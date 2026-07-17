/**
 * 论文项目系统 — Thesis OS Phase 1
 * 项目对象 / 本地持久化 / 从想法创建项目向导 / 项目总览
 */
(function () {
  var STORAGE_KEY = 'thesis_ai_projects_v1';
  var CURRENT_KEY = 'thesis_ai_current_project_id';

  var STAGES = [
    { id: 'ideation', name: '选题立项', icon: '🎯', desc: '从想法到题目与研究问题', modules: ['topic-finder', 'proposal'] },
    { id: 'literature', name: '文献地图', icon: '📚', desc: '检索、筛选、图谱化文献', modules: ['references', 'knowledge-graph'] },
    { id: 'writing', name: '分章写作', icon: '✍️', desc: '大纲落地、章节扩写与数据', modules: ['expand', 'data-analysis'], primaryAction: 'open-outline' },
    { id: 'polish', name: '打磨审校', icon: '🔍', desc: '查错、降重、格式与术语', modules: ['proofread', 'de-duplicate', 'format-check', 'terminology', 'paragraph'] },
    { id: 'review', name: '综合评审', icon: '📊', desc: '审阅、优化与十维看板', modules: ['review', 'optimization', 'dashboard'] },
    { id: 'defense', name: '答辩输出', icon: '🎤', desc: '英文摘要与答辩材料', modules: ['en-abstract', 'defense-ppt'] }
  ];

  var SCHOOL_TEMPLATES = [
    { id: 'sjtu', name: '上海交通大学', degree: '硕士', minChapters: 5, minWords: 30000,
      styleNotes: 'GB/T 7714 参考文献 · 黑体章标题 · 宋体正文 · 公式居中编号',
      headingMap: { 'h1': '黑体 三号', 'h2': '黑体 小三', 'h3': '宋体 四号 加粗' },
      outline: [
        { title: '第1章 绪论', sections: ['研究背景', '研究意义', '国内外研究现状', '研究内容与方法', '论文结构安排'] },
        { title: '第2章 相关理论与技术', sections: ['核心概念界定', '理论基础', '技术路线'] },
        { title: '第3章 研究设计与方法', sections: ['研究框架', '数据来源与处理', '模型构建'] },
        { title: '第4章 实证分析与结果', sections: ['描述性统计', '模型检验', '结果讨论'] },
        { title: '第5章 结论与展望', sections: ['主要结论', '创新点', '研究局限与展望'] }
      ]
    },
    { id: 'tongji', name: '同济大学', degree: '硕士', minChapters: 5, minWords: 30000,
      styleNotes: 'GB/T 7714 参考文献 · 宋体正文 · 图表编号连续 · 页面页脚规范',
      headingMap: { 'h1': '黑体 三号', 'h2': '黑体 小三', 'h3': '仿宋 四号 加粗' },
      outline: [
        { title: '第1章 绪论', sections: ['研究背景与问题', '研究目的与意义', '国内外文献综述', '研究内容与技术路线', '论文结构'] },
        { title: '第2章 理论基础与文献综述', sections: ['相关理论', '国内外研究进展', '研究评述与切入点'] },
        { title: '第3章 研究方法', sections: ['研究设计', '数据采集', '分析方法'] },
        { title: '第4章 结果与分析', sections: ['数据结果', '分析与讨论', '对比验证'] },
        { title: '第5章 结论与建议', sections: ['研究结论', '实践建议', '不足与展望'] }
      ]
    },
    { id: 'zju', name: '浙江大学', degree: '硕士', minChapters: 6, minWords: 35000,
      styleNotes: 'GB/T 7714 参考文献 · 章另起页 · 图表索引 · 英文摘要规范',
      headingMap: { 'h1': '黑体 二号', 'h2': '黑体 三号', 'h3': '黑体 小三' },
      outline: [
        { title: '第1章 绪论', sections: ['研究背景', '问题提出', '研究意义', '研究方法', '论文框架'] },
        { title: '第2章 文献综述', sections: ['国内研究', '国外研究', '研究述评'] },
        { title: '第3章 理论分析与研究假设', sections: ['理论基础', '分析框架', '研究假设'] },
        { title: '第4章 研究设计', sections: ['样本与数据', '变量定义', '模型设定'] },
        { title: '第5章 实证检验与结果', sections: ['描述性统计', '回归分析', '稳健性检验'] },
        { title: '第6章 研究结论与讨论', sections: ['主要结论', '理论贡献', '实践启示', '局限与展望'] }
      ]
    },
    { id: 'fudan', name: '复旦大学', degree: '硕士', minChapters: 5, minWords: 30000,
      styleNotes: 'GB/T 7714 参考文献 · 英文摘要必需 · 学术诚信声明 · 致谢页',
      headingMap: { 'h1': '黑体 三号', 'h2': '黑体 小三', 'h3': '宋体 四号 加粗' },
      outline: [
        { title: '第1章 引言', sections: ['研究背景', '研究问题', '研究意义', '研究框架'] },
        { title: '第2章 文献回顾', sections: ['相关理论', '实证研究回顾', '研究缺口'] },
        { title: '第3章 研究设计与方法', sections: ['研究模型', '数据说明', '方法论'] },
        { title: '第4章 实证分析', sections: ['初步分析', '主要发现', '进一步讨论'] },
        { title: '第5章 结论', sections: ['研究总结', '理论贡献', '实践意义', '研究局限'] }
      ]
    },
    { id: 'generic', name: '通用模板', degree: '硕士', minChapters: 5, minWords: 25000,
      styleNotes: 'GB/T 7714 参考文献 · 建议使用 Word 标题样式套用 · 正文格式见学校规范',
      headingMap: { 'h1': '各校不同', 'h2': '各校不同', 'h3': '各校不同' },
      outline: [
        { title: '第1章 绪论', sections: ['研究背景', '研究意义', '研究内容与方法'] },
        { title: '第2章 文献综述', sections: ['国内外研究现状', '研究评述'] },
        { title: '第3章 研究方法', sections: ['研究设计', '数据来源', '分析方法'] },
        { title: '第4章 实证分析', sections: ['数据结果', '讨论'] },
        { title: '第5章 结论与展望', sections: ['主要结论', '局限与展望'] }
      ]
    }
  ];


  function uid() {
    return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function loadAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveAll(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
    } catch (e) {}
  }

  function authHeaders() {
    var token = null;
    try { token = sessionStorage.getItem('thesis_ai_token'); } catch (e) {}
    var h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }
  function cloudEnabled() {
    try { return !!sessionStorage.getItem('thesis_ai_token'); } catch (e) { return false; }
  }
  function upsertLocal(project) {
    var list = loadAll();
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === project.id) { list[i] = project; found = true; break; }
    }
    if (!found) list.unshift(project);
    saveAll(list);
    setCurrentId(project.id);
    return project;
  }
  function syncProjectToCloud(project, cb) {
    if (!cloudEnabled() || !project) { if (cb) cb(null); return; }
    fetch('/api/projects', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ project: project })
    }).then(function(r){ return r.json(); }).then(function(d){
      if (d && d.success && d.project) {
        upsertLocal(d.project);
        if (cb) cb(d.project);
      } else if (cb) cb(null);
    }).catch(function(){ if (cb) cb(null); });
  }
  function pullCloudProjects(cb) {
    if (!cloudEnabled()) { if (cb) cb([]); return; }
    fetch('/api/projects', { headers: authHeaders() })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (!d || !d.success) { if (cb) cb([]); return; }
        var remote = d.projects || [];
        // merge remote over local by updatedAt
        var map = {};
        loadAll().forEach(function(p){ map[p.id] = p; });
        remote.forEach(function(rp){
          var lp = map[rp.id];
          if (!lp) map[rp.id] = rp;
          else {
            var lt = Date.parse(lp.updatedAt || lp.createdAt || 0) || 0;
            var rt = Date.parse(rp.updatedAt || rp.createdAt || 0) || 0;
            map[rp.id] = rt >= lt ? rp : lp;
          }
        });
        var merged = Object.keys(map).map(function(k){ return map[k]; });
        merged.sort(function(a,b){ return Date.parse(b.updatedAt||0) - Date.parse(a.updatedAt||0); });
        saveAll(merged);
        if (cb) cb(merged);
      }).catch(function(){ if (cb) cb([]); });
  }


  function getCurrentId() {
    try { return localStorage.getItem(CURRENT_KEY) || ''; } catch (e) { return ''; }
  }

  function setCurrentId(id) {
    try {
      if (id) localStorage.setItem(CURRENT_KEY, id);
      else localStorage.removeItem(CURRENT_KEY);
    } catch (e) {}
  }

  function getCurrentProject() {
    var id = getCurrentId();
    if (!id) return null;
    var list = loadAll();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function upsertProject(project) {
    if (!project.updatedAt) project.updatedAt = nowISO();
    var saved = upsertLocal(project);
    // fire-and-forget cloud sync
    try { syncProjectToCloud(saved); } catch (e) {}
    return saved;
  }

  function createProject(opts) {
    opts = opts || {};
    var p = {
      id: uid(),
      title: opts.title || '未命名论文项目',
      idea: opts.idea || '',
      field: opts.field || '',
      keywords: opts.keywords || '',
      degree: opts.degree || '硕士',
      goalWords: opts.goalWords || 30000,
      currentStage: opts.currentStage || 'ideation',
      mode: opts.mode || 'create', // create | import
      hasManuscript: !!opts.hasManuscript,
      stageStatus: {},
      notes: opts.notes || '',
      artifacts: opts.artifacts || { outline: null, chapters: {}, skillLogs: [] },
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    STAGES.forEach(function (s) {
      p.stageStatus[s.id] = s.id === p.currentStage ? 'active' : 'todo';
    });
    return upsertProject(p);
  }

  function updateCurrent(patch) {
    var p = getCurrentProject();
    if (!p) return null;
    Object.keys(patch || {}).forEach(function (k) { p[k] = patch[k]; });
    if (!p.artifacts) p.artifacts = { outline: null, chapters: {}, skillLogs: [] };
    p.updatedAt = nowISO();
    return upsertProject(p);
  }

  function ensureArtifacts(p) {
    if (!p.artifacts) p.artifacts = { outline: null, chapters: {}, skillLogs: [] };
    if (!p.artifacts.chapters) p.artifacts.chapters = {};
    if (!p.artifacts.skillLogs) p.artifacts.skillLogs = [];
    return p.artifacts;
  }

  function saveOutline(outline) {
    var p = getCurrentProject();
    if (!p) return null;
    var arts = ensureArtifacts(p);
    arts.outline = {
      title: outline.title || p.title,
      chapters: outline.chapters || [],
      updatedAt: nowISO()
    };
    p.updatedAt = nowISO();
    // 有大纲后，推进写作阶段
    if ((p.stageStatus || {}).writing !== 'done') {
      p.stageStatus.writing = 'active';
      if (p.currentStage === 'ideation' || p.currentStage === 'literature') {
        // 不强制跳阶段，只标记写作可开始
      }
    }
    return upsertProject(p);
  }

  function getOutline() {
    var p = getCurrentProject();
    if (!p) return null;
    var arts = ensureArtifacts(p);
    return arts.outline || null;
  }

  function chapterKey(title, idx) {
    return 'ch_' + idx + '_' + String(title || '').replace(/\s+/g, '').slice(0, 24);
  }

  function getChapterDraft(key) {
    var p = getCurrentProject();
    if (!p) return null;
    var arts = ensureArtifacts(p);
    return arts.chapters[key] || null;
  }

  function saveChapterDraft(key, draft) {
    var p = getCurrentProject();
    if (!p) return null;
    var arts = ensureArtifacts(p);
    // Ensure versions array exists for this chapter
    if (!arts._versions) arts._versions = {};
    var verKey = key + '_versions';
    var versions = arts._versions[verKey] || [];
    var prev = arts.chapters[key] || {};
    // Archive previous version if it has content
    if (prev.content && prev.content.trim()) {
      versions.push({
        ts: prev.updatedAt || nowISO(),
        content: prev.content,
        status: prev.status || 'draft',
        words: (prev.content || '').replace(/\s+/g, '').length
      });
      versions = versions.slice(-10);
    }
    arts._versions[verKey] = versions;
    arts.chapters[key] = {
      key: key,
      title: draft.title || prev.title || '',
      sections: draft.sections || prev.sections || [],
      content: draft.content != null ? draft.content : (prev.content || ''),
      status: draft.status || prev.status || 'draft',
      updatedAt: nowISO(),
      createdAt: prev.createdAt || nowISO()
    };
    p.updatedAt = nowISO();
    if ((p.stageStatus || {}).writing !== 'done') p.stageStatus.writing = 'active';
    return upsertProject(p);
  }

  function getVersionHistory(key) {
    var p = getCurrentProject();
    if (!p) return [];
    var arts = ensureArtifacts(p);
    if (!arts._versions) return [];
    var verKey = key + '_versions';
    return (arts._versions[verKey] || []).slice().reverse();
  }

  function rollbackChapterVersion(key, ts) {
    var versions = getVersionHistory(key);
    var found = null;
    for (var i = 0; i < versions.length; i++) { if (versions[i].ts === ts) { found = versions[i]; break; } }
    if (!found) return false;
    var draft = getChapterDraft(key) || {};
    // Save current as version first, then restore
    saveChapterDraft(key, { title: draft.title, sections: draft.sections, content: found.content, status: found.status });
    return true;
  }

  function listChapterCards(project) {
    var outline = project && project.artifacts && project.artifacts.outline;
    if (!outline || !outline.chapters || !outline.chapters.length) return [];
    var arts = ensureArtifacts(project);
    return outline.chapters.map(function (ch, idx) {
      var key = chapterKey(ch.title, idx);
      var d = arts.chapters[key];
      var content = d && d.content ? d.content : '';
      var words = content.replace(/\s+/g, '').length;
      return {
        key: key,
        idx: idx,
        title: ch.title,
        sections: ch.sections || [],
        content: content,
        words: words,
        status: !content ? 'empty' : (words < 300 ? 'draft' : 'ready'),
        updatedAt: d && d.updatedAt ? d.updatedAt : null
      };
    });
  }

  function chapterStats(project) {
    var cards = listChapterCards(project);
    var ready = 0, words = 0;
    cards.forEach(function (c) {
      words += c.words;
      if (c.status === 'ready') ready++;
    });
    return { total: cards.length, ready: ready, words: words, cards: cards };
  }

  function logSkillRun(entry) {
    var p = getCurrentProject();
    if (!p) return null;
    var arts = ensureArtifacts(p);
    arts.skillLogs.unshift({
      id: uid(),
      moduleId: entry.moduleId || '',
      title: entry.title || '',
      summary: entry.summary || '',
      at: nowISO()
    });
    arts.skillLogs = arts.skillLogs.slice(0, 50);
    p.updatedAt = nowISO();
    return upsertProject(p);
  }

  function markStage(stageId, status) {
    var p = getCurrentProject();
    if (!p) return null;
    p.stageStatus = p.stageStatus || {};
    p.stageStatus[stageId] = status || 'done';
    if (status === 'active') p.currentStage = stageId;
    p.updatedAt = nowISO();
    return upsertProject(p);
  }

  function completeStage(stageId) {
    var p = markStage(stageId, 'done');
    if (!p) return null;
    var idx = -1;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === stageId) { idx = i; break; }
    if (idx >= 0 && idx < STAGES.length - 1) {
      var next = STAGES[idx + 1].id;
      if (p.stageStatus[next] !== 'done') p.stageStatus[next] = 'active';
      p.currentStage = next;
      upsertProject(p);
    }
    return p;
  }

  function calcProgress(project) {
    if (!project) return { percent: 0, done: 0, total: STAGES.length, label: '未创建项目' };
    var done = 0;
    STAGES.forEach(function (s) {
      if ((project.stageStatus || {})[s.id] === 'done') done++;
    });
    // 有正文时给导入/写作路径额外加成感
    var bonus = project.hasManuscript ? 8 : 0;
    var percent = Math.min(100, Math.round((done / STAGES.length) * 100 + (done === STAGES.length ? 0 : bonus * 0)));
    if (project.hasManuscript && done < 2) percent = Math.max(percent, 18);
    var stage = null;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === project.currentStage) stage = STAGES[i];
    return {
      percent: percent,
      done: done,
      total: STAGES.length,
      label: stage ? ('当前：' + stage.name) : '进行中',
      stage: stage
    };
  }

  function nextAction(project) {
    if (!project) {
      return {
        title: '先选一条路径',
        desc: '从想法立项，或上传已有论文开始打磨。',
        primary: { label: '从想法开始', action: 'open-idea-wizard' },
        secondary: { label: '上传论文', action: 'upload' }
      };
    }
    var hasPaper = !!(project.hasManuscript || (typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100));
    var chCount = (typeof sections !== 'undefined' && sections && sections.length) ? sections.length : 0;
    var refCount = 0;
    if (typeof mergedRefs !== 'undefined' && mergedRefs && mergedRefs.length) refCount = mergedRefs.length;
    else if (typeof existingRefs !== 'undefined' && existingRefs && existingRefs.length) refCount = existingRefs.length;
    if (hasPaper && !chCount) {
      return { title: '目录树还没识别出来', desc: '先看左侧底部目录；若为空，请重新上传论文。', primary: { label: '重新上传论文', action: 'upload' }, secondary: { label: '打开参考文献', action: 'open-stage', stageId: 'literature', moduleId: 'references' } };
    }
    if (hasPaper && !refCount) {
      return { title: '去确认参考文献', desc: '正文结构已有。下一步检查文末文献是否提取成功。', primary: { label: '打开参考文献', action: 'open-stage', stageId: 'literature', moduleId: 'references' }, secondary: { label: '打开论文看板', action: 'open-stage', stageId: 'review', moduleId: 'dashboard' } };
    }
    var stage = null;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === project.currentStage) stage = STAGES[i];
    if (!stage) stage = STAGES[0];
    var mod = stage.modules && stage.modules[0];
    if (stage.id === 'writing') {
      var outline = getOutline();
      if (!outline) return { title: '先定大纲', desc: '分章写作前先保存大纲，后面草稿才有结构。', primary: { label: '打开大纲编辑器', action: 'open-outline' }, secondary: hasPaper ? { label: '去论文扩写', action: 'open-stage', stageId: 'writing', moduleId: 'expand' } : null };
      return { title: '继续分章草稿', desc: '按大纲把每章骨架写出来，再扩写细化。', primary: { label: '打开分章看板', action: 'open-chapters' }, secondary: { label: '论文扩写', action: 'open-stage', stageId: 'writing', moduleId: 'expand' } };
    }
    return {
      title: '继续「' + stage.name + '」',
      desc: stage.desc + (mod ? ' · 推荐：' + moduleLabel(mod) : ''),
      primary: { label: '进入本阶段', action: 'open-stage', stageId: stage.id, moduleId: mod },
      secondary: hasPaper ? null : { label: '上传已有草稿', action: 'upload' }
    };
  }

  function moduleLabel(id) {
    if (typeof APP_MODULES === 'undefined') return id;
    for (var i = 0; i < APP_MODULES.length; i++) if (APP_MODULES[i].id === id) return APP_MODULES[i].name;
    return id;
  }

  function ensureDefaultProject() {
    var cur = getCurrentProject();
    if (cur) return cur;
    // 不自动创建，让用户主动选择路径
    return null;
  }

  function refreshOpenProjectUIs() {
    // Re-render any open project-related overlays so mutations are visible immediately
    if (document.getElementById('projectSwitcherOverlay')) {
      openProjectSwitcher();
    }
    if (document.getElementById('chapterBoardOverlay') && typeof openChapterBoard === 'function') {
      try { openChapterBoard(); } catch (e) {}
    }
    if (document.getElementById('fullPreviewOverlay') && typeof openFullPaperPreview === 'function') {
      // keep preview closed on project switch/delete
    }
    renderProjectChrome();
  }

  function switchToProject(projectId) {
    if (!projectId) return;
    setCurrentId(projectId);
    closeProjectSwitcher();
    refreshOpenProjectUIs();
    if (typeof switchView === 'function') switchView('workspace');
    if (typeof ttp === 'function') ttp('已切换项目');
  }

  function deleteProject(projectId) {
    if (!projectId) return;
    if (!confirm('确定删除该项目？此操作不可恢复。')) return;
    var list = loadAll().filter(function (p) { return p.id !== projectId; });
    saveAll(list);
    if (getCurrentId() === projectId) {
      setCurrentId(list.length ? list[0].id : '');
    }
    // Always re-render list immediately (local first)
    refreshOpenProjectUIs();
    if (cloudEnabled()) {
      fetch('/api/projects/' + encodeURIComponent(projectId), {
        method: 'DELETE',
        headers: authHeaders()
      }).then(function(r){ return r.json().catch(function(){ return {}; }); })
        .then(function(d){
          // re-pull cloud list to avoid stale remote items reappearing later
          try { pullCloudProjects(function(){ refreshOpenProjectUIs(); }); } catch (e) { refreshOpenProjectUIs(); }
          if (d && d.success === false && typeof ttp === 'function') ttp('云端删除失败，已先从本地移除');
        })
        .catch(function(){ try { pullCloudProjects(function(){ refreshOpenProjectUIs(); }); } catch (e) {} });
    }
    if (typeof switchView === 'function') switchView('workspace');
    if (typeof ttp === 'function') ttp('已删除项目');
  }

  function openProjectSwitcher() {
    closeProjectSwitcher();
    var projects = loadAll();
    var current = getCurrentProject();
    var rows = projects.map(function (p) {
      var prog = calcProgress(p);
      var isCur = current && p.id === current.id;
      return '<div class="project-switch-row' + (isCur ? ' is-current' : '') + '" data-project-id="' + p.id + '" onclick="switchToProject(\'' + p.id + '\')">' +
        '<div><b>' + escapeHtml(p.title) + '</b><span>' + prog.percent + '% · ' + escapeHtml(p.field || p.idea || '') + '</span></div>' +
        '<div class="project-switch-actions" onclick="event.stopPropagation()">' +
          '<button class="ai-btn-clear" onclick="switchToProject(\'' + p.id + '\')">打开</button>' +
          '<button class="ai-btn-clear" onclick="deleteProject(\'' + p.id + '\')">删除</button>' +
        '</div>' +
      '</div>';
    }).join('');
    if (!rows) rows = '<div class="project-progress-sub" style="text-align:center;padding:20px">还没有项目，先创建一个吧</div>';

    var ov = document.createElement('div');
    ov.id = 'projectSwitcherOverlay';
    ov.className = 'project-overlay';
    ov.innerHTML =
      '<div class="project-modal" style="width:min(520px,100%)" onclick="event.stopPropagation()">' +
        '<div class="project-modal-head"><div><h3>我的项目</h3><p>共 ' + projects.length + ' 个项目</p></div><button class="project-close" onclick="closeProjectSwitcher()">×</button></div>' +
        '<div style="max-height:50vh;overflow:auto">' + rows + '</div>' +
        '<div class="project-modal-actions">' +
          '<button class="ai-btn-clear" onclick="closeProjectSwitcher()">关闭</button>' +
          '<button class="ai-btn" onclick="closeProjectSwitcher();openIdeaWizard()">新建项目</button>' +
        '</div>' +
      '</div>';
    ov.onclick = function () { closeProjectSwitcher(); };
    document.body.appendChild(ov);
  }

  function closeProjectSwitcher() {
    var ov = document.getElementById('projectSwitcherOverlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  // ---------- UI: Idea Wizard ----------
  function openIdeaWizard() {
    closeIdeaWizard();
    var ov = document.createElement('div');
    ov.id = 'ideaWizardOverlay';
    ov.className = 'project-overlay';
    ov.innerHTML =
      '<div class="project-modal" onclick="event.stopPropagation()">' +
        '<div class="project-modal-head">' +
          '<div><h3>从想法创建论文项目</h3><p>先不用完整初稿。写下兴趣方向，系统会帮你立项并进入写作流水线。</p></div>' +
          '<button class="project-close" onclick="closeIdeaWizard()">✕</button>' +
        '</div>' +
        '<div class="project-form">' +
          '<label>一句话研究想法 *</label>' +
          '<textarea id="ideaText" class="ai-textarea" style="height:96px;margin:0" placeholder="例如：用机器学习做智慧工地安全风险动态分级评价"></textarea>' +
          '<div class="project-grid-2">' +
            '<div><label>学科/领域</label><input id="ideaField" class="ai-input" placeholder="如：工程管理 / 人工智能"></div>' +
            '<div><label>学位类型</label><select id="ideaDegree" class="ai-input"><option>硕士</option><option>本科</option><option>博士</option></select></div></div><div class="project-grid-2"><div><label>学校模板</label><select id="ideaTemplate" class="ai-input" onchange="ideaTemplateChanged(this.value)"><option value="">通用模板</option>' +
              SCHOOL_TEMPLATES.map(function(t){return '<option value="'+t.id+'">'+t.name+'</option>';}).join('') +
            '</select></div>' +
          '</div>' +
          '<div class="template-hint" id="templateHint" style="display:none"></div>' +
          '<label>关键词（选填，逗号分隔）</label>' +
          '<input id="ideaKeywords" class="ai-input" placeholder="智慧工地, 风险评价, 机器学习">' +
          '<label>暂定题目（选填）</label>' +
          '<input id="ideaTitle" class="ai-input" placeholder="可先空着，后面用选题推荐生成">' +
        '</div>' +
        '<div class="project-modal-actions">' +
          '<button class="ai-btn-clear" onclick="closeIdeaWizard()">取消</button>' +
          '<button class="ai-btn" onclick="submitIdeaWizard()">创建项目并开始</button>' +
        '</div>' +
      '</div>';
    ov.onclick = function () { closeIdeaWizard(); };
    document.body.appendChild(ov);
    setTimeout(function () {
      var el = document.getElementById('ideaText');
      if (el) el.focus();
    }, 50);
  }

  function closeIdeaWizard() {
    var ov = document.getElementById('ideaWizardOverlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function ideaTemplateChanged(templateId) {
    var hint = document.getElementById('templateHint');
    if (!hint) return;
    if (!templateId) { hint.style.display = 'none'; return; }
    var t = null;
    for (var i = 0; i < SCHOOL_TEMPLATES.length; i++) { if (SCHOOL_TEMPLATES[i].id === templateId) { t = SCHOOL_TEMPLATES[i]; break; } }
    if (!t) return;
    hint.style.display = '';
    hint.innerHTML = t.styleNotes.replace(/\n/g, '<br>') + '<br><b>要求：</b>≥' + t.outline.length + '章 · ≥' + (t.minWords / 1000) + 'k字 · ' + t.degree;
  }

  function submitIdeaWizard() {
    try {
      var ideaEl = document.getElementById('ideaText');
      var idea = (ideaEl && ideaEl.value || '').trim();
      if (idea.length < 8) { alert('请至少用一句话描述你的研究想法（不少于 8 字）'); return; }
      var field = ((document.getElementById('ideaField') || {}).value || '').trim();
      var degree = ((document.getElementById('ideaDegree') || {}).value || '硕士');
      var templateId = ((document.getElementById('ideaTemplate') || {}).value || '').trim() || 'generic';
      var keywords = ((document.getElementById('ideaKeywords') || {}).value || '').trim();
      var title = ((document.getElementById('ideaTitle') || {}).value || '').trim();
      if (!title) title = idea.length > 24 ? idea.substring(0, 24) + '…' : idea;

      var project = createProject({
        title: title,
        idea: idea,
        field: field,
        keywords: keywords,
        degree: degree,
        mode: 'create',
        currentStage: 'ideation',
        schoolTemplate: templateId,
        hasManuscript: !!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100)
      });
      // Always apply template outline (generic if empty)
      try { applySchoolTemplate(templateId || 'generic'); } catch (e) { console.warn('template apply failed', e); }
      // ensure project still current
      project = getCurrentProject() || project;
      closeIdeaWizard();
      renderProjectChrome();
      if (typeof switchView === 'function') switchView('workspace');
      if (typeof ttp === 'function') ttp('项目已创建：' + project.title + '。可点「一键流水线」自动推进。');
      // prefill topic finder fields if module later opens
      setTimeout(function () {
        var domain = document.getElementById('topicDomain');
        var kws = document.getElementById('topicKeywords');
        if (domain) domain.value = field || idea;
        if (kws) kws.value = keywords;
      }, 200);
    } catch (err) {
      console.error(err);
      alert('创建项目失败：' + (err.message || err) + '。请打开控制台查看详情。');
    }
  }

  // ---------- UI: Project overview in workspace ----------

  function renderImportChecklist(project) {
    var hasPaper = !!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100);
    if (!hasPaper && !(project && project.hasManuscript)) return '';
    var chCount = (typeof sections !== 'undefined' && sections && sections.length) ? sections.length : 0;
    var refCount = 0;
    if (typeof mergedRefs !== 'undefined' && mergedRefs && mergedRefs.length) refCount = mergedRefs.length;
    else if (typeof existingRefs !== 'undefined' && existingRefs && existingRefs.length) refCount = existingRefs.length;
    function item(done, title, desc, btnLabel, onclick) {
      return '<div class="checklist-item' + (done ? ' is-done' : '') + '">' +
        '<div class="checklist-left"><span class="checklist-dot">' + (done ? '\u2713' : '\u25cb') + '</span>' +
        '<div><b>' + title + '</b><p>' + desc + '</p></div></div>' +
        (done ? '<span class="checklist-ok">已完成</span>' :
          '<button class="ai-btn-clear" onclick="' + onclick + '">' + btnLabel + '</button>') +
      '</div>';
    }
    return '<div class="import-checklist">' +
      '<div class="import-checklist-head"><strong>导入后 3 步</strong><span>按顺序做，先别点一圈工具箱</span></div>' +
      item(chCount > 0, '1. 检查目录树', chCount > 0 ? ('已识别 ' + chCount + ' 章') : '左侧底部「目录」应出现章节；没有就重新上传', '看目录树', "document.getElementById('navTree')&&document.getElementById('navTree').scrollIntoView({behavior:'smooth'})") +
      item(refCount > 0, '2. 检查参考文献', refCount > 0 ? ('已提取 ' + refCount + ' 条') : '到参考文献面板确认是否识别到文末文献', '打开参考文献', "switchView('references')") +
      item(false, '3. 打开论文看板', '用十维评分看整体缺口，再决定改哪一章', '打开看板', 'showDashboard()') +
    '</div>';
  }

  function renderProjectOverviewHTML(project) {
    var prog = calcProgress(project);
    var next = nextAction(project);
    if (!project) {
      return '' +
        '<div class="project-overview home-simple">' +
          '<div class="project-overview-head">' +
            '<div class="project-badge">开始使用</div>' +
            '<h2>你想先做什么？</h2>' +
            '<p>中间是论文全貌，左侧是目录树——内容会一点点长出来。右侧工具台可随时用（如数据分析）。</p>' +
          '</div>' +
          '<div class="home-choice-grid">' +
            '<button class="home-choice primary" onclick="openIdeaWizard()">' +
              '<div class="home-choice-kicker">路径 A · 推荐新手</div>' +
              '<div class="home-choice-title">💡 从想法开始</div>' +
              '<div class="home-choice-desc">还没有完整论文。先立项，再写大纲、分章草稿、检索文献。</div>' +
              '<div class="home-choice-next">下一步：创建项目 → 一键流水线/大纲写作</div>' +
            '</button>' +
            '<button class="home-choice" onclick="triggerUpload()">' +
              '<div class="home-choice-kicker">路径 B · 已有草稿</div>' +
              '<div class="home-choice-title">📄 上传论文打磨</div>' +
              '<div class="home-choice-desc">已有 DOCX。导入后自动解析目录树、参考文献，再做评审与优化。</div>' +
              '<div class="home-choice-next">下一步：上传 .docx → 查看目录树</div>' +
            '</button>' +
          '</div>' +
          '<div class="home-help-note">左侧上方是主线阶段，中间大区域是目录树，底部“全部工具”按需展开。登录后项目自动云同步。</div>' +
        '</div>';
    }

    var stagesHtml = STAGES.map(function (s) {
      var st = (project.stageStatus || {})[s.id] || 'todo';
      var cls = 'project-stage-card is-' + st + (s.id === project.currentStage ? ' is-current' : '');
      return '<div class="' + cls + '" onclick="openProjectStage(\'' + s.id + '\')">' +
        '<div class="project-stage-status">' + (st === 'done' ? '已完成' : (st === 'active' ? '进行中' : '未开始')) + '</div>' +
        '<div class="project-stage-name">' + s.icon + ' ' + s.name + '</div>' +
        '<div class="project-stage-desc">' + s.desc + '</div>' +
      '</div>';
    }).join('');

    return '' +
      '<div class="project-overview">' +
        '<div class="project-overview-head">' +
          '<div class="project-badge">' + (project.mode === 'import' ? '导入打磨' : '创作项目') + '</div>' +
          '<h2>' + escapeHtml(project.title) + '</h2>' +
          '<p>' + escapeHtml(project.idea || project.field || '继续推进当前阶段，或切换到其他写作能力。') + '</p>' +
        '</div>' +
        '<div class="project-progress-wrap">' +
          '<div class="project-progress-meta"><span>' + prog.label + '</span><strong>' + prog.percent + '%</strong></div>' +
          '<div class="project-progress-bar"><i style="width:' + prog.percent + '%"></i></div>' +
          '<div class="project-progress-sub">阶段完成 ' + prog.done + '/' + prog.total +
            (project.field ? ' · ' + escapeHtml(project.field) : '') +
            (project.degree ? ' · ' + escapeHtml(project.degree) : '') +
          '</div>' +
        '</div>' +
        '<div class="project-next-card">' +
          '<div><div class="next-kicker">当前建议</div><strong>' + escapeHtml(next.title) + '</strong><p>' + escapeHtml(next.desc) + '</p></div>' +
          '<div class="project-cta-row" style="margin:0">' +
            '<button class="ai-btn" onclick="runProjectAction(\'' + next.primary.action + '\',\'' + (next.primary.stageId || '') + '\',\'' + (next.primary.moduleId || '') + '\')">' + next.primary.label + '</button>' +
            (next.secondary ? '<button class="ai-btn-clear" onclick="runProjectAction(\'' + next.secondary.action + '\')">' + next.secondary.label + '</button>' : '') +
            '<button class="ai-btn-clear" onclick="completeCurrentStage()">完成本阶段</button>' +
          '</div>' +
        '</div>' +
        renderSmartTips(project) +
        '<details class="project-more-tools"><summary>更多工具</summary><div class="project-tools-row">' +
          '<button class="ai-btn-clear" onclick="runOneClickPipeline()">一键流水线</button>' +
          '<button class="ai-btn-clear" onclick="openDefensePack()">答辩材料包</button>' +
          '<button class="ai-btn-clear" onclick="normalizeRefsGBT7714()">文献规范化</button>' +
          '<button class="ai-btn-clear" onclick="openMaterialsLibrary()">资料库</button>' +
          '<button class="ai-btn-clear" onclick="openOutlineEditor()">大纲</button>' +
          '<button class="ai-btn-clear" onclick="openChapterBoard()">分章草稿</button>' +
          '<button class="ai-btn-clear" onclick="openFullPaperPreview()">完整预览</button>' +
          '<button class="ai-btn-clear" onclick="mergeDraftsIntoThesis()">合并到正文</button>' +
          '<button class="ai-btn-clear" onclick="openTemplateChooser()">学校模板</button>' +
          '<button class="ai-btn-clear" onclick="openProjectSettings()">设置</button>' +
          '<button class="ai-btn-clear" onclick="exportFullPaperDocx()">导出DOCX</button>' +
        '</div></details>' +
        '<div class="project-stage-grid">' + stagesHtml + '</div>' +
      '</div>';
  }

  function renderChapterBoardInline(project) {
    var stats = chapterStats(project);
    if (!stats.total) {
      return '<div class="project-panel-card">' +
        '<div class="project-panel-head"><strong>📝 分章草稿</strong><span>先保存大纲后，这里会生成章节卡片</span></div>' +
        '<button class="ai-btn-clear" onclick="openOutlineEditor()">先编辑大纲</button>' +
      '</div>';
    }
    var cards = stats.cards.map(function (c) {
      var badge = c.status === 'ready' ? '可进入扩写' : (c.status === 'draft' ? '草稿中' : '未开始');
      var badgeCls = c.status === 'ready' ? 'ok' : (c.status === 'draft' ? 'warn' : 'muted');
      return '<div class="chapter-card" onclick="openChapterEditor(\'' + c.key + '\')">' +
        '<div class="chapter-card-top"><b>' + escapeHtml(c.title) + '</b><span class="chapter-badge ' + badgeCls + '">' + badge + '</span></div>' +
        '<div class="chapter-card-meta">' + c.words + ' 字 · 引用 ' + ((c.content||'').match(/\[\d+\]/g)||[]).length + ' 处 · 引用 ' + ((c.content||'').match(/\[\d+\]/g)||[]).length + ' 处 · ' + (c.sections.length || 0) + ' 个小节</div>' +
        '<div class="chapter-card-preview">' + escapeHtml((c.content || c.sections.join(' / ') || '点击开始写这一章').slice(0, 72)) + '</div>' +
      '</div>';
    }).join('');
    return '<div class="project-panel-card">' +
      '<div class="project-panel-head"><strong>📝 分章草稿</strong><span>' + stats.ready + '/' + stats.total + ' 章较完整 · 共 ' + stats.words + ' 字</span></div>' +
      '<div class="chapter-card-grid">' + cards + '</div>' +
      '<div class="project-cta-row" style="margin:12px 0 0">' +
        '<button class="ai-btn-clear" onclick="openChapterBoard()">打开分章看板</button>' +
        '<button class="ai-btn-clear" onclick="openOutlineEditor()">调整大纲</button>' +
      '</div>' +
    '</div>';
  }

  function renderSkillLogInline(project) {
    var logs = (project.artifacts && project.artifacts.skillLogs) || [];
    if (!logs.length) {
      return '<div class="project-panel-card"><div class="project-panel-head"><strong>🧾 能力运行记录</strong><span>保存大纲、章节后会自动留下轨迹</span></div></div>';
    }
    var rows = logs.slice(0, 5).map(function (l) {
      return '<div class="skill-log-row"><b>' + escapeHtml(l.title || l.moduleId) + '</b><span>' + escapeHtml(l.summary || '') + '</span><i>' + formatTime(l.at) + '</i></div>';
    }).join('');
    return '<div class="project-panel-card"><div class="project-panel-head"><strong>🧾 最近能力记录</strong><span>本地保存，便于回溯</span></div>' + rows + '</div>';
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var mm = (d.getMonth() + 1);
      var dd = d.getDate();
      var hh = String(d.getHours()).padStart(2, '0');
      var mi = String(d.getMinutes()).padStart(2, '0');
      return mm + '/' + dd + ' ' + hh + ':' + mi;
    } catch (e) { return ''; }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderWorkspaceHero() {
    var box = document.getElementById('workspaceContent');
    if (!box) return;
    var project = getCurrentProject();
    box.innerHTML = renderProjectOverviewHTML(project);
    box.style.display = '';
  }

  function renderProjectChrome() {
    try{ if(typeof renderToolboxFavorites==='function') renderToolboxFavorites(); }catch(e){}
    var project = getCurrentProject();
    var titleEl = document.getElementById('projectTitleChip');
    var progEl = document.getElementById('projectProgressChip');
    if (titleEl) {
      titleEl.textContent = project ? project.title : '未创建项目';
      titleEl.title = project ? (project.idea || project.title) : '点击查看项目列表';
      titleEl.onclick = function () { openProjectSwitcher(); };
    }
    if (progEl) {
      var prog = calcProgress(project);
      progEl.textContent = project ? (prog.percent + '% · ' + prog.label) : '创建项目后显示进度';
    }
    renderStageNav();
    // 若当前仍在欢迎页，刷新概览
    var ws = document.getElementById('workspaceContent');
    if (ws && ws.style.display !== 'none') renderWorkspaceHero();
  }

  function renderStageNav() {
    var host = document.getElementById('stageNav');
    if (!host) return;
    var project = getCurrentProject();
    var html = '';
    STAGES.forEach(function (s, idx) {
      var st = project ? ((project.stageStatus || {})[s.id] || 'todo') : 'todo';
      var cur = project && project.currentStage === s.id;
      html += '<div class="stage-nav-item' + (cur ? ' active' : '') + ' is-' + st + '" onclick="openProjectStage(\'' + s.id + '\')">' +
        '<span class="stage-nav-idx">' + (idx + 1) + '</span>' +
        '<span class="stage-nav-text"><b>' + s.name + '</b><i>' + s.desc + '</i></span>' +
      '</div>';
    });
    host.innerHTML = html;
  }

  function openProjectStage(stageId) {
    var project = getCurrentProject();
    if (!project) {
      openIdeaWizard();
      return;
    }
    var stage = null;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === stageId) stage = STAGES[i];
    if (!stage) return;
    if ((project.stageStatus || {})[stageId] !== 'done') {
      project.stageStatus[stageId] = 'active';
    }
    project.currentStage = stageId;
    upsertProject(project);
    renderProjectChrome();
    if (stageId === "writing") {
      var outline = getOutline();
      if (!outline) openOutlineEditor();
      else openChapterBoard();
      return;
    }
    var mod = stage.modules && stage.modules[0];
    if (stage.primaryAction === 'open-outline') {
      openOutlineEditor();
      return;
    }
    if (mod && typeof switchModule === 'function') switchModule(mod);
  }

  function completeCurrentStage() {
    var project = getCurrentProject();
    if (!project) { openIdeaWizard(); return; }
    completeStage(project.currentStage);
    renderProjectChrome();
    if (typeof ttp === 'function') ttp('已标记阶段完成');
  }

  function runProjectAction(action, stageId, moduleId) {
    if (action === 'open-idea-wizard') return openIdeaWizard();
    if (action === 'upload') return typeof triggerUpload === 'function' ? triggerUpload() : null;
    if (action === 'open-stage') return openProjectStage(stageId || 'ideation');
    if (action === 'open-outline') return openOutlineEditor();
    if (moduleId && typeof switchModule === 'function') return switchModule(moduleId);
  }

  // ---------- Outline Editor ----------
  function defaultOutlineFromProject(p) {
    var title = (p && p.title) || '论文题目';
    return {
      title: title,
      chapters: [
        { title: '第1章 绪论', sections: ['研究背景', '研究意义', '研究内容与方法'] },
        { title: '第2章 文献综述', sections: ['国内外研究现状', '研究评述与缺口'] },
        { title: '第3章 研究设计与方法', sections: ['研究框架', '数据来源', '分析方法'] },
        { title: '第4章 实证分析 / 案例研究', sections: ['描述性统计', '模型结果', '结果讨论'] },
        { title: '第5章 结论与展望', sections: ['主要结论', '研究局限', '未来展望'] }
      ]
    };
  }

  function openOutlineEditor() {
    var p = getCurrentProject();
    if (!p) { openIdeaWizard(); return; }
    closeOutlineEditor();
    var existing = getOutline() || defaultOutlineFromProject(p);
    var ov = document.createElement('div');
    ov.id = 'outlineEditorOverlay';
    ov.className = 'project-overlay';
    ov.innerHTML =
      '<div class="project-modal outline-modal" onclick="event.stopPropagation()">' +
        '<div class="project-modal-head">' +
          '<div><h3>🧭 论文大纲编辑器</h3><p>先把结构定下来，再进入分章写作。大纲会保存到当前项目。</p></div>' +
          '<button class="project-close" onclick="closeOutlineEditor()">✕</button>' +
        '</div>' +
        '<div class="project-form">' +
          '<label>论文题目</label>' +
          '<input id="outlineTitle" class="ai-input" value="' + escapeHtml(existing.title || p.title) + '">' +
          '<label>章节结构（每行一章；用「- 小节」表示下属小节）</label>' +
          '<textarea id="outlineText" class="ai-textarea" style="height:280px;margin:0" placeholder="第1章 绪论\n- 研究背景\n- 研究意义"></textarea>' +
          '<div class="project-progress-sub">提示：可先点「生成默认大纲」，再按你的题目改。</div>' +
        '</div>' +
        '<div class="project-modal-actions">' +
          '<button class="ai-btn-clear" onclick="fillDefaultOutline()">生成默认大纲</button>' +
          '<button class="ai-btn-clear" onclick="closeOutlineEditor()">取消</button>' +
          '<button class="ai-btn" onclick="saveOutlineEditor()">保存大纲</button>' +
        '</div>' +
      '</div>';
    ov.onclick = function () { closeOutlineEditor(); };
    document.body.appendChild(ov);
    document.getElementById('outlineText').value = serializeOutline(existing);
  }

  function closeOutlineEditor() {
    var ov = document.getElementById('outlineEditorOverlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function serializeOutline(outline) {
    var lines = [];
    (outline.chapters || []).forEach(function (ch) {
      lines.push(ch.title || '未命名章节');
      (ch.sections || []).forEach(function (sec) {
        lines.push('- ' + sec);
      });
    });
    return lines.join('\n');
  }

  function parseOutlineText(text) {
    var lines = String(text || '').split(/\r?\n/);
    var chapters = [];
    var cur = null;
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, '');
      if (!line.trim()) return;
      if (/^\s*[-•]/.test(line) || /^\s+/.test(line)) {
        var sec = line.replace(/^\s*[-•]\s*/, '').trim();
        if (sec) {
          if (!cur) {
            cur = { title: '第1章', sections: [] };
            chapters.push(cur);
          }
          cur.sections.push(sec);
        }
      } else {
        cur = { title: line.trim(), sections: [] };
        chapters.push(cur);
      }
    });
    return chapters;
  }

  function fillDefaultOutline() {
    var p = getCurrentProject();
    var d = defaultOutlineFromProject(p || {});
    var titleEl = document.getElementById('outlineTitle');
    var textEl = document.getElementById('outlineText');
    if (titleEl) titleEl.value = d.title;
    if (textEl) textEl.value = serializeOutline(d);
  }

  function saveOutlineEditor() {
    var p = getCurrentProject();
    if (!p) { alert('请先创建项目'); return; }
    var title = (document.getElementById('outlineTitle').value || '').trim() || p.title;
    var chapters = parseOutlineText(document.getElementById('outlineText').value || '');
    if (!chapters.length) { alert('请至少写一章大纲'); return; }
    saveOutline({ title: title, chapters: chapters });
    if (title && title !== p.title) updateCurrent({ title: title });
    logSkillRun({ moduleId: 'outline-editor', title: '保存论文大纲', summary: '共 ' + chapters.length + ' 章' });
    closeOutlineEditor();
    renderProjectChrome();
    try { refreshOpenProjectUIs(); } catch (e) {}
    if (typeof ttp === 'function') ttp('大纲已保存（' + chapters.length + ' 章）');
  }

  
  function ensureUnifiedProjectState() {
    // One model for both paths: project + outline + chapters + optional manuscript
    var p = getCurrentProject();
    if (!p) return null;
    var arts = ensureArtifacts(p);
    if (!arts.outline || !arts.outline.chapters || !arts.outline.chapters.length) {
      // if manuscript sections exist, sync; else generic template
      if (typeof sections !== 'undefined' && sections && sections.length) {
        try { syncSectionsToChapterDrafts(false); } catch (e) {}
      } else {
        try { applySchoolTemplate(p.schoolTemplate || 'generic'); } catch (e) {}
      }
    }
    return getCurrentProject();
  }

  function onManuscriptReady() {
    var p = getCurrentProject();
    if (!p) {
      p = createProject({
        title: '导入论文项目',
        idea: '从已有 DOCX 进入打磨与增强流程',
        mode: 'import',
        currentStage: 'literature',
        hasManuscript: true
      });
      p.stageStatus.ideation = 'done';
      p.stageStatus.literature = 'active';
      upsertProject(p);
    } else {
      updateCurrent({ hasManuscript: true, mode: p.mode === 'create' ? 'create' : 'import' });
    }
    // P1: align imported sections to project outline + chapter drafts
    try { syncSectionsToChapterDrafts(false); } catch (e) { console.warn('[import-sync]', e); }
    renderProjectChrome();
    if (typeof switchView === 'function') switchView('workspace');
    try { ensureUnifiedProjectState(); } catch (e) {}
    if (typeof ttp === 'function') ttp('论文已导入：已并入同一项目主线，请按清单继续');
  }

  // exports
  window.ThesisProject = {
    STAGES: STAGES,
    loadAll: loadAll,
    getCurrentProject: getCurrentProject,
    createProject: createProject,
    updateCurrent: updateCurrent,
    markStage: markStage,
    completeStage: completeStage,
    calcProgress: calcProgress,
    nextAction: nextAction,
    ensureDefaultProject: ensureDefaultProject,
    onManuscriptReady: onManuscriptReady,
    renderProjectChrome: renderProjectChrome,
    renderWorkspaceHero: renderWorkspaceHero,
    saveOutline: saveOutline,
    getOutline: getOutline,
    logSkillRun: logSkillRun,
    listChapterCards: listChapterCards,
    saveChapterDraft: saveChapterDraft,
    getChapterDraft: getChapterDraft,
    getVersionHistory: getVersionHistory,
    rollbackChapterVersion: rollbackChapterVersion,
  };
  window.openIdeaWizard = openIdeaWizard;
  window.closeIdeaWizard = closeIdeaWizard;
  window.submitIdeaWizard = submitIdeaWizard;
  window.openProjectStage = openProjectStage;
  window.completeCurrentStage = completeCurrentStage;
  window.runProjectAction = runProjectAction;
  window.renderWorkspaceHero = renderWorkspaceHero;
  window.openOutlineEditor = openOutlineEditor;
  window.closeOutlineEditor = closeOutlineEditor;
  window.fillDefaultOutline = fillDefaultOutline;
  window.saveOutlineEditor = saveOutlineEditor;
  // Chapter board
  function openChapterBoard() {
    var p = getCurrentProject();
    if (!p) { openIdeaWizard(); return; }
    var outline = getOutline();
    if (!outline) { if (confirm("没有大纲，先编辑吗？")) openOutlineEditor(); return; }
    closeChapterOverlays();
    var stats = chapterStats(p);
    var cards = stats.cards.map(function (c) {
      var b = c.status === "ready" ? "较完整" : (c.status === "draft" ? "草稿" : "空白");
      var bc = c.status === "ready" ? "ok" : (c.status === "draft" ? "warn" : "muted");
      return '<div class="chapter-card" onclick="openChapterEditor(\'' + c.key + '\')">' +
        '<div class="chapter-card-top"><b>' + escapeHtml(c.title) + '</b><span class="chapter-badge ' + bc + '">' + b + '</span></div>' +
        '<div class="chapter-card-meta">' + c.words + ' 字 · 引用 ' + ((c.content||'').match(/\[\d+\]/g)||[]).length + ' 处 · 引用 ' + ((c.content||'').match(/\[\d+\]/g)||[]).length + ' 处 · ' + (c.sections.length||0) + ' 小节' + (c.updatedAt ? ' · ' + formatTime(c.updatedAt) : '') + '</div>' +
        '<div class="chapter-card-preview">' + escapeHtml((c.content||'小节：'+(c.sections.join('、')||'待补充')).slice(0,80)) + '</div>' +
        '<div class="chapter-card-actions" onclick="event.stopPropagation()"><button class="ai-btn-clear" onclick="openChapterEditor(\''+c.key+'\')">编辑</button><button class="ai-btn-clear" onclick="seedChapterFromSections(\''+c.key+'\')">小节骨架</button></div>' +
      '</div>';
    }).join("");
    var ov = document.createElement('div'); ov.id = 'chapterBoardOverlay'; ov.className = 'project-overlay';
    ov.innerHTML = '<div class="project-modal chapter-board-modal" onclick="event.stopPropagation()">' +
      '<div class="project-modal-head"><div><h3>分章草稿看板</h3><p>按大纲拆成章节卡片</p></div><button class="project-close" onclick="closeChapterOverlays()">×</button></div>' +
      '<div class="project-progress-sub" style="margin-bottom:10px">完整 ' + stats.ready + '/' + stats.total + ' · ' + stats.words + ' 字</div>' +
      '<div class="chapter-card-grid">' + cards + '</div>' +
      '<div class="project-modal-actions"><button class="ai-btn-clear" onclick="openOutlineEditor()">调整大纲</button><button class="ai-btn-clear" onclick="closeChapterOverlays()">关闭</button><button class="ai-btn" onclick="closeChapterOverlays();switchModule("expand")">去论文扩写</button></div></div>';
    ov.onclick = function () { closeChapterOverlays(); };
    document.body.appendChild(ov);
  }
  function closeChapterOverlays() {
    ['chapterBoardOverlay','chapterEditorOverlay'].forEach(function(id){ var el=document.getElementById(id); if(el&&el.parentNode)el.parentNode.removeChild(el); });
  }
  function findChapterMeta(key) {
    var p = getCurrentProject(); if (!p) return null;
    var o = getOutline(); if (!o||!o.chapters) return null;
    for (var i=0;i<o.chapters.length;i++) { var ch=o.chapters[i]; if (chapterKey(ch.title,i)===key) return {key:key,title:ch.title,sections:ch.sections||[],idx:i}; }
    return null;
  }
  function openChapterEditor(key) {
    var p=getCurrentProject(); if(!p){openIdeaWizard();return;}
    var m=findChapterMeta(key); if(!m){alert("未找到该章节");return;}
    closeChapterOverlays();
    var d=getChapterDraft(key)||{content:"",status:"empty"};
    var ov=document.createElement('div');ov.id='chapterEditorOverlay';ov.className='project-overlay';
    ov.innerHTML='<div class="project-modal chapter-editor-modal" onclick="event.stopPropagation()">'+
      '<div class="project-modal-head"><div><h3>写作：'+escapeHtml(m.title)+'</h3><p>先写骨架，再调用扩写细化。内容保存在当前项目。</p></div><button class="project-close" onclick="closeChapterOverlays()">×</button></div>'+
      '<div class="project-form"><div class="chapter-sec-tags">'+(m.sections.length?m.sections.map(function(s){return'<span class="chapter-sec-tag">'+escapeHtml(s)+'</span>';}).join(''):'')+'</div>'+
      '<label>本章草稿</label><textarea id="chapterContent" class="ai-textarea" style="height:320px;margin:0" placeholder="在这里写内容/提纲/论据要点..."></textarea></div>'+
      '<button class="ai-btn-clear" onclick="seedChapterFromSections(\''+key+'\',true)">插入小节骨架</button><button class="ai-btn-clear" onclick="insertCiteMarkers(\''+key+'\')">插入文献引用标记</button><button class="ai-btn-clear" onclick="insertRefsIntoDraft(\''+key+'\')">插入参考文献</button><button class="ai-btn-clear" onclick="expandChapterAI(\''+key+'\')">🤖 AI 扩写</button><button class="ai-btn-clear" onclick="showVersionHistory(\''+key+'\')">📜 版本历史</button><button class="ai-btn-clear" onclick="closeChapterOverlays()">取消</button><button class="ai-btn" onclick="saveChapterEditor(\''+key+'\')">保存本章</button></div></div>';
    ov.onclick=function(){closeChapterOverlays();};
    document.body.appendChild(ov);
    document.getElementById('chapterContent').value=d.content||'';
  }
  function seedChapterFromSections(key,inEditor){
    var m=findChapterMeta(key);if(!m)return;
    var sk=m.title+'\n\n'+(m.sections||[]).map(function(s,i){return (i+1)+'. '+s+'\n(在此补充论据、文献与分析)\n';}).join('\n');
    if(inEditor){var ta=document.getElementById('chapterContent');if(!ta)return;if(ta.value&&ta.value.trim()){if(!confirm('已有内容，确认开头插入骨架？'))return;ta.value=sk+'\n'+ta.value;}else ta.value=sk;return;}
    var prev=getChapterDraft(key);
    if(prev&&prev.content&&prev.content.trim()){if(!confirm('该章已有草稿，覆盖为骨架？'))return;}
    saveChapterDraft(key,{title:m.title,sections:m.sections,content:sk,status:'draft'});
    logSkillRun({moduleId:'chapter-seed',title:'生成章节骨架',summary:m.title});
    closeChapterOverlays();openChapterBoard();
    if(typeof ttp==='function')ttp('已生成骨架：'+m.title);
  }
  function saveChapterEditor(key){
    var m=findChapterMeta(key);if(!m)return;
    var ct=(document.getElementById('chapterContent').value||''),w=ct.replace(/\s+/g,'').length;
    saveChapterDraft(key,{title:m.title,sections:m.sections,content:ct,status:w<1?'empty':(w<300?'draft':'ready')});
    logSkillRun({moduleId:'chapter-editor',title:'保存章节草稿',summary:m.title+' · '+w+' 字'});
    closeChapterOverlays();renderProjectChrome();
    try{refreshOpenProjectUIs();}catch(e){}
    if(typeof ttp==='function')ttp('已保存：'+m.title+'('+w+'字)');
  }

  function expandChapterAI(key) {
    var meta=findChapterMeta(key); if(!meta) return;
    var draft=getChapterDraft(key)||{content:''};
    if(!draft.content||draft.content.trim().length<20){alert('请先在草稿中写一些内容（至少20字），再调用 AI 扩写');return;}
    if(!confirm('将使用 AI 对本章进行扩写与充实。确定继续？')) return;
    var token=sessionStorage.getItem('thesis_ai_token'); if(!token){alert('请先登录');return;}
    closeChapterOverlays();
    if(typeof showLoad==='function') showLoad('AI 扩写中...',10,meta.title);
    var sp='你是学术论文导师，擅长充实论文章节。请基于提供的章节草稿进行扩写，保持学术语气，补充论据和解释，不变更核心论点与结构。用中文输出完整扩写后内容。';
    var up='章节标题：'+meta.title+'\n小节：'+(meta.sections||[]).join('、')+'\n\n当前草稿：\n'+draft.content.substring(0,6000)+'\n\n请扩写充实，补充论据与学术引用。';
    fetch('/api/llm/analyze',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({module:'chapter-expand',system_prompt:sp,user_prompt:up,max_tokens:3000})})
    .then(function(r){return r.json()}).then(function(d){
      if(typeof hideLoad==='function') hideLoad();
      if(d.success){
        var ex=d.content.replace(/</g,'&lt;').replace(/>/g,'&gt;');
        saveChapterDraft(key,{title:meta.title,sections:meta.sections,content:ex,status:'ready'});
        logSkillRun({moduleId:'chapter-expand-ai',title:'AI扩写章节',summary:meta.title});
        renderProjectChrome();
        if(typeof ttp==='function')ttp('AI扩写完成：'+meta.title);
      }else{alert('AI扩写出错: '+(d.error||'未知错误'));}
    }).catch(function(){if(typeof hideLoad==='function')hideLoad();alert('网络错误，请重试');});
  }

  function insertRefsIntoDraft(key){
    var meta=findChapterMeta(key); if(!meta) return;
    var draft=getChapterDraft(key)||{content:''};
    var refs=(typeof mergedRefs!=='undefined'&&mergedRefs.length)?mergedRefs:(typeof existingRefs!=='undefined'?existingRefs:[]);
    if(!refs.length){alert('还没有检索文献。请先检索参考文献。');return;}
    closeChapterOverlays();
    var pool=refs.filter(function(r){return(r.ch===(meta.idx+1)||r._chName===('第'+(meta.idx+1)+'章'));});
    if(pool.length<2) pool=refs;
    var sample=pool.slice(0,6).map(function(r,i){return '['+(i+1)+'] '+(r.ci||r.title||'').substring(0,120);}).join('\n');
    var ov=document.createElement('div');ov.id='refsPickerOverlay';ov.className='project-overlay';
    ov.innerHTML='<div class="project-modal" style="width:min(560px,100%)" onclick="event.stopPropagation()">'+
      '<div class="project-modal-head"><div><h3>插入参考文献</h3><p>优先本章关联，备选全库前6条</p></div><button class="project-close" onclick="closeRefsPicker()">×</button></div>'+
      '<div style="max-height:36vh;overflow:auto;font-size:.7rem;line-height:1.8;padding:4px">'+sample.replace(/\n/g,'<br>')+'</div>'+
      '<div class="project-form" style="margin-top:12px"><label>插入到章节开头（可编辑后保存）</label>'+
      '<textarea id="refsInsertText" class="ai-textarea" style="height:120px;margin:0">'+escapeHtml(sample)+'</textarea></div>'+
      '<div class="project-modal-actions"><button class="ai-btn-clear" onclick="closeRefsPicker()">取消</button>'+
      '<button class="ai-btn" onclick="confirmRefsInsert(\''+key+'\')">插入到草稿</button></div></div>';
    ov.onclick=function(){closeRefsPicker();};
    document.body.appendChild(ov);
    logSkillRun({moduleId:'refs-insert',title:'打开参考文献选择',summary:meta.title});
  }
  function closeRefsPicker(){
    var ov=document.getElementById('refsPickerOverlay');
    if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);
  }
  function confirmRefsInsert(key){
    var refText=(document.getElementById('refsInsertText').value||'').trim();
    if(!refText)return;
    var draft=getChapterDraft(key)||{content:''};
    var meta=findChapterMeta(key);
    saveChapterDraft(key,{title:meta?meta.title:'',sections:meta?meta.sections:[],content:refText+'\n\n'+(draft.content||''),status:'draft'});
    logSkillRun({moduleId:'refs-insert',title:'插入参考文献',summary:meta?meta.title:''});
    closeRefsPicker();openChapterEditor(key);
    if(typeof ttp==='function')ttp('已插入到草稿，可继续编辑保存');
  }

  window.openChapterBoard = openChapterBoard;
  window.closeChapterOverlays = closeChapterOverlays;
  window.openChapterEditor = openChapterEditor;
  window.seedChapterFromSections = seedChapterFromSections;
  window.saveChapterEditor = saveChapterEditor;
  window.expandChapterAI = expandChapterAI;
  window.insertRefsIntoDraft = insertRefsIntoDraft;
  window.closeRefsPicker = closeRefsPicker;
  window.confirmRefsInsert = confirmRefsInsert;
  window.openProjectSwitcher = openProjectSwitcher;
  window.closeProjectSwitcher = closeProjectSwitcher;
  window.switchToProject = switchToProject;
  window.deleteProject = deleteProject;
  window.refreshOpenProjectUIs = refreshOpenProjectUIs;
  window.exportFullPaper = exportFullPaper;
  window.exportFullPaperDocx = exportFullPaperDocx;
  window.buildPaperPayload = buildPaperPayload;
  window.openProjectSettings = openProjectSettings;
  window.closeProjectSettings = closeProjectSettings;
  window.saveProjectSettings = saveProjectSettings;

  // ===== P0: Citation closed loop =====
  function getRefLibrary() {
    var refs = (typeof mergedRefs !== 'undefined' && mergedRefs && mergedRefs.length) ? mergedRefs
      : ((typeof existingRefs !== 'undefined' && existingRefs) ? existingRefs : []);
    return refs || [];
  }

  function normalizeRefNum(r, idx) {
    var n = parseInt(r.displayNum || r.num || (idx + 1), 10);
    return isNaN(n) ? (idx + 1) : n;
  }

  function insertCiteMarkers(key) {
    var meta = findChapterMeta(key);
    if (!meta) { alert('未找到章节'); return; }
    var ta = document.getElementById('chapterContent');
    if (!ta) { alert('请先打开章节编辑器'); return; }
    var text = ta.value || '';
    if (text.trim().length < 20) { alert('请先写一些内容，再插入引用标记'); return; }
    var refs = getRefLibrary();
    if (!refs.length) {
      if (confirm('还没有文献库。是否先打开参考文献模块？')) {
        if (typeof switchView === 'function') switchView('references');
      }
      return;
    }

    // Prefer chapter-associated refs, else whole library
    var chNo = (meta.idx || 0) + 1;
    var pool = refs.filter(function(r){
      return r.ch === chNo || r._chName === ('第' + chNo + '章') || String(r.ch) === String(chNo);
    });
    if (pool.length < 2) pool = refs.slice();
    // map to stable numbers from library order
    var nums = [];
    refs.forEach(function(r, i) {
      var n = normalizeRefNum(r, i);
      if (pool.indexOf(r) >= 0) nums.push(n);
    });
    nums = Array.from(new Set(nums)).sort(function(a,b){return a-b;}).slice(0, 12);
    if (!nums.length) nums = refs.slice(0, 8).map(function(r,i){return normalizeRefNum(r,i);});

    // Split by sentence end; insert markers deterministically on every 2nd sentence
    var parts = text.split(/([。！？!?])/);
    var out = [];
    var sent = 0;
    var ni = 0;
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      out.push(part);
      if (/[。！？!?]/.test(part)) {
        sent++;
        // avoid double markers
        var prev = out.join('');
        if (sent % 2 === 0 && ni < nums.length && !/\[\d+\]\s*$/.test(prev)) {
          out.push('[' + nums[ni++] + ']');
        }
      }
    }
    var result = out.join('');
    // ensure at least 3 markers if possible
    var have = (result.match(/\[\d+\]/g) || []).length;
    if (have < 3 && nums.length) {
      var extra = [];
      for (var k = 0; k < nums.length && have + extra.length < 3; k++) {
        if (result.indexOf('[' + nums[k] + ']') < 0) extra.push('[' + nums[k] + ']');
      }
      if (extra.length) result = result.replace(/([。！？!?])/g, function(m, p1, offset) {
        if (extra.length && offset > result.length * 0.2) return p1 + extra.shift();
        return m;
      });
      // fallback append
      if (extra.length) result += ' ' + extra.join('');
    }
    ta.value = result;
    var used = (result.match(/\[\d+\]/g) || []).length;
    logSkillRun({ moduleId: 'cite-markers', title: '插入文献引用标记', summary: meta.title + ' · ' + used + ' 处' });
    if (typeof ttp === 'function') ttp('已按文献库编号插入 ' + used + ' 处引用标记，可点击预览跳转');
    // refresh preview
    renderCitePreview(key);
  }

  function renderCitePreview(key) {
    var ta = document.getElementById('chapterContent');
    var box = document.getElementById('citePreviewBox');
    if (!ta || !box) return;
    var html = escapeHtml(ta.value || '');
    html = html.replace(/\[(\d+)\]/g, '<a href="javascript:void(0)" class="cite-link" onclick="jumpToReference($1)">[$1]</a>');
    html = html.replace(/\n/g, '<br>');
    box.innerHTML = html || '<span class="project-progress-sub">正文预览（引用标记可点击跳转文献）</span>';
  }

  // enhance jumpToReference: open refs panel first
  function jumpToReference(num) {
    num = parseInt(num, 10);
    if (!num || num < 1) return;
    if (typeof switchView === 'function') {
      try { switchView('references'); } catch (e) {}
    }
    setTimeout(function() {
      var el = document.getElementById('r' + (num - 1)) || document.getElementById('er' + (num - 1));
      // also try data-num attributes
      if (!el) {
        el = document.querySelector('[data-ref-num="' + num + '"]') || document.querySelector('#refs [data-num="' + num + '"]');
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background .3s';
        el.style.background = 'rgba(99,102,241,.14)';
        setTimeout(function() { el.style.background = ''; }, 2200);
        if (typeof ttp === 'function') ttp('已定位参考文献 [' + num + ']');
      } else {
        if (typeof ttp === 'function') ttp('未找到文献 [' + num + ']，请先完成文献提取/检索');
      }
    }, 120);
  }

  // ===== P1: import sections -> chapter drafts =====
  function syncSectionsToChapterDrafts(force) {
    if (typeof sections === 'undefined' || !sections || !sections.length) return null;
    var p = getCurrentProject();
    if (!p) {
      p = createProject({
        title: '导入论文项目',
        idea: '从已有 DOCX 进入打磨与增强流程',
        mode: 'import',
        currentStage: 'literature',
        hasManuscript: true
      });
      p.stageStatus.ideation = 'done';
      p.stageStatus.literature = 'active';
      upsertProject(p);
    }
    var arts = ensureArtifacts(p);
    // Build outline from imported sections if missing or force
    var outlineChapters = sections.map(function(cs, idx) {
      var secs = (cs.sections || []).map(function(s) { return (s.num ? (s.num + ' ') : '') + (s.title || ''); });
      return { title: cs.name || ('第' + (cs.ch || (idx + 1)) + '章'), sections: secs };
    });
    if (force || !arts.outline || !arts.outline.chapters || !arts.outline.chapters.length) {
      arts.outline = { title: p.title, chapters: outlineChapters, updatedAt: nowISO(), source: 'import' };
    }
    // Fill chapter drafts from section text if empty
    var filled = 0;
    outlineChapters.forEach(function(ch, idx) {
      var key = chapterKey(ch.title, idx);
      var prev = arts.chapters[key];
      var src = sections[idx] || {};
      var content = (src.text || '').trim();
      // include subsections text lightly
      if ((!content || content.length < 20) && src.sections) {
        content = (src.sections || []).map(function(s) {
          return ((s.num || '') + ' ' + (s.title || '')).trim() + '\n' + (s.text || '');
        }).join('\n\n').trim();
      }
      if (!content) return;
      if (prev && prev.content && prev.content.trim() && !force) return; // don't overwrite user drafts
      arts.chapters[key] = {
        key: key,
        title: ch.title,
        sections: ch.sections || [],
        content: content,
        status: content.replace(/\s+/g, '').length >= 300 ? 'ready' : 'draft',
        updatedAt: nowISO(),
        createdAt: (prev && prev.createdAt) || nowISO(),
        source: 'import'
      };
      filled++;
    });
    p.hasManuscript = true;
    if (p.mode !== 'create') p.mode = 'import';
    p.updatedAt = nowISO();
    upsertProject(p);
    logSkillRun({ moduleId: 'import-sync', title: '导入结构同步到分章草稿', summary: '填充 ' + filled + ' 章 · 共 ' + sections.length + ' 章' });
    return p;
  }


  window.insertCiteMarkers = insertCiteMarkers;
  window.openTemplateChooser = openTemplateChooser;
  window.closeTemplateChooser = closeTemplateChooser;
  
  function openTemplateChooser() {
    // simplified: no complex template export; only apply outline structure
    var p = getCurrentProject();
    if (!p) { openIdeaWizard(); return; }
    var html = '<div style="display:flex;flex-direction:column;gap:8px">';
    SCHOOL_TEMPLATES.forEach(function(tpl) {
      html += '<button class="ai-btn-clear" style="text-align:left;padding:10px 12px" onclick="applySchoolTemplate(\'' + tpl.id + '\');closeTemplateChooser();">' +
        '<b>' + escapeHtml(tpl.name) + '</b><br><span style="font-size:.65rem;color:var(--text-muted)">' + escapeHtml(tpl.styleNotes) + '</span></button>';
    });
    html += '</div>';
    var ov = document.createElement('div');
    ov.id = 'templateChooserOverlay';
    ov.className = 'project-overlay';
    ov.innerHTML = '<div class="project-modal" style="width:min(520px,94vw)" onclick="event.stopPropagation()">' +
      '<div class="project-modal-head"><div><h3>选择学校大纲模板</h3><p>仅套用章节结构与字数目标，不改变导出样式</p></div>' +
      '<button class="project-close" onclick="closeTemplateChooser()">×</button></div>' + html +
      '<div class="project-modal-actions"><button class="ai-btn-clear" onclick="closeTemplateChooser()">关闭</button></div></div>';
    ov.onclick = function(){ closeTemplateChooser(); };
    document.body.appendChild(ov);
  }
  function closeTemplateChooser() {
    var ov = document.getElementById('templateChooserOverlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }
  function applySchoolTemplate(templateId) {
    var tpl = null;
    for (var i = 0; i < SCHOOL_TEMPLATES.length; i++) {
      if (SCHOOL_TEMPLATES[i].id === templateId) { tpl = SCHOOL_TEMPLATES[i]; break; }
    }
    if (!tpl) {
      // generic fallback
      tpl = SCHOOL_TEMPLATES[SCHOOL_TEMPLATES.length - 1];
    }
    var p = getCurrentProject();
    if (!p) return null;
    var outline = {
      title: p.title,
      chapters: (tpl.outline || []).map(function(ch) {
        return { title: ch.title, sections: (ch.sections || []).slice() };
      }),
      updatedAt: nowISO(),
      source: 'template:' + tpl.id
    };
    saveOutline(outline);
    // seed empty chapter drafts for each outline chapter
    var arts = ensureArtifacts(p);
    outline.chapters.forEach(function(ch, idx) {
      var key = chapterKey(ch.title, idx);
      if (!arts.chapters[key] || !(arts.chapters[key].content || '').trim()) {
        var skeleton = ch.title + '\n\n' + (ch.sections || []).map(function(s, i) {
          return (i + 1) + '. ' + s + '\n（待完善）\n';
        }).join('\n');
        arts.chapters[key] = {
          key: key, title: ch.title, sections: ch.sections || [], content: skeleton,
          status: 'draft', updatedAt: nowISO(), createdAt: nowISO(), source: 'template'
        };
      }
    });
    updateCurrent({
      schoolTemplate: tpl.id,
      degree: p.degree || tpl.degree || '硕士',
      goalWords: p.goalWords || tpl.minWords || 30000
    });
    // re-get and persist artifacts
    p = getCurrentProject();
    if (p) {
      p.artifacts = arts;
      upsertProject(p);
    }
    logSkillRun({ moduleId: 'school-template', title: '应用学校大纲模板', summary: tpl.name });
    renderProjectChrome();
    if (typeof ttp === 'function') ttp('已应用模板：' + tpl.name);
    return p;
  }

  window.applySchoolTemplate = applySchoolTemplate;
  window.ideaTemplateChanged = ideaTemplateChanged;
  window.showVersionHistory = showVersionHistory;
  window.closeVersionHistory = closeVersionHistory;
  window.rollbackChapterVersion = rollbackChapterVersion;
  window.showVersionDiff = showVersionDiff;
  window.closeVersionDiff = closeVersionDiff;
  window.jumpToReference = jumpToReference;
  window.stageTips = stageTips;
  window.renderSmartTips = renderSmartTips;

  // ============ Version History Viewer ============

  function showVersionHistory(key) {
    var meta = findChapterMeta(key);
    if (!meta) return;
    var versions = getVersionHistory(key);
    var draft = getChapterDraft(key) || {};
    var rows = '';
    if (!versions.length) {
      rows = '<div class="project-progress-sub" style="text-align:center;padding:16px">暂无历史版本。多次保存章节后自动记录。</div>';
    } else {
      rows = versions.map(function(v) {
        return '<div class="version-row">' +
          '<div class="version-top"><b>' + formatTime(v.ts) + '</b><span>' + v.words + ' 字</span></div>' +
          '<div class="version-preview">' + escapeHtml(v.content.substring(0, 100)) + (v.content.length > 100 ? '...' : '') + '</div>' +
          '<button class="ai-btn-clear" onclick="showVersionDiff(\'' + key + '\',\'' + v.ts + '\')">对比</button>' +
          '<button class="ai-btn-clear" onclick="rollbackChapterVersion(\'' + key + '\',\'' + v.ts + '\')">恢复此版本</button>' +
        '</div>';
      }).join('');
    }
    var currentWords = (draft.content || '').replace(/\s/g, '').length;
    var ov = document.createElement('div');
    ov.id = 'versionHistoryOverlay';
    ov.className = 'project-overlay';
    ov.innerHTML = '' +
      '<div class="project-modal" style="width:min(520px,100%)" onclick="event.stopPropagation()">' +
        '<div class="project-modal-head"><div><h3>版本历史：' + escapeHtml(meta.title) + '</h3><p>当前：' + currentWords + ' 字</p></div><button class="project-close" onclick="closeVersionHistory()">x</button></div>' +
        '<div style="max-height:55vh;overflow:auto">' + rows + '</div>' +
        '<div class="project-modal-actions"><button class="ai-btn-clear" onclick="closeVersionHistory()">关闭</button></div>' +
      '</div>';
    ov.onclick = function() { closeVersionHistory(); };
    document.body.appendChild(ov);
  }

  function closeVersionHistory() {
    var ov = document.getElementById('versionHistoryOverlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function showVersionDiff(key, ts) {
    var meta = findChapterMeta(key);
    if (!meta) return;
    var versions = getVersionHistory(key);
    var found = null;
    for (var i = 0; i < versions.length; i++) { if (versions[i].ts === ts) { found = versions[i]; break; } }
    if (!found) { alert('未找到该版本'); return; }
    var current = getChapterDraft(key) || { content: '' };
    closeVersionHistory();
    var curText = current.content || '';
    var prevText = found.content || '';
    var curLines = curText.split('\n');
    var prevLines = prevText.split('\n');
    var allLines = Math.max(curLines.length, prevLines.length);
    var diff = [];
    for (var i = 0; i < allLines; i++) {
      var pl = i < prevLines.length ? prevLines[i] : '';
      var cl = i < curLines.length ? curLines[i] : '';
      if (pl === cl) { diff.push({ type: 'same', prev: pl, cur: cl }); }
      else if (!pl) { diff.push({ type: 'added', prev: '', cur: cl }); }
      else if (!cl) { diff.push({ type: 'removed', prev: pl, cur: '' }); }
      else { diff.push({ type: 'changed', prev: pl, cur: cl }); }
    }
    var rows = diff.map(function(d) {
      var style = 'background:transparent;';
      if (d.type === 'added') style = 'background:rgba(16,185,129,.08);';
      if (d.type === 'removed') style = 'background:rgba(239,68,68,.06);';
      if (d.type === 'changed') style = 'background:rgba(245,158,11,.05);';
      return '<div style="' + style + 'font-size:.64rem;line-height:1.6;padding:2px 6px;font-family:var(--font-mono)">' +
        (d.prev ? '<span style="text-decoration:line-through;color:rgba(239,68,68,.5)">' + escapeHtml(d.prev) + '</span><br>' : '') +
        (d.cur ? '<span style="color:var(--text-primary)">' + escapeHtml(d.cur) + '</span>' : '') +
      '</div>';
    }).join('');
    var curWords = curText.replace(/\s/g, '').length;
    var ov = document.createElement('div');
    ov.id = 'versionDiffOverlay';
    ov.className = 'project-overlay';
    ov.innerHTML = '' +
      '<div class="project-modal" style="width:min(820px,95%)" onclick="event.stopPropagation()">' +
        '<div class="project-modal-head"><div><h3>版本对比：' + escapeHtml(meta.title) + '</h3><p>历史版本 (' + formatTime(ts) + ' &middot; ' + found.words + '字) &nbsp; &rarr; &nbsp; 当前版本 (' + curWords + '字)</p></div><button class="project-close" onclick="closeVersionDiff()">x</button></div>' +
        '<div style="max-height:60vh;overflow:auto;padding:4px">' + rows + '</div>' +
        '<div class="project-modal-actions">' +
          '<button class="ai-btn-clear" onclick="closeVersionDiff()">关闭</button>' +
          '<button class="ai-btn" onclick="closeVersionDiff();rollbackChapterVersion(\'' + key + '\',\'' + ts + '\')">恢复到此历史版本</button>' +
        '</div>' +
      '</div>';
    ov.onclick = function() { closeVersionDiff(); };
    document.body.appendChild(ov);
  }

  function closeVersionDiff() {
    var ov = document.getElementById('versionDiffOverlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  // ============ Citation Jumping ============

  function jumpToReference(num) {
    if (num < 1) return;
    var el = document.getElementById('r' + (num - 1)) || document.getElementById('er' + (num - 1));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background .3s';
      el.style.background = 'rgba(99,102,241,.12)';
      setTimeout(function() { el.style.background = ''; }, 2000);
      if (typeof ttp === 'function') ttp('已定位参考文献 [' + num + ']');
    } else {
      if (typeof ttp === 'function') ttp('未找到 [' + num + ']，请先在参考文献模块中检索');
    }
  }

  // ============ Smart Stage Tips ============

  function stageTips(project) {
    if (!project) return [];
    var tips = [];
    var stats = chapterStats(project);
    var stage = project.currentStage || 'ideation';

    if (stage === 'ideation') {
      if (!project.field) tips.push({ title: '先确定学科领域', desc: '在项目设置中填写领域，选题推荐会更精准' });
      if (!project.keywords) tips.push({ title: '补充关键词', desc: '关键词帮你聚焦研究方向' });
      tips.push({ title: '试试选题推荐', desc: '输入领域后 AI 可推荐 5 个可行题目' });
    } else if (stage === 'literature') {
      tips.push({ title: '文献检索策略', desc: '先用主题词检索，再看每章关联文献密度' });
    } else if (stage === 'writing') {
      if (stats.total < 3) tips.push({ title: '大纲不完整', desc: '至少 5 章才算标准硕士论文结构' });
      if (stats.words < 1000) tips.push({ title: '开始写第一段', desc: '打开分章草稿，从绪论或最熟的一章开始' });
      if (stats.ready > 0 && stats.ready < stats.total) tips.push({ title: '章节进度：' + stats.ready + '/' + stats.total, desc: '用 AI 扩写提升草稿完成度' });
      if (stats.words > 5000) tips.push({ title: '考虑插入文献', desc: '用章节编辑器插入引用标记标注关键位置' });
    } else if (stage === 'polish') {
      tips.push({ title: '逐章查错', desc: '用论文查错逐章扫描' });
      tips.push({ title: '降重建议', desc: '复制容易重复的段落到查重降重模块' });
    } else if (stage === 'review') {
      tips.push({ title: '看十维看板', desc: '论文看板会告诉你哪些维度偏低' });
    } else if (stage === 'defense') {
      tips.push({ title: '答辩准备', desc: '先跑英文摘要润色，再生成答辩 PPT 大纲' });
    }
    return tips.slice(0, 3);
  }

  function renderSmartTips(project) {
    var tips = stageTips(project);
    if (!tips.length) return '';
    return '<div class="project-smart-tips">' +
      '<div class="smart-tips-head">写作提示</div>' +
      tips.map(function(t) { return '<div class="smart-tip-item"><b>' + escapeHtml(t.title) + '</b><p>' + escapeHtml(t.desc) + '</p></div>'; }).join('') +
    '</div>';
  }

  // ============ Export Full Paper ============
  function buildPaperPayload() {
    var p = getCurrentProject();
    if (!p) return null;
    var outline = getOutline();
    var refs = getRefLibrary();
    var chapters = [];
    if (outline && outline.chapters) {
      outline.chapters.forEach(function(ch, idx) {
        var key = chapterKey(ch.title, idx);
        var d = getChapterDraft(key) || {};
        chapters.push({ title: ch.title, sections: ch.sections || [], content: d.content || '' });
      });
    }
    return {
      title: (outline && outline.title) || p.title || '论文草稿',
      field: p.field || '',
      degree: p.degree || '',
      idea: p.idea || '',
      chapters: chapters,
      references: refs.map(function(r, i) {
        return { num: normalizeRefNum(r, i), text: (r.ci || r.title || '').replace(/<[^>]+>/g, '') };
      })
    };
  }

  function exportFullPaperDocx() {
    var payload = buildPaperPayload();
    if (!payload) { alert('请先创建项目'); return; }
    if (!payload.chapters.length) { alert('请先编辑大纲/分章草稿'); return; }
    var token = sessionStorage.getItem('thesis_ai_token');
    if (!token) { alert('请先登录'); return; }
    if (typeof showLoad === 'function') showLoad('正在导出 DOCX...', 20, payload.title);
    fetch('/api/export/docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(payload)
    }).then(function(r) {
      if (!r.ok) return r.json().then(function(j){ throw new Error(j.error || ('HTTP ' + r.status)); });
      return r.blob();
    }).then(function(blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (payload.title || '论文').replace(/[\\/:\s]+/g, '_') + '.docx';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
      logSkillRun({ moduleId: 'export-docx', title: '导出 DOCX', summary: payload.chapters.length + ' 章' });
      if (typeof ttp === 'function') ttp('DOCX 已导出');
    }).catch(function(e) {
      alert('DOCX 导出失败：' + (e.message || e) + '。将回退为 TXT 导出。');
      exportFullPaper();
    }).finally(function(){ if (typeof hideLoad === 'function') hideLoad(); });
  }

  function exportFullPaper() {
    var p = getCurrentProject();
    if (!p) { alert('请先创建项目'); return; }
    var outline = getOutline();
    if (!outline) { alert('请先编辑论文大纲，再导出'); return; }
    var lines = [];
    lines.push(outline.title || p.title);
    lines.push('');
    lines.push(p.field ? '领域：' + p.field : '');
    lines.push(p.degree ? '学位：' + p.degree : '');
    lines.push('');
    var stats = chapterStats(p);
    outline.chapters.forEach(function (ch, idx) {
      var key = chapterKey(ch.title, idx);
      var draft = getChapterDraft(key);
      var content = draft && draft.content ? draft.content.trim() : '';
      lines.push(ch.title);
      lines.push('');
      if (content) {
        lines.push(content);
      } else {
        lines.push('（本章暂无草稿）');
        if (ch.sections && ch.sections.length) {
          ch.sections.forEach(function (s) { lines.push('- ' + s); });
        }
      }
      lines.push('');
    });
    lines.push('---');
    lines.push('导出时间：' + new Date().toLocaleString());
    lines.push('总字数（章节草稿合计）：' + stats.words + ' 字');
    lines.push('');
    var refs = (typeof mergedRefs !== 'undefined' && mergedRefs.length) ? mergedRefs : (typeof existingRefs !== 'undefined' ? existingRefs : []);
    if (refs.length) {
      lines.push('=== 参考文献 ===');
      refs.forEach(function (r, i) {
        var t = r.ci || (r.title || '').replace(/<[^>]+>/g, '');
        lines.push('[' + (i + 1) + '] ' + t.substring(0, 300));
      });
    }
    var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (outline.title || '论文草稿').replace(/[\\/:\s]+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    logSkillRun({ moduleId: 'export', title: '导出论文全文', summary: stats.words + ' 字 · ' + outline.chapters.length + ' 章' });
    if (typeof ttp === 'function') ttp('已导出论文草稿（' + stats.words + ' 字）');
  }

  // ============ Project Settings ============
  function openProjectSettings() {
    var p = getCurrentProject();
    if (!p) { openIdeaWizard(); return; }
    closeProjectSettings();
    var ov = document.createElement('div');
    ov.id = 'projectSettingsOverlay';
    ov.className = 'project-overlay';
    ov.innerHTML =
      '<div class="project-modal" style="width:min(520px,100%)" onclick="event.stopPropagation()">' +
        '<div class="project-modal-head">' +
          '<div><h3>项目设置</h3><p>调整基本信息与写作目标</p></div>' +
          '<button class="project-close" onclick="closeProjectSettings()">×</button>' +
        '</div>' +
        '<div class="project-form">' +
          '<label>论文题目</label><input id="setTitle" class="ai-input" value="' + escapeHtml(p.title) + '">' +
          '<div class="project-grid-2">' +
            '<div><label>学科/领域</label><input id="setField" class="ai-input" value="' + escapeHtml(p.field || '') + '"></div>' +
            '<div><label>学位类型</label><select id="setDegree" class="ai-input"><option ' + (p.degree === '硕士' ? 'selected' : '') + '>硕士</option><option ' + (p.degree === '本科' ? 'selected' : '') + '>本科</option><option ' + (p.degree === '博士' ? 'selected' : '') + '>博士</option></select></div>' +
          '</div>' +
          '<div class="project-grid-2">' +
            '<div><label>目标字数</label><input id="setGoalWords" class="ai-input" type="number" value="' + (p.goalWords || 30000) + '" min="5000" max="200000"></div>' +
            '<div><label>关键词</label><input id="setKeywords" class="ai-input" value="' + escapeHtml(p.keywords || '') + '"></div>' +
          '</div>' +
          '<label>研究想法 / 摘要</label><textarea id="setIdea" class="ai-textarea" style="height:80px;margin:0">' + escapeHtml(p.idea || '') + '</textarea>' +
        '</div>' +
        '<div class="project-modal-actions">' +
          '<button class="ai-btn-clear" onclick="closeProjectSettings()">取消</button>' +
          '<button class="ai-btn" onclick="saveProjectSettings()">保存设置</button>' +
        '</div>' +
      '</div>';
    ov.onclick = function () { closeProjectSettings(); };
    document.body.appendChild(ov);
  }

  function closeProjectSettings() {
    var ov = document.getElementById('projectSettingsOverlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function saveProjectSettings() {
    var p = getCurrentProject();
    if (!p) return;
    var title = (document.getElementById('setTitle').value || '').trim() || p.title;
    var field = (document.getElementById('setField').value || '').trim();
    var degree = document.getElementById('setDegree').value || p.degree;
    var goal = parseInt(document.getElementById('setGoalWords').value) || p.goalWords || 30000;
    var keywords = (document.getElementById('setKeywords').value || '').trim();
    var idea = (document.getElementById('setIdea').value || '').trim();
    updateCurrent({ title: title, field: field, degree: degree, goalWords: goal, keywords: keywords, idea: idea });
    closeProjectSettings();
    renderProjectChrome();
    if (typeof ttp === 'function') ttp('项目设置已保存');
  }

  window.syncSectionsToChapterDrafts = syncSectionsToChapterDrafts;
  window.renderCitePreview = renderCitePreview;

  function buildMergedHtmlFromDrafts(project) {
    var payload = buildPaperPayload ? buildPaperPayload() : null;
    if (!payload) return '';
    var html = '';
    html += '<div class="merged-paper">';
    html += '<h1 class="merged-title">' + escapeHtml(payload.title || project.title || '论文草稿') + '</h1>';
    if (payload.degree || payload.field) {
      html += '<p class="merged-meta">' + escapeHtml([payload.degree, payload.field].filter(Boolean).join(' · ')) + '</p>';
    }
    (payload.chapters || []).forEach(function(ch, idx) {
      html += '<section class="merged-chapter" id="merged-ch-' + idx + '">';
      html += '<h2>' + escapeHtml(ch.title || ('第'+(idx+1)+'章')) + '</h2>';
      var content = (ch.content || '').trim();
      if (content) {
        content.split(/\n+/).forEach(function(para){
          if (para.trim()) html += '<p>' + escapeHtml(para.trim()) + '</p>';
        });
      } else if (ch.sections && ch.sections.length) {
        ch.sections.forEach(function(s){ html += '<p><b>' + escapeHtml(s) + '</b></p><p>（待完善）</p>'; });
      } else {
        html += '<p>（本章暂无草稿）</p>';
      }
      html += '</section>';
    });
    if (payload.references && payload.references.length) {
      html += '<section class="merged-refs"><h2>参考文献</h2>';
      payload.references.forEach(function(r){
        html += '<p class="merged-ref-item">[' + (r.num || '') + '] ' + escapeHtml(r.text || '') + '</p>';
      });
      html += '</section>';
    }
    html += '</div>';
    return html;
  }

  function mergeDraftsIntoThesis() {
    var p = getCurrentProject();
    if (!p) { alert('请先创建项目'); return; }
    var outline = getOutline();
    if (!outline || !outline.chapters || !outline.chapters.length) {
      alert('请先保存大纲/分章草稿');
      return;
    }
    var box = document.getElementById('thesisBox');
    if (!box) return;
    if (!confirm('将把分章草稿合并到中间工作区（会覆盖当前工作区显示，不影响原 DOCX 文件）。继续？')) return;
    var html = buildMergedHtmlFromDrafts(p);
    // hide workspace home
    var ws = document.getElementById('workspaceContent');
    if (ws) ws.style.display = 'none';
    // remove previous merged root if any
    var old = document.getElementById('mergedPaperRoot');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var root = document.createElement('div');
    root.id = 'mergedPaperRoot';
    root.innerHTML = html;
    box.appendChild(root);
    // also set manuscriptText for modules that need plain text
    try {
      manuscriptText = root.innerText || '';
      manuscriptHTML = root.innerHTML || '';
    } catch (e) {}
    // update sections-like structure for tree
    try {
      var fake = (outline.chapters || []).map(function(ch, i){
        return { ch: i+1, name: ch.title, sections: (ch.sections||[]).map(function(s, j){ return { num: (i+1)+'.'+(j+1), title: s, subs: [], text: '' }; }), text: (getChapterDraft(chapterKey(ch.title,i))||{}).content || '' };
      });
      sections = fake;
      if (typeof renderNavTree === 'function') renderNavTree(sections);
    } catch (e) {}
    updateCurrent({ hasManuscript: true });
    logSkillRun({ moduleId: 'merge-drafts', title: '合并分章草稿到正文', summary: (outline.chapters||[]).length + ' 章' });
    if (typeof switchView === 'function') switchView('workspace');
    // show paper, not home
    if (ws) ws.style.display = 'none';
    if (typeof ttp === 'function') ttp('已合并到工作区，可继续导出或打开看板');
    renderProjectChrome();
  }

  function openFullPaperPreview() {
    var p = getCurrentProject();
    if (!p) { alert('请先创建项目'); return; }
    var html = buildMergedHtmlFromDrafts(p);
    if (!html) { alert('暂无预览内容'); return; }
    var ov = document.createElement('div');
    ov.id = 'fullPreviewOverlay';
    ov.className = 'project-overlay';
    ov.innerHTML = '<div class="project-modal" style="width:min(860px,96vw);max-height:88vh" onclick="event.stopPropagation()">' +
      '<div class="project-modal-head"><div><h3>完整论文预览</h3><p>导出前确认结构与正文</p></div>' +
      '<button class="project-close" onclick="closeFullPaperPreview()">×</button></div>' +
      '<div id="fullPreviewBody" style="overflow:auto;max-height:62vh;padding:8px 4px;border:1px solid var(--border);border-radius:12px;background:var(--bg-card)">' + html + '</div>' +
      '<div class="project-modal-actions">' +
        '<button class="ai-btn-clear" onclick="closeFullPaperPreview()">关闭</button>' +
        '<button class="ai-btn-clear" onclick="closeFullPaperPreview();mergeDraftsIntoThesis()">合并到工作区</button>' +
        '<button class="ai-btn" onclick="closeFullPaperPreview();exportFullPaperDocx()">导出 DOCX</button>' +
      '</div></div>';
    ov.onclick = function(){ closeFullPaperPreview(); };
    document.body.appendChild(ov);
  }
  function closeFullPaperPreview(){
    var ov=document.getElementById('fullPreviewOverlay');
    if(ov&&ov.parentNode) ov.parentNode.removeChild(ov);
  }

  window.mergeDraftsIntoThesis = mergeDraftsIntoThesis;
  window.openFullPaperPreview = openFullPaperPreview;
  window.closeFullPaperPreview = closeFullPaperPreview;
  window.pullCloudProjects = pullCloudProjects;
  window.syncProjectToCloud = syncProjectToCloud;

  // ===== 一键流水线：想法/导入 -> 大纲 -> 章节骨架 ->（可选）选题建议 =====
  function runOneClickPipeline() {
    var p = ensureUnifiedProjectState() || getCurrentProject();
    if (!p) { openIdeaWizard(); return; }
    if (!confirm('一键流水线将：\\n1) 确认/生成大纲\\n2) 为每章生成骨架草稿\\n3) 进入写作阶段\\n\\n不会自动调用收费 LLM（可随后手动点 AI 扩写）。继续？')) return;

    // 1 outline
    var outline = getOutline();
    if (!outline || !outline.chapters || !outline.chapters.length) {
      applySchoolTemplate(p.schoolTemplate || 'generic');
      outline = getOutline();
    }
    // 2 seed chapter skeletons
    var arts = ensureArtifacts(getCurrentProject());
    var n = 0;
    (outline.chapters || []).forEach(function(ch, idx) {
      var key = chapterKey(ch.title, idx);
      var prev = arts.chapters[key];
      if (prev && prev.content && prev.content.replace(/\\s+/g,'').length > 80 && prev.source !== 'template') return;
      var skeleton = ch.title + '\\n\\n' + (ch.sections || []).map(function(s, i) {
        return (i + 1) + '. ' + s + '\\n（请补充论据、数据与文献引用）\\n';
      }).join('\\n');
      // keep imported content if longer
      if (prev && prev.content && prev.content.length > skeleton.length) return;
      arts.chapters[key] = {
        key: key, title: ch.title, sections: ch.sections || [], content: skeleton,
        status: 'draft', updatedAt: nowISO(), createdAt: (prev && prev.createdAt) || nowISO(), source: 'pipeline'
      };
      n++;
    });
    var cur = getCurrentProject();
    cur.artifacts = arts;
    cur.currentStage = 'writing';
    cur.stageStatus = cur.stageStatus || {};
    cur.stageStatus.ideation = 'done';
    cur.stageStatus.writing = 'active';
    if (cur.hasManuscript) cur.stageStatus.literature = cur.stageStatus.literature || 'active';
    upsertProject(cur);
    logSkillRun({ moduleId: 'pipeline', title: '一键流水线', summary: '生成/更新 ' + n + ' 章骨架' });
    renderProjectChrome();
    openChapterBoard();
    if (typeof ttp === 'function') ttp('流水线完成：已进入分章写作。可再点「合并到正文 / 完整预览 / 导出」');
  }

  // ===== 答辩材料包 =====
  function buildDefensePackText(p) {
    var outline = getOutline() || { chapters: [] };
    var stats = chapterStats(p);
    var lines = [];
    lines.push('# 答辩材料包');
    lines.push('题目：' + (p.title || ''));
    lines.push('领域：' + (p.field || '') + '  学位：' + (p.degree || ''));
    lines.push('想法/摘要：' + (p.idea || ''));
    lines.push('');
    lines.push('## 1. 答辩 PPT 结构建议（15-18页）');
    lines.push('1. 封面与选题');
    lines.push('2. 研究背景与问题提出');
    lines.push('3. 研究目的与意义');
    lines.push('4. 文献综述与研究缺口');
    lines.push('5. 研究内容与技术路线');
    lines.push('6. 研究方法与数据');
    lines.push('7-10. 主要结果（按章节拆分）');
    lines.push('11. 创新点');
    lines.push('12. 不足与展望');
    lines.push('13. 结论');
    lines.push('14. 致谢/Q&A');
    lines.push('');
    lines.push('## 2. 3分钟讲稿提纲');
    lines.push('开场：问题是什么、为何重要（30秒）');
    lines.push('方法：用了什么数据/模型/路线（40秒）');
    lines.push('结果：最关键的 2-3 个发现（60秒）');
    lines.push('贡献：理论/实践价值（30秒）');
    lines.push('收尾：不足与下一步（20秒）');
    lines.push('');
    lines.push('## 3. 可能提问与回答要点');
    lines.push('Q1 创新点是什么？ -> 对照现有研究缺口回答');
    lines.push('Q2 数据来源与可靠性？ -> 说明样本、清洗、验证');
    lines.push('Q3 方法为何这样选？ -> 对比备选方法');
    lines.push('Q4 结果是否稳健？ -> 交叉验证/对比实验');
    lines.push('Q5 局限与未来工作？ -> 数据/场景/方法边界');
    lines.push('');
    lines.push('## 4. 当前章节完成度');
    lines.push('总章数：' + stats.total + '，较完整：' + stats.ready + '，总字数：' + stats.words);
    (outline.chapters || []).forEach(function(ch, idx) {
      var d = getChapterDraft(chapterKey(ch.title, idx)) || {};
      var w = (d.content || '').replace(/\\s+/g, '').length;
      lines.push('- ' + ch.title + '：' + w + ' 字');
    });
    lines.push('');
    lines.push('## 5. 英文摘要草稿提示');
    lines.push('Background / Methods / Results / Conclusion 四段式，约 200-300 words。');
    return lines.join('\\n');
  }

  function openDefensePack() {
    var p = getCurrentProject();
    if (!p) { openIdeaWizard(); return; }
    var text = buildDefensePackText(p);
    var ov = document.createElement('div');
    ov.id = 'defensePackOverlay';
    ov.className = 'project-overlay';
    ov.innerHTML = '<div class="project-modal" style="width:min(760px,96vw);max-height:88vh" onclick="event.stopPropagation()">' +
      '<div class="project-modal-head"><div><h3>答辩材料包</h3><p>PPT结构 / 讲稿 / 问答 / 完成度</p></div>' +
      '<button class="project-close" onclick="closeDefensePack()">×</button></div>' +
      '<textarea id="defensePackText" class="ai-textarea" style="height:52vh;margin:0">' + escapeHtml(text) + '</textarea>' +
      '<div class="project-modal-actions">' +
      '<button class="ai-btn-clear" onclick="closeDefensePack()">关闭</button>' +
      '<button class="ai-btn-clear" onclick="downloadDefensePack()">下载TXT</button>' +
      '<button class="ai-btn" onclick="window._openDefensePpt&&window._openDefensePpt();">打开答辩PPT模块</button>' +
      '</div></div>';
    ov.onclick = function(){ closeDefensePack(); };
    document.body.appendChild(ov);
    logSkillRun({ moduleId: 'defense-pack', title: '生成答辩材料包', summary: p.title });
  }
  function closeDefensePack(){
    var ov=document.getElementById('defensePackOverlay');
    if(ov&&ov.parentNode) ov.parentNode.removeChild(ov);
  }
  function downloadDefensePack(){
    var text=(document.getElementById('defensePackText')||{}).value || '';
    var blob=new Blob([text],{type:'text/plain;charset=utf-8;'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='defense_pack.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  // ===== 参考文献 GB/T 7714 自动规范化 =====
  function normalizeRefsGBT7714() {
    var refs = (typeof mergedRefs !== 'undefined' && mergedRefs && mergedRefs.length) ? mergedRefs
      : ((typeof existingRefs !== 'undefined' && existingRefs) ? existingRefs : []);
    if (!refs.length) {
      alert('当前没有参考文献。请先导入论文或检索文献。');
      if (typeof switchView === 'function') switchView('references');
      return;
    }
    var report = { total: refs.length, changed: 0, items: [] };
    refs.forEach(function(r, idx) {
      var raw = (r.ci || r.title || '').replace(/\s+/g, ' ').trim();
      if (!raw) return;
      var n = parseInt(r.displayNum || r.num || (idx + 1), 10) || (idx + 1);
      var fixed = raw;
      // strip leading [n]
      fixed = fixed.replace(/^\[\d+\]\s*/, '');
      // unify punctuation spaces
      fixed = fixed.replace(/\s*,\s*/g, ', ').replace(/\s*\.\s*/g, '. ').replace(/\s+/g, ' ').trim();
      // ensure ends with .
      if (!/[.。]$/.test(fixed)) fixed += '.';
      // Chinese journal-ish: if contains 《》 keep; ensure year 4 digits space normalized
      fixed = fixed.replace(/(20\d{2}|19\d{2})\s*年/g, '$1');
      // wrap as [n] text
      var norm = '[' + n + '] ' + fixed;
      var before = r.ci || '';
      r.ci = norm;
      r.displayNum = n;
      r.num = n;
      if (before !== norm) report.changed++;
      report.items.push(norm);
    });
    // re-render refs panel if possible
    try {
      if (typeof renderRefs === 'function' && typeof mergedRefs !== 'undefined' && mergedRefs && mergedRefs.length) renderRefs();
      else if (typeof renderExistingOnly === 'function') renderExistingOnly();
    } catch (e) {}
    // show report modal
    var ov=document.createElement('div'); ov.id='refNormOverlay'; ov.className='project-overlay';
    ov.innerHTML='<div class="project-modal" style="width:min(720px,96vw);max-height:86vh" onclick="event.stopPropagation()">'+
      '<div class="project-modal-head"><div><h3>参考文献规范化（GB/T 7714 风格）</h3><p>共 '+report.total+' 条，更新 '+report.changed+' 条</p></div>'+
      '<button class="project-close" onclick="var el=document.getElementById(\'refNormOverlay\');if(el)el.remove()">×</button></div>'+
      '<div style="max-height:55vh;overflow:auto;font-size:.72rem;line-height:1.7;border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--surface-alt)">'+
      report.items.map(function(x){return '<div style="margin:0 0 8px">'+escapeHtml(x)+'</div>';}).join('')+
      '</div>'+
      '<div class="project-modal-actions"><button class="ai-btn" onclick="var el=document.getElementById(\'refNormOverlay\');if(el)el.remove();if(typeof switchView===\'function\')switchView(\'references\');">查看参考文献面板</button></div></div>';
    ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
    document.body.appendChild(ov);
    logSkillRun({ moduleId: 'ref-normalize', title: '参考文献规范化', summary: report.changed + '/' + report.total });
    if (typeof ttp === 'function') ttp('已规范化 ' + report.changed + ' 条参考文献');
  }

  window.runOneClickPipeline = runOneClickPipeline;
  window.openDefensePack = openDefensePack;
  window.closeDefensePack = closeDefensePack;
  window.normalizeRefsGBT7714 = normalizeRefsGBT7714;
  window.ensureUnifiedProjectState = ensureUnifiedProjectState;

  function openMaterialsLibrary() {
    var p = getCurrentProject();
    if (!p) { alert('请先创建或选择项目'); openIdeaWizard(); return; }
    if (!cloudEnabled()) { alert('请先登录以使用云端资料库'); return; }
    var ov = document.createElement('div');
    ov.id = 'materialsOverlay';
    ov.className = 'project-overlay';
    ov.innerHTML = '<div class="project-modal" style="width:min(720px,96vw);max-height:88vh" onclick="event.stopPropagation()">' +
      '<div class="project-modal-head"><div><h3>项目资料库</h3><p>上传的数据/文档可供数据分析等模块复用</p></div>' +
      '<button class="project-close" onclick="closeMaterialsLibrary()">×</button></div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
      '<input type="file" id="materialFileInput" multiple style="font-size:.7rem;color:var(--text-secondary)">' +
      '<button class="ai-btn" onclick="uploadMaterials()">上传到资料库</button>' +
      '<button class="ai-btn-clear" onclick="refreshMaterialsList()">刷新</button>' +
      '</div>' +
      '<div id="materialsList" style="max-height:50vh;overflow:auto;font-size:.72rem">加载中…</div>' +
      '<div class="project-modal-actions"><button class="ai-btn-clear" onclick="closeMaterialsLibrary()">关闭</button></div></div>';
    ov.onclick = function(e){ if(e.target===ov) closeMaterialsLibrary(); };
    document.body.appendChild(ov);
    refreshMaterialsList();
  }
  function closeMaterialsLibrary(){
    var ov=document.getElementById('materialsOverlay'); if(ov&&ov.parentNode) ov.parentNode.removeChild(ov);
  }
  function refreshMaterialsList(){
    var p=getCurrentProject(); if(!p) return;
    var el=document.getElementById('materialsList'); if(!el) return;
    el.textContent='加载中…';
    fetch('/api/projects/'+encodeURIComponent(p.id)+'/materials', {headers: authHeaders()})
      .then(function(r){return r.json();})
      .then(function(d){
        if(!d.success){ el.innerHTML='<div style="color:#fca5a5">'+(d.error||'加载失败')+'</div>'; return; }
        var items=d.materials||[];
        if(!items.length){ el.innerHTML='<div style="color:var(--text-muted);padding:12px">暂无资料。可上传 CSV/TXT/DOCX/PDF 等。</div>'; return; }
        var h='<table style="width:100%;border-collapse:collapse"><tr style="background:rgba(255,255,255,.04)"><th style="text-align:left;padding:6px">文件</th><th>类型</th><th>大小</th><th>操作</th></tr>';
        items.forEach(function(m){
          h+='<tr><td style="padding:6px;border-bottom:1px solid rgba(255,255,255,.06)">'+escapeHtml(m.filename)+'</td>'+
            '<td style="text-align:center;border-bottom:1px solid rgba(255,255,255,.06)">'+(m.kind||'')+'</td>'+
            '<td style="text-align:center;border-bottom:1px solid rgba(255,255,255,.06)">'+Math.round((m.size_bytes||0)/1024)+'KB</td>'+
            '<td style="text-align:center;border-bottom:1px solid rgba(255,255,255,.06)">'+
            '<button class="ai-btn-clear" style="padding:2px 8px;font-size:.62rem" onclick="downloadMaterial(\''+m.id+'\')">下载</button> '+
            '<button class="ai-btn-clear" style="padding:2px 8px;font-size:.62rem" onclick="deleteMaterial(\''+m.id+'\')">删除</button></td></tr>';
        });
        h+='</table>';
        el.innerHTML=h;
      }).catch(function(){ el.innerHTML='<div style="color:#fca5a5">网络错误</div>'; });
  }
  function uploadMaterials(){
    var p=getCurrentProject(); if(!p) return;
    var input=document.getElementById('materialFileInput');
    if(!input||!input.files||!input.files.length){ alert('请选择文件'); return; }
    var i=0;
    function next(){
      if(i>=input.files.length){ refreshMaterialsList(); if(typeof ttp==='function')ttp('资料上传完成'); return; }
      var f=input.files[i++];
      var fd=new FormData(); fd.append('file', f); fd.append('kind', (f.name.split('.').pop()||'file'));
      fetch('/api/projects/'+encodeURIComponent(p.id)+'/materials', {method:'POST', headers:{'Authorization': (authHeaders().Authorization||'')}, body:fd})
        .then(function(r){return r.json();})
        .then(function(d){ if(!d.success) alert((f.name+': '+(d.error||'失败'))); next(); })
        .catch(function(){ alert(f.name+' 上传失败'); next(); });
    }
    next();
  }
  function downloadMaterial(id){
    var token=null; try{token=sessionStorage.getItem('thesis_ai_token');}catch(e){}
    window.open('/api/materials/'+encodeURIComponent(id)+'?access_token='+encodeURIComponent(token||''), '_blank');
    // fallback fetch blob
    fetch('/api/materials/'+encodeURIComponent(id), {headers: authHeaders()})
      .then(function(r){ if(!r.ok) throw new Error('download fail'); return r.blob(); })
      .then(function(b){ var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='material'; document.body.appendChild(a); a.click(); a.remove(); });
  }
  function deleteMaterial(id){
    if(!confirm('删除该资料？')) return;
    fetch('/api/materials/'+encodeURIComponent(id), {method:'DELETE', headers: authHeaders()})
      .then(function(r){return r.json();})
      .then(function(d){ if(d.success) refreshMaterialsList(); else alert(d.error||'删除失败'); });
  }
  function saveProjectMaterialMeta(meta){
    // optional: could POST a json material later
    try{ window._lastStructuredExtract = meta; }catch(e){}
  }

  window.openMaterialsLibrary=openMaterialsLibrary;
  window.closeMaterialsLibrary=closeMaterialsLibrary;
  window.refreshMaterialsList=refreshMaterialsList;
  window.uploadMaterials=uploadMaterials;
  window.downloadMaterial=downloadMaterial;
  window.deleteMaterial=deleteMaterial;
  window.saveProjectMaterialMeta=saveProjectMaterialMeta;
}).call(this);