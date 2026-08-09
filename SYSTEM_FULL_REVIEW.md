# 全系统代码复盘报告（用户侧 · 管理侧 · 算法 · 闭环）

> 复盘日期：2026-07-17（基于当前工作区代码实测，覆盖此前报告后的修改变更）  
> 范围：`kg_server.py`、`app.js`、`js/**`、`index.html`、`admin.html`、`tests/run.js`、计费/项目/文献主线  
> 方法：路由鉴权扫描 · 模块元数据 vs 实现对照 · 计费路径追踪 · 产品闭环推演  
> 说明：`SYSTEM_REVIEW.md` 记录的充值/赠送/原子扣点等能力仍有效；**本报告以当前代码为准**，修正了上一版中「API 全公开」「chargeModule 死代码」等已修复项。

---

## 0. 一句话结论

系统已具备较完整的 **资金主链骨架**（注册赠送 → AI 扣点 → 402 引导充值 → 人工审核到账 → 站内信 → Admin 看板），以及 **学术主链半成品**（项目云同步 · 文献检索校验 · 16 模块工具台 · 导出 DOCX）。

当前最大问题不再是「完全没闭环」，而是：

1. **声明 / 定价 / 真实代码路径仍有多处不一致**（运营改价空转、先算后扣、单位混用）；
2. **用户/管理业务闭环缺「决策与信任层」**（阶段指引、项目花费、封禁备注、健康监控、客服工单）；
3. **单体巨石 + 测试只做静态字符串断言**，改支付/计费不会被拦住。

---

## 1. 系统资产清单（现状）

### 1.1 后端（Flask + SQLite 单体 `kg_server.py`）

| 类别 | 内容 |
|------|------|
| 核心职责 | 静态托管 · 文献检索/校验 · 知识图谱 · 鉴权计费 · LLM · ML · 项目/资料 · Admin |
| 数据表 | `users`, `recharge_orders`, `transactions`, `llm_usage`, `daily_free_usage`, `invite_codes`, `config`, `projects`, `project_materials`, `pricing_schedules`, `project_artifacts`, `notifications`, `audit_logs` |
| 鉴权 | JWT（可选依赖）+ `@require_auth`；Admin 支持 `ADMIN_SECRET` 或 `is_admin` JWT |
| 扣点 | `deduct_credits` 原子 `UPDATE … WHERE credits>=?`；失败路径有 `refund_credits`（导出等） |

### 1.2 前端模块（`APP_MODULES` 16 个 + 工具）

| id | 名称 | requiresThesis | 元数据 | 实际实现 | 实际计费 |
|----|------|----------------|--------|----------|----------|
| topic-finder | 选题推荐 | 否 | AI | `/api/llm/analyze` | token 实扣 ✅ |
| proposal | 开题大纲 | 否 | AI | LLM | token ✅ |
| references | 参考文献 | 是 | 本地 | `app.js` → `/search_api` | 登录+限流，默认价 0 ⚠ |
| expand | 论文扩写 | 是 | AI | app-modules LLM | token ✅ |
| data-analysis | 数据分析 | 否 | `serverFixed` | 前端统计 + `/api/data/analyze_ml` | **打开免费；ML 路径固定价** ⚠ |
| knowledge-graph | 知识图谱 | 是 | `serverFixed` | `/kg_api/generate` | 登录+限流；`kg` 默认 0 ⚠ |
| proofread | 论文查错 | 否 | AI | LLM | token ✅ |
| de-duplicate | 查重降重 | 否 | AI | LLM | token ✅ |
| format-check | 格式检查 | 是 | `localCharge` | 纯前端 | `chargeModule` → usage/module ✅ |
| terminology | 术语分析 | 是 | `localCharge` | 纯前端 | 同上 ✅ |
| paragraph | 段落分析 | 是 | `localCharge` | **纯前端规则** | 同上 ✅（元数据已修正，不再假 AI） |
| review | 论文审阅 | 是 | AI | thesis-review + LLM | token（部分） |
| optimization | 优化建议 | 是 | `localCharge` | **纯前端** | chargeModule ✅ |
| defense-ppt | 答辩 PPT | 否 | AI | LLM | token ✅ |
| en-abstract | 英文摘要 | 否 | AI | LLM | token ✅ |
| dashboard | 论文看板 | 是 | `localCharge` | 纯前端 | chargeModule ✅ |

额外工具：资料库、一键流水线、答辩材料包、文献规范化、完整预览；仓库仍有 [`js/modules/cat-game.js`](js/modules/cat-game.js)（娱乐向）。

### 1.3 维护风险（体量）

| 文件 | 角色 | 风险 |
|------|------|------|
| `kg_server.py` | 全后端 | 支付+LLM+检索+项目揉一文件，难测难拆 |
| `app.js` | 文献/图谱/上传 | DOM 巨石 |
| `js/modules/project.js` | 项目/大纲/导出 | 云+本地双写 |
| `js/app-modules.js` | 模块壳+部分数据分析 | 职责过宽 |
| `tests/run.js` | 回归 | **几乎全是源码字符串存在性断言**，无资金状态机真测 |

### 1.4 相对旧报告已修复的项（避免重复开单）

| 旧结论 | 现状 |
|--------|------|
| search/verify/kg/convert 无鉴权 | 均已 `@require_auth` + 用户/IP 限流 |
| chargeModule 前端零调用 | `localCharge` 模块 `switchModule` 会先 `chargeModule` |
| paragraph/optimization 标 AI | 已改为 `localCharge: true, aiDriven: false` |
| knowledge-graph 无 MODULE_RUNNERS | 已映射 `runKnowledgeGraphModule` |
| 顶栏无免费次数 | `updateBalanceDisplay` 展示 `免费 remaining/limit` |
| 402 无引导 | 全局 fetch 补丁 → `showRechargeModal` |
| Admin 全拼 `?secret=` | Admin 前端主路径用 `Authorization: Bearer`（**后端仍兼容 query secret**） |

---

## 2. 致命 / 高优先级问题（按严重度）

### P0 — 安全 / 资金 / 可被打穿

#### P0-1 数据分析 ML：**先算后扣**（与注释相反）

[`kg_server.py`](kg_server.py) `analyze_ml` 在完整 numpy/sklearn 计算结束后才 `deduct_credits`（约 3185 行）。注释写「先扣后算失败则退」，实现是 **先烧 CPU 再收费**。

| 风险 | 说明 |
|------|------|
| 余额不足仍可占用 CPU | 用户故意提交大数据集可白嫖算力 |
| 并发下资源耗尽 | 无队列、无任务超时 |
| 扣费失败时计算已完成 | 结果被 402 丢掉，服务器已付成本 |

**建议**：入口先 `deduct` 或余额预检 + 冻结算；失败 `refund`；限制 rows/列数/超时。

#### P0-2 Webhook 签名过弱（默认关闭，但开启即危险）

`PAYMENT_WEBHOOK_ENABLE=1` 时：`sign === PAYMENT_WEBHOOK_SECRET` 是共享口令，非渠道 HMAC；且以订单表金额入账，**知 secret 可确认任意 pending/submitted 单**。

**建议**：默认保持关；若启用必须渠道验签 + 回调金额 == 订单金额 + 幂等。

#### P0-3 生产默认口令与内存限流

- `ADMIN_SECRET` 默认 `admin123`：生产 `FLASK_ENV=production` 会 raise ✅；开发仍弱。
- `ADMIN_PASSWORD` 默认 `admin123`，`INSERT OR IGNORE` **不会更新已存在 admin 密码**。
- 登录/检索限流为 **进程内 dict**，重启清空；多 worker 不共享。
- Admin 登录页仍明文提示 `admin / admin123`（[`admin.html`](admin.html) hint）。

**建议**：强制首次改密；失败次数落库；Admin 页去掉默认口令提示；多实例迁 Redis/PG。

#### P0-4 检索 / 图谱默认 **0 价** + 高上游成本

虽已登录+限流，但：

- `search` / `kg` 默认价 0 → **登录用户可在限流内无限刷 OpenAlex/S2/Crossref 等**；
- 单次 `search_api` 串行打多源，`queries[:30]`，上游放大倍数极高。

**建议**：检索「每日 N 次免费 + 超出固定厘」；图谱固定价或节点计费；服务端缓存 TTL；queries 上限再压（如 5）。

#### P0-5 Admin 鉴权仍吃 QueryString secret

后端多处：`request.args.get('secret')` 仍有效。即便前端走 Header，**任意人只要把 secret 拼进 URL 就会进 access log / 浏览器历史**。

**建议**：仅接受 Header；query secret 兼容一期后删除。

---

### P1 — 计费一致性 / 用户信任

#### P1-1 定价键与真实计费路径脱节

| 配置键 | 运营以为 | 代码实际 |
|--------|----------|----------|
| `domain_analysis` | 可改固定价 | `domain_analyze` 已 token 实扣，不读该价 |
| `search` / `kg` | 可定价 | 默认 0；检索前端从不 `chargeModule('search')` |
| `data-analysis` | 固定价 | 打开模块不扣；仅 ML 用 `data-ml` |
| `optimization` 等 | pricing 接口标 `llm-token` | 实际本地 + localCharge |

`/api/pricing` 把 `optimization` 等放进 `llm-token` 列表，**与 `APP_MODULES` 和实现冲突**，用户看公开价目会误解。

#### P1-2 单位混用仍在管理报表

| 字段 | 真实单位 |
|------|----------|
| `users.credits` / `transactions` / `user_charged_credits` | 厘（1 点=1000） |
| `llm_usage.cost_credits` | **约「分」= 元×100**（历史误名） |
| 看板 `llm_margin_points_total` | `charged_points - api_cost_yuan` **点减元** |

现金毛利 `approx_cash_profit_yuan` 相对合理；**用量毛利卡片易误导运营**。

**建议**：改名 `api_cost_fen`；API 统一返回 `points` + `api_cost_yuan`；毛利一律用元。

#### P1-3 免费额度双入口

- `/api/usage/module`：本地模块扣点/免费
- `/api/usage/mark_free`：另一套递增

前端主路径用前者；`mark_free` 易成死代码或双计。应合并为单一「消耗一次免费权益」API。

#### P1-4 LLM：预估拦余额，成功后实扣；失败记 success=0 ✅  
缺口：前端多数模块 **无「预计扣点」展示**；扣完后部分有 `updateBalanceDisplay`，缺少统一「本次 -0.023 点」toast（`chargeModule` 有，LLM 路径不统一）。

#### P1-5 导出 DOCX 失败退款 ✅  
缺口：无导出历史；无项目维度累计花费。

#### P1-6 注册/邀请赠送抬高负债  
看板有 `gift_points_total`，缺 **赠送/充值比、邀请 ROI、自邀请风控（设备指纹）**。

---

### P1 — 架构 / 算法 / 产品冲突

#### P1-7 项目状态双写

- 云：`/api/projects` + `project_artifacts`（含 `versions_json` 字段）
- 本地：`localStorage` 多 key

权威源未文档化；多设备冲突、登出丢本地、大 JSON 撑 SQLite 行风险仍在。`versions_json` 表字段有，产品级版本对比/回滚弱。

#### P1-8 文献算法强、产品联动弱

`app.js` 多源检索 + 校验 + 章节分配较成熟，测试也集中于此；但：

- 不进项目花费；
- 无「本次检索预估耗时/源次数」；
- 结果未必稳定沉淀为项目 artifact。

#### P1-9 测试错觉

`tests/run.js` 大量 `indexOf('/api/payment/submit')` 式断言。  
**改坏充值状态机 / 原子扣点条件，测试仍绿。**

#### P1-10 模块职责散落

扩写/审阅/数据分析能力分散在 `app-modules.js`、`thesis-review.js`、`app.js`、`project.js`，边界不清。

#### P1-11 `cat-game` 与学术产品气质冲突  
仍在仓库；若主包引用则损害专业感与体积。

#### P1-12 README 严重过时  
仍描述「6 个分析模块、无登录、无 AI」，与现产品不符。

---

## 3. 系统闭环（现状 vs 理想）

### 3.1 资金闭环 — 基本打通，有口子

```text
注册赠送 → transactions + notify
  → 使用 AI/本地模块 → deduct 原子
  → 402 → 充值弹窗
  → pending → submitted → admin confirm/reject → notify
  → admin 看板（充值/毛利/负债/审计）
```

残余：公开上游刷流量（登录后）、ML 先算后扣、webhook、赠送套利、固定价键空转。

### 3.2 学术生产闭环 — 半通

```text
想法/导入 → 项目(云+本地) → 阶段工具 → 产物 → 导出
```

断裂：

- 阶段完成度无硬指标（`stage_status` 有字段，UX 弱）；
- 无「下一步只做一件事」主 CTA；
- 文献/图谱不进花费；
- 版本对比/导出历史弱；
- 四栏工作台偏桌面，移动端残缺。

### 3.3 运营闭环 — 半通

```text
观测 → 改价/赠送 → 执行 → 审计 → 再观测
```

断裂：改价与真实扣费脱节；无异常检测（402 突刺、LLM 失败率）；无用户封禁/备注；审计缺 admin 登录本身。

### 3.4 信任闭环 — 弱

文献校验强；扣点说明在 transaction 字符串；**无申诉/工单、无管理员双向回复消息**。

---

## 4. 用户侧缺口（「总觉得缺」的来源）

用户心智：

```text
目标论文 → 当前阶段 → 下一步 → 要花多少点 → 产物沉淀 → 导出/答辩
```

| 环节 | 现状 | 缺失 |
|------|------|------|
| 登录后目标 | 项目向导/四栏工作台 | 今日待办 / 阶段检查清单 |
| 能力发现 | 工具台+百宝箱 | 按阶段推荐 Top3 动作 |
| 成本预期 | 定价页/扣点 toast 局部 | AI 按钮旁预估区间 |
| 余额不足 | 402 弹充值 | 部分 LLM 失败文案不统一 |
| 消费感知 | 账户中心流水 | **无项目维度累计花费** |
| 充值 | 附言码+人工 | 截图上传弱、无 SLA 文案 |
| 消息 | 铃铛 | 无邮件/微信；无双向客服 |
| 邀请 | 有码 | 无海报/进度/防刷 |
| 导出 | DOCX+失败退款 | 无历史与版本对比 |
| 异常恢复 | 部分 | LLM 失败是否扣点说明不一 |
| 专业感 | — | cat-game；README 像老项目 |

**用户侧最小补齐包（1–2 周）**

1. 顶栏：余额 + 今日免费 + 未读（已有大半，统一样式即可）  
2. 每个 AI 按钮：预估扣点（用现有 est 逻辑返回字段即可）  
3. 项目卡：本项目累计消耗（`transactions` 带 `project_id` 或 skill_logs 汇总）  
4. 充值：订单号大号+复制+「工作日 X 小时内确认」  
5. 阶段导航：每阶段 1 主 CTA + 完成标准  
6. 去掉/隐藏娱乐模块

---

## 5. 管理侧缺口

管理员心智：

```text
今日待办 → 钱是否到账 → 成本是否失控 → 谁在刷 → 改价是否生效
```

| 环节 | 现状 | 缺失 |
|------|------|------|
| 待办 | pending 数字、30s 刷新 | 超时标红、声音/桌面通知 |
| 对账 | CSV | 日结模板、截图位、银行流水对照 |
| 用户 | 详情抽屉、赠送 | **封禁/限流/备注/风险标签** |
| 盈利 | 曲线+KPI | 单位修正；cohort 付费转化 |
| 改价 | 表+排期 | 保存前 diff；影响模块预览；写 audit |
| 审计 | audit_logs | admin 登录日志；改价审计不全 |
| 健康 | ops_stats 基础 | LLM 失败率、检索 429、磁盘 materials |
| 客服 | 无 | 工单 / 回复进用户消息中心 |
| 权限 | 单一 is_admin | 运营/财务分权 |

**管理侧最小补齐包**

1. 首页「今日待办」：待确认、超时单、今日 API 成本阈值、失败 LLM Top  
2. 用户：封禁开关、备注、最近 402 次数  
3. 改价：diff + audit；删掉无效键或标明「仅 LLM」  
4. 废弃 query secret  
5. 订单附言码一键复制 + 备注「已核银行」

---

## 6. 前后端契约冲突表（仍有效）

| 契约 | 前端/运营以为 | 后端实际 | 后果 |
|------|---------------|----------|------|
| data-analysis 服务器计费 | serverFixed 文案 | 打开不扣，仅 ML 扣 data-ml | 用户困惑 |
| search 可运营定价 | config 有 search_price | 从不扣 | 上游被刷 |
| domain 固定价 | admin 可改 | token 实扣 | 改价无效 |
| pricing 公开接口 | optimization=llm | 本地 fixed | 价目错误 |
| 1 点毛利 | 点−元可减 | 量纲不同 | 报表偏差 |
| Admin secret | Header only | 仍收 query | 日志泄露风险 |
| ML 先扣 | 注释 | 后扣 | 白嫖 CPU |

---

## 7. 算法 / 数据层简表

| 区域 | 观察 | 建议 |
|------|------|------|
| 文献检索 | 多源合并成熟 | 配额+缓存+记账；压 queries |
| 文献校验 | DOI/撤稿等 | 结果写入项目产物 |
| 图谱力导 | 服务端 CPU，已限节点 | 固定价；超时 |
| LLM | markup×成本，最低扣，失败 success=0 | 统一前端 toast；预估展示 |
| ML | 相关/可选 sklearn | **先扣**；限制规模 |
| 邀请 | 日上限有 | 设备防刷 |
| SQLite | WAL+原子扣点 | 单机 OK；多实例需 PG |

---

## 8. 模块收费建议矩阵（决策用）

| 模块 | 建议 | 理由 |
|------|------|------|
| 选题/开题/查错/降重/审阅/答辩/摘要/扩写 | token × markup | 已 LLM |
| 段落/优化/格式/术语/看板 | 本地免费 **或** 低固定+每日免费（现状 localCharge） | 诚实标注 |
| 文献检索 | 日免费 N 次 + 超出固定价 | 防刷上游 |
| 知识图谱 | 固定价/次 | CPU |
| 数据分析·本地统计 | 免费引流 | 纯前端 |
| 数据分析·ML | 固定价 **先扣** | 服务器计算 |
| 导出 DOCX | 固定价+失败退款 | 已 OK |
| 领域分析 | 并入 LLM token | 删除固定价键 |

---

## 9. 优化路线图（按 ROI）

### 第 1 周 — 止血与诚实

1. **ML 改为先扣后算**（P0）  
2. **检索/图谱非零价或日配额**（P0）  
3. **Admin 仅 Header 鉴权 + 去掉登录页默认口令提示**  
4. **对齐 `/api/pricing` 与 APP_MODULES 元数据**；删除或标注无效 config 键  
5. **修正管理端毛利单位**  
6. **补资金单测**：submit 状态机、原子扣点、confirm 鉴权、赠送通知、402  

### 第 2 周 — 「不觉得缺」

7. AI 预估扣点 + 统一扣费 toast  
8. 项目累计消耗  
9. Admin 今日待办 + 订单超时 + 用户备注/封禁  
10. 改价 diff + audit  
11. 充值 SLA 文案 + 附言强化  
12. 隐藏 cat-game；更新 README  

### 第 3–4 周 — 结构

13. 拆 `kg_server.py`：`auth_billing` / `search` / `admin` / `projects`  
14. 拆 `app.js` 文献子系统  
15. 项目 JSON 体积上限；云端权威策略  
16. 基础健康看板：LLM 失败率、402、检索耗时、materials 磁盘  

### 中期

17. 真支付或可靠半自动对账（截图/webhook 验签）  
18. 客服工单（admin 回复 → 用户消息）  
19. PostgreSQL + Redis 限流（多实例）  
20. 角色权限（运营/财务）  

---

## 10. 功能缺口清单（产品语气）

### 用户还没有

- [ ] 阶段进度 % 与「下一步只做一件事」  
- [ ] 操作前价格预估、操作后明确扣点 toast（LLM 全覆盖）  
- [ ] 项目花费报表  
- [ ] 充值凭证/预计到账时间  
- [ ] 与管理员对话（扣点申诉、催到账）  
- [ ] 多设备一致的项目真相源  
- [ ] 导出历史与版本回滚  
- [ ] 移动端可用工作台  

### 管理员还没有

- [ ] 真正的待办收件箱（超时、优先级）  
- [ ] 用户封禁、备注、风险分  
- [ ] 对账日结  
- [ ] 改价影响模拟  
- [ ] 系统健康（错误率、延迟、磁盘）  
- [ ] 分角色权限  
- [ ] 运营活动：批量赠送、优惠码  
- [ ] admin 登录审计、secret 不进 URL  

---

## 11. 已做对的部分

- 充值状态机 `pending → submitted → confirmed|rejected` 与文案  
- 赠送/到账站内信  
- 原子扣点防超卖  
- 账户中心 + 402 引导 + 顶栏余额/免费次数  
- Admin 曲线、批量确认、CSV、用户抽屉、审计、定价排期  
- 核心学术 API 已登录+限流（相对旧版）  
- `localCharge` + `chargeModule` 已接线  
- 文献算法与静态回归在解析/引用领域扎实  
- 项目云同步与资料库方向正确  
- LLM 失败记 `success=0`；导出失败退款  

说明：**资金主链和文献主链都有基础**；下一阶段重点是 **诚实计费、止血算力/上游、补齐信任与运营决策层**，而不是再堆模块数量。

---

## 12. 建议开工顺序

```text
1) ML 先扣后算 + 检索/图谱配额或定价
2) 定价元数据三方对齐（APP_MODULES / PRICING / /api/pricing）
3) Admin 去 query secret + 改默认口令提示 + 毛利单位
4) 用户：AI 预估 + 项目花费 + 充值 SLA
5) 资金/计费自动化测试（真状态机，非字符串）
6) 再谈工单、真支付、拆库
```

---

## 13. 附录：关键面速查（当前代码）

| 路径 | 鉴权 | 限流 | 扣点 |
|------|------|------|------|
| /api/auth/* | 部分 | 登录内存限流 | — |
| /api/payment/* | 大多有；confirm=admin | 建单有 | 入账 |
| /api/llm/analyze | 有 | 20/min·用户 | token ✅ |
| /api/ai/domain_analyze | 有 | 弱 | token ✅ |
| /api/usage/module | 有 | 无 | 固定/免费 ✅ 前端 localCharge 在用 |
| /search_api | **有** | 用户+IP | **默认 0** ⚠ |
| /verify_api | **有** | 有 | 无 |
| /kg_api/generate | **有** | 有 | 价>0 才扣，默认 0 ⚠ |
| /convert_doc | **有** | 有 | 无 |
| /api/data/analyze_ml | 有 | 无 | **算完再扣** ⚠ |
| /api/export/docx | 有 | 无 | 固定+失败退 ✅ |
| /api/admin/* | secret/JWT | 无 | — |
| /api/projects/* | 有 | 无 | — |
| /api/payment/webhook | 开关+弱 sign | 无 | 可入账 ⚠ |

---

**报告结束。**  
若继续开发，建议按第 12 节从 P0（ML 先扣、检索配额）开工；改动面集中在 `kg_server.py` / `js/app-modules.js` / `admin.html` / 补计费测试。
