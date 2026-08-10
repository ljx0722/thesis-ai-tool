"""Apply ALL fixes to index.html in one pass."""
import re

PATH = r"e:\同济学习\毕业论文\论文文献AI利器\index.html"
with open(PATH, "r", encoding="utf-8") as f:
    html = f.read()

before = len(html)
changes = []

def apply(label, fn):
    global html
    fn()
    changes.append(label)

# 1. Close appShell
apply("close appShell", lambda: exec("global html; html = html.replace('</body></html>', '</div>\\n</body></html>')"))

# 2. Nav.init()
old = "window.addEventListener('DOMContentLoaded',function(){"
new = "window.addEventListener('DOMContentLoaded',function(){\n  if (typeof Nav !== 'undefined' && Nav.init) Nav.init();"
if old in html and 'Nav.init()' not in html:
    apply("Nav.init()", lambda: exec("global html; html = html.replace(old, new)"))

# 3. Quill CSS
if 'quill.snow.css' not in html:
    quill_css = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css">'
    m = '<link rel="stylesheet" href="css/modules/writing.css?v=2">'
    apply("Quill CSS", lambda: exec("global html; html = html.replace(m, m + '\\n' + quill_css)"))

# 4. openAccountModal/closeAccountModal wrappers
compat = """window.openAccountModal = function(title, htmlContent) {
  document.getElementById('accountModalMask') || (
    function() { var d = document.createElement('div'); d.id = 'accountModalMask'; d.className = 'modal-overlay hidden'; d.style.display = 'none'; d.innerHTML = '<div class=\"modal-card\" style=\"max-width:640px;max-height:88vh;overflow:auto\" onclick=\"event.stopPropagation()\"><div class=\"modal-header\"><span class=\"modal-header-title\">' + title + '</span><button class=\"modal-close\" onclick=\"document.getElementById(\\'accountModalMask\\').style.display=\\'none\\'\">&times;</button></div><div class=\"modal-body\">' + htmlContent + '</div></div>'; d.onclick = function(e) { if(e.target===d) d.style.display='none'; }; document.body.appendChild(d); return d; }()
  );
  var m = document.getElementById('accountModalMask');
  var titleEl = m.querySelector('.modal-header-title');
  if (titleEl) titleEl.textContent = title || '';
  var bodyEl = m.querySelector('.modal-body');
  if (bodyEl) bodyEl.innerHTML = htmlContent || '';
  m.style.display = 'flex';
};
window.closeAccountModal = function() {
  var m = document.getElementById('accountModalMask');
  if (m) m.style.display = 'none';
};
"""
marker = "window.showPricingInfo = function(){"
if marker in html and 'window.openAccountModal' not in html:
    apply("openAccountModal", lambda: exec("global html; html = html.replace(marker, compat + '\\n' + marker)"))

# 5. Delete dead loadConsumptionHistory
start = html.find('window.loadConsumptionHistory = function(')
if start >= 0:
    line_start = html.rfind('\n', 0, start) + 1
    brace_count = html[start:].find('{')
    depth = 1
    pos = start + brace_count + 1
    while depth > 0 and pos < len(html):
        if html[pos] == '{': depth += 1
        elif html[pos] == '}': depth -= 1
        pos += 1
    end = pos + 1 if pos < len(html) and html[pos] == '\n' else pos
    html = html[:line_start] + html[end:]
    apply("delete loadConsumptionHistory", lambda: None)

# 6. Keyboard hint
old_hint = "Ctrl+1~6 切换模块 | Ctrl+Enter 检索 | Ctrl+O 换论文 | Esc 关闭弹窗"
new_hint = "Ctrl+K 搜索功能 | Ctrl+B 召唤论文搭子"
if old_hint in html:
    apply("keyboard hint", lambda: exec("global html; html = html.replace(old_hint, new_hint)"))

# 7. Remove dead compat divs
for did in ['tocPanel', 'thesisPanel', 'barTabs', 'navFeatureTree', 'cmdFab']:
    pat = re.compile(r'\s*<div id="' + did + r'" style="display:none"></div>\n?')
    html, n = pat.subn('', html)
    if n > 0:
        apply(f"remove #{did}", lambda: None)

# 8. Status bar element
old_sb = '<span id="statusBar" style="display:none"></span>'
new_sb = '<div class="status-bar" id="statusBar" style="display:none"></div>'
if old_sb in html:
    apply("status bar", lambda: exec("global html; html = html.replace(old_sb, new_sb)"))

# 9. Notification panel already has class .notify-panel (verify)
if 'class="notify-panel"' in html:
    apply("notify panel CSS class", lambda: None)

# 10. Changelog panel
cp_start = html.find('id="changelogPanel" style="display:none;position:fixed')
if cp_start >= 0:
    cp_end = html.find('</div>\n\n<div class="cmd-overlay hidden"', cp_start)
    if cp_end < 0:
        cp_end = html.find('</div>\n\n<!-- 命令面板覆盖层 -->', cp_start)
    if cp_end > cp_start:
        chunk = html[cp_start:cp_end]
        inner_start = chunk.find('>') + 1
        inner_end = chunk.rfind('</div>')
        inner = chunk[inner_start:inner_end]
        inner = re.sub(r'style="[^"]*"', '', inner)
        inner = re.sub(r'<b style="[^"]*">', '<b>', inner)
        inner = re.sub(r'<span onclick="[^"]*" style="[^"]*">', '<span>', inner)
        inner = re.sub(r'onmouseenter="[^"]*"', '', inner)
        inner = re.sub(r'onmouseleave="[^"]*"', '', inner)
        new_chunk = '<div id="changelogPanel" class="changelog-panel" style="display:none">\n  <div class="notify-header"><b>功能更新日志</b><button class="notify-close" onclick="document.getElementById(\'changelogPanel\').style.display=\'none\'">X</button></div>\n  <div class="changelog-list">\n' + inner.strip() + '\n  </div>\n</div>'
        html = html[:cp_start] + new_chunk + html[cp_end:]
        apply("changelog panel", lambda: None)

# 11-12. ARIA on login inputs
old_inp = '<input type="text" id="loginUsername" placeholder="用户名" autocomplete="username" autofocus>'
if old_inp in html and 'aria-required' not in html:
    html = html.replace(old_inp, '<input type="text" id="loginUsername" placeholder="用户名" autocomplete="username" autofocus aria-required="true">')
    html = html.replace('<input type="password" id="loginPassword" placeholder="密码" autocomplete="current-password">',
                        '<input type="password" id="loginPassword" placeholder="密码" autocomplete="current-password" aria-required="true">')
    apply("ARIA login", lambda: None)

# 13. ARIA tool panel tabs
if 'role="tablist"' not in html:
    html = html.replace('id="toolPanelTabs"', 'id="toolPanelTabs" role="tablist"')
    html = html.replace('class="tool-panel-tab active" data-tab="references"', 'class="tool-panel-tab active" data-tab="references" role="tab" aria-selected="true"')
    html = html.replace('data-tab="buddy" onclick', 'data-tab="buddy" role="tab" aria-selected="false" onclick')
    html = html.replace('data-tab="inspect" onclick', 'data-tab="inspect" role="tab" aria-selected="false" onclick')
    html = html.replace('data-tab="review" onclick', 'data-tab="review" role="tab" aria-selected="false" onclick')
    apply("ARIA tool panel", lambda: None)

# 14. Search accessibility
old_s = '<input type="text" class="global-search-input" placeholder="搜索全部功能..." readonly onfocus="this.blur();_openCommandPalette()">'
new_s = '<input type="text" class="global-search-input" placeholder="搜索全部功能... (Ctrl+K)" role="searchbox" aria-label="搜索功能" onfocus="_openCommandPalette()">'
if old_s in html:
    html = html.replace(old_s, new_s)
    apply("search accessibility", lambda: None)

# 15. Breadcrumb buttons
old_bc = '<span onclick="Nav.navigate(\'prepare\')" style="cursor:pointer">论文搭子</span>'
new_bc = '<button class="breadcrumb-link" onclick="Nav.navigate(\'prepare\')">论文搭子</button>'
if old_bc in html:
    html = html.replace(old_bc, new_bc)
    apply("breadcrumb button", lambda: None)

after = len(html)
with open(PATH, "w", encoding="utf-8") as f:
    f.write(html)

print(f"Applied {len(changes)} changes ({after - before:+d} bytes):")
for i, c in enumerate(changes, 1):
    print(f"  {i}. {c}")
