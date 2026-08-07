"""
搜索 Blueprint - 多源学术检索引擎
"""
import os
import re
import time
import secrets
import json
import html as html_mod
import xml.etree.ElementTree as ET
from urllib.request import quote
from concurrent.futures import ThreadPoolExecutor, as_completed

from flask import Blueprint, request, jsonify

from backend.database import get_db
from backend.auth import require_auth
from backend.billing import get_price, deduct_credits
from backend.utils.time_utils import today_beijing, now_beijing_str

search_bp = Blueprint('search', __name__, url_prefix='')


# ── 速率限制 ──
_rate_buckets = {}

def _check_rate(key, max_calls=30, window_sec=60):
    now = time.time()
    bucket = _rate_buckets.setdefault(key, [])
    _rate_buckets[key] = [t for t in bucket if now - t < window_sec]
    if len(_rate_buckets[key]) >= max_calls:
        return False
    _rate_buckets[key].append(now)
    return True


# ── 通用 HTTP 抓取 ──
import threading
import requests as req_lib

HAS_REQUESTS = True
_local = threading.local()


def get_session():
    if not hasattr(_local, 'session'):
        _local.session = req_lib.Session()
        _local.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
    return _local.session


def fetch_json(url, headers=None, timeout=15):
    try:
        s = get_session()
        r = s.get(url, headers=headers, timeout=timeout)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    try:
        import urllib.request as ur
        hdrs = headers or {'User-Agent': 'ThesisAI/1.0'}
        req = ur.Request(url, headers=hdrs)
        with ur.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception:
        return None


def fetch_text(url, headers=None, timeout=15):
    try:
        s = get_session()
        r = s.get(url, headers=headers, timeout=timeout)
        if r.status_code == 200:
            return r.text
    except Exception:
        pass
    try:
        import urllib.request as ur
        hdrs = headers or {'User-Agent': 'Mozilla/5.0'}
        req = ur.Request(url, headers=hdrs)
        with ur.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8', errors='ignore')
    except Exception:
        return None


def fetch_with_retry(fn, *args, max_retries=2, **kwargs):
    for attempt in range(max_retries + 1):
        try:
            return fn(*args, **kwargs)
        except Exception:
            if attempt < max_retries:
                time.sleep(0.5 * (attempt + 1))
    return None


# ── 数据模型 ──
def make_result(title, journal, year, authors, doi, source, is_cn=None):
    if is_cn is None:
        is_cn = bool(re.search(r'[一-鿿]', title))
    y = year
    try:
        y = str(int(year)) if year else ''
    except Exception:
        y = ''
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
                if not existing.get('journal') and r.get('journal'):
                    existing['journal'] = r['journal']
                if not existing.get('doi') and r.get('doi'):
                    existing['doi'] = r['doi']
                if not existing.get('authors') and r.get('authors'):
                    existing['authors'] = r['authors']
            continue
        seen[key] = r
        out.append(r)
    return out


# ── 学术源适配器 ──

def search_openalex(query, max_rows=300):
    results = []
    for page in range(1, 5):
        url = f'https://api.openalex.org/works?search={quote(query)}&per_page=200&page={page}&mailto=thesis@wb.com'
        data = fetch_json(url)
        if not data or 'results' not in data or not data['results']:
            break
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


def search_openalex_cn(query, max_rows=200):
    results = []
    for page in range(1, 4):
        if len(results) >= max_rows:
            break
        url = f'https://api.openalex.org/works?search={quote(query)}&filter=language:zh&per_page=200&page={page}&mailto=thesis@wb.com'
        data = fetch_json(url)
        if not data or 'results' not in data or not data['results']:
            break
        for item in data['results']:
            title = item.get('title', '') or ''
            journal = ''
            if item.get('primary_location') and item['primary_location'].get('source'):
                journal = item['primary_location']['source'].get('display_name', '') or ''
            year = item.get('publication_year', '') or ''
            authors = ', '.join([a.get('author', {}).get('display_name', '') for a in (item.get('authorships') or [])])
            doi = item.get('doi', '') or ''
            if title:
                results.append(make_result(title, journal, year, authors, doi, 'OA-CN'))
    return results


def search_crossref(query, max_rows=100):
    results = []
    for offset in range(0, 400, 100):
        if len(results) >= max_rows:
            break
        data = fetch_json(f'https://api.crossref.org/works?query={quote(query)}&rows=100&offset={offset}&mailto=thesis@wb.com')
        if not data or 'message' not in data:
            break
        items = data['message'].get('items', [])
        if not items:
            break
        for item in items:
            title = (item.get('title') or [''])[0] or ''
            journal = (item.get('container-title') or [''])[0] or ''
            dp = (item.get('published-print') or item.get('issued') or {}).get('date-parts', [[]])
            year = (dp[0][0] if dp and dp[0] else '') or ''
            authors = ', '.join([a.get('family', '') for a in (item.get('author') or [])])
            doi = item.get('DOI', '') or ''
            results.append(make_result(title, journal, year, authors, doi, 'CR'))
    return results


def search_semantic_scholar(query, max_rows=100):
    results = []
    for offset in range(0, 200, 100):
        if len(results) >= max_rows:
            break
        url = f'https://api.semanticscholar.org/graph/v1/paper/search?query={quote(query)}&limit=100&offset={offset}&fields=title,year,journal,authors,externalIds'
        data = fetch_json(url)
        if not data or 'data' not in data:
            break
        items = data.get('data', [])
        if not items:
            break
        for item in items:
            title = item.get('title', '') or ''
            journal = ''
            jn = item.get('journal')
            if jn:
                journal = jn.get('name', '') or ''
            year = item.get('year', '') or ''
            authors = ', '.join([a.get('name', '') for a in (item.get('authors') or [])])
            eids = item.get('externalIds') or {}
            doi = eids.get('DOI', '') or ''
            results.append(make_result(title, journal, year, authors, doi, 'S2'))
    return results


def search_arxiv(query, max_rows=100):
    results = []
    try:
        url = f'http://export.arxiv.org/api/query?search_query=all:{quote(query)}&start=0&max_results={min(max_rows,100)}&sortBy=relevance&sortOrder=descending'
        xml_text = fetch_text(url, timeout=20)
        if not xml_text:
            return results
        ns = {'atom': 'http://www.w3.org/2005/Atom', 'arxiv': 'http://arxiv.org/schemas/atom'}
        root = ET.fromstring(xml_text)
        for entry in root.findall('atom:entry', ns):
            title_el = entry.find('atom:title', ns)
            title = title_el.text.strip().replace('\n', ' ') if title_el is not None and title_el.text else ''
            published = entry.find('atom:published', ns)
            year = ''
            if published is not None and published.text:
                ym = re.match(r'(\d{4})', published.text)
                if ym:
                    year = ym.group(1)
            authors = []
            for au in entry.findall('atom:author', ns):
                name_el = au.find('atom:name', ns)
                if name_el is not None and name_el.text:
                    authors.append(name_el.text.strip())
            doi = ''
            for link in entry.findall('atom:link', ns):
                href = link.get('href', '')
                if 'doi.org' in href:
                    doi = href.split('doi.org/')[-1]
            results.append(make_result(title, 'arXiv preprint', year, ', '.join(authors), doi, 'AX'))
    except Exception:
        pass
    return results


def search_pubmed(query, max_rows=100):
    results = []
    try:
        search_url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={quote(query)}&retmax={min(max_rows,100)}&retmode=json&sort=relevance'
        search_data = fetch_json(search_url, timeout=15)
        if not search_data or 'esearchresult' not in search_data:
            return results
        id_list = search_data['esearchresult'].get('idlist', [])
        if not id_list:
            return results
        for i in range(0, min(len(id_list), max_rows), 20):
            batch = ','.join(id_list[i:i + 20])
            summary_url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={batch}&retmode=json'
            summary_data = fetch_json(summary_url, timeout=15)
            if not summary_data or 'result' not in summary_data:
                continue
            for pmid in id_list[i:i + 20]:
                item = summary_data['result'].get(pmid)
                if not item or isinstance(item, str):
                    continue
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
    except Exception:
        pass
    return results


def search_core(query, max_rows=100):
    results = []
    try:
        for page in range(1, 4):
            if len(results) >= max_rows:
                break
            url = f'https://api.core.ac.uk/v3/search/works?q={quote(query)}&limit=100&offset={(page-1)*100}'
            data = fetch_json(url, timeout=20)
            if not data or 'results' not in data:
                break
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


def search_europepmc(query, max_rows=100):
    results = []
    try:
        for offset in range(0, 300, 100):
            if len(results) >= max_rows:
                break
            url = f'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={quote(query)}&resultType=core&pageSize=100&cursorMark=*&format=json'
            data = fetch_json(url, timeout=15)
            if not data or 'resultList' not in data:
                break
            items = data['resultList'].get('result', [])
            if not items:
                break
            for item in items:
                title = item.get('title', '') or ''
                journal = item.get('journalTitle', '') or ''
                year = str(item.get('pubYear', '') or '')
                authors = item.get('authorString', '') or ''
                doi = item.get('doi', '') or ''
                results.append(make_result(title, journal, year, authors, doi, 'EP'))
    except Exception:
        pass
    return results


def search_doaj(query, max_rows=100):
    results = []
    try:
        url = f'https://doaj.org/api/search/articles/{quote(query)}?pageSize={min(max_rows, 100)}&page=1'
        data = fetch_json(url, timeout=15)
        if not data or 'results' not in data:
            return results
        for item in data['results']:
            bib = item.get('bibjson', {})
            title = bib.get('title', '') or ''
            journal = bib.get('journal', {}).get('title', '') or ''
            year = str(bib.get('year', '') or '')
            authors = ', '.join([a.get('name', '') for a in (bib.get('author', []) or [])])
            doi = ''
            for identifier in bib.get('identifier', []):
                if identifier.get('type') == 'doi':
                    doi = identifier.get('id', '')
            results.append(make_result(title, journal, year, authors, doi, 'DJ'))
    except Exception:
        pass
    return results


def search_baidu_xueshu(query, max_rows=80):
    results = []
    try:
        for pn in range(0, min(30, max_rows), 10):
            if len(results) >= max_rows:
                break
            url = f'https://xueshu.baidu.com/s?wd={quote(query)}&pn={pn}&tn=SE_baiduxueshu_c1g0'
            html_text = fetch_text(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'zh-CN,zh;q=0.9',
            }, timeout=15)
            if not html_text:
                break
            items = re.findall(r'<h3\s+class="t\s+c_font">(.*?)</h3>(.*?)(?:<h3\s+class="t\s+c_font"|$)', html_text, re.DOTALL)
            if not items and pn == 0:
                items = re.findall(r'<h3[^>]*class="[^"]*t[^"]*c_font[^"]*"[^>]*>(.*?)</h3>(.*?)(?:<h3[^>]*class="[^"]*t[^"]*|$)', html_text, re.DOTALL)
            for h3_block, rest_block in items:
                if len(results) >= max_rows:
                    break
                title_m = re.search(r'<a[^>]*>(.*?)</a>', h3_block)
                if not title_m:
                    continue
                title = html_mod.unescape(re.sub(r'<[^>]+>', '', title_m.group(1))).strip()
                journal, year = '', ''
                info_patterns = [
                    r'class="sc_info"[^>]*>(.*?)</',
                    r'class="[^"]*info[^"]*"[^>]*>(.*?)</',
                    r'<p[^>]*class="[^"]*sc_info[^"]*"[^>]*>(.*?)</p>',
                ]
                for pat in info_patterns:
                    info_m = re.search(pat, rest_block)
                    if info_m:
                        info = html_mod.unescape(re.sub(r'<[^>]+>', '', info_m.group(1))).strip()
                        ym = re.search(r'((?:19|20)\d{2})', info)
                        if ym:
                            year = ym.group(1)
                        jm = re.sub(r'\s*[-—,，]\s*\d{4}.*', '', info).strip()
                        if jm and len(jm) < 150:
                            journal = jm
                        break
                authors = ''
                au_m = re.search(r'class="sc_author[^"]*"[^>]*>(.*?)</', rest_block)
                if au_m:
                    authors = html_mod.unescape(re.sub(r'<[^>]+>', '', au_m.group(1))).strip()
                if title and len(title) >= 3:
                    results.append(make_result(title, journal, year, authors, '', 'BD'))
            if not items:
                break
            time.sleep(0.3)
    except Exception:
        pass
    return results


def search_cnki(query, max_rows=50):
    """CNKI 搜索（简化版，实际需处理反爬）"""
    return []


def search_wanfang(query, max_rows=50):
    """万方搜索（简化版）"""
    return []


# ── 搜索 API ──

@search_bp.route('/search_api', methods=['POST'])
@require_auth
def search_api():
    """单词搜索：多源聚合。需登录；限流 + 日免费后扣点。"""
    uid = getattr(request, 'user_id', None) or request.remote_addr or 'unknown'
    if not _check_rate('search:' + str(uid), max_calls=30, window_sec=60):
        return jsonify({'success': False, 'error': '检索过于频繁，请稍后再试'}), 429
    if not _check_rate('search_ip:' + str(request.remote_addr or 'unknown'), max_calls=60, window_sec=60):
        return jsonify({'success': False, 'error': '检索过于频繁，请稍后再试'}), 429

    # 日免费额度
    SEARCH_DAILY_FREE = int(os.environ.get('SEARCH_DAILY_FREE', '20'))
    db = get_db()
    try:
        today = today_beijing().isoformat()
        used = db.execute(
            "SELECT COUNT(*) as c FROM transactions WHERE user_id=? AND type='usage' "
            "AND description LIKE ? AND created_at LIKE ?",
            (request.user_id, '文献检索%', today + '%')
        ).fetchone()['c']
        if used < SEARCH_DAILY_FREE:
            u = db.execute('SELECT credits FROM users WHERE id=?', (request.user_id,)).fetchone()
            after = u['credits'] if u else 0
            db.execute(
                "INSERT INTO transactions (user_id, type, amount_credits, credits_after, description, created_at) "
                "VALUES (?,?,?,?,?,datetime('now','localtime'))",
                (request.user_id, 'usage', 0, after, f'文献检索:free({used+1}/{SEARCH_DAILY_FREE})'))
            db.commit()
            usage_meta = {
                'free': True, 'cost': 0, 'cost_points': 0,
                'free_used': used + 1, 'free_limit': SEARCH_DAILY_FREE,
                'free_remaining': max(0, SEARCH_DAILY_FREE - used - 1),
                'credits_after': after, 'points_after': round((after or 0) / 1000, 3)
            }
        else:
            db.close()
            price = get_price('search')
            ok, err, after = deduct_credits(request.user_id, price, '文献检索:paid')
            if not ok:
                needed = price / 1000
                return jsonify({'success': False, 'error': err or '点数不足', 'needed_points': needed}), 402
            usage_meta = {
                'free': False, 'cost': price, 'cost_points': round(price / 1000, 3),
                'free_used': used, 'free_limit': SEARCH_DAILY_FREE, 'free_remaining': 0,
                'credits_after': after, 'points_after': round((after or 0) / 1000, 3)
            }
    finally:
        pass  # db already closed in the free path above
    if usage_meta.get('free'):
        db.close()

    try:
        data = request.get_json() or {}
        queries = data.get('queries', [])
        max_per = min(int(data.get('max_per_query', 100) or 100), 100)
        all_results = []

        for q in queries[:8]:
            if not q.strip():
                continue
            is_cn = bool(re.search(r'[一-鿿]', q))

            for source_fn in [
                lambda q=q: fetch_with_retry(search_openalex, q, min(max_per, 100)),
                lambda q=q: search_crossref(q, 50),
                lambda q=q: search_semantic_scholar(q, 50),
                lambda q=q: search_europepmc(q, 40),
                lambda q=q: search_arxiv(q, 30),
                lambda q=q: search_pubmed(q, 30),
            ]:
                try:
                    all_results.extend(source_fn() or [])
                except Exception:
                    pass

            if is_cn:
                try:
                    all_results.extend(search_baidu_xueshu(q, 30) or [])
                except Exception:
                    pass
                try:
                    all_results.extend(search_cnki(q, 30) or [])
                except Exception:
                    pass
                try:
                    all_results.extend(search_openalex_cn(q, 50) or [])
                except Exception:
                    pass
            else:
                try:
                    all_results.extend(search_core(q, 30) or [])
                except Exception:
                    pass
                try:
                    all_results.extend(search_doaj(q, 20) or [])
                except Exception:
                    pass

        all_results = dedup_results(all_results)
        all_results.sort(key=lambda r: r.get('year') or 0, reverse=True)
        cn = sum(1 for r in all_results if r.get('isCN'))
        return jsonify({'success': True, 'count': len(all_results), 'cn': cn, 'en': len(all_results) - cn,
                        'results': all_results, 'usage': usage_meta})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@search_bp.route('/verify_api', methods=['POST'])
@require_auth
def verify_api():
    """文献校验：DOI 精确解析 + 多源标题匹配。"""
    uid = getattr(request, 'user_id', None) or request.remote_addr or 'unknown'
    if not _check_rate('verify:' + str(uid), max_calls=60, window_sec=60):
        return jsonify({'success': False, 'error': '校验过于频繁，请稍后再试'}), 429
    try:
        data = request.get_json() or {}
        title = (data.get('title') or '').strip()
        journal = (data.get('journal') or '').strip()
        year = str(data.get('year') or '')
        doi = (data.get('doi') or '').strip()
        if not title or len(title) < 3:
            return jsonify({'success': True, 'score': 0, 'doi': '', 'citations': 0, 'retracted': False,
                            'pub_type': '', 'verified': False})

        result = {'title': title, 'doi': doi, 'journal': journal, 'year': year,
                  'verified': False, 'score': 0, 'citations': 0, 'retracted': False,
                  'pub_type': '', 'source': '', 'match_title': ''}

        # DOI 精确解析
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
                    result['score'] = 95
                    oa_doi = fetch_json(f'https://api.openalex.org/works/doi:{doi}', timeout=10)
                    if oa_doi:
                        result['citations'] = oa_doi.get('cited_by_count', 0) or 0
                        result['retracted'] = bool(oa_doi.get('is_retracted', False))
                    return jsonify({'success': True, **result})
            except Exception:
                pass

        # 多源标题匹配
        matches = []
        oa_data = fetch_json(f'https://api.openalex.org/works?search={quote(title[:200])}&per_page=3&mailto=thesis@wb.com')
        if oa_data and 'results' in oa_data:
            for item in oa_data['results']:
                at = item.get('title', '') or ''
                aj = ''
                lp = item.get('primary_location')
                if lp and lp.get('source'):
                    aj = lp['source'].get('display_name', '') or ''
                ay = str(item.get('publication_year', '') or '')
                ad = item.get('doi', '') or ''
                ac = item.get('cited_by_count', 0) or 0
                ar = bool(item.get('is_retracted', False))
                matches.append({'title': at, 'journal': aj, 'year': ay, 'doi': ad, 'citations': ac,
                                'retracted': ar, 'source': 'OA'})

        cr_data = fetch_json(f'https://api.crossref.org/works?query={quote(title[:200])}&rows=3&mailto=thesis@wb.com')
        if cr_data and 'message' in cr_data:
            for item in cr_data['message'].get('items', []):
                at = (item.get('title') or [''])[0] or ''
                aj = (item.get('container-title') or [''])[0] or ''
                dp2 = (item.get('published-print') or item.get('issued') or {}).get('date-parts', [[]])
                ay = str((dp2[0][0] if dp2 and dp2[0] else '') or '')
                ad = item.get('DOI', '') or ''
                ap = item.get('type', '')
                ac = item.get('is-referenced-by-count', 0) or 0
                matches.append({'title': at, 'journal': aj, 'year': ay, 'doi': ad, 'citations': ac,
                                'retracted': False, 'pub_type': ap, 'source': 'CR'})

        # 评分
        na = re.sub(r'[^a-z0-9一-鿿]', '', title.lower())
        nj2 = re.sub(r'[^a-z0-9一-鿿]', '', journal.lower())
        best = {'score': 0, 'doi': '', 'citations': 0, 'retracted': False, 'pub_type': '', 'source': '', 'match_title': ''}
        for m in matches:
            nb = re.sub(r'[^a-z0-9一-鿿]', '', m['title'].lower())
            nk = re.sub(r'[^a-z0-9一-鿿]', '', m['journal'].lower())
            s = 0
            if na and nb:
                if na == nb:
                    s += 50
                elif len(na) > 10 and len(nb) > 10 and (nb in na or na in nb):
                    s += 40
                elif len(na) > 8 and len(nb) > 8 and (nb[:20] in na or na[:20] in nb):
                    s += 25
                else:
                    common = sum(1 for i in range(min(len(na), len(nb))) if na[i] == nb[i])
                    s += min(20, round(common / max(1, max(len(na), len(nb))) * 25))
            if nj2 and nk:
                if nk in nj2 or nj2 in nk:
                    s += 25
                elif len(nk) > 5 and len(nj2) > 5 and (nk[:6] in nj2 or nj2[:6] in nk):
                    s += 15
                elif len(nk) > 3 and len(nj2) > 3 and (nk[:4] in nj2 or nj2[:4] in nk):
                    s += 8
            if year and m['year']:
                try:
                    if int(year) == int(m['year']):
                        s += 25
                    elif abs(int(year) - int(m['year'])) <= 1:
                        s += 15
                except Exception:
                    pass
            if s > best['score']:
                best = {**m, 'score': s, 'match_title': m['title']}
        result.update(best)
        result['verified'] = best['score'] >= 40
        return jsonify({'success': True, **result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# 默认 search 函数别名供外部导入
