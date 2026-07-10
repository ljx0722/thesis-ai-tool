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

  h+='<h4>\ud83d\udcca 术语统计</h4>';
  h+='<div class="dash-row">';
  h+='<div class="dash-item"><div class="dv">'+terms.length+'</div><div class="dl">中文高频词</div></div>';
  h+='<div class="dash-item"><div class="dv">'+et.length+'</div><div class="dl">英文高频词</div></div>';
  h+='</div>';

  h+='<h4>\ud83d\udd11 核心中文术语</h4><div style="margin:8px 0">';
  terms.forEach(function(t){h+='<span class="term-tag">'+t[0]+' <small>('+t[1]+')</small></span>';});
  h+='</div>';
  if(et.length){h+='<h4>\ud83d\udd24 核心英文术语</h4><div style="margin:8px 0">';et.forEach(function(t){h+='<span class="term-tag">'+t[0]+' <small>('+t[1]+')</small></span>';});h+='</div>';}

  if(typeof updLoad==='function')updLoad('检测同义表述...',45);
  h+='<h4>\ud83d\udd04 同义表述检测</h4>';
  var sg=[{w:['机器学习','机器学习技术','机器学习方法'],l:'机器学习'},{w:['深度学习','深度神经网络','DNN'],l:'深度学习'},{w:['人工智能','AI','人工智能技术'],l:'人工智能'},{w:['神经网络','神经网络模型','neural network'],l:'神经网络'},{w:['大数据','大数据技术','海量数据'],l:'大数据'},{w:['物联网','IoT','物联网技术'],l:'物联网'},{w:['自然语言处理','NLP','自然语言理解'],l:'自然语言处理'},{w:['支持向量机','SVM','支持向量机模型'],l:'支持向量机'},{w:['卷积神经网络','CNN','卷积神经网路'],l:'卷积神经网络'}];
  var sf2=false;
  sg.forEach(function(g){var fd=[];g.w.forEach(function(w){if(text.indexOf(w)>=0)fd.push(w);});if(fd.length>=2){sf2=true;h+='<div class="finding warn">\u26a0 \u201c'+g.l+'\u201d 有多种表述: '+fd.join('\u3001')+'</div>';}});
  if(!sf2)h+='<div class="finding ok">\u2705 未检测到明显术语不一致</div>';

  if(typeof updLoad==='function')updLoad('检测中英混用...',65);
  h+='<h4>\ud83c\udf10 中英术语混用</h4>';
  if(typeof updLoad==='function')updLoad('检测中英混用...',65);
  h+='<h4>🔄 术语演变检测</h4>';
  var bodyChs3=(sections||[]).filter(function(s){return!/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name)});
  var evolveIssues=0;
  var trackPairs=[{a:'机器学习',b:'机械学习'},{a:'深度学习',b:'深层学习'},{a:'特征提取',b:'特征抽取'},{a:'数据预处理',b:'数据预处理'}];
  trackPairs.forEach(function(p){
    var chsA=[],chsB=[];
    bodyChs3.forEach(function(cs,i){if((cs.text||'').indexOf(p.a)>=0)chsA.push(i+1);if((cs.text||'').indexOf(p.b)>=0)chsB.push(i+1);});
    if(chsA.length&&chsB.length){evolveIssues++;h+='<div class="finding warn">⚠ '+p.a+'（第'+chsA.join(',')+'章） vs '+p.b+'（第'+chsB.join(',')+'章），表述不一致</div>';}
  });
  if(!evolveIssues)h+='<div class="finding ok">✅ 术语在各章中表述一致</div>';
  var mx=[{c:'机器学习',e:'machine learning'},{c:'深度学习',e:'deep learning'},{c:'神经网络',e:'neural network'},{c:'人工智能',e:'artificial intelligence'},{c:'数据集',e:'dataset'},{c:'准确率',e:'accuracy'},{c:'特征',e:'feature'},{c:'算法',e:'algorithm'},{c:'模型',e:'model'},{c:'参数',e:'parameter'}];
  var mf=false;
  mx.forEach(function(mt){var hc=text.indexOf(mt.c)>=0,he=new RegExp('\\b'+mt.e.replace(/ /g,'\\s+')+'\\b','i').test(text);if(hc&&he){mf=true;h+='<div class="finding info">\ud83d\udccc \u201c'+mt.c+'\u201d 和 \u201c'+mt.e+'\u201d 同时出现，建议统一</div>';}});
  if(!mf)h+='<div class="finding ok">\u2705 中英文术语使用一致</div>';

    if(typeof updLoad==='function')updLoad('拼写检查...',85);
  h += '<h4>📖 术语拼写检查</h4>';
  var sd={'神经网络':'神经网路','机器学习':'机器学习','深度学习':'深度学习'};var si=0;
  Object.keys(sd).forEach(function(cr){var rx=new RegExp(sd[cr],'g');var ct=(text.match(rx)||[]).length;if(ct>0){si++;h+='<div class="finding warn">⚠ 可能拼错: '+sd[cr]+' ('+ct+'次)，应为 '+cr+'</div>';}});
  if(!si)h+='<div class="finding ok">✅ 未检测到常见术语拼写错误</div>';
  if(typeof updLoad==='function')updLoad('检查缩写...',80);
  h+='<h4>\ud83d\udcdd 缩写首次使用检查</h4>';
  var ab=[{r:/\bCNN\b/g,f:'卷积神经网络(Convolutional Neural Network)'},{r:/\bRNN\b/g,f:'循环神经网络(Recurrent Neural Network)'},{r:/\bLSTM\b/g,f:'长短期记忆网络(Long Short-Term Memory)'},{r:/\bSVM\b/g,f:'支持向量机(Support Vector Machine)'},{r:/\bNLP\b/g,f:'自然语言处理(Natural Language Processing)'},{r:/\bPCA\b/g,f:'主成分分析(Principal Component Analysis)'},{r:/\bGAN\b/g,f:'生成对抗网络(Generative Adversarial Network)'},{r:/\bIoT\b/g,f:'物联网(Internet of Things)'},{r:/\bAPI\b/g,f:'应用程序接口(Application Programming Interface)'},{r:/\bGPU\b/g,f:'图形处理器(Graphics Processing Unit)'},{r:/\bROC\b/g,f:'受试者工作特征(Receiver Operating Characteristic)'},{r:/\bAUC\b/g,f:'曲线下面积(Area Under Curve)'},{r:/\bMSE\b/g,f:'均方误差(Mean Squared Error)'},{r:/\bMAE\b/g,f:'平均绝对误差(Mean Absolute Error)'}];
  var abf=false;
  ab.forEach(function(ap){var ms=text.match(ap.r);if(ms&&ms.length>0){var fi=text.indexOf(ms[0]),bf2=text.substring(Math.max(0,fi-120),fi);if(bf2.indexOf(ap.f.substring(0,Math.min(8,ap.f.length)))<0){abf=true;h+='<div class="finding warn">\u26a0 \u201c'+ms[0]+'\u201d 首次未给出全称（'+ap.f+'），共 '+ms.length+' 次</div>';}}});
  if(!abf)h+='<div class="finding ok">\u2705 检测到的缩写均已正确给出全称</div>';

  h += '<h4>📝 外文术语翻译一致性</h4>';
  var transPairs=[{en:'CNN',cn:'卷积神经网络'},{en:'RNN',cn:'循环神经网络'},{en:'SVM',cn:'支持向量机'},{en:'NLP',cn:'自然语言处理'},{en:'PCA',cn:'主成分分析'}];
  var transIssues=0;
  transPairs.forEach(function(p){
    var enRx=new RegExp('\\\\b'+p.en+'\\\\b','gi');var enCount=(text.match(enRx)||[]).length;
    if(enCount>0&&text.indexOf(p.cn)<0){transIssues++;h+='<div class="finding warn">⚠ '+p.en+' 出现 '+enCount+' 次，但未找到其中文翻译 '+p.cn+'</div>';}
  });
  if(!transIssues)h+='<div class="finding ok">✅ 外文术语均有对应中文翻译</div>';

    h += '<h4>🏷️ 专有名词库</h4>';
  var pn={};var pnM, pnR=/\b[A-Z][A-Za-z]{2,}(?:\s+[A-Z][A-Za-z]{2,})?\b/g;
  while((pnM=pnR.exec(text))!==null){var pw=pnM[0];pn[pw]=(pn[pw]||0)+1;}
  var pl=Object.entries(pn).filter(function(e){return e[1]>=3;}).sort(function(a,b){return b[1]-a[1];}).slice(0,15);
  if(pl.length){pl.forEach(function(e){h+='<span class="term-tag">'+e[0]+' ('+e[1]+')</span>';});}else{h+='<div class="finding info">📌 未检测到足够的专有名词</div>';}
  if(typeof updLoad==='function')updLoad('完成',100);
  h+='</div>';
  container.innerHTML = h;
}
