const { chromium } = require('C:/Users/刘锦烋/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  const username = `evidence_${Date.now()}`;
  const password = 'Evidence_2026!';
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
    const project = {
      id: 'p_evidence_ui',
      title: '人工智能辅助论文写作研究',
      idea: '验证文献证据看板与章节证据评分',
      field: '教育技术',
      degree: '硕士',
      mode: 'import',
      currentStage: 'literature',
      hasManuscript: true,
      stageStatus: { ideation: 'done', literature: 'active', review: 'active' },
      artifacts: {
        literature: {
          schemaVersion: 2,
          version: 1,
          claims: {},
          papers: {},
          evidenceLinks: { e1: { id: 'e1', reviewStatus: 'accepted', claimId: 'c1', paperId: 'p1', relation: 'support' } },
          occurrences: {},
          audits: {
            a1: { id: 'a1', status: 'pending', text: '研究表明智能检索能够改善论文写作流程。', reason: '包含可验证判断但未检测到引用', location: { chapter: 1, section: '绪论' } },
            a2: { id: 'a2', status: 'later', text: '数据分析显示反馈质量具有显著影响。', reason: '稍后处理', location: { chapter: 4, section: '结果分析' } }
          },
          sentenceIndex: {
            a1: { id: 'a1', text: '研究表明智能检索能够改善论文写作流程。', hasCitation: false, needsCitation: true, structuralPath: { chapter: 1, section: '绪论' }, location: { chapter: 1, section: '绪论' } },
            a2: { id: 'a2', text: '数据分析显示反馈质量具有显著影响。', hasCitation: false, needsCitation: true, structuralPath: { chapter: 4, section: '结果分析' }, location: { chapter: 4, section: '结果分析' } },
            a3: { id: 'a3', text: '已有研究指出数字工具支持学术写作[1]。', hasCitation: true, needsCitation: false, structuralPath: { chapter: 2, section: '文献综述' }, location: { chapter: 2, section: '文献综述' } }
          },
          chapterScores: {
            '1': { chapterKey: '1', chapter: 1, label: '第1章 · 绪论', total: 1, withCitation: 0, needsCitation: 1, pending: 1, resolved: 0, score: 0, nextAction: '优先处理 1 个缺引句' },
            '2': { chapterKey: '2', chapter: 2, label: '第2章 · 文献综述', total: 1, withCitation: 1, needsCitation: 0, pending: 0, resolved: 0, score: 100, nextAction: '抽查已引用句子的来源关系' },
            '4': { chapterKey: '4', chapter: 4, label: '第4章 · 结果分析', total: 1, withCitation: 0, needsCitation: 1, pending: 0, resolved: 1, score: 50, nextAction: '抽查已引用句子的来源关系' }
          },
          searchRuns: {}, searchSessions: {}, chapterAssignments: {}, annotations: {},
          cart: { paperIds: [], selections: {} },
          bibliography: { includedPaperIds: [] },
          settings: { citationStyle: 'gbt7714-numeric' }
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const user = JSON.parse(sessionStorage.getItem('thesis_ai_user') || '{}');
    const suffix = user && user.id != null ? `_u${user.id}` : '_guest';
    localStorage.setItem(`thesis_ai_projects_v1${suffix}`, JSON.stringify([project]));
    localStorage.setItem(`thesis_ai_current_project_id${suffix}`, project.id);
    window.ThesisProject?.renderProjectChrome?.();
    window.switchView?.('workspace');
  });

  await page.locator('.project-evidence-panel').waitFor({ state: 'visible', timeout: 10000 });
  const homeText = await page.locator('#workspaceContent').innerText();
  assert.match(homeText, /章节证据评分/);
  assert.match(homeText, /补齐章节证据缺口|处理 第1章/);
  await page.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-evidence-home.png', fullPage: true });

  await page.evaluate(() => window.switchModule('references'));
  await page.locator('#literatureWorkbench').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('button[data-view="board"]').waitFor({ state: 'visible', timeout: 10000 });
  const boardText = await page.locator('#literatureWorkbench').innerText();
  assert.match(boardText, /证据看板/);
  assert.match(boardText, /章节证据评分/);
  assert.match(boardText, /第1章/);
  await page.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-evidence-board.png', fullPage: true });

  await page.evaluate(() => {
    localStorage.setItem('thesis_ai_onboarding_done','1');
    document.getElementById('tour-backdrop')?.remove();
    document.getElementById('tour-tooltip')?.remove();
  });
  await page.locator('button[data-view="audit"]').click();
  await page.locator('button[data-sentence-filter="pending"]').waitFor({ state: 'visible', timeout: 10000 });
  const queueText = await page.locator('#literatureWorkbench').innerText();
  assert.match(queueText, /句子证据队列/);
  assert.match(queueText, /待补证据/);
  assert.match(queueText, /研究表明智能检索/);
  await page.screenshot({ path: 'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-sentence-queue.png', fullPage: true });

  const relevantErrors = errors.filter(e => !/favicon|Failed to load resource|ERR_BLOCKED_BY_CLIENT/.test(e));
  assert.deepEqual(relevantErrors, []);
  await browser.close();
  console.log(JSON.stringify({ ok: true, screenshots: [
    'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-evidence-home.png',
    'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-evidence-board.png',
    'C:/Users/刘锦烋/AppData/Local/Temp/thesisbuddy-sentence-queue.png'
  ] }, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
