/**
 * ThesisBuddy Nav — 4-milestone dashboard routing
 * Renders dashboard cards into .stage-dashboard + paper preview into .stage-paper
 */
(function() {
  'use strict';
  if (window.Nav) return;

  var MILESSTONES = [
    { id: 'prepare', name: '准备', modules: ['ideation','citely','knowledge-graph','proposal'] },
    { id: 'writing',  name: '写作', modules: ['writing-workbench','expand','data-analysis'] },
    { id: 'polish',   name: '打磨', modules: ['health-check','review','de-duplicate'] },
    { id: 'finish',   name: '收尾', modules: ['defense-ppt','en-abstract','dashboard'] }
  ];

  var _currentMilestone = 'prepare';

  function navigate(id) {
    var isMilestone = MILESSTONES.find(function(m) { return m.id === id; });
    if (isMilestone) {
      _currentMilestone = id;
      updateSidebar(id);
      renderDashboard(id);
    } else if (typeof switchModule === 'function') {
      switchModule(id);
    }
    try { history.replaceState({ view: id }, '', '#/' + id); } catch(e) {}
  }

  // ── Dashboard Renderers ──

  function getProject() {
    if (window.ThesisProject && ThesisProject.getCurrentProject) return ThesisProject.getCurrentProject();
    return null;
  }

  function getPaper() {
    return {
      has: typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 50,
      text: (typeof manuscriptText !== 'undefined' && manuscriptText) || '',
      sections: (typeof sections !== 'undefined' && sections) || [],
      refs: (typeof existingRefs !== 'undefined' && existingRefs) || [],
      wordCount: (typeof manuscriptText !== 'undefined' && manuscriptText) ? manuscriptText.length : 0,
      chCount: (typeof sections !== 'undefined' && sections) ? sections.filter(function(s) { return s.title && typeof isBodyChapter === 'function' && isBodyChapter(s); }).length : 0
    };
  }

  function renderDashboard(msId) {
    var el = document.getElementById('stageDashboard');
    if (!el) return;
    var ms = MILESSTONES.find(function(m) { return m.id === msId; });
    if (!ms) return;

    var proj = getProject();
    var paper = getPaper();
    var h = '';

    if (!proj && !paper.has) {
      h += '<div class="welcome-hero">' +
        '<div class="welcome-hero-icon">📋</div><h2>欢迎使用论文搭子</h2>' +
        '<p>选一种方式开始你的论文之旅</p>' +
        '<div class="welcome-cards">' +
          '<button class="welcome-card welcome-card-primary" onclick="openIdeaWizard()">' +
            '<span class="welcome-card-icon">💡</span>' +
            '<span class="welcome-card-title">从想法开始</span>' +
            '<span class="welcome-card-desc">准备→写作→打磨→收尾，4个里程碑逐步推进</span></button>' +
          '<button class="welcome-card" onclick="openImportDialog(\'new\')">' +
            '<span class="welcome-card-icon">📄</span>' +
            '<span class="welcome-card-title">导入论文</span>' +
            '<span class="welcome-card-desc">已有 DOCX 论文？导入后体检、审阅、打磨</span></button>' +
        '</div><p class="welcome-hint">按 <kbd>Ctrl+K</kbd> 搜索功能</p></div>';
      el.innerHTML = h;
    } else {
      h += '<h2>' + ms.name + '</h2>';
      h += '<p class="stage-dashboard-sub">' + (proj && proj.title ? '当前项目：' + proj.title : paper.has ? '已加载论文 (' + paper.wordCount + ' 字)' : '') + '</p>';
      h += '<div class="stage-dashboard-grid">';

      if (msId === 'prepare') h += renderPrepare(proj, paper);
      else if (msId === 'writing') h += renderWriting(proj, paper);
      else if (msId === 'polish') h += renderPolish(proj, paper);
      else if (msId === 'finish') h += renderFinalize(proj, paper);

      h += '</div>';
      el.innerHTML = h;
    }
  }

  function card(title, desc, icon, action, stat, statLabel) {
    var h = '<div class="stage-dashboard-card"';
    if (action) h += ' onclick="' + action + '"';
    h += '><div class="stage-dashboard-card-title">' + (icon || '') + ' ' + title + '</div>';
    if (desc) h += '<div class="stage-dashboard-card-desc">' + desc + '</div>';
    if (stat != null) h += '<div class="stage-dashboard-card-stat">' + stat + '</div>';
    if (statLabel) h += '<div class="stage-dashboard-card-stat-label">' + statLabel + '</div>';
    if (action) h += '<div class="stage-dashboard-card-action">进入</div>';
    h += '</div>';
    return h;
  }

  // ── Prepare Dashboard ──
  function renderPrepare(proj, paper) {
    var h = '';
    h += card('选题探索', proj && proj.title ? '当前选题：' + proj.title.substring(0,40) : '从研究方向生成可行选题', '🔍',
      "Nav.navigate('ideation')", null, null);

    var refCount = paper.refs.length;
    h += card('文献调研', refCount > 0 ? '已收集 ' + refCount + ' 篇文献' : '搜索并管理参考文献', '📚',
      "Nav.navigate('citely')", refCount || '—', refCount > 0 ? '篇文献' : '');

    var chCount = paper.chCount;
    h += card('论文大纲', chCount > 0 ? '已解析 ' + chCount + ' 章' : '生成或提取论文章节大纲', '🧭',
      "Nav.navigate('proposal')", chCount || '—', chCount > 0 ? '章' : '');

    h += card('知识图谱', '概念关系、研究脉络、文献演进', '🕸️',
      "Nav.navigate('knowledge-graph')", null, null);

    h += card('导入论文', paper.has ? '已加载 ' + paper.wordCount + ' 字' : '从 DOCX 导入已有论文', '📄',
      "openImportDialog('new')", paper.wordCount > 0 ? Math.round(paper.wordCount/1000) + 'k' : '—', '字');
    return h;
  }

  // ── Writing Dashboard ──
  function renderWriting(proj, paper) {
    var h = '';
    h += card('写作编辑器', '分章编写论文正文，AI 辅助扩写和润色', '✍️',
      "Nav.navigate('writing-workbench')",
      paper.chCount, paper.chCount > 0 ? '章' : '');

    // Chapter progress bars
    var chs = paper.sections.filter(function(s) { return s.title && typeof isBodyChapter === 'function' && isBodyChapter(s); });
    if (chs.length > 0) {
      var chsHtml = '';
      chs.slice(0, 6).forEach(function(ch) {
        var wc = ch.text ? ch.text.length : 0;
        var pct = paper.wordCount > 0 ? Math.min(100, Math.round(wc / paper.wordCount * 100 * chs.length)) : 0;
        chsHtml += '<div class="stage-progress-row">' +
          '<span class="stage-progress-label">' + (ch.title||'').substring(0,8) + '</span>' +
          '<div class="stage-progress-bar"><div class="stage-progress-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="stage-progress-word">' + wc + '</span></div>';
      });
      h += '<div class="stage-dashboard-card"><div class="stage-dashboard-card-title">章节进度</div>' + chsHtml + '</div>';
    }

    h += card('AI 扩写', '选中章节，选择扩写/改写/精简/学术化风格', '📝',
      "Nav.navigate('expand')", null, null);

    h += card('数据分析', '导入数据集，生成统计图表和分析报告', '📈',
      "Nav.navigate('data-analysis')", null, null);

    h += card('全文快览', paper.wordCount + ' 字 · ' + paper.chCount + ' 章 · ' + paper.refs.length + ' 篇参考文献', '📊',
      null, Math.round(paper.wordCount/1000) + 'k', '字');
    return h;
  }

  // ── Polish Dashboard ──
  function renderPolish(proj, paper) {
    var h = '';
    h += card('论文体检', '一键检查语病、重复、格式、术语、段落逻辑', '🏥',
      "Nav.navigate('health-check')",
      '5合1', '项检查');

    h += card('综合审阅', '7 维度综合评分：格式/逻辑/术语/重复/结构/论证/学术化', '🔍',
      "Nav.navigate('review')", null, null);

    // Score snapshot from dashboard
    var scoreHtml = card('论文看板', '10 维评分 + 雷达图 + 优化优先级', '📊',
      "Nav.navigate('dashboard')", null, null);

    if (typeof computeAllScores === 'function' && paper.has) {
      try {
        var scores = computeAllScores();
        scoreHtml = card('论文看板', '综合评分：' + (scores.gradeLabel || '—') + ' · ' + (scores.totalChars||0) + ' 字',
          '📊', "Nav.navigate('dashboard')",
          scores.composite != null ? scores.composite : '—', '分');
      } catch(e) {}
    }
    h += scoreHtml;

    h += card('查重降重', 'AI 驱动的文本相似度检测与降重改写', '📋',
      "Nav.navigate('de-duplicate')", null, null);
    return h;
  }

  // ── Finalize Dashboard ──
  function renderFinalize(proj, paper) {
    var h = '';
    h += card('答辩 PPT', '自动生成答辩幻灯片大纲并导出 PPTX', '🎤',
      "Nav.navigate('defense-ppt')", null, null);

    h += card('英文摘要', '中英文双语摘要翻译与润色', '🌐',
      "Nav.navigate('en-abstract')", null, null);

    h += card('论文看板', '全面质量评估：雷达图、评分、改进建议', '📊',
      "Nav.navigate('dashboard')", null, null);

    h += card('导出文档', '导出为 DOCX / PDF / LaTeX 格式', '📦',
      null, null, null);

    return h;
  }

  // ── Tool Panel ──
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

  function updateSidebar(msId) {
    document.querySelectorAll('.sidebar-icon-milestone').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-milestone') === msId);
    });
  }

  function init() {
    updateSidebar('prepare');
    renderDashboard('prepare');
    PaperPreview.init();
    // Load default tool panel tab content
    setTimeout(function() { switchToolTab('references'); }, 100);
  }

  // Backward compat
  window._open = function(id) { if (typeof switchModule === 'function') switchModule(id); };
  window.switchModule = function(id) {
    var map = { references:'references', refs:'references', literature:'references', tools:'prepare', dashboard:'dashboard', citely:'citely', 'knowledge-graph':'knowledge-graph' };
    navigate(map[id] || id);
  };
  window.switchView = function(view) {
    var map = { workspace:'prepare', refs:'references', tools:'prepare', dashboard:'dashboard', writing:'writing-workbench', review:'review', defense:'defense-ppt', polish:'health-check' };
    navigate(map[view] || view);
  };
  window.switchToolTab = switchToolTab;
  window.toggleToolPanel = toggleToolPanel;

  window.Nav = {
    init:init, navigate:navigate, renderDashboard:renderDashboard,
    toggleToolPanel:toggleToolPanel, switchToolTab:switchToolTab,
    get currentMilestone() { return _currentMilestone; }
  };
})();

// ── Paper Preview Component ──
var PaperPreview = (function() {
  'use strict';
  function init() {
    refreshChapterSelect();
    showChapter(null);
  }

  function refreshChapterSelect() {
    var sel = document.getElementById('paperChapterSelect');
    if (!sel) return;
    var chs = [];
    if (typeof sections !== 'undefined' && sections) {
      chs = sections.filter(function(s) { return s.title && typeof isBodyChapter === 'function' && isBodyChapter(s); });
    }
    sel.innerHTML = '<option value="">-- 选择章节 --</option>';
    chs.forEach(function(ch, i) {
      sel.innerHTML += '<option value="' + i + '">' + (ch.title||'未命名').substring(0,50) + '</option>';
    });
    sel.style.display = chs.length > 0 ? '' : 'none';
    if (chs.length > 0) {
      sel.value = '0';
      showChapter(0);
    }
  }

  function selectChapter(idx) {
    showChapter(parseInt(idx));
  }

  function showChapter(idx) {
    var body = document.getElementById('paperPreviewBody');
    var wcEl = document.getElementById('paperWordCount');
    if (!body) return;

    var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 50;
    if (!has) {
      body.innerHTML = '<div class="stage-paper-empty"><div style="font-size:2rem;margin-bottom:8px">📄</div><strong>还没有论文</strong><span>创建项目或导入 DOCX 后会自动展示论文正文</span><button class="btn btn-primary btn-sm" onclick="openImportDialog(\'new\')" style="margin-top:8px">导入论文</button></div>';
      if (wcEl) wcEl.textContent = '';
      return;
    }

    if (idx == null && typeof sections !== 'undefined' && sections.length) {
      var chs = sections.filter(function(s) { return s.title && typeof isBodyChapter === 'function' && isBodyChapter(s); });
      if (chs.length > 0) idx = 0;
    }

    if (idx != null && typeof sections !== 'undefined' && sections[idx]) {
      var s = sections[idx];
      var html = '';
      if (s.title) html += '<h1>' + s.title.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</h1>';
      html += (s.html || '').replace(/<h2/g, '<h2').replace(/<h3/g, '<h3');
      if (!s.html && s.text) {
        html += '<p>' + s.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n\n/g, '</p><p>') + '</p>';
      }
      body.innerHTML = html;
      if (wcEl) wcEl.textContent = (s.text ? s.text.length : 0) + ' 字';
    } else if (typeof manuscriptText !== 'undefined' && manuscriptText) {
      body.innerHTML = '<div style="white-space:pre-wrap;font-size:var(--text-base);line-height:var(--leading-relaxed)">' + manuscriptText.substring(0, 5000).replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>';
      if (wcEl) wcEl.textContent = manuscriptText.length + ' 字';
    }
  }

  window.addEventListener('manuscript-loaded', function() { refreshChapterSelect(); });
  window.addEventListener('project-changed', function() { refreshChapterSelect(); });

  return { init:init, selectChapter:selectChapter, showChapter:showChapter, refreshChapterSelect:refreshChapterSelect };
})();
