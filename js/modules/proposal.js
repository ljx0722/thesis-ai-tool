/** Proposal v3 — 双模式开题大纲 */
var _proposalOutline = [];

function runProposalModule(c) {
  c.innerHTML = '<div class="module-panel-content">' +
    '<div style="display:flex;gap:6px;margin-bottom:10px">' +
    '<button onclick="_propSwitchMode(\'scratch\')" id="propModeScratch" class="ai-btn" style="flex:1;font-size:12px;padding:6px">✏️ 从零生成</button>' +
    '<button onclick="_propSwitchMode(\'paste\')" id="propModePaste" class="ai-btn-clear" style="flex:1;font-size:12px;padding:6px">📋 粘贴开题报告</button>' +
    '</div>'+
    '<div id="propModeContent"></div>'+
    '<div id="proposalOutput"></div></div>';
  _propSwitchMode('scratch');
}

// ── 模式切换 ──
window._propSwitchMode = function(mode) {
  document.getElementById('propModeScratch').className = mode==='scratch'?'ai-btn':'ai-btn-clear';
  document.getElementById('propModeScratch').style.cssText = 'flex:1;font-size:12px;padding:6px';
  document.getElementById('propModePaste').className = mode==='paste'?'ai-btn':'ai-btn-clear';
  document.getElementById('propModePaste').style.cssText = 'flex:1;font-size:12px;padding:6px';
  var el = document.getElementById('propModeContent');
  if (mode === 'scratch') {
    el.innerHTML =
      '<h4>📝 从零生成大纲</h4>'+
      '<p style="font-size:12px;color:#94a3b8;margin:4px 0 12px">输入论文题目和关键词，AI 生成完整的章节大纲</p>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'+
        '<div><label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:2px">论文题目</label><input id="propTitle" class="agent-input" placeholder="如：海绵城市雨洪管理效果评估" value="'+(typeof ThesisProject!=='undefined'&&ThesisProject.getCurrentProject?((ThesisProject.getCurrentProject()||{}).title||''):'')+'"></div>'+
        '<div><label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:2px">关键词</label><input id="propKW" class="agent-input" placeholder="逗号分隔" value="'+(typeof ThesisProject!=='undefined'&&ThesisProject.getCurrentProject?((ThesisProject.getCurrentProject()||{}).keywords||''):'')+'"></div>'+
      '</div>'+
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">'+
        '<select id="propDegree" class="select" style="width:80px"><option>本科</option><option>硕士</option><option>博士</option></select>'+
        '<select id="propChapters" class="select" style="width:80px"><option>3章</option><option selected>5章</option><option>7章</option></select>'+
        '<select id="propType" class="select" style="width:120px"><option>实证研究</option><option>理论分析</option><option>案例研究</option><option>文献综述</option><option>实验研究</option></select>'+
        '<button onclick="_propGenerate()" class="ai-btn" style="flex:1">🤖 生成大纲</button>'+
      '</div>';
  } else {
    el.innerHTML =
      '<h4>📋 从开题报告提取大纲</h4>'+
      '<p style="font-size:12px;color:#94a3b8;margin:4px 0 12px">粘贴已有的开题报告内容，AI 提取并结构化大纲</p>'+
      '<textarea id="proposalInput" class="agent-textarea" style="height:140px;margin-bottom:8px" placeholder="在此粘贴你的开题报告全文..."></textarea>'+
      '<div style="display:flex;gap:8px;margin-bottom:12px">'+
        '<button onclick="_propGeneratePaste()" class="ai-btn" style="flex:1">🤖 提取大纲</button>'+
        '<button class="ai-btn-clear" onclick="document.getElementById(\'proposalInput\').value=\'\';document.getElementById(\'proposalOutput\').innerHTML=\'\'">清空</button>'+
      '</div>';
  }
};

// ── 模式 A: 从零生成 ──
window._propGenerate = function() {
  var title = document.getElementById('propTitle').value.trim();
  var kw = document.getElementById('propKW').value.trim();
  var degree = document.getElementById('propDegree').value;
  var chCount = parseInt(document.getElementById('propChapters').value)||5;
  var pType = document.getElementById('propType').value;
  if (!title || title.length < 4) { alert('请输入论文题目（至少4个字）'); return; }
  var out = document.getElementById('proposalOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 生成'+chCount+'章大纲中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token') || '';
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      capability_id: 'proposal', max_tokens: 2500,
      input: '请为以下论文生成'+chCount+'章的详细大纲（章→节→小节），每章3-4节，每节2-3小节。严格JSON格式输出：\n{"outline":[{"title":"章标题","desc":"本章写作目标(30字)","sections":[{"title":"节标题","desc":"本节要点(20字)","subs":[{"title":"小节标题"}]}]}]}\n\n论文题目：'+title+'\n关键词：'+(kw||'无')+'\n学位：'+degree+'\n类型：'+pType
    })
  }).then(function(r){return r.json()}).then(function(d) { _renderResult(d.content, out); })
  .catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};

// ── 模式 B: 粘贴提取 ──
window._propGeneratePaste = function() {
  var input = document.getElementById('proposalInput').value.trim();
  var chEl = document.getElementById('propChapters') || {}, chCount = chEl ? (parseInt(chEl.value)||5) : 5;
  if (!input || input.length < 20) { alert('请粘贴至少20字的内容'); return; }
  var out = document.getElementById('proposalOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 提取'+chCount+'章大纲中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token') || '';
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      capability_id: 'proposal', max_tokens: 2500,
      input: '请从以下开题报告中提取论文大纲（章→节→小节），每章3-4节，每节2-3小节。严格JSON格式：\n{"outline":[{"title":"章标题","sections":[{"title":"节标题","subs":[{"title":"小节标题"}]}]}]}\n\n开题报告：\n' + input.substring(0, 8000)
    })
  }).then(function(r){return r.json()}).then(function(d) { _renderResult(d.content, out); })
  .catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};

// ── 公共渲染 ──
function _renderResult(content, out) {
  try {
    var json = JSON.parse(content.match(/\{[\s\S]*\}/));
    _proposalOutline = json.outline || [];
  } catch(e) {
    _proposalOutline = [];
    var lines = content.split('\n'), ch=null, sec=null;
    lines.forEach(function(l) {
      if (/^第[一二三四五六七八九十\d]+章/.test(l) || /^[#*]+\s*第/.test(l)) {
        ch = { title: l.replace(/^[#*\s\d.]+/,''), sections: [] };
        _proposalOutline.push(ch); sec = null;
      } else if (/^\d+\.\d+/.test(l) && ch) {
        sec = { title: l.replace(/^\d+\.\d+\s*/,''), subs: [] };
        ch.sections.push(sec);
      } else if (/^\d+\.\d+\.\d+/.test(l) && sec) {
        sec.subs.push({ title: l.replace(/^\d+\.\d+\.\d+\s*/,'') });
      } else if (ch && !sec) { ch.title += ' ' + l.trim(); }
    });
    if (!_proposalOutline.length) _proposalOutline = [{ title: '论文大纲', sections: [] }];
  }
  var h = '<div style="margin-top:8px;font-size:12px;color:#94a3b8">✏️ 点击任何标题可直接编辑</div>'+
    '<div style="margin:12px 0">' + _renderOutlineTree() + '</div>'+
    '<div style="display:flex;gap:8px">'+
    '<button class="ai-btn" style="flex:1" onclick="_applyOutline()">✅ 应用到项目</button>'+
    '<button class="ai-btn" style="flex:1" onclick="_propAddChapter()">➕ 添加章节</button>'+
    '<button class="ai-btn-clear" style="font-size:12px;padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer" onclick="var t=this.parentElement.previousElementSibling.previousElementSibling;if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制</button>'+
    '</div>';
  out.innerHTML = h;
  if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'proposal', title: '开题大纲', summary: _proposalOutline.length+'章' });
  if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
}

window._propAddChapter = function() {
  _proposalOutline.push({ title: '新章节', sections: [{ title: '节标题', subs: [{ title: '小节标题' }] }] });
  var out = document.getElementById('proposalOutput');
  out.innerHTML = '<div style="margin:12px 0">' + _renderOutlineTree() + '</div>'+
    '<div style="display:flex;gap:8px"><button class="ai-btn" style="flex:1" onclick="_applyOutline()">✅ 应用到项目</button></div>';
};

function _renderOutlineTree() {
  if (!_proposalOutline.length) return '';
  return _proposalOutline.map(function(ch, ci) {
    var secs = ch.sections || [];
    return '<div style="margin-bottom:8px;padding:10px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">' +
      '<div style="font-weight:700;font-size:14px;color:#111;margin-bottom:2px" contenteditable="true" onblur="_editOutlineTitle('+ci+',-1,-1,this)">第'+(ci+1)+'章 ' + (ch.title||'未命名') + '</div>'+
      (ch.desc?'<div style="font-size:11px;color:#94a3b8;margin-bottom:4px;padding-left:4px;border-left:2px solid #4f46e5" contenteditable="true" onblur="_editOutlineDesc('+ci+',this)">'+(ch.desc||'')+'</div>':'')+
      '<button style="font-size:10px;border:none;background:none;color:#94a3b8;cursor:pointer;margin-bottom:4px" onclick="_propDeleteChapter('+ci+')">删除本章</button>'+
      secs.map(function(sec, si) {
        var subs = sec.subs || [];
        return '<div style="margin-left:16px;padding:6px 0">' +
          '<div style="font-weight:600;font-size:13px;color:#333;margin-bottom:2px" contenteditable="true" onblur="_editOutlineTitle('+ci+','+si+',-1,this)">' + (ci+1) + '.' + (si+1) + ' ' + (sec.title||'节标题') + '</div>'+
          (sec.desc?'<div style="font-size:10px;color:#94a3b8;margin-bottom:2px;padding-left:4px" contenteditable="true" onblur="_editOutlineSecDesc('+ci+','+si+',this)">'+sec.desc+'</div>':'')+
          subs.map(function(sub, ui) {
            return '<div style="margin-left:20px;font-size:12px;color:#555;padding:2px 0" contenteditable="true" onblur="_editOutlineTitle('+ci+','+si+','+ui+',this)">' + (si+1) + '.' + (ci+1) + '.' + (ui+1) + ' ' + (sub.title||'小节标题') + '</div>';
          }).join('') +
        '</div>';
      }).join('') +
    '</div>';
  }).join('');
}

window._editOutlineTitle = function(chIdx, secIdx, subIdx, el) {
  var val = el.textContent.trim();
  if (subIdx >= 0) _proposalOutline[chIdx].sections[secIdx].subs[subIdx].title = val;
  else if (secIdx >= 0) _proposalOutline[chIdx].sections[secIdx].title = val;
  else _proposalOutline[chIdx].title = val;
  el.focus();
};
window._editOutlineDesc = function(ci, el) { _proposalOutline[ci].desc = el.textContent.trim(); };
window._editOutlineSecDesc = function(ci, si, el) { _proposalOutline[ci].sections[si].desc = el.textContent.trim(); };
window._propDeleteChapter = function(ci) { _proposalOutline.splice(ci,1); var out=document.getElementById('proposalOutput'); out.innerHTML='<div style="margin:12px 0">'+_renderOutlineTree()+'</div><div style="display:flex;gap:8px"><button class="ai-btn" style="flex:1" onclick="_applyOutline()">✅ 应用到项目</button></div>'; };
window.runProposalAI = window._propGeneratePaste; // backward compat
