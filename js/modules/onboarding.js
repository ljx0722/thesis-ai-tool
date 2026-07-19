/**
 * 论文搭子 ThesisBuddy — 操作指南
 * 首次登录自动播放；右下角 ? 可重开
 * 高亮目标 + 全屏半透明蒙版；说明气泡贴近控件
 */
var _tourSteps = [];
var _tourIdx = -1;
var _tourRunning = false;

function buildTourSteps() {
  _tourSteps = [
    {
      title: '欢迎使用',
      body: '从想法立项到导入论文、检索文献、打磨审校，一站完成。<br>接下来用几步带你熟悉主界面。',
      el: null, pos: 'center', icon: '👋'
    },
    {
      title: '导入或新建论文',
      body: '可「从想法开始」创建项目，或点「导入论文」上传 .docx。<br>上传后会进入标题校准，确认章 / 节 / 小节样式（同济模板可用 标题_TJ、一级标题_TJ、二级标题_TJ）。',
      el: function () {
        return document.querySelector('[onclick*="triggerUpload"]')
          || document.getElementById('uploadDrop')
          || document.querySelector('.home-choice')
          || document.querySelector('[onclick*="openIdeaWizard"]');
      },
      pos: 'right', icon: '📎'
    },
    {
      title: '目录树',
      body: '校准完成后，这里展示章 / 节 / 小节。<br>点击可定位到中间论文区对应位置；目录树在本栏内滚动。',
      el: function () {
        return document.getElementById('tocPanel')
          || document.getElementById('navTree')
          || document.querySelector('.toc-panel');
      },
      pos: 'right', icon: '📑'
    },
    {
      title: '论文正文',
      body: '中间为论文全貌，仅在本框内滚动。<br>可用「检索 / 图谱 / 校验」处理文献；角标可点击跳转。',
      el: function () {
        return document.getElementById('thesisBox')
          || document.getElementById('thesisPanel');
      },
      pos: 'left', icon: '📄'
    },
    {
      title: '参考文献',
      body: '顶栏「参考文献」或右侧「参考文献」标签，查看已识别文献、检索与校验。<br>删除文献会同步去掉正文角标并重编号。',
      el: function () {
        return document.querySelector('[data-view="refs"]')
          || document.querySelector('[onclick*="references"]')
          || document.getElementById('baSearch');
      },
      pos: 'bottom', icon: '📚'
    },
    {
      title: '检索与科研图表',
      body: '文献检索可同时设置条数、中文、英文、近3年和近5年最低比例；条件不足时会明确提示。<br>数据分析中的「科研图表顾问」会按论证目标、数据画像和目标期刊推荐图型，并保存 Figure Artifact。',
      el: function () { return document.getElementById('baSearch'); },
      pos: 'bottom', icon: '🔍'
    },
    {
      title: '工具台',
      body: '右侧可打开选题、开题、查错、降重、格式检查、数据分析、知识图谱等能力。<br>使用智能能力时按用量计点，可在「账户 / 计费」查看说明。',
      el: function () {
        return document.getElementById('refPanel')
          || document.querySelector('.tool-panel')
          || document.querySelector('[data-view="tools"]');
      },
      pos: 'left', icon: '🧰'
    },
    {
      title: '主线进度',
      body: '左侧阶段表示当前论文进度（选题 → 文献 → 写作 → 打磨 → 评审）。<br>按提示完成下一步即可。',
      el: function () {
        return document.getElementById('stageNav')
          || document.querySelector('.stage-nav')
          || document.querySelector('.nav-sidebar');
      },
      pos: 'right', icon: '🧭'
    },
    {
      title: '账户与帮助',
      body: '右上角可查看余额、明细与计费说明；充值后可继续使用智能能力。<br>随时点右下角 <b>?</b> 可重新打开本指南。',
      el: function () {
        return document.getElementById('buddyHelpBtn')
          || document.getElementById('buddyTools')
          || document.getElementById('changelogLink');
      },
      pos: 'left', icon: '💡'
    }
  ];
}

function _tourClearChrome() {
  ['tour-tooltip', 'tour-backdrop', 'tour-highlight', 'tour-cutout'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
}

function renderTourTooltip(step) {
  _tourClearChrome();
  var s = _tourSteps[step];
  if (!s) return;

  // 全屏灰色蒙版
  var bg = document.createElement('div');
  bg.id = 'tour-backdrop';
  bg.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(15,23,42,.52);pointer-events:auto;';
  bg.onclick = function () { /* 点击蒙版不关闭，需点按钮 */ };
  document.body.appendChild(bg);

  var tt = document.createElement('div');
  tt.id = 'tour-tooltip';
  tt.style.cssText = 'position:fixed;z-index:100003;background:#fff;color:#0f172a;border-radius:16px;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.28);max-width:min(380px,92vw);font-family:var(--font-sans),system-ui,sans-serif;font-size:.82rem;line-height:1.65;opacity:0;transition:opacity .2s,transform .2s;transform:translateY(6px);border:1px solid rgba(15,23,42,.08);';
  document.body.appendChild(tt);

  var h = '';
  h += '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">';
  h += '<div style="font-size:1.6rem;line-height:1">' + (s.icon || '📋') + '</div>';
  h += '<div><div style="font-size:1rem;font-weight:700;margin-bottom:6px">' + s.title + '</div>';
  h += '<div style="color:#475569">' + s.body + '</div></div></div>';
  h += '<div style="display:flex;justify-content:center;gap:5px;margin:12px 0 14px">';
  for (var i = 0; i < _tourSteps.length; i++) {
    h += '<span style="width:7px;height:7px;border-radius:50%;background:' + (i === step ? '#4f46e5' : '#cbd5e1') + '"></span>';
  }
  h += '</div>';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">';
  if (step > 0) {
    h += '<button type="button" onclick="tourPrev()" style="background:#f1f5f9;border:none;padding:8px 14px;border-radius:10px;cursor:pointer;font-size:.75rem;color:#334155">← 上一步</button>';
  } else {
    h += '<button type="button" onclick="tourEnd()" style="background:transparent;border:none;padding:8px 12px;cursor:pointer;font-size:.72rem;color:#94a3b8">跳过</button>';
  }
  h += '<span style="font-size:.68rem;color:#94a3b8">' + (step + 1) + '/' + _tourSteps.length + '</span>';
  if (step < _tourSteps.length - 1) {
    h += '<button type="button" onclick="tourNext()" style="background:#4f46e5;color:#fff;border:none;padding:8px 18px;border-radius:10px;cursor:pointer;font-size:.75rem;font-weight:600">下一步 →</button>';
  } else {
    h += '<button type="button" onclick="tourEnd()" style="background:#4f46e5;color:#fff;border:none;padding:8px 18px;border-radius:10px;cursor:pointer;font-size:.75rem;font-weight:600">开始使用</button>';
  }
  h += '</div>';
  tt.innerHTML = h;

  requestAnimationFrame(function () {
    var target = null;
    try { target = s.el ? (typeof s.el === 'function' ? s.el() : s.el) : null; } catch (e) { target = null; }
    if (target && !(target.offsetWidth || target.offsetHeight || target.getClientRects().length)) target = null;
    // autoSkipMissing: 无目标时改为居中说明，避免指空
    if (!target && s.pos && s.pos !== 'center') { s = Object.assign({}, s, { pos: 'center' }); }

    var ttW = tt.offsetWidth, ttH = tt.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;
    var x, y;
    var pad = 10;

    if (target && s.pos !== 'center') {
      var rect = target.getBoundingClientRect();
      // 挖洞高亮：亮边 + 蒙版通过巨大 box-shadow
      var hl = document.createElement('div');
      hl.id = 'tour-highlight';
      hl.style.cssText = 'position:fixed;z-index:100002;border-radius:12px;pointer-events:none;'
        + 'box-shadow:0 0 0 3px #6366f1, 0 0 0 9999px rgba(15,23,42,.52);'
        + 'transition:all .25s ease;';
      hl.style.left = Math.max(4, rect.left - 6) + 'px';
      hl.style.top = Math.max(4, rect.top - 6) + 'px';
      hl.style.width = Math.min(vw - 8, rect.width + 12) + 'px';
      hl.style.height = Math.min(vh - 8, rect.height + 12) + 'px';
      document.body.appendChild(hl);
      // 背景蒙版可减弱，避免双层过黑
      bg.style.background = 'transparent';

      var pos = s.pos || 'bottom';
      if (pos === 'bottom') {
        x = rect.left + rect.width / 2 - ttW / 2;
        y = rect.bottom + pad;
      } else if (pos === 'top') {
        x = rect.left + rect.width / 2 - ttW / 2;
        y = rect.top - ttH - pad;
      } else if (pos === 'right') {
        x = rect.right + pad;
        y = rect.top + rect.height / 2 - ttH / 2;
      } else if (pos === 'left') {
        x = rect.left - ttW - pad;
        y = rect.top + rect.height / 2 - ttH / 2;
      } else {
        x = rect.left + rect.width / 2 - ttW / 2;
        y = rect.bottom + pad;
      }
      // 贴边修正
      if (x < 12) x = 12;
      if (x + ttW > vw - 12) x = vw - ttW - 12;
      if (y < 12) y = 12;
      if (y + ttH > vh - 12) y = Math.max(12, rect.top - ttH - pad);
      if (y < 12) y = Math.min(vh - ttH - 12, rect.bottom + pad);
    } else {
      x = (vw - ttW) / 2;
      y = (vh - ttH) / 2;
      bg.style.background = 'rgba(15,23,42,.52)';
    }

    tt.style.left = Math.max(12, Math.min(vw - ttW - 12, x)) + 'px';
    tt.style.top = Math.max(12, Math.min(vh - ttH - 12, y)) + 'px';
    tt.style.opacity = '1';
    tt.style.transform = 'translateY(0)';
  });
}

var TOUR_VERSION = '3';
function tourStorageKey(){try{var u=JSON.parse(sessionStorage.getItem('thesis_ai_user')||'{}');return 'thesisbuddy_tour_v'+TOUR_VERSION+'_u'+(u.id!=null?u.id:'guest');}catch(e){return 'thesisbuddy_tour_v'+TOUR_VERSION+'_guest';}}

function tourStart() {
  buildTourSteps();
  var saved=0;try{var state=JSON.parse(localStorage.getItem(tourStorageKey())||'{}');saved=Number(state.step||0);}catch(e){}
  _tourIdx=Math.max(0,Math.min(saved,_tourSteps.length-1));
  _tourRunning = true;
  renderTourTooltip(_tourIdx);
}
function tourNext() {
  if (_tourIdx < _tourSteps.length - 1) {
    _tourIdx++;
    try{localStorage.setItem(tourStorageKey(),JSON.stringify({step:_tourIdx,completed:false}));}catch(e){}
    renderTourTooltip(_tourIdx);
  } else tourEnd();
}
function tourPrev() {
  if (_tourIdx > 0) {
    _tourIdx--;
    try{localStorage.setItem(tourStorageKey(),JSON.stringify({step:_tourIdx,completed:false}));}catch(e){}
    renderTourTooltip(_tourIdx);
  }
}
function tourEnd() {
  _tourRunning = false;
  _tourClearChrome();
  try {
    sessionStorage.setItem('thesis_ai_tour_seen', '1');
    localStorage.setItem(tourStorageKey(), JSON.stringify({step:0,completed:true}));
  } catch (e) {}
}

// 暴露
window.tourStart = tourStart;
window.tourNext = tourNext;
window.tourPrev = tourPrev;
window.tourEnd = tourEnd;
window.buildTourSteps = buildTourSteps;

// 首次登录自动打开
(function () {
  var seen = false;
  try { var state=JSON.parse(localStorage.getItem(tourStorageKey())||'{}');seen = sessionStorage.getItem('thesis_ai_tour_seen') === '1' || state.completed===true; } catch (e) {}
  if (seen) return;
  var isLoggedIn = false;
  try {
    isLoggedIn = sessionStorage.getItem('thesis_ai_login') === 'true' || !!sessionStorage.getItem('thesis_ai_token');
  } catch (e) {}
  if (!isLoggedIn) return;
  var checks = 0;
  var timer = setInterval(function () {
    checks++;
    if (typeof tourStart === 'function') {
      clearInterval(timer);
      setTimeout(function () { try { tourStart(); } catch (e) {} }, 700);
    }
    if (checks > 60) clearInterval(timer);
  }, 100);
})();
