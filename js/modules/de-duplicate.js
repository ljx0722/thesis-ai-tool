/** 查重降重：相似度检测 + AI降重 */
function runDeduplicate(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div class="module-panel" style="max-width:800px;margin:0 auto">' +
    '<h4>📋 论文查重降重</h4>' +
    '<div class="ai-desc">粘贴你的论文段落，AI 会：<br><b>1. 检测可能重复的内容</b>（词汇、句式层面）<br><b>2. 给出改写建议</b>（保持原意的替代表达）<br>' +
    '⚠ 本功能用于辅助降重，不能替代正式查重软件</div>' +
    '<textarea id="dedupInput" class="ai-textarea" placeholder="在此粘贴需要查重或降重的论文内容..." style="margin-bottom:0"></textarea>' +
    '<div class="ai-actions"><button onclick="runDedupAI(\'check\')" class="ai-btn">🔍 查重检测</button><button onclick="runDedupAI(\'rewrite\')" class="ai-btn" style="background:var(--accent-dark)">✍️ 智能降重</button><button onclick="document.getElementById(\'dedupInput\').value=\'\';document.getElementById(\'dedupOutput\').innerHTML=\'\'" class="ai-btn-clear">清空</button></div>' +
    '<div id="dedupOutput" style="min-height:200px"></div>' +
  '</div>';
}

window.runDedupAI = function(mode) {
  var input = document.getElementById('dedupInput').value.trim();
  if (!input || input.length < 100) { alert('请粘贴至少100字的内容'); return; }
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
      out.innerHTML = '<div class="ai-output">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>';
      if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'de-duplicate', title: '查重降重', summary: 'AI 完成' });
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; }
  });
};
