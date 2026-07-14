/**
 * 开题报告 → 论文大纲建议模块
 * AI 分析开题报告内容，输出结构化论文大纲
 */
function runProposalModule(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div class="module-panel" style="max-width:800px;margin:0 auto">' +
    '<h4>📝 开题报告 → 论文大纲建议</h4>' +
    '<div style="padding:12px;background:rgba(99,102,241,.05);border-radius:10px;margin-bottom:16px;font-size:.75rem;color:rgba(255,255,255,.5);line-height:1.7">' +
    '将你的开题报告内容粘贴到下方，AI 会分析并输出：<br>' +
    '<b>• 论文大纲结构</b>（章/节/小节）<br>' +
    '<b>• 各章核心内容建议</b><br>' +
    '<b>• 研究方法与技术路线</b><br>' +
    '<b>• 参考文献方向建议</b><br>' +
    '<b>• 数据可视化建议</b>（论文配图类型推荐）</div>' +
    '<textarea id="proposalInput" placeholder="在此粘贴你的开题报告全文..." style="width:100%;height:200px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px;color:#e2e8f0;font-size:.78rem;font-family:inherit;resize:vertical;line-height:1.7;outline:none;margin-bottom:12px"></textarea>' +
    '<div style="display:flex;gap:8px;margin-bottom:16px">' +
      '<button onclick="runProposalAI()" style="flex:1;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.8rem;font-weight:700;cursor:pointer">🤖 AI 分析开题报告</button>' +
      '<button id="proposalClearBtn" onclick="document.getElementById(\'proposalInput\').value=\'\';document.getElementById(\'proposalOutput\').innerHTML=\'\'" style="padding:12px 16px;border:none;border-radius:10px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);font-size:.75rem;cursor:pointer">清空</button>' +
    '</div>' +
    '<div id="proposalOutput" style="min-height:200px"></div>' +
    '<div style="margin-top:8px;padding:12px;background:rgba(0,0,0,.1);border-radius:10px;font-size:.62rem;color:rgba(255,255,255,.25)">' +
    '提示：AI 分析消耗 <b>1 点</b>。系统会基于你的余额自动扣费。</div>' +
  '</div>';
}

window.runProposalAI = function() {
  var input = document.getElementById('proposalInput').value.trim();
  if (!input || input.length < 100) { alert('请粘贴至少100字的开题报告内容'); return; }
  var output = document.getElementById('proposalOutput');
  output.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,.4)"><div style="font-size:2rem;margin-bottom:8px">⏳</div>AI 正在分析开题报告，生成大纲建议...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      module: 'proposal',
      system_prompt: '你是一位资深的学术论文导师，擅长帮助研究生从开题报告梳理出完整的论文大纲。请用中文回答，输出结构清晰、有层次。',
      user_prompt: '请根据以下开题报告内容，完成以下任务：\n\n1. 梳理论文大纲结构（章→节→小节，至少3章）\n2. 每章核心内容建议（各100-200字）\n3. 建议的研究方法与技术路线（含数据可视化方案，推荐合适的图表类型）\n4. 参考文献方向建议（至少3个领域）\n5. 潜在创新点与注意事项\n\n开题报告内容：\n' + input.substring(0, 8000),
      max_tokens: 2500
    })
  }).then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        output.innerHTML = '<div style="padding:16px;background:rgba(255,255,255,.03);border-radius:10px;border:1px solid rgba(255,255,255,.08);font-size:.75rem;color:#e2e8f0;line-height:1.8;white-space:pre-wrap">' +
        d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
        '<div style="text-align:right;font-size:.62rem;color:rgba(255,255,255,.25);margin-top:6px">消耗 ' + d.usage.cost_credits/1000 + ' 点 · 剩余 ' + d.usage.credits_after/1000 + ' 点</div>';
        if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
      } else {
        output.innerHTML = '<div style="padding:16px;background:rgba(239,68,68,.1);border-radius:10px;color:#fca5a5;font-size:.75rem">❌ ' + d.error + '</div>';
      }
    }).catch(function() { output.innerHTML = '<div style="padding:16px;background:rgba(239,68,68,.1);border-radius:10px;color:#fca5a5">网络错误</div>'; });
};

// LLM helper for adding AI buttons to any module
window.addLLMButton = function(containerId, moduleName, promptText) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var btn = document.createElement('button');
  btn.textContent = '🤖 AI 深度分析';
  btn.style.cssText = 'width:100%;margin-top:12px;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.75rem;font-weight:600;cursor:pointer;transition:all .2s';
  btn.onmouseenter = function() { this.style.boxShadow = '0 4px 16px rgba(99,102,241,.3)'; };
  btn.onmouseleave = function() { this.style.boxShadow = ''; };
  var outputId = containerId + '_llm_output';
  btn.onclick = function() {
    var out = document.getElementById(outputId);
    if (!out) { out = document.createElement('div'); out.id = outputId; out.style.cssText = 'margin-top:10px;padding:14px;background:rgba(255,255,255,.03);border-radius:10px;border:1px solid rgba(255,255,255,.08);font-size:.73rem;color:#e2e8f0;line-height:1.75;white-space:pre-wrap;max-height:400px;overflow-y:auto'; el.appendChild(out); }
    out.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,.4)">⏳ AI分析中...</div>';
    var token = sessionStorage.getItem('thesis_ai_token');
    fetch('/api/llm/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ module: moduleName, system_prompt: '你是一位学术论文评审专家。请用中文进行分析。', user_prompt: promptText(), max_tokens: 2000 })
    }).then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) {
          out.innerHTML = d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;') +
            '<div style="text-align:right;font-size:.6rem;color:rgba(255,255,255,.2);margin-top:8px">消耗 ' + d.usage.cost_credits/1000 + ' 点</div>';
          if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
        } else { out.innerHTML = '<div style="color:#fca5a5">❌ ' + d.error + '</div>'; }
      }).catch(function() { out.innerHTML = '<div style="color:#fca5a5">网络错误</div>'; });
  };
  el.appendChild(btn);
};
