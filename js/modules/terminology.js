/**
 * 模块: 术语一致性分析
 * 术语提取 / 同义检测 / 中英混用 / 缩写检查
 */
function runTerminology(container) {
  var text = manuscriptText || '';
  if (!text) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af">请先上传论文</div>';
    return;
  }
  if(typeof updLoad==='function')updLoad('提取术语...',20);

  var h = '<div class="module-panel">';

  var cnText = text.replace(/[^一-鿿]/g, '');
  var bf = {};
  var ss = {};
  '研究分析基于技术应用系统设计实现模型理论实践发展影响因素对策建议问题策略现状趋势综述进行通过采用利用使用提出表明结果显示证明发现认为'.match(/../g).forEach(function(s){ss[s]=1;});
  for (var i=0;i<cnText.length-1;i++){var bg=cnText.substring(i,i+2);if(ss[bg])continue;bf[bg]=(bf[bg]||0)+1;}
  var terms=Object.entries(bf).filter(function(e){return e[1]>=5;}).sort(function(a,b){return b[1]-a[1];}).slice(0,25);

  var ew={};
  text.replace(/[^a-zA-Z\s]/g,' ').split(/\s+/).filter(function(w){return w.length>=4;}).forEach(function(w){var lw=w.toLowerCase();ew[lw]=(ew[lw]||0)+1;});
  var et=Object.entries(ew).filter(function(e){return e[1]>=3;}).sort(function(a,b){return b[1]-a[1];}).slice(0,15);

  h+='<h4>📊 术语统计</h4>';
  h+='<div class="dash-row">';
  h+='<div class="dash-item"><div class="dv">'+terms.length+'</div><div class="dl">中文高频词</div></div>';
  h+='<div class="dash-item"><div class="dv">'+et.length+'</div><div class="dl">英文高频词</div></div>';
  h+='</div>';

  h+='<h4>🔑 核心中文术语</h4><div style="margin:8px 0">';
  terms.forEach(function(t){h+='<span class="term-tag">'+t[0]+' <small>('+t[1]+')</small></span>';});
  h+='</div>';
  if(et.length){h+='<h4>🔤 核心英文术语</h4><div style="margin:8px 0">';et.forEach(function(t){h+='<span class="term-tag">'+t[0]+' <small>('+t[1]+')</small></span>';});h+='</div>';}

  if(typeof updLoad==='function')updLoad('检测同义表述...',45);
  h+='<h4>🔄 同义表述检测</h4>';
  var sg=[{w:['机器学习','机器学习技术','机器学习方法'],l:'机器学习'},{w:['深度学习','深度神经网络','DNN'],l:'深度学习'},
    {w:['人工智能','AI','人工智能技术'],l:'人工智能'},{w:['大数据','大数据技术','海量数据'],l:'大数据'},
    {w:['物联网','IoT','物联网技术'],l:'物联网'},{w:['区块链','区块链技术','分布式账本'],l:'区块链'},
    {w:['实证研究','实证分析','经验研究'],l:'实证研究'},{w:['案例分析','案例研究','个案研究'],l:'案例分析'},
    {w:['问卷调查','问卷调研','问卷研究'],l:'问卷调查'},{w:['文献综述','文献回顾','文献梳理'],l:'文献综述'},
    {w:['回归分析','回归模型','回归方法'],l:'回归分析'},{w:['结构方程','SEM','结构方程模型'],l:'结构方程模型'},
    {w:['因子分析','因素分析','因子分析法'],l:'因子分析'},{w:['政策建议','对策建议','政策含义'],l:'政策建议'},
    {w:['理论框架','理论模型','理论架构'],l:'理论框架'},{w:['可持续发展','永续发展','可持续发展战略'],l:'可持续发展'}];
  var sf2=false;
  sg.forEach(function(g){var fd=[];g.w.forEach(function(w){if(text.indexOf(w)>=0)fd.push(w);});if(fd.length>=2){sf2=true;h+='<div class=”finding warn”>⚠ “'+g.l+'” 有多种表述: '+fd.join('、')+'</div>';}});
  if(!sf2)h+='<div class=”finding ok”>✅ 未检测到明显术语不一致</div>';

  if(typeof updLoad==='function')updLoad('检测术语演变...',55);
  h+='<h4>🔄 术语演变检测</h4>';
  var bodyChs3=(sections||[]).filter(isBodyChapter);
  var evolveIssues=0;
  // Pattern-based: detect common mis-spellings and inconsistent usage across ALL domains
  var trackPairs=[{a:'机器',b:'机械'},{a:'数据',b:'数字'},{a:'分析',b:'解析'},{a:'评估',b:'评价'},{a:'模型',b:'模式'},{a:'策略',b:'战略'},{a:'影响',b:'效应'},{a:'特征',b:'特性'},{a:'标准',b:'规范'},{a:'结构',b:'构造'}];
  trackPairs.forEach(function(p){
    if(p.a===p.b)return;
    var chsA=[],chsB=[];
    bodyChs3.forEach(function(cs,i){
      var t=cs.text||'';if(t.indexOf(p.a)>=0&&!/机械学习|机器学习|数据化|数字化/.test(t))chsA.push(i+1);
      if(t.indexOf(p.b)>=0&&!/机械学习|机器学习|数据化|数字化/.test(t))chsB.push(i+1);
    });
    if(chsA.length&&chsB.length){evolveIssues++;h+='<div class=”finding info”>📌 “'+p.a+'”（第'+chsA.join(',')+'章） vs “'+p.b+'”（第'+chsB.join(',')+'章），请确认是否为同一概念</div>';}
  });
  if(!evolveIssues)h+='<div class=”finding ok”>✅ 术语在各章中表述一致</div>';

  if(typeof updLoad==='function')updLoad('检测中英混用...',65);
  h+='<h4>🌐 中英术语混用</h4>';
  // Multi-discipline CN-EN pairs
  var mx=[{c:'机器学习',e:'machine learning'},{c:'深度学习',e:'deep learning'},{c:'人工智能',e:'artificial intelligence'},
    {c:'数据分析',e:'data analysis'},{c:'回归分析',e:'regression analysis'},{c:'问卷',e:'questionnaire'},
    {c:'建筑',e:'architecture'},{c:'混凝土',e:'concrete'},{c:'城市',e:'urban'},{c:'金融',e:'financial'},
    {c:'供应链',e:'supply chain'},{c:'碳排放',e:'carbon emission'},{c:'新能源',e:'renewable energy'},
    {c:'法律',e:'law'},{c:'教育',e:'education'},{c:'医疗',e:'medical'},{c:'基因',e:'genetic'}];
  var mf=false;
  mx.forEach(function(mt){var hc=text.indexOf(mt.c)>=0,he=new RegExp('\\b'+mt.e.replace(/ /g,'\\s+')+'\\b','i').test(text);if(hc&&he){mf=true;h+='<div class=”finding info”>📌 “'+mt.c+'” 和 “'+mt.e+'” 同时出现，建议统一</div>';}});
  if(!mf)h+='<div class=”finding ok”>✅ 中英文术语使用一致</div>';

  if(typeof updLoad==='function')updLoad('拼写检查...',80);
  h += '<h4>📖 术语拼写检查</h4>';
  // Multi-discipline common spelling errors
  var sd={'神经网络':'神经网路','卷积':'卷积','自然处理':'自然言语处理','特征提取':'特徵提取','随机森林':'随即森林','梯度下降':'梯度下将','过拟合':'过拟和','正则化':'正则花','激活函数':'激活涵数','准确率':'准碓率','召回率':'找回率','归一化':'归壹化','显著性':'显着性','回归':'回规','相关性':'相关姓','系数':'系术','分布':'分怖','假设':'假没','统计':'统记','方差':'方羞','标准差':'标准羞','实证研究':'实政研究','理论':'理伦','分析':'分析','结果':'结里'};var si=0;
  Object.keys(sd).forEach(function(cr){var rx=new RegExp(sd[cr],'g');var ct=(text.match(rx)||[]).length;if(ct>0){si++;h+='<div class=”finding warn”>⚠ 可能拼错: '+sd[cr]+' ('+ct+'次)，应为 '+cr+'</div>';}});
  if(!si)h+='<div class=”finding ok”>✅ 未检测到常见术语拼写错误</div>';

  if(typeof updLoad==='function')updLoad('检查缩写...',85);
  h+='<h4>📝 缩写首次使用检查</h4>';
  // Multi-discipline abbreviations
  var ab=[{r:/\bCNN\b/g,f:'卷积神经网络(Convolutional Neural Network)'},{r:/\bLSTM\b/g,f:'长短期记忆网络(Long Short-Term Memory)'},
    {r:/\bNLP\b/g,f:'自然语言处理(Natural Language Processing)'},{r:/\bPCA\b/g,f:'主成分分析(Principal Component Analysis)'},
    {r:/\bGDP\b/g,f:'国内生产总值(Gross Domestic Product)'},{r:/\bFDI\b/g,f:'外商直接投资(Foreign Direct Investment)'},
    {r:/\bROE\b/g,f:'净资产收益率(Return on Equity)'},{r:/\bESG\b/g,f:'环境社会治理(Environmental Social Governance)'},
    {r:/\bPPP\b/g,f:'政府与社会资本合作(Public-Private Partnership)'},{r:/\bSWOT\b/g,f:'态势分析(Strengths Weaknesses Opportunities Threats)'},
    {r:/\bPEST\b/g,f:'宏观环境分析(Political Economic Social Technological)'},{r:/\bSWMM\b/g,f:'暴雨洪水管理模型(Storm Water Management Model)'},
    {r:/\bBIM\b/g,f:'建筑信息模型(Building Information Modeling)'},{r:/\bGIS\b/g,f:'地理信息系统(Geographic Information System)'}];
  var abf=false;
  ab.forEach(function(ap){var ms=text.match(ap.r);if(ms&&ms.length>0){var fi=text.indexOf(ms[0]),bf2=text.substring(Math.max(0,fi-120),fi);if(bf2.indexOf(ap.f.substring(0,Math.min(8,ap.f.length)))<0){abf=true;h+='<div class=”finding warn”>⚠ “'+ms[0]+'” 首次未给出全称（'+ap.f+'），共 '+ms.length+' 次</div>';}}});
  if(!abf)h+='<div class=”finding ok”>✅ 检测到的缩写均已正确给出全称</div>';

  h += '<h4>📝 外文术语翻译一致性</h4>';
  var transPairs=[{en:'CNN',cn:'卷积神经网络'},{en:'GDP',cn:'国内生产总值'},{en:'FDI',cn:'外商直接投资'},{en:'PPP',cn:'政府与社会资本合作'},{en:'SWOT',cn:'态势分析'},{en:'SEM',cn:'结构方程模型'}];
  var transIssues=0;
  transPairs.forEach(function(p){
    var enRx=new RegExp('\\b'+p.en+'\\b','gi');var enCount=(text.match(enRx)||[]).length;
    if(enCount>0&&text.indexOf(p.cn)<0){transIssues++;h+='<div class=”finding warn”>⚠ '+p.en+' 出现 '+enCount+' 次，但未找到其中文翻译 '+p.cn+'</div>';}
  });
  if(!transIssues)h+='<div class=”finding ok”>✅ 外文术语均有对应中文翻译</div>';

  h += '<h4>🏷️ 专有名词库</h4>';
  var pn={};var pnM, pnR=/\b[A-Z][A-Za-z]{2,}(?:\s+[A-Z][A-Za-z]{2,})?\b/g;
  while((pnM=pnR.exec(text))!==null){var pw=pnM[0];pn[pw]=(pn[pw]||0)+1;}
  var pl=Object.entries(pn).filter(function(e){return e[1]>=3;}).sort(function(a,b){return b[1]-a[1];}).slice(0,15);
  if(pl.length){pl.forEach(function(e){h+='<span class="term-tag">'+e[0]+' ('+e[1]+')</span>';});}else{h+='<div class="finding info">📌 未检测到足够的专有名词</div>';}
  if(typeof updLoad==='function')updLoad('完成',100);
  h+='</div>';
  container.innerHTML = h;
}
