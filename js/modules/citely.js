/**
 * Citely.js — 文献管理模块 (Citely-like 2-step flow)
 * 替代 literature-search-modal.js + literature-workbench.js
 *
 * 2步流程: 搜索 → 保存/引用
 * Tabs: 搜索结果 | 我的文献 | 引用地图
 */
var Citely = (function() {
  'use strict';

  // ── State ──
  var state = {
    results: [],
    saved: [],
    citations: [],
    query: '',
    loading: false,
    filters: { yearFrom: '', yearTo: '', language: 'all', maxResults: 30, sources: ['OA','CR','S2','BD'] },
    activeTab: 'results',
    projectKeywords: '',
    chapters: [],
    exportFormat: 'gbt7714'
  };

  // ── API ──
  var API = {
    search: function(query, opts) {
      return fetch('/search_api', {
        method: 'POST',
        headers: apiAuthHeaders(true),
        body: JSON.stringify({ queries: [query], max_per_query: (opts && opts.maxResults) || 30 })
      }).then(function(r) { return r.json(); });
    },
    saveToCollection: function(paper) {
      if (!paper) return;
      var saved = loadSavedPapers();
      var exists = saved.findIndex(function(p) { return (p.doi && p.doi === paper.doi) || p.title === paper.title; });
      if (exists >= 0) {
        saved[exists] = Object.assign(saved[exists], paper, { savedAt: saved[exists].savedAt || new Date().toISOString() });
      } else {
        paper.savedAt = new Date().toISOString();
        paper.tags = paper.tags || [];
        paper.notes = paper.notes || '';
        saved.push(paper);
      }
      saveSavedPapers(saved);
    },
    removeFromCollection: function(paper) {
      var saved = loadSavedPapers();
      saved = saved.filter(function(p) { return !((p.doi && paper.doi && p.doi === paper.doi) || p.title === paper.title); });
      saveSavedPapers(saved);
    },
    citeToChapter: function(paper, chapterId, chapterTitle) {
      if (!paper || !chapterId) return;
      var citations = loadCitations();
      // Dedup: same paper + same chapter
      var exists = citations.findIndex(function(c) { return c.chapterId === chapterId && ((paper.doi && c.doi === paper.doi) || c.title === paper.title); });
      if (exists < 0) {
        citations.push({
          id: 'cite_' + Date.now(),
          title: paper.title, doi: paper.doi, authors: paper.authors,
          year: paper.year, journal: paper.journal, source: paper.source,
          chapterId: chapterId, chapterTitle: chapterTitle,
          citedAt: new Date().toISOString()
        });
        saveCitations(citations);
        showToast('已引用 "' + paper.title.substring(0, 40) + '..." → ' + chapterTitle);
      }
    },
    removeCitation: function(citationId) {
      var citations = loadCitations();
      citations = citations.filter(function(c) { return c.id !== citationId; });
      saveCitations(citations);
    }
  };

  function loadSavedPapers() {
    try { return JSON.parse(localStorage.getItem('citely_saved') || '[]'); } catch(e) { return []; }
  }
  function saveSavedPapers(papers) {
    localStorage.setItem('citely_saved', JSON.stringify(papers));
  }
  function loadCitations() {
    try { return JSON.parse(localStorage.getItem('citely_citations') || '[]'); } catch(e) { return []; }
  }
  function saveCitations(citations) {
    localStorage.setItem('citely_citations', JSON.stringify(citations));
  }

  // ── Toast ──
  function showToast(msg) {
    var t = document.getElementById('citelyToast');
    if (!t) { t = document.createElement('div'); t.id = 'citelyToast'; t.className = 'citely-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer); t._timer = setTimeout(function() { t.classList.remove('show'); }, 2500);
  }

  // ── UI: Search Tab ──
  function renderSearchTab() {
    return '<div class="citely-search-area">' +
      '<div class="citely-search-bar">' +
        '<input type="text" id="citelyQuery" class="citely-search-input" placeholder="输入关键词、标题或DOI..." value="' + esc(state.query) + '">' +
        '<button class="citely-btn citely-btn-primary" onclick="Citely.doSearch()">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> 检索' +
        '</button>' +
        '<button class="citely-btn citely-btn-ghost" onclick="Citely.toggleFilters()" title="高级筛选">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>' +
        '</button>' +
      '</div>' +
      '<div id="citelyFilters" class="citely-filters" style="display:none">' +
        '<div class="citely-filter-row">' +
          '<label>年份 <input type="number" id="citelyYearFrom" placeholder="起" value="' + esc(state.filters.yearFrom) + '" class="citely-input-sm" style="width:80px"></label>' +
          '<label>至 <input type="number" id="citelyYearTo" placeholder="止" value="' + esc(state.filters.yearTo) + '" class="citely-input-sm" style="width:80px"></label>' +
          '<label>语言 <select id="citelyLanguage" class="citely-select-sm"><option value="all">全部</option><option value="zh"' + (state.filters.language==='zh'?' selected':'') + '>中文</option><option value="en"' + (state.filters.language==='en'?' selected':'') + '>英文</option></select></label>' +
          '<label>结果数 <select id="citelyMaxResults" class="citely-select-sm"><option value="20">20</option><option value="30" selected>30</option><option value="50">50</option><option value="80">80</option></select></label>' +
          '<button class="citely-btn citely-btn-sm" onclick="Citely.applyFilters()">应用</button>' +
        '</div>' +
      '</div>' +
      (state.projectKeywords ? '<div class="citely-keywords">💡 论文主题词：<span class="citely-kw-tags">' +
        state.projectKeywords.split(/[,，;；\s]+/).filter(Boolean).map(function(k) {
          return '<button class="citely-kw-tag" onclick="Citely.fillKeyword(\'' + esc(k.replace(/'/g, "\\'")) + '\')">' + esc(k) + '</button>';
        }).join('') + '</span></div>' : '') +
    '</div>' +
    (state.loading ? '<div class="citely-loading"><div class="citely-spinner"></div><span>正在检索学术数据库...</span></div>' :
     state.results.length === 0 && state.query ? '<div class="citely-empty"><div class="citely-empty-icon">📭</div><p>未找到匹配结果</p><p class="citely-empty-hint">试试更宽泛的关键词或缩短搜索词</p></div>' :
     state.results.length === 0 ? '<div class="citely-empty"><div class="citely-empty-icon">🔍</div><p>输入关键词开始检索</p><p class="citely-empty-hint">支持中文和英文关键词，可从论文主题词中选择</p></div>' :
     '<div class="citely-result-meta">找到 <b>' + state.results.length + '</b> 篇文献，按时间排序</div>' +
     '<div class="citely-result-list">' + state.results.map(renderResultCard).join('') + '</div>');
  }

  // ── UI: Result Card ──
  function renderResultCard(paper, index) {
    var saved = loadSavedPapers();
    var isSaved = saved.some(function(p) { return (p.doi && paper.doi && p.doi === paper.doi) || p.title === paper.title; });
    var sourceColors = { OA: '#10b981', CR: '#3b82f6', S2: '#8b5cf6', BD: '#f59e0b', AX: '#6366f1', PM: '#ef4444', CO: '#14b8a6', EP: '#06b6d4', DJ: '#84cc16', 'OA-CN': '#ec4899' };
    var yearColor = '';
    try { var y = parseInt(paper.year); if (y >= 2024) yearColor = '#10b981'; else if (y >= 2020) yearColor = '#3b82f6'; else yearColor = '#9ca3af'; } catch(e) {}
    var authorsShort = (paper.authors || '').split(',').slice(0, 3).join(', ') + ((paper.authors || '').split(',').length > 3 ? ' 等' : '');
    var relevance = paper._relevance || 0;
    var relevColor = relevance >= 50 ? '#10b981' : (relevance >= 25 ? '#f59e0b' : '#94a3b8');
    var hasAbstract = paper.abstract && paper.abstract.length > 10;
    var abstractPreview = hasAbstract ? paper.abstract.substring(0, 180) : '';

    return '<div class="citely-card' + (isSaved ? ' is-saved' : '') + '" data-index="' + index + '">' +
      '<div class="citely-card-body">' +
        '<div class="citely-card-title">' +
          (paper.doi ? '<a href="https://doi.org/' + esc(paper.doi) + '" target="_blank" class="citely-doi-link" title="通过DOI访问全文">📄</a> ' : '📄 ') +
          esc(paper.title) +
          (paper.year ? ' <span class="citely-year-badge" style="background:' + yearColor + '">' + esc(String(paper.year)) + '</span>' : '') +
        '</div>' +
        (authorsShort ? '<div class="citely-card-authors">👤 ' + esc(authorsShort) + '</div>' : '') +
        '<div class="citely-card-meta">' +
          (paper.journal ? '<span class="citely-journal">📰 ' + esc(paper.journal) + '</span>' : '') +
          (paper.doi ? '<span class="citely-doi">🔗 ' + esc(paper.doi) + '</span>' : '') +
        '</div>' +
        '<div class="citely-card-sources">' +
          (paper.source ? paper.source.split(/[,;]/).map(function(s) { s = s.trim(); return '<span class="citely-source-badge" style="background:' + (sourceColors[s] || '#94a3b8') + '">' + esc(s) + '</span>'; }).join('') : '') +
          (paper.citations ? '<span class="citely-cite-count">📖 被引 ' + paper.citations + ' 次</span>' : '') +
          (relevance > 0 ? '<span class="citely-cite-count" style="color:' + relevColor + ';font-weight:600">⭐ ' + relevance + '分相关</span>' : '') +
        '</div>' +
        (abstractPreview ? '<div class="citely-card-abstract" id="citelyAbs_' + index + '">' + esc(abstractPreview) + (abstractPreview.length >= 180 ? '…' : '') + '</div>' : '') +
        (hasAbstract && !paper.isCN
          ? '<button style="font-size:10px;border:none;background:none;color:#4f46e5;cursor:pointer;padding:2px 0" onclick="Citely.translateAbstract(' + index + ')">🌐 AI 中文摘要</button>'
          : '') +
      '</div>' +
      '<div class="citely-card-actions">' +
        (!isSaved
          ? '<button class="citely-action-btn citely-save" onclick="Citely.savePaper(' + index + ')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> 保存</button>'
          : '<span class="citely-saved-badge">✓ 已保存</span>') +
        '<div class="citely-cite-group">' +
          '<select class="citely-cite-select" id="citeChapter_' + index + '" onchange="Citely.citePaper(' + index + ', this.value, this.selectedOptions[0].text)">' +
            '<option value="">引用到章节...</option>' +
            state.chapters.map(function(ch) { return '<option value="' + esc(ch.id) + '">' + esc(ch.title) + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ── AI 翻译英文摘要 → 中文 ──
  function translateAbstract(index) {
    var paper = state.results[index]; if (!paper || !paper.abstract) return;
    var el = document.getElementById('citelyAbs_' + index); if (!el) return;
    el.innerHTML = '<span style="color:#94a3b8;font-style:italic">⏳ AI 翻译中...</span>';
    var token = sessionStorage.getItem('thesis_ai_token') || '';
    fetch('/api/llm/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        capability_id: 'en-abstract',
        input: '请将以下英文学术摘要翻译为中文，保持学术性：\n\n' + (paper.abstract||'').substring(0, 1000),
        max_tokens: 600
      })
    }).then(function(r){return r.json()}).then(function(d) {
      if (d.success) {
        el.innerHTML = '<div style="color:#0369a1;font-size:12px;line-height:1.6;padding:4px 0">🌐 ' + d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;').substring(0, 300) + '</div>';
      } else {
        el.innerHTML = '<span style="color:#94a3b8">翻译不可用</span>';
      }
    }).catch(function() {
      el.innerHTML = '<span style="color:#94a3b8">翻译不可用</span>';
    });
  }

  // ── UI: Saved Tab ──
  function renderSavedTab() {
    var saved = loadSavedPapers();
    if (!saved.length) return '<div class="citely-empty"><div class="citely-empty-icon">📚</div><p>还没有保存的文献</p><p class="citely-empty-hint">在搜索结果中点击"保存"将文献加入你的文献库</p></div>';
    return '<div class="citely-result-meta">已保存 <b>' + saved.length + '</b> 篇文献 | <button class="citely-btn citely-btn-sm" onclick="Citely.exportBibliography()">📋 导出参考文献</button></div>' +
      '<div class="citely-result-list">' + saved.map(function(paper, i) {
        return renderResultCard(paper, i);
      }).join('') + '</div>';
  }

  // ── UI: Citation Map Tab ──
  function renderCitationMap() {
    var citations = loadCitations();
    if (!citations.length) return '<div class="citely-empty"><div class="citely-empty-icon">🗺️</div><p>还没有引用记录</p><p class="citely-empty-hint">在文献上选择"引用到章节"建立引用关系</p></div>';
    var byChapter = {};
    citations.forEach(function(c) {
      byChapter[c.chapterTitle] = byChapter[c.chapterTitle] || [];
      byChapter[c.chapterTitle].push(c);
    });
    var html = '<div class="citely-citation-map">';
    Object.keys(byChapter).forEach(function(chTitle) {
      html += '<div class="citely-citation-chapter"><div class="citely-citation-chapter-title">📖 ' + esc(chTitle) + ' <span class="citely-cite-count-sm">' + byChapter[chTitle].length + ' 篇</span></div>';
      byChapter[chTitle].forEach(function(c) {
        html += '<div class="citely-citation-item">' +
          '<span class="citely-citation-paper">📄 ' + esc(c.title) + ' (' + esc(String(c.year || '')) + ')</span>' +
          '<button class="citely-remove-cite" onclick="Citely.removeCitation(\'' + c.id + '\')" title="移除引用">✕</button>' +
        '</div>';
      });
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="citely-export-bar"><button class="citely-btn citely-btn-primary" onclick="Citely.exportBibliography()">📋 导出参考文献 (GB/T 7714)</button></div>';
    return html;
  }

  // ── Main Render ──
  function render() {
    var container = document.getElementById('citelyContainer');
    if (!container) return;

    var html = '<div class="citely-root">';
    html += '<div class="citely-tabs">' +
      '<button class="citely-tab' + (state.activeTab === 'results' ? ' active' : '') + '" onclick="Citely.switchTab(\'results\')">' +
        '🔍 搜索结果' + (state.results.length ? ' <span class="citely-badge">' + state.results.length + '</span>' : '') +
      '</button>' +
      '<button class="citely-tab' + (state.activeTab === 'saved' ? ' active' : '') + '" onclick="Citely.switchTab(\'saved\')">' +
        '📚 我的文献' + ' <span class="citely-badge" id="citelySavedCount">' + loadSavedPapers().length + '</span>' +
      '</button>' +
      '<button class="citely-tab' + (state.activeTab === 'citationMap' ? ' active' : '') + '" onclick="Citely.switchTab(\'citationMap\')">' +
        '🗺️ 引用地图' + ' <span class="citely-badge" id="citelyCitationCount">' + loadCitations().length + '</span>' +
      '</button>' +
    '</div>';

    html += '<div class="citely-content">';
    if (state.activeTab === 'results') {
      html += renderSearchTab();
    } else if (state.activeTab === 'saved') {
      html += renderSavedTab();
    } else if (state.activeTab === 'citationMap') {
      html += renderCitationMap();
    }
    html += '</div></div>';

    container.innerHTML = html;
  }

  // ── Public API ──
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function doSearch() {
    var input = document.getElementById('citelyQuery');
    var q = input ? input.value.trim() : state.query;
    if (!q) { showToast('请输入检索关键词'); return; }
    state.query = q;
    state.loading = true;
    state.results = [];
    render();

    API.search(q, state.filters).then(function(data) {
      state.loading = false;
      if (data.success) {
        state.results = data.results || [];
        if (state.filters.language === 'zh') state.results = state.results.filter(function(r) { return r.isCN; });
        if (state.filters.language === 'en') state.results = state.results.filter(function(r) { return !r.isCN; });
        if (state.filters.yearFrom) state.results = state.results.filter(function(r) { return parseInt(r.year||0) >= parseInt(state.filters.yearFrom||0); });
        if (state.filters.yearTo) state.results = state.results.filter(function(r) { return parseInt(r.year||0) <= parseInt(state.filters.yearTo||0); });

        // AI relevance scoring: compute keyword overlap with essay topics
        if (state.results.length > 0) {
          var essayText = (typeof manuscriptText !== 'undefined' && manuscriptText ? manuscriptText : (state.projectKeywords || state.query));
          state.results.forEach(function(r) {
            var score = 0;
            var qLower = state.query.toLowerCase();
            var titleLower = (r.title||'').toLowerCase();
            if (titleLower.indexOf(qLower) >= 0) score += 40;
            var words = state.query.split(/\s+/);
            words.forEach(function(w) { if (w.length > 2 && titleLower.indexOf(w.toLowerCase()) >= 0) score += 10; });
            if (r.citations) { try { var c = parseInt(r.citations); if (c > 100) score += 15; else if (c > 10) score += 5; } catch(e) {} }
            if (r.doi) score += 5;
            r._relevance = Math.min(99, Math.max(1, score || 10));
          });
          state.results.sort(function(a, b) { return (b._relevance||0) - (a._relevance||0); });
        }
      }
      render();
    }).catch(function() {
      state.loading = false;
      render();
      showToast('检索失败，请稍后重试');
    });
  }

  function switchTab(tab) {
    state.activeTab = tab;
    if (tab === 'results') state.results = state.results; // keep results
    else if (tab === 'saved') state.saved = loadSavedPapers();
    else if (tab === 'citationMap') state.citations = loadCitations();
    render();
  }

  function toggleFilters() {
    var el = document.getElementById('citelyFilters');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }

  function applyFilters() {
    var yf = document.getElementById('citelyYearFrom');
    var yt = document.getElementById('citelyYearTo');
    var lang = document.getElementById('citelyLanguage');
    var mr = document.getElementById('citelyMaxResults');
    state.filters.yearFrom = yf ? yf.value : '';
    state.filters.yearTo = yt ? yt.value : '';
    state.filters.language = lang ? lang.value : 'all';
    state.filters.maxResults = mr ? parseInt(mr.value) : 30;
    toggleFilters();
    if (state.query) doSearch();
  }

  function fillKeyword(keyword) {
    var input = document.getElementById('citelyQuery');
    if (input) { input.value = keyword; }
    state.query = keyword;
    doSearch();
  }

  function savePaper(index) {
    var paper = state.results[index];
    if (!paper) return;
    API.saveToCollection(paper);
    render();
  }

  function citePaper(index, chapterId, chapterTitle) {
    if (!chapterId) return;
    var paper = state.results[index];
    if (!paper) {
      // Try saved tab
      var saved = loadSavedPapers();
      paper = saved[index];
    }
    if (!paper) return;
    API.citeToChapter(paper, chapterId, chapterTitle);
    var sel = document.getElementById('citeChapter_' + index);
    if (sel) sel.value = '';
    render();
  }

  function removeCitation(id) {
    API.removeCitation(id);
    state.citations = loadCitations();
    render();
  }

  function exportBibliography() {
    var citations = loadCitations();
    var saved = loadSavedPapers();
    var allPapers = citations.slice();
    saved.forEach(function(p) {
      var exists = allPapers.some(function(c) { return (p.doi && c.doi === p.doi) || p.title === c.title; });
      if (!exists) allPapers.push(p);
    });

    if (!allPapers.length) { showToast('没有可导出的文献'); return; }

    // Detect format preference from state
    var fmt = state.exportFormat || 'gbt7714';
    var lines = [];
    if (fmt === 'gbt7714') {
      lines = allPapers.map(function(p, i) {
        var authors = (p.authors || '佚名').split(',').slice(0, 3).join(', ');
        if ((p.authors||'').split(',').length > 3) authors += ', 等';
        return '[' + (i+1) + '] ' + authors + '. ' + (p.title || '') +
          '[J]. ' + (p.journal || '未知期刊') + ', ' + (p.year || '') +
          (p.doi ? '. DOI:' + p.doi : '') + '.';
      });
    } else if (fmt === 'apa') {
      lines = allPapers.map(function(p, i) {
        var authors = (p.authors || 'Anonymous').split(',').map(function(a){ return a.trim().split(' ').pop(); }).slice(0, 3).join(', ');
        if ((p.authors||'').split(',').length > 3) authors += ', et al.';
        return authors + ' (' + (p.year||'n.d.') + '). ' + (p.title||'Untitled') + '. *' +
          (p.journal||'Unknown Journal') + '*' + (p.doi ? '. https://doi.org/'+p.doi : '') + '.';
      });
    } else if (fmt === 'bibtex') {
      lines = allPapers.map(function(p, i) {
        var author = (p.authors||'anonymous').split(',')[0].trim().split(' ').pop().toLowerCase();
        var key = author + (p.year||'') + (p.title||'').split(' ')[0].toLowerCase();
        return '@article{' + key + ',\n  title={' + (p.title||'') + '},\n  author={' + (p.authors||'佚名') + '},\n  journal={' + (p.journal||'') + '},\n  year={' + (p.year||'') + '}' +
          (p.doi ? ',\n  doi={' + p.doi + '}' : '') + '\n}';
      });
    }

    var text = lines.join(fmt==='bibtex'?'\n\n':'\n');

    // Show format selector + copy
    var modalId = 'citelyExport_' + Date.now();
    var html = '<div style="padding:14px">'+
      '<div style="display:flex;gap:6px;margin-bottom:12px">'+
        ['gbt7714','apa','bibtex'].map(function(f) {
          return '<button class="'+(f===fmt?'ai-btn':'ai-btn-clear')+'" style="font-size:12px;padding:5px 12px" onclick="var s=window.Citely.getState?Citely.getState():null;if(s)s.exportFormat=\''+f+'\';Citely.exportBibliography();var el=document.getElementById(\''+modalId+'\');if(el)el.remove()">' + (f==='gbt7714'?'GB/T 7714':f==='apa'?'APA 7th':'BibTeX') + '</button>';
        }).join('') +
      '</div>'+
      '<textarea readonly style="width:100%;height:300px;font-family:monospace;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;resize:vertical">' + text + '</textarea>'+
      '<div style="margin-top:8px;display:flex;gap:8px">'+
        '<button class="ai-btn" style="flex:1;font-size:12px" onclick="navigator.clipboard.writeText(this.parentElement.previousElementSibling.value).then(function(){if(typeof ttp===\'function\')ttp(\'已复制 '+allPapers.length+' 条文献\')})">📋 复制到剪贴板</button>'+
        '<button class="ai-btn-clear" style="font-size:12px;padding:5px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer" onclick="document.getElementById(\''+modalId+'\').remove()">关闭</button>'+
      '</div></div>';
    var ov = document.createElement('div');
    ov.id = modalId;
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:100000;display:flex;align-items:center;justify-content:center';
    ov.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:700px;width:94vw;max-height:85vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,.22)" onclick="event.stopPropagation()">'+html+'</div>';
    ov.onclick = function(){ ov.remove(); };
    document.body.appendChild(ov);
  }

  function mount(containerId, projectData) {
    // Bootstrap from project data
    if (projectData) {
      state.projectKeywords = projectData.keywords || '';
      state.chapters = projectData.chapters || [];
    }
    // Try to get from window.ThesisProject
    if (window.ThesisProject && ThesisProject.getCurrentProject) {
      try {
        var proj = ThesisProject.getCurrentProject();
        if (proj) {
          state.projectKeywords = proj.keywords || state.projectKeywords;
          state.chapters = (proj.chapters || []).map(function(ch) { return { id: ch.id || ch, title: ch.title || ch }; });
        }
      } catch(e) {}
    }

    render();
  }

  function refresh(projectData) {
    if (projectData) {
      state.projectKeywords = projectData.keywords || '';
      state.chapters = projectData.chapters || [];
    }
    state.saved = loadSavedPapers();
    state.citations = loadCitations();
    render();
  }

  // ── Expose Public API ──
  return {
    mount: mount,
    refresh: refresh,
    doSearch: doSearch,
    switchTab: switchTab,
    toggleFilters: toggleFilters,
    applyFilters: applyFilters,
    fillKeyword: fillKeyword,
    savePaper: savePaper,
    citePaper: citePaper,
    removeCitation: removeCitation,
    exportBibliography: exportBibliography,
    translateAbstract: translateAbstract,
    getState: function() { return state; }
  };
})();
