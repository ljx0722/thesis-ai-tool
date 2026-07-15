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
    { id: 'writing', name: '分章写作', icon: '✍️', desc: '大纲落地、章节扩写与数据', modules: ['expand', 'data-analysis'] },
    { id: 'polish', name: '打磨审校', icon: '🔍', desc: '查错、降重、格式与术语', modules: ['proofread', 'de-duplicate', 'format-check', 'terminology', 'paragraph'] },
    { id: 'review', name: '综合评审', icon: '📊', desc: '审阅、优化与十维看板', modules: ['review', 'optimization', 'dashboard'] },
    { id: 'defense', name: '答辩输出', icon: '🎤', desc: '英文摘要与答辩材料', modules: ['en-abstract', 'defense-ppt'] }
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
            '<div><label>学位类型</label><select id="ideaDegree" class="ai-input"><option>硕士</option><option>本科</option><option>博士</option></select></div>' +
          '</div>' +
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

  function submitIdeaWizard() {
    var idea = (document.getElementById('ideaText').value || '').trim();
    if (idea.length < 8) { alert('请至少用一句话描述你的研究想法（不少于 8 字）'); return; }
    var field = (document.getElementById('ideaField').value || '').trim();
    var degree = document.getElementById('ideaDegree').value || '硕士';
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
    closeIdeaWizard();
    renderProjectChrome();
    if (typeof switchModule === 'function') switchModule('topic-finder');
    if (typeof ttp === 'function') ttp('项目已创建：' + project.title);
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
        '<div class="project-overview">' +
          '<div class="project-overview-head">' +
            '<div class="project-badge">Thesis OS</div>' +
            '<h2>从想法到答辩，一步步做成论文</h2>' +
            '<p>本平台既是论文打磨器，也是写作流水线。你可以先立项，再逐步生成大纲、文献、章节与答辩材料。</p>' +
          '</div>' +
          '<div class="project-cta-row">' +
            '<button class="ai-btn" onclick="openIdeaWizard()">💡 从想法开始</button>' +
            '<button class="ai-btn-clear" onclick="triggerUpload()">📄 上传已有论文</button>' +
            '<button class="ai-btn-clear" onclick="switchModule(\'topic-finder\')">先试用选题推荐</button>' +
          '</div>' +
          '<div class="project-stage-grid">' +
            STAGES.map(function (s, idx) {
              return '<div class="project-stage-card">' +
                '<div class="project-stage-idx">' + (idx + 1) + '</div>' +
                '<div class="project-stage-name">' + s.icon + ' ' + s.name + '</div>' +
                '<div class="project-stage-desc">' + s.desc + '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
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
          '<div><strong>' + escapeHtml(next.title) + '</strong><p>' + escapeHtml(next.desc) + '</p></div>' +
          '<div class="project-cta-row" style="margin:0">' +
            '<button class="ai-btn" onclick="runProjectAction(\'' + next.primary.action + '\',\'' + (next.primary.stageId || '') + '\',\'' + (next.primary.moduleId || '') + '\')">' + next.primary.label + '</button>' +
            (next.secondary ? '<button class="ai-btn-clear" onclick="runProjectAction(\'' + next.secondary.action + '\')">' + next.secondary.label + '</button>' : '') +
            '<button class="ai-btn-clear" onclick="completeCurrentStage()">标记本阶段完成</button>' +
          '</div>' +
        '</div>' +
        '<div class="project-stage-grid">' + stagesHtml + '</div>' +
      '</div>';
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
      titleEl.title = project ? (project.idea || project.title) : '点击从想法创建项目';
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
    var mod = stage.modules && stage.modules[0];
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
    if (moduleId && typeof switchModule === 'function') return switchModule(moduleId);
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
    renderWorkspaceHero: renderWorkspaceHero
  };
  window.openIdeaWizard = openIdeaWizard;
  window.closeIdeaWizard = closeIdeaWizard;
  window.submitIdeaWizard = submitIdeaWizard;
  window.openProjectStage = openProjectStage;
  window.completeCurrentStage = completeCurrentStage;
  window.runProjectAction = runProjectAction;
  window.renderWorkspaceHero = renderWorkspaceHero;
})();
