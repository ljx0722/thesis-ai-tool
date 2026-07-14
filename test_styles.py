"""
论文样式检测脚本 — 模拟 app.js 的 DOCX 解析逻辑
用法: python test_styles.py <目录路径>     (扫描目录下所有 .docx)
      python test_styles.py <文件路径>     (检测单个文件)
"""

import sys, os, zipfile, re
from xml.etree import ElementTree as ET
from collections import defaultdict

def extract_text_from_xml(xml_string):
    """从 OOXML w:p 块中提取纯文本 (模拟 extractTextFromXml)"""
    result = []
    for t in re.findall(r'<w:t[^>]*>([^<]*)</w:t>', xml_string):
        result.append(t)
    return ' '.join(result).strip()

def parse_styles_xml(xml_string):
    """从 styles.xml 提取 styleId → name 映射 + 样式级别的默认 rPr"""
    style_map = {}
    style_type = {}
    style_rpr = {}  # style-level default font properties
    root = ET.fromstring(xml_string)
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    for style in root.findall('.//w:style', ns):
        sid = style.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}styleId', '')
        stype = style.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}type', 'paragraph')
        name_el = style.find('.//w:name', ns)
        name = name_el.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', sid) if name_el is not None else sid
        style_map[sid] = name
        style_type[sid] = stype

        # 提取样式级别 rPr 默认字体
        def_rpr = {}
        rpr_el = style.find('.//w:rPr', ns)
        if rpr_el is not None:
            fonts_el = rpr_el.find('.//w:rFonts', ns)
            if fonts_el is not None:
                for attr in ['ascii', 'hAnsi', 'eastAsia', 'cs']:
                    val = fonts_el.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'+attr)
                    if val and val.strip(): def_rpr[attr] = val
            sz_el = rpr_el.find('.//w:sz', ns)
            if sz_el is not None:
                sz = sz_el.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val')
                if sz: def_rpr['size'] = int(sz) / 2
            if rpr_el.find('.//w:b', ns) is not None: def_rpr['bold'] = True
            if rpr_el.find('.//w:i', ns) is not None: def_rpr['italic'] = True
            color_el = rpr_el.find('.//w:color', ns)
            if color_el is not None:
                c = color_el.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val')
                if c: def_rpr['color'] = '#' + c
        if def_rpr: style_rpr[sid] = def_rpr

    return style_map, style_type, style_rpr

def parse_document_xml(xml_string, style_map, style_rpr):
    """
    从 document.xml 提取所有段落信息：
    - 样式名
    - 文本
    - 字体属性 (rFonts, sz, b, i, color)
    - 当 run 无显式 rPr 时回退到样式级默认值
    """
    paras = []

    # 拆分为独立 <w:p> 块
    p_blocks = re.split(r'(?=<w:p[\s>])', xml_string)
    for p_block in p_blocks:
        if not p_block.strip():
            continue

        # 段落样式
        pstyle_match = re.search(r'<w:pStyle[^>]*w:val="([^"]*)"', p_block)
        style_id = pstyle_match.group(1) if pstyle_match else 'Normal'
        style_name = style_map.get(style_id, style_id)
        style_def = style_rpr.get(style_id)  # 样式级默认字体

        # 段落文本
        para_text = ''
        t_parts = re.split(r'<w:t[ >]', p_block)
        for tp in t_parts[1:]:
            tm = re.search(r'>([^<]*)<', tp)
            if tm:
                para_text += tm.group(1)
        para_text = para_text.replace('\t', ' ').replace('\n', ' ').strip()
        para_text = re.sub(r'\s+', ' ', para_text)

        if not para_text or len(para_text) < 2:
            continue

        # 过滤页码、纯数字
        if re.match(r'^\d{1,3}$', para_text):
            continue
        if re.match(r'^[ivxlcdm]+$', para_text, re.I):
            continue
        if re.search(r'[\t\s]+\d{1,3}$', para_text):
            continue
        if re.search(r'\.{3,}\d{1,3}$', para_text):
            continue

        # 提取 run-level 字体属性
        font_info = {'fonts': set(), 'sizes': [], 'bold': False, 'italic': False, 'color': None}
        has_font_data = False
        r_blocks = re.split(r'<w:r[ >]', p_block)
        for r_block in r_blocks[1:]:
            rpr_match = re.search(r'<w:rPr[^>]*>(.*?)</w:rPr>', r_block, re.DOTALL)
            if rpr_match:
                rpr = rpr_match.group(1)

                # rFonts
                rf_match = re.search(r'<w:rFonts[^>]*/?>', rpr)
                if rf_match:
                    rf = rf_match.group(0)
                    for attr in ['ascii', 'hAnsi', 'eastAsia', 'cs']:
                        m = re.search(rf'w:{attr}="([^"]*)"', rf)
                        if m and m.group(1).strip():
                            font_info['fonts'].add(m.group(1))
                            has_font_data = True

                # size
                for sz_tag in ['w:sz', 'w:szCs']:
                    sz_m = re.search(rf'<{sz_tag}[^>]*w:val="(\d+)"', rpr)
                    if sz_m:
                        font_info['sizes'].append(int(sz_m.group(1)) / 2)
                        has_font_data = True

                # bold
                if re.search(r'<w:b\s*/>', rpr) or re.search(r'<w:b\s', rpr):
                    font_info['bold'] = True; has_font_data = True

                # italic
                if re.search(r'<w:i\s*/>', rpr) or re.search(r'<w:i\s', rpr):
                    font_info['italic'] = True; has_font_data = True

                # color
                color_m = re.search(r'<w:color[^>]*w:val="([^"]*)"', rpr)
                if color_m:
                    font_info['color'] = '#' + color_m.group(1)
                    has_font_data = True

        # 回退：run 没有显式字体数据时，使用样式级默认字体
        if not has_font_data and style_def:
            for attr in ['ascii', 'hAnsi', 'eastAsia', 'cs']:
                if attr in style_def:
                    font_info['fonts'].add(style_def[attr])
            if 'size' in style_def:
                font_info['sizes'].append(style_def['size'])
            if style_def.get('bold'): font_info['bold'] = True
            if style_def.get('italic'): font_info['italic'] = True
            if 'color' in style_def: font_info['color'] = style_def['color']

        paras.append({
            'style': style_name,
            'style_id': style_id,
            'text': para_text[:100],  # truncated for display
            'fonts': sorted(font_info['fonts']),
            'sizes': font_info['sizes'],
            'bold': font_info['bold'],
            'italic': font_info['italic'],
            'color': font_info['color']
        })

    return paras

def detect_heading_type(style_name):
    """判断样式是否为标题类型"""
    heading_patterns = [
        (r'^(标题\s*1|Heading\s*1|Title\s*1|1\s*级|h1|chapter|第.+章)$', 'H1 章标题'),
        (r'^(标题\s*2|Heading\s*2|Title\s*2|2\s*级|h2|副标题)$', 'H2 节标题'),
        (r'^(标题\s*3|Heading\s*3|3\s*级|h3)$', 'H3 小节标题'),
        (r'^(标题\s*4|Heading\s*4|4\s*级|h4)$', 'H4'),
        (r'^(标题\s*5|Heading\s*5|5\s*级|h5)$', 'H5'),
        (r'^(标题\s*6|Heading\s*6|6\s*级|h6)$', 'H6'),
        (r'^(toc|目录|目次|TOC)', '📑 目录样式'),
        (r'^(正文|Normal|Body|标准|默认)', '📝 正文'),
        (r'(摘要|Abstract)', '📄 摘要'),
        (r'(关键词|Keywords|关键字)', '🏷️ 关键词'),
        (r'(参考文献|Reference)', '📚 参考文献'),
        (r'(致谢|Acknowledg)', '🙏 致谢'),
        (r'(附录|Appendix)', '📎 附录'),
        (r'(表|Table)', '📊 表格'),
        (r'(图|Figure|Chart)', '📈 图表'),
    ]
    for pattern, label in heading_patterns:
        if re.search(pattern, style_name, re.I):
            return label
    return None

def analyze_docx(filepath):
    """分析单个 .docx 文件，返回检测到的所有样式"""
    with zipfile.ZipFile(filepath, 'r') as z:
        styles_xml = z.read('word/styles.xml').decode('utf-8')
        doc_xml = z.read('word/document.xml').decode('utf-8')

    style_map, style_type, style_rpr = parse_styles_xml(styles_xml)
    paras = parse_document_xml(doc_xml, style_map, style_rpr)

    # 按样式分组统计
    style_groups = defaultdict(lambda: {'count': 0, 'paras': [], 'fonts': set(), 'all_sizes': [], 'bold_count': 0, 'italic_count': 0, 'total_runs': 0, 'head_type': None})

    for p in paras:
        sn = p['style']
        g = style_groups[sn]
        g['count'] += 1
        if len(g['paras']) < 3:
            g['paras'].append(p['text'])
        for f in p['fonts']:
            g['fonts'].add(f)
        g['all_sizes'].extend(p['sizes'])
        if p['bold']:
            g['bold_count'] += 1
        if p['italic']:
            g['italic_count'] += 1
        g['total_runs'] += 1
        if g['head_type'] is None:
            g['head_type'] = detect_heading_type(sn)

    return style_map, style_type, style_groups, len(paras)

def print_results(filepath, style_map, style_type, style_groups, total_paras):
    """格式化输出结果"""
    print(f"\n{'='*80}")
    print(f"  📁 {os.path.basename(filepath)}")
    print(f"{'='*80}")
    print(f"  样式库总数: {len(style_map)} | 有效段落: {total_paras} | 检测到的样式组: {len(style_groups)}")

    # 按段落数量排序
    sorted_groups = sorted(style_groups.items(), key=lambda x: -x[1]['count'])

    print(f"\n  {'序号':<5} {'样式名称':<30} {'段落数':<8} {'字体':<45} {'字号范围':<12} {'属性':<8}")
    print(f"  {'─'*5} {'─'*30} {'─'*8} {'─'*45} {'─'*12} {'─'*8}")

    for idx, (name, g) in enumerate(sorted_groups, 1):
        fonts_str = ', '.join(sorted(g['fonts'])[:4]) if g['fonts'] else '(使用默认)'
        if len(fonts_str) > 44:
            fonts_str = fonts_str[:41] + '...'

        if g['all_sizes']:
            min_sz = min(g['all_sizes'])
            max_sz = max(g['all_sizes'])
            if min_sz == max_sz:
                size_str = f'{min_sz:.0f}pt'
            else:
                size_str = f'{min_sz:.0f}-{max_sz:.0f}pt'
        else:
            size_str = '—'

        attrs = []
        if g['bold_count'] > g['total_runs'] * 0.4:
            attrs.append('B')
        if g['italic_count'] > g['total_runs'] * 0.4:
            attrs.append('I')
        attr_str = '+'.join(attrs) if attrs else '—'

        head_hint = f' [{g["head_type"]}]' if g['head_type'] else ''
        print(f"  {idx:<5} {name:<30} {g['count']:<8} {fonts_str:<45} {size_str:<12} {attr_str:<8}{head_hint}")

    # 示例段落
    print(f"\n  ─── 示例段落内容 ───")
    for idx, (name, g) in enumerate(sorted_groups[:8], 1):
        print(f"\n  [{name}] ×{g['count']}段")
        for pi, sample in enumerate(g['paras'][:2], 1):
            print(f"    {pi}. {sample[:90]}{'…' if len(sample) > 90 else ''}")

    # 样式库完整清单
    print(f"\n  ─── styles.xml 中定义的全部样式 ({len(style_map)}个) ───")
    for sid, name in sorted(style_map.items(), key=lambda x: x[1]):
        tp = style_type.get(sid, 'paragraph')
        used = '✅' if name in style_groups else '  '
        is_heading = detect_heading_type(name)
        hint = f' → {is_heading}' if is_heading else ''
        print(f"    {used} [{tp:10}] {name:<35} (id: {sid}){hint}")

def main():
    if len(sys.argv) < 2:
        print("用法: python test_styles.py <docx文件或目录>")
        print("  例: python test_styles.py ./testArtical/")
        print("  例: python test_styles.py 论文.docx")
        sys.exit(1)

    target = sys.argv[1]
    files = []

    if os.path.isdir(target):
        for f in os.listdir(target):
            if f.lower().endswith('.docx') and not f.startswith('~$'):
                files.append(os.path.join(target, f))
        if not files:
            print(f"[!] 目录 '{target}' 中没有找到 .docx 文件")
            # 也搜下子目录
            for root, dirs, filenames in os.walk(target):
                for f in filenames:
                    if f.lower().endswith('.docx') and not f.startswith('~$'):
                        files.append(os.path.join(root, f))
            if files:
                print(f"    在子目录中找到 {len(files)} 个文件")
            else:
                sys.exit(1)
    elif os.path.isfile(target):
        files.append(target)
    else:
        print(f"[!] '{target}' 不存在")
        sys.exit(1)

    print(f"找到 {len(files)} 个 .docx 文件\n")

    for fp in files:
        try:
            style_map, style_type, style_groups, total_paras = analyze_docx(fp)
            print_results(fp, style_map, style_type, style_groups, total_paras)
        except Exception as e:
            print(f"\n  ❌ {os.path.basename(fp)}: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    main()
