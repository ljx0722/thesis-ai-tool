/** 查重降重 — 深度版：逐句对比 + 相似度 + 一键替换 */
function runDeduplicate(c) {
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>📋 查重降重</h4><p style="font-size:12px;color:#94a3b8;margin:4px 0 10px">查重：标记重复句式+严重程度 | 降重：逐句对照改写</p>' +
    (has ? '<div style="font-size:12px;color:#0369a1;margin-bottom:8px">📄 已读取 ' + manuscriptText.length + ' 字</div>'+
      '<textarea id="dedupInput" class="ai-textarea" style="height:120px;margin-bottom:8px">'+(manuscriptText||'').substring(0,4000)+'</textarea>'
    : '<textarea id="dedupInput" class="ai-textarea" style="height:140px;margin-bottom:8px" placeholder="粘贴需要查重或降重的内容..."></textarea>') +
    '<div style="display:flex;gap:8px;margin-bottom:12px">' +
    '<button onclick="runDedupAI(\'check\')" class="ai-btn" style="flex:1">🔍 查重检测</button>' +
    '<button onclick="runDedupAI(\'rewrite\')" class="ai-btn" style="flex:1;background:#6366f1">✍️ 智能降重</button>' +
    '<button class="ai-btn-clear" onclick="document.getElementById(\'dedupInput\').value=\'\';document.getElementById(\'dedupOutput\').innerHTML=\'\'">清空</button></div>' +
    '<div id="dedupOutput"></div></div>';
}

window._replaceText = function(text) {
  var ta = document.getElementById('dedupInput');
  if (ta) { ta.value = text; ta.focus(); }
  if (typeof ttp === 'function') ttp('已替换到输入框');
};

window.runDedupAI = function(mode) {
  var input = document.getElementById('dedupInput').value.trim();
  if (!input || input.length < 100) { alert('请粘贴至少100字或先导入论文'); return; }
  var out = document.getElementById('dedupOutput');
  out.innerHTML = '<div class="ai-loading">⏳ '+ (mode==='check'?'检测中':'改写中') +'...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  var prompt = mode === 'check'
    ? '请检测以下文本的重复问题。每处问题输出一行，格式：[严重程度] 原句 | 问题类型 | 相似度估算%\n严重程度：🔴高/🟡中/🟢低\n\n' + input.substring(0, 4000)
    : '请对以下文本进行降重改写。每句输出一行，格式：原文 | 改写后\n保持原意，更换表达方式\n\n' + input.substring(0, 4000);
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ capability_id: 'de-duplicate', input: prompt, max_tokens: 2500 })
  }).then(function(r){return r.json()}).then(function(d){
    if (!d.success) { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; return; }
    var lines = d.content.split('\n').filter(function(l){ return l.trim().length > 10; });
    if (mode === 'check') {
      var h = '<div style="margin-bottom:8px;font-size:12px;font-weight:600">查重结果：'+lines.length+'处疑似问题</div>';
      lines.forEach(function(l) {
        var sev = l.indexOf('🔴')>=0?'高':(l.indexOf('🟡')>=0?'中':'低');
        var parts = l.replace(/^\[.*?\]/,'').split('|');
        var sevBg = sev==='高'?'#fee2e2':sev==='中'?'#fef3c7':'#f0fdf4';
        var sevColor = sev==='高'?'#dc2626':sev==='中'?'#d97706':'#16a34a';
        h += '<div style="margin-bottom:8px;padding:10px;background:'+sevBg+';border-radius:8px;border:1px solid '+(sev==='高'?'#fecaca':sev==='中'?'#fde68a':'#bbf7d0')+'">'+
          '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><span style="font-size:11px;padding:1px 6px;border-radius:4px;background:'+sevColor+';color:#fff;font-weight:600">'+sev+'</span><span style="font-size:11px;color:#94a3b8">'+(parts[1]||'')+' · '+(parts[2]||'')+'</span></div>'+
          '<div style="font-size:12px;color:#555">'+(parts[0]||l).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div></div>';
      });
      out.innerHTML = h || '<div style="text-align:center;padding:20px;color:#10b981">✅ 未发现明显重复</div>';
    } else {
      var h = '<div style="margin-bottom:8px;font-size:12px;font-weight:600">逐句对照改写：</div>';
      var hasComparison = false;
      lines.forEach(function(l) {
        var parts = l.split('|');
        if (parts.length >= 2) { hasComparison = true;
          h += '<div style="margin-bottom:10px;padding:10px;background:#f8fafc;border-radius:8px;border:1px solid #f1f5f9">'+
            '<div style="font-size:12px;color:#94a3b8;margin-bottom:4px">📝 原句</div><div style="font-size:12px;color:#555;margin-bottom:6px;padding:6px;background:#fff;border-radius:4px">'+parts[0].replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div>'+
            '<div style="font-size:12px;color:#94a3b8;margin-bottom:4px">✨ 改写</div><div style="font-size:12px;color:#111;padding:6px;background:#f0f9ff;border-radius:4px;border:1px solid #bae6fd">'+parts[1].replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div>'+
            '<div style="margin-top:6px"><button class="ai-btn-clear" style="font-size:11px;padding:3px 10px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer" onclick="_replaceText(\''+parts[1].replace(/'/g,"\\'").replace(/"/g,'&quot;')+'\')">🔄 替换到输入框</button></div></div>';
        }
      });
      if (!hasComparison) h += '<div class="ai-output">'+d.content.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div>';
      out.innerHTML = h;
    }
    if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'de-duplicate', title: '查重降重', summary: (mode==='check'?'查重':'降重')+'完成' });
    if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};
