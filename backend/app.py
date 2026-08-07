"""
论文搭子 ThesisBuddy - Flask 应用工厂
模块化架构：各功能域通过 Blueprint 注册。
"""
import os
import math
import random
import json
import re
import html
import time
import threading
import sqlite3
import hashlib
import secrets
import csv
import io
import statistics
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal, InvalidOperation

from flask import Flask, request, jsonify, send_from_directory

from backend.config import (
    DB_PATH, MATERIALS_DIR, SNAPSHOTS_DIR, RESULTS_DIR,
    DATASET_RESULT_MAX_BYTES, DATASET_RECIPE_MAX_BYTES,
    DATASET_WORKER_LEASE_SECONDS, DATASET_WORKER_MAX_ATTEMPTS,
    APP_VERSION, BUILD_SHA, BUILD_TIME,
)
from backend.database import init_db

# ── Flask 工厂 ──


def create_app():
    app = Flask(__name__)
    os.environ.setdefault('TZ', 'Asia/Shanghai')

    # 初始化数据库
    init_db()
    print(f"[DB] SQLite initialized at {DB_PATH}")

    # ── 文件服务 ──
    APP_ROOT = os.path.realpath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    STATIC_ALLOWED_EXTENSIONS = {'js', 'css', 'html', 'json', 'png', 'jpg', 'jpeg', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'map'}

    @app.route('/')
    def index():
        return send_from_directory(APP_ROOT, 'index.html', mimetype='text/html; charset=utf-8')

    @app.route('/<path:filename>')
    def serve_static(filename):
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if ext not in STATIC_ALLOWED_EXTENSIONS:
            return "Not Found", 404
        normalized = filename.replace('\\', '/')
        if normalized.startswith('/') or any(part in ('', '.', '..') for part in normalized.split('/')):
            return "Not Found", 404
        target = os.path.realpath(os.path.join(APP_ROOT, *normalized.split('/')))
        try:
            if os.path.commonpath([APP_ROOT, target]) != APP_ROOT or not os.path.isfile(target) or os.path.islink(target):
                return "Not Found", 404
        except ValueError:
            return "Not Found", 404
        return send_from_directory(APP_ROOT, normalized)

    # ── 健康检查 ──
    @app.route('/health/live', methods=['GET'])
    def health_live():
        from backend.utils.time_utils import now_beijing_str
        return jsonify({'ok': True, 'service': 'ThesisBuddy', 'version': APP_VERSION, 'sha': BUILD_SHA,
                        'server_time': now_beijing_str(), 'timezone': 'Asia/Shanghai'})

    @app.route('/health/ready', methods=['GET'])
    def health_ready():
        checks = {'database': False, 'materials_writable': False, 'snapshots_writable': False, 'results_writable': False}
        try:
            from backend.database import get_db
            db = get_db()
            db.execute('SELECT 1').fetchone()
            checks['database'] = True
            db.close()
            checks['materials_writable'] = os.access(MATERIALS_DIR, os.W_OK)
            checks['snapshots_writable'] = os.access(SNAPSHOTS_DIR, os.W_OK)
            checks['results_writable'] = os.access(RESULTS_DIR, os.W_OK)
        except Exception as e:
            return jsonify({'ok': False, 'checks': checks, 'error': str(e), 'version': APP_VERSION, 'sha': BUILD_SHA}), 503
        ok = all(checks.values())
        return jsonify({'ok': ok, 'checks': checks, 'version': APP_VERSION, 'sha': BUILD_SHA}), (200 if ok else 503)

    @app.route('/api/time', methods=['GET'])
    def api_time():
        from backend.utils.time_utils import now_beijing
        now = now_beijing()
        return jsonify({
            'success': True, 'timezone': 'Asia/Shanghai',
            'server_time': now.strftime('%Y-%m-%d %H:%M:%S'),
            'iso': now.isoformat(), 'unix_ms': int(now.timestamp() * 1000),
            'offset_minutes': 480,
        })

    @app.route('/api/version', methods=['GET'])
    def api_version():
        return jsonify({'success': True, 'brand': '论文搭子', 'product': 'ThesisBuddy',
                        'version': APP_VERSION, 'commit': BUILD_SHA, 'build_time': BUILD_TIME,
                        'api_version': 1, 'server_time': datetime.now().isoformat(), 'timezone': 'Asia/Shanghai'})

    @app.route('/ping', methods=['GET'])
    def ping():
        return jsonify({'ok': True, 'service': 'ThesisBuddy', 'version': APP_VERSION, 'sha': BUILD_SHA,
                        'sources': ['OpenAlex', 'OpenAlex-CN', 'Crossref', 'Semantic Scholar', 'arXiv',
                                    'PubMed', 'CORE', 'DOAJ', 'EuropePMC', 'CNKI', '百度学术']})

    # ── 运行时状态 ──
    @app.route('/api/runtime/status', methods=['GET'])
    def runtime_status():
        from backend.database import get_db
        db = get_db()
        try:
            row = db.execute('SELECT * FROM service_runtime_state WHERE id=1').fetchone()
            data = dict(row) if row else {'mode': 'normal', 'message': ''}
            return jsonify({
                'success': True, 'mode': data.get('mode') or 'normal', 'message': data.get('message') or '',
                'startsAt': data.get('starts_at'), 'deadlineAt': data.get('deadline_at'),
                'targetVersion': data.get('target_version'), 'targetCommit': data.get('target_commit'),
                'serverTime': datetime.utcnow().isoformat(timespec='seconds') + 'Z',
                'version': APP_VERSION, 'commit': BUILD_SHA,
                'writePolicy': {'projectSave': True, 'newAiJobs': (data.get('mode') or 'normal') == 'normal',
                                'uploads': (data.get('mode') or 'normal') == 'normal'}
            })
        finally:
            db.close()

    # ── 注册 Blueprints ──
    from backend.auth import auth_bp
    app.register_blueprint(auth_bp)

    from backend.billing import billing_bp
    app.register_blueprint(billing_bp)

    from backend.notifications import notifications_bp
    app.register_blueprint(notifications_bp)

    # 搜索、项目、文献、知识图谱等 Blueprint（渐进式提取）
    _register_remaining_blueprints(app)

    # 兜底兼容：保留 kg_server.py 中尚未提取的路由
    _register_legacy_fallback(app)

    # 载入旧版本兼容路由（逐步迁移中）
    _register_transitional_routes(app)

    return app


def _register_remaining_blueprints(app):
    """注册剩余的模块化 Blueprint。"""
    try:
        from backend.search import search_bp
        app.register_blueprint(search_bp)
    except ImportError:
        pass

    try:
        from backend.projects import projects_bp
        app.register_blueprint(projects_bp)
    except ImportError:
        pass

    try:
        from backend.literature import literature_bp
        app.register_blueprint(literature_bp)
    except ImportError:
        pass

    try:
        from backend.documents import documents_bp
        app.register_blueprint(documents_bp)
    except ImportError:
        pass

    try:
        from backend.ai import ai_bp
        app.register_blueprint(ai_bp)
    except ImportError:
        pass

    try:
        from backend.knowledge_graph import kg_bp
        app.register_blueprint(kg_bp)
    except ImportError:
        pass

    try:
        from backend.admin import admin_bp
        app.register_blueprint(admin_bp)
    except ImportError:
        pass


def _register_transitional_routes(app):
    """注册过渡期路由——从 kg_server.py 逐步提取中。"""
    from backend.database import get_db
    from backend.auth import require_auth
    from backend.utils.time_utils import now_beijing_str, today_beijing
    from backend.billing import get_price, deduct_credits

    # ── 邀请码 ──
    @app.route('/api/invite/generate', methods=['POST'])
    @require_auth
    def invite_generate():
        import uuid
        db = get_db()
        try:
            existing = db.execute('SELECT invite_code FROM users WHERE id=?', (request.user_id,)).fetchone()
            if existing and existing['invite_code']:
                return jsonify({'success': True, 'code': existing['invite_code']})
            code = uuid.uuid4().hex[:8].upper()
            db.execute("INSERT INTO invite_codes (code, owner_id, created_at) VALUES (?,?,datetime('now','localtime'))",
                       (code, request.user_id))
            db.execute("UPDATE users SET invite_code=? WHERE id=?", (code, request.user_id))
            db.commit()
            return jsonify({'success': True, 'code': code})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
        finally:
            db.close()

    @app.route('/api/invite/my_code', methods=['GET'])
    @require_auth
    def invite_my_code():
        db = get_db()
        try:
            user = db.execute('SELECT invite_code FROM users WHERE id=?', (request.user_id,)).fetchone()
            return jsonify({'success': True, 'code': (user['invite_code'] if user else '') or ''})
        finally:
            db.close()

    @app.route('/api/invite/stats', methods=['GET'])
    @require_auth
    def invite_stats():
        db = get_db()
        try:
            count = db.execute('SELECT COUNT(*) as c FROM invite_codes WHERE owner_id=? AND used_by IS NOT NULL',
                               (request.user_id,)).fetchone()['c']
            return jsonify({'success': True, 'invited_count': count})
        finally:
            db.close()

    @app.route('/api/invite/apply', methods=['POST'])
    @require_auth
    def invite_apply():
        return jsonify({'success': False, 'error': '邀请码需在注册时填写'}), 400

    # ── 管理员运行时状态 ──
    @app.route('/api/admin/runtime/status', methods=['PUT'])
    def admin_runtime_status():
        from backend.admin import _check_admin
        data = request.get_json(silent=True) or {}
        secret = data.get('secret', '')
        if not _check_admin(secret):
            return jsonify({'success': False, 'error': '无权限'}), 403
        mode = (data.get('mode') or '').strip()
        if mode not in ('normal', 'announced', 'draining', 'maintenance'):
            return jsonify({'success': False, 'error': '无效维护状态'}), 400
        db = get_db()
        try:
            db.execute(
                "INSERT INTO service_runtime_state(id,mode,message,starts_at,deadline_at,target_version,target_commit,updated_by,updated_at) "
                "VALUES(1,?,?,?,?,?,?,?,datetime('now','localtime')) ON CONFLICT(id) DO UPDATE SET "
                "mode=excluded.mode,message=excluded.message,starts_at=excluded.starts_at,deadline_at=excluded.deadline_at,"
                "target_version=excluded.target_version,target_commit=excluded.target_commit,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
                (mode, (data.get('message') or '')[:300], data.get('startsAt'), data.get('deadlineAt'),
                 data.get('targetVersion'), data.get('targetCommit'), 'admin'))
            db.commit()
            return jsonify({'success': True, 'mode': mode})
        except Exception as e:
            db.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500
        finally:
            db.close()


def _register_legacy_fallback(app):
    """
    保留从 kg_server.py 导入的兼容模块。
    当全部 Blueprint 提取完成后可移除此函数。
    """
    # 此时 kg_server 的 app 对象仍可作为单例被导入。
    # 但由于我们在 create_app() 中创建新 app，需要通过此函数
    # 来桥接尚未迁移的路由。随着迁移推进，此函数逐步清空。
    pass
