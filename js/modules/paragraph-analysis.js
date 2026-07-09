/**
 * 模块: 段落分析
 * 段落长度分布 / 长句检测 / 过渡词分析
 */
function runParagraphAnalysis(container) {
  var text = manuscriptText || '';
  var html = manuscriptHTML || '';
  if (!text) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af">请先上传论文</div>';
    return;
  }
  if(typeof updLoad==='function')updLoad('提取段落...',20);

  var stats = { totalParas: 0, longParas: 0, shortParas: 0, totalSents: 0, longSents: 0, avgSentLen: 0 };
  var paraData = [];
  var box = document.getElementById('thesisBox');
  if (box) {
    var refBoundary2 = typeof bodyBoundaryEl === 'function' ? bodyBoundaryEl() : null;
    var allParas = box.querySelectorAll('p');
    var paras = [];
    for (var ai = 0; ai < allParas.length; ai++) {
      if (refBoundary2 && (allParas[ai].compareDocumentPosition(refBoundary2) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      paras.push(allParas[ai]);
    }
    stats.totalParas = paras.length;
    var tc = 0, ts = 0;
    for (var pi = 0; pi < paras.length; pi++) {
      var pt = (paras[pi].textContent || '').trim();
      if (pt.length < 10) continue;
      tc += pt.length;
      var sents = pt.split(/[。！？\.\?\!]/).filter(function(s){return s.trim().length>0;});
      ts += sents.length;
      var lsc = sents.filter(function(s){return s.trim().length>100;}).length;
      paraData.push({ el: paras[pi], len: pt.length, sents: sents.length, longSents: lsc, text: pt.substring(0,60) });
      if (pt.length > 800) stats.longParas++;
      if (pt.length < 30) stats.shortParas++;
    }
    stats.totalSents = ts;
    stats.avgSentLen = ts ? Math.round(tc / ts) : 0;
    stats.longSents = paraData.reduce(function(s,p){return s+p.longSents;},0);
  }

  if(typeof updLoad==='function')updLoad('分析段落分布...',45);

  var h = '<div class="module-panel">';
  h += '<h4>\ud83d\udcca 段落统计</h4>';
  h += '<div class="dash-row">';
  h += '<div class="dash-item"><div class="dv">' + stats.totalParas + '</div><div class="dl">总段落</div></div>';
  h += '<div class="dash-item"><div class="dv">' + stats.totalSents + '</div><div class="dl">总句子</div></div>';
  h += '<div class="dash-item"><div class="dv">' + stats.avgSentLen + '</div><div class="dl">平均句长(字)</div></div>';
  h += '<div class="dash-item"><div class="dv">' + stats.longSents + '</div><div class="dl">长句(>100字)</div></div>';
  h += '<div class="dash-item"><div class="dv">' + stats.longParas + '</div><div class="dl">长段(>800字)</div></div>';
  h += '</div>';

  if(typeof updLoad==='function')updLoad('检测过渡词...',65);

  // === 可读性评分 ===
  if(typeof updLoad==='function')updLoad('计算可读性...',75);
  h += '<h4>📖 可读性评分</h4>';
  var avgSentLen=stats.avgSentLen||0;
  var passiveCount=(text.match(/被(?!称为|视为|认为|广泛|动|迫|告|捕|害|杀|偷|抢|骗|称作|誉为|评为|列为|授予|命名为|应用于|用于)/g)||[]).length+(text.match(/由(?!于|此|来|衷)/g)||[]).length+(text.match(/受(?!到|理|访|伤|贿|益|众|灾|限|托|邀|聘|训|教|精)/g)||[]).length;
  var passiveDensity=Math.round(passiveCount/Math.max(1,text.length/1000));
  var readabilityScore=Math.max(0,Math.min(100,100-(avgSentLen-20)*1.5-passiveDensity*2));
  var level=readabilityScore>=80?'✅ 易读':(readabilityScore>=50?'⚠ 中等':'❗ 偏难');
  h+='<div class="dash-row">';
  h+='<div class="dash-item"><div class="dv">'+readabilityScore+'</div><div class="dl">可读性分</div></div>';
  h+='<div class="dash-item"><div class="dv">'+avgSentLen+'</div><div class="dl">平均句长</div></div>';
  h+='<div class="dash-item"><div class="dv">'+passiveDensity+'</div><div class="dl">被动语态/k字</div></div>';
  h+='</div>';
  h+='<div style="margin:8px 0;font-size:.74rem">'+level+' 可读性评估: ';
  if(readabilityScore>=80)h+='文章可读性良好，句子长度和结构适中。';
  else if(readabilityScore>=50)h+='可读性中等，建议适当拆分长句，减少被动语态使用。';
  else h+='可读性偏低，建议大幅缩短句子，用主动语态替换被动表述。';
  h+='</div>';
  h += '<h4>\ud83d\udd17 过渡词使用</h4>';
  var tw = ['因此','所以','然而','但是','此外','另外','首先','其次','最后','总之','综上所述','换言之','与此同时','另一方面','不仅如此','更重要的是','例如','比如','也就是说'];
  var tf = {};
  tw.forEach(function(w){var c=(text.match(new RegExp(w,'g'))||[]).length;if(c>0)tf[w]=c;});
  var tt = Object.values(tf).reduce(function(a,b){return a+b;},0);
  if (tt > 0) {
    h += '<div style="margin:4px 0;font-size:.72rem;color:#6b7280">检测到 ' + tt + ' 处过渡词，使用 ' + Object.keys(tf).length + ' 种</div>';
    h += '<div style="margin:4px 0">';
    Object.entries(tf).sort(function(a,b){return b[1]-a[1];}).slice(0,12).forEach(function(e){h+='<span class="term-tag">'+e[0]+'('+e[1]+')</span>';});
    h += '</div>';
    if (Object.keys(tf).length < 5) h += '<div class="finding warn">\u26a0 过渡词种类偏少（' + Object.keys(tf).length + ' 种），建议丰富逻辑连接词</div>';
    else h += '<div class="finding ok">\u2705 过渡词使用较丰富</div>';
  } else {
    h += '<div class="finding info">\ud83d\udccc 未检测到明显过渡词，建议增加逻辑连接词提升可读性</div>';
  }

  if(typeof updLoad==='function')updLoad('检测段落问题...',85);

  if (paraData.length > 0) {
    h += '<h4>\u26a0 需关注的段落</h4>';
    var pp2 = paraData.filter(function(p){return p.len > 800 || p.longSents > 3;}).slice(0, 8);
    if (pp2.length) {
      pp2.forEach(function(p, i) {
        var reason = p.len > 800 ? '过长(' + p.len + '字)' : '';
        if (p.longSents > 3) reason += (reason?', ':'') + p.longSents + '个长句';
        h += '<div class="finding warn" onclick="jumpToParagraph(' + i + ')" style="cursor:pointer">\u26a0 ' + reason + '：\u300c' + p.text + '...\u300d</div>';
      });
    } else {
      h += '<div class="finding ok">\u2705 段落结构良好，未发现突出问题</div>';
    }
  }

  if(typeof updLoad==='function')updLoad('完成',100);
  h += '</div>';
  container.innerHTML = h;
}

function jumpToParagraph(idx) {
  var box = document.getElementById('thesisBox');
  if (!box) return;
  var refBd = typeof bodyBoundaryEl === 'function' ? bodyBoundaryEl() : null;
  var allP = box.querySelectorAll('p');
  var filtered = [];
  for (var fi = 0; fi < allP.length; fi++) {
    if (refBd && (allP[fi].compareDocumentPosition(refBd) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    filtered.push(allP[fi]);
  }
  var count = 0;
  for (var i = 0; i < filtered.length; i++) {
    if ((filtered[i].textContent||'').trim().length >= 10) {
      if (count === idx) {
        filtered[i].scrollIntoView({behavior:'smooth',block:'center'});
        filtered[i].style.transition='background .3s';paras[i].style.background='#fef3c7';
        setTimeout(function(){filtered[i].style.background='';},2000);
        return;
      }
      count++;
    }
  }
}
