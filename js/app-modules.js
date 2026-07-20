
(function initRuntimeUpgradeCoordinator(){
  var loadedCommit='',deadlineMs=0,lastMode='normal',reloadStarted=false,pollTimer=null,pollInFlight=false;
  function formatRemaining(ms){var s=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(s/60);return String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
  function flush(){
    var btn=document.getElementById('serviceUpgradeSave');if(btn){btn.disabled=true;btn.textContent='保存中…';}
    var p=window.ThesisProject&&ThesisProject.flushAllDirty?ThesisProject.flushAllDirty({force:true}):Promise.resolve({success:true});
    return p.then(function(r){if(btn){btn.disabled=false;btn.textContent=r.success?'已保存':'重试保存';}return r;}).catch(function(){if(btn){btn.disabled=false;btn.textContent='重试保存';}return{success:false};});
  }
  function tick(){var el=document.getElementById('serviceUpgradeCountdown');if(el)el.textContent=deadlineMs?formatRemaining(deadlineMs-Date.now()):'等待恢复';}
  function schedule(){clearTimeout(pollTimer);pollTimer=setTimeout(poll,lastMode==='normal'?25000:4000);}
  function handleStatus(s){
    lastMode=s.mode||'normal';var b=document.getElementById('serviceUpgradeBanner');if(!b)return;
    if(lastMode==='normal'){
      if(s.commit&&loadedCommit&&s.commit!==loadedCommit&&!reloadStarted){reloadStarted=true;flush().then(function(r){if(r.success)location.reload();else reloadStarted=false;});}
      else b.hidden=true;
      return;
    }
    b.hidden=false;
    document.getElementById('serviceUpgradeTitle').textContent=lastMode==='announced'?'服务即将升级':'服务升级中';
    document.getElementById('serviceUpgradeMessage').textContent=s.message||'请尽快保存当前内容；新任务暂时不可用。';
    if(s.deadlineAt){var serverNow=Date.parse(s.serverTime)||Date.now(),serverDeadline=Date.parse(s.deadlineAt);deadlineMs=Date.now()+Math.max(0,serverDeadline-serverNow);}else deadlineMs=0;
    tick();flush();
  }
  function poll(){if(pollInFlight)return;schedule();pollInFlight=true;fetch('/api/runtime/status',{cache:'no-store'}).then(function(r){return r.json();}).then(function(s){if(!loadedCommit)loadedCommit=s.commit||'';handleStatus(s);}).catch(function(){}).finally(function(){pollInFlight=false;schedule();});}
  window.addEventListener('DOMContentLoaded',function(){var save=document.getElementById('serviceUpgradeSave');if(save)save.onclick=flush;setInterval(tick,1000);poll();});
  window.addEventListener('visibilitychange',function(){if(!document.hidden){clearTimeout(pollTimer);poll();}else clearTimeout(pollTimer);});
})();

(function initBeijingTimeSync(){
  var clockOffsetMs=0,lastSyncAt=0,timer=null;
  function applyServerTime(payload){
    if(!payload)return;
    var unix=Number(payload.unix_ms||0);
    var parsed=Date.parse(payload.iso||payload.server_time||'');
    var serverMs=unix||parsed;
    if(!serverMs||!isFinite(serverMs))return;
    clockOffsetMs=serverMs-Date.now();
    lastSyncAt=Date.now();
    window.__beijingClockOffsetMs=clockOffsetMs;
    window.__beijingServerTime=payload.server_time||'';
    window.__beijingTimezone=payload.timezone||'Asia/Shanghai';
    try{localStorage.setItem('thesisbuddy_clock_offset_ms',String(clockOffsetMs));localStorage.setItem('thesisbuddy_clock_synced_at',String(lastSyncAt));}catch(e){}
  }
  function syncBeijingTime(){
    return fetch('/api/time',{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){
      if(d&&(d.success||d.server_time||d.unix_ms))applyServerTime(d);
      return d;
    }).catch(function(){
      return fetch('/api/version',{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){
        if(d&&d.server_time)applyServerTime({server_time:d.server_time,timezone:d.timezone||'Asia/Shanghai'});
        return d;
      });
    }).catch(function(){return null;});
  }
  function beijingNow(){return new Date(Date.now()+Number(window.__beijingClockOffsetMs||0));}
  function formatBeijing(date){
    var d=date||beijingNow();
    try{return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d).replace(/\//g,'-');}catch(e){}
    return d.toISOString().slice(0,19).replace('T',' ');
  }
  window.syncBeijingTime=syncBeijingTime;
  window.beijingNow=beijingNow;
  window.formatBeijingTime=formatBeijing;
  try{
    var saved=Number(localStorage.getItem('thesisbuddy_clock_offset_ms')||0);
    if(isFinite(saved)){clockOffsetMs=saved;window.__beijingClockOffsetMs=saved;}
  }catch(e){}
  window.addEventListener('DOMContentLoaded',function(){
    syncBeijingTime();
    if(timer)clearInterval(timer);
    timer=setInterval(syncBeijingTime,60*60*1000); // hourly sync with Beijing server clock
  });
  window.addEventListener('visibilitychange',function(){if(!document.hidden)syncBeijingTime();});
})();

function escapeModuleHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function getSessionScope(){
  try{
    var user=JSON.parse(sessionStorage.getItem('thesis_ai_user')||'{}');
    var uid=user&&user.id!=null?String(user.id):'guest';
    var pid=window.ThesisProject&&ThesisProject.getCurrentProject?((ThesisProject.getCurrentProject()||{}).id||'unassigned'):'unassigned';
    return uid+'_'+pid;
  }catch(e){return 'guest_unassigned';}
}
function manuscriptBackupKey(kind){return 'thesis_backup_'+kind+'_'+getSessionScope();}
function legacyBackupKey(kind){return 'thesis_backup_'+kind;}
function clearManuscriptRuntime(){
  existingRefs=[];mergedRefs=[];manuscriptText='';manuscriptHTML='';paperTopics=[];sections=[];
  _treeIndex={chapters:[],sections:[],subs:[],paragraphs:[],sentences:[]};
  _thesisLoaded=false;_analysisCache={};kgCurrentData=null;
  var tb=document.getElementById('thesisBox');
  if(tb){
    var ws=document.getElementById('workspaceContent');
    Array.prototype.slice.call(tb.childNodes).forEach(function(n){if(n!==ws)tb.removeChild(n);});
    if(ws){ws.style.display='';ws.style.height='';ws.style.overflow='visible';}
  }
  if(typeof renderNavTree==='function')renderNavTree([]);
  var refs=document.getElementById('refs');if(refs)refs.innerHTML='<div class="panel-empty">导入论文或检索后，文献会出现在这里</div>';
  var kw=document.getElementById('kwBar');if(kw)kw.style.display='none';
  updateBarActions();updateStatusBar2();updateNavStates();
}
window.clearManuscriptRuntime=clearManuscriptRuntime;

function ensureLoggedIn(msg){
  try{
    var t=sessionStorage.getItem('thesis_ai_token');
    if(t) return true;
  }catch(e){}
  if(typeof ttp==='function') ttp(msg||'请先登录');
  else alert(msg||'请先登录后再使用');
  try{
    var lb=document.getElementById('loginBox')||document.getElementById('authOverlay');
    if(lb) lb.style.display='';
  }catch(e2){}
  return false;
}
/**
 * 论文搭子 ThesisBuddy — 模块系统
 * 模块标签顶栏 / 操作按钮顶栏 / 键盘快捷键 / 换论文 / 悬浮上传
 */

// 共享工具：过滤附录/致谢等非正文章节
function isBodyChapter(s) {
  return !/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name || '');
}

// ==================== 模块清单 ====================
// requiresThesis: 是否需要先上传论文才能使用
// aiDriven: 是否调用 AI 大模型（消耗点数）

// ===== Tool dock (right panel home) + favorites =====
var TOOLBOX_KEY = 'thesis_ai_toolbox_favs_v1';
function toolboxStorageKey(){try{var u=JSON.parse(sessionStorage.getItem('thesis_ai_user')||'{}');return TOOLBOX_KEY+'_u'+(u.id!=null?u.id:'guest');}catch(e){return TOOLBOX_KEY+'_guest';}}
var DEFAULT_FAVS = ['data-analysis','topic-finder','proofread','defense-ppt','materials','pipeline'];

function loadToolboxFavs(){
  try{
    var raw = localStorage.getItem(toolboxStorageKey());
    if(!raw) return DEFAULT_FAVS.slice();
    var arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : DEFAULT_FAVS.slice();
  }catch(e){ return DEFAULT_FAVS.slice(); }
}
function saveToolboxFavs(arr){
  try{ localStorage.setItem(toolboxStorageKey(), JSON.stringify(arr||[])); }catch(e){}
}
function toolMeta(id){
  if(id==='materials') return {id:id, name:'资料库', icon:'📁', requiresThesis:false, desc:'上传/选用 CSV 等项目文件'};
  if(id==='pipeline') return {id:id, name:'一键流水线', icon:'⚡', requiresThesis:false, desc:'大纲+章节骨架一次生成'};
  if(id==='defense-pack') return {id:id, name:'答辩材料包', icon:'🎤', requiresThesis:false, desc:'PPT/讲稿/问答提纲'};
  if(id==='ref-norm') return {id:id, name:'文献规范化', icon:'📚', requiresThesis:false, desc:'GB/T 7714 风格整理'};
  if(id==='preview') return {id:id, name:'完整预览', icon:'👁', requiresThesis:false, desc:'导出前看全文'};
  var m = (typeof APP_MODULES!=='undefined'?APP_MODULES:[]).find(function(x){return x.id===id;});
  return m || {id:id, name:id, icon:'•', requiresThesis:true, desc:''};
}
function launchTool(id){
  if(window.innerWidth<1024)toggleToolPanel(true);
  if(id==='materials'){ if(typeof openMaterialsLibrary==='function') openMaterialsLibrary(); return; }
  if(id==='pipeline'){ if(typeof runOneClickPipeline==='function') runOneClickPipeline(); return; }
  if(id==='defense-pack'){ if(typeof openDefensePack==='function') openDefensePack(); return; }
  if(id==='ref-norm'){ if(typeof normalizeRefsGBT7714==='function') normalizeRefsGBT7714(); return; }
  if(id==='preview'){ if(typeof openFullPaperPreview==='function') openFullPaperPreview(); return; }
  switchModule(id);
}
function renderToolboxFavorites(){
  var host=document.getElementById('toolboxFavorites'); if(!host) return;
  var favs=loadToolboxFavs();
  if(!favs.length){ host.innerHTML='<div style="padding:6px 10px;color:rgba(255,255,255,.35);font-size:.62rem">还没有快捷入口</div>'; return; }
  host.innerHTML = favs.map(function(id){
    var m=toolMeta(id);
    return '<button class="toolbox-fav" onclick="launchTool(\''+id+'\')">'+ (m.icon||'') + ' ' + (m.name||id) + '</button>';
  }).join('');
}
function openToolboxPicker(){
  var favs=loadToolboxFavs();
  var all = (APP_MODULES||[]).map(function(m){return m.id;}).concat(['materials','pipeline','defense-pack','ref-norm','preview']);
  var seen={}; all=all.filter(function(id){ if(seen[id])return false; seen[id]=1; return true; });
  var html='<div class="toolbox-picker-list">';
  all.forEach(function(id){
    var m=toolMeta(id);
    var checked = favs.indexOf(id)>=0 ? 'checked' : '';
    html += '<label class="toolbox-picker-item">'+
      '<input type="checkbox" data-tool-id="'+id+'" '+checked+'>'+
      '<span class="toolbox-picker-copy"><b>'+ (m.icon||'') + ' ' + m.name + '</b><small>'+ (m.desc|| (m.requiresThesis?'需要论文':'可随时使用')) +'</small></span></label>';
  });
  html+='</div>';
  if(typeof openAccountModal==='function'){
    openAccountModal('自定义百宝箱', html + '<div class="toolbox-picker-actions"><button type="button" class="ai-btn" onclick="saveToolboxPicker()">保存快捷入口</button></div>');
  } else {
    var ov=document.createElement('div'); ov.className='project-overlay'; ov.id='toolboxPickerOv';
    ov.innerHTML='<div class="project-modal" onclick="event.stopPropagation()"><div class="project-modal-head"><h3>自定义百宝箱</h3><button class="project-close" onclick="this.closest(\'.project-overlay\').remove()">×</button></div>'+html+'<div class="project-modal-actions"><button type="button" class="ai-btn" onclick="saveToolboxPicker()">保存</button></div></div>';
    document.body.appendChild(ov);
  }
}
function saveToolboxPicker(){
  var boxes=document.querySelectorAll('[data-tool-id]');
  var arr=[]; boxes.forEach(function(b){ if(b.checked) arr.push(b.getAttribute('data-tool-id')); });
  if(!arr.length) arr=DEFAULT_FAVS.slice();
  saveToolboxFavs(arr);
  renderToolboxFavorites();
  if(typeof closeAccountModal==='function') closeAccountModal();
  var ov=document.getElementById('toolboxPickerOv'); if(ov) ov.remove();
  if(typeof ttp==='function') ttp('百宝箱已更新');
}
function openFeatureCatalog(){ openToolHome(); }
function openToolHome(){
  if(window.innerWidth<1024)toggleToolPanel(true);
  var home=document.getElementById('toolHome');
  if(home){
    home.style.display='';
    home.style.flex='1 1 auto';
    home.style.minHeight='0';
    home.style.overflowY='auto';
    home.style.height='';
    home.style.padding='';
  }
  // hide ref-only and module area content view conceptually by showing home on top
  var panel=document.getElementById('refPanel');
  if(panel){
    panel.querySelectorAll('.ref-only').forEach(function(el){ el.style.display='none'; });
    var ma=panel.querySelector('.module-area');
    if(ma){
      ma.style.display='none';
      ma.style.flex='0 0 0';
      ma.style.minHeight='0';
      ma.style.height='0';
      ma.style.overflow='hidden';
    }
  }
  document.querySelectorAll('.tool-tab').forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-tooltab')==='home'); });
  var title=document.getElementById('toolPanelTitle'); if(title) title.textContent='工具台';
  var sub=document.getElementById('toolPanelSub'); if(sub) sub.textContent='先选功能；论文全貌与目录始终保留在左侧';
  renderToolHome();
  renderToolboxFavorites();
}
function renderToolHome(){
  var freeHost=document.getElementById('toolHomeGrid');
  var thesisHost=document.getElementById('toolHomeGridThesis');
  if(!freeHost||!thesisHost) return;
  var free=[], need=[];
  (APP_MODULES||[]).forEach(function(m){ (m.requiresThesis?need:free).push(m); });
  // ensure data-analysis highlighted
  freeHost.innerHTML = free.map(function(m){
    var billing = m.aiDriven ? '智能辅助 · 按用量计点' : (m.localCharge ? '分析能力 · 按次计点' : (m.serverFixed ? '分析能力 · 按次计点' : '可用'));
    return '<button class="tool-card" onclick="launchTool(\''+m.id+'\')"><b>'+m.icon+' '+m.name+'</b><span>'+billing+'</span></button>';
  }).join('') +
  '<button class="tool-card" onclick="launchTool(\'materials\')"><b>📁 资料库</b><span>上传 CSV 等，供分析模块复用</span></button>'+
  '<button class="tool-card" onclick="launchTool(\'pipeline\')"><b>⚡ 一键流水线</b><span>大纲+章节骨架</span></button>'+
  '<button class="tool-card" onclick="launchTool(\'defense-pack\')"><b>🎤 答辩材料包</b><span>讲稿/问答/PPT结构</span></button>';
  thesisHost.innerHTML = need.map(function(m){
    var billing = m.aiDriven ? '智能辅助' : (m.localCharge ? '按次计点' : '');
    return '<button class="tool-card" onclick="launchTool(\''+m.id+'\')"><b>'+m.icon+' '+m.name+'</b><span>基于论文内容分析'+(billing?' · '+billing:'')+'</span><div class="need-tag">建议先有论文/草稿</div></button>';
  }).join('');
}
function toggleTocPanel(){
  var p=document.getElementById('tocPanel'); if(!p) return;
  if(window.innerWidth<1024){
    document.body.classList.toggle('toc-drawer-open');
    document.body.classList.remove('tool-drawer-open');
    return;
  }
  p.classList.toggle('collapsed');
}
function toggleToolPanel(force){
  var open=typeof force==='boolean'?force:!document.body.classList.contains('tool-drawer-open');
  document.body.classList.toggle('tool-drawer-open',open);
  if(open)document.body.classList.remove('toc-drawer-open');
}
window.toggleToolPanel=toggleToolPanel;
function setToolPanelHeader(name, sub){
  var t=document.getElementById('toolPanelTitle'); if(t) t.textContent=name||'工具台';
  var s=document.getElementById('toolPanelSub'); if(s) s.textContent=sub||'';
}


var APP_MODULES = [
  // 选题阶段 — 无需论文, AI驱动
  { id: 'topic-finder',    name: '选题推荐',   icon: '💡', requiresThesis: false, aiDriven: true },
  { id: 'proposal',        name: '开题大纲',   icon: '📝', requiresThesis: false, aiDriven: true },
  // 撰写阶段
  { id: 'references',      name: '参考文献',   icon: '📋', requiresThesis: true,  aiDriven: false },
  { id: 'expand',          name: '论文扩写',   icon: '✍️', requiresThesis: false, aiDriven: true },
  { id: 'data-analysis',   name: '数据分析',   icon: '📈', requiresThesis: false, aiDriven: false, serverFixed: true, localCharge: true, openOnly: true },
  { id: 'knowledge-graph', name: '知识图谱',   icon: '🕸️', requiresThesis: true,  aiDriven: false, serverFixed: true },
  // 打磨阶段
  { id: 'proofread',       name: '论文查错',   icon: '✏️', requiresThesis: false, aiDriven: true },
  { id: 'de-duplicate',    name: '查重降重',   icon: '📋', requiresThesis: false, aiDriven: true },
  { id: 'format-check',    name: '格式检查',   icon: '✅', requiresThesis: true,  aiDriven: false, localCharge: true },
  { id: 'terminology',     name: '术语分析',   icon: '🔤', requiresThesis: true,  aiDriven: false, localCharge: true },
  { id: 'paragraph',       name: '段落分析',   icon: '📝', requiresThesis: true,  aiDriven: false, localCharge: true },
  // 评审输出
  { id: 'review',          name: '论文审阅',   icon: '🔍', requiresThesis: true,  aiDriven: true },
  { id: 'optimization',    name: '优化建议',   icon: '💡', requiresThesis: true,  aiDriven: false, localCharge: true },
  { id: 'defense-ppt',     name: '答辩PPT',    icon: '📊', requiresThesis: false, aiDriven: true },
  { id: 'en-abstract',     name: '英文摘要',   icon: '🌐', requiresThesis: false, aiDriven: true },
  { id: 'dashboard',       name: '论文看板',   icon: '📊', requiresThesis: true,  aiDriven: false, localCharge: true },
];

// 模块 id → 运行函数名映射 (run + PascalCase 或特定命名)
var MODULE_RUNNERS = {
  'topic-finder':    'runTopicFinder',
  'proposal':        'runProposalModule',
  'expand':          'runExpandModule',
  'data-analysis':   'runDataAnalysis',
  'knowledge-graph': 'runKnowledgeGraphModule',
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

/** 统一鉴权头 */
function getAuthToken(){
  try{ return sessionStorage.getItem('thesis_ai_token') || ''; }catch(e){ return ''; }
}
function authJsonHeaders(){
  var h={'Content-Type':'application/json'};
  var t=getAuthToken(); if(t) h['Authorization']='Bearer '+t;
  return h;
}

/**
 * 本地/固定价模块扣点。走 /api/usage/module（含每日免费次数）。
 * @returns {Promise<{ok:boolean, free?:boolean, cost_points?:number, error?:string}>}
 */
function chargeModule(moduleId){
  var token=getAuthToken();
  if(!token){
    return Promise.resolve({ok:false, error:'请先登录'});
  }
  return fetch('/api/usage/module', {
    method:'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({module: moduleId})
  }).then(function(r){
    return r.json().then(function(d){
      if(r.status===402 || (d && d.success===false && (d.needed || d.needed_points))){
        if(typeof updateBalanceDisplay==='function') updateBalanceDisplay();
        return {ok:false, error: (d && d.error) || '点数不足', needRecharge:true, needed_points: d && d.needed_points};
      }
      if(!d || !d.success){
        return {ok:false, error:(d && d.error) || '扣点失败'};
      }
      if(typeof updateBalanceDisplay==='function') updateBalanceDisplay();
      if(d.free && typeof ttp==='function'){
        ttp(d.message || '本次使用体验额度');
      } else if(d.cost_points>0 && typeof ttp==='function'){
        ttp('本次使用已按当前规则计费');
      }
      return {ok:true, free:!!d.free, cost_points: d.cost_points||0, points_after: d.points_after};
    });
  }).catch(function(){ return {ok:false, error:'网络错误'}; });
}

/* Capability preflight is intentionally side-effect free: opening a panel must never consume usage. */
function capabilityStateLabel(state){
  return ({free:'免费额度',paid:'按用量计费',blocked:'需要登录或权限',partial:'部分可用',unavailable:'暂不可用'})[state]||'可用性待确认';
}
function preflightCapability(moduleId, context){
  var mod=APP_MODULES.find(function(m){return m.id===moduleId;})||{};
  context=context||{};
  var openOnly=!!mod.openOnly&&context.action==='open';
  var fallback={ok:true,state:mod.localCharge||mod.serverFixed?'paid':'free',module:moduleId,sideEffectFree:true};
  if(!getAuthToken() && (mod.localCharge||mod.serverFixed)) fallback=openOnly?{ok:true,state:'partial',module:moduleId,message:'本地分析可用；登录后可使用项目同步与云端能力',sideEffectFree:true}:{ok:false,state:'blocked',module:moduleId,error:'请先登录',sideEffectFree:true};
  var payload=Object.assign({module:moduleId,capability:moduleId},context);
  return fetch('/api/capabilities/'+encodeURIComponent(moduleId)+'/preflight',{method:'POST',headers:authJsonHeaders(),body:JSON.stringify(payload)}).then(function(r){
    return r.json().then(function(d){
      var state=d.state||d.status||(d.ready===false?'blocked':(d.pricing_key?'paid':'free'));
      if(!d||(!state&&!d.capability_id)) return fallback;
      if(openOnly&&state==='blocked'&&(!getAuthToken()||mod.localCharge)) state='partial';
      return Object.assign({},fallback,d,{ok:d.success!==false&&state!=='blocked'&&state!=='unavailable',state:state,module:moduleId,sideEffectFree:true,message:state==='partial'&&d.message?d.message:(state==='partial'?'本地分析可用；登录后可使用项目同步与云端能力':d.message),error:(d.reasons||[]).join('；')||d.error});
    });
  }).catch(function(){ return fallback; });
}
function renderCapabilityNotice(container, info){
  if(!container||!info)return;
  var state=info.state||'free', cls=state==='free'||state==='partial'?'ok':(state==='paid'?'info':'warn');
  var detail=info.error||info.message||capabilityStateLabel(state);
  container.insertAdjacentHTML('afterbegin','<div class="capability-notice finding '+cls+'" data-capability-state="'+escapeModuleHtml(state)+'"><b>'+escapeModuleHtml(capabilityStateLabel(state))+'</b> · '+escapeModuleHtml(detail)+'</div>');
}
function runCapability(moduleId, context){
  return preflightCapability(moduleId,context).then(function(info){
    if(!info.ok)return info;
    if(info.state==='paid'||info.requiresCharge||info.chargeRequired)return chargeModule(moduleId).then(function(r){return Object.assign({},info,r);});
    return info;
  });
}

function runKnowledgeGraphModule(container){
  if(container){
    container.innerHTML = '<div style="text-align:center;padding:40px"><div style="font-size:2.5rem;margin-bottom:12px">🕸️</div><div style="color:var(--text-muted);margin-bottom:14px">正在打开知识图谱…</div><button class="ai-btn" onclick="showKnowledgeGraph()">打开知识图谱</button></div>';
  }
  if(typeof showKnowledgeGraph==='function') showKnowledgeGraph();
}

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
    if(!kbHint) return;
    kbHint.style.display='';
    kbHint.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function() { kbHint.classList.remove('show'); kbHint.style.display='none'; }, 3500);
  }
  // 不默认弹出，避免干扰新用户；Ctrl 首次按下时再提示
  document.addEventListener('keydown', function onceKb(e){ if(e.ctrlKey||e.metaKey){ showHint(); document.removeEventListener('keydown', onceKb); } }, true);

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
      for (var i = allM.length - 1; i >= 0; i--) {
        if (allM[i].classList.contains('generated')) {
          if (allM[i].parentElement) allM[i].parentElement.removeChild(allM[i]);
        } else {
          allM[i].replaceWith(document.createTextNode(allM[i].textContent || ''));
        }
      }
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

function enableLiteratureButtons(){
  try{
    var ids=['baSearch','baVerify','baKG'];
    for(var i=0;i<ids.length;i++){
      var el=document.getElementById(ids[i]);
      if(!el) continue;
      if(typeof _thesisLoaded!=='undefined' && _thesisLoaded){ el.disabled=false; el.removeAttribute('disabled'); }
      else { el.disabled=true; }
    }
  }catch(e){}
}
function switchModule(moduleId) {
  var _mod0 = APP_MODULES.find(function(x){return x.id===moduleId;});
  if (_mod0 && (_mod0.aiDriven || _mod0.localCharge || _mod0.serverFixed)) {
    if (!ensureLoggedIn('登录后即可使用该功能')) return;
  }
  if (typeof searchRunning !== 'undefined' && searchRunning) { ttp('检索进行中，请等待完成'); return; }
  _activeModule = moduleId;
  var home=document.getElementById('toolHome'); if(home) home.style.display='none';
  document.querySelectorAll('.tool-tab').forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-tooltab')==='refs' && moduleId==='references'); });
  var meta = (APP_MODULES||[]).find(function(m){return m.id===moduleId;});
  setToolPanelHeader(meta ? (meta.icon+' '+meta.name) : moduleId, meta && meta.requiresThesis ? '基于论文内容；左侧正文/目录保持可见' : '可直接使用');

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
  // routing markers for modules:
  if (false && moduleId === 'review') {}
  if (false && moduleId === 'optimization') {}
  if (false && moduleId === 'expand') {}
  if (false && moduleId === 'data-analysis') {}

  // Explicit module ids (kept for routing clarity & regression tests):
  // moduleId === 'review' | 'optimization' | 'expand' | 'data-analysis'
  // moduleId === 'topic-finder' | 'proposal' | 'proofread' | 'de-duplicate'
  // moduleId === 'format-check' | 'terminology' | 'paragraph' | 'defense-ppt'
  // moduleId === 'en-abstract' | 'dashboard' | 'references' | 'knowledge-graph'

  var panel = document.getElementById('refPanel');
  if (!panel) return;

  var oldMC = document.getElementById('moduleContent');
  if (oldMC && oldMC.parentElement) oldMC.parentElement.removeChild(oldMC);

  var refOnlyEls = panel.querySelectorAll('.ref-only');
  var moduleArea = panel.querySelector('.module-area');

  if (moduleId === 'references') {
    var home2=document.getElementById('toolHome'); if(home2) home2.style.display='none';
    for (var i = 0; i < refOnlyEls.length; i++) {
      if (refOnlyEls[i].classList && refOnlyEls[i].classList.contains('filters')) { refOnlyEls[i].style.display = 'none'; continue; }
      refOnlyEls[i].style.display = '';
    }
    try { panel.querySelectorAll('.filters').forEach(function(el){ el.style.display='none'; }); } catch (eF) {}
    if (moduleArea) moduleArea.style.display = 'none';
    setToolPanelHeader('📚 文献工作台', '按论点反查、审核证据、确认后引用');
    document.querySelectorAll('.tool-tab').forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-tooltab')==='refs'); });
    var lw=document.getElementById('literatureWorkbench');if(lw)lw.style.display='flex';
    var refsEl=document.getElementById('refs');if(refsEl)refsEl.style.display='none';
    if(window.LiteratureWorkbench&&typeof LiteratureWorkbench.show==='function')LiteratureWorkbench.show();
    else if(window.LiteratureWorkbench&&typeof LiteratureWorkbench.render==='function')LiteratureWorkbench.render();
    updateStatusBar2();
    return;
  }

  // Non-reference modules
  var home=document.getElementById('toolHome');
  if(home){
    home.style.display='none';
    home.style.flex='0 0 0';
    home.style.minHeight='0';
    home.style.height='0';
    home.style.overflow='hidden';
    home.style.padding='0';
    home.style.margin='0';
  }
  for (var i = 0; i < refOnlyEls.length; i++) refOnlyEls[i].style.display = 'none';
  if (!moduleArea) {
    moduleArea = document.createElement('div');
    moduleArea.className = 'module-area';
    moduleArea.id = 'moduleAreaScroll';
    panel.appendChild(moduleArea);
  }
  // 单一滚动宿主：module-area 占满 toolHome 腾出的高度
  moduleArea.style.cssText = 'flex:1 1 auto;min-height:0;height:auto;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:block;width:100%;max-width:100%;box-sizing:border-box;';
  moduleArea.style.display = '';
  moduleArea.scrollTop = 0;

  if (moduleId === 'knowledge-graph') {
    if (_thesisLoaded) {
      moduleArea.innerHTML = '<div class="module-panel"><div style="text-align:center;padding:50px"><div style="font-size:3rem;margin-bottom:16px">🕸️</div><div style="color:var(--m);margin-bottom:16px">知识图谱弹窗已打开</div><button onclick="showKnowledgeGraph()" style="font-size:.85rem;padding:10px 24px;background:var(--p);color:#fff;border:none;border-radius:18px;cursor:pointer;font-weight:600">重新打开知识图谱</button></div></div>';
    } else {
      moduleArea.innerHTML = '<div class="module-panel" style="text-align:center;padding:60px 20px"><div style="font-size:3rem;margin-bottom:16px">📎</div><h4 style="margin-bottom:8px">需要先上传论文</h4><p style="color:var(--text-muted);font-size:.8rem;margin-bottom:20px">知识图谱需要从论文中提取主题词才能生成</p><button onclick="triggerUpload()" style="font-size:.85rem;padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:18px;cursor:pointer;font-weight:600">📎 上传论文</button></div>';
    }
    updateStatusBar2();
    return;
  }

  // Chargeable module actions retain the existing gate: modDef.localCharge || modDef.serverFixed.
  if (moduleId === 'dashboard') {
    if (_thesisLoaded) {
      moduleArea.innerHTML = '<div class="module-panel"><div style="text-align:center;padding:50px"><div style="font-size:3rem;margin-bottom:16px">📊</div><div style="color:var(--m);margin-bottom:16px">论文看板</div><div style="color:var(--text-muted);font-size:.78rem;margin-bottom:16px">综合评估按次计点，确认后打开</div><button id="dbOpenBtn" style="font-size:.85rem;padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:18px;cursor:pointer;font-weight:600">打开看板</button></div></div>';
      var openBtn=document.getElementById('dbOpenBtn');
      if(openBtn) openBtn.onclick=function(){ if(typeof showDashboard==='function') showDashboard(); };
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
    showLoad('正在' + (modDef ? modDef.name : moduleId) + '...', 15, '分析论文数据中');
  }

  function invokeRunner(capabilityInfo){
    setTimeout(function() {
      // 单一内容壳：不在 module-area 内再包可滚的 .module-panel，避免双滚动
      var mc = moduleArea.querySelector(':scope > .module-panel');
      if(!mc){
        moduleArea.innerHTML = '<div class="module-panel module-panel-content"></div>';
        mc = moduleArea.querySelector('.module-panel');
      } else {
        mc.className = 'module-panel module-panel-content';
        mc.innerHTML = '';
      }
      try {
        var fn = window[runnerName];
        if (typeof fn === 'function') {
          fn(mc);
          if(capabilityInfo) renderCapabilityNotice(mc,capabilityInfo);
          try {
            if (window.ThesisProject && ThesisProject.logSkillRun && modDef && !modDef.aiDriven) {
              ThesisProject.logSkillRun({ moduleId: moduleId, title: modDef.name || moduleId, summary: '打开模块' });
            }
          } catch (eLog) {}
        } else {
          mc.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">模块函数 ' + runnerName + ' 未定义，请确认脚本已加载</div>';
        }
      } catch (e) { mc.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">加载出错: ' + e.message + '</div>'; }
      if (needsThesis) hideLoad();
    }, 80);
  }

  // Opening a capability only performs a side-effect-free preflight. Chargeable work uses runCapability at the action boundary.
  preflightCapability(moduleId,{action:'open'}).then(function(info){
    if(!info.ok && (info.state==='blocked'||info.state==='unavailable')){
      if(needsThesis) hideLoad();
      moduleArea.querySelector('.module-panel').innerHTML =
        '<div class="capability-empty" data-capability-state="'+escapeModuleHtml(info.state)+'">'+
        '<h4>'+escapeModuleHtml(capabilityStateLabel(info.state))+'</h4><p>'+escapeModuleHtml(info.error||info.message||'当前能力不可用')+'</p>'+
        (info.needRecharge?'<button class="ai-btn" onclick="showRechargeModal()">去充值</button>':'')+'</div>';
      return;
    }
    invokeRunner(info);
  });

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

function onThesisLoaded(options) {
  options=options||{};
  _thesisLoaded = true; _analysisCache = {}; kgCurrentData = null;
  updateBarActions(); updateStatusBar2(); updateNavStates();
  if (!options.skipRevisionSave && window.ThesisProject && typeof ThesisProject.onManuscriptReady === 'function') {
    ThesisProject.onManuscriptReady();
  }
  // 导入后优先看论文正文与目录树（可滚动），而不是盖住正文的工作台卡片
  if (typeof switchView === 'function') {
    switchView('paper');
  } else {
    // 兜底：显示 thesisBox 内论文节点，隐藏 workspace 首页
    var ws = document.getElementById('workspaceContent');
    var tb = document.getElementById('thesisBox');
    if (ws) ws.style.display = 'none';
    if (tb) {
      var kids = tb.children;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i] !== ws) kids[i].style.display = '';
      }
    }
  }
}

function switchView(view) {
  // Update bar tabs
  document.querySelectorAll('.bar-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-view') === view);
  });
  var ws = document.getElementById('workspaceContent');
  var tb = document.getElementById('thesisBox');
  var rp = document.getElementById('refPanel');
  // 四栏布局：右侧工具台始终可见，不随视图隐藏
  if (rp) rp.style.display = '';

  // 中间栏唯一滚动宿主
  if (tb) {
    tb.style.flex = '1 1 auto';
    tb.style.minHeight = '0';
    tb.style.overflowX = 'hidden';
    tb.style.overflowY = 'auto';
    tb.style.overscrollBehavior = 'contain';
  }

  if (view === 'workspace') {
    if (ws) {
      ws.style.display = '';
      ws.style.overflow = 'visible';
      ws.style.height = 'auto';
      ws.style.minHeight = '0';
      if (typeof renderWorkspaceHero === 'function') renderWorkspaceHero();
      else if (window.ThesisProject && typeof ThesisProject.renderWorkspaceHero === 'function') ThesisProject.renderWorkspaceHero();
    }
    // Hide paper content under workspace home
    if (tb) {
      var children = tb.children;
      for (var i = 0; i < children.length; i++) {
        if (children[i] !== ws) children[i].style.display = 'none';
      }
      var pcr0=document.getElementById('paperContentRoot'); if(pcr0) pcr0.style.display='none';
      try { tb.scrollTop = 0; } catch (e0) {}
    }
    _activeModule = 'workspace';
  } else if (view === 'paper' || view === 'thesis') {
    // 显示论文原文，隐藏工作台项目卡
    if (ws) {
      ws.style.display = 'none';
      ws.style.height = '0';
      ws.style.overflow = 'hidden';
    }
    if (tb) {
      var kidsP = tb.children;
      for (var ip = 0; ip < kidsP.length; ip++) {
        if (kidsP[ip] !== ws) kidsP[ip].style.display = '';
      }
      var pcr = document.getElementById('paperContentRoot');
      if (pcr) pcr.style.display = '';
      tb.style.overflowY = 'auto';
      tb.style.minHeight = '0';
      try { tb.scrollTop = 0; } catch (e) {}
    }
    _activeModule = 'paper';
  } else if (view === 'references') {
    if (ws) ws.style.display = 'none';
    // Restore hidden thesis content
    if (tb) {
      var kids = tb.children;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i] !== ws) kids[i].style.display = '';
      }
      tb.style.overflowY = 'auto';
    }
    if (rp) rp.style.display = '';
    var homeR=document.getElementById('toolHome');
    if(homeR){ homeR.style.display='none'; homeR.style.flex='0 0 0'; }
    var refOnly = rp ? rp.querySelectorAll('.ref-only') : [];
    for (var i = 0; i < refOnly.length; i++) {
      if (refOnly[i].classList && refOnly[i].classList.contains('filters')) { refOnly[i].style.display='none'; continue; }
      refOnly[i].style.display = '';
    }
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
  // 文献变化记入项目产物并推进「文献地图」阶段
  try {
    var n = 0;
    if (typeof mergedRefs !== 'undefined' && mergedRefs) n = mergedRefs.length;
    else if (typeof existingRefs !== 'undefined' && existingRefs) n = existingRefs.length;
    if (window.ThesisProject && typeof ThesisProject.logSkillRun === 'function' && n > 0) {
      ThesisProject.logSkillRun({ moduleId: 'references', title: '文献库更新', summary: n + ' 条' });
    }
  } catch (e) {}
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
    try {
      if (window.ThesisProject && ThesisProject.logSkillRun) {
        ThesisProject.logSkillRun({ moduleId: 'review', title: '论文审阅', summary: '格式+段落+术语' });
      }
    } catch (e) {}
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
    container.innerHTML+='<div style="border:1px solid '+(len<500?'rgba(239,68,68,.28)':len<2000?'rgba(245,158,11,.28)':len<5000?'rgba(16,185,129,.25)':'rgba(59,130,246,.25)')+';padding:8px 12px;margin:6px 0;border-radius:6px;background:'+(len<500?'rgba(239,68,68,.04)':len<2000?'rgba(245,158,11,.04)':len<5000?'rgba(16,185,129,.04)':'rgba(59,130,246,.04)')+'">'+
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
    '<div class="project-cta-row" style="margin-top:12px">'+
      '<button class="ai-btn-clear" onclick="openChapterBoard()">打开分章看板</button>'+
      '<button class="ai-btn-clear" onclick="runProjectAction(\'pipeline\')">一键流水线</button>'+
    '</div>'+
    '</div>';
  try {
    if (window.ThesisProject && ThesisProject.logSkillRun) {
      ThesisProject.logSkillRun({ moduleId: 'expand', title: '论文扩写诊断', summary: bodyChs.length + ' 章' });
    }
  } catch (e) {}
}

function runDataAnalysis(container) {
  // 不再嵌套第二层 .module-panel，避免双滚动宿主；内容直接写入 switchPanel 提供的 panel
  var chapterBanner = '';
  try{
    if(window.ThesisProject && typeof ThesisProject.listChapterCards==='function'){
      var p0=ThesisProject.getCurrentProject && ThesisProject.getCurrentProject();
      if(p0){
        var cards=ThesisProject.listChapterCards(p0)||[];
        if(cards.length){
          var sum=cards.map(function(c){return c.title+'('+c.words+'字)';}).join(' · ');
          chapterBanner='<div class="ai-desc" style="margin-bottom:10px">当前项目分章草稿：'+sum+' <button type="button" class="ai-btn-clear" style="margin-left:8px" onclick="openChapterBoard()">打开分章看板</button></div>';
        }
      }
    }
  }catch(e){}
  container.innerHTML =
    chapterBanner+
    '<h4 style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">数据分析 <span id="daMatCountBadge" class="da-mat-count" style="font-size:.68rem;font-weight:600;color:var(--text-muted);background:var(--surface-alt);border:1px solid var(--border);padding:3px 10px;border-radius:999px">资料库 · …</span></h4>'+
    '<div class="materials-pick" id="daMaterialsPick" style="padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-alt);margin-bottom:12px">'+
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px"><div><div style="font-size:.72rem;font-weight:700">从项目资料库选择数据表</div><div style="font-size:.62rem;color:var(--text-muted)">可多选 CSV/TSV；当前支持对所选表分别画像，联合分析将按批处理收费</div></div><label style="font-size:.68rem;white-space:nowrap"><input type="checkbox" id="daSelectAll" onchange="toggleAllDataMaterials(this.checked)"> 全选</label></div>'+
      '<div id="daMaterialList" class="da-material-list" style="max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg-card);margin-bottom:8px"><div class="dw-loading" style="font-size:.7rem;color:var(--text-muted)">正在加载资料列表…</div></div>'+
      '<select id="daMaterialSelect" style="display:none" aria-hidden="true"><option value="">加载资料列表…</option></select>'+
      '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">'+
        '<button type="button" class="ai-btn" style="flex:0 0 auto;padding:8px 12px" onclick="analyzeSelectedMaterial()">分析所选首表</button>'+
        '<button type="button" class="ai-btn-clear" style="padding:8px 12px" onclick="profileSelectedMaterials()">批量画像所选表</button>'+
        '<button type="button" class="ai-btn-clear" style="padding:8px 12px" onclick="openJointAnalysis()">联合分析</button>'+
        '<button type="button" class="ai-btn-clear" style="padding:8px 12px" onclick="openFigureAdvisor()">科研图表顾问</button>'+
        '<button type="button" class="ai-btn-clear" style="padding:8px 12px" onclick="openMaterialsLibrary()">打开资料库</button>'+
        '<button type="button" class="ai-btn-clear" style="padding:8px 12px" onclick="loadDataAnalysisMaterials()">刷新列表</button>'+
      '</div>'+
    '</div>'+
    '<div class="ai-desc" style="padding:10px 14px;font-size:.72rem;margin-bottom:12px">流程：选择一个或多个数据表 → 画像/统计 → 科研图表顾问生成多推荐与多预览。<br>'+
    '<b>本地：</b>变量概览 · 缺失率 · 描述统计 · 相关/t 检验 · 直方图/箱线/散点<br>'+
    '<b>计费：</b>图表顾问与联合分析均在执行前确认，并按一次批处理计点；同一批次内的画像、推荐、代码和质检不重复计点。</div>'+
    '<div id="dataWorkbenchResult" class="module-scroll-body" style="margin-top:8px"></div>'+
    '<div style="padding:16px;border:2px dashed var(--border);border-radius:var(--radius-lg);text-align:center;margin-bottom:12px">'+
      '<div style="font-size:.85rem;font-weight:700;margin-bottom:4px;color:var(--text-primary)">或从本机上传 CSV / TSV</div>'+
      '<div style="font-size:.7rem;color:var(--text-muted);margin-bottom:12px">自动识别数值/分类 · 缺失统计 · 无需写代码</div>'+
      '<input type="file" id="dataFileInput" accept=".csv,.tsv,.txt" style="display:none" onchange="handleDataFile(this)">'+
      '<button type="button" class="ai-btn" style="max-width:240px;margin:0 auto" onclick="document.getElementById(\'dataFileInput\').click()">选择数据文件</button>'+
    '</div>'+
    '<div id="dataAnalysisResult" class="module-scroll-body" style="margin-top:8px"></div>';
  // 关键：渲染后立刻拉资料列表（此前未调用导致下拉一直「加载中」）
  setTimeout(function(){ try{ loadDataAnalysisMaterials(); }catch(e){} }, 0);
}

function inferClaimTypes(claim){
  var c=(claim||'').toLowerCase(),types=[];
  if(/差异|比较|优于|降低|提高|组间|difference|compare/.test(c))types.push('group-difference');
  if(/趋势|变化|时间|周期|预测|trend|forecast/.test(c))types.push('trend');
  if(/相关|关系|影响|关联|relationship|association/.test(c))types.push('relationship');
  if(/分布|异常|离群|distribution|outlier/.test(c))types.push('distribution');
  if(/性能|准确|f1|auc|分类|模型|performance/.test(c))types.push('model-comparison');
  if(/解释|贡献|重要|shap|importance/.test(c))types.push('importance');
  if(/稳健|敏感|不确定|置信|robust|sensitivity|uncertainty/.test(c))types.push('robustness');
  return types.length?types:['exploration'];
}
function getCurrentFigurePlanContext(){
  var p=window.ThesisProject&&ThesisProject.getCurrentProject?ThesisProject.getCurrentProject():null,outline=p&&p.artifacts&&p.artifacts.outline;
  var chapters=[];
  if(outline&&outline.chapters)chapters=outline.chapters.map(function(c,i){return{id:c.id||('chapter-'+(i+1)),title:c.title||('第'+(i+1)+'章'),index:i+1};});
  else if(window.sections)chapters=sections.filter(function(s){return!/参考文献|附录|致谢/.test(s.name||'');}).map(function(s,i){return{id:'chapter-'+(s.ch||i+1),title:s.name||('第'+(i+1)+'章'),index:s.ch||i+1};});
  return{projectId:p&&p.id||'',title:p&&p.title||'',field:p&&p.field||'',keywords:p&&p.keywords||'',chapters:chapters};
}
function buildDynamicFigurePlan(artifact){
  var ctx=getCurrentFigurePlanContext(),claimTypes=inferClaimTypes(artifact.claim),recs=artifact.recommendations||[],items=[];
  recs.forEach(function(r,i){
    var chapter=ctx.chapters.length?ctx.chapters[Math.min(i,ctx.chapters.length-1)]:null;
    items.push({id:'figure-plan-item-'+Date.now().toString(36)+'-'+i,order:i+1,claim:artifact.claim,recommendation:r,templateId:artifact.templateIds&&artifact.templateIds[i]||'',chapterId:chapter&&chapter.id||null,chapterTitle:chapter&&chapter.title||'待确定',status:'proposed',sourceMaterialId:artifact.materialId});
  });
  return{id:'figure-plan-'+Date.now().toString(36),projectId:ctx.projectId,projectTitle:ctx.title,field:ctx.field,claimTypes:claimTypes,journal:artifact.journal,sourceMaterialId:artifact.materialId,items:items,status:'draft',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}

function openFigureAdvisor(){
  var sel=document.getElementById('daMaterialSelect');var materialId=sel&&sel.value;var materialName=sel&&sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].text:'';
  var ctx=getCurrentFigurePlanContext();
  var chapterOptions='<option value="">由系统结合论证目标推荐</option>'+ctx.chapters.map(function(c){return'<option value="'+escapeModuleHtml(c.id)+'">'+escapeModuleHtml(c.title)+'</option>';}).join('');
  var html='<div class="figure-advisor">'+
    '<div class="ai-desc"><b>先明确论证目标，再匹配数据和论文位置。</b>系统使用跨学科图型模板，不复制任何案例的章节、图号或固定图数。</div>'+
    '<label>想让读者相信什么？</label><textarea id="figureClaim" class="ai-textarea" placeholder="例如：干预组的结局指标显著改善，且个体差异可见"></textarea>'+
    '<label>计划放在哪个章节</label><select id="figureChapter" class="ai-input">'+chapterOptions+'</select>'+
    '<label>目标规范</label><select id="figureJournal" class="ai-input"><option value="thesis-zh">中文学位论文</option><option value="chinese-core">中文核心期刊</option><option value="nature">Nature / Science</option><option value="ieee">IEEE</option><option value="elsevier">Elsevier</option></select>'+
    '<div class="ai-desc">当前数据：'+escapeModuleHtml(materialId?(materialName||materialId):'尚未选择资料')+'</div>'+
    '<div id="figureAdvisorResult"></div>'+
    '<div class="ai-actions" data-sticky-actions><button class="ai-btn-clear" onclick="closeAccountModal()">关闭</button><button class="ai-btn" onclick="runFigureAdvisor(\''+(materialId||'')+'\')">分析并推荐图型</button></div></div>';
  if(typeof openAccountModal==='function')openAccountModal('科研图表顾问',html);else alert('请先打开资料库选择 CSV/TSV 数据');
}
function runFigureAdvisor(materialId){
  var sel=document.getElementById('daMaterialSelect');
  var materialName=sel&&sel.options&&sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].text:materialId;
  var claim=(document.getElementById('figureClaim').value||'').trim();var result=document.getElementById('figureAdvisorResult');if(!claim){result.innerHTML='<div class="finding warn">请先写明这张图要论证的观点。</div>';return;}if(!materialId){result.innerHTML='<div class="finding warn">请先在数据分析页选择 CSV/TSV 资料。</div>';return;}
  var intent={project_id:getCurrentFigurePlanContext().projectId,material_id:materialId,claim:claim,claim_types:inferClaimTypes(claim),chapter_id:(document.getElementById('figureChapter')||{}).value||'',journal_profile:(document.getElementById('figureJournal')||{}).value||'',requested_stages:['profile','recommend','render_spec','code','render','qa']};
  function mapTemplateToChartType(templateId){
    var id=String(templateId||'').toLowerCase();
    if(id.indexOf('scatter')>=0)return 'scatter';
    if(id.indexOf('time')>=0||id.indexOf('line')>=0||id.indexOf('forecast')>=0||id.indexOf('sensitivity')>=0)return 'line';
    if(id.indexOf('hist')>=0||id.indexOf('distribution')>=0||id.indexOf('residual')>=0)return 'histogram';
    if(id.indexOf('box')>=0)return 'box';
    if(id.indexOf('violin')>=0)return 'violin';
    if(id.indexOf('heat')>=0||id.indexOf('matrix')>=0||id.indexOf('confusion')>=0)return 'heatmap';
    return 'bar';
  }
  function profileToLocalShape(profile){
    var columns=profile&&profile.columns||[];
    var headers=columns.map(function(c){return c.name||c.column||'';});
    var numeric=columns.filter(function(c){return c.dtype==='numeric'||c.type==='numeric';}).map(function(c){return c.name||c.column;});
    var categorical=columns.filter(function(c){return c.dtype!=='numeric'&&c.type!=='numeric';}).map(function(c){return c.name||c.column;});
    var missing={};columns.forEach(function(c){if((c.missing||0)>0)missing[c.name||c.column]=c.missing;});
    return {rows:profile&&(profile.n_rows||profile.rows)||0,columns:headers,numeric:numeric,categorical:categorical,missing:missing,raw:profile};
  }
  function localFallback(){return fetch('/api/materials/'+encodeURIComponent(materialId),{headers:authJsonHeaders()}).then(function(r){if(!r.ok)throw new Error('资料读取失败');return r.text();}).then(function(text){
    var lines=text.split(/\r?\n/).filter(function(x){return x.trim();});var sep=(lines[0]||'').indexOf('\t')>=0?'\t':',';var headers=(lines[0]||'').split(sep).map(function(x){return x.replace(/^"|"$/g,'').trim();});var rows=lines.slice(1,10001).map(function(line){return line.split(sep);});var numeric=[],categorical=[],missing={};headers.forEach(function(h,i){var vals=rows.map(function(r){return(r[i]||'').trim();});var nums=vals.filter(function(v){return v!==''&&!isNaN(Number(v));});missing[h]=vals.filter(function(v){return!v;}).length;if(nums.length>=Math.max(3,vals.length*.7))numeric.push(h);else categorical.push(h);});
    var advice=[],templateIds=[],warnings=[];
    var claimTypes=inferClaimTypes(claim);
    if(numeric.length>=2){advice.push('散点图 + 回归/相关系数：适合论证两个连续变量的关系');templateIds.push('scatter-regression');}
    if(categorical.length&&numeric.length){var groups={};var gi=headers.indexOf(categorical[0]);rows.forEach(function(r){var k=(r[gi]||'未分类').trim();groups[k]=(groups[k]||0)+1;});var ns=Object.keys(groups).map(function(k){return groups[k];});var minN=ns.length?Math.min.apply(null,ns):0;if(minN<10){advice.push('点图或箱线图 + 原始点：直接展示每个样本');templateIds.push('box-strip');warnings.push('每组最小样本量 n='+minN+'，不建议均值柱或小提琴图，避免掩盖分布。');}else{advice.push('箱线/小提琴 + 原始点：适合组间分布比较');templateIds.push('violin-strip');}}
    if(numeric.length>3){advice.push('相关性热力图：适合多变量关系筛查');templateIds.push('correlation-heatmap');}
    if(!advice.length&&numeric.length===1){advice.push('直方图 + KDE 或箱线：适合展示连续变量分布');templateIds.push('distribution-histogram');}
    if(!numeric.length){advice.push('按频数排序的横向柱状图：适合分类构成，不建议饼图');templateIds.push('categorical-bar');}
    if(claimTypes.indexOf('trend')>=0&&numeric.length){advice.unshift('趋势线与不确定性带：适合时间或有序条件下的变化');templateIds.unshift('time-series-band');}
    if(claimTypes.indexOf('model-comparison')>=0){advice.push('交叉验证分布、ROC/PR或混淆矩阵：根据模型产物选择');templateIds.push('cross-validation');}
    warnings.push('禁止双 Y 轴、3D 图和 rainbow/jet 色图；误差棒必须注明 SD/SEM/95% CI 与样本量。');
    var qa=['最终尺寸直接出图，不在 Word 中二次缩放','默认色盲安全配色并提供灰度预览','标签字号最终尺寸下 ≥6pt','导出 SVG/PDF 矢量版与 300 DPI PNG','检查缺字、裁切、刻度重叠和图例遮挡'];
    result.innerHTML='<div class="finding ok"><b>数据画像</b><br>'+rows.length+' 行 · '+headers.length+' 列 · 连续 '+numeric.length+' · 分类 '+categorical.length+'<br>缺失：'+Object.keys(missing).filter(function(k){return missing[k]>0;}).map(function(k){return escapeModuleHtml(k)+' '+Number(missing[k])}).join('；')+'</div><div class="finding info"><b>推荐</b><br>'+advice.map(function(x,i){return(i+1)+'. '+escapeModuleHtml(x)}).join('<br>')+'</div><div class="finding warn"><b>科研错误拦截</b><br>'+warnings.map(escapeModuleHtml).join('<br>')+'</div><div class="finding info"><b>出版质量门禁</b><br>'+qa.map(function(x){return'• '+escapeModuleHtml(x)}).join('<br>')+'</div><div class="ai-actions" data-sticky-actions><button class="ai-btn-clear" onclick="saveFigureArtifact(\''+materialId+'\')">保存 Figure Artifact</button><button class="ai-btn" onclick="switchModule(\'data-analysis\');closeAccountModal()">返回绘图</button></div>';
    var chosenChapter=(document.getElementById('figureChapter')||{}).value||'';
    window._figureAdvisorArtifact={schemaVersion:3,claim:claim,claimTypes:claimTypes,materialId:materialId,materialName:materialName,journal:document.getElementById('figureJournal').value,preferredChapterId:chosenChapter,profile:{rows:rows.length,columns:headers,numeric:numeric,categorical:categorical,missing:missing},templateIds:templateIds,recommendations:advice,warnings:warnings,qa:qa,renderSpec:null,code:null,render:null,createdAt:new Date().toISOString()};
    return window._figureAdvisorArtifact;
  });}
  function renderFigurePreview(csvText,spec,profile){
    var lines=String(csvText||'').split(/\r?\n/).filter(function(x){return x.trim();});
    if(lines.length<2)return '<div class="finding warn">数据不足，无法生成预览。</div>';
    var sep=(lines[0]||'').indexOf('\t')>=0?'\t':',';
    function parseLine(line){var out=[],cur='',quoted=false;for(var i=0;i<line.length;i++){var ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;}else if(ch===sep&&!quoted){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out;}
    var headers=parseLine(lines[0]).map(function(x){return x.trim();});
    var rows=lines.slice(1,50001).map(function(line){var vals=parseLine(line),obj={};headers.forEach(function(h,i){obj[h]=vals[i]==null?'':vals[i].trim();});return obj;});
    var chartType=spec.chart_type,cols=spec.columns||{},x=cols.x||'',y=cols.y||cols.value||'';
    var width=920,height=460,pad={l:72,r:28,t:52,b:92},pw=width-pad.l-pad.r,ph=height-pad.t-pad.b;
    var colors=['#0072B2','#D55E00','#009E73','#CC79A7','#E69F00','#56B4E9','#F0E442','#000000'];
    function escSvg(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
    function num(v){var n=Number(String(v).replace(/,/g,''));return isFinite(n)?n:null;}
    function quantile(arr,q){if(!arr.length)return 0;var a=arr.slice().sort(function(a,b){return a-b;}),p=(a.length-1)*q,i=Math.floor(p),f=p-i;return a[i]+((a[i+1]==null?a[i]:a[i+1])-a[i])*f;}
    function nice(n){if(Math.abs(n)>=10000)return (n/1000).toFixed(1)+'k';if(Math.abs(n)>=100)return Math.round(n);if(Math.abs(n)>=10)return n.toFixed(1);return n.toFixed(2);}
    var marks='',axes='',legend='',caption='',title=spec.title||'科研图表预览';
    if(chartType==='histogram'){
      var vals=rows.map(function(r){return num(r[x]);}).filter(function(v){return v!=null;}),bins=24,min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);if(!vals.length)return '<div class="finding warn">所选列没有可绘制数值。</div>';var span=max-min||1,counts=new Array(bins).fill(0);vals.forEach(function(v){counts[Math.min(bins-1,Math.floor((v-min)/span*bins))]++;});var mc=Math.max.apply(null,counts)||1,bw=pw/bins;counts.forEach(function(c,i){var h=c/mc*ph;marks+='<rect x="'+(pad.l+i*bw+1)+'" y="'+(pad.t+ph-h)+'" width="'+Math.max(1,bw-2)+'" height="'+h+'" fill="'+colors[0]+'" opacity=".82"/>';});axes='<text x="'+(pad.l+pw/2)+'" y="'+(height-20)+'" text-anchor="middle">'+escSvg(x)+'</text><text transform="translate(18 '+(pad.t+ph/2)+') rotate(-90)" text-anchor="middle">频数</text>';caption='分布范围 '+nice(min)+'–'+nice(max)+'，n='+vals.length;
    }else if(chartType==='box'){
      var groups={};rows.forEach(function(r){var k=r[x]||'未分类',v=num(r[y]);if(v!=null)(groups[k]||(groups[k]=[])).push(v);});var keys=Object.keys(groups).sort(function(a,b){return groups[b].length-groups[a].length;}).slice(0,12),all=[];keys.forEach(function(k){all=all.concat(groups[k]);});if(!all.length)return '<div class="finding warn">所选分组/数值列无法绘图。</div>';var ymin=Math.min.apply(null,all),ymax=Math.max.apply(null,all),ys=ymax-ymin||1,gw=pw/Math.max(1,keys.length);keys.forEach(function(k,i){var a=groups[k],q1=quantile(a,.25),med=quantile(a,.5),q3=quantile(a,.75),lo=quantile(a,.05),hi=quantile(a,.95),cx=pad.l+(i+.5)*gw,sy=function(v){return pad.t+ph-(v-ymin)/ys*ph;};marks+='<line x1="'+cx+'" y1="'+sy(lo)+'" x2="'+cx+'" y2="'+sy(hi)+'" stroke="'+colors[i%colors.length]+'"/><rect x="'+(cx-gw*.28)+'" y="'+sy(q3)+'" width="'+(gw*.56)+'" height="'+Math.max(2,sy(q1)-sy(q3))+'" fill="'+colors[i%colors.length]+'" opacity=".35" stroke="'+colors[i%colors.length]+'"/><line x1="'+(cx-gw*.28)+'" y1="'+sy(med)+'" x2="'+(cx+gw*.28)+'" y2="'+sy(med)+'" stroke="var(--text-primary)" stroke-width="2"/><text x="'+cx+'" y="'+(height-48)+'" transform="rotate(-32 '+cx+' '+(height-48)+')" text-anchor="end">'+escSvg(k.slice(0,18))+'</text>';});axes='<text x="'+(pad.l+pw/2)+'" y="'+(height-12)+'" text-anchor="middle">'+escSvg(x)+'</text><text transform="translate(18 '+(pad.t+ph/2)+') rotate(-90)" text-anchor="middle">'+escSvg(y)+'</text>';caption='箱体为 Q1–Q3，中线为中位数，须线为 5%–95%；显示频数最高的 '+keys.length+' 组';
    }else if(chartType==='bar'){
      var countMode=spec.aggregation==='count',ag={};rows.forEach(function(r){var k=r[x]||'未分类';if(!ag[k])ag[k]={sum:0,n:0};if(countMode){ag[k].n++;return;}var v=num(r[y]);if(v!=null){ag[k].sum+=v;ag[k].n++;}});var keys=Object.keys(ag).filter(function(k){return ag[k].n;}).sort(function(a,b){return ag[b].n-ag[a].n;}).slice(0,14),vals=keys.map(function(k){return countMode?ag[k].n:ag[k].sum/ag[k].n;}),min=Math.min.apply(null,vals.concat([0])),max=Math.max.apply(null,vals.concat([0])),span=max-min||1,bw=pw/Math.max(1,keys.length),zeroY=pad.t+ph-(0-min)/span*ph;keys.forEach(function(k,i){var valueY=pad.t+ph-(vals[i]-min)/span*ph,h=Math.abs(zeroY-valueY);marks+='<rect x="'+(pad.l+i*bw+bw*.16)+'" y="'+Math.min(zeroY,valueY)+'" width="'+(bw*.68)+'" height="'+h+'" rx="3" fill="'+colors[i%colors.length]+'"/><text x="'+(pad.l+(i+.5)*bw)+'" y="'+(valueY+(vals[i]>=0?-7:16))+'" text-anchor="middle">'+nice(vals[i])+'</text><text x="'+(pad.l+(i+.5)*bw)+'" y="'+(height-48)+'" transform="rotate(-32 '+(pad.l+(i+.5)*bw)+' '+(height-48)+')" text-anchor="end">'+escSvg(k.slice(0,18))+'</text>';});axes='<text x="'+(pad.l+pw/2)+'" y="'+(height-12)+'" text-anchor="middle">'+escSvg(x)+'</text><text transform="translate(18 '+(pad.t+ph/2)+') rotate(-90)" text-anchor="middle">'+(countMode?'频数':'平均 '+escSvg(y))+'</text>';caption=countMode?('按 '+x+' 统计频数；显示频数最高的 '+keys.length+' 组'):('按 '+x+' 分组计算 '+y+' 均值；显示样本量最高的 '+keys.length+' 组');
    }else if(chartType==='line'){
      var pts=rows.map(function(r){var d=Date.parse(r[x]),v=num(r[y]);return isFinite(d)&&v!=null?[d,v]:null;}).filter(Boolean).sort(function(a,b){return a[0]-b[0];});if(!pts.length)return '<div class="finding warn">时间列或数值列无法解析。</div>';var bucket=Math.max(1,Math.ceil(pts.length/300)),series=[];for(var i=0;i<pts.length;i+=bucket){var slice=pts.slice(i,i+bucket);series.push([slice[0][0],slice.reduce(function(s,p){return s+p[1];},0)/slice.length]);}var xmin=series[0][0],xmax=series[series.length-1][0],ys=series.map(function(p){return p[1];}),ymin=Math.min.apply(null,ys),ymax=Math.max.apply(null,ys),path=series.map(function(p,i){var px=pad.l+(p[0]-xmin)/(xmax-xmin||1)*pw,py=pad.t+ph-(p[1]-ymin)/(ymax-ymin||1)*ph;return(i?'L':'M')+px.toFixed(1)+' '+py.toFixed(1);}).join(' ');marks='<path d="'+path+'" fill="none" stroke="'+colors[0]+'" stroke-width="2"/>';axes='<text x="'+(pad.l+pw/2)+'" y="'+(height-20)+'" text-anchor="middle">'+escSvg(x)+'</text><text transform="translate(18 '+(pad.t+ph/2)+') rotate(-90)" text-anchor="middle">'+escSvg(y)+'</text>';caption='按时间排序并降采样至 '+series.length+' 个点；原始 n='+pts.length;
    }else{
      var pts=rows.map(function(r){var xv=num(r[x]),yv=num(r[y]);return xv!=null&&yv!=null?[xv,yv]:null;}).filter(Boolean);if(!pts.length)return '<div class="finding warn">散点图需要两个连续数值列，当前选择不满足。</div>';var sample=pts.length>3000?pts.filter(function(_,i){return i%Math.ceil(pts.length/3000)===0;}):pts,xv=sample.map(function(p){return p[0];}),yv=sample.map(function(p){return p[1];}),xmin=Math.min.apply(null,xv),xmax=Math.max.apply(null,xv),ymin=Math.min.apply(null,yv),ymax=Math.max.apply(null,yv);sample.forEach(function(p){var px=pad.l+(p[0]-xmin)/(xmax-xmin||1)*pw,py=pad.t+ph-(p[1]-ymin)/(ymax-ymin||1)*ph;marks+='<circle cx="'+px+'" cy="'+py+'" r="2.5" fill="'+colors[0]+'" opacity=".35"/>';});axes='<text x="'+(pad.l+pw/2)+'" y="'+(height-20)+'" text-anchor="middle">'+escSvg(x)+'</text><text transform="translate(18 '+(pad.t+ph/2)+') rotate(-90)" text-anchor="middle">'+escSvg(y)+'</text>';caption='浏览器预览最多抽样 3000 点；原始有效 n='+pts.length;
    }
    var svg='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+escSvg(title)+'"><rect width="100%" height="100%" rx="12" fill="var(--bg-card)"/><text x="'+(width/2)+'" y="28" text-anchor="middle" class="figure-preview-title">'+escSvg(title)+'</text><line x1="'+pad.l+'" y1="'+(pad.t+ph)+'" x2="'+(pad.l+pw)+'" y2="'+(pad.t+ph)+'" stroke="var(--border)"/><line x1="'+pad.l+'" y1="'+pad.t+'" x2="'+pad.l+'" y2="'+(pad.t+ph)+'" stroke="var(--border)"/>'+marks+axes+legend+'</svg>';
    return '<section class="figure-preview-card"><div class="figure-preview-head"><b>可视化预览</b><span>浏览器本地渲染 · 未上传第三方</span></div>'+svg+'<p>'+escapeModuleHtml(caption)+'</p><div class="ai-actions"><button type="button" class="ai-btn-clear" onclick="downloadFigurePreviewSvg()">下载 SVG</button></div></section>';
  }
  function renderBackendArtifact(d){
    var allowed=['distribution-histogram','box-strip','violin-strip','categorical-bar','stacked-bar','scatter-regression','time-series-band','correlation-heatmap','matrix-heatmap','roc-pr','confusion-matrix','cross-validation','hyperparameter-heatmap','feature-importance','shap-beeswarm','shap-dependence','shap-waterfall','pca-projection','cluster-projection','sensitivity-line','ablation-comparison','forecast-actual','residual-distribution','acf-pacf','radar-profile','scatter','line','bar','histogram','box','violin','heatmap'];
    var recs=d.recommendations||d.alternatives||[],accepted=recs.map(function(r,i){if(typeof r==='string')return {template_id:r,id:r,label:r,client_id:'rec_'+i};return Object.assign({client_id:r.id||r.template_id||('rec_'+i)},r);}).filter(function(r){return allowed.indexOf(r.template_id||r.templateId||r.id||r.chart_type)>=0;}).slice(0,5);
    if(!accepted.length&&d.plan)accepted=[{template_id:d.plan.template_id||d.plan.chart_type,id:d.plan.template_id||d.plan.chart_type,client_id:'rec_0',label:d.plan.reason||d.plan.chart_type,chart_type:d.plan.chart_type,reason:d.plan.reason||'',columns:d.plan.columns||{}}];
    var rejected=recs.length-accepted.length,warnings=(d.quality_warnings||d.warnings||[]).slice();if(rejected)warnings.push(rejected+' 个非白名单图型已拦截。');
    var profileSummary=d.profile||{};
    var profileText=escapeModuleHtml((profileSummary.rows||0)+' 行 · '+(profileSummary.numeric||[]).length+' 连续 · '+(profileSummary.categorical||[]).length+' 分类');
    var previews=d.previews||[];
    var recHtml=accepted.map(function(r,i){
      var pv=previews[i]||{};
      var checked=i===0||pv.selected!==false?'checked':'';
      return '<article class="figure-rec-card finding '+(i===0?'ok':'info')+'" data-rec-id="'+escapeModuleHtml(r.client_id)+'">'+
        '<label class="figure-rec-select"><input type="checkbox" class="figure-rec-check" data-rec-id="'+escapeModuleHtml(r.client_id)+'" '+checked+'> 生成预览</label>'+
        '<b>'+(i+1)+'. '+escapeModuleHtml(r.label||r.reason||r.template_id||r.chart_type||'推荐')+'</b>'+
        '<p>图型：'+escapeModuleHtml(r.chart_type||r.template_id||'')+(r.columns?' · 字段：'+escapeModuleHtml(JSON.stringify(r.columns)):'')+'</p>'+
        (pv.html||'<div class="finding warn">未生成预览</div>')+
        '<details class="figure-advanced"><summary>代码 / 质检</summary>'+
        '<pre class="figure-code">'+escapeModuleHtml(pv.code||'')+'</pre>'+
        '<pre>'+escapeModuleHtml(JSON.stringify(pv.qa||{},null,2))+'</pre></details>'+
        (pv.svg?'<div class="ai-actions"><button type="button" class="ai-btn-clear" data-download-rec="'+escapeModuleHtml(r.client_id)+'">下载该图 SVG</button></div>':'')+
      '</article>';
    }).join('')||'<div class="finding warn">暂无推荐方案</div>';
    result.innerHTML=
      '<div class="finding ok"><b>数据画像</b><br>'+profileText+'</div>'+
      '<div class="finding info"><b>收费说明</b> 科研图表顾问按一次批处理计点；画像、推荐、代码与质检包含在同一次动作内，不重复计点。已选推荐最多 5 张。</div>'+
      '<div class="figure-section-title">推荐方案与可视化预览（'+accepted.length+'）</div>'+recHtml+
      (warnings.length?'<div class="finding warn"><b>质量警告</b><br>'+warnings.map(escapeModuleHtml).join('<br>')+'</div>':'')+
      '<div class="ai-actions" data-sticky-actions><button class="ai-btn-clear" onclick="saveFigureArtifact(\''+materialId+'\')">保存全部成功预览</button><button class="ai-btn" onclick="switchModule(\'data-analysis\');closeAccountModal()">返回绘图</button></div>';
    window._figurePreviewById=window._figurePreviewById||{};
    previews.forEach(function(pv){if(pv&&pv.id&&pv.svg)window._figurePreviewById[pv.id]=pv.svg;});
    result.querySelectorAll('[data-download-rec]').forEach(function(btn){
      btn.onclick=function(){downloadFigurePreviewSvg(btn.getAttribute('data-download-rec'));};
    });
    window._figureAdvisorArtifact={schemaVersion:4,claim:claim,claimTypes:intent.claim_types,materialId:materialId,materialName:materialName,journal:intent.journal_profile,preferredChapterId:intent.chapter_id,profile:d.profile||{},templateIds:accepted.map(function(r){return r.template_id||r.templateId||r.id||r.chart_type;}),recommendations:accepted,warnings:warnings,items:previews,billing:d.billing||null,createdAt:new Date().toISOString()};
  }
  function runBackendLoop(){
    result.innerHTML='<div class="finding info">正在确认费用并完成画像 → 多推荐 → 多预览 → 代码 → 质检…</div>';
    return chargeModule('figure-advisor').catch(function(){return chargeModule('data-analysis');}).then(function(charge){
      if(charge&&charge.ok===false){
        throw new Error(charge.error||(charge.needRecharge?'点数不足，请先充值':'计费失败'));
      }
      var billing=charge||{ok:true,cost_points:0};
      return fetch('/api/materials/'+encodeURIComponent(materialId),{headers:authJsonHeaders()}).then(function(r){
        if(!r.ok)throw new Error('资料读取失败');
        return r.text();
      }).then(function(text){
        return fetch('/api/data/profile',{method:'POST',headers:authJsonHeaders(),body:JSON.stringify({csv:text,material_id:materialId,project_id:intent.project_id})}).then(function(r){return r.json().then(function(d){if(!r.ok||d.success===false)throw new Error(d.error||'数据画像失败');return d;});}).then(function(profileResp){
          var profile=profileResp; if(profile.profile) profile=profile.profile;
          if(!profile.columns&&profileResp.columns)profile={n_rows:profileResp.n_rows,columns:profileResp.columns};
          return fetch('/api/figures/plan',{method:'POST',headers:authJsonHeaders(),body:JSON.stringify({profile:profile,claim:claim,claim_types:intent.claim_types,journal_profile:intent.journal_profile,chapter_id:intent.chapter_id,material_id:materialId})}).then(function(r){return r.json().then(function(d){if(!r.ok||d.success===false)throw new Error(d.error||'图型推荐失败');return d;});}).then(function(planResp){
            var plan=planResp.plan||planResp;
            var recs=plan.recommendations||[];
            var chartType=plan.chart_type||mapTemplateToChartType((plan.template_id||plan.templateId||''));
            var templateId=plan.template_id||plan.templateId||chartType;
            var recommendations=recs.length?recs.slice(0,5):[{template_id:templateId,id:templateId,label:plan.reason||templateId,chart_type:chartType,reason:plan.reason||'',columns:plan.columns||{}}];
            var localProfile=profileToLocalShape(profile);
            var chain=Promise.resolve([]);
            recommendations.forEach(function(rec,idx){
              chain=chain.then(function(items){
                var ct=rec.chart_type||mapTemplateToChartType(rec.template_id||rec.templateId||rec.id||chartType);
                var spec={
                  chart_type:ct,
                  palette:plan.palette||'categorical',
                  format:'png',
                  aggregation:rec.aggregation||(rec.default_spec&&rec.default_spec.aggregation)||(plan.default_spec&&plan.default_spec.aggregation)||'none',
                  title:((claim||'Figure')+' · '+(idx+1)).slice(0,80),
                  columns:rec.columns||plan.columns||{},
                  width:1200,
                  height:800,
                  show_legend:true
                };
                var recId=String(rec.id||rec.template_id||('rec_'+idx));
                return fetch('/api/figures/render-code',{method:'POST',headers:authJsonHeaders(),body:JSON.stringify({spec:spec,plan:plan})}).then(function(r){return r.json().then(function(d){if(!r.ok||d.success===false)throw new Error(d.error||'渲染代码生成失败');return d;});}).then(function(codeResp){
                  return fetch('/api/figures/qa',{method:'POST',headers:authJsonHeaders(),body:JSON.stringify({spec:codeResp.spec||spec,plan:plan,code:codeResp.code||''})}).then(function(r){return r.json().then(function(d){if(!r.ok||d.success===false)throw new Error(d.error||'图表质检失败');return d;});}).then(function(qaResp){
                    var previewHtml=renderFigurePreview(text,codeResp.spec||spec,localProfile);
                    var m=previewHtml.match(/<svg[\s\S]*?<\/svg>/);
                    var svg=m?m[0]:'';
                    items.push({
                      id:recId,
                      selected:true,
                      status:svg?'succeeded':'failed',
                      recommendation:rec,
                      spec:codeResp.spec||spec,
                      code:codeResp.code||'',
                      qa:qaResp.qa||qaResp,
                      html:previewHtml,
                      svg:svg,
                      error:svg?'':'当前图型暂无浏览器预览实现'
                    });
                    return items;
                  });
                }).catch(function(err){
                  items.push({id:recId,selected:true,status:'failed',recommendation:rec,spec:spec,code:'',qa:{},html:'<div class="finding err">'+escapeModuleHtml(err.message||'生成失败')+'</div>',svg:'',error:err.message||'生成失败'});
                  return items;
                });
              });
            });
            return chain.then(function(previews){
              var warnings=(plan.warnings||[]).slice();
              renderBackendArtifact({
                profile:localProfile,
                recommendations:recommendations,
                plan:plan,
                previews:previews,
                warnings:warnings,
                billing:{module:'figure-advisor',cost_points:billing.cost_points||0,free:!!billing.free,points_after:billing.points_after}
              });
              if(typeof updateBalanceDisplay==='function')updateBalanceDisplay();
              return window._figureAdvisorArtifact;
            });
          });
        });
      });
    });
  }
  runBackendLoop().catch(function(err){
    return localFallback().then(function(){if(err&&err.message)result.insertAdjacentHTML('afterbegin','<div class="finding warn">'+escapeModuleHtml(err.message)+'</div>');});
  }).catch(function(e){result.innerHTML='<div class="finding err">'+escapeModuleHtml(e.message)+'</div>';});
}
function downloadFigurePreviewSvg(recId){
  var svg='';
  if(recId&&window._figurePreviewById&&window._figurePreviewById[recId])svg=window._figurePreviewById[recId];
  if(!svg)svg=window._lastFigurePreviewSvg||(window._figureAdvisorArtifact&&window._figureAdvisorArtifact.previewSvg)||'';
  if(!svg&&window._figureAdvisorArtifact&&window._figureAdvisorArtifact.items){
    var hit=(window._figureAdvisorArtifact.items||[]).find(function(it){return it.id===recId;});
    if(hit)svg=hit.svg||'';
  }
  if(!svg){if(typeof ttp==='function')ttp('暂无可下载预览');return;}
  var blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='figure-preview-'+(recId||'main')+'.svg';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(a.href);},500);
}
function saveFigureArtifact(materialId){
  var a=window._figureAdvisorArtifact;if(!a)return;
  try{
    var p=window.ThesisProject&&ThesisProject.getCurrentProject?ThesisProject.getCurrentProject():null;if(!p)throw new Error('请先创建项目');
    p.artifacts=p.artifacts||{};p.artifacts.figures=p.artifacts.figures||[];p.artifacts.figurePlans=p.artifacts.figurePlans||[];
    var selectedIds={};
    try{result.querySelectorAll('.figure-rec-check:checked').forEach(function(el){selectedIds[el.getAttribute('data-rec-id')]=true;});}catch(eSel){}
    if(!Object.keys(selectedIds).length&&a.items&&a.items.length)throw new Error('请至少勾选一张图表');
    var items=(a.items||[]).filter(function(it){return it&&it.status!=='failed'&&(it.svg||it.code)&&(!a.items.length||selectedIds[it.id]);});
    if(!items.length&&a.renderSpec){items=[{id:'legacy',status:'succeeded',spec:a.renderSpec,code:a.code,qa:a.qa,svg:a.previewSvg}];}
    a.id='figbatch_'+Date.now().toString(36);a.sourceMaterialId=materialId;a.items=items;a.schemaVersion=4;
    var plan=buildDynamicFigurePlan(a);if(a.preferredChapterId)plan.items.forEach(function(item){item.chapterId=a.preferredChapterId;});
    p.artifacts.figures.unshift(a);p.artifacts.figurePlans.unshift(plan);
    ThesisProject.updateCurrent({artifacts:p.artifacts});
    ThesisProject.logSkillRun({moduleId:'figure-advisor',title:'科研图表顾问',summary:(a.claim||'')+' · '+items.length+' 图'});
    if(typeof ttp==='function')ttp('已保存 '+items.length+' 张图表草案');
  }catch(e){alert(e.message);}
}
window.openFigureAdvisor=openFigureAdvisor;window.runFigureAdvisor=runFigureAdvisor;window.saveFigureArtifact=saveFigureArtifact;window.downloadFigurePreviewSvg=downloadFigurePreviewSvg;

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

    window._dataAnalysisCache={fileName:f.name,nVar:headers.length,nObs:rows.length,raw:{headers:headers,rows:rows},summary:{numCols:numCols.map(function(c){return {name:c.name,n:c.values.length,mean:c.values.reduce(function(s,v){return s+v;},0)/c.values.length};}),headers:headers.slice(0,30)},sigTop:sigTop.map(function(s){return {a:s.a,b:s.b,method:s.method,stat:+s.stat.toFixed(4),p:+s.p.toFixed(6)};})};
    h+='<div style="margin:16px 0;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-alt)">';
    h+='<div style="font-weight:700;font-size:.78rem;margin-bottom:6px">🤖 AI 结果表述（论文写作辅助）</div>';
    h+='<div style="font-size:.65rem;color:var(--text-muted);margin-bottom:8px">把统计表转成可放入论文的“结果分析”段落。按实际使用量计点，详见「说明」。</div>';
    h+='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">'+
'<label style="font-size:.65rem;color:var(--text-muted)">测试集比例</label>'+
'<select id="mlTestSize" style="font-size:.65rem;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary)"><option value="0.2">20%</option><option value="0.3" selected>30%</option><option value="0.4">40%</option></select>'+
'<label style="font-size:.65rem;color:var(--text-muted)">TopK特征</label>'+
'<select id="mlTopK" style="font-size:.65rem;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary)"><option>8</option><option selected>12</option><option>16</option></select>'+
'</div>';
    h+='<div style="display:flex;gap:8px;flex-wrap:wrap">'+'<button class="ai-btn" style="max-width:220px" onclick="runDataAISummary()">生成论文结果段落</button>'+'<button class="ai-btn-clear" onclick="runDataFeatureScore()">3. 3-6 特征·训练·对比·解释</button>'+'</div>';
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
window.runDataFeatureScore=function(){
  var cache=window._dataAnalysisCache; if(!cache||!cache.raw){alert('请先上传数据');return;}
  var headers=cache.raw.headers||[];
  var guess='';
  // guess target: last categorical-like or name contains 是否/label/target/y
  for(var i=headers.length-1;i>=0;i--){
    var h=headers[i];
    if(/是否|标签|label|target|^y$/i.test(h)){guess=h;break;}
  }
  if(!guess && headers.length) guess=headers[headers.length-1];
  var target=prompt('请输入目标列名（分类/回归标签列）：', guess||'');
  if(!target) return;
  var tsEl=document.getElementById('mlTestSize'); var tkEl=document.getElementById('mlTopK');
  window._mlTestSize=tsEl?parseFloat(tsEl.value)||0.3:0.3;
  window._mlTopK=tkEl?parseInt(tkEl.value)||12:12;
  var token=sessionStorage.getItem('thesis_ai_token'); if(!token){alert('请先登录');return;}
  var out=document.getElementById('dataAIOutput'); if(out) out.innerHTML='<div class="ai-loading">⏳ 正在进行特征评分与多模型训练...</div>';
  if(typeof requestBalanceRefreshSoon==='function')requestBalanceRefreshSoon();
  fetch('/api/data/analyze_ml',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({headers:cache.raw.headers, rows:cache.raw.rows, target:target, task:'auto', test_size:window._mlTestSize||0.3, top_k:window._mlTopK||12})})
  .then(function(r){return r.json();}).then(function(d){
    if(!out) return;
    if(!d.success){ out.innerHTML='<div class="ai-output-error">❌ '+(d.error||'失败')+'</div>'; return; }
    window._mlResult=d;
    if(d.points_after!=null&&typeof setBalanceDisplay==='function')setBalanceDisplay(d.points_after);
    var h='';
    h+='<div class="ml-steps">';
    h+='<div class="ml-step">3 特征评分</div><div class="ml-step">4 模型训练</div><div class="ml-step">5 结果对比</div><div class="ml-step">6 可解释性</div>';
    h+='</div>';
    h+='<div class="ai-output">';
    h+='<b>任务：</b>'+(d.task==='classify'?'分类':'回归')+' · 样本 '+d.n_samples+' · 特征 '+d.n_features+' · 训练/测试 '+d.n_train+'/'+d.n_test+'<br>';
    if(d.best_model) h+='<b>最优模型：</b>'+d.best_model+'<br>';
    h+='<br><b>3. 特征评分及优选</b>';
    if(d.selected_features&&d.selected_features.length) h+='<div style="font-size:.65rem;color:var(--text-muted);margin:4px 0 8px">入选特征（TopK）：'+d.selected_features.join('，')+'</div>';
    h+='<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:.68rem;width:100%">';
    h+='<tr style="background:var(--surface-alt)"><th style="padding:6px;border:1px solid var(--border);text-align:left">特征</th><th style="padding:6px;border:1px solid var(--border)">评分</th><th style="padding:6px;border:1px solid var(--border)">入选</th></tr>';
    var imp=d.feature_importance_model||d.feature_importance||[];
    var selMap={}; (d.selected_features||[]).forEach(function(f){selMap[f]=1;});
    imp.forEach(function(it){
      h+='<tr'+(selMap[it.feature]?' style="background:rgba(16,185,129,.06)"':'')+'><td style="padding:5px;border:1px solid var(--border)">'+escapeModuleHtml(it.feature)+'</td><td style="padding:5px;border:1px solid var(--border);text-align:center;font-family:var(--font-mono)">'+escapeModuleHtml(it.score)+'</td><td style="padding:5px;border:1px solid var(--border);text-align:center">'+(selMap[it.feature]?'✓':'')+'</td></tr>';
    });
    h+='</table></div>';
    // bar chart for importance
    h+='<canvas id="mlImpChart" width="640" height="220" style="width:100%;max-width:640px;height:220px;margin-top:8px;border-radius:8px;background:rgba(255,255,255,.03)"></canvas>';

    h+='<br><b>4/5. 模型训练与对比</b>';
    h+='<div style="overflow-x:auto;margin-top:6px"><table style="border-collapse:collapse;font-size:.68rem;width:100%">';
    if(d.task==='classify'){
      h+='<tr style="background:var(--surface-alt)"><th style="padding:6px;border:1px solid var(--border);text-align:left">模型</th><th style="padding:6px;border:1px solid var(--border)">准确率</th><th style="padding:6px;border:1px solid var(--border)">F1</th><th style="padding:6px;border:1px solid var(--border)">AUC</th></tr>';
      (d.model_compare||[]).forEach(function(m){
        var best=d.best_model&&m.model===d.best_model;
        h+='<tr'+(best?' style="background:rgba(99,102,241,.08)"':'')+'><td style="padding:5px;border:1px solid var(--border)">'+(best?'★ ':'')+m.model+'</td><td style="padding:5px;border:1px solid var(--border);text-align:center">'+(m.accuracy!=null?m.accuracy:'-')+'</td><td style="padding:5px;border:1px solid var(--border);text-align:center">'+(m.f1!=null?m.f1:'-')+'</td><td style="padding:5px;border:1px solid var(--border);text-align:center">'+(m.auc!=null?m.auc:'-')+'</td></tr>';
      });
    }else{
      h+='<tr style="background:var(--surface-alt)"><th style="padding:6px;border:1px solid var(--border);text-align:left">模型</th><th style="padding:6px;border:1px solid var(--border)">R²</th></tr>';
      (d.model_compare||[]).forEach(function(m){
        var best=d.best_model&&m.model===d.best_model;
        h+='<tr'+(best?' style="background:rgba(99,102,241,.08)"':'')+'><td style="padding:5px;border:1px solid var(--border)">'+(best?'★ ':'')+m.model+'</td><td style="padding:5px;border:1px solid var(--border);text-align:center">'+(m.r2!=null?m.r2:'-')+'</td></tr>';
      });
    }
    h+='</table></div>';

    if(d.roc&&d.roc.fpr&&d.roc.tpr){
      h+='<br><b>ROC 曲线</b>（'+ (d.roc.model||'') + (d.roc.auc!=null?(' · AUC='+d.roc.auc):'') +'）';
      h+='<canvas id="mlRocChart" width="640" height="260" style="width:100%;max-width:640px;height:260px;margin-top:8px;border-radius:8px;background:rgba(255,255,255,.03)"></canvas>';
    }
    if(d.confusion&&d.confusion.matrix){
      h+='<br><b>混淆矩阵</b><div style="overflow-x:auto;margin-top:6px"><table style="border-collapse:collapse;font-size:.68rem">';
      h+='<tr><th style="padding:5px;border:1px solid var(--border)"></th>';
      (d.confusion.labels||[]).forEach(function(lb){h+='<th style="padding:5px;border:1px solid var(--border)">预测:'+lb+'</th>';});
      h+='</tr>';
      d.confusion.matrix.forEach(function(row,i){
        h+='<tr><th style="padding:5px;border:1px solid var(--border)">真实:'+((d.confusion.labels||[])[i]||i)+'</th>';
        row.forEach(function(v){h+='<td style="padding:5px;border:1px solid var(--border);text-align:center">'+v+'</td>';});
        h+='</tr>';
      });
      h+='</table></div>';
    }

    h+='<br><b>6. 可解释性分析（模型特征重要性）</b>';
    h+='<div style="font-size:.65rem;color:var(--text-muted);margin:4px 0 8px">'+(d.note||'基于树模型特征重要性或相关评分，非完整 SHAP 交互依赖。')+'</div>';
    h+='</div>';
    out.innerHTML=h;
    if(typeof updateBalanceDisplay==='function') updateBalanceDisplay();

    setTimeout(function(){
      // importance bar
      var c1=document.getElementById('mlImpChart');
      if(c1&&imp.length&&typeof drawBarChart==='function'){
        var items=imp.slice(0,10).map(function(it){return [it.feature, Math.round(it.score*1000)/1000];});
        // drawBarChart expects [label,count]
        try{ drawBarChart(c1, items.map(function(e){return [e[0], e[1]];})); }catch(e){}
      }
      // ROC line
      var c2=document.getElementById('mlRocChart');
      if(c2&&d.roc){
        try{ drawROCCurve(c2, d.roc.fpr, d.roc.tpr, d.roc.auc); }catch(e){ console.warn(e); }
      }
    }, 40);
  }).catch(function(err){ if(out) out.innerHTML='<div class="ai-output-error">网络错误</div>'; }).finally(function(){if(typeof updateBalanceDisplay==='function')updateBalanceDisplay();});
};
window.runDataAISummary=function(){
  var cache=window._dataAnalysisCache; if(!cache){alert('请先上传并完成数据分析');return;}
  var token=sessionStorage.getItem('thesis_ai_token'); if(!token){alert('请先登录');return;}
  var out=document.getElementById('dataAIOutput'); if(!out)return;
  out.innerHTML='<div class="ai-loading">⏳ AI 正在根据统计结果撰写论文表述...</div>';
  var summary=JSON.stringify(cache.summary).substring(0,3500);
  var sig=JSON.stringify(cache.sigTop||[]).substring(0,2000);
  if(typeof requestBalanceRefreshSoon==='function')requestBalanceRefreshSoon();
  fetch('/api/llm/analyze',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({module:'data-analysis',system_prompt:'你是学术论文数据分析写作助手。请用中文、规范学术语气，根据统计摘要撰写：1)结果描述 2)可放入论文的段落 3)图表标题建议。不要编造未给出的数据。',
      user_prompt:'文件：'+cache.fileName+'\n变量数：'+cache.nVar+' 观测：'+cache.nObs+'\n统计摘要：'+summary+'\n显著性结果(Top)：'+sig+'\n请输出结构化中文结果。',max_tokens:1800})})
  .then(function(r){return r.json();}).then(function(d){
    if(d.success){ out.innerHTML='<div class="ai-output">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'; if(d.points_after!=null&&typeof setBalanceDisplay==='function')setBalanceDisplay(d.points_after); }
    else out.innerHTML='<div class="ai-output-error">❌ '+(d.error||'失败')+'</div>';
  }).catch(function(){out.innerHTML='<div class="ai-output-error">网络错误</div>';}).finally(function(){if(typeof updateBalanceDisplay==='function')updateBalanceDisplay();});
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
function drawROCCurve(canvas, fpr, tpr, auc){
  if(!canvas||!fpr||!tpr) return;
  var dpr=window.devicePixelRatio||1;
  var W=canvas.clientWidth||640, H=canvas.clientHeight||260;
  canvas.width=W*dpr; canvas.height=H*dpr;
  var ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  var pad={top:16,right:16,bottom:34,left:42};
  var pw=W-pad.left-pad.right, ph=H-pad.top-pad.bottom;
  ctx.fillStyle='rgba(255,255,255,0.02)'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.strokeRect(pad.left,pad.top,pw,ph);
  // diagonal
  ctx.setLineDash([4,4]); ctx.beginPath();
  ctx.moveTo(pad.left, pad.top+ph); ctx.lineTo(pad.left+pw, pad.top); ctx.stroke(); ctx.setLineDash([]);
  // curve
  ctx.strokeStyle='#6366f1'; ctx.lineWidth=2; ctx.beginPath();
  for(var i=0;i<fpr.length;i++){
    var x=pad.left+fpr[i]*pw; var y=pad.top+(1-tpr[i])*ph;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.font='11px sans-serif'; ctx.textAlign='center';
  ctx.fillText('FPR', pad.left+pw/2, H-10);
  ctx.save(); ctx.translate(12, pad.top+ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('TPR', 0, 0); ctx.restore();
  if(auc!=null){ ctx.textAlign='left'; ctx.fillText('AUC='+auc, pad.left+8, pad.top+16); }
}
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
  var restoreSession = function() {
  // 身份确认后再恢复；备份按 user + project 命名，旧全局备份不自动认领
  try{
    if(!getAuthToken())return;
    var savedT=sessionStorage.getItem(manuscriptBackupKey('text'));
    var savedH=sessionStorage.getItem(manuscriptBackupKey('html'));
    if(savedT&&savedH&&savedT.length>100){
      console.log('[session] Restoring scoped thesis:',Math.round(savedT.length/1000)+'k chars');
      manuscriptText=savedT;manuscriptHTML=savedH;
      var thesisBox=document.getElementById('thesisBox');
      var ws=document.getElementById('workspaceContent');
      Array.prototype.slice.call(thesisBox.childNodes).forEach(function(n){if(n!==ws)thesisBox.removeChild(n);});
      if(ws)ws.style.display='none';
      var paper=document.createElement('div');paper.id='paperContentRoot';paper.className='paper-content-root';paper.innerHTML=manuscriptHTML;thesisBox.appendChild(paper);
      try{
        sections=[];var allEls5=paper.querySelectorAll('p,h1,h2,h3,h4,h5,h6');
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
        sections=buildFullTree(paper,allHd2,bodyStart2,refBound2);
        paperTopics=extractTopics(manuscriptText);renderNavTree(sections);
      }catch(e){console.warn('[session] Tree rebuild failed:',e.message);}
      document.getElementById('statusBar').textContent='已恢复 '+(sections.length||0)+'章（刷新恢复）';
    }
  }catch(e3){}
  };
  window.restoreScopedSession=restoreSession;
  if(getAuthToken())restoreSession();

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



var BUDDY_PREF_DEFAULTS={colorMode:'auto',accentPreset:'indigo',fontFamily:'auto',density:'default',fontScale:1,reduceMotion:false};
var BUDDY_ACCENTS={indigo:['#6366f1','#4f46e5','#818cf8'],ocean:['#0284c7','#0369a1','#38bdf8'],forest:['#059669','#047857','#34d399'],rose:['#e11d48','#be123c','#fb7185'],sunset:['#ea580c','#c2410c','#fb923c']};
var _buddyThemeTimer=null,_buddyThemeMedia=null,_buddyThemeMediaHandler=null,_buddyThemePreviewBaseline=null,_buddyThemeSaving=false;
function buddyUserKey(base){try{var u=JSON.parse(sessionStorage.getItem('thesis_ai_user')||'{}');return base+'_u'+(u.id!=null?u.id:'guest');}catch(e){return base+'_guest';}}
function migrateLegacyPreferences(){
  try{
    var user=JSON.parse(sessionStorage.getItem('thesis_ai_user')||'{}');
    if(user.id==null)return;
    var key=buddyUserKey('thesisbuddy_preferences_v1');
    if(localStorage.getItem(key)!==null)return;
    var legacy=localStorage.getItem('thesis-ai-dark');
    if(legacy===null)legacy=localStorage.getItem('thesis_ai_dark');
    if(legacy!==null){var p=Object.assign({},BUDDY_PREF_DEFAULTS,{colorMode:legacy==='1'?'dark':'light'});localStorage.setItem(key,JSON.stringify(p));}
    localStorage.removeItem('thesis-ai-dark');localStorage.removeItem('thesis_ai_dark');
  }catch(e){}
}
function loadPreferences(){try{migrateLegacyPreferences();return Object.assign({},BUDDY_PREF_DEFAULTS,JSON.parse(localStorage.getItem(buddyUserKey('thesisbuddy_preferences_v1'))||'{}'));}catch(e){return Object.assign({},BUDDY_PREF_DEFAULTS);}}
function clearBuddyThemeSchedule(){
  if(_buddyThemeTimer){clearTimeout(_buddyThemeTimer);_buddyThemeTimer=null;}
  if(_buddyThemeMedia&&_buddyThemeMediaHandler){if(_buddyThemeMedia.removeEventListener)_buddyThemeMedia.removeEventListener('change',_buddyThemeMediaHandler);else if(_buddyThemeMedia.removeListener)_buddyThemeMedia.removeListener(_buddyThemeMediaHandler);}
  _buddyThemeMedia=null;_buddyThemeMediaHandler=null;
}
function resolveBuddyDarkMode(p,now){
  if(p.colorMode==='dark')return true;
  if(p.colorMode==='light')return false;
  if(p.colorMode==='system')return window.matchMedia('(prefers-color-scheme:dark)').matches;
  var hour=(now||new Date()).getHours();return hour<6||hour>=18;
}
function scheduleBuddyTheme(p){
  clearBuddyThemeSchedule();
  if(p.colorMode==='system'){
    _buddyThemeMedia=window.matchMedia('(prefers-color-scheme:dark)');
    _buddyThemeMediaHandler=function(){applyPreferences(loadPreferences());};
    if(_buddyThemeMedia.addEventListener)_buddyThemeMedia.addEventListener('change',_buddyThemeMediaHandler);else if(_buddyThemeMedia.addListener)_buddyThemeMedia.addListener(_buddyThemeMediaHandler);
  }else if(p.colorMode==='auto'){
    var now=new Date(),next=new Date(now);
    if(now.getHours()<6)next.setHours(6,0,0,0);else if(now.getHours()<18)next.setHours(18,0,0,0);else{next.setDate(next.getDate()+1);next.setHours(6,0,0,0);}
    _buddyThemeTimer=setTimeout(function(){applyPreferences(loadPreferences());},Math.max(1000,next.getTime()-now.getTime()));
  }
}
function applyPreferences(p){
  p=Object.assign({},BUDDY_PREF_DEFAULTS,p||{});var b=document.body,dark=resolveBuddyDarkMode(p);
  b.classList.toggle('dark',dark);b.classList.toggle('light',!dark);b.dataset.density=p.density;b.dataset.font=p.fontFamily;b.dataset.reduceMotion=String(!!p.reduceMotion);b.dataset.colorMode=p.colorMode;
  document.documentElement.style.fontSize=(15*Number(p.fontScale||1))+'px';
  var ac=BUDDY_ACCENTS[p.accentPreset]||BUDDY_ACCENTS.indigo;
  document.documentElement.style.setProperty('--accent',ac[0]);document.documentElement.style.setProperty('--accent-dark',ac[1]);document.documentElement.style.setProperty('--accent-light',ac[2]);scheduleBuddyTheme(p);
}
function fillPreferenceForm(p){document.getElementById('prefColorMode').value=p.colorMode;document.getElementById('prefAccent').value=p.accentPreset;document.getElementById('prefDensity').value=p.density;document.getElementById('prefFont').value=p.fontFamily;document.getElementById('prefScale').value=String(p.fontScale);document.getElementById('prefReduceMotion').checked=!!p.reduceMotion;}
function openThemeStudio(){var p=loadPreferences();_buddyThemePreviewBaseline=Object.assign({},p);_buddyThemeSaving=false;fillPreferenceForm(p);document.getElementById('themeStudio').classList.add('open');document.getElementById('themeStudio').setAttribute('aria-hidden','false');document.getElementById('themeStudioBackdrop').classList.add('open');}
function closeThemeStudio(){if(!_buddyThemeSaving&&_buddyThemePreviewBaseline)applyPreferences(_buddyThemePreviewBaseline);document.getElementById('themeStudio').classList.remove('open');document.getElementById('themeStudio').setAttribute('aria-hidden','true');document.getElementById('themeStudioBackdrop').classList.remove('open');_buddyThemePreviewBaseline=null;_buddyThemeSaving=false;}
function readPreferenceForm(){return{colorMode:document.getElementById('prefColorMode').value,accentPreset:document.getElementById('prefAccent').value,density:document.getElementById('prefDensity').value,fontFamily:document.getElementById('prefFont').value,fontScale:Number(document.getElementById('prefScale').value),reduceMotion:document.getElementById('prefReduceMotion').checked};}
function previewPreferences(){applyPreferences(readPreferenceForm());}
function savePreferences(){var p=readPreferenceForm();localStorage.setItem(buddyUserKey('thesisbuddy_preferences_v1'),JSON.stringify(p));_buddyThemePreviewBaseline=Object.assign({},p);_buddyThemeSaving=true;applyPreferences(p);closeThemeStudio();if(typeof ttp==='function')ttp('外观设置已保存');}
function resetPreferences(){fillPreferenceForm(BUDDY_PREF_DEFAULTS);previewPreferences();}
function reloadBuddyPreferences(){applyPreferences(loadPreferences());}
document.addEventListener('visibilitychange',function(){if(!document.hidden){var p=loadPreferences();if(p.colorMode==='auto'||p.colorMode==='system')applyPreferences(p);}});
function openContextHelp(){if(typeof tourStart==='function')tourStart();else openAccountModal('当前页面帮助','<p>从左侧故事线选择阶段，中间查看论文，右侧运行能力。论文搭子助手会优先引用当前项目资料。</p>');}
var _buddyConversation=[];
var _buddyConversationId='';
function buddyConversationKey(projectId){
  try{
    var u=JSON.parse(sessionStorage.getItem('thesis_ai_user')||'{}');
    return 'thesisbuddy_conv_'+(u.id||'guest')+'_'+(projectId||'none');
  }catch(e){return 'thesisbuddy_conv_guest_'+(projectId||'none');}
}
function loadBuddyConversationId(projectId){
  try{return localStorage.getItem(buddyConversationKey(projectId))||'';}catch(e){return '';}
}
function saveBuddyConversationId(projectId, conversationId){
  _buddyConversationId=conversationId||'';
  try{if(conversationId)localStorage.setItem(buddyConversationKey(projectId),conversationId);else localStorage.removeItem(buddyConversationKey(projectId));}catch(e){}
}
function getBuddySelection(){
  try{var s=window.getSelection&&window.getSelection();return s&&String(s).trim()?String(s).trim().slice(0,6000):'';}catch(e){return'';}
}
function getBuddyChapterContext(p){
  var active=document.querySelector('[data-chapter-id].active,[data-chapter].active');
  var id=active&&(active.getAttribute('data-chapter-id')||active.getAttribute('data-chapter'))||window._activeChapterId||'';
  var draft=id&&window.ThesisProject&&ThesisProject.getChapterDraft?ThesisProject.getChapterDraft(id):null;
  return{id:id||'',title:draft&&draft.title||active&&active.textContent&&active.textContent.trim().slice(0,160)||'',content:draft&&draft.content?draft.content.slice(0,12000):''};
}
function renderBuddySources(host,sources){
  if(!host||!sources||!sources.length)return;
  var groups={};sources.forEach(function(s,i){
    var key=s.source_type||s.document_id||s.material_id||s.filename||s.document||'其他来源';
    if(!groups[key])groups[key]={name:(s.source_type==='revision'?'正文版本 · ':s.source_type==='legacy_rag'?'项目资料 · ':'')+(s.filename||s.document||s.source_name||'项目资料'),items:[]};
    groups[key].items.push(s);
  });
  var section=document.createElement('section');section.className='buddy-sources';section.setAttribute('aria-label','回答来源');
  section.innerHTML='<div class="buddy-sources-title">引用依据</div>'+Object.keys(groups).map(function(key){var g=groups[key];return '<details class="buddy-source-group" open><summary>'+escapeModuleHtml(g.name)+' <span>'+g.items.length+' 条</span></summary><div>'+g.items.map(function(s,i){var heading=s.heading||s.section||s.chapter_id||('片段 '+((s.ordinal==null?i:s.ordinal)+1));var excerpt=s.excerpt||s.quote||s.text||'';return '<article class="buddy-source-item"><strong>'+escapeModuleHtml(heading)+'</strong>'+(excerpt?'<p>'+escapeModuleHtml(excerpt.slice(0,500))+'</p>':'')+'</article>';}).join('')+'</div></details>';}).join('');
  host.appendChild(section);
}
function openBuddyAssistant(){
  var d=document.getElementById('buddyDrawer');d.classList.add('open');d.setAttribute('aria-hidden','false');document.getElementById('buddyBackdrop').classList.add('open');
  var p=window.ThesisProject&&ThesisProject.getCurrentProject?ThesisProject.getCurrentProject():null;
  var ctx=document.getElementById('buddyContext');if(ctx)ctx.textContent=p?(p.title+' · '+(p.currentStage||'进行中')):'尚未选择项目';
  var host=document.getElementById('buddyMessages');
  var projectId=p&&p.id||'';
  var nextId=loadBuddyConversationId(projectId);
  if(nextId!==_buddyConversationId){
    _buddyConversationId=nextId;
    _buddyConversation=[];
    if(host)host.innerHTML='';
  }
  if(_buddyConversationId&&projectId&&(!_buddyConversation||!_buddyConversation.length)){
    fetch('/api/assistant/conversations/'+encodeURIComponent(_buddyConversationId),{headers:authJsonHeaders()}).then(function(r){return r.json();}).then(function(d){
      if(!d.success)return;
      _buddyConversation=[];
      if(host)host.innerHTML='';
      (d.messages||[]).forEach(function(m){
        var kind=m.role==='user'?'user':'assistant';
        var el=appendBuddyMessage(m.content||'',kind);
        if(kind==='assistant'&&m.sources&&m.sources.length)renderBuddySources(el,m.sources);
        _buddyConversation.push({role:m.role,content:m.content||''});
      });
    }).catch(function(){});
  }
  setTimeout(function(){document.getElementById('buddyInput').focus();},100);
}
function closeBuddyAssistant(){var d=document.getElementById('buddyDrawer');d.classList.remove('open');d.setAttribute('aria-hidden','true');document.getElementById('buddyBackdrop').classList.remove('open');}
function appendBuddyMessage(text,kind){var host=document.getElementById('buddyMessages');var el=document.createElement('div');el.className='buddy-message '+(kind||'assistant');el.textContent=text;host.appendChild(el);host.scrollTop=host.scrollHeight;return el;}
function askBuddyAssistant(){
  var input=document.getElementById('buddyInput'),q=(input.value||'').trim();if(!q)return;if(!ensureLoggedIn())return;input.value='';appendBuddyMessage(q,'user');var pending=appendBuddyMessage('正在检索当前项目证据…','assistant');var p=window.ThesisProject&&ThesisProject.getCurrentProject?ThesisProject.getCurrentProject():null;
  var projectContext=p?('项目：'+p.title+'\n阶段：'+(p.currentStage||'')+'\n想法：'+(p.idea||'')+'\n'):'';var chapter=getBuddyChapterContext(p);var revisionId=p&&p.activeRevisionId||window._activeRevisionId||'';var moduleId=window._activeModuleId||document.body.getAttribute('data-active-module')||'';_buddyConversation.push({role:'user',content:q});
  var conversationId=_buddyConversationId||loadBuddyConversationId(p&&p.id||'');
  fetch('/api/assistant/query',{method:'POST',headers:authJsonHeaders(),body:JSON.stringify({project_id:p&&p.id,question:q,context:projectContext,revision:revisionId,revision_id:revisionId,module:moduleId,module_id:moduleId,chapter:chapter,selection:getBuddySelection(),conversation_id:conversationId||undefined,conversation:_buddyConversation.slice(-12),idempotency_key:'buddy_'+Date.now()})}).then(function(r){return r.json().then(function(d){return{status:r.status,data:d};});}).then(function(x){var d=x.data||{};if(!d.success)throw new Error(d.error||'回答失败');pending.textContent=d.answer||d.content||'没有找到可用回答';_buddyConversation.push({role:'assistant',content:pending.textContent}); if(d.conversation_id)saveBuddyConversationId(p&&p.id||'',d.conversation_id); if(d.sources&&d.sources.length)renderBuddySources(pending,d.sources);if(d.usage&&d.usage.cost_points!=null)document.getElementById('buddyCostHint').textContent='本次回答已按实际使用量计费';if(typeof updateBalanceDisplay==='function')updateBalanceDisplay();}).catch(function(e){pending.textContent='暂时无法回答：'+e.message;});
}
window.openBuddyAssistant=openBuddyAssistant;window.closeBuddyAssistant=closeBuddyAssistant;window.askBuddyAssistant=askBuddyAssistant;window.openThemeStudio=openThemeStudio;window.closeThemeStudio=closeThemeStudio;window.previewPreferences=previewPreferences;window.savePreferences=savePreferences;window.resetPreferences=resetPreferences;window.reloadBuddyPreferences=reloadBuddyPreferences;window.openContextHelp=openContextHelp;
try{applyPreferences(loadPreferences());}catch(e){}

function downloadText(filename, text){
  var blob=new Blob([text],{type:'text/csv;charset=utf-8;'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(a.href);},500);
}
window.exportMlMetrics=function(){
  var d=window._mlResult; if(!d){alert('请先运行模型分析');return;}
  var rows=['model,accuracy,f1,auc,r2'];
  (d.model_compare||[]).forEach(function(m){
    rows.push([m.model,m.accuracy!=null?m.accuracy:'',m.f1!=null?m.f1:'',m.auc!=null?m.auc:'',m.r2!=null?m.r2:''].join(','));
  });
  downloadText('model_metrics.csv', rows.join('\n'));
};
window.exportMlFeatures=function(){
  var d=window._mlResult; if(!d){alert('请先运行模型分析');return;}
  var imp=d.feature_importance_model||d.feature_importance||[];
  var rows=['feature,score,selected'];
  var sel={}; (d.selected_features||[]).forEach(function(f){sel[f]=1;});
  imp.forEach(function(it){ rows.push([JSON.stringify(it.feature), it.score, sel[it.feature]?1:0].join(',')); });
  downloadText('feature_scores.csv', rows.join('\n'));
};

try{ renderToolboxFavorites(); openToolHome(); }catch(e){}

function updateDaMatCountBadge(n, total, selected){
  var badge=document.getElementById('daMatCountBadge');
  if(!badge) return;
  if(n==null){ badge.textContent='资料库 · …'; return; }
  var base=(total!=null && total!==n)?('资料库 · '+n+' 个数据文件 / 共 '+total+' 个'):('资料库 · '+n+' 个数据文件');
  if(selected!=null) base+=' · 已选 '+selected;
  badge.textContent=base;
}
function selectedDataMaterialIds(){
  return Array.prototype.slice.call(document.querySelectorAll('input[name="daMaterialIds"]:checked')).map(function(el){return el.value;}).filter(Boolean);
}
function toggleAllDataMaterials(checked){
  Array.prototype.slice.call(document.querySelectorAll('input[name="daMaterialIds"]')).forEach(function(el){el.checked=!!checked;});
  syncSelectedDataMaterials();
}
function syncSelectedDataMaterials(){
  var ids=selectedDataMaterialIds();
  var sel=document.getElementById('daMaterialSelect');
  if(sel){
    if(!ids.length){sel.value='';}
    else{
      // keep first selected as legacy single-select value for openFigureAdvisor/analyzeSelectedMaterial
      if(!Array.prototype.some.call(sel.options,function(o){return o.value===ids[0];})){
        var opt=document.createElement('option');opt.value=ids[0];opt.textContent=ids[0];sel.appendChild(opt);
      }
      sel.value=ids[0];
    }
  }
  var badgeN=document.querySelectorAll('input[name="daMaterialIds"]').length;
  updateDaMatCountBadge(badgeN,null,ids.length);
}
function loadDataAnalysisMaterials(){
  var sel=document.getElementById('daMaterialSelect');
  var list=document.getElementById('daMaterialList');
  if(!sel && !list) return;
  var p = window.ThesisProject && ThesisProject.getCurrentProject && ThesisProject.getCurrentProject();
  if(!p || !p.id){
    if(sel) sel.innerHTML='<option value="">请先创建/选择项目</option>';
    if(list) list.innerHTML='<div style="font-size:.7rem;color:var(--text-muted)">请先创建/选择项目</div>';
    updateDaMatCountBadge(0);
    return;
  }
  var token=null; try{token=sessionStorage.getItem('thesis_ai_token');}catch(e){}
  if(!token){
    if(sel) sel.innerHTML='<option value="">请先登录后使用资料库</option>';
    if(list) list.innerHTML='<div style="font-size:.7rem;color:var(--text-muted)">请先登录后使用资料库</div>';
    updateDaMatCountBadge(0);
    return;
  }
  if(sel) sel.innerHTML='<option value="">加载资料列表…</option>';
  if(list) list.innerHTML='<div style="font-size:.7rem;color:var(--text-muted)">正在加载资料列表…</div>';
  fetch('/api/projects/'+encodeURIComponent(p.id)+'/materials', {headers:{'Authorization':'Bearer '+token}})
    .then(function(r){
      if(r.status===401){ throw new Error('login'); }
      return r.json();
    })
    .then(function(d){
      if(!d.success){
        if(sel) sel.innerHTML='<option value="">资料库加载失败'+(d.error?('：'+d.error):'')+'</option>';
        if(list) list.innerHTML='<div style="font-size:.7rem;color:var(--danger)">资料库加载失败'+(d.error?('：'+escapeModuleHtml(d.error)):'')+'</div>';
        updateDaMatCountBadge(0);
        return;
      }
      var all=d.materials||[];
      var items=all.filter(function(m){
        var n=(m.filename||'').toLowerCase();
        return /\.(csv|tsv|txt)$/i.test(n) || /(csv|tsv|txt)/i.test(m.kind||'');
      });
      updateDaMatCountBadge(items.length, all.length, 0);
      if(!items.length){
        if(sel) sel.innerHTML='<option value="">暂无 CSV/TSV，请先在资料库上传</option>';
        if(list) list.innerHTML='<div style="font-size:.7rem;color:var(--text-muted)">暂无 CSV/TSV，请先在资料库上传</div>';
        return;
      }
      if(sel){
        sel.innerHTML='<option value="">选择一个数据文件（'+items.length+'）…</option>'+items.map(function(m){
          var kb=Math.round((m.size_bytes||0)/1024);
          return '<option value="'+escapeModuleHtml(m.id)+'">'+escapeModuleHtml(String(m.filename||'file'))+' ('+kb+'KB)</option>';
        }).join('');
      }
      if(list){
        list.innerHTML=items.map(function(m){
          var kb=Math.round((m.size_bytes||0)/1024);
          return '<label style="display:flex;gap:8px;align-items:flex-start;padding:6px 4px;border-bottom:1px solid var(--border-light);font-size:.72rem">'+
            '<input type="checkbox" name="daMaterialIds" value="'+escapeModuleHtml(m.id)+'" onchange="syncSelectedDataMaterials()">'+
            '<span><b>'+escapeModuleHtml(String(m.filename||'file'))+'</b><br><span style="color:var(--text-muted)">'+kb+'KB · '+(escapeModuleHtml(m.kind||'csv'))+'</span></span></label>';
        }).join('');
      }
    }).catch(function(err){
      if(err && err.message==='login'){
        if(sel) sel.innerHTML='<option value="">请先登录后使用资料库</option>';
        if(list) list.innerHTML='<div style="font-size:.7rem;color:var(--text-muted)">请先登录后使用资料库</div>';
      } else {
        if(sel) sel.innerHTML='<option value="">网络错误，可点「刷新列表」重试</option>';
        if(list) list.innerHTML='<div style="font-size:.7rem;color:var(--danger)">网络错误，可点「刷新列表」重试</div>';
      }
      updateDaMatCountBadge(0);
    });
}
window.loadDataAnalysisMaterials=loadDataAnalysisMaterials;
window.updateDaMatCountBadge=updateDaMatCountBadge;
window.toggleAllDataMaterials=toggleAllDataMaterials;
window.syncSelectedDataMaterials=syncSelectedDataMaterials;
window.selectedDataMaterialIds=selectedDataMaterialIds;
window.openJointAnalysis=function(){
  var ids=selectedDataMaterialIds();
  var host=document.getElementById('dataWorkbenchResult')||document.getElementById('dataAnalysisResult');
  if(ids.length<2){alert('联合分析至少需要勾选两个 CSV/TSV');return;}
  if(!host)return;
  var token=null;try{token=sessionStorage.getItem('thesis_ai_token');}catch(e){}
  if(!token){alert('请先登录');return;}
  var p=window.ThesisProject&&ThesisProject.getCurrentProject&&ThesisProject.getCurrentProject();
  if(!p||!p.id){host.innerHTML='<div class="finding err">请先选择项目</div>';return;}
  var auth={'Authorization':'Bearer '+token,'Content-Type':'application/json'};
  host.innerHTML='<div class="finding info">正在检查 '+ids.length+' 个数据表的联合关系…</div>';
  fetch('/api/projects/'+encodeURIComponent(p.id)+'/datasets/compatibility',{method:'POST',headers:auth,body:JSON.stringify({material_ids:ids})}).then(function(r){return r.json().then(function(d){if(!r.ok||d.success===false)throw new Error(d.error||'兼容性检查失败');return d;});}).then(function(d){
    var pairs=d.pairs||[],recipe={sources:ids,steps:[]},modes=[],warnings=[];
    for(var sourceIndex=1;sourceIndex<ids.length;sourceIndex++){
      var pair=pairs.find(function(x){return (x.left_source_id===ids[0]&&x.right_source_id===ids[sourceIndex])||(x.left_source_id===ids[sourceIndex]&&x.right_source_id===ids[0]);})||{};
      var join=(pair.candidate_joins||[])[0];
      if(join){
        if(pair.requires_confirmation||join.requires_confirmation||join.cardinality==='many_to_many'||join.cardinality==='N:M'){
          throw new Error('检测到可能造成行数膨胀的连接关系，请先减少所选资料或整理连接键后重试');
        }
        var left=pair.left_source_id===ids[0]?join.left:join.right,right=pair.left_source_id===ids[0]?join.right:join.left;
        recipe.steps.push({op:'join',right_source:ids[sourceIndex],left_on:left,right_on:right,how:'inner'});
        modes.push(left+' = '+right+' 连接');
      }else{
        recipe.steps.push({op:'union',source:ids[sourceIndex],mode:'by_name'});
        modes.push('纵向合并');
      }
    }
    var mode=modes.join(' → ');
    return fetch('/api/projects/'+encodeURIComponent(p.id)+'/datasets/preview',{method:'POST',headers:auth,body:JSON.stringify({recipe:recipe})}).then(function(r){return r.json().then(function(preview){if(!r.ok||preview.success===false)throw new Error(preview.error||'联合预览失败');return{pairs:pairs,recipe:recipe,mode:mode,preview:preview};});});
  }).then(function(ctx){
    var pr=ctx.preview,diag=pr.diagnostics||{},warnings=[];
    (diag.unmatched||[]).forEach(function(x){if(x.count)warnings.push('未匹配 '+x.count+' 行');});
    (diag.duplicates||[]).forEach(function(x){if(x.right_duplicate_keys)warnings.push('右表存在 '+x.right_duplicate_keys+' 个重复连接键');});
    host.innerHTML='<div class="finding ok"><b>联合预览完成</b><br>'+escapeModuleHtml(ctx.mode)+' · '+pr.total_count+' 行 · '+(pr.columns||[]).length+' 列</div>'+
      (warnings.length?'<div class="finding warn">'+warnings.map(escapeModuleHtml).join('<br>')+'</div>':'')+
      '<div style="overflow:auto"><table style="border-collapse:collapse;font-size:.68rem;min-width:100%"><tr>'+(pr.columns||[]).map(function(c){return'<th style="padding:5px;border:1px solid var(--border)">'+escapeModuleHtml(c)+'</th>';}).join('')+'</tr>'+(pr.rows||[]).slice(0,8).map(function(row){return'<tr>'+(pr.columns||[]).map(function(c){return'<td style="padding:5px;border:1px solid var(--border)">'+escapeModuleHtml(row[c])+'</td>';}).join('')+'</tr>';}).join('')+'</table></div>'+
      '<div class="ai-actions"><button type="button" class="ai-btn" id="daRunJointAnalysis">确认并运行联合分析</button></div>';
    var btn=document.getElementById('daRunJointAnalysis');if(!btn)return;
    btn.onclick=function(){
      btn.disabled=true;btn.textContent='正在创建数据集…';
      fetch('/api/projects/'+encodeURIComponent(p.id)+'/datasets',{method:'POST',headers:auth,body:JSON.stringify({name:'联合分析 '+new Date().toLocaleString(),recipe:ctx.recipe})}).then(function(r){return r.json().then(function(d){if(!r.ok||d.success===false)throw new Error(d.error||'数据集创建失败');return d.dataset;});}).then(function(dataset){
        btn.textContent='正在分析…';var key='joint-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
        return fetch('/api/projects/'+encodeURIComponent(p.id)+'/datasets/'+encodeURIComponent(dataset.id)+'/analyze',{method:'POST',headers:Object.assign({},auth,{'Idempotency-Key':key}),body:'{}'});
      }).then(function(r){return r.json().then(function(d){if(!r.ok||d.success===false)throw new Error(d.error||'联合分析失败');return d;});}).then(function(d){
        var a=d.analysis||{},bill=d.billing||{};
        host.innerHTML='<div class="finding ok"><b>联合分析完成</b><br>'+a.n_rows+' 行 · '+a.n_columns+' 列 · 相关关系 '+(a.correlations||[]).length+' 组 · 分组汇总 '+(a.group_summaries||[]).length+' 组<br>本次使用已按当前规则计费</div>'+
          '<div class="finding info"><b>相关性摘要</b><br>'+((a.correlations||[]).slice(0,8).map(function(x){return escapeModuleHtml(x.x+' × '+x.y+'：r='+x.pearson+' (n='+x.n+')');}).join('<br>')||'暂无可计算的数值列关系')+'</div>';
        if(typeof updateBalanceDisplay==='function')updateBalanceDisplay();
      }).catch(function(err){btn.disabled=false;btn.textContent='确认并运行联合分析';host.insertAdjacentHTML('afterbegin','<div class="finding err">'+escapeModuleHtml(err.message||'联合分析失败')+'</div>');});
    };
  }).catch(function(err){host.innerHTML='<div class="finding err">'+escapeModuleHtml(err.message||'联合分析失败')+'</div>';});
};
window.profileSelectedMaterials=function(){
  var ids=selectedDataMaterialIds();
  var host=document.getElementById('dataWorkbenchResult')||document.getElementById('dataAnalysisResult');
  if(!ids.length){alert('请先勾选至少一个 CSV/TSV');return;}
  if(!host)return;
  var token=null; try{token=sessionStorage.getItem('thesis_ai_token');}catch(e){}
  if(!token){alert('请先登录');return;}
  host.innerHTML='<div class="finding info">正在对 '+ids.length+' 个数据表做批量画像…</div>';
  var p=window.ThesisProject&&ThesisProject.getCurrentProject&&ThesisProject.getCurrentProject();
  if(!p||!p.id){host.innerHTML='<div class="finding err">请先选择项目</div>';return;}
  // Prefer batch endpoint when available; otherwise sequential profile via material download.
  fetch('/api/projects/'+encodeURIComponent(p.id)+'/data/profiles:batch',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({material_ids:ids})}).then(function(r){
    if(r.status===404) throw new Error('no-batch');
    return r.json().then(function(d){if(!r.ok||d.success===false)throw new Error(d.error||'批量画像失败');return d;});
  }).then(function(d){
    var rows=d.profiles||d.items||d.results||[];
    var errors=d.errors||[];
    if(!Array.isArray(rows)) rows=Object.keys(rows).map(function(k){return Object.assign({material_id:k},rows[k]);});
    var status=errors.length?'partial':'succeeded';
    host.innerHTML='<div class="finding '+(errors.length?'warn':'ok')+'"><b>批量画像'+(errors.length?'部分完成':'完成')+'</b> · '+rows.length+' 个成功'+(errors.length?' · '+errors.length+' 个失败':'')+'</div>'+errors.map(function(x){return '<div class="finding err">'+escapeModuleHtml(x.material_id||'资料')+'：'+escapeModuleHtml(x.error||'处理失败')+'</div>';}).join('')+rows.map(function(x){
      var id=x.material_id||x.id||'';
      if(x.success===false||x.error) return '<div class="finding err">'+escapeModuleHtml(id)+'：'+escapeModuleHtml(x.error||'失败')+'</div>';
      var prof=x.profile||x;
      return '<div class="finding info"><b>'+escapeModuleHtml(id)+'</b><br>行数 '+(prof.n_rows||prof.rows||0)+' · 列数 '+(prof.n_columns||(prof.columns&&prof.columns.length)||0)+'</div>';
    }).join('');
  }).catch(function(err){
    if(err&&err.message==='no-batch'){
      host.innerHTML='<div class="finding warn">当前后端尚未提供 profiles:batch，将改为逐表下载画像（兼容模式）。</div>';
      var chain=Promise.resolve([]);
      ids.forEach(function(id){
        chain=chain.then(function(acc){
          return fetch('/api/materials/'+encodeURIComponent(id),{headers:{'Authorization':'Bearer '+token}}).then(function(r){if(!r.ok)throw new Error('读取失败');return r.text();}).then(function(text){
            return fetch('/api/data/profile',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({csv:text,material_id:id,project_id:p.id})}).then(function(r){return r.json().then(function(d){if(!r.ok||d.success===false)throw new Error(d.error||'画像失败');return d;});}).then(function(d){acc.push({id:id,ok:true,profile:d});return acc;});
          }).catch(function(e){acc.push({id:id,ok:false,error:e.message});return acc;});
        });
      });
      return chain.then(function(rows){
        host.innerHTML='<div class="finding ok"><b>兼容模式批量画像完成</b> · '+rows.length+' 个结果</div>'+rows.map(function(x){
          if(!x.ok) return '<div class="finding err">'+escapeModuleHtml(x.id)+'：'+escapeModuleHtml(x.error||'失败')+'</div>';
          return '<div class="finding info"><b>'+escapeModuleHtml(x.id)+'</b><br>行数 '+(x.profile.n_rows||0)+' · 列数 '+(x.profile.n_columns||(x.profile.columns&&x.profile.columns.length)||0)+'</div>';
        }).join('');
      });
    }
    host.innerHTML='<div class="finding err">'+escapeModuleHtml(err.message||'批量画像失败')+'</div>';
  });
};
window.analyzeSelectedMaterial=function(){
  var ids=selectedDataMaterialIds();
  var sel=document.getElementById('daMaterialSelect');
  var id=ids[0]||(sel&&sel.value)||'';
  if(!id){ alert('请先勾选或选择资料库中的 CSV/TSV'); return; }
  if(sel) sel.value=id;
  var token=null; try{token=sessionStorage.getItem('thesis_ai_token');}catch(e){}
  if(!token){ alert('请先登录'); return; }
  var container=document.getElementById('dataAnalysisResult')||document.getElementById('dataWorkbenchResult'); if(!container) return;
  container.innerHTML='<div class="ai-loading">正在从资料库读取并分析…</div>';
  try{ var area=document.querySelector('#refPanel .module-area'); if(area) area.scrollTop=area.scrollHeight; }catch(eS){}
  fetch('/api/materials/'+encodeURIComponent(id), {headers:{'Authorization':'Bearer '+token}})
    .then(function(r){
      if(r.status===401) throw new Error('请先登录');
      if(!r.ok) throw new Error('读取失败（'+r.status+'）');
      return r.blob();
    })
    .then(function(blob){
      var name=(sel&&sel.options[sel.selectedIndex]&&sel.options[sel.selectedIndex].text||'data.csv').split(' (')[0];
      var file=new File([blob], name, {type: blob.type||'text/csv'});
      analyzeCSV(file, container);
    })
    .catch(function(e){ container.innerHTML='<div class="ai-output-error">'+(e.message||'分析失败')+'</div>'; });
};
