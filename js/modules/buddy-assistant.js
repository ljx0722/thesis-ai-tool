/**
 * 论文搭子助手 — 上下文感知对话 + 快捷指令 + Skill 调度
 */
(function() {
  'use strict';

  var _messages = [];
  var _container = null;
  var _conversationId = '';
  var _projectId = '';

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

  function currentProject() {
    return window.ThesisProject && ThesisProject.getCurrentProject ? ThesisProject.getCurrentProject() : null;
  }

  function getCurrentStage() {
    var project = currentProject();
    return project && project.currentStage || 'any';
  }

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, function(character) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character];
    });
  }

  function authHeaders() {
    var token = sessionStorage.getItem('thesis_ai_token') || '';
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
  }

  function conversationKey(projectId) {
    var user = {};
    try { user = JSON.parse(sessionStorage.getItem('thesis_ai_user') || '{}'); } catch (e) {}
    return 'thesisbuddy_conv_' + (user.id || 'guest') + '_' + (projectId || 'none');
  }

  function loadConversationId(projectId) {
    try { return localStorage.getItem(conversationKey(projectId)) || ''; } catch (e) { return ''; }
  }

  function saveConversationId(projectId, conversationId) {
    _conversationId = conversationId || '';
    try {
      if (_conversationId) localStorage.setItem(conversationKey(projectId), _conversationId);
      else localStorage.removeItem(conversationKey(projectId));
    } catch (e) {}
  }

  function getContext() {
    var context = [];
    var project = currentProject();
    if (project) {
      if (project.title) context.push('论文题目：' + project.title);
      if (project.keywords) context.push('关键词：' + project.keywords);
    }
    if (typeof manuscriptText !== 'undefined' && manuscriptText) context.push('论文全文已加载（' + manuscriptText.length + ' 字）');
    return context.length ? context.join('\n') : null;
  }

  function renderSources(host, sources) {
    if (!host || !sources || !sources.length) return;
    var groups = {};
    sources.forEach(function(source) {
      var key = source.source_type || source.document_id || source.material_id || source.filename || source.document || '其他来源';
      if (!groups[key]) groups[key] = { name: (source.source_type === 'revision' ? '正文版本 · ' : source.source_type === 'legacy_rag' ? '项目资料 · ' : '') + (source.filename || source.document || source.source_name || '项目资料'), items: [] };
      groups[key].items.push(source);
    });
    var section = document.createElement('section');
    section.className = 'buddy-sources';
    section.setAttribute('aria-label', '回答来源');
    section.innerHTML = '<div class="buddy-sources-title">引用依据</div>' + Object.keys(groups).map(function(key) {
      var group = groups[key];
      return '<details class="buddy-source-group" open><summary>' + esc(group.name) + ' <span>' + group.items.length + ' 条</span></summary><div>' + group.items.map(function(source, index) {
        var heading = source.heading || source.section || source.chapter_id || ('片段 ' + ((source.ordinal == null ? index : source.ordinal) + 1));
        var excerpt = source.excerpt || source.quote || source.text || '';
        return '<article class="buddy-source-item"><strong>' + esc(heading) + '</strong>' + (excerpt ? '<p>' + esc(excerpt.slice(0, 500)) + '</p>' : '') + '</article>';
      }).join('') + '</div></details>';
    }).join('');
    host.appendChild(section);
  }

  function appendMessage(role, text, sources) {
    var body = document.getElementById('buddyMessages');
    if (!body) return null;
    var message = document.createElement('div');
    message.className = 'buddy-msg ' + (role === 'user' ? 'buddy-msg-user' : 'buddy-msg-ai');
    var bubble = document.createElement('div');
    bubble.className = 'buddy-msg-bubble';
    bubble.textContent = text || '';
    message.appendChild(bubble);
    renderSources(message, sources);
    body.appendChild(message);
    body.scrollTop = body.scrollHeight;
    return message;
  }

  function loadConversation(projectId, conversationId) {
    if (!projectId || !conversationId) return;
    fetch('/api/assistant/conversations/' + encodeURIComponent(conversationId), { headers: authHeaders() })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        if (!data.success || projectId !== _projectId || conversationId !== _conversationId) return;
        var body = document.getElementById('buddyMessages');
        if (!body) return;
        body.innerHTML = '';
        _messages = [];
        (data.messages || []).forEach(function(message) {
          appendMessage(message.role, message.content || '', message.sources || []);
          _messages.push({ role: message.role, content: message.content || '' });
        });
      }).catch(function() {});
  }

  function render(container) {
    _container = container;
    if (!_container) return;
    var stage = getCurrentStage();
    var commands = QUICK_COMMANDS[stage] || QUICK_COMMANDS.any;
    var all = QUICK_COMMANDS.any.concat(commands).slice(0, 5);
    _container.innerHTML = '<div class="buddy-panel">' +
      '<div class="buddy-chat-body" id="buddyMessages"><div class="buddy-welcome">我会优先使用当前项目、论文版本和资料证据回答；找不到依据时会明确说明。</div></div>' +
      '<div class="buddy-quick-row" id="buddyQuickCommands">' + all.map(function(command) {
        return '<button onclick="BuddyAssistant.quickAsk(\'' + command.prompt.replace(/'/g, "\\'") + '\')" class="buddy-quick-btn">' + command.label + '</button>';
      }).join('') + '</div>' +
      '<div class="buddy-input-row"><textarea id="buddyInput" rows="2" placeholder="例如：总结当前章节；下一步做什么；这段有证据支撑吗？"></textarea><button onclick="BuddyAssistant.ask()" class="ai-btn" style="padding:8px 16px;font-size:12px">发送</button></div></div>';
    _messages = [];
    var project = currentProject();
    _projectId = project && project.id || '';
    _conversationId = loadConversationId(_projectId);
    if (_conversationId) loadConversation(_projectId, _conversationId);
  }

  function renderQuickCmds() {
    var element = document.getElementById('buddyQuickCommands');
    if (!element) return;
    var commands = QUICK_COMMANDS[getCurrentStage()] || QUICK_COMMANDS.any;
    element.innerHTML = QUICK_COMMANDS.any.concat(commands).slice(0, 5).map(function(command) {
      return '<button onclick="BuddyAssistant.quickAsk(\'' + command.prompt.replace(/'/g, "\\'") + '\')" class="buddy-quick-btn">' + command.label + '</button>';
    }).join('');
  }

  function quickAsk(prompt) {
    var input = document.getElementById('buddyInput');
    if (input) input.value = prompt;
    ask();
  }

  function ask() {
    var input = document.getElementById('buddyInput');
    if (!input) return;
    var question = input.value.trim();
    if (!question) return;
    input.value = '';
    _messages.push({ role: 'user', content: question });
    appendMessage('user', question);
    var pending = appendMessage('assistant', '正在检索当前项目证据…');
    var pendingBubble = pending && pending.querySelector('.buddy-msg-bubble');
    var project = currentProject();
    var context = getContext();
    var request;

    if (project && project.id) {
      var revisionId = project.activeRevisionId || window._activeRevisionId || '';
      request = fetch('/api/assistant/query', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          project_id: project.id,
          question: question,
          revision_id: revisionId,
          module_id: window._activeModuleId || document.body.getAttribute('data-active-module') || '',
          conversation_id: _conversationId || undefined,
          idempotency_key: 'buddy_' + Date.now()
        })
      });
    } else {
      request = fetch('/api/llm/chat', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          messages: _messages,
          max_tokens: 800,
          system_prompt: '你是“论文搭子”，一个专业的学术写作助手。回答简洁具体；如果缺少项目证据，要明确说明。' + (context ? '\n\n当前上下文：\n' + context : '')
        })
      });
    }

    request.then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok || data.success === false) throw new Error(data.error || '请求失败');
        return data;
      });
    }).then(function(data) {
      var answer = data.answer || data.content || '没有找到可用回答';
      if (pendingBubble) pendingBubble.textContent = answer;
      renderSources(pending, data.sources || []);
      _messages.push({ role: 'assistant', content: answer });
      if (project && project.id && data.conversation_id) saveConversationId(project.id, data.conversation_id);
      if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
    }).catch(function(error) {
      if (pendingBubble) pendingBubble.textContent = '暂时无法回答：' + error.message;
    });
  }

  document.addEventListener('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      event.preventDefault();
      if (window.ThesisRouter && ThesisRouter.go) ThesisRouter.go('buddy');
    }
  });

  window.BuddyAssistant = { mount: render, ask: ask, quickAsk: quickAsk, refresh: renderQuickCmds };
  window.openBuddyAssistant = function() {
    if (window.ThesisRouter && ThesisRouter.go) return ThesisRouter.go('buddy');
  };
  window.askBuddyAssistant = ask;
})();
