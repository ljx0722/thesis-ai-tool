<script id="featureTreeScript">
(function(){
  function renderTree(){
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
    var h=tools.map(function(t){return'<div class="ft-leaf" onclick="_open(\''+t.id+'\',\'workspace\')">'+'<span class="ft-icon">'+t.icon+'</span><span class="ft-label">'+t.label+'</span></div>'}).join('');
    c.innerHTML=h;
  }
  renderTree();window._renderFeatureTree=renderTree;
})();
</script>

<script id="moduleRouter">
(function(){
  window._openFullscreen=function(h,m){var mc=document.getElementById('mainContent'),tp=document.getElementById('thesisPanel'),rp=document.getElementById('refPanel');if(tp)tp.style.display='none';if(rp)rp.style.display='none';mc.innerHTML=h;if(m)setTimeout(m,50)};
  window._activateTab=function(n){document.querySelectorAll('.bar-tab').forEach(function(t){t.classList.toggle('active',t.getAttribute('data-view')===n)})};
  window._restoreWorkspace=function(){var mc=document.getElementById('mainContent'),tp=document.getElementById('thesisPanel'),rp=document.getElementById('refPanel');if(tp)tp.style.display='';if(rp)rp.style.display='';mc.innerHTML='<div id="workspaceContent" class="workspace-content"></div>';_activateTab('workspace');if(typeof window.renderWorkspaceHero==='function')try{window.renderWorkspaceHero()}catch(e){};if(window._renderFeatureTree)window._renderFeatureTree()};
  window._open=function(id,tab){_activateTab(tab||'workspace');var mc=document.getElementById('mainContent'),tp=document.getElementById('thesisPanel'),rp=document.getElementById('refPanel');
    if(id==='references'){_restoreWorkspace();if(typeof switchModule==='function')switchModule('references');return}
    if(id==='dashboard'){if(typeof showDashboard==='function')showDashboard();return}
    if(id==='knowledge-graph'){if(typeof showKnowledgeGraph==='function')showKnowledgeGraph();return}
    if(id==='chapter-board'){if(typeof openChapterBoard==='function')openChapterBoard();return}
    if(id==='outline'){if(typeof openOutlineEditor==='function')openOutlineEditor();return}
    if(id==='citely'){if(tp)tp.style.display='none';if(rp)rp.style.display='none';mc.innerHTML='<div id="citelyContainer"></div>';var pd={};try{var p=window.ThesisProject&&ThesisProject.getCurrentProject?ThesisProject.getCurrentProject():null;if(p){pd.keywords=p.keywords||'';pd.chapters=(p.chapters||[]).map(function(c){return{id:c.id||c.title||c,title:c.title||c}});}}catch(e){}if(typeof Citely!=='undefined')setTimeout(function(){Citely.mount('citelyContainer',pd)},50);return}
    if(id==='writing-workbench'){if(tp)tp.style.display='none';if(rp)rp.style.display='none';mc.innerHTML='';if(typeof WritingModule!=='undefined')WritingModule.mount(mc);return}
    if(tp)tp.style.display='none';if(rp)rp.style.display='none';mc.innerHTML='<div style="flex:1;overflow:auto;min-height:0" id="tbModuleRoot"></div>';
    var root=document.getElementById('tbModuleRoot');if(!root)return;
    var runners={'topic-finder':'runTopicFinder','proposal':'runProposalModule','expand':'runExpandModule','data-analysis':'runDataAnalysis','proofread':'runProofread','de-duplicate':'runDeduplicate','format-check':'runFormatCheck','terminology':'runTerminology','paragraph':'runParagraphAnalysis','review':'runReviewModule','optimization':'runOptimization','defense-ppt':'runDefensePPT','en-abstract':'runEnAbstract'};
    var fn=runners[id];if(fn&&typeof window[fn]==='function'){window[fn](root);mc.style.boxShadow='inset 0 0 0 2px var(--accent)';setTimeout(function(){mc.style.boxShadow=''},1500)}else{root.innerHTML='<div style="text-align:center;padding:40px;color:#94a3b8">加载中...</div>'}
  }
})();
</script>
