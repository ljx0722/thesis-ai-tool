"""
论文搭子 ThesisBuddy - 定价体系迁移工具
从"厘"单位 (1元=1000厘) 迁移到"点"单位 (1点=1元)
"""

import sqlite3
import os
import sys


def get_db_path():
    return os.environ.get('DB_PATH', os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'data', 'thesis.db'))


def upgrade_from_li_to_points(db_path=None):
    """
    执行定价体系迁移。
    1. 添加 points 列到 users 表
    2. 将 credits (厘) 转换为 points (点)
    3. 更新 config 表中的价格（从厘→点）
    4. 添加必要的列到 transactions
    """
    db_path = db_path or get_db_path()
    db_path = os.path.abspath(db_path)

    if not os.path.exists(db_path):
        print(f"[migrate] 数据库不存在: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    try:
        print("[migrate] 开始定价体系迁移: 厘(li) → 点(point)")

        # Step 1: 检查当前状态
        cols = [r[1] for r in conn.execute('PRAGMA table_info(users)').fetchall()]

        if 'points' in cols:
            print("[migrate] users.points 已存在，跳过列添加")
        else:
            conn.execute('ALTER TABLE users ADD COLUMN points REAL NOT NULL DEFAULT 0')
            # 迁移: points = credits / 1000
            conn.execute('UPDATE users SET points = ROUND(CAST(credits AS REAL) / 1000.0, 3)')
            print("[migrate] users.points 列已添加并填充")

        # Step 2: transactions 添加 points 列
        tx_cols = [r[1] for r in conn.execute('PRAGMA table_info(transactions)').fetchall()]
        if 'points' in tx_cols:
            print("[migrate] transactions.points 已存在，跳过")
        else:
            conn.execute('ALTER TABLE transactions ADD COLUMN points REAL')
            conn.execute('ALTER TABLE transactions ADD COLUMN points_after REAL')
            conn.execute('UPDATE transactions SET points = ROUND(CAST(amount_credits AS REAL) / 1000.0, 3)')
            conn.execute('UPDATE transactions SET credits_after = credits_after WHERE credits_after IS NOT NULL')
            conn.execute('UPDATE transactions SET points_after = ROUND(CAST(credits_after AS REAL) / 1000.0, 3) WHERE credits_after IS NOT NULL')
            print("[migrate] transactions.points / points_after 列已添加")

        # Step 3: 更新 config 表价格（厘→点）
        # 旧价格 = 500厘 = 0.5点; 新价格 = 1点 = 1000milli-points (但UI直接显示为点)
        # 这里我们直接把 config 中的价格按新体系存入：
        # 旧体系: config value = 500 (表示500厘=0.5显示点)
        # 新体系: 我们新增 config 条目，key 改为 xxx_price_milli，value 单位从"厘"改为"毫点"
        # 同时保留旧 key 作为兼容（前端过渡期）

        NEW_PRICES = {
            # key → price in milli-points (1点=1000毫点, 等价于旧体系中的"厘")
            # 但这些价格按新定价重新设定
            'search_price': 1000,         # 1.0点/次 (原500厘=0.5点)
            'kg_price': 1000,             # 1.0点/次 (原50厘=0.05点)
            'format-check_price': 500,    # 0.5点/次 (原50厘)
            'terminology_price': 500,     # 0.5点/次 (原50厘)
            'paragraph_price': 500,       # 0.5点/次 (原50厘)
            'dashboard_price': 0,         # 免费 (原100厘)
            'data-analysis_price': 500,   # 0.5点/次 (原150厘)
            'data-ml_price': 2000,        # 2.0点/次 (原500厘)
            'export-docx_price': 500,     # 0.5点/次 (原200厘)
            'figure-advisor-batch_price': 2000,  # 2.0点/次 (原400厘)
            'joint-analysis_price': 500,  # 0.5点/次 (原300厘)
            'module_price': 200,          # 0.2点兜底 (原100厘)
            'register_bonus': 10000,      # 注册送10点 (原3000厘=3点)
            'invite_bonus': 5000,         # 邀请送5点 (原1000厘=1点)
        }

        print("[migrate] 更新定价配置...")
        for key, value in NEW_PRICES.items():
            conn.execute('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', (key, str(value)))
            print(f"  {key}: {value} milli-points ({value/1000:.2f} 点)")

        # Step 4: 添加新的价目表字段到 recharge_orders
        order_cols = [r[1] for r in conn.execute('PRAGMA table_info(recharge_orders)').fetchall()]
        if 'points' in order_cols:
            print("[migrate] recharge_orders.points 已存在")
        else:
            conn.execute('ALTER TABLE recharge_orders ADD COLUMN points REAL')
            conn.execute('UPDATE recharge_orders SET points = ROUND(amount_fen / 100.0, 2)')
            print("[migrate] recharge_orders.points 列已添加")

        conn.commit()
        print("[migrate] 定价体系迁移完成！")

        # Step 5: 输出迁移摘要
        users_count = conn.execute('SELECT COUNT(*) as c FROM users').fetchone()['c']
        total_points = conn.execute('SELECT COALESCE(SUM(points), 0) as t FROM users').fetchone()['t']
        search_price = conn.execute("SELECT value FROM config WHERE key='search_price'").fetchone()
        print(f"\n  迁移摘要:")
        print(f"  用户数: {users_count}")
        print(f"  总点数余额: {total_points:.3f} 点")
        if search_price:
            print(f"  文献检索: {int(search_price['value'])/1000:.2f} 点/次")
        print(f"  注册赠送: {int(NEW_PRICES['register_bonus'])/1000:.1f} 点")
        return True

    except Exception as e:
        conn.rollback()
        print(f"[migrate] 迁移失败: {e}")
        return False
    finally:
        conn.close()


def show_pricing():
    """显示当前定价配置。"""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        print("数据库不存在")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        print("\n当前定价配置:")
        print("-" * 60)
        rows = conn.execute(
            "SELECT key, value FROM config WHERE key LIKE '%_price' OR key IN ('register_bonus','invite_bonus','balance_refresh_seconds')"
        ).fetchall()
        for r in rows:
            key = r['key']
            val = int(r['value'])
            readable = f"{val/1000:.2f} 点" if val >= 100 else f"{val} 毫点"
            print(f"  {key:30s} = {val:>6d} ({readable})")

        user_count = conn.execute('SELECT COUNT(*) as c FROM users').fetchone()['c']
        print(f"\n  用户总数: {user_count}")
    finally:
        conn.close()


if __name__ == '__main__':
    if len(sys.argv) > 1:
        if sys.argv[1] == 'show':
            show_pricing()
        elif sys.argv[1] == 'migrate':
            success = upgrade_from_li_to_points()
            sys.exit(0 if success else 1)
        else:
            print("用法: python migrate_pricing.py [show|migrate]")
    else:
        print("用法: python migrate_pricing.py [show|migrate]")
        print("  show    - 显示当前定价")
        print("  migrate - 执行迁移")
