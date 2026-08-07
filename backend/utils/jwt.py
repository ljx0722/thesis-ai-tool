"""
JWT 工具：生成、验证、解析。
"""
import os
import secrets
import jwt as pyjwt
from backend.config import JWT_SECRET_PATH

HAS_JWT = True


def _load_or_create_secret():
    """加载或创建 JWT 密钥。"""
    if os.path.exists(JWT_SECRET_PATH):
        with open(JWT_SECRET_PATH, 'r') as f:
            return f.read().strip()
    secret = secrets.token_hex(32)
    os.makedirs(os.path.dirname(JWT_SECRET_PATH), exist_ok=True)
    with open(JWT_SECRET_PATH, 'w') as f:
        f.write(secret)
    return secret


JWT_SECRET = _load_or_create_secret()
JWT_ALGORITHM = 'HS256'


def create_token(user_id, username, is_admin=False):
    """为用户生成 JWT token。"""
    return pyjwt.encode({
        'user_id': user_id,
        'username': username,
        'is_admin': is_admin
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token):
    """验证并解析 token，返回 payload 或 None。"""
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None
