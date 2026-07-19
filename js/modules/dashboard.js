/**
 * 论文看板 — 综合评估行动中心
 * 权威分数来自 computeThesisReview()；展示与行动映射在此层完成。
 */
var THESIS_BOARD_WEIGHTS = [
  { key: 'topic', label: '选题价值', weight: 0.10, modules: [{ id: 'topic-finder', name: '选题推荐' }, { id: 'proposal', name: '开题报告' }] },
  { key: 'literature', label: '文献综述', weight: 0.15, modules: [{ id: 'references', name: '文献工作台' }, { id: 'knowledge-graph', name: '知识图谱' }] },
  { key: 'struct', label: '框架结构', weight: 0.15, modules: [{ id: 'optimization', name: '结构优化' }, { id: 'review', name: '论文查错' }] },
  { key: 'method', label: '研究方法', weight: 0.10, modules: [{ id: 'optimization', name: '结构优化' }, { id: 'data-analysis', name: '数据分析' }] },
  { key: 'content', label: '内容论证', weight: 0.15, modules: [{ id: 'paragraph', name: '段落分析' }, { id: 'data-analysis', name: '数据分析' }] },
  { key: 'conclusion', label: '结论展望', weight: 0.10, modules: [{ id: 'optimization', name: '结构优化' }, { id: 'proofread', name: '校对润色' }] },
  { key: 'innovation', label: '创新性', weight: 0.05, modules: [{ id: 'topic-finder', name: '选题推荐' }, { id: 'review', name: '论文查错' }] },
  { key: 'readable', label: '学术写作', weight: 0.08, modules: [{ id: 'proofread', name: '校对润色' }, { id: 'paragraph', name: '段落分析' }, { id: 'terminology', name: '术语检查' }] },
  { key: 'format', label: '格式规范', weight: 0.05, modules: [{ id: 'format-check', name: '格式检查' }] },
  { key: 'practical', label: '实践价值', weight: 0.07, modules: [{ id: 'review', name: '论文查错' }, { id: 'data-analysis', name: '数据分析' }] }
];

function showDashboard() {
  if (!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100)) {
    alert('请先上传论文');
    return;
  }
  var overlay = document.getElementById('dbOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  buildDashboard();
  try {
    if (window.ThesisProject && ThesisProject.logSkillRun) {
      ThesisProject.logSkillRun({ moduleId: 'dashboard', title: '论文看板', summary: '打开综合评估' });
    }
  } catch (e) {}
}

function closeDashboard() {
  var overlay = document.getElementById('dbOverlay');
  if (overlay) overlay.style.display = 'none';
}

function buildDashboard() {
  showLoad('生成论文看板...', 10, '聚合分析数据');
  setTimeout(function () {
    var content = document.getElementById('dbContent');
    try {
      if (!content) { hideLoad(); return; }
      updLoad('计算评分...', 30);
      content.innerHTML = buildDashboardHTML();
      bindDashboardActions(content);
      updLoad('渲染图表...', 70);
      setTimeout(function () {
        drawRadarChart();
        drawChapterChart();
        drawLitPie();
        hideLoad();
      }, 80);
    } catch (e) {
      hideLoad();
      if (content) content.innerHTML = '<div class="thesis-board-error">渲染出错：' + escBoard(e.message) + '</div>';
    }
  }, 40);
}

function escBoard(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function boardThemeColors() {
  var styles = getComputedStyle(document.body);
  function v(name, fallback) {
    var val = styles.getPropertyValue(name);
    return (val && val.trim()) || fallback;
  }
  return {
    text: v('--text-primary', '#0f172a'),
    muted: v('--text-muted', '#64748b'),
    border: v('--border', '#e2e8f0'),
    accent: v('--accent', '#6366f1'),
    card: v('--bg-card', '#ffffff'),
    success: v('--success', '#10b981'),
    warning: v('--warning', '#f59e0b'),
    danger: v('--danger', '#ef4444'),
    info: v('--info', '#3b82f6')
  };
}

function scoreTone(score) {
  if (score >= 80) return 'ok';
  if (score >= 60) return 'info';
  if (score >= 40) return 'warn';
  return 'bad';
}

function scoreLevel(score) {
  if (score >= 80) return '优秀';
  if (score >= 60) return '良好';
  if (score >= 40) return '一般';
  return '需改进';
}

function gradeMeta(composite) {
  if (composite >= 85) return { grade: 'A', label: '优秀', tone: 'ok' };
  if (composite >= 70) return { grade: 'B', label: '良好', tone: 'info' };
  if (composite >= 55) return { grade: 'C', label: '中等', tone: 'warn' };
  return { grade: 'D', label: '需改进', tone: 'bad' };
}

function computeAllScores() {
  var rev = typeof computeThesisReview === 'function' ? computeThesisReview() : null;
  if (!rev || !rev.dimensions || rev.dimensions.length < 10) {
    return null;
  }
  var dims = THESIS_BOARD_WEIGHTS.map(function (meta, idx) {
    var source = rev.dimensions[idx] || { score: 0, label: meta.label, subItems: [] };
    return {
      key: meta.key,
      label: meta.label,
      weight: meta.weight,
      score: source.score,
      subItems: source.subItems || [],
      modules: meta.modules
    };
  });
  var text = manuscriptText || '';
  var secs = sections || [];
  var bodyChs = secs.filter(isBodyChapter);
  var rl = (typeof mergedRefs !== 'undefined' && mergedRefs.length) ? mergedRefs : (typeof existingRefs !== 'undefined' ? existingRefs : []);
  var totalChars = text.length;
  var cnRefs = rl.filter(function (r) { return /[一-鿿]/.test((r.title || r.ci || '').substring(0, 5)); }).length;
  var enRefs = rl.length - cnRefs;
  var recentRefs = rl.filter(function (r) { var y = parseInt(r.year, 10) || 0; return y >= (new Date().getFullYear() - 5); }).length;
  var doiRefs = rl.filter(function (r) { return r.doi && r.doi.length > 5; }).length;
  var methods = (rev.stats && rev.stats.methods) || [];
  var avgSentLen = (rev.stats && rev.stats.avgSentLen) || 35;
  var hasIntro = bodyChs.some(function (c) { return /绪论|引言|前言/.test(c.name); });
  var hasLit = bodyChs.some(function (c) { return /文献|综述|理论|基础/.test(c.name); });
  var hasMethod = bodyChs.some(function (c) { return /方法|模型|算法|设计/.test(c.name); });
  var hasResult = bodyChs.some(function (c) { return /结果|实证|调研|案例|分析/.test(c.name); });
  var hasConclusion = bodyChs.some(function (c) { return /结论|对策|建议|展望|总结/.test(c.name); });
  var structCompleteness = [hasIntro, hasLit, hasMethod, hasResult, hasConclusion].filter(Boolean).length;
  var figCount = (text.match(/图\s*\d+/g) || []).length;
  var secCount = 0;
  bodyChs.forEach(function (c) {
    (c.sections || []).forEach(function (sc) {
      secCount++;
      if (sc.subs) secCount += sc.subs.length;
    });
  });
  var g = gradeMeta(rev.composite);
  return {
    composite: rev.composite,
    grade: g.grade,
    gradeLabel: g.label,
    gradeTone: g.tone,
    dims: dims,
    totalChars: totalChars,
    chapters: bodyChs.length,
    sections: secCount,
    totalRefs: rl.length,
    cnRefs: cnRefs,
    enRefs: enRefs,
    recentRefs: recentRefs,
    doiRate: rl.length ? Math.round(doiRefs / rl.length * 100) : 0,
    methods: methods,
    avgSentLen: avgSentLen,
    passiveDens: Math.round((text.match(/被/g) || []).length / Math.max(1, totalChars / 1000)),
    structCompleteness: structCompleteness,
    figCount: figCount,
    enRate: rl.length ? Math.round(enRefs / rl.length * 100) : 0,
    recentRate: rl.length ? Math.round(recentRefs / rl.length * 100) : 0,
    bodyChs: bodyChs,
    review: rev
  };
}

function buildDimInsight(dim) {
  var auto = (dim.subItems || []).filter(function (item) { return item.auto; });
  var manual = (dim.subItems || []).filter(function (item) { return !item.auto; });
  var strengths = auto.filter(function (item) { return item.s == null || item.s >= 65; });
  var weaknesses = auto.filter(function (item) { return item.s != null && item.s < 65; });
  return {
    strengths: strengths,
    weaknesses: weaknesses,
    manual: manual,
    summary: weaknesses.length
      ? weaknesses[0].d
      : (strengths.length ? ('当前优势：' + strengths[0].d) : '暂无自动证据，可结合人工复核项判断。')
  };
}

function getPriorityActions(s) {
  return s.dims
    .map(function (dim) {
      var insight = buildDimInsight(dim);
      var gap = Math.max(0, 70 - dim.score);
      return {
        dim: dim,
        impact: gap * dim.weight,
        reason: insight.summary,
        module: dim.modules[0]
      };
    })
    .filter(function (item) { return item.dim.score < 70; })
    .sort(function (a, b) { return b.impact - a.impact; })
    .slice(0, 5);
}

function boardSummary(s) {
  var weak = s.dims.filter(function (d) { return d.score < 70; }).sort(function (a, b) { return a.score - b.score; }).slice(0, 2);
  if (!weak.length) return '各维度较均衡，可继续在各模块精修细节。';
  return '短板主要在' + weak.map(function (d) { return d.label + '（' + d.score + '）'; }).join('、') + '，优先用平台对应模块补强。';
}

function signalRow(label, value, tone) {
  return '<div class="thesis-board-signal"><span>' + escBoard(label) + '</span><strong class="tone-' + tone + '">' + escBoard(value) + '</strong></div>';
}

function moduleButtons(modules) {
  return (modules || []).map(function (mod) {
    return '<button type="button" class="thesis-board-action" data-board-module="' + escBoard(mod.id) + '">' + escBoard(mod.name) + '</button>';
  }).join('');
}

function buildDashboardHTML() {
  var s = computeAllScores();
  if (!s) {
    return '<div class="thesis-board-error">暂无评估数据，请先上传并解析论文正文。</div>';
  }
  window._dbScores = s;
  window._dbBodyChs = s.bodyChs;
  var actions = getPriorityActions(s);
  var h = '';
  h += '<div class="thesis-board">';
  h += '<aside class="thesis-board-side">';
  h += '<section class="thesis-board-card thesis-board-score">';
  h += '<div class="thesis-board-score-value tone-' + s.gradeTone + '">' + s.composite + '</div>';
  h += '<div class="thesis-board-score-meta"><span class="thesis-board-grade tone-' + s.gradeTone + '">' + s.grade + ' 级 · ' + s.gradeLabel + '</span><p>' + escBoard(boardSummary(s)) + '</p></div>';
  h += '<details class="thesis-board-formula"><summary>评分权重</summary><p>选题 10% · 文献 15% · 框架 15% · 方法 10% · 论证 15% · 结论 10% · 创新 5% · 写作 8% · 格式 5% · 实践 7%</p></details>';
  h += '</section>';
  h += '<section class="thesis-board-card"><div class="thesis-board-card-title">十维雷达</div><canvas id="dbRadar" class="thesis-board-canvas radar"></canvas></section>';
  h += '<section class="thesis-board-card"><div class="thesis-board-card-title">关键信号</div><div class="thesis-board-signals">';
  h += signalRow('总字数', Math.round(s.totalChars / 1000) + 'k 字', s.totalChars > 30000 ? 'ok' : (s.totalChars > 15000 ? 'info' : 'warn'));
  h += signalRow('正文章节', s.chapters + ' 章', s.chapters >= 5 ? 'ok' : (s.chapters >= 3 ? 'info' : 'bad'));
  h += signalRow('参考文献', s.totalRefs + ' 条', s.totalRefs >= 30 ? 'ok' : (s.totalRefs >= 15 ? 'info' : 'bad'));
  h += signalRow('中外比例', '中 ' + s.cnRefs + ' / 英 ' + s.enRefs, s.enRate >= 30 ? 'ok' : (s.enRate >= 15 ? 'warn' : 'bad'));
  h += signalRow('近五年文献', s.recentRate + '%', s.recentRate >= 50 ? 'ok' : (s.recentRate >= 30 ? 'warn' : 'bad'));
  h += signalRow('DOI 覆盖率', s.doiRate + '%', s.doiRate >= 50 ? 'ok' : (s.doiRate >= 30 ? 'warn' : 'bad'));
  h += signalRow('结构完整度', s.structCompleteness + '/5', s.structCompleteness >= 4 ? 'ok' : (s.structCompleteness >= 3 ? 'warn' : 'bad'));
  h += signalRow('平均句长', s.avgSentLen + ' 字', s.avgSentLen <= 35 ? 'ok' : (s.avgSentLen <= 50 ? 'warn' : 'bad'));
  h += '</div></section>';
  h += '<section class="thesis-board-card"><div class="thesis-board-card-title">章节字数</div><canvas id="dbChapter" class="thesis-board-canvas chapter"></canvas></section>';
  h += '<section class="thesis-board-card" id="dbLitPieHost"><div class="thesis-board-card-title">文献构成</div><canvas id="dbLitPieCanvas" class="thesis-board-canvas pie"></canvas><div class="thesis-board-legend"><span>中文 ' + s.cnRefs + '</span><span>英文 ' + s.enRefs + '</span><span>近5年 ' + s.recentRate + '%</span></div></section>';
  h += '</aside>';

  h += '<div class="thesis-board-main">';
  h += '<section class="thesis-board-card"><div class="thesis-board-card-title">十维概览</div><div class="thesis-board-grid">';
  s.dims.forEach(function (dim, idx) {
    h += '<button type="button" class="thesis-board-dim tone-' + scoreTone(dim.score) + '" data-board-scroll="dim-' + idx + '">';
    h += '<strong>' + dim.score + '</strong><span>' + escBoard(dim.label) + '</span><em>' + scoreLevel(dim.score) + '</em>';
    h += '</button>';
  });
  h += '</div></section>';

  h += '<section class="thesis-board-card"><div class="thesis-board-card-title">优先行动</div>';
  if (!actions.length) {
    h += '<div class="thesis-board-empty">各维度均达到良好线，可在校对、格式和文献工作台继续精修。</div>';
  } else {
    h += '<div class="thesis-board-actions-list">';
    actions.forEach(function (item, i) {
      h += '<article class="thesis-board-action-item">';
      h += '<header><span>' + (i + 1) + '. ' + escBoard(item.dim.label) + '</span><strong class="tone-' + scoreTone(item.dim.score) + '">' + item.dim.score + '</strong></header>';
      h += '<p>' + escBoard(item.reason) + '</p>';
      h += '<div class="thesis-board-action-row">' + moduleButtons([item.module]) + '<span class="thesis-board-impact">权重影响约 ' + Math.round(item.impact) + '</span></div>';
      h += '</article>';
    });
    h += '</div>';
  }
  h += '</section>';

  h += '<section class="thesis-board-card"><div class="thesis-board-card-title">维度详解</div><div class="thesis-board-details">';
  s.dims.forEach(function (dim, idx) {
    var insight = buildDimInsight(dim);
    h += '<details class="thesis-board-detail" id="dim-' + idx + '"' + (idx === 0 || dim.score < 70 ? ' open' : '') + '>';
    h += '<summary><span>' + escBoard(dim.label) + '</span><strong class="tone-' + scoreTone(dim.score) + '">' + dim.score + ' · ' + scoreLevel(dim.score) + '</strong></summary>';
    h += '<div class="thesis-board-detail-body">';
    h += '<p class="thesis-board-detail-summary">' + escBoard(insight.summary) + '</p>';
    if (insight.weaknesses.length) {
      h += '<div class="thesis-board-block"><h5>为什么偏低</h5><ul>' + insight.weaknesses.map(function (item) {
        return '<li><b>' + escBoard(item.t) + '</b> ' + escBoard(item.d) + '</li>';
      }).join('') + '</ul></div>';
    }
    if (insight.strengths.length) {
      h += '<div class="thesis-board-block"><h5>为什么不低 / 已满足</h5><ul>' + insight.strengths.map(function (item) {
        return '<li><b>' + escBoard(item.t) + '</b> ' + escBoard(item.d) + '</li>';
      }).join('') + '</ul></div>';
    }
    if (insight.manual.length) {
      h += '<div class="thesis-board-block muted"><h5>仍需人工复核</h5><ul>' + insight.manual.map(function (item) {
        return '<li><b>' + escBoard(item.t) + '</b> ' + escBoard(item.d) + '</li>';
      }).join('') + '</ul></div>';
    }
    h += '<div class="thesis-board-action-row">' + moduleButtons(dim.modules) + '</div>';
    h += '</div></details>';
  });
  h += '</div></section>';
  h += '</div></div>';
  return h;
}

function openBoardModule(moduleId) {
  closeDashboard();
  if (moduleId === 'references') {
    if (window.LiteratureWorkbench && typeof LiteratureWorkbench.open === 'function') {
      LiteratureWorkbench.open({ mode: 'imported' });
      return;
    }
    if (typeof switchModule === 'function') switchModule('references');
    return;
  }
  if (typeof MODULE_RUNNERS !== 'undefined' && MODULE_RUNNERS[moduleId] && typeof window[MODULE_RUNNERS[moduleId]] === 'function') {
    if (typeof switchModule === 'function') switchModule(moduleId);
    window[MODULE_RUNNERS[moduleId]]();
    return;
  }
  if (typeof switchModule === 'function') switchModule(moduleId);
}

function bindDashboardActions(root) {
  if (!root) return;
  root.querySelectorAll('[data-board-module]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openBoardModule(btn.getAttribute('data-board-module'));
    });
  });
  root.querySelectorAll('[data-board-scroll]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-board-scroll'));
      if (target) {
        if (target.tagName === 'DETAILS') target.open = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function drawRadarChart() {
  var canvas = document.getElementById('dbRadar');
  if (!canvas || !window._dbScores) return;
  var s = window._dbScores;
  var theme = boardThemeColors();
  var dims = s.dims.map(function (d) { return { name: d.label.slice(0, 2), score: d.score }; });
  var ctx = canvas.getContext('2d');
  var w = Math.max(240, (canvas.parentElement.clientWidth || 280) - 24);
  var h = 220;
  canvas.width = w;
  canvas.height = h;
  var cx = w / 2, cy = h / 2, n = dims.length, maxR = Math.min(w, h) / 2 - 28;
  ctx.clearRect(0, 0, w, h);
  for (var g = 1; g <= 4; g++) {
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var a = (Math.PI * 2 / n) * i - Math.PI / 2;
      var rx = cx + maxR * g / 4 * Math.cos(a), ry = cy + maxR * g / 4 * Math.sin(a);
      i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (var j = 0; j < n; j++) {
    var a2 = (Math.PI * 2 / n) * j - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + maxR * Math.cos(a2), cy + maxR * Math.sin(a2));
    ctx.strokeStyle = theme.border;
    ctx.stroke();
  }
  ctx.beginPath();
  for (var k = 0; k <= n; k++) {
    var idx = k % n, a3 = (Math.PI * 2 / n) * idx - Math.PI / 2;
    var rv = dims[idx].score / 100 * maxR;
    var px = cx + rv * Math.cos(a3), py = cy + rv * Math.sin(a3);
    k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(99,102,241,0.12)';
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = '11px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.text;
  for (var m = 0; m < n; m++) {
    var a4 = (Math.PI * 2 / n) * m - Math.PI / 2;
    ctx.fillText(dims[m].name + ' ' + dims[m].score, cx + (maxR + 16) * Math.cos(a4), cy + (maxR + 16) * Math.sin(a4));
  }
}

function drawChapterChart() {
  var canvas = document.getElementById('dbChapter');
  if (!canvas || !window._dbBodyChs) return;
  var bodyChs = window._dbBodyChs;
  var theme = boardThemeColors();
  var tc = manuscriptText ? manuscriptText.length : 1;
  var w = Math.max(220, (canvas.parentElement.clientWidth || 280) - 24);
  var h = 110;
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (!bodyChs.length) return;
  var barCnt = bodyChs.length, bg = 12, bw = (w - bg * (barCnt + 1)) / barCnt;
  var colors = [theme.accent, theme.success, theme.info, theme.warning, theme.danger, '#8b5cf6', '#06b6d4', '#f97316'];
  var maxPct = 0;
  bodyChs.forEach(function (c) { var p = (c.text || '').length / tc * 100; if (p > maxPct) maxPct = p; });
  bodyChs.forEach(function (cs, i) {
    var pct = (cs.text || '').length / tc * 100;
    var bh = (pct / Math.max(1, maxPct)) * (h - 28);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(bg + i * (bw + bg), h - bh - 12, bw, bh);
    ctx.fillStyle = theme.text;
    ctx.font = '10px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(pct) + '%', bg + i * (bw + bg) + bw / 2, h - bh - 16);
    ctx.fillStyle = theme.muted;
    ctx.fillText((cs.name || '').replace('第', '').substring(0, 4), bg + i * (bw + bg) + bw / 2, h - 2);
  });
}

function drawLitPie() {
  var s = window._dbScores;
  var canvas = document.getElementById('dbLitPieCanvas');
  if (!s || !s.totalRefs || !canvas) return;
  var theme = boardThemeColors();
  var ctx = canvas.getContext('2d');
  var W = canvas.width = Math.max(220, (canvas.parentElement.clientWidth || 260) - 24);
  var H = canvas.height = 150;
  var cx = 70, cy = H / 2, r = 48;
  var total = Math.max(1, s.totalRefs);
  var slices = [{ v: s.cnRefs, c: theme.accent }, { v: s.enRefs, c: theme.info }];
  var start = -Math.PI / 2;
  slices.forEach(function (sl) {
    var ang = (sl.v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + ang);
    ctx.closePath();
    ctx.fillStyle = sl.c;
    ctx.fill();
    start += ang;
  });
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = theme.card;
  ctx.fill();
  ctx.fillStyle = theme.text;
  ctx.font = 'bold 14px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(s.totalRefs), cx, cy + 1);
  ctx.font = '10px system-ui,sans-serif';
  ctx.fillStyle = theme.muted;
  ctx.fillText('总文献', cx, cy + 16);
}

function exportDashboardReport() {
  var s = window._dbScores || computeAllScores();
  if (!s) { alert('请先打开论文看板生成评估数据'); return; }
  var lines = [];
  lines.push('论文搭子 ThesisBuddy — 论文评估报告');
  lines.push('生成时间: ' + new Date().toLocaleString());
  lines.push('');
  lines.push('=== 综合评分 ===');
  lines.push('总分: ' + s.composite + ' / 100');
  lines.push('等级: ' + s.grade + '（' + s.gradeLabel + '）');
  lines.push('摘要: ' + boardSummary(s));
  lines.push('权重: 选题10% 文献15% 框架15% 方法10% 论证15% 结论10% 创新5% 写作8% 格式5% 实践7%');
  lines.push('');
  lines.push('=== 十维得分与证据 ===');
  s.dims.forEach(function (dim) {
    var insight = buildDimInsight(dim);
    lines.push(dim.label + ': ' + dim.score + ' — ' + insight.summary);
  });
  lines.push('');
  lines.push('=== 优先行动 ===');
  var actions = getPriorityActions(s);
  if (!actions.length) lines.push('整体质量良好，建议继续精修细节');
  actions.forEach(function (item, i) {
    lines.push((i + 1) + '. ' + item.dim.label + '（' + item.dim.score + '）→ ' + item.module.name + '：' + item.reason);
  });
  lines.push('');
  lines.push('=== 基础统计 ===');
  lines.push('总字数: ' + Math.round(s.totalChars / 1000) + 'k');
  lines.push('正文章节: ' + s.chapters + ' · 小节: ' + s.sections);
  lines.push('参考文献: ' + s.totalRefs + '（中文 ' + s.cnRefs + ' / 英文 ' + s.enRefs + '）');
  lines.push('近五年文献: ' + s.recentRate + '% · DOI: ' + s.doiRate + '%');
  lines.push('研究方法: ' + (s.methods.length ? s.methods.join('、') : '未检测到'));
  var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '论文评估报告.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

window.showDashboard = showDashboard;
window.closeDashboard = closeDashboard;
window.exportDashboardReport = exportDashboardReport;
window.computeAllScores = computeAllScores;
