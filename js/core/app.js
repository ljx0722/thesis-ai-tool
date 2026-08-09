/**
 * ThesisBuddy Core — App Shell
 * 初始化、模块注册、data-action 事件代理、视图切换
 */
var TB = window.TB || {};

(function() {
  'use strict';

  // ── 模块注册表 ──
  var _modules = {};
  var _activeModule = null;

  TB.registerModule = function(id, module) {
    _modules[id] = module;
  };

  TB.getModule = function(id) {
    return _modules[id];
  };

  // ── 初始化 ──
  function init() {
    console.log('[TB] Core initializing...');

    // 1. 检查登录状态
    var token = sessionStorage.getItem('thesis_ai_token');
    var loginOverlay = document.getElementById('loginOverlay');
    var appShell = document.getElementById('appShell');

    if (token) {
      // 验证 token
      fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.success) {
            TB.state.setUser(d.user);
            bootstrapApp(appShell, loginOverlay);
          } else {
            showLogin(loginOverlay, appShell);
          }
        }).catch(function() {
          showLogin(loginOverlay, appShell);
        });
    } else {
      showLogin(loginOverlay, appShell);
    }

    // 2. 绑定 data-action 事件代理
    bindShellActions();

    // 3. 监听事件
    TB.events.on('balance:updated', function(data) {
      updateBalanceDisplay(data);
    });
    TB.events.on('recharge:open', function() {
      if (typeof AccountModule !== 'undefined' && AccountModule.showRechargeModal) {
        AccountModule.showRechargeModal();
      }
    });

    console.log('[TB] Core initialized');
  }

  function bootstrapApp(appShell, loginOverlay) {
    if (loginOverlay) {
      loginOverlay.style.opacity = '0';
      loginOverlay.style.transition = 'opacity .4s';
      setTimeout(function() { loginOverlay.style.display = 'none'; }, 400);
    }
    if (appShell) appShell.style.display = '';
    TB.state.set('appReady', true);
    TB.api.startBalancePolling();
    window.dispatchEvent(new Event('resize'));

    // 触发认证完成后的引导
    if (typeof window.bootstrapProject === 'function') {
      window.bootstrapProject();
    }
  }

  function showLogin(loginOverlay, appShell) {
    if (loginOverlay) loginOverlay.style.display = 'flex';
    if (appShell) appShell.style.display = 'none';
  }

  // ── data-action 事件代理 ──
  function bindShellActions() {
    document.addEventListener('click', function(e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;

      var action = el.getAttribute('data-action');
      var module = el.getAttribute('data-module');
      var view = el.getAttribute('data-view');
      var panel = el.getAttribute('data-panel');

      switch (action) {
        case 'module:switch':
          if (module) switchModule(module);
          break;
        case 'view:switch':
          if (view) switchView(view);
          break;
        case 'panel:toggle':
          if (panel) togglePanel(panel);
          break;
        case 'recharge:open':
          TB.events.emit('recharge:open');
          break;
        case 'account:open':
          TB.events.emit('account:open');
          break;
        case 'notifications:toggle':
          TB.events.emit('notifications:toggle');
          break;
        case 'tool:home':
          openToolHome();
          break;
        case 'project:create':
          openIdeaWizard();
          break;
        case 'auth:logout':
          doLogout();
          break;
        case 'auth:login':
          doLogin();
          break;
      }
    });

    // 顶栏标签点击 — 通过 data-action 已在上面处理
  }

  // ── Shell 函数 ──

  function switchModule(id) {
    TB.state.set('currentModule', id);

    // 特殊模块处理
    if (id === 'references' || id === 'literature') {
      openCitelyModule();
      return;
    }
    if (id === 'dashboard') {
      if (typeof showDashboard === 'function') showDashboard();
      return;
    }
    if (id === 'knowledge-graph' || id === 'kg') {
      if (typeof showKnowledgeGraph === 'function') showKnowledgeGraph();
      return;
    }

    // 通用模块：显示在工具台面板
    var refPanel = document.getElementById('refPanel');
    var toolHome = document.getElementById('toolHome');
    var moduleContent = document.getElementById('moduleContent');

    if (toolHome) toolHome.style.display = 'none';
    if (moduleContent) moduleContent.style.display = '';

    // 动态加载并运行模块
    var runnerName = getModuleRunner(id);
    if (runnerName && typeof window[runnerName] === 'function') {
      if (moduleContent) window[runnerName](moduleContent);
    }

    // 更新标签状态
    updateTabState(id);
  }

  function switchView(view) {
    TB.state.set('currentView', view);
    if (view === 'workspace') {
      openToolHome();
    } else if (view === 'refs') {
      switchModule('references');
    } else if (view === 'tools') {
      openToolHome();
    } else if (view === 'dashboard') {
      if (typeof showDashboard === 'function') showDashboard();
    }
  }

  function togglePanel(panel) {
    if (panel === 'toc') {
      if (typeof toggleTocPanel === 'function') toggleTocPanel();
    } else if (panel === 'tool') {
      if (typeof toggleToolPanel === 'function') toggleToolPanel();
    }
  }

  function openToolHome() {
    var toolHome = document.getElementById('toolHome');
    var moduleContent = document.getElementById('moduleContent');
    if (toolHome) toolHome.style.display = '';
    if (moduleContent) moduleContent.style.display = 'none';
    updateTabState('tools');
  }

  function openCitelyModule() {
    var refPanel = document.getElementById('refPanel');
    var toolHome = document.getElementById('toolHome');
    var moduleContent = document.getElementById('moduleContent');
    var citelyContainer = document.getElementById('citelyContainer');

    if (toolHome) toolHome.style.display = 'none';
    if (moduleContent) moduleContent.style.display = '';

    // 确保 Citely 容器存在
    if (!citelyContainer && moduleContent) {
      moduleContent.innerHTML = '<div id="citelyContainer"></div>';
      citelyContainer = document.getElementById('citelyContainer');
    }

    if (citelyContainer && typeof Citely !== 'undefined') {
      // 传入项目上下文
      var projData = {};
      if (window.ThesisProject && ThesisProject.getCurrentProject) {
        try {
          var p = ThesisProject.getCurrentProject();
          if (p) {
            projData.keywords = p.keywords || '';
            projData.chapters = (p.chapters || []).map(function(ch) { return { id: ch.id || ch.title || ch, title: ch.title || ch }; });
          }
        } catch (e) {}
      }
      Citely.mount('citelyContainer', projData);
    }

    updateTabState('references');
  }

  function openIdeaWizard() {
    if (typeof window.openIdeaWizard === 'function') {
      window.openIdeaWizard();
    }
  }

  function doLogin() {
    if (typeof window.doLogin === 'function') window.doLogin();
  }

  function doLogout() {
    sessionStorage.removeItem('thesis_ai_token');
    sessionStorage.removeItem('thesis_ai_user');
    location.reload();
  }

  function getModuleRunner(id) {
    var map = {
      'ideation': 'IdeationModule', 'health-check': 'HealthCheckModule',
      'expand': 'runExpandModule', 'data-analysis': 'runDataAnalysis',
      'knowledge-graph': 'runKnowledgeGraphModule',
      
      
      'paragraph': 'runParagraphAnalysis', 'review': 'runReviewModule',
      'optimization': 'runOptimization', 'defense-ppt': 'runDefensePPT',
      'en-abstract': 'runEnAbstract', 'dashboard': 'showDashboard',
    };
    return map[id] || null;
  }

  function updateTabState(activeView) {
    document.querySelectorAll('.bar-tab').forEach(function(tab) {
      var view = tab.getAttribute('data-view');
      var module = tab.getAttribute('data-module');
      var isActive = (view && activeView === view) || (module && activeView === module);
      tab.classList.toggle('active', isActive);
    });
  }

  function updateBalanceDisplay(data) {
    var el = document.getElementById('balanceAmount');
    if (!el) return;
    var pts = Number(data && data.points != null ? data.points : TB.state.get('balance'));
    if (!isFinite(pts)) pts = 0;
    el.textContent = pts.toFixed(3);
    el.style.color = pts >= 1 ? '#10b981' : (pts > 0 ? '#f59e0b' : '#f87171');
  }

  // ── 工具台首页（如果旧 rendeToolHome 不可用时使用） ──
  var _defaultToolModules = [
    { id: 'topic-finder', name: '选题推荐', icon: '💡', requiresThesis: false },
    { id: 'proposal', name: '开题大纲', icon: '📝', requiresThesis: false },
    { id: 'proofread', name: '论文查错', icon: '✏️', requiresThesis: false },
    { id: 'format-check', name: '格式检查', icon: '✅', requiresThesis: true },
    { id: 'terminology', name: '术语分析', icon: '🔤', requiresThesis: true },
    { id: 'review', name: '论文审阅', icon: '🔍', requiresThesis: true },
    { id: 'dashboard', name: '论文看板', icon: '📊', requiresThesis: true },
    { id: 'defense-ppt', name: '答辩PPT', icon: '📊', requiresThesis: false },
    { id: 'en-abstract', name: '英文摘要', icon: '🌐', requiresThesis: false },
  ];

  function renderDefaultToolHome() {
    var home = document.getElementById('toolHome');
    if (!home) return;
    var html = '<div class="tool-home-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;padding:14px">';
    _defaultToolModules.forEach(function(m) {
      html += '<button onclick="TB.getModule(\'shell\') ? switchModule(\'' + m.id + '\') : void 0" style="display:flex;align-items:center;gap:8px;padding:12px 14px;border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--bg-card,#fff);color:var(--text-primary,#111);cursor:pointer;font-size:.78rem;font-weight:500;text-align:left;transition:all .15s;font-family:inherit" onmouseenter="this.style.borderColor=\'var(--accent,#4f46e5)\';this.style.boxShadow=\'0 2px 8px rgba(0,0,0,.06)\'" onmouseleave="this.style.borderColor=\'var(--border,#e5e7eb)\';this.style.boxShadow=\'none\'">' +
        '<span style="font-size:1.2rem">' + esc(m.icon) + '</span>' +
        '<span>' + esc(m.name) + '</span>' +
      '</button>';
    });
    html += '</div>';
    home.innerHTML = html;
  }

  function esc(s) { return String(s || '').replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ── 启动 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── 导出 Shell 函数供全局使用 ──
  window.switchModule = switchModule;
  window.switchView = switchView;
  window.openToolHome = openToolHome;

})();
