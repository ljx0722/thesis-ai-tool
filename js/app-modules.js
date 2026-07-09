/**
 * 论文AI利器 — 模块系统
 * 模块标签顶栏 / 操作按钮顶栏 / 键盘快捷键 / 换论文 / 悬浮上传
 */

var APP_MODULES = [
  { id: 'format-check',    name: '格式检查',   icon: '✅', requiresThesis: true },
  { id: 'terminology',     name: '术语分析',   icon: '🔤', requiresThesis: true },
  { id: 'paragraph',       name: '段落分析',   icon: '📝', requiresThesis: true },
  { id: 'optimization',    name: '优化建议',   icon: '💡', requiresThesis: true },
  { id: 'knowledge-graph', name: '知识图谱',   icon: '🕸️', requiresThesis: true },
  { id: 'references',      name: '参考文献',   icon: '📋', requiresThesis: true },
];

var _activeModule = 'references';
var _thesisLoaded = false;
var _analysisCache = {};

function showUploadOverlay() { var el = document.getElementById('uploadOverlay'); if (el) el.classList.add('show'); }
function hideUploadOverlay() { var el = document.getElementById('uploadOverlay'); if (el) el.classList.remove('show'); }

// ==================== 换论文 ====================
function changeThesis() {
  // 清理旧数据
  if (typeof clearAll === 'function') {
    existingRefs = []; mergedRefs = []; manuscriptText = ''; manuscriptHTML = ''; paperTopics = []; sections = [];
    document.getElementById('thesisBox').innerHTML = '<i style="color:#9ca3af">论文原文将在此显示</i>';
    document.getElementById('navTree').innerHTML = '<i style="color:var(--m);font-size:.7rem;padding:8px;display:block">请先上传论文</i>';
    document.getElementById('refs').innerHTML = '<div style="text-align:center;padding:60px;color:#9ca3af;font-size:.82rem">← 请先上传论文</div>';
    document.getElementById('kwBar').style.display = 'none';
  }
  updateDashboard([]);
  _thesisLoaded = false; _analysisCache = {}; kgCurrentData = null;
  showUploadOverlay();
  renderModuleTabs();
  updateBarActions();
  updateStatusBar2();
  switchPanel('references');
  document.getElementById('statusBar').textContent = '等待上传论文…';
  document.getElementById('upStatus').innerHTML = '等待上传';
}

// ==================== 快捷键 ====================
function initKeyboard() {
  var kbHint = document.getElementById('kbHint');
  if (!kbHint) return;
  // 显示快捷键提示
  var hintTimer = null;
  function showHint() {
    kbHint.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function() { kbHint.classList.remove('show'); }, 4000);
  }
  showHint();

  document.addEventListener('keydown', function(e) {
    var mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    // Ctrl+1..6: 切换模块
    var num = parseInt(e.key);
    if (num >= 1 && num <= APP_MODULES.length) {
      e.preventDefault();
      var m = APP_MODULES[num - 1];
      if (m.requiresThesis && !_thesisLoaded) { ttp('请先上传论文'); return; }
      switchModule(m.id);
      return;
    }

    // Ctrl+Enter: 检索文献
    if (e.key === 'Enter') {
      e.preventDefault();
      if (_thesisLoaded && typeof startSearch === 'function') startSearch();
      return;
    }

    // Ctrl+B: 导出
    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      if (_thesisLoaded && typeof copyBib === 'function') copyBib();
      return;
    }

    // Ctrl+O: 换论文
    if (e.key === 'o' || e.key === 'O') {
      e.preventDefault();
      changeThesis();
      return;
    }
  });

  // Escape: 关闭弹窗
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var kg = document.getElementById('kgOverlay');
      if (kg && kg.style.display === 'flex') { closeKnowledgeGraph(); return; }
      var ul = document.getElementById('uploadOverlay');
      if (ul && ul.classList.contains('show') && _thesisLoaded) { hideUploadOverlay(); return; }
    }
  });
}

// ==================== 渲染顶栏模块标签 ====================
function renderModuleTabs() {
  var container = document.getElementById('moduleTabs');
  if (!container) return;
  _thesisLoaded = !!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100);

  var h = '';
  APP_MODULES.forEach(function(m, idx) {
    var disabled = m.requiresThesis && !_thesisLoaded;
    var active = _activeModule === m.id ? ' active' : '';
    var cls = 'module-tab' + active + (disabled ? ' disabled' : '');
    var onclick = disabled ? '' : ' onclick="switchModule(\'' + m.id + '\')"';
    h += '<div class="' + cls + '" data-module="' + m.id + '"' + onclick + ' title="' + (disabled ? '请先上传论文' : m.name + ' (Ctrl+' + (idx + 1) + ')') + '">';
    h += '<span class="tab-icon">' + m.icon + '</span>' + m.name;
    h += '</div>';
  });
  container.innerHTML = h;
}

function updateBarActions() {
  _thesisLoaded = !!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100);
  ['baSearch', 'baVerify', 'baCopy', 'baBib', 'baDOI'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { if (_thesisLoaded) el.removeAttribute('disabled'); else el.setAttribute('disabled', ''); }
  });
  var dbBtn = document.getElementById('dashboardBtn');
  if (dbBtn) { if (_thesisLoaded) dbBtn.removeAttribute('disabled'); else dbBtn.setAttribute('disabled', ''); }
}

function resetSearch() {
  if (!_thesisLoaded) { ttp('请先上传论文'); return; }
  if (typeof mergedRefs !== 'undefined' && mergedRefs.length > 0) {
    if (!confirm('确定要清空所有检索文献吗？将回到论文导入后的初始状态。')) return;
  }
  var genSpans = document.querySelectorAll('.cite-marker.generated');
  for (var gsi = 0; gsi < genSpans.length; gsi++) if (genSpans[gsi].parentElement) genSpans[gsi].parentElement.removeChild(genSpans[gsi]);
  if (typeof existingRefs !== 'undefined' && existingRefs.length) {
    existingRefs.forEach(function(er) { er.displayNum = er.num; er.subType = 'unchanged'; });
    if (typeof wrapExistingMarkers === 'function') {
      var allM = document.querySelectorAll('.cite-marker');
      for (var i = 0; i < allM.length; i++) allM[i].parentElement.removeChild(allM[i]);
      wrapExistingMarkers(existingRefs.filter(function(r) { return r.num; }));
    }
  }
  if (typeof mergedRefs !== 'undefined') mergedRefs = [];
  if (typeof existingRefs !== 'undefined' && existingRefs.length) {
    if (typeof renderExistingOnly === 'function') renderExistingOnly();
    updateDashboard(existingRefs);
  }
  _analysisCache = {}; kgCurrentData = null;
  updateStatusBar2();
  switchPanel('references');
  ttp('已重置');
}

// ==================== 模块切换（带 pushState） ====================
function switchModule(moduleId) {
  if (typeof searchRunning !== 'undefined' && searchRunning) { ttp('检索进行中，请等待完成'); return; }
  _activeModule = moduleId;

  var tabs = document.querySelectorAll('.module-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].getAttribute('data-module') === moduleId);

  switchPanel(moduleId);

  if (moduleId === 'knowledge-graph' && _thesisLoaded) showKnowledgeGraph();

  // pushState for back button
  try { history.pushState({ module: moduleId }, '', '#/' + moduleId); } catch (e) {}
}

window.addEventListener('popstate', function(e) {
  if (e.state && e.state.module) {
    var m = APP_MODULES.find(function(x) { return x.id === e.state.module; });
    if (m && (!m.requiresThesis || _thesisLoaded)) switchModule(e.state.module);
  }
});

function switchPanel(moduleId) {
  var panel = document.getElementById('refPanel');
  if (!panel) return;

  var oldMC = document.getElementById('moduleContent');
  if (oldMC && oldMC.parentElement) oldMC.parentElement.removeChild(oldMC);

  var refOnlyEls = panel.querySelectorAll('.ref-only');
  var moduleArea = panel.querySelector('.module-area');

  if (moduleId === 'references') {
    for (var i = 0; i < refOnlyEls.length; i++) refOnlyEls[i].style.display = '';
    if (moduleArea) moduleArea.style.display = 'none';
    if (typeof mergedRefs !== 'undefined' && mergedRefs.length) renderRefs();
    else if (typeof existingRefs !== 'undefined' && existingRefs.length) renderExistingOnly();
  } else {
    for (var i = 0; i < refOnlyEls.length; i++) refOnlyEls[i].style.display = 'none';
    if (!moduleArea) {
      moduleArea = document.createElement('div');
      moduleArea.className = 'module-area';
      moduleArea.style.cssText = 'flex:1;overflow-y:auto;';
      panel.appendChild(moduleArea);
    }
    moduleArea.style.display = '';

    if (moduleId === 'knowledge-graph') {
      moduleArea.innerHTML = '<div class="module-panel"><div style="text-align:center;padding:50px"><div style="font-size:3rem;margin-bottom:16px">🕸️</div><div style="color:var(--m);margin-bottom:16px">知识图谱弹窗已打开</div><button onclick="showKnowledgeGraph()" style="font-size:.85rem;padding:10px 24px;background:var(--p);color:#fff;border:none;border-radius:18px;cursor:pointer;font-weight:600">重新打开知识图谱</button></div></div>';
      return;
    }

    moduleArea.innerHTML = '<div class="module-panel"><div style="text-align:center;padding:40px;color:var(--m)"><div style="font-size:2rem;margin-bottom:12px">⏳</div><div>正在分析...</div></div></div>';

    if (_thesisLoaded) {
      var name = APP_MODULES.find(function(m) { return m.id === moduleId; });
      var label = name ? name.name : moduleId;
      showLoad('正在' + label + '...', 15, '分析论文数据中');

      setTimeout(function() {
        var mc = moduleArea.querySelector('.module-panel');
        try {
          if (moduleId === 'optimization' && typeof runOptimization === 'function') runOptimization(mc);
          else if (moduleId === 'format-check' && typeof runFormatCheck === 'function') runFormatCheck(mc);
          else if (moduleId === 'terminology' && typeof runTerminology === 'function') runTerminology(mc);
          else if (moduleId === 'paragraph' && typeof runParagraphAnalysis === 'function') runParagraphAnalysis(mc);
        } catch (e) { mc.innerHTML = '<div style="text-align:center;padding:40px;color:var(--r)">分析出错: ' + e.message + '</div>'; }
        hideLoad();
      }, 100);
    }
  }
  updateStatusBar2();
}

function jumpToSection(elementId, chapterLabel) {
  var el = document.getElementById(elementId);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.style.transition = 'background .3s'; el.style.background = 'rgba(175,82,222,0.15)'; setTimeout(function() { el.style.background = ''; }, 2000); ttp('已定位: ' + (chapterLabel || elementId)); }
}

function updateStatusBar2() {
  var sb = document.getElementById('statusBar');
  if (!sb) return;
  var refCount = 0;
  if (typeof mergedRefs !== 'undefined' && mergedRefs.length) refCount = mergedRefs.length;
  else if (typeof existingRefs !== 'undefined' && existingRefs.length) refCount = existingRefs.length;
  if (_thesisLoaded && refCount > 0) { var chCount = (typeof sections !== 'undefined' && sections) ? sections.length : 0; sb.textContent = chCount + '章 | ' + refCount + '条文献'; }
  else if (_thesisLoaded) sb.textContent = '已加载论文，请检索文献';
  else sb.textContent = '等待上传论文…';
}

function onThesisLoaded() {
  _thesisLoaded = true; _analysisCache = {}; kgCurrentData = null;
  hideUploadOverlay();
  renderModuleTabs(); updateBarActions(); updateStatusBar2();
  switchPanel('references');
}

var _origClearAll = typeof clearAll === 'function' ? clearAll : function() {};
clearAll = function() {
  _origClearAll();
  _thesisLoaded = false; _analysisCache = {}; _activeModule = 'references';
  showUploadOverlay(); renderModuleTabs(); updateBarActions(); updateStatusBar2();
  if (typeof switchPanel === 'function') switchPanel('references');
};

// showKnowledgeGraph 在 app.js 中直接调用，不再需要包装

// ==================== 引用更新回调（每次检索完成后刷新动态视图） ====================
function onRefsChanged() {
  _analysisCache = {};
  kgCurrentData = null;
  // 如果当前在分析模块，标记需要刷新
  if (_activeModule !== 'references' && _activeModule !== 'knowledge-graph') {
    var mc = document.querySelector('#refPanel .module-panel');
    if (mc) mc.innerHTML = '<div style="text-align:center;padding:20px;color:#f59e0b;font-size:.78rem">🔄 文献已更新，点击模块标签刷新分析</div>';
  }
}

// ==================== 初始化 ====================
(function() {
  showUploadOverlay();
  renderModuleTabs(); updateBarActions(); updateStatusBar2();
  initKeyboard();

  var pollCount = 0;
  var pollTimer = setInterval(function() {
    pollCount++;
    if (_thesisLoaded) { clearInterval(pollTimer); return; }
    if (typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100) { clearInterval(pollTimer); onThesisLoaded(); return; }
    if (pollCount > 120) clearInterval(pollTimer);
  }, 1000);
})();
