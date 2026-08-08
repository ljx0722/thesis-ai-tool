/** 论文查错 */
function runProofread(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  var hasManuscript = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 50;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>✏️ 论文查错</h4>' +
    '<p style="font-size:12px;color:#94a3b8;margin:4px 0 10px">AI 逐句扫描语病、标点、重复、口语化、长句</p>' +
    (hasManuscript
      ? '<div style="padding:8px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin-bottom:8px;font-size:12px;color:#0369a1">📄 已读取论文 ' + manuscriptText.length + ' 字</div>'
      : '<textarea id="proofreadInput" class="ai-textarea" placeholder="粘贴需要检查的段落..." style="margin-bottom:8px"></textarea>') +
    '<div style="display:flex;gap:8px">' +
    '<button onclick="runProofreadAI()" class="ai-btn" style="flex:1">🤖 AI查错</button>' +
    (hasManuscript ? '<button onclick="(function(){var el=document.getElementById(\'proofreadScope\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'})()" class="ai-btn-clear">选范围</button>' : '') +
    '<button onclick="document.getElementById(\'proofreadOutput\').innerHTML=\'\'" class="ai-btn-clear">清空</button></div>' +
    '<div id="proofreadOutput" style="min-height:200px"></div>' +
  '</div>';
}

window.runProofreadAI = function() {
  var hasManuscript = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 50;
  var input;
  if (hasManuscript) {
    var sel = document.getElementById('proofreadChapter');
    var chIdx = sel ? sel.value : '';
    input = manuscriptText;
    if (chIdx && typeof sections !== 'undefined') {
      var s = sections[parseInt(chIdx)];
      if (s && s.text) input = s.text;
    }
    input = input.substring(0, 8000);
  } else {
    var ta = document.getElementById('proofreadInput');
    if (!ta) return;
    input = ta.value.trim();
  }
  if (!input || input.length < 50) { alert('请粘贴至少50字的内容或先导入论文'); return; }
  var out = document.getElementById('proofreadOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 正在逐句扫描' + (input.length > 2000 ? '（内容较长，可能需要15-30秒）' : '') + '...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ capability_id: 'proofread', input: '请逐句检查以下论文内容，标注语病、标点错误、重复表达、口语化和过长句子。逐条列出问题和修改建议：\n\n' + input, max_tokens: 3000 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div class="ai-output" style="white-space:pre-wrap">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'+
        '<div style="margin-top:12px;display:flex;gap:8px">'+
          '<button class="ai-btn-clear btn-sm" onclick="(function(){var t=document.querySelector(\'#proofreadOutput .ai-output\');if(!t)return;navigator.clipboard.writeText(t.textContent).then(function(){typeof ttp===\'function\'&&ttp(\'已复制\')})})()">📋 复制结果</button>'+
          '<button class="ai-btn-clear btn-sm" onclick="(function(){if(window.ThesisProject&&ThesisProject.logSkillRun)ThesisProject.logSkillRun({moduleId:\'proofread\',title:\'论文查错\',summary:(typeof manuscriptText!==\'undefined\'&&manuscriptText?manuscriptText.length:input.length)+\'字\'})})()">💾 保存到项目记录</button>'+
        '</div>';
      if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'proofread', title: '论文查错', summary: input.length + ' 字' });
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; }
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误，请稍后重试</div>'; });
};
