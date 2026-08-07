"""通知模块 Blueprint"""
import json
from flask import Blueprint, request, jsonify

from backend.database import get_db
from backend.auth import require_auth

notifications_bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')


def create_notification(user_id, type, title, body, meta=None, db=None):
    """创建通知。可传入外部 db 连接以在事务中调用。"""
    close_after = db is None
    if db is None:
        db = get_db()
    try:
        db.execute(
            "INSERT INTO notifications (user_id, type, title, body, meta_json, created_at) "
            "VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))",
            (user_id, type, title, body, json.dumps(meta or {}, ensure_ascii=False)))
        if close_after:
            db.commit()
    except Exception:
        if close_after:
            db.rollback()
        raise
    finally:
        if close_after:
            db.close()


@notifications_bp.route('', methods=['GET'])
@require_auth
def list_notifications():
    limit = request.args.get('limit', 40, type=int)
    db = get_db()
    try:
        rows = db.execute(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (request.user_id, limit)).fetchall()
        unread = db.execute(
            "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0",
            (request.user_id,)).fetchone()['c']
        return jsonify({
            'success': True,
            'unread': unread,
            'notifications': [dict(r) for r in rows]
        })
    finally:
        db.close()


@notifications_bp.route('/read', methods=['POST'])
@require_auth
def mark_read():
    data = request.get_json() or {}
    db = get_db()
    try:
        if data.get('all'):
            db.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (request.user_id,))
        else:
            ids = data.get('ids', [])
            if ids:
                placeholders = ','.join('?' for _ in ids)
                db.execute(
                    f"UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN ({placeholders})",
                    (request.user_id, *ids))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()
