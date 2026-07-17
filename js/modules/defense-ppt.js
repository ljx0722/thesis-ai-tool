/** 答辩PPT大纲生成 */
function runDefensePPT(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div class="module-panel" style="max-width:800px;margin:0 auto">' +
    '<h4>📊 答辩PPT大纲</h4>' +
    '<div class="ai-desc">从论文内容自动提取核心论点，生成 <b>15-20 页答辩PPT大纲</b><br>每页包含：标题 + 3-5 个要点 + 建议展示方式</div>' +
    '<textarea id="defenseInput" class="ai-textarea" placeholder="在此粘贴论文摘要或全文（越长效果越好）..." style="height:200px;margin-bottom:0"></textarea>' +
    '<div class="ai-actions">' +
    '<button onclick="runDefenseAI()" class="ai-btn">🤖 生成PPT大纲</button>' +
    '<button onclick="document.getElementById(\'defenseInput\').value=\'\';document.getElementById(\'defenseOutput\').innerHTML=\'\'" class="ai-btn-clear">清空</button></div>' +
    '<div id="defenseOutput" style="min-height:200px"></div>' +
  '</div>';
}

window.runDefenseAI = function() {
  var input = document.getElementById('defenseInput').value.trim();
  if (!input || input.length < 200) { alert('请粘贴至少200字的内容（论文摘要或正文均可）'); return; }
  var out = document.getElementById('defenseOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 正在生成答辩PPT大纲...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ module: 'defense-ppt', system_prompt: '你是答辩PPT设计专家。请根据论文内容生成一份专业的答辩PPT大纲。每页格式：页码 + 标题 + 3-5个要点 + [建议展示方式:图表/文字/流程图]。结构：封面→目录→研究背景→研究目的→文献综述→研究方法→技术路线→实验/数据→结果分析→创新点→结论→不足与展望→致谢。共15-20页。', user_prompt: '请根据以下论文内容生成答辩PPT大纲：\n\n'+input.substring(0,12000), max_tokens: 3000 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div class="ai-output">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>';
      if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'defense-ppt', title: '答辩PPT', summary: 'AI 完成' });
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; }
  });
};
