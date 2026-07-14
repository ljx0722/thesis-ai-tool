/** 查重降重：相似度检测 + AI降重 */
function runDeduplicate(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div class="module-panel" style="max-width:800px;margin:0 auto">' +
    '<h4>📋 论文查重降重</h4>' +
    '<div style="padding:12px;background:rgba(99,102,241,.05);border-radius:10px;margin-bottom:16px;font-size:.75rem;color:rgba(255,255,255,.5);line-height:1.7;">' +
    '粘贴你的论文段落，AI 会：<br><b>1. 检测可能重复的内容</b>（词汇、句式层面）<br><b>2. 给出改写建议</b>（保持原意的替代表达）<br>' +
    '⚠ 本功能用于辅助降重，不能替代正式查重软件<br>消耗 <b>1.0 点</b>（两次AI调用：检测+改写）</div>' +
    '<textarea id="dedupInput" placeholder="在此粘贴需要查重或降重的论文内容..." style="width:100%;height:180px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px;color:#e2e8f0;font-size:.78rem;resize:vertical;line-height:1.7;outline:none"></textarea>' +
    '<div style="display:flex;gap:8px;margin:12px 0"><button onclick="runDedupAI(\'check\')" style="flex:1;padding:12px;border:none;border-radius:10px;background:#6366f1;color:#fff;font-size:.8rem;font-weight:700;cursor:pointer">🔍 查重检测</button><button onclick="runDedupAI(\'rewrite\')" style="flex:1;padding:12px;border:none;border-radius:10px;background:#8b5cf6;color:#fff;font-size:.8rem;font-weight:700;cursor:pointer">✍️ 智能降重</button></div>' +
    '<div id="dedupOutput" style="min-height:200px"></div>' +
  '</div>';
}

window.runDedupAI = function(mode) {
  var input = document.getElementById('dedupInput').value.trim();
  if (!input || input.length < 100) { alert('请粘贴至少100字的内容'); return; }
  var out = document.getElementById('dedupOutput');
  out.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,.4)">⏳ AI分析中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  var prompt = mode === 'check'
    ? '请检测以下论文段落中的潜在重复问题（词汇重复、句式单一、过度引用），标注具体位置并给出严重程度（高/中/低）。\n\n' + input.substring(0, 4000)
    : '请对以下论文段落进行降重改写，保持学术原意但更换表达方式、调整句式结构、替换同义词。逐段给出原文→改写对照。\n\n' + input.substring(0, 4000);
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ module: 'de-duplicate', system_prompt: '你是学术论文查重与降重专家。请用中文回答，结构化输出。', user_prompt: prompt, max_tokens: 2500 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div style="padding:16px;background:rgba(255,255,255,.03);border-radius:10px;border:1px solid rgba(255,255,255,.08);font-size:.75rem;color:#e2e8f0;line-height:1.8;white-space:pre-wrap">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div><div style="text-align:right;font-size:.62rem;color:rgba(255,255,255,.25);margin-top:6px">消耗 '+d.usage.cost_credits+' 点 · 剩余 '+d.usage.credits_after+' 点</div>';
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div style="color:#fca5a5">❌ '+d.error+'</div>'; }
  });
};
