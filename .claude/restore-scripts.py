#!/usr/bin/env python3
"""Restore script tags to index.html and fix CSS variable compatibility."""
import re

PATH = "e:/同济学习/毕业论文/论文文献AI利器/index.html"

with open(PATH, "r", encoding="utf-8") as f:
    html = f.read()

# ---- 1. Restore all script tags ----
# The original 43 script tags, minus featree.js duplicates, plus new modules
JS_TAGS = [
    # CDN
    '<script defer src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>',
    '<script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>',
    '<script defer src="https://cdn.jsdelivr.net/npm/simple-statistics@7.8.0/dist/simple-statistics.min.js"></script>',
    '<script defer src="https://cdn.jsdelivr.net/npm/diff-match-patch@1.0.5/index.js"></script>',
    '<script defer src="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js"></script>',
    # Core infrastructure
    '<script defer src="js/core/utils.js?v=91"></script>',
    '<script defer src="js/core/api.js?v=91"></script>',
    '<script defer src="js/core/state.js?v=91"></script>',
    '<script defer src="js/core/events.js?v=91"></script>',
    '<script defer src="js/core/ui.js?v=91"></script>',
    '<script defer src="js/core/doc.js?v=91"></script>',
    '<script defer src="js/core/senttools.js?v=91"></script>',
    '<script defer src="js/core/auditor.js?v=91"></script>',
    '<script defer src="js/core/command-palette.js?v=2"></script>',
    '<script defer src="js/core/nav.js?v=2"></script>',
    # 3rd party
    '<script defer src="mammoth.browser.min.js?v=90"></script>',
    '<script defer src="jszip.min.js?v=90"></script>',
    # App core
    '<script defer src="app.js?v=90"></script>',
    '<script defer src="js/core/app.js?v=90"></script>',
    # New unified modules
    '<script defer src="js/modules/ideation.js?v=91"></script>',
    '<script defer src="js/modules/health-check.js?v=91"></script>',
    '<script defer src="js/modules/buddy-assistant.js?v=91"></script>',
    # Module system
    '<script defer src="js/modules/login/login.js?v=90"></script>',
    '<script defer src="js/modules/account/account.js?v=90"></script>',
    '<script defer src="js/modules/account/notifications.js?v=90"></script>',
    '<script defer src="js/modules/paper-import.js?v=90"></script>',
    '<script defer src="js/modules/project.js?v=90"></script>',
    # Feature modules
    '<script defer src="js/modules/citely.js?v=90"></script>',
    '<script defer src="js/modules/review/review.js?v=90"></script>',
    '<script defer src="js/modules/writing/writing.js?v=90"></script>',
    # Legacy modules (kept for backward compat)
    '<script defer src="js/modules/optimization.js?v=90"></script>',
    '<script defer src="js/modules/format-check.js?v=90"></script>',
    '<script defer src="js/modules/terminology.js?v=90"></script>',
    '<script defer src="js/modules/paragraph-analysis.js?v=90"></script>',
    '<script defer src="js/modules/dashboard.js?v=90"></script>',
    '<script defer src="js/modules/thesis-review.js?v=90"></script>',
    '<script defer src="js/modules/proposal.js?v=90"></script>',
    '<script defer src="js/modules/onboarding.js?v=90"></script>',
    '<script defer src="js/modules/topic-finder.js?v=90"></script>',
    '<script defer src="js/modules/proofread.js?v=90"></script>',
    '<script defer src="js/modules/de-duplicate.js?v=90"></script>',
    '<script defer src="js/modules/defense-ppt.js?v=90"></script>',
    '<script defer src="js/modules/en-abstract.js?v=90"></script>',
    '<script defer src="js/modules/literature-workbench.js?v=90"></script>',
    '<script defer src="js/modules/literature-search-modal.js?v=90"></script>',
    # App modules (last)
    '<script defer src="js/app-modules.js?v=90"></script>',
]

# Find insertion point: after the </div> closing appShell, before </body>
body_close = html.find("</body>")
if body_close < 0:
    print("ERROR: </body> not found")
else:
    tags_html = "\n" + "\n".join(JS_TAGS) + "\n"
    html = html[:body_close] + tags_html + html[body_close:]
    print(f"Inserted {len(JS_TAGS)} script tags before </body>")

# ---- 2. Fix the 7→4 grid column mismatch ----
html = html.replace(
    "grid-template-columns: repeat(7, minmax(0, 1fr))",
    "grid-template-columns: repeat(4, minmax(0, 1fr))")

# ---- 3. Fix the script open/close mismatch ----
# The login/register JS block is missing its opening <script> tag
# Find "// ====== 登录/注册逻辑 ======"
marker = "// ====== 登录/注册逻辑 ======"
idx = html.find(marker)
if idx >= 0:
    # Check if <script> is before it
    before = html[max(0, idx-200):idx]
    if "<script>" not in before[-100:]:
        # Missing script tag - add it
        # Find the line before the comment
        nl = html.rfind("\n", 0, idx)
        html = html[:nl+1] + "<script>\n" + html[nl+1:]
        print("Added missing <script> tag before login/register logic")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(html)

# Verify
with open(PATH, "r", encoding="utf-8") as f:
    v = f.read()
scripts = len(re.findall(r'<script[^>]*src="[^"]*"', v))
opens = len(re.findall(r'<script[^/]', v))
closes = len(re.findall(r'</script>', v))
print(f"Script src tags: {scripts}, <script> opens: {opens}, </script> closes: {closes}")
print(f"Script balance: {'OK' if opens == closes else 'MISMATCH'}")

# Also check critical elements
for eid in ["appShell", "loginOverlay", "cmdOverlay"]:
    print(f"  #{eid}: {'OK' if f'id=\"{eid}\"' in v else 'MISSING'}")
