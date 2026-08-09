/**
 * 论文搭子助手 — 上下文感知对话 + 快捷指令 + Skill 调度
 * Mountable in tool panel or standalone drawer.
 */
(function() {
  'use strict';

  var _messages = [];
  var _container = null;

  var QUICK_COMMANDS = {
    any: [
      { label: '当前章节摘要', prompt: '请用3句话总结我当前正在编辑的章节。' },
      { label: '下一步建议', prompt: '基于我的论文当前状态，下一步应该做什么？给出具体建议。' },
      { label: '全文概览', prompt: '请概述我的整篇论文：主题、结构、核心论点。' }
    ],
    ideation: [
      { label: '帮我理清研究问题', prompt: '请用Socratic提问方式，帮我厘清我的研究问题。一次问一个问题，等我回答后再继续。' },
      { label: '评估选题可行性', prompt: '请从研究可行性、创新性、文献支撑三个维度评估我当前的选题。' },
      { label: '推荐理论框架', prompt: '根据我的研究方向，推荐3个适合的理论框架，并说明各自的优缺点。' }
    ],
    writing: [
      { label: '检查本节逻辑', prompt: '请逐段分析我当前章节的逻辑连贯性，指出跳跃或矛盾之处。' },
      { label: '这段需要引用', prompt: '我当前段落缺少文献支撑，请根据上下文推荐1-2篇应引用的文献。' },
      { label: '改写这一段', prompt: '请以更学术化的风格改写我当前选中的段落，保持原意。' }
    ],
    polish: [
      { label: '全面体检', prompt: '请对我的论文做全面的语言和格式检查。' },
      { label: '降重建议', prompt: '请找出论文中可能重复率较高的段落，给出改写方案。' }
    ],
    review: [
      { label: '模拟审阅', prompt: '请以期刊审稿人的视角审阅我的论文，给出评分和改进建议。' },
      { label: '答辩模拟', prompt: '请以答辩评委的身份，提出5个可能被问到的尖锐问题。' }
    ],
    defense: [
      { label: '生成答辩讲稿', prompt: '请根据我的论文，为15分钟的答辩演讲生成讲稿大纲。' },
      { label: 'PPT 大纲', prompt: '请为答辩PPT生成各页的内容大纲。' }
    ]
  };

  function getCurrentStage() {
    if (window.ThesisProject && ThesisProject.getCurrentProject) {
      var p = ThesisProject.getCurrentProject();
      if (p && p.currentStage) return p.currentStage;
    }
    return 'any';
  }

  function esc(s) { return String(s||'').replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  }); }

  function getContext() {
    var ctx = [];
    if (window.ThesisProject && ThesisProject.getCurrentProject) {
      var p = ThesisProject.getCurrentProject();
      if (p) {
        if (p.title) ctx.push('论文题目：' + p.title);
        if (p.keywords) ctx.push('关键词：' + p.keywords);
      }
    }
    if (typeof manuscriptText !== 'undefined' && manuscriptText) {
      ctx.push('论文全文已加载（' + manuscriptText.length + ' 字）');
    }
    return ctx.length ? ctx.join('\n') : null;
  }

  function render(container) {
    _container = container;
    if (!_container) return;
    var stage = getCurrentStage();
    var cmds = QUICK_COMMANDS[stage] || QUICK_COMMANDS['any'];
    var all = QUICK_COMMANDS['any'].concat(cmds).slice(0, 5);

    var h = '<div class="buddy-panel">' +
      '<div class="buddy-chat-body" id="buddyMessages">' +
        '<div class="buddy-welcome">我会优先使用当前项目、论文版本和资料证据回答；找不到依据时会明确说明。</div>' +
      '</div>' +
      '<div class="buddy-quick-row" id="buddyQuickCommands">' +
        all.map(function(c) {
          return '<button onclick="BuddyAssistant.quickAsk(\''+c.prompt.replace(/'/g,"\\'")+'\')" class="buddy-quick-btn">'+c.label+'</button>';
        }).join('') +
      '</div>' +
      '<div class="buddy-input-row">' +
        '<textarea id="buddyInput" rows="2" placeholder="例如：总结当前章节；下一步做什么；这段有证据支撑吗？"></textarea>' +
        '<button onclick="BuddyAssistant.ask()" class="ai-btn" style="padding:8px 16px;font-size:12px">发送</button>' +
      '</div>' +
      '</div>';
    _container.innerHTML = h;
    _messages = [];
  }

  function renderQuickCmds() {
    var el = document.getElementById('buddyQuickCommands');
    if (!el) return;
    var stage = getCurrentStage();
    var cmds = QUICK_COMMANDS[stage] || QUICK_COMMANDS['any'];
    var all = QUICK_COMMANDS['any'].concat(cmds).slice(0, 5);
    el.innerHTML = all.map(function(c) {
      return '<button onclick="BuddyAssistant.quickAsk(\''+c.prompt.replace(/'/g,"\\'")+'\')" class="buddy-quick-btn">'+c.label+'</button>';
    }).join('');
  }

  function quickAsk(prompt) {
    var input = document.getElementById('buddyInput');
    if (input) { input.value = prompt; }
    ask();
  }

  function ask() {
    var input = document.getElementById('buddyInput');
    if (!input) return;
    var question = input.value.trim();
    if (!question) return;
    input.value = '';

    var body = document.getElementById('buddyMessages');
    if (!body) return;

    _messages.push({ role: 'user', content: question });
    body.innerHTML += '<div class="buddy-msg buddy-msg-user"><div class="buddy-msg-bubble">'+esc(question)+'</div></div>';

    var loadingId = 'buddyLoading_' + Date.now();
    body.innerHTML += '<div class="buddy-msg buddy-msg-ai" id="'+loadingId+'"><div class="buddy-msg-bubble"><div class="ai-loading" style="padding:10px;font-size:12px">搭子思考中...</div></div></div>';
    body.scrollTop = body.scrollHeight;

    var token = sessionStorage.getItem('thesis_ai_token') || '';
    var ctx = getContext();
    fetch('/api/llm/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ messages: _messages, max_tokens: 800,
        system_prompt: '你是"论文搭子"，一个专业的学术写作助手。你会根据用户当前的论文上下文提供具体、有针对性的建议。回答简洁（200字以内），如果用户需要详细分析你会主动提出。' + (ctx ? '\n\n当前上下文：\n' + ctx : '')
      })
    }).then(function(r) { return r.json(); })
      .then(function(d) {
        var loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        if (d.success) {
          _messages.push({ role: 'assistant', content: d.content });
          body.innerHTML += '<div class="buddy-msg buddy-msg-ai"><div class="buddy-msg-bubble">'+d.content.replace(/</g,'&lt;')+'</div></div>';
        } else {
          body.innerHTML += '<div class="buddy-msg buddy-msg-ai"><div class="buddy-msg-bubble" style="color:var(--danger)">' + esc(d.error||'请求失败') + '</div></div>';
        }
        body.scrollTop = body.scrollHeight;
        if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
      }).catch(function() {
        var loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        body.innerHTML += '<div class="buddy-msg buddy-msg-ai"><div class="buddy-msg-bubble" style="color:var(--danger)">网络错误，请稍后重试</div></div>';
        body.scrollTop = body.scrollHeight;
      });
  }

  // Keyboard shortcut: Ctrl+B
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      if (typeof Nav !== 'undefined') { Nav.switchToolTab('buddy'); Nav.toggleToolPanel(); }
    }
  });

  window.BuddyAssistant = { mount: render, ask: ask, quickAsk: quickAsk, refresh: renderQuickCmds };
  window.openBuddyAssistant = function() {
    if (typeof Nav !== 'undefined') { Nav.switchToolTab('buddy'); Nav.toggleToolPanel(); }
  };
  window.askBuddyAssistant = ask;
})();
