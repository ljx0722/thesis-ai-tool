/**
 * 学术论文AI一站式助手 — 十维论文评审体系
 * 覆盖选题/文献/框架/方法/论证/结论/创新/写作/格式/实践价值
 * 可直接用作评阅意见、开题评议、答辩评语参考
 */
var thesisReview = null;

function computeThesisReview() {
  var text = manuscriptText || '';
  var secs = sections || [];
  var bodyChs = secs.filter(function(s) { return !/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name); });
  var rl = (typeof mergedRefs !== 'undefined' && mergedRefs.length) ? mergedRefs : (typeof existingRefs !== 'undefined' ? existingRefs : []);
  var totalChars = text.length;
  var cnRefs = rl.filter(function(r) { return /[一-鿿]/.test((r.title || r.ci || '').substring(0, 5)); }).length;
  var enRefs = rl.length - cnRefs;
  var recentRefs = rl.filter(function(r) { var y = parseInt(r.year) || 0; return y >= (new Date().getFullYear() - 5); }).length;
  var doiRefs = rl.filter(function(r) { return r.doi && r.doi.length > 5; }).length;

  // ====== 一、选题与研究价值 (0-100) ======
  var dim1 = { score: 65, label: '选题价值', subItems: [] };
  if (bodyChs.length >= 3) dim1.score += 5; else dim1.subItems.push({ t: '⚠ 研究范围', d: '论文章节少于3章，研究范围可能过窄', s: 50, auto: true });
  if (totalChars > 20000) dim1.score += 5; else dim1.subItems.push({ t: '⚠ 篇幅不足', d: '全文少于20k字，可能无法充分展开研究', s: 50, auto: true });
  if (totalChars > 40000) dim1.score += 8; else dim1.subItems.push({ t: '📝 篇幅', d: '建议充实研究内容，达到专业硕士论文最低篇幅要求', s: 60, auto: true });
  if (bodyChs.length >= 5) dim1.score += 5;
  // Title check
  var title = (bodyChs[0] && bodyChs[0].name) || '';
  if (title.length > 30) dim1.subItems.push({ t: '⚠ 题目', d: '标题偏长(' + title.length + '字)，建议精简至25字以内', s: 60, auto: true });
  else if (title.length > 5) dim1.score += 5;
  dim1.subItems.push({ t: '题目评估', d: '需要人工判断：是否贴合专业培养目标、学科研究方向；题目宽窄是否适配', s: null, auto: false });
  dim1.subItems.push({ t: '价值评估', d: '需要人工判断：现实应用价值、理论学术价值、时代/政策契合性', s: null, auto: false });
  dim1.score = Math.max(0, Math.min(100, dim1.score));

  // ====== 二、文献综述与理论基础 (0-100) ======
  var dim2 = { score: 45, label: '文献综述', subItems: [] };
  if (rl.length >= 40) dim2.score += 20; else if (rl.length >= 20) dim2.score += 10; else dim2.subItems.push({ t: '❌ 文献量', d: '文献总量仅' + rl.length + '条，远低于硕士论文要求(40+条)', s: 20, auto: true });
  if (enRefs / Math.max(1, rl.length) >= 0.3) dim2.score += 10; else dim2.subItems.push({ t: '⚠ 外文', d: '外文文献占比' + Math.round(enRefs/Math.max(1,rl.length)*100) + '%，建议≥30%', s: 40, auto: true });
  if (recentRefs / Math.max(1, rl.length) >= 0.5) dim2.score += 10; else dim2.subItems.push({ t: '⚠ 前沿性', d: '近五年文献占比' + Math.round(recentRefs/Math.max(1,rl.length)*100) + '%(<50%)，建议补充最新研究', s: 45, auto: true });
  if (doiRefs / Math.max(1, rl.length) >= 0.4) dim2.score += 5;
  // Check for core journals
  var coreJournals = 0; rl.forEach(function(r) { var j = (r.journal || '').toLowerCase(); if (/学报|研究|科学|nature|science|ieee|acm|springer|elsevier/.test(j)) coreJournals++; });
  if (coreJournals >= 5) dim2.score += 8;
  dim2.subItems.push({ t: '文献评述', d: '需要人工判断：是否按理论流派/时间线梳理、有无对比归纳、是否指出研究缺口', s: null, auto: false });
  dim2.subItems.push({ t: '理论支撑', d: '需要人工判断：选用理论是否适配、是否全文贯穿运用', s: null, auto: false });
  dim2.score = Math.max(0, Math.min(100, dim2.score));

  // ====== 三、研究内容与框架 (0-100) ======
  var dim3 = { score: 60, label: '框架结构', subItems: [] };
  if (bodyChs.length >= 5) dim3.score += 12; else if (bodyChs.length >= 4) dim3.score += 5;
  // Chapter balance check
  if (bodyChs.length >= 2) {
    var lens = bodyChs.map(function(c) { return (c.text || '').length; });
    var avg = lens.reduce(function(a,b){return a+b;},0) / lens.length;
    var maxDev = 0; lens.forEach(function(l) { var dev = Math.abs(l - avg) / avg; if (dev > maxDev) maxDev = dev; });
    if (maxDev < 0.5) dim3.score += 10; else dim3.subItems.push({ t: '⚠ 章节均衡', d: '各章篇幅差异较大(max=' + Math.round(maxDev*100) + '%)，建议调整', s: 55, auto: true });
  }
  // Check for standard structure
  var hasIntro = bodyChs.some(function(c) { return /绪论|引言|前言/.test(c.name); });
  var hasLit = bodyChs.some(function(c) { return /文献|综述|理论|基础/.test(c.name); });
  var hasMethod = bodyChs.some(function(c) { return /方法|模型|算法|设计|技术/.test(c.name); });
  var hasResult = bodyChs.some(function(c) { return /结果|实证|调研|案例|分析|实验/.test(c.name); });
  var hasConclusion = bodyChs.some(function(c) { return /结论|对策|建议|展望|总结/.test(c.name); });
  if (hasIntro && hasLit && hasMethod && hasResult && hasConclusion) dim3.score += 15;
  else {
    if (!hasIntro) dim3.subItems.push({ t: '❌ 缺失', d: '未检测到绪论/引言章', s: 30, auto: true });
    if (!hasLit) dim3.subItems.push({ t: '⚠ 缺失', d: '未检测到文献综述/理论基础章', s: 40, auto: true });
    if (!hasMethod) dim3.subItems.push({ t: '⚠ 缺失', d: '未检测到研究方法/设计章', s: 40, auto: true });
    if (!hasResult) dim3.subItems.push({ t: '❌ 缺失', d: '未检测到实证/分析/调研章', s: 25, auto: true });
    if (!hasConclusion) dim3.subItems.push({ t: '❌ 缺失', d: '未检测到结论/对策章', s: 25, auto: true });
  }
  dim3.subItems.push({ t: '逻辑递进', d: '需要人工判断：提出问题→分析问题→解决问题闭环是否完整', s: null, auto: false });
  dim3.subItems.push({ t: '标题规范', d: '需要人工判断：标题层级是否统一、口语化程度、标题与正文一致性', s: null, auto: false });
  dim3.score = Math.max(0, Math.min(100, dim3.score));

  // ====== 四、研究方法 (0-100) ======
  var dim4 = { score: 55, label: '研究方法', subItems: [] };
  var methods = [];
  if (/问卷|调查|Interview|访谈/.test(text)) methods.push('调研类');
  if (/回归|因子|熵值|SWOT|PEST|博弈|统计分析|SPSS|Stata/.test(text)) methods.push('量化实证');
  if (/案例|case study/.test(text.toLowerCase())) methods.push('案例法');
  if (/实验|仿真|模拟|样机|测试/.test(text)) methods.push('实验/仿真');
  if (/文献研究|规范分析|比较研究|比较法/.test(text)) methods.push('理论分析');
  if (/文本分析|话语分析|历史分析/.test(text)) methods.push('文本分析');
  if (methods.length >= 3) dim4.score += 15; else if (methods.length >= 2) dim4.score += 8;
  if (methods.length === 0) dim4.subItems.push({ t: '❌ 方法', d: '未检测到明确的研究方法，建议在绪论或专门章节说明', s: 25, auto: true });
  else dim4.subItems.push({ t: '检测方法', d: '自动检测到：' + methods.join('、'), s: 70, auto: true });
  var hasTechRoute = /技术路线|研究思路|研究路径|flowchart|流程图|框架图/.test(text);
  if (hasTechRoute) dim4.score += 10;
  var hasDataDesc = /样本|数据来源|数据处理|问卷设计/.test(text);
  if (hasDataDesc) dim4.score += 5;
  dim4.subItems.push({ t: '方法适配', d: '需要人工判断：方法是否适配研究问题、操作步骤是否完整', s: null, auto: false });
  dim4.subItems.push({ t: '重难点', d: '需要人工判断：是否明确研究重点与难点、全文是否围绕重难点展开', s: null, auto: false });
  dim4.score = Math.max(0, Math.min(100, dim4.score));

  // ====== 五、论证与实证材料 (0-100) ======
  var dim5 = { score: 50, label: '内容论证', subItems: [] };
  var hasData = /数据|统计|百分比|增长率|均值|标准差/.test(text);
  var hasChart = (text.match(/图\s*\d+/g) || []).length >= 3;
  var hasTable = (text.match(/表\s*\d+/g) || []).length >= 3;
  if (hasData) dim5.score += 10; else dim5.subItems.push({ t: '⚠ 数据', d: '未检测到数据支撑，论证可能偏虚空', s: 45, auto: true });
  if (hasChart || hasTable) dim5.score += 10; else dim5.subItems.push({ t: '⚠ 图表', d: '图表偏少，建议增加图表直观呈现数据', s: 50, auto: true });
  var dataSources = /统计局|年鉴|年报|数据库|调查|官方/.test(text);
  if (dataSources) dim5.score += 8;
  var caseCount = (text.match(/案例|公司|企业|集团|有限公司/g) || []).length;
  if (caseCount >= 5) dim5.score += 10;
  dim5.subItems.push({ t: '论证逻辑', d: '需要人工判断：论点论据论证是否统一、因果分析是否合理', s: null, auto: false });
  dim5.subItems.push({ t: '案例代表性', d: '需要人工判断：选取案例是否典型、是否有普遍参考意义', s: null, auto: false });
  dim5.score = Math.max(0, Math.min(100, dim5.score));

  // ====== 六、结论与展望 (0-100) ======
  var dim6 = { score: 55, label: '结论展望', subItems: [] };
  if (hasConclusion) dim6.score += 15; else dim6.subItems.push({ t: '❌ 结论', d: '未检测到独立的结论/对策章', s: 20, auto: true });
  var hasLimitation = /不足|局限|缺陷|待改进/.test(text);
  if (hasLimitation) dim6.score += 10;
  var hasFuture = /展望|后续|未来|进一步/.test(text);
  if (hasFuture) dim6.score += 8;
  var conclusionCh = bodyChs[bodyChs.length - 1];
  if (conclusionCh && (conclusionCh.text || '').length / Math.max(1, totalChars) < 0.03) dim6.subItems.push({ t: '⚠ 结论篇幅', d: '结论章过短(<3%)，建议充实总结要点', s: 50, auto: true });
  dim6.subItems.push({ t: '对策针对性', d: '需要人工判断：是否一一对应前文问题、是否分层清晰', s: null, auto: false });
  dim6.subItems.push({ t: '局限客观性', d: '需要人工判断：是否诚实说明不足而非回避', s: null, auto: false });
  dim6.score = Math.max(0, Math.min(100, dim6.score));

  // ====== 七、创新点 (0-100) ======
  var dim7 = { score: 40, label: '创新性', subItems: [] };
  var innovationKeywords = /首次|创新|新颖|独特|首创|改进|优化|新方法|新模型|新视角|新框架/.test(text);
  if (innovationKeywords) dim7.score += 10;
  if (methods.length >= 3) dim7.score += 8;
  if (enRefs >= 20) dim7.score += 5; // International horizon suggests innovation potential
  dim7.subItems.push({ t: '创新评估', d: '需要人工判断：理论/视角/方法/实践/对象创新是否真实存在', s: null, auto: false });
  dim7.subItems.push({ t: '创新力度', d: '需要人工判断：创新是实质性突破还是微调、是否夸大', s: null, auto: false });
  dim7.score = Math.max(0, Math.min(100, dim7.score));

  // ====== 八、学术写作与表达 (0-100) ======
  var dim8 = { score: 60, label: '学术写作', subItems: [] };
  var avgSentLen = 35;
  var box = document.getElementById('thesisBox');
  if (box) {
    var paras = box.querySelectorAll('p');
    var tc = 0, ts = 0;
    for (var pi = 0; pi < Math.min(paras.length, 150); pi++) {
      var pt = (paras[pi].textContent || '').trim();
      if (pt.length < 10) continue;
      var sents = pt.split(/[。！？\.\?\!]/).filter(function(s){return s.trim().length>0;});
      tc += pt.length; ts += sents.length;
    }
    avgSentLen = ts > 0 ? Math.round(tc / ts) : 35;
  }
  if (avgSentLen < 35) dim8.score += 12; else if (avgSentLen < 50) dim8.score += 5;
  else dim8.subItems.push({ t: '⚠ 句长', d: '平均句长' + avgSentLen + '字(偏高)，建议拆分长句', s: 50, auto: true });
  var passiveDensity = Math.round((text.match(/被/g) || []).length / Math.max(1, totalChars/1000));
  if (passiveDensity < 8) dim8.score += 5;
  var oralWords = /很|挺|太|非常|特别|有点|大概|差不多|可能吧/.test(text);
  if (!oralWords) dim8.score += 5;
  dim8.subItems.push({ t: '语言质量', d: '需要人工判断：学术书面化程度、专业术语准确性、段落逻辑', s: null, auto: false });
  dim8.score = Math.max(0, Math.min(100, dim8.score));

  // ====== 九、格式规范 (0-100) ======
  var dim9 = { score: 70, label: '格式规范', subItems: [] };
  if (doiRefs / Math.max(1, rl.length) >= 0.5) dim9.score += 8; else dim9.subItems.push({ t: '⚠ DOI', d: 'DOI覆盖率' + Math.round(doiRefs/Math.max(1,rl.length)*100) + '%(<50%)，GB/T 7714 格式可能不完整', s: 55, auto: true });
  dim9.subItems.push({ t: '排版规范', d: '需要人工判断：字体/行距/页边距/页码/页眉是否符合学校模板', s: null, auto: false });
  dim9.subItems.push({ t: '重复率', d: '需要人工判断：查重率是否符合院校标准，无大面积抄袭拼接', s: null, auto: false });
  dim9.score = Math.max(0, Math.min(100, dim9.score));

  // ====== 十、实践价值与综合能力 (0-100) ======
  var dim10 = { score: 55, label: '实践价值', subItems: [] };
  var practicalWords = /实践|应用|落地|实施|方案|对策|建议|行业|企业|产业/.test(text);
  if (practicalWords) dim10.score += 10;
  var industryWords = /企业|公司|集团|行业|产业|市场/.test(text);
  if (industryWords) dim10.score += 8;
  dim10.subItems.push({ t: '实践价值', d: '需要人工判断：是否有实际行业/企业/政策应用场景，落地可行性', s: null, auto: false });
  dim10.subItems.push({ t: '综合能力', d: '需要人工判断：专业知识掌握程度、独立研究能力、逻辑思维水平', s: null, auto: false });
  dim10.subItems.push({ t: '治学态度', d: '需要人工判断：论文完整度、是否认真打磨、工作量是否饱满', s: null, auto: false });
  dim10.score = Math.max(0, Math.min(100, dim10.score));

  // ====== COMPOSITE ======
  var composite = Math.round(
    dim1.score * 0.10 + dim2.score * 0.15 + dim3.score * 0.15 +
    dim4.score * 0.10 + dim5.score * 0.15 + dim6.score * 0.10 +
    dim7.score * 0.05 + dim8.score * 0.08 + dim9.score * 0.05 + dim10.score * 0.07
  );

  // Auto-only items
  var autoItems = 0, manualItems = 0;
  [dim1,dim2,dim3,dim4,dim5,dim6,dim7,dim8,dim9,dim10].forEach(function(d) {
    d.subItems.forEach(function(s) { if (s.auto) autoItems++; else manualItems++; });
  });

  thesisReview = {
    composite: composite,
    dimensions: [dim1, dim2, dim3, dim4, dim5, dim6, dim7, dim8, dim9, dim10],
    stats: { totalChars: totalChars, chapters: bodyChs.length, refs: rl.length,
      cnRefs: cnRefs, enRefs: enRefs, recentRefs: recentRefs, doiRefs: doiRefs,
      methods: methods, avgSentLen: avgSentLen, titles: secs.length,
      autoItems: autoItems, manualItems: manualItems },
    timestamp: new Date().toLocaleString()
  };
  return thesisReview;
}

// ====== Generate review report HTML ======
function renderReviewReport() {
  var rev = computeThesisReview();
  if (!rev) return '<div style="text-align:center;padding:40px;color:#86868b">暂无数据，请先上传论文</div>';

  var h = '<div class="module-panel">';

  // Header
  h += '<div style="text-align:center;margin-bottom:20px">';
  h += '<div style="font-size:1.3rem;font-weight:700;color:#1d1d1f">📋 论文评审报告</div>';
  h += '<div style="font-size:.7rem;color:#86868b">自动化评审 · ' + rev.stats.autoItems + ' 项自动检测 + ' + rev.stats.manualItems + ' 项需人工评判 · ' + rev.timestamp + '</div>';
  h += '<div style="margin-top:10px;font-size:.9rem;font-weight:800;color:#0071e3">综合评分 ' + rev.composite + '/100</div>';
  h += '</div>';

  // Summary stats
  h += '<div class="dash-row" style="margin-bottom:16px">';
  h += '<div class="dash-item"><div class="dv">' + Math.round(rev.stats.totalChars/1000) + 'k</div><div class="dl">总字数</div></div>';
  h += '<div class="dash-item"><div class="dv">' + rev.stats.refs + '</div><div class="dl">文献</div></div>';
  h += '<div class="dash-item"><div class="dv">' + rev.stats.cnRefs + '/' + rev.stats.enRefs + '</div><div class="dl">中/英</div></div>';
  h += '<div class="dash-item"><div class="dv">' + Math.round(rev.stats.recentRefs/Math.max(1,rev.stats.refs)*100) + '%</div><div class="dl">5年文献</div></div>';
  h += '<div class="dash-item"><div class="dv">' + rev.stats.methods.length + '</div><div class="dl">研究方法</div></div>';
  h += '</div>';

  // Each dimension
  rev.dimensions.forEach(function(dim, di) {
    var level = dim.score >= 80 ? '优秀' : (dim.score >= 65 ? '良好' : (dim.score >= 50 ? '中等' : '需改进'));
    var levelColor = dim.score >= 80 ? '#30d158' : (dim.score >= 65 ? '#0071e3' : (dim.score >= 50 ? '#ff9f0a' : '#ff3b30'));
    h += '<h4>' + (di+1) + '. ' + dim.label + ' <span style="font-size:.72rem;color:' + levelColor + ';font-weight:600">' + dim.score + '分 — ' + level + '</span></h4>';

    dim.subItems.forEach(function(item) {
      var icon = item.s >= 70 ? '✅' : (item.s >= 50 ? '⚠' : (item.s !== null ? '❌' : '📝'));
      var cls = item.s >= 70 ? 'ok' : (item.s >= 50 ? 'warn' : (item.s !== null ? 'err' : 'info'));
      var tag = item.auto ? '<span style="font-size:.55rem;background:#e5e7eb;color:#86868b;padding:1px 5px;border-radius:4px;margin-left:6px">自动</span>' : '<span style="font-size:.55rem;background:#ede9fe;color:#7c3aed;padding:1px 5px;border-radius:4px;margin-left:6px">人工</span>';
      h += '<div class="finding ' + cls + '">' + icon + ' <b>' + item.t + '</b>' + tag + '<br><span style="font-size:.7rem;color:#555">' + item.d + '</span></div>';
    });
  });

  // Bottom: dimensions bar chart
  h += '<h4>📊 维度得分分布</h4>';
  rev.dimensions.forEach(function(dim) {
    var barColor = dim.score >= 80 ? '#30d158' : (dim.score >= 65 ? '#0071e3' : (dim.score >= 50 ? '#ff9f0a' : '#ff3b30'));
    h += '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:.7rem">';
    h += '<span style="min-width:60px;font-weight:600;color:#1d1d1f">' + dim.label + '</span>';
    h += '<div class="bar-wrap"><div class="bar-fill" style="width:' + dim.score + '%;background:' + barColor + '"></div></div>';
    h += '<span style="font-weight:600;color:' + barColor + ';min-width:30px;text-align:right">' + dim.score + '</span>';
    h += '</div>';
  });

  h += '</div>';
  return h;
}

// ====== Generate review text (usable as 评阅意见) ======
function generateReviewText() {
  var rev = thesisReview || computeThesisReview();
  var lines = [];
  lines.push('═══════════════════════════════════════');
  lines.push('    论文评审意见（自动生成参考版本）');
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push('综合评分：' + rev.composite + '/100');
  lines.push('');

  var levels = { 80: '优秀', 65: '良好', 50: '中等', 0: '需改进' };
  rev.dimensions.forEach(function(dim, di) {
    var lv = Object.keys(levels).reverse().find(function(k) { return dim.score >= parseInt(k); });
    lines.push('【' + (di+1) + '. ' + dim.label + '】' + dim.score + '分 — ' + (levels[lv] || levels['0']));
    dim.subItems.filter(function(s) { return s.auto && s.s !== null; }).forEach(function(s) {
      lines.push('  ' + (s.s >= 70 ? '✓' : (s.s >= 50 ? '△' : '✗')) + ' ' + s.t + '：' + s.d);
    });
    lines.push('');
  });

  lines.push('注：标注"人工"的项目需由评审老师根据论文实际内容评判。');
  lines.push('本报告由学术论文AI一站式助手自动生成，仅供参考。');
  return lines.join('\n');
}

function copyReviewText() {
  var txt = generateReviewText();
  navigator.clipboard.writeText(txt);
  ttp('评审意见已复制');
}
