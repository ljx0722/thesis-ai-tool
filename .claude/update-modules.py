import os, re

base = 'e:/同济学习/毕业论文/论文文献AI利器'

# File 1: js/core/app.js
path = os.path.join(base, 'js/core/app.js')
with open(path, 'r', encoding='utf-8') as f: content = f.read()
content = content.replace(
    "'topic-finder': 'runTopicFinder', 'proposal': 'runProposalModule',",
    "'ideation': 'IdeationModule', 'health-check': 'HealthCheckModule',")
content = content.replace("'proofread': 'runProofread', 'de-duplicate': 'runDeduplicate',", "")
content = content.replace("'format-check': 'runFormatCheck', 'terminology': 'runTerminology',", "")
old_list = "{ id: 'topic-finder', name: '选题推荐', icon: '💡', requiresThesis: false },\n    { id: 'proofread', name: '论文查错', icon: '✏️', requiresThesis: false },\n    { id: 'format-check', name: '格式检查', icon: '✅', requiresThesis: true },\n    { id: 'terminology', name: '术语分析', icon: '🔤', requiresThesis: true },"
new_list = "{ id: 'ideation', name: '开题工作台', icon: '💡', requiresThesis: false },\n    { id: 'health-check', name: '论文体检', icon: '🏥', requiresThesis: false },"
content = content.replace(old_list, new_list)
with open(path, 'w', encoding='utf-8') as f: f.write(content)
print("1/8: js/core/app.js")

# File 2: js/core/featree.js
path = os.path.join(base, 'js/core/featree.js')
with open(path, 'r', encoding='utf-8') as f: content = f.read()
content = content.replace("'topic-finder':'runTopicFinder','proposal':'runProposalModule',", "'ideation':'IdeationModule','health-check':'HealthCheckModule',")
content = content.replace("'proofread':'runProofread','de-duplicate':'runDeduplicate',", "")
content = content.replace("'format-check':'runFormatCheck','terminology':'runTerminology',", "")
with open(path, 'w', encoding='utf-8') as f: f.write(content)
print("2/8: js/core/featree.js")

# File 3: js/app-modules.js
path = os.path.join(base, 'js/app-modules.js')
with open(path, 'r', encoding='utf-8') as f: content = f.read()
content = content.replace("var DEFAULT_FAVS = ['references','proofread','format-check','data-analysis'];", "var DEFAULT_FAVS = ['health-check','ideation','citely','data-analysis'];")
content = content.replace("{title:'句子改写 / 降 AI 味',desc:'查错、降重、长句与口语化处理',action:\"launchTool('proofread')\"},", "{title:'论文体检',desc:'一键查错、降重、格式、术语、段落',action:\"launchTool('health-check')\"},")
content = content.replace("{title:'格式与导出',desc:'格式检查、预览、DOCX 导出',action:\"launchTool('format-check')\"},", "{title:'开题工作台',desc:'选题探索与大纲生成',action:\"launchTool('ideation')\"},")
content = content.replace("{ id: 'topic-finder',    name: '选题推荐',   icon: '💡', requiresThesis: false, aiDriven: true },", "{ id: 'ideation',        name: '开题工作台', icon: '💡', requiresThesis: false, aiDriven: true },")
content = content.replace("{ id: 'proofread',       name: '论文查错',   icon: '✏️', requiresThesis: false, aiDriven: true },", "{ id: 'health-check',    name: '论文体检',   icon: '🏥', requiresThesis: false, aiDriven: true },")
content = re.sub(r"\s*\{ id: 'format-check',\s+name: '格式检查',[^}]*\},\n", "", content)
content = re.sub(r"\s*\{ id: 'terminology',\s+name: '术语分析',[^}]*\},\n", "", content)
content = content.replace("'topic-finder':    'runTopicFinder',", "'ideation':        'IdeationModule',")
content = content.replace("'proofread':       'runProofread',", "'health-check':    'HealthCheckModule',")
content = re.sub(r"\s*'format-check':\s+'runFormatCheck',\n", "", content)
content = re.sub(r"\s*'terminology':\s+'runTerminology',\n", "", content)
with open(path, 'w', encoding='utf-8') as f: f.write(content)
print("3/8: js/app-modules.js")

# File 4: js/modules/dashboard.js
path = os.path.join(base, 'js/modules/dashboard.js')
with open(path, 'r', encoding='utf-8') as f: content = f.read()
content = content.replace("'topic-finder'", "'ideation'")
content = content.replace("'proposal'", "'ideation'")
content = content.replace("'proofread'", "'health-check'")
content = content.replace("'format-check'", "'health-check'")
content = content.replace("'terminology'", "'health-check'")
with open(path, 'w', encoding='utf-8') as f: f.write(content)
print("4/8: js/modules/dashboard.js")

# File 5: js/modules/project.js
path = os.path.join(base, 'js/modules/project.js')
with open(path, 'r', encoding='utf-8') as f: content = f.read()
content = content.replace("if (/topic-finder|proposal/.test(mid) && p.stageStatus.ideation !== 'done')", "if (/ideation/.test(mid) && p.stageStatus.prepare !== 'done')")
content = content.replace("if (/proofread|format-check|de-duplicate|terminology|paragraph|optimization/.test(mid) && p.stageStatus.polish !== 'done')", "if (/health-check/.test(mid) && p.stageStatus.polish !== 'done')")
content = content.replace("hasPolish: hasLog(['proofread', 'format-check', 'de-duplicate', 'terminology', 'paragraph', 'optimization']),", "hasPolish: hasLog(['health-check']),")
content = content.replace("hasRevised: hasLog(['proofread', 'de-duplicate', 'review']) && hasPaper,", "hasRevised: hasLog(['health-check', 'review']) && hasPaper,")
content = content.replace("_open('format-check')", "_open('health-check')")
content = content.replace("_open('proofread')", "_open('health-check')")
with open(path, 'w', encoding='utf-8') as f: f.write(content)
print("5/8: js/modules/project.js")

# File 6: js/core/auditor.js
path = os.path.join(base, 'js/core/auditor.js')
with open(path, 'r', encoding='utf-8') as f: content = f.read()
content = content.replace("_open('format-check');\">格式检查</button>", "_open('health-check');\">论文体检</button>")
content = content.replace("_open('proofread')\">AI查错</button>", "_open('health-check')\">论文体检</button>")
with open(path, 'w', encoding='utf-8') as f: f.write(content)
print("6/8: js/core/auditor.js")

# File 7: js/core/senttools.js
path = os.path.join(base, 'js/core/senttools.js')
with open(path, 'r', encoding='utf-8') as f: content = f.read()
content = content.replace("id:'proofread'", "id:'health-check'")
content = content.replace("label:'查错'", "label:'体检'")
content = content.replace("capability: 'proofread'", "capability: 'health-check'")
with open(path, 'w', encoding='utf-8') as f: f.write(content)
print("7/8: js/core/senttools.js")

# File 8: js/modules/review/review.js
path = os.path.join(base, 'js/modules/review/review.js')
with open(path, 'r', encoding='utf-8') as f: content = f.read()
content = content.replace("{ id: 'proofread',  name: '论文查错',   icon: '✏️', color: '#f59e0b' },", "{ id: 'health-check', name: '论文体检', icon: '🏥', color: '#6366f1' },")
content = content.replace("{ id: 'terminology',name: '术语分析',   icon: '🔤', color: '#3b82f6' },", "")
content = re.sub(r"\s*'proofread': 'AI 逐句扫描语病[^']*',\n", "", content)
content = re.sub(r"\s*'terminology': '检查术语使用[^']*',\n", "", content)
content = re.sub(r"\s*'proofread': 'runProofread',\n", "", content)
content = re.sub(r"\s*'terminology': 'runTerminology',\n", "", content)
content = re.sub(r"\s*\} else if \(tabId === 'proofread'\) \{\s*// proofread[^}]*\}", "", content)
with open(path, 'w', encoding='utf-8') as f: f.write(content)
print("8/8: js/modules/review/review.js")

print("\nDone! All 8 files updated.")
