/**
 * 开题工作台 — 统一选题 + 开题
 * 合并：topic-finder + proposal
 * 双 Tab：选题探索 | 大纲生成
 * 支持 Socratic 引导模式（→ Claude Code academic-paper plan mode）
 */
var IdeationModule = (function() {
  'use strict';

  var _container = null;
  var _activeTab = 'topics'; // 'topics' | 'outline'
  var _state = { domain: '', kws: '', topics: [], landscape: '', selectedTopic: null, outline: [] };

  function esc(s) { return String(s||'').replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  }); }

  function render() {
    if (!_container) return;
    var h = '<div class="module-panel module-panel-content">';
    h += '<h4>💡 开题工作台</h4>';
    h += '<p style="font-size:12px;color:#94a3b8;margin:4px 0 12px">探索选题方向、生成论文大纲，或开启Socratic对话引导</p>';

    // Tab bar
    h += '<div style="display:flex;gap:4px;margin-bottom:14px">';
    h += '<button onclick="IdeationModule.switchTab(\'topics\')" style="flex:1;padding:8px;border-radius:10px;border:1px solid '+
      (_activeTab==='topics'?'var(--accent,#6366f1)':'var(--border,#e5e7eb)')+
      ';background:'+(_activeTab==='topics'?'var(--accent-glow,rgba(99,102,241,.1))':'var(--bg-card,#fff)')+
      ';color:'+(_activeTab==='topics'?'var(--accent,#6366f1)':'var(--text-secondary,#555)')+
      ';font-weight:600;font-size:13px;cursor:pointer;font-family:var(--font-sans)">🔍 选题探索</button>';
    h += '<button onclick="IdeationModule.switchTab(\'outline\')" style="flex:1;padding:8px;border-radius:10px;border:1px solid '+
      (_activeTab==='outline'?'var(--accent,#6366f1)':'var(--border,#e5e7eb)')+
      ';background:'+(_activeTab==='outline'?'var(--accent-glow,rgba(99,102,241,.1))':'var(--bg-card,#fff)')+
      ';color:'+(_activeTab==='outline'?'var(--accent,#6366f1)':'var(--text-secondary,#555)')+
      ';font-weight:600;font-size:13px;cursor:pointer;font-family:var(--font-sans)">📝 大纲生成</button>';
    h += '</div>';

    // Socratic mode banner
    h += '<div style="margin-bottom:14px;padding:10px 14px;border-radius:10px;border:1px solid rgba(99,102,241,.15);background:rgba(99,102,241,.04);display:flex;align-items:center;justify-content:space-between;gap:12px">'+
      '<div><span style="font-weight:700;font-size:13px;color:var(--accent,#6366f1)">🤔 需要引导？</span><span style="font-size:11px;color:#94a3b8;margin-left:8px">Socratic对话模式：AI用提问帮你一步步理清研究思路</span></div>'+
      '<button onclick="IdeationModule.startSocratic()" style="padding:6px 14px;border-radius:8px;border:1px solid var(--accent,#6366f1);background:var(--accent,#6366f1);color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:var(--font-sans)">开始对话</button>'+
      '</div>';

    // Tab content
    h += '<div id="ideationTabContent"></div>';
    h += '</div>';
    _container.innerHTML = h;

    if (_activeTab === 'topics') renderTopicsTab();
    else renderOutlineTab();
  }

  // ── Topics Tab ──
  function renderTopicsTab() {
    var el = document.getElementById('ideationTabContent');
    if (!el) return;
    var h = '<div style="display:flex;flex-direction:column;gap:8px">'+
      '<textarea id="ideationDomain" class="agent-textarea" style="height:80px" placeholder="描述你的研究方向，越具体越好&#10;&#10;例如：研究海绵城市在南方多雨地区的应用效果，分析其对城市内涝防治的影响。">'+esc(_state.domain)+'</textarea>'+
      '<div style="display:flex;gap:8px;align-items:center">'+
        '<input id="ideationKeywords" class="agent-input" style="flex:1" placeholder="关键词（选填）" value="'+esc(_state.kws||'')+'">'+
        '<select id="ideationDepth" class="select" style="width:120px"><option>快速(5个)</option><option selected>标准(8个)</option><option>深度(12个)</option></select>'+
        '<button onclick="IdeationModule.analyzeTopics()" class="ai-btn" style="width:100px">🔍 分析</button>'+
      '</div>'+
      '<div id="ideationTopicResult"></div>'+
      '</div>';
    el.innerHTML = h;
    if (_state.topics.length > 0) renderTopicResults();
  }

  function analyzeTopics() {
    _state.domain = document.getElementById('ideationDomain').value.trim();
    _state.kws = document.getElementById('ideationKeywords').value.trim();
    var depthSel = document.getElementById('ideationDepth');
    var topicCount = depthSel ? parseInt(depthSel.value)||8 : 8;

    if (_state.domain.length < 10) { alert('请输入至少10个字描述你的研究方向'); return; }

    var el = document.getElementById('ideationTopicResult');
    el.innerHTML = '<div class="ai-loading">⏳ AI 正在分析研究领域...</div>';

    var token = sessionStorage.getItem('thesis_ai_token') || '';
    fetch('/api/llm/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        capability_id: 'topic-finder', max_tokens: 3000,
        input: '请分两步完成：\n\n第一步：分析研究领域的现状（200字内）。\n\n第二步：推荐'+topicCount+'个具体论文选题。JSON格式：[{"title":"选题标题","background":"研究背景(50字)","question":"核心研究问题","method":"建议方法","contribution":"预期贡献","keywords":"关键词","feasibility":"可行性"}]\n\n研究方向：'+_state.domain+( _state.kws ? '\n关键词：'+_state.kws : '')
      })
    }).then(function(r){return r.json()}).then(function(d) {
      if (!d.success) { el.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; return; }
      var text = d.content || '';
      var jsonIdx = text.indexOf('[');
      _state.landscape = jsonIdx > 0 ? text.substring(0, jsonIdx).trim() : text.substring(0, 200);
      try {
        var match = text.match(/\[[\s\S]*\]/);
        _state.topics = match ? JSON.parse(match[0]) : [];
      } catch(e) { _state.topics = []; }
      if (!_state.topics.length) { el.innerHTML = '<div class="ai-output-error">未能解析选题，请重试</div>'; return; }
      renderTopicResults();
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    }).catch(function() { el.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
  }

  function renderTopicResults() {
    var el = document.getElementById('ideationTopicResult');
    if (!el) return;
    var h = '<div style="margin-top:10px;padding:10px;background:var(--surface-alt,#f3f4f6);border-radius:10px;font-size:12px;line-height:1.7;color:var(--text-secondary,#555);margin-bottom:12px">'+esc(_state.landscape||'')+'</div>';
    h += '<div style="display:flex;flex-direction:column;gap:8px">';
    _state.topics.forEach(function(t, i) {
      var colors = ['#6366f1','#8b5cf6','#3b82f6','#059669','#d97706','#dc2626','#7c3aed','#0d9488'];
      h += '<div style="border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:12px;background:var(--bg-card,#fff);cursor:pointer;transition:all .15s" onclick="IdeationModule.selectTopic('+i+')" onmouseenter="this.style.borderColor=\''+(colors[i%colors.length])+'\';this.style.boxShadow=\'0 2px 8px rgba(0,0,0,.06)\'" onmouseleave="this.style.borderColor=\'var(--border,#e5e7eb)\';this.style.boxShadow=\'none\'" id="topicCard'+i+'">'+
        '<div style="display:flex;gap:8px;align-items:flex-start">'+
          '<span style="width:24px;height:24px;border-radius:6px;background:'+(colors[i%colors.length])+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">'+(i+1)+'</span>'+
          '<div style="flex:1">'+
            '<div style="font-weight:700;font-size:14px;color:var(--text-primary,#111);line-height:1.4;margin-bottom:4px">'+esc(t.title||'')+'</div>'+
            '<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">🎯 '+esc(t.question||'')+'</div>'+
            '<div style="display:flex;gap:4px;flex-wrap:wrap">'+
              (t.method?'<span style="font-size:10px;padding:2px 6px;border-radius:8px;background:rgba(59,130,246,.08);color:#3b82f6">'+esc(t.method)+'</span>':'')+
              (t.feasibility?'<span style="font-size:10px;padding:2px 6px;border-radius:8px;background:'+(t.feasibility==='高'?'rgba(16,185,129,.08)':'rgba(245,158,11,.08)')+';color:'+(t.feasibility==='高'?'#059669':'#d97706')+'">可行性:'+esc(t.feasibility)+'</span>':'')+
              (t.keywords?'<span style="font-size:10px;padding:2px 6px;border-radius:8px;background:rgba(99,102,241,.06);color:#6366f1">'+esc(t.keywords)+'</span>':'')+
            '</div>'+
          '</div>'+
        '</div>'+
        (i === _state.selectedTopic ? '<div style="margin-top:8px;display:flex;gap:6px"><button class="ai-btn" style="font-size:11px;padding:5px 10px" onclick="event.stopPropagation();IdeationModule.useTopicAsProject()">📌 设为项目选题</button></div>' : '')+
      '</div>';
    });
    h += '</div>';
    el.innerHTML = h;
  }

  function selectTopic(i) {
    _state.selectedTopic = i;
    renderTopicResults();
  }

  function useTopicAsProject() {
    var t = _state.topics[_state.selectedTopic];
    if (!t) return;
    if (window.ThesisProject && ThesisProject.createFromIdea) {
      ThesisProject.createFromIdea(t.title||'', t.keywords||'', t.method||'');
    }
    if (typeof ttp === 'function') ttp('已设为项目选题：'+(t.title||'').substring(0,30));
  }

  // ── Outline Tab ──
  function renderOutlineTab() {
    var el = document.getElementById('ideationTabContent');
    if (!el) return;

    var titleVal = '';
    var kwVal = '';
    if (window.ThesisProject && ThesisProject.getCurrentProject) {
      var p = ThesisProject.getCurrentProject();
      if (p) { titleVal = p.title||''; kwVal = p.keywords||''; }
    }
    if (!titleVal && _state.selectedTopic != null && _state.topics[_state.selectedTopic]) {
      titleVal = _state.topics[_state.selectedTopic].title||'';
      kwVal = _state.topics[_state.selectedTopic].keywords||'';
    }

    var h = '<div style="display:flex;gap:6px;margin-bottom:8px">'+
      '<button onclick="IdeationModule._outlineMode(\'scratch\')" id="ideationOutScratch" class="ai-btn" style="flex:1;font-size:12px;padding:6px">✏️ 从零生成</button>'+
      '<button onclick="IdeationModule._outlineMode(\'paste\')" id="ideationOutPaste" class="ai-btn-clear" style="flex:1;font-size:12px;padding:6px">📋 提取已有大纲</button>'+
      '</div>'+
      '<div id="ideationOutlineForm"></div>'+
      '<div id="ideationOutlineResult"></div>';

    el.innerHTML = h;
    _outlineMode('scratch');
  }

  function _outlineMode(mode) {
    document.getElementById('ideationOutScratch').className = mode==='scratch'?'ai-btn':'ai-btn-clear';
    document.getElementById('ideationOutScratch').style.cssText = 'flex:1;font-size:12px;padding:6px';
    document.getElementById('ideationOutPaste').className = mode==='paste'?'ai-btn':'ai-btn-clear';
    document.getElementById('ideationOutPaste').style.cssText = 'flex:1;font-size:12px;padding:6px';

    var el = document.getElementById('ideationOutlineForm');
    var titleVal = '';
    var kwVal = '';
    if (window.ThesisProject && ThesisProject.getCurrentProject) {
      var p = ThesisProject.getCurrentProject();
      if (p) { titleVal = p.title||''; kwVal = p.keywords||''; }
    }

    if (mode === 'scratch') {
      el.innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'+
          '<div><label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:2px">论文题目</label><input id="ideationOutTitle" class="agent-input" placeholder="输入论文题目" value="'+esc(titleVal)+'"></div>'+
          '<div><label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:2px">关键词</label><input id="ideationOutKW" class="agent-input" placeholder="逗号分隔" value="'+esc(kwVal)+'"></div>'+
        '</div>'+
        '<div style="display:flex;gap:8px;margin-bottom:8px">'+
          '<select id="ideationOutDegree" class="select" style="width:80px"><option>本科</option><option selected>硕士</option><option>博士</option></select>'+
          '<select id="ideationOutChapters" class="select" style="width:80px"><option>3章</option><option selected>5章</option><option>7章</option></select>'+
          '<button onclick="IdeationModule.generateOutline()" class="ai-btn" style="flex:1">🤖 生成大纲</button>'+
        '</div>';
    } else {
      el.innerHTML =
        '<textarea id="ideationOutPasteInput" class="agent-textarea" style="height:120px;margin-bottom:8px" placeholder="在此粘贴你的开题报告全文..."></textarea>'+
        '<button onclick="IdeationModule.extractOutline()" class="ai-btn" style="width:100%">🤖 提取大纲</button>';
    }
  }

  function generateOutline() {
    var title = document.getElementById('ideationOutTitle').value.trim();
    var kw = document.getElementById('ideationOutKW').value.trim();
    var degree = document.getElementById('ideationOutDegree').value;
    var chCount = parseInt(document.getElementById('ideationOutChapters').value)||5;
    if (!title || title.length < 4) { alert('请输入论文题目（至少4个字）'); return; }

    var resultEl = document.getElementById('ideationOutlineResult');
    resultEl.innerHTML = '<div class="ai-loading">⏳ 生成'+chCount+'章大纲中...</div>';

    var token = sessionStorage.getItem('thesis_ai_token') || '';
    fetch('/api/llm/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        capability_id: 'proposal', max_tokens: 2500,
        input: '请为以下论文生成'+chCount+'章的详细大纲（章→节），每章3-4节。严格JSON格式：\n{"outline":[{"title":"章标题","desc":"本章目标(30字)","sections":[{"title":"节标题","desc":"本节要点(20字)"}]}]}\n\n论文题目：'+title+'\n关键词：'+(kw||'无')+'\n学位：'+degree
      })
    }).then(function(r){return r.json()}).then(function(d) {
      if (!d.success) { resultEl.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; return; }
      try {
        var match = (d.content||'').match(/\{[\s\S]*\}/);
        var parsed = match ? JSON.parse(match[0]) : null;
        _state.outline = (parsed && parsed.outline) ? parsed.outline : [];
      } catch(e) { _state.outline = []; }
      if (!_state.outline.length) { resultEl.innerHTML = '<div class="ai-output-error">未能解析大纲</div>'; return; }
      renderOutlineResult();
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    }).catch(function() { resultEl.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
  }

  function extractOutline() {
    var text = document.getElementById('ideationOutPasteInput').value.trim();
    if (!text || text.length < 20) { alert('请粘贴至少20字'); return; }
    var resultEl = document.getElementById('ideationOutlineResult');
    resultEl.innerHTML = '<div class="ai-loading">⏳ 提取大纲中...</div>';
    var token = sessionStorage.getItem('thesis_ai_token') || '';
    fetch('/api/llm/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ capability_id: 'proposal', max_tokens: 2500, input: '请从以下开题报告中提取章节大纲，JSON格式：{"outline":[{"title":"章标题","desc":"本章目标","sections":[{"title":"节标题","desc":"要点"}]}]}\n\n'+text.substring(0,5000) })
    }).then(function(r){return r.json()}).then(function(d) {
      if (!d.success) { resultEl.innerHTML = '<div class="ai-output-error">❌ '+d.error+'</div>'; return; }
      try {
        var match = (d.content||'').match(/\{[\s\S]*\}/);
        var parsed = match ? JSON.parse(match[0]) : null;
        _state.outline = (parsed && parsed.outline) ? parsed.outline : [];
      } catch(e) { _state.outline = []; }
      renderOutlineResult();
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    }).catch(function() { resultEl.innerHTML = '<div class="ai-output-error">❌ 网络错误</div>'; });
  }

  function renderOutlineResult() {
    var el = document.getElementById('ideationOutlineResult');
    if (!el) return;
    var h = '<div style="margin-top:12px"><div style="font-weight:700;font-size:14px;margin-bottom:8px">📋 生成的大纲</div>';
    _state.outline.forEach(function(ch, i) {
      h += '<div style="border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:12px;margin-bottom:8px;background:var(--bg-card,#fff)">'+
        '<div style="font-weight:700;font-size:14px;color:var(--text-primary,#111);margin-bottom:4px">第'+(i+1)+'章 '+esc(ch.title||'')+'</div>'+
        '<div style="font-size:11px;color:#94a3b8;margin-bottom:8px">'+esc(ch.desc||'')+'</div>'+
        (ch.sections||[]).map(function(sec, j) {
          return '<div style="padding:4px 0;font-size:12px;color:var(--text-secondary,#555);border-bottom:1px solid var(--border-light,#f1f5f9)">'+
            '<span style="font-weight:600;margin-right:4px">'+(i+1)+'.'+(j+1)+'</span>'+esc(sec.title||'')+
            (sec.desc?' <span style="font-size:10px;color:#94a3b8">— '+esc(sec.desc)+'</span>':'')+
            '</div>';
        }).join('')+
        '</div>';
    });
    h += '<div style="display:flex;gap:8px;margin-top:8px">'+
      '<button onclick="IdeationModule.saveOutline()" class="ai-btn" style="flex:1;font-size:12px">💾 保存到项目</button>'+
      '<button class="ai-btn-clear" style="font-size:12px" onclick="var t=this.parentElement.parentElement;if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制</button>'+
      '</div></div>';
    el.innerHTML = h;
  }

  function saveOutline() {
    if (!_state.outline.length) return;
    if (window.ThesisProject && ThesisProject.saveOutline) {
      ThesisProject.saveOutline(_state.outline);
    }
    if (typeof ttp === 'function') ttp('大纲已保存');
  }

  // ── Socratic Mode ──
  function startSocratic() {
    if (typeof window._startSocraticMode === 'function') {
      window._startSocraticMode();
      return;
    }
    if (window.ThesisRouter && ThesisRouter.go) {
      ThesisRouter.go('buddy');
      var input = document.getElementById('buddyInput');
      if (input) {
        input.value = '请用Socratic对话方式引导我规划论文。我的研究方向是：' + (_state.domain || '待定');
        input.focus();
      }
      return;
    }
    alert('Socratic引导模式将在搭子助手中启动。你可以直接在对话中说："引导我规划论文"。');
  }

  // ── Public API ──
  return {
    mount: function(c) { _container = c; _state = { domain: '', kws: '', topics: [], landscape: '', selectedTopic: null, outline: [] }; _activeTab = 'topics'; render(); },
    destroy: function() { _container = null; },
    refresh: render,
    switchTab: function(tab) { _activeTab = tab; render(); },
    analyzeTopics: analyzeTopics,
    selectTopic: selectTopic,
    useTopicAsProject: useTopicAsProject,
    generateOutline: generateOutline,
    extractOutline: extractOutline,
    saveOutline: saveOutline,
    startSocratic: startSocratic,
    _outlineMode: _outlineMode
  };
})();
