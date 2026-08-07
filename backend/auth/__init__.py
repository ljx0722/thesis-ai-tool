"""
认证授权 Blueprint
注册、登录、JWT 验证、密码管理
"""
import hashlib
import secrets
import time
from functools import wraps

from flask import Blueprint, request, jsonify

from backend.database import get_db
from backend.utils.time_utils import today_beijing
from backend.utils.jwt import create_token, verify_token

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# 内存速率限制
_rate_buckets = {}


def _check_rate(key, max_calls=30, window_sec=60):
    """简单的内存速率限制，返回 True 表示未超限。"""
    now = time.time()
    bucket = _rate_buckets.setdefault(key, [])
    _rate_buckets[key] = [t for t in bucket if now - t < window_sec]
    if len(_rate_buckets[key]) >= max_calls:
        return False
    _rate_buckets[key].append(now)
    return True


def hash_password(password):
    """PBKDF2-SHA256 哈希密码。"""
    salt = secrets.token_bytes(32)
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return salt.hex() + ':' + key.hex()


def verify_password(password, stored):
    """验证密码。"""
    salt_hex, key_hex = stored.split(':')
    salt = bytes.fromhex(salt_hex)
    key = bytes.fromhex(key_hex)
    new_key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return secrets.compare_digest(key, new_key)


def generate_token(user_id):
    """为指定用户生成 JWT token。"""
    return create_token(user_id, '', False)


def require_auth(f):
    """JWT 认证装饰器。"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'error': '未登录或登录已过期'}), 401
        token = auth_header[7:]
        payload = verify_token(token)
        if not payload:
            return jsonify({'success': False, 'error': '无效的登录凭证'}), 401
        request.user_id = payload['user_id']
        return f(*args, **kwargs)
    return wrapper


@auth_bp.route('/register', methods=['POST'])
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
        inviter_id = None
        inv_bonus = 0
        if invite:
            ic = db.execute("SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL", (invite,)).fetchone()
            if ic and ic['owner_id']:
                inviter_id = ic['owner_id']
                inv_bonus = int(db.execute("SELECT value FROM config WHERE key='invite_bonus'").fetchone()['value'] or 1000)
                bonus += inv_bonus
        cur = db.execute(
            "INSERT INTO users (username, password_hash, credits, invited_by, created_at) VALUES (?, ?, ?, ?, datetime('now','localtime'))",
            (username, pwd_hash, bonus, inviter_id))
        new_uid = cur.lastrowid
        db.execute(
            "INSERT INTO transactions (user_id,type,amount_credits,credits_after,description,created_at) "
            "VALUES (?,?,?,?,?,datetime('now','localtime'))",
            (new_uid, 'register_bonus', bonus, bonus, f'注册赠送 {bonus/1000:.3f} 点'))
        if inviter_id and inv_bonus:
            db.execute(
                "UPDATE invite_codes SET used_by = ?, used_at = datetime('now','localtime') WHERE code = ? AND used_by IS NULL",
                (new_uid, invite))
            db.execute("UPDATE users SET credits = credits + ? WHERE id = ?", (inv_bonus, inviter_id))
            inv_after = db.execute('SELECT credits FROM users WHERE id=?', (inviter_id,)).fetchone()['credits']
            db.execute(
                "INSERT INTO transactions (user_id,type,amount_credits,credits_after,description,created_at) "
                "VALUES (?,?,?,?,?,datetime('now','localtime'))",
                (inviter_id, 'invite_bonus', inv_bonus, inv_after, f'邀请用户 {username} 奖励'))
            from backend.notifications import create_notification
            create_notification(
                inviter_id, 'gift', '邀请奖励到账',
                f'你邀请的用户 {username} 已注册，系统赠送你 {inv_bonus/1000:.3f} 点。',
                {'points': inv_bonus / 1000, 'from': 'system'}, db=db)
            create_notification(
                new_uid, 'gift', '注册赠送到账',
                f'欢迎注册！系统赠送你 {bonus/1000:.3f} 点（含邀请奖励）。',
                {'points': bonus / 1000, 'from': 'system'}, db=db)
        else:
            from backend.notifications import create_notification
            create_notification(
                new_uid, 'gift', '注册赠送到账',
                f'欢迎注册！系统赠送你 {bonus/1000:.3f} 点，可直接用于 AI 写作。',
                {'points': bonus / 1000, 'from': 'system'}, db=db)
        db.commit()
        return jsonify({'success': True, 'message': f'注册成功！赠送 {bonus/1000:.3f} 点。', 'points': bonus / 1000})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@auth_bp.route('/login', methods=['POST'])
def auth_login():
    ip = request.remote_addr or 'unknown'
    if not _check_rate('login:' + ip, max_calls=10, window_sec=60):
        return jsonify({'success': False, 'error': '登录尝试过于频繁，请稍后再试'}), 429
    if not _check_rate('login_fail:' + ip, max_calls=20, window_sec=600):
        return jsonify({'success': False, 'error': '登录失败次数过多，请 10 分钟后再试'}), 429
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    if not username or not password:
        return jsonify({'success': False, 'error': '请输入用户名和密码'}), 400
    db = get_db()
    try:
        user = db.execute(
            'SELECT id, username, password_hash, credits, is_admin, invite_code FROM users WHERE username = ?',
            (username,)).fetchone()
        if not user or not verify_password(password, user['password_hash']):
            _check_rate('login_fail:' + ip, max_calls=1000, window_sec=600)
            return jsonify({'success': False, 'error': '用户名或密码错误'}), 401
        token = generate_token(user['id'])
        return jsonify({'success': True, 'token': token, 'user': {
            'id': user['id'], 'username': user['username'],
            'credits': user['credits'], 'is_admin': bool(user['is_admin']),
            'invite_code': user['invite_code'] or '',
            'points': round((user['credits'] or 0) / 1000.0, 3)
        }})
    finally:
        db.close()


@auth_bp.route('/me', methods=['GET'])
@require_auth
def auth_me():
    db = get_db()
    try:
        user = db.execute(
            'SELECT id, username, credits, is_admin, invite_code, free_used_date FROM users WHERE id = ?',
            (request.user_id,)).fetchone()
        if not user:
            return jsonify({'success': False, 'error': '用户不存在'}), 404
        today = today_beijing().isoformat()
        return jsonify({'success': True, 'user': {
            'id': user['id'], 'username': user['username'],
            'credits': user['credits'], 'is_admin': bool(user['is_admin']),
            'invite_code': user['invite_code'] or '',
            'free_used_today': (user['free_used_date'] == today)
        }})
    finally:
        db.close()


@auth_bp.route('/change_password', methods=['POST'])
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
