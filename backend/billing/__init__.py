"""
计费支付 Blueprint
充值、支付确认、余额查询、消费记录、定价引擎
"""
import json
import os
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request, jsonify

from backend.database import get_db
from backend.auth import require_auth
from backend.utils.time_utils import now_beijing, now_beijing_str, today_beijing

billing_bp = Blueprint('billing', __name__, url_prefix='/api')

# ── 定价常量 ──
CREDIT_PER_YUAN = 1000  # 1元 = 1000厘 = 1.0显示点
LLM_MIN_CHARGE = int(os.environ.get('LLM_MIN_CHARGE', '20'))
DAILY_FREE_OPS = int(os.environ.get('DAILY_FREE_OPS', '0'))
USER_MARKUP = float(os.environ.get('USER_MARKUP', '3.0'))
DEEPSEEK_INPUT_PRICE_PER_1M = float(os.environ.get('DEEPSEEK_INPUT_PRICE', '0.1'))
DEEPSEEK_OUTPUT_PRICE_PER_1M = float(os.environ.get('DEEPSEEK_OUTPUT_PRICE', '0.1'))
DEEPSEEK_MODEL = os.environ.get('DEEPSEEK_MODEL', 'deepseek-chat')

RECHARGE_PAYMENT_METHODS = {'alipay', 'wechat'}
RECHARGE_MIN_FEN = 100
RECHARGE_MAX_FEN = 500000

PRICING_DEFAULTS = {
    'module': 100, 'upload': 0, 'search': 500, 'kg': 50,
    'domain_analysis': 0, 'format-check': 50, 'terminology': 50,
    'paragraph': 50, 'dashboard': 100, 'data-analysis': 150,
    'data-ml': 500, 'export-docx': 200,
    'topic-finder': 0, 'proposal': 0, 'review': 0,
    'optimization': 50, 'expand': 0, 'proofread': 0,
    'de-duplicate': 0, 'defense-ppt': 0, 'en-abstract': 0,
    'llm_analysis': 0, 'joint-analysis': 300, 'figure-advisor-batch': 400,
    'data-profile': 0, 'dataset-compatibility': 0, 'dataset-preview': 0,
    'dataset-management': 0, 'figure-recommend': 0, 'figure-render-code': 0, 'figure-qa': 0,
}

PRICING_MODULE_META = {
    'module': {'name': '通用本地模块', 'desc': '未单独定价时的兜底固定价'},
    'upload': {'name': '上传解析', 'desc': 'DOCX 上传与本地解析（通常免费）'},
    'search': {'name': '文献检索', 'desc': '多源学术检索，按次扣点'},
    'kg': {'name': '知识图谱', 'desc': '生成论文知识图谱'},
    'format-check': {'name': '格式检查', 'desc': '论文格式规范检查（本地）'},
    'terminology': {'name': '术语分析', 'desc': '术语一致性分析（本地）'},
    'paragraph': {'name': '段落分析', 'desc': '段落结构分析（本地）'},
    'dashboard': {'name': '论文看板', 'desc': '十维评分看板（本地）'},
    'data-analysis': {'name': '数据分析（统计）', 'desc': '本地统计分析'},
    'data-ml': {'name': '数据分析（机器学习）', 'desc': '特征/模型训练'},
    'export-docx': {'name': '导出 DOCX', 'desc': '导出论文草稿为 Word'},
    'topic-finder': {'name': '选题推荐', 'desc': 'AI 选题（按 token 实扣）'},
    'proposal': {'name': '开题大纲', 'desc': 'AI 开题（按 token 实扣）'},
    'review': {'name': '论文审阅', 'desc': 'AI 审阅（按 token 实扣）'},
    'optimization': {'name': '优化建议', 'desc': '本地优化建议'},
    'expand': {'name': '论文扩写', 'desc': 'AI 扩写（按 token 实扣）'},
    'proofread': {'name': '论文查错', 'desc': 'AI 查错（按 token 实扣）'},
    'de-duplicate': {'name': '查重降重', 'desc': 'AI 降重（按 token 实扣）'},
    'defense-ppt': {'name': '答辩 PPT', 'desc': 'AI 答辩大纲（按 token 实扣）'},
    'en-abstract': {'name': '英文摘要', 'desc': 'AI 英文摘要（按 token 实扣）'},
    'llm_analysis': {'name': '通用 LLM 分析', 'desc': '通用 AI 分析（按 token 实扣）'},
    'joint-analysis': {'name': '联合数据分析', 'desc': '数据集分析配方'},
    'figure-advisor-batch': {'name': '批量科研图表顾问', 'desc': '图表方案批量生成'},
    'data-profile': {'name': '数据剖析', 'desc': '表格资料确定性剖析'},
    'dataset-compatibility': {'name': '数据集兼容性', 'desc': '连接与合并兼容性检查'},
    'figure-recommend': {'name': '图表推荐', 'desc': '基于列角色推荐科研图表'},
    'figure-render-code': {'name': '图表代码', 'desc': '生成不执行的绘图代码'},
    'figure-qa': {'name': '图表质检', 'desc': '图表规范静态质检'},
}

# ── 余额 / 扣点 / 定价核心函数 ──


def get_price(key):
    """获取能力价格（单位：厘 = 1/1000点）。"""
    config_key = key if key.endswith('_price') else (key + '_price')
    db = get_db()
    try:
        value = db.execute('SELECT value FROM config WHERE key=?', (config_key,)).fetchone()
        if value:
            return int(value['value'])
        bare = db.execute('SELECT value FROM config WHERE key=?', (key,)).fetchone()
        if bare:
            return int(bare['value'])
        return int(PRICING_DEFAULTS.get(key, PRICING_DEFAULTS.get('module', 50)))
    except Exception:
        return int(PRICING_DEFAULTS.get(key, 50))
    finally:
        db.close()


def deduct_credits(user_id, amount, desc):
    """原子扣点：UPDATE WHERE credits>=amount 防并发超卖。amount 单位=厘。"""
    amount = int(amount or 0)
    if amount < 0:
        return False, '扣点金额无效', None
    if amount == 0:
        db = get_db()
        try:
            u = db.execute('SELECT credits FROM users WHERE id = ?', (user_id,)).fetchone()
            if not u:
                return False, '用户不存在', None
            return True, None, u['credits']
        finally:
            db.close()
    db = get_db()
    try:
        cur = db.execute(
            'UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?',
            (amount, user_id, amount))
        if cur.rowcount != 1:
            u = db.execute('SELECT credits FROM users WHERE id = ?', (user_id,)).fetchone()
            if not u:
                return False, '用户不存在', None
            return False, f'点数不足。需要 {amount/1000:.3f} 点，当前 {u["credits"]/1000:.3f} 点', u['credits']
        after = db.execute('SELECT credits FROM users WHERE id = ?', (user_id,)).fetchone()['credits']
        db.execute(
            "INSERT INTO transactions (user_id, type, amount_credits, credits_after, description, created_at) "
            "VALUES (?,?,?,?,?,datetime('now','localtime'))",
            (user_id, 'usage', -amount, after, desc))
        db.commit()
        return True, None, after
    except Exception as e:
        db.rollback()
        return False, str(e), None
    finally:
        db.close()


def refund_credits(user_id, amount, desc):
    """失败退款（加回余额）。"""
    amount = int(amount or 0)
    if amount <= 0:
        return False, '退款金额无效', None
    db = get_db()
    try:
        cur = db.execute('UPDATE users SET credits = credits + ? WHERE id = ?', (amount, user_id))
        if cur.rowcount != 1:
            return False, '用户不存在', None
        after = db.execute('SELECT credits FROM users WHERE id = ?', (user_id,)).fetchone()['credits']
        db.execute(
            "INSERT INTO transactions (user_id, type, amount_credits, credits_after, description, created_at) "
            "VALUES (?,?,?,?,?,datetime('now','localtime'))",
            (user_id, 'refund', amount, after, desc))
        db.commit()
        return True, None, after
    except Exception as e:
        db.rollback()
        return False, str(e), None
    finally:
        db.close()


def _parse_yuan_to_fen(value):
    """将元转换为分。"""
    if value is None or isinstance(value, bool):
        raise ValueError('请输入有效金额')
    text = str(value).strip()
    if not text:
        raise ValueError('请输入有效金额')
    try:
        amount = Decimal(text)
    except (InvalidOperation, ValueError):
        raise ValueError('请输入有效金额')
    if not amount.is_finite():
        raise ValueError('请输入有效金额')
    fen_decimal = amount * 100
    if fen_decimal != fen_decimal.to_integral_value():
        raise ValueError('金额最多保留 2 位小数')
    amount_fen = int(fen_decimal)
    if amount_fen < RECHARGE_MIN_FEN:
        raise ValueError('最低充值 1 元')
    if amount_fen > RECHARGE_MAX_FEN:
        raise ValueError('单笔最高 5000 元')
    return amount_fen


def _yuan_from_fen(amount_fen):
    return int(amount_fen or 0) / 100.0


def _credits_from_fen(amount_fen):
    return int(amount_fen or 0) * CREDIT_PER_YUAN // 100


# ── 支付 API ──


@billing_bp.route('/payment/recharge', methods=['POST'])
@require_auth
def payment_recharge():
    """创建充值订单。"""
    data = request.get_json() or {}
    try:
        amount_fen = _parse_yuan_to_fen(data.get('amount_yuan'))
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    payment_method = (data.get('payment_method') or 'alipay').strip().lower()
    if payment_method not in RECHARGE_PAYMENT_METHODS:
        return jsonify({'success': False, 'error': '不支持的支付方式'}), 400
    db = get_db()
    try:
        user = db.execute('SELECT id, credits FROM users WHERE id = ?', (request.user_id,)).fetchone()
        if not user:
            return jsonify({'success': False, 'error': '用户不存在'}), 404
        MAX_OPEN = int(os.environ.get('MAX_OPEN_RECHARGE_ORDERS', '3'))
        open_orders = db.execute(
            "SELECT COUNT(*) as c FROM recharge_orders WHERE user_id = ? AND status IN ('pending','submitted')",
            (request.user_id,)).fetchone()['c']
        if open_orders >= MAX_OPEN:
            return jsonify({'success': False, 'error': f'你还有 {open_orders} 单待处理，请等待管理员确认后再创建新订单'}), 400
        cur = db.execute(
            "INSERT INTO recharge_orders (user_id, amount_yuan, amount_fen, status, payment_method, created_at) "
            "VALUES (?,?,?,?,?,datetime('now','localtime'))",
            (request.user_id, _yuan_from_fen(amount_fen), amount_fen, 'pending', payment_method))
        order_id = cur.lastrowid
        from backend.notifications import create_notification
        create_notification(
            request.user_id, 'recharge', '充值订单已创建',
            f'订单 #{order_id}（¥{_yuan_from_fen(amount_fen):.2f}）已创建，请完成转账并提交审核。',
            {'order_id': order_id}, db=db)
        db.commit()
        return jsonify({'success': True, 'order_id': order_id, 'amount_yuan': _yuan_from_fen(amount_fen),
                        'amount_fen': amount_fen, 'status': 'pending',
                        'message': '订单已创建，请按订单金额转账并备注订单号'})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@billing_bp.route('/payment/submit', methods=['POST'])
@require_auth
def payment_submit():
    """用户提交支付审核。"""
    data = request.get_json() or {}
    order_id = data.get('order_id')
    db = get_db()
    try:
        order = db.execute('SELECT * FROM recharge_orders WHERE id=? AND user_id=?',
                           (order_id, request.user_id)).fetchone()
        if not order:
            return jsonify({'success': False, 'error': '订单不存在'}), 404
        if order['status'] != 'pending':
            return jsonify({'success': False, 'error': '订单状态不允许提交'}), 400
        db.execute("UPDATE recharge_orders SET status='submitted' WHERE id=?", (order_id,))
        from backend.notifications import create_notification
        create_notification(
            request.user_id, 'recharge', '充值申请已提交',
            f'订单 #{order_id}（¥{order["amount_yuan"]}）已提交审核，管理员确认后到账。',
            {'order_id': order_id}, db=db)
        db.commit()
        return jsonify({'success': True, 'message': '已提交审核，等待管理员确认到账', 'status': 'submitted', 'order_id': order_id})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@billing_bp.route('/payment/orders', methods=['GET'])
@require_auth
def payment_orders():
    db = get_db()
    try:
        orders = db.execute(
            'SELECT * FROM recharge_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
            (request.user_id,)).fetchall()
        return jsonify({'success': True, 'orders': [dict(o) for o in orders]})
    finally:
        db.close()


def _order_amount_fen(order):
    amount_fen = order.get('amount_fen') if isinstance(order, dict) else (order['amount_fen'] if 'amount_fen' in order.keys() else None)
    if amount_fen is not None:
        return int(amount_fen)
    amount_yuan = order.get('amount_yuan') if isinstance(order, dict) else order['amount_yuan']
    return int((Decimal(str(amount_yuan)) * 100).to_integral_value())


@billing_bp.route('/payment/confirm', methods=['POST'])
def payment_confirm():
    """管理员确认到账。"""
    data = request.get_json() or {}
    secret = data.get('secret') or request.headers.get('Authorization', '').replace('Bearer ', '')
    admin_secret = os.environ.get('ADMIN_SECRET', '')
    if not admin_secret or secret != admin_secret:
        return jsonify({'success': False, 'error': '无权限'}), 403
    order_id = data.get('order_id')
    final_amount_fen = data.get('amount_fen')
    db = get_db()
    try:
        order = db.execute('SELECT * FROM recharge_orders WHERE id = ?', (order_id,)).fetchone()
        if not order:
            return jsonify({'success': False, 'error': '订单不存在'}), 404
        if final_amount_fen is not None:
            final_amount_fen = int(final_amount_fen)
        else:
            final_amount_fen = _order_amount_fen(order)
        if order['status'] in ('confirmed',):
            return jsonify({'success': False, 'error': '已处理'}), 400
        final_yuan = _yuan_from_fen(final_amount_fen)
        db.execute(
            "UPDATE recharge_orders SET status='confirmed', confirmed_at=datetime('now','localtime'), "
            "amount_yuan=?, amount_fen=? WHERE id=?",
            (final_yuan, final_amount_fen, order_id))
        credits = _credits_from_fen(final_amount_fen)
        db.execute('UPDATE users SET credits = credits + ? WHERE id=?', (credits, order['user_id']))
        after = db.execute('SELECT credits FROM users WHERE id=?', (order['user_id'],)).fetchone()['credits']
        desc = f'充值 {credits/1000:.3f}点'
        db.execute(
            "INSERT INTO transactions (user_id,type,amount_credits,credits_after,description,created_at) "
            "VALUES (?,?,?,?,?,datetime('now','localtime'))",
            (order['user_id'], 'recharge', credits, after, desc))
        from backend.notifications import create_notification
        create_notification(
            order['user_id'], 'recharge', '充值到账',
            f'你的充值订单 #{order_id} 已确认，到账 {credits/1000:.3f} 点。当前余额 {after/1000:.3f} 点。',
            {'order_id': order_id, 'points': credits / 1000, 'points_after': after / 1000}, db=db)
        db.commit()
        return jsonify({'success': True, 'message': '已确认到账', 'credits': after, 'points': credits / 1000})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@billing_bp.route('/payment/resubmit', methods=['POST'])
@require_auth
def payment_resubmit():
    data = request.get_json() or {}
    order_id = data.get('order_id')
    db = get_db()
    try:
        order = db.execute('SELECT * FROM recharge_orders WHERE id=? AND user_id=?',
                           (order_id, request.user_id)).fetchone()
        if not order:
            return jsonify({'success': False, 'error': '订单不存在'}), 404
        if order['status'] not in ('rejected', 'pending'):
            return jsonify({'success': False, 'error': '仅待支付或已拒绝订单可重新提交'}), 400
        db.execute("UPDATE recharge_orders SET status='submitted' WHERE id=?", (order_id,))
        from backend.notifications import create_notification
        create_notification(
            request.user_id, 'recharge', '充值申请已重新提交',
            f'订单 #{order_id}（¥{order["amount_yuan"]}）已重新提交审核。', {'order_id': order_id}, db=db)
        db.commit()
        return jsonify({'success': True, 'message': '已重新提交审核', 'status': 'submitted', 'order_id': order_id})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@billing_bp.route('/payment/webhook', methods=['POST'])
def payment_webhook():
    data = request.get_json() or {}
    order_id = data.get('order_id')
    status = data.get('status')
    db = get_db()
    try:
        if status == 'paid' and order_id:
            db.execute("UPDATE recharge_orders SET status='submitted' WHERE id=? AND status='pending'", (order_id,))
            db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@billing_bp.route('/payment/balance', methods=['GET'])
@require_auth
def payment_balance():
    db = get_db()
    try:
        u = db.execute('SELECT credits, free_used_date FROM users WHERE id = ?', (request.user_id,)).fetchone()
        today = today_beijing().isoformat()
        free_row = db.execute('SELECT used FROM daily_free_usage WHERE user_id = ? AND usage_date = ?',
                              (request.user_id, today)).fetchone()
        used = free_row['used'] if free_row else 0
        free_limit = DAILY_FREE_OPS
        refresh_row = db.execute("SELECT value FROM config WHERE key='balance_refresh_seconds'").fetchone()
        try:
            refresh_seconds = int(refresh_row['value']) if refresh_row else 5
        except (TypeError, ValueError):
            refresh_seconds = 5
        refresh_seconds = max(2, min(60, refresh_seconds))
        return jsonify({
            'success': True,
            'credits': u['credits'],
            'points': round((u['credits'] or 0) / 1000, 3),
            'free_used_today': used,
            'free_limit_today': free_limit,
            'free_remaining_today': max(0, free_limit - used),
            'free_available': used < free_limit,
            'refresh_interval_seconds': refresh_seconds
        })
    finally:
        db.close()


@billing_bp.route('/usage/check_free', methods=['GET'])
@require_auth
def usage_check_free():
    db = get_db()
    try:
        today = today_beijing().isoformat()
        row = db.execute('SELECT used FROM daily_free_usage WHERE user_id = ? AND usage_date = ?',
                         (request.user_id, today)).fetchone()
        used = int(row['used']) if row else 0
        free_limit = DAILY_FREE_OPS
        remaining = max(0, free_limit - used)
        return jsonify({
            'success': True, 'free_available': remaining > 0,
            'free_used_today': used, 'free_limit_today': free_limit,
            'free_remaining_today': remaining
        })
    finally:
        db.close()


@billing_bp.route('/usage/mark_free', methods=['POST'])
@require_auth
def usage_mark_free():
    db = get_db()
    try:
        today = today_beijing().isoformat()
        free_limit = DAILY_FREE_OPS
        db.execute('BEGIN IMMEDIATE')
        db.execute('INSERT OR IGNORE INTO daily_free_usage (user_id, usage_date, used) VALUES (?, ?, 0)',
                   (request.user_id, today))
        cur = db.execute(
            'UPDATE daily_free_usage SET used = used + 1 WHERE user_id = ? AND usage_date = ? AND used < ?',
            (request.user_id, today, free_limit))
        row = db.execute('SELECT used FROM daily_free_usage WHERE user_id=? AND usage_date=?',
                         (request.user_id, today)).fetchone()
        used = int(row['used']) if row else 0
        if cur.rowcount != 1:
            db.rollback()
            return jsonify({'success': False, 'error': '今日免费次数已用完',
                            'free_used_today': used, 'free_limit_today': free_limit,
                            'free_remaining_today': 0}), 400
        db.execute("UPDATE users SET free_used_date = ? WHERE id = ?", (today, request.user_id))
        db.commit()
        return jsonify({'success': True, 'free_used_today': used, 'free_limit_today': free_limit,
                        'free_remaining_today': max(0, free_limit - used)})
    finally:
        db.close()


@billing_bp.route('/usage/module', methods=['POST'])
@require_auth
def usage_module():
    """本地/固定价模块扣点。"""
    data = request.get_json(silent=True) or {}
    module = (data.get('module') or 'module').strip() or 'module'
    db = get_db()
    try:
        today = today_beijing().isoformat()
        free_limit = DAILY_FREE_OPS
        db.execute('BEGIN IMMEDIATE')
        db.execute('INSERT OR IGNORE INTO daily_free_usage (user_id, usage_date, used) VALUES (?, ?, 0)',
                   (request.user_id, today))
        cur = db.execute(
            'UPDATE daily_free_usage SET used = used + 1 WHERE user_id = ? AND usage_date = ? AND used < ?',
            (request.user_id, today, free_limit))
        if cur.rowcount == 1:
            db.execute("UPDATE users SET free_used_date = ? WHERE id = ?", (today, request.user_id))
            new_count = db.execute(
                'SELECT used FROM daily_free_usage WHERE user_id = ? AND usage_date = ?',
                (request.user_id, today)).fetchone()['used']
            db.commit()
            return jsonify({'success': True, 'free': True, 'module': module,
                            'message': f'今日免费({new_count}/{free_limit})', 'cost': 0, 'cost_points': 0})
        db.rollback()
    finally:
        db.close()
    price = get_price(module)
    if price <= 0:
        return jsonify({'success': True, 'free': False, 'module': module, 'cost': 0, 'cost_points': 0})
    ok, err, after = deduct_credits(request.user_id, price, f'模块使用:{module}')
    if not ok:
        return jsonify({'success': False, 'error': err, 'needed': price, 'needed_points': price / 1000}), 402
    return jsonify({'success': True, 'free': False, 'module': module, 'cost': price,
                    'cost_points': round(price / 1000, 3), 'credits_after': after,
                    'points_after': round((after or 0) / 1000, 3)})


@billing_bp.route('/usage/history', methods=['GET'])
@require_auth
def usage_history():
    db = get_db()
    try:
        limit = request.args.get('limit', 100, type=int)
        txs = db.execute(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            (request.user_id, limit)).fetchall()
        llm_rows = db.execute(
            'SELECT * FROM llm_usage WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            (request.user_id, limit)).fetchall()
        return jsonify({
            'success': True,
            'transactions': [dict(t) for t in txs],
            'llm_usage': [dict(l) for l in llm_rows]
        })
    finally:
        db.close()


@billing_bp.route('/pricing', methods=['GET'])
def api_pricing():
    """获取公开定价信息。"""
    items = []
    for key, price in sorted(PRICING_DEFAULTS.items()):
        meta = PRICING_MODULE_META.get(key, {})
        items.append({
            'key': key,
            'name': meta.get('name', key),
            'price': price,
            'points': round(price / 1000, 3),
        })
    return jsonify({'success': True, 'items': items})


@billing_bp.route('/account/overview', methods=['GET'])
@require_auth
def account_overview():
    db = get_db()
    try:
        user = db.execute('SELECT * FROM users WHERE id = ?', (request.user_id,)).fetchone()
        if not user:
            return jsonify({'success': False, 'error': '用户不存在'}), 404
        today = today_beijing().isoformat()
        free_row = db.execute('SELECT used FROM daily_free_usage WHERE user_id = ? AND usage_date = ?',
                              (request.user_id, today)).fetchone()
        free_used = free_row['used'] if free_row else 0
        spent = db.execute(
            "SELECT COALESCE(SUM(ABS(amount_credits)),0) as total FROM transactions WHERE user_id=? AND type='usage'",
            (request.user_id,)).fetchone()['total']
        recharged = db.execute(
            "SELECT COALESCE(SUM(amount_yuan),0) as total FROM recharge_orders WHERE user_id=? AND status='confirmed'",
            (request.user_id,)).fetchone()['total']
        unread = db.execute(
            "SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0",
            (request.user_id,)).fetchone()['c']
        invite_used = db.execute(
            "SELECT COUNT(*) as c FROM invite_codes WHERE owner_id=? AND used_by IS NOT NULL",
            (request.user_id,)).fetchone()['c']
        orders = db.execute(
            'SELECT * FROM recharge_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            (request.user_id,)).fetchall()
        txs = db.execute(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
            (request.user_id,)).fetchall()
        notifs = db.execute(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            (request.user_id,)).fetchall()
        return jsonify({
            'success': True,
            'user': dict(user),
            'free': {'remaining': max(0, DAILY_FREE_OPS - free_used), 'limit': DAILY_FREE_OPS, 'used': free_used},
            'stats': {
                'spent_points': round(spent / 1000, 3),
                'recharged_yuan': recharged,
                'unread_notifications': unread,
                'invite_used': invite_used,
            },
            'transactions': [dict(t) for t in txs],
            'orders': [dict(o) for o in orders],
            'notifications': [dict(n) for n in notifs],
        })
    finally:
        db.close()
