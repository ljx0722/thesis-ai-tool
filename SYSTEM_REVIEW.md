# 系统闭环复盘报告（2026-07-17，持续更新）

> 范围：前后端计费/充值/管理员/通知/项目主线。  
> 状态标记：✅ 已落地 · ⏳ 部分 · ❌ 未做（中期/依赖外部）

## 一、已落地能力（累计）

### 管理员
- ✅ 全部充值记录筛选/搜索；确认到账 / 拒绝并通知
- ✅ 批量确认勾选订单
- ✅ 赠送/扣减点数（按「点」）+ 用户站内消息
- ✅ 盈利曲线（SVG）+ 现金毛利 / 点负债 / 赠送 KPI
- ✅ 全站流水 + CSV 导出（订单 / 流水）
- ✅ 用户详情抽屉（余额/订单/流水/LLM/项目）
- ✅ 审计日志（确认/拒绝/赠送/批量确认）
- ✅ 30s 自动刷新

### 用户
- ✅ 消息中心（铃铛 + 未读）
- ✅ 账户中心（余额/免费额度/流水/订单/消息/邀请）
- ✅ 充值闭环：`pending → submitted → confirmed|rejected`
- ✅ 订单 `order_id` + 附言码；拒绝后可重新提交
- ✅ 402 全局拦截 → 引导充值

### 安全 / 计费
- ✅ `/api/payment/confirm` 仅管理员
- ✅ 生产默认 `ADMIN_SECRET=admin123` **直接拒绝启动**
- ✅ 登录 IP 速率限制 + 失败窗口
- ✅ 充值建单节流；同用户未完结单上限；同金额 pending 复用
- ✅ 扣点原子 `UPDATE … WHERE credits>=?`
- ✅ `domain_analyze` 按 token × USER_MARKUP 实扣
- ✅ 免费额度 API 统一「已用/上限/剩余」
- ✅ LLM 注释与 `USER_MARKUP=3` 对齐；失败记 `success=0`
- ✅ 导出 DOCX 失败退款；ML 扣点路径加固
- ✅ `init_db` 配置 `INSERT OR IGNORE`（不再覆盖运营改价）
- ✅ 邀请日上限；邀请/注册流水与通知修复
- ✅ 定价排期 `is_active` 写库节流（60s）

---

## 二、剩余项（按优先级）

### 仍建议但未做满
| 项 | 状态 | 说明 |
|----|------|------|
| 支付截图上传 | ❌ | 需对象存储/本地目录；当前靠附言码人工核对 |
| 真实支付渠道 / webhook 签名 | ⏳ | webhook 占位仍在；默认关闭 |
| 设备级邀请风控 | ⏳ | 仅日上限；无设备指纹 |
| 多 worker 行锁 | ⏳ | SQLite 原子 UPDATE 已缓解；多实例仍建议 PG |
| 本项目累计花费卡片 | ❌ | 产品主线 P3 |
| 账号注销 / 软删除 | ❌ | 合规 P3 |
| Token 吊销/设备列表 | ❌ | P3 |

### 中期
- 真实支付或半自动对账增强
- PostgreSQL（多实例）
- 异常监控面板（402 突刺 / LLM 失败率）

---

## 三、盈利口径（管理员）

| 指标 | 公式 |
|------|------|
| 累计充值现金 | `SUM(confirmed amount_yuan)` |
| API 成本 | `SUM(llm_usage.cost_credits)/100` |
| 现金毛利 | 充值 − API 成本 |
| 用量毛利 | 用户扣点 − API 成本 |
| 点余额负债 | `SUM(users.credits)/1000` |
| 累计赠送 | 注册/邀请/admin_gift |

约定：**1 点 ≈ 1 元**（充值汇率）；赠送抬高负债、不进现金。

---

## 四、单位约定

| 名称 | 含义 |
|------|------|
| 厘（milli-credit） | 库内 `users.credits` / `transactions.amount_credits` |
| 点 | 展示单位 = 厘/1000；1 元充值 = 1 点 |
| `llm_usage.cost_credits` | API 成本「分」近似 = 元×100（历史字段名） |
| `user_charged_credits` | 用户实扣厘 |

---

## 五、关键文件

- [kg_server.py](kg_server.py)
- [admin.html](admin.html)
- [index.html](index.html)
- [css/style.css](css/style.css)

## 六、自测清单

1. 重启后端（迁移 `audit_logs` / `recharge_orders.note`）
2. 用户充值 → 备注订单号 → 提交审核 → 管理员确认 → 消息到账
3. 管理员赠送 2 点 → 用户账户中心/铃铛可见
4. 故意耗尽点数调 AI → 弹出充值确认
5. 管理员导出订单 CSV、打开用户详情抽屉
6. 生产环境若不设 `ADMIN_SECRET` 应无法启动（`FLASK_ENV=production`）
