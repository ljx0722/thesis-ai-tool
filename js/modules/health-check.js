/**
 * 论文体检 — 统一论文质量检查
 * 合并：proofread + de-duplicate + format-check + terminology + paragraph-analysis
 * 架构：轻量检查走 API，深度检查触发 Claude Code Skill
 */
var HealthCheckModule = (function() {
  'use strict';

  var CHECKS = [
    { id: 'proofread', name: '语病错字', icon: '✏️', desc: '语法错误、标点、口语化表达' },
    { id: 'de-duplicate', name: '查重降重', icon: '📋', desc: '重复率检测、改写建议' },
    { id: 'format-check', name: '格式规范', icon: '✅', desc: '标题样式、图表格式、引用格式与参考文献' },
    { id: 'terminology', name: '术语分析', icon: '🔤', desc: '术语一致性、拼写、缩写规范性' },
    { id: 'paragraph', name: '段落逻辑', icon: '📝', desc: '段落连贯性、长句检测、逻辑流畅度' }
  ];

  var _results = {};
  var _container = null;

  function esc(s) { return String(s||'').replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  }); }

  function getText() {
    if (typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 50) return manuscriptText;
    return null;
  }

  function render() {
    if (!_container) return;
    var hasText = !!getText();
    var h = '<div class="module-panel module-panel-content">';
    h += '<h4>🏥 论文体检</h4>';
    h += '<p style="font-size:12px;color:#94a3b8;margin:4px 0 12px">一键检查论文的语病、重复、格式、术语和段落逻辑问题</p>';

    // Status bar with summary
    var checkedCount = Object.keys(_results).length;
    if (checkedCount > 0) {
      var totalIssues = 0;
      CHECKS.forEach(function(c) {
        if (_results[c.id] && _results[c.id].count != null) totalIssues += _results[c.id].count;
      });
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding:12px;background:var(--surface-alt,#f3f4f6);border-radius:12px;align-items:center">';
      h += '<span style="font-size:14px;font-weight:700;color:var(--text-primary,#111)">'+checkedCount+'/'+CHECKS.length+' 项已完成</span>';
      h += '<span style="font-size:12px;color:var(--text-muted,#888)">·</span>';
      h += '<span style="font-size:14px;font-weight:700;color:'+(totalIssues===0?'#10b981':'#f59e0b')+'">'+totalIssues+' 个问题</span>';
      h += '<button class="ai-btn-clear" style="margin-left:auto;font-size:11px;padding:4px 10px" onclick="HealthCheckModule.reset()">重新检查</button>';
      h += '</div>';
    }

    if (!hasText) {
      h += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;background:var(--surface-alt,#f3f4f6);border-radius:10px;margin-bottom:12px">'+
        '📄 请先导入论文或粘贴内容。也可以：'+
        '<div style="margin-top:8px"><textarea id="healthCheckInput" class="ai-textarea" style="height:100px;margin-bottom:8px" placeholder="直接粘贴需要检查的文本..."></textarea></div>'+
        '</div>';
    } else {
      h += '<div style="font-size:12px;color:#0369a1;margin-bottom:8px;background:var(--info-bg,rgba(59,130,246,.08));padding:6px 10px;border-radius:8px">📄 已加载论文（'+getText().length+' 字）</div>';
    }

    // Check grid
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px">';
    CHECKS.forEach(function(c) {
      var isDone = !!_results[c.id];
      var result = _results[c.id];
      h += '<div style="border:1px solid '+(isDone?(result.count>0?'rgba(245,158,11,.35)':'rgba(16,185,129,.35)'):'var(--border,#e5e7eb)')+';border-radius:10px;padding:10px;cursor:pointer;transition:all .15s;background:'+(isDone?(result.count>0?'var(--warning-bg,rgba(245,158,11,.08))':'var(--success-bg,rgba(16,185,129,.08))'):'var(--bg-card,#fff)')+'" onclick="HealthCheckModule.runCheck(\''+c.id+'\')" onmouseenter="this.style.borderColor=\'var(--accent,#6366f1)\'" onmouseleave="this.style.borderColor=\''+(isDone?(result.count>0?'rgba(245,158,11,.35)':'rgba(16,185,129,.35)'):'var(--border,#e5e7eb)')+'\'">'+
        '<div style="font-size:20px;margin-bottom:4px">'+c.icon+'</div>'+
        '<div style="font-size:13px;font-weight:600;color:var(--text-primary,#111);margin-bottom:2px">'+c.name+'</div>'+
        '<div style="font-size:10px;color:var(--text-muted,#888)">'+c.desc+'</div>'+
        (isDone ? '<div style="margin-top:6px;font-size:11px;font-weight:600;color:'+(result.count>0?'#f59e0b':'#10b981')+'">'+(result.count>0?result.count+' 处问题':'✅ 通过')+'</div>' : '<div style="margin-top:6px;font-size:10px;color:#94a3b8">点击检查 →</div>')+
        '</div>';
    });
    h += '</div>';

    // Run all button
    h += '<div style="display:flex;gap:8px;margin-bottom:12px">';
    h += '<button onclick="HealthCheckModule.runAll()" class="ai-btn" style="flex:1">🔍 一键全检</button>';
    h += '<button onclick="HealthCheckModule.exportReport()" class="ai-btn-clear" style="font-size:12px" '+(checkedCount===0?'disabled':'')+'>📄 导出报告</button>';
    h += '<button onclick="HealthCheckModule.deepReview()" class="ai-btn-clear" style="font-size:12px;background:var(--accent-glow,rgba(99,102,241,.1));color:var(--accent,#6366f1);border-color:rgba(99,102,241,.25)">🔍 深度审阅</button>';
    h += '</div>';

    // Results panel
    h += '<div id="healthCheckResults" style="display:flex;flex-direction:column;gap:8px">';
    if (checkedCount > 0) {
      CHECKS.forEach(function(c) {
        if (!_results[c.id]) return;
        var r = _results[c.id];
        h += '<details style="border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--bg-card,#fff);overflow:hidden">'+
          '<summary style="padding:10px 14px;cursor:pointer;font-weight:600;font-size:13px;display:flex;align-items:center;gap:8px;list-style:none">'+
          '<span>'+c.icon+'</span><span>'+c.name+'</span>'+
          '<span style="margin-left:auto;font-size:11px;color:'+(r.count>0?'#f59e0b':'#10b981')+'">'+(r.count>0?r.count+' 处':'✅ 通过')+'</span>'+
          '</summary>'+
          '<div style="padding:0 14px 14px;font-size:12px;line-height:1.7;color:var(--text-secondary,#555)">'+(r.html||'<span style="color:#94a3b8">无详细信息</span>')+'</div>'+
          '</details>';
      });
    }
    h += '</div>';

    h += '</div>';
    _container.innerHTML = h;
  }

  function runCheck(checkId) {
    var hasText = !!getText();
    var text = hasText ? getText().substring(0, 8000) : '';
    if (!hasText) {
      var ta = document.getElementById('healthCheckInput');
      if (ta && ta.value.trim().length >= 50) text = ta.value.trim();
    }
    if (!text || text.length < 50) { alert('请先导入论文或粘贴至少50字'); return; }

    var check = CHECKS.find(function(c) { return c.id === checkId; });
    if (!check) return;

    _results[checkId] = { count: -1, html: '<div class="ai-loading">⏳ 检查中...</div>' };
    render();

    var capabilityId = checkId;
    var prompts = {
      'proofread': '请逐句检查以下论文，每发现一个问题用一行输出，格式：[类型] 原句摘录 | 问题说明 | 修改建议。类型：语法错误、标点错误、重复表达、口语化、长句建议、逻辑问题\n\n',
      'de-duplicate': '请分析以下论文的重复问题（不是逐字查重，而是分析表达重复、冗余和可降重的段落），输出格式：[重复类型] 问题描述 | 改写建议\n\n',
      'format-check': '请检查以下论文的格式规范性：标题层级是否合理、图表编号是否连续、文内引用与参考文献格式是否一致。输出格式：[格式问题] 问题描述 | 修改建议\n\n',
      'terminology': '请检查以下论文的术语使用：术语是否前后一致、拼写是否正确、缩写是否在首次出现时定义。输出格式：[术语问题] 术语名 | 问题描述 | 修改建议\n\n',
      'paragraph': '请分析以下论文的段落逻辑：段落间是否连贯、是否存在过长段落或过短段落、逻辑链条是否完整。输出格式：[段落问题] 位置描述 | 问题说明 | 优化建议\n\n'
    };

    var token = sessionStorage.getItem('thesis_ai_token') || '';
    fetch('/api/llm/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ capability_id: capabilityId, max_tokens: 2500, input: (prompts[checkId]||'') + text })
    }).then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { _results[checkId] = { count: 0, html: '<span style="color:#ef4444">❌ '+d.error+'</span>' }; render(); return; }
        var lines = d.content.split('\n').filter(function(l) { return l.trim(); });
        var h = '';
        lines.forEach(function(l) {
          h += '<div style="margin-bottom:6px;padding:8px;background:var(--surface-alt,#f3f4f6);border-radius:6px;line-height:1.6">'+l.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div>';
        });
        _results[checkId] = { count: lines.length, html: h || '<span style="color:#10b981">✅ 未发现问题</span>' };
        if (window.ThesisProject && ThesisProject.logSkillRun) ThesisProject.logSkillRun({ moduleId: checkId, title: check.name, summary: lines.length+'处' });
        if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
        render();
      }).catch(function() {
        _results[checkId] = { count: 0, html: '<span style="color:#ef4444">❌ 网络错误</span>' };
        render();
      });
  }

  function runAll() {
    _results = {};
    CHECKS.forEach(function(c, i) {
      setTimeout(function() { runCheck(c.id); }, i * 300);
    });
  }

  function deepReview() {
    // Trigger Claude Code academic-paper-reviewer Skill
    if (typeof _open === 'function') {
      _open('review');
    } else {
      alert('深度审阅功能需要 Claude Code Skills 支持。请使用 Ctrl+K 搜索"审阅"或直接在对话中说"审阅这篇论文"。');
    }
  }

  function exportReport() {
    var h = '# 论文体检报告\n\n';
    var total = 0;
    CHECKS.forEach(function(c) {
      if (!_results[c.id]) return;
      h += '## '+c.icon+' '+c.name+' ('+_results[c.id].count+' 处)\n\n';
      h += (_results[c.id].html||'').replace(/<[^>]+>/g,'') + '\n\n';
      total += _results[c.id].count;
    });
    h += '---\n总计：'+total+' 个问题\n';
    var blob = new Blob([h], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '论文体检报告_'+new Date().toISOString().substring(0,10)+'.md';
    a.click();
  }

  function reset() { _results = {}; render(); }

  return {
    mount: function(c) { _container = c; _results = {}; render(); },
    destroy: function() { _container = null; },
    refresh: render,
    runCheck: runCheck,
    runAll: runAll,
    deepReview: deepReview,
    exportReport: exportReport,
    reset: reset
  };
})();
