/**
 * PaperImport — 论文导入模块
 * 封装 DOCX 导入流程，提供简洁的导入接口
 *
 * 依赖 app.js 中的 mammoth 解析 + 标题校准 + 全文树构建逻辑。
 * 此模块仅负责入口 UI 和流程编排。
 */
var PaperImport = (function() {
  'use strict';

  function showUploadDialog(intent) {
    intent = intent || 'new';
    if (typeof showUploadOverlay === 'function') {
      showUploadOverlay();
    } else {
      var el = document.getElementById('uploadOverlay');
      if (el) el.classList.add('show');
    }
  }

  function openImport(intent) {
    window._importIntent = intent || 'new';
    var input = document.getElementById('fileInput');
    if (input) input.click();
    else showUploadDialog(intent);
  }

  /**
   * 初始化导入模块，绑定文件输入事件和拖放。
   */
  function init() {
    var fileInput = document.getElementById('fileInput');
    if (!fileInput) return;

    fileInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var intent = window._importIntent || 'new';
      if (typeof beginImportFile === 'function') {
        beginImportFile(file, intent).catch(function(err) {
          console.error('[PaperImport] Import failed:', err);
          if (typeof ttp === 'function') ttp('导入失败: ' + (err.message || '未知错误'));
        });
      }
    });

    // 为拖放区域绑定事件
    var drop = document.getElementById('uploadDrop');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function(evName) {
        drop.addEventListener(evName, function(e) {
          e.preventDefault();
          e.stopPropagation();
          drop.classList.add('dragover');
        }, false);
      });
      ['dragleave', 'drop'].forEach(function(evName) {
        drop.addEventListener(evName, function(e) {
          e.preventDefault();
          e.stopPropagation();
          drop.classList.remove('dragover');
        }, false);
      });
      drop.addEventListener('drop', function(e) {
        var files = e.dataTransfer.files;
        if (files.length && typeof beginImportFile === 'function') {
          beginImportFile(files[0], window._importIntent || 'new').catch(function(err) {
            console.error('[PaperImport] Drop import failed:', err);
          });
        }
      });
    }
  }

  // ── Public API ──
  return {
    init: init,
    open: openImport,
    showUploadDialog: showUploadDialog
  };
})();
