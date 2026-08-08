/** 英文摘要 */
function runEnAbstract(container) {
  var c = container || document.querySelector('.module-panel'); if (!c) return;
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 30;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>🌐 英文摘要</h4><p style="font-size:12px;color:#94a3b8;margin:4px 0 10px">翻译模式：中文→学术英文 | 润色模式：英文→优化</p>' +
    '<div style="display:flex;gap:6px;margin-bottom:8px">' +
    '<button onclick="setEnMode(\'translate\')" id="enBtnTranslate" class="ai-btn" style="flex:1;font-size:12px;padding:6px">翻译</button>' +
    '<button onclick="setEnMode(\'polish\')" id="enBtnPolish" class="ai-btn-clear" style="flex:1;font-size:12px;padding:6px">润色</button></div>' +
    '<textarea id="enInput" class="ai-textarea" style="height:140px;margin-bottom:8px" placeholder="翻译模式：粘贴中文摘要 | 润色模式：粘贴英文摘要">' + (has ? manuscriptText.substring(0, 2000) : '') + '</textarea>' +
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
  var mode = window._enMode;
  var prompt = mode === 'translate' ? '请将以下中文摘要翻译为规范学术英文摘要：\n\n'+input.substring(0,3000) : '请润色以下英文摘要，修正语法，优化用词，符合国际期刊标准：\n\n'+input.substring(0,3000);
  var out = document.getElementById('enOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 处理中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ capability_id: 'en-abstract', input: prompt, max_tokens: 2000 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      out.innerHTML = '<div class="ai-output" style="white-space:pre-wrap;font-size:13px;line-height:1.7">'+d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'+
        '<div style="margin-top:10px"><button class="ai-btn-clear" style="font-size:12px;padding:5px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer" onclick="var t=this.parentElement.previousElementSibling;if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制</button></div>';
      if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'en-abstract', title: '英文摘要', summary: 'AI 完成' });
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    } else { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; }
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};
