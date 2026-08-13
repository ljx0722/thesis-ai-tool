(function () {
  'use strict';

  var START_KEY = 'thesisbuddy_activation_start_v1';
  var EVENTS_KEY = 'thesisbuddy_activation_events_v1';
  var LIMIT_MS = 3 * 60 * 1000;

  function userId() {
    try {
      var user = JSON.parse(sessionStorage.getItem('thesis_ai_user') || '{}');
      return user.id == null ? 'guest' : String(user.id);
    } catch (e) { return 'guest'; }
  }
  function now() { return Date.now(); }
  function safeStart() {
    try { return JSON.parse(sessionStorage.getItem(START_KEY + '_' + userId()) || 'null'); } catch (e) { return null; }
  }
  function rememberStart(value) {
    try { sessionStorage.setItem(START_KEY + '_' + userId(), JSON.stringify(value)); } catch (e) {}
  }
  function appendLocal(event) {
    try {
      var key = EVENTS_KEY + '_' + userId();
      var list = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(list)) list = [];
      list.push(event);
      localStorage.setItem(key, JSON.stringify(list.slice(-80)));
    } catch (e) {}
  }
  function track(name, data) {
    data = data || {};
    var event = {
      event: name,
      at: now(),
      userId: userId(),
      projectId: data.projectId || '',
      path: data.path || '',
      durationMs: Number(data.durationMs || 0),
      status: data.status || '',
      action: data.action || ''
    };
    appendLocal(event);
    if (window.TB && TB.events) TB.events.emit('activation:event', event);
    return event;
  }
  function start(path) {
    var value = { path: path, at: now(), projectId: '', completed: false };
    rememberStart(value);
    track('start_path_selected', { path: path });
  }
  function created(projectId) {
    var state = safeStart() || { path: 'idea', at: now() };
    state.path = 'idea';
    state.projectId = projectId || '';
    rememberStart(state);
    track('project_created', { path: 'idea', projectId: projectId || '', durationMs: now() - state.at });
  }
  function imported(projectId) {
    var state = safeStart() || { path: 'docx', at: now() };
    state.path = 'docx';
    state.projectId = projectId || '';
    rememberStart(state);
    track('import_completed', { path: 'docx', projectId: projectId || '', durationMs: now() - state.at });
  }
  function recommendedAction(action, path) {
    var state = safeStart();
    var duration = state ? now() - state.at : 0;
    var projectId = state && state.projectId || '';
    var actualPath = path || state && state.path || '';
    track('recommended_next_action_clicked', { action: action, path: actualPath, projectId: projectId, durationMs: duration });
    if (state && !state.completed) {
      state.completed = true;
      state.completedAt = now();
      rememberStart(state);
      track('activation_completed', {
        action: action,
        path: actualPath,
        projectId: projectId,
        durationMs: duration,
        status: duration <= LIMIT_MS ? 'within_target' : 'over_target'
      });
    }
  }

  window.ThesisActivation = {
    track: track,
    start: start,
    created: created,
    imported: imported,
    recommendedAction: recommendedAction,
    get current() { return safeStart(); }
  };
})();
