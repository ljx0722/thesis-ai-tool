"""
论文文献AI利器 - Python知识图谱服务
Flask后端: HTTP文件服务 + 知识图谱API + 多源文献检索API
数据源: OpenAlex / Crossref / Semantic Scholar / arXiv / CORE / 百度学术
"""
from flask import Flask, request, jsonify, send_file
import math, random, json, re, os, html, time, threading, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

app = Flask(__name__)


# ========== 文件服务 ==========
@app.route('/')
def index():
    return send_file('index.html', mimetype='text/html; charset=utf-8')

@app.route('/<path:filename>')
def serve_static(filename):
    allowed = {'js','css','html','png','jpg','jpeg','svg','ico','woff','woff2','ttf','eot','map'}
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in allowed: return "Not Found", 404
    try: return send_file(filename)
    except FileNotFoundError: return "Not Found", 404


# ========== 辅助函数 ==========
_local = threading.local()

def get_session():
    """Thread-safe: 每线程独立 Session，避免并发损坏连接池"""
    if not HAS_REQUESTS: return None
    if not hasattr(_local, 'session'):
        _local.session = requests.Session()
        _local.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
    return _local.session

def fetch_with_retry(fn, *args, max_retries=2, **kwargs):
    for attempt in range(max_retries + 1):
        try: return fn(*args, **kwargs)
        except Exception: 
            if attempt < max_retries: time.sleep(0.5 * (attempt + 1))
    return None

def fetch_json(url, headers=None, timeout=15):
    """用 requests 获取 JSON，失败时 fallback 到 urllib"""
    if HAS_REQUESTS:
        try:
            s = get_session()
            r = s.get(url, headers=headers, timeout=timeout)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
    # fallback: urllib
    try:
        import urllib.request
        hdrs = headers or {'User-Agent': 'ThesisAI/1.0 (mailto:thesis@wb.com)'}
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception:
        return None

def fetch_text(url, headers=None, timeout=15):
    if HAS_REQUESTS:
        try:
            s = get_session()
            r = s.get(url, headers=headers, timeout=timeout)
            if r.status_code == 200:
                return r.text
        except Exception:
            pass
    try:
        import urllib.request
        hdrs = headers or {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8', errors='ignore')
    except Exception:
        return None

def make_result(title, journal, year, authors, doi, source, is_cn=None):
    if is_cn is None: is_cn = bool(re.search(r'[一-鿿]', title))
    y = year
    try: y = str(int(year)) if year else ''
    except: y = ''
    return {'title': (title or '').strip(), 'journal': (journal or '').strip(),
            'year': y, 'authors': (authors or '').strip(),
            'doi': (doi or '').strip(), 'source': source, 'isCN': is_cn}

def dedup_results(results):
    seen, out = {}, []
    for r in results:
        key = re.sub(r'[^a-z0-9一-鿿]', '', (r['title'] or '').lower())[:80]
        if not key or key in seen:
            existing = seen.get(key)
            if existing:
                if not existing.get('journal') and r.get('journal'): existing['journal'] = r['journal']
                if not existing.get('doi') and r.get('doi'): existing['doi'] = r['doi']
                if not existing.get('authors') and r.get('authors'): existing['authors'] = r['authors']
            continue
        seen[key] = r
        out.append(r)
    return out


# ========== ① OpenAlex (覆盖最广的免费学术API) ==========
def search_openalex(query, max_rows=300):
    results = []
    from urllib.request import quote
    for page in range(1, 5):
        url = f'https://api.openalex.org/works?search={quote(query)}&per_page=200&page={page}&mailto=thesis@wb.com'
        data = fetch_json(url)
        if not data or 'results' not in data or not data['results']: break
        for item in data['results']:
            title = item.get('title', '') or ''
            journal = ''
            if item.get('primary_location') and item['primary_location'].get('source'):
                journal = item['primary_location']['source'].get('display_name', '') or ''
            year = item.get('publication_year', '') or ''
            authors = ', '.join([a.get('author', {}).get('display_name', '') for a in (item.get('authorships') or [])])
            doi = item.get('doi', '') or ''
            results.append(make_result(title, journal, year, authors, doi, 'OA'))
    return results


# ========== ② Crossref (DOI注册中心) ==========
def search_crossref(query, max_rows=100):
    results = []
    from urllib.request import quote
    for offset in range(0, 400, 100):
        if len(results) >= max_rows: break
        data = fetch_json(f'https://api.crossref.org/works?query={quote(query)}&rows=100&offset={offset}&mailto=thesis@wb.com')
        if not data or 'message' not in data: break
        items = data['message'].get('items', [])
        if not items: break
        for item in items:
            title = (item.get('title') or [''])[0] or ''
            journal = (item.get('container-title') or [''])[0] or ''
            dp = (item.get('published-print') or item.get('issued') or {}).get('date-parts', [[]])
            year = (dp[0][0] if dp and dp[0] else '') or ''
            authors = ', '.join([a.get('family', '') for a in (item.get('author') or [])])
            doi = item.get('DOI', '') or ''
            results.append(make_result(title, journal, year, authors, doi, 'CR'))
    return results



# ========== OpenAlex 中文专搜（提高中文文献命中率） ==========
def search_openalex_cn(query, max_rows=200):
    '''OpenAlex with Chinese language filter: 大幅提高中文文献召回率'''
    results = []
    from urllib.request import quote
    for page in range(1, 4):
        if len(results) >= max_rows: break
        url = f'https://api.openalex.org/works?search={quote(query)}&filter=language:zh&per_page=200&page={page}&mailto=thesis@wb.com'
        data = fetch_json(url)
        if not data or 'results' not in data or not data['results']: break
        for item in data['results']:
            title = item.get('title', '') or ''
            journal = ''
            if item.get('primary_location') and item['primary_location'].get('source'):
                journal = item['primary_location']['source'].get('display_name', '') or ''
            year = item.get('publication_year', '') or ''
            authors = ', '.join([a.get('author', {}).get('display_name', '') for a in (item.get('authorships') or [])])
            doi = item.get('doi', '') or ''
            if title: results.append(make_result(title, journal, year, authors, doi, 'OA-CN'))
    return results

# ========== ③ Semantic Scholar (AI/NLP领域强) ==========
def search_semantic_scholar(query, max_rows=100):
    results = []
    from urllib.request import quote
    for offset in range(0, 200, 100):
        if len(results) >= max_rows: break
        url = f'https://api.semanticscholar.org/graph/v1/paper/search?query={quote(query)}&limit=100&offset={offset}&fields=title,year,journal,authors,externalIds'
        data = fetch_json(url)
        if not data or 'data' not in data: break
        items = data.get('data', [])
        if not items: break
        for item in items:
            title = item.get('title', '') or ''
            journal = ''
            jn = item.get('journal')
            if jn: journal = jn.get('name', '') or ''
            year = item.get('year', '') or ''
            authors = ', '.join([a.get('name', '') for a in (item.get('authors') or [])])
            eids = item.get('externalIds') or {}
            doi = eids.get('DOI', '') or ''
            results.append(make_result(title, journal, year, authors, doi, 'S2'))
    return results


# ========== ④ arXiv (物理/CS/数学预印本) ==========
def search_arxiv(query, max_rows=100):
    """arXiv API: http://export.arxiv.org/api/query"""
    results = []
    from urllib.request import quote
    try:
        url = f'http://export.arxiv.org/api/query?search_query=all:{quote(query)}&start=0&max_results={min(max_rows,100)}&sortBy=relevance&sortOrder=descending'
        xml_text = fetch_text(url, timeout=20)
        if not xml_text: return results
        # arXiv API returns Atom XML
        ns = {'atom': 'http://www.w3.org/2005/Atom', 'arxiv': 'http://arxiv.org/schemas/atom'}
        root = ET.fromstring(xml_text)
        for entry in root.findall('atom:entry', ns):
            title_el = entry.find('atom:title', ns)
            title = title_el.text.strip().replace('\n', ' ') if title_el is not None and title_el.text else ''
            journal = 'arXiv preprint'
            # Get year from published date
            published = entry.find('atom:published', ns)
            year = ''
            if published is not None and published.text:
                ym = re.match(r'(\d{4})', published.text)
                if ym: year = ym.group(1)
            # Authors
            authors = []
            for au in entry.findall('atom:author', ns):
                name_el = au.find('atom:name', ns)
                if name_el is not None and name_el.text: authors.append(name_el.text.strip())
            doi = ''
            for link in entry.findall('atom:link', ns):
                href = link.get('href', '')
                if 'doi.org' in href:
                    doi = href.split('doi.org/')[-1]
            results.append(make_result(title, journal, year, ', '.join(authors), doi, 'AX'))
    except Exception:
        pass
    return results


# ========== ⑤ CORE (全球开放获取论文聚合) ==========
def search_core(query, max_rows=100):
    """CORE API v3: 聚合全球开放获取论文"""
    results = []
    from urllib.request import quote
    try:
        # CORE v3 API - 不需要 API key 也能做基础搜索
        for page in range(1, 4):
            if len(results) >= max_rows: break
            url = f'https://api.core.ac.uk/v3/search/works?q={quote(query)}&limit=100&offset={(page-1)*100}'
            data = fetch_json(url, timeout=20)
            if not data or 'results' not in data: break
            for item in data['results']:
                title = item.get('title', '') or ''
                journal = item.get('publisher', '') or item.get('source', '') or ''
                year = str(item.get('yearPublished', '') or '')
                authors = ', '.join([a.get('name', '') for a in (item.get('authors') or [])])
                doi = item.get('doi', '') or ''
                results.append(make_result(title, journal, year, authors, doi, 'CO'))
    except Exception:
        pass
    return results



# ========== PubMed (生命科学/医学免费API) ==========
def search_pubmed(query, max_rows=100):
    """PubMed E-utilities: 免费官方 API，覆盖生物医学/生命科学文献"""
    results = []
    from urllib.request import quote
    try:
        # Step 1: esearch 获取 PMID 列表
        search_url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={quote(query)}&retmax={min(max_rows,100)}&retmode=json&sort=relevance'
        search_data = fetch_json(search_url, timeout=15)
        if not search_data or 'esearchresult' not in search_data: return results
        id_list = search_data['esearchresult'].get('idlist', [])
        if not id_list: return results
        # Step 2: esummary 批量获取详情（每次最多 20 篇）
        for i in range(0, min(len(id_list), max_rows), 20):
            batch = ','.join(id_list[i:i+20])
            summary_url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={batch}&retmode=json'
            summary_data = fetch_json(summary_url, timeout=15)
            if not summary_data or 'result' not in summary_data: continue
            for pmid in id_list[i:i+20]:
                item = summary_data['result'].get(pmid)
                if not item or isinstance(item, str): continue
                title = item.get('title', '') or ''
                journal = item.get('source', '') or item.get('fulljournalname', '') or ''
                year = str(item.get('pubdate', '') or '')[:4]
                authors_list = [a.get('name', '') for a in (item.get('authors', []) or [])]
                authors = ', '.join(authors_list[:5])
                doi = ''
                if item.get('elocationid', '').startswith('doi:'):
                    doi = item['elocationid'].replace('doi:', '').strip()
                if title and len(title) >= 3:
                    results.append(make_result(title, journal, year, authors, doi, 'PM'))
    except Exception: pass
    return results

# ========== ⑥ 百度学术 (HTML抓取, 多页) ==========
def search_baidu_xueshu_page(query, pn):
    results = []
    from urllib.request import quote
    try:
        url = f'https://xueshu.baidu.com/s?wd={quote(query)}&pn={pn}&tn=SE_baiduxueshu_c1g0'
        html_text = fetch_text(url, headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Accept':'text/html','Accept-Language':'zh-CN,zh;q=0.9'}, timeout=15)
        if not html_text: return results
        items = re.findall(r'<h3\s+class="t\s+c_font">(.*?)</h3>(.*?)(?:<h3\s+class="t\s+c_font"|$)', html_text, re.DOTALL)
        for h3_block, rest_block in items[:30]:
            title_m = re.search(r'<a[^>]*>(.*?)</a>', h3_block)
            if not title_m: continue
            title = html.unescape(re.sub(r'<[^>]+>', '', title_m.group(1))).strip()
            journal, year = '', ''
            info_m = re.search(r'class="sc_info"[^>]*>(.*?)</', rest_block)
            if info_m:
                info = html.unescape(re.sub(r'<[^>]+>', '', info_m.group(1))).strip()
                ym = re.search(r'((?:19|20)\d{2})', info)
                if ym: year = ym.group(1)
                jm = re.sub(r'\s*[-—,，]\s*\d{4}.*', '', info).strip()
                if jm and len(jm) < 150: journal = jm
            if title and len(title) >= 3: results.append(make_result(title, journal, year, '', '', 'BD'))
    except: pass
    return results

def search_baidu_xueshu(query, max_rows=80):
    """百度学术公开搜索页抓取 - 翻多页"""
    results = []
    from urllib.request import quote
    try:
        for pn in range(0, min(30, max_rows), 10):
            if len(results) >= max_rows: break
            url = f'https://xueshu.baidu.com/s?wd={quote(query)}&pn={pn}&tn=SE_baiduxueshu_c1g0'
            html_text = fetch_text(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'zh-CN,zh;q=0.9',
            }, timeout=15)
            if not html_text: break
            # 提取每条结果的标题、期刊、年份
            items = re.findall(r'<h3\s+class="t\s+c_font">(.*?)</h3>(.*?)(?:<h3\s+class="t\s+c_font"|$)', html_text, re.DOTALL)
            if not items and pn == 0:
                # 备用模式：百度学术可能改了页面结构，尝试更宽松的匹配
                items = re.findall(r'<h3[^>]*class="[^"]*t[^"]*c_font[^"]*"[^>]*>(.*?)</h3>(.*?)(?:<h3[^>]*class="[^"]*t[^"]*|$)', html_text, re.DOTALL)
            for h3_block, rest_block in items:
                if len(results) >= max_rows: break
                title_m = re.search(r'<a[^>]*>(.*?)</a>', h3_block)
                if not title_m: continue
                title = html.unescape(re.sub(r'<[^>]+>', '', title_m.group(1))).strip()
                journal, year = '', ''
                # 多种可能的期刊信息格式
                info_patterns = [
                    r'class="sc_info"[^>]*>(.*?)</',
                    r'class="[^"]*info[^"]*"[^>]*>(.*?)</',
                    r'<p[^>]*class="[^"]*sc_info[^"]*"[^>]*>(.*?)</p>',
                ]
                for pat in info_patterns:
                    info_m = re.search(pat, rest_block)
                    if info_m:
                        info = html.unescape(re.sub(r'<[^>]+>', '', info_m.group(1))).strip()
                        ym = re.search(r'((?:19|20)\d{2})', info)
                        if ym: year = ym.group(1)
                        jm = re.sub(r'\s*[-—,，]\s*\d{4}.*', '', info).strip()
                        if jm and len(jm) < 150:
                            journal = jm
                        break
                # 额外从 rest_block 提取作者和更多元数据
                authors = ''
                au_m = re.search(r'class="sc_author[^"]*"[^>]*>(.*?)</', rest_block)
                if au_m:
                    authors = html.unescape(re.sub(r'<[^>]+>', '', au_m.group(1))).strip()
                if title and len(title) >= 3:
                    results.append(make_result(title, journal, year, authors, '', 'BD'))
            # 如果某页没结果，停止翻页
            if not items: break
            time.sleep(0.3)  # 礼貌延迟
    except Exception:
        pass
    return results


# ========== 统一检索 API ==========
@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({'ok': True, 'service': '论文文献AI利器', 'sources': ['OpenAlex','OpenAlex-CN','Crossref','Semantic Scholar','arXiv','CORE','PubMed','INSPIRE-HEP','DataCite','DOAJ','万方','百度学术']})

def _run_source(fn, *args):
    """Thread-safe wrapper: 在线程池中安全调用搜索函数"""
    try: return fn(*args) or []
    except: return []

@app.route('/search_api', methods=['POST'])
def search_api():
    try:
        data = request.get_json() or {}
        queries = data.get('queries', [])
        max_per = data.get('max_per_query', 400)
        all_results = []

        for q in queries[:30]:
            if not q.strip(): continue
            is_cn = bool(re.search(r'[一-鿿]', q))

            with ThreadPoolExecutor(max_workers=8) as ex:
                futures = [
                    ex.submit(_run_source, fetch_with_retry, search_openalex, q, max_per),
                    ex.submit(_run_source, search_crossref, q, 100),
                    ex.submit(_run_source, search_semantic_scholar, q, 100),
                ]
                if is_cn:
                    futures.append(ex.submit(_run_source, fetch_with_retry, search_openalex_cn, q, 150))
                    futures.append(ex.submit(_run_source, search_wanfang, q, 50))
                futures.append(ex.submit(_run_source, search_arxiv, q, 100))
                futures.append(ex.submit(_run_source, search_core, q, 80))
                futures.append(ex.submit(_run_source, search_pubmed, q, 100))
                futures.append(ex.submit(_run_source, search_inspirehep, q, 80))
                futures.append(ex.submit(_run_source, search_datacite, q, 80))
                futures.append(ex.submit(_run_source, search_doaj, q, 80))

                for f in as_completed(futures, timeout=20):
                    try: all_results.extend(f.result() or [])
                    except: pass

            # 百度学术并发翻页
            if is_cn:
                try:
                    with ThreadPoolExecutor(max_workers=3) as ex2:
                        bd_futures = [ex2.submit(_run_source, search_baidu_xueshu_page, q, pn) for pn in [0, 10, 20]]
                        for f in as_completed(bd_futures, timeout=12):
                            try: all_results.extend(f.result() or [])
                            except: pass
                except: pass

        all_results = dedup_results(all_results)
        all_results.sort(key=lambda r: r.get('year') or 0, reverse=True)
        cn = sum(1 for r in all_results if r.get('isCN'))
        print(f'[search] {len(queries)} queries -> {len(all_results)} results (CN:{cn} EN:{len(all_results)-cn})')
        return jsonify({'success': True, 'count': len(all_results), 'cn': cn, 'en': len(all_results) - cn, 'results': all_results})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/verify_api', methods=['POST'])
def verify_api():
    """增强版文献校验：DOI精确解析 + 标题多源匹配 + 引用数 + 撤稿检测"""
    try:
        data = request.get_json() or {}
        title = (data.get('title') or '').strip()
        journal = (data.get('journal') or '').strip()
        year = str(data.get('year') or '')
        doi = (data.get('doi') or '').strip()
        if not title or len(title) < 3:
            return jsonify({'success': True, 'score': 0, 'doi': '', 'citations': 0, 'retracted': False, 'pub_type': '', 'verified': False})

        result = {'title': title, 'doi': doi, 'journal': journal, 'year': year,
                  'verified': False, 'score': 0, 'citations': 0, 'retracted': False,
                  'pub_type': '', 'source': '', 'match_title': ''}

        # === 第一步：DOI 精确解析（最可靠） ===
        if doi:
            try:
                cr_doi = fetch_json(f'https://api.crossref.org/works/{doi}', timeout=10)
                if cr_doi and 'message' in cr_doi:
                    msg = cr_doi['message']
                    result['verified'] = True
                    result['doi'] = doi
                    result['match_title'] = (msg.get('title') or [''])[0] or title
                    result['journal'] = (msg.get('container-title') or [''])[0] or journal
                    dp = msg.get('published-print') or msg.get('issued') or msg.get('created') or {}
                    dp2 = dp.get('date-parts', [[None]])[0]
                    result['year'] = str(dp2[0]) if dp2 else year
                    result['pub_type'] = msg.get('type', '')
                    result['source'] = 'DOI (Crossref)'
                    result['score'] = 95  # DOI verified = near-certain
                    # 获取引用数
                    oa_doi = fetch_json(f'https://api.openalex.org/works/doi:{doi}', timeout=10)
                    if oa_doi:
                        result['citations'] = oa_doi.get('cited_by_count', 0) or 0
                        result['retracted'] = bool(oa_doi.get('is_retracted', False))
                    return jsonify({'success': True, **result})
            except: pass

        # === 第二步：多源标题匹配 ===
        matches = []
        from urllib.request import quote

        # OpenAlex
        oa_data = fetch_json(f'https://api.openalex.org/works?search={quote(title[:200])}&per_page=3&mailto=thesis@wb.com')
        if oa_data and 'results' in oa_data:
            for item in oa_data['results']:
                at = item.get('title', '') or ''
                aj = ''; lp = item.get('primary_location')
                if lp and lp.get('source'): aj = lp['source'].get('display_name', '') or ''
                ay = str(item.get('publication_year', '') or '')
                ad = item.get('doi', '') or ''
                ac = item.get('cited_by_count', 0) or 0
                ar = bool(item.get('is_retracted', False))
                matches.append({'title': at, 'journal': aj, 'year': ay, 'doi': ad, 'citations': ac, 'retracted': ar, 'source': 'OA'})

        # Crossref
        cr_data = fetch_json(f'https://api.crossref.org/works?query={quote(title[:200])}&rows=3&mailto=thesis@wb.com')
        if cr_data and 'message' in cr_data:
            for item in cr_data['message'].get('items', []):
                at = (item.get('title') or [''])[0] or ''
                aj = (item.get('container-title') or [''])[0] or ''
                dp = (item.get('published-print') or item.get('issued') or {}).get('date-parts', [[]])
                ay = str((dp[0][0] if dp and dp[0] else '') or '')
                ad = item.get('DOI', '') or ''
                ap = item.get('type', '')
                ac = item.get('is-referenced-by-count', 0) or 0
                matches.append({'title': at, 'journal': aj, 'year': ay, 'doi': ad, 'citations': ac, 'retracted': False, 'pub_type': ap, 'source': 'CR'})

        # Semantic Scholar
        s2_data = fetch_json(f'https://api.semanticscholar.org/graph/v1/paper/search?query={quote(title[:200])}&limit=3&fields=title,year,journal,externalIds,citationCount,publicationTypes')
        if s2_data and 'data' in s2_data:
            for item in s2_data['data']:
                at = item.get('title', '') or ''
                jn = item.get('journal') or {}
                aj = jn.get('name', '') or ''
                ay = str(item.get('year', '') or '')
                eids = item.get('externalIds') or {}
                ad = eids.get('DOI', '') or ''
                ac = item.get('citationCount', 0) or 0
                apts = item.get('publicationTypes', []) or []
                ap = apts[0] if apts else ''
                matches.append({'title': at, 'journal': aj, 'year': ay, 'doi': ad, 'citations': ac, 'retracted': False, 'pub_type': ap, 'source': 'S2'})

        # === 第三步：评分（标题 + 年份 + 期刊三维匹配） ===
        na = re.sub(r'[^a-z0-9一-鿿]', '', title.lower())
        nj2 = re.sub(r'[^a-z0-9一-鿿]', '', journal.lower())

        best = {'score': 0, 'doi': '', 'citations': 0, 'retracted': False, 'pub_type': '', 'source': '', 'match_title': ''}
        for m in matches:
            nb = re.sub(r'[^a-z0-9一-鿿]', '', m['title'].lower())
            nk = re.sub(r'[^a-z0-9一-鿿]', '', m['journal'].lower())
            s = 0

            # 标题匹配 (0-50)
            if na and nb:
                if na == nb: s += 50
                elif len(na) > 10 and len(nb) > 10 and (nb in na or na in nb): s += 40
                elif len(na) > 8 and len(nb) > 8 and (nb[:20] in na or na[:20] in nb): s += 25
                else:
                    common = sum(1 for i in range(min(len(na), len(nb))) if na[i] == nb[i])
                    s += min(20, round(common / max(1, max(len(na), len(nb))) * 25))

            # 期刊匹配 (0-25)
            if nj2 and nk:
                if nk in nj2 or nj2 in nk: s += 25
                elif len(nk) > 5 and len(nj2) > 5 and (nk[:6] in nj2 or nj2[:6] in nk): s += 15
                elif len(nk) > 3 and len(nj2) > 3 and (nk[:4] in nj2 or nj2[:4] in nk): s += 8

            # 年份匹配 (0-25)
            if year and m['year']:
                try:
                    dy = abs(int(m['year']) - int(year))
                    if dy == 0: s += 25
                    elif dy <= 1: s += 20
                    elif dy <= 3: s += 12
                    elif dy <= 5: s += 5
                except: pass

            if s > best['score']:
                best = {'score': s, 'doi': m.get('doi', ''), 'citations': m.get('citations', 0),
                        'retracted': m.get('retracted', False), 'pub_type': m.get('pub_type', ''),
                        'source': m.get('source', ''), 'match_title': m.get('title', '')}

        result['verified'] = best['score'] >= 50
        result['score'] = min(95, best['score'])
        result['doi'] = best['doi'] or doi
        result['citations'] = best['citations']
        result['retracted'] = best['retracted']
        result['pub_type'] = best.get('pub_type', '')
        result['source'] = best.get('source', '')
        result['match_title'] = best.get('match_title', '')

        return jsonify({'success': True, **result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ========== 知识图谱 API (不变) ==========
def build_knowledge_graph(paper_topics, sections, merged_refs, manuscript_text=''):
    entities, links, link_set = [], [], set()
    for i, topic in enumerate(paper_topics[:15]):
        entities.append({'id': f'topic_{i}', 'label': topic.get('label', f'主题{i}')[:12], 'fullLabel': topic.get('label', ''), 'count': topic.get('count', 0), 'type': 'keyword', 'radius': 5 + min(topic.get('count', 1) * 0.5, 8)})
    chapter_entities = []
    for cs in sections:
        chapter_entities.append({'id': f'ch_{cs["ch"]}', 'label': cs['name'][:12], 'fullLabel': cs['name'], 'type': 'chapter', 'radius': 12})
        if cs.get('sections'):
            for sec in cs['sections']:
                entities.append({'id': f'sec_{sec["num"].replace(".", "_")}', 'label': sec['title'][:10], 'fullLabel': f"{sec['num']} {sec['title']}", 'type': 'section', 'parent': f'ch_{cs["ch"]}', 'radius': 7})
                links.append({'source': f'ch_{cs["ch"]}', 'target': f'sec_{sec["num"].replace(".", "_")}', 'type': 'has', 'id': f'ch_sec_{cs["ch"]}_{sec["num"]}'})
                if sec.get('subs'):
                    for sub in sec['subs'][:3]:
                        entities.append({'id': f'sub_{sub["num"].replace(".", "_")}', 'label': sub['title'][:12], 'fullLabel': f"{sub['num']} {sub['title']}", 'type': 'subsection', 'parent': f'sec_{sec["num"].replace(".", "_")}', 'radius': 5})
    entities.extend(chapter_entities)
    for ri, r in enumerate(merged_refs[:30]):
        if r.get('title'):
            entities.append({'id': f'ref_{ri}', 'label': r['title'][:30] + ('...' if len(r['title']) > 30 else ''), 'fullLabel': r['title'], 'count': r.get('conf', 0), 'type': 'reference', 'radius': 4 + min(r.get('conf', 0) * 0.1, 6)})
    text_lower = (manuscript_text or '').lower()
    for i, topic in enumerate(paper_topics[:15]):
        kw = topic.get('label', '').lower()
        if not kw: continue
        for cs in sections:
            cht = (cs.get('text', '') or '').lower()
            if kw in (cht if cht else text_lower):
                lid = f'kw_ch_{i}_{cs["ch"]}'
                if lid not in link_set: links.append({'source': f'topic_{i}', 'target': f'ch_{cs["ch"]}', 'type': 'in', 'id': lid}); link_set.add(lid)
        for ri, r in enumerate(merged_refs[:30]):
            if kw in (r.get('title', '') or '').lower():
                lid = f'kw_ref_{i}_{ri}'
                if lid not in link_set: links.append({'source': f'topic_{i}', 'target': f'ref_{ri}', 'type': 'related', 'id': lid}); link_set.add(lid)
    for ri, r in enumerate(merged_refs[:30]):
        if r.get('ch'):
            lid = f'ch_ref_{r["ch"]}_{ri}'
            if lid not in link_set: links.append({'source': f'ch_{r["ch"]}', 'target': f'ref_{ri}', 'type': 'cites', 'id': lid}); link_set.add(lid)
    positions = compute_force_layout(entities, links)
    for e in entities:
        if e['id'] in positions: e['x'], e['y'] = positions[e['id']]['x'], positions[e['id']]['y']
    return {'entities': entities, 'links': links}

def compute_force_layout(entities, links, width=1400, height=800, iterations=80):
    pos = {e['id']: {'x': random.uniform(100, width - 100), 'y': random.uniform(100, height - 100), 'vx': 0, 'vy': 0} for e in entities}
    cx, cy, r = width / 2, height / 2, min(width, height) * 0.3
    for i, e in enumerate([x for x in entities if x['type'] == 'keyword']):
        a = (i / max(len(entities) or 1, 1)) * 2 * math.pi - math.pi / 2
        pos[e['id']] = {'x': cx + math.cos(a) * r * 1.1, 'y': cy + math.sin(a) * r * 1.1, 'vx': 0, 'vy': 0}
    for i, e in enumerate([x for x in entities if x['type'] == 'chapter']):
        a = (i / max(len(entities) or 1, 1)) * 2 * math.pi - math.pi / 2
        pos[e['id']] = {'x': cx + math.cos(a) * r * 0.7, 'y': cy + math.sin(a) * r * 0.7, 'vx': 0, 'vy': 0}
    for i, e in enumerate([x for x in entities if x['type'] == 'reference']):
        a = (i / max(len(entities) or 1, 1)) * 2 * math.pi - math.pi / 2
        pos[e['id']] = {'x': cx + math.cos(a) * r * 0.4, 'y': cy + math.sin(a) * r * 0.4, 'vx': 0, 'vy': 0}
    ids = {e['id'] for e in entities}
    for _ in range(iterations):
        for i in range(len(entities)):
            for j in range(i + 1, len(entities)):
                p1, p2 = pos[entities[i]['id']], pos[entities[j]['id']]
                dx, dy = p2['x'] - p1['x'], p2['y'] - p1['y']; d = math.sqrt(dx * dx + dy * dy) or 1; f = 400 / d
                p1['vx'] -= dx / d * f; p1['vy'] -= dy / d * f; p2['vx'] += dx / d * f; p2['vy'] += dy / d * f
        for l in links:
            if l['source'] in ids and l['target'] in ids:
                p1, p2 = pos[l['source']], pos[l['target']]
                dx, dy = p2['x'] - p1['x'], p2['y'] - p1['y']
                p1['vx'] += dx * 0.02; p1['vy'] += dy * 0.02; p2['vx'] -= dx * 0.02; p2['vy'] -= dy * 0.02
        for e in entities:
            p = pos[e['id']]; p['vx'] *= 0.85; p['vy'] *= 0.85; p['x'] += p['vx']; p['y'] += p['vy']
            p['x'] = max(50, min(width - 50, p['x'])); p['y'] = max(50, min(height - 50, p['y']))
    return pos

@app.route('/kg_api/generate', methods=['POST'])
def kg_api():
    try:
        data = request.get_json() or {}
        result = build_knowledge_graph(data.get('paper_topics', []), data.get('sections', []), data.get('merged_refs', []), data.get('manuscript_text', ''))
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("论文文献AI利器 - Python知识图谱服务")
    print("=" * 50)
    print(f"HTTP库: {'requests (推荐)' if HAS_REQUESTS else 'urllib (建议 pip install requests)'}")
    print("数据源: OpenAlex | OpenAlex-CN | Crossref | Semantic Scholar | arXiv | CORE | PubMed | INSPIRE-HEP | DataCite | DOAJ | 万方 | 百度学术")
    print("访问: http://localhost:5000")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=False)
# ========== INSPIRE-HEP (高能物理/核物理/天体物理) ==========
def search_inspirehep(query, max_rows=100):
    '''INSPIRE-HEP: CERN 维护，覆盖高能物理、核物理、天体物理、加速器物理'''
    results = []
    from urllib.request import quote
    try:
        for page in range(1, 4):
            if len(results) >= max_rows: break
            url = f'https://inspirehep.net/api/literature?q={quote(query)}&size=100&page={page}&sort=mostrecent'
            data = fetch_json(url, timeout=15)
            if not data or 'hits' not in data: break
            hits = data['hits'].get('hits', [])
            if not hits: break
            for item in hits:
                metadata = item.get('metadata', {})
                title = metadata.get('titles', [{}])[0].get('title', '') or ''
                journal = ''
                pub_info = metadata.get('publication_info', [])
                if pub_info:
                    jn = pub_info[0].get('journal_title', '') or ''
                    if jn: journal = jn
                year = str(metadata.get('publication_info', [{}])[0].get('year', '') or '')
                authors = ', '.join([a.get('full_name', '') for a in (metadata.get('authors', []) or [])[:6]])
                doi = metadata.get('dois', [{}])[0].get('value', '') or ''
                if title and len(title) >= 3:
                    results.append(make_result(title, journal, year, authors, doi, 'IN'))
    except Exception: pass
    return results


# ========== DataCite (数据集/灰色文献/预印本) ==========
def search_datacite(query, max_rows=100):
    '''DataCite: DOI 注册中心，覆盖数据集、软件、预印本、灰色文献'''
    results = []
    from urllib.request import quote
    try:
        for offset in range(0, 200, 100):
            if len(results) >= max_rows: break
            url = f'https://api.datacite.org/dois?query={quote(query)}&page[size]=100&page[number]={offset//100+1}&sort=relevance'
            data = fetch_json(url, timeout=15)
            if not data or 'data' not in data: break
            items = data.get('data', [])
            if not items: break
            for item in items:
                attrs = item.get('attributes', {})
                titles = attrs.get('titles', [])
                title = titles[0].get('title', '') if titles else ''
                if not title: continue
                journal = attrs.get('publisher', '') or attrs.get('container', {}).get('title', '') or ''
                year = str(attrs.get('publicationYear', '') or '')
                authors = ', '.join([a.get('name', '') for a in (attrs.get('creators', []) or [])[:5]])
                doi = attrs.get('doi', '') or item.get('id', '').replace('https://doi.org/', '')
                rtype = attrs.get('types', {}).get('resourceTypeGeneral', '')
                if rtype and rtype not in ('Text', 'JournalArticle'):
                    journal = rtype + ' · ' + (journal or 'DataCite')
                results.append(make_result(title, journal, year, authors, doi, 'DC'))
    except Exception: pass
    return results


# ========== DOAJ (开放获取期刊文章) ==========
def search_doaj(query, max_rows=100):
    '''DOAJ: Directory of Open Access Journals，覆盖全球开放获取期刊'''
    results = []
    from urllib.request import quote
    try:
        for page in range(1, 4):
            if len(results) >= max_rows: break
            url = f'https://doaj.org/api/search/articles/{quote(query)}?page={page}&pageSize=50'
            data = fetch_json(url, timeout=15)
            if not data or 'results' not in data: break
            items = data.get('results', [])
            if not items: break
            for item in items:
                bib = item.get('bibjson', {})
                title = bib.get('title', '') or ''
                journal = ''
                jn = bib.get('journal', {})
                if jn: journal = jn.get('title', '') or ''
                year = str(bib.get('year', '') or '')
                authors = ', '.join([a.get('name', '') for a in (bib.get('author', []) or [])[:5]])
                doi = ''
                ids = bib.get('identifier', [])
                for ido in ids:
                    if ido.get('type') == 'doi': doi = ido.get('id', ''); break
                if title and len(title) >= 3:
                    results.append(make_result(title, journal, year, authors, doi, 'DJ'))
    except Exception: pass
    return results


# ========== 万方数据 (公开搜索页抓取) ==========
def search_wanfang(query, max_rows=60):
    '''万方数据公开搜索页: 中文期刊/学位论文'''
    results = []
    from urllib.request import quote
    try:
        for pn in range(0, min(30, max_rows), 10):
            if len(results) >= max_rows: break
            url = f'https://s.wanfangdata.com.cn/paper?q={quote(query)}&p={pn}'
            html_text = fetch_text(url, headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Accept':'text/html','Accept-Language':'zh-CN,zh;q=0.9'}, timeout=15)
            if not html_text: break
            # 万方搜索结果格式: <div class="record-item"> ... <a class="title">标题</a> ... <span class="source">期刊 年份</span>
            items = re.findall(r'<div[^>]*class="[^"]*record-item[^"]*"[^>]*>(.*?)</div>\s*</div>\s*</div>', html_text, re.DOTALL)
            if not items:
                # Fallback pattern
                items = re.findall(r'<a[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)</a>', html_text)
                for title_text in items[:10]:
                    title = html.unescape(re.sub(r'<[^>]+>', '', title_text)).strip()
                    if title and len(title) >= 3:
                        results.append(make_result(title, '', '', '', '', 'WF'))
                break
            for item_block in items[:30]:
                title_m = re.search(r'<a[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)</a>', item_block)
                if not title_m: continue
                title = html.unescape(re.sub(r'<[^>]+>', '', title_m.group(1))).strip()
                journal, year = '', ''
                src_m = re.search(r'class="[^"]*source[^"]*"[^>]*>(.*?)</', item_block)
                if src_m:
                    src_text = html.unescape(re.sub(r'<[^>]+>', '', src_m.group(1))).strip()
                    ym = re.search(r'((?:19|20)\d{2})', src_text)
                    if ym: year = ym.group(1)
                    journal = re.sub(r'\s*[-—]\s*\d{4}.*', '', src_text).strip()
                if title and len(title) >= 3:
                    results.append(make_result(title, journal, year, '', '', 'WF'))
            if not items: break
            time.sleep(0.3)
    except Exception: pass
    return results


