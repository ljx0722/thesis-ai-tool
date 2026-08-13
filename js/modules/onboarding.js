(function () {
  'use strict';

  var VERSION = '1';
  var active = null;

  function key(name) {
    var user = 'guest';
    try { var value = JSON.parse(sessionStorage.getItem('thesis_ai_user') || '{}'); if (value.id != null) user = String(value.id); } catch (e) {}
    return 'thesisbuddy_guide_' + VERSION + '_' + user + '_' + name;
  }
  function seen(name) { try { return localStorage.getItem(key(name)) === '1'; } catch (e) { return false; } }
  function mark(name) { try { localStorage.setItem(key(name), '1'); } catch (e) {} }
  function remove() {
    var el = document.getElementById('taskGuide');
    if (el) el.remove();
    active = null;
  }
  function openGuide(name) {
    remove();
    var config = {
      idea: {
        title: '从想法建立论文项目',
        description: '只需要一句话研究想法。创建后系统会给出唯一推荐动作，不用先挑工具。',
        steps: ['写下你要研究什么', '选择学科与学位类型', '创建项目并按推荐动作继续'],
        action: 'openIdeaWizard()', actionLabel: '开始创建项目'
      },
      docx: {
        title: '导入已有论文',
        description: '先保留原文，再确认 Word 标题层级。完成后先看解析结果，不会直接修改正文。',
        steps: ['选择 DOCX 或旧版 DOC', '确认章、节、小节样式', '核对目录、字数、文献与待确认项'],
        action: "openImportDialog('new')", actionLabel: '选择论文文件'
      },
      module: {
        title: '工具如何使用',
        description: '工具按准备、写作、打磨、收尾归类。打开页面只检查可用性，实际执行时才按原规则计点。',
        steps: ['从当前项目的推荐动作进入', '也可用 Ctrl+K 搜索工具、检索文献', '手机端在底部“工具”中查看全部能力'],
        action: "ThesisRouter.go('tools')", actionLabel: '查看全部工具'
      },
      help: {
        title: '找到下一步',
        description: '项目主页会告诉你当前阶段、目录校准与检索证据的状态；先完成推荐动作，再打开其他工具。',
        steps: ['导入后先核对标题层级', '准备阶段可以检索并保存证据', '账户与帮助入口始终在顶栏'],
        action: "ThesisRouter.go('home')", actionLabel: '回到项目主页'
      }
    }[name] || null;
    if (!config) return;
    active = name;
    var guide = document.createElement('aside');
    guide.id = 'taskGuide';
    guide.className = 'task-guide';
    guide.setAttribute('role', 'dialog');
    guide.setAttribute('aria-modal', 'false');
    guide.setAttribute('aria-labelledby', 'taskGuideTitle');
    guide.innerHTML = '<div class="task-guide-head"><span>快速开始</span><button type="button" onclick="TaskGuide.close()" aria-label="关闭指南">×</button></div>' +
      '<h2 id="taskGuideTitle">' + config.title + '</h2><p>' + config.description + '</p><ol>' + config.steps.map(function (step) { return '<li>' + step + '</li>'; }).join('') + '</ol>' +
      '<div class="task-guide-actions"><button type="button" class="btn btn-ghost" onclick="TaskGuide.dismiss()">不再提示</button><button type="button" class="btn btn-primary" onclick="TaskGuide.run(\'' + config.action.replace(/'/g, "\\'") + '\')">' + config.actionLabel + '</button></div>';
    document.body.appendChild(guide);
    requestAnimationFrame(function () { guide.classList.add('open'); });
  }
  function close() { remove(); }
  function dismiss() { if (active) mark(active); remove(); }
  function run(action) { if (active) mark(active); remove(); try { Function(action)(); } catch (e) { console.warn('[guide action]', e); } }
  function maybe(name) { if (seen(name)) return false; openGuide(name); return true; }
  function maybeStartTour() {
    if (window.ThesisProject && ThesisProject.getCurrentProject && ThesisProject.getCurrentProject()) return;
    // The two-path home is the onboarding. Do not block it with an automatic tour.
  }
  function tourStart() { openGuide('help'); }
  function tourEnd() { close(); }

  window.TaskGuide = { open: openGuide, maybe: maybe, close: close, dismiss: dismiss, run: run };
  window.openContextHelp = function () { openGuide('module'); };
  window.maybeStartTour = maybeStartTour;
  window.tourStart = tourStart;
  window.tourEnd = tourEnd;
  window.tourNext = function () {};
  window.tourPrev = function () {};
})();
