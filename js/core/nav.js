(function () {
  'use strict';

  var current = { surface: 'home', milestone: 'prepare', module: '', projectId: '' };
  var initialized = false;
  var historyLock = false;
  var aliases = {
    workspace: 'home', prepare: 'milestone', writing: 'milestone', polish: 'milestone', finish: 'milestone',
    paper: 'paper', thesis: 'paper', tools: 'tools', refs: 'references', literature: 'references'
  };

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function project() {
    return window.ThesisProject && ThesisProject.getCurrentProject ? ThesisProject.getCurrentProject() : null;
  }
  function hasManuscript() {
    return typeof manuscriptText !== 'undefined' && String(manuscriptText || '').replace(/\s+/g, '').length > 100;
  }
  function setVisible(el, visible) {
    if (!el) return;
    el.hidden = !visible;
    el.style.display = visible ? '' : 'none';
  }
  function emit() {
    if (window.TB && TB.state) {
      TB.state.set('currentView', current.surface);
      TB.state.set('currentModule', current.module || null);
    }
    if (window.TB && TB.events) TB.events.emit('route:changed', copy(current));
    try { window.dispatchEvent(new CustomEvent('thesisbuddy-route-changed', { detail: copy(current) })); } catch (e) {}
  }
  function routeHash(route) {
    var parts = ['#', route.surface || 'home'];
    if (route.surface === 'milestone') parts.push(route.milestone || 'prepare');
    if (route.surface === 'module') parts.push(route.module || '');
    return parts.join('/');
  }
  function parseHash() {
    var parts = String(location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!parts.length) return null;
    if (parts[0] === 'milestone') return { surface: 'milestone', milestone: parts[1] || 'prepare' };
    if (parts[0] === 'module') return { surface: 'module', module: parts[1] || '' };
    if (['home', 'paper', 'tools', 'buddy', 'import-result'].indexOf(parts[0]) >= 0) return { surface: parts[0] };
    if (['prepare', 'writing', 'polish', 'finish'].indexOf(parts[0]) >= 0) return { surface: 'milestone', milestone: parts[0] };
    return { surface: 'module', module: parts[0] };
  }
  function commitHistory(replace) {
    if (historyLock) return;
    try {
      var method = replace ? 'replaceState' : 'pushState';
      history[method]({ thesisRoute: copy(current) }, '', routeHash(current));
    } catch (e) {}
  }

  function updateNavigation() {
    document.querySelectorAll('[data-route-surface]').forEach(function (button) {
      var active = button.getAttribute('data-route-surface') === current.surface;
      button.classList.toggle('active', active);
      if (button.getAttribute('role') === 'tab') button.setAttribute('aria-selected', active ? 'true' : 'false');
      if (button.classList.contains('mobile-nav-item')) button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    document.querySelectorAll('[data-milestone]').forEach(function (button) {
      var id = button.getAttribute('data-milestone');
      var active = id === current.milestone && (current.surface === 'milestone' || current.surface === 'home' || current.surface === 'module');
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'step' : 'false');
    });
    var title = document.getElementById('contentTitle');
    if (title) {
      var label = '项目主页';
      if (current.surface === 'paper') label = '论文正文';
      if (current.surface === 'tools') label = '全部工具';
      if (current.surface === 'buddy') label = '论文搭子';
      if (current.surface === 'import-result') label = '导入结果';
      if (current.surface === 'milestone') {
        var ms = window.ThesisCapabilities && ThesisCapabilities.milestones.find(function (m) { return m.id === current.milestone; });
        label = ms ? ms.name : '阶段';
      }
      if (current.surface === 'module') {
        var cap = window.ThesisCapabilities && ThesisCapabilities.get(current.module);
        label = cap ? cap.name : '工具';
      }
      title.textContent = label;
    }
  }

  function showShellSurface(surface) {
    var home = document.getElementById('workspaceContent');
    var thesis = document.getElementById('thesisBox');
    var focus = document.getElementById('focusSurface');
    var tools = document.getElementById('toolCatalogSurface');
    var importResult = document.getElementById('importResultSurface');
    var toolPanel = document.getElementById('refPanel');
    var toc = document.getElementById('tocPanel');

    setVisible(home, surface === 'home' || surface === 'milestone');
    setVisible(focus, surface === 'module' || surface === 'buddy');
    setVisible(tools, surface === 'tools');
    setVisible(importResult, surface === 'import-result');

    if (thesis) {
      var paperActive = surface === 'paper';
      thesis.style.display = (surface === 'home' || surface === 'milestone' || paperActive) ? '' : 'none';
      Array.prototype.forEach.call(thesis.children, function (child) {
        if (child === home) child.style.display = (surface === 'home' || surface === 'milestone') ? '' : 'none';
        else child.style.display = paperActive ? '' : 'none';
      });
      var toolbar = document.getElementById('paperToolbar');
      if (toolbar) { toolbar.hidden = !paperActive; toolbar.style.display = paperActive ? '' : 'none'; }
    }
    if (toc) toc.classList.toggle('is-paper-active', surface === 'paper');
    if (toolPanel) toolPanel.classList.toggle('is-context-visible', surface === 'module' && window.innerWidth >= 1180);
  }

  function renderHome() {
    if (window.ThesisProject && ThesisProject.renderWorkspaceHero) ThesisProject.renderWorkspaceHero();
  }

  function renderMilestone() {
    var host = document.getElementById('workspaceContent');
    if (!host) return;
    var p = project();
    if (!p) { renderHome(); return; }
    if (window.ThesisProject && ThesisProject.renderMilestoneHome) {
      ThesisProject.renderMilestoneHome(current.milestone);
      return;
    }
    renderHome();
  }

  function renderTools() {
    var host = document.getElementById('toolCatalogSurface');
    if (!host || !window.ThesisCapabilities) return;
    var html = '<div class="catalog-head"><div><h2>全部工具</h2><p>按论文阶段查找能力。打开工具只检查可用性，实际执行时才计点。</p></div><button type="button" class="btn btn-ghost" onclick="ThesisRouter.openMobileToolDrawer()">筛选工具</button></div>';
    ThesisCapabilities.milestones.forEach(function (ms) {
      var items = ThesisCapabilities.forMilestone(ms.id);
      html += '<section class="catalog-section"><div class="catalog-section-head"><span class="catalog-step">' + ms.icon + '</span><div><h3>' + ms.name + '</h3><p>' + ms.description + '</p></div></div><div class="catalog-list">';
      items.forEach(function (item) {
        html += '<button type="button" class="catalog-item" onclick="ThesisRouter.openModule(\'' + item.id + '\')"><span class="catalog-icon">' + item.icon + '</span><span><strong>' + item.name + '</strong><small>' + (item.requiresManuscript ? '需要论文正文' : item.requiresProject ? '基于当前项目' : '可直接使用') + '</small></span><span class="catalog-arrow">→</span></button>';
      });
      html += '</div></section>';
    });
    host.innerHTML = html;
  }

  function showModuleEmpty(host, title, message, primaryLabel, action) {
    host.innerHTML = '<div class="route-empty"><div class="route-empty-mark">↗</div><h2>' + title + '</h2><p>' + message + '</p><button type="button" class="btn btn-primary" onclick="' + action + '">' + primaryLabel + '</button></div>';
  }

  function mountRunner(host, item, requestedId) {
    var canonical = window.ThesisCapabilities ? ThesisCapabilities.canonical(requestedId) : item;
    if (!canonical) return;
    if (canonical.presentation === 'modal' && canonical.runner && typeof window[canonical.runner] === 'function') {
      window[canonical.runner]();
      return;
    }
    if (canonical.action && typeof window[canonical.action] === 'function') {
      window[canonical.action]();
      return;
    }
    if (canonical.id === 'references') {
      var workbench = document.getElementById('literatureWorkbench');
      if (workbench) {
        host.appendChild(workbench);
        workbench.style.display = 'flex';
        workbench.classList.remove('ref-only');
      }
      if (window.LiteratureWorkbench && LiteratureWorkbench.show) LiteratureWorkbench.show();
      else if (window.LiteratureWorkbench && LiteratureWorkbench.render) LiteratureWorkbench.render();
      return;
    }
    if (canonical.runner === 'WritingModule' && window.WritingModule) { WritingModule.mount(host); return; }
    if (canonical.runner === 'IdeationModule' && window.IdeationModule) {
      IdeationModule.mount(host);
      if (item && item.tab === 'outline') IdeationModule.switchTab('outline');
      return;
    }
    if (canonical.runner === 'HealthCheckModule' && window.HealthCheckModule) {
      HealthCheckModule.mount(host);
      if (item && item.check) setTimeout(function () { HealthCheckModule.runCheck(item.check); }, 0);
      return;
    }
    if (canonical.runner === 'ReviewModule' && window.ReviewModule) { ReviewModule.mount(host); return; }
    if (canonical.runner && typeof window[canonical.runner] === 'function') {
      window[canonical.runner](host);
      return;
    }
    showModuleEmpty(host, canonical.name, '该工具脚本尚未完成加载，请刷新后重试。', '返回工具目录', "ThesisRouter.go('tools')");
  }

  function renderModule() {
    var item = window.ThesisCapabilities && ThesisCapabilities.get(current.module);
    var host = document.getElementById('focusSurface');
    if (!host) return;
    host.innerHTML = '';
    if (!item) {
      showModuleEmpty(host, '未找到工具', '这个入口已失效，工具目录中仍保留全部可用能力。', '查看全部工具', "ThesisRouter.go('tools')");
      return;
    }
    current.milestone = item.milestone || current.milestone;
    var p = project();
    if (item.requiresProject && !p) {
      showModuleEmpty(host, item.name, '先创建或导入一个论文项目，系统才能保存这项能力产生的内容。', '创建项目', 'openIdeaWizard()');
      return;
    }
    if (item.requiresManuscript && !hasManuscript()) {
      showModuleEmpty(host, item.name, '这项能力需要论文正文。你可以导入 DOCX，或先完成分章草稿后合并到正文。', '导入论文', "openImportDialog('new')");
      return;
    }
    host.innerHTML = '<div class="route-loading" role="status"><span></span>正在打开' + item.name + '…</div>';
    var launch = function () { host.innerHTML = ''; mountRunner(host, item, current.module); };
    var canonical = ThesisCapabilities.canonical(current.module) || item;
    if (typeof preflightCapability === 'function' && canonical.id && canonical.presentation !== 'modal' && !canonical.action) {
      preflightCapability(canonical.id, { action: 'open' }).then(function (info) {
        if (info && info.ok === false && (info.state === 'blocked' || info.state === 'unavailable')) {
          showModuleEmpty(host, item.name, info.error || info.message || '当前能力不可用。', info.needRecharge ? '去充值' : '返回工具目录', info.needRecharge ? 'showRechargeModal()' : "ThesisRouter.go('tools')");
          return;
        }
        launch();
        if (info && typeof renderCapabilityNotice === 'function') renderCapabilityNotice(host, info);
      }).catch(launch);
    } else launch();
  }

  function renderBuddy() {
    var host = document.getElementById('focusSurface');
    if (!host) return;
    host.innerHTML = '';
    if (window.BuddyAssistant && BuddyAssistant.mount) BuddyAssistant.mount(host);
    else showModuleEmpty(host, '论文搭子', '助手正在加载，请稍后重试。', '返回主页', "ThesisRouter.go('home')");
  }

  function renderImportResult() {
    if (window.ThesisProject && ThesisProject.renderImportResult) ThesisProject.renderImportResult();
  }

  function render() {
    showShellSurface(current.surface);
    updateNavigation();
    if (current.surface === 'home') renderHome();
    else if (current.surface === 'milestone') renderMilestone();
    else if (current.surface === 'tools') renderTools();
    else if (current.surface === 'module') renderModule();
    else if (current.surface === 'buddy') renderBuddy();
    else if (current.surface === 'import-result') renderImportResult();
    else if (current.surface === 'paper' && !hasManuscript()) {
      var p = project();
      current.surface = 'home';
      renderHome();
      if (typeof ttp === 'function') ttp(p ? '当前项目还没有正文' : '请先创建或导入项目');
    }
    closeMobileToolDrawer();
    emit();
  }

  function go(target, options) {
    options = options || {};
    var next = typeof target === 'string' ? { surface: aliases[target] || target } : (target || {});
    if (typeof target === 'string' && ['prepare', 'writing', 'polish', 'finish'].indexOf(target) >= 0) next = { surface: 'milestone', milestone: target };
    current = Object.assign({}, current, next);
    var p = project();
    current.projectId = p && p.id || '';
    if (!options.fromHistory) commitHistory(!!options.replace);
    render();
    return copy(current);
  }
  function openModule(id, options) {
    var item = window.ThesisCapabilities && ThesisCapabilities.get(id);
    return go({ surface: 'module', module: id, milestone: item && item.milestone || current.milestone }, options);
  }
  function openMobileToolDrawer() {
    var drawer = document.getElementById('mobileToolDrawer');
    var backdrop = document.getElementById('mobileDrawerBackdrop');
    if (drawer) { drawer.hidden = false; drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); }
    if (backdrop) { backdrop.hidden = false; backdrop.classList.add('open'); }
    document.body.classList.add('mobile-drawer-open');
  }
  function closeMobileToolDrawer() {
    var drawer = document.getElementById('mobileToolDrawer');
    var backdrop = document.getElementById('mobileDrawerBackdrop');
    if (drawer) { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); setTimeout(function () { if (!drawer.classList.contains('open')) drawer.hidden = true; }, 180); }
    if (backdrop) { backdrop.classList.remove('open'); setTimeout(function () { if (!backdrop.classList.contains('open')) backdrop.hidden = true; }, 180); }
    document.body.classList.remove('mobile-drawer-open');
  }
  function renderMobileTools() {
    var body = document.getElementById('mobileToolDrawerBody');
    if (!body || !window.ThesisCapabilities) return;
    body.innerHTML = ThesisCapabilities.milestones.map(function (ms) {
      return '<section><h3><span>' + ms.icon + '</span>' + ms.name + '</h3>' + ThesisCapabilities.forMilestone(ms.id).map(function (item) {
        return '<button type="button" onclick="ThesisRouter.openModule(\'' + item.id + '\')"><span>' + item.icon + '</span><span><strong>' + item.name + '</strong><small>' + (item.requiresManuscript ? '需要正文' : item.requiresProject ? '当前项目' : '可直接使用') + '</small></span></button>';
      }).join('') + '</section>';
    }).join('');
  }

  function init() {
    if (initialized) return;
    initialized = true;
    renderMobileTools();
    window.addEventListener('popstate', function (event) {
      var route = event.state && event.state.thesisRoute ? event.state.thesisRoute : parseHash();
      if (!route) return;
      historyLock = true;
      go(route, { fromHistory: true });
      historyLock = false;
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900) closeMobileToolDrawer();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMobileToolDrawer();
    });
    var initial = parseHash();
    go(initial || { surface: 'home' }, { replace: true });
  }

  window.ThesisRouter = {
    init: init,
    go: go,
    openModule: openModule,
    openMobileToolDrawer: openMobileToolDrawer,
    closeMobileToolDrawer: closeMobileToolDrawer,
    render: render,
    get current() { return copy(current); }
  };

  window.Nav = {
    init: init,
    navigate: function (id) {
      if (['prepare', 'writing', 'polish', 'finish'].indexOf(id) >= 0) return go({ surface: 'milestone', milestone: id });
      return openModule(id);
    },
    renderDashboard: function () { return go('home', { replace: true }); },
    switchToolTab: function (id) { return id === 'buddy' ? go('buddy') : openModule(id === 'inspect' ? 'health-check' : id === 'review' ? 'review' : 'references'); },
    toggleToolPanel: openMobileToolDrawer,
    get currentMilestone() { return current.milestone; }
  };
  window.switchModule = function (id) { return openModule(id); };
  window.switchView = function (view) {
    var mapped = aliases[view] || view;
    if (mapped === 'references') return openModule('references');
    return go(mapped);
  };
  window._open = function (id) { return openModule(id); };
  window._restoreWorkspace = function () { return go('home'); };
  window.openToolHome = function () { return go('tools'); };
  window.openBuddyAssistant = function () { return go('buddy'); };
})();
