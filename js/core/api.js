/**
 * ThesisBuddy Core — 统一 HTTP 客户端
 * 封装 fetch: JWT 注入、402 拦截、余额自动刷新
 */
var TB = window.TB || {};

(function() {
  'use strict';

  var TOKEN_KEY = 'thesis_ai_token';
  var _balanceRefreshTimer = null;

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function authHeaders(json) {
    var h = {};
    if (json) h['Content-Type'] = 'application/json';
    var t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  // ── 基础请求 ──
  TB.api = {
    get: function(url) {
      return fetch(url, { headers: authHeaders(false) }).then(function(r) { return r.json(); });
    },
    post: function(url, body) {
      return fetch(url, { method: 'POST', headers: authHeaders(true), body: JSON.stringify(body || {}) }).then(function(r) { return r.json(); });
    },
    put: function(url, body) {
      return fetch(url, { method: 'PUT', headers: authHeaders(true), body: JSON.stringify(body || {}) }).then(function(r) { return r.json(); });
    },
    del: function(url) {
      return fetch(url, { method: 'DELETE', headers: authHeaders(false) }).then(function(r) { return r.json(); });
    },
    headers: function(json) { return authHeaders(json); },
    getToken: getToken
  };

  // ── 余额 ──
  TB.api.fetchBalance = function() {
    var token = getToken();
    if (!token) return Promise.resolve(null);
    return fetch('/api/payment/balance', { headers: authHeaders(false) })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) {
          TB.state.set('balance', d.points || 0);
          TB.state.set('freeRemaining', d.free_remaining_today || 0);
          TB.events.emit('balance:updated', { points: d.points || 0, freeRemaining: d.free_remaining_today || 0 });
        }
        return d;
      });
  };

  // ── 模块扣点 ──
  TB.api.chargeModule = function(moduleId) {
    return fetch('/api/usage/module', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ module: moduleId })
    }).then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) { TB.api.fetchBalance(); return { ok: true, free: d.free, cost: d.cost_points }; }
      if (d.error) { return { ok: false, error: d.error, needRecharge: true }; }
      return { ok: false };
    });
  };

  // ── LLM 调用 ──
  TB.api.callLLM = function(capabilityId, input, opts) {
    opts = opts || {};
    var token = getToken();
    return fetch('/api/llm/analyze', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        capability_id: capabilityId,
        input: input,
        max_tokens: opts.max_tokens || 2000,
        revision_id: opts.revision_id || undefined,
        project_id: opts.project_id || undefined
      })
    }).then(function(r) { return r.json(); });
  };

  // ── 402 全局拦截 ──
  function install402Interceptor() {
    if (window.__tb402patched) return;
    window.__tb402patched = true;
    var origFetch = window.fetch;
    window.fetch = function() {
      return origFetch.apply(this, arguments).then(function(res) {
        if (res && res.status === 402) {
          try {
            res.clone().json().then(function(d) {
              var msg = (d && d.error) ? d.error : '点数不足';
              if (confirm(msg + '\n\n是否立即充值？')) {
                TB.events.emit('recharge:open');
              }
              TB.api.fetchBalance();
            }).catch(function() {});
          } catch (e) {}
        }
        return res;
      });
    };
  }

  install402Interceptor();

  // ── 余额自动刷新 ──
  TB.api.startBalancePolling = function(intervalMs) {
    intervalMs = intervalMs || 30000;
    if (_balanceRefreshTimer) clearInterval(_balanceRefreshTimer);
    TB.api.fetchBalance();
    _balanceRefreshTimer = setInterval(TB.api.fetchBalance, intervalMs);
  };

  // ── 兼容全局函数 ──
  window.apiAuthHeaders = authHeaders;

})();
