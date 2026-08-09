"""Final CSS dead-class cleanup using brace-balanced block removal."""
import re

PATH = r"e:\同济学习\毕业论文\论文文献AI利器\css\style.css"
with open(PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

DEAD = re.compile(
    r'\.bar\b|\.bar-left\b|\.bar-right\b|'
    r'\.nav-sidebar\b|\.toc-panel\b|'
    r'\.thesis-panel\b|\.thesis-bar\b'
)

removed = 0
i = 0
out = []

while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # Check if this line starts a CSS rule (has a selector before '{')
    brace_pos = stripped.find('{')
    if brace_pos > 0:
        selector = stripped[:brace_pos]
        if DEAD.search(selector):
            # This block's selector references a dead class - remove entire block
            depth = 1
            while depth > 0 and i < len(lines):
                depth += lines[i].count('{') - lines[i].count('}')
                i += 1
            removed += 1
            continue
    out.append(line)
    i += 1

# Handle multi-line selectors: if a line is a continuation (no '{') and the PREVIOUS
# line had dead selectors, we already removed it. But there might be cases where
# a continuation line has dead class references without brace.
# Simple fix: re-read and remove lines that are pure-selector lines with dead classes
out2 = []
i = 0
while i < len(out):
    line = out[i]
    stripped = line.strip()
    brace_pos = stripped.find('{')
    if brace_pos < 0 and stripped and not stripped.startswith('/*') and not stripped.startswith('//') and not stripped.startswith('}') and not stripped.startswith('@'):
        # Could be a multi-line selector continuation
        if DEAD.search(stripped) and ',' not in stripped:
            # Dead-only continuation - skip it and the next complete block
            next_i = i
            depth = 0
            while next_i < len(out):
                if '{' in out[next_i]: depth += out[next_i].count('{')
                if '}' in out[next_i]:
                    depth -= out[next_i].count('}')
                    if depth <= 0:
                        removed += 1
                        i = next_i + 1
                        break
                next_i += 1
            if depth <= 0:
                continue
    out2.append(line)
    i += 1

result = ''.join(out2)
# Clean triple+ blank lines
result = re.sub(r'\n{3,}', '\n\n', result)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(result)

# Stats
for cls_pat in [r'\.bar\b', r'\.bar-left\b', r'\.bar-right\b', r'\.nav-sidebar\b', r'\.toc-panel\b', r'\.thesis-panel\b', r'\.thesis-bar\b']:
    c = len(re.findall(cls_pat, result))
    print(f"  {cls_pat}: {c} {'CLEAN' if c == 0 else 'REMAINING'}")
print(f"\nBlocks removed: {removed}")
print(f"Lines: {len(result.split(chr(10)))}")
