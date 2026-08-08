/** 答辩PPT大纲 — 自动读取论文 */
function runDefensePPT(container) {
  var c = container || document.querySelector('.module-panel'); if (!c) return;
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 200;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>📊 答辩PPT大纲</h4><p style="font-size:12px;color:#94a3b8;margin:4px 0 10px">从论文自动提取15-20页答辩PPT，每题含标题+要点</p>' +
    (has
      ? '<div style="font-size:12px;color:#0369a1;margin-bottom:8px">📄 已读取 ' + manuscriptText.length + ' 字</div>'
      : '<textarea id="defenseInput" class="ai-textarea" style="height:120px;margin-bottom:8px" placeholder="粘贴论文摘要或全文..."></textarea>') +
    '<div style="display:flex;gap:8px;margin-bottom:12px"><button onclick="runDefenseAI()" class="ai-btn" style="flex:1">🤖 生成PPT</button><button class="ai-btn-clear" onclick="document.getElementById(\'defenseOutput\').innerHTML=\'\'">清空</button></div>' +
    '<div id="defenseOutput"></div></div>';
}

window.runDefenseAI = function() {
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 200;
  var input = has ? manuscriptText.substring(0, 15000) : (document.getElementById('defenseInput')||{}).value||'';
  if (!input || input.length < 200) { alert('请粘贴至少200字或先导入论文'); return; }
  var out = document.getElementById('defenseOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 生成中' + (input.length > 5000 ? '（约20-40秒）' : '') + '...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ capability_id: 'defense-ppt', input: '请生成答辩PPT大纲（15-20页），每页含标题+3-5要点，按背景→方法→结果→讨论→结论组织：\n\n'+input, max_tokens: 3500 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div class="ai-output" style="white-space:pre-wrap;font-size:13px;line-height:1.7">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'+
        '<div style="margin-top:10px"><button class="ai-btn-clear" style="font-size:12px;padding:5px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer" onclick="var t=this.parentElement.previousElementSibling;if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制</button></div>';
      if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'defense-ppt', title: '答辩PPT', summary: 'AI 生成' });
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; }
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};
