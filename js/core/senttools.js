/**
 * SentenceTools v2 — 即时 AI 操作工具栏
 * 选中文字 → 点击按钮 → 直接调 AI → 结果显示在就近面板
 */
(function(){
  'use strict';

  var _toolbar = null;
  var _selectedText = '';
  var _resultPanel = null;

  function getToolbar() {
    if (!_toolbar) {
      _toolbar = document.createElement('div');
      _toolbar.id = 'sentenceToolbar';
      _toolbar.style.cssText = 'position:absolute;display:none;z-index:100;background:#1e293b;color:#fff;border-radius:10px;padding:6px 8px;box-shadow:0 8px 30px rgba(0,0,0,.3);font-size:12px;white-space:nowrap;pointer-events:auto';
      document.body.appendChild(_toolbar);
    }
    return _toolbar;
  }

  function getResultPanel() {
    if (!_resultPanel) {
      _resultPanel = document.createElement('div');
      _resultPanel.id = 'sentenceResultPanel';
      _resultPanel.style.cssText = 'position:fixed;right:0;top:48px;width:380px;max-width:92vw;height:calc(100vh-48px);background:#fff;border-left:1px solid #e2e8f0;box-shadow:-4px 0 20px rgba(0,0,0,.08);z-index:95;display:none;flex-direction:column;overflow:hidden';
      _resultPanel.innerHTML = '<div style="padding:10px 14px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0"><span id="sentPanelTitle" style="font-weight:700;font-size:13px">AI 结果</span><button onclick="document.getElementById(\'sentenceResultPanel\').style.display=\'none\'" style="border:none;background:none;font-size:16px;cursor:pointer;color:#94a3b8">&times;</button></div><div id="sentPanelBody" style="flex:1;overflow-y:auto;padding:14px;font-size:13px;line-height:1.7"></div>';
      document.body.appendChild(_resultPanel);
    }
    return _resultPanel;
  }

  function hide() {
    getToolbar().style.display = 'none';
    _selectedText = '';
  }

  function show(x, y, text) {
    _selectedText = text || '';
    var tb = getToolbar();
    var tools = [
      { id: 'proofread', label: '查错', icon: '✏️', prompt: '请逐句检查语法和标点错误，标注问题位置并给出修改建议：\n\n' },
      { id: 'rewrite', label: '改写', icon: '📝', prompt: '请用更学术化的语言改写以下内容，保持原意：\n\n' },
      { id: 'dedup', label: '降重', icon: '📋', prompt: '请在不改变原意的前提下重新表述以下内容，避免重复表达：\n\n' },
      { id: 'cite', label: '引用', icon: '📚', prompt: '以下内容在论文中缺少文献引用。请分析哪些断言需要引用支撑，建议引用方向（不需要具体文献名）：\n\n' },
    ];

    var h = '<div style="display:flex;gap:3px;align-items:center">';
    tools.forEach(function(t) {
      h += '<button onclick="event.stopPropagation();_runSentenceAction(\'' + t.id + '\')" style="border:none;background:rgba(255,255,255,.1);color:#fff;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;transition:background .1s" onmouseenter="this.style.background=\'rgba(255,255,255,.2)\'" onmouseleave="this.style.background=\'rgba(255,255,255,.1)\'">' + t.icon + ' ' + t.label + '</button>';
    });
    h += '<button onclick="event.stopPropagation();_closeSentenceToolbar()" style="border:none;background:transparent;color:rgba(255,255,255,.4);cursor:pointer;font-size:14px;padding:5px">&times;</button>';
    h += '</div>';

    tb.innerHTML = h;
    tb.style.left = Math.min(x, window.innerWidth - 420) + 'px';
    tb.style.top = Math.max(y - 50, 10) + 'px';
    tb.style.display = 'block';
  }

  // ── 即时 AI 操作 ──
  window._runSentenceAction = function(actionId) {
    var text = _selectedText;
    if (!text || text.length < 3) return;
    hide();

    var panel = getResultPanel();
    panel.style.display = 'flex';
    var title = document.getElementById('sentPanelTitle');
    var body = document.getElementById('sentPanelBody');

    var prompts = {
      'proofread': { title: '✏️ 查错结果', prompt: '请逐句检查以下文本的语法错误、标点错误和表达问题，逐条列出问题和修改建议：\n\n' + text, capability: 'proofread' },
      'rewrite': { title: '📝 改写结果', prompt: '请用更学术和专业的语言改写以下文本，输出改写后的完整文本：\n\n' + text, capability: 'expand' },
      'dedup': { title: '📋 降重结果', prompt: '请在不改变原意的前提下重新表述以下文本，降低重复率：\n\n' + text, capability: 'de-duplicate' },
      'cite': { title: '📚 引用建议', prompt: '分析以下文本中哪些陈述需要参考文献支撑，逐条指出并建议引用方向（不需要具体文献名）：\n\n' + text, capability: 'proofread' },
    };

    var cfg = prompts[actionId] || prompts['proofread'];
    if (title) title.textContent = cfg.title;
    body.innerHTML = '<div class="ai-loading">⏳ AI 分析中...</div>';

    var token = sessionStorage.getItem('thesis_ai_token') || '';
    fetch('/api/llm/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ capability_id: cfg.capability, input: cfg.prompt, max_tokens: 2000 })
    }).then(function(r){ return r.json(); }).then(function(d) {
      if (d.success) {
        body.innerHTML = '<div class="ai-output" style="white-space:pre-wrap;font-size:13px;line-height:1.7">' +
          d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
          '<div style="margin-top:10px;display:flex;gap:6px">' +
          '<button class="btn btn-ghost btn-sm" onclick="var t=this.parentElement.previousElementSibling;if(t)navigator.clipboard.writeText(t.textContent).then(function(){if(typeof ttp===\'function\')ttp(\'已复制\')})">📋 复制</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="if(typeof ThesisProject!==\'undefined\'&&ThesisProject.logSkillRun)ThesisProject.logSkillRun({moduleId:\'sent-tool\',title:\''+cfg.title+'\',summary:text.substring(0,50)})">💾 保存</button>' +
          '</div>';
        if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
      } else {
        body.innerHTML = '<div style="color:#ef4444;padding:20px">❌ ' + (d.error || 'AI 服务不可用') + '</div>';
      }
    }).catch(function() {
      body.innerHTML = '<div style="color:#ef4444;padding:20px">❌ 网络错误</div>';
    });
  };

  window._closeSentenceToolbar = function() { hide(); };

  function onThesisSelection(e) {
    var tb = document.getElementById('thesisBox');
    if (!tb) return;
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().trim().length < 3) { hide(); return; }
    var range = sel.getRangeAt(0);
    if (!tb.contains(range.commonAncestorContainer)) { hide(); return; }
    show(e.clientX, e.clientY, sel.toString().trim());
  }

  document.addEventListener('mouseup', function(e) { setTimeout(function() { onThesisSelection(e); }, 100); });
  document.addEventListener('click', function(e) { var t = getToolbar(); if (t.style.display !== 'none' && !t.contains(e.target)) hide(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hide(); });

  console.log('[TB] SentenceTools v2 ready — 4 direct AI actions.');
})();
