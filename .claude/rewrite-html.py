import os, re

base = 'e:/同济学习/毕业论文/论文文献AI利器'
path = os.path.join(base, 'index.html')

with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

# === 1. Fix CSS links ===
old_css = '''<link rel="stylesheet" href="css/base.css?v=91">
<link rel="stylesheet" href="css/style.css?v=90">
<link rel="stylesheet" href="css/shell.css?v=90">
<link rel="stylesheet" href="css/components.css?v=90"></head><body class="app-shell">'''

new_css = '''<link rel="stylesheet" href="css/tokens.css?v=2">
<link rel="stylesheet" href="css/reset.css?v=2">
<link rel="stylesheet" href="css/base.css?v=2">
<link rel="stylesheet" href="css/shell.css?v=2">
<link rel="stylesheet" href="css/components.css?v=2">
<link rel="stylesheet" href="css/style.css?v=2">
<link rel="stylesheet" href="css/citely.css?v=2"></head><body class="app-shell">'''

html = html.replace(old_css, new_css)

# === 2. Replace top bar ===
old_bar = '''<div class="bar">
  <div class="bar-left">
    <button class="workspace-drawer-btn" onclick="toggleTocPanel()" title="打开目录">目录</button>
    <h1>论文搭子 <span class="brand-en">ThesisBuddy</span></h1>
    <button id="projectTitleChip" class="project-chip" onclick="openIdeaWizard()" title="创建或查看项目">未创建项目</button>
    <span id="projectProgressChip" class="project-progress-chip" style="font-size:.58rem;color:rgba(255,255,255,.55)">创建项目后显示进度</span>
  </div>
  <div class="bar-tabs" id="barTabs">
    <button class="bar-tab active" data-view="workspace" onclick="switchView('workspace');_restoreWorkspace()">准备</button>
    <button class="bar-tab" data-view="writing" onclick="_open('writing-workbench')">写作</button>
    <button class="bar-tab" data-view="polish" onclick="_open('health-check')">打磨</button>
    <button class="bar-tab" data-view="review" onclick="_open('review')">审阅</button>
    <button class="bar-tab" data-view="defense" onclick="_open('defense-ppt')">收尾</button>
  </div>
  <div class="bar-right">
    <span id="balanceBar" style="font-size:.65rem;color:rgba(255,255,255,.75);cursor:pointer;display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,.08);padding:3px 10px;border-radius:12px" onclick="showRechargeModal()" title="点击充值">✨ <strong id="balanceAmount" style="color:inherit;font-weight:700">0.000</strong> 点 <span style="font-size:.5rem;color:rgba(255,255,255,.3)">+</span></span>
    <button id="notifyBellBtn" onclick="toggleNotifyPanel()" style="position:relative;background:rgba(255,255,255,.06);color:rgba(255,255,255,.55);border:none;border-radius:12px;padding:4px 10px;cursor:pointer;font-size:.62rem;margin-left:4px" title="消息中心">🔔<span id="notifyBadge" style="display:none;position:absolute;top:-3px;right:-2px;min-width:14px;height:14px;padding:0 3px;border-radius:8px;background:#ef4444;color:#fff;font-size:.5rem;line-height:14px;font-weight:700">0</span></button>
    <div class="bar-account-menu" style="position:relative;margin-left:4px">
      <button onclick="toggleAccountMenu()" style="background:rgba(255,255,255,.06);color:rgba(255,255,255,.75);border:none;border-radius:12px;padding:4px 10px;cursor:pointer;font-size:.6rem" title="账户菜单">账户 ▾</button>
      <div id="accountDropdown" style="display:none;position:absolute;top:100%;right:0;margin-top:6px;background:var(--bg-card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.15);z-index:100020;min-width:140px;overflow:hidden">
        <button onclick="openAccountCenter();toggleAccountMenu()" style="display:block;width:100%;text-align:left;padding:9px 14px;border:none;background:transparent;color:var(--text-primary,#111);font-size:.72rem;cursor:pointer;font-family:var(--font-sans)">账户中心</button>
        <button onclick="showConsumptionHistory();toggleAccountMenu()" style="display:block;width:100%;text-align:left;padding:9px 14px;border:none;background:transparent;color:var(--text-secondary,#475569);font-size:.72rem;cursor:pointer;font-family:var(--font-sans)">消费明细</button>
        <button onclick="showPricingInfo();toggleAccountMenu()" style="display:block;width:100%;text-align:left;padding:9px 14px;border:none;background:transparent;color:var(--text-secondary,#475569);font-size:.72rem;cursor:pointer;font-family:var(--font-sans)">使用说明</button>
        <button onclick="toggleChangelog();toggleAccountMenu()" style="display:block;width:100%;text-align:left;padding:9px 14px;border:none;background:transparent;color:var(--text-secondary,#475569);font-size:.72rem;cursor:pointer;font-family:var(--font-sans)">更新日志</button>
        <hr style="margin:4px 0;border:none;border-top:1px solid var(--border,#e5e7eb)">
        <button onclick="doLogout()" style="display:block;width:100%;text-align:left;padding:9px 14px;border:none;background:transparent;color:var(--danger,#ef4444);font-size:.72rem;cursor:pointer;font-family:var(--font-sans)">登出</button>
      </div>
    </div>
    <button onclick="window.location.href='/admin.html'" style="background:rgba(99,102,241,.15);color:#c7d2fe;border:none;border-radius:12px;padding:4px 10px;cursor:pointer;font-size:.6rem;margin-left:4px;display:none" id="adminPanelBtn" title="管理员看板">⚙️</button>
  </div>
</div>'''

new_bar = '''<header class="topbar">
  <div class="topbar-left">
    <span class="topbar-brand">论文搭子 <span>ThesisBuddy</span></span>
    <button id="projectTitleChip" class="project-chip" onclick="openIdeaWizard()" title="创建或查看项目">未创建项目</button>
    <span id="projectProgressChip" style="font-size:.58rem;color:rgba(255,255,255,.55);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">创建项目后显示进度</span>
  </div>
  <div class="topbar-center">
    <div class="global-search" onclick="_openCommandPalette()" title="搜索功能 (Ctrl+K)">
      <svg class="global-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="text" class="global-search-input" placeholder="搜索全部功能..." readonly onfocus="this.blur();_openCommandPalette()">
      <kbd class="global-search-kbd">Ctrl+K</kbd>
    </div>
  </div>
  <div class="topbar-right">
    <span class="topbar-balance" id="balanceBar" onclick="showRechargeModal()" title="点击充值">✨ <strong id="balanceAmount">0.000</strong> 点</span>
    <button class="topbar-icon-btn" id="notifyBellBtn" onclick="toggleNotifyPanel()" title="消息中心" style="position:relative">🔔<span id="notifyBadge" class="topbar-badge" style="display:none">0</span></button>
    <div class="bar-account-menu" style="position:relative">
      <button class="topbar-icon-btn" onclick="toggleAccountMenu()" title="账户菜单">账户 ▾</button>
      <div class="topbar-dropdown" id="accountDropdown" style="display:none">
        <button onclick="openAccountCenter();toggleAccountMenu()">账户中心</button>
        <button onclick="showConsumptionHistory();toggleAccountMenu()">消费明细</button>
        <button onclick="showPricingInfo();toggleAccountMenu()">使用说明</button>
        <button onclick="toggleChangelog();toggleAccountMenu()">更新日志</button>
        <hr>
        <button onclick="doLogout()" style="color:var(--danger)">登出</button>
      </div>
    </div>
    <button class="topbar-icon-btn" id="adminPanelBtn" onclick="window.location.href='/admin.html'" style="background:rgba(99,102,241,.15);color:#c7d2fe;display:none" title="管理员看板">⚙️</button>
  </div>
</header>'''

html = html.replace(old_bar, new_bar)

# === 3. Replace main layout ===
old_main = '''<div class="main" id="mainLayout">
  <!-- 左侧目录树 -->
  <div class="toc-panel" id="tocPanel">
    <div class="toc-panel-head">
      <div><span class="toc-panel-title">📑 目录</span></div>
    </div>
    <div class="toc-panel-sub" id="navTreeMeta" style="padding:0 10px 4px;font-size:11px;color:#94a3b8">导入论文后显示章节</div>
    <div class="nav-tree" id="navTree">
      <div class="tree-empty">
        <div class="tree-empty-title">还没有论文</div>
        <div class="tree-empty-desc">创建项目或导入 DOCX</div>
        <button class="tree-empty-btn" onclick="openIdeaWizard()">从想法开始</button>
        <button class="tree-empty-btn" onclick="openImportDialog('new')">导入论文</button>
      </div>
    </div>
    <div id="stageNav" style="display:none"></div>
    <div id="navFeatureTree" style="display:none"></div>
  </div>

  <!-- 论文正文 -->
  <div class="thesis-panel" id="thesisPanel">
    <div class="thesis-bar">
      <h3>📄 论文 <span id="upStatus" style="font-size:.68rem;color:var(--m);font-weight:400">导入论文开始</span></h3>
      <div class="thesis-bar-actions">
        <button class="bar-mini" onclick="openImportDialog('replace')">导入论文</button>
        <button class="bar-mini" onclick="openFullPaperPreview()">预览</button>
        <button class="bar-mini" onclick="mergeDraftsIntoThesis()">合并草稿</button>
        <button class="bar-mini" onclick="showDashboard()">看板</button>
      </div>
    </div>
    <div class="thesis-box" id="thesisBox">
      <div id="workspaceContent" class="workspace-content">
        <div id="workspaceWelcome" class="workspace-welcome">
          <div class="workspace-welcome-icon">📋</div>
          <h2 class="workspace-welcome-title">欢迎使用论文搭子</h2>
          <p class="workspace-welcome-sub">选一种方式开始你的论文之旅，或按 <kbd>Ctrl+K</kbd> 搜索全部功能</p>
          <div class="workspace-welcome-cards">
            <button class="workspace-welcome-card primary" onclick="openIdeaWizard()">
              <span class="workspace-welcome-card-icon">💡</span>
              <span class="workspace-welcome-card-title">从想法开始</span>
              <span class="workspace-welcome-card-desc">准备→写作→打磨→收尾，4个里程碑逐步推进</span>
            </button>
            <button class="workspace-welcome-card" onclick="openImportDialog('new')">
              <span class="workspace-welcome-card-icon">📄</span>
              <span class="workspace-welcome-card-title">导入论文</span>
              <span class="workspace-welcome-card-desc">已有 DOCX 论文？导入后体检、审阅、打磨</span>
            </button>
          </div>
          <p class="workspace-welcome-hint">按 <kbd>Ctrl+K</kbd> 搜索功能 · 按 <kbd>Ctrl+B</kbd> 召唤论文搭子助手</p>
        </div>
      </div>
    </div>
    <div class="skeleton-full" id="thesisSkeleton" style="display:none"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-block"></div></div>
  </div>
</div>'''

new_main = '''<div class="main-layout" id="mainLayout">
  <!-- LEFT: Sidebar -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-project-name" id="sidebarProjectName">论文搭子</span>
    </div>
    <nav class="sidebar-milestones" role="navigation" aria-label="论文阶段">
      <button class="sidebar-milestone active" data-milestone="prepare" onclick="Nav.navigate('prepare')">
        <span class="sidebar-milestone-icon">1</span> 准备
      </button>
      <button class="sidebar-milestone" data-milestone="writing" onclick="Nav.navigate('writing')">
        <span class="sidebar-milestone-icon">2</span> 写作
      </button>
      <button class="sidebar-milestone" data-milestone="polish" onclick="Nav.navigate('polish')">
        <span class="sidebar-milestone-icon">3</span> 打磨
      </button>
      <button class="sidebar-milestone" data-milestone="finish" onclick="Nav.navigate('finish')">
        <span class="sidebar-milestone-icon">4</span> 收尾
      </button>
    </nav>
    <div class="sidebar-tree" id="navTree">
      <div class="sidebar-tree-empty" id="navTreeMeta">导入论文后显示章节</div>
    </div>
    <div class="sidebar-footer">
      <button class="sidebar-quick-action" onclick="openIdeaWizard()">💡 从想法开始</button>
      <button class="sidebar-quick-action" onclick="openImportDialog('new')">📄 导入论文</button>
      <button class="sidebar-quick-action" onclick="Nav.switchToolTab('buddy');Nav.toggleToolPanel()">🤖 论文搭子 (Ctrl+B)</button>
    </div>
  </aside>

  <!-- CENTER: Content -->
  <div class="content-panel" id="contentPanel">
    <div class="content-toolbar">
      <span class="content-toolbar-title" id="contentTitle">准备</span>
      <span class="content-toolbar-breadcrumb" id="contentBreadcrumb">
        <span onclick="Nav.navigate('prepare')" style="cursor:pointer">论文搭子</span>
        <span style="color:var(--text-muted)">/</span>
        <span>准备</span>
      </span>
      <div class="content-toolbar-actions">
        <button class="btn-ghost btn-sm" onclick="openImportDialog('replace')">导入论文</button>
        <button class="btn-ghost btn-sm" onclick="openFullPaperPreview()">预览</button>
        <button class="btn-ghost btn-sm" onclick="showDashboard()">看板</button>
      </div>
    </div>
    <div class="content-body" id="contentBody"></div>
    <div class="skeleton-full" id="thesisSkeleton" style="display:none"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-block"></div></div>
  </div>

  <!-- RIGHT: Tool Panel -->
  <div class="tool-panel" id="toolPanel">
    <div class="tool-panel-header">
      <div class="tool-panel-tabs" id="toolPanelTabs">
        <button class="tool-panel-tab active" data-tab="references" onclick="Nav.switchToolTab('references')">📚 文献</button>
        <button class="tool-panel-tab" data-tab="buddy" onclick="Nav.switchToolTab('buddy')">🤖 搭子</button>
        <button class="tool-panel-tab" data-tab="inspect" onclick="Nav.switchToolTab('inspect')">🔍 检查</button>
        <button class="tool-panel-tab" data-tab="review" onclick="Nav.switchToolTab('review')">💬 审阅</button>
      </div>
      <button class="btn-icon" onclick="Nav.toggleToolPanel()" title="收起面板">◀</button>
    </div>
    <div class="tool-panel-body" id="toolPanelBody"></div>
  </div>
</div>'''

html = html.replace(old_main, new_main)

# === 4. Remove old floating cmd-fab ===
html = html.replace(
    '''<!-- 浮动命令面板按钮 -->
<div class="cmd-fab" id="cmdFab" onclick="_openCommandPalette()" title="搜索功能 (Ctrl+K)">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
</div>''', '')

# === 5. Update command palette HTML (use new classes) ===
old_cmd_html = '''<div class="cmd-overlay" id="cmdOverlay" style="display:none" onclick="_closeCommandPalette()">
  <div class="cmd-palette" onclick="event.stopPropagation()">
    <div class="cmd-head">
      <span style="font-weight:700;font-size:14px">⚡ 论文搭子</span>
      <button onclick="_closeCommandPalette()" style="border:none;background:none;font-size:18px;cursor:pointer;color:#94a3b8">&times;</button>
    </div>
    <input type="text" id="cmdSearch" class="cmd-input" placeholder="搜索功能...（选题/查错/降重/PPT...）" oninput="_filterCommandPalette()">
    <div class="cmd-results" id="cmdResults"></div>
    <div class="cmd-foot">
      <span>↑↓ 选择 · Enter 打开 · Esc 关闭</span>
      <span><button class="nav-quick-btn" onclick="openIdeaWizard();_closeCommandPalette()" style="font-size:11px">💡 从想法开始</button><button class="nav-quick-btn" onclick="openImportDialog('new');_closeCommandPalette()" style="font-size:11px;margin-left:4px">📎 导入论文</button></span>
    </div>
  </div>
</div>'''

new_cmd_html = '''<div class="cmd-overlay hidden" id="cmdOverlay" onclick="_closeCommandPalette()">
  <div class="cmd-palette" onclick="event.stopPropagation()">
    <div class="cmd-palette-header">
      <span>⚡ 论文搭子</span>
      <button class="modal-close" onclick="_closeCommandPalette()">&times;</button>
    </div>
    <input type="text" id="cmdSearch" class="cmd-input" placeholder="搜索功能..." oninput="CommandPalette.filter(this.value)">
    <div class="cmd-results" id="cmdResults"></div>
    <div class="cmd-footer">
      <span>↑↓ 选择 · Enter 打开 · Esc 关闭</span>
      <div>
        <button onclick="openIdeaWizard();CommandPalette.close()">💡 从想法开始</button>
        <button onclick="openImportDialog('new');CommandPalette.close()">📎 导入论文</button>
      </div>
    </div>
  </div>
</div>'''

html = html.replace(old_cmd_html, new_cmd_html)

# === 6. Remove old buddy tools and buddy drawer (moved to sidebar + tool panel) ===
html = re.sub(r'<div class="buddy-tools" id="buddyTools"[^>]*>.*?</div>', '', html, flags=re.DOTALL)
html = re.sub(r'<div class="buddy-backdrop" id="buddyBackdrop"[^>]*></div>', '', html, flags=re.DOTALL)
html = re.sub(r'<aside class="buddy-drawer" id="buddyDrawer"[^>]*>.*?</aside>', '', html, flags=re.DOTALL)

# === 7. Fix script loading order ===
old_scripts = '''<script defer src="js/modules/project.js?v=90"></script>

<!-- ====== 新统一模块 ====== -->
<script defer src="js/modules/ideation.js?v=91"></script>
<script defer src="js/modules/health-check.js?v=91"></script>
<script defer src="js/modules/buddy-assistant.js?v=91"></script>'''

new_scripts = '''<script defer src="js/modules/project.js?v=90"></script>
<script defer src="js/modules/ideation.js?v=91"></script>
<script defer src="js/modules/health-check.js?v=91"></script>
<script defer src="js/modules/buddy-assistant.js?v=91"></script>'''

# Remove duplicate featree.js (first occurrence near line 520)
html = re.sub(r'\s*<script defer src="js/core/featree\.js\?v=90"></script>\s*', '\n', html, count=1)

# Remove duplicate featree.js (second occurrence near line 551)
html = re.sub(r'\s*<script defer src="js/core/featree\.js\?v=90"></script>\s*', '\n', html, count=1)

# Remove old app.js at root (line 505 area)
html = re.sub(r'\s*<script defer src="app\.js\?v=90"></script>\s*', '\n', html)

# Add new core scripts in correct order before the module imports
core_insert = '''
<!-- ====== Core Infrastructure ====== -->
<script defer src="js/core/utils.js?v=91"></script>
<script defer src="js/core/api.js?v=91"></script>
<script defer src="js/core/state.js?v=91"></script>
<script defer src="js/core/events.js?v=91"></script>
<script defer src="js/core/ui.js?v=91"></script>
<script defer src="js/core/doc.js?v=91"></script>
<script defer src="js/core/senttools.js?v=91"></script>
<script defer src="js/core/auditor.js?v=91"></script>
<script defer src="js/core/command-palette.js?v=2"></script>
<script defer src="js/core/nav.js?v=2"></script>
'''

# Insert after the close of the old core section
html = html.replace(
    '<script defer src="js/core/auditor.js?v=91"></script>',
    '<script defer src="js/core/auditor.js?v=91"></script>\n<script defer src="js/core/command-palette.js?v=2"></script>\n<script defer src="js/core/nav.js?v=2"></script>')

# Add Nav.init() call on DOMContentLoaded
if 'Nav.init()' not in html:
    html = html.replace(
        'window.addEventListener(\'DOMContentLoaded\',function(){',
        'window.addEventListener(\'DOMContentLoaded\',function(){\n  if (typeof Nav !== \'undefined\' && Nav.init) Nav.init();')

# === 8. Add helper CSS class for btn-ghost + btn-sm combo ===
style_css = '''/* Shell compatibility helpers for old app.js references */
#thesisBox { flex: 1; overflow-y: auto; padding: var(--space-4); min-height: 0; }
.bar-mini { font-size: var(--text-xs); padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-card); color: var(--text-secondary); cursor: pointer; }
.bar-mini:hover { background: var(--surface-alt); border-color: var(--border-strong); }
.btn-ghost.btn-sm { padding: 5px 10px; font-size: var(--text-xs); border-radius: var(--radius-sm); background: transparent; color: var(--text-secondary); border: 1px solid var(--border); cursor: pointer; }
.btn-ghost.btn-sm:hover { background: var(--surface-alt); }'''

with open(os.path.join(base, 'css/style.css'), 'a', encoding='utf-8') as f:
    f.write('\n' + style_css)

print("=== HTML structural rewrite complete ===")
print("Changes made:")
print("1. CSS links updated to new architecture")
print("2. Topbar rewritten (.bar -> .topbar)")
print("3. Main layout rewritten (3-column IDE)")
print("4. Command palette HTML updated")
print("5. Old cmd-fab, buddy-drawer, buddy-tools removed")
print("6. featree.js duplicates removed")
print("7. nav.js + command-palette.js added to script order")
print("8. Nav.init() added to DOMContentLoaded")
print("9. Backward-compat CSS helpers added to style.css")
