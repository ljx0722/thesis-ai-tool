/** 英文摘要润色翻译 */
function runEnAbstract(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div class="module-panel" style="max-width:800px;margin:0 auto">' +
    '<h4>🌐 英文摘要润色</h4>' +
    '<div style="padding:12px;background:rgba(99,102,241,.05);border-radius:10px;margin-bottom:16px;font-size:.75rem;color:rgba(255,255,255,.5);line-height:1.7;">支持两种模式：<br><b>翻译模式：</b>中文摘要 → 学术英文摘要<br><b>润色模式：</b>已有英文 → AI润色优化（语法/用词/流畅度）<br>消耗 <b>0.3 点</b></div>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px"><button onclick="setEnMode(\'translate\')" id="enBtnTranslate" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(99,102,241,.3);background:rgba(99,102,241,.15);color:#c7d2fe;cursor:pointer;font-size:.72rem;font-weight:600">翻译模式</button><button onclick="setEnMode(\'polish\')" id="enBtnPolish" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:rgba(255,255,255,.5);cursor:pointer;font-size:.72rem;font-weight:600">润色模式</button></div>' +
    '<textarea id="enInput" placeholder="翻译模式：粘贴中文摘要&#10;润色模式：粘贴英文摘要" style="width:100%;height:160px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px;color:#e2e8f0;font-size:.78rem;resize:vertical;line-height:1.7;outline:none;margin-bottom:12px"></textarea>' +
    '<button onclick="runEnAI()" style="width:100%;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.8rem;font-weight:700;cursor:pointer;margin-bottom:12px">🤖 开始处理</button>' +
    '<div id="enOutput" style="min-height:200px"></div>' +
  '</div>';
  window._enMode = 'translate';
}

window.setEnMode = function(m) {
  window._enMode = m;
  document.getElementById('enBtnTranslate').style.cssText = 'flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:rgba(255,255,255,.5);cursor:pointer;font-size:.72rem;font-weight:600';
  document.getElementById('enBtnPolish').style.cssText = 'flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:rgba(255,255,255,.5);cursor:pointer;font-size:.72rem;font-weight:600';
  if (m === 'translate') document.getElementById('enBtnTranslate').style.cssText = 'flex:1;padding:8px;border-radius:8px;border:1px solid rgba(99,102,241,.3);background:rgba(99,102,241,.15);color:#c7d2fe;cursor:pointer;font-size:.72rem;font-weight:600';
  else document.getElementById('enBtnPolish').style.cssText = 'flex:1;padding:8px;border-radius:8px;border:1px solid rgba(99,102,241,.3);background:rgba(99,102,241,.15);color:#c7d2fe;cursor:pointer;font-size:.72rem;font-weight:600';
  var ph = m === 'translate' ? '在此粘贴中文摘要...' : '在此粘贴英文摘要...';
  document.getElementById('enInput').placeholder = ph;
};

window.runEnAI = function() {
  var input = document.getElementById('enInput').value.trim();
  if (!input || input.length < 30) { alert('请粘贴至少30字的内容'); return; }
  var mode = window._enMode;
  var prompt = mode === 'translate'
    ? '请将以下中文摘要翻译为规范学术英文摘要，保留所有关键信息，使用学术论文的标准英文表达。\n\n'+input.substring(0,3000)
    : '请润色以下英文摘要，修正语法错误，优化用词和句式，使其符合国际学术期刊标准。保留原意，只做语言层面优化。\n\n'+input.substring(0,3000);
  var out = document.getElementById('enOutput');
  out.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,.4)">⏳ AI处理中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ module: 'en-abstract', system_prompt: '你是学术翻译与写作专家，精通中英文学术写作规范。', user_prompt: prompt, max_tokens: 2000 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div style="padding:16px;background:rgba(255,255,255,.03);border-radius:10px;border:1px solid rgba(255,255,255,.08);font-size:.75rem;color:#e2e8f0;line-height:1.8;white-space:pre-wrap">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div><div style="text-align:right;font-size:.62rem;color:rgba(255,255,255,.25);margin-top:6px">消耗 '+(d.usage.cost_credits).toFixed(1)+' 点 · 剩余 '+(d.usage.credits_after).toFixed(1)+' 点</div>';
    } else { out.innerHTML = '<div style="color:#fca5a5">❌ '+d.error+'</div>'; }
  });
};
