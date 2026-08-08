/** 论文查错 — 深度版：逐句标注 + 错误分类 + 点击定位 */
function runProofread(c) {
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 50;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>✏️ 论文查错</h4><p style="font-size:12px;color:#94a3b8;margin:4px 0 10px">AI逐句扫描，标注语病、标点、重复、长句，可点击定位原文</p>' +
    (has ? '<div style="font-size:12px;color:#0369a1;margin-bottom:8px">📄 已读取 ' + manuscriptText.length + ' 字</div>'+
      '<select id="proofreadChapter" class="select" style="width:100%;margin-bottom:8px;font-size:12px"><option value="">全篇检查</option>' +
      (typeof sections!=='undefined'&&sections.length?sections.filter(function(s){return s.title&&typeof isBodyChapter==='function'&&isBodyChapter(s)}).map(function(s,i){return'<option value="'+i+'">'+s.title.substring(0,40)+'</option>'}).join(''):'')+'</select>'
    : '<textarea id="proofreadInput" class="ai-textarea" style="height:100px;margin-bottom:8px" placeholder="粘贴需要检查的段落..."></textarea>') +
    '<div style="display:flex;gap:8px;margin-bottom:12px"><button onclick="runProofreadAI()" class="ai-btn" style="flex:1">🤖 逐句扫描</button><button class="ai-btn-clear" onclick="document.getElementById(\'proofreadOutput\').innerHTML=\'\'">清空</button></div>' +
    '<div id="proofreadOutput"></div></div>';
}

window._jumpToProofreadSentence = function(text, idx) {
  if (typeof manuscriptText === 'undefined' || !manuscriptText) { alert('请先导入论文'); return; }
  var pos = manuscriptText.indexOf(text.substring(0, 30));
  if (pos < 0) { alert('句子定位失败，可能文本已变更'); return; }
  var tb = document.getElementById('thesisBox');
  if (tb) { tb.scrollTop = Math.max(0, pos / manuscriptText.length * tb.scrollHeight); }
  if (typeof _restoreWorkspace === 'function') _restoreWorkspace();
};

window.runProofreadAI = function() {
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 50;
  var input;
  if (has) {
    var sel = document.getElementById('proofreadChapter'), chIdx = sel ? sel.value : '';
    input = manuscriptText;
    if (chIdx && typeof sections !== 'undefined') { var s = sections[parseInt(chIdx)]; if (s && s.text) input = s.text; }
    input = input.substring(0, 8000);
  } else {
    var ta = document.getElementById('proofreadInput'); if (!ta) return; input = ta.value.trim();
  }
  if (!input || input.length < 50) { alert('请粘贴至少50字或先导入论文'); return; }
  var out = document.getElementById('proofreadOutput');
  out.innerHTML = '<div class="ai-loading">⏳ AI逐句扫描中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      capability_id: 'proofread', max_tokens: 3000,
      input: '请逐句检查以下论文，每发现一个问题用一行输出，格式严格为：\n[类型] 原句摘录 | 问题说明 | 修改建议\n类型只能是：语法错误、标点错误、重复表达、口语化、长句建议、逻辑问题\n\n' + input
    })
  }).then(function(r){return r.json()}).then(function(d){
    if (!d.success) { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; return; }
    var lines = d.content.split('\n').filter(function(l){ return /^\[/.test(l); });
    if (!lines.length) { out.innerHTML = '<div style="text-align:center;padding:20px;color:#10b981">✅ 未发现明显问题</div>'; return; }
    var stats = { '语法错误':0,'标点错误':0,'重复表达':0,'口语化':0,'长句建议':0,'逻辑问题':0 };
    var h = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
    Object.keys(stats).forEach(function(k) { stats[k] = lines.filter(function(l){return l.indexOf('['+k+']')>=0}).length; });
    Object.keys(stats).forEach(function(k) { if (stats[k] > 0) h += '<span style="font-size:11px;padding:3px 8px;border-radius:10px;background:#fef2f2;color:#dc2626;font-weight:600">'+k+' '+stats[k]+'</span>'; });
    h += '</div><div style="font-size:13px;line-height:1.7">';
    lines.forEach(function(l) {
      var parts = l.replace(/^\[/,'').split('|');
      var type = (parts[0]||'').replace(/\]/,'').trim();
      var quote = (parts[1]||'').trim();
      var detail = (parts[2]||'').trim();
      var colors = {'语法错误':'#dc2626','标点错误':'#f59e0b','重复表达':'#8b5cf6','口语化':'#ef4444','长句建议':'#3b82f6','逻辑问题':'#6366f1'};
      h += '<div style="margin-bottom:10px;padding:10px;background:#f8fafc;border-radius:8px;border:1px solid #f1f5f9"><div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">'+
        '<span style="font-size:11px;padding:1px 6px;border-radius:4px;background:'+(colors[type]||'#94a3b8')+';color:#fff;font-weight:600">'+type+'</span>'+
        '<span style="font-size:11px;color:#94a3b8">'+detail+'</span>'+'</div>'+
        '<div style="font-size:12px;color:#555;background:#fff;padding:6px 10px;border-radius:4px;border-left:3px solid '+(colors[type]||'#94a3b8')+'">'+quote.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div>'+
        (has?'<div style="margin-top:4px;font-size:11px;color:#4f46e5;cursor:pointer" onclick="_jumpToProofreadSentence(\''+quote.replace(/'/g,"\\'").replace(/"/g,'&quot;')+'\')">📍 定位原文 →</div>':'')+
        '</div>';
    });
    h += '</div><div style="margin-top:10px;display:flex;gap:8px"><button class="ai-btn-clear" style="font-size:12px;padding:5px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer" onclick="var t=this.parentElement.previousElementSibling;if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制结果</button></div>';
    out.innerHTML = h;
    if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'proofread', title: '查错', summary: lines.length+'处' });
    if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};
