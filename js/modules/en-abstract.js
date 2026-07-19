/** 英文摘要润色翻译 */
function runEnAbstract(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div class="module-panel" style="max-width:800px;margin:0 auto">' +
    '<h4>🌐 英文摘要润色</h4>' +
    '<div class="ai-desc">支持两种模式：<br><b>翻译模式：</b>中文摘要 → 学术英文摘要<br><b>润色模式：</b>已有英文 → AI润色优化（语法/用词/流畅度）</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px">' +
    '<button onclick="setEnMode(\'translate\')" id="enBtnTranslate" class="ai-btn" style="flex:1;padding:8px 12px;font-size:var(--font-size-sm)">翻译模式</button>' +
    '<button onclick="setEnMode(\'polish\')" id="enBtnPolish" class="ai-btn-clear" style="flex:1">润色模式</button></div>' +
    '<textarea id="enInput" class="ai-textarea" placeholder="翻译模式：粘贴中文摘要&#10;润色模式：粘贴英文摘要" style="height:160px;margin-bottom:0"></textarea>' +
    '<div class="ai-actions-full"><button onclick="runEnAI()" class="ai-btn">🤖 开始处理</button></div>' +
    '<div id="enOutput" style="min-height:200px"></div>' +
  '</div>';
  window._enMode = 'translate';
}

window.setEnMode = function(m) {
  window._enMode = m;
  var tb = document.getElementById('enBtnTranslate');
  var pb = document.getElementById('enBtnPolish');
  if (m === 'translate') {
    tb.className = 'ai-btn'; tb.style.cssText = 'flex:1;padding:8px 12px;font-size:var(--font-size-sm)';
    pb.className = 'ai-btn-clear'; pb.style.cssText = 'flex:1';
  } else {
    pb.className = 'ai-btn'; pb.style.cssText = 'flex:1;padding:8px 12px;font-size:var(--font-size-sm)';
    tb.className = 'ai-btn-clear'; tb.style.cssText = 'flex:1';
  }
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
  out.innerHTML = '<div class="ai-loading">⏳ AI 处理中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ capability_id: 'en-abstract', input: prompt, max_tokens: 2000 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div class="ai-output">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>';
      if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'en-abstract', title: '英文摘要', summary: 'AI 完成' });
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; }
  });
};
