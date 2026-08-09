const { chromium } = require('C:/Users/刘锦烋/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const username = `annotation_${Date.now()}`;
  const password = 'E2eTest_2026!';
  await page.goto('http://127.0.0.1:5000', { waitUntil: 'domcontentloaded' });
  await page.locator('#loginSwitchLink').click();
  await page.locator('#loginUsername').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#regConfirmPassword').fill(password);
  await page.locator('#loginBtn').click();
  await page.locator('#loginCardTitle').filter({ hasText: '登录系统' }).waitFor({ timeout: 5000 });
  await page.locator('#loginUsername').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#loginBtn').click();
  await page.locator('#appShell').waitFor({ state: 'visible', timeout: 15000 });

  await page.evaluate(() => {
    if (typeof tourEnd === 'function') tourEnd(true);
    document.querySelectorAll('#tour-tooltip,#tour-backdrop').forEach(el => el.remove());
    const project = ThesisProject.createProject({
      title: '批注运行时验证',
      idea: '验证阅读批注在论文正文中的锚定、高亮与项目生命周期',
      field: '教育技术'
    });
    const root = document.getElementById('thesisBox');
    const workspace = document.getElementById('workspaceContent');
    if (workspace) workspace.style.display = 'none';
    const paper = document.createElement('div');
    paper.id = 'paperContentRoot';
    const heading = document.createElement('h1');
    heading.textContent = '第1章 绪论';
    const paragraph = document.createElement('p');
    paragraph.textContent = '生成式人工智能能够改善研究生论文写作效率，但其证据质量仍需审慎评估。';
    paper.append(heading, paragraph);
    root.appendChild(paper);
    window.manuscriptText = paragraph.textContent;
    window._thesisStructured = true;
    const paragraphNode = {
      el: paragraph,
      sentences: [{ text: paragraph.textContent, start: 0, end: paragraph.textContent.length }]
    };
    const paragraphEntry = {
      el: paragraph,
      node: paragraphNode,
      _chapter: { ch: 1, name: '第1章 绪论', el: heading }
    };
    paragraphNode._chapter = paragraphEntry._chapter;
    window._treeIndex = {
      chapters: [{ ch: 1, name: '第1章 绪论', el: heading }],
      sections: [],
      subs: [],
      paragraphs: [paragraphEntry],
      sentences: []
    };
    window._citationNodeByElement = new WeakMap();
    window._citationNodeByElement.set(paragraph, { paragraph: paragraphNode, chapter: paragraphEntry._chapter });
    const scope = getManuscriptScope();
    const indexedParagraph = scope.paragraphs[0];
    const start = paragraph.textContent.indexOf('改善研究生论文写作效率');
    const quote = '改善研究生论文写作效率';
    const anchor = {
      revisionId: scope.revisionId,
      paragraphId: indexedParagraph.paragraphId,
      structuralPath: indexedParagraph.structuralPath,
      startOffset: start,
      endOffset: start + quote.length,
      quote,
      prefix: paragraph.textContent.substring(Math.max(0, start - 32), start),
      suffix: paragraph.textContent.substring(start + quote.length, start + quote.length + 32),
      normalizedTextHash: indexedParagraph.textHash
    };
    const lit = ThesisProject.getLiteratureArtifact();
    lit.annotations = lit.annotations || {};
    lit.annotations['ann-e2e'] = {
      id: 'ann-e2e',
      anchor,
      type: 'evidence',
      label: '证据',
      title: '效率提升证据',
      note: '需要核对实验设计与样本范围。',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    ThesisProject.saveLiteratureArtifact(lit, { localOnly: true });
    LiteratureWorkbench.open({ mode: 'annotations', keepSelection: true });
  });

  await page.getByRole('tab', { name: '阅读批注' }).waitFor({ state: 'visible' });
  await page.locator('.literature-annotation-item').waitFor({ state: 'visible' });
  const anchorDiagnostic = await page.evaluate(() => {
    const annotation = ThesisProject.getLiteratureArtifact().annotations['ann-e2e'];
    const resolved = resolveTextAnchor(annotation.anchor);
    const entry = window._treeIndex.paragraphs[0];
    const node = entry && (entry.node || entry);
    return {
      anchor: annotation.anchor,
      status: resolved.status,
      nodeParagraphId: node && node.paragraphId,
      nodeTextHash: node && node.textHash,
      nodeText: node && node.text,
      domText: document.querySelector('#paperContentRoot p').textContent
    };
  });
  assert.match(await page.locator('.literature-annotation-item').innerText(), /效率提升证据/);
  assert.match(await page.locator('.literature-annotation-status').innerText(), /已定位/, JSON.stringify(anchorDiagnostic));
  assert.equal(await page.locator('[data-annotation-filter="evidence"]').getAttribute('aria-pressed'), 'false');
  await page.locator('[data-annotation-filter="evidence"]').click();
  assert.equal(await page.locator('[data-annotation-filter="evidence"]').getAttribute('aria-pressed'), 'true');

  const highlightState = await page.evaluate(() => ({
    cssHighlight: Boolean(window.CSS && CSS.highlights && CSS.highlights.get('literature-annotation-evidence')),
    fallback: document.querySelectorAll('[data-literature-annotation-highlight]').length
  }));
  assert.equal(highlightState.cssHighlight || highlightState.fallback > 0, true);

  await page.locator('[data-annotation-jump="ann-e2e"]').click();
  assert.equal(await page.locator('#paperContentRoot p').evaluate(el => el.classList.contains('literature-annotation-focus')), true);

  await page.evaluate(() => {
    document.body.classList.add('dark');
    document.body.classList.remove('light');
    document.body.dataset.colorMode = 'dark';
  });
  const darkColors = await page.evaluate(() => {
    const card = getComputedStyle(document.querySelector('.literature-annotation-item'));
    const status = getComputedStyle(document.querySelector('.literature-annotation-status'));
    return { card: card.backgroundColor, text: card.color, status: status.backgroundColor };
  });
  assert.notEqual(darkColors.card, 'rgba(0, 0, 0, 0)');
  assert.notEqual(darkColors.status, 'rgba(0, 0, 0, 0)');
  await page.locator('#literatureWorkbench').screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-annotations-dark.png' });

  await page.evaluate(() => clearManuscriptRuntime());
  const cleared = await page.evaluate(() => ({
    cssHighlight: Boolean(window.CSS && CSS.highlights && CSS.highlights.get('literature-annotation-evidence')),
    fallback: document.querySelectorAll('[data-literature-annotation-highlight]').length,
    selectionBarHidden: document.getElementById('literatureSelectionBar').hidden
  }));
  assert.equal(cleared.cssHighlight, false);
  assert.equal(cleared.fallback, 0);
  assert.equal(cleared.selectionBarHidden, true);

  const relevantErrors = consoleErrors.filter(error => !error.includes('favicon'));
  assert.deepEqual(relevantErrors, []);
  await browser.close();
  console.log(JSON.stringify({ ok: true, username, highlightState, darkColors, screenshot: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-annotations-dark.png' }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
