const { test, expect } = require('@playwright/test');

const baseURL = process.env.THESISBUDDY_BASE_URL || 'http://127.0.0.1:5000';

async function authenticate(page) {
  const username = `e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const password = 'E2eTest_2026!';

  await page.getByRole('link', { name: '立即注册' }).click();
  await page.locator('#loginUsername').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#regConfirmPassword').fill(password);
  await page.locator('#loginBtn').click();
  await expect(page.locator('#loginError')).toContainText('注册成功');

  await page.locator('#loginUsername').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#loginBtn').click();
  await expect(page.locator('#appShell')).toBeVisible({ timeout: 15000 });
}

test('new user sees two real activation paths and contextual help', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /论文搭子/ })).toBeVisible();
  await authenticate(page);

  await expect(page.locator('.activation-home')).toBeVisible();
  await expect(page.getByRole('button', { name: /从想法开始/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /导入已有论文/ }).first()).toBeVisible();
  await expect(page.locator('#taskGuide')).toHaveCount(0);

  await page.locator('#helpBtn').click();
  await expect(page.locator('#taskGuide')).toBeVisible();
  await expect(page.locator('#taskGuide')).toContainText('找到下一步');
  await page.getByRole('button', { name: '关闭指南' }).click();

  await page.getByRole('button', { name: /从想法开始/ }).first().click();
  await expect(page.locator('#taskGuide')).toContainText('从想法建立论文项目');
  await page.getByRole('button', { name: '开始创建项目' }).click();
  await expect(page.locator('#ideaWizardOverlay')).toBeVisible();
  await expect(page.locator('#ideaWizardOverlay')).toContainText('从想法创建论文项目');
  await page.locator('#ideaText').fill('研究人工智能辅助工具对研究生论文写作效率与质量的影响');
  await page.locator('#ideaField').fill('教育技术');
  await expect(page.locator('#ideaWizardOverlay')).toContainText('创建项目并开始');
  await expect(page.locator('#ideaWizardOverlay').getByRole('button', { name: '创建项目并开始' })).toBeVisible();
  await page.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-desktop-acceptance.png', fullPage: true });

  expect(consoleErrors.filter(error => !error.includes('favicon'))).toEqual([]);
});

test('desktop project home scrolls and exposes appearance settings', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await authenticate(page);

  await expect(page.locator('.activation-home')).toBeVisible();
  const shellMetrics = await page.locator('#appShell').evaluate(element => ({
    display: getComputedStyle(element).display,
    height: element.clientHeight,
    viewport: window.innerHeight
  }));
  expect(shellMetrics.display).toBe('flex');
  expect(Math.abs(shellMetrics.height - shellMetrics.viewport)).toBeLessThanOrEqual(1);

  await page.locator('#workspaceContent').evaluate(element => {
    element.style.minHeight = '2000px';
  });
  const thesisBox = page.locator('#thesisBox');
  await expect.poll(() => thesisBox.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  const before = await thesisBox.evaluate(element => element.scrollTop);
  await thesisBox.hover();
  await page.mouse.wheel(0, 700);
  await expect.poll(() => thesisBox.evaluate(element => element.scrollTop)).toBeGreaterThan(before);

  await page.getByTitle('账户菜单').click();
  const appearance = page.getByRole('button', { name: '外观设置' });
  await expect(appearance).toBeVisible();
  await appearance.click();
  const themeStudio = page.locator('#themeStudio');
  await expect(themeStudio).toBeVisible();
  await expect(themeStudio).toHaveClass(/open/);
  await expect(themeStudio).toHaveAttribute('aria-hidden', 'false');
  const panelBox = await themeStudio.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox.x).toBeGreaterThanOrEqual(0);
  expect(panelBox.y).toBeGreaterThanOrEqual(0);
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
  await expect(page.locator('#prefAccent')).toBeVisible();
  await expect(page.locator('#prefDensity')).toBeVisible();
});

test('desktop interaction surfaces keep visibility and ownership contracts', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await authenticate(page);

  await page.evaluate(() => window.showRechargeModal());
  const recharge = page.locator('#rechargeModal');
  await expect(recharge).toBeVisible();
  await expect(recharge).not.toHaveClass(/hidden/);
  await expect(recharge).toHaveAttribute('aria-hidden', 'false');
  await page.evaluate(() => window.hideRechargeModal());
  await expect(recharge).toBeHidden();
  await expect(recharge).toHaveClass(/hidden/);

  await page.evaluate(() => window.openAccountCenter());
  const account = page.locator('#accountCenterMask');
  await expect(account).toBeVisible();
  await expect(account).not.toHaveClass(/hidden/);
  await expect(account).toHaveAttribute('aria-hidden', 'false');
  await page.evaluate(() => window.closeAccountCenter());
  await expect(account).toBeHidden();

  await page.evaluate(() => window.openBuddyAssistant());
  await expect(page.locator('#buddyInput')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.ThesisRouter.current.surface)).toBe('buddy');
  await page.evaluate(() => window.ThesisRouter.go('home'));

  await page.evaluate(() => window.openImportDialog('new'));
  const drop = page.locator('#uploadDrop');
  await expect(drop).toBeVisible();
  await drop.dispatchEvent('dragover');
  await expect(drop).toHaveClass(/dragover/);
  await drop.dispatchEvent('dragleave');
  await expect(drop).not.toHaveClass(/dragover/);

  expect(consoleErrors.filter(error => !error.includes('favicon'))).toEqual([]);
});

test('mobile shell exposes four destinations and tool drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await authenticate(page);

  const mobileNav = page.locator('.mobile-bottom-nav');
  await expect(mobileNav).toBeVisible();
  for (const name of ['主页', '论文', '工具', '搭子']) {
    await expect(mobileNav.getByRole('button', { name })).toBeVisible();
  }

  await mobileNav.getByRole('button', { name: '工具' }).click();
  await expect(page.locator('#mobileToolDrawer')).toBeVisible();
  await expect(page.locator('#mobileToolDrawerBody')).toContainText('准备');
  await expect(page.locator('#mobileToolDrawerBody')).toContainText('打磨');
  await expect(page.locator('body')).not.toHaveClass(/mobile-overflow/);
  await page.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-mobile-acceptance.png', fullPage: true });
});

test('mobile tools catalog filter opens the same drawer surface', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await authenticate(page);
  await page.evaluate(() => ThesisRouter.go('tools'));
  const filter = page.locator('.catalog-mobile-filter');
  await expect(filter).toBeVisible();
  await filter.click();
  await expect(page.locator('#mobileToolDrawer')).toBeVisible();
  await expect(page.locator('#mobileToolDrawerBody')).toContainText('准备');
  await page.evaluate(() => ThesisRouter.closeMobileToolDrawer());
  await expect(page.locator('#mobileToolDrawer')).toBeHidden({ timeout: 1000 });
});
