/**
 * Writing Module — 统一写作工作台
 * 左侧目录树 + 右侧章节编辑 + AI扩写
 */
var WritingModule = (function() {
  'use strict';
  var _container = null, _activeChapter = null;

  function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function getChapters(){
    if(window.ThesisProject&&ThesisProject.getCurrentProject){try{var p=ThesisProject.getCurrentProject();if(p&&p.chapters)return p.chapters;if(p&&p.outline)return p.outline.map(function(item,i){return{id:'ch_'+(i+1),title:item.title||item,content:item.content||'',wordCount:0};});}catch(e){}}
    if(typeof sections!=='undefined'&&sections.length){var body=sections.filter(function(s){return s.title&&typeof isBodyChapter==='function'&&isBodyChapter(s);});if(body.length)return body.map(function(s,i){return{id:s.id||('ch_'+(i+1)),title:s.title,content:s.content||(typeof manuscriptText!=='undefined'?manuscriptText:''),wordCount:s.content?s.content.length:0};});}
    return [];
  }

  function selectChapter(id){
    var chs=getChapters();var found=null;
    for(var i=0;i<chs.length;i++){if(chs[i].id===id||chs[i].title===id){found=chs[i];found.index=i;break;}}
    _activeChapter=found;render();
  }

  function expandChapter(id){
    var chs=getChapters();var ch=null;
    for(var i=0;i<chs.length;i++){if(chs[i].id===id||chs[i].title===id){ch=chs[i];break;}}
    if(!ch&&chs.length>0)ch=chs[0];
    if(!ch){if(typeof ttp==='function')ttp('请先创建大纲或导入论文');return;}
    _activeChapter=ch;render();
    var panel=document.getElementById('writingExpandPanel');
    if(!panel)return;
    var text=ch.content||(typeof manuscriptText!=='undefined'?manuscriptText:'');
    if(!text||text.length<20){panel.innerHTML='<div class="ai-output-error">该章节内容不足，请先导入论文或手动添加内容</div>';return;}
    panel.innerHTML='<div class="ai-loading">⏳ AI 正在扩写「'+esc(ch.title)+'」…</div>';
    var t=sessionStorage.getItem('thesis_ai_token');
    fetch('/api/llm/analyze',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({capability_id:'expand',input:'请将以下论文章节内容扩写至更详细和学术化的版本，保持原意和结构：\n\n章节：'+ch.title+'\n\n'+text.substring(0,5000),max_tokens:2500})})
      .then(function(r){return r.json()}).then(function(d){
        if(d.success){panel.innerHTML='<div class="ai-output" style="white-space:pre-wrap">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div><div style="margin-top:8px"><button class="btn btn-sm btn-ghost" onclick="WritingModule.saveDraft(\''+(ch.id||'')+'\')">💾 保存到草稿</button><button class="btn btn-sm btn-ghost" style="margin-left:6px" onclick="var t=this.parentElement.previousElementSibling;if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制</button></div>';if(window.ThesisProject&&ThesisProject.logSkillRun)ThesisProject.logSkillRun({moduleId:'expand',title:'扩写：'+ch.title,summary:text.length+'字'});if(typeof updateBalanceDisplay==='function')updateBalanceDisplay();}
        else{panel.innerHTML='<div class="ai-output-error">❌ '+d.error+'</div>';}
      }).catch(function(){panel.innerHTML='<div class="ai-output-error">❌ 网络错误</div>';});
  }

  function saveDraft(chId){
    if(window.ThesisProject&&ThesisProject.saveChapterDraft){var panel=document.getElementById('writingExpandPanel');var text=panel?panel.querySelector('.ai-output'):null;if(text&&text.textContent){ThesisProject.saveChapterDraft(chId,text.textContent);if(typeof ttp==='function')ttp('草稿已保存');}}
  }

  function render(){
    if(!_container)return;
    var chapters=getChapters();
    var h='<div class="writing-root" style="display:flex;flex-direction:column;height:100%">';
    // Toolbar
    var totalWords=0;chapters.forEach(function(ch,i){totalWords+=ch.wordCount||(ch.content?ch.content.length:0);});
    h+='<div style="padding:12px 20px;border-bottom:1px solid var(--border,#e2e8f0);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">'+
      '<div><span style="font-weight:700;font-size:14px">✍️ 写作工作台</span>'+
      (chapters.length?' <span style="font-size:12px;color:#94a3b8">'+chapters.length+'章 · '+totalWords+'字</span>':'')+'</div>'+
      '<div style="display:flex;gap:6px">'+
        (typeof openOutlineEditor==='function'?'<button class="btn btn-ghost btn-sm" onclick="openOutlineEditor()">编辑大纲</button>':'')+
        (typeof mergeDraftsIntoThesis==='function'?'<button class="btn btn-ghost btn-sm" onclick="mergeDraftsIntoThesis()">合并到正文</button>':'')+
      '</div></div>';
    // Body
    h+='<div style="display:flex;flex:1;overflow:hidden;min-height:0">';
    // Chapter selector (compact, no TOC - uses global TOC column)
    h+='<div style="width:200px;flex-shrink:0;overflow-y:auto;padding:12px;border-right:1px solid var(--border,#f1f5f9)">';
    if(!chapters.length){
      h+='<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">还没有章节</div>';
    }else{
      chapters.forEach(function(ch,i){
        var isActive=_activeChapter&&(_activeChapter.id===ch.id||_activeChapter.title===ch.title);
        var wc=ch.wordCount||(ch.content?ch.content.length:0);
        h+='<div style="padding:8px 10px;margin-bottom:4px;border-radius:8px;cursor:pointer;font-size:13px;'+
          (isActive?'background:var(--accent,#4f46e5);color:#fff;font-weight:600':'color:var(--text-secondary,#555)')+
          '" onclick="WritingModule.selectChapter(\''+(ch.id||ch.title||'ch_'+i)+'\')">'+
          (i+1)+'. '+esc((ch.title||'未命名').substring(0,24))+
          (wc>0?' <span style="font-size:10px;opacity:.6">'+wc+'字</span>':'')+'</div>';
      });
    }
    h+='</div>';
    // Content
    h+='<div style="flex:1;overflow-y:auto;padding:20px">';
    if(!chapters.length){
      h+='<div style="text-align:center;padding:60px 20px;color:#94a3b8">'+
        '<div style="font-size:48px;margin-bottom:12px">✍️</div><h3>论文写作</h3><p style="margin-top:8px">请先在「立项」中导入论文或从想法创建大纲</p>'+
        '<button class="btn btn-primary" style="margin-top:16px" onclick="navigateTo(\'setup\')">→ 去立项</button></div>';
    }else if(_activeChapter){
      var ch=_activeChapter;var ctext=ch.content||(typeof manuscriptText!=='undefined'?manuscriptText:'');
      h+='<h3 style="font-size:18px;font-weight:700;margin-bottom:4px">'+(ch.index!=null?'第'+(ch.index+1)+'章 ':'')+esc(ch.title||'未命名')+'</h3>';
      h+='<div style="font-size:12px;color:#94a3b8;margin-bottom:16px">'+(ctext?ctext.length+' 字':'空章节')+'</div>';
      h+='<div style="display:flex;gap:8px;margin-bottom:16px">'+
        '<button class="btn btn-primary btn-sm" onclick="WritingModule.expandChapter(\''+(ch.id||'')+'\')">🤖 AI扩写</button>'+
        '<button class="btn btn-ghost btn-sm" onclick="if(typeof openChapterEditor===\'function\')openChapterEditor(\''+(ch.id||'')+'\')">✏️ 手动编辑</button>'+
      '</div>';
      h+='<div id="writingExpandPanel" style="min-height:200px">'+
        '<div style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#94a3b8">点击「AI扩写」生成此章节的扩展内容，或点击「手动编辑」在弹窗中编写</div>'+
      '</div>';
    }else{
      h+='<div style="text-align:center;padding:60px 20px;color:#94a3b8">'+
        '<div style="font-size:48px;margin-bottom:12px">📝</div><h3>选择章节开始写作</h3><p style="margin-top:8px">从左侧目录中选择一个章节</p></div>';
    }
    h+='</div></div></div>';
    _container.innerHTML=h;
  }

  return{ mount:function(c){_container=c;render();}, destroy:function(){_container=null;_activeChapter=null;}, refresh:render, selectChapter:selectChapter, expandChapter:expandChapter, saveDraft:saveDraft };
})();
