/** 答辩PPT — 深度版：可编辑幻灯片列表 + 导出 */
var _defenseSlides = [];
function runDefensePPT(c) {
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 200;
  c.innerHTML = '<div class="module-panel module-panel-content">' +
    '<h4>📊 答辩PPT大纲</h4><p style="font-size:12px;color:#94a3b8;margin:4px 0 10px">从论文自动提取15-20页结构，每题可编辑标题和要点</p>' +
    (has ? '<div style="font-size:12px;color:#0369a1;margin-bottom:8px">📄 已读取 ' + manuscriptText.length + ' 字</div>' : '<textarea id="defenseInput" class="ai-textarea" style="height:100px;margin-bottom:8px" placeholder="粘贴论文摘要或全文..."></textarea>') +
    '<div style="display:flex;gap:8px;margin-bottom:12px">' +
    '<button onclick="runDefenseAI()" class="ai-btn" style="flex:1">🤖 生成PPT大纲</button>' +
    '<select id="defenseSlides" class="select" style="width:80px;font-size:12px"><option>12页</option><option selected>16页</option><option>20页</option></select>' +
    '<button class="ai-btn-clear" onclick="document.getElementById(\'defenseOutput\').innerHTML=\'\'">清空</button></div>' +
    '<div id="defenseOutput"></div></div>';
}

window._updateDefenseSlide = function(idx, field, el) {
  if (field === 'title') _defenseSlides[idx].title = el.textContent.trim();
  else _defenseSlides[idx].bullets = el.textContent.trim().split('\n').filter(Boolean);
};

function _renderDefenseSlides() {
  if (!_defenseSlides.length) return '';
  return _defenseSlides.map(function(s, i) {
    return '<div class="card" style="margin-bottom:10px;padding:14px;display:flex;gap:14px;align-items:flex-start">'+
      '<div style="width:40px;height:40px;border-radius:10px;background:#4f46e5;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0">'+(i+1)+'</div>'+
      '<div style="flex:1"><div style="font-weight:700;font-size:14px;color:#111;margin-bottom:6px" contenteditable="true" onblur="_updateDefenseSlide('+i+',\'title\',this)">'+(s.title||'幻灯片'+(i+1))+'</div>'+
      '<div style="font-size:12px;color:#555;line-height:1.7" contenteditable="true" onblur="_updateDefenseSlide('+i+',\'bullets\',this)">'+(s.bullets||['要点1','要点2','要点3']).map(function(b,j){return '• '+b;}).join('<br>')+'</div>'+
      '<div style="font-size:10px;color:#94a3b8;margin-top:4px">建议时长：'+(s.duration||'2-3')+'分钟</div></div></div>';
  }).join('');
}

window._exportDefenseSlides = function() {
  var text = _defenseSlides.map(function(s,i) {
    return '第'+(i+1)+'页：'+(s.title||'')+'\n'+(s.bullets||[]).map(function(b){return '- '+b;}).join('\n');
  }).join('\n\n');
  navigator.clipboard.writeText(text).then(function(){ if(typeof ttp==='function') ttp('已复制'+_defenseSlides.length+'页大纲'); });
};

window._downloadPPTX = function() {
  if (!_defenseSlides.length) { alert('请先生成PPT大纲'); return; }
  if (typeof PptxGenJS === 'undefined') { _exportDefenseSlides(); return; }
  try {
    var pptx = new PptxGenJS();
    pptx.defineLayout({ name:'CUSTOM', width:'13.33', height:'7.5' });
    pptx.layout = 'CUSTOM';
    _defenseSlides.forEach(function(s,i) {
      var slide = pptx.addSlide();
      slide.background = { color: i===0 ? '1E293B' : 'FFFFFF' };
      slide.addText((s.title||'幻灯片'+(i+1)), {
        x:0.8, y:0.6, w:11.7, h:1.2,
        fontSize: 24, bold: true, color: i===0 ? 'FFFFFF' : '1E293B'
      });
      if (i===0) slide.addText('论文答辩', { x:0.8, y:2.0, w:11.7, h:0.5, fontSize:14, color:'CBD5E1' });
      var bullets = s.bullets || ['要点1'];
      slide.addText(bullets.map(function(b,j){ return '• ' + b; }).join('\n'), {
        x:1.2, y:2.8, w:10.9, h:4, fontSize: 14, color: '334155', lineSpacing: 32
      });
      slide.addText(String(i+1), {
        x:12.0, y:6.8, w:1, h:0.5, fontSize:10, color:'94A3B8'
      });
    });
    pptx.writeFile({ fileName: '答辩PPT_论文搭子.pptx' }).then(function() {
      if (typeof ttp === 'function') ttp('PPTX 已下载');
    });
  } catch(e) {
    alert('PPTX 生成失败: ' + e.message + '，已复制文本大纲到剪贴板');
    _exportDefenseSlides();
  }
};

window.runDefenseAI = function() {
  var has = typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 200;
  var sc = document.getElementById('defenseSlides'), slideCount = sc?parseInt(sc.value):16;
  var input = has ? manuscriptText.substring(0, 15000) : (document.getElementById('defenseInput')||{}).value||'';
  if (!input || input.length < 200) { alert('请粘贴至少200字或先导入论文'); return; }
  var out = document.getElementById('defenseOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 生成'+slideCount+'页大纲中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ capability_id: 'defense-ppt', max_tokens: 3500,
      input: '请生成'+slideCount+'页答辩PPT大纲。按背景→方法→结果→讨论→结论组织。每页格式：标题|要点（3-5条，分号分隔）|时长（分钟）。每页一行：\n\n' + input
    })
  }).then(function(r){return r.json()}).then(function(d){
    if (!d.success) { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; return; }
    var lines = d.content.split('\n').filter(function(l){ return l.trim().length > 5; });
    _defenseSlides = [];
    lines.forEach(function(l) {
      var parts = l.split('|');
      var title = (parts[0]||'').replace(/^\d+[\.\、\s]+/,'').trim();
      var bullets = ((parts[1]||'').split(/[；;]/).filter(Boolean).length >= 2) ? (parts[1]||'').split(/[；;]/).filter(Boolean).map(function(b){return b.trim();}) : ['要点1','要点2','要点3'];
      var dur = (parts[2]||'').match(/\d+/);
      _defenseSlides.push({ title: title||'幻灯片', bullets: bullets, duration: dur?dur[0]:'2-3' });
    });
    if (!_defenseSlides.length) d.content.split('\n').filter(function(l){return l.trim().length>0}).forEach(function(l,i){
      _defenseSlides.push({ title: l.replace(/^\d+[\.\、\s]+/,'').trim(), bullets: ['要点1','要点2','要点3'], duration: '2-3' });
    });
    var h = '<div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">'+
      '<span style="font-size:12px;color:#94a3b8">生成'+_defenseSlides.length+'页 · 点击可直接编辑</span>'+
      '<button class="ai-btn" style="margin-left:auto;font-size:12px;padding:5px 12px" onclick="_downloadPPTX()">📥 下载PPTX</button>'+
      '<button class="ai-btn-clear" style="font-size:12px;padding:5px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer" onclick="_exportDefenseSlides()">📋 复制大纲</button></div>'+
      _renderDefenseSlides();
    out.innerHTML = h;
    if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'defense-ppt', title: '答辩PPT', summary: _defenseSlides.length + '页' });
    if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};
