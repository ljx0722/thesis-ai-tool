/** 论文查错：AI扫描语病/标点/重复句 */
function runProofread(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div class="module-panel" style="max-width:800px;margin:0 auto">' +
    '<h4>✏️ 论文查错</h4>' +
    '<div style="padding:12px;background:rgba(99,102,241,.05);border-radius:10px;margin-bottom:16px;font-size:.75rem;color:rgba(255,255,255,.5);line-height:1.7;">AI 逐句扫描：<b>语病 · 标点错误 · 重复句 · 口语化表达 · 长句拆分建议</b><br>消耗 <b>0.5 点</b></div>' +
    '<textarea id="proofreadInput" placeholder="在此粘贴需要检查的论文段落..." style="width:100%;height:180px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px;color:#e2e8f0;font-size:.78rem;resize:vertical;line-height:1.7;outline:none"></textarea>' +
    '<div style="display:flex;gap:8px;margin:12px 0">' +
    '<button onclick="runProofreadAI()" style="flex:1;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.8rem;font-weight:700;cursor:pointer">🤖 开始查错</button>' +
    '<button onclick="document.getElementById(\'proofreadInput\').value=\'\';document.getElementById(\'proofreadOutput\').innerHTML=\'\'" style="padding:12px 16px;border:none;border-radius:10px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);font-size:.75rem;cursor:pointer">清空</button></div>' +
    '<div id="proofreadOutput" style="min-height:200px"></div>' +
  '</div>';
}

window.runProofreadAI = function() {
  var input = document.getElementById('proofreadInput').value.trim();
  if (!input || input.length < 50) { alert('请粘贴至少50字的内容'); return; }
  var out = document.getElementById('proofreadOutput');
  out.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,.4)">⏳ 正在逐句扫描...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ module: 'proofread', system_prompt: '你是学术论文语言校对专家。请逐句检查以下内容，标注：1.语病 2.标点错误 3.重复句式 4.口语化表达 5.建议拆分的长句。用中文回答，给出原文和修改建议。', user_prompt: '请检查以下论文内容：\n\n'+input.substring(0,5000), max_tokens: 2500 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div style="padding:16px;background:rgba(255,255,255,.03);border-radius:10px;border:1px solid rgba(255,255,255,.08);font-size:.75rem;color:#e2e8f0;line-height:1.8;white-space:pre-wrap">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div><div style="text-align:right;font-size:.62rem;color:rgba(255,255,255,.25);margin-top:6px">消耗 '+(d.usage.cost_credits).toFixed(1)+' 点 · 剩余 '+(d.usage.credits_after).toFixed(1)+' 点</div>';
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div style="color:#fca5a5">❌ '+d.error+'</div>'; }
  });
};
