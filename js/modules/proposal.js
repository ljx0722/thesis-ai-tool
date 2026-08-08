/** 开题大纲 — 深度版：树形可编辑大纲 + 一键应用到项目 */
var _proposalOutline = [];
function runProposalModule(c) {
  c.innerHTML = '<div class="module-panel-content">' +
    '<h4>📝 开题大纲</h4>' +
    '<p style="font-size:12px;color:#94a3b8;margin:4px 0 10px">粘贴开题报告或研究方向，AI 生成可编辑的结构化大纲，可直接应用到论文项目</p>' +
    '<textarea id="proposalInput" class="ai-textarea" style="height:120px;margin-bottom:8px" placeholder="粘贴开题报告内容，或描述你的研究方向和论文类型..."></textarea>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px">' +
    '<button onclick="runProposalAI()" class="ai-btn" style="flex:1">🤖 生成大纲</button>' +
    '<select id="proposalChapters" class="select" style="width:100px;font-size:12px"><option>3章</option><option selected>5章</option><option>7章</option></select>' +
    '<button class="ai-btn-clear" onclick="document.getElementById(\'proposalInput\').value=\'\';document.getElementById(\'proposalOutput\').innerHTML=\'\'">清空</button></div>' +
    '<div id="proposalOutput"></div></div>';
}

window._applyOutline = function() {
  if (!_proposalOutline.length) { alert('请先生成大纲'); return; }
  if (typeof ThesisProject === 'undefined' || !ThesisProject.getCurrentProject) { alert('请先创建项目'); return; }
  var p = ThesisProject.getCurrentProject();
  if (!p) { alert('请先创建项目'); return; }
  var chapters = _proposalOutline.map(function(ch,i) {
    return { title: ch.title, sections: (ch.sections||[]).map(function(sec,j) {
      return { title: sec.title, subs: (sec.subs||[]).map(function(sub) { return { title: sub.title }; }) };
    })};
  });
  p.outline = chapters;
  p.chapters = chapters;
  ThesisProject.updateCurrent({ outline: chapters, chapters: chapters, currentStage: 'structure' });
  ThesisProject.saveOutline(chapters);
  ThesisProject.renderProjectChrome();
  if (typeof _restoreWorkspace === 'function') _restoreWorkspace();
  if (typeof ttp === 'function') ttp('大纲已应用，跳转到写作继续');
  if (typeof _openWriting === 'function') setTimeout(_openWriting, 500);
};

window._editOutlineTitle = function(chIdx, secIdx, subIdx, el) {
  var val = el.textContent.trim();
  if (subIdx >= 0) _proposalOutline[chIdx].sections[secIdx].subs[subIdx].title = val;
  else if (secIdx >= 0) _proposalOutline[chIdx].sections[secIdx].title = val;
  else _proposalOutline[chIdx].title = val;
  el.focus();
};

function _renderOutlineTree() {
  if (!_proposalOutline.length) return '';
  return _proposalOutline.map(function(ch, ci) {
    var secs = ch.sections || [];
    return '<div style="margin-bottom:10px;padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">' +
      '<div style="font-weight:700;font-size:14px;color:#111;margin-bottom:6px" contenteditable="true" onblur="_editOutlineTitle('+ci+',-1,-1,this)">' + (ch.title||'第'+(ci+1)+'章') + '</div>' +
      secs.map(function(sec, si) {
        var subs = sec.subs || [];
        return '<div style="margin-left:16px;padding:6px 0">' +
          '<div style="font-weight:600;font-size:13px;color:#333;margin-bottom:3px" contenteditable="true" onblur="_editOutlineTitle('+ci+','+si+',-1,this)">' + (si+1) + '.' + (ci+1) + ' ' + (sec.title||'节标题') + '</div>' +
          subs.map(function(sub, ui) {
            return '<div style="margin-left:20px;font-size:12px;color:#555;padding:2px 0" contenteditable="true" onblur="_editOutlineTitle('+ci+','+si+','+ui+',this)">' + (si+1) + '.' + (ci+1) + '.' + (ui+1) + ' ' + (sub.title||'小节标题') + '</div>';
          }).join('') +
        '</div>';
      }).join('') +
    '</div>';
  }).join('');
}

window.runProposalAI = function() {
  var input = document.getElementById('proposalInput').value.trim();
  var chEl = document.getElementById('proposalChapters'), chapters = chEl?parseInt(chEl.value):5;
  if (!input || input.length < 20) { alert('请粘贴至少20字的内容'); return; }
  var out = document.getElementById('proposalOutput');
  out.innerHTML = '<div class="ai-loading">⏳ 生成'+chapters+'章大纲中...</div>';
  var token = sessionStorage.getItem('thesis_ai_token');
  fetch('/api/llm/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      capability_id: 'proposal', max_tokens: 2500,
      input: '请生成'+chapters+'章的论文大纲（章→节→小节），每章3-4节，每节2-3小节。严格按JSON格式输出：\n{"outline":[{"title":"章标题","sections":[{"title":"节标题","subs":[{"title":"小节标题"}]}]}]}\n\n研究内容：\n' + input.substring(0, 8000)
    })
  }).then(function(r){return r.json()}).then(function(d){
    if (!d.success) { out.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; return; }
    try {
      var json = JSON.parse(d.content.match(/\{[\s\S]*\}/));
      _proposalOutline = json.outline || [];
    } catch(e) {
      // Fallback: parse markdown
      _proposalOutline = [];
      var lines = d.content.split('\n');
      var ch=null, sec=null;
      lines.forEach(function(l) {
        if (/^第[一二三四五六七八九十\d]+章/.test(l) || /^[#*]+\s*第/.test(l)) {
          ch = { title: l.replace(/^[#*\s\d.]+/,''), sections: [] };
          _proposalOutline.push(ch); sec = null;
        } else if (/^\d+\.\d+/.test(l) && ch) {
          sec = { title: l.replace(/^\d+\.\d+\s*/,''), subs: [] };
          ch.sections.push(sec);
        } else if (/^\d+\.\d+\.\d+/.test(l) && sec) {
          sec.subs.push({ title: l.replace(/^\d+\.\d+\.\d+\s*/,'') });
        } else if (ch && !sec) {
          ch.title += ' ' + l.trim();
        }
      });
      if (!_proposalOutline.length) _proposalOutline = [{ title: '论文大纲', sections: [] }];
    }
    var h = '<div style="margin-top:8px;font-size:12px;color:#94a3b8">✏️ 点击任何标题可直接编辑。编辑完成后点击下方按钮应用。</div>' +
      '<div style="margin:12px 0">' + _renderOutlineTree() + '</div>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="ai-btn" style="flex:1" onclick="_applyOutline()">✅ 应用大纲到项目</button>' +
      '<button class="ai-btn-clear" style="font-size:12px;padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer" onclick="var t=document.getElementById(\'proposalOutput\');if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制</button>' +
      '</div>';
    out.innerHTML = h;
    if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: 'proposal', title: '开题大纲', summary: _proposalOutline.length + '章' });
    if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
  }).catch(function(){ out.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
};
