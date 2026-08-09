const { chromium } = require('C:/Users/刘锦烋/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const username = `theme_search_${Date.now()}`;
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
    ThesisProject.createProject({
      title: '生成式 AI 与研究生论文写作研究',
      idea: '研究生成式 AI 辅助工具对研究生论文写作效率与质量的影响',
      field: '教育技术',
      keywords: '生成式AI, 论文写作, 研究生'
    });
    ThesisProject.renderProjectChrome();
  });

  await page.locator('#baSearch').click();
  await page.locator('#literatureWorkbench').waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('tab', { name: '局部反查' }).getAttribute('aria-selected'), 'true');
  assert.match(await page.locator('#lwClaimText').inputValue(), /生成式 AI 辅助工具/);
  assert.equal(await page.locator('#baSearch').isEnabled(), true);

  async function inspectMode(mode, suffix) {
    await page.evaluate(value => {
      document.body.classList.toggle('dark', value === 'dark');
      document.body.classList.toggle('light', value === 'light');
      document.body.dataset.colorMode = value;
    }, mode);
    await page.evaluate(() => {
      document.getElementById('dbOverlay').style.display = 'flex';
      document.getElementById('kgOverlay').style.display = 'flex';
    });
    const colors = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const overlay = getComputedStyle(document.getElementById('kgOverlay'));
      const modal = getComputedStyle(document.getElementById('kgModal'));
      const content = getComputedStyle(document.getElementById('kgContent'));
      return {
        cardToken: body.getPropertyValue('--bg-card').trim(),
        surfaceToken: body.getPropertyValue('--surface-alt').trim(),
        overlayToken: body.getPropertyValue('--bg-overlay').trim(),
        overlay: overlay.backgroundColor,
        modal: modal.backgroundColor,
        content: content.backgroundColor
      };
    });
    assert.notEqual(colors.modal, 'rgba(0, 0, 0, 0)');
    assert.notEqual(colors.content, 'rgba(0, 0, 0, 0)');
    assert.notEqual(colors.overlay, colors.modal);
    await page.locator('#kgModal').screenshot({ path: `C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-kg-${suffix}.png` });
    await page.locator('#dbOverlay > .workspace-modal').screenshot({ path: `C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-board-${suffix}.png` });
    return colors;
  }

  const light = await inspectMode('light', 'light');
  const dark = await inspectMode('dark', 'dark');
  assert.notEqual(light.modal, dark.modal);
  assert.notEqual(light.content, dark.content);

  const relevantErrors = consoleErrors.filter(error => !error.includes('favicon') && !error.includes('Failed to load resource: the server responded with a status of 404'));
  assert.deepEqual(relevantErrors, []);
  await browser.close();
  console.log(JSON.stringify({ ok: true, username, light, dark, screenshots: [
    'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-kg-light.png',
    'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-kg-dark.png',
    'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-board-light.png',
    'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-board-dark.png'
  ] }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
