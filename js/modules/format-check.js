/**
 * 模块: 格式规范性检查
 * 标题层级 / 图表编号 / 参考文献格式 / 段落格式
 */
function runFormatCheck(container) {
  var text = manuscriptText || '';
  var html = manuscriptHTML || '';
  var secs = sections || [];
  if (!text || !secs.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af">请先上传论文</div>';
    return;
  }
  if(typeof updLoad==='function')updLoad('数据统计...',15);

  var bodyChs = secs.filter(function(s) { return !/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name); });
  var issues = { errors: [], warnings: [], ok: [] };
  var stats = {};

  stats.chapters = bodyChs.length;
  stats.sections = 0; bodyChs.forEach(function(c) { stats.sections += (c.sections||[]).length; });
  stats.subs = 0; bodyChs.forEach(function(c) { (c.sections||[]).forEach(function(s) { stats.subs += (s.subs||[]).length; }); });
  stats.words = Math.round(text.length / 1000);
  var totalChars = text.length;
  stats.paras = (html.match(/<p[ >]/g) || []).length;

  if(typeof updLoad==='function')updLoad('检查标题层级...',30);

  secs.forEach(function(cs) {
    if (!cs.sections || !cs.sections.length) {
      if ((cs.text || '').length > 2000)
        issues.warnings.push({ msg: cs.name + ' 内容较长但无小节划分，建议增加二级标题', ch: cs.ch, sec: '' });
      return;
    }
    var lastNum = 0;
    cs.sections.forEach(function(sec) {
      var np = parseFloat(sec.num) || 0;
      if (lastNum > 0 && np - lastNum > 1.1) {
        issues.warnings.push({ msg: cs.name + ' 小节从 ' + lastNum.toFixed(1) + ' 跳到 ' + np.toFixed(1) + '，可能跳号', ch: cs.ch, sec: sec.num });
      }
      lastNum = np;
      if (sec.subs) {
        var lastSub = 0;
        sec.subs.forEach(function(sub) {
          var sp = parseFloat(sub.num.split('.').pop()) || 0;
          if (lastSub > 0 && sp - lastSub > 1) {
            issues.warnings.push({ msg: sec.num + ' ' + sec.title + ' 子节跳号', ch: cs.ch, sec: sec.num });
          }
          lastSub = sp;
        });
      }
    });
  });
  var h1Count = (html.match(/<h1[ >]/g) || []).length;
  if (h1Count > 1) issues.warnings.push({ msg: '检测到 ' + h1Count + ' 个 H1 标签，建议统一为章节标题格式（论文标题通常为1个H1属正常）' });
  else if (h1Count === 1) issues.ok.push({ msg: '检测到 1 个 H1 标签（通常为论文标题，正常）' });

    // 摘要与关键词检查
  if(typeof updLoad==='function')updLoad('检查摘要...',45);
  h += '<h4>\ud83d\udcdd 摘要与关键词</h4>';
  var absMatch=text.match(/(?:摘要|Abstract)[\s\S]{0,2000}?(?=\n(?:第[一二三四五六七八九十\d]+章|Abstract|关键词|关键字|Keyword|引言|绪论)|\nAbstract|$)/);
  var absText=absMatch?absMatch[0]:text.substring(0,1500);
  var absElements=[{label:'背景/问题',kw:['背景','问题','目前','现有','存在','面临','挑战']},{label:'方法/手段',kw:['方法','采用','基于','通过','模型','算法','实验','设计','利用']},{label:'结果/发现',kw:['结果','表明','发现','显示','证明','效果','性能','准确']},{label:'结论/意义',kw:['结论','意义','贡献','创新','价值','展望','启示']}];
  var absLower=(absText||'').toLowerCase();
  absElements.forEach(function(el){
    var hits=el.kw.filter(function(k){return absLower.indexOf(k)>=0;}).length;
    if(hits>=2)h+='<div class=\"finding ok\">\u2705 '+el.label+'要素已覆盖 ('+hits+'个关键词)</div>';
    else if(hits>=1)h+='<div class=\"finding warn\">\u26a0 '+el.label+'要素不足，建议补充</div>';
    else h+='<div class=\"finding err\">\u2757 '+el.label+'要素缺失</div>';
  });
  var kwMatch=text.match(/(?:关键词|关键字|Keywords)[\uff1a:]\s*(.+?)(?:\n|$)/i);
  if(kwMatch){
    var kws2=kwMatch[1].split(/[\uff1b;\uff0c,\s]+/).filter(function(w){return w.length>=2;});
    if(kws2.length<3)h+='<div class=\"finding warn\">\u26a0 关键词仅'+kws2.length+'个，建议3-5个关键词</div>';
    else if(kws2.length>8)h+='<div class=\"finding warn\">\u26a0 关键词'+kws2.length+'个（偏多），建议精简至3-5个</div>';
    else h+='<div class=\"finding ok\">\u2705 关键词'+kws2.length+'个（合理范围）</div>';
  }else{h+='<div class=\"finding warn\">\u26a0 未检测到中文关键词行</div>';}

  if(typeof updLoad==='function')updLoad('检查图表编号...',50);

  // 图/表编号检测：只在疑似标题行匹配（紧跟前缀+空格+编号），去重后检查连续性
  var figNums = [], figRaw = [];
  var figRe = /图\s*(\d+)(?:[\.-](\d+))?/g, fm;
  while ((fm = figRe.exec(text)) !== null) {
    var mn = parseInt(fm[1]), sn = fm[2] ? parseInt(fm[2]) : 0;
    // 只取紧邻"图"后有标题特征的行（减少正文中"如图X"的误匹配）
    var ctx = text.substring(Math.max(0, fm.index - 2), Math.min(text.length, fm.index + fm[0].length + 30));
    var isCaption = ctx.indexOf('图' + fm[1]) === fm.index - text.substring(0, fm.index).lastIndexOf('图') || /[。；！？\.\?\!]/.test(text.substring(Math.max(0, fm.index - 6), fm.index));
    figRaw.push({ num: mn, sub: sn, mainNum: mn });
  }
  var tblNums = [], tblRaw = [];
  var tblRe = /表\s*(\d+)(?:[\.-](\d+))?/g, tm;
  while ((tm = tblRe.exec(text)) !== null) {
    var tn = parseInt(tm[1]), tsn = tm[2] ? parseInt(tm[2]) : 0;
    tblRaw.push({ num: tn, sub: tsn, mainNum: tn });
  }
  // 按主编号去重
  var figSeen = {}; figRaw.forEach(function(f) { figSeen[f.mainNum] = f; });
  figNums = Object.keys(figSeen).map(Number).sort(function(a,b){return a-b;});
  var tblSeen = {}; tblRaw.forEach(function(t) { tblSeen[t.mainNum] = t; });
  tblNums = Object.keys(tblSeen).map(Number).sort(function(a,b){return a-b;});
  stats.figCount = figRaw.length;
  stats.tblCount = tblRaw.length;

  if (figNums.length >= 2) {
    var figGaps = [];
    for (var i = 1; i < figNums.length; i++)
      if (figNums[i] - figNums[i-1] > 1)
        for (var g = figNums[i-1]+1; g < figNums[i]; g++) figGaps.push(g);
    if (figGaps.length) issues.warnings.push({ msg: '图主编号不连续：缺少 图' + figGaps.join(', 图') + '（注意：子编号如图3-1已按主编号去重）' });
    else issues.ok.push({ msg: '图编号连续（图' + figNums[0] + '-图' + figNums[figNums.length-1] + '，' + figRaw.length + ' 个匹配）' });
  } else if (figNums.length === 1) {
    issues.ok.push({ msg: '检测到 1 个图编号（图' + figNums[0] + '），无法判断连续性' });
  }
  if (tblNums.length >= 2) {
    var tblGaps = [];
    for (var j = 1; j < tblNums.length; j++)
      if (tblNums[j] - tblNums[j-1] > 1)
        for (var k = tblNums[j-1]+1; k < tblNums[j]; k++) tblGaps.push(k);
    if (tblGaps.length) issues.warnings.push({ msg: '表主编号不连续：缺少 表' + tblGaps.join(', 表') + '（注意：子编号已按主编号去重）' });
    else issues.ok.push({ msg: '表编号连续（表' + tblNums[0] + '-表' + tblNums[tblNums.length-1] + '，' + tblRaw.length + ' 个匹配）' });
  } else if (tblNums.length === 1) {
    issues.ok.push({ msg: '检测到 1 个表编号（表' + tblNums[0] + '），无法判断连续性' });
  }

    // 结论与展望检查
  h += '<h4>\ud83c\udfc1 结论与展望</h4>';
  var bodyChs2 = secs.filter(function(s) { return !/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name); });
  var lastCh2=bodyChs2[bodyChs2.length-1];
  if(lastCh2&&/结论|结语|总结|展望|对策|建议/.test(lastCh2.name)){
    var lct=(lastCh2.text||'').length;
    if(lct/totalChars<0.03)h+='<div class=\"finding warn\">\u26a0 结论章过短('+Math.round(lct/totalChars*100)+'%)，建议充实总结要点和展望</div>';
    else h+='<div class=\"finding ok\">\u2705 结论章占比'+Math.round(lct/totalChars*100)+'%（合理）</div>';
    if(/不足|局限|缺陷/.test(lastCh2.text||''))h+='<div class=\"finding ok\">\u2705 已说明研究局限性</div>';
    else h+='<div class=\"finding warn\">\u26a0 未检测到研究局限性说明</div>';
    if(/展望|后续|未来|进一步/.test(lastCh2.text||''))h+='<div class=\"finding ok\">\u2705 已包含研究展望</div>';
    else h+='<div class=\"finding warn\">\u26a0 未检测到研究展望</div>';
  }else{h+='<div class=\"finding warn\">\u26a0 未检测到结论/展望章</div>';}

  if(typeof updLoad==='function')updLoad('检查引用格式...',70);

  var refList = (typeof mergedRefs !== 'undefined' && mergedRefs.length) ? mergedRefs : (typeof existingRefs !== 'undefined' ? existingRefs : []);
  if (refList.length) {
    var missingDOI = 0, missingYear = 0;
    refList.forEach(function(r) {
      if (!r.doi) missingDOI++;
      if (!r.year && !(r.ci||'').match(/\b(19|20)\d{2}\b/)) missingYear++;
    });
    stats.refCount = refList.length;
    stats.refWithDOI = refList.length - missingDOI;
    stats.refWithYear = refList.length - missingYear;
    if (missingDOI) issues.warnings.push({ msg: missingDOI + ' 条文献缺少 DOI' });
    if (missingYear) issues.warnings.push({ msg: missingYear + ' 条文献缺少年份' });
    if (!missingDOI && !missingYear) issues.ok.push({ msg: '参考文献格式信息基本完整' });
  }

  if(typeof updLoad==='function')updLoad('检查段落格式...',85);

  var longParaCount = 0, totalParaChars = 0, paraCount = 0;
  var box = document.getElementById('thesisBox');
  if (box) {
    var refBoundary = bodyBoundaryEl();
    var paras = box.querySelectorAll('p');
    for (var pi = 0; pi < paras.length; pi++) {
      // 跳过参考文献列表之后的段落
      if (refBoundary && (paras[pi].compareDocumentPosition(refBoundary) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      var pt = (paras[pi].textContent || '').trim();
      if (pt.length > 10) { paraCount++; totalParaChars += pt.length; if (pt.length > 800) longParaCount++; }
    }
  }
  if (longParaCount) issues.warnings.push({ msg: '检测到 ' + longParaCount + ' 个超长段落（>800字），建议拆分' });
  else issues.ok.push({ msg: '段落长度合理，未检测到超长段落' });
  stats.avgParaLen = paraCount ? Math.round(totalParaChars / Math.max(1, paraCount)) : 0;

  if(typeof updLoad==='function')updLoad('渲染结果...',95);

  function sevIcon(t) { return t === 'errors' ? '\u2757' : (t === 'warnings' ? '\u26a0' : '\u2705'); }
  function sevCls(t) { return t === 'errors' ? 'err' : (t === 'warnings' ? 'warn' : 'ok'); }

  var h = '<div class="module-panel">';
  h += '<h4>\ud83d\udcca 格式统计</h4>';
  h += '<div class="dash-row">';
  h += '<div class="dash-item"><div class="dv">' + stats.chapters + '</div><div class="dl">章节</div></div>';
  h += '<div class="dash-item"><div class="dv">' + stats.sections + '</div><div class="dl">小节</div></div>';
  h += '<div class="dash-item"><div class="dv">' + stats.figCount + '</div><div class="dl">图片</div></div>';
  h += '<div class="dash-item"><div class="dv">' + stats.tblCount + '</div><div class="dl">表格</div></div>';
  h += '<div class="dash-item"><div class="dv">' + stats.words + 'k</div><div class="dl">字数</div></div>';
  h += '</div>';

  var totalIssues = issues.errors.length + issues.warnings.length;
  h += '<div style="margin:8px 0;font-weight:600;font-size:.8rem;color:' + (totalIssues ? '#ef4444' : '#10b981') + '">' + (totalIssues === 0 ? '\ud83c\udf89 未发现问题' : '发现 ' + issues.errors.length + ' 个错误，' + issues.warnings.length + ' 个警告') + '</div>';

  ['errors', 'warnings', 'ok'].forEach(function(cat) {
    if (!issues[cat].length) return;
    h += '<h4>' + sevIcon(cat) + ' ' + ({errors:'严重问题',warnings:'需注意',ok:'通过项'}[cat]) + '</h4>';
    issues[cat].forEach(function(item) {
      var onclick = '';
      if (item.ch && item.sec) {
        onclick = ' onclick="jumpToSection(\'sec-' + item.sec.replace(/\./g,'-') + '\',\'' + item.ch + '\')" style="cursor:pointer"';
      } else if (item.ch) {
        onclick = ' onclick="jumpToSection(\'ch-' + item.ch + '\',\'' + item.ch + '\')" style="cursor:pointer"';
      }
      h += '<div class="finding ' + sevCls(cat) + '"' + onclick + '>' + item.msg + '</div>';
    });
  });
  h += '</div>';
  if(typeof updLoad==='function')updLoad('完成',100);
  container.innerHTML = h;
}
