/**
 * ThesisBuddy Nav — thin routing layer
 * Authority: app-modules.js switchModule() is the ONE entry point.
 * This file: sidebar milestones, tool panel tabs, welcome page, backward compat.
 */
(function() {
  'use strict';
  if (window.Nav) return;

  var MILESSTONES = [
    { id: 'prepare', name: '准备', modules: ['ideation','topic-finder','proposal','citely','knowledge-graph'] },
    { id: 'writing',  name: '写作', modules: ['writing-workbench','expand','data-analysis'] },
    { id: 'polish',   name: '打磨', modules: ['health-check','review','de-duplicate'] },
    { id: 'finish',   name: '收尾', modules: ['defense-ppt','en-abstract','dashboard'] }
  ];

  var _currentMilestone = 'prepare';

  function navigate(id) {
    // Is it a milestone?
    var ms = MILESSTONES.find(function(m) { return m.id === id; });
    if (ms) { _currentMilestone = id; updateSidebar(id); renderMilestoneLanding(id); return; }
    // Delegate to the ONE dispatcher
    if (typeof switchModule === 'function') { switchModule(id); }
    _currentMilestone = milestoneOf(id);
    updateSidebar(_currentMilestone);
  }

  function switchToolTab(tabId) {
    var panel = document.getElementById('toolPanel');
    if (panel) panel.classList.remove('collapsed');
    document.querySelectorAll('.tool-panel-tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    var body = document.getElementById('toolPanelBody');
    if (!body) return;
    if (tabId === 'references' && typeof switchPanel === 'function') switchPanel('references');
    else if (tabId === 'inspect' && typeof HealthCheckModule !== 'undefined') HealthCheckModule.mount(body);
    else if (tabId === 'review' && typeof ReviewModule !== 'undefined') ReviewModule.mount(body);
    else if (tabId === 'buddy' && typeof BuddyAssistant !== 'undefined') BuddyAssistant.mount(body);
  }

  function toggleToolPanel() {
    var panel = document.getElementById('toolPanel');
    if (panel) panel.classList.toggle('collapsed');
  }

  function milestoneOf(id) {
    for (var i = 0; i < MILESSTONES.length; i++) {
      if (MILESSTONES[i].modules.indexOf(id) >= 0) return MILESSTONES[i].id;
    }
    return 'prepare';
  }

  function updateSidebar(msId) {
    document.querySelectorAll('.sidebar-milestone').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-milestone') === msId);
    });
  }

  function renderMilestoneLanding(msId) {
    var body = document.getElementById('contentBody');
    if (!body) return;
    var ms = MILESSTONES.find(function(m) { return m.id === msId; });
    if (!ms) return;
    var h = '<div class="milestone-landing"><h2>'+ms.name+'</h2><p>选择一项功能开始</p><div class="milestone-grid">';
    ms.modules.forEach(function(mid) {
      h += '<button class="milestone-card" onclick="Nav.navigate(\''+mid+'\')">'+
        '<span class="milestone-card-icon">&#x1F4C4;</span>'+
        '<span class="milestone-card-title">'+mid+'</span></button>';
    });
    h += '</div></div>';
    body.innerHTML = h;
  }

  function renderWelcome() {
    var body = document.getElementById('contentBody');
    if (!body) return;
    body.innerHTML = '<div class="welcome-hero"><div class="welcome-hero-icon">&#x1F4CB;</div>'+
      '<h2>欢迎使用论文搭子</h2><p>选一种方式开始你的论文之旅</p>'+
      '<div class="welcome-cards">'+
        '<button class="welcome-card welcome-card-primary" onclick="openIdeaWizard()">'+
          '<span class="welcome-card-icon">&#x1F4A1;</span>'+
          '<span class="welcome-card-title">从想法开始</span>'+
          '<span class="welcome-card-desc">准备→写作→打磨→收尾，4个里程碑逐步推进</span></button>'+
        '<button class="welcome-card" onclick="openImportDialog(\'new\')">'+
          '<span class="welcome-card-icon">&#x1F4C4;</span>'+
          '<span class="welcome-card-title">导入论文</span>'+
          '<span class="welcome-card-desc">已有 DOCX 论文？导入后体检、审阅、打磨</span></button>'+
      '</div>'+
      '<p class="welcome-hint">按 <kbd>Ctrl+K</kbd> 全局搜索功能 · 右侧面板切换文献/搭子/检查/审阅</p></div>';
  }

  function init() {
    updateSidebar('prepare');
    renderWelcome();
  }

  // Backward compat wrappers — delegate to app-modules.js
  window._open = function(id) {
    if (typeof switchModule === 'function') switchModule(id);
  };
  window.switchModule = function(id) {
    var map = { references:'references', refs:'references', literature:'references', tools:'prepare', dashboard:'dashboard', citely:'citely' };
    navigate(map[id] || id);
  };
  window.switchView = function(view) {
    var map = { workspace:'prepare', refs:'references', tools:'prepare', dashboard:'dashboard', writing:'writing-workbench', review:'review', defense:'defense-ppt', polish:'health-check' };
    navigate(map[view] || view);
  };
  window.switchToolTab = switchToolTab;
  window.toggleToolPanel = toggleToolPanel;

  window.Nav = { init:init, navigate:navigate, renderWelcome:renderWelcome, toggleToolPanel:toggleToolPanel, switchToolTab:switchToolTab,
    get currentMilestone() { return _currentMilestone; }
  };
})();
