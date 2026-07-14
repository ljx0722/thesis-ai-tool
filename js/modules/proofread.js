/** 论文查错：AI扫描语病/标点/重复句 */
function runProofread(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div class="module-panel" style="max-width:800px;margin:0 auto">' +
    '<h4>✏️ 论文查错</h4>' +
    '<div class="ai-desc">AI 逐句扫描：<b>语病 · 标点错误 · 重复句 · 口语化表达 · 长句拆分建议</b></div>' +
    '<textarea id="proofreadInput" class="ai-textarea" placeholder="在此粘贴需要检查的论文段落..." style="margin-bottom:0"></textarea>' +
    '<div class="ai-actions">' +
    '<button onclick="runProofreadAI()" class="ai-btn">🤖 开始查错</button>' +
    '<button onclick="document.getElementById(\'proofreadInput\').value=\'\';document.getElementById(\'proofreadOutput\').innerHTML=\'\'" class="ai-btn-clear">清空</button></div>' +
    '<div id="proofreadOutput" style="min-height:200px"></div>' +
  '</div>';
}

window.runProofreadAI = function() {
  var input = document.getElementById('proofreadInput').value.trim();
  if (!input || input.length < 50) { alert('请粘贴至少50字的内容'); return; }
  var out = document.getElementById('proofreadOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 正在逐句扫描...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ module: 'proofread', system_prompt: '你是学术论文语言校对专家。请逐句检查以下内容，标注：1.语病 2.标点错误 3.重复句式 4.口语化表达 5.建议拆分的长句。用中文回答，给出原文和修改建议。', user_prompt: '请检查以下论文内容：\n\n'+input.substring(0,5000), max_tokens: 2500 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div class="ai-output">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>';
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; }
  });
};
