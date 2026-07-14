/** 选题推荐：输入领域 → AI 搜索 + 分析 → 推荐论文题目 + 大纲 */
function runTopicFinder(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div class="module-panel" style="max-width:800px;margin:0 auto">' +
    '<h4>💡 论文选题推荐</h4>' +
    '<div style="padding:12px;background:rgba(99,102,241,.05);border-radius:10px;margin-bottom:16px;font-size:.75rem;color:rgba(255,255,255,.5);line-height:1.7">' +
    '输入你感兴趣的研究领域，AI 会分析该领域的研究热点与空白，<br>为你推荐 <b>5 个可行论文题目</b>，每个附带大纲方向与参考文献建议。<br>' +
    '消耗 <b>1 点</b>（调两次 AI：研究趋势分析 + 题目生成）</div>' +
    '<div style="display:flex;gap:10px;margin-bottom:12px">' +
      '<input id="topicDomain" placeholder="研究领域（如：人工智能教育、供应链金融风险）" style="flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 14px;color:#e2e8f0;font-size:.78rem;outline:none">' +
      '<input id="topicKeywords" placeholder="关键词（选填，逗号分隔）" style="flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 14px;color:#e2e8f0;font-size:.78rem;outline:none">' +
      '<button onclick="runTopicFinderAI()" style="padding:10px 20px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.78rem;font-weight:700;cursor:pointer;white-space:nowrap">🤖 开始推荐</button>' +
    '</div>' +
    '<div id="topicOutput" style="min-height:200px"></div>' +
  '</div>';
}

window.runTopicFinderAI = function() {
  var domain = document.getElementById('topicDomain').value.trim();
  var keywords = document.getElementById('topicKeywords').value.trim();
  if (!domain || domain.length < 2) { alert('请输入研究领域'); return; }
  var out = document.getElementById('topicOutput');
  out.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,.4)">⏳ AI 正在分析"' + domain + '"领域的研究趋势...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');

  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      module: 'topic-finder',
      system_prompt: '你是顶尖学术导师，擅长分析研究趋势并为学生推荐有创新价值的论文题目。请用中文回答，结构清晰。',
      user_prompt: '研究领域：' + domain + (keywords ? '\n关键词：' + keywords : '') + '\n\n请完成以下任务：\n1. 该领域近3年研究热点（100字）\n2. 研究空白与机会点（80字）\n3. 推荐5个论文题目（每个题目附50字简介 + 3-5个大纲方向）\n4. 每个题目建议3个最有价值的参考文献检索方向\n\n请按编号清晰列出。',
      max_tokens: 3000
    })
  }).then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        out.innerHTML = '<div style="padding:16px;background:rgba(255,255,255,.03);border-radius:10px;border:1px solid rgba(255,255,255,.08);font-size:.75rem;color:#e2e8f0;line-height:1.8;white-space:pre-wrap">' +
          d.content.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
          '<div style="text-align:right;font-size:.62rem;color:rgba(255,255,255,.25);margin-top:6px">消耗 ' + d.usage.cost_credits + ' 点 · 剩余 ' + d.usage.credits_after + ' 点</div>';
      } else { out.innerHTML = '<div style="padding:16px;background:rgba(239,68,68,.1);border-radius:10px;color:#fca5a5">❌ ' + d.error + '</div>'; }
    });
};
