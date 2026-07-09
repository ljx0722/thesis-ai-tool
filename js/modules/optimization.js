/**
 * 模块: 论文优化建议
 * 结构分析 / 文献密度 / 重复内容 / 句式检查 / 字数统计
 */
function runOptimization(container) {
  var text = manuscriptText || '';
  var secs = sections || [];
  if (!text || !secs.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af">请先上传论文</div>';
    return;
  }
  if(typeof updLoad==='function')updLoad('统计字数...',15);

  var bodyChs = secs.filter(function(s) { return !/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name); });
  var totalChars = text.length;

  if(typeof updLoad==='function')updLoad('分析结构...',35);

  var h = '<div class="module-panel">';

  // Dashboard
  h += '<h4>\ud83d\udcca 论文总览</h4>';
  h += '<div class="dash-row">';
  h += '<div class="dash-item"><div class="dv">' + Math.round(totalChars/1000) + 'k</div><div class="dl">总字数</div></div>';
  h += '<div class="dash-item"><div class="dv">' + bodyChs.length + '</div><div class="dl">正文章节</div></div>';
  var sc = 0; bodyChs.forEach(function(c){sc+=(c.sections||[]).length;});
  h += '<div class="dash-item"><div class="dv">' + sc + '</div><div class="dl">小节</div></div>';
  var rc = (typeof mergedRefs!=='undefined'&&mergedRefs.length)?mergedRefs.length:(typeof existingRefs!=='undefined'?existingRefs.length:0);
  h += '<div class="dash-item"><div class="dv">' + rc + '</div><div class="dl">文献</div></div>';
  h += '</div>';

  // Word distribution
  h += '<h4>\ud83d\udcca 章节字数分布</h4>';
  bodyChs.forEach(function(cs) {
    var ct = (cs.text || '').length;
    var pct = totalChars > 0 ? Math.round(ct / totalChars * 100) : 0;
    var barCl = pct > 30 ? '#ef4444' : (pct < 5 ? '#f59e0b' : '#10b981');
    h += '<div class="stat-row"><span class="slabel">' + cs.name + '</span><span class="svalue">' + Math.round(ct/1000) + 'k (' + pct + '%)</span></div>';
    h += '<div class="bar-wrap"><div class="bar-fill" style="width:' + pct + '%;background:' + barCl + '"></div></div>';
  });

  // Structure
  if(typeof updLoad==='function')updLoad('结构诊断...',50);
  h += '<h4>\ud83c\udfd7 结构诊断</h4>';
  if (bodyChs.length >= 2) {
    var fl = (bodyChs[0].text||'').length, ll = (bodyChs[bodyChs.length-1].text||'').length;
    var ip = Math.round(fl/Math.max(1,totalChars)*100), cp = Math.round(ll/Math.max(1,totalChars)*100);
    if (ip > 25) h += '<div class="finding warn">\u26a0 绪论占比 ' + ip + '%（偏大），建议控制在15-20%</div>';
    else if (ip < 5 && bodyChs.length>3) h += '<div class="finding warn">\u26a0 绪论占比 ' + ip + '%（偏小），建议补充文献综述</div>';
    else h += '<div class="finding ok">\u2705 绪论占比 ' + ip + '%（合理）</div>';
    if (cp > 20) h += '<div class="finding warn">\u26a0 结论占比 ' + cp + '%（偏大），应简洁扼要</div>';
    else if (cp < 3 && bodyChs.length>3) h += '<div class="finding warn">\u26a0 结论占比 ' + cp + '%（偏小），建议充实总结与展望</div>';
    else h += '<div class="finding ok">\u2705 结论占比 ' + cp + '%（合理）</div>';
  }

  // Lit density
    // 研究方法检测
  if(typeof updLoad==='function')updLoad('检测方法...',60);
  h += '<h4>🔬 研究方法检测</h4>';
  var methodHits=[];
  if(/问卷|调查|Interview|访谈/.test(text))methodHits.push('调研类');
  if(/回归|因子|熵值|SWOT|PEST|博弈|统计分析|SPSS|Stata|T.test|ANOVA/.test(text))methodHits.push('量化实证');
  if(/案例|case study/.test(text.toLowerCase()))methodHits.push('案例法');
  if(/实验|仿真|模拟|样机|测试/.test(text))methodHits.push('实验/仿真');
  if(/文献研究|规范分析|比较研究|比较法/.test(text))methodHits.push('理论分析');
  if(/文本分析|话语分析|历史分析/.test(text))methodHits.push('文本分析');
  if(/技术路线|研究思路|研究路径/.test(text))methodHits.push('技术路线');
  if(methodHits.length>=3)h+='<div class="finding ok">✅ 检测到'+methodHits.length+'种研究方法：'+methodHits.join('、')+'</div>';
  else if(methodHits.length>=1)h+='<div class="finding warn">⚠ 仅检测到'+methodHits.length+'种方法：'+methodHits.join('、')+'，建议丰富研究手段</div>';
  else h+='<div class="finding err">❗ 未检测到明确的研究方法，建议在绪论中说明研究方法</div>';

  // 创新点提示
  h += '<h4>✨ 创新点提示</h4>';
  var innoHits=[];
  if(/首次|创新|新颖|首创|改进|优化|新方法|新模型|新视角|新框架/.test(text))innoHits.push('检测到创新相关表述');
  if(/不同于|区别于|弥补了|丰富了|拓展了/.test(text))innoHits.push('检测到差异化表述');
  if(innoHits.length>0){innoHits.forEach(function(m){h+='<div class="finding info">📌 '+m+'</div>';});}
  h+='<div class="finding info">📌 需人工判断：创新是否真实存在（理论/视角/方法/实践/对象）</div>';

  if(typeof updLoad==='function')updLoad('检查文献密度...',65);
  
  // === 摘要质量评估 ===
  if(typeof updLoad==='function')updLoad('评估摘要...',55);
  h += '<h4>\ud83d\udcdd 摘要质量评估</h4>';
  var absMatch=text.match(/(?:摘要|Abstract)[\s\S]{0,2000}?(?=\n(?:第[一二三四五六七八九十\d]+章|Abstract|关键词|关键字|Keyword|引言|绪论|第1章|\n\n\n)|\nAbstract|$)/);
  var absText=absMatch?absMatch[0]:text.substring(0,1500);
  var elements=[{label:'背景/问题',kw:['背景','问题','目前','现有','存在','面临','挑战']},{label:'方法/手段',kw:['方法','采用','利用','基于','通过','模型','算法','实验','设计']},{label:'结果/发现',kw:['结果','表明','发现','显示','证明','效果','性能','准确']},{label:'结论/意义',kw:['结论','意义','贡献','创新','价值','展望','启示']}];
  var absLower=absText.toLowerCase();
  elements.forEach(function(el){
    var hits=el.kw.filter(function(k){return absLower.indexOf(k)>=0;}).length;
    if(hits>=2)h+='<div class="finding ok">\u2705 '+el.label+'要素已覆盖</div>';
    else if(hits>=1)h+='<div class="finding warn">\u26a0 '+el.label+'要素不足，建议补充</div>';
    else h+='<div class="finding err">\u2757 '+el.label+'要素缺失</div>';
  });
  h += '<h4>\ud83d\udcda 文献密度</h4>';
  var rm = {}, tr = 0;
  var rl = (typeof mergedRefs!=='undefined'&&mergedRefs.length)?mergedRefs:(typeof existingRefs!=='undefined'?existingRefs:[]);
  rl.forEach(function(r){var ck=r.ch||1;rm[ck]=(rm[ck]||0)+1;tr++;});
  if (tr > 0) {
    bodyChs.forEach(function(cs) {
      var cnt = rm[cs.ch] || 0;
      h += '<div class="stat-row"><span class="slabel">' + cs.name + '</span><span class="svalue">' + cnt + '条</span></div>';
      if (!cnt) h += '<div class="finding warn" onclick="jumpToSection(\'ch-'+cs.ch+'\',\''+cs.ch+'\')" style="cursor:pointer">\u26a0 此章无引用 — 点击跳转到该章节</div>';
    });
  } else {
    h += '<div class="finding info">\ud83d\udccc 尚未检索文献，切换到"参考文献"模块检索后查看密度分析</div>';
  }

  // Sentence check
  if(typeof updLoad==='function')updLoad('检查句式...',80);
  h += '<h4>\ud83d\udd0d 句式检查</h4>';
  var pts = [
    { re: /本文首次(提出|发现|证明)/g, msg: '"本文首次提出/发现/证明"等绝对断言，请确认有充分文献佐证' },
    { re: /国内外(尚未|尚无|没有|未见)/g, msg: '"国内外尚无"等表述，请确认文献调研充分' },
    { re: /填补了.*空白/g, msg: '"填补了空白"表述应谨慎使用' },
  ];
  var af = false;
  pts.forEach(function(pt){var m=text.match(pt.re);if(m){af=true;h+='<div class="finding warn">\u26a0 '+pt.msg+'（'+m.length+' 次）</div>';}});
  if(!af)h+='<div class="finding ok">\u2705 未检测到过度断言句式</div>';

  // Duplicate check
  if(typeof updLoad==='function')updLoad('检测重复内容...',90);
  h += '<h4>\ud83d\udd04 重复内容检测</h4>';
  if (bodyChs.length >= 2) {
    var sf = 0;
    for (var i=0;i<bodyChs.length;i++) {
      for (var j=i+1;j<bodyChs.length;j++) {
        var ov=keywordCosineSimilarity(bodyChs[i].text||'',bodyChs[j].text||'');
        if(ov>0.6){sf++;h+='<div class="finding err">\u2757 '+bodyChs[i].name+' 与 '+bodyChs[j].name+' 相似度 '+Math.round(ov*100)+'%</div>';}
      }
    }
    if(!sf)h+='<div class="finding ok">\u2705 各章节间未检测到明显重复</div>';
  }
  if(typeof updLoad==='function')updLoad('完成',100);
  h += '</div>';
  container.innerHTML = h;
}
