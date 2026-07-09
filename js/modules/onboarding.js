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
      body: '一站式论文写作辅助平台。<br>上传你的 .docx 论文后，即可使用全部功能。<br><br><b>本指南将带你快速了解所有核心功能。</b>',
      el: null, pos: 'center',
      icon: '👋'
    },
    {
      title: '📎 上传论文',
      body: '首先上传你的论文文件（仅支持 .docx 格式）。<br>文件仅在本机解析，不会上传到任何服务器。<br><br>上传完成后自动进入系统。',
      el: function() { return document.getElementById('uploadOverlay') || document.getElementById('uploadDrop'); },
      pos: 'center',
      icon: '📎'
    },
    {
      title: '模块切换',
      body: '上传论文后，顶栏中央会显示所有功能模块。<br>点击标签即可切换，也可以使用快捷键 <b>Ctrl+1~6</b>。<br><br>模块从左到右：格式检查 → 术语分析 → 段落分析 → 优化建议 → 知识图谱 → 参考文献',
      el: function() { return document.getElementById('moduleTabs'); },
      pos: 'bottom',
      icon: '🏷️'
    },
    {
      title: '操作按钮',
      body: '顶栏右侧是全局操作按钮：<br><b>🔍 检索文献</b> — 自动搜索匹配论文主题的文献<br><b>✅ 批量校验</b> — 验证文献真实性<br><b>📋 导出</b> — 复制 GB/T 7714 格式参考文献<br><b>📎 换论文</b> — 上传新的论文文件',
      el: function() { return document.getElementById('barActions'); },
      pos: 'bottom',
      icon: '🔧'
    },
    {
      title: '📋 参考文献 — 核心功能',
      body: '切换到参考文献模块后：<br>1. 查看已自动识别的原文引用<br>2. 点击 <b>🔍 检索文献</b> 自动搜索新文献<br>3. 新文献自动按章节分配并注入正文<br>4. 点击 <b>📋 导出</b> 一键复制全部参考文献',
      el: null, pos: 'center',
      icon: '📋'
    },
    {
      title: '🕸️ 知识图谱',
      body: '切换到知识图谱模块 → 点击"打开知识图谱"。<br>包含三种视图：<br>☁️ <b>词云</b> — 交互式关键词可视化<br>🔗 <b>网络图</b> — 力导向节点关系图<br>📅 <b>时间线</b> — 文献按年份分布<br><br>点击词汇可高亮关联节点。',
      el: null, pos: 'center',
      icon: '🕸️'
    },
    {
      title: '分析模块',
      body: '四个分析模块帮助优化论文：<br>✅ <b>格式检查</b> — 标题层级、图表编号<br>🔤 <b>术语分析</b> — 术语一致性、缩写检查<br>📝 <b>段落分析</b> — 可读性评分、过渡词<br>💡 <b>优化建议</b> — 结构诊断、文献密度、摘要评估',
      el: null, pos: 'center',
      icon: '🔍'
    },
    {
      title: '📊 论文看板',
      body: '点击顶栏中央的圆形按钮打开 <b>论文看板</b>。<br>综合评估报告：五维雷达图、综合评分、<br>章节分布、优先建议，一页纵览论文全局。',
      el: null, pos: 'center', icon: '📊'
    },
    {
      title: '💡 小提示',
      body: '⌨ <b>快捷键</b>：Ctrl+1~6 切换模块 | Ctrl+Enter 检索 | Ctrl+B 导出 | Ctrl+O 换论文<br>📄 <b>知识图谱中可导出分析报告</b><br>🔗 <b>顶栏补全DOI按钮可自动补全缺失信息</b><br><br>点击右上角 <b>?</b> 按钮可随时重新查看本指南。',
      el: null, pos: 'center',
      icon: '💡'
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
