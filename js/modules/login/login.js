/**
 * Login Module — 从 index.html 内联脚本提取
 * 登录、注册、Token 管理
 */
var LoginModule = (function() {
  'use strict';

  var TOKEN_KEY = 'thesis_ai_token';
  var USER_KEY = 'thesis_ai_user';
  var isRegMode = false;

  function getToken() { return sessionStorage.getItem(TOKEN_KEY) || ''; }

  function doLogin() {
    var u = document.getElementById('loginUsername');
    var p = document.getElementById('loginPassword');
    var err = document.getElementById('loginError');
    var username = u ? u.value.trim() : '';
    var password = p ? p.value : '';
    if (!username) { err.textContent = '请输入用户名'; return; }
    if (!password) { err.textContent = '请输入密码'; return; }

    if (isRegMode) {
      var cp = document.getElementById('regConfirmPassword');
      if (cp && password !== cp.value) { err.textContent = '两次密码不一致'; return; }
      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password, invite_code: (document.getElementById('regInviteCode') || {}).value || '' })
      }).then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.success) {
            err.style.color = '#10b981';
            err.textContent = '注册成功！请登录';
            toggleRegMode();
          } else { err.textContent = d.error; }
        }).catch(function() { err.textContent = '网络错误'; });
      return;
    }

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    }).then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) {
          sessionStorage.setItem(TOKEN_KEY, d.token);
          sessionStorage.setItem(USER_KEY, JSON.stringify(d.user));
          if (d.user.is_admin) {
            sessionStorage.setItem('thesis_ai_admin_secret', d.token);
            window.location.href = '/admin.html';
            return;
          }
          if (window.ThesisApp && ThesisApp.handleLogin) ThesisApp.handleLogin(d.user);
          else finishLogin(d.user);
        } else { err.textContent = d.error; }
      }).catch(function() { err.textContent = '网络错误'; });
  }

  function finishLogin(user) {
    var loginOverlay = document.getElementById('loginOverlay');
    var appShell = document.getElementById('appShell');
    if (loginOverlay) {
      loginOverlay.style.opacity = '0';
      loginOverlay.style.transition = 'opacity .4s';
      setTimeout(function() { loginOverlay.style.display = 'none'; }, 400);
    }
    if (appShell) appShell.style.display = '';

    if (window.TB && TB.state) {
      TB.state.setUser(user);
      TB.state.set('appReady', true);
      if (TB.api) TB.api.startBalancePolling();
    }

    // 通知其他子系统
    if (window.ThesisProject && ThesisProject.bootstrapAuthenticatedUser) {
      ThesisProject.bootstrapAuthenticatedUser().catch(function(e) { console.warn('[bootstrap]', e); });
    }
    if (typeof window.updateBalanceDisplay === 'function') window.updateBalanceDisplay();
    if (typeof window.maybeStartTour === 'function') window.maybeStartTour();

    window.dispatchEvent(new Event('resize'));
  }

  function toggleRegMode() {
    isRegMode = !isRegMode;
    var confirmField = document.getElementById('regConfirmField');
    var cardTitle = document.getElementById('loginCardTitle');
    var btnText = document.getElementById('loginBtnText');
    var switchText = document.getElementById('loginSwitchText');
    var switchLink = document.getElementById('loginSwitchLink');
    var err = document.getElementById('loginError');

    if (confirmField) confirmField.style.display = isRegMode ? '' : 'none';
    if (cardTitle) cardTitle.textContent = isRegMode ? '注册账号' : '登录系统';
    if (btnText) btnText.textContent = isRegMode ? '注 册' : '登 录';
    if (switchText) switchText.textContent = isRegMode ? '已有账号？' : '还没有账号？';
    if (switchLink) switchLink.textContent = isRegMode ? '去登录' : '立即注册';
    if (err) err.textContent = '';
  }

  function doLogout() {
    if (window.ThesisApp && ThesisApp.logout) { ThesisApp.logout(); return; }
    if (typeof window.clearManuscriptRuntime === 'function') window.clearManuscriptRuntime();
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem('thesis_ai_admin_secret');
    location.reload();
  }

  function init() {
    // 暴露全局函数供 onclick 兼容
    window.doLogin = doLogin;
    window.toggleRegMode = toggleRegMode;
    window.doLogout = doLogout;

    // 绑定回车键
    var pwInput = document.getElementById('loginPassword');
    if (pwInput) {
      pwInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
    }
    var unInput = document.getElementById('loginUsername');
    if (unInput) {
      unInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { var el = document.getElementById('loginPassword'); if (el) el.focus(); } });
    }

    // Session validation is owned by ThesisApp; this module only owns the form.
  }

  return { init: init, doLogin: doLogin, doLogout: doLogout, toggleRegMode: toggleRegMode };
})();
