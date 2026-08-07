/**
 * Writing Module — 写作工作台
 * 章节目录 + AI 扩写 + 草稿管理
 */
var WritingModule = (function() {
  'use strict';

  var _container = null;
  var _activeChapter = null;

  // ── 渲染 ──
  function render() {
    if (!_container) return;

    var chapters = getChapters();
    var html = '<div class="writing-root">';

    // 工具栏
    html += '<div class="writing-toolbar">' +
      '<span style="font-size:.85rem;font-weight:700">✍️ 论文写作</span>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="writing-btn-ghost" onclick="WritingModule.refresh()">刷新</button>' +
        (typeof window.openOutlineEditor === 'function' ? '<button class="writing-btn-ghost" onclick="window.openOutlineEditor()">编辑大纲</button>' : '') +
        (typeof window.mergeDraftsIntoThesis === 'function' ? '<button class="writing-btn-ghost" onclick="window.mergeDraftsIntoThesis()">合并到论文</button>' : '') +
      '</div>' +
    '</div>';

    // 章节列表
    html += '<div class="writing-chapter-list">';
    if (!chapters || !chapters.length) {
      html += '<div style="text-align:center;padding:40px;color:var(--text-muted,#888)">' +
        '<div style="font-size:2.5rem;margin-bottom:10px">📝</div>' +
        '<p>还没有章节，从想法创建大纲或导入论文</p>' +
        '<button class="ai-btn" style="margin-top:10px" onclick="typeof window.openIdeaWizard === \'function\' ? window.openIdeaWizard() : null">💡 从想法开始</button>' +
      '</div>';
    } else {
      chapters.forEach(function(ch, i) {
        var isActive = _activeChapter && _activeChapter.id === (ch.id || ch.title);
        var wordCount = ch.wordCount || (ch.content ? ch.content.length : 0);
        html += '<div class="writing-chapter-card' + (isActive ? ' active' : '') + '" onclick="WritingModule.selectChapter(\'' + (ch.id || ch.title || 'ch_' + i) + '\')">' +
          '<div class="writing-chapter-num">第' + (i + 1) + '章</div>' +
          '<div class="writing-chapter-title">' + esc(ch.title || '未命名章节') + '</div>' +
          '<div class="writing-chapter-meta">' +
            (wordCount > 0 ? '📝 ' + wordCount + ' 字' : '空章节') +
          '</div>' +
          '<div class="writing-chapter-actions">' +
            '<button class="writing-action-btn" onclick="event.stopPropagation();WritingModule.openEditor(\'' + (ch.id || ch.title || 'ch_' + i) + '\')">编辑</button>' +
            '<button class="writing-action-btn primary" onclick="event.stopPropagation();WritingModule.expandChapter(\'' + (ch.id || ch.title || 'ch_' + i) + '\')">AI扩写</button>' +
          '</div>' +
        '</div>';
      });
    }
    html += '</div>';
    html += '</div>';

    _container.innerHTML = html;
  }

  function esc(s) { return String(s||'').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function getChapters() {
    // 尝试从 ThesisProject 获取
    if (window.ThesisProject && ThesisProject.getCurrentProject) {
      try {
        var p = ThesisProject.getCurrentProject();
        if (p && p.chapters) return p.chapters;
        if (p && p.outline) {
          // 将大纲转为章节列表
          return p.outline.map(function(item, i) { return { id: 'ch_' + (i+1), title: item.title || item, content: item.content || '' }; });
        }
      } catch(e) {}
    }
    // 从全局 sections 获取
    if (typeof sections !== 'undefined' && sections.length) {
      return sections.filter(function(s) { return s.title && typeof isBodyChapter === 'function' && isBodyChapter(s); })
        .map(function(s) { return { id: s.id || s.title, title: s.title, content: s.content || '' }; });
    }
    return [];
  }

  // ── API ──
  function mount(container) {
    _container = container;
    render();
  }

  function destroy() { _container = null; _activeChapter = null; }
  function refresh() { render(); }

  function selectChapter(id) {
    _activeChapter = { id: id };
    render();
  }

  function openEditor(id) {
    if (typeof window.openChapterEditor === 'function') {
      window.openChapterEditor(id);
    } else {
      if (typeof ttp === 'function') ttp('章节编辑器将在后续版本中启用');
    }
  }

  function expandChapter(id) {
    if (typeof window.goThesisExpand === 'function') {
      window.goThesisExpand(id);
    } else {
      if (typeof ttp === 'function') ttp('AI 扩写功能将在后续版本中启用');
    }
  }

  return {
    mount: mount, destroy: destroy, refresh: refresh,
    selectChapter: selectChapter, openEditor: openEditor, expandChapter: expandChapter
  };
})();
