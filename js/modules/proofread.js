/** 论文查错 */
function runProofread(container) {
  var c = container || document.querySelector('.module-panel'); if (!c) return;
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 50;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>✏️ 论文查错</h4><p style="font-size:12px;color:#94a3b8;margin:4px 0 10px">AI 逐句扫描语病、标点、重复、长句</p>' +
    (has
      ? '<div style="font-size:12px;color:#0369a1;margin-bottom:8px">📄 已读取 ' + manuscriptText.length + ' 字</div>' +
        '<select id="proofreadChapter" class="select" style="width:100%;margin-bottom:8px;font-size:12px"><option value="">全篇检查</option>' +
          (typeof sections!=='undefined'&&sections.length?sections.filter(function(s){return s.title&&typeof isBodyChapter==='function'&&isBodyChapter(s)}).map(function(s,i){return'<option value="'+i+'">'+s.title.substring(0,40)+'</option>'}).join(''):'')+'</select>'
      : '<textarea id="proofreadInput" class="ai-textarea" placeholder="粘贴需要检查的段落..." style="height:120px;margin-bottom:8px"></textarea>') +
    '<div style="display:flex;gap:8px;margin-bottom:12px"><button onclick="runProofreadAI()" class="ai-btn" style="flex:1">🤖 查错</button><button class="ai-btn-clear" onclick="document.getElementById(\'proofreadOutput\').innerHTML=\'\'">清空</button></div>' +
    '<div id="proofreadOutput"></div></div>';
}

window.runProofreadAI = function() {
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 50;
  var input;
  if (has) {
    var sel = document.getElementById('proofreadChapter'), chIdx = sel ? sel.value : '';
    input = manuscriptText;
    if (chIdx && typeof sections !== 'undefined') { var s = sections[parseInt(chIdx)]; if (s && s.text) input = s.text; }
    input = input.substring(0, 8000);
  } else {
    var ta = document.getElementById('proofreadInput'); if (!ta) return; input = ta.value.trim();
  }
  if (!input || input.length < 50) { alert('请粘贴至少50字或先导入论文'); return; }
  var out = document.getElementById('proofreadOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 扫描中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ capability_id: 'proofread', input: '请逐句检查，标注语病、标点错误、重复、口语化、长句。逐条列出问题和修改建议：\n\n' + input, max_tokens: 3000 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div class="ai-output" style="white-space:pre-wrap;font-size:13px;line-height:1.7">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'+
        '<div style="margin-top:10px;display:flex;gap:8px">'+
          '<button class="ai-btn-clear" style="font-size:12px;padding:5px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer" onclick="var t=this.parentElement.previousElementSibling;if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制</button>'+
          '<button class="ai-btn-clear" style="font-size:12px;padding:5px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer" onclick="if(window.ThesisProject&&ThesisProject.logSkillRun)ThesisProject.logSkillRun({moduleId:\'proofread\',title:\'查错\',summary:input.length+\'字\'});if(typeof ttp===\'function\')ttp(\'已保存\')">💾 保存</button></div>';
      if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'proofread', title: '论文查错', summary: input.length + ' 字' });
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; }
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};
