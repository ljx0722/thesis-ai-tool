#!/usr/bin/env python3
"""Add backward-compat null guards for old document.getElementById() calls."""
import re

FILES = [
    "js/app-modules.js",
    "js/core/app.js",
    "js/core/featree.js",
    "js/core/senttools.js",
    "js/core/auditor.js",
    "js/modules/format-check.js",
    "js/modules/optimization.js",
    "js/modules/paragraph-analysis.js",
    "js/modules/thesis-review.js",
    "js/modules/proofread.js",
    "js/modules/onboarding.js",
    "js/modules/project.js",
    "js/modules/review/review.js",
    "js/modules/dashboard.js",
]

BASE = "e:/同济学习/毕业论文/论文文献AI利器"
ELEMENTS = {
    "thesisBox": "contentBody",
    "workspaceContent": "contentBody",
    "toolHome": "toolPanelBody",
    "tocPanel": "sidebar",
    "statusBar": "contentBody",
    "barTabs": "sidebar",
    "thesisPanel": "contentPanel",
}

def add_null_guard(content, old_id, new_id):
    """Wrap getElementById(old_id) with null check and fallback."""
    pattern = rf"document\.getElementById\('{old_id}'\)"
    replacement = f"(document.getElementById('{old_id}') || document.getElementById('{new_id}'))"
    return content.replace(pattern, replacement)

patches = 0
for fname in FILES:
    path = f"{BASE}/{fname}"
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        continue

    original = content
    for old_id, new_id in ELEMENTS.items():
        content = add_null_guard(content, old_id, new_id)

    if content != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        patches += 1
        # Count changes
        for old_id in ELEMENTS:
            old_count = original.count(f"getElementById('{old_id}')")
            new_count = content.count(f"getElementById('{old_id}')")
            if old_count > new_count:
                print(f"  {fname}: {old_id} → {ELEMENTS[old_id]} ({new_count - old_count} changes)")

print(f"\n{patches} files patched")
