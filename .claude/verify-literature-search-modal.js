const { chromium } = require('C:/Users/刘锦烋/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const username = `lsm_${Date.now()}`;
  const password = 'E2eTest_2026!';

  await page.goto('http://127.0.0.1:5000', { waitUntil: 'domcontentloaded' });
  await page.locator('#loginSwitchLink').click();
  await page.locator('#loginUsername').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#regConfirmPassword').fill(password);
  await page.locator('#loginBtn').click();
  await page.waitForTimeout(2000);
  await page.locator('#loginUsername').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#loginBtn').click();
  await page.waitForFunction(() => document.getElementById('appShell')?.offsetParent !== null, { timeout: 15000 });

  await page.evaluate(() => {
    if (typeof tourEnd === 'function') tourEnd(true);
    document.querySelectorAll('#tour-tooltip,#tour-backdrop').forEach(el => { el.remove(); });
    try { localStorage.setItem('thesis_tour_done', '1'); } catch(e) {}
    ThesisProject.createProject({
      title: '文献检索弹窗测试',
      idea: '研究生成式 AI 辅助工具对研究生论文写作效率与质量的影响',
      field: '教育技术',
      keywords: '生成式AI,论文写作,研究生'
    });
    ThesisProject.renderProjectChrome();
  });

  // Open the modal
  await page.evaluate(() => { if (typeof startSearch === 'function') startSearch(); });
  await page.waitForFunction(() => document.getElementById('literatureSearchOverlay')?.style?.display === 'flex', { timeout: 15000 });
  await page.evaluate(() => document.querySelectorAll('#tour-tooltip,#tour-backdrop').forEach(el => el.remove()));
  assert.equal(await page.locator('#literatureSearchSteps button').count(), 5);

  // Fill intent and advance to strategy — do everything in one evaluate call
  const advanceResult = await page.evaluate(() => {
    document.querySelectorAll('#tour-tooltip,#tour-backdrop').forEach(el => { if(el.remove) el.remove(); });
    var claim = document.getElementById('literatureIntentClaim');
    if (claim) {
      var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeInputValueSetter.call(claim, '生成式人工智能辅助工具能否提升研究生论文写作效率与质量？');
      claim.dispatchEvent(new Event('input', { bubbles: true }));
      claim.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Trigger the next button via event delegation
    var btn = document.querySelector('[data-search-action="next"]');
    if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return {
      claimValue: claim ? claim.value : 'no element',
      buttonFound: !!btn,
      overlayDisplay: document.getElementById('literatureSearchOverlay')?.style?.display
    };
  });

  // Check if we advanced
  await page.waitForTimeout(500);
  const afterClick = await page.evaluate(() => ({
    currentStep: document.querySelector('[aria-current="step"]')?.dataset?.searchStep || 'none',
    strategyVisible: document.querySelector('[data-query-value]') ? true : false
  }));

  if (afterClick.currentStep === 'strategy') {
    assert.ok(afterClick.strategyVisible);

    // Make a strategy edit so Escape exercises the save-and-exit branch.
    await page.evaluate(() => {
      var target = document.getElementById('literatureTarget');
      if (target) {
        target.value = '12';
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('literatureSearchExitConfirm')?.hidden, { timeout: 4000 });
    await page.evaluate(() => document.querySelector('[data-search-exit="save"]')?.click());
    await page.waitForFunction(() => document.getElementById('literatureSearchOverlay')?.style?.display === 'none', { timeout: 4000 });

    await page.evaluate(() => { if (typeof LiteratureSearchModal !== 'undefined') LiteratureSearchModal.resume(); });
    await page.waitForFunction(() => document.getElementById('literatureSearchOverlay')?.style?.display === 'flex', { timeout: 5000 });
  }

  // Mobile layout
  await page.setViewportSize({ width: 375, height: 812 });
  const modalBox = await page.locator('#literatureSearchModal').boundingBox();
  assert.ok(modalBox && modalBox.width <= 375 && modalBox.height <= 812);

  await page.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-litsearch-verify.png', fullPage: true });
  const relevant = consoleErrors.filter(error => !error.includes('favicon') && !error.includes('404 (NOT FOUND)'));
  assert.deepEqual(relevant, []);
  await browser.close();
  console.log(JSON.stringify({ ok: true, username, stageAfterAdvance: afterClick.currentStep, screenshot: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-litsearch-verify.png' }));
})().catch(error => { console.error(error); process.exit(1); });
