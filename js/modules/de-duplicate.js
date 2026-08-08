/** 查重降重 — 自动读取论文 */
function runDeduplicate(container) {
  var c = container || document.querySelector('.module-panel'); if (!c) return;
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>📋 查重降重</h4><p style="font-size:12px;color:#94a3b8;margin:4px 0 10px">查重检测：标记重复句式 | 智能降重：AI改写</p>' +
    (has
      ? '<div style="font-size:12px;color:#0369a1;margin-bottom:8px">📄 已读取 ' + manuscriptText.length + ' 字</div>' +
        '<textarea id="dedupInput" class="ai-textarea" style="height:120px;margin-bottom:8px">' + (manuscriptText||'').substring(0, 4000) + '</textarea>'
      : '<textarea id="dedupInput" class="ai-textarea" style="height:140px;margin-bottom:8px" placeholder="粘贴需要查重或降重的内容..."></textarea>') +
    '<div style="display:flex;gap:8px;margin-bottom:12px"><button onclick="runDedupAI(\'check\')" class="ai-btn" style="flex:1">🔍 查重</button><button onclick="runDedupAI(\'rewrite\')" class="ai-btn" style="flex:1;background:#6366f1">✍️ 降重</button><button class="ai-btn-clear" onclick="document.getElementById(\'dedupInput\').value=\'\';document.getElementById(\'dedupOutput\').innerHTML=\'\'">清空</button></div>' +
    '<div id="dedupOutput"></div></div>';
}

window.runDedupAI = function(mode) {
  var input = document.getElementById('dedupInput').value.trim();
  if (!input || input.length < 100) { alert('请粘贴至少100字或先导入论文'); return; }
  var out = document.getElementById('dedupOutput');
  out.innerHTML = '<div class="ai-loading">⏳ ' + (mode === 'check' ? '检测中' : '改写中') + '...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  var prompt = mode === 'check'
    ? '请检测以下论文段落中的潜在重复问题（词汇重复、句式单一、过度引用），标注位置和严重程度：\n\n' + input.substring(0, 4000)
    : '请对以下论文段落进行降重改写，保持原意但更换表达、调整句式。逐段给出原文→改写对照：\n\n' + input.substring(0, 4000);
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ capability_id: 'de-duplicate', input: prompt, max_tokens: 2500 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div class="ai-output" style="white-space:pre-wrap;font-size:13px;line-height:1.7">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'+
        '<div style="margin-top:10px"><button class="ai-btn-clear" style="font-size:12px;padding:5px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer" onclick="var t=this.parentElement.previousElementSibling;if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制</button></div>';
      if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'de-duplicate', title: '查重降重', summary: 'AI 完成' });
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; }
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};
