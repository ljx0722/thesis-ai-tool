path = 'e:/同济学习/毕业论文/论文文献AI利器/tests/run.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

fixes = 0

# Fix: toc column / tool home (2-space indent)
search = "assert(html.indexOf('id=\"tocPanel\"') >= 0, 'toc column missing');"
if search in c:
    replacement = "assert(html.indexOf('id=\"sidebar\"') >= 0, 'sidebar column missing');"
    c = c.replace(search, replacement)
    fixes += 1

search = "assert(html.indexOf('id=\"toolHome\"') >= 0, 'tool home missing');"
if search in c:
    replacement = "assert(html.indexOf('id=\"toolPanel\"') >= 0, 'tool panel missing');"
    c = c.replace(search, replacement)
    fixes += 1

search = "assert(html.indexOf('toolboxFavorites') >= 0, 'toolbox missing');"
if search in c:
    replacement = "assert(html.indexOf('sidebar-milestone') >= 0, 'milestones missing');"
    c = c.replace(search, replacement)
    fixes += 1

# Fix: toc area / toolbox
search = "assert(html.indexOf('tocPanel') >= 0 || html.indexOf('nav-tree') >= 0, 'toc area missing');"
if search in c:
    replacement = "assert(html.indexOf('sidebar-tree') >= 0 || html.indexOf('navTree') >= 0, 'tree area missing');"
    c = c.replace(search, replacement)
    fixes += 1

search = "assert(html.indexOf('toolboxFavorites') >= 0 || html.indexOf('toolHome') >= 0, 'toolbox/tool home missing');"
if search in c:
    replacement = "assert(html.indexOf('tool-panel-tab') >= 0 || html.indexOf('toolPanel') >= 0, 'tool panel missing');"
    c = c.replace(search, replacement)
    fixes += 1

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print(f'{fixes} individual fixes applied')
