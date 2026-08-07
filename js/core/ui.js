/**
 * ThesisBuddy Core — UI 工具
 * Modal/Toast/Loading/Skeleton — 替代全局 showLoad/hideLoad/ttp/openAccountModal
 */
var TB = window.TB || {};

(function() {
  'use strict';

  // ── Toast (替代全局 ttp) ──
  var _toastTimer = null;
  TB.ui = {
    toast: function(msg, duration) {
      duration = duration || 2500;
      var t = document.getElementById('tbToast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'tbToast';
        t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100000;background:#1f2937;color:#fff;padding:10px 24px;border-radius:10px;font-size:.78rem;font-weight:600;opacity:0;transition:opacity .3s;pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.2);font-family:inherit;';
        document.body.appendChild(t);
      }
      t.textContent = msg; t.style.opacity = '1';
      clearTimeout(_toastTimer);
      _toastTimer = setTimeout(function() { t.style.opacity = '0'; }, duration);
    },

    // ── Loading (替代全局 showLoad/hideLoad/updLoad) ──
    showLoading: function(msg, pct, detail) {
      var ov = document.getElementById('loadOv');
      if (!ov) return;
      ov.classList.add('show');
      var msgEl = document.getElementById('loadMsg');
      if (msgEl) msgEl.textContent = msg || '';
      if (pct !== undefined) {
        var pctEl = document.getElementById('loadPct');
        var bar = document.getElementById('loadBar');
        if (pctEl) { pctEl.style.display = 'block'; pctEl.textContent = pct + '%'; }
        if (bar) bar.style.width = pct + '%';
      }
      var detailEl = document.getElementById('loadDetail');
      if (detailEl && detail) detailEl.textContent = detail;
    },

    updateLoading: function(msg, pct, detail) {
      this.showLoading(msg, pct, detail);
    },

    hideLoading: function() {
      var ov = document.getElementById('loadOv');
      if (ov) ov.classList.remove('show');
    },

    // ── Modal (通用弹窗，替代硬编码的覆盖层 HTML) ──
    showModal: function(opts) {
      opts = opts || {};
      var id = opts.id || 'tbModal_' + Date.now();
      var title = opts.title || '';
      var content = opts.content || '';
      var width = opts.width || '560px';
      var onClose = opts.onClose;

      // 移除已存在的同 ID 弹窗
      var existing = document.getElementById(id);
      if (existing) existing.remove();

      var html = '<div id="' + id + '" class="tb-modal-overlay" style="display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,.45);backdrop-filter:blur(6px);z-index:100065;align-items:center;justify-content:center" onclick="TB.ui.hideModal(\'' + id + '\')">' +
        '<div style="background:var(--bg-card,#fff);border-radius:16px;width:' + width + ';max-width:96vw;max-height:88vh;overflow:hidden;border:1px solid var(--border,#e5e7eb);box-shadow:0 24px 64px rgba(0,0,0,.22);display:flex;flex-direction:column" onclick="event.stopPropagation()">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border,#e5e7eb)">' +
        '<b style="font-size:1rem;color:var(--text-primary,#111)">' + TB.escapeHtml(title) + '</b>' +
        '<button onclick="TB.ui.hideModal(\'' + id + '\')" style="border:none;background:transparent;font-size:1.1rem;cursor:pointer;color:var(--text-muted,#999)">✕</button>' +
        '</div>' +
        '<div style="padding:16px 18px;overflow:auto;flex:1;font-size:.82rem;color:var(--text-secondary,#444)">' + content + '</div>' +
        '</div></div>';

      document.body.insertAdjacentHTML('beforeend', html);
      if (onClose) {
        TB.events.on('modal:closed:' + id, onClose);
      }
    },

    hideModal: function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.remove();
        TB.events.emit('modal:closed:' + id);
      }
    },

    // ── Confirm ──
    confirm: function(msg) {
      return window.confirm(msg);
    },

    alert: function(msg) {
      return window.alert(msg);
    }
  };

  // ── 兼容全局函数 ──
  // 旧代码大量使用这些全局函数
  window.ttp = TB.ui.toast.bind(TB.ui);
  window.showLoad = TB.ui.showLoading.bind(TB.ui);
  window.updLoad = TB.ui.updateLoading.bind(TB.ui);
  window.hideLoad = TB.ui.hideLoading.bind(TB.ui);

})();
