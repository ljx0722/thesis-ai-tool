"""Remove dead CSS class references from style.css — line-by-line."""
import re

PATH = r"e:\同济学习\毕业论文\论文文献AI利器\css\style.css"
with open(PATH, "r", encoding="utf-8") as f:
    css = f.read()

DEAD = r'\.bar\b|\.bar-left\b|\.bar-tabs\b|\.bar-actions\b|\.nav-sidebar\b|\.toc-panel\b|\.thesis-panel\b|\.thesis-bar\b|\.thesis-bar-actions\b|\.help-btn\b|\.module-tabs\b'

removed_blocks = 0
removed_lines = 0

# Pass 1: Remove entire blocks where ALL selectors are dead
block_pat = re.compile(
    r'^\s*((?:' + DEAD + r')(?:\s*,\s*(?:' + DEAD + r'))*)\s*\{[^}]*\}\s*\n?',
    re.MULTILINE
)
css, n = block_pat.subn('\n', css)
removed_blocks = n

# Pass 2: Line-by-line cleanup of grouped selectors
lines = css.split('\n')
result = []
for line in lines:
    if '{' not in line:
        result.append(line)
        continue

    sel, body = line.split('{', 1)
    sel = sel.strip()
    indent = line[:len(line) - len(line.lstrip())]

    if not sel:
        result.append(line)
        continue

    parts = [p.strip() for p in sel.split(',')]
    alive = [p for p in parts if not re.search(DEAD, p)]

    if not alive:
        removed_lines += 1
        continue  # skip entirely dead line

    if len(alive) != len(parts):
        removed_lines += 1
        result.append(indent + ', '.join(alive) + ' {' + body)
    else:
        result.append(line)

css = '\n'.join(result)

# Pass 3: clean 3+ blank lines
css = re.sub(r'\n{3,}', '\n\n', css)

# Pass 4: remove lines that are just "/* ... moved to css/shell.css */"
css = re.sub(r'\n/\* (?:Top Bar|Main Layout|Thesis Panel|Reset) .*?\*/\n', '\n', css)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(css)

# Stats
with open(PATH, "r", encoding="utf-8") as f:
    v = f.read()

print(f"Blocks removed: {removed_blocks}")
print(f"Lines cleaned: {removed_lines}")
print(f"Total lines: {len(v.split(chr(10)))}")
print()
for cls_name, cls_pat in [
    ('.bar', r'\.bar\b'), ('.bar-left', r'\.bar-left'),
    ('.bar-tabs', r'\.bar-tabs'), ('.bar-actions', r'\.bar-actions'),
    ('.nav-sidebar', r'\.nav-sidebar'), ('.toc-panel', r'\.toc-panel'),
    ('.thesis-panel', r'\.thesis-panel\b'), ('.thesis-bar', r'\.thesis-bar\b'),
    ('.thesis-bar-actions', r'\.thesis-bar-actions'), ('.help-btn', r'\.help-btn'),
    ('.module-tabs', r'\.module-tabs'),
]:
    c = len(re.findall(cls_pat, v))
    print(f"  {cls_name}: {'CLEAN' if c == 0 else f'{c} remaining'}")
