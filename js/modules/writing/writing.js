/**
 * Writing Module — Quill编辑器 + AI 4模式扩写 + 一键插入
 */
var WritingModule = (function() {
  'use strict';
  var _container = null, _activeChapter = null, _quill = null, _lastAIResult = null;

  function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function getChapters(){
    if(window.ThesisProject&&ThesisProject.getCurrentProject){try{var p=ThesisProject.getCurrentProject();if(p&&p.chapters)return p.chapters;if(p&&p.outline)return p.outline.map(function(item,i){return{id:'ch_'+(i+1),title:item.title||item,content:item.content||'',wordCount:0};});}catch(e){}}
    if(typeof sections!=='undefined'&&sections.length){var body=sections.filter(function(s){return s.title&&typeof isBodyChapter==='function'&&isBodyChapter(s);});if(body.length)return body.map(function(s,i){return{id:s.id||('ch_'+(i+1)),title:s.title,content:s.content||(typeof manuscriptText!=='undefined'?manuscriptText:''),wordCount:s.content?s.content.length:0};});}
    return [];
  }

  function selectChapter(id){var chs=getChapters();var found=null;for(var i=0;i<chs.length;i++){if(chs[i].id===id||chs[i].title===id){found=chs[i];found.index=i;break;}}_activeChapter=found;render();}

  function expandChapter(id){
    var chs=getChapters();var ch=null;
    for(var i=0;i<chs.length;i++){if(chs[i].id===id||chs[i].title===id){ch=chs[i];break;}}
    if(!ch&&chs.length>0)ch=chs[0];
    if(!ch){if(typeof ttp==='function')ttp('请先创建大纲或导入论文');return;}
    _activeChapter=ch;render();
    var panel=document.getElementById('writingExpandPanel');if(!panel)return;
    var text='';if(_quill)text=_quill.getText();if(!text||text.length<20)text=ch.content||(typeof manuscriptText!=='undefined'?manuscriptText:'');
    if(!text||text.length<20){panel.innerHTML='<div style="color:#ef4444;font-size:13px;padding:10px">内容不足，请先导入论文或手动添加</div>';return;}
    var modeEl=document.getElementById('writingMode');var mode=modeEl?modeEl.value:'扩写';
    var prompts={'扩写':'请将以下论文内容扩写至更详细和学术化的版本','改写':'请用更学术的语言改写以下内容，改善表达和逻辑','精简':'请将以下内容精简至核心要点，去除冗余','学术化':'请以顶级期刊标准改写以下内容，提升学术性和规范度'};
    panel.innerHTML='<div class="ai-loading">⏳ AI '+mode+'…</div>';
    var t=sessionStorage.getItem('thesis_ai_token');
    fetch('/api/llm/analyze',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({capability_id:'expand',input:(prompts[mode]||prompts['扩写'])+'，保持原意：\n\n'+text.substring(0,5000),max_tokens:2500})})
      .then(function(r){return r.json()}).then(function(d){
        if(d.success){_lastAIResult=d.content;panel.innerHTML='<div class="ai-output" style="white-space:pre-wrap;max-height:300px;overflow:auto;font-size:13px;line-height:1.7">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div><div style="margin-top:8px;display:flex;gap:6px"><button class="btn btn-primary btn-sm" onclick="WritingModule.insertAIResult()">🔄 插入到编辑器</button><button class="btn btn-ghost btn-sm" onclick="WritingModule.saveDraft(\''+(ch.id||'')+'\')">💾 保存</button><button class="btn btn-ghost btn-sm" onclick="var t=this.parentElement.previousElementSibling.previousElementSibling;if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制</button></div>';if(window.ThesisProject&&ThesisProject.logSkillRun)ThesisProject.logSkillRun({moduleId:'expand',title:mode+'：'+ch.title,summary:text.length+'字'});if(typeof updateBalanceDisplay==='function')updateBalanceDisplay();}
        else{panel.innerHTML='<div style="color:#ef4444;font-size:13px">❌ '+d.error+'</div>';}
      }).catch(function(){panel.innerHTML='<div style="color:#ef4444;font-size:13px">❌ 网络错误</div>';});
  }

  function insertAIResult(){if(!_lastAIResult){if(typeof ttp==='function')ttp('请先运行AI扩写');return;}if(_quill){var r=_quill.getSelection(true);_quill.insertText(r?r.index:_quill.getLength(),'\n\n'+_lastAIResult);}_lastAIResult=null;if(typeof ttp==='function')ttp('已插入编辑器');}
  function saveEditorContent(){if(!_quill)return;if(!_activeChapter)return;if(window.ThesisProject&&ThesisProject.saveChapterDraft){ThesisProject.saveChapterDraft(_activeChapter.id||'',_quill.getText());if(typeof ttp==='function')ttp('已保存');}}
  function saveDraft(chId){if(window.ThesisProject&&ThesisProject.saveChapterDraft){var panel=document.getElementById('writingExpandPanel');var t=panel?panel.querySelector('.ai-output'):null;if(t&&t.textContent){ThesisProject.saveChapterDraft(chId,t.textContent);if(typeof ttp==='function')ttp('已保存');}}}

  function render(){
    if(!_container)return;var chapters=getChapters();
    var h='<div class="writing-root" style="display:flex;flex-direction:column;height:100%">';
    var totalWords=0;chapters.forEach(function(ch,i){totalWords+=ch.wordCount||(ch.content?ch.content.length:0);});
    h+='<div style="padding:10px 16px;border-bottom:1px solid var(--border,#e2e8f0);display:flex;align-items:center;justify-content:space-between;flex-shrink:0"><div><span style="font-weight:700;font-size:14px">✍️ 写作</span>'+(chapters.length?' <span style="font-size:12px;color:#94a3b8">'+chapters.length+'章 · '+totalWords+'字</span>':'')+'</div><div style="display:flex;gap:6px">'+(typeof openOutlineEditor==='function'?'<button class="btn btn-ghost btn-sm" onclick="openOutlineEditor()">大纲</button>':'')+(typeof mergeDraftsIntoThesis==='function'?'<button class="btn btn-ghost btn-sm" onclick="mergeDraftsIntoThesis()">合并</button>':'')+'</div></div>';
    h+='<div style="display:flex;flex:1;overflow:hidden;min-height:0">';
    h+='<div style="width:200px;flex-shrink:0;overflow-y:auto;padding:10px;border-right:1px solid var(--border,#f1f5f9)">';
    if(!chapters.length){h+='<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">没有章节</div>';}
    else{chapters.forEach(function(ch,i){var isActive=_activeChapter&&(_activeChapter.id===ch.id||_activeChapter.title===ch.title);var wc=ch.wordCount||(ch.content?ch.content.length:0);h+='<div style="padding:7px 10px;margin-bottom:4px;border-radius:8px;cursor:pointer;font-size:13px;'+(isActive?'background:var(--accent,#4f46e5);color:#fff;font-weight:600':'color:#555')+'" onclick="WritingModule.selectChapter(\''+(ch.id||ch.title||'ch_'+i)+'\')">'+(i+1)+'. '+esc((ch.title||'未命名').substring(0,24))+(wc>0?' <span style="font-size:10px;opacity:.6">'+wc+'字</span>':'')+'</div>';});}h+='</div>';
    h+='<div style="flex:1;overflow-y:auto;padding:16px 20px">';
    if(!chapters.length){h+='<div style="text-align:center;padding:60px 20px;color:#94a3b8"><div style="font-size:48px;margin-bottom:12px">✍️</div><h3>论文写作</h3><p style="margin-top:8px">请先在「立项」导入论文或创建大纲</p><button class="btn btn-primary" style="margin-top:16px" onclick="ThesisRouter.go(\'home\')">→ 返回主页开始立项</button></div>';}
    else if(_activeChapter){var ch=_activeChapter;var ctext=ch.content||(typeof manuscriptText!=='undefined'?manuscriptText:'');h+='<h3 style="font-size:18px;font-weight:700;margin-bottom:4px">'+(ch.index!=null?'第'+(ch.index+1)+'章 ':'')+esc(ch.title||'未命名')+'</h3><div id="writingChapterWC" style="font-size:12px;color:#94a3b8;margin-bottom:12px">'+(ctext?ctext.length+' 字':'空章节')+'</div><div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" onclick="WritingModule.expandChapter(\''+(ch.id||'')+'\')">🤖 AI处理</button><select id="writingMode" class="select" style="font-size:11px;padding:4px 8px;width:80px"><option>扩写</option><option>改写</option><option>精简</option><option>学术化</option></select><button class="btn btn-ghost btn-sm" onclick="WritingModule.insertAIResult()">🔄 插入</button><button class="btn btn-ghost btn-sm" onclick="WritingModule.saveEditorContent()">💾 保存</button></div><div id="writingEditor" style="height:420px;font-size:14px;background:#fff"></div><div id="writingExpandPanel" style="margin-top:12px"></div>';
      setTimeout(function(){var el=document.getElementById('writingEditor');if(!el||typeof Quill==='undefined')return;if(_quill){try{_quill=null}catch(e){}}_quill=new Quill(el,{theme:'snow',modules:{toolbar:[['bold','italic','underline'],[{'header':[1,2,3,false]}],[{'list':'ordered'},{'list':'bullet'}],['blockquote'],['clean']]},placeholder:'还没有内容，点击 AI处理 生成或开始编写...'});if(ctext){if(/<\/?[a-z]/i.test(ctext))_quill.clipboard.dangerouslyPasteHTML(0,ctext);else _quill.setText(ctext)}_quill.on('text-change',function(){var wc=document.getElementById('writingChapterWC');if(wc&&_quill)wc.textContent=_quill.getText().length+' 字'});},120);}
    else{h+='<div style="text-align:center;padding:60px 20px;color:#94a3b8"><div style="font-size:48px;margin-bottom:12px">📝</div><h3>选择章节开始写作</h3><p style="margin-top:8px">从左侧目录选择一个章节</p></div>';}
    h+='</div></div></div>';_container.innerHTML=h;
  }

  return{
    mount:function(c){_container=c;render();setTimeout(function(){if(_quill)_quill.update();},200);},
    destroy:function(){_container=null;_activeChapter=null;if(_quill){try{var el=document.getElementById('writingEditor');if(el)el.innerHTML=''}catch(e){}}_quill=null;_lastAIResult=null;},
    refresh:render,selectChapter:selectChapter,expandChapter:expandChapter,saveDraft:saveDraft,insertAIResult:insertAIResult,saveEditorContent:saveEditorContent
  };
})();
