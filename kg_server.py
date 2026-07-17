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
MATERIALS_DIR = os.environ.get('MATERIALS_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'materials'))
os.makedirs(MATERIALS_DIR, exist_ok=True)

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
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            idea TEXT,
            field TEXT,
            keywords TEXT,
            degree TEXT,
            goal_words INTEGER DEFAULT 30000,
            current_stage TEXT,
            mode TEXT,
            has_manuscript INTEGER DEFAULT 0,
            stage_status TEXT,
            school_template TEXT,
            notes TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS project_materials (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            kind TEXT,
            mime TEXT,
            size_bytes INTEGER DEFAULT 0,
            storage_path TEXT NOT NULL,
            meta_json TEXT,
            created_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS pricing_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            config_json TEXT NOT NULL,
            effective_at TEXT NOT NULL,
            created_by INTEGER,
            created_at TEXT,
            is_active INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS project_artifacts (
            project_id TEXT PRIMARY KEY,
            outline_json TEXT,
            chapters_json TEXT,
            versions_json TEXT,
            skill_logs_json TEXT,
            manuscript_meta_json TEXT,
            updated_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        );
    ''')
    conn.commit()
    # Default pricing config (单位：分点 = 0.1点)
    for k,v in [('upload_price','0'),('module_price','50'),('search_price','0'),
                ('kg_price','0'),('domain_analysis_price','0'),('data-ml_price','200'),('export-docx_price','100'),
                ('format-check_price','30'),('terminology_price','30'),('paragraph_price','30'),
                ('dashboard_price','50'),('data-analysis_price','80'),
                ('register_bonus','3000'),('invite_bonus','1000')]:  # 注册送3.0点, 邀请送1.0点
        # INSERT OR IGNORE 对已有库不更新；关键计费项强制刷新到新默认
        conn.execute('INSERT INTO config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',(k,v))
    # Seed admin
    try:
        admin_pwd = os.environ.get('ADMIN_PASSWORD', 'admin123')
        salt = secrets.token_bytes(32)
        key = hashlib.pbkdf2_hmac('sha256', admin_pwd.encode(), salt, 100000)
        pwd_hash = salt.hex() + ':' + key.hex()
        conn.execute('INSERT OR IGNORE INTO users (username, password_hash, credits, is_admin, created_at) VALUES (?, ?, 500000, 1, datetime(\"now\",\"localtime\"))',
                     ('admin', pwd_hash))
        conn.execute("UPDATE users SET credits = 500000 WHERE username = 'admin' AND credits < 500")
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
# JWT_SECRET 持久化到磁盘，避免重启后所有用户掉线
_JWT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', '.jwt_secret')
def _load_jwt_secret():
    env = os.environ.get('JWT_SECRET')
    if env: return env
    try:
        if os.path.exists(_JWT_FILE):
            with open(_JWT_FILE, 'r') as f:
                s = f.read().strip()
                if s: return s
    except: pass
    s = secrets.token_hex(32)
    try:
        os.makedirs(os.path.dirname(_JWT_FILE), exist_ok=True)
        with open(_JWT_FILE, 'w') as f: f.write(s)
    except: pass
    return s
JWT_SECRET = _load_jwt_secret()
TOKEN_EXPIRE_DAYS = 30

# 简单内存速率限制（IP → [timestamps]）
_rate_buckets = {}
def _check_rate(key, max_calls=30, window_sec=60):
    """Return True if under limit, False if rate-limited"""
    now = time.time()
    bucket = _rate_buckets.setdefault(key, [])
    # purge old
    _rate_buckets[key] = [t for t in bucket if now - t < window_sec]
    if len(_rate_buckets[key]) >= max_calls:
        return False
    _rate_buckets[key].append(now)
    return True

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
# 成本基准：默认按 1000万Token ≈ 1 元 => 每 1M Token 约 0.1 元（可管理端覆盖）
TOKEN_YUAN_PER_10M = float(os.environ.get('TOKEN_YUAN_PER_10M', '1.0'))
DEEPSEEK_INPUT_PRICE_PER_1M = float(os.environ.get('DEEPSEEK_INPUT_PRICE', str(TOKEN_YUAN_PER_10M / 10.0)))
DEEPSEEK_OUTPUT_PRICE_PER_1M = float(os.environ.get('DEEPSEEK_OUTPUT_PRICE', str(TOKEN_YUAN_PER_10M / 10.0)))
USER_MARKUP = float(os.environ.get('USER_MARKUP', '3.0'))  # 用户扣点倍率（覆盖 API + 运维）
CREDIT_PER_YUAN = 1000  # 1元=1000厘=1.0显示点
LLM_MIN_CHARGE = int(os.environ.get('LLM_MIN_CHARGE', '20'))  # LLM 最低扣 20 厘=0.02点
DAILY_FREE_OPS = int(os.environ.get('DAILY_FREE_OPS', '5'))  # 每日免费本地模块次数
QUICK_RECHARGE_AMOUNTS = [1, 5, 10, 20, 50]  # 快充金额（1元=1点）
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'admin123')
if ADMIN_SECRET == 'admin123' and os.environ.get('FLASK_ENV') == 'production':
    print('[WARN] ADMIN_SECRET 仍为默认 admin123，生产环境请设置环境变量 ADMIN_SECRET')
if not os.environ.get('ADMIN_SECRET'):
    print('[INFO] ADMIN_SECRET 使用默认值 admin123（开发模式）。生产请设置环境变量。')


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
    return jsonify({'ok': True, 'service': '论文文献AI利器', 'sources': ['OpenAlex','OpenAlex-CN','Crossref','Semantic Scholar','arXiv','PubMed','CORE','DOAJ','EuropePMC','CNKI','百度学术']})

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

            # 每个词只查核心源 + 学术源
            for source_fn in [
                lambda: fetch_with_retry(search_openalex, q, min(max_per, 100)),
                lambda: search_crossref(q, 50),
                lambda: search_semantic_scholar(q, 50),
                lambda: search_europepmc(q, 40),
                lambda: search_arxiv(q, 30),
                lambda: search_pubmed(q, 30),
            ]:
                try: all_results.extend(source_fn() or [])
                except: pass

            if is_cn:
                try: all_results.extend(search_baidu_xueshu_page(q, 0) or [])
                except: pass
                try: all_results.extend(search_cnki(q, 30) or [])
                except: pass
                try: all_results.extend(search_openalex_cn(q, 50) or [])
                except: pass
            else:
                # 英文额外源
                try: all_results.extend(search_core(q, 30) or [])
                except: pass
                try: all_results.extend(search_doaj(q, 20) or [])
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
        bonus = int(db.execute("SELECT value FROM config WHERE key='register_bonus'").fetchone()['value'] or 5000)
        # Apply invite code bonus
        inviter_id = None
        if invite:
            ic = db.execute("SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL", (invite,)).fetchone()
            if ic and ic['owner_id']:
                inviter_id = ic['owner_id']
                inv_bonus = int(db.execute("SELECT value FROM config WHERE key='invite_bonus'").fetchone()['value'] or 1000)
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
    # 速率限制：每 IP 每分钟最多 10 次登录尝试
    ip = request.remote_addr or 'unknown'
    if not _check_rate('login:'+ip, max_calls=10, window_sec=60):
        return jsonify({'success': False, 'error': '登录尝试过于频繁，请稍后再试'}), 429
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
        pts = int(order['amount_yuan'] * 1000)
        db.execute("UPDATE recharge_orders SET status = 'confirmed', confirmed_at = datetime('now','localtime') WHERE id = ?", (order_id,))
        db.execute("UPDATE users SET credits = credits + ? WHERE id = ?", (pts, request.user_id))
        after = db.execute('SELECT credits FROM users WHERE id = ?', (request.user_id,)).fetchone()['credits']
        db.execute("INSERT INTO transactions (user_id, type, amount_credits, credits_after, description, created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))",
                   (request.user_id, 'recharge', pts, after, '充值 '+str(pts/1000)+'点'))
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
        pts = int(order['amount_yuan'] * 1000)
        db.execute("UPDATE recharge_orders SET status = 'confirmed', confirmed_at = datetime('now','localtime') WHERE id = ?", (order_id,))
        db.execute("UPDATE users SET credits = credits + ? WHERE id = ?", (pts, order['user_id']))
        after = db.execute('SELECT credits FROM users WHERE id = ?', (order['user_id'],)).fetchone()['credits']
        db.execute("INSERT INTO transactions (user_id, type, amount_credits, credits_after, description, created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))",
                   (order['user_id'], 'recharge', pts, after, '充值 '+str(pts/1000)+'点'))
        db.commit()
        return jsonify({'success': True, 'message': '已到账 '+str(pts/1000)+' 点', 'credits': after, 'points': pts/1000, 'points_after': after/1000})
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
        free_row = db.execute('SELECT used FROM daily_free_usage WHERE user_id = ? AND usage_date = ?',
                              (request.user_id, today)).fetchone()
        used = free_row['used'] if free_row else 0
        free_limit = DAILY_FREE_OPS if 'DAILY_FREE_OPS' in globals() else 5
        return jsonify({
            'success': True,
            'credits': u['credits'],
            'points': round((u['credits'] or 0)/1000, 3),
            'free_used_today': used,
            'free_limit_today': free_limit,
            'free_remaining_today': max(0, free_limit - used),
            'free_available': used < free_limit
        })
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
    """本地/固定价模块扣点。
    credits 存库单位=厘；前端展示点=credits/1000。
    每日前 DAILY_FREE_OPS 次本地模块免费。
    """
    data = request.get_json(silent=True) or {}
    module = (data.get('module') or 'module').strip() or 'module'
    # LLM modules should not use this endpoint for real charge
    db = get_db()
    try:
        today = date.today().isoformat()
        free_row = db.execute('SELECT used FROM daily_free_usage WHERE user_id = ? AND usage_date = ?',
                              (request.user_id, today)).fetchone()
        free_count = free_row['used'] if free_row else 0
        free_limit = DAILY_FREE_OPS if 'DAILY_FREE_OPS' in globals() else 5
        if free_count < free_limit:
            db.execute('INSERT OR IGNORE INTO daily_free_usage (user_id, usage_date, used) VALUES (?, ?, 0)',
                       (request.user_id, today))
            db.execute('UPDATE daily_free_usage SET used = used + 1 WHERE user_id = ? AND usage_date = ?',
                       (request.user_id, today))
            db.execute("UPDATE users SET free_used_date = ? WHERE id = ?", (today, request.user_id))
            db.commit()
            new_count = db.execute('SELECT used FROM daily_free_usage WHERE user_id = ? AND usage_date = ?',
                                   (request.user_id, today)).fetchone()['used']
            return jsonify({'success': True, 'free': True, 'module': module,
                            'message': f'今日免费({new_count}/{free_limit})',
                            'cost': 0, 'cost_points': 0})
    finally:
        db.close()
    price = get_price(module)
    if price <= 0:
        price = get_price('module')
    if price <= 0:
        return jsonify({'success': True, 'free': False, 'module': module, 'cost': 0, 'cost_points': 0})
    ok, err, after = deduct_credits(request.user_id, price, f'模块使用:{module}')
    if not ok:
        return jsonify({'success': False, 'error': err, 'needed': price, 'needed_points': price/1000}), 402
    return jsonify({'success': True, 'free': False, 'module': module, 'cost': price,
                    'cost_points': round(price/1000, 3), 'credits_after': after,
                    'points_after': round((after or 0)/1000, 3)})

# 模块扣点定价（从 config 表读取，默认值兜底）
PRICING_DEFAULTS = {
    # 单位：厘（1点=1000厘，1元充值=1000厘）
    # 本地/轻计算（固定价）
    'module': 100,            # 通用本地模块兜底 0.05点
    'upload': 0,             # 上传解析免费（本地）
    'search': 0,             # 文献检索免费（外部公开源）
    'kg': 0,                 # 知识图谱免费（本地）
    'domain_analysis': 0,    # 领域分析免费引流
    'format-check': 50,
    'terminology': 50,
    'paragraph': 50,
    'dashboard': 100,
    'data-analysis': 150,     # 含本地统计
    'data-ml': 500,  # 0.5点/次，约覆盖CPU          # 多模型训练/特征评分 0.2点
    'export-docx': 200,      # 导出 DOCX 0.1点
    # AI 模块若走 /api/llm/analyze 则按 token 实扣；下列作预估展示/兼容旧 usage_module
    'topic-finder': 0,
    'proposal': 0,
    'review': 0,
    'optimization': 0,
    'expand': 0,
    'proofread': 0,
    'de-duplicate': 0,
    'defense-ppt': 0,
    'en-abstract': 0,
    'llm_analysis': 0,
}


def get_active_pricing_config():
    """Return active pricing overrides from schedules (effective_at <= now)."""
    import json as _json
    db = get_db()
    try:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        row = db.execute(
            "SELECT * FROM pricing_schedules WHERE effective_at <= ? ORDER BY effective_at DESC, id DESC LIMIT 1",
            (now,)
        ).fetchone()
        if not row:
            return {}
        # mark active
        try:
            db.execute("UPDATE pricing_schedules SET is_active=0")
            db.execute("UPDATE pricing_schedules SET is_active=1 WHERE id=?", (row['id'],))
            db.commit()
        except Exception:
            pass
        try:
            return _json.loads(row['config_json'] or '{}') or {}
        except Exception:
            return {}
    finally:
        db.close()


def get_price(key):
    """Price in milli-credits. Supports scheduled global overrides."""
    # scheduled overrides first
    cfg = get_active_pricing_config()
    if key in cfg:
        try:
            return int(float(cfg[key]))
        except Exception:
            pass
    k = key if key.endswith('_price') else (key + '_price')
    if k in cfg:
        try:
            return int(float(cfg[k]))
        except Exception:
            pass
    db = get_db()
    try:
        v = db.execute('SELECT value FROM config WHERE key=?', (k,)).fetchone()
        if v:
            return int(v['value'])
        # bare key
        v2 = db.execute('SELECT value FROM config WHERE key=?', (key,)).fetchone()
        if v2:
            return int(v2['value'])
        return int(PRICING_DEFAULTS.get(key, PRICING_DEFAULTS.get('module', 50)))
    except Exception:
        return int(PRICING_DEFAULTS.get(key, 50))
    finally:
        db.close()

def deduct_credits(user_id, amount, desc):
    db = get_db()
    try:
        u = db.execute('SELECT credits FROM users WHERE id = ?', (user_id,)).fetchone()
        if not u: return False, '用户不存在', None
        if u['credits'] < amount: return False, f'点数不足。需要 {amount/1000:.3f} 点，当前 {u["credits"]/1000:.3f} 点', u['credits']
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
    # 速率限制：每用户每分钟最多 20 次 LLM 调用
    uid = getattr(request, 'user_id', None) or request.remote_addr or 'unknown'
    if not _check_rate('llm:'+str(uid), max_calls=20, window_sec=60):
        return jsonify({'success': False, 'error': 'AI 调用过于频繁，请稍后再试'}), 429
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
    est_credits = max(LLM_MIN_CHARGE if 'LLM_MIN_CHARGE' in globals() else 20, int(est_api_cost * USER_MARKUP * 1000 + 0.999))  # 预估扣厘

    # 检查余额
    db = get_db()
    try:
        u = db.execute('SELECT credits FROM users WHERE id = ?', (request.user_id,)).fetchone()
        if not u: return jsonify({'success': False, 'error': '用户不存在'}), 404
        if u['credits'] < est_credits:
            return jsonify({'success': False, 'error': f'点数不足。预计需 {est_credits/1000:.3f} 点，当前 {u["credits"]/1000:.3f} 点',
                            'credits': u['credits'], 'needed': est_credits, 'needed_points': round(est_credits/1000,3), 'points': round(u['credits']/1000,3)}), 402
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
    # 用户扣点：实际成本（元）×3，折算到厘（×1000），四舍五入，最低 5 厘（≈0.05元/次地板价覆盖运维）
    charge_credits = max(LLM_MIN_CHARGE if 'LLM_MIN_CHARGE' in globals() else 20, round(api_cost * USER_MARKUP * 1000))
    content = result['choices'][0]['message']['content']

    # 扣点
    ok, err, after = deduct_credits(request.user_id, charge_credits,
        f'LLM分析 {module} (输入{actual_input}+输出{actual_output} tokens, API成本¥{api_cost:.4f}, 扣{charge_credits/1000:.2f}点)')
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
        'cost_points': round(charge_credits/1000, 3),
        'credits_after': after, 'points_after': round((after or 0)/1000, 3),
        'markup': USER_MARKUP
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
        inv_bonus = int(db.execute("SELECT value FROM config WHERE key='invite_bonus'").fetchone()['value'] or 1000)
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

def _check_admin(s):
    """Check admin auth: accepts secret key or admin JWT token"""
    if s == ADMIN_SECRET:
        return True
    if HAS_JWT and s:
        try:
            payload = pyjwt.decode(s, JWT_SECRET, algorithms=['HS256'])
            db = get_db()
            try:
                u = db.execute('SELECT is_admin FROM users WHERE id=?', (payload['user_id'],)).fetchone()
                if u and u['is_admin']:
                    return True
            finally: db.close()
        except: pass
    return False

@app.route('/api/admin/dashboard', methods=['GET'])
def admin_dashboard():
    # auth via ADMIN_SECRET or admin JWT (_check_admin)
    s = request.args.get('secret', '')
    auth = request.headers.get('Authorization', '')
    # Try query param first (as secret key or JWT), then header
    db = get_db()
    try:
        authorized = _check_admin(s)
        if not authorized and auth.startswith('Bearer '):
            try:
                payload = pyjwt.decode(auth[7:], JWT_SECRET, algorithms=['HS256'])
                u = db.execute('SELECT is_admin FROM users WHERE id=?', (payload['user_id'],)).fetchone()
                if u and u['is_admin']:
                    authorized = True
            except: pass
        if not authorized:
            return jsonify({'error': '无权限'}), 403
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
        # LLM economics
        try:
            llm_api_cost_total = db.execute('SELECT SUM(cost_credits) as s FROM llm_usage').fetchone()['s'] or 0  # stored as fen-ish (api_cost*100)
            llm_charged_total = db.execute('SELECT SUM(user_charged_credits) as s FROM llm_usage').fetchone()['s'] or 0  # milli-credits
            llm_api_cost_today = db.execute("SELECT SUM(cost_credits) as s FROM llm_usage WHERE created_at LIKE ?", (today+'%',)).fetchone()['s'] or 0
            llm_charged_today = db.execute("SELECT SUM(user_charged_credits) as s FROM llm_usage WHERE created_at LIKE ?", (today+'%',)).fetchone()['s'] or 0
        except Exception:
            llm_api_cost_total = llm_charged_total = llm_api_cost_today = llm_charged_today = 0
        return jsonify({'success': True, 'stats': {
            'total_users': total_users, 'today_users': today_users, 'total_credits': total_credits,
            'total_recharge': total_recharge, 'pending_orders': pending,
            'llm_today': llm_today, 'llm_total': llm_total, 'total_cost': total_cost, 'llm_api_cost_yuan_total': round((llm_api_cost_total or 0)/100.0, 4), 'llm_charged_points_total': round((llm_charged_total or 0)/1000.0, 3), 'llm_api_cost_yuan_today': round((llm_api_cost_today or 0)/100.0, 4), 'llm_charged_points_today': round((llm_charged_today or 0)/1000.0, 3), 'llm_margin_points_total': round(((llm_charged_total or 0)/1000.0) - ((llm_api_cost_total or 0)/100.0), 3),
            'recent_users': recent_users, 'recent_orders': recent_orders
        }})
    finally: db.close()

@app.route('/api/admin/users', methods=['GET'])
def admin_users():
    s = request.args.get('secret', '')
    if not _check_admin(s): return jsonify({'error': '无权限'}), 403
    db = get_db()
    try:
        rows = [dict(r) for r in db.execute('SELECT id,username,credits,invite_code,created_at FROM users ORDER BY id DESC LIMIT 100').fetchall()]
        return jsonify({'success': True, 'users': rows})
    finally: db.close()

@app.route('/api/admin/credits', methods=['POST'])
def admin_credits():
    data = request.get_json() or {}
    if not _check_admin(data.get('secret','')): return jsonify({'error':'无权限'}), 403
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




# ========== 导出 / 数据分析（轻量） ==========
@app.route('/api/export/docx', methods=['POST'])
@require_auth
def export_docx():
    """将项目大纲+分章草稿+参考文献导出为 DOCX。"""
    try:
        from docx import Document
        from docx.shared import Pt, Inches
        from docx.oxml.ns import qn
    except Exception as e:
        return jsonify({'success': False, 'error': '服务器未安装 python-docx: ' + str(e)}), 500
    data = request.get_json() or {}
    title = (data.get('title') or '论文草稿').strip()
    chapters = data.get('chapters') or []
    references = data.get('references') or []
    field = data.get('field') or ''
    degree = data.get('degree') or ''
    if not chapters:
        return jsonify({'success': False, 'error': '没有可导出的章节'}), 400

    price = get_price('export-docx')
    if price > 0:
        ok, err, after = deduct_credits(request.user_id, price, '导出DOCX')
        if not ok:
            return jsonify({'success': False, 'error': err, 'needed': price}), 402

    doc = Document()
    # basic CN font
    try:
        style = doc.styles['Normal']
        style.font.name = 'Times New Roman'
        style.font.size = Pt(12)
        style._element.rPr.rFonts.set(qn('w:eastAsia'), '宋体')
    except Exception:
        pass

    h = doc.add_heading(title, level=0)
    meta = []
    if degree: meta.append(degree)
    if field: meta.append(field)
    if meta:
        p = doc.add_paragraph(' / '.join(meta))
    doc.add_paragraph('')

    for ch in chapters:
        ctitle = (ch.get('title') or '未命名章节').strip()
        doc.add_heading(ctitle, level=1)
        secs = ch.get('sections') or []
        content = (ch.get('content') or '').strip()
        if content:
            for para in content.split('\n'):
                if para.strip():
                    doc.add_paragraph(para.strip())
        else:
            for s in secs:
                if str(s).strip():
                    doc.add_paragraph(str(s).strip(), style=None)
            doc.add_paragraph('（本章暂无草稿）')

    if references:
        doc.add_heading('参考文献', level=1)
        for r in references:
            num = r.get('num') or ''
            text = (r.get('text') or '').strip()
            if not text:
                continue
            prefix = f'[{num}] ' if num != '' else ''
            doc.add_paragraph(prefix + text)

    import io
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    filename = re.sub(r'[\\/:*?"<>|]+', '_', title)[:80] + '.docx'
    return send_file(buf, as_attachment=True, download_name=filename,
                     mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document')



@app.route('/api/data/analyze_ml', methods=['POST'])
@require_auth
def analyze_ml():
    """无代码风格轻量机器学习分析。
    输入: headers, rows, target, task(auto/classify/regress), test_size, top_k
    """
    data = request.get_json() or {}
    headers = data.get('headers') or []
    rows = data.get('rows') or []
    target = data.get('target') or ''
    task = (data.get('task') or 'auto').lower()
    test_size = float(data.get('test_size') or 0.3)
    top_k = int(data.get('top_k') or 12)
    if not headers or not rows or not target or target not in headers:
        return jsonify({'success': False, 'error': '需要 headers/rows/target'}), 400
    try:
        import numpy as np
    except Exception as e:
        return jsonify({'success': False, 'error': '服务器缺少 numpy: ' + str(e)}), 500

    def to_float(v):
        try:
            if v is None or str(v).strip() == '':
                return None
            return float(v)
        except Exception:
            return None

    # Keep mostly numeric features
    feats = []
    for h in headers:
        if h == target:
            continue
        vals = [to_float(r.get(h)) for r in rows]
        non = [v for v in vals if v is not None]
        if len(non) >= max(10, int(0.5 * len(rows))):
            feats.append(h)
    if not feats:
        return jsonify({'success': False, 'error': '未找到足够的数值特征列'}), 400

    X_list, y_raw = [], []
    for r in rows:
        yv = r.get(target, '')
        if yv is None or str(yv).strip() == '':
            continue
        row = []
        ok = True
        for f in feats:
            fv = to_float(r.get(f))
            if fv is None:
                ok = False
                break
            row.append(fv)
        if not ok:
            continue
        X_list.append(row)
        y_raw.append(yv)
    if len(X_list) < 20:
        return jsonify({'success': False, 'error': '有效样本不足（建议 >=20 行完整数值样本）'}), 400

    X = np.asarray(X_list, dtype=float)
    # impute nan just in case
    col_mean = np.nanmean(X, axis=0)
    inds = np.where(np.isnan(X))
    if inds[0].size:
        X[inds] = np.take(col_mean, inds[1])

    # auto task
    y_str = [str(v) for v in y_raw]
    uniq = sorted(list(set(y_str)))
    numeric_y = all(to_float(v) is not None for v in y_raw)
    if task == 'auto':
        task = 'classify' if (not numeric_y or len(uniq) <= max(12, int(0.2 * len(uniq)))) and len(uniq) >= 2 else 'regress'
        if numeric_y and len(uniq) > 15:
            task = 'regress'

    n = X.shape[0]
    rng = np.random.default_rng(42)
    idx = np.arange(n)
    rng.shuffle(idx)
    cut = max(1, min(n - 1, int(n * (1 - test_size))))
    tr, te = idx[:cut], idx[cut:]

    def corr_importance(y_num):
        imp = []
        for j, f in enumerate(feats):
            col = X[:, j]
            if col.std() < 1e-12 or np.std(y_num) < 1e-12:
                score = 0.0
            else:
                score = float(abs(np.corrcoef(col, y_num)[0, 1]))
                if np.isnan(score):
                    score = 0.0
            imp.append({'feature': f, 'score': round(score, 4)})
        imp.sort(key=lambda d: d['score'], reverse=True)
        return imp

    result = {
        'success': True,
        'task': task,
        'n_samples': int(n),
        'n_features': int(len(feats)),
        'n_train': int(len(tr)),
        'n_test': int(len(te)),
        'note': ''
    }

    # try sklearn models when available
    has_sk = False
    try:
        from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, AdaBoostClassifier
        from sklearn.linear_model import LogisticRegression, Ridge
        from sklearn.tree import DecisionTreeClassifier
        from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, r2_score, confusion_matrix
        from sklearn.preprocessing import StandardScaler
        has_sk = True
    except Exception:
        has_sk = False

    if task == 'classify':
        classes = uniq
        y_map = {c: i for i, c in enumerate(classes)}
        y = np.array([y_map[s] for s in y_str], dtype=int)
        imp = corr_importance(y.astype(float))
        selected = [d['feature'] for d in imp[:max(1, min(top_k, len(imp)))]]
        sel_idx = [feats.index(f) for f in selected]
        Xs = X[:, sel_idx]
        result['classes'] = classes
        result['feature_importance'] = imp[:20]
        result['selected_features'] = selected
        models = []
        best = None

        if has_sk:
            Xtr, Xte = Xs[tr], Xs[te]
            ytr, yte = y[tr], y[te]
            scaler = StandardScaler()
            Xtr_s = scaler.fit_transform(Xtr)
            Xte_s = scaler.transform(Xte)
            candidates = []
            # Logistic
            try:
                lr = LogisticRegression(max_iter=300, multi_class='auto')
                lr.fit(Xtr_s, ytr)
                pred = lr.predict(Xte_s)
                proba = None
                if hasattr(lr, 'predict_proba') and len(classes) == 2:
                    proba = lr.predict_proba(Xte_s)[:, 1]
                acc = float(accuracy_score(yte, pred))
                f1 = float(f1_score(yte, pred, average='weighted'))
                auc = float(roc_auc_score(yte, proba)) if proba is not None and len(np.unique(yte)) > 1 else None
                candidates.append({'model': '逻辑回归', 'accuracy': round(acc, 4), 'f1': round(f1, 4), 'auc': None if auc is None else round(auc, 4), '_proba': proba, '_pred': pred})
            except Exception:
                pass
            try:
                rf = RandomForestClassifier(n_estimators=120, random_state=42)
                rf.fit(Xtr, ytr)
                pred = rf.predict(Xte)
                proba = rf.predict_proba(Xte)[:, 1] if len(classes) == 2 else None
                acc = float(accuracy_score(yte, pred))
                f1 = float(f1_score(yte, pred, average='weighted'))
                auc = float(roc_auc_score(yte, proba)) if proba is not None and len(np.unique(yte)) > 1 else None
                # tree importance remap to selected
                fi = getattr(rf, 'feature_importances_', None)
                if fi is not None:
                    for i, f in enumerate(selected):
                        # blend into imp display for top features
                        pass
                    tree_imp = [{'feature': selected[i], 'score': round(float(fi[i]), 4)} for i in range(len(selected))]
                    tree_imp.sort(key=lambda d: d['score'], reverse=True)
                    result['feature_importance_model'] = tree_imp[:20]
                candidates.append({'model': '随机森林', 'accuracy': round(acc, 4), 'f1': round(f1, 4), 'auc': None if auc is None else round(auc, 4), '_proba': proba, '_pred': pred})
            except Exception:
                pass
            try:
                ada = AdaBoostClassifier(n_estimators=80, random_state=42)
                ada.fit(Xtr, ytr)
                pred = ada.predict(Xte)
                proba = ada.predict_proba(Xte)[:, 1] if len(classes) == 2 and hasattr(ada, 'predict_proba') else None
                acc = float(accuracy_score(yte, pred))
                f1 = float(f1_score(yte, pred, average='weighted'))
                auc = float(roc_auc_score(yte, proba)) if proba is not None and len(np.unique(yte)) > 1 else None
                candidates.append({'model': 'AdaBoost', 'accuracy': round(acc, 4), 'f1': round(f1, 4), 'auc': None if auc is None else round(auc, 4), '_proba': proba, '_pred': pred})
            except Exception:
                pass
            try:
                dt = DecisionTreeClassifier(max_depth=6, random_state=42)
                dt.fit(Xtr, ytr)
                pred = dt.predict(Xte)
                acc = float(accuracy_score(yte, pred))
                f1 = float(f1_score(yte, pred, average='weighted'))
                candidates.append({'model': '决策树', 'accuracy': round(acc, 4), 'f1': round(f1, 4), 'auc': None, '_proba': None, '_pred': pred})
            except Exception:
                pass
            if candidates:
                best = max(candidates, key=lambda d: (d.get('auc') is not None, d.get('auc') or 0, d.get('accuracy') or 0))
                models = [{k: v for k, v in c.items() if not k.startswith('_')} for c in candidates]
                result['model_compare'] = models
                result['best_model'] = best['model']
                # ROC curve for best binary
                if best.get('_proba') is not None and len(classes) == 2:
                    # build ROC points
                    scores = np.asarray(best['_proba'], dtype=float)
                    y_true = y[te]
                    thresholds = np.linspace(0, 1, 51)
                    fpr_list, tpr_list = [], []
                    for th in thresholds:
                        pred_b = (scores >= th).astype(int)
                        tp = float(np.sum((pred_b == 1) & (y_true == 1)))
                        fp = float(np.sum((pred_b == 1) & (y_true == 0)))
                        tn = float(np.sum((pred_b == 0) & (y_true == 0)))
                        fn = float(np.sum((pred_b == 0) & (y_true == 1)))
                        tpr = tp / (tp + fn + 1e-12)
                        fpr = fp / (fp + tn + 1e-12)
                        fpr_list.append(round(fpr, 4))
                        tpr_list.append(round(tpr, 4))
                    result['roc'] = {'fpr': fpr_list, 'tpr': tpr_list, 'auc': best.get('auc'), 'model': best['model']}
                # confusion
                try:
                    cm = confusion_matrix(y[te], best['_pred']).tolist()
                    result['confusion'] = {'matrix': cm, 'labels': classes}
                except Exception:
                    pass
                result['note'] = '已完成特征评分 + 多模型训练/对比。可解释性为模型特征重要性（非完整SHAP）。'
            else:
                has_sk = False

        if not has_sk or not result.get('model_compare'):
            # fallback nearest centroid
            def predict_centroid(Xtr, ytr, Xte):
                preds = []
                for x in Xte:
                    best_c, bd = 0, 1e18
                    for c in np.unique(ytr):
                        mu = Xtr[ytr == c].mean(axis=0)
                        d = float(np.sum((x - mu) ** 2))
                        if d < bd:
                            bd, best_c = d, int(c)
                    preds.append(best_c)
                return np.array(preds)
            pred = predict_centroid(Xs[tr], y[tr], Xs[te]) if len(te) else np.array([])
            acc = float((pred == y[te]).mean()) if len(te) else None
            result['model_compare'] = [{'model': 'NearestCentroid', 'accuracy': None if acc is None else round(acc, 4), 'f1': None, 'auc': None}]
            result['best_model'] = 'NearestCentroid'
            result['feature_importance'] = imp[:20]
            result['selected_features'] = selected
            result['note'] = 'sklearn 不可用时的轻量回退：相关评分 + 最近质心分类。'

    else:  # regress
        y = np.array([float(v) for v in y_raw], dtype=float)
        imp = corr_importance(y)
        selected = [d['feature'] for d in imp[:max(1, min(top_k, len(imp)))]]
        sel_idx = [feats.index(f) for f in selected]
        Xs = X[:, sel_idx]
        result['feature_importance'] = imp[:20]
        result['selected_features'] = selected
        models = []
        if has_sk:
            Xtr, Xte = Xs[tr], Xs[te]
            ytr, yte = y[tr], y[te]
            try:
                ridge = Ridge(alpha=1.0)
                ridge.fit(Xtr, ytr)
                pred = ridge.predict(Xte)
                models.append({'model': 'Ridge回归', 'r2': round(float(r2_score(yte, pred)), 4)})
            except Exception:
                pass
            try:
                rf = RandomForestRegressor(n_estimators=120, random_state=42)
                rf.fit(Xtr, ytr)
                pred = rf.predict(Xte)
                models.append({'model': '随机森林回归', 'r2': round(float(r2_score(yte, pred)), 4)})
                fi = getattr(rf, 'feature_importances_', None)
                if fi is not None:
                    tree_imp = [{'feature': selected[i], 'score': round(float(fi[i]), 4)} for i in range(len(selected))]
                    tree_imp.sort(key=lambda d: d['score'], reverse=True)
                    result['feature_importance_model'] = tree_imp[:20]
            except Exception:
                pass
        if not models:
            # OLS top features
            Xk = np.c_[np.ones(len(Xs)), Xs]
            beta, *_ = np.linalg.lstsq(Xk, y, rcond=None)
            yhat = Xk @ beta
            ss_res = float(np.sum((y - yhat) ** 2))
            ss_tot = float(np.sum((y - y.mean()) ** 2)) or 1.0
            r2 = 1 - ss_res / ss_tot
            models = [{'model': 'OLS-TopFeatures', 'r2': round(float(r2), 4)}]
            result['note'] = '回归轻量实现：相关评分 + 最小二乘/可选随机森林。'
        else:
            result['note'] = '已完成回归特征评分与模型对比。'
        result['model_compare'] = models
        result['best_model'] = max(models, key=lambda d: d.get('r2') or -1e9)['model']

    # 固定价扣点（本地/服务器计算，非 LLM token）
    price = get_price('data-ml')
    if price > 0:
        ok, err, after = deduct_credits(request.user_id, price, '数据分析-特征/模型训练')
        if not ok:
            return jsonify({'success': False, 'error': err, 'needed': price}), 402
        result['usage'] = {'cost_credits': price, 'cost_points': round(price/1000,3), 'credits_after': after, 'points_after': round((after or 0)/1000,3)}
    else:
        result['usage'] = {'cost_credits': 0, 'cost_points': 0}
    return jsonify(result)




@app.route('/api/pricing', methods=['GET'])
def pricing_info():
    """公开计费说明（不展示敏感配置）。"""
    items = []
    for k, v in PRICING_DEFAULTS.items():
        items.append({
            'key': k,
            'milli_credits': get_price(k) if k not in ('topic-finder','proposal','review','optimization','expand','proofread','de-duplicate','defense-ppt','en-abstract','llm_analysis') else 0,
            'points': round((get_price(k) if k not in ('topic-finder','proposal','review','optimization','expand','proofread','de-duplicate','defense-ppt','en-abstract','llm_analysis') else 0)/1000, 3),
            'billing': 'llm-token' if k in ('topic-finder','proposal','review','optimization','expand','proofread','de-duplicate','defense-ppt','en-abstract','llm_analysis') else 'fixed'
        })
    return jsonify({
        'success': True,
        'unit': {'credit_name': '点', 'storage': 'milli-credit(厘)', 'ratio': '1点=1000厘', 'recharge': '1元=1点=1000厘'},
        'llm': {
            'formula': '扣点(厘)=max(最低扣点, round(API成本元 × 倍率 × 1000))',
            'markup': USER_MARKUP if 'USER_MARKUP' in globals() else 3.0,
            'min_charge_points': (LLM_MIN_CHARGE if 'LLM_MIN_CHARGE' in globals() else 20)/1000,
            'provider_prices_yuan_per_1m_tokens': {
                'input': DEEPSEEK_INPUT_PRICE_PER_1M if 'DEEPSEEK_INPUT_PRICE_PER_1M' in globals() else 1.0,
                'output': DEEPSEEK_OUTPUT_PRICE_PER_1M if 'DEEPSEEK_OUTPUT_PRICE_PER_1M' in globals() else 2.0
            }
        },
        'daily_free_local_ops': DAILY_FREE_OPS if 'DAILY_FREE_OPS' in globals() else 5,
        'register_bonus_points': 3.0,
        'items': items,
        'notes': [
            'AI 写作类功能按实际 token 消耗计费，前端不展示固定点数。',
            '本地统计/检索/图谱默认低价或免费，仅覆盖服务器成本。',
            '多模型训练等服务器计算按固定小额点数计费。'
        ]
    })




@app.route('/api/usage/history', methods=['GET'])
@require_auth
def usage_history():
    """用户消费明细：交易 + LLM 调用。"""
    limit = min(100, max(1, int(request.args.get('limit', 50))))
    db = get_db()
    try:
        txs = [dict(r) for r in db.execute(
            "SELECT id,type,amount_credits,credits_after,description,created_at FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT ?",
            (request.user_id, limit)).fetchall()]
        llms = [dict(r) for r in db.execute(
            "SELECT id,module,prompt_tokens,completion_tokens,cost_credits,user_charged_credits,model,success,created_at FROM llm_usage WHERE user_id=? ORDER BY id DESC LIMIT ?",
            (request.user_id, limit)).fetchall()]
        for t in txs:
            t['points'] = round((t.get('amount_credits') or 0)/1000, 3)
            t['points_after'] = round((t.get('credits_after') or 0)/1000, 3)
        for l in llms:
            l['points_charged'] = round((l.get('user_charged_credits') or 0)/1000, 3)
        return jsonify({'success': True, 'transactions': txs, 'llm_usage': llms})
    finally:
        db.close()


@app.route('/api/admin/pricing', methods=['GET', 'POST'])
def admin_pricing():
    """管理员查看/修改计费配置。"""
    s = request.args.get('secret', '') if request.method == 'GET' else (request.get_json() or {}).get('secret', '')
    if not s:
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            s = auth[7:]
    if not _check_admin(s):
        return jsonify({'success': False, 'error': '无权限'}), 403

    if request.method == 'GET':
        db = get_db()
        try:
            rows = {r['key']: r['value'] for r in db.execute('SELECT key,value FROM config').fetchall()}
            items = []
            for k, default in PRICING_DEFAULTS.items():
                key = k + '_price'
                val = int(rows.get(key, default))
                items.append({
                    'key': k,
                    'config_key': key,
                    'milli_credits': val,
                    'points': round(val/1000, 3),
                    'billing': 'llm-token' if k in ('topic-finder','proposal','review','optimization','expand','proofread','de-duplicate','defense-ppt','en-abstract','llm_analysis') else 'fixed'
                })
            # also expose bonus keys
            bonuses = {
                'register_bonus': int(rows.get('register_bonus', 3000)),
                'invite_bonus': int(rows.get('invite_bonus', 1000)),
            }
            return jsonify({'success': True, 'items': items, 'bonuses': bonuses,
                            'unit': {'ratio': '1点=1000厘', 'recharge': '1元=1点'},
                            'llm_markup': USER_MARKUP if 'USER_MARKUP' in globals() else 3.0,
                            'llm_min_charge_points': (LLM_MIN_CHARGE if 'LLM_MIN_CHARGE' in globals() else 20)/1000,
                            'daily_free_ops': DAILY_FREE_OPS if 'DAILY_FREE_OPS' in globals() else 5})
        finally:
            db.close()

    # POST update
    data = request.get_json() or {}
    updates = data.get('updates') or {}
    if not isinstance(updates, dict) or not updates:
        return jsonify({'success': False, 'error': 'updates 不能为空'}), 400
    db = get_db()
    try:
        allowed = set([k+'_price' for k in PRICING_DEFAULTS.keys()] + ['register_bonus', 'invite_bonus'])
        changed = []
        for k, v in updates.items():
            key = k if k.endswith('_price') or k in ('register_bonus','invite_bonus') else (k + '_price')
            if key not in allowed and k not in ('register_bonus','invite_bonus'):
                continue
            try:
                iv = int(float(v))
            except Exception:
                continue
            if iv < 0: iv = 0
            db.execute('INSERT INTO config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, str(iv)))
            changed.append({key: iv})
        db.commit()
        return jsonify({'success': True, 'changed': changed})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()




@app.route('/api/admin/llm_economics', methods=['GET'])
def admin_llm_economics():
    s = request.args.get('secret', '')
    auth = request.headers.get('Authorization', '')
    if not s and auth.startswith('Bearer '):
        s = auth[7:]
    if not _check_admin(s):
        return jsonify({'success': False, 'error': '无权限'}), 403
    db = get_db()
    try:
        today = date.today().isoformat()
        total_calls = db.execute('SELECT COUNT(*) as c FROM llm_usage').fetchone()['c']
        today_calls = db.execute("SELECT COUNT(*) as c FROM llm_usage WHERE created_at LIKE ?", (today+'%',)).fetchone()['c']
        api_cost_fen_total = db.execute('SELECT SUM(cost_credits) as s FROM llm_usage').fetchone()['s'] or 0
        charged_milli_total = db.execute('SELECT SUM(user_charged_credits) as s FROM llm_usage').fetchone()['s'] or 0
        api_cost_fen_today = db.execute("SELECT SUM(cost_credits) as s FROM llm_usage WHERE created_at LIKE ?", (today+'%',)).fetchone()['s'] or 0
        charged_milli_today = db.execute("SELECT SUM(user_charged_credits) as s FROM llm_usage WHERE created_at LIKE ?", (today+'%',)).fetchone()['s'] or 0
        by_module = [dict(r) for r in db.execute(
            "SELECT module, COUNT(*) as calls, SUM(prompt_tokens) as tin, SUM(completion_tokens) as tout, "
            "SUM(cost_credits) as api_cost_fen, SUM(user_charged_credits) as charged_milli "
            "FROM llm_usage GROUP BY module ORDER BY calls DESC LIMIT 30"
        ).fetchall()]
        for r in by_module:
            r['api_cost_yuan'] = round((r.get('api_cost_fen') or 0)/100.0, 4)
            r['charged_points'] = round((r.get('charged_milli') or 0)/1000.0, 3)
            r['margin_points'] = round(r['charged_points'] - r['api_cost_yuan'], 3)
        return jsonify({
            'success': True,
            'summary': {
                'total_calls': total_calls,
                'today_calls': today_calls,
                'api_cost_yuan_total': round(api_cost_fen_total/100.0, 4),
                'charged_points_total': round(charged_milli_total/1000.0, 3),
                'margin_points_total': round((charged_milli_total/1000.0) - (api_cost_fen_total/100.0), 3),
                'api_cost_yuan_today': round(api_cost_fen_today/100.0, 4),
                'charged_points_today': round(charged_milli_today/1000.0, 3),
                'margin_points_today': round((charged_milli_today/1000.0) - (api_cost_fen_today/100.0), 3),
            },
            'by_module': by_module
        })
    finally:
        db.close()




# ========== 云端项目库 ==========
def _project_row_to_dict(row, artifacts=None):
    import json as _json
    d = dict(row)
    # normalize
    out = {
        'id': d.get('id'),
        'title': d.get('title') or '未命名论文项目',
        'idea': d.get('idea') or '',
        'field': d.get('field') or '',
        'keywords': d.get('keywords') or '',
        'degree': d.get('degree') or '硕士',
        'goalWords': d.get('goal_words') or 30000,
        'currentStage': d.get('current_stage') or 'ideation',
        'mode': d.get('mode') or 'create',
        'hasManuscript': bool(d.get('has_manuscript') or 0),
        'schoolTemplate': d.get('school_template') or '',
        'notes': d.get('notes') or '',
        'createdAt': d.get('created_at'),
        'updatedAt': d.get('updated_at'),
        'stageStatus': {},
        'artifacts': {'outline': None, 'chapters': {}, 'skillLogs': [], '_versions': {}}
    }
    try:
        out['stageStatus'] = _json.loads(d.get('stage_status') or '{}') or {}
    except Exception:
        out['stageStatus'] = {}
    if artifacts:
        a = dict(artifacts)
        try: out['artifacts']['outline'] = _json.loads(a.get('outline_json') or 'null')
        except Exception: out['artifacts']['outline'] = None
        try: out['artifacts']['chapters'] = _json.loads(a.get('chapters_json') or '{}') or {}
        except Exception: out['artifacts']['chapters'] = {}
        try: out['artifacts']['_versions'] = _json.loads(a.get('versions_json') or '{}') or {}
        except Exception: out['artifacts']['_versions'] = {}
        try: out['artifacts']['skillLogs'] = _json.loads(a.get('skill_logs_json') or '[]') or []
        except Exception: out['artifacts']['skillLogs'] = []
        try: out['artifacts']['manuscriptMeta'] = _json.loads(a.get('manuscript_meta_json') or 'null')
        except Exception: out['artifacts']['manuscriptMeta'] = None
    return out


@app.route('/api/projects', methods=['GET'])
@require_auth
def projects_list():
    db = get_db()
    try:
        rows = db.execute(
            'SELECT * FROM projects WHERE user_id=? ORDER BY updated_at DESC, created_at DESC LIMIT 100',
            (request.user_id,)
        ).fetchall()
        items = []
        for r in rows:
            art = db.execute('SELECT * FROM project_artifacts WHERE project_id=?', (r['id'],)).fetchone()
            items.append(_project_row_to_dict(r, art))
        return jsonify({'success': True, 'projects': items})
    finally:
        db.close()


@app.route('/api/projects/<project_id>', methods=['GET'])
@require_auth
def projects_get(project_id):
    db = get_db()
    try:
        r = db.execute('SELECT * FROM projects WHERE id=? AND user_id=?', (project_id, request.user_id)).fetchone()
        if not r:
            return jsonify({'success': False, 'error': '项目不存在'}), 404
        art = db.execute('SELECT * FROM project_artifacts WHERE project_id=?', (project_id,)).fetchone()
        return jsonify({'success': True, 'project': _project_row_to_dict(r, art)})
    finally:
        db.close()


@app.route('/api/projects', methods=['POST'])
@require_auth
def projects_upsert():
    """创建或更新项目（含 artifacts）。"""
    import json as _json
    data = request.get_json() or {}
    p = data.get('project') or data
    pid = (p.get('id') or '').strip()
    if not pid:
        pid = 'p_' + secrets.token_hex(8)
    title = (p.get('title') or '未命名论文项目').strip()[:200]
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    stage_status = p.get('stageStatus') or {}
    artifacts = p.get('artifacts') or {}
    db = get_db()
    try:
        exists = db.execute('SELECT id FROM projects WHERE id=? AND user_id=?', (pid, request.user_id)).fetchone()
        payload = (
            title,
            p.get('idea') or '',
            p.get('field') or '',
            p.get('keywords') or '',
            p.get('degree') or '硕士',
            int(p.get('goalWords') or 30000),
            p.get('currentStage') or 'ideation',
            p.get('mode') or 'create',
            1 if p.get('hasManuscript') else 0,
            _json.dumps(stage_status, ensure_ascii=False),
            p.get('schoolTemplate') or '',
            p.get('notes') or '',
            now,
            pid,
            request.user_id,
        )
        if exists:
            db.execute(
                "UPDATE projects SET title=?, idea=?, field=?, keywords=?, degree=?, goal_words=?, current_stage=?, mode=?, "
                "has_manuscript=?, stage_status=?, school_template=?, notes=?, updated_at=? "
                "WHERE id=? AND user_id=?",
                payload
            )
        else:
            db.execute(
                "INSERT INTO projects "
                "(title, idea, field, keywords, degree, goal_words, current_stage, mode, has_manuscript, stage_status, school_template, notes, updated_at, id, user_id, created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                payload + (p.get('createdAt') or now,)
            )
        # artifacts upsert
        db.execute(
            "INSERT INTO project_artifacts(project_id, outline_json, chapters_json, versions_json, skill_logs_json, manuscript_meta_json, updated_at) "
            "VALUES (?,?,?,?,?,?,?) "
            "ON CONFLICT(project_id) DO UPDATE SET "
            "outline_json=excluded.outline_json, "
            "chapters_json=excluded.chapters_json, "
            "versions_json=excluded.versions_json, "
            "skill_logs_json=excluded.skill_logs_json, "
            "manuscript_meta_json=excluded.manuscript_meta_json, "
            "updated_at=excluded.updated_at",
            (
                pid,
                _json.dumps(artifacts.get('outline'), ensure_ascii=False),
                _json.dumps(artifacts.get('chapters') or {}, ensure_ascii=False),
                _json.dumps(artifacts.get('_versions') or {}, ensure_ascii=False),
                _json.dumps(artifacts.get('skillLogs') or [], ensure_ascii=False),
                _json.dumps(artifacts.get('manuscriptMeta'), ensure_ascii=False),
                now,
            )
        )
        db.commit()
        row = db.execute('SELECT * FROM projects WHERE id=? AND user_id=?', (pid, request.user_id)).fetchone()
        art = db.execute('SELECT * FROM project_artifacts WHERE project_id=?', (pid,)).fetchone()
        return jsonify({'success': True, 'project': _project_row_to_dict(row, art)})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/projects/<project_id>', methods=['DELETE'])
@require_auth
def projects_delete(project_id):
    db = get_db()
    try:
        r = db.execute('SELECT id FROM projects WHERE id=? AND user_id=?', (project_id, request.user_id)).fetchone()
        if not r:
            return jsonify({'success': False, 'error': '项目不存在'}), 404
        db.execute('DELETE FROM project_artifacts WHERE project_id=?', (project_id,))
        db.execute('DELETE FROM projects WHERE id=? AND user_id=?', (project_id, request.user_id))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()




@app.route('/api/projects/<project_id>/materials', methods=['GET'])
@require_auth
def materials_list(project_id):
    db = get_db()
    try:
        own = db.execute('SELECT id FROM projects WHERE id=? AND user_id=?', (project_id, request.user_id)).fetchone()
        if not own:
            return jsonify({'success': False, 'error': '项目不存在'}), 404
        rows = db.execute(
            'SELECT id, project_id, filename, kind, mime, size_bytes, meta_json, created_at FROM project_materials WHERE project_id=? AND user_id=? ORDER BY created_at DESC',
            (project_id, request.user_id)
        ).fetchall()
        items = []
        import json as _json
        for r in rows:
            d = dict(r)
            try:
                d['meta'] = _json.loads(d.pop('meta_json') or '{}')
            except Exception:
                d['meta'] = {}
            items.append(d)
        return jsonify({'success': True, 'materials': items})
    finally:
        db.close()


@app.route('/api/projects/<project_id>/materials', methods=['POST'])
@require_auth
def materials_upload(project_id):
    """Upload a file into project materials library (csv/docx/pdf/json/txt...)."""
    import json as _json
    db = get_db()
    try:
        own = db.execute('SELECT id FROM projects WHERE id=? AND user_id=?', (project_id, request.user_id)).fetchone()
        if not own:
            return jsonify({'success': False, 'error': '项目不存在'}), 404
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': '未选择文件'}), 400
        f = request.files['file']
        raw = f.read()
        if not raw:
            return jsonify({'success': False, 'error': '空文件'}), 400
        if len(raw) > 30 * 1024 * 1024:
            return jsonify({'success': False, 'error': '文件过大（上限30MB）'}), 400
        filename = (f.filename or 'file.bin').replace('\\\\', '/').split('/')[-1]
        ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else 'bin'
        kind = request.form.get('kind') or ext
        mid = 'm_' + secrets.token_hex(8)
        user_dir = os.path.join(MATERIALS_DIR, str(request.user_id), project_id)
        os.makedirs(user_dir, exist_ok=True)
        storage_name = mid + '_' + re.sub(r'[^A-Za-z0-9._一-鿿-]+', '_', filename)[:80]
        storage_path = os.path.join(user_dir, storage_name)
        with open(storage_path, 'wb') as out:
            out.write(raw)
        meta = {}
        try:
            meta = _json.loads(request.form.get('meta') or '{}')
        except Exception:
            meta = {}
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        db.execute(
            'INSERT INTO project_materials(id, project_id, user_id, filename, kind, mime, size_bytes, storage_path, meta_json, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            (mid, project_id, request.user_id, filename, kind, f.mimetype or '', len(raw), storage_path, _json.dumps(meta, ensure_ascii=False), now)
        )
        db.commit()
        return jsonify({'success': True, 'material': {
            'id': mid, 'project_id': project_id, 'filename': filename, 'kind': kind,
            'mime': f.mimetype or '', 'size_bytes': len(raw), 'meta': meta, 'created_at': now
        }})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/materials/<material_id>', methods=['GET', 'DELETE'])
@require_auth
def materials_one(material_id):
    db = get_db()
    try:
        row = db.execute('SELECT * FROM project_materials WHERE id=? AND user_id=?', (material_id, request.user_id)).fetchone()
        if not row:
            return jsonify({'success': False, 'error': '资料不存在'}), 404
        if request.method == 'DELETE':
            try:
                if row['storage_path'] and os.path.exists(row['storage_path']):
                    os.remove(row['storage_path'])
            except Exception:
                pass
            db.execute('DELETE FROM project_materials WHERE id=? AND user_id=?', (material_id, request.user_id))
            db.commit()
            return jsonify({'success': True})
        # GET download
        return send_file(row['storage_path'], as_attachment=True, download_name=row['filename'])
    finally:
        db.close()




@app.route('/api/admin/pricing/schedules', methods=['GET', 'POST'])
def admin_pricing_schedules():
    import json as _json
    s = request.args.get('secret', '') if request.method == 'GET' else (request.get_json() or {}).get('secret', '')
    auth = request.headers.get('Authorization', '')
    if not s and auth.startswith('Bearer '):
        s = auth[7:]
    if not _check_admin(s):
        return jsonify({'success': False, 'error': '无权限'}), 403

    if request.method == 'GET':
        db = get_db()
        try:
            rows = [dict(r) for r in db.execute(
                'SELECT id,name,config_json,effective_at,created_at,is_active FROM pricing_schedules ORDER BY effective_at DESC, id DESC LIMIT 50'
            ).fetchall()]
            for r in rows:
                try:
                    r['config'] = _json.loads(r.get('config_json') or '{}')
                except Exception:
                    r['config'] = {}
            active = get_active_pricing_config()
            return jsonify({'success': True, 'schedules': rows, 'active_config': active})
        finally:
            db.close()

    data = request.get_json() or {}
    name = (data.get('name') or '定价方案').strip()[:80]
    effective_at = (data.get('effective_at') or '').strip()
    config = data.get('config') or {}
    if not effective_at:
        return jsonify({'success': False, 'error': '请提供 effective_at (YYYY-mm-dd HH:MM:SS)'}), 400
    if not isinstance(config, dict) or not config:
        return jsonify({'success': False, 'error': 'config 不能为空'}), 400
    db = get_db()
    try:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cur = db.execute(
            "INSERT INTO pricing_schedules(name, config_json, effective_at, created_by, created_at, is_active) VALUES (?,?,?,?,?,0)",
            (name, _json.dumps(config, ensure_ascii=False), effective_at, None, now)
        )
        db.commit()
        return jsonify({'success': True, 'id': cur.lastrowid, 'message': '定价方案已创建，将于生效时间后自动启用'})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/admin/ops_stats', methods=['GET'])
def admin_ops_stats():
    s = request.args.get('secret', '')
    auth = request.headers.get('Authorization', '')
    if not s and auth.startswith('Bearer '):
        s = auth[7:]
    if not _check_admin(s):
        return jsonify({'success': False, 'error': '无权限'}), 403
    db = get_db()
    try:
        today = date.today().isoformat()
        users = db.execute('SELECT COUNT(*) as c FROM users').fetchone()['c']
        orders_pending = db.execute("SELECT COUNT(*) as c FROM recharge_orders WHERE status='pending'").fetchone()['c']
        orders_today = db.execute("SELECT COUNT(*) as c, SUM(amount_yuan) as s FROM recharge_orders WHERE created_at LIKE ?", (today+'%',)).fetchone()
        recharged_today = db.execute("SELECT COUNT(*) as c, SUM(amount_yuan) as s FROM recharge_orders WHERE status='confirmed' AND confirmed_at LIKE ?", (today+'%',)).fetchone()
        llm_today = db.execute("SELECT COUNT(*) as c, SUM(user_charged_credits) as charged, SUM(cost_credits) as api_fen FROM llm_usage WHERE created_at LIKE ?", (today+'%',)).fetchone()
        projects = 0
        try:
            projects = db.execute('SELECT COUNT(*) as c FROM projects').fetchone()['c']
        except Exception:
            projects = 0
        return jsonify({'success': True, 'stats': {
            'users': users,
            'projects': projects,
            'orders_pending': orders_pending,
            'orders_today': orders_today['c'] or 0,
            'order_amount_today': float(orders_today['s'] or 0),
            'confirmed_amount_today': float(recharged_today['s'] or 0),
            'llm_calls_today': llm_today['c'] or 0,
            'llm_charged_points_today': round((llm_today['charged'] or 0)/1000.0, 3),
            'llm_api_cost_yuan_today': round((llm_today['api_fen'] or 0)/100.0, 4),
        }})
    finally:
        db.close()




@app.route('/api/payment/webhook', methods=['POST'])
def payment_webhook():
    """支付渠道到账回调占位。
    真实环境应校验签名（支付宝/微信 notify），根据 out_trade_no 找到订单并确认到账。
    当前默认关闭自动到账，仅记录请求，避免误入账。
    """
    enable = os.environ.get('PAYMENT_WEBHOOK_ENABLE', '0') == '1'
    data = request.get_json(silent=True) or dict(request.form) or {}
    # Always log
    try:
        print('[payment-webhook]', data)
    except Exception:
        pass
    if not enable:
        return jsonify({'success': False, 'error': 'webhook disabled; use admin manual confirm', 'received': True}), 200
    # Minimal auto-confirm contract:
    # { order_id, trade_status=SUCCESS, amount_yuan, sign }
    order_id = data.get('order_id') or data.get('out_trade_no')
    status = str(data.get('trade_status') or data.get('status') or '').upper()
    if not order_id or status not in ('SUCCESS', 'TRADE_SUCCESS', 'PAID', 'CONFIRMED'):
        return jsonify({'success': False, 'error': 'invalid payload'}), 400
    # TODO: verify signature with PAYMENT_WEBHOOK_SECRET
    secret = os.environ.get('PAYMENT_WEBHOOK_SECRET', '')
    if secret and data.get('sign') != secret:
        return jsonify({'success': False, 'error': 'bad sign'}), 403
    db = get_db()
    try:
        order = db.execute('SELECT * FROM recharge_orders WHERE id = ?', (order_id,)).fetchone()
        if not order:
            return jsonify({'success': False, 'error': 'order not found'}), 404
        if order['status'] == 'confirmed':
            return jsonify({'success': True, 'message': 'already confirmed'})
        pts = int(order['amount_yuan'] * 1000)
        db.execute("UPDATE recharge_orders SET status='confirmed', confirmed_at=datetime('now','localtime') WHERE id=?", (order_id,))
        db.execute('UPDATE users SET credits = credits + ? WHERE id=?', (pts, order['user_id']))
        after = db.execute('SELECT credits FROM users WHERE id=?', (order['user_id'],)).fetchone()['credits']
        db.execute("INSERT INTO transactions (user_id,type,amount_credits,credits_after,description,created_at) VALUES (?,?,?,?,?,datetime('now','localtime'))",
                   (order['user_id'], 'recharge', pts, after, f'支付回调到账 {pts/1000}点'))
        db.commit()
        return jsonify({'success': True, 'credits': after, 'points': after/1000})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


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


