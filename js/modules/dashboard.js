/**
 * 论文看板 — 综合评估报告
 * 包含：综合评分、雷达图、维度详解、改进建议、章节分析、文献分析、对比基准
 */
function showDashboard() {
  if (!(typeof manuscriptText !== 'undefined' && manuscriptText && manuscriptText.length > 100)) {
    alert('请先上传论文');
    return;
  }
  var overlay = document.getElementById('dbOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  buildDashboard();
}
function closeDashboard() {
  var overlay = document.getElementById('dbOverlay');
  if (overlay) overlay.style.display = 'none';
}
function buildDashboard() {
  showLoad('生成论文看板...', 10, '聚合分析数据');
  setTimeout(function() {
    try {
      var content = document.getElementById('dbContent');
      if (!content) { hideLoad(); return; }
      updLoad('计算评分...', 30);
      var h = buildDashboardHTML();
      content.innerHTML = h;
      updLoad('渲染图表...', 70);
      setTimeout(function() {
        drawRadarChart(); drawChapterChart();
        drawScoreBars(); drawLitPie();
        hideLoad();
      }, 120);
    } catch (e) { hideLoad(); content.innerHTML = '<div style="text-align:center;padding:60px;color:#ff3b30">渲染出错: ' + e.message + '</div>'; }
  }, 80);
}

// ========== 评分计算 ==========
function computeAllScores() {
  var rev = typeof computeThesisReview === 'function' ? computeThesisReview() : null;
  var dimScores = { struct:60, literature:45, format:70, readable:60, method:55, content:50, innovation:40, terminology:65, conclusion:55, practical:55 };
  var text = manuscriptText || '';
  var secs = sections || [];
  var bodyChs = secs.filter(function(s) { return !/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name); });
  var rl = (typeof mergedRefs !== 'undefined' && mergedRefs.length) ? mergedRefs : (typeof existingRefs !== 'undefined' ? existingRefs : []);
  var totalChars = text.length;
  var cnRefs = rl.filter(function(r) { return /[一-鿿]/.test((r.title||r.ci||'').substring(0,5)); }).length;
  var enRefs = rl.length - cnRefs;
  var recentRefs = rl.filter(function(r){var y=parseInt(r.year)||0;return y>=(new Date().getFullYear()-5);}).length;
  var doiRefs = rl.filter(function(r){return r.doi&&r.doi.length>5;}).length;

  if (rev && rev.dimensions) {
    dimScores.struct = rev.dimensions[2].score;
    dimScores.literature = rev.dimensions[1].score;
    dimScores.format = rev.dimensions[8].score;
    dimScores.readable = rev.dimensions[7].score;
    dimScores.method = rev.dimensions[3].score;
    dimScores.content = rev.dimensions[4].score;
    dimScores.innovation = rev.dimensions[6].score;
    dimScores.terminology = 65;
    dimScores.conclusion = rev.dimensions[5].score;
    dimScores.practical = rev.dimensions[9].score;
  }
  var composite = rev ? rev.composite : Math.round((dimScores.struct*0.1+dimScores.literature*0.2+dimScores.format*0.1+dimScores.readable*0.1+dimScores.method*0.15+dimScores.content*0.15+dimScores.innovation*0.05+dimScores.terminology*0.05+dimScores.conclusion*0.05+dimScores.practical*0.05));
  var grade = composite>=85?'A':(composite>=70?'B':(composite>=55?'C':'D'));

  var methods = [];
  if(/问卷|调查|Interview|访谈/.test(text))methods.push('调研类');
  if(/回归|因子|熵值|SWOT|PEST|博弈|统计分析|SPSS|Stata/.test(text))methods.push('量化实证');
  if(/案例|case study/.test(text.toLowerCase()))methods.push('案例法');
  if(/实验|仿真|模拟|样机/.test(text))methods.push('实验/仿真');
  if(/技术路线|研究思路/.test(text))methods.push('技术路线');

  var avgSentLen = 35;
  var box = document.getElementById('thesisBox');
  if (box) {
    var paras = box.querySelectorAll('p'); var tc=0, ts=0;
    for (var pi=0; pi<Math.min(paras.length,100); pi++) {
      var pt=(paras[pi].textContent||'').trim();
      if(pt.length<10)continue;
      var sents=pt.split(/[。！？\.\?\!]/).filter(function(s){return s.trim().length>0;});
      tc+=pt.length; ts+=sents.length;
    }
    avgSentLen = ts>0?Math.round(tc/ts):35;
  }
  var passiveDens = Math.round((text.match(/被/g)||[]).length/Math.max(1,totalChars/1000));
  var hasIntro = bodyChs.some(function(c){return/绪论|引言|前言/.test(c.name);});
  var hasLit = bodyChs.some(function(c){return/文献|综述|理论|基础/.test(c.name);});
  var hasMethod = bodyChs.some(function(c){return/方法|模型|算法|设计/.test(c.name);});
  var hasResult = bodyChs.some(function(c){return/结果|实证|调研|案例|分析/.test(c.name);});
  var hasConclusion = bodyChs.some(function(c){return/结论|对策|建议|展望|总结/.test(c.name);});
  var structCompleteness = [hasIntro,hasLit,hasMethod,hasResult,hasConclusion].filter(Boolean).length;
  var figCount = (text.match(/图\s*\d+/g)||[]).length;
  var secCount = 0; bodyChs.forEach(function(c){(c.sections||[]).forEach(function(sc){secCount++;if(sc.subs)secCount+=sc.subs.length;});});

  return {
    composite:composite, grade:grade, dimScores:dimScores,
    totalChars:totalChars, chapters:bodyChs.length, sections:secCount, totalRefs:rl.length,
    cnRefs:cnRefs, enRefs:enRefs, recentRefs:recentRefs, doiRate:rl.length>0?Math.round(doiRefs/rl.length*100):0,
    methods:methods, avgSentLen:avgSentLen, passiveDens:passiveDens,
    structCompleteness:structCompleteness, figCount:figCount,
    enRate:rl.length>0?Math.round(enRefs/rl.length*100):0,
    recentRate:rl.length>0?Math.round(recentRefs/rl.length*100):0,
    bodyChs:bodyChs, totalChars:totalChars
  };
}

// ========== HTML构建 ==========
function buildDashboardHTML() {
  var s = computeAllScores();
  var gc = s.grade==='A'?'#30d158':(s.grade==='B'?'#0071e3':(s.grade==='C'?'#ff9f0a':'#ff3b30'));
  var gradeLabel = s.grade==='A'?'优秀':(s.grade==='B'?'良好':(s.grade==='C'?'中等':'需改进'));

  var h = '<div style="display:flex;height:100%;gap:14px;font-size:.74rem;line-height:1.65">';

  // ====== LEFT COLUMN (280px): Score + Radar + Chapter ======
  h += '<div style="width:290px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;overflow-y:auto">';

  // Score circle
  h += '<div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.04);padding:18px;text-align:center">';
  h += '<div style="position:relative;display:inline-block;width:110px;height:110px;border-radius:50%;background:conic-gradient('+gc+' '+(s.composite*3.6)+'deg,#e5e7eb 0deg);margin-bottom:10px">';
  h += '<div style="position:absolute;top:8px;left:8px;width:94px;height:94px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column">';
  h += '<span style="font-size:2rem;font-weight:800;color:'+gc+';font-family:SF Mono,monospace;line-height:1">'+s.composite+'</span>';
  h += '<span style="font-size:.58rem;color:#86868b;font-weight:600">总分/100</span>';
  h += '</div></div>';
  h += '<div style="font-size:1.2rem;font-weight:800;color:'+gc+';font-family:SF Mono,monospace">'+s.grade+' 级 — '+gradeLabel+'</div>';
  h += '<div style="font-size:.62rem;color:#86868b;margin-top:4px;line-height:1.5">综合评分基于十维评审体系<br>涵盖选题/文献/框架/方法/论证/<br>结论/创新/写作/格式/实践价值</div>';
  h += '</div>';

  // Radar
  h += '<div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.04);padding:14px;position:relative">';
  h += '<div style="font-size:.7rem;font-weight:600;color:#1d1d1f;margin-bottom:6px">📊 十维雷达图</div>';
  h += '<canvas id="dbRadar" style="width:100%;height:230px"></canvas>';
  h += '</div>';

  // Chapter distribution
  h += '<div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.04);padding:14px">';
  h += '<div style="font-size:.7rem;font-weight:600;color:#1d1d1f;margin-bottom:6px">📊 章节字数分布</div>';
  h += '<canvas id="dbChapter" style="width:100%;height:110px"></canvas>';
  h += '</div>';

  // Quick stats
  h += '<div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.04);padding:14px">';
  h += '<div style="font-size:.7rem;font-weight:600;color:#1d1d1f;margin-bottom:8px">📈 快速统计</div>';
  h += statRow('总字数',Math.round(s.totalChars/1000)+'k 字',s.totalChars>30000?'#30d158':(s.totalChars>15000?'#0071e3':'#ff9f0a'));
  h += statRow('正文章节',s.chapters+' 章',s.chapters>=5?'#30d158':(s.chapters>=3?'#0071e3':'#ff3b30'));
  h += statRow('小节数',s.sections+' 个',s.sections>=8?'#30d158':(s.sections>=4?'#0071e3':'#ff9f0a'));
  h += statRow('参考文献',s.totalRefs+' 条',s.totalRefs>=30?'#30d158':(s.totalRefs>=15?'#0071e3':'#ff3b30'));
  h += statRow('中外比例','中 '+s.cnRefs+' / 英 '+s.enRefs,s.enRate>=30?'#30d158':(s.enRate>=15?'#ff9f0a':'#ff3b30'));
  h += statRow('近五年文献',s.recentRate+'%',s.recentRate>=50?'#30d158':(s.recentRate>=30?'#ff9f0a':'#ff3b30'));
  h += statRow('DOI覆盖率',s.doiRate+'%',s.doiRate>=50?'#30d158':(s.doiRate>=30?'#ff9f0a':'#ff3b30'));
  h += statRow('图表数量','图'+s.figCount+' 个',s.figCount>=5?'#30d158':(s.figCount>=2?'#0071e3':'#ff9f0a'));
  h += statRow('研究方法',s.methods.length?s.methods.join('、'):'未检测到',s.methods.length>=2?'#30d158':(s.methods.length>=1?'#ff9f0a':'#ff3b30'));
  h += statRow('结构完整度',s.structCompleteness+'/5要素',s.structCompleteness>=4?'#30d158':(s.structCompleteness>=3?'#ff9f0a':'#ff3b30'));
  h += statRow('平均句长',s.avgSentLen+' 字',s.avgSentLen<=35?'#30d158':(s.avgSentLen<=50?'#ff9f0a':'#ff3b30'));
  h += statRow('被动语态',s.passiveDens+' 处/千字',s.passiveDens<=8?'#30d158':(s.passiveDens<=15?'#ff9f0a':'#ff3b30'));
  h += '</div>';
  h += '</div>';

  // ====== RIGHT (flex): Score bars + Details + Suggestions ======
  h += '<div style="flex:1;display:flex;flex-direction:column;gap:12px;overflow-y:auto">';

  // Dimension score bars
  h += '<div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.04);padding:16px">';
  h += '<div style="font-size:.72rem;font-weight:600;color:#1d1d1f;margin-bottom:10px">📈 十维得分详解</div>';
  var dims = [
    {name:'选题价值',score:s.dimScores.innovation+5||45, info:'题目表述、研究范围、理论与实践价值'},
    {name:'文献综述',score:s.dimScores.literature, info:'文献总量('+s.totalRefs+'条)、外文占比('+s.enRate+'%)、近五年率('+s.recentRate+'%)'},
    {name:'框架结构',score:s.dimScores.struct, info:'章节数('+s.chapters+')、标准结构完整度('+s.structCompleteness+'/5)、均衡性'},
    {name:'研究方法',score:s.dimScores.method, info:'检测到方法: '+(s.methods.join('、')||'无')+',技术路线、数据来源'},
    {name:'内容论证',score:s.dimScores.content, info:'数据支撑('+(s.figCount?'图'+s.figCount+'个,':'')+'表格),案例材料,论证逻辑'},
    {name:'结论展望',score:s.dimScores.conclusion||55, info:'结论清晰度、研究局限性说明、未来展望'},
    {name:'创新性',score:s.dimScores.innovation, info:'理论/视角/方法/实践创新，差异化程度'},
    {name:'学术写作',score:s.dimScores.readable, info:'句长('+s.avgSentLen+'字)、被动语态('+s.passiveDens+'处/千字)、口语化'},
    {name:'格式规范',score:s.dimScores.format, info:'DOI覆盖率('+s.doiRate+'%)、图表编号、GB/T 7714规范'},
    {name:'实践价值',score:s.dimScores.practical||55, info:'行业/政策/企业应用场景，落地可行性'},
  ];
  dims.forEach(function(d) {
    var cl = d.score>=80?'#30d158':(d.score>=60?'#0071e3':(d.score>=40?'#ff9f0a':'#ff3b30'));
    h += '<div style="margin-bottom:8px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">';
    h += '<span style="font-size:.68rem;font-weight:600;color:#1d1d1f">'+d.name+'</span>';
    h += '<span style="font-size:.68rem;font-weight:700;color:'+cl+';font-family:SF Mono,monospace">'+d.score+'</span>';
    h += '</div>';
    h += '<div style="height:7px;background:#e5e7eb;border-radius:6px;overflow:hidden"><div style="height:100%;width:'+d.score+'%;background:'+cl+';border-radius:6px;transition:width .6s ease"></div></div>';
    h += '<div style="font-size:.58rem;color:#86868b;margin-top:1px">'+d.info+'</div>';
    h += '</div>';
  });
  h += '</div>';

  // Suggestions card
  h += '<div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.04);padding:16px">';
  h += '<div style="font-size:.72rem;font-weight:600;color:#1d1d1f;margin-bottom:10px">💡 优先改进建议</div>';
  var suggestions = [];
  ['struct','literature','format','method','content','conclusion','innovation','readable','practical'].forEach(function(key) {
    var sc = s.dimScores[key]||50;
    if (sc < 50) suggestions.push({dim:key, score:sc, items:getSuggestions(key, s)});
  });
  // Also add generic suggestions
  if (s.totalRefs < 15) suggestions.push({dim:'literature', score:s.dimScores.literature, items:['参考文献仅 '+s.totalRefs+' 条，硕士论文建议 30-50 条。切换到参考文献模块，点击"检索文献"补充。']});
  if (s.enRate < 25) suggestions.push({dim:'literature', score:s.dimScores.literature, items:['英文文献占比 '+s.enRate+'%（<25%），建议增加外文检索。在参考文献面板中增加英文关键词搜索。']});
  if (s.structCompleteness < 4) suggestions.push({dim:'struct', score:s.dimScores.struct, items:['论文标准结构不完整（'+s.structCompleteness+'/5要素），建议补充缺失章节。硕士论文通常需包含：绪论→文献综述→研究方法→实证分析→结论。']});
  if (s.figCount < 3 && s.totalChars > 20000) suggestions.push({dim:'content', score:s.dimScores.content, items:['图表仅 '+s.figCount+' 个（偏少），建议增加数据可视化图表增强论证说服力。']});
  if (s.avgSentLen > 50) suggestions.push({dim:'readable', score:s.dimScores.readable, items:['平均句长 '+s.avgSentLen+' 字（偏高），建议拆分长句、简化从句，控制在 25-35 字为宜。']});

  if (!suggestions.length) {
    h += '<div style="text-align:center;padding:20px;color:#30d158;font-size:.78rem">🎉 论文整体质量良好，无明显短板！<br><span style="color:#86868b;font-size:.68rem">建议在各分析模块中查看详细检查结果</span></div>';
  } else {
    suggestions.forEach(function(sug, i) {
      h += '<div style="padding:10px 12px;margin-bottom:6px;border-radius:10px;background:rgba(0,0,0,0.02);border-left:3px solid '+(sug.score<40?'#ff3b30':'#ff9f0a')+'">';
      h += '<div style="font-size:.68rem;font-weight:600;color:#1d1d1f;margin-bottom:4px">'+(i+1)+'. '+dimName(sug.dim)+'（得分 '+sug.score+'）</div>';
      sug.items.forEach(function(item) {
        h += '<div style="font-size:.64rem;color:#555;margin:3px 0;padding-left:8px;border-left:2px solid #e5e7eb">• '+item+'</div>';
      });
      h += '</div>';
    });
  }
  h += '</div>';

  h += '</div>'; // end right column
  h += '</div>'; // end flex

  // Store for chart rendering
  window._dbScores = s;
  window._dbBodyChs = s.bodyChs;

  return h;
}

function statRow(label, value, color) {
  return '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:.64rem"><span style="color:#86868b">'+label+'</span><span style="font-weight:600;color:'+color+'">'+value+'</span></div>';
}
function dimName(key) {
  var m = {struct:'框架结构',literature:'文献综述',format:'格式规范',readable:'学术写作',method:'研究方法',content:'内容论证',conclusion:'结论展望',innovation:'创新性',practical:'实践价值'};
  return m[key] || key;
}
function getSuggestions(key, s) {
  var map = {
    literature: ['外文文献偏少，建议检索英文数据库（PubMed/Semantic Scholar），确保英文占比 ≥30%', '近五年文献不足，关注最新研究动态', '缺少核心期刊文献支撑'],
    struct: ['章节分配不均衡，建议调整各章篇幅比例', '缺少独立的研究方法章', '绪论/结论篇幅比例需优化'],
    method: ['研究方法不够多样化，建议组合使用定量+定性方法', '缺少技术路线图说明研究路径', '方法论描述不够详细'],
    content: ['数据支撑不足，建议补充统计图表', '案例分析深度不够', '缺少对比分析或验证环节'],
    format: ['DOI覆盖率偏低，点击顶栏"补全DOI"自动修复', '图表编号可能不连续', '参考文献格式需检查GB/T 7714规范'],
    readable: ['句长偏高，建议拆分超长句', '口语化表达较多', '被动语态使用偏多'],
    innovation: ['创新点表述不够明确', '建议在绪论末尾单独列出创新点'],
    conclusion: ['结论章偏短', '缺少研究局限性说明', '没有未来研究展望'],
    practical: ['实践应用价值论述不足', '缺少落地可行性分析'],
  };
  return map[key] || ['建议在各分析模块中查看详细检查结果'];
}

// ========== 雷达图 ==========
function drawRadarChart() {
  var canvas = document.getElementById('dbRadar');
  if (!canvas || !window._dbScores) return;
  var s = window._dbScores, ds = s.dimScores;
  var dims = [
    {name:'选题',score:ds.innovation+5||45,color:'#0071e3'},
    {name:'文献',score:ds.literature,color:'#30d158'},
    {name:'框架',score:ds.struct,color:'#af52de'},
    {name:'方法',score:ds.method,color:'#ff9f0a'},
    {name:'论证',score:ds.content,color:'#ff375f'},
    {name:'结论',score:ds.conclusion||55,color:'#5ac8fa'},
    {name:'创新',score:ds.innovation,color:'#32d74b'},
    {name:'写作',score:ds.readable,color:'#ff6482'},
    {name:'格式',score:ds.format,color:'#bf5af2'},
    {name:'实践',score:ds.practical||55,color:'#00c7be'},
  ];
  var ctx = canvas.getContext('2d');
  var w = canvas.parentElement.clientWidth-28, h = 230;
  canvas.width = w; canvas.height = h;
  var cx = w/2, cy = h/2, n = dims.length, maxR = Math.min(w,h)/2-30;
  ctx.clearRect(0,0,w,h);
  for (var g=1;g<=4;g++) {
    ctx.beginPath();
    for (var i=0;i<=n;i++) {
      var a = (Math.PI*2/n)*i - Math.PI/2;
      var rx = cx+maxR*g/4*Math.cos(a), ry = cy+maxR*g/4*Math.sin(a);
      i===0?ctx.moveTo(rx,ry):ctx.lineTo(rx,ry);
    }
    ctx.closePath(); ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=1; ctx.stroke();
  }
  for (var i=0;i<n;i++) {
    var a = (Math.PI*2/n)*i - Math.PI/2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+maxR*Math.cos(a),cy+maxR*Math.sin(a));
    ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=1.5; ctx.stroke();
  }
  ctx.beginPath();
  for (var i=0;i<=n;i++) {
    var idx=i%n, a=(Math.PI*2/n)*idx-Math.PI/2;
    var rv = dims[idx].score/100*maxR;
    var px=cx+rv*Math.cos(a), py=cy+rv*Math.sin(a);
    i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
  }
  ctx.closePath(); ctx.fillStyle='rgba(0,113,227,0.08)'; ctx.fill();
  ctx.strokeStyle='#0071e3'; ctx.lineWidth=2; ctx.stroke();
  for (var i=0;i<n;i++) {
    var a=(Math.PI*2/n)*i-Math.PI/2;
    var rv=dims[i].score/100*maxR;
    ctx.beginPath(); ctx.arc(cx+rv*Math.cos(a),cy+rv*Math.sin(a),4,0,Math.PI*2);
    ctx.fillStyle=dims[i].color; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();
  }
  ctx.font='bold 10px -apple-system,"PingFang SC",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  for (var i=0;i<n;i++) {
    var a=(Math.PI*2/n)*i-Math.PI/2;
    ctx.fillStyle='#1d1d1f';
    ctx.fillText(dims[i].name+' '+dims[i].score, cx+(maxR+18)*Math.cos(a), cy+(maxR+18)*Math.sin(a));
  }
}

function drawChapterChart() {
  var canvas = document.getElementById('dbChapter');
  if (!canvas||!window._dbBodyChs) return;
  var bodyChs = window._dbBodyChs;
  var tc = manuscriptText?manuscriptText.length:1;
  var w = canvas.parentElement.clientWidth-28, h = 110;
  canvas.width = w; canvas.height = h;
  var ctx = canvas.getContext('2d'); ctx.clearRect(0,0,w,h);
  if (!bodyChs.length) return;
  var barCnt = bodyChs.length, bg = 16, bw = (w-bg*(barCnt+1))/barCnt;
  var colors = ['#0071e3','#30d158','#af52de','#ff9f0a','#ff375f','#5ac8fa','#32d74b','#ff6482'];
  var maxPct = 0; bodyChs.forEach(function(c){var p=(c.text||'').length/tc*100;if(p>maxPct)maxPct=p;});
  bodyChs.forEach(function(cs,i) {
    var pct = (cs.text||'').length/tc*100;
    var bh = (pct/Math.max(1,maxPct))*(h-25);
    ctx.fillStyle = colors[i%colors.length];
    ctx.beginPath(); ctx.roundRect(bg+i*(bw+bg),h-bh,bw,bh,[4,4,0,0]); ctx.fill();
    ctx.fillStyle='#1d1d1f'; ctx.font='9px sans-serif'; ctx.textAlign='center';
    ctx.fillText(Math.round(pct)+'%',bg+i*(bw+bg)+bw/2,h-bh-4);
    ctx.fillText((cs.name||'').replace('第','').substring(0,4),bg+i*(bw+bg)+bw/2,h-2);
  });
}

function drawScoreBars() {
  // No separate canvas needed — bars are already inline in HTML
}
function drawLitPie() {
  // Placeholder for future pie chart
}

function showReviewInDashboard() {
  var overlay = document.getElementById('dbOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  var content = document.getElementById('dbContent');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center;padding:60px;color:#86868b"><div style="font-size:2rem;margin-bottom:12px">⏳</div>正在生成评审报告...</div>';
  setTimeout(function() {
    var h = renderReviewReport();
    content.innerHTML = h;
  }, 100);
}
