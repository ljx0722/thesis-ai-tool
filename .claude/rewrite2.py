#!/usr/bin/env python3
"""Rewrite index.html: new layout, CSS links, JS scripts."""
import re

PATH = "e:/同济学习/毕业论文/论文文献AI利器/index.html"
with open(PATH, "r", encoding="utf-8") as f:
    html = f.read()

changes = 0

# 1: CSS links
old_css = '<link rel="stylesheet" href="css/base.css?v=91">\n<link rel="stylesheet" href="css/style.css?v=90">\n<link rel="stylesheet" href="css/shell.css?v=90">\n<link rel="stylesheet" href="css/components.css?v=90">'
new_css = '<link rel="stylesheet" href="css/tokens.css?v=2">\n<link rel="stylesheet" href="css/reset.css?v=2">\n<link rel="stylesheet" href="css/base.css?v=2">\n<link rel="stylesheet" href="css/shell.css?v=2">\n<link rel="stylesheet" href="css/components.css?v=2">\n<link rel="stylesheet" href="css/style.css?v=2">\n<link rel="stylesheet" href="css/citely.css?v=2">'
if old_css in html:
    html = html.replace(old_css, new_css)
    changes += 1
    print("1. CSS links updated")

# 2: Old bar → new topbar
# Find old bar start and end
bar_start = html.find('<div class="bar">')
changelog_comment = '<!-- ====== \u66f4\u65b0\u65e5\u5fd7\u6309\u94ae ====== -->'
bar_end = html.find(changelog_comment)
if bar_start >= 0 and bar_end > bar_start:
    new_bar = '<header class="topbar">\n  <div class="topbar-left">\n    <span class="topbar-brand">\u8bba\u6587\u642d\u5b50 <span>ThesisBuddy</span></span>\n    <button id="projectTitleChip" class="project-chip" onclick="openIdeaWizard()" title="\u521b\u5efa\u6216\u67e5\u770b\u9879\u76ee">\u672a\u521b\u5efa\u9879\u76ee</button>\n  </div>\n  <div class="topbar-center">\n    <div class="global-search" onclick="_openCommandPalette()" title="\u641c\u7d22\u529f\u80fd (Ctrl+K)">\n      <svg class="global-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>\n      <input type="text" class="global-search-input" placeholder="\u641c\u7d22\u5168\u90e8\u529f\u80fd..." readonly onfocus="this.blur();_openCommandPalette()">\n      <kbd class="global-search-kbd">Ctrl+K</kbd>\n    </div>\n  </div>\n  <div class="topbar-right">\n    <span class="topbar-balance" id="balanceBar" onclick="showRechargeModal()" title="\u70b9\u51fb\u5145\u503c">\u2728 <strong id="balanceAmount">0.000</strong> \u70b9</span>\n    <button class="topbar-icon-btn" id="notifyBellBtn" onclick="toggleNotifyPanel()" title="\u6d88\u606f\u4e2d\u5fc3" style="position:relative">\U0001f514<span id="notifyBadge" class="topbar-badge" style="display:none">0</span></button>\n    <div class="bar-account-menu" style="position:relative">\n      <button class="topbar-icon-btn" onclick="toggleAccountMenu()" title="\u8d26\u6237\u83dc\u5355">\u8d26\u6237 \u25be</button>\n      <div class="topbar-dropdown" id="accountDropdown" style="display:none">\n        <button onclick="openAccountCenter();toggleAccountMenu()">\u8d26\u6237\u4e2d\u5fc3</button>\n        <button onclick="showConsumptionHistory();toggleAccountMenu()">\u6d88\u8d39\u660e\u7ec6</button>\n        <button onclick="showPricingInfo();toggleAccountMenu()">\u4f7f\u7528\u8bf4\u660e</button>\n        <button onclick="toggleChangelog();toggleAccountMenu()">\u66f4\u65b0\u65e5\u5fd7</button>\n        <hr>\n        <button onclick="doLogout()" style="color:var(--danger)">\u767b\u51fa</button>\n      </div>\n    </div>\n    <button class="topbar-icon-btn" id="adminPanelBtn" onclick="window.location.href=\'/admin.html\'" style="background:rgba(99,102,241,.15);color:#c7d2fe;display:none" title="\u7ba1\u7406\u5458\u770b\u677f">\u2699\ufe0f</button>\n  </div>\n</header>\n'
    html = html[:bar_start] + new_bar + html[bar_end:]
    changes += 1
    print("2. Topbar replaced")

# 3: Old main layout → new 3-column
main_start = html.find('<div class="main" id="mainLayout">')
cmd_fab_marker = '<!-- \u6d6e\u52a8\u547d\u4ee4\u9762\u677f\u6309\u94ae -->'
main_end = html.find(cmd_fab_marker)
if main_start >= 0 and main_end > main_start:
    new_main = '<div class="main-layout" id="mainLayout">\n  <aside class="sidebar" id="sidebar">\n    <div class="sidebar-header">\n      <span class="sidebar-project-name" id="sidebarProjectName">\u8bba\u6587\u642d\u5b50</span>\n    </div>\n    <nav class="sidebar-milestones" role="navigation" aria-label="\u8bba\u6587\u9636\u6bb5">\n      <button class="sidebar-milestone active" data-milestone="prepare" onclick="Nav.navigate(\'prepare\')"><span class="sidebar-milestone-icon">1</span> \u51c6\u5907</button>\n      <button class="sidebar-milestone" data-milestone="writing" onclick="Nav.navigate(\'writing\')"><span class="sidebar-milestone-icon">2</span> \u5199\u4f5c</button>\n      <button class="sidebar-milestone" data-milestone="polish" onclick="Nav.navigate(\'polish\')"><span class="sidebar-milestone-icon">3</span> \u6253\u78e8</button>\n      <button class="sidebar-milestone" data-milestone="finish" onclick="Nav.navigate(\'finish\')"><span class="sidebar-milestone-icon">4</span> \u6536\u5c3e</button>\n    </nav>\n    <div class="sidebar-tree" id="navTree">\n      <div class="sidebar-tree-empty" id="navTreeMeta">\u5bfc\u5165\u8bba\u6587\u540e\u663e\u793a\u7ae0\u8282</div>\n    </div>\n    <div class="sidebar-footer">\n      <button class="sidebar-quick-action" onclick="openIdeaWizard()">\U0001f4a1 \u4ece\u60f3\u6cd5\u5f00\u59cb</button>\n      <button class="sidebar-quick-action" onclick="openImportDialog(\'new\')">\U0001f4c4 \u5bfc\u5165\u8bba\u6587</button>\n      <button class="sidebar-quick-action" onclick="Nav.switchToolTab(\'buddy\');Nav.toggleToolPanel()">\U0001f916 \u8bba\u6587\u642d\u5b50 (Ctrl+B)</button>\n    </div>\n  </aside>\n  <div class="content-panel" id="contentPanel">\n    <div class="content-toolbar">\n      <span class="content-toolbar-title" id="contentTitle">\u51c6\u5907</span>\n      <span class="content-toolbar-breadcrumb" id="contentBreadcrumb"><span onclick="Nav.navigate(\'prepare\')" style="cursor:pointer">\u8bba\u6587\u642d\u5b50</span><span style="color:var(--text-muted)">/</span><span>\u51c6\u5907</span></span>\n      <div class="content-toolbar-actions">\n        <button class="btn-ghost btn-sm" onclick="openImportDialog(\'replace\')">\u5bfc\u5165\u8bba\u6587</button>\n        <button class="btn-ghost btn-sm" onclick="openFullPaperPreview()">\u9884\u89c8</button>\n        <button class="btn-ghost btn-sm" onclick="showDashboard()">\u770b\u677f</button>\n      </div>\n    </div>\n    <div class="content-body" id="contentBody"></div>\n    <div class="skeleton-full" id="thesisSkeleton" style="display:none"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-block"></div></div>\n  </div>\n  <div class="tool-panel" id="toolPanel">\n    <div class="tool-panel-header">\n      <div class="tool-panel-tabs" id="toolPanelTabs">\n        <button class="tool-panel-tab active" data-tab="references" onclick="Nav.switchToolTab(\'references\')">\U0001f4da \u6587\u732e</button>\n        <button class="tool-panel-tab" data-tab="buddy" onclick="Nav.switchToolTab(\'buddy\')">\U0001f916 \u642d\u5b50</button>\n        <button class="tool-panel-tab" data-tab="inspect" onclick="Nav.switchToolTab(\'inspect\')">\U0001f50d \u68c0\u67e5</button>\n        <button class="tool-panel-tab" data-tab="review" onclick="Nav.switchToolTab(\'review\')">\U0001f4ac \u5ba1\u9605</button>\n      </div>\n      <button class="btn-icon" onclick="Nav.toggleToolPanel()" title="\u6536\u8d77\u9762\u677f">\u25c0</button>\n    </div>\n    <div class="tool-panel-body" id="toolPanelBody"></div>\n  </div>\n</div>\n'
    html = html[:main_start] + new_main + html[main_end:]
    changes += 1
    print("3. Main layout replaced")

# 4: Remove old cmd-fab
fab_marker = '<!-- \u6d6e\u52a8\u547d\u4ee4\u9762\u677f\u6309\u94ae -->'
fab_start = html.find(fab_marker)
if fab_start >= 0:
    # Find the end of the cmd-fab div
    fab_close = html.find('</div>\n\n<!--', fab_start)
    if fab_close < 0:
        fab_close = html.find('</div>\n<!--', fab_start)
    if fab_close > fab_start:
        fab_end = html.find('>', fab_close) + 1
        cmd_overlay_found = html.find('<!-- \u547d\u4ee4\u9762\u677f\u8986\u76d6\u5c42 -->', fab_start)
        if cmd_overlay_found < 0:
            cmd_overlay_found = html.find('cmd-overlay', fab_start)
        # Find the right cut point
        cut = fab_start
        while cut > 0 and html[cut] != '\n':
            cut -= 1
        if html[cut] == '\n':
            fab_start_clean = cut
        else:
            fab_start_clean = fab_start
        html = html[:fab_start_clean] + html[fab_end:]
        changes += 1
        print("4. Old cmd-fab removed")

# 5: Update command palette overlay HTML
cmd_ov_start = html.find('<div class="cmd-overlay" id="cmdOverlay"')
if cmd_ov_start >= 0:
    cmd_script_start = html.find('<!-- \u547d\u4ee4\u9762\u677f\u811a\u672c -->', cmd_ov_start)
    if cmd_script_start > cmd_ov_start:
        html = html[:cmd_ov_start] + html[cmd_script_start:]
        changes += 1
        print("5. Old inline command palette + script removed")

# 6: Remove featree.js
featree_before = html.count('featree.js')
html = re.sub(r'\s*<script defer src="js/core/featree\.js\?v=90"></script>', '', html)
if html.count('featree.js') < featree_before:
    changes += 1
    print(f"6. featree.js removed ({featree_before} -> {html.count('featree.js')})")

# 7: Add nav.js + command-palette.js
if 'nav.js' not in html:
    html = html.replace(
        '<script defer src="js/core/auditor.js?v=91"></script>',
        '<script defer src="js/core/auditor.js?v=91"></script>\n<script defer src="js/core/command-palette.js?v=2"></script>\n<script defer src="js/core/nav.js?v=2"></script>')
    changes += 1
    print("7. nav.js + command-palette.js added")

# 8: Nav.init() in DOMContentLoaded
if 'Nav.init()' not in html:
    html = html.replace(
        "window.addEventListener('DOMContentLoaded',function(){",
        "window.addEventListener('DOMContentLoaded',function(){\n  if (typeof Nav !== 'undefined' && Nav.init) Nav.init();")
    changes += 1
    print("8. Nav.init() added")

# 9: Remove old buddy-tools and buddy-drawer
buddy_tools_idx = html.find('<div class="buddy-tools"')
if buddy_tools_idx >= 0:
    theme_studio_idx = html.find('<div class="theme-studio-backdrop"', buddy_tools_idx)
    if theme_studio_idx > buddy_tools_idx:
        html = html[:buddy_tools_idx] + html[theme_studio_idx:]
        changes += 1
        print("9. Old buddy-tools/drawer removed")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(html)

print(f"\nDone! {changes} changes applied.")
