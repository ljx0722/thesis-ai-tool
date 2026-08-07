/**
 * ThesisBuddy Nav — 模块导航系统
 * 顶栏标签页点击 → 切换到对应模块
 * 每个模块占据主内容区 (mainContent) 全宽
 */
var Nav = (function() {
  'use strict';

  var _modules = {};
  var _active = null;

  function register(id, config) {
    _modules[id] = {
      name: config.name || id,
      mount: config.mount || null,
      destroy: config.destroy || null,
      visible: config.visible !== false
    };
    // 自动渲染侧边栏项
    renderSidebarItem(id, _modules[id]);
  }

  function navigate(id) {
    if (_active === id || !_modules[id]) return;
    // 销毁当前
    if (_active && _modules[_active] && _modules[_active].destroy) {
      try { _modules[_active].destroy(); } catch(e) { console.warn('[nav] destroy error:', e); }
    }
    _active = id;
    // 清空并挂载
    var mc = document.getElementById('mainContent');
    if (!mc) return;
    mc.innerHTML = '';
    var mod = _modules[id];
    if (mod && mod.mount) {
      try { mod.mount(mc); } catch(e) { console.warn('[nav] mount error:', e); }
    }
    // 更新UI
    updateTabs();
    updateSidebar();
    if (window.TB && TB.state) TB.state.set('currentView', id);
    try { history.pushState({ view: id }, '', '#/' + id); } catch(e) {}
  }

  function updateTabs() {
    document.querySelectorAll('.bar-tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-nav') === _active);
    });
  }

  function updateSidebar() {
    document.querySelectorAll('.nav-item[data-nav]').forEach(function(item) {
      item.classList.toggle('active', item.getAttribute('data-nav') === _active);
    });
  }

  function renderSidebarItem(id, mod) {
    var container = document.getElementById('stageNav');
    if (!container) return;
    var existing = container.querySelector('[data-nav="' + id + '"]');
    if (existing) return;
    var el = document.createElement('button');
    el.className = 'nav-item';
    el.setAttribute('data-nav', id);
    el.textContent = mod.name;
    el.onclick = function() { navigate(id); };
    container.appendChild(el);
  }

  // 初始化
  function init() {
    // 绑定顶栏标签
    document.querySelectorAll('.bar-tab[data-nav]').forEach(function(tab) {
      tab.addEventListener('click', function() {
        navigate(tab.getAttribute('data-nav'));
      });
    });

    // 浏览器后退
    window.addEventListener('popstate', function(e) {
      if (e.state && e.state.view && _modules[e.state.view]) {
        navigate(e.state.view);
      }
    });

    // 注册内置模块
    register('workspace', { name: '总览', mount: mountWorkspace });
    register('literature', { name: '文献', mount: mountCitely });
    register('writing', { name: '写作', mount: mountWriting });
    register('review', { name: '审阅', mount: mountReview });
    register('dashboard', { name: '看板', mount: mountDashboard });
    register('defense', { name: '答辩', mount: mountDefense });

    // 默认打开总览
    navigate('workspace');
  }

  // ── 模块 mount 函数 ──

  function mountWorkspace(container) {
    var hasProject = window.ThesisProject && ThesisProject.getCurrentProject && ThesisProject.getCurrentProject();
    if (hasProject && typeof window.renderWorkspaceHero === 'function') {
      container.innerHTML = '<div id="workspaceContent"></div>';
      setTimeout(function() { window.renderWorkspaceHero(); }, 50);
    } else {
      container.innerHTML = renderEmptyWorkspace();
    }
  }

  function renderEmptyWorkspace() {
    return '<div style="max-width:600px;margin:60px auto;padding:0 20px;text-align:center">' +
      '<div style="font-size:48px;margin-bottom:16px">🎓</div>' +
      '<h2 style="font-size:22px;font-weight:700;margin-bottom:8px;color:var(--text)">欢迎使用论文搭子</h2>' +
      '<p style="color:var(--text-muted);margin-bottom:32px;font-size:14px">AI 论文全流程工作台 — 从想法到答辩通关</p>' +
      '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">' +
        '<button class="btn btn-primary" style="padding:14px 28px;font-size:15px" onclick="typeof openIdeaWizard===\'function\'?openIdeaWizard():null">' +
          '💡 从想法开始</button>' +
        '<button class="btn btn-ghost" style="padding:14px 28px;font-size:15px" onclick="typeof PaperImport!==\'undefined\'?PaperImport.open(\'new\'):typeof openImportDialog===\'function\'?openImportDialog(\'new\'):null">' +
          '📄 导入论文</button>' +
      '</div>' +
      '<div style="margin-top:40px;text-align:left">' +
        '<h3 style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:12px">七个阶段</h3>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">' +
          ['🎯 想清楚：选题打磨','📚 找资料：文献检索','🧭 搭结构：开题大纲','✍️ 写出来：章节扩写','🔍 改得好：格式审阅','📊 过评审：论文看板','🎤 做答辩：PPT+摘要'].map(function(s){
            var parts = s.split('：');
            return '<div class="card" style="padding:12px">' +
              '<div style="font-size:20px;margin-bottom:4px">' + parts[0].split(' ')[0] + '</div>' +
              '<div style="font-size:13px;font-weight:600;color:var(--text)">' + parts[0].split(' ')[1] + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted)">' + parts[1] + '</div></div>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function mountCitely(container) {
    container.innerHTML = '<div id="citelyContainer"></div>';
    var projData = {};
    if (window.ThesisProject && ThesisProject.getCurrentProject) {
      try {
        var p = ThesisProject.getCurrentProject();
        if (p) {
          projData.keywords = p.keywords || '';
          projData.chapters = (p.chapters || []).map(function(ch) {
            return { id: ch.id || ch.title || ch, title: ch.title || ch };
          });
        }
      } catch(e) {}
    }
    if (typeof Citely !== 'undefined') Citely.mount('citelyContainer', projData);
  }

  function mountWriting(container) {
    if (typeof WritingModule !== 'undefined') {
      WritingModule.mount(container);
    } else {
      container.innerHTML = '<div class="empty-state">' +
        '<div class="empty-state-icon">✍️</div><h3>论文写作</h3><p>请先导入论文或创建大纲</p>' +
        '<button class="btn btn-primary" onclick="typeof openImportDialog===\'function\'?openImportDialog(\'new\'):null">📄 导入论文</button></div>';
    }
  }

  function mountReview(container) {
    if (typeof ReviewModule !== 'undefined') {
      ReviewModule.mount(container);
    } else {
      container.innerHTML = '<div class="empty-state">' +
        '<div class="empty-state-icon">🔍</div><h3>论文审阅</h3><p>请先导入论文</p></div>';
    }
  }

  function mountDashboard(container) {
    var hasEssay = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100;
    if (!hasEssay) {
      container.innerHTML = '<div class="empty-state">' +
        '<div class="empty-state-icon">📊</div><h3>论文看板</h3><p>导入论文后可查看综合评估</p></div>';
      return;
    }
    // 内嵌看板
    container.innerHTML = '<div id="dashboardInline"></div>';
    container.style.overflow = 'auto';
    if (typeof buildDashboardHTML === 'function') {
      try {
        var el = document.getElementById('dashboardInline');
        if (el) el.innerHTML = buildDashboardHTML();
      } catch(e) {
        container.innerHTML = '<div class="empty-state"><p>看板加载中...</p></div>';
      }
    }
  }

  function mountDefense(container) {
    container.innerHTML = '<div style="max-width:700px;margin:40px auto;padding:20px">' +
      '<h2 style="font-size:20px;font-weight:700;margin-bottom:20px">🎤 答辩准备</h2>' +
      '<div class="card-grid">' +
        '<div class="card" style="cursor:pointer;text-align:center;padding:24px" onclick="typeof window.openDefensePack===\'function\'?window.openDefensePack():null">' +
          '<div style="font-size:32px;margin-bottom:8px">📊</div>' +
          '<div style="font-size:15px;font-weight:700">答辩PPT</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">AI 生成答辩大纲与讲稿</div>' +
        '</div>' +
        '<div class="card" style="cursor:pointer;text-align:center;padding:24px" onclick="Nav.navigate(\'review\')">' +
          '<div style="font-size:32px;margin-bottom:8px">🔍</div>' +
          '<div style="font-size:15px;font-weight:700">论文审阅</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">定位风险与证据缺口</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ── 公开 API ──
  return {
    init: init,
    register: register,
    navigate: navigate,
    get active() { return _active; },
    get modules() { return _modules; }
  };
})();

// 向下兼容：保留 switchModule / switchView 供旧代码调用
window.switchModule = function(id) {
  var map = { references: 'literature', refs: 'literature', tools: 'workspace' };
  Nav.navigate(map[id] || id);
};
window.switchView = function(view) {
  var map = { workspace: 'workspace', refs: 'literature', tools: 'workspace', dashboard: 'dashboard' };
  Nav.navigate(map[view] || view);
};
