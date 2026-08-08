/** 选题推荐 — 深度版：AI分析+卡片结果+一键采纳 */
function runTopicFinder(c) {
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>💡 论文选题推荐</h4>' +
    '<p style="font-size:12px;color:#94a3b8;margin:4px 0 12px">输入研究方向，AI 深度分析研究热点、推荐选题并附背景与方法建议</p>' +
    '<div style="display:flex;gap:8px;margin-bottom:6px">' +
    '<input id="topicDomain" class="ai-input" placeholder="研究领域，如：海绵城市雨洪管理" style="flex:1">' +
    '<input id="topicKeywords" class="ai-input" placeholder="关键词（选填）" style="width:180px;flex-shrink:0">' +
    '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">' +
    '<button onclick="runTopicFinderAI()" class="ai-btn" style="flex:1">🤖 AI 深度选题分析</button>' +
    '<select id="topicCount" class="select" style="width:100px;font-size:12px"><option>3个</option><option selected>5个</option><option>8个</option></select>' +
    '<button class="ai-btn-clear" onclick="this.parentElement.parentElement.querySelector(\'input\').value=\'\';document.getElementById(\'topicOutput\').innerHTML=\'\'">清空</button>' +
    '</div>' +
    '<div id="topicOutput" style="margin-top:12px"></div></div>';
}

window._adoptTopic = function(title, background) {
  if (typeof ThesisProject === 'undefined' || !ThesisProject.createProject) {
    alert('项目系统未就绪'); return;
  }
  var p = ThesisProject.createProject({
    title: title, idea: background || title,
    keywords: (document.getElementById('topicKeywords')||{}).value||'',
    field: (document.getElementById('topicDomain')||{}).value||'',
    degree: '本科', mode: 'create', currentStage: 'ideation',
    schoolTemplate: 'generic'
  });
  try { ThesisProject.applySchoolTemplate('generic'); } catch(e) {}
  ThesisProject.renderProjectChrome();
  if (typeof ttp === 'function') ttp('已采纳选题：' + title);
  if (typeof _restoreWorkspace === 'function') _restoreWorkspace();
};

window.runTopicFinderAI = function() {
  var domainEl = document.getElementById('topicDomain'), kwEl = document.getElementById('topicKeywords');
  var countEl = document.getElementById('topicCount'), out = document.getElementById('topicOutput');
  var domain = (domainEl?domainEl.value.trim():''), kws = (kwEl?kwEl.value.trim():''), count = countEl?parseInt(countEl.value):5;
  if (!domain || domain.length < 2) { alert('请输入研究领域'); return; }
  out.innerHTML = '';
  var loading = document.createElement('div');loading.className = 'ai-loading';loading.textContent = 'AI 正在分析"' + domain + '"领域的研究趋势...';out.appendChild(loading);
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      capability_id: 'topic-finder', max_tokens: 3000,
      input: '请对研究领域进行深度分析。领域：'+domain+(kws?'，关键词：'+kws:'')+'。\n\n请返回'+count+'个论文选题，每个严格按以下格式输出（用"---"分隔每个选题）：\n\n选题标题\n研究背景：(100字描述研究背景与问题现状)\n核心研究问题：(一句话概括核心问题)\n建议方法：(研究方法建议)\n预期贡献：(预期学术/实践贡献)\n关键词：(3-5个关键词)'
    })
  }).then(function(r){return r.json()}).then(function(d){
    if (!d.success) { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; return; }
    var text = d.content || '';
    var topics = text.split(/---+/).filter(function(t){ return t.trim().length > 20; });
    if (!topics.length) topics = [text];
    var h = '';
    topics.forEach(function(t, i) {
      var lines = t.trim().split('\n');
      var title = lines[0] || ('选题'+(i+1));
      var bg='', q='', m='', c='', kw='';
      lines.forEach(function(l) {
        if (/研究背景[：:]/.test(l)) bg = l.replace(/.*?[：:]/,'').trim();
        else if (/核心.*问题[：:]/.test(l)) q = l.replace(/.*?[：:]/,'').trim();
        else if (/方法[：:]/.test(l)) m = l.replace(/.*?[：:]/,'').trim();
        else if (/贡献[：:]/.test(l)) c = l.replace(/.*?[：:]/,'').trim();
        else if (/关键词[：:]/.test(l)) kw = l.replace(/.*?[：:]/,'').trim();
      });
      h += '<div class="card" style="margin-bottom:12px;padding:16px;border-left:4px solid '+
        ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6','#6366f1','#ec4899','#14b8a6'][i%8]+'">'+
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">'+
        '<div style="flex:1"><div style="font-size:15px;font-weight:700;color:#111;margin-bottom:8px">'+(i+1)+'. '+title.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div>'+
        (bg?'<div style="margin-bottom:6px"><span style="font-weight:600;font-size:12px;color:#4f46e5">背景</span> <span style="font-size:12px;color:#555">'+bg.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span></div>':'')+
        (q?'<div style="margin-bottom:6px"><span style="font-weight:600;font-size:12px;color:#10b981">核心问题</span> <span style="font-size:12px;color:#555">'+q.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span></div>':'')+
        (m?'<div style="margin-bottom:6px"><span style="font-weight:600;font-size:12px;color:#f59e0b">方法</span> <span style="font-size:12px;color:#555">'+m.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span></div>':'')+
        (c?'<div style="margin-bottom:8px"><span style="font-weight:600;font-size:12px;color:#8b5cf6">贡献</span> <span style="font-size:12px;color:#555">'+c.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span></div>':'')+
        (kw?'<div style="margin-bottom:8px"><span style="font-weight:600;font-size:12px;color:#94a3b8">关键词：</span><span style="font-size:11px;color:#94a3b8">'+kw.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span></div>':'')+
        '</div>'+
        '<button class="ai-btn" style="flex-shrink:0;font-size:12px;padding:6px 14px" onclick="_adoptTopic(\''+title.replace(/'/g,"\\'").replace(/"/g,'&quot;')+'\',\''+(bg||title).replace(/'/g,"\\'").replace(/"/g,'&quot;')+'\')">✅ 采纳</button>'+
        '</div></div>';
    });
    out.innerHTML = h || '<div class="ai-output">'+text.replace(/</g,'&lt;')+'</div>';
    if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'topic-finder', title: '选题推荐', summary: domain });
    if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; })
  .finally(function(){ if(btn){btn.disabled=false;btn.textContent='🤖 AI 深度选题分析';} });
};
