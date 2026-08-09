const { chromium } = require('C:/Users/刘锦烋/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const username = `e2e_${Date.now()}`;
  const password = 'E2eTest_2026!';
  await page.goto('http://127.0.0.1:5000', { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('.landing-title').isVisible(), true);

  await page.locator('[data-landing-path="docx"]').click();
  assert.equal(await page.locator('[data-landing-path="docx"]').getAttribute('aria-selected'), 'true');
  assert.match(await page.locator('#landingStageDesc').innerText(), /导入路径/);

  await page.locator('[data-stage="0"]').focus();
  await page.locator('[data-stage="0"]').press('End');
  assert.equal(await page.locator('[data-stage="6"]').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#landingStageName').innerText(), '做答辩');

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

  await page.locator('#tour-tooltip').waitFor({ state: 'visible', timeout: 5000 });
  assert.match(await page.locator('#tour-tooltip').innerText(), /欢迎使用/);
  await page.getByRole('button', { name: '跳过' }).click();
  assert.equal(await page.locator('#tour-tooltip').count(), 0);

  await page.locator('.nav-upload-btn.primary').click();
  await page.locator('#ideaWizardOverlay').waitFor({ state: 'visible' });
  assert.match(await page.locator('#ideaWizardOverlay').innerText(), /从想法创建论文项目/);
  await page.locator('#ideaText').fill('研究人工智能辅助工具对研究生论文写作效率与质量的影响');
  await page.locator('#ideaField').fill('教育技术');
  assert.match(await page.locator('#ideaWizardOverlay').innerText(), /创建项目并开始/);

  await page.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-e2e.png', fullPage: true });
  const relevantErrors = consoleErrors.filter(error => !error.includes('favicon'));
  assert.deepEqual(relevantErrors, []);
  await browser.close();
  console.log(JSON.stringify({ ok: true, username, screenshot: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-e2e.png' }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
