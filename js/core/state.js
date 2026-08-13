/**
 * ThesisBuddy Core — 全局响应式状态
 * 简单的发布/订阅状态存储，替代隐式全局变量。
 */
var TB = window.TB || {};

(function() {
  'use strict';

  var _state = {
    user: null,
    balance: 0,
    freeRemaining: 0,
    project: null,
    manuscript: { text: '', html: '', sections: [], refs: [], topics: [] },
    currentView: 'workspace',
    currentModule: null,
    theme: 'auto',
    appReady: false,
    appPhase: 'booting'
  };

  var _listeners = {};

  TB.state = {
    get: function(key) {
      return key ? _state[key] : _state;
    },

    set: function(key, value) {
      var old = _state[key];
      _state[key] = value;
      if (old !== value) {
        // 通知监听器
        var fns = _listeners[key] || [];
        fns.forEach(function(fn) {
          try { fn(value, old); } catch (e) { console.warn('[state] listener error:', e); }
        });
        // 全局变化事件
        var allFns = _listeners['*'] || [];
        allFns.forEach(function(fn) {
          try { fn(key, value, old); } catch (e) { console.warn('[state] listener error:', e); }
        });
      }
    },

    on: function(key, fn) {
      if (!_listeners[key]) _listeners[key] = [];
      _listeners[key].push(fn);
    },

    off: function(key, fn) {
      if (!_listeners[key]) return;
      _listeners[key] = _listeners[key].filter(function(f) { return f !== fn; });
    },

    // ── 便捷方法 ──
    setManuscript: function(data) {
      _state.manuscript = Object.assign(_state.manuscript, data || {});
      _state.appReady = true;
      this.set('manuscript', _state.manuscript);
      this.set('appReady', true);
    },

    setUser: function(user) {
      var old = _state.user;
      _state.balance = (user && user.points) || _state.balance;
      this.set('user', user);
      if (old === user) _state.user = user;
      this.set('balance', _state.balance);
    },

    setProject: function(project) {
      this.set('project', project);
    },

    isLoggedIn: function() {
      return !!this.getToken();
    },

    getToken: function() {
      try { return sessionStorage.getItem('thesis_ai_token') || ''; } catch (e) { return ''; }
    }
  };

  // ── 兼容旧代码的全局变量 ──
  // 旧代码大量使用这些全局变量，需要保持同步
  Object.defineProperty(window, 'manuscriptText', {
    get: function() { return _state.manuscript.text; },
    set: function(v) { _state.manuscript.text = v || ''; }
  });
  Object.defineProperty(window, 'manuscriptHTML', {
    get: function() { return _state.manuscript.html; },
    set: function(v) { _state.manuscript.html = v || ''; }
  });
  Object.defineProperty(window, 'sections', {
    get: function() { return _state.manuscript.sections; },
    set: function(v) { _state.manuscript.sections = v || []; }
  });
  Object.defineProperty(window, 'existingRefs', {
    get: function() { return _state.manuscript.refs; },
    set: function(v) { _state.manuscript.refs = v || []; }
  });
  Object.defineProperty(window, 'paperTopics', {
    get: function() { return _state.manuscript.topics; },
    set: function(v) { _state.manuscript.topics = v || []; }
  });

})();
