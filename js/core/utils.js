/**
 * ThesisBuddy Core — 共享工具函数
 * 从 app.js 提取，作为所有模块的基础依赖。
 */
var TB = window.TB || {};

(function() {
  'use strict';

  // ── 文本处理 ──
  TB.escapeHtml = function(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  TB.norm = function(s) {
    return (s || '').toLowerCase().replace(/[^一-鿿a-z0-9]/g, '');
  };

  TB.cnDigit = function(s) {
    var m = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
              '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15, '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20 };
    return m[s] || parseInt(s) || 0;
  };

  TB.detectHeadingLevel = function(txt) {
    if (!txt) return 0;
    // 中文章节号模式
    var m1 = txt.match(/^第([一二三四五六七八九十百千]+)章/);
    if (m1) return 1;
    var m2 = txt.match(/^第([一二三四五六七八九十百千]+)节/);
    if (m2) return 2;
    // 数字模式
    var m3 = txt.match(/^(\d+)\.(\d+)\.(\d+)\s/);
    if (m3) return 3;
    var m4 = txt.match(/^(\d+)\.(\d+)\s/);
    if (m4) return 2;
    var m5 = txt.match(/^(\d+)\s/);
    if (m5) return 1;
    // 关键词模式
    if (/^(摘要|Abstract|关键词|Keywords|绪论|引言|前言|结论|总结|展望|参考文献|致谢|附录)/.test(txt)) return 1;
    return 0;
  };

  TB.detectChapterNum = function(txt) {
    var m = txt.match(/^第([一二三四五六七八九十百千]+)章/);
    if (m) return TB.cnDigit(m[1]);
    m = txt.match(/^(\d+)\s/);
    return m ? parseInt(m[1]) : 0;
  };

  TB.medianNumber = function(values) {
    if (!values || !values.length) return 0;
    var sorted = values.slice().sort(function(a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  TB.isChineseTitle = function(t) { return /[一-龥]/.test(t || ''); };

  TB.bigramOverlap = function(a, b) {
    if (!a || !b) return 0;
    var sa = new Set(), sb = new Set(), ta = TB.norm(a), tb = TB.norm(b);
    for (var i = 0; i < ta.length - 1; i++) sa.add(ta.substring(i, i + 2));
    for (var i = 0; i < tb.length - 1; i++) sb.add(tb.substring(i, i + 2));
    var h = 0;
    sa.forEach(function(g) { if (sb.has(g)) h++; });
    return Math.max(sa.size, sb.size) > 0 ? h / Math.max(sa.size, sb.size) : 0;
  };

  TB.sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms || 0); }); };

  TB.uid = function() {
    return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
  };

  TB.nowISO = function() { return new Date().toISOString(); };

  TB.isBodyChapter = function(section) {
    if (!section || !section.title) return false;
    var t = section.title;
    return !/^(摘要|Abstract|关键词|Keywords|目录|参考文献|致谢|附录|绪论|引言|前言)/.test(t);
  };

  // ── 兼容旧代码的全局别名 ──
  window.escapeHtml = TB.escapeHtml;
  window.norm = TB.norm;
  window.cnDigit = TB.cnDigit;
  window.detectHeadingLevel = TB.detectHeadingLevel;
  window.detectChapterNum = TB.detectChapterNum;
  window.medianNumber = TB.medianNumber;
  window.bigramOverlap = TB.bigramOverlap;
  window.sleep = TB.sleep;
  window.isBodyChapter = TB.isBodyChapter;
  window.isChineseTitle = TB.isChineseTitle;

})();
