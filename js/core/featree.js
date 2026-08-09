/**
 * ThesisBuddy — 统一模块调度 + 状态感知侧栏
 * 一个 _open(id) 调度全部 20 个模块
 * 论文原文始终可见，模块在右侧面板或覆盖层中打开
 */
(function(){
  'use strict';

  var RUNNERS={
    'topic-finder':'runTopicFinder','proposal':'runProposalModule',
    'expand':'runExpandModule','data-analysis':'runDataAnalysis',
    'proofread':'runProofread','de-duplicate':'runDeduplicate',
    'format-check':'runFormatCheck','terminology':'runTerminology',
    'paragraph':'runParagraphAnalysis','review':'runReviewModule',
    'optimization':'runOptimization','defense-ppt':'runDefensePPT',
    'en-abstract':'runEnAbstract'
  };

  // ── 统一模块打开：不隐藏论文，在右侧面板打开 ──
  window._open = function(id) {
    // 弹窗模块
    if (id === 'dashboard') { if (typeof showDashboard === 'function') showDashboard(); return; }
    if (id === 'knowledge-graph') { if (typeof showKnowledgeGraph === 'function') showKnowledgeGraph(); return; }

    // 独立弹窗函数
    if (id === 'chapter-board') { if (typeof openChapterBoard === 'function') openChapterBoard(); return; }
    if (id === 'outline') { if (typeof openOutlineEditor === 'function') openOutlineEditor(); return; }

    // 参考文献：使用 switchModule 在 refPanel 中显示
    if (id === 'references') {
      if (typeof switchModule === 'function') { switchModule('references'); }
      else { alert('参考文献模块未就绪'); }
      return;
    }

    // Citely：全屏替换 thesisBox
    if (id === 'citely') {
      var tb = document.getElementById('thesisBox');
      var rp = document.getElementById('refPanel');
      if (tb) {
        if (rp) rp.style.display = 'none';
        tb.innerHTML = '<div id="citelyContainer" style="height:100%"></div>';
        var pd = {};
        try {
          var p = window.ThesisProject && ThesisProject.getCurrentProject ? ThesisProject.getCurrentProject() : null;
          if (p) { pd.keywords = p.keywords || ''; pd.chapters = (p.chapters || []).map(function(c) { return { id: c.id || c.title || c, title: c.title || c }; }); }
        } catch (e) {}
        if (typeof Citely !== 'undefined') setTimeout(function() { Citely.mount('citelyContainer', pd); }, 50);
      }
      return;
    }

    // 写作工作台：全屏替换 thesisBox
    if (id === 'writing-workbench') {
      var tb2 = document.getElementById('thesisBox');
      var rp2 = document.getElementById('refPanel');
      if (tb2) {
        if (rp2) rp2.style.display = 'none';
        tb2.innerHTML = '<div style="height:100%"></div>';
        if (typeof WritingModule !== 'undefined') WritingModule.mount(tb2.querySelector('div'));
      }
      return;
    }

    // 所有其他模块：在 refPanel 中打开（论文保持可见）
    if (typeof switchModule === 'function') {
      switchModule(id);
    } else {
      // Fallback: 直接调用
      var rp3 = document.getElementById('refPanel');
      if (rp3) {
        rp3.innerHTML = '<div class="module-panel module-panel-content" style="flex:1;overflow:auto;padding:16px"></div>';
        var container = rp3.querySelector('.module-panel');
        var fn = RUNNERS[id];
        if (fn && typeof window[fn] === 'function') {
          window[fn](container);
        } else {
          container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">模块加载中...</div>';
        }
      }
    }
  };

  // 恢复工作台
  window._restoreWorkspace = function() {
    var tb = document.getElementById('thesisBox');
    var rp = document.getElementById('refPanel');
    if (tb) tb.innerHTML = '<div id="workspaceContent" class="workspace-content"></div>';
    if (rp) rp.style.display = '';
    if (typeof window.renderWorkspaceHero === 'function') try { window.renderWorkspaceHero(); } catch (e) {}
    if (window._renderFeatureTree) window._renderFeatureTree();
  };

  // ── 状态感知侧栏 ──
  window._renderFeatureTree = function() {
    var c = document.getElementById('navFeatureTree'); if (!c) return;
    var hasEssay = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100;
    var tools = hasEssay ? [
      { id: 'format-check', icon: '✅', label: '格式检查' },
      { id: 'proofread', icon: '✏️', label: '论文查错' },
      { id: 'terminology', icon: '🔤', label: '术语分析' },
      { id: 'paragraph', icon: '📝', label: '段落分析' },
      { id: 'de-duplicate', icon: '📋', label: '查重降重' },
      { id: 'review', icon: '🔍', label: '综合审阅' },
      { id: 'optimization', icon: '💡', label: '优化建议' },
      { id: 'expand', icon: '📝', label: 'AI扩写' },
      { id: 'data-analysis', icon: '📈', label: '数据分析' },
      { id: 'references', icon: '📋', label: '参考文献' },
      { id: 'citely', icon: '🔍', label: '文献检索' },
      { id: 'knowledge-graph', icon: '🕸️', label: '知识图谱' },
      { id: 'dashboard', icon: '📊', label: '论文看板' },
      { id: 'defense-ppt', icon: '📊', label: '答辩PPT' },
    ] : [
      { id: 'topic-finder', icon: '💡', label: '选题推荐' },
      { id: 'proposal', icon: '📝', label: '开题大纲' },
      { id: 'citely', icon: '🔍', label: '文献检索' },
      { id: 'proofread', icon: '✏️', label: '论文查错' },
      { id: 'de-duplicate', icon: '📋', label: '查重降重' },
      { id: 'defense-ppt', icon: '📊', label: '答辩PPT' },
      { id: 'en-abstract', icon: '🌐', label: '英文摘要' },
    ];
    var h = '';
    tools.forEach(function(t) {
      h += '<div class="ft-leaf" onclick="_open(\'' + t.id + '\')"><span class="ft-icon">' + t.icon + '</span><span class="ft-label">' + t.label + '</span></div>';
    });
    c.innerHTML = h;
  };

  // 初始化
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', window._renderFeatureTree); }
  else { window._renderFeatureTree(); }

  console.log('[TB] Module dispatcher ready. 20 modules.');

})();
