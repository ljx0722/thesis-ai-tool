/**
 * ThesisDocument — 统一论文文档模型
 * Path A (从想法开始) 和 Path B (导入论文) 最终都产出一个 ThesisDocument
 * 替代分散在 app.js 的全局变量 (manuscriptText, sections, existingRefs 等)
 */
(function(){
  'use strict';

  var _doc = {
    // 来源
    source: null,           // 'idea' | 'import' | null

    // 核心文本
    text: '',              // 全文纯文本
    html: '',              // 全文HTML

    // 结构化树 (5层: ch → sec → sub → para → sent)
    chapters: [],           // [{id, ch, title, text, sections:[]}]
    sections: [],           // [{id, num, title, text, chapterId, subs:[]}]
    paragraphs: [],         // [{id, text, subId, sentenceIds:[]}]
    sentences: [],          // [{id, text, paragraphId, offset}]

    // 参考文献
    references: [],         // [{num, ci, title, journal, year, doi, refType}]
    topics: [],             // 论文主题词

    // 元数据
    meta: {
      wordCount: 0,
      chapterCount: 0,
      refCount: 0,
      loaded: false,
      ready: false
    }
  };

  // ── 兼容旧全局变量的 getter/setter ──
  Object.defineProperty(window, 'manuscriptText', {
    get: function(){ return _doc.text; },
    set: function(v){ _doc.text = v || ''; }
  });
  Object.defineProperty(window, 'manuscriptHTML', {
    get: function(){ return _doc.html; },
    set: function(v){ _doc.html = v || ''; }
  });
  Object.defineProperty(window, 'existingRefs', {
    get: function(){ return _doc.references; },
    set: function(v){ _doc.references = v || []; }
  });
  Object.defineProperty(window, 'mergedRefs', {
    get: function(){ return _doc.references; },
    set: function(v){ _doc.references = v || []; }
  });
  Object.defineProperty(window, 'paperTopics', {
    get: function(){ return _doc.topics; },
    set: function(v){ _doc.topics = v || []; }
  });

  // ── 句子查找 ──
  function getSentence(id) {
    for (var i = 0; i < _doc.sentences.length; i++) {
      if (_doc.sentences[i].id === id) return _doc.sentences[i];
    }
    return null;
  }

  function getChapterSentences(chapterId) {
    var result = [];
    _doc.sentences.forEach(function(s) {
      if (s.chapterId === chapterId) result.push(s);
    });
    return result;
  }

  // ── 标注系统 ──
  var _annotations = {}; // { sentenceId: { checkerName: { issues, score } } }

  function annotateSentence(sentenceId, checkerName, result) {
    if (!_annotations[sentenceId]) _annotations[sentenceId] = {};
    _annotations[sentenceId][checkerName] = result;
  }

  function getSentenceAnnotations(sentenceId) {
    return _annotations[sentenceId] || {};
  }

  // ── 论文就绪标记 ──
  function syncFromGlobals() {
    // 从旧全局变量同步填充 _doc（桥接兼容）
    if (typeof manuscriptText !== 'undefined' && manuscriptText) _doc.text = manuscriptText;
    if (typeof manuscriptHTML !== 'undefined' && manuscriptHTML) _doc.html = manuscriptHTML;
    if (typeof sections !== 'undefined' && sections) {
      _doc.chapters = sections;
      _doc.meta.chapterCount = sections.length;
    }
    if (typeof existingRefs !== 'undefined' && existingRefs) {
      _doc.references = existingRefs;
      _doc.meta.refCount = existingRefs.length;
    }
    if (typeof paperTopics !== 'undefined' && paperTopics) _doc.topics = paperTopics;
  }

  function markReady(source) {
    syncFromGlobals();
    _doc.source = source || _doc.source;
    _doc.meta.loaded = true;
    _doc.meta.ready = true;
    _doc.meta.wordCount = _doc.text.length;
    _doc.meta.chapterCount = _doc.chapters.length;
    _doc.meta.refCount = _doc.references.length;

    // 触发全局就绪事件
    if (typeof window.onThesisLoaded === 'function') {
      window.onThesisLoaded({ skipRevisionSave: false });
    }

    // 刷新状态栏和侧栏
    try { if (typeof window.updateStatusBar2 === 'function') window.updateStatusBar2(); } catch(e) {}
    try { if (typeof window._renderFeatureTree === 'function') window._renderFeatureTree(); } catch(e) {}
  }

  function isReady() {
    return _doc.meta.ready && _doc.text.length > 100;
  }

  // ── 导出 ──
  window.ThesisDocument = {
    get: function() { return _doc; },
    getSentence: getSentence,
    getChapterSentences: getChapterSentences,
    annotateSentence: annotateSentence,
    getSentenceAnnotations: getSentenceAnnotations,
    markReady: markReady,
    isReady: isReady,
    _doc: _doc,
    _annotations: _annotations
  };

  console.log('[TB] ThesisDocument model initialized.');

})();
