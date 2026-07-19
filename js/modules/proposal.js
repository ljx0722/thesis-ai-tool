/**
 * 开题报告 → 论文大纲建议模块
 * AI 分析开题报告内容，输出结构化论文大纲
 */
function runProposalModule(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div style="max-width:800px;margin:0 auto;width:100%">' +
    '<h4>📝 开题报告 → 论文大纲建议</h4>' +
    '<div class="ai-desc">将你的开题报告内容粘贴到下方，AI 会分析并输出：<br>' +
    '<b>· 论文大纲结构</b>（章/节/小节）<br>' +
    '<b>· 各章核心内容建议</b><br>' +
    '<b>· 研究方法与技术路线</b><br>' +
    '<b>· 参考文献方向建议</b><br>' +
    '<b>· 数据可视化建议</b>（论文配图类型推荐）</div>' +
    '<textarea id="proposalInput" class="ai-textarea" placeholder="在此粘贴你的开题报告全文..." style="height:200px;margin-bottom:0"></textarea>' +
    '<div class="ai-actions">' +
      '<button onclick="runProposalAI()" class="ai-btn">🤖 AI 分析开题报告</button>' +
      '<button onclick="document.getElementById(\'proposalInput\').value=\'\';document.getElementById(\'proposalOutput\').innerHTML=\'\'" class="ai-btn-clear">清空</button>' +
    '</div>' +
    '<div id="proposalOutput" style="min-height:200px"></div>' +
  '</div>';
}

window.runProposalAI = function() {
  var input = document.getElementById('proposalInput').value.trim();
  if (!input || input.length < 100) { alert('请粘贴至少100字的开题报告内容'); return; }
  var output = document.getElementById('proposalOutput');
  output.innerHTML = '<div class="ai-loading">⏳ AI 正在分析开题报告，生成大纲建议...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      capability_id: 'proposal',
      input: '请根据以下开题报告内容，完成以下任务：\n\n1. 梳理论文大纲结构（章→节→小节，至少3章）\n2. 每章核心内容建议（各100-200字）\n3. 建议的研究方法与技术路线（含数据可视化方案，推荐合适的图表类型）\n4. 参考文献方向建议（至少3个领域）\n5. 潜在创新点与注意事项\n\n开题报告内容：\n' + input.substring(0, 8000),
      max_tokens: 2500
    })
  }).then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        output.innerHTML = '<div class="ai-output">' + d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
        if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'proposal', title: '开题大纲', summary: 'AI 完成' });
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
      } else {
        output.innerHTML = '<div class="ai-output-error">❌ ' + d.error + '</div>';
      }
    }).catch(function() { output.innerHTML = '<div class="ai-output-error">网络错误</div>'; });
};

// LLM helper for adding AI buttons to any module
window.addLLMButton = function(containerId, moduleName, promptText) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var btn = document.createElement('button');
  btn.textContent = '🤖 AI 深度分析';
  btn.className = 'ai-btn';
  btn.style.cssText = 'width:100%;margin-top:12px';
  var outputId = containerId + '_llm_output';
  btn.onclick = function() {
    var out = document.getElementById(outputId);
    if (!out) { out = document.createElement('div'); out.id = outputId; out.className = 'ai-output'; out.style.cssText = 'margin-top:10px'; el.appendChild(out); }
    out.innerHTML = '<div class="ai-loading">⏳ AI 分析中...</div>';
    var token = sessionStorage.getItem('thesis_ai_token');
    fetch('/api/llm/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ capability_id: moduleName, input: promptText(), max_tokens: 2000 })
    }).then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) {
          out.innerHTML = d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;');
          if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
        } else { out.innerHTML = '<div class="ai-output-error">❌ ' + d.error + '</div>'; }
      }).catch(function() { out.innerHTML = '<div class="ai-output-error">网络错误</div>'; });
  };
  el.appendChild(btn);
};
