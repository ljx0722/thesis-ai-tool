import os
path = 'e:/同济学习/毕业论文/论文文献AI利器/tests/run.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

fixes = 0

# Fix 1: required HTML IDs
old1 = """['tocPanel', 'thesisPanel', 'stageNav', 'fileInput',
    'statusBar', 'loadOv', 'barTabs', 'kgOverlay',
    'appShell', 'notifyPanel', 'loginOverlay', 'balanceBar',
    'cmdFab', 'cmdOverlay', 'cmdSearch']"""
new1 = """['sidebar', 'contentPanel', 'toolPanel', 'fileInput',
    'statusBar', 'loadOv', 'kgOverlay',
    'appShell', 'notifyPanel', 'loginOverlay', 'balanceBar',
    'cmdOverlay', 'cmdSearch']"""
if old1 in c:
    c = c.replace(old1, new1)
    fixes += 1

# Fix 2: 4-column layout test
old2 = """assert(html.indexOf('id="tocPanel"') >= 0, 'toc column missing');
    assert(html.indexOf('id="toolHome"') >= 0, 'tool home missing');
    assert(html.indexOf('toolboxFavorites') >= 0, 'toolbox missing');"""
new2 = """assert(html.indexOf('id="sidebar"') >= 0, 'sidebar column missing');
    assert(html.indexOf('id="toolPanel"') >= 0, 'tool panel missing');
    assert(html.indexOf('sidebar-milestone') >= 0, 'milestones missing');"""
if old2 in c:
    c = c.replace(old2, new2)
    fixes += 1

# Fix 3: TOC wrap test
old3 = """assert(html.indexOf('tocPanel') >= 0 || html.indexOf('nav-tree') >= 0, 'toc area missing');
    assert(html.indexOf('toolboxFavorites') >= 0 || html.indexOf('toolHome') >= 0, 'toolbox/tool home missing');"""
new3 = """assert(html.indexOf('sidebar-tree') >= 0 || html.indexOf('navTree') >= 0, 'tree area missing');
    assert(html.indexOf('tool-panel-tab') >= 0 || html.indexOf('toolPanel') >= 0, 'tool panel missing');"""
if old3 in c:
    c = c.replace(old3, new3)
    fixes += 1

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print(f'{fixes} fixes applied')
