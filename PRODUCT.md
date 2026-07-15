# 论文AI利器 — 智能论文写作辅助平台（Thesis OS）

## Register

**Product UI** — 论文写作操作系统 / 学术工作台。支持从想法立项，也支持导入 DOCX 打磨增强。

## Purpose

一站式学术论文生产与打磨平台。覆盖：选题立项 → 文献地图 → 分章写作 → 打磨审校 → 综合评审 → 答辩输出。

## Target Users

中国高校本科生/研究生、科研工作者。中文为主，英文为辅。

## Core Workflows

1. **创作路径**：想法 → 项目 → 阶段能力 → 产物积累 → 导出/答辩
2. **导入路径**：上传 DOCX → 解析校准 → 文献/评审/图谱 → 增强导出

## Product Principles

- 项目制，而不是单次工具箱
- 阶段导航优先，能力按钮次之
- 学术 skill 可编排，但前端不暴露 skill 名称
- 前端不展示固定 token 标价，按实际消耗计费

## Brand Personality

学术专业、清晰可信、效率导向。不花哨，不娱乐化。

## Anti-References

- 不是 Notion 式的笔记工具
- 不是花哨的 AI 聊天界面
- 拒绝过度装饰和娱乐化动效

## Tech Stack

- Frontend: Vanilla HTML/CSS/JS (无框架)
- Parsing: mammoth.js + JSZip (DOCX本地解析)
- Backend: Flask + Gunicorn (kg_server.py)
- Visualization: 原生 SVG + Canvas (无D3/ECharts)
- Project state: localStorage (`thesis_ai_projects_v1`)


## Roadmap Status
- Phase 1: project model / idea wizard / stages
- Phase 2: outline + chapter drafts + export + templates + versions + tips
- Next: chapter compare UI, evidence-linked writing, DOCX export with styles
