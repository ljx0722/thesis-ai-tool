/** 选题推荐：输入领域 → AI 搜索 + 分析 → 推荐论文题目 + 大纲 */
function runTopicFinder(container) {
  var c = container || document.querySelector('.module-panel');
  if (!c) return;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>💡 论文选题推荐</h4>' +
    '<div class="ai-desc">输入你感兴趣的研究领域，AI 会分析该领域的研究热点与空白，为你推荐 <b>5 个可行论文题目</b>，每个附带大纲方向与参考文献建议。</div>' +
    '<div class="ai-input-row ai-input-row-stack">' +
      '<input id="topicDomain" class="ai-input" placeholder="研究领域（如：人工智能教育、供应链金融风险）">' +
      '<input id="topicKeywords" class="ai-input" placeholder="关键词（选填，逗号分隔）">' +
      '<button type="button" onclick="runTopicFinderAI()" class="ai-btn ai-btn-compact">开始推荐</button>' +
    '</div>' +
    '<div id="topicOutput" class="module-output-host"></div>' +
  '</div>';
}

window.runTopicFinderAI = function() {
  var domainEl = document.getElementById('topicDomain');
  var keywordsEl = document.getElementById('topicKeywords');
  var out = document.getElementById('topicOutput');
  var button = document.querySelector('button[onclick="runTopicFinderAI()"]');
  if (!domainEl || !keywordsEl || !out) return;
  var domain = domainEl.value.trim();
  var keywords = keywordsEl.value.trim();
  if (!domain || domain.length < 2) { alert('请输入研究领域'); return; }
  if (button && button.disabled) return;
  out.innerHTML = '';
  var loading = document.createElement('div');loading.className = 'ai-loading';loading.textContent = 'AI 正在分析“' + domain + '”领域的研究趋势...';out.appendChild(loading);
  if (button) { button.disabled = true; button.textContent = '分析中...'; }
  var token = sessionStorage.getItem('thesis_ai_token') || '';

  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      capability_id: 'topic-finder',
      input: '研究领域：' + domain + (keywords ? '\n关键词：' + keywords : '') + '\n\n请完成以下任务：\n1. 该领域近3年研究热点（100字）\n2. 研究空白与机会点（80字）\n3. 推荐5个论文题目（每个题目附50字简介 + 3-5个大纲方向）\n4. 每个题目建议3个最有价值的参考文献检索方向\n\n请按编号清晰列出。',
      max_tokens: 3000
    })
  }).then(function(r) {
    return r.json().catch(function(){ throw new Error('服务返回了无法解析的响应'); }).then(function(d){
      if (!r.ok || !d.success) throw new Error(d.error || ('选题推荐失败 (' + r.status + ')'));
      return d;
    });
  }).then(function(d) {
    out.innerHTML = '';
    var result = document.createElement('div');result.className = 'ai-output';result.textContent = d.content || '服务未返回推荐内容';out.appendChild(result);
    if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'topic-finder', title: '选题推荐', summary: domain });
    if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
  }).catch(function(error) {
    out.innerHTML = '';
    var errorEl = document.createElement('div');errorEl.className = 'ai-output-error';errorEl.textContent = error.message || '网络错误，请稍后重试';out.appendChild(errorEl);
  }).finally(function() {
    if (button) { button.disabled = false; button.textContent = '开始推荐'; }
  });
};
