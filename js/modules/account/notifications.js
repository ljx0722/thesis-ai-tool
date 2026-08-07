/**
 * Notifications Module — 消息通知
 * 从 index.html 内联脚本提取
 */
var NotifyModule = (function() {
  'use strict';

  var _notifyOpen = false;
  var _lastUnread = 0;

  function getToken() { try { return sessionStorage.getItem('thesis_ai_token') || ''; } catch(e) { return ''; } }
  function apiHeaders(json) { var h = {}; if (json) h['Content-Type'] = 'application/json'; var t = getToken(); if (t) h['Authorization'] = 'Bearer ' + t; return h; }

  function togglePanel() {
    var p = document.getElementById('notifyPanel');
    if (!p) return;
    _notifyOpen = !_notifyOpen;
    p.style.display = _notifyOpen ? 'block' : 'none';
    if (_notifyOpen) pollNotifications(true);
  }

  function pollNotifications(render) {
    var token = getToken();
    if (!token) return;
    fetch('/api/notifications?limit=40', { headers: apiHeaders(false) })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) return;
        var unread = d.unread || 0;
        var badge = document.getElementById('notifyBadge');
        if (badge) {
          if (unread > 0) { badge.style.display = ''; badge.textContent = unread > 99 ? '99+' : String(unread); }
          else { badge.style.display = 'none'; }
        }
        if (unread > _lastUnread && _lastUnread >= 0) {
          // 新消息轻提示
          if (typeof ttp === 'function') ttp('📬 新消息');
        }
        _lastUnread = unread;
        if (render || _notifyOpen) renderList(d.notifications || []);
      });
  }

  function renderList(list) {
    var el = document.getElementById('notifyList');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div style="padding:28px 16px;text-align:center;color:var(--text-muted,#999);font-size:.75rem">暂无消息</div>';
      return;
    }
    var iconMap = { gift: '🎁', recharge: '💳', system: '📢' };
    var h = '';
    list.forEach(function(n) {
      var unread = !n.is_read;
      h += '<div onclick="window.markNotificationRead(' + n.id + ')" style="padding:10px 14px;border-bottom:1px solid rgba(0,0,0,.04);cursor:pointer;background:' + (unread ? 'rgba(0,113,227,.04)' : 'transparent') + '">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">' +
        '<div style="font-size:.78rem;font-weight:' + (unread ? 700 : 600) + ';color:var(--text-primary,#111)">' + (iconMap[n.type] || '📢') + ' ' + (n.title || '') + '</div>' +
        '<div style="font-size:.58rem;color:var(--text-muted,#999);white-space:nowrap">' + (n.created_at || '').substring(5, 16) + '</div>' +
        '</div><div style="font-size:.7rem;color:var(--text-secondary,#555);margin-top:4px;line-height:1.5">' + (n.body || '') + '</div>' +
        (unread ? '<div style="font-size:.58rem;color:var(--accent,#0071e3);margin-top:4px">未读 · 点击标记已读</div>' : '') +
        '</div>';
    });
    el.innerHTML = h;
  }

  function markRead(id) {
    var token = getToken();
    if (!token) return;
    fetch('/api/notifications/read', {
      method: 'POST', headers: apiHeaders(true),
      body: JSON.stringify({ ids: [id] })
    }).then(function(r) { return r.json(); })
      .then(function() {
        pollNotifications(true);
        if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
      });
  }

  function markAllRead() {
    var token = getToken();
    if (!token) return;
    fetch('/api/notifications/read', {
      method: 'POST', headers: apiHeaders(true),
      body: JSON.stringify({ all: true })
    }).then(function(r) { return r.json(); })
      .then(function() { pollNotifications(true); });
  }

  function init() {
    window.toggleNotifyPanel = togglePanel;
    window.pollNotifications = pollNotifications;
    window.markNotificationRead = markRead;
    window.markAllNotificationsRead = markAllRead;

    // 外部点击关闭
    document.addEventListener('click', function(e) {
      var p = document.getElementById('notifyPanel');
      var b = document.getElementById('notifyBellBtn');
      if (!p || !_notifyOpen) return;
      if (p.contains(e.target) || (b && b.contains(e.target))) return;
      togglePanel();
    });

    // 初始轮询
    setTimeout(function() { pollNotifications(); }, 800);
    setInterval(function() { pollNotifications(); }, 20000);
  }

  return { init: init, togglePanel: togglePanel, pollNotifications: pollNotifications, markRead: markRead, markAllRead: markAllRead };
})();
