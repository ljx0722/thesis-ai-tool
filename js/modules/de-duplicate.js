/** 查重降重：相似度检测 + AI降重 — 自动读取论文 */
function runDeduplicate(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  var hasManuscript = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>📋 论文查重降重</h4>' +
    '<div class="ai-desc"><b>查重检测：</b>检测词汇重复、句式单一、过度引用<br><b>智能降重：</b>AI改写，保持原意，更换表达</div>' +
    (hasManuscript
      ? '<div style="padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin-bottom:8px;font-size:12px;color:#0369a1">📄 已读取论文：' + manuscriptText.length + ' 字。点击下方按钮进行分析。</div>' +
        '<textarea id="dedupInput" class="ai-textarea" style="margin-bottom:0">' + (manuscriptText||'').substring(0, 4000) + '</textarea>'
      : '<textarea id="dedupInput" class="ai-textarea" placeholder="在此粘贴需要查重或降重的论文内容..." style="margin-bottom:0"></textarea>') +
    '<div class="ai-actions"><button onclick="runDedupAI(\'check\')" class="ai-btn">🔍 查重检测</button><button onclick="runDedupAI(\'rewrite\')" class="ai-btn" style="background:var(--accent-dark)">✍️ 智能降重</button><button onclick="document.getElementById(\'dedupInput\').value=\'\';document.getElementById(\'dedupOutput\').innerHTML=\'\'" class="ai-btn-clear">清空</button></div>' +
    '<div id="dedupOutput" style="min-height:200px"></div>' +
  '</div>';
}

window.runDedupAI = function(mode) {
  var input = document.getElementById('dedupInput').value.trim();
  if (!input || input.length < 100) { alert('请粘贴至少100字的内容或先导入论文'); return; }
  var out = document.getElementById('dedupOutput');
  out.innerHTML = '<div class="ai-loading">⏳ AI 分析中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  var prompt = mode === 'check'
    ? '请检测以下论文段落中的潜在重复问题（词汇重复、句式单一、过度引用），标注具体位置并给出严重程度（高/中/低）。\n\n' + input.substring(0, 4000)
    : '请对以下论文段落进行降重改写，保持学术原意但更换表达方式、调整句式结构、替换同义词。逐段给出原文→改写对照。\n\n' + input.substring(0, 4000);
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ capability_id: 'de-duplicate', input: prompt, max_tokens: 2500 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      var wrapper = document.createElement('div');
      var div = document.createElement('div');div.className = 'ai-output';div.style.whiteSpace='pre-wrap';div.textContent = d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;');wrapper.appendChild(div);
      var btns = document.createElement('div');btns.style.cssText='margin-top:12px;display:flex;gap:8px';
      var copyBtn = document.createElement('button');copyBtn.textContent='📋 复制结果';copyBtn.style.cssText='font-size:12px;padding:5px 12px;border:1px solid var(--border,#d1d5db);border-radius:8px;background:var(--bg-surface,#fff);cursor:pointer;color:var(--text-secondary,#555);font-weight:500';copyBtn.onclick=function(){navigator.clipboard.writeText(div.textContent).then(function(){if(typeof ttp==='function')ttp('已复制')})};
      btns.appendChild(copyBtn);
      wrapper.appendChild(btns);
      out.innerHTML = '';out.appendChild(wrapper);
      if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'de-duplicate', title: '查重降重', summary: 'AI 完成' });
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; }
  });
};
