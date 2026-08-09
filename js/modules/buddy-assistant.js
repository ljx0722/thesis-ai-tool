/**
 * 论文搭子助手 — 上下文感知对话 + 快捷指令 + Skill 调度
 * 作为 Claude Code Skills 在前端的统一对话入口
 */
(function() {
  'use strict';

  var _messages = [];
  var _isOpen = false;

  // Quick commands — context-aware
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
    if (typeof sections !== 'undefined' && sections.length) {
      ctx.push('目录结构：' + sections.filter(function(s){return s.title;}).map(function(s){return s.title.substring(0,30);}).join(' → '));
    }
    return ctx.length ? ctx.join('\n') : null;
  }

  function toggle() {
    _isOpen = !_isOpen;
    var drawer = document.getElementById('buddyDrawer');
    var backdrop = document.getElementById('buddyBackdrop');
    if (!drawer || !backdrop) return;
    drawer.setAttribute('aria-hidden', _isOpen ? 'false' : 'true');
    drawer.style.display = _isOpen ? 'flex' : 'none';
    backdrop.style.display = _isOpen ? 'block' : 'none';
    if (_isOpen) {
      document.getElementById('buddyInput').focus();
      renderQuickCommands();
    }
  }

  function close() {
    _isOpen = false;
    var drawer = document.getElementById('buddyDrawer');
    var backdrop = document.getElementById('buddyBackdrop');
    if (drawer) { drawer.setAttribute('aria-hidden', 'true'); drawer.style.display = 'none'; }
    if (backdrop) backdrop.style.display = 'none';
  }

  function renderQuickCommands() {
    var el = document.getElementById('buddyQuickCommands');
    if (!el) return;
    var stage = getCurrentStage();
    var cmds = (QUICK_COMMANDS[stage] || QUICK_COMMANDS['any']);
    var all = QUICK_COMMANDS['any'].concat(cmds).slice(0, 6);
    el.innerHTML = all.map(function(c) {
      return '<button onclick="BuddyAssistant.quickAsk(\''+c.prompt.replace(/'/g,"\\'")+'\')" style="padding:5px 10px;border:1px solid var(--border,#e5e7eb);border-radius:14px;background:var(--bg-card,#fff);color:var(--text-secondary,#555);font-size:11px;cursor:pointer;white-space:nowrap;font-family:var(--font-sans)">'+c.label+'</button>';
    }).join('');
  }

  function quickAsk(prompt) {
    var input = document.getElementById('buddyInput');
    if (input) {
      input.value = prompt;
      askBuddyAssistant();
    }
  }

  function ask() {
    var input = document.getElementById('buddyInput');
    if (!input) return;
    var question = input.value.trim();
    if (!question) return;
    input.value = '';

    var body = document.getElementById('buddyMessages');
    if (!body) return;

    // Add user message
    _messages.push({ role: 'user', content: question });
    body.innerHTML += '<div class="buddy-msg buddy-msg-user"><div class="buddy-msg-bubble">'+esc(question)+'</div></div>';
    body.scrollTop = body.scrollHeight;

    // Add loading
    var loadingId = 'buddyLoading_' + Date.now();
    body.innerHTML += '<div class="buddy-msg buddy-msg-ai" id="'+loadingId+'"><div class="buddy-msg-bubble"><div class="ai-loading" style="padding:10px;font-size:12px">搭子思考中...</div></div></div>';
    body.scrollTop = body.scrollHeight;

    var token = sessionStorage.getItem('thesis_ai_token') || '';
    var ctx = getContext();

    fetch('/api/llm/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        messages: _messages,
        system_prompt: '你是"论文搭子"，一个专业的学术写作助手。你会根据用户当前的论文上下文提供具体、有针对性的建议。回答简洁（200字以内），如果用户需要详细分析你会主动提出。' + (ctx ? '\n\n当前上下文：\n' + ctx : ''),
        max_tokens: 800
      })
    }).then(function(r) { return r.json(); })
      .then(function(d) {
        var loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        if (d.success) {
          _messages.push({ role: 'assistant', content: d.content });
          body.innerHTML += '<div class="buddy-msg buddy-msg-ai"><div class="buddy-msg-bubble">'+d.content.replace(/</g,'&lt;')+'</div></div>';
        } else {
          body.innerHTML += '<div class="buddy-msg buddy-msg-ai"><div class="buddy-msg-bubble" style="color:#ef4444">❌ '+esc(d.error||'请求失败')+'</div></div>';
        }
        body.scrollTop = body.scrollHeight;
        if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
      }).catch(function() {
        var loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        body.innerHTML += '<div class="buddy-msg buddy-msg-ai"><div class="buddy-msg-bubble" style="color:#ef4444">❌ 网络错误，请稍后重试</div></div>';
        body.scrollTop = body.scrollHeight;
      });
  }

  // Skill dispatch: detect intent and suggest Skill
  function detectSkillIntent(question) {
    var q = question.toLowerCase();
    if (/深度.?研究|systematic.?review|系统.?回顾|文献.?综.?述|证据.?综合/.test(q)) return 'deep-research';
    if (/写.?论文|生成.?论文|纸.?写|paper.?write|初稿/.test(q)) return 'academic-paper';
    if (/审阅|审稿|review.?paper|评分|评审/.test(q)) return 'academic-paper-reviewer';
    if (/全程|全流程|pipeline|从.?研究.?到.?论文/.test(q)) return 'academic-pipeline';
    return null;
  }

  function open() {
    toggle();
  }

  // Put on window
  window.BuddyAssistant = { open: open, close: close, ask: ask, quickAsk: quickAsk, toggle: toggle };
  window.openBuddyAssistant = open;
  window.closeBuddyAssistant = close;
  window.askBuddyAssistant = ask;

  // Keyboard shortcut: Ctrl+B for buddy
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      toggle();
    }
    if (e.key === 'Escape' && _isOpen) {
      close();
    }
  });
})();
