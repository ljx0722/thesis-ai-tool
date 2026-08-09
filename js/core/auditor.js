/**
 * ThesisAuditor — 统一论文审阅引擎
 * 注册 7 个检查器，按需运行，结果存入 ThesisDocument.annotations
 */
(function(){
  'use strict';

  var _checkers = {};
  var _results = {}; // { checkerName: { sentenceId: {issues,score} } }

  // ── 注册检查器 ──
  function register(name, fn, opts) {
    _checkers[name] = { fn: fn, opts: opts || {} };
    console.log('[Auditor] Registered checker:', name);
  }

  // ── 对全文运行所有本地检查 ──
  function auditAll() {
    var hasEssay = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100;
    if (!hasEssay) { console.warn('[Auditor] No essay loaded'); return null; }

    _results = {};
    Object.keys(_checkers).forEach(function(name) {
      var checker = _checkers[name];
      try {
        var result = checker.fn(manuscriptText, sections, existingRefs);
        _results[name] = result;
        if (window.ThesisDocument && ThesisDocument._doc) {
          window.ThesisDocument._doc.meta[name + '_score'] = result.score || 0;
        }
      } catch(e) {
        _results[name] = { error: e.message, score: 0 };
      }
    });
    return _results;
  }

  // ── 运行单个检查器 ──
  function auditOne(name) {
    var checker = _checkers[name];
    if (!checker) return null;
    try {
      return checker.fn(manuscriptText, sections, existingRefs);
    } catch(e) {
      return { error: e.message, score: 0 };
    }
  }

  // ── 获取所有检查结果的汇总 ──
  function getSummary() {
    var summary = { checkers: {}, totalScore: 0, count: 0 };
    Object.keys(_results).forEach(function(name) {
      var r = _results[name];
      summary.checkers[name] = { score: (r && r.score) || 0, issues: (r && r.issues) ? r.issues.length : 0 };
      if (r && r.score) { summary.totalScore += r.score; summary.count++; }
    });
    if (summary.count > 0) summary.avgScore = Math.round(summary.totalScore / summary.count);
    return summary;
  }

  // ── 注册内置的本地检查器 ──
  // 注册格式检查（format-check 的核心逻辑是纯本地的）
  register('format', function(text, secs, refs) {
    var issues = [], score = 80;
    var bodyChs = (secs || []).filter(function(s) { return s.title && (typeof isBodyChapter === 'function' ? isBodyChapter(s) : true); });
    if (bodyChs.length < 3) { issues.push({ type: 'warn', msg: '建议至少3章正文' }); score -= 10; }
    var totalSections = 0; bodyChs.forEach(function(c) { totalSections += (c.sections || []).length; });
    if (totalSections < 5) { issues.push({ type: 'warn', msg: '建议每章至少2节' }); score -= 5; }
    // 图表检测
    var figs = (text.match(/图\s*\d+/g) || []).length;
    var tbls = (text.match(/表\s*\d+/g) || []).length;
    issues.push({ type: 'ok', msg: figs + '个图, ' + tbls + '个表' });
    if (figs + tbls < 3) { issues.push({ type: 'info', msg: '图表较少，建议增加数据可视化' }); }
    return { score: score, issues: issues, stats: { chapters: bodyChs.length, sections: totalSections, figures: figs, tables: tbls } };
  });

  // 注册段落分析
  register('paragraph', function(text, secs, refs) {
    var issues = [], score = 75;
    var avgSentLen = 0;
    var sentences = text.split(/[。！？\.\!\?]+/).filter(function(s) { return s.trim().length > 5; });
    sentences.forEach(function(s) { avgSentLen += s.length; });
    avgSentLen = sentences.length > 0 ? Math.round(avgSentLen / sentences.length) : 0;
    var longSentences = sentences.filter(function(s) { return s.length > 100; }).length;
    if (avgSentLen > 80) { issues.push({ type: 'warn', msg: '平均句长 ' + avgSentLen + ' 字，偏长' }); score -= 10; }
    if (longSentences > sentences.length * 0.2) { issues.push({ type: 'warn', msg: longSentences + ' 处超长句(>100字)' }); score -= 5; }
    return { score: score, issues: issues, stats: { avgSentenceLength: avgSentLen, totalSentences: sentences.length, longSentences: longSentences } };
  });

  console.log('[TB] ThesisAuditor ready. 2 built-in checkers registered.');

  // ── 段落级标注渲染 ──
  function applyParagraphAnnotations() {
    // 对论文中的每个段落，根据审计结果添加颜色标注
    var box = document.getElementById('thesisBox');
    if (!box) return;
    var paragraphs = box.querySelectorAll('p, li, blockquote');
    var results = _results;

    paragraphs.forEach(function(p) {
      var text = (p.textContent || '').trim();
      if (text.length < 10) return;

      // 清除旧标注
      p.classList.remove('audit-ok','audit-warn','audit-bad');

      var score = 0, issues = 0;
      Object.keys(results).forEach(function(name) {
        var r = results[name];
        if (r && r.score) score += r.score;
        if (r && r.issues) issues += r.issues.length;
      });

      score = Object.keys(results).length > 0 ? Math.round(score / Object.keys(results).length) : 0;

      if (score >= 80) p.classList.add('audit-ok');
      else if (score >= 50) p.classList.add('audit-warn');
      else p.classList.add('audit-bad');

      // 添加数据属性
      p.setAttribute('data-audit-score', String(score));
      p.setAttribute('data-audit-issues', String(issues));
    });
  }

  window.ThesisAuditor = {
    register: register,
    auditAll: auditAll,
    auditOne: auditOne,
    getSummary: getSummary,
    getResults: function() { return _results; },
    getCheckers: function() { return Object.keys(_checkers); },
    applyAnnotations: applyParagraphAnnotations
  };

})();
