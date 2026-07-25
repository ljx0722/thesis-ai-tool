const { chromium } = require('C:/Users/刘锦烋/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  const username = `docx_e2e_${Date.now()}`;
  const password = 'E2eTest_2026!';
  const fixture = path.resolve('.claude/thesisbuddy-e2e-results/docx-heading-mapping-real.docx');
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
  await page.evaluate(() => { if (typeof tourEnd === 'function') tourEnd(true); document.querySelectorAll('#tour-tooltip,#tour-backdrop').forEach(el => el.remove()); });

  await page.locator('#fileInput').setInputFiles(fixture);
  await page.locator('#cwOverlay').waitFor({ state: 'visible', timeout: 30000 });
  await page.evaluate(() => { document.querySelectorAll('#tour-tooltip,#tour-backdrop').forEach(el => el.remove()); });
  await page.evaluate(() => {
    const groups = window._docxStyleGroups || [];
    const ghost = groups.find(group => group.name === '未定位标题_TJ');
    if (!ghost || !ghost._items || ghost._items.length < 2) throw new Error('Ghost style group missing');
    const candidate = document.querySelector('#paperContentRoot p');
    ghost._items[0].el = null;
    ghost._items[0].domIndex = -1;
    ghost._items[0].status = 'unmapped';
    ghost._items[0].confidence = 0;
    ghost._items[0].skipped = false;
    ghost._items[1].el = null;
    ghost._items[1].domIndex = -1;
    ghost._items[1].status = 'unmapped';
    ghost._items[1].confidence = 0;
    ghost._items[1].skipped = false;
    candidate.textContent = '第三章 XML 独有标题';
  });

  await page.getByText('标题_TJ', { exact: true }).click();
  await page.locator('#cwConfirmPopup').waitFor({ state: 'visible' });
  await page.locator('#cwConfirmAcceptButton').click();
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.getByText('一级标题_TJ', { exact: true }).click();
  await page.locator('#cwConfirmAcceptButton').click();
  await page.getByRole('button', { name: /下一步/ }).click();
  await page.getByText('二级标题_TJ', { exact: true }).click();
  await page.locator('#cwConfirmAcceptButton').click();

  await page.getByText('未定位标题_TJ', { exact: true }).click();
  await page.locator('#cwConfirmPopup').waitFor({ state: 'visible' });
  const rows = page.locator('.cw-confirm-item');
  assert.equal(await rows.count(), 2);
  await rows.nth(0).getByRole('button', { name: '手动定位' }).click();
  await page.locator('.cw-manual-candidate').filter({ hasText: '第三章 XML 独有标题' }).first().click();
  await page.locator('#cwManualUseButton').click();
  const firstMeta = rows.nth(0).locator('.cw-confirm-item-meta');
  await firstMeta.waitFor();
  assert.match(await firstMeta.innerText(), /已手动定位/);
  await rows.nth(1).getByRole('button', { name: '跳过该条' }).click();
  assert.match(await rows.nth(1).locator('.cw-confirm-item-meta').innerText(), /已跳过/);
  await page.screenshot({ path: '.claude/thesisbuddy-e2e-results/docx-manual-map-skip.png', fullPage: true });
  await page.locator('#cwConfirmAcceptButton').click();
  await page.getByRole('button', { name: /完成/ }).click();
  await page.locator('#cwOverlay').waitFor({ state: 'detached', timeout: 30000 });
  assert.equal(await page.evaluate(() => !!document.getElementById('thesisBox') && typeof manuscriptText === 'string' && manuscriptText.length > 50), true);

  const relevantErrors = consoleErrors.filter(error => !error.includes('favicon') && !error.includes('status of 404') && !error.includes('status of 409'));
  assert.deepEqual(relevantErrors, []);
  console.log(JSON.stringify({ ok: true, fixture, screenshot: path.resolve('.claude/thesisbuddy-e2e-results/docx-manual-map-skip.png') }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
