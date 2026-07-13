/**
 * 论文AI利器 — 交互式操作指南
 * 首次访问自动播放，右上角 ? 按钮可随时重新打开
 */
var _tourSteps = [];
var _tourIdx = -1;
var _tourRunning = false;

function buildTourSteps() {
  _tourSteps = [
    {
      title: '欢迎使用 论文AI利器',
      body: '一站式论文写作辅助平台。上传你的 .docx 论文后，即可使用全部功能。<br><br><b>本指南将带你快速了解所有核心功能。</b>',
      el: null, pos: 'center', icon: '👋'
    },
    {
      title: '📎 上传论文',
      body: '首先上传你的论文文件（仅支持 .docx 格式）。<br>文件仅在本机解析，不会上传到任何服务器。<br><br>上传完成后会自动弹出<b>标题层级校准弹窗</b>，确认章/节/小节。',
      el: function() { return document.getElementById('uploadOverlay') || document.getElementById('uploadDrop'); },
      pos: 'center', icon: '📎'
    },
    {
      title: '📐 标题层级校准',
      body: '上传后自动弹出校准弹窗：<br>• 展示文档中所有 Word 样式名及数量<br>• 分三步确认：章 → 节 → 小节<br>• 点击样式行弹出全量勾选确认<br>• 已确认样式自动在后续步骤隐藏',
      el: null, pos: 'center', icon: '📐'
    },
    {
      title: '🔍 论文审阅（核心模块）',
      body: '顶栏 <b>Ctrl+1</b> 进入论文审阅。<br>整合了格式检查、段落分析、术语分析，<br>三列并排展示所有维度的检测结果。<br>另外 <b>Ctrl+2</b> 优化建议给出针对性改进方案。',
      el: function() { return document.getElementById('moduleTabs'); },
      pos: 'bottom', icon: '🔍'
    },
    {
      title: '✍️ 论文扩写（新功能）',
      body: '顶栏 <b>Ctrl+3</b> 进入论文扩写。<br>• 自动检测各章文字量<br>• 标注不足章节并给出扩写方向建议<br>• 通用扩写策略：文献综述/理论框架/方法论',
      el: null, pos: 'center', icon: '✍️'
    },
    {
      title: '📈 数据分析（新功能）',
      body: '顶栏 <b>Ctrl+4</b> 进入数据分析。<br>• 上传 Excel/CSV 数据文件<br>• 自动识别数值型/分类型变量<br>• 输出描述统计与数据规律',
      el: null, pos: 'center', icon: '📈'
    },
    {
      title: '📊 论文报告',
      body: '顶栏右侧蓝色 <b>📊 报告</b> 按钮打开综合看板。<br>雷达图、章节分布、文献分析总览。',
      el: function() { return document.getElementById('dashboardBtn'); },
      pos: 'bottom', icon: '📊'
    },
    {
      title: '🔍 交互式文献检索',
      body: '检索时分为两步确认：<br>1. <b>检索结果确认</b> — 全选/筛选/勾选文献<br>2. <b>分配策略确认</b> — 预览每章分配<br>按 <b>Ctrl+Enter</b> 或点击 🔍检索 启动。',
      el: function() { return document.getElementById('baSearch'); },
      pos: 'bottom', icon: '🔍'
    },
    {
      title: '🕸️ 知识图谱',
      body: '顶栏 <b>Ctrl+5</b> 进入知识图谱。<br>三种视图：☁️词云 🔗网络图 📅时间线<br>支持 PNG 导出。',
      el: null, pos: 'center', icon: '🕸️'
    },
    {
      title: '📋 参考文献管理',
      body: '顶栏 <b>Ctrl+6</b> 进入参考文献。<br>自动识别原文引用、文献检索与注入、GB/T 7714 格式。<br>文献卡片显示位置信息与评分维度。',
      el: null, pos: 'center', icon: '📋'
    },
    {
      title: '💡 小提示',
      body: '⌨ <b>快捷键</b>：Ctrl+1~6 切换模块 | Ctrl+Enter 检索 | Ctrl+O 换论文<br>📜 <b>右上角更新日志</b> 查看功能变更记录<br>🔄 <b>刷新页面可恢复</b> 上次导入的论文<br>📐 <b>上传后检查标题层级</b>，可大幅提升目录树精度<br>点击右上角 <b>?</b> 重新查看本指南。',
      el: null, pos: 'center', icon: '💡'
    }
  ];
}

function renderTourTooltip(step) {
  // Remove old
  var old = document.getElementById('tour-tooltip');
  if (old) old.parentElement.removeChild(old);
  var oldBg = document.getElementById('tour-backdrop');
  if (oldBg) oldBg.parentElement.removeChild(oldBg);

  var s = _tourSteps[step];
  if (!s) return;

  var tt = document.createElement('div');
  tt.id = 'tour-tooltip';
  tt.style.cssText = 'position:fixed;z-index:100002;background:#fff;border-radius:18px;padding:24px 28px;box-shadow:0 25px 80px rgba(0,0,0,0.25);max-width:420px;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;font-size:.82rem;line-height:1.7;color:#1d1d1f;transition:opacity .3s,transform .3s;opacity:0;transform:translateY(8px)';
  document.body.appendChild(tt);

  // Backdrop
  var bg = document.createElement('div');
  bg.id = 'tour-backdrop';
  bg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.35);z-index:100001;transition:opacity .3s';
  document.body.appendChild(bg);

  // Build content
  var h = '';
  h += '<div style="font-size:2rem;margin-bottom:8px">' + (s.icon || '📋') + '</div>';
  h += '<div style="font-size:1.05rem;font-weight:700;margin-bottom:10px;color:#1d1d1f">' + s.title + '</div>';
  h += '<div style="color:#555;margin-bottom:20px">' + s.body + '</div>';

  // Progress dots
  h += '<div style="display:flex;justify-content:center;gap:6px;margin-bottom:16px">';
  for (var i = 0; i < _tourSteps.length; i++) {
    h += '<span style="width:8px;height:8px;border-radius:50%;background:' + (i === step ? '#0071e3' : '#d1d5db') + ';transition:background .3s"></span>';
  }
  h += '</div>';

  // Buttons
  h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">';
  if (step > 0) {
    h += '<button onclick="tourPrev()" style="background:rgba(0,0,0,0.05);border:none;padding:8px 16px;border-radius:10px;cursor:pointer;font-size:.75rem;color:#555">← 上一步</button>';
  } else {
    h += '<span></span>';
  }
  h += '<span style="font-size:.68rem;color:#86868b">' + (step + 1) + '/' + _tourSteps.length + '</span>';
  if (step < _tourSteps.length - 1) {
    h += '<button onclick="tourNext()" style="background:#0071e3;color:#fff;border:none;padding:8px 20px;border-radius:10px;cursor:pointer;font-size:.75rem;font-weight:600">下一步 →</button>';
    h += '<button onclick="tourEnd()" style="background:transparent;color:#86868b;border:none;padding:8px 12px;cursor:pointer;font-size:.7rem">跳过</button>';
  } else {
    h += '<button onclick="tourEnd()" style="background:#0071e3;color:#fff;border:none;padding:8px 24px;border-radius:10px;cursor:pointer;font-size:.75rem;font-weight:600">开始使用 🎉</button>';
  }
  h += '</div>';

  tt.innerHTML = h;

  // Position
  requestAnimationFrame(function() {
    var target = s.el ? (typeof s.el === 'function' ? s.el() : s.el) : null;
    var ttW = tt.offsetWidth, ttH = tt.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;
    var x, y;

    if (target && target.offsetParent && s.pos !== 'center') {
      var rect = target.getBoundingClientRect();
      // Highlight target
      var hl = document.createElement('div');
      hl.style.cssText = 'position:fixed;z-index:100001;border-radius:10px;box-shadow:0 0 0 4px #0071e3,0 0 0 9999px rgba(0,0,0,0.35);pointer-events:none;transition:all .3s';
      hl.style.left = (rect.left - 6) + 'px';
      hl.style.top = (rect.top - 6) + 'px';
      hl.style.width = (rect.width + 12) + 'px';
      hl.style.height = (rect.height + 12) + 'px';
      hl.id = 'tour-highlight';
      document.body.appendChild(hl);

      if (s.pos === 'bottom') {
        x = Math.max(12, Math.min(vw - ttW - 12, rect.left + rect.width / 2 - ttW / 2));
        y = rect.bottom + 14;
      } else { // top
        x = Math.max(12, Math.min(vw - ttW - 12, rect.left + rect.width / 2 - ttW / 2));
        y = rect.top - ttH - 14;
      }
    } else {
      // Center
      x = (vw - ttW) / 2;
      y = (vh - ttH) / 2;
    }

    tt.style.left = x + 'px';
    tt.style.top = Math.max(20, Math.min(vh - ttH - 20, y)) + 'px';
    tt.style.opacity = '1';
    tt.style.transform = 'translateY(0)';
    bg.style.opacity = '1';
  });
}

function tourStart() {
  buildTourSteps();
  _tourIdx = 0;
  _tourRunning = true;
  renderTourTooltip(0);
}

function tourNext() {
  var oldHl = document.getElementById('tour-highlight');
  if (oldHl) oldHl.parentElement.removeChild(oldHl);
  if (_tourIdx < _tourSteps.length - 1) {
    _tourIdx++;
    renderTourTooltip(_tourIdx);
  } else {
    tourEnd();
  }
}

function tourPrev() {
  var oldHl = document.getElementById('tour-highlight');
  if (oldHl) oldHl.parentElement.removeChild(oldHl);
  if (_tourIdx > 0) {
    _tourIdx--;
    renderTourTooltip(_tourIdx);
  }
}

function tourEnd() {
  _tourRunning = false;
  var tt = document.getElementById('tour-tooltip');
  if (tt) tt.parentElement.removeChild(tt);
  var bg = document.getElementById('tour-backdrop');
  if (bg) bg.parentElement.removeChild(bg);
  var hl = document.getElementById('tour-highlight');
  if (hl) hl.parentElement.removeChild(hl);

  // Mark as seen
  try { sessionStorage.setItem('thesis_ai_tour_seen', '1'); } catch (e) {}

  // If thesis not loaded, show upload overlay
  if (!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100)) {
    if (typeof showUploadOverlay === 'function') showUploadOverlay();
  }
}

// ========== Init ==========
(function() {
  var seen = false;
  try { seen = sessionStorage.getItem('thesis_ai_tour_seen'); } catch (e) {}

  if (!seen) {
    // 只在登录后启动（不在登录页触发）
    var isLoggedIn = false;
    try { isLoggedIn = sessionStorage.getItem('thesis_ai_login') === 'true'; } catch (e) {}
    if (!isLoggedIn) return;
    // Wait for DOM + libraries
    var checks = 0;
    var timer = setInterval(function() {
      checks++;
      if (typeof showLoad !== 'undefined') {
        clearInterval(timer);
        setTimeout(tourStart, 400);
      }
      if (checks > 50) clearInterval(timer); // give up after 5s
    }, 100);
  }
})();
