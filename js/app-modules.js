/**
 * 学术论文AI一站式助手 — 模块系统
 * 模块标签顶栏 / 操作按钮顶栏 / 键盘快捷键 / 换论文 / 悬浮上传
 */

// 共享工具：过滤附录/致谢等非正文章节
function isBodyChapter(s) {
  return !/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name || '');
}

// ==================== 模块清单 ====================
// requiresThesis: 是否需要先上传论文才能使用
// aiDriven: 是否调用 AI 大模型（消耗点数）
var APP_MODULES = [
  // 选题阶段 — 无需论文, AI驱动
  { id: 'topic-finder',    name: '选题推荐',   icon: '💡', requiresThesis: false, aiDriven: true },
  { id: 'proposal',        name: '开题大纲',   icon: '📝', requiresThesis: false, aiDriven: true },
  // 撰写阶段
  { id: 'references',      name: '参考文献',   icon: '📋', requiresThesis: true,  aiDriven: false },
  { id: 'expand',          name: '论文扩写',   icon: '✍️', requiresThesis: true,  aiDriven: true },
  { id: 'data-analysis',   name: '数据分析',   icon: '📈', requiresThesis: false, aiDriven: false },
  { id: 'knowledge-graph', name: '知识图谱',   icon: '🕸️', requiresThesis: true,  aiDriven: false },
  // 打磨阶段
  { id: 'proofread',       name: '论文查错',   icon: '✏️', requiresThesis: false, aiDriven: true },
  { id: 'de-duplicate',    name: '查重降重',   icon: '📋', requiresThesis: false, aiDriven: true },
  { id: 'format-check',    name: '格式检查',   icon: '✅', requiresThesis: true,  aiDriven: false },
  { id: 'terminology',     name: '术语分析',   icon: '🔤', requiresThesis: true,  aiDriven: false },
  { id: 'paragraph',       name: '段落分析',   icon: '📝', requiresThesis: true,  aiDriven: true },
  // 评审输出
  { id: 'review',          name: '论文审阅',   icon: '🔍', requiresThesis: true,  aiDriven: true },
  { id: 'optimization',    name: '优化建议',   icon: '💡', requiresThesis: true,  aiDriven: true },
  { id: 'defense-ppt',     name: '答辩PPT',    icon: '📊', requiresThesis: false, aiDriven: true },
  { id: 'en-abstract',     name: '英文摘要',   icon: '🌐', requiresThesis: false, aiDriven: true },
  { id: 'dashboard',       name: '论文看板',   icon: '📊', requiresThesis: true,  aiDriven: false },
];

// 模块 id → 运行函数名映射 (run + PascalCase 或特定命名)
var MODULE_RUNNERS = {
  'topic-finder':    'runTopicFinder',
  'proposal':        'runProposalModule',
  'expand':          'runExpandModule',
  'data-analysis':   'runDataAnalysis',
  'proofread':       'runProofread',
  'de-duplicate':    'runDeduplicate',
  'format-check':    'runFormatCheck',
  'terminology':     'runTerminology',
  'paragraph':       'runParagraphAnalysis',
  'review':          'runReviewModule',
  'optimization':    'runOptimization',
  'defense-ppt':     'runDefensePPT',
  'en-abstract':     'runEnAbstract',
  'dashboard':       'showDashboard',
};

// 更新侧边栏项目状态（标记哪些需要论文上传才能用）
function updateNavStates() {
  var items = document.querySelectorAll('.nav-item[data-needs-thesis]');
  for (var i = 0; i < items.length; i++) {
    var needs = items[i].getAttribute('data-needs-thesis') === '1';
    if (needs && !_thesisLoaded) {
      items[i].classList.add('disabled');
      items[i].title = items[i].title || '需要先上传论文';
    } else {
      items[i].classList.remove('disabled');
    }
  }
}

// Block clicks on disabled nav items
document.addEventListener('click', function(e) {
  var navItem = e.target.closest('.nav-item.disabled');
  if (navItem) {
    e.preventDefault();
    e.stopPropagation();
    ttp('📎 请先上传论文');
  }
}, true);

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
    document.getElementById('thesisBox').innerHTML = ''; if(document.getElementById('workspaceContent')) document.getElementById('workspaceContent').style.display=''; switchView('workspace');
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
  updateNavStates();
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
// 顶栏只保留视图切换（工作台 / 参考文献 / 论文看板）
// 能力入口统一放在左侧「阶段 + 能力」导航，避免顶栏被 16 个模块挤爆
function renderModuleTabs() {
  var container = document.getElementById('barTabs');
  if (!container) return;
  _thesisLoaded = !!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100);
  var activeView = 'workspace';
  if (_activeModule === 'references') activeView = 'refs';
  else if (_activeModule === 'dashboard') activeView = 'dashboard';
  else if (_activeModule && _activeModule !== 'workspace') {
    // 在能力模块中时，高亮工作台（中间编辑区）
    activeView = 'workspace';
  }
  container.innerHTML =
    '<button class="bar-tab' + (activeView === 'workspace' ? ' active' : '') + '" data-view="workspace" onclick="switchView(\'workspace\')">工作台</button>' +
    '<button class="bar-tab' + (activeView === 'refs' ? ' active' : '') + '" data-view="refs" onclick="switchView(\'references\')">参考文献</button>' +
    '<button class="bar-tab' + (activeView === 'dashboard' ? ' active' : '') + '" data-view="dashboard" onclick="showDashboard()">论文看板</button>';
}

function updateBarActions() {
  _thesisLoaded = !!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100);
  ['baSearch', 'baVerify'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { if (_thesisLoaded) el.removeAttribute('disabled'); else el.setAttribute('disabled', ''); }
  });
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

  // Highlight nav items
  document.querySelectorAll('.nav-item').forEach(function(n) {
    n.classList.toggle('active', n.getAttribute('data-module') === moduleId);
  });
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
    updateStatusBar2();
    return;
  }

  // Non-reference modules
  for (var i = 0; i < refOnlyEls.length; i++) refOnlyEls[i].style.display = 'none';
  if (!moduleArea) {
    moduleArea = document.createElement('div');
    moduleArea.className = 'module-area';
    moduleArea.style.cssText = 'flex:1;overflow-y:auto;';
    panel.appendChild(moduleArea);
  }
  moduleArea.style.display = '';

  if (moduleId === 'knowledge-graph') {
    if (_thesisLoaded) {
      moduleArea.innerHTML = '<div class="module-panel"><div style="text-align:center;padding:50px"><div style="font-size:3rem;margin-bottom:16px">🕸️</div><div style="color:var(--m);margin-bottom:16px">知识图谱弹窗已打开</div><button onclick="showKnowledgeGraph()" style="font-size:.85rem;padding:10px 24px;background:var(--p);color:#fff;border:none;border-radius:18px;cursor:pointer;font-weight:600">重新打开知识图谱</button></div></div>';
    } else {
      moduleArea.innerHTML = '<div class="module-panel" style="text-align:center;padding:60px 20px"><div style="font-size:3rem;margin-bottom:16px">📎</div><h4 style="margin-bottom:8px">需要先上传论文</h4><p style="color:var(--text-muted);font-size:.8rem;margin-bottom:20px">知识图谱需要从论文中提取主题词才能生成</p><button onclick="triggerUpload()" style="font-size:.85rem;padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:18px;cursor:pointer;font-weight:600">📎 上传论文</button></div>';
    }
    updateStatusBar2();
    return;
  }

  if (moduleId === 'dashboard') {
    if (_thesisLoaded) {
      showDashboard();
      moduleArea.innerHTML = '<div class="module-panel"><div style="text-align:center;padding:50px"><div style="font-size:3rem;margin-bottom:16px">📊</div><div style="color:var(--m);margin-bottom:16px">论文看板弹窗已打开</div><button onclick="showDashboard()" style="font-size:.85rem;padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:18px;cursor:pointer;font-weight:600">重新打开看板</button></div></div>';
    } else {
      moduleArea.innerHTML = '<div class="module-panel" style="text-align:center;padding:60px 20px"><div style="font-size:3rem;margin-bottom:16px">📎</div><h4 style="margin-bottom:8px">需要先上传论文</h4><p style="color:var(--text-muted);font-size:.8rem;margin-bottom:20px">论文看板需要论文数据才能生成</p><button onclick="triggerUpload()" style="font-size:.85rem;padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:18px;cursor:pointer;font-weight:600">📎 上传论文</button></div>';
    }
    updateStatusBar2();
    return;
  }

  // Check if module needs thesis
  var modDef = APP_MODULES.find(function(m) { return m.id === moduleId; });
  var needsThesis = modDef ? modDef.requiresThesis : true;

  if (needsThesis && !_thesisLoaded) {
    // File-dependent module without thesis: show upload prompt
    var label = modDef ? modDef.name : moduleId;
    moduleArea.innerHTML = '<div class="module-panel" style="text-align:center;padding:60px 20px"><div style="font-size:3rem;margin-bottom:16px">📎</div><h4 style="margin-bottom:8px;color:var(--text-primary)">需要先上传论文</h4><p style="color:var(--text-muted);font-size:.8rem;margin-bottom:20px">"' + label + '"模块需要论文数据才能运行</p><button onclick="triggerUpload()" style="font-size:.85rem;padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:18px;cursor:pointer;font-weight:600">📎 上传论文</button></div>';
    updateStatusBar2();
    return;
  }

  // Load and run the module
  moduleArea.innerHTML = '<div class="module-panel"><div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:12px">⏳</div><div>正在加载...</div></div></div>';

  var runnerName = MODULE_RUNNERS[moduleId];
  if (!runnerName) {
    moduleArea.querySelector('.module-panel').innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">未知模块: ' + moduleId + '</div>';
    updateStatusBar2();
    return;
  }

  if (needsThesis) {
    // File-dependent module with thesis loaded
    showLoad('正在' + (modDef ? modDef.name : moduleId) + '...', 15, '分析论文数据中');
  }

  setTimeout(function() {
    var mc = moduleArea.querySelector('.module-panel');
    try {
      var fn = window[runnerName];
      if (typeof fn === 'function') {
        fn(mc);
      } else {
        mc.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">模块函数 ' + runnerName + ' 未定义，请确认脚本已加载</div>';
      }
    } catch (e) { mc.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">加载出错: ' + e.message + '</div>'; }
    if (needsThesis) hideLoad();
  }, 100);

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
  else if (_thesisLoaded) sb.textContent = '';
  else sb.textContent = '等待上传论文…';
  updateNavStates();
}

function onThesisLoaded() {
  _thesisLoaded = true; _analysisCache = {}; kgCurrentData = null;
  updateBarActions(); updateStatusBar2(); updateNavStates();
  if (window.ThesisProject && typeof ThesisProject.onManuscriptReady === 'function') {
    ThesisProject.onManuscriptReady();
  }
  switchView('references');
}

function switchView(view) {
  // Update bar tabs
  document.querySelectorAll('.bar-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-view') === view);
  });
  var ws = document.getElementById('workspaceContent');
  var tb = document.getElementById('thesisBox');
  var rp = document.getElementById('refPanel');

  if (view === 'workspace') {
    if (ws) {
      ws.style.display = '';
      if (typeof renderWorkspaceHero === 'function') renderWorkspaceHero();
      else if (window.ThesisProject && typeof ThesisProject.renderWorkspaceHero === 'function') ThesisProject.renderWorkspaceHero();
    }
    // Hide paper content
    var children = tb.children;
    for (var i = 0; i < children.length; i++) {
      if (children[i] !== ws) children[i].style.display = 'none';
    }
    if (rp) rp.style.display = 'none';
    _activeModule = 'workspace';
  } else if (view === 'references') {
    if (ws) ws.style.display = 'none';
    // Restore hidden thesis content
    if (tb) {
      var kids = tb.children;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i] !== ws) kids[i].style.display = '';
      }
    }
    if (rp) rp.style.display = '';
    var refOnly = rp ? rp.querySelectorAll('.ref-only') : [];
    for (var i = 0; i < refOnly.length; i++) refOnly[i].style.display = '';
    var ma = rp ? rp.querySelector('.module-area') : null;
    if (ma) ma.style.display = 'none';
    _activeModule = 'references';
  } else if (view === 'dashboard') {
    showDashboard();
  }
}

function toggleNavGroup(el) {
  el.classList.toggle('collapsed');
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

function runReviewModule(container) {
  if (!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100)) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af">请先上传论文</div>';return;
  }
  container.innerHTML = '<div class="module-panel" style="display:flex;flex-wrap:wrap;gap:12px">'+
    '<div id="reviewFormat" style="flex:1;min-width:300px;border:1px solid var(--bd);border-radius:10px;padding:12px;background:var(--card)"><div style="font-size:.8rem;font-weight:700;margin-bottom:6px">✅ 格式检查</div><div id="reviewFormatContent" style="font-size:.7rem;color:var(--m)">分析中...</div></div>'+
    '<div id="reviewParagraph" style="flex:1;min-width:300px;border:1px solid var(--bd);border-radius:10px;padding:12px;background:var(--card)"><div style="font-size:.8rem;font-weight:700;margin-bottom:6px">📝 段落分析</div><div id="reviewParaContent" style="font-size:.7rem;color:var(--m)">分析中...</div></div>'+
    '<div id="reviewTerm" style="flex:1;min-width:300px;border:1px solid var(--bd);border-radius:10px;padding:12px;background:var(--card)"><div style="font-size:.8rem;font-weight:700;margin-bottom:6px">🔤 术语分析</div><div id="reviewTermContent" style="font-size:.7rem;color:var(--m)">分析中...</div></div>'+
    '</div>';
  setTimeout(function(){
    var fc=document.getElementById('reviewFormatContent');if(fc&&typeof runFormatCheck==='function')runFormatCheck(fc);
    var pc=document.getElementById('reviewParaContent');if(pc&&typeof runParagraphAnalysis==='function')runParagraphAnalysis(pc);
    var tc=document.getElementById('reviewTermContent');if(tc&&typeof runTerminology==='function')runTerminology(tc);
  },50);
}

function runExpandModule(container) {
  // Project-aware chapter draft summary
  try{
    if(window.ThesisProject && typeof ThesisProject.listChapterCards==='function'){
      var p=ThesisProject.getCurrentProject && ThesisProject.getCurrentProject();
      if(p){
        var cards=ThesisProject.listChapterCards(p)||[];
        if(cards.length){
          var sum=cards.map(function(c){return c.title+'('+c.words+'字)';}).join(' · ');
          var banner=document.createElement('div');
          banner.className='ai-desc';
          banner.innerHTML='当前项目分章草稿：'+sum+' <button class="ai-btn-clear" style="margin-left:8px" onclick="openChapterBoard()">打开分章看板</button>';
          // prepend later after container filled by original function body via timeout
          setTimeout(function(){ if(container && container.firstChild) container.insertBefore(banner, container.firstChild); else if(container) container.appendChild(banner); },0);
        }
      }
    }
  }catch(e){}
  if (!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100)) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af">请先上传论文</div>';return;
  }
  var bodyChs=(sections||[]).filter(isBodyChapter);
  container.innerHTML = '<div class="module-panel">'+
    '<h4>✍️ 论文扩写建议</h4>'+
    '<div style="padding:12px;background:rgba(0,113,227,.05);border-radius:8px;margin-bottom:12px;font-size:.75rem;color:#555">论文扩写模块帮助从大纲逐步填充完整论文。当前状态监测后给出各章节扩写建议。</div>'+
    '<h4>📊 各章内容诊断</h4>';
  bodyChs.forEach(function(cs){
    var len=(cs.text||'').length,ratio=len/Math.max(1,(manuscriptText||'').length)*100;
    var status=len<500?'⚠ 过少':(len<2000?'📝 可扩充':(len<5000?'✅ 适中':'🔴 过长'));
    var suggest=len<500?'建议至少扩写至2000字（当前'+Math.round(len/100)/10+'千字）。可增加：文献综述、理论框架、案例支撑。':
                (len<2000?'内容偏少，建议补充实证数据、案例分析和图表说明。':
                (len<5000?'结构合理，可在结论部分增加未来展望和局限讨论。':'内容较充实，检查是否有冗余段落可精简。'));
    container.innerHTML+='<div style="border-left:1px solid '+(len<500?'#ff3b30':len<2000?'#ff9f0a':len<5000?'#30d158':'#0071e3')+';padding:8px 12px;margin:6px 0;border-radius:6px;background:rgba(0,0,0,.02)">'+
      '<div style="font-weight:600;font-size:.76rem">'+cs.name+' <span style="font-size:.62rem;color:var(--m)">('+Math.round(len/100)/10+'k字 | '+Math.round(ratio)+'%)</span> '+status+'</div>'+
      '<div style="font-size:.68rem;color:#666;margin-top:4px">'+suggest+'</div>'+
      '</div>';
  });
  container.innerHTML+='<h4>💡 通用扩写策略</h4>'+
    '<div style="font-size:.7rem;color:#555;line-height:1.8">'+
    '<b>1. 文献综述扩展：</b>检索近3-5年相关文献，按主题分类综述，每类3-5篇，总结研究空白。<br>'+
    '<b>2. 理论框架完善：</b>明确核心概念的操作化定义，建立变量关系模型，补充假设推导过程。<br>'+
    '<b>3. 方法论充实：</b>详细描述数据来源、样本量计算、问卷设计、变量测量、分析策略。<br>'+
    '<b>4. 实证分析深化：</b>增加稳健性检验、异质性分析、机制检验，多角度验证结果。'+
    '</div>'+
    '</div>';
}

function runDataAnalysis(container) {
  try{
    if(window.ThesisProject && typeof ThesisProject.listChapterCards==='function'){
      var p=ThesisProject.getCurrentProject && ThesisProject.getCurrentProject();
      if(p){
        var cards=ThesisProject.listChapterCards(p)||[];
        if(cards.length){
          var sum=cards.map(function(c){return c.title+'('+c.words+'字)';}).join(' · ');
          setTimeout(function(){
            var banner=document.createElement('div');
            banner.className='ai-desc';
            banner.innerHTML='当前项目分章草稿：'+sum+' <button class="ai-btn-clear" style="margin-left:8px" onclick="openChapterBoard()">打开分章看板</button>';
            if(container && container.firstChild) container.insertBefore(banner, container.firstChild);
          },0);
        }
      }
    }
  }catch(e){}
  container.innerHTML = '<div class="module-panel">'+
    '<h4>数据分析</h4>'+
    '<div class="ai-desc" style="padding:10px 14px;font-size:.72rem">参考无代码分析工具流程：导入 → 自动预处理 → 统计检验 → 可视化 → AI 论文表述。<br>'+
    '<b>本地计算：</b>变量概览 · 缺失率 · 描述统计 · Pearson相关 · t检验 · 直方图/箱线图/散点图<br>'+
    '<b>AI 辅助：</b>一键生成「结果描述 + 论文段落建议」（按实际 token 扣点）</div>'+
    '<div style="padding:20px;border:2px dashed var(--border);border-radius:var(--radius-lg);text-align:center">'+
    '<div style="font-size:2.2rem;margin-bottom:8px">📊</div>'+
    '<div style="font-size:.85rem;font-weight:700;margin-bottom:4px;color:var(--text-primary)">1. 导入数据，自动进行数据预处理</div>'+
    '<div style="font-size:.7rem;color:var(--text-muted);margin-bottom:12px">支持 .csv / .tsv · 自动识别数值/分类 · 缺失统计 · 无需写代码</div>'+
    '<input type="file" id="dataFileInput" accept=".csv,.tsv,.txt" style="display:none" onchange="handleDataFile(this)">'+
    '<button class="ai-btn" style="max-width:240px;margin:0 auto" onclick="document.getElementById(\'dataFileInput\').click()">📁 选择数据文件</button>'+
    '</div>'+
    '<div id="dataAnalysisResult" style="margin-top:16px"></div>'+
    '</div>';
}

function handleDataFile(input){
  var f=input.files[0];if(!f)return;
  var container=document.getElementById('dataAnalysisResult');if(!container)return;
  container.innerHTML='<div style="text-align:center;padding:30px;color:var(--text-muted)">⏳ 正在解析数据...</div>';
  analyzeCSV(f,container);
}

function analyzeCSV(f,container){
  var reader=new FileReader();
  reader.onload=function(e){
    var text=e.target.result;
    var lines=text.split('\n').filter(function(l){return l.trim();});
    if(lines.length<2){container.innerHTML='<div style="text-align:center;padding:30px;color:var(--text-muted)">文件为空或格式不正确</div>';return;}
    // Detect delimiter (comma or tab)
    var sep = lines[0].indexOf('\t') > -1 ? '\t' : ',';
    var headers=lines[0].split(sep).map(function(h){return h.replace(/"/g,'').trim();});
    var rows=lines.slice(1).map(function(l){
      var vals=l.split(sep).map(function(v){return v.replace(/"/g,'').trim();});
      var obj={}; headers.forEach(function(h,i){obj[h]=vals[i]||'';});
      return obj;
    });

    // Summary stats
    var h='<h4>📊 数据概览 <span style="font-weight:400;font-size:.7rem;color:var(--text-muted)">'+f.name+'</span></h4>';
    h+='<div class="dash-row">';
    h+='<div class="dash-item"><div class="dv">'+headers.length+'</div><div class="dl">变量</div></div>';
    h+='<div class="dash-item"><div class="dv">'+rows.length+'</div><div class="dl">观测值</div></div>';
    h+='</div>';

    // Identify numeric columns for correlation / scatter
    var numCols=[];
    headers.forEach(function(hdr){
      var vals=rows.map(function(r){return r[hdr];}).filter(function(v){return v!=='';});
      var nums=vals.map(function(v){var n=parseFloat(v);return isNaN(n)?null:n;}).filter(function(n){return n!==null;});
      if(nums.length>vals.length*0.7 && nums.length>=3) numCols.push({name:hdr, values:nums});
    });

    // Correlation matrix for numeric columns (up to 6)
    if(numCols.length>=2){
      var nShow=Math.min(6, numCols.length);
      h+='<h4>🔗 相关性矩阵（Pearson）</h4>';
      h+='<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:.68rem;min-width:280px">';
      h+='<tr><th style="padding:4px 8px;border:1px solid var(--border);background:var(--surface-alt)"></th>';
      for(var ci=0;ci<nShow;ci++) h+='<th style="padding:4px 8px;border:1px solid var(--border);background:var(--surface-alt);max-width:70px;overflow:hidden;text-overflow:ellipsis" title="'+numCols[ci].name+'">'+numCols[ci].name.substring(0,8)+'</th>';
      h+='</tr>';
      for(var i=0;i<nShow;i++){
        h+='<tr><th style="padding:4px 8px;border:1px solid var(--border);background:var(--surface-alt);text-align:left">'+numCols[i].name.substring(0,10)+'</th>';
        for(var j=0;j<nShow;j++){
          var r=pearsonCorr(numCols[i].values, numCols[j].values);
          var bg=corrColor(r);
          h+='<td style="padding:4px 8px;border:1px solid var(--border);text-align:center;background:'+bg+';font-family:var(--font-mono)">'+(i===j?'1.00':r.toFixed(2))+'</td>';
        }
        h+='</tr>';
      }
      h+='</table></div>';
      // Scatter of strongest |r| pair (non-diagonal)
      var best={abs:0,i:0,j:1};
      for(var i=0;i<nShow;i++) for(var j=i+1;j<nShow;j++){
        var rr=Math.abs(pearsonCorr(numCols[i].values,numCols[j].values));
        if(rr>best.abs) best={abs:rr,i:i,j:j};
      }
      if(best.abs>0.05){
        h+='<h4>📈 散点图（最强相关: '+numCols[best.i].name+' × '+numCols[best.j].name+', r='+pearsonCorr(numCols[best.i].values,numCols[best.j].values).toFixed(2)+'）</h4>';
        h+='<canvas id="chartScatter0" width="600" height="220" style="width:100%;max-width:600px;height:220px;border-radius:6px;background:rgba(255,255,255,0.03)"></canvas>';
      }
    }

    // Per-column analysis with charts
    h+='<h4>📋 变量分析</h4>';
    var chartIdx = 0;
    headers.forEach(function(hdr){
      var vals=rows.map(function(r){return r[hdr];}).filter(function(v){return v!=='';});
      var nums=vals.map(function(v){var n=parseFloat(v);return isNaN(n)?null:n;}).filter(function(n){return n!==null;});
      var isNum=nums.length>vals.length*0.7;

      if(isNum){
        var sum=nums.reduce(function(a,b){return a+b;},0),avg=sum/nums.length;
        var min=Math.min.apply(null,nums),max=Math.max.apply(null,nums);
        var sorted=nums.slice().sort(function(a,b){return a-b;});
        var median=sorted[Math.floor(sorted.length/2)];
        // Compute std dev
        var variance=0; nums.forEach(function(n){variance+=Math.pow(n-avg,2);}); variance/=nums.length;
        var stddev=Math.sqrt(variance);
        h+='<div style="padding:10px 12px;margin:6px 0;border-radius:var(--radius-md);background:var(--surface-alt);border:1px solid var(--border)">';
        h+='<div style="font-weight:700;font-size:.78rem;color:var(--text-primary);margin-bottom:6px">'+hdr+' <span style="font-weight:400;font-size:.65rem;color:var(--text-muted)">数值型 · '+nums.length+'个有效值</span></div>';
        h+='<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:.68rem;color:var(--text-secondary);margin-bottom:8px">';
        h+='<span>均值 <b style="color:var(--text-primary)">'+avg.toFixed(2)+'</b></span>';
        h+='<span>中位数 <b style="color:var(--text-primary)">'+median.toFixed(2)+'</b></span>';
        h+='<span>标准差 <b style="color:var(--text-primary)">'+stddev.toFixed(2)+'</b></span>';
        h+='<span>最小值 <b style="color:var(--text-primary)">'+min.toFixed(2)+'</b></span>';
        h+='<span>最大值 <b style="color:var(--text-primary)">'+max.toFixed(2)+'</b></span>';
        h+='</div>';
        h+='<canvas id="chartHist'+chartIdx+'" width="600" height="160" style="width:100%;max-width:600px;height:160px;border-radius:6px;background:rgba(255,255,255,0.03)"></canvas>';
        h+='<canvas id="chartBox'+chartIdx+'" width="600" height="120" style="width:100%;max-width:600px;height:120px;border-radius:6px;background:rgba(255,255,255,0.03);margin-top:6px"></canvas>';
        h+='</div>';
        chartIdx++;
      } else {
        var uVals={}; vals.forEach(function(v){uVals[v]=(uVals[v]||0)+1;});
        var sorted=Object.entries(uVals).sort(function(a,b){return b[1]-a[1];});
        var topItems=sorted.slice(0,8);
        var otherCount=sorted.slice(8).reduce(function(s,e){return s+e[1];},0);
        h+='<div style="padding:10px 12px;margin:6px 0;border-radius:var(--radius-md);background:var(--surface-alt);border:1px solid var(--border)">';
        h+='<div style="font-weight:700;font-size:.78rem;color:var(--text-primary);margin-bottom:6px">'+hdr+' <span style="font-weight:400;font-size:.65rem;color:var(--text-muted)">分类型 · '+vals.length+'个值 · '+sorted.length+'个类别</span></div>';
        h+='<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:.68rem;color:var(--text-secondary);margin-bottom:4px">';
        sorted.slice(0,5).forEach(function(e){
          h+='<span>'+e[0]+' <b style="color:var(--text-primary)">'+e[1]+'</b></span>';
        });
        if(sorted.length>5) h+='<span style="color:var(--text-muted)">...还有'+(sorted.length-5)+'类</span>';
        h+='</div>';
        h+='<canvas id="chartBar'+chartIdx+'" width="600" height="180" style="width:100%;max-width:600px;height:180px;border-radius:6px;background:rgba(255,255,255,0.03)"></canvas>';
        h+='</div>';
        chartIdx++;
      }
    });
    // ===== 变量概览表（类似无代码工具“数据预览/变量概览”）=====
    h+='<h4>🧾 变量概览（自动预处理）</h4>';
    h+='<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:.66rem;min-width:100%">';
    h+='<tr style="background:var(--surface-alt)"><th style="padding:6px 8px;border:1px solid var(--border);text-align:left">列名</th><th style="padding:6px 8px;border:1px solid var(--border)">类型</th><th style="padding:6px 8px;border:1px solid var(--border)">有效数</th><th style="padding:6px 8px;border:1px solid var(--border)">缺失%</th><th style="padding:6px 8px;border:1px solid var(--border)">示例</th></tr>';
    var typeMap={};
    headers.forEach(function(hdr){
      var vals=rows.map(function(r){return r[hdr];});
      var nonEmpty=vals.filter(function(v){return v!=='';});
      var nums=nonEmpty.map(function(v){var n=parseFloat(v);return isNaN(n)?null:n;}).filter(function(n){return n!==null;});
      var isNum=nums.length>nonEmpty.length*0.7;
      var miss=rows.length?((rows.length-nonEmpty.length)/rows.length*100):0;
      typeMap[hdr]=isNum?'numeric':'categorical';
      h+='<tr><td style="padding:5px 8px;border:1px solid var(--border)">'+hdr+'</td><td style="padding:5px 8px;border:1px solid var(--border);text-align:center">'+(isNum?'数值':'分类')+'</td><td style="padding:5px 8px;border:1px solid var(--border);text-align:center">'+nonEmpty.length+'</td><td style="padding:5px 8px;border:1px solid var(--border);text-align:center">'+miss.toFixed(1)+'%</td><td style="padding:5px 8px;border:1px solid var(--border);color:var(--text-muted)">'+(nonEmpty.slice(0,3).join(' | ').substring(0,40))+'</td></tr>';
    });
    h+='</table></div>';

    // ===== 一键显著性检验（无代码）=====
    var sigRows=[];
    for(var i=0;i<Math.min(numCols.length,8);i++){
      for(var j=i+1;j<Math.min(numCols.length,8);j++){
        var a=numCols[i].values,b=numCols[j].values,n=Math.min(a.length,b.length);
        if(n<5) continue;
        var r=pearsonCorr(a,b);
        var rr=Math.max(-0.999,Math.min(0.999,r));
        var z=0.5*Math.log((1+rr)/(1-rr))*Math.sqrt(n-3);
        var p=2*(1-normalCdf(Math.abs(z)));
        sigRows.push({a:numCols[i].name,b:numCols[j].name,method:'Pearson相关',stat:r,p:p});
      }
    }
    headers.forEach(function(hdr){
      if(typeMap[hdr]!=='categorical') return;
      var levels={}; rows.forEach(function(r){var v=r[hdr]; if(v) levels[v]=(levels[v]||0)+1;});
      var lv=Object.keys(levels); if(lv.length!==2) return;
      numCols.slice(0,8).forEach(function(nc){
        var g1=[],g2=[];
        rows.forEach(function(r){
          var n=parseFloat(r[nc.name]); if(isNaN(n)) return;
          if(r[hdr]===lv[0]) g1.push(n); else if(r[hdr]===lv[1]) g2.push(n);
        });
        var tt=welchTTest(g1,g2); if(!tt) return;
        sigRows.push({a:nc.name,b:hdr+'('+lv[0]+' vs '+lv[1]+')',method:'Welch t检验',stat:tt.t,p:tt.p});
      });
    });
    sigRows.sort(function(x,y){return x.p-y.p;});
    var sigTop=sigRows.slice(0,20);
    if(sigTop.length){
      h+='<h4>2. 一键显著性检验（无需代码）</h4>';
      h+='<div style="font-size:.65rem;color:var(--text-muted);margin-bottom:6px">显著性水平 α=0.05 · 展示 p 值最小的前 20 组</div>';
      h+='<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:.66rem;min-width:100%">';
      h+='<tr style="background:var(--surface-alt)"><th style="padding:6px 8px;border:1px solid var(--border)">变量A</th><th style="padding:6px 8px;border:1px solid var(--border)">变量B</th><th style="padding:6px 8px;border:1px solid var(--border)">方法</th><th style="padding:6px 8px;border:1px solid var(--border)">统计量</th><th style="padding:6px 8px;border:1px solid var(--border)">P值</th><th style="padding:6px 8px;border:1px solid var(--border)">显著性</th></tr>';
      sigTop.forEach(function(s){
        var sig=s.p<0.05;
        h+='<tr'+(sig?' style="background:rgba(16,185,129,.06)"':'')+'><td style="padding:5px 8px;border:1px solid var(--border)">'+s.a+'</td><td style="padding:5px 8px;border:1px solid var(--border)">'+s.b+'</td><td style="padding:5px 8px;border:1px solid var(--border);text-align:center">'+s.method+'</td><td style="padding:5px 8px;border:1px solid var(--border);text-align:center;font-family:var(--font-mono)">'+s.stat.toFixed(4)+'</td><td style="padding:5px 8px;border:1px solid var(--border);text-align:center;font-family:var(--font-mono)">'+(s.p<0.0001?'<0.0001':s.p.toFixed(4))+'</td><td style="padding:5px 8px;border:1px solid var(--border);text-align:center;font-weight:700;color:'+(sig?'#059669':'var(--text-muted)')+'">'+(sig?'显著':'不显著')+'</td></tr>';
      });
      h+='</table></div>';
    }

    window._dataAnalysisCache={fileName:f.name,nVar:headers.length,nObs:rows.length,summary:{numCols:numCols.map(function(c){return {name:c.name,n:c.values.length,mean:c.values.reduce(function(s,v){return s+v;},0)/c.values.length};}),headers:headers.slice(0,30)},sigTop:sigTop.map(function(s){return {a:s.a,b:s.b,method:s.method,stat:+s.stat.toFixed(4),p:+s.p.toFixed(6)};})};
    h+='<div style="margin:16px 0;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-alt)">';
    h+='<div style="font-weight:700;font-size:.78rem;margin-bottom:6px">🤖 AI 结果表述（论文写作辅助）</div>';
    h+='<div style="font-size:.65rem;color:var(--text-muted);margin-bottom:8px">把统计表转成可放入论文的“结果分析”段落。前端不显示固定点数，按实际 token 消耗计费。</div>';
    h+='<button class="ai-btn" style="max-width:220px" onclick="runDataAISummary()">生成论文结果段落</button>';
    h+='<div id="dataAIOutput" style="margin-top:10px"></div></div>';

    container.innerHTML=h;

    // Draw charts after DOM is ready
    setTimeout(function(){
      var ci=0;
      // scatter first if present
      if(numCols.length>=2){
        var nShow=Math.min(6, numCols.length);
        var best={abs:0,i:0,j:1};
        for(var i=0;i<nShow;i++) for(var j=i+1;j<nShow;j++){
          var rr=Math.abs(pearsonCorr(numCols[i].values,numCols[j].values));
          if(rr>best.abs) best={abs:rr,i:i,j:j};
        }
        var sc=document.getElementById('chartScatter0');
        if(sc && best.abs>0.05) drawScatter(sc, numCols[best.i].values, numCols[best.j].values, numCols[best.i].name, numCols[best.j].name);
      }
      headers.forEach(function(hdr){
        var vals=rows.map(function(r){return r[hdr];}).filter(function(v){return v!=='';});
        var nums=vals.map(function(v){var n=parseFloat(v);return isNaN(n)?null:n;}).filter(function(n){return n!==null;});
        var isNum=nums.length>vals.length*0.7;

        if(isNum){
          var canvas=document.getElementById('chartHist'+ci);
          if(canvas) drawHistogram(canvas, nums, hdr);
          // boxplot for numeric
          var boxC=document.getElementById('chartBox'+ci);
          if(boxC) drawBoxPlot(boxC, nums, hdr);
          ci++;
        } else {
          var uVals={}; vals.forEach(function(v){uVals[v]=(uVals[v]||0)+1;});
          var sorted=Object.entries(uVals).sort(function(a,b){return b[1]-a[1];});
          var canvas=document.getElementById('chartBar'+ci);
          if(canvas) drawBarChart(canvas, sorted.slice(0,8));
          ci++;
        }
      });
    },50);
  };
  reader.readAsText(f);
}


function erfcApprox(x){
  var z=Math.abs(x);
  var t=1/(1+0.5*z);
  var ans=t*Math.exp(-z*z-1.26551223+t*(1.00002368+t*(0.37409196+t*(0.09678418+t*(-0.18628806+t*(0.27886807+t*(-1.13520398+t*(1.48851587+t*(-0.82215223+t*0.17087277)))))))));
  return x>=0?ans:2-ans;
}
function normalCdf(x){ return 1-0.5*erfcApprox(x/Math.SQRT2); }
function studentTCdfApprox(t, df){
  if(df<=0) return 0.5;
  var x=t*Math.sqrt(df/(df+t*t));
  return normalCdf(x);
}
function welchTTest(a,b){
  if(!a||!b||a.length<2||b.length<2) return null;
  var n1=a.length,n2=b.length;
  var m1=a.reduce(function(s,v){return s+v;},0)/n1;
  var m2=b.reduce(function(s,v){return s+v;},0)/n2;
  var v1=0,v2=0; a.forEach(function(v){v1+=Math.pow(v-m1,2);}); b.forEach(function(v){v2+=Math.pow(v-m2,2);});
  v1/=(n1-1); v2/=(n2-1);
  var se=Math.sqrt(v1/n1+v2/n2); if(!se) return {t:0,p:1,df:n1+n2-2};
  var tstat=(m1-m2)/se;
  var df=Math.pow(v1/n1+v2/n2,2)/(Math.pow(v1/n1,2)/(n1-1)+Math.pow(v2/n2,2)/(n2-1));
  var p=2*(1-studentTCdfApprox(Math.abs(tstat), Math.max(1,Math.round(df))));
  return {t:tstat,p:p,df:df,mean1:m1,mean2:m2};
}
window._dataAnalysisCache=null;
window.runDataAISummary=function(){
  var cache=window._dataAnalysisCache; if(!cache){alert('请先上传并完成数据分析');return;}
  var token=sessionStorage.getItem('thesis_ai_token'); if(!token){alert('请先登录');return;}
  var out=document.getElementById('dataAIOutput'); if(!out)return;
  out.innerHTML='<div class="ai-loading">⏳ AI 正在根据统计结果撰写论文表述...</div>';
  var summary=JSON.stringify(cache.summary).substring(0,3500);
  var sig=JSON.stringify(cache.sigTop||[]).substring(0,2000);
  fetch('/api/llm/analyze',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({module:'data-analysis',system_prompt:'你是学术论文数据分析写作助手。请用中文、规范学术语气，根据统计摘要撰写：1)结果描述 2)可放入论文的段落 3)图表标题建议。不要编造未给出的数据。',
      user_prompt:'文件：'+cache.fileName+'\n变量数：'+cache.nVar+' 观测：'+cache.nObs+'\n统计摘要：'+summary+'\n显著性结果(Top)：'+sig+'\n请输出结构化中文结果。',max_tokens:1800})})
  .then(function(r){return r.json();}).then(function(d){
    if(d.success){ out.innerHTML='<div class="ai-output">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'; if(typeof updateBalanceDisplay==='function')updateBalanceDisplay(); }
    else out.innerHTML='<div class="ai-output-error">❌ '+(d.error||'失败')+'</div>';
  }).catch(function(){out.innerHTML='<div class="ai-output-error">网络错误</div>';});
};


function pearsonCorr(a,b){
  var n=Math.min(a.length,b.length); if(n<2) return 0;
  var sa=0,sb=0,sab=0,sa2=0,sb2=0;
  for(var i=0;i<n;i++){ sa+=a[i]; sb+=b[i]; sab+=a[i]*b[i]; sa2+=a[i]*a[i]; sb2+=b[i]*b[i]; }
  var den=Math.sqrt((n*sa2-sa*sa)*(n*sb2-sb*sb));
  if(!den) return 0;
  return (n*sab-sa*sb)/den;
}
function corrColor(r){
  var a=Math.min(1, Math.abs(r));
  if(r>=0) return 'rgba(99,102,241,'+(0.08+a*0.45).toFixed(2)+')';
  return 'rgba(239,68,68,'+(0.08+a*0.45).toFixed(2)+')';
}
function drawScatter(canvas, xs, ys, xl, yl){
  var dpr=window.devicePixelRatio||1;
  var W=canvas.clientWidth||600, H=canvas.clientHeight||220;
  canvas.width=W*dpr; canvas.height=H*dpr;
  var ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  var n=Math.min(xs.length,ys.length);
  var xmin=Math.min.apply(null,xs), xmax=Math.max.apply(null,xs);
  var ymin=Math.min.apply(null,ys), ymax=Math.max.apply(null,ys);
  if(xmin===xmax){xmin-=1;xmax+=1;} if(ymin===ymax){ymin-=1;ymax+=1;}
  var pad={top:12,right:12,bottom:28,left:44};
  var pw=W-pad.left-pad.right, ph=H-pad.top-pad.bottom;
  ctx.fillStyle='rgba(255,255,255,0.015)'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.strokeRect(pad.left,pad.top,pw,ph);
  ctx.fillStyle='#6366f1';
  for(var i=0;i<n;i++){
    var x=pad.left+((xs[i]-xmin)/(xmax-xmin))*pw;
    var y=pad.top+ph-((ys[i]-ymin)/(ymax-ymin))*ph;
    ctx.globalAlpha=0.65; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='10px sans-serif'; ctx.textAlign='center';
  ctx.fillText(xl+' →', pad.left+pw/2, H-6);
  ctx.save(); ctx.translate(12, pad.top+ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText(yl, 0, 0); ctx.restore();
}
function drawBoxPlot(canvas, values, label){
  if(!values||values.length<3) return;
  var dpr=window.devicePixelRatio||1;
  var W=canvas.clientWidth||600, H=canvas.clientHeight||120;
  canvas.width=W*dpr; canvas.height=H*dpr;
  var ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  var sorted=values.slice().sort(function(a,b){return a-b;});
  function q(p){ var i=(sorted.length-1)*p; var lo=Math.floor(i), hi=Math.ceil(i); return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo); }
  var q1=q(0.25), med=q(0.5), q3=q(0.75), iqr=q3-q1;
  var lo=Math.max(sorted[0], q1-1.5*iqr), hi=Math.min(sorted[sorted.length-1], q3+1.5*iqr);
  var min=sorted[0], max=sorted[sorted.length-1];
  var pad={top:16,right:16,bottom:24,left:50};
  var pw=W-pad.left-pad.right, ph=H-pad.top-pad.bottom;
  function xOf(v){ return pad.left+((v-min)/Math.max(1e-9,max-min))*pw; }
  ctx.fillStyle='rgba(255,255,255,0.015)'; ctx.fillRect(0,0,W,H);
  var midY=pad.top+ph/2;
  // whisker
  ctx.strokeStyle='#818cf8'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(xOf(lo), midY); ctx.lineTo(xOf(hi), midY); ctx.stroke();
  // box
  ctx.fillStyle='rgba(99,102,241,0.25)'; ctx.strokeStyle='#6366f1';
  ctx.fillRect(xOf(q1), midY-16, xOf(q3)-xOf(q1), 32);
  ctx.strokeRect(xOf(q1), midY-16, xOf(q3)-xOf(q1), 32);
  // median
  ctx.beginPath(); ctx.moveTo(xOf(med), midY-16); ctx.lineTo(xOf(med), midY+16); ctx.stroke();
  // whisker caps
  ctx.beginPath(); ctx.moveTo(xOf(lo), midY-10); ctx.lineTo(xOf(lo), midY+10);
  ctx.moveTo(xOf(hi), midY-10); ctx.lineTo(xOf(hi), midY+10); ctx.stroke();
  // outliers
  ctx.fillStyle='#f59e0b';
  sorted.forEach(function(v){ if(v<lo||v>hi){ ctx.beginPath(); ctx.arc(xOf(v), midY, 2.5, 0, Math.PI*2); ctx.fill(); }});
  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='10px sans-serif'; ctx.textAlign='center';
  ctx.fillText(label+' 箱线图  Q1='+q1.toFixed(2)+'  M='+med.toFixed(2)+'  Q3='+q3.toFixed(2), pad.left+pw/2, H-6);
}

// Simple histogram for numeric data
function drawHistogram(canvas, values, label) {
  var dpr=window.devicePixelRatio||1;
  var W=canvas.clientWidth, H=canvas.clientHeight;
  canvas.width=W*dpr; canvas.height=H*dpr;
  var ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);

  var min=Math.min.apply(null,values), max=Math.max.apply(null,values);
  if(min===max){min-=1;max+=1;}
  var bins=Math.min(20, Math.max(5, Math.ceil(Math.sqrt(values.length))));
  var binW=(max-min)/bins;
  var counts=new Array(bins).fill(0);
  values.forEach(function(v){
    var idx=Math.min(bins-1, Math.floor((v-min)/binW));
    counts[idx]++;
  });
  var maxCount=Math.max.apply(null,counts);
  var pad={top:8,right:12,bottom:28,left:50};
  var pw=W-pad.left-pad.right, ph=H-pad.top-pad.bottom;
  var barW=pw/bins*0.85, gap=pw/bins*0.15;

  // Background
  ctx.fillStyle='rgba(255,255,255,0.015)';
  ctx.fillRect(0,0,W,H);

  // Grid lines
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=0.5;
  for(var i=0;i<=4;i++){
    var y=pad.top+ph*i/4;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
  }

  // Bars
  var accent='#6366f1';
  counts.forEach(function(c,i){
    var bh=(c/maxCount)*ph;
    var x=pad.left+i*barW+i*gap;
    var y=pad.top+ph-bh;
    ctx.fillStyle=accent; ctx.globalAlpha=0.8;
    ctx.beginPath();
    ctx.roundRect(x,y,barW,bh,[2,2,0,0]);
    ctx.fill();
  });
  ctx.globalAlpha=1;

  // Axes
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(pad.left,pad.top); ctx.lineTo(pad.left,pad.top+ph); ctx.lineTo(W-pad.right,pad.top+ph); ctx.stroke();

  // Labels
  ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='10px -apple-system,sans-serif';
  ctx.textAlign='center';
  for(var i=0;i<=4;i++){
    var val=min+(max-min)*i/4;
    var y=pad.top+ph-ph*i/4;
    ctx.fillText(val.toFixed(1),pad.left/2+10,y+4);
  }
  ctx.fillText(label, W/2, H-4);
}

// Horizontal bar chart for categorical data
function drawBarChart(canvas, items) {
  var dpr=window.devicePixelRatio||1;
  var W=canvas.clientWidth, H=canvas.clientHeight;
  canvas.width=W*dpr; canvas.height=H*dpr;
  var ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);

  var maxVal=items[0]?items[0][1]:1;
  var pad={top:4,right:12,bottom:4,left:100};
  var pw=W-pad.left-pad.right, ph=H-pad.top-pad.bottom;
  var barH=Math.min(20, ph/items.length-4);
  var colors=['#6366f1','#818cf8','#a78bfa','#c4b5fd','#22d3ee','#34d399','#f59e0b','#f472b6'];

  ctx.fillStyle='rgba(255,255,255,0.015)';
  ctx.fillRect(0,0,W,H);

  items.forEach(function(item,i){
    var y=pad.top+i*(barH+4);
    var bw=(item[1]/maxVal)*pw;
    // label
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='10px -apple-system,sans-serif';
    ctx.textAlign='right';
    var label=item[0]; if(label.length>12)label=label.substring(0,11)+'…';
    ctx.fillText(label, pad.left-8, y+barH/2+4);
    // bar
    ctx.fillStyle=colors[i%colors.length]; ctx.globalAlpha=0.75;
    ctx.beginPath();
    ctx.roundRect(pad.left, y, bw, barH, [0,3,3,0]);
    ctx.fill();
    ctx.globalAlpha=1;
    // count
    ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.font='9px -apple-system,sans-serif';
    ctx.textAlign='left';
    ctx.fillText(item[1], pad.left+bw+6, y+barH/2+4);
  });
}

// ==================== 初始化 ====================
(function() {
  // 先尝试从 sessionStorage 恢复，恢复成功就不弹上传遮罩
  try{
    var savedT=sessionStorage.getItem('thesis_backup_text');
    var savedH=sessionStorage.getItem('thesis_backup_html');
    if(savedT&&savedH&&savedT.length>100){
      console.log('[session] Restoring thesis from sessionStorage:',Math.round(savedT.length/1000)+'k chars');
      manuscriptText=savedT;manuscriptHTML=savedH;
      document.getElementById('thesisBox').innerHTML=manuscriptHTML;
      try{
        var box2=document.getElementById('thesisBox');
        sections=[];var allEls5=box2.querySelectorAll('p,h1,h2,h3,h4,h5,h6');
        var refBound2=null;
        for(var ri2=0;ri2<allEls5.length;ri2++){var rt2=(allEls5[ri2].textContent||'').replace(/\s+/g,'');if(rt2.indexOf('参考文献')===0&&rt2.length<20){refBound2=allEls5[ri2];break;}}
        var bodyStart2=Math.max(0,Math.floor(allEls5.length*0.08));
        var allHd2=[];
        for(var ei2=bodyStart2;ei2<allEls5.length;ei2++){
          var el2=allEls5[ei2],txt2=(el2.textContent||'').trim();
          if(!txt2||txt2.length<2)continue;
          if(refBound2&&(el2.compareDocumentPosition(refBound2)&Node.DOCUMENT_POSITION_FOLLOWING))break;
          if(/^H[1-6]$/.test((el2.tagName||'').toUpperCase())){
            allHd2.push({el:el2,txt:txt2,level:-1,tagLevel:parseInt(el2.tagName.charAt(1)),bare:false});
          }
        }
        for(var ei22=bodyStart2;ei22<allEls5.length;ei22++){
          var ef2=allEls5[ei22],tf2=(ef2.textContent||'').trim();
          if(!tf2||tf2.length<2||(refBound2&&(ef2.compareDocumentPosition(refBound2)&Node.DOCUMENT_POSITION_FOLLOWING)))continue;
          var dup2=false;for(var di2=0;di2<allHd2.length;di2++){if(allHd2[di2].el===ef2){dup2=true;break;}}if(dup2)continue;
          allHd2.push({el:ef2,txt:tf2,level:-1,tagLevel:-1,bare:false});
        }
        sections=buildFullTree(box2,allHd2,bodyStart2,refBound2);
        paperTopics=extractTopics(manuscriptText);renderNavTree(sections);
      }catch(e){console.warn('[session] Tree rebuild failed:',e.message);}
      document.getElementById('statusBar').textContent='已恢复 '+(sections.length||0)+'章（刷新恢复）';
    }
  }catch(e3){}

  // 页面刷新时已有论文数据就不弹上传遮罩
  var hasData = (typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100)
    || (typeof sections !== 'undefined' && sections && sections.length > 0);
  // Thesis OS: 默认进入项目工作台，而不是强弹上传
  if (!hasData) {
    // 不再自动 showUploadOverlay，改为项目总览引导
    if (typeof switchView === 'function') switchView('workspace');
  }
  renderModuleTabs(); updateBarActions(); updateStatusBar2();
  initKeyboard();
  if (window.ThesisProject && typeof ThesisProject.renderProjectChrome === 'function') {
    ThesisProject.renderProjectChrome();
  }
  if (typeof renderWorkspaceHero === 'function') renderWorkspaceHero();

  var pollCount = 0;
  var pollTimer = setInterval(function() {
    pollCount++;
    if (_thesisLoaded) { clearInterval(pollTimer); return; }
    if (typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100) { clearInterval(pollTimer); onThesisLoaded(); return; }
    if (pollCount > 120) clearInterval(pollTimer);
  }, 1000);
})();
