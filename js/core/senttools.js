/**
 * SentenceTools — 句子级操作工具栏
 * 选中论文正文中的文本 → 弹出工具栏 → 选择操作
 */
(function(){
  'use strict';

  var _toolbar = null;
  var _selectedText = '';

  function getToolbar() {
    if (!_toolbar) {
      _toolbar = document.createElement('div');
      _toolbar.id = 'sentenceToolbar';
      _toolbar.style.cssText = 'position:absolute;display:none;z-index:100;background:#1e293b;color:#fff;border-radius:10px;padding:6px 8px;box-shadow:0 8px 30px rgba(0,0,0,.3);font-size:12px;white-space:nowrap;pointer-events:auto';
      document.body.appendChild(_toolbar);
    }
    return _toolbar;
  }

  function hide() {
    var tb = getToolbar();
    tb.style.display = 'none';
    _selectedText = '';
  }

  function show(x, y, text) {
    _selectedText = text || '';
    var tb = getToolbar();
    var tools = [
      { id: 'proofread', label: '查错', icon: '✏️' },
      { id: 'de-duplicate', label: '降重', icon: '📋' },
      { id: 'terminology', label: '术语', icon: '🔤' },
      { id: 'expand', label: '扩写', icon: '📝' },
      { id: 'references', label: '引用', icon: '📋' },
    ];

    var h = '<div style="display:flex;gap:4px;align-items:center">';
    tools.forEach(function(t) {
      h += '<button onclick="event.stopPropagation();_openSentenceTool(\'' + t.id + '\')" style="border:none;background:rgba(255,255,255,.1);color:#fff;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;transition:background .1s" onmouseenter="this.style.background=\'rgba(255,255,255,.2)\'" onmouseleave="this.style.background=\'rgba(255,255,255,.1)\'">' + t.icon + ' ' + t.label + '</button>';
    });
    h += '<button onclick="event.stopPropagation();_closeSentenceToolbar()" style="border:none;background:transparent;color:rgba(255,255,255,.4);cursor:pointer;font-size:14px;padding:5px">&times;</button>';
    h += '</div>';

    tb.innerHTML = h;
    // 定位到鼠标上方
    tb.style.left = Math.min(x, window.innerWidth - 400) + 'px';
    tb.style.top = Math.max(y - 50, 10) + 'px';
    tb.style.display = 'block';
  }

  // 当选择论文正文文本时显示工具栏
  function onThesisSelection(e) {
    // 检查选择是否在 thesisBox 内
    var tb = document.getElementById('thesisBox');
    if (!tb) return;

    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().trim().length < 3) {
      hide();
      return;
    }

    var range = sel.getRangeAt(0);
    if (!tb.contains(range.commonAncestorContainer)) {
      hide();
      return;
    }

    // 在鼠标位置显示工具栏
    show(e.clientX, e.clientY, sel.toString().trim());
  }

  // 从选中的模块中打开, 带已选文本
  window._openSentenceTool = function(moduleId) {
    // 将选中文本临时存储到模块
    window._sentenceToolInput = _selectedText;
    window._open(moduleId);
    hide();
  };

  window._closeSentenceToolbar = function() {
    hide();
  };

  // 初始化
  document.addEventListener('mouseup', function(e) {
    // 延迟让选择完成
    setTimeout(function() { onThesisSelection(e); }, 100);
  });

  document.addEventListener('click', function(e) {
    var tb = getToolbar();
    if (tb.style.display !== 'none' && !tb.contains(e.target)) {
      hide();
    }
  });

  // 论文切换时隐藏
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') hide();
  });

  console.log('[TB] SentenceTools ready. Select text in thesis to activate.');

})();
