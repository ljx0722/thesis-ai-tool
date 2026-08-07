"""管理后台 Blueprint"""
import os
from flask import Blueprint, request, jsonify
from backend.database import get_db

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


def _check_admin(secret_or_request=None):
    """验证管理员身份。接受 secret 字符串或 Flask request 对象。"""
    if secret_or_request is None:
        auth = request.headers.get('Authorization', '')
        secret = auth.replace('Bearer ', '')
    elif isinstance(secret_or_request, str):
        secret = secret_or_request
    else:
        auth = secret_or_request.headers.get('Authorization', '')
        secret = auth.replace('Bearer ', '')
    admin_secret = os.environ.get('ADMIN_SECRET', '')
    if not admin_secret:
        return False
    if secret == admin_secret:
        return True
    # 也允许管理员 JWT
    from backend.utils.jwt import verify_token
    payload = verify_token(secret)
    if payload and payload.get('is_admin'):
        return True
    return False


@admin_bp.route('/dashboard', methods=['GET'])
def admin_dashboard():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    db = get_db()
    try:
        total_users = db.execute('SELECT COUNT(*) as c FROM users').fetchone()['c']
        total_orders = db.execute('SELECT COUNT(*) as c FROM recharge_orders WHERE status="confirmed"').fetchone()['c']
        total_revenue = db.execute('SELECT COALESCE(SUM(amount_yuan),0) as t FROM recharge_orders WHERE status="confirmed"').fetchone()['t']
        pending_orders = db.execute('SELECT COUNT(*) as c FROM recharge_orders WHERE status="submitted"').fetchone()['c']
        return jsonify({
            'success': True,
            'total_users': total_users,
            'total_orders': total_orders,
            'total_revenue': total_revenue,
            'pending_orders': pending_orders,
        })
    finally:
        db.close()


@admin_bp.route('/users', methods=['GET'])
def admin_users():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    db = get_db()
    try:
        users = db.execute(
            'SELECT id, username, credits, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 50'
        ).fetchall()
        return jsonify({'success': True, 'users': [dict(u) for u in users]})
    finally:
        db.close()


@admin_bp.route('/credits', methods=['POST'])
def admin_credits():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    data = request.get_json() or {}
    user_id = data.get('user_id')
    amount = int(data.get('amount', 0))
    desc = data.get('description', '管理员调整')
    if not user_id or amount == 0:
        return jsonify({'success': False, 'error': '缺少参数'}), 400
    db = get_db()
    try:
        db.execute('UPDATE users SET credits = credits + ? WHERE id = ?', (amount, user_id))
        after = db.execute('SELECT credits FROM users WHERE id = ?', (user_id,)).fetchone()
        if not after:
            return jsonify({'success': False, 'error': '用户不存在'}), 404
        db.execute(
            "INSERT INTO transactions (user_id, type, amount_credits, credits_after, description, created_at) "
            "VALUES (?,?,?,?,?,datetime('now','localtime'))",
            (user_id, 'admin', amount, after['credits'], f'管理员调整: {desc}'))
        db.commit()
        return jsonify({'success': True, 'credits_after': after['credits'],
                        'points_after': round(after['credits'] / 1000, 3)})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@admin_bp.route('/orders', methods=['GET'])
def admin_orders():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    db = get_db()
    try:
        orders = db.execute(
            'SELECT r.*, u.username FROM recharge_orders r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT 50'
        ).fetchall()
        return jsonify({'success': True, 'orders': [dict(o) for o in orders]})
    finally:
        db.close()


@admin_bp.route('/reject_order', methods=['POST'])
def admin_reject_order():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    data = request.get_json() or {}
    order_id = data.get('order_id')
    db = get_db()
    try:
        db.execute("UPDATE recharge_orders SET status='rejected' WHERE id=?", (order_id,))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@admin_bp.route('/batch_confirm', methods=['POST'])
def admin_batch_confirm():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    data = request.get_json() or {}
    order_ids = data.get('order_ids', [])
    if not order_ids:
        return jsonify({'success': False, 'error': '请选择订单'}), 400
    from backend.billing import _credits_from_fen, _yuan_from_fen
    db = get_db()
    confirmed = []
    try:
        for oid in order_ids:
            order = db.execute('SELECT * FROM recharge_orders WHERE id=?', (oid,)).fetchone()
            if not order or order['status'] == 'confirmed':
                continue
            amount_fen = order['amount_fen']
            final_yuan = amount_fen / 100.0
            db.execute(
                "UPDATE recharge_orders SET status='confirmed', confirmed_at=datetime('now','localtime') WHERE id=?",
                (oid,))
            credits = int(amount_fen) * 10
            db.execute('UPDATE users SET credits = credits + ? WHERE id=?', (credits, order['user_id']))
            after = db.execute('SELECT credits FROM users WHERE id=?', (order['user_id'],)).fetchone()['credits']
            db.execute(
                "INSERT INTO transactions (user_id,type,amount_credits,credits_after,description,created_at) "
                "VALUES (?,?,?,?,?,datetime('now','localtime'))",
                (order['user_id'], 'recharge', credits, after, f'充值 {credits/1000:.3f}点'))
            confirmed.append({'id': oid, 'credits': credits, 'points': credits / 1000})
        db.commit()
        return jsonify({'success': True, 'confirmed': confirmed})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@admin_bp.route('/pricing', methods=['GET', 'POST'])
def admin_pricing():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    db = get_db()
    if request.method == 'GET':
        try:
            rows = db.execute("SELECT key, value FROM config WHERE key LIKE '%_price' OR key IN ('register_bonus','invite_bonus','balance_refresh_seconds')").fetchall()
            return jsonify({'success': True, 'config': {r['key']: r['value'] for r in rows}})
        finally:
            db.close()
    else:
        data = request.get_json() or {}
        try:
            for key, value in data.items():
                db.execute('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', (key, str(value)))
            db.commit()
            return jsonify({'success': True})
        except Exception as e:
            db.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500
        finally:
            db.close()


@admin_bp.route('/pricing/schedules', methods=['GET', 'POST'])
def admin_pricing_schedules():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    return jsonify({'success': True, 'schedules': []})


@admin_bp.route('/timeseries', methods=['GET'])
def admin_timeseries():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    return jsonify({'success': True, 'data': []})


@admin_bp.route('/transactions', methods=['GET'])
def admin_transactions():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    db = get_db()
    try:
        txs = db.execute(
            'SELECT t.*, u.username FROM transactions t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC LIMIT 50'
        ).fetchall()
        return jsonify({'success': True, 'transactions': [dict(t) for t in txs]})
    finally:
        db.close()


@admin_bp.route('/export/orders.csv', methods=['GET'])
def admin_export_orders_csv():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    import csv, io
    db = get_db()
    try:
        orders = db.execute('SELECT r.*, u.username FROM recharge_orders r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC').fetchall()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', '用户', '金额(元)', '状态', '创建时间'])
        for o in orders:
            writer.writerow([o['id'], o['username'], o['amount_yuan'], o['status'], o['created_at']])
        return output.getvalue(), 200, {'Content-Type': 'text/csv; charset=utf-8',
                                         'Content-Disposition': 'attachment; filename=orders.csv'}
    finally:
        db.close()


@admin_bp.route('/export/transactions.csv', methods=['GET'])
def admin_export_transactions_csv():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    import csv, io
    db = get_db()
    try:
        txs = db.execute('SELECT t.*, u.username FROM transactions t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC').fetchall()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', '用户', '类型', '变动(厘)', '余额后(厘)', '说明', '时间'])
        for t in txs:
            writer.writerow([t['id'], t['username'], t['type'], t['amount_credits'], t['credits_after'], t['description'], t['created_at']])
        return output.getvalue(), 200, {'Content-Type': 'text/csv; charset=utf-8',
                                         'Content-Disposition': 'attachment; filename=transactions.csv'}
    finally:
        db.close()


@admin_bp.route('/audit', methods=['GET'])
def admin_audit():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    return jsonify({'success': True, 'logs': []})


@admin_bp.route('/llm_usage', methods=['GET'])
def admin_llm_usage():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    return jsonify({'success': True, 'usage': []})


@admin_bp.route('/llm_economics', methods=['GET'])
def admin_llm_economics():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    return jsonify({'success': True, 'data': {}})


@admin_bp.route('/ops_stats', methods=['GET'])
def admin_ops_stats():
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    return jsonify({'success': True, 'stats': {}})


@admin_bp.route('/user/<int:uid>', methods=['GET'])
def admin_user_detail(uid):
    if not _check_admin():
        return jsonify({'success': False, 'error': '无权限'}), 403
    db = get_db()
    try:
        user = db.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
        if not user:
            return jsonify({'success': False, 'error': '用户不存在'}), 404
        return jsonify({'success': True, 'user': dict(user)})
    finally:
        db.close()
