/**
 * 论文AI利器 — 模块系统
 * 模块标签顶栏 / 操作按钮顶栏 / 键盘快捷键 / 换论文 / 悬浮上传
 */

var APP_MODULES = [
  { id: 'review',          name: '论文审阅',   icon: '🔍', requiresThesis: true },
  { id: 'optimization',    name: '优化建议',   icon: '💡', requiresThesis: true },
  { id: 'expand',          name: '论文扩写',   icon: '✍️', requiresThesis: true },
  { id: 'proposal',        name: '开题大纲',   icon: '📝', requiresThesis: false },
  { id: 'data-analysis',   name: '数据分析',   icon: '📈', requiresThesis: false },
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
          else if (moduleId === 'review' && typeof runReviewModule === 'function') runReviewModule(mc);
          else if (moduleId === 'expand' && typeof runExpandModule === 'function') runExpandModule(mc);
          else if (moduleId === 'data-analysis' && typeof runDataAnalysis === 'function') runDataAnalysis(mc);
          else if (moduleId === 'proposal' && typeof runProposalModule === 'function') runProposalModule(mc);
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
  else if (_thesisLoaded) sb.textContent = '';
  else sb.textContent = '等待上传论文…';
}

function onThesisLoaded() {
  _thesisLoaded = true; _analysisCache = {}; kgCurrentData = null;
  updateBarActions(); updateStatusBar2();
  switchView('refs');
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
    if (ws) ws.style.display = '';
    // Hide paper content
    var children = tb.children;
    for (var i = 0; i < children.length; i++) {
      if (children[i] !== ws) children[i].style.display = 'none';
    }
    if (rp) rp.style.display = 'none';
    _activeModule = 'workspace';
  } else if (view === 'references') {
    if (ws) ws.style.display = 'none';
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

// Override switchModule to show content in thesis panel
var _origSwitchModule = switchModule;
window.switchModule = function(moduleId) {
  if (typeof searchRunning !== 'undefined' && searchRunning) { ttp('检索进行中，请等待完成'); return; }
  _activeModule = moduleId;
  // Highlight nav item
  document.querySelectorAll('.nav-item').forEach(function(n) {
    n.classList.toggle('active', n.getAttribute('data-module') === moduleId);
  });
  // Show module in thesis panel
  var tb = document.getElementById('thesisBox');
  var ws = document.getElementById('workspaceContent');
  if (ws) ws.style.display = 'none';
  // Hide paper content, show module output
  var children = tb.children;
  for (var i = 0; i < children.length; i++) {
    if (children[i] !== ws) children[i].style.display = 'none';
  }
  var mc = document.getElementById('moduleOutput');
  if (!mc) {
    mc = document.createElement('div');
    mc.id = 'moduleOutput';
    mc.style.cssText = 'padding:0;flex:1;overflow-y:auto';
    tb.appendChild(mc);
  }
  mc.style.display = '';
  mc.innerHTML = '<div class="module-panel"><div style="text-align:center;padding:40px;color:var(--m)"><div style="font-size:2rem;margin-bottom:12px">⏳</div><div>正在分析...</div></div></div>';

  if (moduleId === 'knowledge-graph') { showKnowledgeGraph(); mc.innerHTML = '<div class="module-panel"><div style="text-align:center;padding:50px"><div style="font-size:3rem;margin-bottom:16px">🕸️</div><div style="color:var(--m);margin-bottom:16px">知识图谱弹窗已打开</div><button onclick="showKnowledgeGraph()" style="font-size:.85rem;padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:18px;cursor:pointer;font-weight:600">重新打开知识图谱</button></div></div>'; return; }
  if (!_thesisLoaded && moduleId !== 'data-analysis' && moduleId !== 'proposal') { mc.innerHTML = '<div class="module-panel"><div style="text-align:center;padding:40px;color:#9ca3af">请先上传论文</div></div>'; return; }

  showLoad('分析中...', 15, '');
  setTimeout(function() {
    var panel = mc.querySelector('.module-panel');
    try {
      if (moduleId === 'optimization' && typeof runOptimization === 'function') runOptimization(panel);
      else if (moduleId === 'review' && typeof runReviewModule === 'function') runReviewModule(panel);
      else if (moduleId === 'expand' && typeof runExpandModule === 'function') runExpandModule(panel);
      else if (moduleId === 'data-analysis' && typeof runDataAnalysis === 'function') runDataAnalysis(panel);
      else if (moduleId === 'proposal' && typeof runProposalModule === 'function') runProposalModule(panel);
    } catch (e) { panel.innerHTML = '<div style="text-align:center;padding:40px;color:var(--r)">分析出错: ' + e.message + '</div>'; }
    hideLoad();
  }, 100);
};

// Keep switchPanel for backwards compat
function switchPanel(moduleId) {
  if (moduleId === 'references') {
    switchView('references');
  } else {
    switchModule(moduleId);
  }
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
  if (!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100)) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af">请先上传论文</div>';return;
  }
  var bodyChs=(sections||[]).filter(function(s){return!/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name)});
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
    container.innerHTML+='<div style="border-left:3px solid '+(len<500?'#ff3b30':len<2000?'#ff9f0a':len<5000?'#30d158':'#0071e3')+';padding:8px 12px;margin:6px 0;border-radius:6px;background:rgba(0,0,0,.02)">'+
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
  // Placeholder until user uploads Excel file
  container.innerHTML = '<div class="module-panel">'+
    '<h4>📈 数据分析</h4>'+
    '<div style="padding:20px;border:2px dashed #ccc;border-radius:12px;text-align:center">'+
    '<div style="font-size:3rem;margin-bottom:8px">📊</div>'+
    '<div style="font-size:.8rem;font-weight:600;margin-bottom:4px">上传 Excel 数据进行智能分析</div>'+
    '<div style="font-size:.7rem;color:#999;margin-bottom:12px">支持 .xlsx / .csv，自动识别变量类型与数据规律</div>'+
    '<input type="file" id="dataFileInput" accept=".xlsx,.csv" style="display:none" onchange="handleDataFile(this)">'+
    '<button onclick="document.getElementById(\'dataFileInput\').click()" style="background:#0071e3;color:#fff;border:none;border-radius:18px;padding:8px 24px;cursor:pointer;font-weight:600;font-size:.75rem">📁 选择数据文件</button>'+
    '</div>'+
    '<div id="dataAnalysisResult" style="margin-top:12px"></div>'+
    '</div>';
}

function handleDataFile(input){
  var f=input.files[0];if(!f)return;
  var container=document.getElementById('dataAnalysisResult');if(!container)return;
  container.innerHTML='<div style="text-align:center;padding:30px;color:var(--m)">⏳ 正在分析数据…</div>';
  var ext=(f.name||'').toLowerCase().split('.').pop();
  if(ext==='xlsx'){
    container.innerHTML='<div style="padding:16px;background:#fff3cd;border-radius:8px;font-size:.72rem;color:#856404">⚠ XLSX 格式需要完整解析库。请将文件另存为 <b>CSV（逗号分隔）</b> 格式后重新上传。<br><br>或者，下面显示的是基础数据信息。</div>';
    analyzeCSV(f,container);
  } else {
    analyzeCSV(f,container);
  }
}

function analyzeCSV(f,container){
  var reader=new FileReader();
  reader.onload=function(e){
    var text=e.target.result;
    var lines=text.split('\n').filter(function(l){return l.trim();});
    if(lines.length<2){container.innerHTML='<div style="text-align:center;padding:30px;color:var(--m)">文件为空或格式不正确</div>';return;}
    var headers=lines[0].split(/[,\t]/).map(function(h){return h.replace(/"/g,'').trim();});
    var rows=lines.slice(1).map(function(l){var vals=l.split(/[,\t]/).map(function(v){return v.replace(/"/g,'').trim();});var obj={};headers.forEach(function(h,i){obj[h]=vals[i]||'';});return obj;});
    // Basic analysis
    var h='<h4>📊 数据概览 ('+f.name+')</h4>';
    h+='<div class="dash-row">';
    h+='<div class="dash-item"><div class="dv">'+headers.length+'</div><div class="dl">变量</div></div>';
    h+='<div class="dash-item"><div class="dv">'+rows.length+'</div><div class="dl">观测值</div></div>';
    h+='</div>';
    h+='<h4>📋 变量详情</h4>';
    headers.forEach(function(hdr){
      var vals=rows.map(function(r){return r[hdr];}).filter(function(v){return v!=='';});
      var nums=vals.map(function(v){var n=parseFloat(v);return isNaN(n)?null:n;}).filter(function(n){return n!==null;});
      var isNum=nums.length>vals.length*0.7;
      if(isNum){
        var sum=nums.reduce(function(a,b){return a+b;},0),avg=sum/nums.length;
        var min=Math.min.apply(null,nums),max=Math.max.apply(null,nums);
        h+='<div style="padding:6px 8px;margin:2px 0;border-radius:6px;background:rgba(0,0,0,.02);font-size:.7rem"><b>'+hdr+'</b> (数值, '+nums.length+'个有效值) 平均:'+avg.toFixed(2)+' 范围:['+min.toFixed(2)+', '+max.toFixed(2)+']</div>';
      } else {
        var uVals={};vals.forEach(function(v){uVals[v]=(uVals[v]||0)+1;});var topKV=Object.entries(uVals).sort(function(a,b){return b[1]-a[1];}).slice(0,5).map(function(e){return e[0]+'('+e[1]+')';}).join(', ');
        h+='<div style="padding:6px 8px;margin:2px 0;border-radius:6px;background:rgba(0,0,0,.02);font-size:.7rem"><b>'+hdr+'</b> (分类, '+vals.length+'个有效值) TOP: '+topKV+'</div>';
      }
    });
    container.innerHTML=h;
  };
  reader.readAsText(f);
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
  if (!hasData) {
    showUploadOverlay();
  }
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
