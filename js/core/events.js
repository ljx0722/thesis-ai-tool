/**
 * ThesisBuddy Core — 事件总线
 * 模块间通信：替代全局 window.func() 调用。
 */
var TB = window.TB || {};

(function() {
  'use strict';

  var _events = {};

  TB.events = {
    on: function(event, fn) {
      if (!_events[event]) _events[event] = [];
      _events[event].push(fn);
      return function() { TB.events.off(event, fn); };
    },

    off: function(event, fn) {
      if (!_events[event]) return;
      _events[event] = _events[event].filter(function(f) { return f !== fn; });
    },

    emit: function(event, data) {
      var fns = _events[event] || [];
      fns.forEach(function(fn) {
        try { fn(data); } catch (e) { console.warn('[events]', event, e); }
      });
    }
  };

  // ── 标准事件名 ──
  // module:switch     → { module: 'literature' }
  // view:switch       → { view: 'workspace' }
  // recharge:open     → {}
  // account:open      → {}
  // balance:updated   → { points, freeRemaining }
  // project:changed   → { project }
  // manuscript:loaded → { text, html, sections, refs }
  // document:imported → { chapters }
  // panel:toggle      → { panel: 'toc'|'tool' }
  // modal:open        → { id, content, title }
  // modal:close       → { id }
  // toast:show        → { message, duration }

})();
