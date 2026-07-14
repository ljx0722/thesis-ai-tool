/** 答辩PPT大纲生成 */
function runDefensePPT(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div class="module-panel" style="max-width:800px;margin:0 auto">' +
    '<h4>📊 答辩PPT大纲</h4>' +
    '<div style="padding:12px;background:rgba(99,102,241,.05);border-radius:10px;margin-bottom:16px;font-size:.75rem;color:rgba(255,255,255,.5);line-height:1.7;">从论文内容自动提取核心论点，生成 <b>15-20 页答辩PPT大纲</b><br>每页包含：标题 + 3-5 个要点 + 建议展示方式</div>' +
    '<textarea id="defenseInput" placeholder="在此粘贴论文摘要或全文（越长效果越好）..." style="width:100%;height:200px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px;color:#e2e8f0;font-size:.78rem;resize:vertical;line-height:1.7;outline:none;margin-bottom:12px"></textarea>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px">' +
    '<button onclick="runDefenseAI()" style="flex:1;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.8rem;font-weight:700;cursor:pointer">🤖 生成PPT大纲</button>' +
    '<button onclick="document.getElementById(\'defenseInput\').value=\'\';document.getElementById(\'defenseOutput\').innerHTML=\'\'" style="padding:12px 16px;border:none;border-radius:10px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);font-size:.75rem;cursor:pointer">清空</button></div>' +
    '<div id="defenseOutput" style="min-height:200px"></div>' +
  '</div>';
}

window.runDefenseAI = function() {
  var input = document.getElementById('defenseInput').value.trim();
  if (!input || input.length < 200) { alert('请粘贴至少200字的内容（论文摘要或正文均可）'); return; }
  var out = document.getElementById('defenseOutput');
  out.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,.4)">⏳ 正在生成答辩PPT大纲...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ module: 'defense-ppt', system_prompt: '你是答辩PPT设计专家。请根据论文内容生成一份专业的答辩PPT大纲。每页格式：页码 + 标题 + 3-5个要点 + [建议展示方式:图表/文字/流程图]。结构：封面→目录→研究背景→研究目的→文献综述→研究方法→技术路线→实验/数据→结果分析→创新点→结论→不足与展望→致谢。共15-20页。', user_prompt: '请根据以下论文内容生成答辩PPT大纲：\n\n'+input.substring(0,12000), max_tokens: 3000 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div style="padding:16px;background:rgba(255,255,255,.03);border-radius:10px;border:1px solid rgba(255,255,255,.08);font-size:.75rem;color:#e2e8f0;line-height:1.8;white-space:pre-wrap">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div style="color:#fca5a5">❌ '+d.error+'</div>'; }
  });
};
