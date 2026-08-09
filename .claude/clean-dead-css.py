#!/usr/bin/env python3
"""Remove all CSS rules targeting dead HTML classes from style.css."""
import re

PATH = r"e:\同济学习\毕业论文\论文文献AI利器\css\style.css"
with open(PATH, "r", encoding="utf-8") as f:
    css = f.read()

DEAD = r'\.bar\b|\.bar-left\b|\.bar-tabs\b|\.bar-actions\b|\.nav-sidebar\b|\.toc-panel\b|\.thesis-panel\b|\.thesis-bar\b|\.thesis-bar-actions\b|\.help-btn\b|\.module-tabs\b'

removed = 0

# Pass 1: Remove entire declaration blocks where ALL selectors reference dead classes
# Match: dead-selector-only {...}  (possibly with comma-separated dead selectors)
dead_only = re.compile(
    r'^(\s*)((?:' + DEAD + r'|,[ \n]*' + DEAD + r')+)\s*\{[^}]*\}\n',
    re.MULTILINE | re.DOTALL
)
css, n = dead_only.subn('', css)
removed += n
print(f"Pass 1 (dead-only blocks): {n} removed")

# Pass 2: Remove lines that are pure dead-class references from grouped selectors.
# A grouped selector like ".bar, .thesis-bar, .nav-sidebar, .ref-panel" →
# remove the dead parts, keep ".ref-panel"
def clean_grouped(m):
    text = m.group(0)
    parts = [p.strip() for p in text.split(',')]
    alive = [p for p in parts if not re.search(DEAD, p)]
    if not alive:
        return ''
    return ', '.join(alive)

# Match selectors with commas at the start of declaration blocks
grouped = re.compile(
    r'(^[^{,\n]*?(?:' + DEAD + r')[^{,\n]*?)((?:,\s*[^{,\n]*?)*)\s*(\{[^}]*\})',
    re.MULTILINE
)

css, n2 = grouped.subn(lambda m: clean_grouped(m.group(1) + m.group(2)) + ' ' + m.group(3) if any(p.strip() and not re.search(DEAD, p.strip()) for p in (m.group(1) + m.group(2)).split(',')) else '', css)
removed += n2

# Actually the grouped regex is too complex. Let me do a simpler approach:
# Process line by line, removing dead class references from comma-separated selectors
lines = css.split('\n')
new_lines = []
for line in lines:
    stripped = line.strip()
    # Skip non-selector lines
    if not stripped or stripped.startswith('/*') or stripped.startswith('//') or stripped.startswith('}') or stripped.startswith('@') or '{' not in stripped:
        new_lines.append(line)
        continue

    # Split selector from body
    if '{' in stripped:
        selector_part = stripped[:stripped.index('{')].strip()
        body_part = stripped[stripped.index('{'):]

        parts = [p.strip() for p in selector_part.split(',')]
        alive_parts = [p for p in parts if not re.search(DEAD, p)]

        if not alive_parts:
            # All dead - skip this line
            removed += 1
            continue
        elif len(alive_parts) != len(parts):
            # Some dead parts removed - reconstruct
            new_line = ', '.join(alive_parts) + ' ' + body_part
            line_indent = line[:len(line) - len(line.lstrip())]
            new_lines.append(line_indent + new_line)
            removed += 1
            continue

    new_lines.append(line)

css = '\n'.join(new_lines)
print(f"Pass 3 (line-by-line): {removed - n - n2} cleaned")

# Also clean empty lines (3+ consecutive newlines → 2)
css = re.sub(r'\n{3,}', '\n\n', css)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(css)

# Verify
with open(PATH, "r", encoding="utf-8") as f:
    v = f.read()
for cls in ['\\.bar\\b', '\\.bar-left', '\\.bar-tabs', '\\.bar-actions', '\\.nav-sidebar', '\\.toc-panel', '\\.thesis-panel', '\\.thesis-bar', '\\.help-btn', '\\.module-tabs']:
    count = len(re.findall(cls, v))
    if count > 0:
        print(f"  REMAINING: {cls}: {count}")
    else:
        print(f"  CLEAN: {cls}")

print(f"\nTotal removed: {removed}")
print(f"Lines: {len(v.split(chr(10)))}")
