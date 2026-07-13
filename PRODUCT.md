# 论文AI利器 — 智能论文写作辅助平台

## Register
**Product UI** — 论文写作工具/学术辅助面板。用户在此完成论文解析、文献检索、格式检查、知识图谱生成等学术工作流。

## Purpose
一站式学术论文辅助工具。支持 DOCX 论文解析、多源文献检索（12 数据源）、GB/T 7714 参考文献管理、十维论文评审、知识图谱可视化、术语一致性分析、段落逻辑检测。

## Target Users
中国高校本科生/研究生、科研工作者。中文为主，英文为辅。

## Core Workflow
上传论文 → 校准目录 → 检索文献 → 评审分析 → 知识图谱 → 导出报告

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
