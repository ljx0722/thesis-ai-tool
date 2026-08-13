(function () {
  'use strict';

  var milestones = [
    { id: 'prepare', name: '准备', icon: '1', description: '选题、文献与大纲' },
    { id: 'writing', name: '写作', icon: '2', description: '分章写作与数据' },
    { id: 'polish', name: '打磨', icon: '3', description: '体检、降重与评审' },
    { id: 'finish', name: '收尾', icon: '4', description: '答辩、摘要与导出' }
  ];

  var capabilities = [
    { id: 'ideation', name: '开题工作台', icon: '💡', milestone: 'prepare', requiresProject: false, requiresManuscript: false, runner: 'IdeationModule', presentation: 'focus', billing: 'ai', searchTerms: '选题 研究问题 开题 大纲' },
    { id: 'proposal', name: '开题大纲', icon: '📝', milestone: 'prepare', requiresProject: false, requiresManuscript: false, aliasOf: 'ideation', tab: 'outline', presentation: 'focus', billing: 'ai', searchTerms: '开题 大纲 结构' },
    { id: 'references', name: '证据与引用', icon: '📚', milestone: 'prepare', requiresProject: true, requiresManuscript: false, presentation: 'tool', billing: 'free', searchTerms: '参考文献 引用 证据 审计' },
    { id: 'citely', name: '智能文献检索', icon: '🔎', milestone: 'prepare', requiresProject: false, requiresManuscript: false, aliasOf: 'references', presentation: 'tool', billing: 'free', searchTerms: '检索 搜索 文献' },
    { id: 'knowledge-graph', name: '知识图谱', icon: '🕸️', milestone: 'prepare', requiresProject: true, requiresManuscript: true, runner: 'runKnowledgeGraphModule', presentation: 'modal', billing: 'fixed', searchTerms: '图谱 概念 网络 时间线' },
    { id: 'writing-workbench', name: '写作编辑器', icon: '✍️', milestone: 'writing', requiresProject: true, requiresManuscript: false, runner: 'WritingModule', presentation: 'focus', billing: 'free', searchTerms: '写作 编辑 章节 草稿' },
    { id: 'expand', name: '论文扩写', icon: '📝', milestone: 'writing', requiresProject: false, requiresManuscript: false, runner: 'runExpandModule', presentation: 'focus', billing: 'ai', searchTerms: '扩写 改写 精简 学术化' },
    { id: 'data-analysis', name: '数据与图表', icon: '📈', milestone: 'writing', requiresProject: false, requiresManuscript: false, runner: 'runDataAnalysis', presentation: 'focus', billing: 'mixed', searchTerms: '数据 统计 图表 CSV 科研绘图' },
    { id: 'health-check', name: '论文体检', icon: '🏥', milestone: 'polish', requiresProject: false, requiresManuscript: false, runner: 'HealthCheckModule', presentation: 'focus', billing: 'ai', searchTerms: '查错 格式 术语 段落 降重' },
    { id: 'proofread', name: '论文查错', icon: '✏️', milestone: 'polish', requiresProject: false, requiresManuscript: false, aliasOf: 'health-check', check: 'proofread', presentation: 'focus', billing: 'ai', searchTerms: '语病 错字 校对' },
    { id: 'format-check', name: '格式检查', icon: '✅', milestone: 'polish', requiresProject: true, requiresManuscript: true, aliasOf: 'health-check', check: 'format-check', presentation: 'focus', billing: 'fixed', searchTerms: '格式 标题 图表 引用' },
    { id: 'terminology', name: '术语分析', icon: '🔤', milestone: 'polish', requiresProject: true, requiresManuscript: true, aliasOf: 'health-check', check: 'terminology', presentation: 'focus', billing: 'fixed', searchTerms: '术语 一致性 缩写' },
    { id: 'paragraph', name: '段落分析', icon: '¶', milestone: 'polish', requiresProject: true, requiresManuscript: true, aliasOf: 'health-check', check: 'paragraph', presentation: 'focus', billing: 'fixed', searchTerms: '段落 逻辑 长句 连贯' },
    { id: 'de-duplicate', name: '查重降重', icon: '📋', milestone: 'polish', requiresProject: false, requiresManuscript: false, runner: 'runDeduplicate', presentation: 'focus', billing: 'ai', searchTerms: '查重 降重 重复 改写' },
    { id: 'review', name: '综合审阅', icon: '🔍', milestone: 'polish', requiresProject: true, requiresManuscript: true, runner: 'ReviewModule', presentation: 'focus', billing: 'ai', searchTerms: '审阅 评审 评分 审稿' },
    { id: 'optimization', name: '优化建议', icon: '💡', milestone: 'polish', requiresProject: true, requiresManuscript: true, runner: 'runOptimization', presentation: 'focus', billing: 'fixed', searchTerms: '优化 建议 结构' },
    { id: 'dashboard', name: '论文看板', icon: '📊', milestone: 'finish', requiresProject: true, requiresManuscript: true, runner: 'showDashboard', presentation: 'modal', billing: 'fixed', searchTerms: '看板 评分 雷达 质量' },
    { id: 'defense-ppt', name: '答辩 PPT', icon: '🎤', milestone: 'finish', requiresProject: false, requiresManuscript: false, runner: 'runDefensePPT', presentation: 'focus', billing: 'ai', searchTerms: '答辩 PPT 幻灯片' },
    { id: 'en-abstract', name: '英文摘要', icon: '中/EN', milestone: 'finish', requiresProject: false, requiresManuscript: false, runner: 'runEnAbstract', presentation: 'focus', billing: 'ai', searchTerms: '英文 摘要 翻译' },
    { id: 'materials', name: '项目资料库', icon: '📁', milestone: 'writing', requiresProject: true, requiresManuscript: false, action: 'openMaterialsLibrary', presentation: 'modal', billing: 'free', searchTerms: '资料 文件 CSV 上传' },
    { id: 'pipeline', name: '一键流水线', icon: '⚡', milestone: 'writing', requiresProject: true, requiresManuscript: false, action: 'runOneClickPipeline', presentation: 'modal', billing: 'mixed', searchTerms: '流水线 自动 大纲 章节' },
    { id: 'defense-pack', name: '答辩材料包', icon: '📦', milestone: 'finish', requiresProject: true, requiresManuscript: false, action: 'openDefensePack', presentation: 'modal', billing: 'mixed', searchTerms: '答辩 材料 讲稿 问答' },
    { id: 'ref-norm', name: '文献规范化', icon: '§', milestone: 'finish', requiresProject: true, requiresManuscript: false, action: 'normalizeRefsGBT7714', presentation: 'modal', billing: 'free', searchTerms: '文献 规范 GB T 7714' },
    { id: 'preview', name: '完整预览', icon: '👁', milestone: 'finish', requiresProject: true, requiresManuscript: false, action: 'openFullPaperPreview', presentation: 'modal', billing: 'free', searchTerms: '预览 全文 导出' }
  ];

  var byId = {};
  capabilities.forEach(function (item) { byId[item.id] = item; });

  function get(id) { return byId[id] || null; }
  function canonical(id) {
    var item = get(id);
    return item && item.aliasOf ? (get(item.aliasOf) || item) : item;
  }
  function forMilestone(id) {
    return capabilities.filter(function (item) { return item.milestone === id && !item.aliasOf; });
  }
  function search(query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return capabilities.slice();
    return capabilities.filter(function (item) {
      return [item.id, item.name, item.searchTerms].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }

  window.ThesisCapabilities = {
    milestones: milestones,
    all: capabilities,
    get: get,
    canonical: canonical,
    forMilestone: forMilestone,
    search: search
  };
})();
