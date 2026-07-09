/**
 * 论文看板 — 综合评估仪表盘
 * 汇聚所有模块的分析结果，以图表+评分形式展示论文全局画像
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
  showLoad('生成论文看板...', 20, '聚合分析数据');
  setTimeout(function() {
    try {
      var content = document.getElementById('dbContent');
      if (!content) { hideLoad(); return; }
      var h = buildDashboardHTML();
      content.innerHTML = h;
      updLoad('渲染图表...', 80);
      setTimeout(function() {
        drawRadarChart();
        drawChapterChart();
        hideLoad();
      }, 150);
    } catch (e) { hideLoad(); content.innerHTML = '<div style="text-align:center;padding:60px;color:#ff3b30">渲染出错: ' + e.message + '</div>'; }
  }, 100);
}

// ========== 计算综合评分 ==========
function computeAllScores() {
  var rev = typeof computeThesisReview === 'function' ? computeThesisReview() : null;
  if (rev && rev.dimensions) {
    return {
      composite: rev.composite,
      grade: rev.composite >= 80 ? 'A' : (rev.composite >= 65 ? 'B' : (rev.composite >= 50 ? 'C' : 'D')),
      struct: rev.dimensions[2] ? rev.dimensions[2].score : 60,
      literature: rev.dimensions[1] ? rev.dimensions[1].score : 45,
      format: rev.dimensions[8] ? rev.dimensions[8].score : 70,
      readability: rev.dimensions[7] ? rev.dimensions[7].score : 60,
      terminology: 65,
      avgSentLen: rev.stats.avgSentLen,
      totalChars: rev.stats.totalChars,
      totalChapters: rev.stats.chapters,
      totalRefs: rev.stats.refs,
      cnRefs: rev.stats.cnRefs,
      enRefs: rev.stats.enRefs,
      figCount: (manuscriptText.match(/图\s*\d+/g) || []).length,
      sectionCount: (function(){var c2=0;(sections||[]).forEach(function(s){(s.sections||[]).forEach(function(sc){c2++;if(sc.subs)c2+=sc.subs.length;});});return c2;})(),
      doiRate: rev.stats.refs > 0 ? Math.round(rev.stats.doiRefs/Math.max(1,rev.stats.refs)*100) : 0,
      fullReview: rev
    };
  }
  // Fallback — simple scoring
  var text = manuscriptText || '';
  var secs = sections || [];
  var bodyChs = secs.filter(function(s) { return !/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name); });
  var rl = (typeof mergedRefs !== 'undefined' && mergedRefs.length) ? mergedRefs : (typeof existingRefs !== 'undefined' ? existingRefs : []);
  var totalChars = text.length;

  // 1. 结构分 (0-100)
  var structScore = bodyChs.length >= 3 ? 70 : (bodyChs.length >= 2 ? 40 : 20);
  if (bodyChs.length >= 3) {
    var firstLen = (bodyChs[0].text || '').length;
    var lastLen = (bodyChs[bodyChs.length - 1].text || '').length;
    var introPct = totalChars > 0 ? Math.round(firstLen / totalChars * 100) : 0;
    var concPct = totalChars > 0 ? Math.round(lastLen / totalChars * 100) : 0;
    if (introPct >= 8 && introPct <= 25) structScore += 15;
    if (concPct >= 3 && concPct <= 20) structScore += 15;
    if (introPct > 25 || concPct > 20) structScore -= 10;
  }
  structScore = Math.max(0, Math.min(100, structScore));

  // 2. 文献分 (0-100)
  var litScore = 0;
  if (rl.length >= 30) litScore = 90;
  else if (rl.length >= 20) litScore = 75;
  else if (rl.length >= 10) litScore = 55;
  else if (rl.length >= 5) litScore = 30;
  else litScore = 5;
  var cnCount = rl.filter(function(r) { return /[一-鿿]/.test((r.title || r.ci || '').substring(0, 5)); }).length;
  var enCount = rl.length - cnCount;
  if (rl.length > 0 && enCount / rl.length >= 0.3) litScore += 10;
  if (enCount / Math.max(1, rl.length) < 0.15) litScore -= 15;
  // Per-chapter coverage
  var chapCovered = 0;
  var byCh = {}; rl.forEach(function(r) { var ck = r.ch || 1; byCh[ck] = (byCh[ck] || 0) + 1; });
  bodyChs.forEach(function(c) { if (byCh[c.ch] && byCh[c.ch] >= 1) chapCovered++; });
  if (bodyChs.length > 0 && chapCovered / bodyChs.length >= 0.8) litScore += 10;
  litScore = Math.max(0, Math.min(100, litScore));

  // 3. 格式分 (0-100)
  var fmtScore = 85; // Start high, deduct for issues
  var headingIssues = 0;
  secs.forEach(function(cs) {
    if (cs.sections) {
      var lastNum = 0;
      cs.sections.forEach(function(sec) {
        var np = parseFloat(sec.num) || 0;
        if (lastNum > 0 && np - lastNum > 1.1) headingIssues++;
        lastNum = np;
      });
    }
  });
  fmtScore -= headingIssues * 8;
  // Figure count
  var figCount = (text.match(/图\s*\d+/g) || []).length;
  if (figCount === 0 && totalChars > 5000) fmtScore -= 10;
  // DOI coverage
  if (rl.length > 0) {
    var doiCount = rl.filter(function(r) { return r.doi && r.doi.length > 5; }).length;
    var doiRate = doiCount / rl.length;
    if (doiRate < 0.3) fmtScore -= 15;
    else if (doiRate < 0.6) fmtScore -= 5;
  }
  fmtScore = Math.max(0, Math.min(100, fmtScore));

  // 4. 可读性分 (0-100)
  var readScore = 70;
  var avgSentLen = 35;
  var box = typeof document !== 'undefined' ? document.getElementById('thesisBox') : null;
  if (box) {
    var paras = box.querySelectorAll('p');
    var tc2 = 0, ts2 = 0;
    for (var pi = 0; pi < Math.min(paras.length, 100); pi++) {
      var pt = (paras[pi].textContent || '').trim();
      if (pt.length < 10) continue;
      var sents = pt.split(/[。！？\.\?\!]/).filter(function(s){return s.trim().length>0;});
      tc2 += pt.length; ts2 += sents.length;
    }
    avgSentLen = ts2 > 0 ? Math.round(tc2 / ts2) : 35;
    readScore = Math.round(100 - (avgSentLen - 20) * 1.5);
    var passives = (text.match(/被/g) || []).length;
    var passDens = Math.round(passives / Math.max(1, totalChars) * 1000);
    readScore -= passDens * 2;
  }
  readScore = Math.max(0, Math.min(100, readScore));

  // 5. 术语分 (0-100)
  var termScore = 65;
  var absText = text.substring(0, Math.min(1500, totalChars));
  var elements = [
    { kw: ['背景','问题','目前','现有','存在','面临'], label: '背景' },
    { kw: ['方法','采用','利用','基于','通过','模型','算法','实验'], label: '方法' },
    { kw: ['结果','表明','发现','显示','证明','效果','性能'], label: '结果' },
    { kw: ['结论','意义','贡献','创新','价值','展望'], label: '结论' },
  ];
  elements.forEach(function(el) {
    var hits = el.kw.filter(function(k) { return absText.indexOf(k) >= 0; }).length;
    if (hits >= 2) termScore += 8;
  });
  // Abbreviation check
  var abbrs = /\b(CNN|RNN|LSTM|SVM|NLP|PCA|GAN|IoT|API|GPU|ROC|AUC|MSE|MAE)\b/g;
  var abbrCount = (text.match(abbrs) || []).length;
  if (abbrCount > 5) termScore -= 5;
  termScore = Math.max(0, Math.min(100, termScore));

  // Composite score
  var composite = Math.round(structScore * 0.15 + litScore * 0.35 + fmtScore * 0.20 + readScore * 0.15 + termScore * 0.15);
  var grade = composite >= 80 ? 'A' : (composite >= 65 ? 'B' : (composite >= 50 ? 'C' : 'D'));

  return {
    composite: composite, grade: grade,
    struct: structScore, literature: litScore, format: fmtScore,
    readability: readScore, terminology: termScore,
    avgSentLen: avgSentLen,
    totalChars: totalChars, totalChapters: bodyChs.length,
    totalRefs: rl.length, cnRefs: cnCount, enRefs: enCount,
    figCount: figCount, sectionCount: (function(){var c=0;secs.forEach(function(s){(s.sections||[]).forEach(function(sc){c++;if(sc.subs)c+=sc.subs.length;});});return c;})(),
    doiRate: rl.length > 0 ? Math.round(rl.filter(function(r){return r.doi&&r.doi.length>5;}).length/rl.length*100) : 0,
    userName: (typeof AppState !== 'undefined' && AppState.thesis ? AppState.thesis.fileName : '') || '论文'
  };
}

// ========== Build HTML ==========
function buildDashboardHTML() {
  var scores = computeAllScores();
  var gradeColor = scores.grade === 'A' ? '#30d158' : (scores.grade === 'B' ? '#0071e3' : (scores.grade === 'C' ? '#ff9f0a' : '#ff3b30'));

  var h = '';
  h += '<div style="display:flex;height:100%;gap:16px">';

  // === LEFT PANEL: Score + Radar ===
  h += '<div style="width:340px;flex-shrink:0;display:flex;flex-direction:column;gap:14px">';

  // Big score circle
  h += '<div style="text-align:center;padding:20px;background:#fff;border-radius:18px;box-shadow:0 2px 16px rgba(0,0,0,0.06)">';
  h += '<div style="position:relative;display:inline-block;width:130px;height:130px;border-radius:50%;background:conic-gradient(' + gradeColor + ' ' + (scores.composite * 3.6) + 'deg, #e5e7eb 0deg);margin-bottom:10px">';
  h += '<div style="position:absolute;top:10px;left:10px;width:110px;height:110px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column">';
  h += '<span style="font-size:2.4rem;font-weight:800;color:' + gradeColor + ';font-family:SF Mono,monospace;line-height:1">' + scores.composite + '</span>';
  h += '<span style="font-size:.7rem;color:#86868b;font-weight:600">综合评分</span>';
  h += '</div></div>';
  h += '<div style="font-size:1.5rem;font-weight:800;color:' + gradeColor + ';font-family:SF Mono,monospace">' + scores.grade + '</div>';
  h += '<div style="font-size:.7rem;color:#86868b;margin-top:2px">论文质量等级</div>';
  h += '</div>';

  // Radar chart
  h += '<div style="flex:1;background:#fff;border-radius:18px;box-shadow:0 2px 16px rgba(0,0,0,0.06);padding:16px;position:relative">';
  h += '<div style="font-size:.72rem;font-weight:600;color:#1d1d1f;margin-bottom:8px">📊 五维雷达图</div>';
  h += '<canvas id="dbRadar" style="width:100%;height:220px"></canvas>';
  h += '</div>';
  h += '</div>';

  // === CENTER: Stats grid ===
  h += '<div style="flex:1;display:flex;flex-direction:column;gap:14px;overflow-y:auto">';

  // Quick stats
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
  var statCards = [
    { v: Math.round(scores.totalChars / 1000) + 'k', l: '总字数', c: '#0071e3' },
    { v: scores.totalChapters, l: '章节', c: '#30d158' },
    { v: scores.sectionCount, l: '小节', c: '#af52de' },
    { v: scores.totalRefs, l: '参考文献', c: '#ff9f0a' },
    { v: scores.cnRefs + '/' + scores.enRefs, l: '中/英文', c: '#ff375f' },
    { v: scores.doiRate + '%', l: 'DOI覆盖率', c: '#5ac8fa' },
  ];
  statCards.forEach(function(sc) {
    h += '<div style="flex:1;min-width:80px;background:#fff;border-radius:14px;padding:14px 12px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.04)">';
    h += '<div style="font-size:1.3rem;font-weight:700;color:' + sc.c + ';font-family:SF Mono,monospace">' + sc.v + '</div>';
    h += '<div style="font-size:.62rem;color:#86868b;margin-top:3px">' + sc.l + '</div>';
    h += '</div>';
  });
  h += '</div>';

  // Score bars + suggestions
  h += '<div style="display:flex;gap:14px;flex:1">';

  // Left: score bars
  h += '<div style="flex:1;background:#fff;border-radius:18px;box-shadow:0 2px 16px rgba(0,0,0,0.06);padding:18px">';
  h += '<div style="font-size:.72rem;font-weight:600;color:#1d1d1f;margin-bottom:12px">📈 维度得分</div>';
  var dims = [
    { name: '结构合理性', score: scores.struct, color: '#0071e3' },
    { name: '文献质量', score: scores.literature, color: '#30d158' },
    { name: '格式规范', score: scores.format, color: '#af52de' },
    { name: '可读性', score: scores.readability, color: '#ff9f0a' },
    { name: '术语规范', score: scores.terminology, color: '#ff375f' },
  ];
  dims.forEach(function(d) {
    h += '<div style="margin-bottom:10px">';
    h += '<div style="display:flex;justify-content:space-between;font-size:.68rem;margin-bottom:3px"><span style="color:#1d1d1f">' + d.name + '</span><span style="font-weight:600;color:' + d.color + '">' + d.score + '</span></div>';
    h += '<div style="height:6px;background:#e5e7eb;border-radius:6px;overflow:hidden"><div style="height:100%;width:' + d.score + '%;background:' + d.color + ';border-radius:6px;transition:width .6s ease"></div></div>';
    h += '</div>';
  });
  h += '</div>';

  // Right: suggestions
  h += '<div style="flex:1;background:#fff;border-radius:18px;box-shadow:0 2px 16px rgba(0,0,0,0.06);padding:18px;overflow-y:auto">';
  h += '<div style="font-size:.72rem;font-weight:600;color:#1d1d1f;margin-bottom:12px">💡 优先建议</div>';
  var suggestions = [];
  if (scores.struct < 60) suggestions.push({ p: '修改章节结构', d: '调整绪论/结论占比，增加方法论章节' });
  if (scores.literature < 50) suggestions.push({ p: '补充参考文献', d: '检索更多高质量文献，确保每章有引用支撑' });
  if (scores.format < 60) suggestions.push({ p: '修正格式问题', d: '检查图表编号连续性，补全DOI信息' });
  if (scores.readability < 55) suggestions.push({ p: '提高可读性', d: '缩短长句，减少被动语态使用' });
  if (scores.terminology < 55) suggestions.push({ p: '统一术语', d: '同一概念使用统一表述，缩写首次出现给出全称' });
  if (scores.totalRefs < 10) suggestions.push({ p: '增加参考文献', d: '当前仅有 ' + scores.totalRefs + ' 条文献，建议检索补充' });
  if (scores.enRefs / Math.max(1, scores.totalRefs) < 0.25) suggestions.push({ p: '补充英文文献', d: '英文文献占比偏低（' + Math.round(scores.enRefs/Math.max(1,scores.totalRefs)*100) + '%），建议检索英文文献' });
  suggestions.forEach(function(s, i) {
    h += '<div style="padding:8px 10px;margin-bottom:6px;border-radius:10px;background:rgba(0,0,0,0.02);border:1px solid #e5e7eb">';
    h += '<div style="font-size:.68rem;font-weight:600;color:#1d1d1f">' + (i+1) + '. ' + s.p + '</div>';
    h += '<div style="font-size:.64rem;color:#86868b;margin-top:2px">' + s.d + '</div>';
    h += '</div>';
  });
  if (!suggestions.length) {
    h += '<div style="text-align:center;padding:30px;color:#30d158;font-size:.8rem">🎉 论文整体质量良好，无明显短板</div>';
  }
  h += '</div>';

  h += '</div>'; // end score bars + suggestions

  // Chapter distribution chart
  h += '<div style="background:#fff;border-radius:18px;box-shadow:0 2px 16px rgba(0,0,0,0.06);padding:18px">';
  h += '<div style="font-size:.72rem;font-weight:600;color:#1d1d1f;margin-bottom:10px">📊 章节字数分布</div>';
  h += '<canvas id="dbChapter" style="width:100%;height:120px"></canvas>';
  h += '</div>';

  h += '</div>'; // end center
  h += '</div>'; // end flex

  // Store scores globally for chart rendering
  window._dbScores = scores;
  window._dbBodyChs = (sections || []).filter(function(s) { return !/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name); });

  return h;
}

// ========== Radar Chart ==========
function drawRadarChart() {
  var canvas = document.getElementById('dbRadar');
  if (!canvas || !window._dbScores) return;
  var scores = window._dbScores;
  var ctx = canvas.getContext('2d');
  var w = canvas.parentElement.clientWidth - 32, h = 220;
  canvas.width = w; canvas.height = h;

  var dims = [
    { name: '结构', score: scores.struct, color: '#0071e3' },
    { name: '文献', score: scores.literature, color: '#30d158' },
    { name: '格式', score: scores.format, color: '#af52de' },
    { name: '可读性', score: scores.readability, color: '#ff9f0a' },
    { name: '术语', score: scores.terminology, color: '#ff375f' },
  ];
  var n = dims.length;
  var cx = w / 2, cy = h / 2, maxR = Math.min(w, h) / 2 - 30;

  ctx.clearRect(0, 0, w, h);

  // Grid circles
  for (var g = 1; g <= 4; g++) {
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      var rx = cx + maxR * g / 4 * Math.cos(angle);
      var ry = cy + maxR * g / 4 * Math.sin(angle);
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Axis lines
  for (var i = 0; i < n; i++) {
    var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle));
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Data polygon
  ctx.beginPath();
  for (var i = 0; i <= n; i++) {
    var idx = i % n;
    var angle = (Math.PI * 2 / n) * idx - Math.PI / 2;
    var val = dims[idx].score / 100 * maxR;
    var px = cx + val * Math.cos(angle);
    var py = cy + val * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,113,227,0.12)';
  ctx.fill();
  ctx.strokeStyle = '#0071e3';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Data points
  for (var i = 0; i < n; i++) {
    var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
    var val = dims[i].score / 100 * maxR;
    var px = cx + val * Math.cos(angle);
    var py = cy + val * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = dims[i].color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Labels
  ctx.font = 'bold 11px -apple-system,"PingFang SC",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (var i = 0; i < n; i++) {
    var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
    var lx = cx + (maxR + 22) * Math.cos(angle);
    var ly = cy + (maxR + 22) * Math.sin(angle);
    ctx.fillStyle = '#1d1d1f';
    ctx.fillText(dims[i].name + ' ' + dims[i].score, lx, ly);
  }
}

// ========== Chapter Distribution Chart ==========
function drawChapterChart() {
  var canvas = document.getElementById('dbChapter');
  if (!canvas || !window._dbBodyChs) return;
  var bodyChs = window._dbBodyChs;
  var totalChars = manuscriptText ? manuscriptText.length : 1;
  var w = canvas.parentElement.clientWidth - 32, h = 120;
  canvas.width = w; canvas.height = h;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  var barCount = bodyChs.length;
  if (!barCount) return;
  var barGap = 20, barW = (w - barGap * (barCount + 1)) / barCount;
  var colors = ['#0071e3','#30d158','#af52de','#ff9f0a','#ff375f','#5ac8fa','#32d74b','#ff6482'];

  var maxPct = 0;
  bodyChs.forEach(function(cs) {
    var pct = (cs.text || '').length / totalChars * 100;
    if (pct > maxPct) maxPct = pct;
  });

  bodyChs.forEach(function(cs, i) {
    var pct = (cs.text || '').length / totalChars * 100;
    var bh = (pct / Math.max(1, maxPct)) * (h - 30);
    var x = barGap + i * (barW + barGap);
    var y = h - bh;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bh, [5, 5, 0, 0]);
    ctx.fill();

    // Label
    ctx.fillStyle = '#1d1d1f';
    ctx.font = '10px -apple-system,"PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(pct) + '%', x + barW / 2, y - 4);
    ctx.fillText(cs.name.substring(2, 6) || cs.name, x + barW / 2, h - 2);
  });
}

function showReviewInDashboard() {
  var overlay = document.getElementById('dbOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  var content = document.getElementById('dbContent');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center;padding:60px;color:#86868b"><div style="font-size:2rem;margin-bottom:12px">⏳</div>正在生成评审报告...</div>';
  setTimeout(function() {
    var h = '<div style="display:flex;height:100%;gap:16px">';
    h += '<div style="flex:1;overflow-y:auto;background:#fff;border-radius:18px;box-shadow:0 2px 16px rgba(0,0,0,0.06);padding:20px">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
    h += '<h2 style="font-size:1.1rem;font-weight:700;color:#1d1d1f;margin:0">📋 十维评审报告</h2>';
    h += '<button onclick="copyReviewText()" style="background:#0071e3;color:#fff;border:none;border-radius:18px;padding:8px 18px;cursor:pointer;font-weight:600;font-size:.72rem">📄 复制评语</button>';
    h += '</div>';
    h += renderReviewReport();
    h += '</div></div>';
    content.innerHTML = h;
  }, 100);
}
