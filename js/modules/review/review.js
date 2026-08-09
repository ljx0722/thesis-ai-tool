/**
 * Review Module — 统一审阅面板
 * 合并: format-check + proofread + terminology + paragraph + de-duplicate + optimization + thesis-review
 *
 * 统一的 mount(container) / destroy() 接口
 * Tab 切换: 格式 | 查错 | 术语 | 段落 | 降重 | 综合审阅 | 优化建议
 */
var ReviewModule = (function() {
  'use strict';

  var _container = null;
  var _activeTab = 'overview';

  // ── 审阅子工具注册 ──
  var TABS = [
    { id: 'overview',   name: '总览',       icon: '📊', color: '#4f46e5' },
    { id: 'format',     name: '格式检查',   icon: '✅', color: '#10b981' },
    { id: 'health-check', name: '论文体检', icon: '🏥', color: '#6366f1' },
    
    { id: 'paragraph',  name: '段落分析',   icon: '📝', color: '#8b5cf6' },
    { id: 'de-duplicate', name: '查重降重', icon: '📋', color: '#ef4444' },
    { id: 'review',     name: '综合审阅',   icon: '🔍', color: '#ec4899' },
    { id: 'optimize',   name: '优化建议',   icon: '💡', color: '#6366f1' },
  ];

  // ── 渲染 ──
  function render() {
    if (!_container) return;
    var hasEssay = (typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 50);

    var html = '<div class="review-root">';
    // Tab 栏
    html += '<div class="review-tabs">';
    TABS.forEach(function(tab) {
      html += '<button class="review-tab' + (_activeTab === tab.id ? ' active' : '') + '" onclick="ReviewModule.switchTab(\'' + tab.id + '\')" style="border-bottom-color:' + (_activeTab === tab.id ? tab.color : 'transparent') + '">' +
        tab.icon + ' ' + tab.name +
      '</button>';
    });
    html += '</div>';

    // 内容区
    html += '<div class="review-content" id="reviewTabContent">';
    if (!hasEssay && _activeTab !== 'overview') {
      html += '<div style="text-align:center;padding:60px 20px;color:var(--text-muted,#888)">' +
        '<div style="font-size:2.5rem;margin-bottom:12px">📄</div>' +
        '<p style="font-size:.85rem">请先导入论文后使用审阅功能</p>' +
        '<button class="ai-btn" onclick="typeof PaperImport !== \'undefined\' ? PaperImport.open(\'new\') : (typeof openImportDialog === \'function\' ? openImportDialog(\'new\') : null)" style="margin-top:10px">📎 导入论文</button>' +
      '</div>';
    } else if (_activeTab === 'overview') {
      html += renderOverview();
    } else {
      html += '<div id="reviewSubContent">请先运行分析</div>';
    }
    html += '</div>';
    html += '</div>';

    _container.innerHTML = html;

    // 加载对应子工具
    if (hasEssay && _activeTab !== 'overview') {
      loadSubTool(_activeTab);
    }
  }

  function renderOverview() {
    var hasEssay = (typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 50);
    var html = '<div class="review-overview">';
    html += '<h3 style="font-size:.95rem;margin:0 0 4px">📊 论文审阅总览</h3>';
    html += '<p style="font-size:.72rem;color:var(--text-muted,#888);margin:0 0 16px">一站式检查论文各项质量指标</p>';

    html += '<div class="review-card-grid">';
    TABS.filter(function(t) { return t.id !== 'overview'; }).forEach(function(tab) {
      html += '<div class="review-card" onclick="ReviewModule.switchTab(\'' + tab.id + '\')" style="cursor:pointer;border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:16px;transition:all .15s;background:var(--bg-card,#fff)" onmouseenter="this.style.borderColor=\'' + tab.color + '\';this.style.boxShadow=\'0 2px 12px rgba(0,0,0,.06)\'" onmouseleave="this.style.borderColor=\'var(--border,#e5e7eb)\';this.style.boxShadow=\'none\'">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
          '<span style="font-size:1.4rem">' + tab.icon + '</span>' +
          '<div>' +
            '<div style="font-size:.82rem;font-weight:700;color:var(--text-primary,#111)">' + tab.name + '</div>' +
            '<div style="font-size:.65rem;color:' + tab.color + ';font-weight:600">点击运行 →</div>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:.68rem;color:var(--text-muted,#888)">' + getTabDesc(tab.id) + '</div>' +
      '</div>';
    });
    html += '</div>';

    if (!hasEssay) {
      html += '<div style="text-align:center;padding:20px;margin-top:16px;background:var(--bg-elevated,#f8fafc);border-radius:10px;border:1px dashed var(--border,#e5e7eb)">' +
        '<p style="font-size:.78rem;color:var(--text-muted,#888)">导入论文后可运行全部审阅检查</p>' +
      '</div>';
    } else {
      html += '<div style="text-align:center;padding:16px;margin-top:16px">' +
        '<button class="ai-btn" onclick="ReviewModule.runAllChecks()" style="background:var(--accent,#4f46e5);color:#fff;padding:10px 24px">🚀 一键运行全部审阅</button>' +
      '</div>';
    }

    html += '</div>';
    return html;
  }

  function getTabDesc(id) {
    var m = {
      'format': '检查标题层级、图表编号、参考文献格式、段落格式是否符合规范',      'paragraph': '段落长度分布、长句检测、过渡词分析、标题拆分残留检测',
      'de-duplicate': 'AI 驱动的文本相似度检测与智能降重改写',
      'review': '十维综合评分：选题价值、文献综述、框架结构、研究方法、内容论证等',
      'optimize': '基于各维度检测结果，生成优先级优化建议清单',
    };
    return m[id] || '';
  }

  // ── 加载子工具 ──
  function loadSubTool(tabId) {
    var subContainer = document.getElementById('reviewSubContent');
    if (!subContainer) return;

    // format + paragraph → HealthCheckModule.runCheck()
    if ((tabId === 'format' || tabId === 'paragraph') && typeof HealthCheckModule !== 'undefined') {
      var checkId = tabId === 'format' ? 'format-check' : 'paragraph';
      HealthCheckModule.mount(subContainer);
      HealthCheckModule.runCheck(checkId);
      return;
    }
    // de-duplicate / review / optimize → global functions
    var runnerMap = {
      'de-duplicate': 'runDeduplicate',
      'review': 'runReviewModule',
      'optimize': 'runOptimization',
    };
    var fnName = runnerMap[tabId];
    if (fnName && typeof window[fnName] === 'function') {
      window[fnName](subContainer);
    }
  }

  function runAllChecks() {
    // 依次运行所有本地检查
    var tasks = TABS.filter(function(t) { return t.id !== 'overview' && t.id !== 'health-check'; });
    var idx = 0;
    function runNext() {
      if (idx >= tasks.length) return;
      _activeTab = tasks[idx].id;
      render();
      idx++;
      setTimeout(runNext, 500);
    }
    runNext();
  }

  // ── API ──
  function mount(container) {
    _container = container;
    _activeTab = 'overview';
    render();
  }

  function destroy() {
    _container = null;
    _activeTab = 'overview';
  }

  function switchTab(tabId) {
    _activeTab = tabId;
    render();
  }

  function refresh() {
    render();
  }

  return {
    mount: mount,
    destroy: destroy,
    switchTab: switchTab,
    refresh: refresh,
    runAllChecks: runAllChecks
  };
})();
