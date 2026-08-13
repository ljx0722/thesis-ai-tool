/**
 * ThesisBuddy Command Palette — Ctrl+K global search
 * Extracted from index.html inline script
 */
(function() {
  'use strict';

  var FALLBACK_CMDS = [
    // 准备
    { id: 'ideation', icon: '💡', label: '开题工作台', keys: '选题 大纲 开题', milestone: 'prepare' },
    { id: 'topic-finder', icon: '🔍', label: '选题推荐', keys: '选题 题目 方向', milestone: 'prepare' },
    { id: 'proposal', icon: '📝', label: '开题大纲', keys: '大纲 开题 结构', milestone: 'prepare' },
    { id: 'citely', icon: '📚', label: '文献检索', keys: '文献 搜索 论文', milestone: 'prepare' },
    { id: 'knowledge-graph', icon: '🕸️', label: '知识图谱', keys: '图谱 概念 网络', milestone: 'prepare' },
    // 写作
    { id: 'writing-workbench', icon: '✍️', label: '写作编辑器', keys: '写作 编辑 章节', milestone: 'writing' },
    { id: 'expand', icon: '📝', label: 'AI扩写', keys: '扩写 扩展 生成', milestone: 'writing' },
    { id: 'data-analysis', icon: '📈', label: '数据分析', keys: '数据 统计 图表', milestone: 'writing' },
    // 打磨
    { id: 'health-check', icon: '🏥', label: '论文体检', keys: '体检 查错 降重 格式', milestone: 'polish' },
    { id: 'review', icon: '🔍', label: '综合审阅', keys: '审阅 评审 评分', milestone: 'polish' },
    { id: 'de-duplicate', icon: '📋', label: '查重降重', keys: '查重 降重 改写', milestone: 'polish' },
    // 收尾
    { id: 'dashboard', icon: '📊', label: '论文看板', keys: '看板 评分 雷达', milestone: 'finish' },
    { id: 'defense-ppt', icon: '📊', label: '答辩PPT', keys: '答辩 PPT 演讲', milestone: 'finish' },
    { id: 'en-abstract', icon: '🌐', label: '英文摘要', keys: '英文 摘要 翻译', milestone: 'finish' },
    // 全局
    { id: 'references', icon: '📋', label: '参考文献管理', keys: '引用 文献 格式', milestone: 'any' },
    { id: 'import', icon: '📄', label: '导入论文', keys: '导入 上传 DOCX', milestone: 'any' },
  ];

  function commands() {
    if (!window.ThesisCapabilities) return FALLBACK_CMDS;
    return ThesisCapabilities.all.map(function(item) {
      return {
        id: item.id,
        icon: item.icon || '•',
        label: item.name,
        keys: item.searchTerms || item.name,
        milestone: item.milestone || 'any'
      };
    }).concat([{ id: 'import', icon: 'DOCX', label: '导入已有论文', keys: '导入 上传 DOCX', milestone: 'any' }]);
  }

  var _recentIds = [];
  var _selectedIdx = -1;

  function open() {
    var overlay = document.getElementById('cmdOverlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    var input = document.getElementById('cmdSearch');
    if (input) { input.value = ''; setTimeout(function() { input.focus(); }, 50); }
    _selectedIdx = -1;
    filter('');
  }

  function close() {
    var overlay = document.getElementById('cmdOverlay');
    if (overlay) overlay.classList.add('hidden');
    _selectedIdx = -1;
  }

  function filter(query) {
    var q = (query || '').trim().toLowerCase();
    var el = document.getElementById('cmdResults');
    if (!el) return;

    var results = commands().filter(function(c) {
      if (!q) return true;
      return c.label.indexOf(q) >= 0 || c.keys.indexOf(q) >= 0 || c.id.indexOf(q) >= 0;
    });

    // Sort: recent items first, then by milestone order
    results.sort(function(a, b) {
      var aRecent = _recentIds.indexOf(a.id);
      var bRecent = _recentIds.indexOf(b.id);
      if (aRecent >= 0 && bRecent >= 0) return aRecent - bRecent;
      if (aRecent >= 0) return -1;
      if (bRecent >= 0) return 1;
      return 0;
    });

    // Group by milestone
    var milestones = ['prepare','writing','polish','finish','any'];
    var names = { prepare: '准备', writing: '写作', polish: '打磨', finish: '收尾', any: '其他' };
    var h = '';
    var lastMilestone = null;

    results.forEach(function(c, i) {
      if (c.milestone !== lastMilestone && q === '') {
        h += '<div class="cmd-item-group">'+ (names[c.milestone] || c.milestone) +'</div>';
        lastMilestone = c.milestone;
      }
      var active = i === _selectedIdx ? ' active' : '';
      h += '<button class="cmd-item'+active+'" onclick="CommandPalette.execute(\''+c.id+'\')" data-idx="'+i+'">'+
        '<span class="cmd-item-icon">'+c.icon+'</span>'+
        '<span class="cmd-item-label">'+c.label+'</span>'+
        '<span class="cmd-item-hint">'+c.keys.split(' ').slice(0,2).join(' · ')+'</span>'+
        '</button>';
    });

    el.innerHTML = h || '<div style="text-align:center;padding:20px;color:var(--text-muted, #94a3b8)">没有匹配的功能</div>';
    _selectedIdx = results.length > 0 ? 0 : -1;
  }

  function execute(id) {
    _recentIds = _recentIds.filter(function(x) { return x !== id; });
    _recentIds.unshift(id);
    if (_recentIds.length > 8) _recentIds = _recentIds.slice(0, 8);
    close();
    if (id === 'import') {
      if (typeof openImportDialog === 'function') openImportDialog('new');
      return;
    }
    if (window.ThesisRouter && ThesisRouter.openModule) {
      ThesisRouter.openModule(id);
    } else if (typeof switchModule === 'function') {
      switchModule(id);
    }
  }

  function navigate(dir) {
    var items = document.querySelectorAll('.cmd-item');
    if (!items.length) return;
    _selectedIdx = Math.max(0, Math.min(items.length - 1, _selectedIdx + dir));
    items.forEach(function(item, i) {
      item.classList.toggle('active', i === _selectedIdx);
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    var overlay = document.getElementById('cmdOverlay');
    var isOpen = overlay && !overlay.classList.contains('hidden');

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (isOpen) close(); else open();
      return;
    }

    if (!isOpen) return;

    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); navigate(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); navigate(-1); }
    if (e.key === 'Enter') {
      e.preventDefault();
      var active = document.querySelector('.cmd-item.active');
      if (active && active.getAttribute('data-idx') != null) {
        var items = document.querySelectorAll('.cmd-item');
        var idx = parseInt(active.getAttribute('data-idx'));
        if (idx < items.length) items[idx].click();
      }
    }
  });

  // Expose
  window.CommandPalette = { open: open, close: close, execute: execute, filter: filter };
  window._openCommandPalette = open;
  window._closeCommandPalette = close;
  window._filterCommandPalette = function() {
    var input = document.getElementById('cmdSearch');
    filter(input ? input.value : '');
  };
})();
