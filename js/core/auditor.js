/**
 * ThesisAuditor v2 — 5-reviewer academic review engine
 * Modeled on academic-research-skills' multi-perspective peer review:
 * EIC + Methodology + Domain + Perspective + Devil's Advocate
 */
(function(){
  'use strict';

  // ── 5-reviewer 配置 ──
  var REVIEWERS = {
    'eic': {
      name: '主编审阅 (EIC)',
      role: 'Editor-in-Chief',
      weight: 0.25,
      dimensions: ['originality', 'significance', 'structure', 'overall'],
      focus: '评估论文总体质量、原创性、学术贡献和发表潜力'
    },
    'methodology': {
      name: '方法审阅',
      role: 'Methodology Reviewer',
      weight: 0.20,
      dimensions: ['method_rigor', 'data_validity', 'conclusion_support', 'reproducibility'],
      focus: '研究设计严谨性、方法选择是否恰当、数据是否支持结论'
    },
    'domain': {
      name: '领域审阅',
      role: 'Domain Expert Reviewer',
      weight: 0.20,
      dimensions: ['lit_review', 'theoretical_grounding', 'field_positioning', 'technical_accuracy'],
      focus: '文献综述完整性、理论基础、在领域中的定位'
    },
    'perspective': {
      name: '交叉视角审阅',
      role: 'Cross-Disciplinary Reviewer',
      weight: 0.15,
      dimensions: ['interdisciplinarity', 'innovation', 'implications', 'applicability'],
      focus: '跨学科视角、创新性、理论与实践价值'
    },
    'devil': {
      name: '质疑审阅 (Devil\'s Advocate)',
      role: 'Devil\'s Advocate',
      weight: 0.20,
      dimensions: ['logic_gaps', 'counterarguments', 'overclaiming', 'weakness_identification'],
      focus: '挑战核心论点、寻找逻辑漏洞、识别过度声明'
    }
  };

  var _reviewResults = {};
  var _overallScore = 0;

  // ── 审阅维度检查规则 ──

  function _checkOriginality(text, secs) {
    var score = 60;
    var findings = [];
    // 新颖性关键词
    var novelKws = ['首次','创新','新颖','突破','开创','原创','率先','第一个','独有','首次提出'];
    var hits = novelKws.filter(function(k){ return text.indexOf(k) >= 0; });
    if (hits.length >= 3) { score += 20; findings.push('多项创新声明'); }
    else if (hits.length >= 1) { score += 10; findings.push('有创新元素'); }
    else { findings.push('新颖性表述需加强'); }

    // 研究空白声明
    if (/研究空白|尚未有|缺乏|不足|空白|unknown|gap|no prior/i.test(text)) { score += 15; findings.push('明确了研究空白'); }
    else { findings.push('建议明确研究空白'); score -= 5; }

    return { score: Math.min(100, score), findings: findings };
  }

  function _checkSignificance(text, secs) {
    var score = 60;
    var findings = [];
    // 意义声明
    if (/意义|贡献|价值|影响|significance|contribution|impact/i.test(text)) { score += 15; findings.push('阐述了研究意义'); }
    // 应用价值
    if (/实践|应用|政策|管理|industry|policy|application/i.test(text)) { score += 10; findings.push('有实践应用价值'); }
    // 理论价值
    if (/理论|framework|model|理论框架|模型/i.test(text)) { score += 10; findings.push('有理论贡献'); }
    return { score: Math.min(100, score), findings: findings };
  }

  function _checkStructure(text, secs) {
    var bodyChs = secs.filter(function(s){ return s.title && (typeof isBodyChapter==='function'?isBodyChapter(s):!/参考文献|致谢|附录/.test(s.title)); });
    var score = 50;
    var findings = [];
    if (bodyChs.length >= 6) { score += 20; findings.push('章节结构完整(≥6章)'); }
    else if (bodyChs.length >= 4) { score += 10; findings.push('章节结构良好(4-5章)'); }
    else { findings.push('章节较少，建议扩充'); }

    var hasIntro = bodyChs.some(function(c){return /绪论|引言|前言/.test(c.title);});
    var hasLit = bodyChs.some(function(c){return /文献|综述|理论|基础/.test(c.title);});
    var hasMethod = bodyChs.some(function(c){return /方法|模型|算法|设计/.test(c.title);});
    var hasResult = bodyChs.some(function(c){return /结果|实证|调研|案例|分析/.test(c.title);});
    var hasConc = bodyChs.some(function(c){return /结论|对策|建议|展望|总结/.test(c.title);});

    var completeness = [hasIntro, hasLit, hasMethod, hasResult, hasConc].filter(Boolean).length;
    if (completeness >= 5) { score += 20; findings.push('包含标准五段结构'); }
    else if (completeness >= 3) { score += 10; findings.push('结构基本完整('+completeness+'/5段)'); }
    else { score -= 10; findings.push('缺少核心章节，结构不完整'); }

    return { score: Math.min(100, score), findings: findings };
  }

  function _checkMethodRigor(text, secs) {
    var score = 55;
    var findings = [];
    // 研究方法声明
    if (/方法|methodology|研究设计|research design/i.test(text)) { score += 10; findings.push('研究方法声明'); }
    // 数据来源
    if (/数据|data|样本|sample|问卷|survey|访谈|interview/i.test(text)) { score += 15; findings.push('有数据/样本描述'); }
    else { findings.push('建议补充数据来源'); score -= 10; }
    // 分析方法
    if (/回归|regression|分析|analysis|统计|statistical|检验|test|模型/i.test(text)) { score += 15; findings.push('有分析方法说明'); }
    // 效度/信度
    if (/效度|信度|validity|reliability|Cronbach/i.test(text)) { score += 10; }
    return { score: Math.min(100, score), findings: findings };
  }

  function _checkLogicGaps(text, secs) {
    // Devil's Advocate: 找逻辑漏洞
    var score = 60;
    var findings = [];
    // 检查过度声明
    var overclaims = (text.match(/必然|一定|绝对|总是|必定|inevitable|certain|always|must/g)||[]).length;
    if (overclaims > 5) { score -= 15; findings.push('存在过多绝对性表述('+overclaims+'处)'); }
    // 检查因果关系声明
    if (/导致|引起|造成|因此|所以|cause|therefore|thus|hence/i.test(text)) { score -= 5; findings.push('注意因果关系表述是否经得起检验'); }
    // 检查局限性讨论
    if (/局限|不足|limitation|future work|未来研究/i.test(text)) { score += 15; findings.push('承认研究局限性'); }
    else { score -= 10; findings.push('建议补充研究局限性'); }

    return { score: Math.min(100, score), findings: findings };
  }

  function _checkAcademicTone(text) {
    var score = 70;
    var findings = [];
    // 写作质量检查
    var aiTerms = ['值得注意的是','不可否认','总而言之','由此可见','毋庸置疑','当然','显然','必须指出'];
    var aiHits = aiTerms.filter(function(k){ return text.indexOf(k) >= 0; });
    if (aiHits.length > 3) { score -= 10; findings.push('AI典型用语偏多('+aiHits.length+'处)，建议替换'); }
    // 破折号过度使用
    var emDashes = (text.match(/——|—/g)||[]).length;
    if (emDashes > 10) { score -= 5; findings.push('破折号使用偏多('+emDashes+'个)'); }
    // 段落长度均匀性
    var paras = text.split(/\n\n+/).filter(function(p){ return p.trim().length > 20; });
    if (paras.length > 5) {
      var lengths = paras.map(function(p){return p.length;});
      var avg = lengths.reduce(function(a,b){return a+b;},0)/lengths.length;
      var variance = lengths.reduce(function(a,b){return a+Math.pow(b-avg,2);},0)/lengths.length;
      if (variance < 10000) { findings.push('段落长度过于均匀，建议调整节奏'); score -= 5; }
    }

    return { score: Math.min(100, score), findings: findings };
  }

  // ── 运行完整审阅 ──
  function auditFull() {
    var text = typeof manuscriptText !== 'undefined' ? manuscriptText : '';
    var secs = typeof sections !== 'undefined' ? sections : [];
    var refs = typeof existingRefs !== 'undefined' && existingRefs.length ? existingRefs :
               (typeof mergedRefs !== 'undefined' && mergedRefs.length ? mergedRefs : []);

    if (!text || text.length < 100) {
      _reviewResults = { error: 'No thesis loaded', scores: {}, overall: 0 };
      return _reviewResults;
    }

    // EIC
    var eic = {
      originality: _checkOriginality(text, secs),
      significance: _checkSignificance(text, secs),
      structure: _checkStructure(text, secs),
      overall: (function(){
        var o = _checkOriginality(text, secs);
        var s = _checkSignificance(text, secs);
        var st = _checkStructure(text, secs);
        return { score: Math.round((o.score + s.score + st.score) / 3), findings: ['综合评估'] };
      })()
    };
    var eicScore = Math.round((eic.originality.score + eic.significance.score + eic.structure.score + eic.overall.score)/4);

    // Methodology
    var method = _checkMethodRigor(text, secs);
    var methodScore = method.score;

    // Domain (文献综述)
    var domainScore = 60;
    var refCount = refs.length;
    if (refCount >= 30) domainScore += 20;
    else if (refCount >= 15) domainScore += 10;
    if (refCount > 0) {
      var cnRefs = refs.filter(function(r){return /[一-鿿]/.test((r.title||r.ci||'').substring(0,5));}).length;
      if (cnRefs > 0 && (refCount-cnRefs) > 0 && cnRefs/refCount >= 0.3 && cnRefs/refCount <= 0.8) domainScore += 10;
    }

    // Perspective (交叉视角)
    var perspScore = 60;
    if (/交叉|cross[-\s]?disciplin|interdisciplin|多学科|跨领域/i.test(text)) perspScore += 15;
    if (/应用|industry|practice|实践|案例/i.test(text)) perspScore += 10;

    // Devil's Advocate
    var devil = _checkLogicGaps(text, secs);
    var devilScore = devil.score;

    // Writing quality
    var writing = _checkAcademicTone(text);
    var writingScore = writing.score;

    _reviewResults = {
      reviewers: {
        '主编审阅 (EIC)': { score: eicScore, weight: 0.25, detail: eic },
        '方法审阅': { score: methodScore, weight: 0.20, detail: method },
        '领域审阅': { score: domainScore, weight: 0.20 },
        '交叉视角审阅': { score: perspScore, weight: 0.15 },
        '质疑审阅 (Devil\'s Advocate)': { score: devilScore, weight: 0.20, detail: devil },
        '写作质量': { score: writingScore, weight: 0.10, detail: writing }
      },
      overall: 0,
      strengths: [],
      weaknesses: [],
      verdict: '',
      timestamp: new Date().toISOString()
    };

    // 计算加权总分
    var sumWeighted = 0, sumWeights = 0;
    Object.keys(_reviewResults.reviewers).forEach(function(k) {
      var r = _reviewResults.reviewers[k];
      sumWeighted += r.score * (r.weight || 0.1);
      sumWeights += (r.weight || 0.1);
    });
    _reviewResults.overall = Math.round(sumWeighted / Math.max(0.01, sumWeights));

    // 判定等级
    if (_reviewResults.overall >= 85) _reviewResults.verdict = '优秀 — 建议直接投稿';
    else if (_reviewResults.overall >= 70) _reviewResults.verdict = '良好 — 经修改后可以投稿';
    else if (_reviewResults.overall >= 55) _reviewResults.verdict = '需大幅修改';
    else _reviewResults.verdict = '建议重构后再审';

    // 强弱项
    var sorted = Object.keys(_reviewResults.reviewers).sort(function(a,b){
      return _reviewResults.reviewers[b].score - _reviewResults.reviewers[a].score;
    });
    if (sorted.length >= 2) {
      _reviewResults.strengths = [sorted[0], sorted[1]];
      _reviewResults.weaknesses = [sorted[sorted.length-1], sorted[sorted.length-2]];
    }

    return _reviewResults;
  }

  // ── 段落标注 ──
  function applyParagraphAnnotations() {
    var box = document.getElementById('thesisBox');
    if (!box) return;
    var paragraphs = box.querySelectorAll('p, li, blockquote');
    var overall = _reviewResults.overall || 0;

    paragraphs.forEach(function(p) {
      var text = (p.textContent || '').trim();
      if (text.length < 10) return;
      p.classList.remove('audit-ok','audit-warn','audit-bad');
      if (overall >= 80) p.classList.add('audit-ok');
      else if (overall >= 55) p.classList.add('audit-warn');
      else p.classList.add('audit-bad');
      p.setAttribute('data-audit-score', String(overall));
    });
  }

  // ── 导出 ──
  window.ThesisAuditor = {
    REVIEWERS: REVIEWERS,
    auditFull: auditFull,
    getResults: function() { return _reviewResults; },
    getOverallScore: function() { return _reviewResults.overall || _reviewResults.overall_score || 0; },
    getVerdict: function() { return _reviewResults.verdict || ''; },
    applyAnnotations: applyParagraphAnnotations,
    // Legacy compat
    auditAll: auditFull,
    getSummary: function() { return { avgScore: _reviewResults.overall || 0, verdict: _reviewResults.verdict || '' }; },
    register: function(){},
    auditOne: auditFull
  };

  console.log('[TB] ThesisAuditor v2 ready — 5-reviewer model + writing quality check');

})();
