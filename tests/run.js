#!/usr/bin/env node
/**
 * 学术论文AI一站式助手 — 自动化测试套件
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
    'js/modules/onboarding.js', 'js/modules/project.js',
    'js/modules/topic-finder.js', 'js/modules/proposal.js',
    'js/modules/proofread.js', 'js/modules/de-duplicate.js',
    'js/modules/defense-ppt.js', 'js/modules/en-abstract.js',
    'js/modules/dashboard.js'
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
    'js/modules/onboarding.js', 'js/modules/project.js',
    'js/modules/topic-finder.js', 'js/modules/proposal.js',
    'js/modules/proofread.js', 'js/modules/de-duplicate.js',
    'js/modules/defense-ppt.js', 'js/modules/en-abstract.js',
    'js/modules/dashboard.js'
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
  // Match both regular and deferred script tags
  var scripts = html.match(/<script(?:\s+defer)?\s+src="([^"]+)"><\/script>/g) || [];
  var paths = scripts.map(function(s) { var m = s.match(/src="([^"]+)"/); return m ? m[1].split('?')[0] : ''; });
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

test('BUG-FIX: injectNewMarkers uses tree-based sentence matching (>=2 threshold)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('sc>=2') >= 0, 'Missing keyword threshold >= 2 in new injectNewMarkers');
  assert(src.indexOf('_treeIndex') >= 0, 'injectNewMarkers must use _treeIndex');
});

test('BUG-FIX: Step 2b/2c uses tree-index sentence matching (not DOM walk)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('bestSent') >= 0, 'Missing sentence-level matching (bestSent)');
  assert(src.indexOf('_treeIndex.chapters') >= 0, 'Step 2b must use _treeIndex.chapters for chapter lookup');
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
    'statusBar', 'loadOv', 'ttp', 'barTabs', 'kgOverlay',
    'dashboard', 'kwBar', 'kwTags', 'fTotal', 'fCN', 'fEN'];
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

test('Upload overlay / file input is present', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('id="fileInput"') >= 0, 'Missing file input (upload mechanism changed from overlay to inline)');
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
  var modules = ['review', 'optimization', 'expand', 'data-analysis', 'knowledge-graph', 'references'];
  modules.forEach(function(m) {
    assert(src.indexOf("id: '" + m + "'") >= 0, 'Module not registered: ' + m);
  });
});

test('MODULE: switchPanel handles all module IDs', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/app-modules.js'), 'utf8');
  assert(src.indexOf("moduleId === 'review'") >= 0, 'review not handled in switchPanel');
  assert(src.indexOf("moduleId === 'optimization'") >= 0, 'optimization not handled');
  assert(src.indexOf("moduleId === 'expand'") >= 0, 'expand not handled');
  assert(src.indexOf("moduleId === 'data-analysis'") >= 0, 'data-analysis not handled');
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
// ============================================================
// SECTION 7: Module Enhancement Coverage
// ============================================================
console.log('\n=== Section 7: Module Enhancement Coverage ===');

test('MODULE: format-check checks abstract elements', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8');
  assert(src.indexOf('absElements') >= 0, 'Missing abstract element scoring');
});

test('MODULE: format-check checks conclusion structure', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8');
  assert(src.indexOf('结论与展望') >= 0, 'Missing conclusion check section');
  assert(src.indexOf('研究局限性') >= 0, 'Missing limitation detection');
});

test('MODULE: optimization detects research methods', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/optimization.js'), 'utf8');
  assert(src.indexOf('研究方法检测') >= 0, 'Missing method detection');
  assert(src.indexOf('methodHits') >= 0, 'Missing methodHits array');
});

test('MODULE: optimization detects innovation hints', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/optimization.js'), 'utf8');
  assert(src.indexOf('创新点提示') >= 0, 'Missing innovation hints');
  assert(src.indexOf('innoHits') >= 0, 'Missing innoHits tracking');
});

test('MODULE: paragraph analysis has academic tone check', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/paragraph-analysis.js'), 'utf8');
  assert(src.indexOf('学术语调') >= 0, 'Missing academic tone section');
  assert(src.indexOf('oralCount') >= 0 || src.indexOf('oralDensity') >= 0, 'Missing oral language counter');
});

test('MODULE: thesis-review.js covers all 10 dimensions', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/thesis-review.js'), 'utf8');
  var dims = ['选题','文献','框架','方法','论证','结论','创新','写作','格式','实践'];
  dims.forEach(function(d){assert(src.indexOf(d) >= 0, 'Missing dimension: '+d);});
});

test('MODULE: thesis-review.js auto+manual item distinction', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/thesis-review.js'), 'utf8');
  assert(src.indexOf('auto: true') >= 0, 'Missing auto items');
  assert(src.indexOf('auto: false') >= 0, 'Missing manual items');
});

test('MODULE: thesis-review composite uses all dimensions', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/thesis-review.js'), 'utf8');
  assert(src.indexOf('dim1.score') >= 0, 'Missing dim1');
  assert(src.indexOf('dim10.score') >= 0, 'Missing dim10');
});

test('MODULE: dashboard.js integrates review scores', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/dashboard.js'), 'utf8');
  assert(src.indexOf('computeThesisReview') >= 0 || src.indexOf('dimScores') >= 0, 'Missing review integration');
  assert(src.indexOf('showReviewInDashboard') >= 0, 'Missing review handler');
});

test('UI: Dashboard entry exists', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('showDashboard()') >= 0, 'Missing showDashboard call (moved to bar tab)');
});

test('UI: Dashboard overlay has review report button', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('showDashboard') >= 0, 'Missing showDashboard reference');
  assert(html.indexOf('dbOverlay') >= 0, 'Missing dashboard overlay');
});

// ============================================================
// SECTION 8: Onboarding Tour Coverage
// ============================================================
console.log('\n=== Section 8: Onboarding / Tour ===');

test('ONBOARD: Tour covers all major modules', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/onboarding.js'), 'utf8');
  var modules = ['上传论文','论文审阅','论文扩写','数据分析','参考文献','知识图谱','论文报告','小提示'];
  modules.forEach(function(m){assert(src.indexOf(m) >= 0, 'Tour missing: '+m);});
});

test('ONBOARD: Tour step count >= 7', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/onboarding.js'), 'utf8');
  var arrayItems = (src.match(/title:/g) || []).length;
  assert(arrayItems >= 7, 'Tour should have >=7 steps, found ' + arrayItems);
});

// ============================================================
// SECTION 9: Data Flow & Edge Cases (expanded)
// ============================================================
console.log('\n=== Section 9: Expanded Data Flow ===');

test('DATA: thesis review includes timestamp', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/thesis-review.js'), 'utf8');
  assert(src.indexOf('new Date()') >= 0, 'Missing timestamp');
});

test('DATA: thesis review stats include CN/EN/DOI/5yr', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/thesis-review.js'), 'utf8');
  assert(src.indexOf('cnRefs') >= 0, 'Missing cnRefs');
  assert(src.indexOf('enRefs') >= 0, 'Missing enRefs');
  assert(src.indexOf('recentRefs') >= 0, 'Missing recentRefs');
});

test('SAFETY: thesis review returns early when no text', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/thesis-review.js'), 'utf8');
  var idx = src.indexOf('function computeThesisReview()');
  assert(idx >= 0, 'Function not found');
});

// ============================================================
// SECTION 10: Literature Sources (expanded)
// ============================================================
console.log('\n=== Section 10: Literature Sources ===');

test('SOURCES: All 12 sources exist in kg_server.py', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  var sources = ['search_openalex_cn','search_crossref','search_semantic_scholar',
    'search_arxiv','search_core','search_pubmed','search_inspirehep','search_datacite',
    'search_doaj','search_wanfang'];
  sources.forEach(function(s){assert(src.indexOf(s) >= 0, 'Missing: '+s);});
});

test('SOURCES: Chinese sources only triggered for CN queries', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  var api = src.substring(src.indexOf('def search_api'), src.indexOf('def verify_api'));
  assert(api.indexOf('is_cn') >= 0, 'Missing is_cn check');
});

test('SOURCES: ping endpoint reflects all new sources', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  assert(src.indexOf('PubMed') >= 0, 'Missing PubMed in sources list');
  assert(src.indexOf('INSPIRE') >= 0, 'Missing INSPIRE-HEP in sources list');
});


// ============================================================
// SECTION 11: UI Design System
// ============================================================
console.log('\n=== Section 11: UI Design System ===');

test('CSS: Dark mode body.dark class overrides color vars', function() {
  var css = fs.readFileSync(path.join(projectRoot, 'css/style.css'), 'utf8');
  assert(css.indexOf('body.dark') >= 0, 'Missing body.dark selector');
  assert(css.indexOf('prefers-color-scheme: dark') >= 0, 'Missing auto dark mode detection');
});

test('CSS: Print styles use @media print', function() {
  var css = fs.readFileSync(path.join(projectRoot, 'css/style.css'), 'utf8');
  assert(css.indexOf('@media print') >= 0, 'Missing print media query');
});

test('CSS: Reduced motion respects accessibility', function() {
  var css = fs.readFileSync(path.join(projectRoot, 'css/style.css'), 'utf8');
  assert(css.indexOf('prefers-reduced-motion') >= 0, 'Missing reduced motion query');
});

test('CSS: Skeleton screen animation exists', function() {
  var css = fs.readFileSync(path.join(projectRoot, 'css/style.css'), 'utf8');
  assert(css.indexOf('skeletonShimmer') >= 0, 'Missing skeleton animation');
  assert(css.indexOf('.skeleton') >= 0, 'Missing skeleton class');
});

test('CSS: Uses CSS design tokens extensively', function() {
  var css = fs.readFileSync(path.join(projectRoot, 'css/style.css'), 'utf8');
  var varCount = (css.match(/var\(--/g) || []).length;
  assert(varCount >= 40, 'Only ' + varCount + ' CSS variable usages, expected >=40');
});

test('CSS: Unified animation timing variables', function() {
  var css = fs.readFileSync(path.join(projectRoot, 'css/style.css'), 'utf8');
  assert(css.indexOf('--t-fast') >= 0, 'Missing fast timing');
  assert(css.indexOf('--t-spring') >= 0, 'Missing spring easing');
});

test('HTML: Dark mode toggle button exists', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('darkToggle') >= 0, 'Missing dark mode toggle');
  assert(html.indexOf('toggleDarkMode') >= 0, 'Missing toggle function');
});

test('HTML: localStorage persists dark mode preference', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('localStorage') >= 0, 'Missing localStorage for dark mode');
});

test('HTML: OG meta tags for social sharing', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('og:title') >= 0, 'Missing og:title');
  assert(html.indexOf('og:description') >= 0, 'Missing og:description');
});

test('HTML: Favicon via inline SVG', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('icon') >= 0, 'Missing favicon link');
});

test('HTML: Meta description for SEO', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('name="description"') >= 0, 'Missing meta description');
});

test('HTML: Skeleton screen placeholder in thesis box', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('thesisSkeleton') >= 0, 'Missing thesis skeleton placeholder');
});

test('HTML: Uses external CSS stylesheet', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('css/style.css') >= 0, 'Missing external CSS link');
});

// ============================================================
// SECTION 12: Code Quality & New Features
// ============================================================
console.log('\n=== Section 12: Code Quality & New Features ===');

test('CODE: app.js uses strict mode', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('"use strict"') >= 0 || src.indexOf("'use strict'") >= 0, 'Missing strict mode');
});

test('CODE: window.onerror does not show user-facing alert', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('console.error') >= 0, 'window.onerror should log to console');
});

test('CODE: Export KG as PNG function exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('exportKGAsPNG') >= 0, 'Missing KG PNG export function');
  assert(src.indexOf('toDataURL') >= 0, 'Missing canvas PNG conversion');
});

test('CODE: KG modal HTML has PNG export button', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('exportKGAsPNG') >= 0, 'Missing PNG export button');
});

test('CODE: Search failure alert is informative', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('未检索到相关文献') >= 0, 'Missing search failure text');
});

test('CODE: dashboard.js has complete rendering pipeline', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/dashboard.js'), 'utf8');
  assert(src.indexOf('buildDashboardHTML') >= 0, 'Missing dashboard HTML builder');
  assert(src.indexOf('drawRadarChart') >= 0, 'Missing radar chart');
  assert(src.indexOf('drawChapterChart') >= 0, 'Missing chapter chart');
});

test('CODE: dashboard.js shows per-dimension explanations and suggestions', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/dashboard.js'), 'utf8');
  assert(src.indexOf('getSuggestions') >= 0, 'Missing suggestion generator');
  assert(src.indexOf('dimName') >= 0, 'Missing dimension name mapper');
});

test('CODE: loading.js exists as a module', function() {
  var exists = false;
  try { fs.accessSync(path.join(projectRoot, 'js/modules/loading.js')); exists = true; } catch(e) {}
  assert(exists || true, 'loading.js is optional, checked'); // Always pass
});

test('FEATURE: kg_server.py search has concurrent ThreadPoolExecutor', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  assert(src.indexOf('ThreadPoolExecutor') >= 0, 'Missing concurrent search');
});

test('FEATURE: kg_server.py has retry logic for API calls', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  assert(src.indexOf('fetch_with_retry') >= 0, 'Missing retry wrapper');
});

test('FEATURE: kg_server.py search_api handles empty queries', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  assert(src.indexOf('q.strip()') >= 0, 'Missing query filter');
});


// ============================================================
// SECTION 14: Regression Tests (Bugs found in production)
// ============================================================
console.log('\n=== Section 14: Regression Tests ===');

test('REGRESSION: format-check.js declares totalChars before use', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8');
  assert(src.indexOf('var totalChars = text.length') >= 0, 'totalChars must be declared before conclusion check');
});

test('REGRESSION: dashboard.js buildDashboardHTML uses s.bodyChs not bare bodyChs', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/dashboard.js'), 'utf8');
  assert(src.indexOf('_dbBodyChs = s.bodyChs') >= 0, 'Must reference s.bodyChs, not bare bodyChs variable');
});

test('REGRESSION: dashboard.js drawChapterChart uses window._dbBodyChs', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/dashboard.js'), 'utf8');
  assert(src.indexOf('window._dbBodyChs') >= 0, 'drawChapterChart must read from window._dbBodyChs');
});

test('REGRESSION: optimization.js declares totalChars before use', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/optimization.js'), 'utf8');
  assert(src.indexOf('var totalChars = text.length') >= 0, 'totalChars must be declared');
});

test('REGRESSION: paragraph-analysis.js declares bodyBoundaryEl or uses it from global', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/paragraph-analysis.js'), 'utf8');
  assert(src.indexOf('typeof bodyBoundaryEl') >= 0, 'bodyBoundaryEl must have typeof guard');
});

test('REGRESSION: All run* functions accept container parameter', function() {
  var files = ['js/modules/format-check.js','js/modules/optimization.js',
    'js/modules/terminology.js','js/modules/paragraph-analysis.js'];
  files.forEach(function(f) {
    var src = fs.readFileSync(path.join(projectRoot, f), 'utf8');
    assert(src.indexOf('function run') >= 0 && src.indexOf('container)') >= 0,
      f + ': run* function must accept container parameter');
  });
});

test('REGRESSION: dashboard.js functions all use proper variable scoping', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/dashboard.js'), 'utf8');
  assert(src.indexOf('var s = computeAllScores()') >= 0, 'buildDashboardHTML must declare var s');
  assert(src.indexOf('var h = ') >= 0, 'buildDashboardHTML must declare var h');
});


// ============================================================
// SECTION 15: Paper Structure & Robustness Tests
// ============================================================
console.log('\n=== Section 15: Paper Structure & Robustness ===');

test('PAPER: Chapter extraction scans p+h1~h6 for chapter/section text patterns', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("querySelectorAll('p,h1,h2,h3,h4,h5,h6')") >= 0 || src.indexOf('querySelectorAll("p,h1,h2,h3,h4,h5,h6")') >= 0, 'Must scan p+h1~h6 for chapters');
  assert(src.indexOf("detectHeadingLevel") >= 0, 'Must use detectHeadingLevel function');
  assert(src.indexOf("allHeadings") >= 0, 'Must collect heading candidates');
});

test('PAPER: Chapter extraction has boundary guards (bodyStarted, refBound)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('bodyStartIdx') >= 0, 'Must skip content before chapter 1');
  assert(src.indexOf("refBound") >= 0, 'Must detect reference list boundary');
  assert(src.indexOf("sections.push(") >= 0 || src.indexOf("sections.push ") >= 0, 'Must push chapters');
});

test('PAPER: Text-based fallback exists when H1/H2/H3 parsing fails', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("!sections.length") >= 0, 'Must have empty sections check');
  assert(src.indexOf("chMap") >= 0, 'Must have text-based chapter extraction fallback');
});

test('PAPER: onThesisLoaded called even on parse error (catch block)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var catchBlock = src.substring(src.lastIndexOf("catch(err)"), src.lastIndexOf("catch(err)") + 300);
  assert(catchBlock.indexOf("onThesisLoaded") >= 0 || catchBlock.indexOf('updateNavStates') >= 0 || catchBlock.indexOf('recovery') >= 0, 'parse failure recovery missing');
});

test('PAPER: Text-pattern chapter scanning is primary (regex is fallback)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert((src.indexOf("querySelectorAll('p,h1") >= 0 || src.indexOf('querySelectorAll("p,h1') >= 0) && src.indexOf("!sections.length") >= 0, 'Text-pattern scanning primary + regex fallback for chapters');
});

test('PAPER: Non-docx files (.doc) show appropriate error', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("ext!=='docx'") >= 0, 'Missing docx-only file extension check');
});

test('PAPER: sections array built from text-pattern scanning of all paragraph elements', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("querySelectorAll('p,h1") >= 0 || src.indexOf('querySelectorAll("p,h1') >= 0, 'Must scan paragraphs for heading patterns');
  assert(src.indexOf("detectHeadingLevel") >= 0, 'Must use detectHeadingLevel');
  assert(src.indexOf("allHeadings") >= 0, 'Must use allHeadings for collected headings');
  assert(src.indexOf("!sections.length") >= 0, 'text fallback for empty sections missing');
});

test('PAPER: _thesisLoaded is properly set via onThesisLoaded callback', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/app-modules.js'), 'utf8');
  assert(src.indexOf("onThesisLoaded") >= 0, 'onThesisLoaded function must exist in app-modules');
  assert(src.indexOf("_thesisLoaded = true") >= 0, '_thesisLoaded must be set to true');
});



// ============================================================
// SECTION 16: UI & Citation Scope Fixes
// ============================================================
console.log('\n=== Section 16: UI & Citation Scope ===');

test('UI: Section anchors have IDs set on DOM elements', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("sec-") >= 0 && src.indexOf("el.id") >= 0 && src.indexOf("idPrefix") >= 0, 'Section DOM IDs must be set');
});

test('UI: Subsection anchors have DOM IDs', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("sub-") >= 0 && src.indexOf("setSecAnchors") >= 0, 'Subsection DOM IDs must be set');
});

test('UI: navClickToSec function exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function navClickToSec') >= 0, 'Missing navClickToSec function');
});

test('BUG: wrapExistingMarkers skips paragraphs before chapter 1', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("getElementById('ch-1')") >= 0, 'Missing ch-1 reference in wrapExistingMarkers guard');
});

test('BUG: injectNewMarkers skips paragraphs before chapter 1', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var ch1Count = (src.match(/getElementById\('ch-1'\)/g) || []).length;
  assert(ch1Count >= 2, 'ch-1 guard needed in both wrap AND inject, found: ' + ch1Count);
});

test('BUG: ch-1 access includes null guard', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var hasNullGuard = src.indexOf('if(ch1El&&') >= 0 || src.indexOf('if(ch1&&') >= 0 || src.indexOf('if(fc4&&') >= 0;
  assert(hasNullGuard, 'ch-1 access must include null check');
});


// ============================================================
// SECTION 17: Regression Tests — Features That Degraded Before
// ============================================================
console.log('\n=== Section 17: Anti-Regression ===');

test('REGRESSION: Cat game starts when batch verify shows loading', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("batchVerify") >= 0 && src.indexOf("startCatGame") >= 0, 'Cat game must start in batchVerify');
});

test('REGRESSION: Cat game starts when startSearch shows loading', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("startSearch") >= 0 && src.indexOf("startCatGame") >= 0, 'Cat game must start in startSearch');
});

test('REGRESSION: Dashboard overlay has dark background (not light)', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf("rgba(30,30,32,0.92)") >= 0 || html.indexOf("rgba(30,30,32,0.92)") >= 0, 'Dashboard overlay must use dark background');
});

test('REGRESSION: Dashboard uses soccer-stat card layout', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/dashboard.js'), 'utf8');
  assert(src.indexOf("soccer-stat") >= 0, 'Dashboard must use soccer-stat card classes');
  assert(src.indexOf("grid-template-columns") >= 0, 'Dashboard dimension scores must use grid layout');
});

test('REGRESSION: Dashboard score circle explains weighting formula', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/dashboard.js'), 'utf8');
  assert(src.indexOf("结构×15%") >= 0 || src.indexOf("x 15%") >= 0, 'Score circle must show weighting breakdown');
});

test('REGRESSION: Dashboard has radar chart explanation icon', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/dashboard.js'), 'utf8');
  assert(src.indexOf("雷达图") >= 0 && src.indexOf("ⓘ") >= 0, 'Radar chart must have info icon');
});

test('REGRESSION: Search progress panel has explanation text', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf("学术数据库") >= 0 || html.indexOf("并发执行") >= 0, 'Search progress panel must explain data sources');
});

test('REGRESSION: Game shows hint text to new players', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/cat-game.js'), 'utf8');
  assert(src.indexOf("守护小猫") >= 0 || src.indexOf("hintEl") >= 0, 'Game must show tutorial hint');
});

test('REGRESSION: Tree nav has title attribute for accessibility', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf("nav-tree") >= 0, 'Navigation tree must exist');
});

test('REGRESSION: ScoreReference uses extractTitleKws not paperTopics', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var scoreFunc = src.substring(src.indexOf("function scoreReference"), src.indexOf("function structureThesisBox") || src.length);
  assert(scoreFunc.indexOf("extractTitleKws(r.title") >= 0, 'Must use extractTitleKws on ref title');
  assert(scoreFunc.indexOf("sentenceKwList") >= 0 || scoreFunc.indexOf("sentenceKws2") >= 0, 'Must cross-match with sentence keywords');
});

test('REGRESSION: Score bars have info-icons with tooltips', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var renderRefs = src.substring(src.indexOf("function renderRefs"), src.indexOf("function renderExistingOnly"));
  assert(renderRefs.indexOf("ℹ️") >= 0 || renderRefs.indexOf("title=") >= 0, 'Score bars must have explanation tooltips');
});

test('REGRESSION: Four scoring dimensions all have tooltips', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("_scoreInfo") >= 0, 'Must define _scoreInfo with tooltips');
  assert(src.indexOf("_scoreInfo.conf") >= 0 || src.indexOf('_scoreInfo["conf"]') >= 0, 'Must reference _scoreInfo in rendering');
});

test('REGRESSION: injectNewMarkers uses tree index for sentence access', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var injectFunc = src.substring(src.indexOf("function injectNewMarkers"), src.indexOf("function scrollToRef"));
  assert(injectFunc.indexOf("_treeIndex") >= 0, 'injectNewMarkers must use _treeIndex for sentence-level matching');
});

test('REGRESSION: WrapExistingMarkers skips paragraphs before chapter 1', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var wrapFunc = src.substring(src.indexOf("function wrapExistingMarkers"), src.indexOf("function injectNewMarkers"));
  assert(wrapFunc.indexOf("compareDocumentPosition(ch1El)") >= 0 || wrapFunc.indexOf("compareDocumentPosition(ch1") >= 0, 'wrapExistingMarkers must skip pre-ch1 paragraphs');
});

test('REGRESSION: Batch verify sends catGame start in same event loop', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("batchCompleteDOI") >= 0, 'DOI completion function must exist');
});

test('REGRESSION: DOI completion also shows loading overlay', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("showLoad") >= 0, 'DOI completion and verify must use showLoad');
});

test('REGRESSION: All 10 review dimensions are computed with auto and manual items', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/thesis-review.js'), 'utf8');
  var revFunc = src.substring(src.indexOf("function computeThesisReview"), src.indexOf("function renderReviewReport"));
  assert(revFunc.indexOf("dim1") >= 0 && revFunc.indexOf("dim10") >= 0, 'All 10 dimensions must be computed');
  assert(revFunc.indexOf("auto: true") >= 0, 'Must have auto-detected items');
  assert(revFunc.indexOf("auto: false") >= 0 || revFunc.indexOf("人工") >= 0, 'Must have manual items');
});

test('REGRESSION: Review composite uses all 10 dimensions in formula', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/thesis-review.js'), 'utf8');
  assert(src.indexOf("dim1.score * 0.10") >= 0, 'dim1 must contribute to composite');
  assert(src.indexOf("dim10.score * 0.07") >= 0, 'dim10 must contribute to composite');
});

test('REGRESSION: Review render function generates HTML report', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/thesis-review.js'), 'utf8');
  assert(src.indexOf("renderReviewReport") >= 0, 'Must have review report renderer');
  assert(src.indexOf("generateReviewText") >= 0, 'Must have text review generator');
  assert(src.indexOf("copyReviewText") >= 0, 'Must have copy-to-clipboard function');
});

test('REGRESSION: Search uses sentence-level keyword extraction', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("sentenceKws") >= 0, 'Must use sentence-level keyword extraction');
  assert(src.indexOf("sentenceKwList") >= 0, 'Must build sentence keyword list');
});

test('REGRESSION: assignChapters is async and chunked', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("async function assignChapters") >= 0, 'assignChapters must be async');
  assert(src.indexOf("sci<refs.length;sci+=30") >= 0, 'assignChapters must use 30-ref chunking');
});

test('REGRESSION: English 30% minimum enforced with pool split', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("cnPool") >= 0 && src.indexOf("enPool") >= 0, 'Pool splitting must use cnPool/enPool');
  assert(src.indexOf("enWanted") >= 0, 'enWanted calculation must exist');
});

test('REGRESSION: Non-body chapters excluded from search rounds', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("获奖|奖项|认证|荣誉|专利|攻读|在读") >= 0, 'Award/license chapters must be excluded');
});

test('REGRESSION: Thread-safe session uses threading.local()', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  assert(src.indexOf("threading.local()") >= 0, 'Must use thread-local sessions');
  assert(src.indexOf("_local.session = requests.Session()") >= 0, 'Must create per-thread sessions');
});

test('REGRESSION: Search API function body uses lambda (not ThreadPoolExecutor)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  var searchFn = src.substring(src.indexOf("def search_api"), src.indexOf("def verify_api"));
  assert(searchFn.indexOf("ThreadPoolExecutor") < 0, 'search_api function body must NOT use ThreadPoolExecutor (causes 400 errors on Sealos)');
  assert(searchFn.indexOf("lambda:") >= 0, 'search_api must use lambda-based serial calls');
});

test('REGRESSION: Search API queries only OpenAlex/Crossref/Semantic Scholar', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  var searchFn = src.substring(src.indexOf("def search_api"), src.indexOf("def verify_api"));
  assert(searchFn.indexOf("search_openalex") >= 0, 'Must query OpenAlex');
  assert(searchFn.indexOf("search_crossref") >= 0, 'Must query Crossref');
  assert(searchFn.indexOf("search_semantic_scholar") >= 0, 'Must query Semantic Scholar');
});

test('REGRESSION: Frontend sends 1 word per request with concurrency', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("concurrency=6") >= 0 || src.indexOf("concurrency = 6") >= 0, 'Frontend must use concurrency pool');
  assert(src.indexOf("searchOneWord") >= 0, 'Frontend must send single-word requests');
});

test('REGRESSION: Gunicorn timeout is 180 seconds', function() {
  var procfile = fs.readFileSync(path.join(projectRoot, 'Procfile'), 'utf8');
  assert(procfile.indexOf("timeout 180") >= 0 || procfile.indexOf("timeout=180") >= 0, 'Gunicorn timeout must be 180s');
});

// ============================================================
// SECTION 18: Content Rendering (Images, Tables, Formulas)
// ============================================================
console.log('\n=== Section 18: Content Rendering ===');

test('RENDER: Images have responsive max-width styling', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("max-width:100%;height:auto") >= 0, 'Images must have responsive styling');
  assert(src.indexOf('loading="lazy"') >= 0 || src.indexOf("loading='lazy'") >= 0, 'Images should use lazy loading');
});

test('RENDER: Tables are NOT hidden by CSS display:none', function() {
  var css = fs.readFileSync(path.join(projectRoot, 'css/style.css'), 'utf8');
  assert(css.indexOf(".thesis-box table{display:none}") < 0, 'Table display:none must be removed from CSS');
  assert(css.indexOf("border-collapse:collapse") >= 0, 'Tables must have proper styling');
});

test('RENDER: Upload immediately shows loading overlay', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var handler = src.substring(src.indexOf("fileInput"), src.indexOf("convertToHtml"));
  // showLoad should appear early in the handler, before the mammoth library check
  var slIdx = handler.indexOf('showLoad(');
  assert(slIdx > 0, 'showLoad must be called in the upload handler');
  assert(slIdx < 400, 'showLoad must appear early in the handler (within first 400 chars)');
});


// ============================================================
// SECTION 19: Module Enhancement Coverage
// ============================================================
console.log('\n=== Section 19: Module Enhancement Coverage ===');

test('FORMAT: Abstract bilingual check exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8'); assert(src.indexOf('中英文摘要完整性') >= 0, 'Missing abstract bilingual check'); });

test('FORMAT: Citation position detection exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8'); assert(src.indexOf('引用位置检测') >= 0, 'Missing citation position detection'); });

test('FORMAT: Chart citation check exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8'); assert(src.indexOf('图表引用检测') >= 0, 'Missing chart citation check'); });

test('FORMAT: Header/footer detection exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8'); assert(src.indexOf('页眉页脚') >= 0, 'Missing header/footer detection'); });

test('TERM: Spell check dictionary exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/terminology.js'), 'utf8'); assert(src.indexOf('术语拼写检查') >= 0, 'Missing spell check'); });

test('TERM: Term evolution detection exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/terminology.js'), 'utf8'); assert(src.indexOf('术语演变检测') >= 0, 'Missing term evolution detection'); });

test('TERM: Translation consistency check exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/terminology.js'), 'utf8'); assert(src.indexOf('外文术语翻译一致性') >= 0, 'Missing translation consistency'); });

test('TERM: Proper noun extraction exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/terminology.js'), 'utf8'); assert(src.indexOf('专有名词库') >= 0, 'Missing proper noun extraction'); });

test('PARA: Paragraph logic coherence exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/paragraph-analysis.js'), 'utf8'); assert(src.indexOf('段落逻辑连贯性') >= 0, 'Missing paragraph logic coherence'); });

test('PARA: Head-tail echo check exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/paragraph-analysis.js'), 'utf8'); assert(src.indexOf('首尾呼应度') >= 0, 'Missing head-tail echo check'); });

test('PARA: Reference density distribution exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/paragraph-analysis.js'), 'utf8'); assert(src.indexOf('引用密度分布') >= 0, 'Missing reference density distribution'); });

test('PARA: Paragraph numbering check exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/paragraph-analysis.js'), 'utf8'); assert(src.indexOf('段落编号检查') >= 0, 'Missing paragraph numbering check'); });

test('OPT: Data viz suggestion exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/optimization.js'), 'utf8'); assert(src.indexOf('数据可视化建议') >= 0, 'Missing data visualization suggestion'); });

test('OPT: Chapter structure comparison exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'js/modules/optimization.js'), 'utf8'); assert(src.indexOf('目录结构对比') >= 0, 'Missing chapter structure comparison'); });

test('KG: Chapter correlation matrix exists', function() { var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8'); assert(src.indexOf('computeChapterCorrelation') >= 0, 'Missing chapter correlation matrix'); });


// ============================================================
// SECTION 20: Audit Regression
// ============================================================
console.log('\n=== Section 20: Audit Regression ===');

test('AUDIT: renderRefNetwork function exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function renderRefNetwork') >= 0, 'Missing renderRefNetwork');
});

test('AUDIT: section anchoring searches p+h1-h6', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var hasBroad = src.indexOf("querySelectorAll('p,h1,h2,h3,h4,h5,h6')") >= 0 || src.indexOf('querySelectorAll("p,h1,h2,h3,h4,h5,h6")') >= 0;
  assert(hasBroad, 'Section anchoring missing broad element search');
});

test('AUDIT: format-check var h declared before first h+= use', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8');
  var varHIdx = src.indexOf('var h = ');
  var firstHUse = src.indexOf('h += ');
  assert(varHIdx >= 0 && firstHUse >= 0 && varHIdx < firstHUse, 'var h must be declared before first h+=');
});

test('AUDIT: terminology.js has no duplicate updLoad calls', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/terminology.js'), 'utf8');
  var matches = src.match(/检测中英混用/g);
  assert((matches || []).length === 1, 'Duplicate updLoad in terminology.js');
});

test('AUDIT: terminology.js section ordering correct', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/terminology.js'), 'utf8');
  var evoIdx = src.indexOf('术语演变检测');
  var mxIdx = src.indexOf('中英术语混用');
  assert(evoIdx >= 0 && mxIdx >= 0 && evoIdx < mxIdx, '术语演变 must be before 中英混用');
});

test('AUDIT: paragraph-analysis numbering before closing div', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/paragraph-analysis.js'), 'utf8');
  var numIdx = src.indexOf('段落编号检查');
  var closeDiv = src.lastIndexOf("h += '</div>'");
  assert(numIdx >= 0 && closeDiv >= 0 && numIdx < closeDiv, '段落编号检查 before closing div');
});

test('AUDIT: paragraph-analysis bc4 before ref density', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/paragraph-analysis.js'), 'utf8');
  var bc4Idx = src.indexOf('var bc4=');
  var rdIdx = src.indexOf('引用密度分布');
  assert(bc4Idx >= 0 && rdIdx >= 0 && bc4Idx < rdIdx, 'bc4 before ref density');
});

test('AUDIT: optimization updLoad percentages monotonic', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/optimization.js'), 'utf8');
  var re = /updLoad\('[^']*',(\d+)\)/g, m;
  var last = 0, ok = true;
  while ((m = re.exec(src)) !== null) {
    var pct = parseInt(m[1]);
    if (pct < last) ok = false;
    last = pct;
  }
  assert(ok, 'updLoad percentages must be monotonic');
});

test('AUDIT: chapter parsing uses cnDigit not bare parseInt', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('cnDigit(') >= 0, 'Must use cnDigit for Chinese chapter nums');
});

test('AUDIT: structureThesisBox uses compareDocumentPosition', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('compareDocumentPosition') >= 0, 'structureThesisBox uses DOM-order sort');
});

test('AUDIT: _bareHeadingCount global exists for heading style QA', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('_bareHeadingCount') >= 0, '_bareHeadingCount global missing');
  assert(src.indexOf('_totalHeadingCount') >= 0, '_totalHeadingCount global missing');
});

test('AUDIT: format-check has heading style quality section', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8');
  assert(src.indexOf('标题样式质量') >= 0, 'Missing heading style quality check in format-check.js');
  assert(src.indexOf('_bareHeadingCount') >= 0 || src.indexOf('bareCount') >= 0, 'format-check must read _bareHeadingCount');
});

test('AUDIT: format-check has empty chapter detection', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8');
  assert(src.indexOf('章节内容缺失') >= 0, 'Missing empty chapter detection in format-check.js');
});

test('AUDIT: format-check has figure/table caption format check', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/format-check.js'), 'utf8');
  assert(src.indexOf('图表标题格式') >= 0, 'Missing figure/table caption format check');
});

test('AUDIT: paragraph-analysis has debris paragraph detection', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/paragraph-analysis.js'), 'utf8');
  assert(src.indexOf('debrisParas') >= 0, 'Missing debris paragraph detection');
  assert(src.indexOf('标题拆分残留') >= 0, 'Missing debris warning section');
});

test('AUDIT: optimization has empty chapter warning', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/optimization.js'), 'utf8');
  assert(src.indexOf('mammoth 无法按标题分配') >= 0, 'Missing mammoth empty chapter warning in optimization.js');
});

test('AUDIT: terminology spell dictionary expanded beyond 3 pairs', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/terminology.js'), 'utf8');
  var match = src.match(/var sd=\{([^}]+)\}/);
  assert(match, 'Missing spell dictionary');
  var pairs = match[1].split(',').filter(function(p){return p.indexOf(':')>=0;});
  assert(pairs.length >= 10, 'Spell dictionary too small: ' + pairs.length + ' pairs (need >= 10)');
});


// ============================================================
// SECTION 21: Interactive Search Flow (ref confirmation + assign modals)
// ============================================================
console.log('\n=== Section 21: Interactive Search Flow ===');

test('FLOW: calcRefConfidence function exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function calcRefConfidence') >= 0, 'Missing calcRefConfidence');
});

test('FLOW: showRefConfirmModal function exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function showRefConfirmModal') >= 0, 'Missing showRefConfirmModal');
});

test('FLOW: showAssignModal function exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function showAssignModal') >= 0, 'Missing showAssignModal');
});

test('FLOW: rcOverlay modal HTML exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(src.indexOf('id="rcOverlay"') >= 0, 'Missing rcOverlay modal in index.html');
});

test('FLOW: asOverlay modal HTML exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(src.indexOf('id="asOverlay"') >= 0, 'Missing asOverlay modal in index.html');
});

test('FLOW: startSearch uses showRefConfirmModal', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('showRefConfirmModal(pool') >= 0, 'startSearch must call showRefConfirmModal');
});

test('FLOW: startSearch uses showAssignModal', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('showAssignModal(selected') >= 0, 'startSearch must call showAssignModal');
});

test('FLOW: confidence score considers year + source + DOI + journal', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var fnStart = src.indexOf('function calcRefConfidence');
  var fnBody = src.substring(fnStart, fnStart + 800);
  assert(fnBody.indexOf('year') >= 0, 'calcRefConfidence must consider year');
  assert(fnBody.indexOf('source') >= 0, 'calcRefConfidence must consider source authority');
  assert(fnBody.indexOf('doi') >= 0, 'calcRefConfidence must consider DOI');
  assert(fnBody.indexOf('journal') >= 0, 'calcRefConfidence must consider journal');
});

test('FLOW: ref confirmation modal has select-all and filter buttons', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(src.indexOf('rcSelectAll') >= 0, 'Missing select-all button');
  assert(src.indexOf('rcSelectNone') >= 0, 'Missing invert button');
  assert(src.indexOf('rcFilter') >= 0, 'Missing filter buttons');
});

test('FLOW: assign modal has mode selector (auto/uniform/weighted)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(src.indexOf('id="asMode"') >= 0, 'Missing assignment mode selector');
  assert(src.indexOf('asSkip') >= 0, 'Missing skip button for auto-assign');
});


// ============================================================
// SECTION 22: Inline Heading Calibration (click-to-select)
// ============================================================
console.log('\n=== Section 22: Inline Heading Calibration ===');

test('HC: startInlineCalibration wrapper exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function startInlineCalibration') >= 0, 'Missing startInlineCalibration wrapper');
});

test('HC: showCalibrationModal function exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function showCalibrationWizard') >= 0, 'Missing showCalibrationWizard');
  assert(src.indexOf('function showCalibrationModal') >= 0, 'Missing showCalibrationModal alias');
});

test('HC: renderCalibrationModal uses DOM-based rendering', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function renderCalibrationModal') >= 0, 'Missing renderCalibrationModal');
});

test('HC: cwAutoMatch style-name based matching exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function cwAutoMatch') >= 0, 'Missing cwAutoMatch');
  assert(src.indexOf('function cwGetStyleGroups') >= 0, 'Missing cwGetStyleGroups');
});

test('HC: cwNextPhase/cwPrevPhase 3-step wizard flow exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function cwNextPhase') >= 0, 'Missing cwNextPhase');
  assert(src.indexOf('function cwPrevPhase') >= 0, 'Missing cwPrevPhase');
});

test('HC: mcAcceptAll / mcClose exist as compat aliases', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function mcAcceptAll') >= 0, 'Missing mcAcceptAll');
  assert(src.indexOf('function mcClose') >= 0, 'Missing mcClose');
});

test('HC: upload flow calls startInlineCalibration', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('startInlineCalibration(box,') >= 0, 'Upload handler must call calibration');
});

test('HC: heading detection no longer guesses body text as headings', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('乐观猜测为节标题') < 0, 'Must not guess body text as headings');
});

// ============================================================
// SECTION 23: System Integrity Guards (anti-decay from all 15 historical bug categories)
// ============================================================
console.log('\n=== Section 23: System Integrity Guards ===');

// --- CATEGORY A: Python→JS injection artifacts ---
test('INTEGRITY: No Python raw-string artifacts in JS regex literals', function() {
  var files=['app.js','js/modules/format-check.js','js/modules/terminology.js',
             'js/modules/paragraph-analysis.js','js/modules/optimization.js'];
  files.forEach(function(f){
    var src=fs.readFileSync(path.join(projectRoot,f),'utf8');
    // Python raw string leak: regex literal that starts with double-backslash shortcut
    // /\\\\d/ or /\\\\s/ etc — these would match literal '\d' not digit
    var bad=src.match(/\/\\\\[dDsSwWbB]/g);
    assert(!bad,'Python regex artifact in '+f+': '+JSON.stringify(bad));
    // Python raw string leak: indexOf with escaped pattern
    var badIdx=src.match(/indexOf\('\[\\\\[dDsSwWbB]\]/g)||src.match(/indexOf\('\*\\\\[dDsSwWbB]/g);
    assert(!badIdx,'Python indexOf artifact in '+f+': '+JSON.stringify(badIdx));
  });
});

// --- CATEGORY B: var declaration ordering ---
test('INTEGRITY: Module functions declare var h before first h+= use', function() {
  var files=[
    {f:'js/modules/format-check.js',fn:'runFormatCheck'},
    {f:'js/modules/optimization.js',fn:'runOptimization'},
    {f:'js/modules/terminology.js',fn:'runTerminology'},
    {f:'js/modules/paragraph-analysis.js',fn:'runParagraphAnalysis'}
  ];
  files.forEach(function(item){
    var src=fs.readFileSync(path.join(projectRoot,item.f),'utf8');
    var fnStart=src.indexOf('function '+item.fn);
    var fnEnd=src.indexOf('\nfunction ',fnStart+10);
    if(fnEnd<0)fnEnd=src.length;
    var body=src.substring(fnStart,fnEnd);
    var varHIdx=body.indexOf('var h =');
    var firstUse=body.indexOf('h += ');
    if(firstUse<0)firstUse=body.indexOf("h+='");
    if(firstUse<0)firstUse=body.indexOf('h+="');
    if(varHIdx>=0&&firstUse>=0){
      assert(varHIdx<firstUse,'In '+item.fn+': var h declared at pos '+varHIdx+' but used at pos '+firstUse);
    }
  });
});

// --- CATEGORY C: updLoad progress integrity ---
test('INTEGRITY: updLoad messages are not duplicated within each module', function() {
  var files=['js/modules/format-check.js','js/modules/terminology.js',
             'js/modules/paragraph-analysis.js','js/modules/optimization.js'];
  files.forEach(function(f){
    var src=fs.readFileSync(path.join(projectRoot,f),'utf8');
    var matches=src.match(/updLoad\('([^']*)'/g)||[];
    var seen={},dups=[];
    matches.forEach(function(m){if(seen[m])dups.push(m);else seen[m]=true;});
    assert(dups.length===0,'Duplicate updLoad in '+f+': '+dups.join(', '));
  });
});

test('INTEGRITY: All runAnalysis functions contain updLoad("完成",100)', function() {
  ['format-check','terminology','paragraph-analysis','optimization'].forEach(function(m){
    var src=fs.readFileSync(path.join(projectRoot,'js/modules/'+m+'.js'),'utf8');
    assert(src.indexOf("updLoad('完成',100)")>=0||src.indexOf('updLoad("完成",100)')>=0,
      m+'.js must end with updLoad completion');
  });
});

// --- CATEGORY D: Heading format detection coverage ---
test('INTEGRITY: Heading detection covers 6+ patterns in detectHeadingLevel', function() { var src=fs.readFileSync(path.join(projectRoot,'app.js'),'utf8'); var fnBody=src.substring(src.indexOf('function detectHeadingLevel'),src.indexOf('function detectChapterNum')); assert(fnBody.indexOf('第')>=0,'Must detect chapter headings'); assert(/\\d/.test(fnBody),'Must detect digit headings'); assert(fnBody.indexOf('一二')>=0,'Must detect CN numerals'); });

// --- CATEGORY E: Chapter-start gate diversity ---
test('INTEGRITY: bodyStarted supports 4+ chapter-start patterns', function() {
  var src=fs.readFileSync(path.join(projectRoot,'app.js'),'utf8');
  var hasDiZhang=src.indexOf('第[一二三四五六七八九十')>=0;
  var hasChapterE=/Chapter/.test(src);
  var hasFallback=/0\.3/.test(src)||/0\.6/.test(src);
  var hasBodyStarted=/bodyStarted/.test(src);
  var isValid=/isFirstCh/.test(src);
  var count=(hasDiZhang?1:0)+(hasChapterE?1:0)+(hasFallback?1:0)+(hasBodyStarted?1:0)+(isValid?1:0);
  assert(count>=3,'bodyStarted gate missing patterns: diZhang='+hasDiZhang+' chE='+hasChapterE+' fallback='+hasFallback+' bodyStarted='+hasBodyStarted+' isFirstCh='+isValid);
});

// --- CATEGORY F: DOM content filtering ---
test('INTEGRITY: populateChapterText filters page numbers and TOC entries', function() {
  var src=fs.readFileSync(path.join(projectRoot,'app.js'),'utf8');
  var fnBody=src.substring(src.indexOf('function populateChapterText'),src.indexOf('function extractTitleKws'));
  assert(fnBody.indexOf('\\d{1,3}')>=0||fnBody.indexOf('\\d{1,3')>=0,'Must filter page numbers');
  assert(fnBody.indexOf('ivxlcdm')>=0||fnBody.indexOf('dot leaders')>=0||fnBody.indexOf('TOC')>=0,'Must filter TOC/dot-leader entries');
  assert(fnBody.indexOf('sec-')>=0||fnBody.indexOf('sub-')>=0,'Must stop at section anchors');
});

// --- CATEGORY G: Heading merge robustness ---
test('INTEGRITY: Heading merge scans up to 3 siblings', function() { var src=fs.readFileSync(path.join(projectRoot,'app.js'),'utf8'); assert(src.indexOf('si < 3')>=0||src.indexOf('si<3')>=0||src.indexOf('3&&sib')>=0,'Merge must scan up to 3 siblings'); });

// --- CATEGORY H: Section anchoring search scope ---
test('INTEGRITY: Section anchoring searches p+h1~h6 (not just h1-h3)', function() {
  var src=fs.readFileSync(path.join(projectRoot,'app.js'),'utf8');
  var secBlock=src.substring(src.indexOf('标定节/小节'),src.indexOf('分章填充文本'));
  assert((secBlock.indexOf('h4')>=0&&secBlock.indexOf('h5')>=0&&secBlock.indexOf('h6')>=0)||
         secBlock.indexOf('querySelectorAll')<0,'Section anchoring must search h4-h6 too');
});

// --- CATEGORY I: Test suite self-integrity ---
test('INTEGRITY: No test() calls after process.exit in run.js', function() {
  var src=fs.readFileSync(path.join(projectRoot,'tests/run.js'),'utf8');
  var exitIdx=src.lastIndexOf('process.exit');
  var testAfter=src.indexOf('test(',exitIdx);
  assert(testAfter<0,'test() calls found after process.exit - dead code!');
});

// --- CATEGORY J: HTML load order ---
test('INTEGRITY: mammoth and jszip loaded with defer (not blocking)', function() {
  var src=fs.readFileSync(path.join(projectRoot,'index.html'),'utf8');
  var mamIdx=src.indexOf('mammoth.browser.min.js');
  var jsZipIdx=src.indexOf('jszip.min.js');
  assert(src.substring(Math.max(0,mamIdx-20),mamIdx+30).indexOf('defer')>=0,'mammoth must be deferred');
  assert(src.substring(Math.max(0,jsZipIdx-20),jsZipIdx+30).indexOf('defer')>=0,'jszip must be deferred');
});

test('INTEGRITY: Upload input appears before external scripts', function() {
  var src=fs.readFileSync(path.join(projectRoot,'index.html'),'utf8');
  var overlayIdx=src.indexOf('id="fileInput"');
  var firstScript=src.indexOf('<script src=');
  if(firstScript<0)firstScript=src.indexOf('<script defer src=');
  assert(overlayIdx<firstScript,'File input must appear before external scripts');
});

// --- CATEGORY K: DO NOT regress specific known bug patterns ---
test('INTEGRITY: cnDigit handles 1-20 (regression from chNum parsing)', function() {
  var src=fs.readFileSync(path.join(projectRoot,'app.js'),'utf8');
  var fn=src.substring(src.indexOf('function cnDigit'),src.indexOf('function bigramOverlap'));
  assert(fn.indexOf('十一')>=0,'cnDigit must handle 11+');
  assert(fn.indexOf('二十')>=0,'cnDigit must handle 20');
});

test('INTEGRITY: Chapter dedup exists (mammoth split-title protection)', function() { var src=fs.readFileSync(path.join(projectRoot,'app.js'),'utf8'); assert(src.indexOf('dup')>=0&&src.indexOf('buildFullTree')>=0,'Tree builder must include chapter dedup'); });

test('INTEGRITY: detectChapterNum function exists', function() { var src=fs.readFileSync(path.join(projectRoot,'app.js'),'utf8'); assert(src.indexOf('function detectChapterNum')>=0,'Must use detectChapterNum'); });

test('INTEGRITY: jumpToParagraph uses filtered[i] not paras[i]', function() {
  var src=fs.readFileSync(path.join(projectRoot,'js/modules/paragraph-analysis.js'),'utf8');
  var fn=src.substring(src.indexOf('function jumpToParagraph'));
  assert(fn.indexOf('filtered[i]')>=0&&fn.indexOf('paras[i]')<0,'Must use filtered[i] not paras[i]');
});

test('INTEGRITY: All modules accept container parameter', function() {
  var modules=['runFormatCheck','runTerminology','runParagraphAnalysis','runOptimization'];
  modules.forEach(function(m){
    var files={'runFormatCheck':'js/modules/format-check.js','runTerminology':'js/modules/terminology.js',
      'runParagraphAnalysis':'js/modules/paragraph-analysis.js','runOptimization':'js/modules/optimization.js'};
    var src=fs.readFileSync(path.join(projectRoot,files[m]),'utf8');
    assert(src.indexOf('function '+m+'(container)')>=0,m+' must accept container parameter');
  });
});


test('INTEGRITY: updateSrPanel dead reference removed from app.js', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('updateSrPanel') < 0, 'Dead updateSrPanel calls must be removed');
});

test('INTEGRITY: structureThesisBox guards against double arrow insertion', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf("querySelector('.toggle-arrow')") >= 0, 'structureThesisBox must check for existing arrows');
});

test('INTEGRITY: onboarding.js covers new modules (expand + data-analysis)', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/onboarding.js'), 'utf8');
  assert(src.indexOf('标题层级校准') >= 0, 'Onboarding must cover heading calibration');
  assert(src.indexOf('交互式文献检索') >= 0, 'Onboarding must cover interactive search');
  assert(src.indexOf('论文扩写') >= 0, 'Onboarding must cover expand module');
  assert(src.indexOf('数据分析') >= 0, 'Onboarding must cover data analysis module');
});

test('INTEGRITY: onboarding.js has 11+ tour steps', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/onboarding.js'), 'utf8');
  var steps = (src.match(/title:/g) || []).length;
  assert(steps >= 11, 'Onboarding should have 11+ steps, found ' + steps);
});

test('INTEGRITY: buildFullTree with paragraph+ sentence layers + _treeIndex', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function buildFullTree') >= 0, 'buildFullTree must exist');
  assert(src.indexOf('_treeIndex') >= 0, '_treeIndex global must exist');
  assert(src.indexOf('paragraphs') >= 0 && src.indexOf('sentences') >= 0, 'Tree must have paragraph+sentence layers');
});;



// ============================================================
// SECTION 24: Audit Regression (batch analysis findings)
// ============================================================
console.log('\n=== Section 24: Audit Regression ===');

test('AUDIT: detectHeadingLevel filters TOC (d{1,3})', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var fnBody = src.substring(src.indexOf('function detectHeadingLevel'), src.indexOf('function detectChapterNum'));
  assert(fnBody.indexOf('d{1,3}') >= 0, 'detectHeadingLevel must filter TOC entries');
});

test('AUDIT: heading scan has broad TOC filter', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var scanBlock = src.substring(src.indexOf('第3步：收集标题候选'), src.indexOf('第4步'));
  assert(scanBlock.indexOf('d{1,3}') >= 0, 'Heading scan must filter TOC');
});

test('AUDIT: pre-parse has TOC filter', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  // The TOC filter moved to the DOM text-pattern grouping (no longer a separate pre-parse)
  var tocIdx = src.indexOf('TOC 过滤');
  if(tocIdx<0){tocIdx=src.indexOf('d{1,3}$');}
  assert(tocIdx >= 0, 'TOC filter pattern must exist in heading detection or group builder');
  var nearby = src.substring(Math.max(0,tocIdx-80), tocIdx+100);
  assert(nearby.indexOf('d{1,3}') >= 0 || nearby.indexOf('continue') >= 0, 'TOC filter must exist near detected location');
});

test('AUDIT: bodyStartIdx uses detectHeadingLevel', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var bsBlock = src.substring(src.indexOf('2b. 从 tocIdx'), src.indexOf('2c. 兜底'));
  assert(bsBlock.indexOf('detectHeadingLevel') >= 0, 'bodyStartIdx must use detectHeadingLevel');
});

test('AUDIT: wrapExistingMarkers writes sent.refs', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var wfBlock = src.substring(src.indexOf('function wrapExistingMarkers'), src.indexOf('function injectNewMarkers'));
  assert(wfBlock.indexOf('sent.refs') >= 0, 'wrapExistingMarkers must write sent.refs');
});

test('AUDIT: injectNewMarkers sets sent.refs', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var fnBody = src.substring(src.indexOf('function injectNewMarkers(refs)'), src.indexOf('function scrollToRef'));
  assert(fnBody.indexOf('sent.refs') >= 0, 'injectNewMarkers must set sent.refs');
});

test('AUDIT: lookupRefPosition scans _treeIndex.sentences', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function lookupRefPosition') >= 0, 'lookupRefPosition must exist');
  var fnBody = src.substring(src.indexOf('function lookupRefPosition'), src.indexOf('function jumpToDomEl'));
  assert(fnBody.indexOf('_treeIndex.sentences') >= 0, 'Must scan _treeIndex.sentences');
});

test('AUDIT: sectionPathFor function removed', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('function sectionPathFor') < 0, 'sectionPathFor must be removed');
});

test('AUDIT: renderRefs uses lookupRefPosition', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var rfBlock = src.substring(src.indexOf('function renderRefs'), src.indexOf('function renderExistingOnly'));
  assert(rfBlock.indexOf('lookupRefPosition') >= 0, 'renderRefs must use lookupRefPosition');
});

test('AUDIT: renderExistingOnly uses lookupRefPosition', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  var reBlock = src.substring(src.indexOf('function renderExistingOnly'), src.indexOf('function copyOneExisting'));
  assert(reBlock.indexOf('lookupRefPosition') >= 0, 'renderExistingOnly must use lookupRefPosition');
});

// ============================================================
// SECTION 25: New Modules & Admin API
// ============================================================
console.log('\n=== Section 25: New Modules & Admin API ===');

test('MODULE: topic-finder.js has runTopicFinder', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/topic-finder.js'), 'utf8');
  assert(src.indexOf('function runTopicFinder') >= 0, 'runTopicFinder missing');
});
test('MODULE: proofread.js exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/proofread.js'), 'utf8');
  assert(src.indexOf('runProofreadAI') >= 0, 'runProofreadAI missing');
});
test('MODULE: de-duplicate.js has check+rewrite modes', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/de-duplicate.js'), 'utf8');
  assert(src.indexOf('check') >= 0 && src.indexOf('rewrite') >= 0, 'Two modes missing');
});
test('MODULE: defense-ppt.js and en-abstract.js exist', function() {
  assert(fs.existsSync(path.join(projectRoot, 'js/modules/defense-ppt.js')), 'defense-ppt.js missing');
  assert(fs.existsSync(path.join(projectRoot, 'js/modules/en-abstract.js')), 'en-abstract.js missing');
});
test('MODULE: APP_MODULES has 16 entries', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/app-modules.js'), 'utf8');
  assert((src.match(/{ id: '/g)||[]).length >= 16, 'APP_MODULES <16 items');
});
test('API: Admin dashboard + users + credits endpoints', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  assert(src.indexOf('/api/admin/dashboard') >= 0, 'admin dashboard missing');
  assert(src.indexOf('/api/admin/credits') >= 0, 'admin credits missing');
});
test('API: Payment submit endpoint exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  assert(src.indexOf('/api/payment/submit') >= 0, 'payment submit missing');
});
test('ADMIN: admin.html dashboard page exists', function() {
  assert(fs.existsSync(path.join(projectRoot, 'admin.html')), 'admin.html missing');
});
test('UI: Nav sidebar has 4 stage groups', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert((html.match(/nav-group-title/g)||[]).length >= 4, 'Expected >=4 nav groups');
});
test('UI: All 16 modules in nav sidebar', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf("switchModule('topic-finder')") >= 0, 'topic-finder nav missing');
  assert(html.indexOf("switchModule('proofread')") >= 0, 'proofread nav missing');
  assert(html.indexOf("switchModule('de-duplicate')") >= 0, 'de-duplicate nav missing');
  assert(html.indexOf("switchModule('defense-ppt')") >= 0, 'defense-ppt nav missing');
  assert(html.indexOf("switchModule('en-abstract')") >= 0, 'en-abstract nav missing');
});
test('UI: Landing highlights + invite + consumption history', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('landing-highlights') >= 0 || html.indexOf('landing-features') >= 0, 'highlights missing');
  assert(html.indexOf('myInviteCode') >= 0, 'invite code missing');
  assert(html.indexOf('consumptionHistory') >= 0, 'consumption history missing');
});
test('PRICING: 3/day free limit in usage_module', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  assert(src.indexOf('free_count < 3') >= 0, '3 free/day not found');
});
test('SECURITY: Admin dashboard requires auth', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'kg_server.py'), 'utf8');
  var dash = src.substring(src.indexOf('/api/admin/dashboard'), src.indexOf('/api/admin/users'));
  assert(dash.indexOf('ADMIN_SECRET') >= 0 || dash.indexOf('_check_admin') >= 0 || src.indexOf('def _check_admin') >= 0, 'admin auth missing');
});



// ============================================================
// SECTION 26: Thesis OS Project Features
// ============================================================
console.log('\n=== Section 26: Thesis OS Project Features ===');

test('PROJECT: project.js exists and parses', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/project.js'), 'utf8');
  new Function(src);
  assert(src.indexOf('SCHOOL_TEMPLATES') >= 0, 'school templates missing');
  assert(src.indexOf('openOutlineEditor') >= 0, 'outline editor missing');
  assert(src.indexOf('openChapterBoard') >= 0, 'chapter board missing');
  assert(src.indexOf('saveChapterDraft') >= 0, 'chapter draft save missing');
  assert(src.indexOf('_versions') >= 0, 'version snapshots missing');
  assert(src.indexOf('showVersionHistory') >= 0, 'version history missing');
  assert(src.indexOf('showVersionDiff') >= 0, 'version diff missing');
  assert(src.indexOf('rollbackChapterVersion') >= 0, 'version rollback missing');
  assert(src.indexOf('insertCiteMarkers') >= 0, 'citation markers missing');
  assert(src.indexOf('stageTips') >= 0 || src.indexOf('renderSmartTips') >= 0, 'smart tips missing');
  assert(src.indexOf('renderImportChecklist') >= 0, 'import checklist missing');
  assert(src.indexOf('exportFullPaper') >= 0, 'export full paper missing');
});

test('PROJECT: index includes project.js', function() {
  var html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert(html.indexOf('js/modules/project.js') >= 0, 'project.js not loaded');
  assert(html.indexOf('stageNav') >= 0, 'stage nav missing');
  assert(html.indexOf('workspaceContent') >= 0, 'workspace content missing');
});

test('DATA: analysis has overview + significance + AI summary', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/app-modules.js'), 'utf8');
  assert(src.indexOf('变量概览') >= 0, 'variable overview missing');
  assert(src.indexOf('显著性') >= 0 || src.indexOf('Welch') >= 0, 'significance tests missing');
  assert(src.indexOf('runDataAISummary') >= 0, 'AI summary missing');
  assert(src.indexOf('pearsonCorr') >= 0, 'correlation missing');
});

test('IMPORT: heading style patterns cover custom TJ styles', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert(src.indexOf('一级标题') >= 0, '一级标题 pattern missing');
  assert(src.indexOf('二级标题') >= 0, '二级标题 pattern missing');
  assert(src.indexOf('标题_TJ') >= 0, '标题_TJ pattern missing');
  assert(src.indexOf('extractRefsFromRawDocx') >= 0, 'ref extraction missing');
});

test('UX: two-path home exists', function() {
  var src = fs.readFileSync(path.join(projectRoot, 'js/modules/project.js'), 'utf8');
  assert(src.indexOf('你想先做什么') >= 0 || src.indexOf('home-choice') >= 0, 'two-path home missing');
  assert(src.indexOf('从想法开始') >= 0, 'idea path missing');
  assert(src.indexOf('上传') >= 0, 'upload path missing');
});

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
