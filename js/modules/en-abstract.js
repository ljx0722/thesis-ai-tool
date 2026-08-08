/** 英文摘要 — 深度版：逐句对照 + 术语一致性 */
function runEnAbstract(c) {
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 30;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>🌐 英文摘要</h4><p style="font-size:12px;color:#94a3b8;margin:4px 0 10px">翻译：中文→学术英文 | 润色：优化语法用词</p>' +
    '<div style="display:flex;gap:6px;margin-bottom:8px">' +
    '<button onclick="setEnMode(\'translate\')" id="enBtnTranslate" class="ai-btn" style="flex:1;font-size:12px;padding:6px">翻译模式</button>' +
    '<button onclick="setEnMode(\'polish\')" id="enBtnPolish" class="ai-btn-clear" style="flex:1;font-size:12px;padding:6px">润色模式</button></div>' +
    '<textarea id="enInput" class="ai-textarea" style="height:140px;margin-bottom:8px" placeholder="翻译：粘贴中文摘要 | 润色：粘贴英文摘要">'+(has?manuscriptText.substring(0,2000):'')+'</textarea>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px"><button onclick="runEnAI()" class="ai-btn" style="flex:1">🤖 开始</button><button class="ai-btn-clear" onclick="document.getElementById(\'enInput\').value=\'\';document.getElementById(\'enOutput\').innerHTML=\'\'">清空</button></div>' +
    '<div id="enOutput"></div></div>';
  window._enMode = 'translate';
}

window.setEnMode = function(m) {
  window._enMode = m;
  var tb = document.getElementById('enBtnTranslate'), pb = document.getElementById('enBtnPolish');
  if (m === 'translate') { tb.className = 'ai-btn'; tb.style.cssText = 'flex:1;font-size:12px;padding:6px'; pb.className = 'ai-btn-clear'; pb.style.cssText = 'flex:1;font-size:12px;padding:6px'; }
  else { pb.className = 'ai-btn'; pb.style.cssText = 'flex:1;font-size:12px;padding:6px'; tb.className = 'ai-btn-clear'; tb.style.cssText = 'flex:1;font-size:12px;padding:6px'; }
  document.getElementById('enInput').placeholder = m === 'translate' ? '粘贴中文摘要...' : '粘贴英文摘要...';
};

window.runEnAI = function() {
  var input = document.getElementById('enInput').value.trim();
  if (!input || input.length < 30) { alert('请粘贴至少30字'); return; }
  var mode = window._enMode, out = document.getElementById('enOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 处理中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  var prompt = mode === 'translate'
    ? '请将以下中文摘要翻译为学术英文。要求按原文逐句翻译，输出格式为每行：中文原句 | 英文翻译。最后注术语一致性建议。\n\n' + input.substring(0,3000)
    : '请润色以下英文摘要，修正语法，优化用词，符合国际期刊标准。逐句输出：原文 | 润色后。最后注术语一致性建议。\n\n' + input.substring(0,3000);
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ capability_id: 'en-abstract', input: prompt, max_tokens: 2500 })
  }).then(function(r){return r.json()}).then(function(d){
    if (!d.success) { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; return; }
    var text = d.content || '';
    var parts = text.split(/术语一致|术语建议/);
    var main = parts[0], terms = parts.length > 1 ? parts[1] : '';
    var lines = main.split('\n').filter(function(l){ return l.includes('|'); });
    if (lines.length) {
      var h = '<div style="font-size:12px;font-weight:600;margin-bottom:8px">📝 逐句对照：</div>';
      lines.forEach(function(l) {
        var pair = l.split('|');
        if (pair.length >= 2) {
          h += '<div class="card" style="margin-bottom:8px;padding:10px;display:flex;gap:10px">'+
            '<div style="flex:1"><div style="font-size:10px;color:#94a3b8;margin-bottom:3px">'+(mode==='translate'?'中文原句':'原文')+'</div><div style="font-size:12px;color:#555;line-height:1.6">'+pair[0].trim().replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div></div>'+
            '<div style="flex:1"><div style="font-size:10px;color:#94a3b8;margin-bottom:3px">'+(mode==='translate'?'英文翻译':'润色后')+'</div><div style="font-size:13px;color:#111;line-height:1.6;font-style:italic">'+pair[1].trim().replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div></div>'+
            '</div>';
        }
      });
      if (terms.trim()) h += '<div class="card" style="padding:12px;background:#fffbeb;border:1px solid #fde68a;margin-top:8px"><div style="font-size:12px;font-weight:600;margin-bottom:4px">🔤 术语一致性建议</div><div style="font-size:12px;color:#555">'+terms.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div></div>';
      out.innerHTML = h;
    } else {
      out.innerHTML = '<div class="ai-output" style="white-space:pre-wrap;font-size:13px;line-height:1.7">'+text.replace(/</g,'&lt;')+'</div>';
    }
    out.innerHTML += '<div style="margin-top:10px"><button class="ai-btn-clear" style="font-size:12px;padding:5px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer" onclick="var t=this.parentElement.previousElementSibling;if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制</button></div>';
    if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'en-abstract', title: '英文摘要', summary: mode });
    if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};
