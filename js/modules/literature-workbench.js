"use strict";
(function(){
  var state={view:'local',anchor:null,claim:null,results:[],loading:false,error:'',cartOpen:false,auditRun:{status:'idle',processed:0,total:0,findings:0,startedAt:null,completedAt:null,summary:null}};
  var persistQueue=Promise.resolve();
  var RELATIONS={support:'支持',counterargument:'反驳',qualify:'限定/补充',method:'方法依据',definition:'定义来源',evidence:'实证证据'};
  var CLAIM_TYPES={fact:'事实/统计',cause:'因果关系',comparison:'比较/趋势',theory:'理论观点',method:'方法选择',definition:'定义/概念',gap:'研究空白',own:'本文贡献'};

  function uid(prefix){return(prefix||'lit')+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
  function esc(value){return typeof escapeHtml==='function'?escapeHtml(value):String(value==null?'':value).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function currentProject(){return window.ThesisProject&&ThesisProject.getCurrentProject?ThesisProject.getCurrentProject():null;}
  function artifact(){return window.ThesisProject&&ThesisProject.getLiteratureArtifact?ThesisProject.getLiteratureArtifact():{claims:{},papers:{},evidenceLinks:{},occurrences:{},audits:{},searchRuns:{},cart:{paperIds:[],selections:{}},settings:{citationStyle:'gbt7714-numeric'},bibliography:{includedPaperIds:[]}};}
  function ensureImportedPapers(){
    if(!currentProject())return Promise.resolve(artifact());
    var refsList=(Array.isArray(window.existingRefs)&&window.existingRefs.length)?window.existingRefs:(Array.isArray(existingRefs)?existingRefs:[]);
    return persist(function(next){
      refsList.forEach(function(ref,index){
        var id=ref.paperId||ref.id||('imported-ref-'+(ref.num||index+1));
        if(!next.papers[id])next.papers[id]={paperId:id,title:ref.title||ref.ci||'未命名文献',authors:ref.authors||'',journal:ref.journal||'',year:ref.year||'',doi:normalizeDoi(ref.doi||''),referenceNo:ref.displayNum||ref.num||ref.originalNumber||index+1,origin:'imported',source:'manuscript'};
        if(next.bibliography.includedPaperIds.indexOf(id)<0)next.bibliography.includedPaperIds.push(id);
      });
      return next;
    });
  }
  function save(lit){if(window.ThesisProject&&ThesisProject.saveLiteratureArtifact)return ThesisProject.saveLiteratureArtifact(lit);return Promise.resolve(lit);}
  function persist(mutator){persistQueue=persistQueue.catch(function(){}).then(function(){var lit=JSON.parse(JSON.stringify(artifact())),next=mutator(lit)||lit;return save(next);});return persistQueue;}
  function panel(){return document.getElementById('literatureWorkbench');}
  function refs(){return document.getElementById('refs');}
  function setHeader(){if(typeof setToolPanelHeader==='function')setToolPanelHeader('📚 文献工作台','按论点反查、审核证据、确认后引用');}

  function selectedAnchor(){
    var selection=window.getSelection&&window.getSelection();
    if(!selection||!selection.rangeCount||selection.isCollapsed)return null;
    var range=selection.getRangeAt(0),root=document.getElementById('paperContentRoot');
    if(!root||!root.contains(range.commonAncestorContainer))return null;
    return window.createTextAnchor?window.createTextAnchor(range):null;
  }
  function inferClaimType(text){
    if(/定义|是指|称为|概念/.test(text))return'definition';
    if(/导致|影响|促进|抑制|因而|因此/.test(text))return'cause';
    if(/相比|高于|低于|趋势|增加|下降/.test(text))return'comparison';
    if(/方法|模型|算法|量表|实验/.test(text))return'method';
    if(/不足|缺乏|尚未|空白/.test(text))return'gap';
    if(/本文|本研究|我们/.test(text))return'own';
    return'fact';
  }
  function claimFromAnchor(anchor){
    var text=(anchor&&anchor.quote||'').trim();
    return{id:uid('claim'),anchor:anchor,originalText:text,normalizedClaim:text,claimType:inferClaimType(text),citationNeed:'needs-citation',discipline:(currentProject()||{}).field||'',keywords:typeof extractTitleKws==='function'?extractTitleKws(text).slice(0,8):[],synonyms:{zh:[],en:[]},searchRoles:['support'],reviewStatus:'draft',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  }
  function activateSelection(anchor,autoSearch){state.anchor=anchor;state.claim=claimFromAnchor(anchor);state.results=[];state.error='';state.view='local';open({mode:'local',keepSelection:true});if(autoSearch)setTimeout(function(){searchClaim();},0);}

  function installSelectionToolbar(){
    var old=document.getElementById('literatureSelectionBar');if(old)old.remove();
    var bar=document.createElement('div');bar.id='literatureSelectionBar';bar.className='literature-selection-bar';bar.hidden=true;
    bar.innerHTML='<button type="button" data-action="search">为此处找文献</button><button type="button" data-action="claim">提取论点</button><button type="button" data-action="skip">无需引用</button><button type="button" data-action="evidence">查看证据</button>';
    document.body.appendChild(bar);
    document.addEventListener('selectionchange',function(){
      var anchor=selectedAnchor();if(!anchor){bar.hidden=true;return;}
      var selection=window.getSelection(),range=selection.getRangeAt(0),rect=range.getBoundingClientRect();
      if(!rect.width&&!rect.height){bar.hidden=true;return;}
      bar.hidden=false;bar.style.left=Math.max(12,Math.min(window.innerWidth-bar.offsetWidth-12,rect.left))+'px';bar.style.top=Math.max(12,rect.top-bar.offsetHeight-8)+'px';bar._anchor=anchor;
    });
    bar.addEventListener('mousedown',function(e){e.preventDefault();});
    bar.addEventListener('click',function(e){var btn=e.target.closest('button');if(!btn)return;var anchor=bar._anchor;if(!anchor)return;bar.hidden=true;
      if(btn.dataset.action==='skip'){persist(function(lit){var c=claimFromAnchor(anchor);c.citationNeed='not-needed';c.reviewStatus='accepted';lit.claims[c.id]=c;return lit;}).then(function(){if(typeof ttp==='function')ttp('已标记为无需引用');}).catch(function(err){if(typeof ttp==='function')ttp(err.message||'保存失败');});return;}
      if(btn.dataset.action==='search')activateSelection(anchor,true);
      else if(btn.dataset.action==='evidence'){activateSelection(anchor,false);state.view='matrix';render();}
      else activateSelection(anchor,false);
    });
  }

  function buildQueryPlan(claim){
    var keywords=(claim.keywords||[]).filter(Boolean).slice(0,6),base=(claim.normalizedClaim||claim.originalText||'').trim();
    var variants=[];if(base)variants.push(base.substring(0,180));
    if(keywords.length)variants.push(keywords.slice(0,4).join(' '));
    if(claim.discipline&&keywords.length)variants.push(claim.discipline+' '+keywords.slice(0,3).join(' '));
    if((claim.searchRoles||[]).indexOf('counterargument')>=0)variants.push(keywords.slice(0,4).join(' ')+' limitation controversy');
    variants=variants.filter(function(v,i,a){return v&&a.indexOf(v)===i;}).slice(0,5);
    return{claimId:claim.id,claim:base,discipline:[claim.discipline].filter(Boolean),roles:(claim.searchRoles||['support']).slice(0,3),keywords:keywords,synonyms:claim.synonyms||{zh:[],en:[]},filters:{languages:['zh','en'],yearFrom:new Date().getFullYear()-10,yearTo:new Date().getFullYear(),documentTypes:['journal-article','review']},queryVariants:variants};
  }
  function normalizeDoi(value){return String(value||'').trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//,'').replace(/^doi\s*:\s*/,'').replace(/[\s.,;]+$/,'');}
  function paperId(p){var doi=normalizeDoi(p.doi);if(doi)return'doi:'+doi;var author=String(p.authors||'').split(',')[0].trim().toLowerCase().replace(/\W/g,'');return'meta:'+String(p.title||'').toLowerCase().normalize('NFKC').replace(/[^a-z0-9一-鿿]/g,'')+':'+author+':'+(p.year||'');}
  function scoreCandidate(p,claim){var rel=typeof keywordCosineSimilarity==='function'?keywordCosineSimilarity((p.title||'')+' '+(p.abstract||''),claim.normalizedClaim||''):0;var quality=0;if(p.doi)quality+=.35;if(p.journal)quality+=.2;if(p.year)quality+=.15;if(p.citations)quality+=Math.min(.2,Math.log10(Number(p.citations)+1)/10);return{relevance:Math.round(rel*100),quality:Math.round(Math.min(1,quality)*100),total:Math.round((rel*.65+Math.min(1,quality)*.35)*100)};}

  async function searchClaim(){
    if(!state.claim)return;state.claim.normalizedClaim=(document.getElementById('lwClaimText')||{}).value||state.claim.normalizedClaim;state.claim.claimType=(document.getElementById('lwClaimType')||{}).value||state.claim.claimType;state.claim.discipline=(document.getElementById('lwDiscipline')||{}).value||state.claim.discipline;
    state.claim.keywords=((document.getElementById('lwKeywords')||{}).value||'').split(/[，,、\s]+/).filter(Boolean).slice(0,10);state.claim.searchRoles=Array.prototype.slice.call(document.querySelectorAll('[name="lwRole"]:checked')).map(function(el){return el.value;});if(!state.claim.searchRoles.length)state.claim.searchRoles=['support'];state.claim.reviewStatus='accepted';
    var project=currentProject();if(!project){state.error='请先创建或打开项目';render();return;}
    var plan=buildQueryPlan(state.claim);state.loading=true;state.error='';render();
    try{
      var response=await fetch('/api/projects/'+encodeURIComponent(project.id)+'/literature/searches',{method:'POST',headers:apiAuthHeaders(true),body:JSON.stringify({queryPlans:[plan],maxResults:40,idempotencyKey:uid('search')})});
      var data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||'检索失败');
      state.results=(data.papers||[]).map(function(p){p.paperId=p.paperId||paperId(p);p.scores=p.scores||scoreCandidate(p,state.claim);return p;});
      await persist(function(lit){lit.claims[state.claim.id]=state.claim;state.results.forEach(function(p){lit.papers[p.paperId]=p;});var run=data.searchRun||{id:uid('run'),queryPlans:[plan],createdAt:new Date().toISOString()};lit.searchRuns[run.id]=run;return lit;});
    }catch(e){state.error=e.message;}finally{state.loading=false;render();}
  }

  function reportSaveError(err){state.error=(err&&err.message)||'保存失败，请稍后重试';if(typeof ttp==='function')ttp(state.error);render();}
  function toggleCart(id){persist(function(lit){var ids=lit.cart.paperIds,idx=ids.indexOf(id);if(idx>=0){ids.splice(idx,1);delete lit.cart.selections[id];}else{ids.push(id);lit.cart.selections[id]={claimId:state.claim&&state.claim.id,relation:'support'};}return lit;}).then(render).catch(reportSaveError);}
  function setRelation(id,value){persist(function(lit){if(!lit.cart.selections[id])lit.cart.selections[id]={claimId:state.claim&&state.claim.id};lit.cart.selections[id].relation=value;return lit;}).then(render).catch(reportSaveError);}
  function nextReferenceNo(){var used=[];(existingRefs||[]).concat(mergedRefs||[]).forEach(function(r){var n=Number(r.displayNum||r.num);if(n)used.push(n);});return used.length?Math.max.apply(Math,used)+1:1;}
  async function confirmCitation(id){var lit=artifact(),paper=lit.papers[id];if(!paper||!state.claim)return;var selection=lit.cart.selections[id]||{relation:'support'};var number=paper.referenceNo||nextReferenceNo();paper.referenceNo=number;
    var preview=window.previewCitationInsertion&&previewCitationInsertion(state.claim.anchor,{paperId:id,referenceNo:number});if(!preview||preview.status!=='resolved'){alert('原文位置已变化，请重新选择');return;}
    var ok=confirm('确认在所选原文末尾插入 ['+number+']？\n\n关系：'+(RELATIONS[selection.relation]||selection.relation)+'\n文献：'+paper.title);if(!ok)return;
    var result=window.commitCitationOccurrence({confirmed:true,anchor:state.claim.anchor,paper:{paperId:id,referenceNo:number},relationIds:[]});if(!result||!result.success){alert(result&&result.error||'插入失败');return;}
    try{
      await persist(function(next){next.papers[id]=paper;next.occurrences[result.occurrence.id]=result.occurrence;var link={id:uid('evidence'),claimId:state.claim.id,paperId:id,relation:selection.relation||'support',rationale:'用户确认该文献用于当前论点',excerpt:'',confidence:1,reviewStatus:'accepted',occurrenceId:result.occurrence.id,createdAt:new Date().toISOString()};next.evidenceLinks[link.id]=link;if(next.bibliography.includedPaperIds.indexOf(id)<0)next.bibliography.includedPaperIds.push(id);return next;});
      if(typeof ttp==='function')ttp('引用已确认插入');render();
    }catch(err){if(result.markerEl&&result.markerEl.parentNode)result.markerEl.parentNode.removeChild(result.markerEl);alert((err&&err.message)||'引用未保存，正文已恢复');}
  }

  async function audit(){
    var scope=window.getManuscriptScope?window.getManuscriptScope():{paragraphs:[]},items={},runId=uid('audit-run'),startedAt=new Date().toISOString();
    state.view='audit';state.error='';state.auditRun={id:runId,status:'running',processed:0,total:0,findings:0,startedAt:startedAt,completedAt:null,summary:null};render();
    if(!scope.paragraphs||!scope.paragraphs.length){state.auditRun.status='empty';state.auditRun.completedAt=new Date().toISOString();state.auditRun.summary='没有可审计的正文段落';state.error=scope&&scope.structured===false?'正文已导入，但未形成章节树；请确认正文内容后重试':'请先导入论文正文后再运行审计';render();if(typeof ttp==='function')ttp(state.error);return;}
    var total=scope.paragraphs.reduce(function(n,p){return n+(p.sentences||[]).length;},0),processed=0;state.auditRun.total=total;render();
    try{
      for(var pi=0;pi<scope.paragraphs.length;pi++){
        var p=scope.paragraphs[pi];
        for(var si=0;si<(p.sentences||[]).length;si++){
          var s=p.sentences[si],text=s.text||'',hasRef=/\[\s*\d+(?:\s*[,，、-]\s*\d+)*\s*\]/.test(text)||/\(\s*\d{1,3}\s*\)/.test(text),needs=!hasRef&&text.length>=18&&(/研究|数据|表明|发现|认为|指出|影响|导致|方法|模型|理论|比例|增长|下降/.test(text));
          if(needs){var hash=typeof simpleTextHash==='function'?simpleTextHash((scope.revisionId||'')+':'+p.paragraphId+':'+s.sentenceId+':'+text):String(p.paragraphId)+'-'+String(s.sentenceId),id='audit-'+hash,loc=p.structuralPath||{};items[id]={id:id,key:(scope.revisionId||'')+':'+p.paragraphId+':'+s.sentenceId,text:text,paragraphId:p.paragraphId,sentenceId:s.sentenceId,structuralPath:loc,location:{chapter:loc.chapter||0,section:loc.section||'',subsection:loc.subsection||'',paragraph:loc.paragraph||0},actions:['search','dismiss','later'],status:'pending',reason:'包含可验证的事实、关系或研究判断，但未检测到引用',source:'heuristic-audit',confidence:'medium',lastSeenRunId:runId,updatedAt:new Date().toISOString(),createdAt:new Date().toISOString()};}
          processed++;state.auditRun.processed=processed;state.auditRun.findings=Object.keys(items).length;if(processed===1||processed%20===0)render();await new Promise(function(resolve){setTimeout(resolve,0);});
        }
      }
      state.auditRun.status='completed';state.auditRun.completedAt=new Date().toISOString();state.auditRun.summary={totalSentences:total,findings:Object.keys(items).length,structured:scope.structured!==false};
      if(!currentProject()){render();if(typeof ttp==='function')ttp('审计完成：发现 '+Object.keys(items).length+' 个可能缺引位置（未登录项目，结果仅本次有效）');return;}
      await persist(function(lit){var seen={};Object.keys(items).forEach(function(id){var fresh=items[id],old=lit.audits[id];if(old){var manualStatus=old.status&&old.status!=='pending'?old.status:'pending';lit.audits[id]=Object.assign({},old,fresh,{status:manualStatus,createdAt:old.createdAt||fresh.createdAt});}else lit.audits[id]=fresh;seen[id]=true;});Object.keys(lit.audits).forEach(function(id){var old=lit.audits[id];if(old&&old.lastSeenRunId&&old.lastSeenRunId!==runId&&!seen[id]&&old.status==='pending'){old.status='resolved';old.resolvedAt=new Date().toISOString();old.lastSeenRunId=runId;}});lit.auditRuns=lit.auditRuns||{};lit.auditRuns[runId]=state.auditRun;return lit;});
      render();if(typeof ttp==='function')ttp('审计完成：发现 '+Object.keys(items).length+' 个可能缺引位置');
    }catch(err){state.auditRun.status='failed';state.auditRun.completedAt=new Date().toISOString();state.error=err.message||'审计失败';render();reportSaveError(err);}
  }
  function auditToClaim(id){var lit=artifact(),item=lit.audits[id];if(!item)return;var entries=((window._treeIndex||{}).paragraphs)||[],entry=entries.find(function(e){return(e.node||e).paragraphId===item.paragraphId;});if(!entry)return;var p=entry.node||entry,s=(p.sentences||[]).find(function(x){return x.sentenceId===item.sentenceId;});if(!s)return;var text=citationPlainText(p.el),start=typeof s.start==='number'?s.start:text.indexOf(s.text);if(start<0)return;var anchor={revisionId:s.revisionId,paragraphId:p.paragraphId,structuralPath:p.structuralPath,startOffset:start,endOffset:start+s.text.length,quote:s.text,prefix:text.substring(Math.max(0,start-32),start),suffix:text.substring(start+s.text.length,start+s.text.length+32),normalizedTextHash:simpleTextHash(text)};activateSelection(anchor);}
  function dismissAudit(id,status){persist(function(lit){if(lit.audits[id])lit.audits[id].status=status;return lit;}).then(render).catch(reportSaveError);}

  function formatPaper(p,style){
    var authors=p.authors||'',year=p.year||'n.d.',title=p.title||'未命名文献',journal=p.journal||'',doi=normalizeDoi(p.doi);if(style==='apa7')return authors+' ('+year+'). '+title+'. '+journal+(doi?'. https://doi.org/'+doi:'');if(style==='ieee')return authors+', “'+title+'”, '+journal+', '+year+(doi?', doi: '+doi:'')+'.';if(style==='bibtex')return'@article{'+String(p.paperId||'ref').replace(/\W/g,'_')+',\n  author={'+authors+'},\n  title={'+title+'},\n  journal={'+journal+'},\n  year={'+year+'}'+(doi?',\n  doi={'+doi+'}':'')+'\n}';if(style==='ris')return'TY  - JOUR\nTI  - '+title+'\nAU  - '+authors+'\nPY  - '+year+'\nJO  - '+journal+(doi?'\nDO  - '+doi:'')+'\nER  -';return'['+(p.referenceNo||'')+'] '+authors+'. '+title+'[J]. '+journal+', '+year+(doi?'. DOI: '+doi:'')+'.';
  }
  function exportBibliography(){var lit=artifact(),style=lit.settings.citationStyle||'gbt7714-numeric',text=lit.bibliography.includedPaperIds.map(function(id){return formatPaper(lit.papers[id]||{},style);}).join(style==='bibtex'||style==='ris'?'\n\n':'\n');if(!text)return alert('暂无已确认引用');navigator.clipboard.writeText(text);if(typeof ttp==='function')ttp('已复制 '+style+' 文献列表');}

  function tabs(){return'<div class="literature-tabs" role="tablist">'+[['local','局部反查'],['imported','已导入'],['audit','全文审计'],['matrix','证据矩阵'],['format','格式与导出']].map(function(item){return'<button role="tab" aria-selected="'+(state.view===item[0])+'" class="'+(state.view===item[0]?'active':'')+'" data-view="'+item[0]+'">'+item[1]+'</button>';}).join('')+'</div>';}
  function emptyLocal(){return'<div class="literature-empty"><strong>从一句原文开始找依据</strong><p>在左侧正文中选择句子或段落，然后点击“为此处找文献”。系统先生成论点和检索计划，不会自动修改正文。</p><button type="button" data-action="audit">先做全文引用审计</button></div>';}
  function claimEditor(){var c=state.claim,roles=Object.keys(RELATIONS).map(function(key){return'<label><input type="checkbox" name="lwRole" value="'+key+'" '+((c.searchRoles||[]).indexOf(key)>=0?'checked':'')+'> '+RELATIONS[key]+'</label>';}).join('');return'<section class="literature-claim"><div class="literature-source-quote">'+esc(c.originalText)+'</div><label>规范化论点<textarea id="lwClaimText">'+esc(c.normalizedClaim)+'</textarea></label><div class="literature-form-row"><label>论点类型<select id="lwClaimType">'+Object.keys(CLAIM_TYPES).map(function(k){return'<option value="'+k+'" '+(c.claimType===k?'selected':'')+'>'+CLAIM_TYPES[k]+'</option>';}).join('')+'</select></label><label>学科<input id="lwDiscipline" value="'+esc(c.discipline||'')+'"></label></div><label>检索关键词<input id="lwKeywords" value="'+esc((c.keywords||[]).join('，'))+'"></label><fieldset><legend>需要哪类文献</legend>'+roles+'</fieldset><button class="literature-primary" type="button" data-action="search">确认意图并检索</button></section>';}
  function evidenceCard(p){var lit=artifact(),inCart=lit.cart.paperIds.indexOf(p.paperId)>=0,sel=lit.cart.selections[p.paperId]||{},summary=p.abstract||'当前来源未提供摘要，仅基于题名和元数据判断。',method=p.methods||'未从来源元数据中识别研究方法。';return'<article class="evidence-card"><div class="evidence-card-head"><div><h4>'+esc(p.title)+'</h4><p>'+esc(p.authors||'作者未知')+' · '+esc(p.journal||'来源未知')+' · '+esc(p.year||'年份未知')+'</p></div><span class="evidence-score">'+Number((p.scores||{}).total||0)+'</span></div><div class="evidence-tags"><span>'+esc(p.source||'多源')+'</span>'+(p.doi?'<span>DOI 已提供</span>':'<span>DOI 缺失</span>')+(p.citations?'<span>被引 '+esc(p.citations)+'</span>':'')+'</div><details open><summary>为什么适合当前论点</summary><p>主题相关 '+Number((p.scores||{}).relevance||0)+'%，质量信号 '+Number((p.scores||{}).quality||0)+'%。命中题名/摘要中的论点关键词，最终关系需人工确认。</p></details><details><summary>摘要与方法</summary><p>'+esc(summary)+'</p><p><strong>方法：</strong>'+esc(method)+'</p></details><div class="evidence-actions"><button type="button" data-cart="'+esc(p.paperId)+'">'+(inCart?'移出候选篮':'加入候选篮')+'</button>'+(inCart?'<select data-relation="'+esc(p.paperId)+'">'+Object.keys(RELATIONS).map(function(k){return'<option value="'+k+'" '+(sel.relation===k?'selected':'')+'>'+RELATIONS[k]+'</option>';}).join('')+'</select><button class="literature-primary" type="button" data-confirm="'+esc(p.paperId)+'">确认引用</button>':'')+'</div></article>';}
  function localView(){if(!state.claim)return emptyLocal();var html=claimEditor();if(state.loading)html+='<div class="literature-loading">正在按论点和文献角色检索…</div>';if(state.error)html+='<div class="literature-error">'+esc(state.error)+'</div>';if(state.results.length)html+='<div class="evidence-list"><div class="literature-section-title">候选证据 '+state.results.length+' 篇</div>'+state.results.map(evidenceCard).join('')+'</div>';return html;}
  function auditView(){var lit=artifact(),items=Object.keys(lit.audits||{}).map(function(k){return lit.audits[k];}),pending=items.filter(function(x){return x.status==='pending';}),run=state.auditRun||{status:'idle',processed:0,total:0,findings:0};var statusText=run.status==='running'?'正在审计 '+run.processed+'/'+run.total+' 句（发现 '+run.findings+' 项）':run.status==='completed'?'本次审计完成：检查 '+(run.summary&&run.summary.totalSentences||run.total||0)+' 句，发现 '+(run.findings||0)+' 项':run.status==='empty'?'当前没有可审计的正文范围':run.status==='failed'?'审计失败，请重试':'尚未运行审计';return'<div class="literature-section-head"><div><strong>全文引用审计</strong><p>只识别可能缺引的位置，不自动检索或插入。</p><p>'+esc(statusText)+'</p></div><button type="button" data-action="run-audit" '+(run.status==='running'?'disabled':'')+'>运行审计</button></div>'+(state.error?'<div class="literature-error">'+esc(state.error)+'</div>':'')+(pending.length?'<div class="audit-list">'+pending.map(function(item){var loc=item.location||item.structuralPath||{};return'<article class="audit-item"><p>'+esc(item.text)+'</p><span>'+esc(item.reason)+' · '+esc((loc.chapter?'第'+loc.chapter+'章 ':'')+(loc.section||'正文'))+'</span><div><button data-audit-search="'+esc(item.id)+'">跳转并找文献</button><button data-audit-dismiss="'+esc(item.id)+'" data-status="not-needed">无需引用</button><button data-audit-dismiss="'+esc(item.id)+'" data-status="later">稍后处理</button></div></article>';}).join('')+'</div>':run.status==='completed'?'<div class="literature-empty"><strong>本次审计没有待处理项</strong><p>已检查 '+(run.summary&&run.summary.totalSentences||run.total||0)+' 句；现有已处理结果仍保留。</p></div>':'<div class="literature-empty"><strong>'+ (run.status==='empty'?'没有可审计的正文树':'尚无待处理项') +'</strong><p>'+ (run.status==='idle'?'点击“运行审计”，系统会按句子检查事实、因果、方法和研究判断。':'可重新运行审计，已处理状态不会被覆盖。') +'</p></div>');}
  function matrixView(){var lit=artifact(),claims=Object.keys(lit.claims).map(function(k){return lit.claims[k];}),links=Object.keys(lit.evidenceLinks).map(function(k){return lit.evidenceLinks[k];});return claims.length?'<div class="matrix-list">'+claims.map(function(c){var related=links.filter(function(l){return l.claimId===c.id&&l.reviewStatus==='accepted';});return'<section class="matrix-claim"><h4>'+esc(c.normalizedClaim||c.originalText)+'</h4><p>'+CLAIM_TYPES[c.claimType]+' · '+related.length+' 条已接受证据</p>'+related.map(function(l){var p=lit.papers[l.paperId]||{};return'<div class="matrix-link"><span class="relation relation-'+l.relation+'">'+(RELATIONS[l.relation]||l.relation)+'</span><strong>'+esc(p.title||'文献')+'</strong></div>';}).join('')+'</section>';}).join('')+'</div>':'<div class="literature-empty"><strong>证据矩阵还是空的</strong><p>确认文献与论点关系后，这里会显示支持、反驳、限定和方法依据。</p></div>';}
  function importedView(){var lit=artifact(),ids=lit.bibliography.includedPaperIds||[],papers=ids.map(function(id){return lit.papers[id]||{};});return'<div class="literature-section-head"><div><strong>已导入文献 '+papers.length+' 篇</strong><p>这些文献来自正文参考文献列表，可加入候选篮后参与论点反查。</p></div></div><div class="evidence-list">'+(papers.length?papers.map(evidenceCard).join(''):'<div class="literature-empty"><strong>尚未识别正文参考文献</strong><p>请确认正文已完成导入，或先运行全文审计。</p></div>')+'</div>';}
  function formatView(){var lit=artifact(),style=lit.settings.citationStyle||'gbt7714-numeric',ids=lit.bibliography.includedPaperIds;return'<div class="literature-section-head"><div><strong>格式与导出</strong><p>只有已确认引用默认进入最终书目。</p></div></div><label class="format-style">引用样式<select id="lwStyle"><option value="gbt7714-numeric" '+(style==='gbt7714-numeric'?'selected':'')+'>GB/T 7714—2015</option><option value="apa7" '+(style==='apa7'?'selected':'')+'>APA 7</option><option value="ieee" '+(style==='ieee'?'selected':'')+'>IEEE</option><option value="bibtex" '+(style==='bibtex'?'selected':'')+'>BibTeX</option><option value="ris" '+(style==='ris'?'selected':'')+'>RIS</option></select></label><div class="format-preview">'+(ids.length?ids.map(function(id){return'<div>'+esc(formatPaper(lit.papers[id]||{},style))+'</div>';}).join(''):'暂无已确认引用')+'</div><button class="literature-primary" type="button" data-action="export">复制当前格式</button>';}
  function cartBar(){var lit=artifact(),count=lit.cart.paperIds.length,open=state.cartOpen;return'<div class="literature-cart"><button type="button" data-action="cart">候选篮 <strong>'+count+'</strong></button><span>'+Object.keys(lit.evidenceLinks).length+' 条已接受证据</span></div>'+(open&&count?'<div class="evidence-list" style="padding:8px 12px 60px">'+lit.cart.paperIds.map(function(id){return evidenceCard(lit.papers[id]||{paperId:id,title:'文献'});}).join('')+'</div>':'');}
  function render(){var root=panel();if(!root)return;var body=state.view==='local'?localView():state.view==='imported'?importedView():state.view==='audit'?auditView():state.view==='matrix'?matrixView():formatView();root.innerHTML=tabs()+'<div class="literature-body">'+body+'</div>'+cartBar();}
  function open(options){options=options||{};state.view=options.mode||state.view||'local';if(!options.keepSelection){var anchor=selectedAnchor();if(anchor){state.anchor=anchor;state.claim=claimFromAnchor(anchor);}}
    if(typeof switchModule==='function')switchModule('references');setHeader();var root=panel();if(root)root.style.display='flex';var oldRefs=refs();if(oldRefs)oldRefs.style.display='none';ensureImportedPapers().then(function(){render();}).catch(function(err){state.error=err.message||'文献数据加载失败';render();});
  }
  function show(){setHeader();var root=panel();if(root)root.style.display='flex';var oldRefs=refs();if(oldRefs)oldRefs.style.display='none';ensureImportedPapers().then(function(){render();}).catch(function(err){state.error=err.message||'文献数据加载失败';render();});}
  function bind(){var root=panel();if(!root||root.dataset.literatureBound==='1')return;root.dataset.literatureBound='1';root.addEventListener('click',function(e){try{var tab=e.target.closest('[data-view]');if(tab){state.view=tab.dataset.view;render();return;}var action=e.target.closest('[data-action]');if(action){if(action.dataset.action==='search'){if(state.claim)searchClaim();else{var anchor=selectedAnchor();if(anchor)activateSelection(anchor,true);else{state.view='audit';audit();}}}else if(action.dataset.action==='audit'||action.dataset.action==='run-audit')audit();else if(action.dataset.action==='export')exportBibliography();else if(action.dataset.action==='cart'){state.cartOpen=!state.cartOpen;render();}return;}var cart=e.target.closest('[data-cart]');if(cart){toggleCart(cart.dataset.cart);return;}var confirm=e.target.closest('[data-confirm]');if(confirm){confirmCitation(confirm.dataset.confirm);return;}var auditSearch=e.target.closest('[data-audit-search]');if(auditSearch){auditToClaim(auditSearch.dataset.auditSearch);return;}var dismiss=e.target.closest('[data-audit-dismiss]');if(dismiss){dismissAudit(dismiss.dataset.auditDismiss,dismiss.dataset.status);}}catch(err){reportSaveError(err);}});root.addEventListener('change',function(e){if(e.target.matches('[data-relation]'))setRelation(e.target.dataset.relation,e.target.value);if(e.target.id==='lwStyle'){persist(function(lit){lit.settings.citationStyle=e.target.value;return lit;}).then(render).catch(reportSaveError);}});}
  function init(){installSelectionToolbar();bind();window.addEventListener('literature-artifact-changed',function(){if(panel()&&panel().style.display!=='none')render();});}
  window.LiteratureWorkbench={open:open,show:show,render:render,audit:audit,ensureImportedPapers:ensureImportedPapers,buildQueryPlan:buildQueryPlan,normalizeDoi:normalizeDoi,paperId:paperId,formatPaper:formatPaper};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
