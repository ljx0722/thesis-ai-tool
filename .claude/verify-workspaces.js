const { chromium } = require('C:/Users/刘锦烋/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const username = `workspace_${Date.now()}`;
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
    ThesisProject.createProject({title:'工作区整合验证',idea:'验证六工作区导航和旧模块兼容路由',field:'教育技术'});
    ThesisProject.renderProjectChrome();
  });

  const workspaceButtons = page.locator('#stageNav [data-workspace]');
  assert.equal(await workspaceButtons.count(), 6);
  assert.deepEqual(await workspaceButtons.locator('b').allTextContents(), ['规划','证据','写作','打磨','评审','交付']);

  await page.locator('[data-workspace="evidence"]').click();
  await page.getByRole('button', { name: '文献工作台' }).waitFor({ state: 'visible' });
  assert.match(page.url(), /#\/workspace\/evidence\/literature$/);
  await page.getByRole('tab', { name: '局部反查' }).waitFor({ state: 'visible' });

  await page.locator('[data-workspace="polish"]').click();
  await page.getByRole('button', { name: '格式规范' }).waitFor({ state: 'visible' });
  assert.match(page.url(), /#\/workspace\/polish\/format$/);
  assert.equal(await page.locator('.workspace-mode-tab').count(), 5);

  await page.evaluate(() => history.pushState({}, '', '#/references'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#appShell').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: '文献工作台' }).waitFor({ state: 'visible' });
  assert.equal(await page.locator('#stageNav [data-workspace="evidence"]').getAttribute('class').then(x => x.includes('active')), true);

  await page.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-workspaces.png', fullPage: true });
  const relevant = errors.filter(error => !error.includes('favicon') && !error.includes('404 (NOT FOUND)'));
  assert.deepEqual(relevant, []);
  await browser.close();
  console.log(JSON.stringify({ok:true,username,screenshot:'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-workspaces.png'}));
})().catch(error => { console.error(error); process.exit(1); });
