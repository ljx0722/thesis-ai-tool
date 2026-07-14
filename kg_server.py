"""
论文文献AI利器 - Python知识图谱服务
Flask后端: HTTP文件服务 + 知识图谱API + 多源文献检索API
数据源: OpenAlex / Crossref / Semantic Scholar / arXiv / CORE / 百度学术
"""
from flask import Flask, request, jsonify, send_file
import math, random, json, re, os, html, time, threading, sqlite3, hashlib, secrets
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, date

try:
    import jwt as pyjwt
    HAS_JWT = True
except ImportError:
    HAS_JWT = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

app = Flask(__name__)

# ========== 数据库 ==========
DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'thesis.db'))
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            credits INTEGER NOT NULL DEFAULT 5,
            is_admin INTEGER NOT NULL DEFAULT 0,
            invite_code TEXT,
            invited_by TEXT,
            free_used_date TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS recharge_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount_yuan REAL NOT NULL,
            amount_fen INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            payment_method TEXT DEFAULT 'alipay',
            created_at TEXT,
            confirmed_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount_credits INTEGER NOT NULL,
            credits_after INTEGER NOT NULL,
            description TEXT,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS llm_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            module TEXT NOT NULL,
            prompt_tokens INTEGER NOT NULL DEFAULT 0,
            completion_tokens INTEGER NOT NULL DEFAULT 0,
            cost_credits INTEGER NOT NULL DEFAULT 0,
            user_charged_credits INTEGER NOT NULL DEFAULT 0,
            model TEXT NOT NULL DEFAULT 'deepseek-chat',
            success INTEGER NOT NULL DEFAULT 0,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS daily_free_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            usage_date TEXT NOT NULL,
            used INTEGER NOT NULL DEFAULT 0,
            UNIQUE(user_id, usage_date),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS invite_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            owner_id INTEGER NOT NULL,
            used_by INTEGER,
            used_at TEXT,
            created_at TEXT,
            FOREIGN KEY (owner_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    ''')
    conn.commit()
    # Default pricing config (单位：分点 = 0.1点)
    for k,v in [('upload_price','10'),('module_price','1'),('search_price','0'),
                ('kg_price','0'),('domain_analysis_price','0'),('register_bonus','50'),('invite_bonus','10')]:
        conn.execute('INSERT OR IGNORE INTO config (key,value) VALUES (?,?)',(k,v))
    # Seed admin
    try:
        admin_pwd = os.environ.get('ADMIN_PASSWORD', 'admin123')
        salt = secrets.token_bytes(32)
        key = hashlib.pbkdf2_hmac('sha256', admin_pwd.encode(), salt, 100000)
        pwd_hash = salt.hex() + ':' + key.hex()
        conn.execute('INSERT OR IGNORE INTO users (username, password_hash, credits, is_admin, created_at) VALUES (?, ?, 50000, 1, datetime(\"now\",\"localtime\"))',
                     ('admin', pwd_hash))
        conn.execute("UPDATE users SET credits = 50000 WHERE username = 'admin' AND credits < 50000")
        conn.commit()
    except: pass
    # Generate admin invite code
    try:
        code = __import__('uuid').uuid4().hex[:8].upper()
        conn.execute("INSERT OR IGNORE INTO invite_codes (code, owner_id, created_at) SELECT ?, id, datetime('now','localtime') FROM users WHERE username='admin' LIMIT 1",(code,))
        conn.execute("UPDATE users SET invite_code = COALESCE(invite_code, ?) WHERE username='admin'",(code,))
        conn.commit()
    except: pass
    conn.close()
    print(f"[DB] SQLite initialized at {DB_PATH}")

init_db()

# ========== 认证工具 ==========
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
TOKEN_EXPIRE_DAYS = 30

def hash_password(password):
    salt = secrets.token_bytes(32)
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return salt.hex() + ':' + key.hex()

def verify_password(password, stored):
    salt_hex, key_hex = stored.split(':')
    salt = bytes.fromhex(salt_hex)
    key = bytes.fromhex(key_hex)
    new_key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return secrets.compare_digest(key, new_key)

def require_auth(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not HAS_JWT:
            return jsonify({'success': False, 'error': 'JWT库未安装'}), 500
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'error': '未登录或登录已过期'}), 401
        token = auth_header[7:]
        try:
            payload = pyjwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            request.user_id = payload['user_id']
        except pyjwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': '登录已过期，请重新登录'}), 401
        except Exception:
            return jsonify({'success': False, 'error': '无效的登录凭证'}), 401
        return f(*args, **kwargs)
    return wrapper

def generate_token(user_id):
    return pyjwt.encode({
        'user_id': user_id,
        'exp': datetime.utcnow().timestamp() + TOKEN_EXPIRE_DAYS * 86400
    }, JWT_SECRET, algorithm='HS256') if HAS_JWT else ''

# ========== LLM 配置 ==========
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
DEEPSEEK_BASE_URL = os.environ.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
DEEPSEEK_MODEL = os.environ.get('DEEPSEEK_MODEL', 'deepseek-chat')
DEEPSEEK_INPUT_PRICE_PER_1M = float(os.environ.get('DEEPSEEK_INPUT_PRICE', '1.0'))
DEEPSEEK_OUTPUT_PRICE_PER_1M = float(os.environ.get('DEEPSEEK_OUTPUT_PRICE', '2.0'))
USER_MARKUP = 2.0
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', secrets.token_hex(16))


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
    return jsonify({'ok': True, 'service': '论文文献AI利器', 'sources': ['OpenAlex','OpenAlex-CN','Crossref','Semantic Scholar','arXiv','CORE','PubMed','INSPIRE-HEP','DataCite','DOAJ','EuropePMC','CNKI','万方','百度学术']})

def _run_source(fn, *args):
    """Thread-safe wrapper: 在线程池中安全调用搜索函数"""
    try: return fn(*args) or []
    except: return []

@app.route('/search_api', methods=['POST'])
def search_api():
    """单词搜索：每次只查1个词、3个核心源，返回前100条"""
    try:
        data = request.get_json() or {}
        queries = data.get('queries', [])
        max_per = data.get('max_per_query', 400)
        all_results = []

        for q in queries[:30]:
            if not q.strip(): continue
            is_cn = bool(re.search(r'[一-鿿]', q))

            # 每个词只查3个最快源 + 新增源
            for source_fn in [
                lambda: fetch_with_retry(search_openalex, q, min(max_per, 100)),
                lambda: search_crossref(q, 50),
                lambda: search_semantic_scholar(q, 50),
                lambda: search_europepmc(q, 40),
            ]:
                try: all_results.extend(source_fn() or [])
                except: pass

            if is_cn:
                try: all_results.extend(search_baidu_xueshu_page(q, 0) or [])
                except: pass
                try: all_results.extend(search_cnki(q, 30) or [])
                except: pass

        all_results = dedup_results(all_results)
        all_results.sort(key=lambda r: r.get('year') or 0, reverse=True)
        cn = sum(1 for r in all_results if r.get('isCN'))
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
        a = (i / max(len(entities) or 10, 1)) * 2 * math.pi - math.pi / 2
        pos[e['id']] = {'x': cx + math.cos(a) * r * 1.1, 'y': cy + math.sin(a) * r * 1.1, 'vx': 0, 'vy': 0}
    for i, e in enumerate([x for x in entities if x['type'] == 'chapter']):
        a = (i / max(len(entities) or 10, 1)) * 2 * math.pi - math.pi / 2
        pos[e['id']] = {'x': cx + math.cos(a) * r * 0.7, 'y': cy + math.sin(a) * r * 0.7, 'vx': 0, 'vy': 0}
    for i, e in enumerate([x for x in entities if x['type'] == 'reference']):
        a = (i / max(len(entities) or 10, 1)) * 2 * math.pi - math.pi / 2
        pos[e['id']] = {'x': cx + math.cos(a) * r * 0.4, 'y': cy + math.sin(a) * r * 0.4, 'vx': 0, 'vy': 0}
    ids = {e['id'] for e in entities}
    for _ in range(iterations):
        for i in range(len(entities)):
            for j in range(i + 1, len(entities)):
                p1, p2 = pos[entities[i]['id']], pos[entities[j]['id']]
                dx, dy = p2['x'] - p1['x'], p2['y'] - p1['y']; d = math.sqrt(dx * dx + dy * dy) or 10; f = 400 / d
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


# ========== .doc 文件转换 API（旧版 Word 格式支持） ==========
@app.route('/convert_doc', methods=['POST'])
def convert_doc():
    """接收 .doc 文件，提取纯文本并包装为 HTML 返回"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file uploaded'}), 400
        f = request.files['file']
        buf = f.read()
        if not buf or len(buf) < 1024:
            return jsonify({'success': False, 'error': 'File too small or empty'}), 400

        import olefile
        from html import escape
        ole = olefile.OleFileIO(buf)
        # 尝试读取 WordDocument 流中的文本
        # .doc 文件的文本存储在 WordDocument 流中，但格式复杂
        # 简化方案：读取 1Table/0Table 中的 Unicode 文本
        text_parts = []

        # 方法1：尝试读取主文本流
        if ole.exists('WordDocument'):
            word_stream = ole.openstream('WordDocument').read()
            # 从 WordDocument 流中提取 Unicode 文本片段
            # Word 97-2003 二进制格式：FIB 在偏移 0，文本起始位置在 FIB 中
            # 简化：提取所有可打印的 Unicode 字符序列
            import struct
            # 尝试解析 FIB 获取文本范围
            try:
                # FIB 的 ccpText 在偏移 0x4C 处（4字节 LE）
                ccpText = struct.unpack_from('<I', word_stream, 0x4C)[0]
                # 文本起始在 FIB 偏移后
                # 简化：从整个流中提取 UTF-16LE 文本段
                text_start = 0
                for i in range(0, len(word_stream) - 1, 2):
                    ch = struct.unpack_from('<H', word_stream, i)[0]
                    if 0x20 <= ch <= 0xFFFF and ch != 0xFFFE:
                        text_start = i
                        break
                # 提取 text_start 之后的文本
                chars = []
                for i in range(text_start, min(text_start + ccpText * 2 + 200, len(word_stream) - 1), 2):
                    ch = struct.unpack_from('<H', word_stream, i)[0]
                    if ch == 0x000D or ch == 0x0007:  # CR or Bell = paragraph marker
                        chars.append('\n')
                    elif 0x20 <= ch <= 0xFFFD:
                        chars.append(chr(ch))
                    elif ch == 0:  # null terminator
                        if chars and chars[-1] != '\n':
                            chars.append('\n')
                extracted = ''.join(chars).strip()
                if extracted and len(extracted) > 100:
                    text_parts.append(extracted)
            except:
                pass

        # 方法2：如果主文本流解析失败，尝试从 1Table 流中提取
        if not text_parts and ole.exists('1Table'):
            try:
                table = ole.openstream('1Table').read()
                # 提取可打印文本
                chars = []
                for ch in table.decode('utf-16-le', errors='ignore'):
                    if ch.isprintable() or ch in '\n\r\t':
                        chars.append(ch)
                extracted = ''.join(chars).strip()
                if extracted and len(extracted) > 100:
                    text_parts.append(extracted)
            except:
                pass

        # 方法3：最后的兜底 - 从整个 OLE 文件中提取所有可读文本
        if not text_parts:
            all_text = []
            for stream_name in ole.listdir():
                try:
                    flat_name = '/'.join(stream_name)
                    data = ole.openstream(flat_name).read()
                    # 尝试 UTF-16LE 解码
                    try:
                        decoded = data.decode('utf-16-le', errors='ignore')
                        # 只保留包含中文字符的连续文本段
                        for segment in decoded.split('\x00\x00\x00'):
                            clean = ''.join(c for c in segment if c.isprintable() or c in '\n\r\t ')
                            if len(clean) > 40 and any('一' <= c <= '鿿' for c in clean):
                                all_text.append(clean)
                    except:
                        pass
                except:
                    pass
            if all_text:
                text_parts = all_text

        ole.close()

        if not text_parts:
            return jsonify({
                'success': False,
                'error': '无法从该 .doc 文件中提取文本。建议用 Word 打开后另存为 .docx 格式再上传。'
            }), 400

        # 合并所有文本片段
        full_text = '\n\n'.join(text_parts)
        # 包装为基本 HTML（每行一个 <p>）
        lines = full_text.split('\n')
        html_parts = ['<p>' + escape(line.strip()) + '</p>' for line in lines if line.strip()]
        html = '\n'.join(html_parts)

        return jsonify({
            'success': True,
            'text': full_text[:500000],
            'html': html[:800000],
            'charCount': len(full_text)
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ========== 用户认证 API ==========
@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '')
    invite = (data.get('invite_code') or '').strip().upper()
    if not username or len(username) < 2 or len(username) > 32:
        return jsonify({'success': False, 'error': '用户名需2-32个字符'}), 400
    if not password or len(password) < 6:
        return jsonify({'success': False, 'error': '密码至少6个字符'}), 400
    db = get_db()
    try:
        existing = db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
        if existing:
            return jsonify({'success': False, 'error': '用户名已存在'}), 409
        pwd_hash = hash_password(password)
        bonus = int(db.execute("SELECT value FROM config WHERE key='register_bonus'").fetchone()['value'] or 50)
        # Apply invite code bonus
        inviter_id = None
        if invite:
            ic = db.execute("SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL", (invite,)).fetchone()
            if ic and ic['owner_id']:
                inviter_id = ic['owner_id']
                inv_bonus = int(db.execute("SELECT value FROM config WHERE key='invite_bonus'").fetchone()['value'] or 10)
                db.execute("UPDATE invite_codes SET used_by = (SELECT id FROM users WHERE username = ?), used_at = datetime('now','localtime') WHERE code = ?", (username, invite))
                db.execute("UPDATE users SET credits = credits + ? WHERE id = ?", (inv_bonus, inviter_id))
                bonus += inv_bonus
        db.execute("INSERT INTO users (username, password_hash, credits, invited_by, created_at) VALUES (?, ?, ?, ?, datetime('now','localtime'))",
                   (username, pwd_hash, bonus, inviter_id))
        db.commit()
        return jsonify({'success': True, 'message': f'注册成功！赠送{bonus}点数。','points': bonus})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    if not username or not password:
        return jsonify({'success': False, 'error': '请输入用户名和密码'}), 400
    db = get_db()
    try:
        user = db.execute('SELECT id, username, password_hash, credits, is_admin, invite_code FROM users WHERE username = ?',
                          (username,)).fetchone()
        if not user or not verify_password(password, user['password_hash']):
            return jsonify({'success': False, 'error': '用户名或密码错误'}), 401
        token = generate_token(user['id'])
        return jsonify({'success': True, 'token': token, 'user': {
            'id': user['id'], 'username': user['username'],
            'credits': user['credits'], 'is_admin': bool(user['is_admin']),
            'invite_code': user['invite_code'] or ''
        }})
    finally:
        db.close()

@app.route('/api/auth/me', methods=['GET'])
@require_auth
def auth_me():
    db = get_db()
    try:
        user = db.execute('SELECT id, username, credits, is_admin, invite_code, free_used_date FROM users WHERE id = ?',
                          (request.user_id,)).fetchone()
        if not user: return jsonify({'success': False, 'error': '用户不存在'}), 404
        today = date.today().isoformat()
        return jsonify({'success': True, 'user': {
            'id': user['id'], 'username': user['username'],
            'credits': user['credits'], 'is_admin': bool(user['is_admin']),
            'invite_code': user['invite_code'] or '',
            'free_used_today': (user['free_used_date'] == today)
        }})
    finally:
        db.close()

@app.route('/api/auth/change_password', methods=['POST'])
@require_auth
def auth_change_password():
    data = request.get_json() or {}
    old_pw = data.get('old_password') or ''
    new_pw = data.get('new_password') or ''
    if len(new_pw) < 6:
        return jsonify({'success': False, 'error': '新密码至少6个字符'}), 400
    db = get_db()
    try:
        user = db.execute('SELECT password_hash FROM users WHERE id = ?', (request.user_id,)).fetchone()
        if not user or not verify_password(old_pw, user['password_hash']):
            return jsonify({'success': False, 'error': '原密码错误'}), 401
        new_hash = hash_password(new_pw)
        db.execute('UPDATE users SET password_hash = ? WHERE id = ?', (new_hash, request.user_id))
        db.commit()
        return jsonify({'success': True, 'message': '密码已修改'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

# ========== 支付 / 点数 API ==========
@app.route('/api/payment/recharge', methods=['POST'])
@require_auth
def payment_recharge():
    data = request.get_json() or {}
    amount_yuan = data.get('amount_yuan')
    pm = data.get('payment_method', 'alipay')
    if amount_yuan not in [1, 5, 10, 20, 50]:
        return jsonify({'success': False, 'error': '金额必须为: 1, 5, 10, 20, 50'}), 400
    db = get_db()
    try:
        db.execute("INSERT INTO recharge_orders (user_id, amount_yuan, amount_fen, status, payment_method, created_at) VALUES (?, ?, ?, 'pending', ?, datetime('now','localtime'))",
                   (request.user_id, amount_yuan, int(amount_yuan * 100), pm))
        db.commit()
        return jsonify({'success': True, 'message': '充值申请已提交 (¥'+str(amount_yuan)+')，请扫码支付后点击"我已支付"'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/payment/submit', methods=['POST'])
@require_auth
def payment_submit():
    """用户点击'我已支付'，自动确认到账（模拟即时到账）"""
    data = request.get_json() or {}
    order_id = data.get('order_id')
    db = get_db()
    try:
        order = db.execute('SELECT * FROM recharge_orders WHERE id = ? AND user_id = ?', (order_id, request.user_id)).fetchone()
        if not order: return jsonify({'success': False, 'error': '订单不存在'}), 404
        if order['status'] != 'pending': return jsonify({'success': False, 'error': '订单已处理'}), 400
        pts = int(order['amount_yuan'] * 10)
        db.execute("UPDATE recharge_orders SET status = 'confirmed', confirmed_at = datetime('now','localtime') WHERE id = ?", (order_id,))
        db.execute("UPDATE users SET credits = credits + ? WHERE id = ?", (pts, request.user_id))
        after = db.execute('SELECT credits FROM users WHERE id = ?', (request.user_id,)).fetchone()['credits']
        db.execute("INSERT INTO transactions (user_id, type, amount_credits, credits_after, description, created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))",
                   (request.user_id, 'recharge', pts, after, '充值 '+str(pts/10)+'点'))
        db.commit()
        return jsonify({'success': True, 'message': '充值成功！到账 '+str(pts/10)+' 点', 'credits': after})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/payment/orders', methods=['GET'])
@require_auth
def payment_orders():
    db = get_db()
    try:
        rows = db.execute("SELECT id, amount_yuan, status, payment_method, created_at, confirmed_at FROM recharge_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
                          (request.user_id,)).fetchall()
        return jsonify({'success': True, 'orders': [dict(r) for r in rows]})
    finally:
        db.close()

@app.route('/api/payment/confirm', methods=['POST'])
@require_auth
def payment_confirm():
    """确认到账（兼容直接确认 pending 订单的场景）"""
    data = request.get_json() or {}
    order_id = data.get('order_id')
    db = get_db()
    try:
        order = db.execute('SELECT * FROM recharge_orders WHERE id = ?', (order_id,)).fetchone()
        if not order: return jsonify({'success': False, 'error': '订单不存在'}), 404
        if order['status'] == 'confirmed': return jsonify({'success': False, 'error': '已处理'}), 400
        pts = int(order['amount_yuan'] * 10)
        db.execute("UPDATE recharge_orders SET status = 'confirmed', confirmed_at = datetime('now','localtime') WHERE id = ?", (order_id,))
        db.execute("UPDATE users SET credits = credits + ? WHERE id = ?", (pts, order['user_id']))
        after = db.execute('SELECT credits FROM users WHERE id = ?', (order['user_id'],)).fetchone()['credits']
        db.execute("INSERT INTO transactions (user_id, type, amount_credits, credits_after, description, created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))",
                   (order['user_id'], 'recharge', pts, after, '充值 '+str(pts/10)+'点'))
        db.commit()
        return jsonify({'success': True, 'message': '已到账 '+str(pts/10)+' 点', 'credits': after})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/payment/balance', methods=['GET'])
@require_auth
def payment_balance():
    db = get_db()
    try:
        u = db.execute('SELECT credits, free_used_date FROM users WHERE id = ?', (request.user_id,)).fetchone()
        today = date.today().isoformat()
        return jsonify({'success': True, 'credits': u['credits'], 'free_available': (u['free_used_date'] != today)})
    finally:
        db.close()
@app.route('/api/usage/check_free', methods=['GET'])
@require_auth
def usage_check_free():
    db = get_db()
    try:
        today = date.today().isoformat()
        row = db.execute('SELECT used FROM daily_free_usage WHERE user_id = ? AND usage_date = ?',
                         (request.user_id, today)).fetchone()
        return jsonify({'success': True, 'free_available': not (row and row['used'])})
    finally:
        db.close()

@app.route('/api/usage/mark_free', methods=['POST'])
@require_auth
def usage_mark_free():
    db = get_db()
    try:
        today = date.today().isoformat()
        db.execute('INSERT OR IGNORE INTO daily_free_usage (user_id, usage_date, used) VALUES (?, ?, 1)',
                   (request.user_id, today))
        db.execute("UPDATE users SET free_used_date = ? WHERE id = ?", (today, request.user_id))
        db.commit()
        return jsonify({'success': True})
    finally:
        db.close()

@app.route('/api/usage/module', methods=['POST'])
@require_auth
def usage_module():
    """模块使用扣点（0.1点/次 = 1分点）"""
    # 首次使用免费（当天），否则扣 module_price 分点
    db = get_db()
    try:
        today = date.today().isoformat()
        free_row = db.execute('SELECT used FROM daily_free_usage WHERE user_id = ? AND usage_date = ?',
                              (request.user_id, today)).fetchone()
        free_count = free_row['used'] if free_row else 0
        if free_count < 3:  # 3 free ops per day
            db.execute('INSERT OR IGNORE INTO daily_free_usage (user_id, usage_date, used) VALUES (?, ?, 1)',
                       (request.user_id, today))
            db.execute('UPDATE daily_free_usage SET used = used + 1 WHERE user_id = ? AND usage_date = ?',
                       (request.user_id, today))
            db.execute("UPDATE users SET free_used_date = ? WHERE id = ?", (today, request.user_id))
            db.commit()
            new_count = db.execute('SELECT used FROM daily_free_usage WHERE user_id = ? AND usage_date = ?',
                                   (request.user_id, today)).fetchone()['used']
            return jsonify({'success': True, 'free': True, 'message': '今日免费(' + str(new_count) + '/3)'})
    finally: db.close()
    # Not free — deduct
    price = get_price('module')
    if price <= 0: return jsonify({'success': True, 'free': False, 'cost': 0})
    ok, err, after = deduct_credits(request.user_id, price, '模块使用')
    if not ok: return jsonify({'success': False, 'error': err, 'needed': price}), 402
    return jsonify({'success': True, 'free': False, 'cost': price, 'credits_after': after})

# 模块扣点定价（从 config 表读取，默认值兜底）
PRICING_DEFAULTS = {
    'module': 1, 'upload': 10, 'llm_analysis': 1,
    'topic-finder': 5, 'proposal': 5, 'review': 3, 'optimization': 3,
    'expand': 5, 'proofread': 5, 'de-duplicate': 10,
    'defense-ppt': 5, 'en-abstract': 3,
    'domain_analysis': 0, 'kg': 0, 'search': 0
}
def get_price(key):
    try:
        db = get_db()
        v = db.execute("SELECT value FROM config WHERE key = ?", (key+'_price',)).fetchone()
        db.close()
        return int(v['value']) if v else PRICING_DEFAULTS.get(key, 0)
    except: return PRICING_DEFAULTS.get(key, 0)

def deduct_credits(user_id, amount, desc):
    db = get_db()
    try:
        u = db.execute('SELECT credits FROM users WHERE id = ?', (user_id,)).fetchone()
        if not u: return False, '用户不存在', None
        if u['credits'] < amount: return False, f'点数不足。需要 {amount} 点，当前 {u["credits"]} 点', u['credits']
        after = u['credits'] - amount
        db.execute('UPDATE users SET credits = ? WHERE id = ?', (after, user_id))
        db.execute("INSERT INTO transactions (user_id, type, amount_credits, credits_after, description, created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))",
                   (user_id, 'usage', -amount, after, desc))
        db.commit()
        return True, None, after
    except Exception as e:
        db.rollback()
        return False, str(e), None
    finally:
        db.close()

# ========== LLM 分析 API（按实际 token 成本 ×2 扣点） ==========
@app.route('/api/llm/analyze', methods=['POST'])
@require_auth
def llm_analyze():
    """LLM 分析：先估算费用检查余额 → 调用 DeepSeek → 按实际 token 成本 ×2 扣点
    计费公式：DeepSeek 实际花费 N 元 → 扣用户 ceil(2N) 点（最低 1 点）
    DeepSeek 定价：输入 1元/百万token，输出 2元/百万token"""
    if not DEEPSEEK_API_KEY:
        return jsonify({'success': False, 'error': 'LLM服务未配置'}), 503
    data = request.get_json() or {}
    module = data.get('module', 'generic')
    system_prompt = data.get('system_prompt', '')
    user_prompt = data.get('user_prompt', '')
    max_tokens = data.get('max_tokens', 2000)

    # 估算费用（防止余额不够还调 API）
    total_text = system_prompt + user_prompt
    cn = len(re.findall(r'[一-鿿]', total_text))
    est_input = int(cn * 0.6 + (len(total_text) - cn) * 0.25)
    est_api_cost = (est_input / 1000000 * DEEPSEEK_INPUT_PRICE_PER_1M +
                    max_tokens / 1000000 * DEEPSEEK_OUTPUT_PRICE_PER_1M)  # 元
    est_credits = max(1, int(est_api_cost * USER_MARKUP + 0.999))  # 预估扣点，向上取整

    # 检查余额
    db = get_db()
    try:
        u = db.execute('SELECT credits FROM users WHERE id = ?', (request.user_id,)).fetchone()
        if not u: return jsonify({'success': False, 'error': '用户不存在'}), 404
        if u['credits'] < est_credits:
            return jsonify({'success': False, 'error': f'点数不足。预计需 {est_credits} 点，当前 {u["credits"]} 点',
                            'credits': u['credits'], 'needed': est_credits}), 402
    finally: db.close()

    # 调用 DeepSeek
    try:
        resp = requests.post(f'{DEEPSEEK_BASE_URL}/chat/completions',
            headers={'Authorization': f'Bearer {DEEPSEEK_API_KEY}', 'Content-Type': 'application/json'},
            json={'model': DEEPSEEK_MODEL, 'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ], 'max_tokens': max_tokens, 'temperature': 0.3, 'stream': False}, timeout=120)
        resp.raise_for_status()
        result = resp.json()
    except Exception as e:
        return jsonify({'success': False, 'error': f'LLM调用失败: {str(e)}'}), 502

    # 按实际用量计算费用
    usage_info = result.get('usage', {})
    actual_input = usage_info.get('prompt_tokens', est_input)
    actual_output = usage_info.get('completion_tokens', 0)
    # DeepSeek 实际花费（元）
    api_cost = (actual_input / 1000000 * DEEPSEEK_INPUT_PRICE_PER_1M +
                actual_output / 1000000 * DEEPSEEK_OUTPUT_PRICE_PER_1M)
    # 用户扣点：实际成本 ×2，向上取整，最低 1 点
    charge_credits = max(1, int(api_cost * USER_MARKUP + 0.999))
    content = result['choices'][0]['message']['content']

    # 扣点
    ok, err, after = deduct_credits(request.user_id, charge_credits,
        f'LLM分析 {module} (输入{actual_input}+输出{actual_output} tokens, API成本¥{api_cost:.4f}, 扣{charge_credits}点)')
    if not ok:
        return jsonify({'success': False, 'error': f'扣费失败: {err}'}), 402

    # 记录
    db2 = get_db()
    try:
        db2.execute("INSERT INTO llm_usage (user_id, module, prompt_tokens, completion_tokens, cost_credits, user_charged_credits, model, success, created_at) VALUES (?,?,?,?,?,?,?,1,datetime('now','localtime'))",
                    (request.user_id, module, actual_input, actual_output, int(api_cost*100), charge_credits, DEEPSEEK_MODEL))
        db2.commit()
    finally: db2.close()

    return jsonify({'success': True, 'content': content, 'usage': {
        'input_tokens': actual_input, 'output_tokens': actual_output,
        'api_cost': round(api_cost, 4), 'cost_credits': charge_credits,
        'credits_after': after
    }})

# ========== 领域分析 API（检索前先由AI分析论文领域） ==========
@app.route('/api/ai/domain_analyze', methods=['POST'])
@require_auth
def domain_analyze():
    """AI分析论文领域和关键词，用于优化文献检索"""
    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    if not text or len(text) < 100:
        return jsonify({'success': False, 'error': '论文内容太少，请至少上传论文正文'}), 400
    snippet = text[:8000]
    prompt = f"""你是一个学术论文分析专家。请分析以下论文内容，严格按此格式输出：
1. 研究领域（3-5个，用中英文，逗号分隔）
2. 核心关键词（5-10个，用逗号分隔，中英文都有）
3. 建议检索词（5-10个，最适合在学术数据库检索的关键词组合）
4. 学科分类（1个最主要学科）

论文内容：
{snippet}"""
    ok, err, after = deduct_credits(request.user_id, 0, '领域分析（免费）')
    if not ok: return jsonify({'success': False, 'error': err}), 402
    try:
        resp = requests.post(f'{DEEPSEEK_BASE_URL}/chat/completions',
            headers={'Authorization': f'Bearer {DEEPSEEK_API_KEY}', 'Content-Type': 'application/json'},
            json={'model': DEEPSEEK_MODEL, 'messages': [{'role': 'user', 'content': prompt}],
                  'max_tokens': 600, 'temperature': 0.1}, timeout=60)
        resp.raise_for_status()
        result = resp.json()
        content = result['choices'][0]['message']['content']
        lines = [l.strip() for l in content.split('\n') if l.strip()]
        fields, keywords, search_terms, discipline = '', '', '', ''
        for l in lines:
            low = l.lower()
            if '研究领域' in low or low.startswith('1.'): fields = l.split('：',1)[-1].split(':',1)[-1].strip()
            elif '核心关键' in low or '关键词' in low or low.startswith('2.'): keywords = l.split('：',1)[-1].split(':',1)[-1].strip()
            elif '检索词' in low or '搜索' in low or low.startswith('3.'): search_terms = l.split('：',1)[-1].split(':',1)[-1].strip()
            elif '学科' in low or low.startswith('4.'): discipline = l.split('：',1)[-1].split(':',1)[-1].strip()
        return jsonify({'success': True, 'domain': {
            'fields': fields or '未识别', 'keywords': keywords or '未识别',
            'search_terms': search_terms or '未识别', 'discipline': discipline or '未识别',
            'raw': content
        }})
    except Exception as e:
        return jsonify({'success': False, 'error': f'AI分析失败: {str(e)}'}), 502

# ========== 邀请码 API ==========
@app.route('/api/invite/generate', methods=['POST'])
@require_auth
def invite_generate():
    """生成邀请码"""
    db = get_db()
    try:
        code = __import__('uuid').uuid4().hex[:8].upper()
        db.execute("INSERT INTO invite_codes (code, owner_id, created_at) VALUES (?, ?, datetime('now','localtime'))",
                   (code, request.user_id))
        db.execute("UPDATE users SET invite_code = COALESCE(invite_code, ?) WHERE id = ?", (code, request.user_id))
        db.commit()
        return jsonify({'success': True, 'code': code})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/invite/apply', methods=['POST'])
@require_auth
def invite_apply():
    """使用邀请码（已注册用户补充填写）"""
    data = request.get_json() or {}
    code = (data.get('code') or '').strip().upper()
    if not code: return jsonify({'success': False, 'error': '请输入邀请码'}), 400
    db = get_db()
    try:
        ic = db.execute("SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL AND owner_id != ?",
                        (code, request.user_id)).fetchone()
        if not ic: return jsonify({'success': False, 'error': '邀请码无效或已被使用'}), 404
        inv_bonus = int(db.execute("SELECT value FROM config WHERE key='invite_bonus'").fetchone()['value'] or 10)
        db.execute("UPDATE invite_codes SET used_by = ?, used_at = datetime('now','localtime') WHERE code = ?",
                   (request.user_id, code))
        db.execute("UPDATE users SET credits = credits + ? WHERE id = ?", (inv_bonus, ic['owner_id']))
        db.execute("UPDATE users SET credits = credits + ?, invited_by = ? WHERE id = ?",
                   (inv_bonus, request.user_id, ic['owner_id']))
        db.commit()
        return jsonify({'success': True, 'message': f'邀请码已使用，你和邀请人各获得 {inv_bonus} 点！'})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/invite/my_code', methods=['GET'])
@require_auth
def invite_my_code():
    """获取当前用户的邀请码"""
    db = get_db()
    try:
        u = db.execute('SELECT invite_code FROM users WHERE id = ?', (request.user_id,)).fetchone()
        if not u or not u['invite_code']: return jsonify({'success': False, 'error': '暂无邀请码，请先生成'}), 404
        return jsonify({'success': True, 'code': u['invite_code']})
    finally:
        db.close()

@app.route('/api/invite/stats', methods=['GET'])
@require_auth
def invite_stats():
    """获取邀请统计"""
    db = get_db()
    try:
        total = db.execute("SELECT COUNT(*) as c FROM invite_codes WHERE owner_id = ?", (request.user_id,)).fetchone()['c']
        used = db.execute("SELECT COUNT(*) as c FROM invite_codes WHERE owner_id = ? AND used_by IS NOT NULL", (request.user_id,)).fetchone()['c']
        return jsonify({'success': True, 'total': total, 'used': used})
    finally:
        db.close()

# ========== 新增文献源 ==========
def search_europepmc(query, max_rows=60):
    """Europe PMC: 生命科学/医学文献"""
    results = []
    try:
        from urllib.parse import quote
        url = f'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={quote(query)}&format=json&pageSize=100&resultType=lite'
        data = fetch_json(url, timeout=15)
        if data and 'resultList' in data:
            for item in data['resultList'].get('result', [])[:max_rows]:
                title = (item.get('title') or '').strip()
                if not title or len(title) < 3: continue
                journal = (item.get('journalTitle') or '').strip()
                year = str(item.get('pubYear') or '')
                authors = (item.get('authorString') or '').strip()
                doi = (item.get('doi') or '').strip()
                results.append(make_result(title, journal, year, authors, doi, 'EP'))
    except: pass
    return results

def search_cnki(query, max_rows=40):
    """CNKI 公共搜索"""
    results = []
    try:
        from urllib.parse import quote
        url = f'https://search.cnki.net/search.aspx?q={quote(query)}&rank=relevant&cluster=all&val=&p=0'
        html_text = fetch_text(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9'
        }, timeout=15)
        if not html_text: return results
        titles = re.findall(r'<a[^>]*class="[^"]*(?:title|fz14)[^"]*"[^>]*>(.*?)</a>', html_text)
        sources = re.findall(r'(?:class="source"[^>]*>|<p[^>]*>)\s*(.*?)\s*(?:</p>|</span>|</div>)', html_text)
        for i, t in enumerate(titles[:max_rows]):
            title = html.unescape(re.sub(r'<[^>]+>', '', t)).strip()
            if not title or len(title) < 3 or len(title) > 300: continue
            journal, year = '', ''
            if i < len(sources):
                src = html.unescape(re.sub(r'<[^>]+>', '', sources[i])).strip()
                ym = re.search(r'((?:19|20)\d{2})', src)
                if ym: year = ym.group(1)
                journal = re.sub(r'\s*\d{4}.*', '', src).strip()
            results.append(make_result(title, journal, year, '', '', 'CNKI'))
    except: pass
    return results


# ========== 管理员看板 API ==========
@app.route('/api/admin/dashboard', methods=['GET'])
def admin_dashboard():
    s = request.args.get('secret', '')
    db = get_db()
    try:
        if s != ADMIN_SECRET:
            auth = request.headers.get('Authorization', '')
            if auth.startswith('Bearer '):
                try:
                    payload = pyjwt.decode(auth[7:], JWT_SECRET, algorithms=['HS256'])
                    u = db.execute('SELECT is_admin FROM users WHERE id=?', (payload['user_id'],)).fetchone()
                    if not (u and u['is_admin']):
                        return jsonify({'error': '无权限'}), 403
                except: return jsonify({'error': '无权限'}), 403
            else: return jsonify({'error': '无权限'}), 403
        today = date.today().isoformat()
        total_users = db.execute('SELECT COUNT(*) as c FROM users').fetchone()['c']
        today_users = db.execute("SELECT COUNT(*) as c FROM users WHERE created_at LIKE ?", (today+'%',)).fetchone()['c']
        total_credits = db.execute('SELECT SUM(credits) as s FROM users').fetchone()['s'] or 0
        total_recharge = db.execute("SELECT SUM(amount_yuan) as s FROM recharge_orders WHERE status='confirmed'").fetchone()['s'] or 0
        pending = db.execute("SELECT COUNT(*) as c FROM recharge_orders WHERE status='submitted'").fetchone()['c']
        llm_today = db.execute("SELECT COUNT(*) as c FROM llm_usage WHERE created_at LIKE ?", (today+'%',)).fetchone()['c']
        llm_total = db.execute('SELECT COUNT(*) as c FROM llm_usage WHERE success=1').fetchone()['c']
        total_cost = db.execute('SELECT SUM(user_charged_credits) as s FROM llm_usage WHERE success=1').fetchone()['s'] or 0
        recent_users = [dict(r) for r in db.execute('SELECT id,username,credits,created_at FROM users ORDER BY id DESC LIMIT 10').fetchall()]
        recent_orders = [dict(r) for r in db.execute("SELECT o.*,u.username FROM recharge_orders o JOIN users u ON o.user_id=u.id ORDER BY o.id DESC LIMIT 10").fetchall()]
        return jsonify({'success': True, 'stats': {
            'total_users': total_users, 'today_users': today_users, 'total_credits': total_credits,
            'total_recharge': total_recharge, 'pending_orders': pending,
            'llm_today': llm_today, 'llm_total': llm_total, 'total_cost': total_cost,
            'recent_users': recent_users, 'recent_orders': recent_orders
        }})
    finally: db.close()

@app.route('/api/admin/users', methods=['GET'])
def admin_users():
    s = request.args.get('secret', '')
    if s != ADMIN_SECRET: return jsonify({'error': '无权限'}), 403
    db = get_db()
    try:
        rows = [dict(r) for r in db.execute('SELECT id,username,credits,invite_code,created_at FROM users ORDER BY id DESC LIMIT 100').fetchall()]
        return jsonify({'success': True, 'users': rows})
    finally: db.close()

@app.route('/api/admin/credits', methods=['POST'])
def admin_credits():
    data = request.get_json() or {}
    if data.get('secret','') != ADMIN_SECRET: return jsonify({'error':'无权限'}), 403
    uid = data.get('user_id')
    amount = int(data.get('amount', 0))
    reason = data.get('reason', '管理员调整')
    db = get_db()
    try:
        db.execute('UPDATE users SET credits = credits + ? WHERE id = ?', (amount, uid))
        after = db.execute('SELECT credits FROM users WHERE id = ?', (uid,)).fetchone()['credits']
        db.execute("INSERT INTO transactions (user_id,type,amount_credits,credits_after,description,created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))",
                   (uid, 'admin_adjust', amount, after, reason))
        db.commit()
        return jsonify({'success': True, 'credits': after})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally: db.close()


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


