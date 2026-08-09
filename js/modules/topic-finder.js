/**
 * Topic Finder v3 — 深度选题探索
 * A) 领域分析 → B) 空白推荐 → C) 文献支撑 → D) 交互追问
 */
(function(){
  'use strict';
  var _state = { step: 0, domain: '', kws: '', landscape: null, topics: [], selectedTopic: null };

  function runTopicFinder(c) {
    _state = { step: 0, domain: '', kws: '', landscape: null, topics: [], selectedTopic: null };
    c.innerHTML = '<div class="module-panel module-panel-content"><div id="tfContent"></div></div>';
    _renderStep0();
  }

  // ── Step 0: 输入研究方向 ──
  function _renderStep0() {
    var el = document.getElementById('tfContent');
    el.innerHTML =
      '<h4>💡 选题探索</h4>'+
      '<p style="font-size:12px;color:#94a3b8;margin:4px 0 16px">输入研究方向，AI 分析领域现状、发现研究空白、推荐可行选题</p>'+
      '<textarea id="tfDomain" class="agent-textarea" style="height:100px;margin-bottom:8px" placeholder="描述你的研究方向，越具体越好&#10;&#10;例如：研究海绵城市在南方多雨地区的应用效果，分析其对城市内涝防治的影响。使用SWMM模型进行模拟，重点考察不同降雨强度下的排水效能。">' + (_state.domain||'') + '</textarea>'+
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">'+
        '<input id="tfKeywords" class="agent-input" style="flex:1" placeholder="关键词（选填，逗号分隔）" value="'+(_state.kws||'')+'">'+
        '<select id="tfDepth" class="select" style="width:140px">'+
          '<option>快速推荐(5个)</option><option selected>标准探索(8个)</option><option>深度分析(12个)</option>'+
        '</select>'+
        '<button class="ai-btn" style="width:120px" onclick="_tfAnalyze()">🔍 开始分析</button>'+
      '</div>'+
      '<div id="tfResult"></div>';
  }

  // ── Step 1: 领域全景分析 ──
  window._tfAnalyze = function() {
    _state.domain = document.getElementById('tfDomain').value.trim();
    _state.kws = document.getElementById('tfKeywords').value.trim();
    var depthSel = document.getElementById('tfDepth');
    _state.topicCount = depthSel ? parseInt(depthSel.value)||8 : 8;

    if (_state.domain.length < 10) { alert('请输入至少10个字描述你的研究方向'); return; }
    _state.step = 1;
    var el = document.getElementById('tfContent');
    var tbody = document.getElementById('tfResult');
    var btn = document.querySelector('button[onclick="_tfAnalyze()"]');
    if(btn){btn.disabled=true;btn.textContent='分析中...'}

    el.innerHTML = '<h4>💡 选题探索</h4>'+
      '<div style="font-size:12px;color:#4f46e5;font-weight:600;margin-bottom:2px">研究方向</div>'+
      '<div style="font-size:13px;color:#555;margin-bottom:16px;line-height:1.6">' + _state.domain.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>'+
      '<div id="tfResult"><div class="ai-loading">⏳ AI 正在分析「' + _state.domain.substring(0,30).replace(/&/g,'&amp;').replace(/</g,'&lt;') + '」领域的研究现状...</div></div>';

    var token = sessionStorage.getItem('thesis_ai_token') || '';
    fetch('/api/llm/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        capability_id: 'topic-finder', max_tokens: 3000,
        input: '请分两步完成：\n\n第一步：分析研究领域的现状（200字内）。包括：近3年研究热点、主要研究方法、代表性学者或团队。\n\n第二步：基于现状分析，推荐'+_state.topicCount+'个具体论文选题。每个选题必须包含以下字段（用JSON格式）：\n[{"title":"选题标题","background":"研究背景与现状(50字)","question":"核心研究问题","method":"建议研究方法","contribution":"预期贡献","keywords":"关键词","feasibility":"可行性评估(高/中/低)","trend":"研究趋势(上升/平稳/下降)"}]\n\n研究方向：'+_state.domain+( _state.kws ? '\n关键词：'+_state.kws : '')
      })
    }).then(function(r){return r.json()}).then(function(d) {
      if (!d.success) { document.getElementById('tfResult').innerHTML = '<div class="ai-output-error">❌ ' + d.error + '</div>'; return; }
      var text = d.content || '';
      // Split landscape analysis from topic JSON
      var jsonIdx = text.indexOf('[');
      var landscape = jsonIdx > 0 ? text.substring(0, jsonIdx).trim() : text.substring(0, 200);
      var jsonStr = jsonIdx > 0 ? text.substring(jsonIdx) : '[]';
      try {
        _state.topics = JSON.parse(jsonStr.match(/\[[\s\S]*\]/)[0]);
        _state.landscape = landscape;
      } catch(e) {
        _state.topics = [];
        _state.landscape = text;
      }
      if (!_state.topics.length) {
        document.getElementById('tfResult').innerHTML = '<div class="ai-output-error">未能解析选题，请重新输入研究方向</div>';
        return;
      }
      _renderTopics();
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    }).catch(function() {
      document.getElementById('tfResult').innerHTML = '<div class="ai-output-error">❌ 网络错误</div>';
    });
  };

  // ── 渲染选题卡片（含文献搜索） ──
  function _renderTopics() {
    var el = document.getElementById('tfContent');
    var colors = ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6','#6366f1','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7'];

    var h = '<div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">'+
      '<div style="font-size:13px;font-weight:600;color:#111;margin-bottom:4px">📊 领域全景分析</div>'+
      '<div style="font-size:12px;color:#555;line-height:1.7">' + _state.landscape.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>'+
    '</div>';

    h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">'+
      '<div style="font-size:13px;font-weight:600">📋 ' + _state.topics.length + ' 个推荐选题</div>'+
      '<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="_tfRefine()">🔍 追问细化</button>'+
      '<button class="btn btn-ghost btn-sm" onclick="_tfReset()">重新开始</button>'+
    '</div>';

    _state.topics.forEach(function(t, i) {
      var color = colors[i % colors.length];
      h += '<div class="card" style="margin-bottom:10px;border-left:4px solid '+color+';cursor:pointer" onclick="_tfSelectTopic('+i+')">'+
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'+
          '<div style="flex:1">'+
            '<div style="font-size:15px;font-weight:700;color:#111;margin-bottom:6px">'+(i+1)+'. '+(t.title||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div>'+
            (t.background ? '<div style="font-size:12px;color:#555;margin-bottom:4px;line-height:1.5">📖 ' + t.background.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>' : '')+
            (t.question ? '<div style="font-size:12px;color:#4f46e5;font-weight:600;margin-bottom:4px">❓ ' + t.question.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>' : '')+
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px;font-size:11px">'+
              (t.method ? '<span style="background:#f0f9ff;color:#0369a1;padding:2px 8px;border-radius:4px">🔬 ' + t.method.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '')+
              (t.feasibility ? '<span style="background:'+(t.feasibility.indexOf('高')>=0?'#f0fdf4':'#fef3c7')+';color:'+(t.feasibility.indexOf('高')>=0?'#16a34a':'#d97706')+';padding:2px 8px;border-radius:4px">可行性: ' + t.feasibility + '</span>' : '')+
              (t.trend ? '<span style="background:#faf5ff;color:#7c3aed;padding:2px 8px;border-radius:4px">📈 ' + t.trend + '</span>' : '')+
            '</div>'+
            (t.keywords ? '<div style="font-size:11px;color:#94a3b8">🏷 ' + t.keywords.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>' : '')+
          '</div>'+
          '<button class="ai-btn" style="flex-shrink:0" onclick="event.stopPropagation();_tfAdopt('+i+')">✅ 采纳</button>'+
        '</div>'+
      '</div>';
    });

    // 每2个选题后插入一次文献搜索按钮
    h += '<div id="tfLitSearch"></div>';
    el.innerHTML = h;
  }

  // ── 采纳选题 → 创建项目 ──
  window._tfAdopt = function(idx) {
    var t = _state.topics[idx]; if (!t) return;
    if (typeof ThesisProject === 'undefined' || !ThesisProject.createProject) { alert('项目系统未就绪'); return; }
    var p = ThesisProject.createProject({
      title: t.title || '论文项目',
      idea: t.background || _state.domain,
      keywords: t.keywords || _state.kws,
      field: _state.domain.substring(0, 30),
      degree: '本科', mode: 'create', currentStage: 'ideation',
      schoolTemplate: 'generic'
    });
    try { ThesisProject.applySchoolTemplate('generic'); } catch(e) {}
    ThesisProject.renderProjectChrome();
    if (typeof ttp === 'function') ttp('已采纳：' + (t.title||'').substring(0,40));
    if (typeof _restoreWorkspace === 'function') _restoreWorkspace();
  };

  // ── 追问细化 ──
  window._tfRefine = function() {
    var q = prompt('想了解什么方向？例如："更偏向工程应用的选题" 或 "聚焦人工智能方法的研究"', '');
    if (!q) return;
    _state.domain = _state.domain + '。重点关注：' + q;
    _renderStep0();
    setTimeout(function() {
      document.getElementById('tfDomain').value = _state.domain;
      _tfAnalyze();
    }, 100);
  };

  // ── 选题搜索文献数 ──
  window._tfSelectTopic = function(idx) {
    var t = _state.topics[idx]; if (!t) return;
    var litEl = document.getElementById('tfLitSearch');
    if (!litEl) return;
    litEl.innerHTML = '<div style="margin:12px 0;padding:12px;background:#f0f9ff;border-radius:10px;border:1px solid #bae6fd">'+
      '<div class="ai-loading" style="font-size:12px">⏳ 正在搜索「'+(t.title||'').substring(0,40).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'」相关文献...</div></div>';

    var token = sessionStorage.getItem('thesis_ai_token') || '';
    fetch('/search_api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ queries: [(t.title||'').substring(0,60)], max_per_query: 15 })
    }).then(function(r){return r.json()}).then(function(d) {
      if (d.success && d.count > 0) {
        litEl.innerHTML = '<div style="margin:12px 0;padding:12px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0">'+
          '<div style="font-size:13px;font-weight:600;margin-bottom:4px">📚 相关文献：' + d.count + ' 篇</div>'+
          '<div style="font-size:11px;color:#555">中文 ' + (d.cn||0) + ' 篇 · 英文 ' + (d.en||0) + ' 篇</div>'+
          '<div style="margin-top:8px;max-height:200px;overflow:auto">'+
            (d.results||[]).slice(0,8).map(function(r) {
              return '<div style="font-size:11px;padding:4px 0;border-bottom:1px solid #f1f5f9">📄 ' + (r.title||'').substring(0,80).replace(/&/g,'&amp;').replace(/</g,'&lt;') + ' <span style="color:#94a3b8">(' + (r.year||'') + ')</span></div>';
            }).join('') +
          '</div>'+
          '<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="_open(\'citely\')">🔍 在文献检索中查看更多</button>'+
        '</div>';
      } else {
        litEl.innerHTML = '<div style="margin:12px 0;padding:12px;background:#fef3c7;border-radius:10px;border:1px solid #fde68a;font-size:12px">📚 未找到匹配文献，建议尝试更宽泛的关键词</div>';
      }
    }).catch(function() {
      litEl.innerHTML = '<div style="margin:12px 0;padding:8px;font-size:12px;color:#94a3b8">文献搜索暂不可用</div>';
    });
  };

  window._tfReset = function() { _renderStep0(); };

  window.runTopicFinder = runTopicFinder;
})();
