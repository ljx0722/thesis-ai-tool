import os
path = 'e:/同济学习/毕业论文/论文文献AI利器/index.html'
with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

# Find the broken overlay and replace it
old_start = html.find('<!-- 命令面板覆盖层 -->')
old_end_marker = '// ====== 登录/注册逻辑 ======'
old_end = html.find(old_end_marker, old_start)
if old_end < 0:
    # Try to find the next script tag
    old_end = html.find('<script>', old_start + 500)
if old_end < 0:
    old_end = html.find('var TOKEN_KEY', old_start)

if old_start >= 0 and old_end > old_start:
    # Remove old broken block
    html = html[:old_start] + html[old_end:]

# Find the correct insertion point
marker = '<!-- 主题由账号级外观设置统一管理。 -->'
idx = html.find(marker)
if idx >= 0:
    nl = html.rfind('\n', 0, idx)

    overlay = '''<!-- 命令面板覆盖层 -->
<div class="cmd-overlay hidden" id="cmdOverlay" onclick="_closeCommandPalette()">
  <div class="cmd-palette" onclick="event.stopPropagation()">
    <div class="cmd-palette-header">
      <span>\u26a1 \u8bba\u6587\u642d\u5b50</span>
      <button class="modal-close" onclick="_closeCommandPalette()">&times;</button>
    </div>
    <input type="text" id="cmdSearch" class="cmd-input" placeholder="\u641c\u7d22\u529f\u80fd..." oninput="CommandPalette.filter(this.value)">
    <div class="cmd-results" id="cmdResults"></div>
    <div class="cmd-footer">
      <span>\u2191\u2193 \u9009\u62e9 \u00b7 Enter \u6253\u5f00 \u00b7 Esc \u5173\u95ed</span>
      <div>
        <button onclick="openIdeaWizard();CommandPalette.close()">\U0001f4a1 \u4ece\u60f3\u6cd5\u5f00\u59cb</button>
        <button onclick="openImportDialog('new');CommandPalette.close()">\U0001f4ce \u5bfc\u5165\u8bba\u6587</button>
      </div>
    </div>
  </div>
</div>
'''
    html = html[:nl] + '\n' + overlay + html[nl:]
    print('Inserted at', nl)

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)
print('Done')
