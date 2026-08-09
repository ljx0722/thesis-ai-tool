/**
 * ThesisBuddy Nav — 4-milestone routing
 * Replaces featree.js _open() and old switchModule/switchView
 */
(function() {
  'use strict';
  if (window.Nav) return;
  var _activeModule = null;
  var _currentMilestone = 'prepare';
  var _modules = {};
  var _tabs = {};

  var MILESSTONES = [
    { id: 'prepare', name: '准备', modules: ['ideation','topic-finder','proposal','citely','knowledge-graph'] },
    { id: 'writing',  name: '写作', modules: ['writing-workbench','expand','data-analysis'] },
    { id: 'polish',   name: '打磨', modules: ['health-check','proofread','de-duplicate','format-check','terminology','paragraph','review'] },
    { id: 'finish',   name: '收尾', modules: ['defense-ppt','en-abstract','dashboard'] }
  ];

  function milestoneName(id) {
    for (var i = 0; i < MILESSTONES.length; i++) {
      if (MILESSTONES[i].id === id) return MILESSTONES[i].name;
    }
    return id;
  }

  function milestoneOf(moduleId) {
    for (var i = 0; i < MILESSTONES.length; i++) {
      if (MILESSTONES[i].modules.indexOf(moduleId) >= 0) return MILESSTONES[i].id;
    }
    return 'prepare';
  }

  function register(id, opts) {
    _modules[id] = { id: id, name: opts.name || id, icon: opts.icon || '', mount: opts.mount, destroy: opts.destroy, milestone: opts.milestone || milestoneOf(id) };
  }

  function registerTab(tabId, opts) {
    _tabs[tabId] = { id: tabId, name: opts.name || tabId, icon: opts.icon || '', mount: opts.mount, destroy: opts.destroy };
  }

  function navigate(id) {
    if (_activeModule === id) return;

    if (_activeModule && _modules[_activeModule] && _modules[_activeModule].destroy) {
      try { _modules[_activeModule].destroy(); } catch(e) {}
    }

    _activeModule = id;
    var mod = _modules[id];
    var isMilestone = !!MILESSTONES.find(function(m) { return m.id === id; });
    _currentMilestone = isMilestone ? id : (mod ? mod.milestone : 'prepare');

    updateSidebar(_currentMilestone);
    updateContentToolbar(id);

    if (isMilestone) {
      renderMilestoneLanding(id);
    } else if (mod && mod.mount) {
      var body = document.getElementById('contentBody');
      if (body) mod.mount(body);
    } else if (typeof window._open === 'function') {
      window._open(id);
    }

    if (window.TB && TB.state) TB.state.set('currentView', id);
    try { history.replaceState({ view: id }, '', '#/' + id); } catch(e) {}
  }

  function switchToolTab(tabId) {
    var panel = document.getElementById('toolPanel');
    if (panel) panel.classList.remove('collapsed');
    document.querySelectorAll('.tool-panel-tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    var body = document.getElementById('toolPanelBody');
    if (!body) return;
    Object.keys(_tabs).forEach(function(k) {
      if (_tabs[k].destroy && k !== tabId) { try { _tabs[k].destroy(); } catch(e) {} }
    });
    var tab = _tabs[tabId];
    if (tab && tab.mount) tab.mount(body);
  }

  function toggleToolPanel() {
    var panel = document.getElementById('toolPanel');
    if (panel) panel.classList.toggle('collapsed');
  }

  function updateSidebar(milestoneId) {
    document.querySelectorAll('.sidebar-milestone').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-milestone') === milestoneId);
    });
  }

  function updateContentToolbar(moduleId) {
    var titleEl = document.getElementById('contentTitle');
    var breadEl = document.getElementById('contentBreadcrumb');
    var mod = _modules[moduleId];
    if (titleEl) titleEl.textContent = mod ? mod.name : milestoneName(_currentMilestone);
    if (breadEl) {
      breadEl.innerHTML = '<span onclick="Nav.navigate(\'prepare\')" style="cursor:pointer">论文搭子</span>' +
        '<span style="color:var(--text-muted)">/</span>' +
        '<span>' + milestoneName(_currentMilestone) + '</span>' +
        (mod ? '<span style="color:var(--text-muted)">/</span><span>' + mod.name + '</span>' : '');
    }
  }

  function renderMilestoneLanding(milestoneId) {
    var body = document.getElementById('contentBody');
    if (!body) return;
    var ms = MILESSTONES.find(function(m) { return m.id === milestoneId; });
    if (!ms) return;
    var h = '<div class="milestone-landing">' +
      '<h2>' + ms.name + '</h2>' +
      '<p>选择一项功能开始</p>' +
      '<div class="milestone-grid">';
    ms.modules.forEach(function(mid) {
      var mod = _modules[mid];
      if (!mod) return;
      h += '<button class="milestone-card" onclick="Nav.navigate(\''+mid+'\')">'+
        '<span class="milestone-card-icon">'+mod.icon+'</span>'+
        '<span class="milestone-card-title">'+mod.name+'</span>'+
        '</button>';
    });
    h += '</div></div>';
    body.innerHTML = h;
  }

  function renderWorkspaceWelcome() {
    var body = document.getElementById('contentBody');
    if (!body) return;
    var h = '<div class="welcome-hero">'+
      '<div class="welcome-hero-icon">📋</div>'+
      '<h2>欢迎使用论文搭子</h2>'+
      '<p>选一种方式开始你的论文之旅</p>'+
      '<div class="welcome-cards">'+
        '<button class="welcome-card welcome-card-primary" onclick="openIdeaWizard()">'+
          '<span class="welcome-card-icon">💡</span>'+
          '<span class="welcome-card-title">从想法开始</span>'+
          '<span class="welcome-card-desc">准备→写作→打磨→收尾，4个里程碑逐步推进</span>'+
        '</button>'+
        '<button class="welcome-card" onclick="if(typeof openImportDialog===\'function\')openImportDialog(\'new\')">'+
          '<span class="welcome-card-icon">📄</span>'+
          '<span class="welcome-card-title">导入论文</span>'+
          '<span class="welcome-card-desc">已有 DOCX 论文？导入后体检、审阅、打磨</span>'+
        '</button>'+
      '</div>'+
      '<p class="welcome-hint">按 <kbd>Ctrl+K</kbd> 搜索功能 · 按 <kbd>Ctrl+B</kbd> 召唤论文搭子</p>'+
      '</div>';
    body.innerHTML = h;
  }

  function init() {
    MILESSTONES.forEach(function(ms) {
      register(ms.id, { name: ms.name, milestone: ms.id });
    });
    registerTab('references', { name: '参考文献', mount: function(c) { if (typeof switchPanel === 'function') switchPanel('references'); } });
    registerTab('buddy', { name: '论文搭子', mount: function(c) { c.innerHTML = '<div id="buddyInlineChat" style="display:flex;flex-direction:column;height:100%"><div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:var(--text-sm)">论文搭子助手 — 在此提问</div></div>'; } });
    registerTab('inspect', { name: '检查', mount: function(c) { if (typeof HealthCheckModule !== 'undefined') HealthCheckModule.mount(c); } });
    registerTab('review', { name: '审阅', mount: function(c) { if (typeof ReviewModule !== 'undefined') ReviewModule.mount(c); } });
    renderWorkspaceWelcome();
  }

  // Backward compat
  window.switchModule = function(id) {
    var map = { references:'references', refs:'references', literature:'references', tools:'prepare', dashboard:'dashboard', 'knowledge-graph':'knowledge-graph', citely:'citely' };
    navigate(map[id] || id);
  };
  window.switchView = function(view) {
    var map = { workspace:'prepare', refs:'references', tools:'prepare', dashboard:'dashboard', writing:'writing-workbench', review:'review', defense:'defense-ppt', polish:'health-check' };
    navigate(map[view] || view);
  };
  window.switchToolTab = switchToolTab;
  window.toggleToolPanel = toggleToolPanel;

  window.Nav = { init:init, navigate:navigate, register:register, registerTab:registerTab, renderWorkspaceWelcome:renderWorkspaceWelcome, toggleToolPanel:toggleToolPanel, switchToolTab:switchToolTab,
    get active() { return _activeModule; },
    get currentMilestone() { return _currentMilestone; },
    get modules() { return _modules; }
  };
})();
