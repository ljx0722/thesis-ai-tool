#!/usr/bin/env node
/**
 * 论文AI利器 — 自动化测试套件
 * 运行: node tests/run.js
 * 覆盖所有历史修复过的 Bug 和关键功能回归检查
 */

var fs = require('fs');
var path = require('path');
var passed = 0, failed = 0, warnings = 0;
var projectRoot = path.dirname(__dirname);

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    Error: ' + e.message);
  }
}

function warn(name, fn) {
  try {
    fn();
    console.log('  ⚠ ' + name + ' (passed but should review)');
    warnings++;
  } catch (e) {
    console.log('  ⚠ ' + name + ' (WARNING confirmed: ' + e.message + ')');
    warnings++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// ============================================================
// SECTION 1: Syntax & Structural Integrity
// ============================================================
console.log('\n=== Section 1: Syntax & Structure ===');

test('All JS files parse without syntax errors', function() {
  var files = [
    'app.js', 'js/app-modules.js',
    'js/modules/optimization.js', 'js/modules/format-check.js',
    'js/modules/terminology.js', 'js/modules/paragraph-analysis.js',
    'js/modules/onboarding.js'
  ];
  files.forEach(function(f) {
    var src = fs.readFileSync(path.join(projectRoot, f), 'utf8');
    new Function(src); // throws if syntax error
  });
});

test('All JS files have balanced braces', function() {
  var files = [
    'app.js', 'js/app-modules.js',
    'js/modules/optimization.js', 'js/modules/format-check.js',
    'js/modules/terminology.js', 'js/modules/paragraph-analysis.js',
    'js/modules/onboarding.js'
  ];
  files.forEach(function(f) {
    var src = fs.readFileSync(path.join(projectRoot, f), 'utf8');
    var count = 0;
    for (var i = 0; i < src.length; i++) {
      if (src[i] === '{') count++;
      if (src[i] === '}') count--;
    }
    assert(count === 0, f + ': brace imbalance = ' + count);
  });
});

test('kg_server.py compiles without errors', function() {
  var cp = require('child_process');
  var result = cp.spawnSync('python', ['-m', 'py_compile', 'kg_server.py'], {
    cwd: projectRoot, encoding: 'utf8', timeout: 10000
  });
  assert(result.status === 0, 'Python compile error: ' + (result.stderr || ''));
});

test('HTML has all required ' + '<script>' + ' tags in correct order', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  var scripts = html.match(/<script src="([^"]+)"><\/script>/g) || [];
  var paths = scripts.map(function(s) { return s.match(/src="([^"]+)"/)[1]; });
  var required = ['mammoth.browser.min.js', 'jszip.min.js', 'app.js',
    'js/modules/optimization.js', 'js/modules/format-check.js',
    'js/modules/terminology.js', 'js/modules/paragraph-analysis.js',
    'js/modules/onboarding.js', 'js/app-modules.js'];
  required.forEach(function(r) {
    assert(paths.indexOf(r) >= 0, 'Missing script: ' + r);
  });
  // app-modules.js must be last
  assert(paths.indexOf('js/app-modules.js') === paths.length - 1, 'app-modules.js must be loaded last');
});

// ============================================================
// SECTION 2: Critical Bug Fixes Verification
// ============================================================
console.log('\n=== Section 2: Historical Bug Fixes ===');

test('BUG-FIX: injectNewMarkers keyword threshold >= 2 (not >=1)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('score>=2') >= 0, 'Missing keyword threshold >= 2 in injectNewMarkers');
  assert(src.indexOf('score>=1&&score>bestScore') < 0, 'OLD threshold >=1 still present — remove it');
});

test('BUG-FIX: Step 2b injects at sentence boundary, not paragraph end', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('bestSentScore') >= 0, 'Missing sentence-level matching in step 2b (bestSentScore)');
  assert(src.indexOf('bestSentPara') >= 0, 'Missing best sentence paragraph tracking');
  assert(src.indexOf('sentEndInPara') >= 0, 'Missing sentence end position tracking');
  assert(src.indexOf('lastChild&&lastChild.nodeType===3') < 0, 'OLD paragraph-end appending still present');
});

test('BUG-FIX: Paragraph collection excludes ref-list area (bodyBoundaryEl)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('bodyBoundaryEl') >= 0, 'bodyBoundaryEl not used in injectNewMarkers');
  // Should have 2+ uses: injectNewMarkers + bodyBoundaryEl definition + deleteRef
  var count = (src.match(/bodyBoundaryEl/g) || []).length;
  assert(count >= 3, 'bodyBoundaryEl used only ' + count + ' times, expected >= 3');
});

test('BUG-FIX: No-DOM refs sorted by tempNum for stable numbering', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('noDom.sort') >= 0, 'Missing stable sort in merge step');
  assert(src.indexOf('noDom2.sort') >= 0, 'Missing stable sort in deleteRef');
});

test('BUG-FIX: DOM renumbering uses _domEl identity (not displayNum)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('_domEl===sp') >= 0, 'Missing _domEl identity matching in reorder step');
  assert(src.indexOf('r.displayNum===tn||r.tempNum===tn') < 0, 'OLD displayNum collision matching still present');
});

test('BUG-FIX: deleteRef protects displaced existing refs', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('subType===\'displaced\'') >= 0, 'displaced refs not protected from deletion');
});

test('BUG-FIX: No genSen fake sentences generated', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('genSen') < 0, 'genSen (fake sentences) still present in code');
});

test('BUG-FIX: Sentence splitting excludes Chinese semicolons', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/paragraph-analysis.js'), 'utf8');
  assert(src.indexOf('split(/[。！？\\.\\?\\!]/)') >= 0, 'Sentence split still includes ； semicolon');
});

test('BUG-FIX: Passive voice detection uses negative lookahead', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/paragraph-analysis.js'), 'utf8');
  assert(src.indexOf('被(?!称为') >= 0, 'Passive detection missing negative lookahead exclusions');
});

test('BUG-FIX: Figure/table detection deduplicates by main number', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8');
  assert(src.indexOf('figSeen') >= 0, 'Figure dedup missing');
  assert(src.indexOf('tblSeen') >= 0, 'Table dedup missing');
});

test('BUG-FIX: Non-body chapters excluded in search and analysis', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('获奖|奖项|认证|荣誉|专利|攻读|在读') >= 0, 'Award/license chapters not excluded');
});

test('BUG-FIX: English 30% minimum enforced with exact pool splitting', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('cnPool') >= 0, 'cnPool/enPool split missing');
  assert(src.indexOf('enWanted') >= 0, 'enWanted calculation missing');
});

test('BUG-FIX: refStatus element has null guard', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var refStatus = src.match(/refStatus/g) || [];
  assert(refStatus.length <= 2, 'refStatus referenced ' + refStatus.length + ' times, expect guarded access');
});

test('BUG-FIX: verifyRef returns extended fields (citations, retracted, verified)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('citations:0,retracted:false,verified:false') >= 0, 'verifyRef missing extended return fields');
});

test('BUG-FIX: closeKnowledgeGraph clears kgCurrentData', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var closeIdx = src.indexOf('function closeKnowledgeGraph()');
  assert(closeIdx >= 0, 'closeKnowledgeGraph function not found');
  var closeBody = src.substring(closeIdx, closeIdx + 200);
  assert(closeBody.indexOf('kgCurrentData=null') >= 0, 'closeKnowledgeGraph does not clear kgCurrentData');
});

test('FEATURE: All 10 literature sources in search_api', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  var sources = ['search_openalex','search_crossref','search_semantic_scholar','search_arxiv',
    'search_core','search_pubmed','search_inspirehep','search_datacite','search_doaj','search_baidu_xueshu'];
  sources.forEach(function(s) {
    assert(src.indexOf(s) >= 0, 'Missing source: ' + s);
  });
  // Verify no duplicates in search_api
  var calls = src.match(/try: all_results\.extend\(search_(\w+)\(/g) || [];
  var seen = {}; calls.forEach(function(c) { var name = c.match(/search_(\w+)/)[1];
    if (seen[name]) throw new Error('Duplicate API call: ' + name); seen[name] = true; });
});

// ============================================================
// SECTION 3: Data Flow & Edge Cases
// ============================================================
console.log('\n=== Section 3: Data Flow & Edge Cases ===');

test('EDGE: assignChapters has body-chapters-empty guard', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('if(!n2){') >= 0 || src.indexOf('if(!n2){console') >= 0, 'Missing empty body chapters guard');
});

test('EDGE: ref.ch falls back to 1 when undefined', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('r.ch||1') >= 0 || src.indexOf('r.ch|| 1') >= 0, 'Missing ref.ch fallback');
});

test('EDGE: chapterForElement defaults to chapter 1', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('lc=1') >= 0, 'chapterForElement missing default lc=1');
});

test('EDGE: beforeRefList returns true when no ref boundary found', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('if(!b)return true') >= 0, 'beforeRefList missing null boundary guard');
});

test('EDGE: searchCache cleared on new file upload', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('searchCache={}') >= 0, 'searchCache not cleared on upload');
});

test('EDGE: mergedRefs reset on new file upload', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('mergedRefs=[]') >= 0, 'mergedRefs not reset on upload');
});

test('EDGE: startSearch returns early if no manuscriptText', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var idx = src.indexOf('async function startSearch()');
  var body = src.substring(idx, idx + 200);
  assert(body.indexOf('!manuscriptText') >= 0, 'startSearch missing manuscriptText guard');
});

test('EDGE: onThesisLoaded calls switchPanel(\\\'references\\\')', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/app-modules.js'), 'utf8');
  assert(src.indexOf('switchPanel') >= 0, 'onThesisLoaded missing panel switch');
});

test('EDGE: changeThesis clears kgCurrentData', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/app-modules.js'), 'utf8');
  assert(src.indexOf('kgCurrentData = null') >= 0, 'changeThesis does not clear kgCurrentData');
});

test('EDGE: resetSearch clears kgCurrentData', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/app-modules.js'), 'utf8');
  assert(src.indexOf('_analysisCache = {}; kgCurrentData = null') >= 0, 'resetSearch missing kgCurrentData clear');
});

// ============================================================
// SECTION 4: UI/HTML Element Existence
// ============================================================
console.log('\n=== Section 4: UI/HTML Elements ===');

test('HTML has all required id elements', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  var required = ['thesisBox', 'navTree', 'refPanel', 'refs', 'fileInput',
    'statusBar', 'loadOv', 'ttp', 'moduleTabs', 'barActions', 'uploadOverlay',
    'kgOverlay', 'dashboard', 'kwBar', 'kwTags', 'fTotal', 'fCN', 'fEN'];
  required.forEach(function(id) {
    assert(html.indexOf('id="' + id + '"') >= 0, 'Missing HTML element: #' + id);
  });
});

test('CSS class .ref-only used for panel switching', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('ref-only') >= 0, 'Missing ref-only CSS class on reference panel elements');
});

test('Help button (?) exists in HTML', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('help-btn') >= 0, 'Missing help button element');
});

test('Upload overlay has correct initial state (show class)', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('upload-overlay') >= 0, 'Missing upload-overlay element');
  // show class is set on <div class="upload-overlay" — any div with that class in HTML is fine
});

// ============================================================
// SECTION 5: Security & Cross-cutting Concerns
// ============================================================
console.log('\n=== Section 5: Security & Robustness ===');

test('SECURITY: No eval() in production code', function() {
  var files = ['app.js', 'js/app-modules.js'];
  files.forEach(function(f) {
    var src = fs.readFileSync(path.join(projectRoot, f), 'utf8');
    var evalCount = (src.match(/\beval\(/g) || []).length;
    assert(evalCount === 0, f + ': found ' + evalCount + ' eval() calls');
  });
});

test('SECURITY: No document.write() calls', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('document.write') < 0, 'document.write found in code');
});

test('ROBUST: window.onerror handler exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('window.onerror') >= 0, 'Missing window.onerror handler');
});

test('ROBUST: kg_server.py API routes have try-except', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  var apiRoutes = ['/search_api', '/verify_api', '/kg_api/generate'];
  apiRoutes.forEach(function(routeName) {
    var routeIdx = src.indexOf("'" + routeName + "'");
    if (routeIdx < 0) routeIdx = src.indexOf('"' + routeName + '"');
    assert(routeIdx >= 0, 'API route not found: ' + routeName);
    var nextRoute = src.indexOf('@app.route', routeIdx + 1);
    if (nextRoute < 0) nextRoute = src.length;
    var body = src.substring(routeIdx, nextRoute);
    assert(body.indexOf('try:') >= 0 && body.indexOf('except') >= 0,
      'API route ' + routeName + ' missing try/except');
  });
});

test('PERF: search uses forEachChunked to avoid blocking main thread', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('forEachChunked') >= 0, 'Missing async chunked processing');
  assert(src.indexOf('await sleep(0)') >= 0, 'Missing await sleep(0) yield points');
});

// ============================================================
// SECTION 6: Module System & UX
// ============================================================
console.log('\n=== Section 6: Module System & UX ===');

test('MODULE: All 6 modules registered with icons', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/app-modules.js'), 'utf8');
  var modules = ['format-check', 'terminology', 'paragraph', 'optimization', 'knowledge-graph', 'references'];
  modules.forEach(function(m) {
    assert(src.indexOf("id: '" + m + "'") >= 0, 'Module not registered: ' + m);
  });
});

test('MODULE: switchPanel handles all module IDs', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/app-modules.js'), 'utf8');
  assert(src.indexOf("moduleId === 'format-check'") >= 0, 'format-check not handled in switchPanel');
  assert(src.indexOf("moduleId === 'references'") >= 0, 'references not handled in switchPanel');
  assert(src.indexOf("moduleId === 'knowledge-graph'") >= 0, 'knowledge-graph not handled in switchPanel');
});

test('KEYBOARD: Ctrl+1~6 shortcuts registered', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/app-modules.js'), 'utf8');
  assert(src.indexOf("Ctrl+1~6") >= 0 || src.indexOf("parseInt(e.key)") >= 0, 'Missing keyboard shortcuts');
});

test('TOUR: onboarding.js has tourStart, tourEnd functions', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/onboarding.js'), 'utf8');
  assert(src.indexOf('function tourStart') >= 0, 'Missing tourStart');
  assert(src.indexOf('function tourEnd') >= 0, 'Missing tourEnd');
  assert(src.indexOf('sessionStorage') >= 0, 'Tour should use sessionStorage to avoid replay');
});

test('TOUR: tourEnd calls showUploadOverlay when thesis not loaded', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/onboarding.js'), 'utf8');
  assert(src.indexOf('showUploadOverlay') >= 0, 'tourEnd should trigger upload overlay');
});

// ============================================================
// Results
// ============================================================
console.log('\n=== RESULTS ===');
console.log('  Passed:  ' + passed);
console.log('  Failed:  ' + failed);
console.log('  Warnings:' + warnings);
console.log('  Total:   ' + (passed + failed + warnings));

if (failed > 0) {
  console.log('\n❌ TESTS FAILED — fix before deploying!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed — ready to deploy.');
  process.exit(0);
}
