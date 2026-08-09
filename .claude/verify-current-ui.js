const { chromium } = require('C:/Users/刘锦烋/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  const username = `ui_${Date.now()}`;
  const password = 'UiTest_2026!';
  await page.goto('http://127.0.0.1:5000', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.locator('#loginSwitchLink').click();
  await page.locator('#loginUsername').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#regConfirmPassword').fill(password);
  await page.locator('#loginBtn').click();
  await page.locator('#loginCardTitle').filter({ hasText: '登录系统' }).waitFor({ timeout: 8000 });
  await page.locator('#loginUsername').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#loginBtn').click();
  await page.locator('#appShell').waitFor({ state: 'visible', timeout: 15000 });
  await page.evaluate(() => {
    localStorage.setItem('thesis_ai_onboarding_done','1');
    document.getElementById('tour-backdrop')?.remove();
    document.getElementById('tour-tooltip')?.remove();
  });

  await page.evaluate(() => {
    window.manuscriptText = `摘要 人工智能辅助论文写作正在改变研究生的信息检索、结构规划和修改反馈方式。本文采用问卷调查、访谈和回归分析方法，研究人工智能工具对论文写作效率与质量的影响。关键词 人工智能 论文写作 研究生 教育技术\n第一章 绪论\n人工智能辅助工具在研究生论文写作中的应用持续增长。研究表明，智能检索、摘要生成和结构建议能够改善写作流程。本文关注效率提升、质量改进和学术规范之间的关系。\n第二章 文献综述\n既有研究指出，数字工具能够支持学术写作过程。国外研究重视写作反馈系统，国内研究关注研究生培养质量和论文规范。相关文献表明，工具使用效果受到学习者经验、任务复杂度和反馈质量影响。\n第三章 研究方法\n本文采用问卷调查、半结构访谈和多元回归分析。问卷收集研究生使用人工智能工具的频率、场景和感知收益。访谈用于解释量化结果，回归模型用于检验工具使用与写作效率之间的关系。\n第四章 结果分析\n结果表明，高频使用者在资料整理和初稿形成方面效率更高。数据分析显示，反馈质量对论文修改满意度具有显著影响。案例材料进一步说明，合理使用工具有助于减少重复性劳动。\n第五章 结论与建议\n研究发现，人工智能辅助工具能够提升论文写作效率，但需要配合学术规范训练。未来应完善工具透明度、引用规范和导师协同机制。`;
    window.sections = [
      { ch: 1, name: '第一章 绪论', text: '人工智能辅助工具在研究生论文写作中的应用持续增长。研究表明，智能检索、摘要生成和结构建议能够改善写作流程。本文关注效率提升、质量改进和学术规范之间的关系。', sections: [] },
      { ch: 2, name: '第二章 文献综述', text: '既有研究指出，数字工具能够支持学术写作过程。国外研究重视写作反馈系统，国内研究关注研究生培养质量和论文规范。相关文献表明，工具使用效果受到学习者经验、任务复杂度和反馈质量影响。', sections: [] },
      { ch: 3, name: '第三章 研究方法', text: '本文采用问卷调查、半结构访谈和多元回归分析。问卷收集研究生使用人工智能工具的频率、场景和感知收益。访谈用于解释量化结果，回归模型用于检验工具使用与写作效率之间的关系。', sections: [] },
      { ch: 4, name: '第四章 结果分析', text: '结果表明，高频使用者在资料整理和初稿形成方面效率更高。数据分析显示，反馈质量对论文修改满意度具有显著影响。案例材料进一步说明，合理使用工具有助于减少重复性劳动。', sections: [] },
      { ch: 5, name: '第五章 结论与建议', text: '研究发现，人工智能辅助工具能够提升论文写作效率，但需要配合学术规范训练。未来应完善工具透明度、引用规范和导师协同机制。', sections: [] }
    ];
    window.paperTopics = [
      { label: '人工智能', count: 28 }, { label: '论文写作', count: 24 }, { label: '研究生', count: 19 }, { label: '写作效率', count: 15 }, { label: '学术规范', count: 13 }, { label: '反馈质量', count: 10 }, { label: '文献检索', count: 9 }, { label: '教育技术', count: 8 }
    ];
    window.existingRefs = window.mergedRefs = [
      { title: 'Artificial intelligence and academic writing feedback', year: '2024', doi: '10.1000/a', ch: 1 },
      { title: '研究生论文写作质量提升研究', year: '2023', doi: '10.1000/b', ch: 2 },
      { title: 'Educational technology in graduate education', year: '2022', ch: 3 },
      { title: '智能写作工具的使用行为分析', year: '2025', ch: 4 }
    ];
    window.chargeModule = () => Promise.resolve({ ok: true });
  });

  await page.evaluate(() => window.showDashboard());
  await page.locator('#dbOverlay').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#dbChapter').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);
  const dashText = await page.locator('#dbOverlay').innerText();
  assert.match(dashText, /总字数/);
  assert.match(dashText, /章节字数/);
  assert.match(dashText, /优先行动|各维度均达到良好线/);
  await page.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-dashboard-check.png', fullPage: true });
  await page.evaluate(() => window.closeDashboard());

  await page.evaluate(() => {
    document.getElementById('kgOverlay').style.display = 'flex';
    window.ensureKnowledgeGraphDOM();
    document.getElementById('kgCloudPanel').style.display = 'block';
    window.kgCurrentView = 'cloud';
    window.setKnowledgeGraphTabs('cloud');
    window.renderWordCloud();
  });
  await page.locator('#wcContainer').waitFor({ state: 'visible', timeout: 10000 });
  const before = await page.locator('#wcInner').evaluate(el => el.style.transform || '');
  await page.locator('#wcContainer').evaluate(el => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -300, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  });
  await page.waitForTimeout(100);
  const afterZoom = await page.locator('#wcInner').evaluate(el => el.style.transform || '');
  const linkZoom = await page.locator('#wcLinkGroup').getAttribute('transform');
  await page.locator('#wcContainer').evaluate(el => {
    const r = el.getBoundingClientRect();
    const down = new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: r.left + 40, clientY: r.bottom - 40 });
    const move = new MouseEvent('mousemove', { bubbles: true, button: 0, clientX: r.left + 140, clientY: r.bottom - 100 });
    const up = new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: r.left + 140, clientY: r.bottom - 100 });
    el.dispatchEvent(down); document.dispatchEvent(move); document.dispatchEvent(up);
  });
  await page.waitForTimeout(100);
  const afterPan = await page.locator('#wcInner').evaluate(el => el.style.transform || '');
  const linkPan = await page.locator('#wcLinkGroup').getAttribute('transform');
  assert.notEqual(afterZoom, before);
  assert.match(linkZoom || '', /translate\(/);
  assert.match(linkZoom || '', /scale\(/);
  assert.notEqual(afterPan, afterZoom);
  assert.match(linkPan || '', /translate\(/);
  assert.match(linkPan || '', /scale\(/);
  await page.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-wordcloud-check.png', fullPage: true });

  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await admin.goto('http://127.0.0.1:5000/admin.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await admin.locator('#loginUser').fill('admin');
  await admin.locator('#loginPass').fill('localpass');
  await admin.locator('button', { hasText: '账号登录' }).click();
  await admin.locator('#dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await admin.evaluate(() => { goSection('pricingSection'); loadPricing(); });
  await admin.locator('#pricingQuickGrid .pricing-quick-card').first().waitFor({ state: 'visible', timeout: 10000 });
  const adminText = await admin.locator('#pricingSection').innerText();
  assert.match(adminText, /常用计费策略/);
  assert.match(adminText, /高级：模型费率卡与能力独立策略/);
  await admin.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-admin-pricing-check.png', fullPage: true });

  const relevantErrors = errors.filter(e => !/favicon|Failed to load resource/.test(e));
  assert.deepEqual(relevantErrors, []);
  await browser.close();
  console.log(JSON.stringify({ ok: true, screenshots: [
    'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-dashboard-check.png',
    'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-wordcloud-check.png',
    'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-admin-pricing-check.png'
  ] }, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
