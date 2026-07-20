/**
 * 论文项目系统 — Thesis OS Phase 1
 * 项目对象 / 本地持久化 / 从想法创建项目向导 / 项目总览
 */
(function () {
  var STORAGE_KEY = 'thesis_ai_projects_v1';
  var CURRENT_KEY = 'thesis_ai_current_project_id';

  var STAGES = [
    { id: 'ideation', name: '想清楚', icon: '🎯', desc: '选题打磨、研究问题与开题方案', modules: ['topic-finder', 'proposal'] },
    { id: 'literature', name: '找资料', icon: '📚', desc: '文献检索、引用整理与研究脉络', modules: ['references', 'knowledge-graph'] },
    { id: 'structure', name: '搭结构', icon: '🧭', desc: '论文大纲、章节计划与研究设计', modules: ['proposal'], primaryAction: 'open-outline' },
    { id: 'writing', name: '写出来', icon: '✍️', desc: '分章写作、数据解读与图表表达', modules: ['expand', 'data-analysis'], primaryAction: 'open-outline' },
    { id: 'polish', name: '改得好', icon: '🔍', desc: '查错、降重、格式、术语与逻辑', modules: ['proofread', 'de-duplicate', 'format-check', 'terminology', 'paragraph'] },
    { id: 'review', name: '过评审', icon: '📊', desc: '综合审阅、论文看板与修改清单', modules: ['review', 'optimization', 'dashboard'] },
    { id: 'defense', name: '做答辩', icon: '🎤', desc: '英文摘要、答辩 PPT 与问答演练', modules: ['en-abstract', 'defense-ppt'] }
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


  function currentUserId() {
    try {
      var user = JSON.parse(sessionStorage.getItem('thesis_ai_user') || '{}');
      return user && user.id != null ? String(user.id) : '';
    } catch (e) { return ''; }
  }

  function scopedKey(base) {
    var uid = currentUserId();
    return uid ? base + '_u' + uid : base + '_guest';
  }

  function projectStorageKey() { return scopedKey(STORAGE_KEY); }
  function currentProjectKey() { return scopedKey(CURRENT_KEY); }

  function uid() {
    return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function loadAll() {
    try {
      var raw = localStorage.getItem(projectStorageKey());
      if (!raw) return [];
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveAll(list) {
    try {
      localStorage.setItem(projectStorageKey(), JSON.stringify(list || []));
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
  var cloudSyncState = { inFlight: {}, dirty: {}, lastSavedAt: {}, lastError: {} };
  function syncProjectToCloud(project, cb) {
    if (!cloudEnabled() || !project) { if (cb) cb(null); return Promise.resolve(null); }
    cloudSyncState.dirty[project.id] = true;
    var previous = cloudSyncState.inFlight[project.id] || Promise.resolve();
    var request = previous.catch(function(){}).then(function(){
      return fetch('/api/projects', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ project: project })
      }).then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(d){
          if (r.status === 409) {
            cloudSyncState.lastError[project.id] = d;
            var err = new Error(d.error || '项目版本冲突'); err.code='PROJECT_VERSION_CONFLICT'; err.data=d; throw err;
          }
          if (!r.ok || !d.success || !d.project) throw new Error(d.error || ('云端同步失败 '+r.status));
          upsertLocal(d.project);
          cloudSyncState.dirty[project.id] = false;
          cloudSyncState.lastSavedAt[project.id] = new Date().toISOString();
          cloudSyncState.lastError[project.id] = null;
          if (cb) cb(d.project);
          return d.project;
        });
      });
    }).catch(function(err){ cloudSyncState.lastError[project.id]=err.data||{error:err.message}; if(cb)cb(null); throw err; });
    cloudSyncState.inFlight[project.id] = request.finally(function(){ delete cloudSyncState.inFlight[project.id]; });
    return cloudSyncState.inFlight[project.id];
  }
  function flushAllDirty(options){
    options=options||{};var ps=[];
    loadAll().forEach(function(p){if(cloudSyncState.dirty[p.id]||options.force)ps.push(syncProjectToCloud(p));});
    return Promise.allSettled(ps).then(function(results){
      var failed=results.filter(function(r){return r.status==='rejected';});
      return {success:failed.length===0,failed:failed.length,results:results};
    });
  }
  function getSaveState(projectId){return{dirty:!!cloudSyncState.dirty[projectId],saving:!!cloudSyncState.inFlight[projectId],lastSavedAt:cloudSyncState.lastSavedAt[projectId]||'',lastError:cloudSyncState.lastError[projectId]||null};}
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
    try { return localStorage.getItem(currentProjectKey()) || ''; } catch (e) { return ''; }
  }

  function setCurrentId(id) {
    try {
      if (id) localStorage.setItem(currentProjectKey(), id);
      else localStorage.removeItem(currentProjectKey());
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
    try { syncProjectToCloud(saved).catch(function(){}); } catch (e) {}
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

  function createLiteratureArtifact() {
    return {
      schemaVersion: 1,
      version: 1,
      revisionId: '',
      manuscriptFingerprint: '',
      settings: { citationStyle: 'gbt7714-numeric', sourcePolicy: {}, defaultFilters: {} },
      claims: {}, papers: {}, evidenceLinks: {}, occurrences: {}, audits: {}, searchRuns: {},
      cart: { paperIds: [], selections: {} },
      bibliography: { includedPaperIds: [], manualOrder: [], lastExport: null },
      migration: { legacyImportedAt: null, warnings: [] }
    };
  }

  function ensureLiteratureShape(value) {
    var lit = value && typeof value === 'object' ? value : createLiteratureArtifact();
    if (!lit.schemaVersion) lit.schemaVersion = 1;
    if (!lit.version) lit.version = 1;
    ['claims','papers','evidenceLinks','occurrences','audits','searchRuns'].forEach(function(k){ if(!lit[k]||typeof lit[k]!=='object')lit[k]={}; });
    if(!lit.settings)lit.settings={citationStyle:'gbt7714-numeric',sourcePolicy:{},defaultFilters:{}};
    if(!lit.settings.citationStyle)lit.settings.citationStyle='gbt7714-numeric';
    if(!lit.cart)lit.cart={paperIds:[],selections:{}};
    if(!Array.isArray(lit.cart.paperIds))lit.cart.paperIds=[];
    if(!lit.cart.selections)lit.cart.selections={};
    if(!lit.bibliography)lit.bibliography={includedPaperIds:[],manualOrder:[],lastExport:null};
    if(!Array.isArray(lit.bibliography.includedPaperIds))lit.bibliography.includedPaperIds=[];
    if(!Array.isArray(lit.bibliography.manualOrder))lit.bibliography.manualOrder=[];
    if(!lit.migration)lit.migration={legacyImportedAt:null,warnings:[]};
    return lit;
  }

  function ensureArtifacts(p) {
    if (!p.artifacts) p.artifacts = { outline: null, chapters: {}, skillLogs: [], exports: [], figures: [], dataProfiles: [], modelRuns: [] };
    if (!p.artifacts.chapters) p.artifacts.chapters = {};
    if (!p.artifacts.skillLogs) p.artifacts.skillLogs = [];
    if (!p.artifacts.exports) p.artifacts.exports = [];
    if (!p.artifacts.figures) p.artifacts.figures = [];
    if (!p.artifacts.figurePlans) p.artifacts.figurePlans = [];
    if (!p.artifacts.dataProfiles) p.artifacts.dataProfiles = [];
    if (!p.artifacts.modelRuns) p.artifacts.modelRuns = [];
    p.artifacts.literature = ensureLiteratureShape(p.artifacts.literature);
    return p.artifacts;
  }

  function getLiteratureArtifact() {
    var p=getCurrentProject();if(!p)return createLiteratureArtifact();
    return ensureArtifacts(p).literature;
  }

  function saveLiteratureArtifact(next, options) {
    var p=getCurrentProject();if(!p)return Promise.reject(new Error('请先创建或打开项目'));
    var arts=ensureArtifacts(p),current=arts.literature;
    var incoming=ensureLiteratureShape(next),submittedVersion=(current&&current.version)||1;
    incoming.version=submittedVersion;
    incoming.revisionId=incoming.revisionId||p.activeRevisionId||'';
    arts.literature=incoming;p.updatedAt=nowISO();
    upsertLocal(p);
    try{window.dispatchEvent(new CustomEvent('literature-artifact-changed',{detail:{projectId:p.id,version:incoming.version}}));}catch(e2){}
    if((options&&options.localOnly)||!cloudEnabled())return Promise.resolve(incoming);
    var key='literature:'+p.id,previous=cloudSyncState.inFlight[key]||Promise.resolve();
    cloudSyncState.dirty[key]=true;
    var request=previous.catch(function(){}).then(function(){
      return fetch('/api/projects/'+encodeURIComponent(p.id)+'/literature',{
        method:'PUT',headers:authHeaders(),body:JSON.stringify({literature:incoming,version:submittedVersion})
      }).then(function(r){return r.json().catch(function(){return{};}).then(function(d){
        if(r.status===409){var conflict=new Error(d.error||'文献工作台版本冲突');conflict.code='LITERATURE_VERSION_CONFLICT';conflict.data=d;throw conflict;}
        if(!r.ok||!d.success||!d.literature)throw new Error(d.error||('文献工作台同步失败 '+r.status));
        var latest=getCurrentProject();if(latest){ensureArtifacts(latest).literature=ensureLiteratureShape(d.literature);latest.updatedAt=nowISO();upsertLocal(latest);}
        cloudSyncState.dirty[key]=false;cloudSyncState.lastSavedAt[key]=new Date().toISOString();cloudSyncState.lastError[key]=null;
        try{window.dispatchEvent(new CustomEvent('literature-artifact-changed',{detail:{projectId:p.id,version:d.version}}));}catch(e3){}
        return d.literature;
      });});
    }).catch(function(err){cloudSyncState.lastError[key]=err.data||{error:err.message};throw err;});
    cloudSyncState.inFlight[key]=request.finally(function(){delete cloudSyncState.inFlight[key];});
    return cloudSyncState.inFlight[key];
  }

  function updateLiteratureArtifact(mutator, options) {
    var current=getLiteratureArtifact();
    var copy=JSON.parse(JSON.stringify(current));
    var result=typeof mutator==='function'?mutator(copy):mutator;
    return saveLiteratureArtifact(result||copy,options);
  }

  function recordExport(meta) {
    var p = getCurrentProject();
    if (!p) return null;
    var arts = ensureArtifacts(p);
    arts.exports.unshift({
      id: uid(),
      format: (meta && meta.format) || 'txt',
      title: (meta && meta.title) || p.title || '',
      chapters: (meta && meta.chapters) || 0,
      words: (meta && meta.words) || 0,
      at: nowISO()
    });
    arts.exports = arts.exports.slice(0, 30);
    p.updatedAt = nowISO();
    upsertProject(p);
    logSkillRun({
      moduleId: (meta && meta.moduleId) || 'export',
      title: (meta && meta.titleLog) || ('导出 ' + ((meta && meta.format) || '文件').toUpperCase()),
      summary: ((meta && meta.chapters) || 0) + ' 章 · ' + ((meta && meta.words) || 0) + ' 字'
    });
    return getCurrentProject();
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
    try {
      var mid = String(entry.moduleId || '');
      p.stageStatus = p.stageStatus || {};
      if (/topic-finder|proposal/.test(mid) && p.stageStatus.ideation !== 'done') {
        p.stageStatus.ideation = 'active';
        p.currentStage = p.currentStage || 'ideation';
      }
      if (/references|knowledge-graph|cite|refs/.test(mid) && p.stageStatus.literature !== 'done') {
        p.stageStatus.literature = 'active';
      }
      if (/chapter|outline|expand|pipeline|merge-drafts/.test(mid) && p.stageStatus.writing !== 'done') {
        p.stageStatus.writing = 'active';
        p.currentStage = 'writing';
      }
      if (/proofread|format-check|de-duplicate|terminology|paragraph|optimization/.test(mid) && p.stageStatus.polish !== 'done') {
        p.stageStatus.polish = 'active';
        p.currentStage = 'polish';
      }
      if (/review|dashboard/.test(mid) && p.stageStatus.review !== 'done') {
        p.stageStatus.review = 'active';
        p.currentStage = 'review';
      }
      if (/defense|en-abstract|export/.test(mid) && p.stageStatus.defense !== 'done') {
        p.stageStatus.defense = 'active';
        p.currentStage = 'defense';
      }
    } catch (e) {}
    upsertProject(p);
    try { autoSyncStageProgress(getCurrentProject()); } catch (e) {}
    try { renderProjectChrome(); } catch (e) {}
    return getCurrentProject();
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


  function sanitizeProjectPaperFlags() {
    try {
      var live = (typeof manuscriptText !== 'undefined' && manuscriptText && String(manuscriptText).replace(/\s+/g, '').length > 100);
      if (live) return;
      var all = loadAll() || [];
      var changed = false;
      all.forEach(function (p) {
        if (!p) return;
        var words = 0;
        try { words = (chapterStats(p).words || 0); } catch (e) {}
        if (p.hasManuscript && !live) {
          p.hasManuscript = false;
          p.stageStatus = p.stageStatus || {};
          ['polish', 'review', 'defense'].forEach(function (sid) {
            if (p.stageStatus[sid] === 'done') p.stageStatus[sid] = 'todo';
          });
          if (p.currentStage === 'polish' || p.currentStage === 'review' || p.currentStage === 'defense') {
            p.currentStage = (p.stageStatus.writing === 'done') ? 'writing' : ((p.stageStatus.literature === 'done') ? 'literature' : 'ideation');
            if (p.stageStatus[p.currentStage] !== 'done') p.stageStatus[p.currentStage] = 'active';
          }
          changed = true;
        }
      });
      if (changed) {
        try { localStorage.setItem(projectStorageKey(), JSON.stringify(all)); } catch (e) {}
      }
    } catch (e) {}
  }

  function paperSignals(project) {
    // 以当前内存正文/分章草稿为准，避免陈旧 hasManuscript 造成「有论文」假进度
    var liveText = (typeof manuscriptText !== 'undefined' && manuscriptText) ? String(manuscriptText) : '';
    var livePaper = liveText.replace(/\s+/g, '').length > 100;
    var draftWords = 0;
    try {
      if (project) {
        var st0 = chapterStats(project);
        draftWords = (st0 && st0.words) || 0;
      }
    } catch (e0) {}
    var hasDraft = draftWords >= 300;
    // 仅真实导入正文算「有论文」；骨架草稿不算审校通过条件
    var hasPaper = !!livePaper;
    var hasWritable = !!(livePaper || hasDraft);
    try {
      if (project && project.hasManuscript && !hasPaper) project.hasManuscript = false;
      else if (project && hasPaper && !project.hasManuscript) project.hasManuscript = true;
    } catch (e1) {}
    var chCount = (typeof sections !== 'undefined' && sections && sections.length) ? sections.length : 0;
    var refCount = 0;
    if (typeof mergedRefs !== 'undefined' && mergedRefs && mergedRefs.length) refCount = mergedRefs.length;
    else if (typeof existingRefs !== 'undefined' && existingRefs && existingRefs.length) refCount = existingRefs.length;
    var outline = null;
    try { outline = project ? getOutline() : null; } catch (e) { outline = null; }
    var stats = { total: 0, ready: 0, words: 0, cards: [] };
    try { if (project) stats = chapterStats(project); } catch (e) {}
    var logs = (project && project.artifacts && project.artifacts.skillLogs) || [];
    function hasLog(keys) {
      var arr = Array.isArray(keys) ? keys : [keys];
      return logs.some(function (l) {
        var id = String(l.moduleId || '');
        for (var i = 0; i < arr.length; i++) {
          if (id === arr[i] || id.indexOf(arr[i]) === 0) return true;
        }
        return false;
      });
    }
    return {
      hasPaper: hasPaper,
      hasWritable: typeof hasWritable!=='undefined'?hasWritable:hasPaper,
      hasDraft: typeof hasDraft!=='undefined'?hasDraft:false,
      chCount: chCount,
      refCount: refCount,
      outline: outline,
      stats: stats,
      hasIdea: !!(project && project.idea && String(project.idea).trim().length >= 8),
      hasTitle: !!(project && project.title && project.title !== '未命名论文项目'),
      hasField: !!(project && project.field && String(project.field).trim()),
      hasOutline: !!(outline && outline.chapters && outline.chapters.length >= 3),
      hasPolish: hasLog(['proofread', 'format-check', 'de-duplicate', 'terminology', 'paragraph', 'optimization']),
      hasReview: hasLog(['review', 'dashboard', 'thesis-review']),
      hasDefense: hasLog(['en-abstract', 'defense-ppt', 'defense-pack', 'defense']),
      hasExport: hasLog(['export', 'export-docx']) || !!(project.artifacts && project.artifacts.exports && project.artifacts.exports.length),
      exportCount: (project.artifacts && project.artifacts.exports && project.artifacts.exports.length) || 0
    };
  }

  function evaluateStage(project, stageId) {
    var s = paperSignals(project);
    var checks = [];
    if (stageId === 'ideation') {
      checks = [
        { ok: s.hasIdea, label: '研究想法 ≥8 字' },
        { ok: s.hasTitle, label: '已有题目' },
        { ok: s.hasField || !!(project && project.keywords), label: '领域或关键词' }
      ];
    } else if (stageId === 'literature') {
      checks = [
        { ok: s.refCount >= 3 || s.hasOutline || s.hasPaper, label: s.hasPaper ? ('文献 ≥3 条（当前 ' + s.refCount + '）') : ('已建大纲/题目，或文献≥3（当前 ' + s.refCount + '）') },
        { ok: s.chCount > 0 || s.hasOutline || s.hasIdea, label: '有章节、大纲或研究想法' },
        { ok: s.refCount >= 5 || s.hasOutline || s.hasPaper, label: '文献≥5 或已具备写作结构' }
      ];
    } else if (stageId === 'structure') {
      checks = [
        { ok: s.hasOutline, label: '大纲 ≥3 章' },
        { ok: !!(project && project.field) || s.hasIdea, label: '研究领域或问题已明确' },
        { ok: s.hasOutline && s.stats.total >= 3, label: '章节计划已建立' }
      ];
    } else if (stageId === 'writing') {
      // 流水线骨架通常 <300 字/章，不能只看 ready；有 pipeline/template 骨架时放宽
      var hasPipelineSkeleton = false;
      try {
        var artsW = project && project.artifacts;
        if (artsW && artsW.chapters) {
          Object.keys(artsW.chapters).forEach(function (k) {
            var ch = artsW.chapters[k];
            if (ch && (ch.source === 'pipeline' || ch.source === 'template') && (ch.content || '').replace(/\s+/g, '').length >= 40) {
              hasPipelineSkeleton = true;
            }
          });
        }
      } catch (e) {}
      var draftReady = s.stats.ready >= 1 || (hasPipelineSkeleton && s.stats.total >= 3);
      var wordsOk = s.stats.words >= 1000 || (hasPipelineSkeleton && s.stats.words >= 200);
      checks = [
        { ok: s.hasOutline, label: '大纲 ≥3 章' },
        { ok: wordsOk, label: hasPipelineSkeleton && s.stats.words < 1000
          ? ('已有骨架草稿 ' + s.stats.words + ' 字（建议继续扩写至 1000+）')
          : ('草稿 ≥1000 字（' + s.stats.words + '）') },
        { ok: draftReady, label: s.stats.ready >= 1
          ? ('至少 1 章较完整（' + s.stats.ready + '/' + s.stats.total + '）')
          : (hasPipelineSkeleton ? ('已生成 ' + s.stats.total + ' 章骨架（可进扩写）') : '至少 1 章较完整') }
      ];
    } else if (stageId === 'polish') {
      checks = [
        { ok: s.hasPaper, label: '有可审校正文（需导入论文正文）' },
        { ok: s.hasPolish, label: '已跑查错/格式/降重等' }
      ];
    } else if (stageId === 'review') {
      checks = [
        { ok: s.hasReview, label: '已跑论文审阅或看板' },
        { ok: s.hasPaper, label: '有导入正文可评' }
      ];
    } else if (stageId === 'defense') {
      checks = [
        { ok: s.hasDefense || s.hasExport, label: '答辩材料或已导出' + (s.exportCount ? '（' + s.exportCount + ' 次）' : '') },
        { ok: s.hasPaper || s.stats.words >= 800, label: '主体内容就绪（正文或较多草稿）' }
      ];
    }
    var passed = 0;
    checks.forEach(function (c) { if (c.ok) passed++; });
    return {
      stageId: stageId,
      checks: checks,
      done: checks.length > 0 && passed === checks.length,
      progress: checks.length ? passed / checks.length : 0,
      passed: passed,
      total: checks.length
    };
  }

  function autoSyncStageProgress(project) {
    if (!project) return null;
    project.stageStatus = project.stageStatus || {};
    var changed = false;
    STAGES.forEach(function (st) {
      var ev = evaluateStage(project, st.id);
      var cur = project.stageStatus[st.id] || 'todo';
      if (ev.done && cur !== 'done') {
        project.stageStatus[st.id] = 'done';
        changed = true;
      } else if (!ev.done && cur === 'todo' && project.currentStage === st.id) {
        project.stageStatus[st.id] = 'active';
        changed = true;
      }
    });
    if (project.stageStatus[project.currentStage] === 'done') {
      for (var i = 0; i < STAGES.length; i++) {
        if (project.stageStatus[STAGES[i].id] !== 'done') {
          if (project.currentStage !== STAGES[i].id) {
            project.currentStage = STAGES[i].id;
            if (project.stageStatus[STAGES[i].id] !== 'done') project.stageStatus[STAGES[i].id] = 'active';
            changed = true;
          }
          break;
        }
      }
    }
    if (changed) {
      project.updatedAt = nowISO();
      upsertProject(project);
    }
    return getCurrentProject() || project;
  }

  function calcProgress(project) {
    if (!project) return { percent: 0, done: 0, total: STAGES.length, label: '未创建项目' };
    var done = 0;
    var soft = 0;
    STAGES.forEach(function (s) {
      if ((project.stageStatus || {})[s.id] === 'done') {
        done++;
        soft += 1;
      } else {
        var ev = evaluateStage(project, s.id);
        soft += Math.min(0.95, ev.progress || 0);
      }
    });
    var percent = Math.min(100, Math.round((soft / STAGES.length) * 100));
    if (project.hasManuscript && percent < 12) percent = 12;
    var stage = null;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === project.currentStage) stage = STAGES[i];
    var curEv = stage ? evaluateStage(project, stage.id) : null;
    return {
      percent: percent,
      done: done,
      total: STAGES.length,
      label: stage ? ('当前：' + stage.name + (curEv ? ' ' + curEv.passed + '/' + curEv.total : '')) : '进行中',
      stage: stage,
      stageEval: curEv
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
    try { project = autoSyncStageProgress(project) || project; } catch (e) {}
    var sig = paperSignals(project);
    if (sig.hasPaper && !sig.chCount && !sig.hasOutline) {
      return { title: '目录树还没识别出来', desc: '先看左侧底部目录；若为空，请重新上传论文。', primary: { label: '重新上传论文', action: 'upload' }, secondary: { label: '打开参考文献', action: 'open-stage', stageId: 'literature', moduleId: 'references' } };
    }
    if (sig.hasPaper && sig.refCount < 1) {
      return { title: '去确认参考文献', desc: '正文结构已有。下一步检查文末文献是否提取成功。', primary: { label: '打开参考文献', action: 'open-stage', stageId: 'literature', moduleId: 'references' }, secondary: { label: '打开论文看板', action: 'open-stage', stageId: 'review', moduleId: 'dashboard' } };
    }
    if (!sig.hasPaper && sig.hasIdea && sig.refCount < 3 && (project.currentStage==='literature' || project.currentStage==='ideation')) {
      return { title: '用想法检索文献', desc: '可先不导入全文，用题目/想法检索相关文献；或先写大纲再检索。', primary: { label: '检索文献', action: 'open-stage', stageId: 'literature', moduleId: 'references' }, secondary: { label: '编辑大纲', action: 'open-outline' } };
    }
    var stage = null;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === project.currentStage) stage = STAGES[i];
    if (!stage) stage = STAGES[0];
    var ev = evaluateStage(project, stage.id);
    if (ev.done) {
      var nextSt = null;
      for (var j = 0; j < STAGES.length; j++) {
        if (STAGES[j].id === stage.id && j < STAGES.length - 1) nextSt = STAGES[j + 1];
      }
      return {
        title: '「' + stage.name + '」标准已达成',
        desc: '可以进入下一阶段' + (nextSt ? '「' + nextSt.name + '」' : '或导出全文') + '。',
        primary: nextSt
          ? { label: '进入' + nextSt.name, action: 'open-stage', stageId: nextSt.id, moduleId: (nextSt.modules && nextSt.modules[0]) || '' }
          : { label: '导出 DOCX', action: 'export-docx' },
        secondary: { label: '标记完成并前进', action: 'complete-stage' }
      };
    }
    if (stage.id === 'ideation') {
      if (!sig.hasIdea) return { title: '写下研究想法', desc: '一句话描述你要研究什么，再进入选题。', primary: { label: '打开项目设置', action: 'open-settings' }, secondary: { label: '选题推荐', action: 'open-stage', stageId: 'ideation', moduleId: 'topic-finder' } };
      return { title: '用 AI 打磨选题', desc: '基于想法生成可行题目与开题大纲。', primary: { label: '选题推荐', action: 'open-stage', stageId: 'ideation', moduleId: 'topic-finder' }, secondary: { label: '开题大纲', action: 'open-stage', stageId: 'ideation', moduleId: 'proposal' } };
    }
    if (stage.id === 'literature') {
      if (sig.refCount < 5) return { title: '补齐参考文献', desc: '至少 5 条可用文献，再进入写作。当前 ' + sig.refCount + ' 条。', primary: { label: '打开参考文献', action: 'open-stage', stageId: 'literature', moduleId: 'references' }, secondary: { label: '知识图谱', action: 'open-stage', stageId: 'literature', moduleId: 'knowledge-graph' } };
      return { title: '核对文献与图谱', desc: '文献已够起步，可做图谱或进入写作。', primary: { label: '打开知识图谱', action: 'open-stage', stageId: 'literature', moduleId: 'knowledge-graph' }, secondary: { label: '去分章写作', action: 'open-stage', stageId: 'writing' } };
    }
    if (stage.id === 'writing') {
      if (!sig.hasOutline) return { title: '先定大纲', desc: '分章写作前先保存大纲，后面草稿才有结构。', primary: { label: '打开大纲编辑器', action: 'open-outline' }, secondary: { label: '一键流水线', action: 'pipeline' } };
      if (sig.stats.words < 1000) return { title: '写满首批草稿', desc: '当前 ' + sig.stats.words + ' 字。打开分章看板写骨架，或用流水线生成。', primary: { label: '打开分章看板', action: 'open-chapters' }, secondary: { label: '一键流水线', action: 'pipeline' } };
      return { title: '充实章节草稿', desc: '已有 ' + sig.stats.ready + '/' + sig.stats.total + ' 章较完整。继续扩写或合并到正文。', primary: { label: '打开分章看板', action: 'open-chapters' }, secondary: { label: '论文扩写', action: 'open-stage', stageId: 'writing', moduleId: 'expand' } };
    }
    if (stage.id === 'polish') {
      return { title: '打磨审校', desc: '依次查错、格式、术语；至少完成一项即记入本阶段。', primary: { label: '论文查错', action: 'open-stage', stageId: 'polish', moduleId: 'proofread' }, secondary: { label: '格式检查', action: 'open-stage', stageId: 'polish', moduleId: 'format-check' } };
    }
    if (stage.id === 'review') {
      return { title: '综合评审', desc: '用审阅与十维看板找短板。', primary: { label: '论文审阅', action: 'open-stage', stageId: 'review', moduleId: 'review' }, secondary: { label: '论文看板', action: 'open-stage', stageId: 'review', moduleId: 'dashboard' } };
    }
    if (stage.id === 'defense') {
      return { title: '答辩与导出', desc: '生成答辩材料包，或导出 DOCX。', primary: { label: '答辩材料包', action: 'defense-pack' }, secondary: { label: '导出 DOCX', action: 'export-docx' } };
    }
    var mod = stage.modules && stage.modules[0];
    return {
      title: '继续「' + stage.name + '」',
      desc: stage.desc + (mod ? ' · 推荐：' + moduleLabel(mod) : ''),
      primary: { label: '进入本阶段', action: 'open-stage', stageId: stage.id, moduleId: mod },
      secondary: sig.hasPaper ? null : { label: '上传已有草稿', action: 'upload' }
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

  function unloadProjectRuntime() {
    if (typeof window.clearManuscriptRuntime === 'function') window.clearManuscriptRuntime();
  }

  function activateProjectRuntime(projectId) {
    setCurrentId(projectId || '');
    unloadProjectRuntime();
    if (typeof window.restoreScopedSession === 'function') window.restoreScopedSession();
    refreshOpenProjectUIs();
    if (typeof switchView === 'function') switchView('workspace');
  }

  function switchToProject(projectId) {
    if (!projectId) return;
    activateProjectRuntime(projectId);
    closeProjectSwitcher();
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
          '<textarea id="ideaText" class="ai-textarea" style="height:96px;margin:0" placeholder="例如：研究某项技术、政策或管理措施对目标结果的影响"></textarea>' +
          '<div class="project-grid-2">' +
            '<div><label>学科/领域</label><input id="ideaField" class="ai-input" placeholder="如：工程管理 / 人工智能"></div>' +
            '<div><label>学位类型</label><select id="ideaDegree" class="ai-input"><option>硕士</option><option>本科</option><option>博士</option></select></div></div><div class="project-grid-2"><div><label>学校模板</label><select id="ideaTemplate" class="ai-input" onchange="ideaTemplateChanged(this.value)"><option value="">通用模板</option>' +
              SCHOOL_TEMPLATES.map(function(t){return '<option value="'+t.id+'">'+t.name+'</option>';}).join('') +
            '</select></div>' +
          '</div>' +
          '<div class="template-hint" id="templateHint" style="display:none"></div>' +
          '<label>关键词（选填，逗号分隔）</label>' +
          '<input id="ideaKeywords" class="ai-input" placeholder="例如：核心对象, 研究方法, 结果变量">' +
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
    var boardDone = !!(project && project.artifacts && (project.artifacts.skillLogs || []).some(function (l) {
      return /dashboard|review/.test(String(l.moduleId || ''));
    }));
    function item(done, title, desc, btnLabel, onclick) {
      return '<div class="checklist-item' + (done ? ' is-done' : '') + '">' +
        '<div class="checklist-left"><span class="checklist-dot">' + (done ? '✓' : '○') + '</span>' +
        '<div><b>' + title + '</b><p>' + desc + '</p></div></div>' +
        (done ? '<span class="checklist-ok">已完成</span>' :
          '<button class="ai-btn-clear" onclick="' + onclick + '">' + btnLabel + '</button>') +
      '</div>';
    }
    return '<div class="import-checklist">' +
      '<div class="import-checklist-head"><strong>导入后 3 步</strong><span>按顺序做，先别点一圈工具箱</span></div>' +
      item(chCount > 0, '1. 检查目录树', chCount > 0 ? ('已识别 ' + chCount + ' 章') : '左侧底部「目录」应出现章节；没有就重新上传', '看目录树', "document.getElementById('navTree')&&document.getElementById('navTree').scrollIntoView({behavior:'smooth'})") +
      item(refCount > 0, '2. 检查参考文献', refCount > 0 ? ('已提取 ' + refCount + ' 条') : '到参考文献面板确认是否识别到文末文献', '打开参考文献', "switchView('references')") +
      item(boardDone, '3. 打开论文看板', boardDone ? '已查看审阅/看板' : '用十维评分看整体缺口，再决定改哪一章', '打开看板', 'showDashboard()') +
    '</div>';
  }

  function renderStageCriteriaHTML(project) {
    if (!project) return '';
    var stageId = project.currentStage || 'ideation';
    var stage = null;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === stageId) stage = STAGES[i];
    var ev = evaluateStage(project, stageId);
    if (!ev.checks || !ev.checks.length) return '';
    var rows = ev.checks.map(function (c) {
      return '<div class="stage-criteria-item' + (c.ok ? ' is-ok' : '') + '">' +
        '<span class="stage-criteria-dot">' + (c.ok ? '✓' : '○') + '</span>' +
        '<span>' + escapeHtml(c.label) + '</span></div>';
    }).join('');
    return '<div class="stage-criteria-card">' +
      '<div class="stage-criteria-head"><strong>' + escapeHtml(stage ? stage.name : '本阶段') + '完成标准</strong>' +
      '<span>' + ev.passed + '/' + ev.total + (ev.done ? ' · 已达标' : '') + '</span></div>' +
      rows +
    '</div>';
  }

  function isProjectEmpty(project) {
    if (!project) return true;
    try {
      var live = (typeof manuscriptText !== 'undefined' && manuscriptText && String(manuscriptText).replace(/\s+/g, '').length > 100);
      if (live) return false;
      var idea = (project.idea || '').trim();
      var title = (project.title || '').trim();
      var hasIdea = idea.length >= 8;
      var hasTitle = title && title !== '未命名论文项目' && title !== '导入论文项目';
      var words = 0;
      try { words = (chapterStats(project).words || 0); } catch (e) {}
      var outline = null;
      try { outline = getOutline(); } catch (e2) {}
      var hasOutline = !!(outline && outline.chapters && outline.chapters.length);
      if (!hasIdea && !hasTitle && !hasOutline && words < 50 && !project.hasManuscript) return true;
      return false;
    } catch (e3) {
      return !project;
    }
  }
  function renderProjectOverviewHTML(project) {
    var prog = calcProgress(project);
    var next = nextAction(project);
    if (!project || isProjectEmpty(project)) {
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

    try { project = autoSyncStageProgress(project) || project; } catch (e) {}
    var prog = calcProgress(project);
    var next = nextAction(project);

    var stagesHtml = STAGES.map(function (s) {
      var st = (project.stageStatus || {})[s.id] || 'todo';
      var ev = evaluateStage(project, s.id);
      var cls = 'project-stage-card is-' + st + (s.id === project.currentStage ? ' is-current' : '');
      return '<div class="' + cls + '" onclick="openProjectStage(\'' + s.id + '\')">' +
        '<div class="project-stage-status">' + (st === 'done' ? '已完成' : (st === 'active' ? '进行中' : '未开始')) +
          (ev.total ? ' · ' + ev.passed + '/' + ev.total : '') + '</div>' +
        '<div class="project-stage-name">' + s.icon + ' ' + s.name + '</div>' +
        '<div class="project-stage-desc">' + s.desc + '</div>' +
      '</div>';
    }).join('');

    var secAction = next.secondary
      ? '<button class="ai-btn-clear" onclick="runProjectAction(\'' + next.secondary.action + '\',\'' + (next.secondary.stageId || '') + '\',\'' + (next.secondary.moduleId || '') + '\')">' + next.secondary.label + '</button>'
      : '';

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
          '<div><div class="next-kicker">下一步只做这一件</div><strong>' + escapeHtml(next.title) + '</strong><p>' + escapeHtml(next.desc) + '</p></div>' +
          '<div class="project-cta-row" style="margin:0">' +
            '<button class="ai-btn" onclick="runProjectAction(\'' + next.primary.action + '\',\'' + (next.primary.stageId || '') + '\',\'' + (next.primary.moduleId || '') + '\')">' + next.primary.label + '</button>' +
            secAction +
            '<button class="ai-btn-clear" onclick="completeCurrentStage()">完成本阶段</button>' +
          '</div>' +
        '</div>' +
        renderStageCriteriaHTML(project) +
        renderImportChecklist(project) +
        renderSmartTips(project) +
        renderChapterBoardInline(project) +
        renderSkillLogInline(project) +
        renderExportHistoryInline(project) +
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
          '<button class="ai-btn-clear" onclick="openExportHistory()">导出历史</button>' +
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
        '<div class="chapter-card-meta">' + c.words + ' 字 · 引用 ' + ((c.content||'').match(/\[\d+\]/g)||[]).length + ' 处 · ' + (c.sections.length || 0) + ' 个小节</div>' +
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
    var exports = (project.artifacts && project.artifacts.exports) || [];
    if (!logs.length && !exports.length) {
      return '<div class="project-panel-card"><div class="project-panel-head"><strong>能力运行记录</strong><span>用模块、保存章节、导出后会自动留下轨迹</span></div></div>';
    }
    var rows = logs.slice(0, 8).map(function (l) {
      return '<div class="skill-log-row"><b>' + escapeHtml(l.title || l.moduleId) + '</b><span>' + escapeHtml(l.summary || '') + '</span><i>' + formatTime(l.at) + '</i></div>';
    }).join('');
    var exportHint = exports.length
      ? '<div class="project-cta-row" style="margin:10px 0 0"><button class="ai-btn-clear" onclick="openExportHistory()">导出历史（' + exports.length + '）</button></div>'
      : '';
    return '<div class="project-panel-card"><div class="project-panel-head"><strong>最近能力记录</strong><span>本地保存 · 驱动阶段进度</span></div>' + rows + exportHint + '</div>';
  }

  function renderExportHistoryInline(project) {
    var list = (project.artifacts && project.artifacts.exports) || [];
    if (!list.length) return '';
    var rows = list.slice(0, 5).map(function (e) {
      return '<div class="skill-log-row"><b>' + escapeHtml((e.format || '').toUpperCase()) + '</b><span>' +
        escapeHtml(e.title || '') + ' · ' + (e.chapters || 0) + ' 章 · ' + (e.words || 0) + ' 字</span><i>' + formatTime(e.at) + '</i></div>';
    }).join('');
    return '<div class="project-panel-card"><div class="project-panel-head"><strong>导出历史</strong><span>最近 ' + list.length + ' 次</span></div>' +
      rows +
      '<div class="project-cta-row" style="margin:10px 0 0">' +
        '<button class="ai-btn-clear" onclick="openExportHistory()">查看全部</button>' +
        '<button class="ai-btn-clear" onclick="exportFullPaperDocx()">再导 DOCX</button>' +
      '</div></div>';
  }

  function openExportHistory() {
    var p = getCurrentProject();
    if (!p) { openIdeaWizard(); return; }
    var list = (ensureArtifacts(p).exports) || [];
    var rows = list.length
      ? list.map(function (e, i) {
          return '<div class="version-row">' +
            '<div class="version-top"><b>#' + (i + 1) + ' · ' + escapeHtml((e.format || '').toUpperCase()) + '</b><span>' + formatTime(e.at) + '</span></div>' +
            '<div class="version-preview">' + escapeHtml(e.title || p.title) + ' · ' + (e.chapters || 0) + ' 章 · ' + (e.words || 0) + ' 字</div>' +
          '</div>';
        }).join('')
      : '<div class="project-progress-sub" style="text-align:center;padding:16px">还没有导出记录。大纲/分章就绪后可导出 DOCX 或 TXT。</div>';
    var ov = document.createElement('div');
    ov.id = 'exportHistoryOverlay';
    ov.className = 'project-overlay';
    ov.innerHTML = '<div class="project-modal" style="width:min(520px,96vw)" onclick="event.stopPropagation()">' +
      '<div class="project-modal-head"><div><h3>导出历史</h3><p>仅记录本机项目内的导出动作，不保存文件本体</p></div>' +
      '<button class="project-close" onclick="closeExportHistory()">×</button></div>' +
      '<div style="max-height:55vh;overflow:auto">' + rows + '</div>' +
      '<div class="project-modal-actions">' +
        '<button class="ai-btn-clear" onclick="closeExportHistory()">关闭</button>' +
        '<button class="ai-btn-clear" onclick="closeExportHistory();exportFullPaper()">导出 TXT</button>' +
        '<button class="ai-btn" onclick="closeExportHistory();exportFullPaperDocx()">导出 DOCX</button>' +
      '</div></div>';
    ov.onclick = function () { closeExportHistory(); };
    document.body.appendChild(ov);
  }
  function closeExportHistory() {
    var ov = document.getElementById('exportHistoryOverlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
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
    if (project) {
      try { project = autoSyncStageProgress(project) || project; } catch (e) {}
    }
    var html = '';
    STAGES.forEach(function (s, idx) {
      var st = project ? ((project.stageStatus || {})[s.id] || 'todo') : 'todo';
      var cur = project && project.currentStage === s.id;
      var meta = '';
      if (project) {
        try {
          var ev = evaluateStage(project, s.id);
          if (ev.total) meta = ' · ' + ev.passed + '/' + ev.total;
        } catch (e) {}
      }
      html += '<div class="stage-nav-item' + (cur ? ' active' : '') + ' is-' + st + '" onclick="openProjectStage(\'' + s.id + '\')">' +
        '<span class="stage-nav-idx">' + (idx + 1) + '</span>' +
        '<span class="stage-nav-text"><b>' + s.name + '</b><i>' + s.desc + meta + '</i></span>' +
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
    var stageId = project.currentStage || 'ideation';
    var ev = evaluateStage(project, stageId);
    if (!ev.done) {
      var missing = (ev.checks || []).filter(function (c) { return !c.ok; }).map(function (c) { return c.label; });
      var msg = '本阶段标准尚未全部达成' + (missing.length ? ('：\n- ' + missing.join('\n- ')) : '') + '\n\n仍要强制标记完成吗？';
      if (!confirm(msg)) return;
    }
    completeStage(stageId);
    renderProjectChrome();
    if (typeof ttp === 'function') ttp(ev.done ? '阶段达标，已进入下一阶段' : '已强制标记阶段完成');
  }

  function runProjectAction(action, stageId, moduleId) {
    if (action === 'open-idea-wizard') return openIdeaWizard();
    if (action === 'upload') return typeof triggerUpload === 'function' ? triggerUpload() : null;
    if (action === 'open-stage') return openProjectStage(stageId || 'ideation');
    if (action === 'open-outline') return openOutlineEditor();
    if (action === 'open-chapters') return openChapterBoard();
    if (action === 'open-settings') return openProjectSettings();
    if (action === 'pipeline') return runOneClickPipeline();
    if (action === 'defense-pack') return openDefensePack();
    if (action === 'export-docx') return exportFullPaperDocx();
    if (action === 'complete-stage') return completeCurrentStage();
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

  function saveManuscriptRevision(meta) {
    var p=getCurrentProject();
    if(!p||!cloudEnabled())return Promise.resolve(null);
    var snapshot={
      schemaVersion:2,
      structured:(typeof window._thesisStructured==='boolean'?window._thesisStructured:((typeof sections!=='undefined'?sections:[]).length>0)),
      text:(typeof manuscriptText!=='undefined'?manuscriptText:''),
      html:(typeof manuscriptHTML!=='undefined'?manuscriptHTML:''),
      sections:(typeof sections!=='undefined'?sections:[]).map(function(ch){return{ch:ch.ch,name:ch.name,text:ch.text||'',sections:(ch.sections||[]).map(function(s){return{num:s.num,title:s.title,text:s.text||'',subs:(s.subs||[]).map(function(u){return{num:u.num,title:u.title,text:u.text||''};})};})};}),
      references:(typeof existingRefs!=='undefined'?existingRefs:[]).map(function(r){return{num:r.num,ci:r.ci,title:r.title,journal:r.journal,year:r.year||r.yr,doi:r.doi,reftype:r.reftype,ch:r.ch};}),
      topics:(typeof paperTopics!=='undefined'?paperTopics:[]),
      source:meta||{}
    };
    return fetch('/api/projects/'+encodeURIComponent(p.id)+'/revisions',{method:'POST',headers:authHeaders(),body:JSON.stringify({source_type:(meta&&meta.sourceType)||'import',file_name:(meta&&meta.fileName)||'',file_kind:(meta&&meta.kind)||'',size_bytes:(meta&&meta.sizeBytes)||0,parser_version:'web-1',structure_summary:{chapters:snapshot.sections.length,references:snapshot.references.length,textChars:snapshot.text.length},calibration:(meta&&meta.calibration)||{},snapshot:snapshot})}).then(function(r){return r.json();}).then(function(d){
      if(!d.success)throw new Error(d.error||'版本保存失败');
      return fetch('/api/projects/'+encodeURIComponent(p.id)+'/revisions/'+encodeURIComponent(d.revision_id)+'/activate',{method:'POST',headers:authHeaders(),body:'{}'}).then(function(r){return r.json();}).then(function(a){if(!a.success)throw new Error(a.error||'版本激活失败');p.activeRevisionId=d.revision_id;p.hasManuscript=true;p.updatedAt=nowISO();upsertLocal(p);return d;});
    });
  }

  function hydrateRevision(projectId, revisionId) {
    if(!projectId||!revisionId)return Promise.resolve(false);
    return fetch('/api/projects/'+encodeURIComponent(projectId)+'/revisions/'+encodeURIComponent(revisionId),{headers:authHeaders()}).then(function(r){return r.json();}).then(function(d){
      if(!d.success)throw new Error(d.error||'版本加载失败');
      unloadProjectRuntime();var s=d.snapshot||{};
      manuscriptText=s.text||'';manuscriptHTML=s.html||'';sections=s.sections||[];existingRefs=s.references||[];mergedRefs=[];paperTopics=s.topics||[];
      var tb=document.getElementById('thesisBox'),ws=document.getElementById('workspaceContent');if(tb){Array.prototype.slice.call(tb.childNodes).forEach(function(n){if(n!==ws)tb.removeChild(n);});if(ws)ws.style.display='none';var root=document.createElement('div');root.id='paperContentRoot';root.className='paper-content-root';root.innerHTML=manuscriptHTML;tb.appendChild(root);}
      if(typeof rehydrateManuscriptRuntime==='function')rehydrateManuscriptRuntime();else if(typeof renderNavTree==='function')renderNavTree(sections);window._thesisStructured=sections.length>0;if(typeof renderExistingOnly==='function')renderExistingOnly();if(typeof onThesisLoaded==='function')onThesisLoaded({skipRevisionSave:true});return true;
    });
  }

  function restoreImportDecomposition(project) {
    var saved=project&&project.artifacts&&project.artifacts.importDecomposition;
    if(saved)renderImportDecomposition(saved);
    if(!cloudEnabled()||!project||!project.id)return Promise.resolve(saved||null);
    return fetch('/api/projects/'+encodeURIComponent(project.id)+'/pipeline/runs',{headers:authHeaders()}).then(function(r){return r.json();}).then(function(d){
      if(!d.success||!d.runs||!d.runs.length)return saved||null;
      var current=normalizePipelineJob({run:d.runs[0]});
      renderImportDecomposition(current);
      if(current.status==='completed'||current.status==='failed')recordImportDecomposition(current);
      return current;
    }).catch(function(){return saved||null;});
  }

  function bootstrapAuthenticatedUser() {
    return new Promise(function(resolve){pullCloudProjects(function(list){var current=getCurrentProject();if(!current&&list&&list.length){setCurrentId(list[0].id);current=list[0];}if(current&&current.activeRevisionId){hydrateRevision(current.id,current.activeRevisionId).catch(function(){unloadProjectRuntime();}).finally(function(){restoreImportDecomposition(current);renderProjectChrome();if(typeof switchView==='function')switchView('workspace');resolve(current);});}else{unloadProjectRuntime();restoreImportDecomposition(current);renderProjectChrome();if(typeof switchView==='function')switchView('workspace');resolve(current);}});});
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
    try { syncSectionsToChapterDrafts(false); } catch (e) { console.warn('[import-sync]', e); }
    try { autoSyncStageProgress(getCurrentProject()); } catch (e) {}
    renderProjectChrome();
    // 导入后显示论文正文（可滚动），不盖住原文
    if (typeof switchView === 'function') switchView('paper');
    try { ensureUnifiedProjectState(); } catch (e) {}
    try { saveManuscriptRevision({sourceType:'import',fileName:window._uploadFileName||'',kind:window._uploadFileKind||'',sizeBytes:window._uploadFileSize||0}).then(function(d){return runImportDecomposition({intent:window._importIntent||'new',fileName:window._uploadFileName||'',revisionId:d&&d.revision_id||''});}).catch(function(e){console.warn('[revision/decomposition]',e.message);if(typeof ttp==='function')ttp('论文已载入，云端拆解可稍后重试');}); } catch (eRev) {}
    if (typeof ttp === 'function') ttp('论文已导入：目录树与正文已就绪，可点「工作台」查看主线进度');
  }

  function renderImportDecomposition(job) {
    var box=document.getElementById('uploadDecomposition'),state=document.getElementById('uploadDecompositionState'),bar=document.getElementById('uploadDecompositionProgress'),list=document.getElementById('uploadDecompositionChecklist'),retry=document.getElementById('uploadDecompositionRetry'),nav=document.getElementById('uploadDecompositionNavigate');
    if(!box)return;job=job||{};box.hidden=false;
    var status=job.status||job.state||'queued';
    if(status==='succeeded')status='completed';
    if(status==='running')status='processing';
    var pct=Math.max(0,Math.min(100,Number(job.progress==null?(status==='completed'?100:status==='failed'?100:35):job.progress)));
    if(status!=='completed'&&status!=='failed'&&typeof showUploadOverlay==='function')showUploadOverlay();
    if(state)state.textContent=status==='completed'?'已完成':status==='failed'?(job.error||'失败'):'处理中';
    if(bar){bar.style.width='100%';bar.style.transform='scaleX('+(pct/100)+')';bar.style.transformOrigin='left center';}
    var steps=job.checklist||[];
    if(!steps.length){
      var runSteps=job.steps||[];
      if(runSteps.length){
        steps=runSteps.map(function(s){
          var label=s.step_key==='decompose'?'识别章节结构':s.step_key==='context-index'?'建立版本上下文索引':(s.step_key||'处理步骤');
          return {label:label,done:s.status==='succeeded'||status==='completed'};
        });
      }else{
        steps=[{label:'提交拆解任务',done:pct>=10},{label:'识别章节与参考文献',done:pct>=55},{label:'建立上下文索引并同步项目',done:status==='completed'}];
      }
    }
    if(list)list.innerHTML='<div class="import-checklist-head"><strong>拆解清单</strong><span>'+Math.round(pct)+'%</span></div>'+steps.map(function(s){return '<div class="checklist-item '+(s.done?'is-done':'')+'"><div class="checklist-left"><span class="checklist-dot">'+(s.done?'✓':'○')+'</span><div><b>'+escapeHtml(s.label||'处理步骤')+'</b></div></div></div>';}).join('');
    if(retry){retry.hidden=status!=='failed';retry.onclick=function(){runImportDecomposition({intent:window._importIntent||'new',fileName:window._uploadFileName||'',revisionId:(getCurrentProject()||{}).activeRevisionId||''});};}
    if(nav){nav.hidden=status!=='completed';nav.onclick=function(){if(typeof switchView==='function')switchView('workspace');if(typeof openChapterBoard==='function')openChapterBoard();};}
  }
  function normalizePipelineJob(payload) {
    var run=(payload&&payload.run)||payload||{};
    var status=run.status||payload.status||'queued';
    if(status==='succeeded')status='completed';
    var steps=run.steps||[];
    var done=steps.filter(function(s){return s.status==='succeeded';}).length;
    var progress=status==='completed'?100:status==='failed'?100:Math.max(15, Math.round(((done+1)/(Math.max(steps.length,2)+1))*100));
    var checklist=steps.map(function(s){
      return {label:s.step_key==='decompose'?'识别章节结构':s.step_key==='context-index'?'建立版本上下文索引':(s.step_key||'处理步骤'), done:s.status==='succeeded'||status==='completed'};
    });
    if(!checklist.length) checklist=[{label:'提交拆解任务',done:true},{label:'识别章节结构',done:status==='completed'},{label:'建立上下文索引',done:status==='completed'}];
    return {
      success:true,
      id:run.id||payload.run_id||payload.job_id||'',
      job_id:run.id||payload.run_id||payload.job_id||'',
      status:status,
      state:status,
      progress:progress,
      checklist:checklist,
      steps:steps,
      output:run.output||payload.output||{},
      error:run.error||payload.error||''
    };
  }
  function runImportDecomposition(meta) {
    renderImportDecomposition({status:'queued',progress:8});
    return startImportDecomposition(meta).then(function(job){
      renderImportDecomposition(job);
      var id=job.job_id||job.id;
      if(!id){
        recordImportDecomposition(job);
        return job;
      }
      if(job.status==='completed'||job.status==='failed'){
        recordImportDecomposition(job);
        return job;
      }
      return new Promise(function(resolve){
        var tries=0;
        var poll=setInterval(function(){
          tries++;
          getImportDecompositionStatus(id).then(function(d){
            renderImportDecomposition(d);
            var s=d.status||d.state;
            if(s==='completed'||s==='failed'||tries>=20){
              clearInterval(poll);
              if(s!=='completed'&&s!=='failed') d={status:'completed',progress:100,checklist:d.checklist||[],id:id,job_id:id};
              recordImportDecomposition(d);
              resolve(d);
            }
          }).catch(function(e){
            clearInterval(poll);
            renderImportDecomposition({status:'failed',error:e.message});
            resolve(null);
          });
        },900);
      });
    }).catch(function(e){
      renderImportDecomposition({status:'failed',error:e.message});
      return null;
    });
  }

  function startImportDecomposition(meta) {
    meta = meta || {};
    var p = getCurrentProject();
    if (!p || !p.id) return Promise.reject(new Error('请先创建或选择项目'));
    var payload = {
      project_id: p.id,
      revision_id: meta.revisionId || p.activeRevisionId || '',
      pipeline_type: 'full',
      intent: meta.intent || 'new',
      preserve_user_edits: true,
      file_name: meta.fileName || window._uploadFileName || '',
      input: { intent: meta.intent || 'new', preserve_user_edits: true, file_name: meta.fileName || window._uploadFileName || '' }
    };
    return fetch('/api/projects/' + encodeURIComponent(p.id) + '/pipeline/runs', {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || d.success === false) throw new Error(d.error || '拆解任务提交失败');
        return normalizePipelineJob(d);
      });
    });
  }
  function getImportDecompositionStatus(jobId) {
    var p = getCurrentProject();
    if (!p || !p.id || !jobId) return Promise.reject(new Error('缺少拆解任务'));
    return fetch('/api/projects/' + encodeURIComponent(p.id) + '/pipeline/runs/' + encodeURIComponent(jobId), { headers: authHeaders() }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || d.success === false) throw new Error(d.error || '拆解状态读取失败');
        return normalizePipelineJob(d);
      });
    });
  }
  function recordImportDecomposition(job) {
    var p = getCurrentProject(); if (!p) return;
    ensureArtifacts(p);
    var decomposition=((job&&job.output)||{}).decompose||job.decomposition||null;
    p.artifacts.importDecomposition = Object.assign({}, job || {}, {
      updatedAt: nowISO(),
      preserveUserEdits: true,
      decomposition: decomposition
    });
    if(decomposition&&decomposition.chapters&&decomposition.chapters.length){
      try{ syncSectionsToChapterDrafts(true); }catch(e){}
    }
    upsertProject(p);
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
    evaluateStage: evaluateStage,
    autoSyncStageProgress: autoSyncStageProgress,
    paperSignals: paperSignals,
    recordExport: recordExport,
    openExportHistory: openExportHistory,
    saveManuscriptRevision: saveManuscriptRevision,
    hydrateRevision: hydrateRevision,
    startImportDecomposition: startImportDecomposition,
    getImportDecompositionStatus: getImportDecompositionStatus,
    recordImportDecomposition: recordImportDecomposition,
    renderImportDecomposition: renderImportDecomposition,
    runImportDecomposition: runImportDecomposition,
    restoreImportDecomposition: restoreImportDecomposition,
    bootstrapAuthenticatedUser: bootstrapAuthenticatedUser,
    flushAllDirty: flushAllDirty,
    getSaveState: getSaveState,
    getLiteratureArtifact: getLiteratureArtifact,
    saveLiteratureArtifact: saveLiteratureArtifact,
    updateLiteratureArtifact: updateLiteratureArtifact,
    ensureLiteratureShape: ensureLiteratureShape,
    syncProjectToCloud: syncProjectToCloud,
  };
  window.openExportHistory = openExportHistory;
  window.closeExportHistory = closeExportHistory;
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
        '<div class="chapter-card-meta">' + c.words + ' 字 · 引用 ' + ((c.content||'').match(/\[\d+\]/g)||[]).length + ' 处 · ' + (c.sections.length||0) + ' 小节' + (c.updatedAt ? ' · ' + formatTime(c.updatedAt) : '') + '</div>' +
        '<div class="chapter-card-preview">' + escapeHtml((c.content||'小节：'+(c.sections.join('、')||'待补充')).slice(0,80)) + '</div>' +
        '<div class="chapter-card-actions" onclick="event.stopPropagation()"><button class="ai-btn-clear" onclick="openChapterEditor(\''+c.key+'\')">编辑</button><button class="ai-btn-clear" onclick="seedChapterFromSections(\''+c.key+'\')">小节骨架</button></div>' +
      '</div>';
    }).join("");
    var ov = document.createElement('div'); ov.id = 'chapterBoardOverlay'; ov.className = 'project-overlay';
    ov.innerHTML = '<div class="project-modal chapter-board-modal" onclick="event.stopPropagation()">' +
      '<div class="project-modal-head"><div><h3>分章草稿看板</h3><p>按大纲拆成章节卡片</p></div><button class="project-close" onclick="closeChapterOverlays()">×</button></div>' +
      '<div class="project-progress-sub" style="margin-bottom:10px">完整 ' + stats.ready + '/' + stats.total + ' · ' + stats.words + ' 字</div>' +
      '<div class="chapter-card-grid">' + cards + '</div>' +
      '<div class="project-modal-actions"><button class="ai-btn-clear" onclick="openOutlineEditor()">调整大纲</button><button class="ai-btn-clear" onclick="closeChapterOverlays()">关闭</button><button class="ai-btn" onclick="goThesisExpand()">去论文扩写</button></div></div>';
    ov.onclick = function () { closeChapterOverlays(); };
    document.body.appendChild(ov);
  }
  
  function goThesisExpand() {
    try { closeChapterOverlays(); } catch (e) {}
    if (typeof switchModule === 'function') switchModule('expand');
    else if (window.switchModule) window.switchModule('expand');
  }
  window.goThesisExpand = goThesisExpand;

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
      body:JSON.stringify({capability_id:'chapter-expand',input:up,max_tokens:3000,project_id:(getCurrentProject()||{}).id||'',revision_id:(getCurrentProject()||{}).activeRevisionId||''})})
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
      if (stats.words < 200) tips.push({ title: '先跑一键流水线', desc: '自动生成大纲与各章骨架，再逐章扩写' });
      else if (stats.words < 1000) tips.push({ title: '骨架已有，开始充实', desc: '当前 ' + stats.words + ' 字。打开分章看板，把一章写到 300+ 字' });
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
    if (!token) { alert('请先登录后再导出'); return; }
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
      var words = 0;
      (payload.chapters || []).forEach(function (ch) { words += String(ch.content || '').replace(/\s+/g, '').length; });
      recordExport({
        format: 'docx',
        title: payload.title,
        chapters: (payload.chapters || []).length,
        words: words,
        moduleId: 'export-docx',
        titleLog: '导出 DOCX'
      });
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
    recordExport({
      format: 'txt',
      title: outline.title || p.title,
      chapters: outline.chapters.length,
      words: stats.words,
      moduleId: 'export',
      titleLog: '导出 TXT'
    });
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

  // ===== 一键流水线：想法/导入 -> 大纲 -> 章节骨架 -> 推进写作阶段完成度 =====
  function runOneClickPipeline() {
    var p = ensureUnifiedProjectState() || getCurrentProject();
    if (!p) { openIdeaWizard(); return; }
    if (!confirm('一键流水线将：\n1) 确认/生成大纲\n2) 为每章生成骨架草稿\n3) 进入写作阶段并刷新完成度\n\n仅生成本地章节骨架，不会自动智能扩写（扩写等智能能力请在工具台单独使用（按用量计点））。继续？')) return;

    // 1 outline
    var outline = getOutline();
    if (!outline || !outline.chapters || !outline.chapters.length) {
      applySchoolTemplate(p.schoolTemplate || 'generic');
      outline = getOutline();
    }
    if (!outline || !outline.chapters || !outline.chapters.length) {
      alert('未能生成大纲，请先打开大纲编辑器手动保存。');
      openOutlineEditor();
      return;
    }

    // 2 seed chapter skeletons（不覆盖用户已写长文）
    var arts = ensureArtifacts(getCurrentProject());
    var n = 0;
    var skipped = 0;
    (outline.chapters || []).forEach(function(ch, idx) {
      var key = chapterKey(ch.title, idx);
      var prev = arts.chapters[key];
      var prevWords = prev && prev.content ? prev.content.replace(/\s+/g, '').length : 0;
      // 用户已写较多内容：跳过
      if (prevWords > 80 && prev && prev.source !== 'template' && prev.source !== 'pipeline') {
        skipped++;
        return;
      }
      var skeleton = ch.title + '\n\n' + (ch.sections || []).map(function(s, i) {
        return (i + 1) + '. ' + s + '\n（请补充论据、数据与文献引用）\n';
      }).join('\n');
      // 已有更长正文则保留
      if (prev && prev.content && prev.content.length > skeleton.length && prevWords > 80) {
        skipped++;
        return;
      }
      arts.chapters[key] = {
        key: key,
        title: ch.title,
        sections: ch.sections || [],
        content: skeleton,
        status: 'draft',
        updatedAt: nowISO(),
        createdAt: (prev && prev.createdAt) || nowISO(),
        source: 'pipeline'
      };
      n++;
    });

    var cur = getCurrentProject();
    cur.artifacts = arts;
    cur.currentStage = 'writing';
    cur.stageStatus = cur.stageStatus || {};
    // 有想法/题目时，选题阶段可视为完成
    if ((cur.idea && String(cur.idea).trim().length >= 8) || (cur.title && cur.title !== '未命名论文项目')) {
      cur.stageStatus.ideation = 'done';
    } else {
      cur.stageStatus.ideation = cur.stageStatus.ideation || 'active';
    }
    if (cur.hasManuscript || ((typeof manuscriptText !== 'undefined') && manuscriptText && manuscriptText.length > 100)) {
      // 导入稿：文献阶段至少 active；有文献数时由 autoSync 判定 done
      if (cur.stageStatus.literature !== 'done') cur.stageStatus.literature = 'active';
    } else {
      // 纯创作路径：流水线后优先写作，不强制文献 done
      if (!cur.stageStatus.literature) cur.stageStatus.literature = 'todo';
    }
    cur.stageStatus.writing = 'active';
    cur.updatedAt = nowISO();
    upsertProject(cur);

    // 3 按真实产物重算阶段（writing 的字数/完整章会反映骨架）
    try { autoSyncStageProgress(getCurrentProject()); } catch (e) {}
    var after = getCurrentProject() || cur;
    var stats = chapterStats(after);
    var writingEv = evaluateStage(after, 'writing');

    logSkillRun({
      moduleId: 'pipeline',
      title: '一键流水线',
      summary: '更新 ' + n + ' 章骨架' + (skipped ? ' · 跳过 ' + skipped + ' 章已有正文' : '') +
        ' · 写作 ' + writingEv.passed + '/' + writingEv.total +
        ' · 草稿 ' + stats.words + ' 字'
    });
    renderProjectChrome();
    openChapterBoard();

    var msg = '流水线完成：生成/更新 ' + n + ' 章骨架';
    if (skipped) msg += '，保留 ' + skipped + ' 章已有正文';
    msg += '。写作进度 ' + writingEv.passed + '/' + writingEv.total;
    if (writingEv.done) {
      msg += '（写作阶段已达标，可进入打磨）';
    } else {
      var miss = (writingEv.checks || []).filter(function (c) { return !c.ok; }).map(function (c) { return c.label; });
      if (miss.length) msg += '；还差：' + miss.join('、');
    }
    if (typeof ttp === 'function') ttp(msg);
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
      var w = (d.content || '').replace(/\s+/g, '').length;
      lines.push('- ' + ch.title + '：' + w + ' 字');
    });
    lines.push('');
    lines.push('## 5. 英文摘要草稿提示');
    lines.push('Background / Methods / Results / Conclusion 四段式，约 200-300 words。');
    return lines.join('\n');
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
      '<div class="project-modal-head"><div><h3>项目资料库 <span id="materialsCountHead" style="font-size:.72rem;font-weight:600;color:var(--text-muted)"></span></h3><p>上传的数据/文档可供数据分析等模块复用</p></div>' +
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
    // 关闭后刷新数据分析下拉（若面板已打开）
    try{ if(typeof loadDataAnalysisMaterials==='function') loadDataAnalysisMaterials(); }catch(e){}
  }
  function refreshMaterialsList(){
    var p=getCurrentProject(); if(!p) return;
    var el=document.getElementById('materialsList'); if(!el) return;
    el.textContent='加载中…';
    fetch('/api/projects/'+encodeURIComponent(p.id)+'/materials', {headers: authHeaders()})
      .then(function(r){return r.json();})
      .then(function(d){
        if(!d.success){ el.textContent=d.error||'加载失败'; el.style.color='#fca5a5'; return; }
        var items=d.materials||[];
        var dataN=items.filter(function(m){ var n=(m.filename||'').toLowerCase(); return /\.(csv|tsv|txt)$/i.test(n); }).length;
        if(!items.length){ el.innerHTML='<div style="color:var(--text-muted);padding:12px">暂无资料。可上传 CSV/TXT/DOCX/PDF 等。</div>'; try{ if(typeof updateDaMatCountBadge==='function') updateDaMatCountBadge(0,0);}catch(e){} return; }
        var h='<div style="font-size:.72rem;color:var(--text-muted);margin:0 0 8px">共 <b style="color:var(--text-primary)">'+items.length+'</b> 个文件 · 其中数据文件 <b style="color:var(--text-primary)">'+dataN+'</b> 个</div>';
        h+='<table style="width:100%;border-collapse:collapse"><tr style="background:rgba(128,128,128,.06)"><th style="text-align:left;padding:6px">文件</th><th>类型</th><th>大小</th><th>操作</th></tr>';
        items.forEach(function(m){
          h+='<tr><td style="padding:6px;border-bottom:1px solid rgba(128,128,128,.1)">'+escapeHtml(m.filename)+'</td>'+
            '<td style="text-align:center;border-bottom:1px solid rgba(128,128,128,.1)">'+(m.kind||'')+'</td>'+
            '<td style="text-align:center;border-bottom:1px solid rgba(128,128,128,.1)">'+Math.round((m.size_bytes||0)/1024)+'KB</td>'+
            '<td style="text-align:center;border-bottom:1px solid rgba(128,128,128,.1)">'+
            '<button class="ai-btn-clear" style="padding:2px 8px;font-size:.62rem" onclick="downloadMaterial(\''+m.id+'\')">下载</button> '+
            '<button class="ai-btn-clear" style="padding:2px 8px;font-size:.62rem" onclick="deleteMaterial(\''+m.id+'\')">删除</button></td></tr>';
        });
        h+='</table>';
        el.innerHTML=h;
        try{ if(typeof updateDaMatCountBadge==='function') updateDaMatCountBadge(dataN, items.length); if(typeof loadDataAnalysisMaterials==='function' && document.getElementById('daMaterialSelect')) loadDataAnalysisMaterials(); }catch(e2){}
      }).catch(function(){ el.innerHTML='<div style="color:#fca5a5">网络错误</div>'; });
  }
  function uploadMaterials(){
    var p=getCurrentProject(); if(!p) return;
    var input=document.getElementById('materialFileInput');
    if(!input||!input.files||!input.files.length){ alert('请选择文件'); return; }
    var i=0;
    function next(){
      if(i>=input.files.length){
        refreshMaterialsList();
        try{ if(typeof loadDataAnalysisMaterials==='function') loadDataAnalysisMaterials(); }catch(e){}
        if(typeof ttp==='function')ttp('资料上传完成');
        return;
      }
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
    fetch('/api/materials/'+encodeURIComponent(id), {headers: authHeaders()})
      .then(function(r){
        if(!r.ok) throw new Error('download fail');
        var disposition=r.headers.get('Content-Disposition')||'';
        var match=disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
        var name=match?decodeURIComponent(match[1].replace(/"/g,'')):'material';
        return r.blob().then(function(blob){return{blob:blob,name:name};});
      })
      .then(function(file){var a=document.createElement('a');a.href=URL.createObjectURL(file.blob);a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},500);})
      .catch(function(){alert('资料下载失败');});
  }
  function deleteMaterial(id){
    if(!confirm('删除该资料？')) return;
    fetch('/api/materials/'+encodeURIComponent(id), {method:'DELETE', headers: authHeaders()})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.success){
          refreshMaterialsList();
          try{ if(typeof loadDataAnalysisMaterials==='function') loadDataAnalysisMaterials(); }catch(e){}
        } else alert(d.error||'删除失败');
      });
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