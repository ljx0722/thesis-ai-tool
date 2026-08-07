/** 答辩PPT大纲生成 — 自动读取论文全文 */
function runDefensePPT(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  var hasManuscript = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 200;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>📊 答辩PPT大纲</h4>' +
    '<div class="ai-desc">从论文内容自动提取核心论点，生成 <b>15-20 页答辩PPT大纲</b><br>每页包含：标题 + 3-5 个要点 + 建议展示方式</div>' +
    (hasManuscript
      ? '<div style="padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin-bottom:8px;font-size:12px;color:#0369a1">📄 已自动读取论文：<b>' + manuscriptText.length + ' 字</b>。AI 将从全文中提取核心论点生成PPT大纲。</div>'
      : '<textarea id="defenseInput" class="ai-textarea" placeholder="在此粘贴论文摘要或全文..." style="height:200px;margin-bottom:0"></textarea>') +
    '<div class="ai-actions">' +
    '<button onclick="runDefenseAI()" class="ai-btn">🤖 生成PPT大纲</button>' +
    '<button onclick="document.getElementById(\'defenseOutput\').innerHTML=\'\'" class="ai-btn-clear">清空</button></div>' +
    '<div id="defenseOutput" style="min-height:200px"></div>' +
  '</div>';
}

window.runDefenseAI = function() {
  var hasManuscript = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 200;
  var input = hasManuscript ? manuscriptText.substring(0, 15000) : (document.getElementById('defenseInput')||{}).value||'';
  if (!input || input.length < 200) { alert('请先导入论文（至少200字）'); return; }
  var out = document.getElementById('defenseOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 正在生成答辩PPT大纲' + (input.length > 5000 ? '（内容较长，约需20-40秒）' : '') + '...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ capability_id: 'defense-ppt', input: '请根据以下论文内容生成答辩PPT大纲（15-20页），每页包含标题和3-5个要点，按研究背景→方法→结果→讨论→结论的逻辑组织：\n\n'+input, max_tokens: 3500 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div class="ai-output" style="white-space:pre-wrap">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'+
        '<div style="margin-top:12px"><button class="ai-btn-clear btn-sm" onclick="var t=this.parentElement.previousElementSibling;if(t)navigator.clipboard.writeText(t.textContent).then(function(){typeof ttp===\'function\'&&ttp(\'已复制大纲\')})">📋 复制大纲</button></div>';
      if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'defense-ppt', title: '答辩PPT', summary: 'AI 生成' });
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; }
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};
