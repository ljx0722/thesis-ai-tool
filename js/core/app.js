(function () {
  'use strict';

  var TOKEN_KEY = 'thesis_ai_token';
  var USER_KEY = 'thesis_ai_user';
  var started = false;
  var readyPromise = null;

  function setPhase(phase, detail) {
    if (window.TB && TB.state) TB.state.set('appPhase', phase);
    if (window.TB && TB.events) TB.events.emit('app:phase', { phase: phase, detail: detail || '' });
    document.body.setAttribute('data-app-phase', phase);
  }

  function showLogin(message) {
    setPhase('signed-out');
    var overlay = document.getElementById('loginOverlay');
    var shell = document.getElementById('appShell');
    if (overlay) { overlay.style.display = 'flex'; overlay.style.opacity = '1'; }
    if (shell) shell.style.display = 'none';
    if (message) {
      var error = document.getElementById('loginError');
      if (error) error.textContent = message;
    }
  }

  function showApp() {
    var overlay = document.getElementById('loginOverlay');
    var shell = document.getElementById('appShell');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(function () { overlay.style.display = 'none'; }, 180);
    }
    if (shell) shell.style.display = '';
    window.dispatchEvent(new Event('resize'));
  }

  function initializeFeatureModules() {
    if (window.LoginModule && LoginModule.init && !LoginModule.__tbInitialized) {
      LoginModule.__tbInitialized = true;
      LoginModule.init();
    }
    // Account, notification and import execution remain on their existing production
    // paths. Initializing the extracted wrappers here would double-bind polling and
    // the file input while those paths are migrated.
    if (window.ThesisRouter && ThesisRouter.init) ThesisRouter.init();
  }

  function hydrateProject() {
    setPhase('loading-projects');
    if (window.ThesisProject && ThesisProject.bootstrapAuthenticatedUser) {
      return ThesisProject.bootstrapAuthenticatedUser();
    }
    if (window.restoreScopedSession) window.restoreScopedSession();
    return Promise.resolve(null);
  }

  function completeAuthentication(user, options) {
    options = options || {};
    if (user) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      if (window.TB && TB.state) TB.state.setUser(user);
    }
    initializeFeatureModules();
    showApp();
    if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    if (typeof reloadBuddyPreferences === 'function') reloadBuddyPreferences();
    if (typeof pollNotifications === 'function') pollNotifications();
    readyPromise = hydrateProject().catch(function (error) {
      console.warn('[app bootstrap]', error);
      if (typeof ttp === 'function') ttp('云端项目暂时不可用，已使用本地数据');
      return null;
    }).then(function (project) {
      setPhase('ready');
      if (window.ThesisRouter) ThesisRouter.go('home', { replace: true });
      if (window.ThesisActivation) ThesisActivation.track('auth_ready', { returning: !!options.returning });
      return project;
    });
    return readyPromise;
  }

  function validateSavedSession() {
    var token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) { showLogin(); return Promise.resolve(false); }
    setPhase('authenticating');
    return fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(function (response) { if (!response.ok) throw new Error('expired'); return response.json(); })
      .then(function (data) {
        if (!data.success || !data.user) throw new Error('expired');
        if (data.user.is_admin) {
          sessionStorage.setItem('thesis_ai_admin_secret', token);
          location.href = '/admin.html';
          return true;
        }
        return completeAuthentication(data.user, { returning: true }).then(function () { return true; });
      })
      .catch(function () {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        if (window.clearManuscriptRuntime) window.clearManuscriptRuntime();
        showLogin('登录状态已失效，请重新登录');
        return false;
      });
  }

  function handleLogin(user) {
    if (user && user.is_admin) {
      sessionStorage.setItem('thesis_ai_admin_secret', sessionStorage.getItem(TOKEN_KEY) || '');
      location.href = '/admin.html';
      return Promise.resolve();
    }
    sessionStorage.setItem('thesis_ai_login', 'true');
    return completeAuthentication(user, { returning: false });
  }

  function logout() {
    if (window.clearManuscriptRuntime) window.clearManuscriptRuntime();
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem('thesis_ai_admin_secret');
    location.reload();
  }

  function init() {
    if (started) return readyPromise || Promise.resolve();
    started = true;
    setPhase('booting');
    initializeFeatureModules();
    return validateSavedSession();
  }

  window.ThesisApp = {
    init: init,
    completeAuthentication: completeAuthentication,
    handleLogin: handleLogin,
    logout: logout,
    showLogin: showLogin,
    get ready() { return readyPromise || Promise.resolve(); }
  };
  window.doLogout = logout;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
