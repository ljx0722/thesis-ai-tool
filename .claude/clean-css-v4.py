"""Surgical CSS cleanup: remove dead classes from grouped selectors, remove fully-dead blocks."""
import re

PATH = r"e:\同济学习\毕业论文\论文文献AI利器\css\style.css"
with open(PATH, "r", encoding="utf-8") as f:
    text = f.read()

DEAD_CLASSES = [
    '.bar', '.bar-left', '.bar-right', '.nav-sidebar',
    '.toc-panel', '.thesis-panel', '.thesis-bar'
]
# Build a regex for "word containing dead class"
dead_pat = re.compile(r'\b(?:' + '|'.join(re.escape(c) for c in DEAD_CLASSES) + r')\b')

lines = text.split('\n')
out = []
i = 0
killed_blocks = 0

def find_block_end(start):
    """Find the closing } of the CSS block starting at `start`."""
    depth = 0
    j = start
    while j < len(lines):
        for ch in lines[j]:
            if ch == '{': depth += 1
            elif ch == '}':
                depth -= 1
                if depth <= 0:
                    return j
        j += 1
    return len(lines) - 1

while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # Check if this line + following lines form a selector block
    if '{' in stripped:
        # Find the selector part (everything before '{')
        brace_idx = stripped.index('{')
        selector = stripped[:brace_idx]

        # Check previous lines for multi-line selector continuations
        sel_start = i
        while sel_start > 0:
            prev = lines[sel_start - 1].strip()
            if prev and '{' not in prev and '}' not in prev and not prev.startswith('/*') and not prev.startswith('@'):
                selector = prev + ' ' + selector
                sel_start -= 1
            else:
                break

        # Split selector into parts
        parts = [p.strip() for p in selector.split(',')]
        alive = [p for p in parts if not dead_pat.search(p)]

        if not alive:
            # All parts dead - skip entire block
            i = find_block_end(i) + 1
            killed_blocks += 1
            continue
        elif len(alive) != len(parts):
            # Some parts dead - reconstruct selector
            sel_end = find_block_end(i)
            new_selector = ',\n'.join(alive)
            # Add indentation
            indent = line[:len(line) - len(line.lstrip())]
            body_start = lines[i].index('{')
            body = lines[i][body_start:]
            # Join remaining body lines
            for k in range(i+1, sel_end+1):
                body += '\n' + lines[k]
            out.append(indent + new_selector + ' ' + body.lstrip())
            i = sel_end + 1
            killed_blocks += 1
            continue

    out.append(line)
    i += 1

result = '\n'.join(out)
result = re.sub(r'\n{3,}', '\n\n', result)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(result)

# Verify
for cls_name in DEAD_CLASSES:
    c = len(re.findall(re.escape(cls_name) + r'\b', result))
    print(f"  {cls_name}: {'CLEAN' if c == 0 else f'{c} REMAINING'}")
print(f"\nBlocks killed: {killed_blocks}")
print(f"Lines: {len(result.split(chr(10)))}")
