/**
 * ThesisBuddy — 统一模块调度 + 状态感知侧栏
 * one _open(id) to dispatch all 20 modules
 */

(function(){
  'use strict';

  // ── 模块注册表 ──
  var OVERLAYS = ['dashboard','knowledge-graph'];        // 全屏弹窗
  var POPUPS   = ['chapter-board','outline'];             // 调用独立函数
  var FULLSCREEN = ['citely','writing-workbench'];        // 替换 thesisBox
  var RESTORE_LAYOUT = ['references'];                    // 恢复原布局

  var RUNNERS = {
    'topic-finder':'runTopicFinder', 'proposal':'runProposalModule',
    'expand':'runExpandModule', 'data-analysis':'runDataAnalysis',
    'proofread':'runProofread', 'de-duplicate':'runDeduplicate',
    'format-check':'runFormatCheck', 'terminology':'runTerminology',
    'paragraph':'runParagraphAnalysis', 'review':'runReviewModule',
    'optimization':'runOptimization', 'defense-ppt':'runDefensePPT',
    'en-abstract':'runEnAbstract'
  };

  var LABELS = {
    'format-check':'✅ 格式检查','proofread':'✏️ 论文查错','terminology':'🔤 术语分析',
    'paragraph':'📝 段落分析','de-duplicate':'📋 查重降重','review':'🔍 综合审阅',
    'optimization':'💡 优化建议','expand':'📝 AI扩写','data-analysis':'📈 数据分析',
    'topic-finder':'💡 选题推荐','proposal':'📝 开题大纲','defense-ppt':'📊 答辩PPT',
    'en-abstract':'🌐 英文摘要','references':'📋 参考文献','citely':'🔍 文献检索'
  };

  // ── 工具抽屉 ──
  function getDrawer(){
    var d=document.getElementById('toolDrawer');
    if(!d){
      d=document.createElement('div');d.id='toolDrawer';d.className='tool-drawer';
      d.innerHTML='<div class="tool-drawer-head"><span id="toolDrawerTitle">工具</span><button onclick="document.getElementById(\'toolDrawer\').classList.remove(\'open\');" style="border:none;background:none;font-size:18px;cursor:pointer;color:#94a3b8">&times;</button></div><div class="tool-drawer-body" id="toolDrawerBody"></div>';
      document.body.appendChild(d);
    }
    return d;
  }

  // ── 恢复工作台 ──
  window._restoreWorkspace=function(){
    var d=document.getElementById('toolDrawer');if(d)d.classList.remove('open');
    var tb=document.getElementById('thesisBox');if(tb)tb.innerHTML='<div id="workspaceContent" class="workspace-content"></div>';
    var tp=document.getElementById('thesisPanel'),rp=document.getElementById('refPanel');
    if(tp)tp.style.display='';if(rp)rp.style.display='';
    if(typeof window.renderWorkspaceHero==='function')try{window.renderWorkspaceHero()}catch(e){}
    if(window._renderFeatureTree)window._renderFeatureTree();
  };

  // ── 统一模块打开 ──
  window._open=function(id){
    // === Overlay 模块 ===
    if(id==='dashboard'){if(typeof showDashboard==='function')showDashboard();return}
    if(id==='knowledge-graph'){if(typeof showKnowledgeGraph==='function')showKnowledgeGraph();return}

    // === 弹窗模块 ===
    if(id==='chapter-board'){if(typeof openChapterBoard==='function')openChapterBoard();return}
    if(id==='outline'){if(typeof openOutlineEditor==='function')openOutlineEditor();return}

    // === 参考文献：恢复原布局 ===
    if(id==='references'){
      if(typeof _restoreWorkspace==='function')_restoreWorkspace();
      if(typeof switchModule==='function')switchModule('references');
      return;
    }

    // === 全屏模块：替换 thesisBox ===
    if(id==='citely'){
      var tb=document.getElementById('thesisBox');var rp=document.getElementById('refPanel');
      if(tb){if(rp)rp.style.display='none';
        tb.innerHTML='<div id="citelyContainer"></div>';
        var pd={};try{var p=window.ThesisProject&&ThesisProject.getCurrentProject?ThesisProject.getCurrentProject():null;if(p){pd.keywords=p.keywords||'';pd.chapters=(p.chapters||[]).map(function(c){return{id:c.id||c.title||c,title:c.title||c}});}}catch(e){}
        if(typeof Citely!=='undefined')setTimeout(function(){Citely.mount('citelyContainer',pd)},50);
      }return;
    }
    if(id==='writing-workbench'){
      var tb2=document.getElementById('thesisBox');var rp2=document.getElementById('refPanel');
      if(tb2){if(rp2)rp2.style.display='none';tb2.innerHTML='';
        if(typeof WritingModule!=='undefined')WritingModule.mount(tb2);
      }return;
    }

    // === 右侧工具抽屉 ===
    var drawer=getDrawer();
    drawer.classList.add('open');
    var title=document.getElementById('toolDrawerTitle');if(title)title.textContent=LABELS[id]||id;
    var body=document.getElementById('toolDrawerBody');if(!body)return;body.innerHTML='';
    var fn=RUNNERS[id];
    if(fn&&typeof window[fn]==='function'){window[fn](body);body.style.boxShadow='inset 0 0 0 2px var(--accent)';setTimeout(function(){body.style.boxShadow=''},1500)}
    else{body.innerHTML='<div style="text-align:center;padding:40px;color:#94a3b8">加载中...</div>'}
  };

  // ── 状态感知侧栏 ──
  window._renderFeatureTree=function(){
    var c=document.getElementById('navFeatureTree');if(!c)return;
    var hasEssay=typeof manuscriptText!=='undefined'&&manuscriptText&&manuscriptText.length>100;
    var tools=hasEssay?[
      {id:'format-check',icon:'✅',label:'格式检查'},
      {id:'proofread',icon:'✏️',label:'论文查错'},
      {id:'terminology',icon:'🔤',label:'术语分析'},
      {id:'paragraph',icon:'📝',label:'段落分析'},
      {id:'de-duplicate',icon:'📋',label:'查重降重'},
      {id:'review',icon:'🔍',label:'综合审阅'},
      {id:'optimization',icon:'💡',label:'优化建议'},
      {id:'expand',icon:'📝',label:'AI扩写'},
      {id:'data-analysis',icon:'📈',label:'数据分析'},
      {id:'references',icon:'📋',label:'参考文献'},
      {id:'citely',icon:'🔍',label:'文献检索'},
      {id:'knowledge-graph',icon:'🕸️',label:'知识图谱'},
      {id:'dashboard',icon:'📊',label:'论文看板'},
      {id:'defense-ppt',icon:'📊',label:'答辩PPT'},
    ]:[
      {id:'topic-finder',icon:'💡',label:'选题推荐'},
      {id:'proposal',icon:'📝',label:'开题大纲'},
      {id:'citely',icon:'🔍',label:'文献检索'},
      {id:'proofread',icon:'✏️',label:'论文查错'},
      {id:'de-duplicate',icon:'📋',label:'查重降重'},
      {id:'defense-ppt',icon:'📊',label:'答辩PPT'},
      {id:'en-abstract',icon:'🌐',label:'英文摘要'},
    ];
    var h='';tools.forEach(function(t){h+='<div class="ft-leaf" onclick="_open(\''+t.id+'\')"><span class="ft-icon">'+t.icon+'</span><span class="ft-label">'+t.label+'</span></div>'});c.innerHTML=h;
  };

  // ── 初始化 ──
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',window._renderFeatureTree);
  else window._renderFeatureTree();

  // ── 向后兼容：switchModule 委托给 _open ──
  if(typeof window.switchModule==='function'){
    var _oldSwitchModule=window.switchModule;
    window.switchModule=function(id){
      // 只有通过旧路径调用的模块才委托
      if(RUNNERS[id]||OVERLAYS.indexOf(id)>=0||POPUPS.indexOf(id)>=0||FULLSCREEN.indexOf(id)>=0||RESTORE_LAYOUT.indexOf(id)>=0){
        _open(id);
      }else{
        _oldSwitchModule(id);
      }
    };
  }

  console.log('[ThesisBuddy] Unified module dispatcher ready. 20 modules registered.');
})();
