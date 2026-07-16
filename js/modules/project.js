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
    var list = loadAll();
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === project.id) {
        list[i] = project;
        found = true;
        break;
      }
    }
    if (!found) list.unshift(project);
    saveAll(list);
    setCurrentId(project.id);
    return project;
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
        title: '创建你的第一个论文项目',
        desc: '从一句话想法开始，或上传已有 DOCX 进入打磨模式。',
        primary: { label: '从想法开始', action: 'open-idea-wizard' },
        secondary: { label: '上传论文', action: 'upload' }
      };
    }
    var stage = null;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === project.currentStage) stage = STAGES[i];
    if (!stage) stage = STAGES[0];
    var mod = stage.modules && stage.modules[0];
    return {
      title: '继续「' + stage.name + '」',
      desc: stage.desc + (mod ? ' · 推荐先做：' + moduleLabel(mod) : ''),
      primary: { label: '进入本阶段', action: 'open-stage', stageId: stage.id, moduleId: mod },
      secondary: project.hasManuscript ? null : { label: '上传已有草稿', action: 'upload' }
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

  function switchToProject(projectId) {
    if (!projectId) return;
    setCurrentId(projectId);
    renderProjectChrome();
    if (typeof switchView === 'function') switchView('workspace');
    if (typeof ttp === 'function') ttp('已切换项目');
  }

  function deleteProject(projectId) {
    var list = loadAll().filter(function (p) { return p.id !== projectId; });
    saveAll(list);
    if (getCurrentId() === projectId) {
      setCurrentId(list.length ? list[0].id : '');
    }
    renderProjectChrome();
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
      return '<div class="project-switch-row' + (isCur ? ' is-current' : '') + '" onclick="switchToProject(\'' + p.id + '\')">' +
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
    var idea = (document.getElementById('ideaText').value || '').trim();
    if (idea.length < 8) { alert('请至少用一句话描述你的研究想法（不少于 8 字）'); return; }
    var field = (document.getElementById('ideaField').value || '').trim();
    var degree = document.getElementById('ideaDegree').value || '硕士';
    var templateId = (document.getElementById('ideaTemplate').value || '').trim();
    var keywords = (document.getElementById('ideaKeywords').value || '').trim();
    var title = (document.getElementById('ideaTitle').value || '').trim();
    if (!title) title = idea.length > 24 ? idea.substring(0, 24) + '…' : idea;

    var project = createProject({
      title: title,
      idea: idea,
      field: field,
      keywords: keywords,
      degree: degree,
      mode: 'create',
      currentStage: 'ideation',
      hasManuscript: !!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100)
    });
    upsertProject(project);
    // Apply school template if selected
    if (templateId) {
      applySchoolTemplate(templateId);
    }
    closeIdeaWizard();
    renderProjectChrome();
    if (typeof switchView === 'function') switchView('workspace');
    if (typeof ttp === 'function') ttp('项目已创建：' + project.title + '。先看工作台建议，再点左侧阶段。');
    // 预填选题推荐输入
    setTimeout(function () {
      var domain = document.getElementById('topicDomain');
      var kws = document.getElementById('topicKeywords');
      if (domain) domain.value = field || idea;
      if (kws) kws.value = keywords;
    }, 200);
  }

  // ---------- UI: Project overview in workspace ----------
  function renderProjectOverviewHTML(project) {
    var prog = calcProgress(project);
    var next = nextAction(project);
    if (!project) {
      return '' +
        '<div class="project-overview home-simple">' +
          '<div class="project-overview-head">' +
            '<div class="project-badge">开始使用</div>' +
            '<h2>你想先做什么？</h2>' +
            '<p>不用一次看完所有功能。选一个入口，系统会引导你完成下一步。</p>' +
          '</div>' +
          '<div class="home-choice-grid">' +
            '<button class="home-choice primary" onclick="openIdeaWizard()">' +
              '<div class="home-choice-kicker">路径 A · 推荐新手</div>' +
              '<div class="home-choice-title">💡 从想法开始</div>' +
              '<div class="home-choice-desc">还没有完整论文。先立项，再写大纲、分章草稿、检索文献。</div>' +
              '<div class="home-choice-next">下一步：创建项目 → 选题推荐</div>' +
            '</button>' +
            '<button class="home-choice" onclick="triggerUpload()">' +
              '<div class="home-choice-kicker">路径 B · 已有草稿</div>' +
              '<div class="home-choice-title">📄 上传论文打磨</div>' +
              '<div class="home-choice-desc">已有 DOCX。导入后自动解析目录树、参考文献，再做评审与优化。</div>' +
              '<div class="home-choice-next">下一步：上传 .docx → 查看目录树</div>' +
            '</button>' +
          '</div>' +
          '<div class="home-help-note">左侧「写作阶段」是主导航；下方「能力」是工具箱。先选路径，再按阶段推进。</div>' +
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
        '<div class="project-tools-row">' +
          '<button class="ai-btn-clear" onclick="openOutlineEditor()">大纲</button>' +
          '<button class="ai-btn-clear" onclick="openChapterBoard()">分章草稿</button>' +
          '<button class="ai-btn-clear" onclick="openTemplateChooser()">学校模板</button>' +
          '<button class="ai-btn-clear" onclick="openProjectSettings()">设置</button>' +
          '<button class="ai-btn-clear" onclick="exportFullPaper()">导出全文</button>' +
        '</div>' +
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
        '<div class="chapter-card-meta">' + c.words + ' 字 &middot; 引用 ' + ((c.content||'').match(/\[\d+\]/g)||[]).length + ' 处 · 引用 ' + ((c.content||'').match(/\[\d+\]/g)||[]).length + ' 处 · ' + (c.sections.length || 0) + ' 个小节</div>' +
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
    if (typeof ttp === 'function') ttp('大纲已保存（' + chapters.length + ' 章）');
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
    renderProjectChrome();
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
        '<div class="chapter-card-meta">' + c.words + ' 字 &middot; 引用 ' + ((c.content||'').match(/\[\d+\]/g)||[]).length + ' 处 · 引用 ' + ((c.content||'').match(/\[\d+\]/g)||[]).length + ' 处 · ' + (c.sections.length||0) + ' 小节' + (c.updatedAt ? ' · ' + formatTime(c.updatedAt) : '') + '</div>' +
        '<div class="chapter-card-preview">' + escapeHtml((c.content||'小节：'+(c.sections.join('、')||'待补充')).slice(0,80)) + '</div>' +
        '<div class="chapter-card-actions" onclick="event.stopPropagation()"><button class="ai-btn-clear" onclick="openChapterEditor(\''+c.key+'\')">编辑</button><button class="ai-btn-clear" onclick="seedChapterFromSections(\''+c.key+'\')">小节骨架</button></div>' +
      '</div>';
    }).join("");
    var ov = document.createElement('div'); ov.id = 'chapterBoardOverlay'; ov.className = 'project-overlay';
    ov.innerHTML = '<div class="project-modal chapter-board-modal" onclick="event.stopPropagation()">' +
      '<div class="project-modal-head"><div><h3>分章草稿看板</h3><p>按大纲拆成章节卡片</p></div><button class="project-close" onclick="closeChapterOverlays()">×</button></div>' +
      '<div class="project-progress-sub" style="margin-bottom:10px">完整 ' + stats.ready + '/' + stats.total + ' · ' + stats.words + ' 字</div>' +
      '<div class="chapter-card-grid">' + cards + '</div>' +
      '<div class="project-modal-actions"><button class="ai-btn-clear" onclick="openOutlineEditor()">调整大纲</button><button class="ai-btn-clear" onclick="closeChapterOverlays()">关闭</button><button class="ai-btn" onclick="closeChapterOverlays();switchModule(\'expand\')">去论文扩写</button></div></div>';
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
  window.exportFullPaper = exportFullPaper;
  window.openProjectSettings = openProjectSettings;
  window.closeProjectSettings = closeProjectSettings;
  window.saveProjectSettings = saveProjectSettings;
  window.insertCiteMarkers = insertCiteMarkers;
  window.openTemplateChooser = openTemplateChooser;
  window.closeTemplateChooser = closeTemplateChooser;
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

}).call(this);