const { test, expect } = require('@playwright/test');

const baseURL = 'http://127.0.0.1:5000';
const username = `e2e_${Date.now()}`;
const password = 'E2eTest_2026!';

test('ThesisBuddy user journey smoke', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /论文搭子/ })).toBeVisible();

  const docxPath = page.locator('[data-landing-path="docx"]');
  await docxPath.click();
  await expect(docxPath).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#landingStageDesc')).toContainText('导入路径');

  const firstStage = page.locator('[data-stage="0"]');
  await firstStage.focus();
  await firstStage.press('End');
  await expect(page.locator('[data-stage="6"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#landingStageName')).toHaveText('做答辩');

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

  await expect(page.locator('#tour-tooltip')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#tour-tooltip')).toContainText('欢迎使用');
  await page.getByRole('button', { name: '跳过' }).click();
  await expect(page.locator('#tour-tooltip')).toHaveCount(0);

  await page.getByRole('button', { name: /从想法开始/ }).first().click();
  await expect(page.locator('#ideaWizardOverlay')).toBeVisible();
  await expect(page.locator('#ideaWizardOverlay')).toContainText('从想法创建论文项目');
  await page.locator('#ideaText').fill('研究人工智能辅助工具对研究生论文写作效率与质量的影响');
  await page.locator('#ideaField').fill('教育技术');
  await expect(page.locator('#ideaWizardOverlay')).toContainText('创建项目并开始');
  await page.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-e2e.png', fullPage: true });

  expect(consoleErrors.filter(error => !error.includes('favicon'))).toEqual([]);
});
