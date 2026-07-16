"use strict";var existingRefs=[],manuscriptText='',manuscriptHTML='',mergedRefs=[],paperTopics=[],zoomLevel=1,sections=[],selNavIdx=-1,searchRunning=false,appReady=false,_bareHeadingCount=0,_totalHeadingCount=0;
// 全文树索引：chapters/sections/subs/paragraphs/sentences 全局扁平数组，O(1) 查找
var _treeIndex={chapters:[],sections:[],subs:[],paragraphs:[],sentences:[]};
window.onerror=function(m,s,l,c,e){console.error(m,'@',s,':',l);document.getElementById('statusBar')&&(document.getElementById('statusBar').textContent='⚠ 出现错误，请刷新页面');return true};
// 评分维度的解释提示
var _scoreInfo={conf:'🔍 真实度：文献在数据库中是否真实存在。DOI精确匹配=高可信；多源标题匹配=可信；无法匹配=低。',topicRel:'🎯 主题相关度：文献标题关键词与论文全文关键词的交集比例。分数越高，文献越贴合论文主题。',secFit:'📂 章节适配度：文献标题关键词与所在章节内容的交叉匹配比例。反映该文献是否适合放在此章。',dupRate:'📝 句子重合度：文献关键词与插入位置上下文关键词的交集。数值高=插入的句子和文献主题高度吻合。'};
// Init complete

// UTILS
function norm(s){return(s||'').toLowerCase().replace(/[^一-鿿a-z0-9]/g,'')}
function cnDigit(s){var m={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,'十六':16,'十七':17,'十八':18,'十九':19,'二十':20};return m[s]||parseInt(s)||0}
function bigramOverlap(a,b){if(!a||!b)return 0;var sa=new Set(),sb=new Set(),ta=norm(a),tb=norm(b);for(var i=0;i<ta.length-1;i++)sa.add(ta.substring(i,i+2));for(var i=0;i<tb.length-1;i++)sb.add(tb.substring(i,i+2));var h=0;sa.forEach(function(g){if(sb.has(g))h++});return Math.max(sa.size,sb.size)>0?h/Math.max(sa.size,sb.size):0}

// 关键词余弦相似度（替代bigram重叠率，更准确）
function keywordCosineSimilarity(textA, textB) {
  var kwsA = extractTitleKws(textA), kwsB = extractTitleKws(textB);
  if (!kwsA.length || !kwsB.length) return 0;
  var allWords = {}; kwsA.forEach(function(w) { allWords[w] = (allWords[w] || 0) + 1; });
  kwsB.forEach(function(w) { allWords[w] = (allWords[w] || 0) + 1; });
  var vecA = kwsA.filter(function(w, i) { return kwsA.indexOf(w) === i; }).map(function(w) { return allWords[w] > 0 ? 1 : 0; });
  var vecB = kwsB.filter(function(w, i) { return kwsB.indexOf(w) === i; }).map(function(w) { return allWords[w] > 0 ? 1 : 0; });
  // Simplified: use keyword set overlap Jaccard coefficient
  var setA = new Set(kwsA), setB = new Set(kwsB);
  var intersection = 0; setA.forEach(function(w) { if (setB.has(w)) intersection++; });
  var union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}
function ttp(m){var t=document.getElementById('ttp');t.textContent=m;t.style.opacity='1';t.style.left='80px';t.style.top='50px';setTimeout(function(){t.style.opacity='0'},2000)}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms||0)})}
// 分片异步遍历：每 chunkSize 个元素后让出主线程，防止浏览器卡死
async function forEachChunked(arr,fn,chunkSize){chunkSize=chunkSize||200;for(var i=0;i<arr.length;i+=chunkSize){var end=Math.min(i+chunkSize,arr.length);for(var j=i;j<end;j++)fn(arr[j],j);await sleep(0);}}
function extractCtxBeforeMarker(txt,refN){
  if(!txt||!refN)return'';
  var plain=txt.replace(/\s+/g,' ').trim();
  var marker='['+refN+']',pos=plain.indexOf(marker);
  if(pos<0)return plain.substring(0,80)+(plain.length>80?'…':'');
  // 如果角标在文本最开头(参考文献列表)，往后多取一些
  var halfWin=pos===0?50:25;
  var start=Math.max(0,pos-halfWin),end=Math.min(plain.length,pos+marker.length+halfWin);
  var ctx=plain.substring(start,end).trim();
  if(start>0)ctx='…'+ctx;if(end<plain.length)ctx=ctx+'…';
  return ctx;
}
function showLoad(m,p,d){var o=document.getElementById('loadOv');o.classList.add('show');document.getElementById('loadMsg').textContent=m;if(p!==undefined){document.getElementById('loadPct').style.display='block';document.getElementById('loadPct').textContent=p+'%';document.getElementById('loadBar').style.width=p+'%'}document.getElementById('loadDetail').textContent=d||''}
function updLoad(m,p,d){document.getElementById('loadMsg').textContent=m;if(p!==undefined){document.getElementById('loadPct').style.display='block';document.getElementById('loadPct').textContent=p+'%';document.getElementById('loadBar').style.width=p+'%'}if(d)document.getElementById('loadDetail').textContent=d}
function hideLoad(){document.getElementById('loadOv').classList.remove('show')}
function zoomThesis(d,r){if(r)zoomLevel=1;else zoomLevel=Math.max(0.5,Math.min(2,zoomLevel+d));document.getElementById('thesisBox').style.zoom=zoomLevel;document.getElementById('zoomLabel').textContent=Math.round(zoomLevel*100)+'%'}

(function(){var a=document.getElementById('navResizer'),b=document.getElementById('navSidebar'),d=false;if(a&&b){a.addEventListener('mousedown',function(e){d=true;e.preventDefault()});document.addEventListener('mousemove',function(e){if(!d)return;b.style.width=Math.max(140,Math.min(400,e.clientX))+'px'});document.addEventListener('mouseup',function(){d=false})}var c=document.getElementById('refResizer'),p=document.getElementById('refPanel'),e=false;if(c&&p){c.addEventListener('mousedown',function(ev){e=true;ev.preventDefault()});document.addEventListener('mousemove',function(ev){if(!e)return;p.style.width=Math.max(300,Math.min(750,window.innerWidth-ev.clientX))+'px'});document.addEventListener('mouseup',function(){e=false})}})();

async function parseDocxStructure(buf){var zip=await JSZip.loadAsync(buf),xml=await zip.file('word/document.xml').async('string'),all=[],pm,pr=/<w:p[ >][\s\S]*?<\/w:p>/g;while((pm=pr.exec(xml))!==null){var p=pm[0],sm=p.match(/<w:pStyle[^>]*w:val="(\d+)"/),style=sm?sm[1]:'',tx=[],tm,tr=/<w:t[^>]*>([^<]*)<\/w:t>/g;while((tm=tr.exec(p))!==null)tx.push(tm[1]);all.push({style:style,text:tx.join(''),idx:all.length})}var tree=[],curCh=null,curSec=null;for(var i=0;i<all.length;i++){var a=all[i];if((a.style==='14'||(parseInt(a.style)>=1&&parseInt(a.style)<=9))&&a.text){var m=a.text.match(/^第([一-龥\d]+)章\s*(.*)/),c=m?cnDigit(m[1]):(tree.length+1);curCh={ch:c,name:a.text,paraIdx:a.idx,sections:[]};tree.push(curCh);curSec=null}else if((a.style==='15'||(parseInt(a.style)>=10&&parseInt(a.style)<=20))&&curCh&&a.text){var sm=a.text.match(/^(\d+\.\d+)\s*(.*)/);curSec={num:sm?sm[1]:a.text.substring(0,5),title:sm?sm[2]:a.text,paraIdx:a.idx,subs:[]};curCh.sections.push(curSec)}else if(a.style==='16'&&curSec&&a.text){var sm2=a.text.match(/^(\d+\.\d+\.\d+)\s*(.*)/);curSec.subs.push({num:sm2?sm2[1]:a.text.substring(0,7),title:sm2?sm2[2]:a.text,paraIdx:a.idx})}}if(!tree.length){var chSet={};for(var i2=0;i2<all.length;i2++){var a2=all[i2];var chM2=a2.text.match(/^第([一-龥\d]+)章\s*(.*)/);if(chM2&&!chSet[cnDigit(chM2[1])]){var c2=cnDigit(chM2[1]);chSet[c2]=true;tree.push({ch:c2,name:a2.text,paraIdx:a2.idx,sections:[]});}}}return tree}

function markAnchors(tree){var box=document.getElementById('thesisBox');if(!box||!tree)return;var headings=[];for(var ci=0;ci<tree.length;ci++){var c=tree[ci];headings.push({id:'ch-'+c.ch,text:c.name});for(var si=0;si<c.sections.length;si++){var s=c.sections[si];headings.push({id:'sec-'+s.num.replace(/[.]/g,'-'),text:s.num+' '+s.title});for(var ui=0;ui<s.subs.length;ui++){var u=s.subs[ui];headings.push({id:'sub-'+u.num.replace(/[.]/g,'-'),text:u.num+' '+u.title})}}}var tw=document.createTreeWalker(box,NodeFilter.SHOW_TEXT,null,false),tmap=[],full='',tn=tw.firstChild();while(tn){var t=tn.textContent||'';tmap.push({node:tn,start:full.length,end:full.length+t.length});full+=t;tn=tw.nextNode()}var normed=full.replace(/\s+/g,'');headings.forEach(function(hd){var q=hd.text.replace(/\s+/g,''),last=-1,idx=-1;while((idx=normed.indexOf(q,idx+1))>=0)last=idx;if(last<0)return;var fi=0,ni=0;while(ni<last&&fi<full.length){if(/[\s\n\t]/.test(full[fi])){fi++;continue}ni++;fi++}for(var ti=0;ti<tmap.length;ti++){if(fi>=tmap[ti].start&&fi<tmap[ti].end){var el=tmap[ti].node.parentElement;while(el&&el!==box&&!/^(p|h[1-6]|li|div|td|th|blockquote)$/i.test(el.tagName||''))el=el.parentElement;if(el&&el!==box&&!el.id)el.id=hd.id;break}}})}
function scrollTo(id){var el=document.getElementById(id);if(!el)return false;el.scrollIntoView({behavior:'smooth',block:'start'});el.style.transition='background .3s';el.style.background='#fef3c7';setTimeout(function(){el.style.background=''},1800);return true}
function chapterForElement(el){var box=document.getElementById('thesisBox'),tw=document.createTreeWalker(box,NodeFilter.SHOW_ELEMENT,null,false),node=tw.firstChild(),lc=1;while(node&&node!==el){if(node.id&&/^ch-/.test(node.id))lc=parseInt(node.id.replace('ch-',''));node=tw.nextNode()}return lc}

function bodyBoundaryEl(){
  var box=document.getElementById('thesisBox');if(!box)return null;
  // 搜索包含"参考文献"开头的任意元素，包括被panel包装后的
  var els=box.querySelectorAll('p,h1,h2,h3,h4,h5,h6,div,li,span');
  for(var i=0;i<els.length;i++){
    var t=(els[i].textContent||'').replace(/\s+/g,'');
    if(t.indexOf('参考文献')===0&&t.length<20)return els[i];
  }
  return null;
}
function beforeRefList(el){var b=bodyBoundaryEl();if(!b)return true;return !(el.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)||el===b}
function firstBodyChEl(){return document.getElementById('ch-1')}

function wrapExistingMarkers(refs){
  try{
  var box=document.getElementById('thesisBox');if(!box||!refs.length)return;
  // DOM 标记：将 [N] 文本替换为可点击 span
  var refMap=new Map();refs.forEach(function(r){if(r.num)refMap.set(r.num,r)});
  var tw=document.createTreeWalker(box,NodeFilter.SHOW_TEXT,null,false),nodes=[];
  for(var tn=tw.nextNode();tn;tn=tw.nextNode())nodes.push(tn);

  for(var i=nodes.length-1;i>=0;i--){
    var node=nodes[i],txt=node.textContent||'',p=node.parentElement;
    if(!beforeRefList(p))continue;
    var ch1El=document.getElementById('ch-1');
    if(ch1El&&p!==ch1El&&(p.compareDocumentPosition(ch1El)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
    var skip=false;
    while(p&&p!==box){
      if(p.id&&/^(?:e?r)\d/.test(p.id)){skip=true;break}
      p=p.parentElement
    }
    if(skip)continue;

    var re=/\[(\d+)\]/g,m,frag=document.createDocumentFragment(),lastIdx=0,any=false;
    while((m=re.exec(txt))!==null){
      var n=parseInt(m[1]);
      var matchRef=refMap.get(n);
      if(!matchRef)continue;
      any=true;
      if(m.index>lastIdx)frag.appendChild(document.createTextNode(txt.substring(lastIdx,m.index)));

      var newNum=matchRef.displayNum||n;
      var cls='cite-marker '+(matchRef.subType==='unchanged'?'existing':(matchRef.subType==='displaced'?'displaced':'generated'));
      var span=document.createElement('span');
      span.className=cls;
      span.textContent='['+newNum+']';
      span.title='引用['+newNum+']'+(matchRef.subType==='displaced'?' (原['+n+'])':'');
      span.onclick=function(nn){return function(e){e.stopPropagation();scrollToRef(nn)}}(newNum);

      matchRef._domEl=span;
      matchRef._paraEl=node.parentElement;
      if(!matchRef._isOriginal){matchRef._ctx=extractCtxBeforeMarker(txt,n);}
      var ctx1=matchRef._ctx;
      if(ctx1){
        var kw3=extractTitleKws(matchRef.title||'');
        if(kw3.length>0){
          var sk3=extractTitleKws(ctx1);
          var o3=sk3.filter(function(w){return kw3.indexOf(w)>=0}).length;
          matchRef._dupRate=Math.min(95,Math.round(o3/Math.max(1,(sk3.length+kw3.length)/2)*100));
        }
      }

      // 关联到 _treeIndex 句子
      if(_treeIndex&&_treeIndex.sentences.length){
        for(var si=0;si<_treeIndex.sentences.length;si++){
          var sent=_treeIndex.sentences[si];
          if(!sent._paragraph||!sent._paragraph.el)continue;
          if(sent._paragraph.el===node.parentElement||sent._paragraph.el.contains(span.firstChild||span)){
            if(!sent.refs)sent.refs=[];
            if(sent.refs.indexOf(newNum)<0)sent.refs.push(newNum);
            if(!sent._paragraph.el.contains(span))matchRef._paragraphEl=sent._paragraph.el;
            break;
          }
        }
      }

      frag.appendChild(span);
      lastIdx=m.index+m[0].length
    }
    if(any){
      if(lastIdx<txt.length)frag.appendChild(document.createTextNode(txt.substring(lastIdx)));
      node.parentElement.replaceChild(frag,node)
    }
  }

  }catch(e){console.warn('[wrap] error:',e.message);}
}
function injectNewMarkers(refs){
  if(!_treeIndex||!_treeIndex.sentences.length)return;
  var byCh={};refs.forEach(function(r){var ck=r.ch||1;if(!byCh[ck])byCh[ck]=[];byCh[ck].push(r);});
  var sentHit={};
  Object.keys(byCh).forEach(function(chNum){
    var chIdx=-1;for(var i=0;i<_treeIndex.chapters.length;i++){if(_treeIndex.chapters[i].ch===parseInt(chNum)){chIdx=i;break;}}
    if(chIdx<0)return;
    var chNode=_treeIndex.chapters[chIdx].node,chRefs=byCh[chNum];
    var allSents=[];
    (function walk(n){if(n.paragraphs)n.paragraphs.forEach(function(p){p.sentences.forEach(function(s){allSents.push({sent:s,para:p,parent:n});});});var kids=n.sections||n.subs||[];kids.forEach(function(k){walk(k);});})(chNode);
    if(!allSents.length)return;
    var used=new Set();
    allSents.forEach(function(si){
      if(used.size>=chRefs.length)return;
      var br=null,bs=0;
      chRefs.forEach(function(r){if(used.has(r))return;var kw=extractTitleKws(r.title||'');var sc=kw.reduce(function(s,w){return s+(si.sent.text.toLowerCase().indexOf(w)>=0?1:0)},0);if(sc>=2&&sc>bs){bs=sc;br=r;}});
      if(br){used.add(br);var si2=si.sent._idx;if(!sentHit[si2])sentHit[si2]=[];sentHit[si2].push(br);br._sentence=si.sent;br._ctx=si.sent.text.substring(0,80);
        br._chName=_treeIndex.chapters[chIdx]?(_treeIndex.chapters[chIdx].name||''):'';}
    });
  });
  for(var si3 in sentHit){
    var refs2=sentHit[si3],sent=_treeIndex.sentences[parseInt(si3)];
    if(!sent||!sent._paragraph||!sent._paragraph.el)continue;
    sent.refs=refs2.map(function(r){return r.displayNum||r.num;});
    var paraEl=sent._paragraph.el;
    refs2.forEach(function(r){
      var n=r.displayNum||r.num;
      var sp=document.createElement('span');sp.className='cite-marker generated';sp.textContent='['+n+']';
      sp.onclick=function(nn){return function(e){e.stopPropagation();scrollToRef(nn);}}(n);
      r._domEl=sp;paraEl.appendChild(sp);
    });
  }
}
function scrollToRef(n){var el=document.getElementById('r'+(n-1))||document.getElementById('er'+(n-1));if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.transition='background .3s';el.style.background='#fef3c7';setTimeout(function(){el.style.background=''},2000)}else ttp('未找到['+n+']')}

function renderNavTree(tree){
  var c=document.getElementById('navTree');
  var meta=document.getElementById('navTreeMeta');
  if(!c)return;
  if(!tree||!tree.length){
    c.innerHTML='<i style="color:rgba(255,255,255,.25);font-size:.65rem;padding:8px;display:block">未检测到章节，可在标题校准中指定</i>';
    if(meta){meta.style.display='none';}
    return;
  }
  var h='',idx=0,chN=0,secN=0,subN=0;
  function rnr(nodes,level){
    for(var i=0;i<nodes.length;i++){
      var n=nodes[i];
      var cls=level===0?'ch':(level===1?'sec':'sub');
      if(level===0)chN++; else if(level===1)secN++; else subN++;
      var numId=(n.num||'').toString().replace(/[.]/g,'-');
      var id=level===0?('ch-'+n.ch):((level===1?'sec-':'sub-')+numId);
      var label=level===0?(n.name||('第'+n.ch+'章')):(((n.num||'')+' '+(n.title||'')).trim());
      var padLeft=level===0?8:(level===1?18:30);
      h+='<div class="tree-node '+cls+'" data-idx="'+(idx++)+'" data-id="'+id+'" onclick="navClick2(this)" style="padding-left:'+padLeft+'px" title="'+String(label).replace(/"/g,'&quot;')+'">'+label+'</div>';
      var kids=n.sections||n.subs||[];
      if(kids.length)rnr(kids,level+1);
    }
  }
  rnr(tree,0);
  c.innerHTML=h;
  c.scrollTop=0;
  if(meta){meta.style.display='block';meta.textContent=chN+' 章 · '+secN+' 节 · '+subN+' 小节';}
}


function navClick2(el){
  var id=el.getAttribute('data-id'),target=document.getElementById(id);
  if(!target)return;
  // 如果target隐藏了，往上找panel的head作为可见目标
  var vis=target;
  if(!target.offsetParent||target.style.display==='none'){
    var p=target.parentElement;
    while(p){
      var cl=p.className||'',m=cl.match(/(\w+)-panel/);
      if(m){vis=p.querySelector('.'+m[1]+'-head')||p;break;}
      p=p.parentElement;
    }
  }
  if(!vis)return;
  vis.scrollIntoView({behavior:'smooth',block:'start'});
  vis.style.transition='background .3s';vis.style.background='#fef3c7';
  setTimeout(function(){vis.style.background=''},1800);
  var ns=document.querySelectorAll('.tree-node');
  for(var i=0;i<ns.length;i++)ns[i].classList.remove('sel');
  el.classList.add('sel');selNavIdx=parseInt(el.getAttribute('data-idx')||'-1');
  // 往上展开所有折叠的父panel
  var pp=vis.parentElement;
  while(pp){
    if(pp.nodeType===1){var cl=pp.className||'',m=cl.match(/(\w+)-panel/);if(m){
      var body=pp.querySelector('.'+m[1]+'-body');
      if(body&&body.classList.contains('collapsed')){body.classList.remove('collapsed');body.style.maxHeight=(body._fh||body._fullHeight||body.scrollHeight)+'px';var arr=pp.querySelector('.toggle-arrow');if(arr)arr.classList.add('open');}
    }}
    pp=pp.parentElement;
  }
}

function extractTextFromXml(xml){var re=/<w:t[^>]*>([^<]*)<\/w:t>/g,parts=[],m;while((m=re.exec(xml))!==null)parts.push(m[1]);return parts.join('').replace(/\s+/g,' ').trim()}
async function extractRefsFromRawDocx(buf){
  var zip=await JSZip.loadAsync(buf);
  var xml=await zip.file('word/document.xml').async('string');

  // Split into paragraphs and extract text + style for each
  var paraBlocks=xml.split('<w:p ');
  var paras=[];
  for(var pbi=1;pbi<paraBlocks.length;pbi++){
    var pBlock='<w:p '+paraBlocks[pbi];
    // Skip table content
    if(pBlock.indexOf('<w:tbl>')>=0||pBlock.indexOf('<w:tbl ')>=0)continue;
    var txt=extractTextFromXml(pBlock);
    if(!txt||txt.length<2)continue;
    // Inline field codes (TOC/HYPERLINK/PAGEREF) — skip
    if(/^(?:HYPERLINK|PAGEREF|_Toc|TOC)/.test(txt))continue;
    if(/^[\d\s.]*$/.test(txt))continue;
    // Style hint: check if this paragraph has a numbered style like "参考文献"
    var sm=pBlock.match(/<w:pStyle[^>]*w:val="([^"]*)"/);
    var styleId=sm?sm[1]:'';
    paras.push({text:txt,styleId:styleId});
  }

  // Find the reference section boundary
  var refStartIdx=-1;
  var refHeaderPatterns=[/^参考文献\s*$/i,/^參考文獻\s*$/i,/^References\s*$/i];
  for(var pi=0;pi<paras.length;pi++){
    var t=paras[pi].text.replace(/\s+/g,'');
    for(var h=0;h<refHeaderPatterns.length;h++){
      if(refHeaderPatterns[h].test(t)){refStartIdx=pi;break;}
    }
    if(refStartIdx>=0)break;
  }
  if(refStartIdx<0){
    // Fallback: search for paragraph containing 参考文献 anywhere
    for(var pi2=0;pi2<paras.length;pi2++){
      if(/参考文献/.test(paras[pi2].text.replace(/\s+/g,''))&&paras[pi2].text.replace(/\s+/g,'').length<30){
        refStartIdx=pi2;break;
      }
    }
  }
  if(refStartIdx<0){console.log('[refs] No "参考文献" boundary found');return [];}
  console.log('[refs] Found reference boundary at paragraph index '+refStartIdx+': "'+paras[refStartIdx].text.substring(0,50)+'"');

  // Collect reference entries from paragraphs after the boundary
  var tailParas=paras.slice(refStartIdx+1);
  if(!tailParas.length)return [];

  var rawRefs=[];
  var stopWords=/^(致谢|附录|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读|Abstract|Acknowledg|作者简介|在读期间)/;
  var refNumStart=/^\[?(\d+)\]?[\s\.、．—\[\]]+/;  // [1], 1., 1、, 1— etc

  for(var ri=0;ri<tailParas.length;ri++){
    var txt=tailParas[ri].text;
    if(stopWords.test(txt.replace(/\s+/g,'')))break;
    if(txt.length<6)continue;
    // Check if starts a new reference
    var nm=txt.match(refNumStart);
    if(nm){
      // Strip the leading number and bracket for cleaner display
      var clean=txt.replace(/^\[?\d+\]?[\s\.、．—\[\]…]+/,'').replace(/^\s+/,'');
      rawRefs.push(clean);
    }else if(rawRefs.length>0){
      // Continuation of previous reference
      rawRefs[rawRefs.length-1]+=' '+txt;
    }else{
      // First ref might not have a number prefix
      rawRefs.push(txt.replace(/^\s*参考文献\s*/,'').replace(/^\s+/,''));
    }
  }

  console.log('[refs] Extracted '+rawRefs.length+' references from '+tailParas.length+' tail paragraphs');
  return rawRefs.map(function(ci,i){
    return {num:i+1,ci:ci.replace(/\s+/g,' ').trim()};
  });
}
function parseRefMeta(ci){
  if(!ci)return{title:'',journal:'',year:'',doi:''};
  var t2=ci.replace(/\s+/g,' ').trim(),title='',journal='',year='',doi='';
  // DOI
  var dm=t2.match(/DOI[:：]\s*(\S+)/i);
  if(dm)doi=dm[1];
  // 年份
  var ym=t2.match(/\b((?:19|20)\d{2})\b/);
  if(ym)year=ym[1];
  // 中文GB/T 7714: "作者. 标题[J]. 期刊, 年份" 或 "标题[J]. 期刊"
  // 优先匹配 [J]/[D]/[M]/[C] 前的标题
  var cm=t2.match(/[.\s]\s*([^\]\[]+?)\s*\[([JDCMPR])\]/);
  if(cm){
    title=cm[1].trim();
    var rest=t2.substring(t2.indexOf(cm[0])+cm[0].length);
    var jm=rest.match(/^\.?\s*([^,，\d]+)/);
    if(jm)journal=jm[1].trim();
  }else{
    // fallback: 英文用逗号分割取后半段，中文取第一句
    var isCN=/[一-龥]/.test(t2);
    if(isCN){var parts2=t2.split(/[\.。]/g);if(parts2.length>1&&parts2[0].length>5)title=parts2[0].trim();else title=t2.substring(0,Math.min(120,t2.length)).trim();}
    else{var commaIdx=t2.lastIndexOf(',');if(commaIdx>0&&commaIdx<t2.length-10){var afterComma=t2.substring(commaIdx+1).trim();title=afterComma.replace(/^\s*\d{4}[a-z]?[\.\s]*/,'').trim();}if(!title||title.length<8)title=t2.substring(0,Math.min(200,t2.length)).trim();}
  }
  return{title:title,doi:doi,yr:year,journal:journal};
}
// 提取论文主题词：中文bigram + 英文长词，按频次排序
function extractTopics(text){
  var m={};
  var raw=text.replace(/<[^>]+>/g,'');
  // 中文bigram（仅中文字符）
  var cn=raw.replace(/[^一-鿿]/g,'');
  for(var i=0;i<cn.length-1;i++){var bg=cn.substring(i,i+2);m[bg]=(m[bg]||0)+1}
  // 英文专业词（大写开头的词如XGBoost, SHAP 等）
  var en=raw.match(/[A-Z][a-zA-Z]{2,}/g)||[];
  en.forEach(function(w){m[w]=(m[w]||0)+3});
  // 普通英文长词
  raw.replace(/[^a-zA-Z\s]/g,' ').split(/\s+/).filter(function(w){return w.length>=4}).forEach(function(w){var lw=w.toLowerCase();m[lw]=(m[lw]||0)+1});
  // 章节标题加权（降低权重+过滤常见无意义词）
  var stopBigrams={};'研究分析基于技术应用系统设计实现模型理论实践发展影响因素对策建议问题策略现状趋势综述'.match(/../g).forEach(function(s){stopBigrams[s]=1});
  sections.forEach(function(cs){
    var cnCh=cs.name.replace(/[^一-鿿]/g,'');
    for(var i=0;i<cnCh.length-1;i++){var bg=cnCh.substring(i,i+2);if(!stopBigrams[bg])m[bg]=(m[bg]||0)+1}
    if(cs.sections)cs.sections.forEach(function(sec){
      var cnSec=sec.title.replace(/[^一-鿿]/g,'');
      for(var i=0;i<cnSec.length-1;i++){var bg=cnSec.substring(i,i+2);if(!stopBigrams[bg])m[bg]=(m[bg]||0)+1}
    });
  });
  return Object.entries(m).sort(function(a,b){return b[1]-a[1]}).map(function(e){return{label:e[0],count:e[1]}}).slice(0,20);
}

// 搜索缓存
var searchCache={};

// fuzzy 编辑距离
function editDist(a,b){
  if(!a||!b)return Math.max(a.length||0,b.length||0);
  var m=[],al=a.length,bl=b.length;
  for(var i=0;i<=al;i++){m[i]=[i];}
  for(var j=0;j<=bl;j++){m[0][j]=j;}
  for(var i=1;i<=al;i++){for(var j=1;j<=bl;j++){m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));}}
  return m[al][bl];
}
function fuzzyMatch(w,list){
  // 查找list中与w fuzzy相近的词，返回0-1相似度
  for(var i=0;i<list.length;i++){
    if(list[i].indexOf(w)>=0||w.indexOf(list[i])>=0)return 1;
    var d=editDist(w,list[i]),ml=Math.max(w.length,list[i].length);
    if(d<=2&&ml>=4)return 1-d/ml;
  }
  return 0;
}

function isChineseTitle(t){return /[一-龥]/.test(t||'')}
function calcTitleYear(ci){var m=(ci||'').match(/\b((?:19|20)\d{2})\b/);return m?parseInt(m[1]):0}
function formatGB7714(r){
  if(r.eType==='existing'&&r.ci)return r.ci.replace(/<[^>]+>/g,'').trim();
  var t2=(r.title&&r.title.trim()||r.ci||'未知标题').replace(/<[^>]+>/g,'').trim(),jn=(r.journal||'').replace(/<[^>]+>/g,'').trim(),yr=r.year||'',doi=r.doi||'';
  if(isChineseTitle(t2)){var au=(r.authors||'').replace(/,/g,', ').trim(),ci='';if(au)ci+=au+'. ';ci+=t2;var rtype=r.reftype||'J';if(jn)ci+='['+rtype+']. <em>'+jn+'</em>';else ci+='['+rtype+'].';if(yr)ci+=', '+yr;if(doi)ci+='. DOI: '+doi;else ci+='.';return ci}else{var au=(r.authors||'').split(',').map(function(a){return a.trim()}).filter(function(a){return a}).join(', '),al=au.split(','),as=al.length>3?al.slice(0,3).join(', ')+', et al.':au,ci='';if(as)ci+=as+'. ';ci+=t2+(t2.endsWith('.')?'':'.');var rtype2=r.reftype||'J';if(jn)ci+=' <em>'+jn+'</em>';if(yr)ci+=', '+yr;if(doi)ci+=', DOI: '+doi;ci+='.';return ci}}
function isRefChinese(r){return /[一-龥]/.test((r.ci||r.title||'').substring(0,5))}

// 从段落往前找最近的章/节/小节锚点（不依赖正则和关键词）
function findSectionForElement(el, refNum){
  var box=document.getElementById('thesisBox');
  if(!el||!el.nodeType||!box)return{ch:'',sec:'',sub:'',ctx:''};
  var paraEl=el;
  try{
    while(paraEl&&paraEl!==box&&paraEl.parentElement&&!/^(?:p|h[1-6]|div|li|td|blockquote)$/i.test(paraEl.tagName||'')){
      paraEl=paraEl.parentElement;
    }
    if(!paraEl)paraEl=el;
    if(!paraEl.nodeType)return{ch:'',sec:'',sub:'',ctx:''};
    var full=(paraEl.innerText||paraEl.textContent||'');
    var ctx=extractCtxBeforeMarker(full,refNum);
  }catch(e){return{ch:'',sec:'',sub:'',ctx:''};}
  var ch='',sec='',sub='',chNum=1;
  var p=paraEl;
  while(p&&p!==box){
    var cls=p.className||'';
    if(!sec&&cls.indexOf('sec-panel')>=0){sec=p.getAttribute('data-num')||'';}
    if(!sub&&cls.indexOf('sub-panel')>=0){sub=p.getAttribute('data-num')||'';}
    if(cls.indexOf('ch-panel')>=0||cls.indexOf('cover-panel')>=0||cls.indexOf('toc-panel')>=0){chNum=parseInt(p.getAttribute('data-ch'))||chNum;}
    p=p.parentElement;
  }
  chNum=chapterForElement(paraEl)||chNum;
  var chN={};sections.forEach(function(cs){if(cs.ch&&cs.name)chN[cs.ch]=cs.name});
  for(var i=1;i<=10;i++)if(!chN[i])chN[i]='第'+i+'章';
  var chName=chN[chNum]||('第'+chNum+'章'),secTitle='',subTitle='';
  var chObj=sections.find(function(s){return s.ch===chNum});
  if(chObj&&chObj.sections){
    var so=chObj.sections.find(function(s){return s.num===sec});
    if(so)secTitle=so.title;
    if(sub){chObj.sections.forEach(function(s){if(s.subs){
      var sso=s.subs.find(function(ss){return ss.num===sub});
      if(sso)subTitle=sso.title;
    }});}
  }
  return{ch:chName,sec:sec?(sec+(secTitle?' '+secTitle:'')):'',sub:sub?(sub+(subTitle?' '+subTitle:'')):'',ctx:ctx};
}

// 从 _treeIndex 查找引用的章节/节/小节位置（替代 DOM 查找）
function lookupRefPosition(r){
  // 优先用已存储的位置
  if(r._chName) return {ch:r._chName||'',sec:r._secName||'',sub:r._subName||'',ctx:r._ctx||''};
  // 从 _treeIndex 查找句子级关联
  if(_treeIndex&&_treeIndex.sentences.length){
    var refNum=r.displayNum||r.num;
    for(var i=0;i<_treeIndex.sentences.length;i++){
      var sent=_treeIndex.sentences[i];
      if(sent.refs&&sent.refs.indexOf(refNum)>=0){
        // 从句子往上找到章/节/小节
        var node=sent._parent;
        var chName='',secName='',subName='';
        if(node){
          if(node.ch!==undefined) chName=node.name||'';
          // Traverse up through _treeIndex to find section and subsection parents
          for(var ti=0;ti<_treeIndex.sections.length;ti++){
            var se=_treeIndex.sections[ti];
            if(se.node===node||(se.node.sections&&se.node.sections.indexOf(node)>=0)||(se.node.subs&&se.node.subs.indexOf(node)>=0)){
              secName=se.num+' '+se.title;subName=se._chapter?se._chapter.name:'';
              break;
            }
          }
          for(var ti2=0;ti2<_treeIndex.subs.length;ti2++){
            var su=_treeIndex.subs[ti2];
            if(su.node===node){subName=su.num+' '+su.title;break;}
          }
        }
        // Fallback to chapter index
        for(var ti3=0;ti3<_treeIndex.chapters.length;ti3++){
          if(!chName&&sent._paragraph&&sent._paragraph._parent){
            var pn=sent._paragraph._parent;
            if(pn.ch===_treeIndex.chapters[ti3].ch)chName=_treeIndex.chapters[ti3].name;
          }
        }
        return {ch:chName||('第'+(r.ch||1)+'章'),sec:secName,sub:subName,ctx:sent.text?sent.text.substring(0,80):(r._ctx||'')};
      }
    }
  }
  // Fallback: DOM 查找
  if(r._domEl){
    try{return findSectionForElement(r._domEl,r.displayNum);}catch(e){}
  }
  return {ch:'第'+(r.ch||1)+'章',sec:'',sub:'',ctx:r._ctx||''};
}

function jumpToDomEl(r){
  if(r&&r._domEl){
    try{
      // 展开所有折叠的父级body
      var pp=r._domEl.parentElement;
      while(pp){
        var cl=pp.className||'',m=cl.match(/(\w+)-body/);
        if(m&&pp.classList.contains('collapsed')){
          pp.classList.remove('collapsed');
          pp.style.maxHeight=(pp._fh||pp._fullHeight||pp.scrollHeight)+'px';
          var hd=pp.parentElement.querySelector('.'+m[1]+'-head');
          if(hd){var ar=hd.querySelector('.toggle-arrow');if(ar)ar.classList.add('open');}
        }
        pp=pp.parentElement;
      }
      r._domEl.scrollIntoView({behavior:'smooth',block:'center'});
      r._domEl.style.transition='background .3s';r._domEl.style.background='#fef3c7';
      setTimeout(function(){r._domEl.style.background=''},2000);
      return true;
    }catch(e){}
  }
  return false;
}
function jumpToCite(idx){var r=mergedRefs[idx];if(!r)return;if(jumpToDomEl(r))return ttp('已定位['+r.displayNum+']');var n=r.displayNum||(idx+1),marker='['+n+']',box=document.getElementById('thesisBox'),tw=document.createTreeWalker(box,NodeFilter.SHOW_ELEMENT,null,false),el=tw.firstChild();while(el){if(/^(p|li|h[1-6]|div|td|span)$/.test((el.tagName||'').toLowerCase())&&(el.textContent||'').indexOf(marker)>=0){jumpToDomEl({_domEl:el});return}el=tw.nextNode()}ttp('未在正文中找到'+marker)}

function updateDashboard(list){if(!list)list=[];var total=list.length,cn=0,en=0,y3=0,y5=0,now=new Date().getFullYear();list.forEach(function(r){if(isRefChinese(r))cn++;else en++;var yr2=r.year?parseInt(r.year):calcTitleYear(r.ci||r.title||'');if(yr2>=2020&&now-yr2<=3)y3++;if(yr2>=2020&&now-yr2<=5)y5++});var pct=function(n){return total>0?Math.round(n/total*100)+'%':''};var de=document.getElementById('dashTotal');if(de){de.textContent=total;de.nextElementSibling&&de.nextElementSibling.classList.contains('dl')&&(de.nextElementSibling.textContent='/ '+total+'条')}de=document.getElementById('dashCN');if(de){de.textContent=cn;var dl=de.parentElement.querySelector('.dl');if(dl)dl.textContent='中文 '+pct(cn)}de=document.getElementById('dashEN');if(de){de.textContent=en;var dl=de.parentElement.querySelector('.dl');if(dl)dl.textContent='英文 '+pct(en)}de=document.getElementById('dash3Y');if(de){de.textContent=y3;var dl=de.parentElement.querySelector('.dl');if(dl)dl.textContent='3年内 '+pct(y3)}de=document.getElementById('dash5Y');if(de){de.textContent=y5;var dl=de.parentElement.querySelector('.dl');if(dl)dl.textContent='5年内 '+pct(y5)}}

function populateChapterText(){
  var box=document.getElementById('thesisBox');
  if(!box||!sections.length)return;
  // Try finding chapter headings by text content
  var bodyChs=sections.filter(function(s){return!/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name)});
  bodyChs.forEach(function(cs,si){
    var id='ch-'+cs.ch;
    var el=document.getElementById(id);
    if(!el){
      // 确保章节不为空
      var allEls=box.querySelectorAll('*');
      for(var i=0;i<allEls.length;i++){
        var t=(allEls[i].textContent||'').replace(/\s+/g,'');
        if(t===cs.name.replace(/\s+/g,'')){el=allEls[i];break}
      }
    }
    if(!el){cs.text=manuscriptText;return}
    // Collect text after this heading until next chapter heading
    // Skip: empty nodes, page numbers, single digits, pure dates, TOC-like entries
    var t='',n=el.nextSibling,nextCh=si+1<bodyChs.length?('ch-'+bodyChs[si+1].ch):null,skipped=0;
    while(n){
      var nextId=n.id||'';
      if(nextCh&&nextId===nextCh)break;
      // stop at next chapter or section anchor
      if(nextId.indexOf('ch-')===0||nextId.indexOf('sec-')===0||nextId.indexOf('sub-')===0)break;
      var nodeTxt=(n.textContent||'').trim();
      if(nodeTxt){
        // Skip page numbers (1-3 pure digits or Roman numerals)
        if(/^[ivxlcdmIVXLCDM]+$/.test(nodeTxt)||/^\d{1,3}$/.test(nodeTxt)){n=n.nextSibling;skipped++;continue}
        // Skip TOC-like entries: short lines starting with numbers followed by dots/spaces
        if(/^\d+(\.\d+)*[\s\.]+[一-鿿]/.test(nodeTxt)&&nodeTxt.length<80){n=n.nextSibling;skipped++;continue}
        // Skip bare page number suffixes like "- 42 -"
        if(/^[-—–]\s*\d+\s*[-—–]$/.test(nodeTxt)){n=n.nextSibling;skipped++;continue}
        if(n.nodeType===3)t+=n.textContent+' ';
        else if(n.nodeType===1&&!nextId)t+=(nodeTxt+' ');
      }
      n=n.nextSibling
    }
    if(skipped>0)console.log('[populate] Skipped',skipped,'page-num/TOC nodes for ch',cs.ch);
    cs.text=t.trim()
  });
  // If all chapters got same/fallback text, split by chapter pattern
  var first=bodyChs[0]&&bodyChs[0].text;
  if(!first){bodyChs.forEach(function(cs){cs.text=manuscriptText});return}
  var allSame=bodyChs.every(function(cs){return cs.text===first||cs.text===manuscriptText});
  if(allSame&&bodyChs.length>1){
    // Split manuscriptText by chapter markers
    var pattern='('+bodyChs.map(function(cs){
      return cs.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    }).join('|')+')';
    var parts=manuscriptText.split(new RegExp(pattern));
    bodyChs.forEach(function(cs,i){
      var idx=bodyChs.indexOf(cs)*2+1;
      if(parts[idx])cs.text=parts[idx].trim()
      else cs.text=manuscriptText
    })
  }
}

function extractTitleKws(title){
  var t=(title||'').toLowerCase(),kws=[];
  var en=t.split(/[\s,.;:·「」『』（）()\-+]+/).filter(function(w){return w.length>2&&!/^[\d.]+$/.test(w)});
  kws=kws.concat(en);
  var cn=t.replace(/[a-z0-9\s,.;:·「」『』（）()\-+]+/gi,'');
  for(var j=0;j<cn.length-1;j++)kws.push(cn.substring(j,j+2));
  return Array.from(new Set(kws)).slice(0,12);
}

async function assignChapters(refs,mode,total){
  if(!refs.length||!sections.length)return;
  // Use fillNodeText-based text (set during upload), populateChapterText only as fallback
  if(!sections[0].text||sections[0].text===manuscriptText){
    if(typeof populateChapterText==='function')populateChapterText();
  }
  // Only use body chapters (excluding 参考文献/附录/致谢/获奖等)
  var bodyChs=sections.filter(function(s){return !/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name)});
  var n2=bodyChs.length,lastCh=bodyChs[n2-1].ch;
  if(!n2){console.warn('[assign] No body chapters found!');return}
  // Score against body chapters only
  await sleep(0);
  var scores=[];
  for(var sci=0;sci<refs.length;sci+=30){
    var sce=Math.min(sci+30,refs.length);
    for(var scj=sci;scj<sce;scj++){var r2=refs[scj];var kws=extractTitleKws(r2.title||"");scores[scj]=bodyChs.map(function(cs){var ct=(cs.text||"").toLowerCase();var h=kws.reduce(function(s,w){return s+(ct.indexOf(w)>=0?1:0)},0);return kws.length>0?h/kws.length:0;});}
    await sleep(0);
  }
  await sleep(0);
  var lCap=Math.max(1,Math.floor(refs.length*0.05));
  var targets=[];

  // === Distribute targets per chapter based on mode ===
  if(mode==='uniform'||mode==='weighted'){
    if(mode==='uniform'){
      var base=Math.floor(refs.length/n2),rem=refs.length-base*n2;
      bodyChs.forEach(function(cs,i){targets.push(base+(rem>0?1:0));if(rem>0)rem--});
    }else if(mode==='weighted'){
      var lens=bodyChs.map(function(cs){return Math.max(50,(cs.text||'').length)});
      var tl=lens.reduce(function(a,b){return a+b},0),asd=0;
      bodyChs.forEach(function(cs,i){var t=Math.round(refs.length*lens[i]/tl);targets.push(t);asd+=t});
      var diff=refs.length-asd;for(var i=0;i<Math.abs(diff);i++){if(diff>0)targets[i%n2]++;else{var j=i;while(targets[j%n2]<=1)j++;targets[j%n2]--}}
    }
    // Enforce last chapter cap, redistribute
    if(targets[n2-1]>lCap){var ex=targets[n2-1]-lCap;targets[n2-1]=lCap;for(var i=0;i<n2-1&&ex>0;i++){targets[i]++;ex--}}
    // Greedy assign: for each body chapter, pick best-scoring unassigned refs
    var assigned=new Set();
    bodyChs.forEach(function(cs,ci){
      var need=targets[ci];
      var cands=refs.map(function(r,i){return i}).filter(function(ri){return!assigned.has(ri)}).sort(function(a,b){return scores[b][ci]-scores[a][ci]});
      for(var k=0;k<Math.min(need,cands.length);k++){refs[cands[k]].ch=cs.ch;assigned.add(cands[k])}
    });
    // Assign remaining refs to best-matching body chapter
    refs.forEach(function(r,i){if(!assigned.has(i)){var bc=bodyChs[0].ch,bs=scores[i][0];bodyChs.forEach(function(cs,ci){if(scores[i][ci]>bs){bs=scores[i][ci];bc=cs.ch}});r.ch=bc}});
  }else{
    // Auto mode: best bigram match against body chapters, then enforce per-chapter max ~20%
    refs.forEach(function(r,ri){var bc=bodyChs[0].ch,bs=scores[ri][0];bodyChs.forEach(function(cs,ci){if(scores[ri][ci]>bs){bs=scores[ri][ci];bc=cs.ch}});r.ch=bc});
    // Cap: no chapter > 20% of total, no chapter < 1
    var maxPerCh=Math.max(2,Math.ceil(refs.length*0.20));
    var cts2={};bodyChs.forEach(function(cs){cts2[cs.ch]=0});refs.forEach(function(r){cts2[r.ch]=(cts2[r.ch]||0)+1});
    // Redistribute overflow from over-packed chapters
    var sortedChs=bodyChs.slice().sort(function(a,b){return(cts2[b.ch]||0)-(cts2[a.ch]||0)});
    sortedChs.forEach(function(cs){
      while((cts2[cs.ch]||0)>maxPerCh){
        var wr2=null,worstScore2=1,wrIdx2=-1;
        refs.forEach(function(rf,ri){if(rf.ch!==cs.ch)return;var sc3=scores[ri][bodyChs.findIndex(function(s){return s.ch===cs.ch})];if(sc3<worstScore2){worstScore2=sc3;wr2=rf;wrIdx2=ri}});
        if(!wr2)break;
        cts2[cs.ch]--;
        var bestAlt2=bodyChs[0].ch,bestAltScore2=0;
        bodyChs.forEach(function(bc2,ci2){if(bc2.ch===cs.ch||(cts2[bc2.ch]||0)>=maxPerCh)return;if(scores[wrIdx2][ci2]>bestAltScore2){bestAltScore2=scores[wrIdx2][ci2];bestAlt2=bc2.ch}});
        wr2.ch=bestAlt2;cts2[bestAlt2]=(cts2[bestAlt2]||0)+1;
      }
    });
  }

  // Find best section and subsection for each ref
  refs.forEach(function(r,ri){
    var kw=extractTitleKws(r.title);
    var bestH2=0,bestSec='',bestH3=0,bestSub='',cs2=null;
    bodyChs.forEach(function(s2){if(s2.ch===r.ch)cs2=s2});
    if(cs2&&cs2.sections){
      cs2.sections.forEach(function(sec){
        var st=(sec.num+' '+sec.title).toLowerCase();
        var h2=kw.reduce(function(s,w){return s+(st.indexOf(w)>=0?1:0)},0);
        if(h2>bestH2){bestH2=h2;bestSec=sec.num}
        if(sec.subs){
          sec.subs.forEach(function(subSec){
            var st2=(subSec.num+' '+subSec.title).toLowerCase();
            var h3=kw.reduce(function(s,w){return s+(st2.indexOf(w)>=0?1:0)},0);
            if(h3>bestH3){bestH3=h3;bestSub=subSec.num}
          });
        }
      });
    }
    // 如果节匹配不到，用章节内容文本再试
    if(!bestSec&&cs2&&cs2.text&&cs2.sections){
      cs2.sections.forEach(function(sec){
        // Search chapter text for section number + title (ignore whitespace differences)
        var st=(cs2.text||'').replace(/\s+/g,'').toLowerCase();
        var searchNum=(sec.num||'').replace(/\s+/g,'');
        var searchTitle=(sec.title||'').replace(/\s+/g,'');
        var idx2=st.indexOf(searchNum+searchTitle);
        if(idx2>=0){
          // 检查节标题附近有没有关键词
          var nearby=st.substring(Math.max(0,idx2-200),Math.min(st.length,idx2+500));
          var h2=kw.reduce(function(s,w){return s+(nearby.indexOf(w)>=0?1:0)},0);
          if(h2>bestH2){bestH2=h2;bestSec=sec.num}
        }
      });
    }
    r._bestSec=bestSec;
    r._bestSub=bestSub;
  });

  // === HARD CONSTRAINTS ===
  // Rule A: Every body chapter >= 1
  var counts={};bodyChs.forEach(function(cs){counts[cs.ch]=0});refs.forEach(function(r){counts[r.ch]=(counts[r.ch]||0)+1});
  bodyChs.forEach(function(cs){
    if(counts[cs.ch]>=1)return;
    var br=null,bs2B=-1,siB=bodyChs.findIndex(function(sx){return sx.ch===cs.ch});
    refs.forEach(function(rf,ri){if(rf.ch===cs.ch)return;if(scores[ri][siB]>bs2B){bs2B=scores[ri][siB];br=rf}});
    if(br){counts[br.ch]--;br.ch=cs.ch;counts[cs.ch]++}
  });
  // Rule B: Last chapter <= lCap
  while(counts[lastCh]>lCap){
    var wr=null,wsW=1;refs.forEach(function(rf,ri){if(rf.ch!==lastCh)return;var scW=scores[ri][bodyChs.findIndex(function(sx){return sx.ch===lastCh})];if(scW<wsW){wsW=scW;wr=rf}});
    if(!wr)break;
    var baC=bodyChs[0].ch,bScoreC=0;refs.forEach(function(r2,ri){if(r2!==wr)return;bodyChs.forEach(function(cs,ci){if(cs.ch===lastCh)return;if(scores[ri][ci]>bScoreC){bScoreC=scores[ri][ci];baC=cs.ch}})});
    counts[lastCh]--;wr.ch=baC;counts[baC]=(counts[baC]||0)+1
  }

  
  refs.forEach(function(r){var cn2='';bodyChs.forEach(function(cs){if(cs.ch===r.ch)cn2=cs.name});r.ins='<b>建议插入 '+(cn2||('第'+r.ch+'章'))+'</b>'})
}



// Extract ALL individual keywords from topics + section headings
function extractAllKeywords(topics,secs){
  var words=new Set();
  // From paper topics
  topics.forEach(function(t){if(t.label)words.add(t.label);(t.label||'').split(/[\s，,、]+/).filter(function(w){return w.length>=2}).forEach(function(w){words.add(w)})});
  // From chapter/section headings
  (secs||sections).forEach(function(cs){
    cs.name.replace(/第[一二三四五六七八九十\d]+章\s*/,'').split(/[\s，,、.。:：()（）]+/).filter(function(w){return w.length>=2}).forEach(function(w){words.add(w)});
    cs.sections.forEach(function(sec){sec.title.split(/[\s，,、.。:：()（）]+/).filter(function(w){return w.length>=2}).forEach(function(w){words.add(w)});
      sec.subs.forEach(function(sub){sub.title.split(/[\s，,、.。:：()（）]+/).filter(function(w){return w.length>=2}).forEach(function(w){words.add(w)})})})
  });
  return Array.from(words).slice(0,60);
}


// ========== 文献置信度评分（用于弹窗①） ==========
function calcRefConfidence(r){
  var score=20; // base
  // 年份：越新越高（近5年+25，近10年+15）
  var yr=parseInt(r.year)||0,now2=(new Date()).getFullYear();
  if(yr>=now2-3)score+=25;else if(yr>=now2-5)score+=20;else if(yr>=now2-10)score+=10;
  // 来源权威度
  if(r.source==='OA'||r.source==='CR')score+=25;
  else if(r.source==='S2'||r.source==='AX'||r.source==='PM')score+=18;
  else if(r.source==='CO'||r.source==='IN'||r.source==='DC'||r.source==='DJ')score+=12;
  else if(r.source==='BD'||r.source==='WF')score+=8;
  // 有DOI +15
  if(r.doi&&r.doi.length>5)score+=15;
  // 有期刊 +10
  if(r.journal&&r.journal.length>3)score+=10;
  // 标题长度合理（20-200字）+5
  var tl=(r.title||'').length;
  if(tl>=20&&tl<=200)score+=5;
  return Math.min(99,score);
}

// ========== 弹窗①: 检索结果确认 ==========
var _rcPool=[],_rcSelected={},_rcFullPool=[],_rcOverflow=[],_rcTarget=0,_rcCallback=null;

// Compute topic relevance: how many paperTopics bigrams appear in the title
function rcTopicRelevance(title){
  if(!title||!paperTopics||!paperTopics.length)return 0;
  var t=(title||'').toLowerCase(),hits=0;
  for(var i=0;i<Math.min(paperTopics.length,20);i++){
    var kw=(paperTopics[i].label||'').toLowerCase();
    if(kw.length>=2&&t.indexOf(kw)>=0)hits++;
  }
  return Math.min(99,Math.round(hits/Math.min(paperTopics.length,20)*100));
}

function showRefConfirmModal(pool,existingRefs,total,callback){
  _rcTarget=total;_rcCallback=callback;
  _rcFullPool=pool.slice();
  // 按 (置信度 + 主题相关度) / 2 综合排序
  pool.sort(function(a,b){
    var sa=(calcRefConfidence(a)+rcTopicRelevance(a.title))/2;
    var sb=(calcRefConfidence(b)+rcTopicRelevance(b.title))/2;
    return sb-sa;
  });
  // 显示上限 = 目标 × 1.25，至少多 20 条
  var displayCap=Math.max(total+20,Math.ceil(total*1.25));
  if(displayCap>=pool.length)displayCap=pool.length;
  _rcPool=pool.slice(0,displayCap);
  _rcOverflow=pool.slice(displayCap);
  _rcSelected={};
  for(var i=0;i<_rcPool.length;i++)_rcSelected[i]=true;
  var cn=0,en=0;_rcPool.forEach(function(r){if(r.isCN)cn++;else en++;});
  document.getElementById('rcSummary').textContent=_rcPool.length+' 篇文献（中 '+cn+' / 英 '+en+'）| 目标 '+total+' 条 | 默认全选 | 备选池 '+_rcOverflow.length+' 条';
  document.getElementById('rcStepLabel').textContent='第 1/2 步';
  document.getElementById('rcSkipBtn').textContent='✅ 下一步 ('+total+'条)';
  rcRenderList('all');
  document.getElementById('rcOverlay').style.display='flex';
}

function rcRenderList(filter){
  var h='',pool=_rcPool;
  var now=typeof Date!=='undefined'?(new Date()).getFullYear():2026;
  var shown=0;
  for(var i=0;i<pool.length;i++){
    var r=pool[i];
    // Apply filter
    if(filter==='cn'&&!r.isCN)continue;
    if(filter==='en'&&r.isCN)continue;
    if(filter==='relevant'){
      if(rcTopicRelevance(r.title)<30)continue;
    }
    if(filter==='recent'){
      var yr2=parseInt(r.year)||0;
      if(yr2<now-5||calcRefConfidence(r)<50)continue;
    }
    if(filter==='confidence'&&calcRefConfidence(r)<50)continue;
    shown++;
    var cf=calcRefConfidence(r);
    var tr=rcTopicRelevance(r.title);
    var composite=Math.round((cf+tr)/2);
    var compositeCl=composite>=70?'high':(composite>=40?'medium':'low');
    var compositeColor=composite>=70?'#30d158':(composite>=40?'#0071e3':'#ff9f0a');
    var cfColor=cf>=70?'#30d158':(cf>=40?'#ff9f0a':'#ff3b30');
    var yrTxt=r.year||'?';
    var jnTxt=(r.journal||'').substring(0,40);
    var srcTxt=r.source||'?';
    var srcColor='#94a3b8';
    if(r.source==='OA'||r.source==='OA-CN'||r.source==='CR')srcColor='#30d158';
    else if(r.source==='S2'||r.source==='AX'||r.source==='PM')srcColor='#0071e3';
    else if(r.source==='BD'||r.source==='WF')srcColor='#ff9f0a';
    var checked=_rcSelected[i]?'checked':'';
    h+='<div class="rc-item" style="display:flex;align-items:flex-start;gap:8px;padding:6px 8px;margin:2px 0;border-radius:8px;cursor:pointer;background:'+(_rcSelected[i]?'rgba(0,113,227,0.04)':'rgba(0,0,0,0.01)')+';transition:background .15s" onclick="rcToggle('+i+')">';
    h+='<input type="checkbox" '+checked+' onclick="event.stopPropagation();rcToggle('+i+')" style="margin-top:3px;flex-shrink:0;accent-color:#0071e3;width:14px;height:14px">';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-size:.75rem;font-weight:500;color:var(--t);line-height:1.35;word-break:break-word">'+(r.title||'(无标题)')+'</div>';
    h+='<div style="font-size:.62rem;color:var(--m);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+jnTxt+' · '+yrTxt+' · <span style="color:'+srcColor+';font-weight:600">'+srcTxt+'</span>';
    // Topic relevance badge
    var trLabel=tr>=70?'🎯 高度相关':(tr>=40?'📌 相关':(tr>=20?'🔹 弱相关':''));
    if(trLabel)h+=' · <span style="color:'+(tr>=50?'#30d158':tr>=30?'#0071e3':'#86868b')+';font-size:.58rem">'+trLabel+' ('+tr+'%)</span>';
    h+='</div>';
    h+='</div>';
    // Composite score ring
    h+='<div style="flex-shrink:0;text-align:center;min-width:42px">';
    h+='<div style="display:inline-block;width:30px;height:30px;border-radius:50%;border:2px solid '+compositeColor+';text-align:center;line-height:26px;font-size:.57rem;font-weight:700;color:'+compositeColor+'" title="综合分='+composite+' (置信'+cf+'+相关'+tr+')/2">'+composite+'</div>';
    h+='<div style="font-size:.42rem;color:var(--m);margin-top:1px">综合</div>';
    h+='</div>';
    h+='</div>';
  }
  if(shown===0)h='<div style="text-align:center;padding:30px;color:var(--m)">无匹配文献（尝试切换筛选条件）</div>';
  document.getElementById('rcList').innerHTML=h;
  rcUpdateCount();
}

function rcToggle(idx){
  _rcSelected[idx]=!_rcSelected[idx];
  // 如果取消勾选后总数不足目标，自动从备选池中补充
  if(!_rcSelected[idx])rcAutoRefill();
  rcUpdateCount();
}

function rcAutoRefill(){
  if(!_rcOverflow.length)return;
  var sel=0;for(var k in _rcSelected){if(_rcSelected[k])sel++;}
  var need=_rcTarget-sel;
  if(need<=0)return;
  // 把 _rcOverflow 按综合分补排
  _rcOverflow.sort(function(a,b){
    var sa=(calcRefConfidence(a)+rcTopicRelevance(a.title))/2;
    var sb=(calcRefConfidence(b)+rcTopicRelevance(b.title))/2;
    return sb-sa;
  });
  var added=0;
  for(var i=0;i<_rcOverflow.length&&added<need;i++){
    var r=_rcOverflow[i];
    if(r.alreadyShown)continue;
    _rcPool.push(r);
    _rcSelected[_rcPool.length-1]=true;
    r.alreadyShown=true;
    added++;
  }
  if(added>0){
    rcRenderList('all');
    document.getElementById('rcSummary').textContent=_rcPool.length+' 篇文献 | 目标 '+_rcTarget+' 条 | 已自动补充 '+added+' 条';
  }
}

function rcSelectAll(){
  for(var i=0;i<_rcPool.length;i++)_rcSelected[i]=true;
  rcUpdateAllChecks();
}
function rcSelectNone(){
  for(var i=0;i<_rcPool.length;i++)_rcSelected[i]=!_rcSelected[i];
  rcUpdateAllChecks();
}
function rcFilter(f){
  rcRenderList(f);
}
function rcUpdateCount(){
  var sel=0;for(var k in _rcSelected){if(_rcSelected[k])sel++;}
  var tail=' / '+_rcPool.length;
  if(_rcOverflow.length)tail+=' +备选 '+_rcOverflow.length;
  if(sel<_rcTarget&&_rcOverflow.length)tail+=' (取消勾选将自动补足)';
  document.getElementById('rcCount').textContent='已选 '+sel+tail;
}
function rcUpdateAllChecks(){
  rcRenderList('all');
}
function rcFinish(){
  var selected=[];
  for(var i=0;i<_rcPool.length;i++){
    if(_rcSelected[i])selected.push(_rcPool[i]);
  }
  if(!selected.length){alert('请至少选择 1 篇文献');return;}
  document.getElementById('rcOverlay').style.display='none';
  if(_rcCallback)_rcCallback(selected);
}
function rcClose(){
  document.getElementById('rcOverlay').style.display='none';
  searchRunning=false;
}

// ========== 弹窗②: 分配策略确认 ==========
var _asSelected=[],_asChapters=[],_asChMap={},_asCallback=null;

function showAssignModal(selected,sections,callback){
  _asSelected=selected.slice();
  _asCallback=callback;
  // Build chapter map
  var bodyChs=sections.filter(function(s){return!/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name)});
  _asChapters=bodyChs;
  _asChMap={};
  // Default: auto-assign (use existing assignChapters logic)
  document.getElementById('asMode').value='auto';
  // Pre-assign with auto strategy
  asRunAssignment('auto');
  document.getElementById('asOverlay').style.display='flex';
}

function asRebuild(){
  var mode=document.getElementById('asMode').value;
  asRunAssignment(mode);
}

function asRunAssignment(mode){
  var total=_asSelected.length;
  var n=_asChapters.length;
  if(!n){document.getElementById('asList').innerHTML='<div style="text-align:center;padding:30px;color:var(--m)">未检测到章节</div>';return}
  // Build keyword scores for each ref against each chapter
  var scores=[];
  for(var i=0;i<_asSelected.length;i++){
    var r=_asSelected[i];
    var kws=extractTitleKws(r.title||'');
    scores[i]=[];
    for(var j=0;j<n;j++){
      var ct=(_asChapters[j].text||'').toLowerCase();
      var h=kws.reduce(function(s,w){return s+(ct.indexOf(w)>=0?1:0)},0);
      scores[i][j]=kws.length>0?h/kws.length:0;
    }
  }
  // Build targets
  var targets=[];
  if(mode==='uniform'){
    var base=Math.floor(total/n),rem=total-base*n;
    for(var j=0;j<n;j++){targets[j]=base+(j<rem?1:0);}
  }else if(mode==='weighted'){
    var lens=_asChapters.map(function(cs){return Math.max(50,(cs.text||'').length)});
    var tl=lens.reduce(function(a,b){return a+b},0);
    var asd=0;
    for(var j=0;j<n;j++){targets[j]=Math.round(total*lens[j]/tl);asd+=targets[j];}
    // adjust
    var diff=total-asd;
    for(var j=0;j<Math.abs(diff);j++){
      if(diff>0)targets[j%n]++;else{var k=j;while(targets[k%n]<=1)k++;targets[k%n]--;}
    }
  }else{
    // auto: no target, best match per ref with per-chapter cap
    _asChMap={};for(var j=0;j<n;j++)_asChMap[j]=[];
    var maxPerCh=Math.max(2,Math.ceil(total*0.20));
    var assigned2=new Set();
    // Greedy: for each chapter, pick its best refs up to target
    var tCaps=[];for(var j=0;j<n;j++)tCaps[j]=Math.max(1,Math.ceil(total/n*0.7+(j===n-1?total/n*0.3:0)));
    if(n===1)tCaps[0]=total;
    for(var j=0;j<n;j++){
      var cands=[];
      for(var i=0;i<total;i++){
        if(!assigned2.has(i))cands.push({idx:i,score:scores[i][j]});
      }
      cands.sort(function(a,b){return b.score-a.score;});
      var tc=Math.min(tCaps[j],cands.length,total-_asChMap[j].length);
      for(var c=0;c<tc;c++){
        assigned2.add(cands[c].idx);
        _asChMap[j].push(_asSelected[cands[c].idx]);
      }
    }
    // Assign remaining to best match
    for(var i=0;i<total;i++){
      if(!assigned2.has(i)){
        var bc=0,bs=scores[i][0];
        for(var j=1;j<n;j++){if(scores[i][j]>bs){bs=scores[i][j];bc=j;}}
        _asChMap[bc].push(_asSelected[i]);
      }
    }
    // Enforce per-chapter cap: redistribute overflow
    var maxPc=Math.max(2,Math.ceil(total*0.20));
    var cts={};for(var j=0;j<n;j++)cts[j]=(_asChMap[j]||[]).length;
    for(var j=0;j<n;j++){
      while((cts[j]||0)>maxPc){
        // find worst-fitting ref in this chapter
        var wr=null,ws=1,wri=-1;
        (_asChMap[j]||[]).forEach(function(rf,ri){var si=_asSelected.indexOf(rf);if(si>=0){if(scores[si][j]<ws){ws=scores[si][j];wr=rf;wri=si;}}});
        if(!wr)break;
        cts[j]--;
        var ba=0,bs2=0;for(var bj=0;bj<n;bj++){if(bj===j||(cts[bj]||0)>=maxPc)continue;if(scores[wri][bj]>bs2){bs2=scores[wri][bj];ba=bj;}}
        _asChMap[ba].push(wr);
        _asChMap[j]=_asChMap[j].filter(function(rf){return rf!==wr;});
        cts[ba]=(cts[ba]||0)+1;
      }
    }
    // Ensure every chapter has at least 1
    for(var j=0;j<n;j++){
      var ctj=(_asChMap[j]||[]).length;
      if(ctj>=1)continue;
      // Steal one from the most-loaded chapter
      var ml=0,mlj=-1;
      for(var bj=0;bj<n;bj++){if(bj===j)continue;var ln=(_asChMap[bj]||[]).length;if(ln>ml){ml=ln;mlj=bj;}}
      if(mlj>=0&&ml>1){
        var sw=null,sb=0;
        (_asChMap[mlj]||[]).forEach(function(rf){var si=_asSelected.indexOf(rf);if(si>=0&&scores[si][j]>sb){sb=scores[si][j];sw=rf;}});
        if(sw){_asChMap[j].push(sw);_asChMap[mlj]=_asChMap[mlj].filter(function(rf){return rf!==sw;});}
      }
    }
    asRenderList();
    return;
  }
  // Uniform / Weighted: assign best for each chapter up to target
  _asChMap={};for(var j=0;j<n;j++)_asChMap[j]=[];
  var assigned=new Set();
  for(var j=0;j<n;j++){
    var need=targets[j];
    var cands=[];
    for(var i=0;i<total;i++){if(!assigned.has(i))cands.push({idx:i,score:scores[i][j]});}
    cands.sort(function(a,b){return b.score-a.score;});
    for(var k=0;k<Math.min(need,cands.length);k++){
      assigned.add(cands[k].idx);
      _asChMap[j].push(_asSelected[cands[k].idx]);
    }
  }
  // Remaining unassigned refs → best chapter
  for(var i=0;i<total;i++){
    if(!assigned.has(i)){
      var bc=0,bs=scores[i][0];
      for(var j=1;j<n;j++){if(scores[i][j]>bs){bs=scores[i][j];bc=j;}}
      _asChMap[bc].push(_asSelected[i]);
    }
  }
  // Enforce last chapter cap
  var maxPC=Math.max(1,Math.floor(total*0.05));
  if((_asChMap[n-1]||[]).length>maxPC){
    var ex2=(_asChMap[n-1]||[]).length-maxPC;
    for(var ej=0;ej<ex2;ej++){
      var wr2=_asChMap[n-1][_asChMap[n-1].length-1];
      _asChMap[n-1].pop();
      var ba2=0;for(var bj2=0;bj2<n-1;bj2++){if((_asChMap[bj2]||[]).length<(_asChMap[ba2]||[]).length)ba2=bj2;}
      _asChMap[ba2].push(wr2);
    }
  }
  asRenderList();
}

function asRenderList(){
  var h='',total=_asSelected.length;
  var summary='共 '+total+' 篇 → ';
  for(var j=0;j<_asChapters.length;j++){
    var cnt=(_asChMap[j]||[]).length;
    var chLabel=_asChapters[j].name.replace(/第[一二三四五六七八九十\d]+章\s*/,'').substring(0,8);
    summary+=chLabel+':'+cnt+'篇 ';
  }
  document.getElementById('asSummary').textContent=summary;

  for(var j=0;j<_asChapters.length;j++){
    var refs2=_asChMap[j]||[];
    var chId='ascg_'+j;
    h+='<div style="margin-bottom:6px;border:1px solid var(--bd);border-radius:10px;overflow:hidden">';
    h+='<div onclick="asToggleCh('+j+')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(0,113,227,0.04);cursor:pointer;font-weight:600;font-size:.72rem;color:var(--t)">';
    h+='<span><span class="as-arrow open" id="asArrow'+j+'">&#9654;</span> '+_asChapters[j].name+'</span>';
    h+='<span style="font-weight:400;font-size:.65rem;color:var(--m)">'+refs2.length+' 篇</span>';
    h+='</div>';
    h+='<div id="'+chId+'" style="display:block;max-height:400px;overflow-y:auto">';
    if(!refs2.length){
      h+='<div style="padding:12px;font-size:.62rem;color:var(--m)">此章暂无文献</div>';
    }else{
      refs2.forEach(function(r,ri){
        var yr2=r.year||'?';
        h+='<div style="display:flex;align-items:center;gap:6px;padding:4px 12px;font-size:.68rem;border-bottom:1px solid rgba(0,0,0,0.03)">';
        h+='<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(r.title||'')+'">'+(r.title||'(无标题)').substring(0,80)+'</span>';
        h+='<span style="color:var(--m);font-size:.58rem;flex-shrink:0">'+yr2+'</span>';
        // Move to another chapter
        h+='<select onchange="asMoveRef('+j+','+ri+',this.value)" style="border:1px solid var(--bd);border-radius:6px;font-size:.55rem;padding:2px 4px;background:var(--solid);color:var(--t);cursor:pointer;flex-shrink:0">';
        h+='<option value="">移至…</option>';
        for(var bj=0;bj<_asChapters.length;bj++){
          if(bj===j)continue;
          h+='<option value="'+bj+'">'+_asChapters[bj].name.replace(/第[一二三四五六七八九十\d]+章\s*/,'').substring(0,10)+'</option>';
        }
        h+='</select>';
        h+='</div>';
      });
    }
    h+='</div></div>';
  }
  document.getElementById('asList').innerHTML=h;
}

function asToggleCh(idx){
  var el=document.getElementById('ascg_'+idx),arrow=document.getElementById('asArrow'+idx);
  if(el){el.style.display=el.style.display==='none'?'block':'none';if(arrow)arrow.classList.toggle('open')}
}

function asMoveRef(fromCh,refIdx,toCh){
  if(!toCh)return;
  toCh=parseInt(toCh);
  var ref=_asChMap[fromCh][refIdx];
  _asChMap[fromCh].splice(refIdx,1);
  if(!_asChMap[toCh])_asChMap[toCh]=[];
  _asChMap[toCh].push(ref);
  asRenderList();
}

function asFinish(){
  // Build final ref list with chapter assignments from _asChMap
  var results=[];
  for(var j=0;j<_asChapters.length;j++){
    var refs2=_asChMap[j]||[];
    refs2.forEach(function(r){
      var copy={};for(var k in r)copy[k]=r[k];
      copy.ch=_asChapters[j].ch;copy._chName=_asChapters[j].name;
      results.push(copy);
    });
  }
  document.getElementById('asOverlay').style.display='none';
  if(_asCallback)_asCallback(results);
}

function asSkip(){
  document.getElementById('asOverlay').style.display='none';
  if(_asCallback)_asCallback(null); // null = use original auto-assign
}


// ========== 内联标题校准：点击原文段落指定层级（支持任意深度） ==========

// ========== 弹窗③: 标题层级校准（分步向导） ==========
var _cwCandidates=[],_cwCallback=null,_cwPhase=0;

function startInlineCalibration(box,autoDetected){_cwCandidates=autoDetected;_cwPhase=0;window._cwAllParaTexts=null;window._cwCheckedEls=null;_cwConfirmed={'0':new Set(),'1':new Set(),'2':new Set()};return new Promise(function(resolve){_cwCallback=resolve;showCalibrationWizard();});}
function showCalibrationWizard(){_cwPhase=0;renderCalibrationModal();hideLoad();}


// ========== 弹窗③: 标题层级校准（样式名驱动 + 确认子窗口） ==========
// 全局状态
var _cwSelections={'0':new Set(),'1':new Set(),'2':new Set()},_cwConfirmed={'0':new Set(),'1':new Set(),'2':new Set()},_cwPhase=0,_cwCheckedEls=null,_cwCandidates=[],_cwCallback=null;

// 从预解析的 docx 数据中取出样式组
function cwGetStyleGroups(){
  if(window._docxStyleGroups&&window._docxStyleGroups.length)return window._docxStyleGroups;
  // 极端兜底（_docxStyleGroups 未初始化时现场扫描）
  var box=document.getElementById('thesisBox');if(!box)return[];
  var els=box.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li'),gs={};
  for(var i=0;i<els.length;i++){
    var el=els[i],t=(el.textContent||'').trim();
    if(!t||t.length<2)continue;
    if(/^\d{1,3}$/.test(t)||/^[ivxlcdm]+$/i.test(t))continue;
    if(/[\t\s]+\d{1,3}$/.test(t)||/\.{3,}\d{1,3}$/.test(t))continue;
    var g='正文段落';
    if(/^第[一二三四五六七八九十123456789]+章/.test(t))g='第X章 格式';
    else if(/^Chapter\s+\d/i.test(t))g='Chapter 格式';
    else if(/^\d+(?:\.\d+)+[\s、,，]+/.test(t))g='数字编号格式';
    else if(t.length<80&&!/^[\(（]?(?:摘要|Abstract|关键词|Keywords|目录|参考文献|致谢|附录)/.test(t))g='短文本(疑似标题)';
    if(!gs[g])gs[g]={name:g,count:0,samples:[],_texts:[],_els:[]};
    gs[g].count++;
    if(gs[g].samples.length<3)gs[g].samples.push(t.substring(0,80));
    gs[g]._texts.push(t);
    gs[g]._els.push(el);
  }
  window._docxStyleGroups=Object.values(gs).sort(function(a,b){return b.count-a.count;});
  return window._docxStyleGroups;
}
function cwGetPhaseCount(p){
  var checkedEls=window._cwCheckedEls&&window._cwCheckedEls[p]?window._cwCheckedEls[p].length:0;
  // 如果已有勾选记录，直接用实际勾选数；否则用样式组全量估算
  if(checkedEls>0)return checkedEls;
  var gs=cwGetStyleGroups(),cnt=0;
  var sel=_cwConfirmed[p]||new Set();
  gs.forEach(function(g){if(sel.has(g.name))cnt+=g.count;});
  return cnt;
}

// 获取某个样式中属于正文范围的所有段落文本列表
function cwGetStyleParagraphs(sname){
  var box=document.getElementById('thesisBox');
  if(!box)return[];
  // 尝试从预解析数据中取出该样式的所有文本
  var cached=window._docxStyleGroups||[];
  var result=[];
  if(cached.length){
    var g2=null;
    for(var i=0;i<cached.length;i++){if(cached[i].name===sname&&cached[i]._texts){g2=cached[i];break;}}
    if(g2&&g2._texts)return g2._texts;
  }
  // 兜底：从 DOM 匹配
  var refBound=typeof bodyBoundaryEl==='function'?bodyBoundaryEl():null;
  var els=box.querySelectorAll('p,h1,h2,h3,h4,h5,h6');
  for(var j=0;j<els.length;j++){
    if(refBound&&(els[j].compareDocumentPosition(refBound)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
    var t=(els[j].textContent||'').trim();if(!t||t.length<2)continue;
    result.push({el:els[j],txt:t});
  }
  return result;
}

function cwAutoMatch(sname){
  if(_cwPhase>=3)return;
  cwShowConfirmPopup(sname);
}

// 确认弹窗：显示该样式下的所有文本条目，供用户勾选
function cwShowConfirmPopup(sname){
  var oldD=document.getElementById('cwConfirmPopup');if(oldD)oldD.parentElement.removeChild(oldD);
  var phases=['章','节','小节'],ph=_cwPhase;
  var colors=['#0071e3','#af52de','#30d158'];

  // 从预解析数据中提取该样式的所有文本
  var items=[],cached=window._docxStyleGroups&&window._docxStyleGroups.length?window._docxStyleGroups:cwGetStyleGroups();
  for(var ci=0;ci<cached.length;ci++){
    if(cached[ci].name===sname&&cached[ci]._texts&&cached[ci]._texts.length){
      var txts=cached[ci]._texts,seen2={};
      for(var ti=0;ti<txts.length;ti++){
        var tx=txts[ti];if(!tx||tx.length<2)continue;
        if(seen2[tx])continue;
        seen2[tx]=true;
        var matchedEl=null;
        if(cached[ci]._els&&cached[ci]._els.length){
          for(var ei=0;ei<cached[ci]._els.length;ei++){
            var eNorm=window._normText(cached[ci]._els[ei].textContent||'');
            if(eNorm===window._normText(tx)||(tx.length>=10&&eNorm.length>=10&&eNorm.substring(0,20)===tx.substring(0,20))){
              matchedEl=cached[ci]._els[ei];break;
            }
          }
        }
        items.push({txt:tx,el:matchedEl,checked:true,idx:items.length});
      }
      break;
    }
  }
  // 兜底：如果预解析没有该样式的详细数据，从 DOM 中按文本模式匹配
  if(!items.length){
    var box=document.getElementById('thesisBox');if(box){
      var refBound=typeof bodyBoundaryEl==='function'?bodyBoundaryEl():null;
      var els=box.querySelectorAll('p,h1,h2,h3,h4,h5,h6');
      for(var j=0;j<els.length;j++){
        if(refBound&&(els[j].compareDocumentPosition(refBound)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
        var et=(els[j].textContent||'').trim();if(!et||et.length<2)continue;
        items.push({txt:et,checked:true,idx:items.length});
      }
    }
  }

  // 构建弹窗
  var popup=document.createElement('div');popup.id='cwConfirmPopup';
  popup.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:14px;padding:0;width:85%;height:80%;max-width:950px;display:flex;flex-direction:column;box-shadow:0 25px 80px rgba(0,0,0,.35);z-index:100000;overflow:hidden';
  popup.onclick=function(e){e.stopPropagation();};

  // Header
  var dh=document.createElement('div');dh.style.cssText='padding:12px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between';
  dh.innerHTML='<div><b style="font-size:.9rem;color:'+colors[ph]+'">确认 '+phases[ph]+'标题 — '+sname+'</b> <span style="font-size:.7rem;color:#999">('+items.length+' 条)</span></div>'+
    '<div style="display:flex;gap:8px">'+
    '<button onclick="cwConfirmSelectAll()" style="background:rgba(0,0,0,.06);color:#333;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:.65rem">全选</button>'+
    '<button onclick="cwConfirmDeselectAll()" style="background:rgba(0,0,0,.06);color:#333;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:.65rem">反选</button>'+
    '<button onclick="cwConfirmAccept(\''+sname.replace(/'/g,'\\\x27')+'\')" style="background:'+colors[ph]+';color:#fff;border:none;border-radius:8px;padding:6px 16px;cursor:pointer;font-weight:600;font-size:.68rem">✅ 确认</button>'+
    '<button onclick="cwConfirmClose()" style="background:rgba(0,0,0,.06);color:#333;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:.68rem">✕ 取消</button>'+
    '</div>';
  popup.appendChild(dh);

  // List
  var dl=document.createElement('div');dl.style.cssText='flex:1;overflow-y:auto;padding:6px 12px';
  window._cwConfirmItems=items;
  window._cwConfirmStyle=sname;
  for(var i=0;i<items.length;i++){
    (function(){
      var it=items[i];
      var row2=document.createElement('div');
      row2.style.cssText='cursor:pointer;display:flex;align-items:flex-start;gap:8px;padding:5px 8px;margin:1px 0;border-radius:6px;font-size:.72rem;color:#1d1d1f;transition:background .1s';
      row2.onmouseenter=function(){row2.style.background='rgba(0,0,0,.02)';};
      row2.onmouseleave=function(){row2.style.background='';};
      row2.onclick=function(){it.checked=!it.checked;row2.getElementsByTagName('span')[0].textContent=it.checked?'☑':'☐';};
      var cb=document.createElement('span');cb.style.cssText='font-size:.7rem;min-width:18px;flex-shrink:0';cb.textContent=it.checked?'☑':'☐';row2.appendChild(cb);
      var txtSpan=document.createElement('span');txtSpan.textContent=it.txt;row2.appendChild(txtSpan);
      dl.appendChild(row2);
    })();
  }
  popup.appendChild(dl);
  document.body.appendChild(popup);
}

function cwConfirmSelectAll(){if(window._cwConfirmItems){window._cwConfirmItems.forEach(function(x){x.checked=true;});cwConfirmRefreshList();}}
function cwConfirmDeselectAll(){if(window._cwConfirmItems){window._cwConfirmItems.forEach(function(x){x.checked=!x.checked;});cwConfirmRefreshList();}}
function cwConfirmRefreshList(){
  var rows=document.querySelectorAll('#cwConfirmPopup div div');if(!rows)return;
  for(var i=0;i<Math.min(rows.length,window._cwConfirmItems.length);i++){
    var sp=rows[i].querySelector('span');if(sp)sp.textContent=window._cwConfirmItems[i].checked?'☑':'☐';
  }
}
function cwConfirmAccept(sname){
  if(_cwPhase>=3)return;
  var items=window._cwConfirmItems||[];

  // 写入样式层级确认状态
  _cwConfirmed[_cwPhase]=_cwConfirmed[_cwPhase]||new Set();
  _cwConfirmed[_cwPhase].add(sname);
  [0,1,2].forEach(function(l){if(l!==_cwPhase&&_cwConfirmed[l])_cwConfirmed[l].delete(sname);});

  // 先清除当前样式在本层的所有已选元素（重新确认意味着重置）
  if(!window._cwCheckedEls)window._cwCheckedEls={};
  if(!window._cwCheckedEls[_cwPhase])window._cwCheckedEls[_cwPhase]=[];

  // 找出当前样式的所有示例文本，用于清除匹配
  var styleSampleSet={};
  if(items.length)items.forEach(function(it){styleSampleSet[it.txt]=true;});

  // 从本层已选列表中移除匹配该样式的所有元素
  window._cwCheckedEls[_cwPhase]=window._cwCheckedEls[_cwPhase].filter(function(el){
    var et=(el.textContent||'').trim();
    return !styleSampleSet[et]&&!items.some(function(it){return it.txt===et||(it.txt.length>=10&&et.length>=10&&it.txt.substring(0,20)===et.substring(0,20));});
  });

  // 重新添加本次勾选的元素（优先用 items 自带的 el 引用）
  for(var k=0;k<items.length;k++){
    if(!items[k].checked)continue;
    var directEl=items[k].el;
    if(directEl){
      var dup2=false;
      for(var d2=0;d2<window._cwCheckedEls[_cwPhase].length;d2++){if(window._cwCheckedEls[_cwPhase][d2]===directEl){dup2=true;break;}}
      if(!dup2)window._cwCheckedEls[_cwPhase].push(directEl);
      continue;
    }
    // 兜底：文本匹配查找 DOM
    var tx2=items[k].txt;
    var box2=document.getElementById('thesisBox');if(!box2)continue;
    var refB2=typeof bodyBoundaryEl==='function'?bodyBoundaryEl():null;
    var els2=box2.querySelectorAll('p,h1,h2,h3,h4,h5,h6');
    for(var l2=0;l2<els2.length;l2++){
      if(refB2&&(els2[l2].compareDocumentPosition(refB2)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
      var et2=(els2[l2].textContent||'').trim();
      if(window._normText(et2)===window._normText(tx2)||(tx2.length>=10&&et2.length>=10&&window._normText(et2).substring(0,20)===window._normText(tx2).substring(0,20))){
        var dup3=false;
        for(var d3=0;d3<window._cwCheckedEls[_cwPhase].length;d3++){if(window._cwCheckedEls[_cwPhase][d3]===els2[l2]){dup3=true;break;}}
        if(!dup3)window._cwCheckedEls[_cwPhase].push(els2[l2]);
        break;
      }
    }
  }
	  var itemsWithEl=items.filter(function(it){return it.el&&it.checked;}).length;
  var itemsNoEl=items.filter(function(it){return !it.el&&it.checked;}).length;
  console.log('[cal] Confirmed phase',_cwPhase,'style',sname,'checked',items.filter(function(it){return it.checked;}).length,'(withEl:',itemsWithEl,'noEl:',itemsNoEl,')','kept',window._cwCheckedEls[_cwPhase].length,'elements');
  cwConfirmClose();
  renderCalibrationModal();
}
function cwConfirmClose(){
  var d=document.getElementById('cwConfirmPopup');if(d)d.parentElement.removeChild(d);
  window._cwConfirmItems=null;window._cwConfirmStyle=null;
}

function cwNextPhase(){if(_cwPhase<2){_cwPhase++;renderCalibrationModal();}else{cwFinish();}}
function cwPrevPhase(){if(_cwPhase>0){_cwPhase--;renderCalibrationModal();}}

// 从预解析 docx 数据中收集所有正文范围的段落内容
function cwEnsureAllParaTexts(){
  if(window._cwAllParaTexts)return;
  window._cwAllParaTexts=[];
  var box=document.getElementById('thesisBox');if(!box)return;
  var refBound=typeof bodyBoundaryEl==='function'?bodyBoundaryEl():null;
  var els=box.querySelectorAll('p,h1,h2,h3,h4,h5,h6');
  for(var i=0;i<els.length;i++){
    if(refBound&&(els[i].compareDocumentPosition(refBound)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
    var t=(els[i].textContent||'').trim();if(!t||t.length<2)continue;
    if(/^\d{1,3}$/.test(t)||/^[ivxlcdm]+$/i.test(t))continue;
    window._cwAllParaTexts.push({el:els[i],txt:t});
  }
}

function cwFinish(){
  var ov=document.getElementById('cwOverlay');if(ov)ov.parentElement.removeChild(ov);

  // 诊断：输出 cwCheckedEls 状态
  if(window._cwCheckedEls){
    console.log('[cal] cwFinish start: cwCheckedEls counts — L0:',(window._cwCheckedEls[0]||[]).length,'L1:',(window._cwCheckedEls[1]||[]).length,'L2:',(window._cwCheckedEls[2]||[]).length);
  } else {
    console.log('[cal] cwFinish start: cwCheckedEls is null/undefined');
  }
  console.log('[cal] cwFinish start: cwConfirmed — L0:',_cwConfirmed[0]?_cwConfirmed[0].size:0,'L1:',_cwConfirmed[1]?_cwConfirmed[1].size:0,'L2:',_cwConfirmed[2]?_cwConfirmed[2].size:0);
  // 构建 candidates：优先从 cwCheckedEls 取，兜底从 DOM text pattern
  _cwCandidates=[];
  if(window._cwCheckedEls){
    for(var lv=0;lv<3;lv++){
      var list=window._cwCheckedEls[lv]||[];
      for(var i=0;i<list.length;i++){
        var el=list[i];
        var txt=(el.textContent||'').trim();
        if(txt&&txt.length>=2){
          var dupLv=-1;
          for(var dl=0;dl<lv;dl++){
            var dlList=window._cwCheckedEls[dl]||[];
            for(var di=0;di<dlList.length;di++){if(dlList[di]===el){dupLv=dl;break;}}
            if(dupLv>=0)break;
          }
          if(dupLv<0)_cwCandidates.push({el:el,txt:txt,level:lv,tagLevel:-1,bare:false});
        }
      }
    }
  }
  // 兜底：用已确认样式组的 _texts 文本直接匹配 DOM 元素，不依赖 _els
  if(!_cwCandidates.length){
    console.warn('[cal] cwCheckedEls empty, falling back to text-based DOM scan');
    var box=document.getElementById('thesisBox');
    if(box){
      var refBound2=typeof bodyBoundaryEl==='function'?bodyBoundaryEl():null;
      var els3=box.querySelectorAll('p,h1,h2,h3,h4,h5,h6');
      // 为每个已确认的层级构造样式文本集
      var styleTextSets=[]; // [{lv:0, texts: {...}, groupNames: [...]}]
      for(var slv=0;slv<3;slv++){
        if(!_cwConfirmed[slv]||!_cwConfirmed[slv].size)continue;
        var set={lv:slv,texts:{},groupNames:[]};
        var gs2=cwGetStyleGroups();
        for(var gi2=0;gi2<gs2.length;gi2++){
          if(_cwConfirmed[slv].has(gs2[gi2].name)){
            set.groupNames.push(gs2[gi2].name);
            var txs=gs2[gi2]._texts||[];
            for(var xi=0;xi<txs.length;xi++){if(txs[xi]&&txs[xi].length>=2)set.texts[window._normText(txs[xi])]=true;}
          }
        }
        if(set.groupNames.length)styleTextSets.push(set);
      }
      console.log('[cal] Fallback styleTextSets:',styleTextSets.map(function(s){return'L'+s.lv+':'+s.groupNames.join(',')+'('+Object.keys(s.texts).length+' texts)';}).join(' | '));
      for(var j=0;j<els3.length;j++){
        if(refBound2&&(els3[j].compareDocumentPosition(refBound2)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
        var et3=(els3[j].textContent||'').trim();if(!et3||et3.length<2)continue;
        var et3n=window._normText(et3);
        var assignedLv=-1;
        for(var si3=0;si3<styleTextSets.length;si3++){
          if(styleTextSets[si3].texts[et3n]){assignedLv=styleTextSets[si3].lv;break;}
          // Try substring match for long texts
          if(et3n.length>=10){
            for(var key3 in styleTextSets[si3].texts){
              if(key3.length>=10&&et3n.substring(0,20)===key3.substring(0,20)){assignedLv=styleTextSets[si3].lv;break;}
            }
          }
          if(assignedLv>=0)break;
        }
        if(assignedLv<0)assignedLv=detectHeadingLevel(et3);
        if(assignedLv>=0)_cwCandidates.push({el:els3[j],txt:et3,level:assignedLv,tagLevel:-1,bare:false});
      }
    }
  }
  // 按 DOM 文档序排序（cwFinish 按层级分组构建会打乱文档顺序，必须重排）
  _cwCandidates.sort(function(a,b){
    if(!a.el||!b.el)return 0;
    return (a.el.compareDocumentPosition(b.el)&Node.DOCUMENT_POSITION_FOLLOWING)?-1:1;
  });
  console.log('[cal] Collected',_cwCandidates.length,'heading candidates from confirmed selections');
  // 重置状态
  _cwSelections={'0':new Set(),'1':new Set(),'2':new Set()};
  _cwConfirmed={'0':new Set(),'1':new Set(),'2':new Set()};
  window._cwCheckedEls=null;
  window._cwAllParaTexts=null;
  if(_cwCallback)_cwCallback(_cwCandidates);
}

function mcClose(){var ov=document.getElementById('cwOverlay');if(ov)ov.parentElement.removeChild(ov);_cwSelections={'0':new Set(),'1':new Set(),'2':new Set()};_cwConfirmed={'0':new Set(),'1':new Set(),'2':new Set()};window._cwCheckedEls=null;if(_cwCallback)_cwCallback(null);}
function mcAcceptAll(){cwFinish();}
function showCalibrationModal(){showCalibrationWizard();}

function renderCalibrationModal(){
  var old=document.getElementById('cwOverlay');if(old)old.parentElement.removeChild(old);
  var phases=['章','节','小节'];
  var phaseNames=['第1步：选择哪个 Word 样式 = 章标题','第2步：选择哪个 Word 样式 = 节标题','第3步：选择哪个 Word 样式 = 小节标题'];
  var colors=['#0071e3','#af52de','#30d158'];
  var ph=_cwPhase;
  var groups=cwGetStyleGroups();

  var ov=document.createElement('div');ov.id='cwOverlay';
  ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(30,30,32,.92);backdrop-filter:blur(12px);z-index:99999;display:flex;align-items:center;justify-content:center';
  ov.onclick=function(e){if(e.target===ov)mcClose();};
  var card=document.createElement('div');
  card.style.cssText='background:#fff;border-radius:18px;padding:0;width:95%;height:88%;max-width:1100px;display:flex;flex-direction:column;box-shadow:0 25px 80px rgba(0,0,0,.3);overflow:hidden';
  ov.appendChild(card);

  // Header — counter for EACH phase independently
  var hdr=document.createElement('div');hdr.style.cssText='padding:14px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between';card.appendChild(hdr);
  var hdrL=document.createElement('div');hdrL.style.cssText='display:flex;align-items:center;gap:8px';hdr.appendChild(hdrL);
  hdrL.appendChild(Object.assign(document.createElement('b'),{style:'font-size:1rem',textContent:'📐 标题校准'}));
  for(var pi2=0;pi2<3;pi2++){
    var cnt=cwGetPhaseCount(pi2);
    var b=document.createElement('span');b.style.cssText='font-size:.68rem;font-weight:'+(pi2===ph?'700':'400')+';color:'+(pi2===ph?colors[pi2]:'#999')+';background:'+(pi2===ph?colors[pi2]+'15':'transparent')+';padding:4px 10px;border-radius:8px';
    b.textContent=phases[pi2]+'×'+cnt;hdrL.appendChild(b);
    if(pi2<2){var ar=document.createElement('span');ar.style.cssText='color:#ccc';ar.textContent='→';hdrL.appendChild(ar);}
  }
  var hdrR=document.createElement('div');hdrR.style.cssText='display:flex;gap:8px';hdr.appendChild(hdrR);
  if(ph>0){var pb=document.createElement('button');pb.style.cssText='background:rgba(0,0,0,.06);color:#333;border:none;border-radius:8px;padding:7px 14px;cursor:pointer;font-weight:500;font-size:.72rem';pb.textContent='← 上一步';pb.onclick=cwPrevPhase;hdrR.appendChild(pb);}
  var nb=document.createElement('button');nb.style.cssText='background:'+(ph<2?colors[ph]:'#30d158')+';color:#fff;border:none;border-radius:8px;padding:7px 16px;cursor:pointer;font-weight:700;font-size:.72rem';nb.textContent=ph<2?'下一步 →':'✅ 完成';nb.onclick=cwNextPhase;hdrR.appendChild(nb);
  hdrR.appendChild(Object.assign(document.createElement('button'),{style:'background:rgba(0,0,0,.06);color:#333;border:none;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:.72rem',textContent:'跳过',onclick:mcClose}));

  // Instruction
  var instr=document.createElement('div');instr.style.cssText='padding:10px 20px;border-bottom:1px solid #f0f0f0;font-size:.72rem;color:#666';
  instr.innerHTML='<b style="color:'+colors[ph]+'">'+phaseNames[ph]+'</b> <span style="font-size:.62rem">点击样式名 → 弹窗勾选确认</span>';
  card.appendChild(instr);

  // List
  var list=document.createElement('div');list.id='cwList';list.style.cssText='flex:1;overflow-y:auto;padding:8px 12px';card.appendChild(list);

  if(groups.length===0){
    var empty=document.createElement('div');empty.style.cssText='text-align:center;padding:40px;color:#999';
    empty.textContent='未检测到任何 Word 样式。论文可能未套用样式。';list.appendChild(empty);
  }else{
    var shown=0;
    for(var i=0;i<groups.length;i++){
      var g=groups[i];
      // 已被其他层级确认的样式跳过
      var assignedOther=false;
      [0,1,2].forEach(function(l){if(l!==ph&&_cwConfirmed[l]&&_cwConfirmed[l].has(g.name))assignedOther=true;});
      if(assignedOther)continue;
      var isConfirmed=_cwConfirmed[ph]?!!_cwConfirmed[ph].has(g.name):false;
      var isTOC=/toc|目录|目次/i.test(g.name);
      if(isTOC&&g.count<20)continue;
      shown++;
      (function(sname,count,samples,active,toc){
        var rowCl=active?colors[ph]:'#ccc';
        var bg=active?colors[ph]+'08':'';
        var sample=samples.length?samples.join('  '):'';
        var row=document.createElement('div');
        row.style.cssText='cursor:pointer;display:flex;align-items:center;gap:10px;padding:10px 12px;margin:3px 0;border-radius:8px;border-left:3px solid '+rowCl+';background:'+bg+';transition:background .1s';
        row.onmouseenter=function(){row.style.background=active?colors[ph]+'12':'rgba(0,0,0,.02)';};
        row.onmouseleave=function(){row.style.background=bg;};
        row.onclick=function(){cwAutoMatch(sname);};

        var idxEl=document.createElement('span');idxEl.style.cssText='font-size:.58rem;color:#999;min-width:18px';idxEl.textContent=shown;row.appendChild(idxEl);

        var info=document.createElement('div');info.style.cssText='flex:1;min-width:0';
        var titleEl=document.createElement('div');titleEl.style.cssText='font-size:.85rem;font-weight:600;color:#1d1d1f';
        titleEl.textContent=sname+(toc?' [目录样式]':'');
        info.appendChild(titleEl);
        if(sample){var ex=document.createElement('div');ex.style.cssText='font-size:.62rem;color:#999;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';ex.textContent='例如：'+sample;info.appendChild(ex);}
        // Show font info if available
        if(g.fonts&&g.fonts.length){
          var fi=document.createElement('div');fi.style.cssText='font-size:.58rem;color:#999;margin-top:1px';
          var fiParts=[];
          var totalFonts=0;
          if(g.fonts.length)fiParts.push('🔤 '+g.fonts.slice(0,3).join('|'));
          if(g.sizes)fiParts.push('📏 '+g.sizes[0]+'-'+g.sizes[1]+'pt');
          if(g.commonBold)fiParts.push('B');
          if(g.commonItalic)fiParts.push('I');
          fi.textContent=fiParts.join(' · ');
          info.appendChild(fi);
        }
        row.appendChild(info);

        var bgHex=rowCl==='#ccc'?'rgba(0,0,0,0.05)':(rowCl+'10');
        var cntEl=document.createElement('span');cntEl.style.cssText='font-size:.68rem;color:'+rowCl+';background:'+bgHex+';padding:4px 12px;border-radius:10px;font-weight:700;flex-shrink:0';cntEl.textContent='×'+count;row.appendChild(cntEl);
        if(active){var chk=document.createElement('span');chk.style.cssText='font-size:.52rem;color:#30d158;background:rgba(48,209,88,.1);padding:3px 8px;border-radius:6px;flex-shrink:0;font-weight:600';chk.textContent='已确认';row.appendChild(chk);}
        list.appendChild(row);
      })(g.name,g.count,g.samples,isConfirmed,/toc|目录|目次/i.test(g.name));
    }
  }
  document.body.appendChild(ov);
}

// Compat stubs
function cwGetItemsForPhase(){return[];}
function cwGetUnassigned(){return[];}


// ========== 弹窗④: 检索结果确认 ==========
async function startSearch(){
  if(!manuscriptText){alert('请先上传论文文件');return}
  if(searchRunning)return;searchRunning=true;
  showLoad('诊断API连接...',0);if(typeof startCatGame==='function')setTimeout(function(){startCatGame();},500);
  try{
  // STEP 0: 检测Flask服务连通性（用轻量ping接口）
  var connected=false;
  try{var tr=await fetch('/ping');if(tr.ok){var tj=await tr.json();connected=tj.ok;}}catch(er){}
  if(!connected){hideLoad();searchRunning=false;alert('无法连接Python服务。\n\n请确认已双击 启动.bat 启动服务。\n如果已启动，请查看Python窗口是否有报错。');return}

  var rawTotal=(parseInt(document.getElementById('fTotal').value)||Math.round(manuscriptText.length/1000)),total=Math.max(1,rawTotal-(existingRefs.length||0));
  var cnPct=parseInt(document.getElementById('fCN').value)||45;
  var enPct=parseInt(document.getElementById('fEN').value)||30;
  // fCN = 中文占比上限提示, fEN = 英文最低占比
  if(!paperTopics.length)paperTopics=extractTopics(manuscriptText);

  // STEP 1: 全层级关键词——章/节/小节/正文段落/泛词
  updLoad('提取全层级关键词...',3);
  var tpLabels=paperTopics.map(function(t){return t.label});
  var searchRounds=[];
  // 第1轮：论文主题词
  searchRounds.push(tpLabels.slice(0,20));
  // 第2轮：主题词两两组合
  var combos=[];for(var k=0;k<Math.min(tpLabels.length-1,10);k++)combos.push(tpLabels[k]+' '+tpLabels[k+1]);
  searchRounds.push(combos);
  // 第3轮：章/节/小节标题中所有>=2字的词
  var allSecWords=[];
  sections.forEach(function(cs){
    if(/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(cs.name))return;
    var cn=cs.name.replace(/第[一二三四五六七八九十\d]+章\s*/,'');
    cn.split(/[\s，,、.。:：()（）]+/).filter(function(w){return w.length>=2}).forEach(function(w){allSecWords.push(w)});
    if(cs.sections)cs.sections.forEach(function(sec){
      sec.title.split(/[\s，,、.。:：()（）]+/).filter(function(w){return w.length>=2}).forEach(function(w){allSecWords.push(w)});
      if(sec.subs)sec.subs.forEach(function(sub){sub.title.split(/[\s，,、.。:：()（）]+/).filter(function(w){return w.length>=2}).forEach(function(w){allSecWords.push(w)})});
    });
  });
  searchRounds.push(Array.from(new Set(allSecWords)).slice(0,40));
  // 第4轮：章/节/小节名整体搜
  var allHeadings=[];
  sections.forEach(function(cs){
    if(/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(cs.name))return;
    var cn=cs.name.replace(/第[一二三四五六七八九十\d]+章\s*/,'').replace(/[\s，、]+/g,' ').trim();
    if(cn.length>=4)allHeadings.push(cn);
    if(cs.sections)cs.sections.forEach(function(sec){
      var sn=sec.num+' '+sec.title;if(sn.length>=4)allHeadings.push(sn.trim());
      if(sec.subs)sec.subs.forEach(function(sub){var ub=sub.num+' '+sub.title;if(ub.length>=4)allHeadings.push(ub.trim())});
    });
  });
  searchRounds.push(Array.from(new Set(allHeadings)).slice(0,25));

  // 第5轮：全文逐句摘要关键词（每句提取3-5个关键词批量检索）
  updLoad('提取句子摘要...',5);
  var sentenceKws = {};
  var box3 = document.getElementById('thesisBox');
  if (box3) {
    var rfBd2 = bodyBoundaryEl();
    var allPs = box3.querySelectorAll('p');
    for (var si2 = 0; si2 < Math.min(allPs.length, 200); si2++) {
      if (rfBd2 && (allPs[si2].compareDocumentPosition(rfBd2) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      var stxt = (allPs[si2].textContent || '').trim();
      if (stxt.length < 20) continue;
      var sents = stxt.split(/[。！？\.\?\!]/).filter(function(s){return s.trim().length >= 8;});
      for (var si3 = 0; si3 < sents.length; si3++) {
        var senText = sents[si3].trim();
        var senKws = extractTitleKws(senText);
        for (var ki2 = 0; ki2 < senKws.length; ki2++) {
          var kw = senKws[ki2];
          if (kw.length >= 2) sentenceKws[kw] = (sentenceKws[kw] || 0) + 1;
        }
      }
    }
  }
  var sentenceKwList = Object.entries(sentenceKws).sort(function(a,b){return b[1]-a[1];}).slice(0,80).map(function(e){return e[0];});
  searchRounds.push(sentenceKwList);

  // 第6轮：句子关键词两两组合
  var sentCombos=[];
  for(var sk=0;sk<Math.min(sentenceKwList.length-1,15);sk++){sentCombos.push(sentenceKwList[sk]+' '+sentenceKwList[sk+1]);}
  searchRounds.push(sentCombos.slice(0,30));

  // 合并去重 → 逐词并发搜索（1词/请求，并发6个，后端只查3源每词约2-4s）
  searchRounds=searchRounds.map(function(r){return Array.from(new Set(r)).filter(Boolean)});
  var allTerms3=[];searchRounds.forEach(function(r){allTerms3=allTerms3.concat(r);});
  allTerms3=Array.from(new Set(allTerms3));
  var pool=[];var seen=new Set();
  var concurrency=6; // 同时最多6个请求
  updLoad('搜索('+allTerms3.length+'词)...',15);
  var completed=0,total=allTerms3.length;
  function searchOneWord(word){
    return fetch('/search_api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queries:[word],max_per_query:100})})
      .then(function(r){return r.json()}).then(function(rj){if(rj.success&&rj.results){rj.results.forEach(function(rr){var nk=norm(rr.title).substring(0,60);if(!seen.has(nk)){seen.add(nk);pool.push(rr);}})}completed++;updLoad('搜索中('+completed+'/'+total+')...',15+Math.round(completed/total*15));})
      .catch(function(){completed++;});
  }
  // 并发池：同时跑 concurrency 个请求
  var idx=0,promises=[];
  function startNext(){
    while(promises.length<concurrency&&idx<allTerms3.length){
      var p=searchOneWord(allTerms3[idx++]).then(function(){promises=promises.filter(function(x){return x!==p;});startNext();});
      promises.push(p);
    }
  }
  startNext();
  // 等全部完成（最多90秒）
  if(promises.length>0){await Promise.race([Promise.all(promises),new Promise(function(r){setTimeout(r,90000)})]);}
  // 收尾：确保所有请求都完成
  var startWait=Date.now();
  while(promises.length>0&&Date.now()-startWait<10000){await sleep(200);}
  updLoad('累计'+pool.length+'条',30);
  if(!pool.length){hideLoad();searchRunning=false;alert('未检索到相关文献。\n\n可能原因：\n1. 论文主题词过于冷门\n2. 网络连接不稳定\n3. 搜索词数量不足\n\n建议：\n• 检查Python服务窗口日志\n• 访问 /ping 确认服务正常\n• 尝试减少检索文献总数');return}
  hideLoad();

  // === 弹窗①: 用户确认检索文献列表 ===
  var self=this;
  await new Promise(function(resolve){
    showRefConfirmModal(pool,existingRefs,total,function(userSelected){
      resolve(userSelected);
    });
  });
  // On cancel (_rcPool empty or rcClose), userSelected is undefined
  if(!_rcPool.length||Object.keys(_rcSelected).length===0){searchRunning=false;return}
  var userSelected=[];
  for(var i=0;i<_rcPool.length;i++){if(_rcSelected[i])userSelected.push(_rcPool[i]);}
  if(!userSelected.length){searchRunning=false;return}

  // === STEP 3: 筛选排序（在用户确认后运行） ===
  showLoad('筛选排序...',70);
  var selected=[];
  try{
    pool=userSelected;
    pool.sort(function(a,b){return(parseInt(b.year)||0)-(parseInt(a.year)||0)});
    updLoad('去重...',76);
    var existingTitles=existingRefs.map(function(er){return(er.title||'').toLowerCase()});
    function isDupWithExisting(rt){var rtL=(rt.title||'').toLowerCase(),rtK=extractTitleKws(rt.title||'');if(!rtK.length)return false;return existingTitles.some(function(et){var etK=extractTitleKws(et);if(!etK.length)return false;var overlap=rtK.filter(function(w){return etK.indexOf(w)>=0}).length;return overlap>=Math.min(3,Math.max(1,Math.floor(rtK.length*0.6)));});}
    var y3Pct=parseInt((document.getElementById('fY3')||{}).value)||50;
    var y5Pct=parseInt((document.getElementById('fY5')||{}).value)||75;
    var thisYear=new Date().getFullYear();
    // 分中文/英文两堆
    var cnPool=[],enPool=[];
    pool.sort(function(a,b){return(parseInt(b.year)||0)-(parseInt(a.year)||0);});
    for(var pi=0;pi<pool.length;pi++){var pr=pool[pi];if(isDupWithExisting(pr))continue;if(pr.isCN)cnPool.push(pr);else enPool.push(pr);}
    updLoad('中:'+cnPool.length+' 英:'+enPool.length+' → 目标'+total,78);
    var enWanted=Math.round(total*Math.max(enPct,100-cnPct)/100);
    var cnWanted=total-enWanted;
    var cnTake=Math.min(cnWanted,cnPool.length);
    var enTake=Math.min(enWanted,enPool.length);
    var cnShort=cnWanted-cnTake,enShort=enWanted-enTake;
    if(cnShort>0){enTake=Math.min(enPool.length,enTake+cnShort);}
    if(enShort>0){cnTake=Math.min(cnPool.length,cnTake+enShort);}
    if(cnTake+enTake<total){cnTake=cnPool.length;enTake=enPool.length;}
    updLoad('中文'+cnTake+'条 + 英文'+enTake+'条',80);
    for(var ci2=0;ci2<cnTake;ci2++)selected.push(cnPool[ci2]);
    for(var ei2=0;ei2<enTake;ei2++)selected.push(enPool[ei2]);
    var recentY5=function(r){return(parseInt(r.year)||0)>=thisYear-5;};
    var curY5=selected.filter(recentY5).length;
    var y5Target=Math.round(selected.length*y5Pct/100);
    if(curY5<y5Target&&pool.length>selected.length){
      var extra=y5Target-curY5;
      var newer=pool.filter(function(r){return recentY5(r)&&selected.indexOf(r)<0;});
      newer.sort(function(a,b){return(parseInt(b.year)||0)-(parseInt(a.year)||0);});
      selected.sort(function(a,b){return(parseInt(a.year)||0)-(parseInt(b.year)||0);});
      for(var bi=0;bi<newer.length&&bi<extra;bi++){for(var si=0;si<selected.length;si++){if(!recentY5(selected[si])){selected[si]=newer[bi];break;}}}
    }
    selected.sort(function(a,b){return(parseInt(b.year)||0)-(parseInt(a.year)||0)});
  }catch(e3){console.warn('[step3] filter error:',e3.message);}
  if(!selected.length){hideLoad();searchRunning=false;alert('筛选后无剩余文献。\n请在上一步中勾选更多文献后重试。');return}
  hideLoad();

  // === 弹窗②: 用户确认分配策略 ===
  var finalSelected=await new Promise(function(resolve){
    showAssignModal(selected,sections,function(result){
      resolve(result);
    });
  });
  // asSkip() returns null → use auto-assign
  if(finalSelected===null){
    showLoad('自动分配章节...',85);
    var distMode=document.getElementById('fDist')&&document.getElementById('fDist').value||'auto';
    await assignChapters(selected,distMode,total);
    finalSelected=selected;
  }else{
    // User confirmed assignment — chapters already set via asFinish()
    selected=finalSelected;
  }
  showLoad('四维度评估...',88);
  await sleep(0);await forEachChunked(finalSelected,function(r){scoreReference(r,{source:'new',hasSentence:false});},50);

  // === STEP 6: MERGE, RENUMBER & RE-ANCHOR ===
  updLoad('合并文献...',92);
  await sleep(0);

  // 1. 合并所有文献，给临时编号
  var allItems=[];
  existingRefs.forEach(function(er){allItems.push({r:er,source:'existing',origNum:er.num})});
  selected.forEach(function(sr){allItems.push({r:sr,source:'new',origNum:null})});
  mergedRefs=[];
  allItems.forEach(function(item,idx){
    var copy={};for(var k in item.r)copy[k]=item.r[k];copy.tempNum=idx+1;copy.source=item.source;copy.origNum=item.origNum;
    mergedRefs.push(copy);
  });

  // 2. 清除旧的新文献标记，已有文献标记保持原位不变
  var genSpans=document.querySelectorAll('.cite-marker.generated');for(var gsi=0;gsi<genSpans.length;gsi++){var gs=genSpans[gsi];if(gs.parentElement)gs.parentElement.removeChild(gs);}
  // 已有文献保持原始编号作为临时编号
  existingRefs.forEach(function(er){er.displayNum=er.num});
  // 新文献的临时displayNum从已有文献最大编号之后开始
  var maxExistingNum=0;existingRefs.forEach(function(er){if(er.num>maxExistingNum)maxExistingNum=er.num});
  var newRefs2=mergedRefs.filter(function(r){return r.source!=='existing'});
  newRefs2.forEach(function(r,idx){r.displayNum=maxExistingNum+idx+1});
  injectNewMarkers(newRefs2);
  updLoad('关联句子...',94);
  await sleep(0);

  // 2b. 未匹配到的文献：用 _treeIndex 找最佳句子注入
  try{mergedRefs.forEach(function(r){
    if(r.source==="existing"||r._domEl||!r.ch||!_treeIndex||!_treeIndex.sentences.length)return;
    var rtKws=extractTitleKws(r.title||"");if(!rtKws.length)return;
    // 找属于该章的句子
    var chIdx=-1;for(var ci=0;ci<_treeIndex.chapters.length;ci++){if(_treeIndex.chapters[ci].ch===r.ch){chIdx=ci;break;}}
    if(chIdx<0)return;
    var chNode=_treeIndex.chapters[chIdx].node;
    var bestSent=null,bestScore=0;
    (function walk(n){if(n.paragraphs)n.paragraphs.forEach(function(p){p.sentences.forEach(function(s){
      var sc=rtKws.reduce(function(sum,w){return sum+(s.text.toLowerCase().indexOf(w)>=0?1:0)},0);
      if(sc>bestScore){bestScore=sc;bestSent=s;}
    });});var kids=n.sections||n.subs||[];kids.forEach(function(k){walk(k);});})(chNode);
    if(!bestSent||bestScore<1)return;
    var paraEl=bestSent._paragraph.el;if(!paraEl)return;
    var n=r.displayNum||r.num;
    var mrk=document.createElement('span');mrk.className='cite-marker generated';mrk.textContent='['+n+']';
    mrk.onclick=function(nn){return function(e){e.stopPropagation();scrollToRef(nn);}}(n);
    paraEl.appendChild(mrk);
    r._domEl=mrk;r._ctx=bestSent.text.substring(0,80);r._hasSection=true;
    if(!bestSent.refs)bestSent.refs=[];bestSent.refs.push(n);
  })}catch(es){console.warn("[auto2b] skip:",es.message);}
  // 2c. 极少数仍未匹配的：追加到章树节点下第一个段落的最后
  try{mergedRefs.forEach(function(r){
    if(r.source==="existing"||r._domEl||!r.ch||!_treeIndex||!_treeIndex.chapters.length)return;
    var chIdx2=-1;for(var ci=0;ci<_treeIndex.chapters.length;ci++){if(_treeIndex.chapters[ci].ch===r.ch){chIdx2=ci;break;}}
    if(chIdx2<0)return;
    var chNode2=_treeIndex.chapters[chIdx2].node;
    var firstPara=null;
    (function walk2(n){if(!firstPara&&n.paragraphs&&n.paragraphs.length)firstPara=n.paragraphs[0];if(!firstPara){var kids=n.sections||n.subs||[];kids.forEach(function(k){walk2(k);});}})(chNode2);
    if(!firstPara||!firstPara.el)return;
    var n=r.displayNum||r.num;
    var mrk2=document.createElement('span');mrk2.className='cite-marker generated';mrk2.textContent='['+n+']';
    mrk2.onclick=function(nn){return function(e){e.stopPropagation();scrollToRef(nn);}}(n);
    firstPara.el.appendChild(mrk2);
    r._domEl=mrk2;r._ctx=(firstPara.el.textContent||'').substring(0,60);r._hasSection=true;
  })}catch(es2){console.warn("[auto2c] skip:",es2.message);}

  // 3.
  var refBoundary2=bodyBoundaryEl();
  var oldRefs=mergedRefs.slice();var markersInOrder=[];
  var spanList=document.querySelectorAll('.cite-marker');
  for(var si=0;si<spanList.length;si++){
    var sp=spanList[si];
    if(refBoundary2&&(sp.compareDocumentPosition(refBoundary2)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
    var ref2=oldRefs.find(function(r){return r._domEl===sp;});
    if(ref2)markersInOrder.push(ref2);
  }

  // 4. 按DOM顺序重建mergedRefs，分配新的displayNum
  // 先收集有DOM的，再追加无DOM的，全部按临时序号排序保持稳定
  mergedRefs=[];
  var seen2=new Set();
  markersInOrder.forEach(function(ref3){
    if(!seen2.has(ref3)){seen2.add(ref3);ref3.displayNum=mergedRefs.length+1;mergedRefs.push(ref3);}
  });
  // 没有DOM标记的文献按 tempNum 排序后追加（保持编号连续性）
  var noDom=oldRefs.filter(function(r){return !seen2.has(r);});
  noDom.sort(function(a,b){return(a.tempNum||0)-(b.tempNum||0);});
  noDom.forEach(function(r){r.displayNum=mergedRefs.length+1;mergedRefs.push(r);seen2.add(r);});

  // 5. 更新所有span的数字和click为新的displayNum
  spanList=document.querySelectorAll('.cite-marker');
  for(var ui=0;ui<spanList.length;ui++){
    var sp2=spanList[ui];
    var matchedRef=oldRefs.find(function(r){return r._domEl===sp2;});
    if(matchedRef){
      matchedRef._domEl=sp2;
      sp2.textContent='['+matchedRef.displayNum+']';
      sp2.onclick=function(nn){return function(e){e.stopPropagation();scrollToRef(nn)}}(matchedRef.displayNum);
    }
  }

  // 6. 设subType：原文文献通过origNum与displayNum比较判断是否顺延
  mergedRefs.forEach(function(r){
    if(r.source==='existing'){
      r.subType=(r.displayNum===r.origNum)?'unchanged':'displaced';
    }else{
      r.subType='appended';
    }
    r.source=undefined;r.origNum=undefined;
  });
  searchRunning=false;
  updLoad('渲染结果...',98);
  await sleep(0);
  // 注入完成后，给有句子位置的文献补算句子重合度
  try{mergedRefs.filter(function(r){return r.subType==='appended'&&r._domEl;}).forEach(function(r){scoreReference(r,{source:'new',hasSentence:true});});}catch(e){}
  // 通知刷新所有动态视图
  if(typeof onRefsChanged==='function')onRefsChanged();
  hideLoad();
  setTimeout(function(){highlightRefSentences();},200);
  try{renderRefs();}catch(rrEx){console.error('[render] error:',rrEx.message);
    // 渲染失败至少更新状态栏
    document.getElementById('statusBar').innerHTML='✅ 检索完成 '+(mergedRefs.length||selected.length||0)+'条 | 已有'+existingRefs.length+' | 新增'+(selected.length||0);
  }
  }catch(err){console.error('[search] fatal:',err.message);hideLoad();searchRunning=false;
    alert('检索过程遇到问题: '+err.message+'\n\n但您的数据没有丢失，可以重试。');}
}

async function verifyRef(title,journal,year,doi){
  if(!title||title.length<5)return{score:0,doi:'',citations:0,retracted:false,verified:false,pub_type:'',source:''};
  try{
    var resp=await fetch('/verify_api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title,journal:journal||'',year:year||'',doi:doi||''})});
    if(resp.ok){var r=await resp.json();if(r.success)return{score:r.score||0,doi:r.doi||'',citations:r.citations||0,retracted:r.retracted||false,verified:r.verified||false,pub_type:r.pub_type||'',source:r.source||''}}
  }catch(e){}
  return{score:0,doi:'',citations:0,retracted:false,verified:false,pub_type:'',source:''};
}

function renderRefs(){
  var c=document.getElementById('refs');c.style.overflowY='auto';c.style.maxHeight='';
  var chN={};
  // Build chapter name map from sections
  sections.forEach(function(cs){if(cs.ch&&cs.name)chN[cs.ch]=cs.name});
  // Fill in missing chapters with default names
  for(var i=1;i<=10;i++)if(!chN[i])chN[i]='第'+i+'章';
  if(!mergedRefs.length){c.innerHTML='<div style="text-align:center;padding:30px;color:#9ca3af">点击检索文献</div>';return}
  var byCh={};mergedRefs.forEach(function(r,i){var ch=r.ch||1;if(!byCh[ch])byCh[ch]=[];byCh[ch].push({r:r,i:i})});
  var chKeys=Object.keys(byCh).sort(function(a,b){return parseInt(a)-parseInt(b)});
  var totalRefs=mergedRefs.length;
  var h='';
  chKeys.forEach(function(ck){
    var items=byCh[ck],count=items.length,chId='chgrp-'+ck;
    var pct=Math.round(count/totalRefs*100);
    h+='<div class="ch-section" style="margin-bottom:8px">';
    h+='<h3 onclick="toggleChGroup(\''+chId+'\')"><span class="arrow open" id="arrow-'+chId+'">&#9654;</span> '+chN[ck]+' <span style="font-size:.68rem;color:var(--m);font-weight:400">'+count+'条 ('+pct+'%)</span></h3>';
    h+='<div id="'+chId+'" style="display:block">';
    items.forEach(function(item){
      var r=item.r,i=item.i;
      var n=r.displayNum||(i+1);
      var cardCls='ref';
      var labelText;
      if(!r.subType||r.subType==='unchanged'){cardCls+=' existing';labelText='蓝色·原文'}
      else if(r.subType==='displaced'){cardCls+=' displaced';labelText='紫色·顺延'}
      else if(r.subType==='replacing'){cardCls+=' replacing';labelText='橙色·插入'}
      else{cardCls+=' appended';labelText='绿色·新增'}

      var gb=formatGB7714(r);
      var chKey=r.ch||1;
      var chObj=sections.find(function(s){return s.ch===chKey});
      var chName=chN[chKey]||('第'+chKey+'章');

      // 位置信息：统一从 _treeIndex 获取
      var sp=lookupRefPosition(r);
      if(!sp.ch||sp.ch==='第1章')sp.ch=chName;
      var conf=r.conf||0,cl=conf>=70?'high':(conf>=40?'medium':'low');
      var dupRate=r._dupRate||0,drCl=dupRate>=80?'high':(dupRate>=50?'medium':'low');

      // 校验状态徽章
      var vBadge='';
      if(r._retracted){vBadge+='<span title="⚠ 该文献已被撤稿" style="font-size:.6rem;background:#ff3b30;color:#fff;padding:1px 6px;border-radius:4px;margin-right:3px;font-weight:600">撤稿</span>';}
      if(r._verified){vBadge+='<span title="DOI验证通过 ('+(r._verifySource||'')+')" style="font-size:.6rem;background:#30d158;color:#fff;padding:1px 6px;border-radius:4px;margin-right:3px;font-weight:600">✓ 已验证</span>';}
      else if(r.conf>=50){vBadge+='<span title="标题部分匹配" style="font-size:.6rem;background:#ff9f0a;color:#fff;padding:1px 6px;border-radius:4px;margin-right:3px;font-weight:600">⚠ 待确认</span>';}
      else{vBadge+='<span title="未在数据库中匹配到" style="font-size:.6rem;background:rgba(0,0,0,0.1);color:#86868b;padding:1px 6px;border-radius:4px;margin-right:3px;font-weight:600">❓ 未校验</span>';}
      if(r._citations>0){vBadge+='<span title="被引 '+r._citations+' 次" style="font-size:.6rem;background:rgba(0,113,227,0.1);color:#0071e3;padding:1px 6px;border-radius:4px;font-weight:600">📊 '+r._citations+'</span>';}
      if(vBadge)vBadge='<div style="margin:4px 0 2px">'+vBadge+'</div>';

      var doi=r.doi||'',tE=encodeURIComponent(gb.replace(/<[^>]+>/g,'').substring(0,200)),act='';
      if(doi)act+='<a class="dl" href="https://doi.org/'+doi+'" target="_blank">DOI</a>';
      act+='<a class="open" href="https://www.baidu.com/s?wd='+tE+'" target="_blank">百度</a>';
      act+='<a class="open" href="https://scholar.google.com/scholar?q='+tE+'" target="_blank">Scholar</a>';
      act+='<button class="verify" onclick="reverify('+i+')">校验</button>';
      act+='<button onclick="copyOne('+i+')">复制</button>';
      // 优化句子：未匹配到节 或 重合率低
      if((!r._hasSection||dupRate<50)&&(r.subType==='appended'||r.subType==='displaced')){
        act+='<button onclick="showOptimizeSentence('+i+')" style="background:#f59e0b;color:#fff">优化句子</button>';
      }
      if(r.subType==='appended')act+='<button class="del-btn" onclick="deleteRef('+i+')">删除</button>';

      var cardClick=r._domEl?'onclick="jumpToDomEl(mergedRefs['+i+'])"':'';
      h+='<div class="'+cardCls+'" id="r'+(n-1)+'" '+cardClick+'>';
      h+='<div class="ref-header">';
      h+='<div class="rnum">['+n+']</div>';
      h+='<div class="ref-content">'+gb+'</div>';
      h+='</div>';
      if(vBadge)h+=vBadge;
      h+='<div class="ref-detail">';
      h+='<div class="ref-row"><span class="label">位置</span><span class="value ch">'+sp.ch+'</span>';
      if(sp.sec)h+='<span class="value sec"> → '+sp.sec+'</span>';
      if(sp.sub)h+='<span class="value sub"> → '+sp.sub+'</span>';
      h+='</div>';
      if(!r._hasSection&&(r.subType==='appended'||r.subType==='replacing')){
        h+='<div class="ref-row" style="background:#fef2f2;border-radius:4px;padding:4px 8px;margin:4px 0"><span class="label" style="color:#dc2626">⚠</span><span class="value" style="color:#dc2626;font-weight:600">未匹配到具体小节 — 建议点击下方"✏️ 优化句子"</span></div>';
      }
      if(sp.ctx)h+='<div class="ref-row"><span class="label">句子</span><span class="value text">「'+sp.ctx+'」</span></div>';
      h+='<div class="ref-bar"><span class="label" title="'+_scoreInfo.conf+'">真实度 ℹ️</span><div class="bar-wrap"><div class="bar-fill '+cl+'" style="width:'+conf+'%"></div></div><span class="num">'+conf+'%</span></div>';
      h+='<div class="ref-bar"><span class="label" title="'+_scoreInfo.topicRel+'">主题相关 ℹ️</span><div class="bar-wrap"><div class="bar-fill '+(r._topicRel>=70?'high':r._topicRel>=40?'medium':'low')+'" style="width:'+(r._topicRel||0)+'%"></div></div><span class="num">'+(r._topicRel||0)+'%</span></div>';
      h+='<div class="ref-bar"><span class="label" title="'+_scoreInfo.secFit+'">章节适配 ℹ️</span><div class="bar-wrap"><div class="bar-fill '+(r._secFit>=70?'high':r._secFit>=40?'medium':'low')+'" style="width:'+(r._secFit||0)+'%"></div></div><span class="num">'+(r._secFit||0)+'%</span></div>';
      h+='<div class="ref-bar"><span class="label" title="'+_scoreInfo.dupRate+'">句子重合 ℹ️</span><div class="bar-wrap"><div class="bar-fill '+drCl+'" style="width:'+dupRate+'%"></div></div><span class="num">'+dupRate+'%</span></div>';
      h+='</div>';
      h+='<div class="ref-actions" onclick="event.stopPropagation()">'+act+'<span style="margin-left:auto;font-size:.6rem;color:#94a3b8">'+labelText+'</span></div>';
      h+='</div>';
    });
    h+='</div></div>';
  });
  c.innerHTML=h;
  updateDashboard(mergedRefs);
}
function toggleChGroup(id){var el=document.getElementById(id),arrow=document.getElementById('arrow-'+id);if(el){el.style.display=el.style.display==='none'?'block':'none';if(arrow)arrow.classList.toggle('open')}}

function renderExistingOnly(){
  var c=document.getElementById('refs'),chN={};
  sections.forEach(function(cs){chN[cs.ch]=cs.name});
  for(var i=1;i<=10;i++)if(!chN[i])chN[i]='第'+i+'章';
  if(!existingRefs.length){c.innerHTML='<div style="text-align:center;padding:30px;color:#9ca3af">未检测到已有参考文献</div>';return}

  var byCh={};existingRefs.forEach(function(r,i){var ch=r.ch||1;if(!byCh[ch])byCh[ch]=[];byCh[ch].push({r:r,i:i})});
  var chKeys=Object.keys(byCh).sort(function(a,b){return parseInt(a)-parseInt(b)});
  var totalRefs=existingRefs.length;
  var h='';

  chKeys.forEach(function(ck){
    var items=byCh[ck],count=items.length,chId='echgrp-'+ck;
    var pct=Math.round(count/totalRefs*100);
    h+='<div class="ch-section" style="margin-bottom:8px">';
    h+='<h3 onclick="toggleChGroup(\''+chId+'\')"><span class="arrow open" id="arrow-'+chId+'">&#9654;</span> '+chN[ck]+' <span style="font-size:.68rem;color:var(--m);font-weight:400">'+count+'条 ('+pct+'%)</span></h3>';
    h+='<div id="'+chId+'" style="display:block">';
    items.forEach(function(item){
      var r=item.r,i=item.i;
      var gb=r.ci||'';
      // 优先用初始解析时存储的位置信息
      var sp=lookupRefPosition(r);
      if(!sp.ch)sp.ch=chN[r.ch||1]||('第'+(r.ch||1)+'章');
      var conf=r.conf||0,cl=conf>=70?'high':(conf>=40?'medium':'low');
      var dupRate=r._dupRate||0,drCl=dupRate>=80?'high':(dupRate>=50?'medium':'low');

      var vBadge2='';
      if(r._retracted){vBadge2+='<span title="⚠ 该文献已被撤稿" style="font-size:.6rem;background:#ff3b30;color:#fff;padding:1px 6px;border-radius:4px;margin-right:3px;font-weight:600">撤稿</span>';}
      if(r._verified){vBadge2+='<span title="DOI验证通过" style="font-size:.6rem;background:#30d158;color:#fff;padding:1px 6px;border-radius:4px;margin-right:3px;font-weight:600">✓ 已验证</span>';}
      else if(r.conf>=50){vBadge2+='<span title="标题部分匹配" style="font-size:.6rem;background:#ff9f0a;color:#fff;padding:1px 6px;border-radius:4px;margin-right:3px;font-weight:600">⚠ 待确认</span>';}
      else{vBadge2+='<span title="未在数据库中匹配到" style="font-size:.6rem;background:rgba(0,0,0,0.1);color:#86868b;padding:1px 6px;border-radius:4px;margin-right:3px;font-weight:600">❓ 未校验</span>';}
      if(r._citations>0){vBadge2+='<span title="被引 '+r._citations+' 次" style="font-size:.6rem;background:rgba(0,113,227,0.1);color:#0071e3;padding:1px 6px;border-radius:4px;font-weight:600">📊 '+r._citations+'</span>';}
      if(vBadge2)vBadge2='<div style="margin:4px 0 2px;padding:0 12px">'+vBadge2+'</div>';
      
            var cardClick=r._domEl?'onclick="jumpToDomEl(existingRefs['+i+'])"':'';
      h+='<div class="ref existing" id="er'+i+'" '+cardClick+'>';
      h+='<div class="ref-header">';
      h+='<div class="rnum">['+(i+1)+']</div>';
      h+='<div class="ref-content">'+gb+'</div>';
      h+='</div>';
      if(vBadge2)h+=vBadge2;
      h+='<div class="ref-detail">';
      h+='<div class="ref-row"><span class="label">位置</span><span class="value ch">'+sp.ch+'</span>';
      if(sp.sec)h+='<span class="value sec"> → '+sp.sec+'</span>';
      if(sp.sub)h+='<span class="value sub"> → '+sp.sub+'</span>';
      h+='</div>';
      if(sp.ctx)h+='<div class="ref-row"><span class="label">句子</span><span class="value text">「'+sp.ctx+'」</span></div>';
      h+='<div class="ref-bar"><span class="label" title="'+_scoreInfo.conf+'">真实度 ℹ️</span><div class="bar-wrap"><div class="bar-fill '+cl+'" style="width:'+conf+'%"></div></div><span class="num">'+conf+'%</span></div>';
      h+='<div class="ref-bar"><span class="label" title="'+_scoreInfo.topicRel+'">主题相关 ℹ️</span><div class="bar-wrap"><div class="bar-fill '+(r._topicRel>=70?'high':r._topicRel>=40?'medium':'low')+'" style="width:'+(r._topicRel||0)+'%"></div></div><span class="num">'+(r._topicRel||0)+'%</span></div>';
      h+='<div class="ref-bar"><span class="label" title="'+_scoreInfo.secFit+'">章节适配 ℹ️</span><div class="bar-wrap"><div class="bar-fill '+(r._secFit>=70?'high':r._secFit>=40?'medium':'low')+'" style="width:'+(r._secFit||0)+'%"></div></div><span class="num">'+(r._secFit||0)+'%</span></div>';
      h+='<div class="ref-bar"><span class="label" title="'+_scoreInfo.dupRate+'">句子重合 ℹ️</span><div class="bar-wrap"><div class="bar-fill '+drCl+'" style="width:'+dupRate+'%"></div></div><span class="num">'+dupRate+'%</span></div>';
      h+='</div>';
      h+='<div class="ref-actions" onclick="event.stopPropagation()">';
      h+='<button class="verify" onclick="reverifyExisting('+i+')">校验</button>';
      h+='<button onclick="copyOneExisting('+i+')">复制</button>';
      h+='<span style="margin-left:auto;font-size:.6rem;color:#94a3b8">蓝色·原文</span>';
      h+='</div>';
      h+='</div>';
    });
    h+='</div></div>';
  });

  c.innerHTML=h;
  var rs=document.getElementById('refStatus');if(rs)rs.innerHTML='已有'+existingRefs.length+'条文献';
  updateDashboard(existingRefs);
}

function copyOneExisting(idx){var r=existingRefs[idx];if(!r)return;var txt=r.ci||'';navigator.clipboard.writeText('['+(idx+1)+'] '+txt);ttp('已复制')}


function deleteRef(idx){
  if(!mergedRefs.length)return;
  var r=mergedRefs[idx];if(!r||r.subType==='unchanged'||r.subType==='displaced'){ttp('原文文献不可删除');return}
  // Remove marker from DOM
  if(r._domEl&&r._domEl.parentElement)r._domEl.parentElement.removeChild(r._domEl);
  // Remove from list
  mergedRefs.splice(idx,1);
  // Renumber all remaining refs in DOM order (stable: no-DOM refs sorted by tempNum)
  var spanList3=document.querySelectorAll('.cite-marker');
  var oldRefs3=mergedRefs.slice();mergedRefs=[];
  var seen3=new Set();
  var refBoundary3=bodyBoundaryEl();
  for(var si3=0;si3<spanList3.length;si3++){
    var sp3=spanList3[si3];
    if(refBoundary3&&(sp3.compareDocumentPosition(refBoundary3)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
    var ref3=oldRefs3.find(function(rf){return rf._domEl===sp3;});
    if(ref3&&!seen3.has(ref3)){seen3.add(ref3);ref3.displayNum=mergedRefs.length+1;mergedRefs.push(ref3);}
  }
  var noDom2=oldRefs3.filter(function(rf){return !seen3.has(rf);});
  noDom2.sort(function(a,b){return(a.tempNum||0)-(b.tempNum||0);});
  noDom2.forEach(function(rf){rf.displayNum=mergedRefs.length+1;mergedRefs.push(rf);seen3.add(rf);});
  // Update span texts
  spanList3=document.querySelectorAll('.cite-marker');
  for(var ui3=0;ui3<spanList3.length;ui3++){
    var sp4=spanList3[ui3];
    var mr3=oldRefs3.find(function(rf){return rf._domEl===sp4;});
    if(mr3){
      mr3._domEl=sp4;
      sp4.textContent='['+mr3.displayNum+']';
      sp4.onclick=function(nn){return function(e){e.stopPropagation();scrollToRef(nn)}}(mr3.displayNum);

    }
  }
  renderRefs();
  ttp('已删除，共'+mergedRefs.length+'条');
}
function copyOne(idx){var r=mergedRefs[idx];if(!r)return;var gb=formatGB7714(r);navigator.clipboard.writeText('['+(r.displayNum||(idx+1))+'] '+gb.replace(/<[^>]+>/g,''));ttp('已复制')}
function copyBib(){navigator.clipboard.writeText(mergedRefs.map(function(r,i){return'['+(r.displayNum||(i+1))+'] '+formatGB7714(r).replace(/<[^>]+>/g,'')}).join('\n\n'));ttp('已复制')}
async function reverify(idx){var r=mergedRefs[idx];if(!r)return;showLoad('校验中...',0);var title=r.title||'',jr=r.journal||'',yr=r.year||'';if(!title&&r.ci){var m=parseRefMeta(r.ci);title=m.title;jr=m.journal;yr=m.yr}if(!title&&r.ci){title=r.ci.replace(/\s+/g,' ').substring(0,100).replace(/^\[\d+\]\s*/,'').trim()}var v=await verifyRef(title,jr,yr,r.doi||'');r.conf=v.score||Math.min(35,r.conf||0);if(v.doi&&!r.doi)r.doi=v.doi;r._citations=v.citations||0;r._retracted=v.retracted;r._verified=v.verified;r._pubType=v.pub_type;r._verifySource=v.source;hideLoad();renderRefs();ttp(v.verified?'✅ DOI验证通过 ('+v.score+'%)':(v.score>=50?'⚠ 部分匹配 ('+v.score+'%)':'❓ 未验证'))}
async function reverifyExisting(idx){var r=existingRefs[idx];if(!r)return;showLoad('校验中...',0);var title=r.title||'',jr=r.journal||'',yr=r.year||'';if(!title&&r.ci){var m=parseRefMeta(r.ci);title=m.title;jr=m.journal;yr=m.yr}if(!title&&r.ci){title=r.ci.replace(/\s+/g,' ').substring(0,100).replace(/^\[\d+\]\s*/,'').trim()}var v=await verifyRef(title,jr,yr,r.doi||'');r.conf=v.score||Math.min(35,r.conf||0);if(v.doi&&!r.doi)r.doi=v.doi;r._citations=v.citations||0;r._retracted=v.retracted;r._verified=v.verified;r._pubType=v.pub_type;r._verifySource=v.source;hideLoad();renderExistingOnly();ttp(v.verified?'✅ DOI验证通过 ('+v.score+'%)':(v.score>=50?'⚠ 部分匹配 ('+v.score+'%)':'❓ 未验证'))}
async function batchVerify(){var list=mergedRefs.length?mergedRefs:existingRefs;if(!list.length)return ttp('请先检索');showLoad('批量校验中...',0);if(typeof startCatGame==='function')setTimeout(function(){startCatGame();},500);var done=0,total=list.length;
  // 并发校验（每批4个）
  for(var bi=0;bi<total;bi+=4){
    var batch=list.slice(bi,Math.min(bi+4,total));
    var results=await Promise.all(batch.map(function(r){var title=r.title||'',jr=r.journal||'',yr=r.year||'';if(!title&&r.ci){var m=parseRefMeta(r.ci);title=m.title;jr=m.journal;yr=m.yr}if(!title&&r.ci){title=r.ci.replace(/\s+/g,' ').substring(0,100).replace(/^\[\d+\]\s*/,'').trim()}return verifyRef(title,jr,yr,r.doi||'');}));
    for(var ri=0;ri<batch.length;ri++){var r=batch[ri],v=results[ri];r.conf=v.score||Math.min(35,r.conf||0);if(v.doi&&!r.doi)r.doi=v.doi;r._citations=v.citations||0;r._retracted=v.retracted;r._verified=v.verified;r._pubType=v.pub_type;r._verifySource=v.source;done++;}
    updLoad('校验中 ('+done+'/'+total+')',Math.round(done/total*100));
  }
  hideLoad();if(mergedRefs.length)renderRefs();else renderExistingOnly();ttp('校验完成: '+total+'条');}

// ========== 全文树构建器：章→节→小节→段落→句子（5层） ==========
function buildFullTree(box, allHeadings, bodyStartIdx, refBound){
  // ① 构建标题树（章/节/小节）
  var tree=[],hdMap=new Map();
  allHeadings.forEach(function(h){
    var lv=h.level;
    if(lv<0 && h.tagLevel>0) lv=h.tagLevel<=1?0:(h.tagLevel===2?1:2);
    if(lv>=0){h.level=lv; hdMap.set(h.el,{el:h.el,txt:h.txt,level:lv});}
  });
  var chCounter=0,stack=[];
  for(var hi=0;hi<allHeadings.length;hi++){
    var hd=allHeadings[hi];if(hd.level<0)continue;
    while(stack.length>0&&stack[stack.length-1].level>=hd.level)stack.pop();
    var nStr=detectHeadingNum(hd.txt);
    if(hd.level===0){
      chCounter++;var cn=detectChapterNum(hd.txt)||chCounter;
      var dup=null;for(var ci=0;ci<tree.length;ci++){if(tree[ci].ch===cn){dup=tree[ci];break;}}
      var ch={ch:cn,name:hd.txt,el:hd.el,sections:[]};
      if(dup){ch=dup;if(hd.txt.length>ch.name.length)ch.name=hd.txt;}
      else tree.push(ch);
      stack=[{node:ch,level:0}];
    }else{
      if(!stack.length)continue;
      var parent=stack[stack.length-1].node;
      var nc={num:nStr,title:hd.txt.replace(/^[\d\.\s、,，]+/,''),el:hd.el,subs:[]};
      if(hd.level===1){if(!parent.sections)parent.sections=[];parent.sections.push(nc);stack.push({node:nc,level:1});}
      else if(hd.level===2&&parent.sections&&parent.sections.length){var sec=parent.sections[parent.sections.length-1];if(!sec.subs)sec.subs=[];sec.subs.push(nc);stack.push({node:nc,level:2});}
    }
  }

  // ② 遍历 DOM，为每个标题节点收集其下的段落和句子
  var allBodyEls=box.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li');
  // 将标题元素映射到树节点
  var elToNode=new Map(),hdEls=[];
  function mapNode(node,lv){
    if(node.el)hdEls.push({el:node.el,node:node,level:lv});
    var kids=node.sections||node.subs||[];
    for(var i=0;i<kids.length;i++)mapNode(kids[i],lv+1);
  }
  for(var i=0;i<tree.length;i++)mapNode(tree[i],0);
  hdEls.sort(function(a,b){return(a.el.compareDocumentPosition(b.el)&Node.DOCUMENT_POSITION_FOLLOWING)?-1:1;});

  // ③ 收集每个标题节点下方的段落，拆分成句子
  for(var hi2=0;hi2<hdEls.length;hi2++){
    var he=hdEls[hi2],node=he.node;
    // 找到该标题在 allBodyEls 中的位置
    var startPos=-1;
    for(var si=0;si<allBodyEls.length;si++){if(allBodyEls[si]===he.el){startPos=si;break;}}
    if(startPos<0)continue;
    // 找下一个标题的位置作为边界
    var endPos=allBodyEls.length;
    for(var ei=startPos+1;ei<allBodyEls.length;ei++){
      if(refBound&&(allBodyEls[ei].compareDocumentPosition(refBound)&Node.DOCUMENT_POSITION_FOLLOWING)){endPos=ei;break;}
      if(hdMap.has(allBodyEls[ei])){endPos=ei;break;}
    }
    // 收集该区间内的非标题段落
    node.paragraphs=[];var fullText='';
    for(var pi=startPos+1;pi<endPos;pi++){
      var pEl=allBodyEls[pi];
      if(hdMap.has(pEl))continue; // 跳过子标题
      var pt=(pEl.textContent||'').trim();
      if(!pt||pt.length<2)continue;
      if(/^\d{1,3}$/.test(pt)||/^[ivxlcdm]+$/i.test(pt)||/^[-—–]/.test(pt))continue;
      // 拆句子
      var sents=[],last=0,t=pt;
      for(var c=0;c<t.length;c++){
        var ch=t.charAt(c);
        if('。！？.!?'.indexOf(ch)>=0){
          var s=t.substring(last,c+1).trim();
          if(s.length>=2)sents.push({text:s,el:pEl,refs:[]});
          last=c+1;
        }
      }
      var tail=t.substring(last).trim();
      if(tail.length>=2)sents.push({text:tail,el:pEl,refs:[]});
      if(sents.length>0){
        var para={el:pEl,text:pt,sentences:sents};
        node.paragraphs.push(para);
        for(var sk=0;sk<sents.length;sk++)sents[sk]._paragraph=para;
        fullText+=pt+'\n';
      }
    }
    node.text=fullText.trim();
  }

  // ④ 构建全局索引
  _treeIndex={chapters:[],sections:[],subs:[],paragraphs:[],sentences:[]};
  function indexNode(node,lv,parent){
    if(lv===0){var ci={idx:_treeIndex.chapters.length,ch:node.ch,name:node.name,el:node.el,node:node};_treeIndex.chapters.push(ci);}
    else if(lv===1){var si={idx:_treeIndex.sections.length,num:node.num,title:node.title,el:node.el,node:node,_chapter:parent};_treeIndex.sections.push(si);}
    else if(lv===2){var ui={idx:_treeIndex.subs.length,num:node.num,title:node.title,el:node.el,node:node,_section:parent};_treeIndex.subs.push(ui);}
    if(node.paragraphs){
      for(var pi=0;pi<node.paragraphs.length;pi++){
        var p=node.paragraphs[pi];
        var pe={idx:_treeIndex.paragraphs.length,el:p.el,text:p.text,node:p,_parent:node};_treeIndex.paragraphs.push(pe);
        for(var si2=0;si2<p.sentences.length;si2++){
          var s=p.sentences[si2];
          var se={idx:_treeIndex.sentences.length,text:s.text,el:s.el,refs:s.refs,node:s,_paragraph:p,_parent:node};
          _treeIndex.sentences.push(se);
          s._idx=_treeIndex.sentences.length-1;
        }
      }
    }
    var kids=node.sections||node.subs||[];for(var ki=0;ki<kids.length;ki++)indexNode(kids[ki],lv+1,lv===0?node:parent);
  }
  for(var ti=0;ti<tree.length;ti++)indexNode(tree[ti],0,null);
  console.log('[tree] Built:',tree.length,'ch,',_treeIndex.sections.length,'sec,',_treeIndex.subs.length,'sub,',_treeIndex.paragraphs.length,'paras,',_treeIndex.sentences.length,'sents');
  return tree;
}

// INIT - this runs LAST, after all functions are defined
(function(){
  var fi=document.getElementById('fileInput');
  if(!fi)return;
  fi.addEventListener('change',async function(e){
    var f=e.target.files[0];if(!f)return;
    var ext=(f.name||'').toLowerCase().split('.').pop();
    if(ext!=='docx'&&ext!=='doc'){alert('不支持 .'+ext+', 请上传 .docx 或 .doc 文件');return}

    showLoad('准备解析...', 2, f.name);

    // === .doc 提示：推荐转为 .docx 以获得完整标题样式信息 ===
    if(ext==='doc'){
      hideLoad();
      var docChoice=confirm('⚠ 此文件为旧版 .doc 格式。\n\n建议用 Word 打开后另存为 .docx 再上传，可以保留标题样式信息，校准更准确。\n\n直接上传 .doc 将丢失字体样式数据，只能解析纯文本。\n\n点击"确定"继续上传 .doc，点击"取消"返回。');
      if(!docChoice){document.getElementById('fileInput').value='';return}
      showLoad('准备解析...', 2, f.name);
    }

    if(ext==='docx'){
    if(typeof mammoth==='undefined'){
      updLoad('等待Word解析库加载...',3);
      for(var retry=0;retry<15&&typeof mammoth==='undefined';retry++){
        await new Promise(function(rr){setTimeout(rr,200)});
        updLoad('等待库加载...',Math.min(8,retry*0.5+3));
      }
      if(typeof mammoth==='undefined'){hideLoad();alert('mammoth.browser.min.js 加载超时。请刷新页面后重试，或检查该文件是否在相同目录。');return}
    }
    if(typeof JSZip==='undefined'){hideLoad();alert('jszip.min.js 未加载。请检查文件是否在相同目录。');return}

    updLoad('读取文件...',10);var buf;
    try{buf=await f.arrayBuffer()}catch(er2){hideLoad();alert('文件读取失败: '+er2.message);return}
    } // end if docx

    try{
    searchCache={};mergedRefs=[];
    updLoad('解析正文...','10',f.name);

    // === .doc 格式：后端转换 ===
    if(ext==='doc'){
      updLoad('转换 .doc...',8);
      var formData=new FormData();formData.append('file',f);
      var resp2=await fetch('/convert_doc',{method:'POST',body:formData});
      var jj2=await resp2.json();
      if(!jj2.success){hideLoad();alert('.doc 转换失败: '+jj2.error);return}
      manuscriptHTML=jj2.html;manuscriptText=jj2.text;
      window._docxStyleGroups=[];
      updLoad('加载正文...',15);
    }

    // === .docx 格式：本地解析 ===
    if(ext==='docx'){
    // ================================================================
    // PHASE 1: XML 预解析 — 提取样式名 + 字体属性 + 生成 styleMap
    // ================================================================
    window._docxParaStyleList=[];
    window._docxFontInfo=[];  // per-paragraph font data for post-processing
    var mammothOptions={includeDefaultStyleMap:true,transformDocument:function(doc){return doc;}};
    try{
      var docxZip=await JSZip.loadAsync(buf);
      var stylesXml=await docxZip.file('word/styles.xml').async('string');
      var docXml=await docxZip.file('word/document.xml').async('string');
      if(stylesXml&&docXml){
        // ----- 步骤A: 从 styles.xml 提取 styleId → 名称 + 默认字体属性 -----
        var styleNameById={}, styleTypeById={}, styleRprById={};
        var styleBlocks=stylesXml.split('<w:style ');
        for(var sbi=1;sbi<styleBlocks.length;sbi++){
          var block2='<w:style '+styleBlocks[sbi];
          var idM=block2.match(/w:styleId="([^"]*)"/);
          if(!idM)continue;
          var sid2=idM[1];
          var nmM=block2.match(/<w:name[^>]*w:val="([^"]*)"/);
          var tpM=block2.match(/w:type="([^"]*)"/);
          styleNameById[sid2]=nmM?nmM[1]:sid2;
          styleTypeById[sid2]=tpM?tpM[1]:'paragraph';

          // 提取样式级别的 rPr 默认值（自定义样式如 _TJ 系在此定义字体）
          var defRpr={};
          var rprBlockM=block2.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
          if(rprBlockM){
            var drpr=rprBlockM[1];
            var drfM=drpr.match(/<w:rFonts[^>]*\/?>/);
            if(drfM){
              var daM=drfM[0].match(/w:ascii="([^"]*)"/);
              var dhM=drfM[0].match(/w:hAnsi="([^"]*)"/);
              var deM=drfM[0].match(/w:eastAsia="([^"]*)"/);
              var dcM=drfM[0].match(/w:cs="([^"]*)"/);
              if(daM)defRpr.ascii=daM[1];
              if(dhM)defRpr.hAnsi=dhM[1];
              if(deM)defRpr.eastAsia=deM[1];
              if(dcM)defRpr.cs=dcM[1];
            }
            var dszM=drpr.match(/<w:sz[^>]*w:val="(\d+)"/);
            if(dszM)defRpr.size=parseInt(dszM[1])/2;
            var dszCsM=drpr.match(/<w:szCs[^>]*w:val="(\d+)"/);
            if(dszCsM&&!dszM)defRpr.size=parseInt(dszCsM[1])/2;
            if(drpr.match(/<w:b\s*\/?>/))defRpr.bold=true;
            if(drpr.match(/<w:i\s*\/?>/))defRpr.italic=true;
            var dclrM=drpr.match(/<w:color[^>]*w:val="([^"]*)"/);
            if(dclrM)defRpr.color='#'+dclrM[1];
          }
          // Also check pPr > rPr in paragraph styles
          if(!rprBlockM){
            var pprBlockM=block2.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
            if(pprBlockM){
              var ppr=pprBlockM[1];
              var rprInPprM=ppr.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
              if(rprInPprM){
                var drpr2=rprInPprM[1];
                var drfM2=drpr2.match(/<w:rFonts[^>]*\/?>/);
                if(drfM2){
                  var daM2=drfM2[0].match(/w:ascii="([^"]*)"/);
                  var dhM2=drfM2[0].match(/w:hAnsi="([^"]*)"/);
                  var deM2=drfM2[0].match(/w:eastAsia="([^"]*)"/);
                  if(daM2)defRpr.ascii=daM2[1];
                  if(dhM2)defRpr.hAnsi=dhM2[1];
                  if(deM2)defRpr.eastAsia=deM2[1];
                }
                var dszM2=drpr2.match(/<w:sz[^>]*w:val="(\d+)"/);
                if(dszM2)defRpr.size=parseInt(dszM2[1])/2;
                if(drpr2.match(/<w:b\s*\/?>/))defRpr.bold=true;
                if(drpr2.match(/<w:i\s*\/?>/))defRpr.italic=true;
              }
            }
          }
          if(Object.keys(defRpr).length>0)styleRprById[sid2]=defRpr;
        }
        console.log('[docx] Parsed '+Object.keys(styleNameById).length+' styles, '+Object.keys(styleRprById).length+' with default rPr');

        // ----- 步骤B: 动态构建 mammoth styleMap -----
        // 中文论文字体样式 → HTML heading level 映射
        var headingPatterns=[
          {regex:/^(标题\s*1|Heading\s*1|Title\s*1|1\s*级|h1|chapter|第.+章)$/i, tag:'h1'},
          {regex:/^(标题\s*2|Heading\s*2|Title\s*2|2\s*级|h2)$/i, tag:'h2'},
          {regex:/^(标题\s*3|Heading\s*3|Title\s*3|3\s*级|h3)$/i, tag:'h3'},
          {regex:/^(标题\s*4|Heading\s*4|4\s*级|h4)$/i, tag:'h4'},
          {regex:/^(标题\s*5|Heading\s*5|5\s*级|h5)$/i, tag:'h5'},
          {regex:/^(标题\s*6|Heading\s*6|6\s*级|h6)$/i, tag:'h6'},
        ];
        var styleMap=[];
        Object.keys(styleNameById).forEach(function(sid){
          var nm=styleNameById[sid];
          var tp=styleTypeById[sid]||'paragraph';
          if(tp!=='paragraph')return; // 只映射段落样式
          for(var pi=0;pi<headingPatterns.length;pi++){
            if(headingPatterns[pi].regex.test(nm)){
              styleMap.push('p[style-name=\''+nm+'\'] => '+headingPatterns[pi].tag+':fresh');
              break;
            }
          }
        });
        // 补充通用映射（覆盖 mammoth 默认可能遗漏的）
        styleMap.push('p[style-name=\'Heading 1\'] => h1:fresh');
        styleMap.push('p[style-name=\'Heading 2\'] => h2:fresh');
        styleMap.push('p[style-name=\'Heading 3\'] => h3:fresh');
        styleMap.push('p[style-name=\'Heading 4\'] => h4:fresh');
        styleMap.push('p[style-name=\'标题 1\'] => h1:fresh');
        styleMap.push('p[style-name=\'标题 2\'] => h2:fresh');
        styleMap.push('p[style-name=\'标题 3\'] => h3:fresh');
        styleMap.push('p[style-name=\'标题\'] => h1:fresh');
        styleMap.push('p[style-name=\'Title\'] => h1:fresh');
        styleMap.push('p[style-name=\'Subtitle\'] => h2:fresh');
        styleMap.push('p[style-name=\'副标题\'] => h2:fresh');
        if(styleMap.length>0){
          mammothOptions.styleMap=styleMap;
          console.log('[docx] Dynamic styleMap built: '+styleMap.length+' rules');
        }

        // ----- 步骤C: 从 document.xml 提取段落样式 + 字体信息 -----
        var paraBlocks=docXml.split('<w:p ');
        for(var pbi=1;pbi<paraBlocks.length;pbi++){
          var pBlock2='<w:p '+paraBlocks[pbi];
          // 段落样式
          var smM=pBlock2.match(/<w:pStyle[^>]*w:val="([^"]*)"/);
          var sname=smM?styleNameById[smM[1]]||smM[1]:'Normal';
          // 段落文本
          var paraText='';
          var tParts2=pBlock2.split('<w:t');
          for(var ti3=1;ti3<tParts2.length;ti3++){
            var tmM2=tParts2[ti3].match(/>([^<]*)</);
            if(tmM2)paraText+=tmM2[1];
          }
          paraText=paraText.replace(/\s+/g,' ').trim();
          if(!paraText||paraText.length<2)continue;
          if(/^\d{1,3}$/.test(paraText)||/^[ivxlcdm]+$/i.test(paraText))continue;
          if(/[\t\s]+\d{1,3}$/.test(paraText)||/\.{3,}\d{1,3}$/.test(paraText))continue;
          window._docxParaStyleList.push({text:paraText,styleName:sname});

          // ---- 提取 run-level 字体属性 (rPr) ----
          var fontRuns=[];
          var styleDefRpr=styleRprById[smM?smM[1]:'']||null;
          var runBlocks=pBlock2.split('<w:r ');
          // 第一个 split 片段不含 <w:r> 内容，跳过
          for(var rbi=1;rbi<runBlocks.length;rbi++){
            var rBlock='<w:r '+runBlocks[rbi];
            // 提取文本
            var rTxt='';
            var rtParts=rBlock.split('<w:t');
            for(var rti=1;rti<rtParts.length;rti++){
              var rtm=rtParts[rti].match(/>([^<]*)</);
              if(rtm)rTxt+=rtm[1];
            }
            if(!rTxt)continue;
            // 提取字体属性
            var rFonts={},hasVals=false;
            var rprM=rBlock.match(/<w:rPr[^>]*>([\s\S]*?)<\/w:rPr>/);
            if(rprM){
              var rpr=rprM[1];
              var rfM=rpr.match(/<w:rFonts[^>]*\/>/);
              if(rfM){
                var aM=rfM[0].match(/w:ascii="([^"]*)"/);
                var hM=rfM[0].match(/w:hAnsi="([^"]*)"/);
                var eM=rfM[0].match(/w:eastAsia="([^"]*)"/);
                var cM=rfM[0].match(/w:cs="([^"]*)"/);
                if(aM){rFonts.ascii=aM[1];hasVals=true;}
                if(hM){rFonts.hAnsi=hM[1];hasVals=true;}
                if(eM){rFonts.eastAsia=eM[1];hasVals=true;}
                if(cM){rFonts.cs=cM[1];hasVals=true;}
              }
              var szM=rpr.match(/<w:sz[^>]*w:val="(\d+)"/);
              if(szM){rFonts.size=parseInt(szM[1])/2;hasVals=true;}
              var szCsM=rpr.match(/<w:szCs[^>]*w:val="(\d+)"/);
              if(szCsM&&!szM){rFonts.size=parseInt(szCsM[1])/2;hasVals=true;}
              var bM=rpr.match(/<w:b\s*\/?>/);
              if(bM){rFonts.bold=true;hasVals=true;}
              var iM=rpr.match(/<w:i\s*\/?>/);
              if(iM){rFonts.italic=true;hasVals=true;}
              var colorM=rpr.match(/<w:color[^>]*w:val="([^"]*)"/);
              if(colorM){rFonts.color='#'+colorM[1];hasVals=true;}
            }
            // 回退到样式级 rPr: run 无 rPr 或 rPr 中无字体数据
            if(!hasVals && styleDefRpr){
              rFonts=Object.assign({}, styleDefRpr);
            }
            fontRuns.push({text:rTxt,props:rFonts});
          }
          // 如果整段没有任何 run 提取到字体，但样式定义了默认字体，至少记一条
          if(fontRuns.length===0 && styleDefRpr){
            fontRuns.push({text:paraText,props:Object.assign({},styleDefRpr)});
          }
          if(fontRuns.length>0){
            window._docxFontInfo.push({text:paraText,styleName:sname,runs:fontRuns});
          }
        }
        console.log('[docx] _docxParaStyleList: '+window._docxParaStyleList.length+' paragraphs');
        console.log('[docx] _docxFontInfo: '+window._docxFontInfo.length+' paragraphs with font data');
      }
    }catch(e){console.warn('[docx] XML pre-parse failed:',e.message);window._docxParaStyleList=[];window._docxFontInfo=[];}

    // ----- mammoth 渲染 (with dynamic styleMap) -----
    updLoad('渲染文档样式...','22');
    var result=await mammoth.convertToHtml({arrayBuffer:buf},mammothOptions);
    manuscriptHTML=result.value;
    if(result.messages&&result.messages.length){
      console.log('[mammoth] '+result.messages.length+' messages:',result.messages.slice(0,10));
    }
    } // end if docx
    manuscriptHTML=manuscriptHTML
      .replace(/<img /g,'<img loading="lazy" style="max-width:100%;height:auto;display:block;margin:10px auto;border-radius:4px" ')
      .replace(/<table>/g,'<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:.75rem">')
      .replace(/<th>/g,'<th style="border:1px solid rgba(0,0,0,0.12);padding:6px 10px;background:rgba(0,0,0,0.03);font-weight:600;text-align:center">')
      .replace(/<td>/g,'<td style="border:1px solid rgba(0,0,0,0.1);padding:6px 10px;vertical-align:top">')
      .replace(/<p>/g,'<p style="line-height:1.9">')
    manuscriptText=manuscriptHTML.replace(/<[^>]+>/g,'\n').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\n{3,}/g,'\n\n')
    var thesisBoxEl=document.getElementById('thesisBox');
    // 保存原始工作台内容，解析失败时可恢复
    var _savedWorkspace = null;
    var wsEl = document.getElementById('workspaceContent');
    if (wsEl) _savedWorkspace = wsEl.outerHTML;
    thesisBoxEl.innerHTML=manuscriptHTML;
    var tbs=thesisBoxEl.querySelectorAll('table');for(var ti=0;ti<tbs.length;ti++)tbs[ti].style.display='';
    // 构建 _docxStyleGroups：XML 样式名 + DOM 元素按文档序对齐（不靠文本匹配）
    window._docxStyleGroups=[];
    window._normText=function(s){return(s||'').replace(/[\s　  - ]+/g,' ').replace(/ +/g,' ').trim();};
    if(window._docxParaStyleList&&window._docxParaStyleList.length){
      var domA=thesisBoxEl.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li');
      var sg2={},xl=window._docxParaStyleList;
      // 策略A: 位置映射 + 宽松文本验证 (窗口=10%)
      var xlClean=[], domClean=[];
      for(var xi=0;xi<xl.length;xi++){var xt=window._normText(xl[xi].text);if(xt&&xt.length>=2&&!/^\d{1,3}$/.test(xt)&&!/^[ivxlcdm]+$/i.test(xt)&&!/[\t\s]+\d{1,3}$/.test(xt)&&!/\.{3,}\d{1,3}$/.test(xt))xlClean.push(xi);}
      for(var di=0;di<domA.length;di++){var dt=window._normText(domA[di].textContent||'');if(dt&&dt.length>=2&&!/^\d{1,3}$/.test(dt)&&!/^[ivxlcdm]+$/i.test(dt)&&!/[\t\s]+\d{1,3}$/.test(dt)&&!/\.{3,}\d{1,3}$/.test(dt))domClean.push(di);}
      var xmlMatched={};
      for(var dci=0;dci<domClean.length;dci++){
        var di2=domClean[dci],dE2=domA[di2],dt2=window._normText(dE2.textContent||''),xlApprox=Math.round(dci*xlClean.length/domClean.length),matchXi=-1;
        var radius=Math.max(15,Math.floor(domClean.length*0.03));
        for(var off=-radius;off<=radius;off++){var xp=xlApprox+off;if(xp<0||xp>=xlClean.length)continue;var xi2=xlClean[xp],xt2=window._normText(xl[xi2].text);
          if(xt2===dt2){matchXi=xi2;break;}if(dt2.length>=10&&xt2.length>=10&&dt2.substring(0,30)===xt2.substring(0,30)){matchXi=xi2;break;}
          if(dt2.length>=8&&xt2.length>=8){var minL=Math.min(dt2.length,xt2.length),mC=0;for(var mc=0;mc<minL;mc++){if(dt2[mc]===xt2[mc])mC++;}if(mC/minL>=0.85){matchXi=xi2;break;}}}
        if(matchXi>=0){var sn=xl[matchXi].styleName||'Normal';if(!sg2[sn])sg2[sn]={name:sn,count:0,samples:[],_texts:[],_els:[]};sg2[sn].count++;if(sg2[sn].samples.length<5)sg2[sn].samples.push(dt2.substring(0,80));sg2[sn]._texts.push(dt2);sg2[sn]._els.push(dE2);xmlMatched[matchXi]=true;}
      }
      // 策略B: 未被DOM匹配的XML段落也全部纳入（保留所有自定义样式）
      var unm=0;
      for(var xi3=0;xi3<xl.length;xi3++){if(xmlMatched[xi3])continue;var xt3=window._normText(xl[xi3].text);if(!xt3||xt3.length<2)continue;if(/^\d{1,3}$/.test(xt3)||/^[ivxlcdm]+$/i.test(xt3))continue;if(/[\t\s]+\d{1,3}$/.test(xt3)||/\.{3,}\d{1,3}$/.test(xt3))continue;var sn4=xl[xi3].styleName||'Normal';if(!sg2[sn4])sg2[sn4]={name:sn4,count:0,samples:[],_texts:[],_els:[]};sg2[sn4].count++;if(sg2[sn4].samples.length<5)sg2[sn4].samples.push(xt3.substring(0,80));sg2[sn4]._texts.push(xt3);unm++;}
      if(unm>0)console.log('[docx] +'+unm+' unmatched XML paragraphs retained');
      window._docxStyleGroups=Object.values(sg2).sort(function(a,b){return b.count-a.count;});
      console.log('[docx] '+window._docxStyleGroups.length+' style groups found. Full list:',window._docxStyleGroups.map(function(g){return g.name+'×'+g.count;}).join(', '));
      // ----- Attach font info to style groups -----
      var fontInfo=window._docxFontInfo||[];
      if(fontInfo.length){
        var fontByStyle={};
        fontInfo.forEach(function(fp){
          var sn=fp.styleName||'Normal';
          if(!fontByStyle[sn])fontByStyle[sn]=new Set();
          fp.runs.forEach(function(r){
            var rp=r.props;
            if(rp.eastAsia)fontByStyle[sn].add(rp.eastAsia);
            if(rp.cs)fontByStyle[sn].add(rp.cs);
            if(rp.ascii)fontByStyle[sn].add(rp.ascii);
            if(rp.hAnsi)fontByStyle[sn].add(rp.hAnsi);
          });
        });
        window._docxStyleGroups.forEach(function(g){
          var fonts=fontByStyle[g.name];
          if(fonts&&fonts.size){
            g.fonts=Array.from(fonts).slice(0,5);
            // Also attach example sizes
            var sizes=[];
            (fontInfo||[]).forEach(function(fp){
              if(fp.styleName===g.name&&fp.runs){
                fp.runs.forEach(function(r){if(r.props.size)sizes.push(r.props.size);});
              }
            });
            if(sizes.length){
              g.sizes=[Math.min.apply(null,sizes),Math.max.apply(null,sizes)];
              // Check for bold/italic commonality
              var boldCount=0, italicCount=0, totalRuns=0;
              (fontInfo||[]).forEach(function(fp){
                if(fp.styleName===g.name&&fp.runs){
                  fp.runs.forEach(function(r){
                    totalRuns++;
                    if(r.props.bold)boldCount++;
                    if(r.props.italic)italicCount++;
                  });
                }
              });
              if(boldCount>totalRuns*0.5)g.commonBold=true;
              if(italicCount>totalRuns*0.5)g.commonItalic=true;
            }
          }
        });
      }
    }
    // 兜底：如果没有任何匹配（极少情况），退化为简单文本模式
    if(!window._docxStyleGroups.length){
      console.warn('[docx] Zero style groups — fallback to text patterns');
      var fb={};var aEl=thesisBoxEl.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li');
      for(var i=0;i<aEl.length;i++){
        var e=aEl[i],t=(e.textContent||'').trim();
        if(!t||t.length<2||/^\d{1,3}$/.test(t)||/^[ivxlcdm]+$/i.test(t))continue;
        if(/[	\s]+\d{1,3}$/.test(t)||/\.{3,}\d{1,3}$/.test(t))continue;
        var g='Normal';
        if(/^第[一-九十百千123456789]+章/.test(t))g='第X章';
        else if(/^Chapter\s+\d/i.test(t))g='Chapter';
        else if(/^\d+(?:\.\d+)+[\s、,，]+/.test(t))g='数字编号';
        if(!fb[g])fb[g]={name:g,count:0,samples:[],_texts:[],_els:[]};
        fb[g].count++;if(fb[g].samples.length<4)fb[g].samples.push(t.substring(0,80));
        fb[g]._texts.push(t);fb[g]._els.push(e);
      }
      window._docxStyleGroups=Object.values(fb).sort(function(a,b){return b.count-a.count;});
    }
    updLoad('构建章节树...','35');

    // ====== 标题层级检测辅助函数 ======
    // 返回 -1(非标题) / 0(章) / 1(节) / 2(小节)
    // 严格策略：只有明确的标题模式才返回 >= 0
    function detectHeadingLevel(txt) {
      if (!txt || txt.length < 2) return -1;
      // TOC 条目过滤：结尾带页码（tab/空格 + 1-3位数字）
      if (/[\t\s]+\d{1,3}$/.test(txt)||/\.{3,}\d{1,3}$/.test(txt)||/[\s\.]{5,}\d{1,3}$/.test(txt)) return -1;
      // 纯页码（1-3位数字或罗马数字）
      if (/^\d{1,3}$/.test(txt)||/^[ivxlcdm]+$/i.test(txt)) return -1;
      // 章标题
      if (/^第[一二三四五六七八九十123456789]+章/.test(txt) || /^Chapter\s+\d/.test(txt)) return 0;
      // 数字编号 + 标题文字：1.1 标题 / 1.1.1标题 / 1．1 标题
      var nm = txt.match(/^(\d+(?:[.．]\d+){1,3})[\s、，,.．]*(.+)$/);
      if (nm && nm[2] && nm[2].trim().length >= 2 && nm[2].trim().length < 80) {
        var dots = (nm[1].match(/[.．]/g)||[]).length;
        return dots <= 2 ? dots : 2;
      }
      // 纯数字 + 标题：1 标题 / 1、标题 → 节
      var sm = txt.match(/^(\d+)[\s、，,.．]+(.+)$/);
      if (sm && sm[2] && sm[2].trim().length >= 2 && sm[2].trim().length < 80) {
        return 1;
      }
      // 中文序号：一、xxx → 节; (一)xxx → 小节
      var cnm = txt.match(/^([\(（]?[一二三四五六七八九十]+[\)）]?)[\s、，,.]+\s*(\S.{1,})/);
      if (cnm && cnm[2] && cnm[2].length >= 2 && cnm[2].length < 80) {
        return cnm[1].indexOf('(') >= 0 || cnm[1].indexOf('（') >= 0 ? 2 : 1;
      }
      return -1;
    }
    function detectChapterNum(txt) {
      var cm = txt.match(/^第([一二三四五六七八九十123456789]+)章/);
      if (cm) return cnDigit(cm[1]);
      var dm = txt.match(/^(\d+)[\s、，,.]/);
      if (dm) return parseInt(dm[1]);
      var cnm = txt.match(/^([一二三四五六七八九十]+)[\s、，,.]/);
      if (cnm) return cnDigit(cnm[1]);
      return 0;
    }
    function detectHeadingNum(txt) {
      var nm = txt.match(/^((?:\d+\.)*\d+)/);
      if (nm) return nm[1];
      var cnm = txt.match(/^([\(（]?[一二三四五六七八九十]+[\)）]?)/);
      if (cnm) return cnm[1];
      return txt.substring(0, 8);
    }

    // =================================================================
    // 新章节解析：围栏架构
    // 策略：① 用 HTML 标题标签优先 ② 文本模式回退 ③ TOC 自动跳过
    // 核心原则：同一层级的标题之间的内容归该标题所有
    // =================================================================
    var box = document.getElementById('thesisBox');
    sections = [];
    if (box) {
      var allEls = box.querySelectorAll('p,h1,h2,h3,h4,h5,h6');
      // ===== 第1步：找"参考文献"边界 =====
      var refBound = null;
      for (var ri = 0; ri < allEls.length; ri++) {
        var rt = (allEls[ri].textContent || '').replace(/\s+/g, '');
        if (rt.indexOf('参考文献') === 0 && rt.length < 20) { refBound = allEls[ri]; break; }
      }
      // ===== 第2步：找正文起始位置（跳过封面/摘要/TOC）=====
      var bodyStartIdx = -1;
      // 2a. 找"目录"所在元素
      var tocIdx = -1;
      for (var ti = 0; ti < allEls.length; ti++) {
        var tt = (allEls[ti].textContent || '').replace(/\s+/g, '');
        if (tt === '目录' || tt === '目 录' || tt === '目錄') { tocIdx = ti; break; }
      }
      if (tocIdx < 0) {
        // 无目录：找"摘要"之后的第一个章标题
        for (var ti2 = 0; ti2 < allEls.length; ti2++) {
          var ts2 = (allEls[ti2].textContent || '').trim();
          if (/^(摘要|Abstract)/.test(ts2)) { tocIdx = ti2; break; }
        }
      }
      // 2b. 从 tocIdx 往后扫，找到第一个真正的正文标题
      for (var bi = Math.max(0, tocIdx); bi < allEls.length; bi++) {
        var bt = (allEls[bi].textContent || '').trim();
        if (!bt || bt.length < 2 || bt.length > 60) continue;
        if (refBound && (allEls[bi].compareDocumentPosition(refBound) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
        // 用 detectHeadingLevel 判定
        var hdLv = detectHeadingLevel(bt);
        var isFirstCh = hdLv === 0 ||
                        (hdLv === 1 && /^1(?:\.\d+)*\s/.test(bt)) ||
                        (hdLv === 1 && /^一[\s、，,.]/.test(bt));
        if (!isFirstCh) continue;
        if (/\t\d{1,3}$/.test(bt) || /[\s\.]{2,}\d{1,3}$/.test(bt)) continue;
        bodyStartIdx = bi;
        break;
      }
      if (bodyStartIdx < 0) bodyStartIdx = Math.max(0, Math.floor(allEls.length * 0.08));
      // 诊断日志
      console.log('[detect] bodyStartIdx='+bodyStartIdx+' tocIdx='+tocIdx+' allEls.length='+allEls.length+' refBound='+!!refBound);
      // 统计标签分布
      var tagStats={};for(var ti=tocIdx;ti<Math.min(tocIdx+30,allEls.length);ti++){var tn=(allEls[ti].tagName||'').toUpperCase();tagStats[tn]=(tagStats[tn]||0)+1;}
      console.log('[detect] first 30 tags after tocIdx:',JSON.stringify(tagStats));
      // ===== 第3步：收集标题候选（HTML 标签 + 样式数据 + 文本模式）=====
      var allHeadings = [];
      for (var ei = bodyStartIdx; ei < allEls.length; ei++) {
        var el2 = allEls[ei], txt2 = (el2.textContent || '').trim();
        if (!txt2 || txt2.length < 2) continue;
        if (refBound && (el2.compareDocumentPosition(refBound) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
        if (/^\d{1,3}$/.test(txt2) || /^[ivxlcdmIVXLCDM]+$/.test(txt2)) continue;
        if (/\t\d{1,3}$/.test(txt2) || /[\s\.]{2,}\d{1,3}$/.test(txt2) || /[\s]+\d{1,3}$/.test(txt2)) continue;
        var tagName = (el2.tagName || '').toUpperCase();
        if (/^H[1-6]$/.test(tagName)) {
          var tl = parseInt(tagName.charAt(1));
          // H1→章(0) H2→节(1) H3+→小节(2)
          var lvFromTag = tl<=1 ? 0 : (tl===2 ? 1 : 2);
          allHeadings.push({ el: el2, txt: txt2, level: lvFromTag, tagLevel: tl, bare: false });
        }
      }
      // ---- 样式数据驱动检测：_docxStyleGroups._els 直接映射到 DOM ----
      // 策略：利用已解析的 Word 样式名 + 字体属性推断层级，不再纯靠文本正则
      var styleToLevel={};
      var headingStylePatterns=[
        // more specific first — avoid 标题_TJ matching 一级标题_TJ as substring
        {re:/(二级标题|2级标题|节标题|二[级級]标题|^heading\s*2$|^标题\s*2$)/i, lv:1},
        {re:/(三级标题|3级标题|小节标题|三[级級]标题|^heading\s*3$|^标题\s*3$)/i, lv:2},
        {re:/(四级标题|4级标题|^heading\s*4$|^标题\s*4$)/i, lv:2},
        {re:/(一级标题|1级标题|章标题|一[级級]标题|^heading\s*1$|^标题\s*1$|^标题_TJ$|^Title$)/i, lv:0},
        {re:/(^h1$|heading\s*1)/i, lv:0},
        {re:/(^h2$|heading\s*2)/i, lv:1},
        {re:/(^h3$|heading\s*3)/i, lv:2},
      ];
      (window._docxStyleGroups||[]).forEach(function(g){
        var nm=g.name||''; if(styleToLevel[nm]!==undefined)return;
        for(var pi4=0;pi4<headingStylePatterns.length;pi4++){
          if(headingStylePatterns[pi4].re.test(nm)){styleToLevel[nm]=headingStylePatterns[pi4].lv;return;}
        }
        // 字体启发式: 粗体 + 大字号(≥14pt) + 短文本(<60字) → 疑似标题
        if(g.commonBold&&g.sizes&&g.sizes.length&&g.sizes[g.sizes.length-1]>=14){
          var avgLen=0;(g.samples||[]).forEach(function(s){avgLen+=s.length;});avgLen/=Math.max(1,g.samples.length);
          if(avgLen<60)styleToLevel[nm]=1;
        }
      });
      var elToLevel=new Map();
      (window._docxStyleGroups||[]).forEach(function(g){
        var lv5=styleToLevel[g.name]; if(lv5===undefined)return;
        var els5=g._els||[]; for(var ei4=0;ei4<els5.length;ei4++)elToLevel.set(els5[ei4],lv5);
      });
      // 样式数据扫描：直接匹配 DOM 元素
      for(var ei5=bodyStartIdx;ei5<allEls.length;ei5++){
        var ef5=allEls[ei5],tf5=(ef5.textContent||'').trim();
        if(!tf5||tf5.length<2)continue;
        if(refBound&&(ef5.compareDocumentPosition(refBound)&Node.DOCUMENT_POSITION_FOLLOWING))break;
        var dupH=false;
        for(var dh=0;dh<allHeadings.length;dh++){if(allHeadings[dh].el===ef5){dupH=true;break;}}
        if(dupH)continue;
        var slv5=elToLevel.get(ef5);
        if(slv5!==undefined){
          allHeadings.push({el:ef5,txt:tf5,level:slv5,tagLevel:-1,bare:false});
        }
      }
      // 文本模式兜底（对样式未覆盖的元素）
      for (var ei2 = bodyStartIdx; ei2 < allEls.length; ei2++) {
        var ef = allEls[ei2], tf = (ef.textContent || '').trim();
        if (!tf || tf.length < 2) continue;
        if (refBound && (ef.compareDocumentPosition(refBound) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
        var dup2 = false;
        for (var di = 0; di < allHeadings.length; di++) { if (allHeadings[di].el === ef) { dup2 = true; break; } }
        if (dup2) continue;
        var tfLv = detectHeadingLevel(tf);
        if (tfLv >= 0) {
          allHeadings.push({ el: ef, txt: tf, level: tfLv, tagLevel: -1, bare: false });
        }
      }
      // 终极兜底
      if (allHeadings.length < 5) {
        for (var ei3 = bodyStartIdx; ei3 < allEls.length; ei3++) {
          var ef2 = allEls[ei3], tf2 = (ef2.textContent || '').trim();
          if (!tf2 || tf2.length < 2 || tf2.length > 200) continue;
          if (refBound && (ef2.compareDocumentPosition(refBound) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
          if (/^\d{1,3}$/.test(tf2)) continue;
          var dup3 = false;
          for (var dj = 0; dj < allHeadings.length; dj++) { if (allHeadings[dj].el === ef2) { dup3 = true; break; } }
          if (dup3) continue;
          allHeadings.push({ el: ef2, txt: tf2, level: -1, tagLevel: -1, bare: false });
        }
      }
      console.log('[detect] allHeadings count='+allHeadings.length);
      if(allHeadings.length>0){
        var lvs={'-1':0,'0':0,'1':0,'2':0};
        allHeadings.forEach(function(h){lvs[h.level]=(lvs[h.level]||0)+1;});
        console.log('[detect] level breakdown:',JSON.stringify(lvs));
        console.log('[detect] first 5 headings:',allHeadings.slice(0,5).map(function(h){return'<'+((h.el.tagName||'').toUpperCase())+'> lv='+h.level+' '+h.txt.substring(0,60);}));
      }

      // ===== 第3.5步：统一解析 level（tagLevel / 文本 / 样式）=====
      for(var ni=0;ni<allHeadings.length;ni++){
        var hh=allHeadings[ni];
        if(hh.level>=0) continue;
        if(hh.tagLevel>0){
          hh.level = hh.tagLevel<=1 ? 0 : (hh.tagLevel===2 ? 1 : 2);
          continue;
        }
        var tl2=detectHeadingLevel(hh.txt||'');
        if(tl2>=0) hh.level=tl2;
      }
      // 过滤目录样式文本（带页码的 TOC 行）
      allHeadings=allHeadings.filter(function(h){
        var x=(h.txt||'');
        if(/[\t\s]+\d{1,3}$/.test(x)||/\.{3,}\d{1,3}$/.test(x)) return false;
        if(x.length>120 && h.level<0) return false;
        return true;
      });
      // 若仍无 level>=0 的标题，用纯文本再扫一遍
      var hasResolved=allHeadings.some(function(h){return h.level>=0;});
      if(!hasResolved){
        console.warn('[detect] no resolved heading levels — full text rescan');
        allHeadings=[];
        for(var ri3=bodyStartIdx;ri3<allEls.length;ri3++){
          var e3=allEls[ri3], t3=(e3.textContent||'').trim();
          if(!t3||t3.length<2||t3.length>100) continue;
          if(refBound&&(e3.compareDocumentPosition(refBound)&Node.DOCUMENT_POSITION_FOLLOWING)) break;
          if(/[\t\s]+\d{1,3}$/.test(t3)||/\.{3,}\d{1,3}$/.test(t3)) continue;
          var lv3=detectHeadingLevel(t3);
          if(lv3>=0) allHeadings.push({el:e3,txt:t3,level:lv3,tagLevel:-1,bare:false});
        }
      }

      // ===== 第4步：合并 split 标签标题（h1 "第2章" + 后面的 p 标题文字） =====
      for (var hi = 0; hi < allHeadings.length; hi++) {
        var hc = allHeadings[hi];
        var hdTxt = hc.txt;
        if (!hc.el) continue;
        var isBare = /^(第[一二三四五六七八九十123456789]+章|\d+(?:\.\d+)*)\s*$/.test(hdTxt);
        if (isBare || (hc.tagLevel >= 0 && hdTxt.length < 10)) {
          var sib = hc.el.nextElementSibling;
          for (var si = 0; si < 3 && sib; si++) {
            var st = (sib.textContent || '').trim();
            if (!st || /^\d{1,3}$/.test(st) || /^[ivxlcdmIVXLCDM]+$/.test(st) || /\.{3,}\s*\d/.test(st)) {
              sib = sib.nextElementSibling; continue;
            }
            // 如果下一个元素的文本已经包含当前编号前缀，不再拼
            if (st.indexOf(hdTxt) >= 0 && st.length <= hdTxt.length + 60) {
              hc.txt = st; hc.el = sib; hc.bare = false;
              break;
            }
            if (st.length > 1 && st.length < 80 &&
                !/^(?:第[一二三四五六七八九十123456789]+章|摘要|Abstract|关键词|目录|参考文献|致谢|附录)/.test(st)) {
              hc.txt = hdTxt + ' ' + st;
              hc.el = sib;
              hc.bare = false;
              break;
            }
            sib = sib.nextElementSibling;
          }
          if (hc.txt === hdTxt) hc.bare = true;
        }
      }
      // ===== 第4.5步: 标题校准 =====
      updLoad('标题校准...', '37');
      var preCal = allHeadings.slice();
      var calibrated = await startInlineCalibration(box, allHeadings);
      if (calibrated !== null && calibrated.length) {
        allHeadings = calibrated;
      } else {
        // 用户跳过校准：保留自动识别结果
        allHeadings = preCal.filter(function(h){return h.level>=0 || (h.tagLevel>0);});
        allHeadings.forEach(function(h){
          if(h.level<0 && h.tagLevel>0) h.level=h.tagLevel<=1?0:(h.tagLevel===2?1:2);
        });
        console.log('[cal] skipped/empty — fallback auto headings:', allHeadings.length);
      }
      // 兜底：如果校准后仍然没有标题数据，扫描全文所有短元素作为候选
      if (!allHeadings.length){
        console.warn('[cal] No headings after calibration — scanning all body elements');
        for(var si2=bodyStartIdx;si2<allEls.length;si2++){
          var es2=allEls[si2],ts2=(es2.textContent||'').trim();
          if(!ts2||ts2.length<2||ts2.length>200)continue;
          if(refBound&&(es2.compareDocumentPosition(refBound)&Node.DOCUMENT_POSITION_FOLLOWING))break;
          if(/^\d{1,3}$/.test(ts2)||/^[ivxlcdm]+$/i.test(ts2))continue;
          if(/[\t\s]+\d{1,3}$/.test(ts2)||/\.{3,}\d{1,3}$/.test(ts2))continue;
          var lv=detectHeadingLevel(ts2);
          allHeadings.push({el:es2,txt:ts2,level:lv,tagLevel:-1,bare:false});
        }
      }
      // ===== 第5步：构建完整 5 层树 + 全局索引 =====
      sections = buildFullTree(box, allHeadings, bodyStartIdx, refBound);
      }
    // ===== 第6步：调试日志 =====
    console.log('[chapters] Parsed', sections.length, 'chapters:');
    sections.forEach(function (cs) {
      console.log('  ch-' + cs.ch, cs.name, 'sections:', (cs.sections || []).length, 'text:', Math.round((cs.text || '').length / 100) / 10 + 'k');
      (cs.sections || []).forEach(function (sec) {
        console.log('    sec-' + sec.num, sec.title, 'subs:', (sec.subs || []).length, 'text:', Math.round((sec.text || '').length / 100) / 10 + 'k');
        (sec.subs || []).forEach(function (sub) {
          console.log('      sub-' + sub.num, sub.title, 'text:', Math.round((sub.text || '').length / 100) / 10 + 'k');
        });
      });
    });
    // ===== 第7步：正则回退（极少数情况） =====
    if (!sections.length) {
      var chMap2 = {}, re2 = /第([一-鿿\d]+)章/g, m2;
      while ((m2 = re2.exec(manuscriptText)) !== null) {
        var d2 = cnDigit(m2[1]);
        if (chMap2[d2]) continue;
        var af2 = manuscriptText.substring(m2.index + m2[0].length);
        if (!af2.startsWith('\n') && !af2.match(/^\s*[^\n]/)) continue;
        if (/PAGEREF|HYPERLINK|_Toc/.test(af2.substring(0, 250))) continue;
        chMap2[d2] = { dig: d2, pos: m2.index };
      }
      var chs2 = Object.values(chMap2).sort(function (a, b) { return a.pos - b.pos; });
      sections = chs2.map(function (hi, ii) {
        var af3 = manuscriptText.substring(hi.pos + 2), nl2 = af3.indexOf('\n');
        var t = (nl2 > 0 ? af3.substring(0, nl2) : af3.substring(0, 50)).trim().replace(/\s*\d+\.\d+.*$/, '').trim();
        return { ch: hi.dig, name: '第' + hi.dig + '章 ' + t, text: manuscriptText, sections: [] };
      });
      console.log('[chapters] using text fallback, found', sections.length);
    }
    // ===== 第8步：给章节打 DOM 锚点 =====
    sections.forEach(function (cs) {
      var el3 = cs.el;
      if (!el3) {
        var allElsFb = box.querySelectorAll('p,h1,h2,h3,h4,h5,h6');
        for (var eiFb = 0; eiFb < allElsFb.length; eiFb++) {
          if ((allElsFb[eiFb].textContent || '').replace(/\s+/g, '') === cs.name.replace(/\s+/g, '')) {
            el3 = allElsFb[eiFb]; break;
          }
        }
      }
      if (el3) {
        el3.id = 'ch-' + cs.ch;
        el3._slevel = 'ch';
        el3.classList.add('ch-head'); el3.style.color = '#e2e8f0';
        var ar = document.createElement('span');
        ar.className = 'toggle-arrow open';
        ar.innerHTML = '&#9654;';
        el3.insertBefore(ar, el3.firstChild);
      }
      // 递归锚点设置（支持任意深度）
      function setSecAnchors(parentNode, level) {
        var kids = parentNode.sections || parentNode.subs || [];
        for (var si2 = 0; si2 < kids.length; si2++) {
          var node = kids[si2];
          var idPrefix = level === 0 ? 'ch-' : (level <= 2 ? (level === 1 ? 'sec-' : 'sub-') : ('sub-'));
          if (level === 0) {
            idPrefix = 'ch-';
          } else if (level === 1) {
            idPrefix = 'sec-';
          } else {
            idPrefix = 'sub-'; // 2+ 级都归为 sub
          }
          if (node.el) {
            node.el.id = idPrefix + (node.num || '').replace(/\./g, '-');
            node.el.style.cssText = 'cursor:pointer';
          } else {
            var allElsS = box.querySelectorAll('p,h1,h2,h3,h4,h5,h6');
            for (var ei2s = 0; ei2s < allElsS.length; ei2s++) {
              if ((allElsS[ei2s].textContent || '').replace(/\s+/g, '') === ((node.num || '') + ' ' + (node.title || '')).replace(/\s+/g, '')) {
                node.el = allElsS[ei2s];
                allElsS[ei2s].id = idPrefix + (node.num || '').replace(/\./g, '-');
                allElsS[ei2s].style.cssText = 'cursor:pointer';
                break;
              }
            }
          }
          var grandkids = node.sections || node.subs || [];
          if (grandkids.length) setSecAnchors(node, level + 1);
        }
      }
      if (cs.sections) setSecAnchors(cs, 1);
    });

    updLoad('提取参考文献...','60');
    var rawRefs=[];try{rawRefs=await extractRefsFromRawDocx(buf)}catch(er3){console.warn(er3)}
    var box=document.getElementById('thesisBox');
    // 给已有文献找位置(结构化之前的原始DOM)
    function locateRefInRawDOM(paraEl,refNum){
      var box=document.getElementById('thesisBox');
      if(!paraEl||!box)return{ch:'',sec:'',sub:'',ctx:''};
      var chNum=chapterForElement(paraEl);
      var sec='',sub='';
      // 往前扫所有兄弟找sec/sub锚点
      var sib=paraEl.previousSibling;
      while(sib){
        if(sib.nodeType===1){
          var eid=sib.id||'',et=sib.textContent||'';
          if(!sec&&eid.indexOf('sec-')===0)sec=eid.replace('sec-','').replace(/-/g,'.');
          if(!sub&&eid.indexOf('sub-')===0)sub=eid.replace('sub-','').replace(/-/g,'.');
          if(!sec){var sm=et.match(/^(\d+)\.(\d+)\s/);if(sm&&!et.match(/^\d+\.\d+\.\d+/))sec=sm[1]+'.'+sm[2];}
          if(!sub){var ssm=et.match(/^(\d+)\.(\d+)\.(\d+)\s/);if(ssm)sub=ssm[1]+'.'+ssm[2]+'.'+ssm[3];}
        }
        if(sec&&sub)break;
        sib=sib.previousSibling;
      }
      if(!paraEl||!box)return{ch:'',sec:'',sub:'',ctx:''};
      var raw=(paraEl.innerText||paraEl.textContent||'');
      var ctx=extractCtxBeforeMarker(raw,refNum);
      var chN={};sections.forEach(function(cs){chN[cs.ch]=cs.name});for(var i=1;i<=10;i++)if(!chN[i])chN[i]='第'+i+'章';
      var ch=chN[chNum]||('第'+chNum+'章'),secTitle='',subTitle='';
      var chObj=sections.find(function(s){return s.ch===chNum});
      if(chObj&&chObj.sections){
        var so=chObj.sections.find(function(s){return s.num===sec});if(so)secTitle=so.title;
        if(sub){chObj.sections.forEach(function(s){if(s.subs){var sso=s.subs.find(function(ss){return ss.num===sub});if(sso)subTitle=sso.title;}});}
      }
      return{ch:ch,sec:sec?(sec+(secTitle?' '+secTitle:'')):'',sub:sub?(sub+(subTitle?' '+subTitle:'')):'',ctx:ctx};
    }

    if(box&&rawRefs.length){
      // 找到参考文献边界
      var refBoundary=null,tw=document.createTreeWalker(box,NodeFilter.SHOW_ELEMENT,null,false),el2=tw.firstChild();
      while(el2){var t2=(el2.textContent||'').replace(/\s+/g,'');if(t2.indexOf('参考文献')===0&&/^(p|li|h[1-6]|div)$/i.test(el2.tagName||'')){refBoundary=el2;break}el2=tw.nextNode()}
      // 一次DOM遍历定位所有引用（N个引用→1次遍历，不再N次）
      var refMap={};rawRefs.forEach(function(r){refMap[r.num]=r;});
      var twAll=document.createTreeWalker(box,NodeFilter.SHOW_ELEMENT,null,false),elAll=twAll.firstChild();
      while(elAll){
        var tagE=(elAll.tagName||'').toLowerCase();
        if(/^(p|li|h[1-6]|div|td)$/.test(tagE)){
          if(!refBoundary||!(elAll.compareDocumentPosition(refBoundary)&Node.DOCUMENT_POSITION_FOLLOWING)){
            var elTxt=elAll.textContent||'';
            // 找这个元素中所有的 [N] 标记
            var rm=/\[(\d+)\]/g,rmM;
            while((rmM=rm.exec(elTxt))!==null){
              var rn=parseInt(rmM[1]);
              // 跳过被误匹配的更大数字（如[2]匹配到[20]里的2）
              if(rmM[0].length>2){var after=elTxt[rmM.index+rmM[0].length]||'';if(/\d/.test(after))continue;}
              var mr=refMap[rn];
              if(mr&&!mr._domEl){
                mr._domEl=elAll;mr.ch=chapterForElement(elAll);
                mr._ctx=extractCtxBeforeMarker(elTxt,rn);
                var sp0=locateRefInRawDOM(elAll,rn);
                mr._chName=sp0.ch;mr._secName=sp0.sec;mr._subName=sp0.sub;
              }
            }
          }
        }
        elAll=twAll.nextNode();
      }
    }
    existingRefs=rawRefs;
    existingRefs.forEach(function(r){
      // 标记原始文献，之后永不改动位置和句子内容
      r._isOriginal=true;
      // 尽可能提取title
      if(r.ci&&!r.title){var mp=parseRefMeta(r.ci);r.title=mp.title;r.journal=mp.journal;r.year=mp.yr||r.year;r.doi=r.doi||mp.doi;r.reftype=r.reftype||mp.reftype}
      if(!r.title&&r.ci){var c=r.ci.replace(/\s+/g,' ').trim().replace(/^\[\d+\]\s*/,'');var fi=c.search(/[。\.]/);r.title=fi>0?c.substring(0,fi):c.substring(0,80)}
      if(!r.ch)r.ch=1;r.displayNum=r.num;r.subType='unchanged';r.eType='existing';
      scoreReference(r,{source:'existing',hasSentence:true});
    });
    updateDashboard(existingRefs);

    await sleep(0);
    wrapExistingMarkers(rawRefs.filter(function(r){return r.num}));
    setTimeout(function(){highlightRefSentences();},100);
    // (已移除死代码：_isOriginal对所有已有文献为true，此循环永不会执行)
    paperTopics=extractTopics(manuscriptText);renderNavTree(sections);
    document.getElementById('kwBar').style.display='block';document.getElementById('kwTags').innerHTML=paperTopics.map(function(t){return'<span class="kw-tag">'+t.label+' ('+t.count+')</span>'}).join('');
    renderExistingOnly();
    hideLoad();document.getElementById('upStatus').innerHTML='已加载 ('+Math.round(manuscriptText.length/1000)+'k字)';
    // 自动设置推荐总文献数（每千字1条）
    var autoTotal=Math.max(5,Math.round(manuscriptText.length/1000));
    var fTotalEl=document.getElementById('fTotal');
    if(fTotalEl&&(!fTotalEl.value||fTotalEl.value==='0'))fTotalEl.value=autoTotal;
    document.getElementById('statusBar').innerHTML='✅ '+sections.length+'章 | 已有'+existingRefs.length+'条文献';
    // 通知模块系统：论文已加载
    if(typeof onThesisLoaded==='function')onThesisLoaded();
    // 会话持久化：备份基础数据防刷新丢失
    try{sessionStorage.setItem('thesis_backup_text',manuscriptText.substring(0,500000));sessionStorage.setItem('thesis_backup_html',manuscriptHTML.substring(0,800000));}catch(e2){}
    }catch(err){
      console.error('Parse error:',err);
      hideLoad();
      // 恢复原始工作台界面（滚轮依赖 workspace-content div）
      if (_savedWorkspace) {
        var tb = document.getElementById('thesisBox');
        if (tb) tb.innerHTML = _savedWorkspace;
      }
      // 重置论文状态 — 不要把半成品标记为已加载
      _thesisLoaded = false;
      existingRefs = []; mergedRefs = []; manuscriptText = ''; manuscriptHTML = ''; paperTopics = []; sections = [];
      document.getElementById('navTree').innerHTML = '<i style="color:rgba(255,255,255,.25);font-size:.65rem;padding:8px;display:block">请先上传论文</i>';
      var nm=document.getElementById('navTreeMeta');if(nm)nm.style.display='none';
      document.getElementById('refs').innerHTML = '<div style="text-align:center;padding:60px;color:#9ca3af;font-size:.82rem">← 请先上传论文</div>';
      document.getElementById('kwBar').style.display = 'none';
      document.getElementById('upStatus').innerHTML = '等待上传';
      if (typeof updateDashboard === 'function') updateDashboard([]);
      if (typeof updateNavStates === 'function') updateNavStates();
      alert('解析失败: '+err.message+'\n\n建议用Word另存为新的.docx后重试');
    }

    // 结构化面板放在try外面，出错不影响正文展示
    try{structureThesisBox();}catch(e){console.warn('[struct] 跳过结构化:',e.message);}
  });

  // 如果用户在上传遮罩打开后、库加载完成前选择了文件，自动触发解析
  if(window._pendingFile){
    var dt=new DataTransfer();dt.items.add(window._pendingFile);
    fi.files=dt.files;fi.dispatchEvent(new Event('change'));window._pendingFile=null;
  }

})();

// ========== 四维度评估 ==========
// 评估指标: ①真实度conf ②主题相关度_topicRel ③章节适配度_secFit ④句子重合度_dupRate
function scoreReference(r, opts){
  var isNew=opts&&opts.source==='new';
  var rtKws=extractTitleKws(r.title||r.ci||'');
  if(rtKws.length===0)return;

  // ① 真实度: DOI/期刊/年份基线分，校验API获取精确分
  if(isNew||!r.conf){
    var base=0;if(r.doi)base+=35;if(r.journal)base+=25;if(r.year)base+=15;
    r.conf=r.conf||Math.min(70,base);
  }

  // ② 主题相关度：文献标题关键词 ∩ 论文全文高频词 / 文献标题关键词数
  // 重新提取文献标题关键词（不是paperTopics的bigram，是字的实际词语）
  var refTitleKws=extractTitleKws(r.title||r.ci||'');
  // 跟论文全文的句子摘要词做交叉匹配（更精准）
  var sentenceKws2=(typeof sentenceKwList!=='undefined'&&sentenceKwList.length)?sentenceKwList:(paperTopics||[]).map(function(t){return t.label||''}).filter(function(w){return w.length>=2;});
  if(refTitleKws.length>0&&sentenceKws2.length>0){
    var h1=0;for(var ti=0;ti<refTitleKws.length;ti++){if(sentenceKws2.indexOf(refTitleKws[ti])>=0)h1++;}
    r._topicRel=Math.min(100,Math.round(h1/Math.max(1,Math.min(refTitleKws.length,10))*100));
  }else{r._topicRel=0;}

  // ③ 章节适配度：文献标题关键词 ∩ 该章节的句子摘要词 / 文献标题关键词数
  if(r.ch&&refTitleKws.length>0){
    var chObj=sections.find(function(s){return s.ch===r.ch});
    var chText2=((chObj&&chObj.text)||manuscriptText||'').toLowerCase();
    var chKws=extractTitleKws(chText2); // 从章文本中提取关键词
    var h2=0;for(var ci=0;ci<refTitleKws.length;ci++){if(chKws.indexOf(refTitleKws[ci])>=0)h2++;}
    r._secFit=Math.min(100,Math.round(h2/Math.max(1,Math.min(refTitleKws.length,10))*100));
  }else{r._secFit=0;}

  // ④ 句子重合度：文献标题关键词 ∩ 句子的关键词 / 文献标题关键词数
  if(opts&&opts.hasSentence){
    var ctxText=(r._ctx||'').toLowerCase();
    if(!ctxText&&r._domEl){
      try{
        var rawTxt=(r._domEl.parentElement?(r._domEl.parentElement.innerText||r._domEl.parentElement.textContent):(r._domEl.textContent||''))||'';
        ctxText=(extractCtxBeforeMarker(rawTxt,r.displayNum||r.num)||'').toLowerCase();
      }catch(e){ctxText=(r._ctx||'').toLowerCase();}
      r._ctx=ctxText;
    }
    if(ctxText&&refTitleKws.length>0){
      var ctxKws=extractTitleKws(ctxText);
      var h3=0;for(var ctxI=0;ctxI<refTitleKws.length;ctxI++){if(ctxKws.indexOf(refTitleKws[ctxI])>=0)h3++;}
      r._dupRate=Math.min(100,Math.round(h3/Math.max(1,Math.min(refTitleKws.length,10))*100));
    }else{r._dupRate=0;}
  }else if(isNew){r._dupRate=0;}
}

// 清空所有数据
// 结构化展示原文：把章节内容封装为可折叠面板

// 结构化展示原文——只加箭头+边框，不移动任何DOM节点
function structureThesisBox(){
  var box=document.getElementById('thesisBox');if(!box||!sections.length)return;

  // 收集所有锚点
  var all=[];
  function scan(n){
    while(n){
      if(n.nodeType===1){
        var id=n.id||'';
        if(id.indexOf('ch-')===0)all.push(n);
        else if(id.indexOf('sec-')===0)all.push(n);
        else if(id.indexOf('sub-')===0)all.push(n);
        scan(n.firstChild);
      }
      n=n.nextSibling;
    }
  }
  scan(box);
  if(!all.length)return;
  // 按DOM顺序排
  all.sort(function(a,b){return(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)?-1:1;});

  for(var i=0;i<all.length;i++){
    var el=all[i],id=el.id||'',lv='ch';
    if(id.indexOf('sec-')===0)lv='sec';
    else if(id.indexOf('sub-')===0)lv='sub';
    el._slevel=lv;

    // 加箭头icon（如果已有则跳过，避免重复）
    if(!el.querySelector('.toggle-arrow')){
      var ar=document.createElement('span');
      ar.className='toggle-arrow open';ar.innerHTML='&#9654;';
      ar.style.cssText='display:inline-flex;align-items:center;margin-right:4px;font-size:.7rem;cursor:pointer;vertical-align:middle';
      el.insertBefore(ar,el.firstChild);
    }
    el.classList.add(lv+'-head');
    el.classList.add(lv+'-panel'); // 用标题本身当panel标记

    // 点击折叠：找到el后面同一父级的所有兄弟，直到下一个同级或上级标题
    ar.addEventListener('click',function(ev){ev.stopPropagation();
      var hd=this.parentElement,lv2=hd._slevel||'ch';
      // 收集要折叠的兄弟
      var sib=hd.nextSibling,toCollapse=[],spanId='fold_'+Math.random().toString(36).slice(2);
      while(sib){
        var stop2=false;
        if(sib.nodeType===1&&sib._slevel){
          var sl=sib._slevel;
          if(lv2==='ch')stop2=true;
          else if(lv2==='sec'&&(sl==='sec'||sl==='ch'))stop2=true;
          else if(lv2==='sub'&&(sl==='sub'||sl==='sec'||sl==='ch'))stop2=true;
        }
        if(stop2)break;
        toCollapse.push(sib);sib=sib.nextSibling;
      }
      // 检查是否已折叠
      var collapsed=toCollapse.length>0&&toCollapse[0].style.display==='none';
      if(collapsed){
        toCollapse.forEach(function(n){n.style.display='';});
        this.classList.add('open');
      }else{
        toCollapse.forEach(function(n){n.style.display='none';});
        this.classList.remove('open');
      }
    });
  }

}
function clearAll(){
  if(!confirm('确定要清空所有数据吗？这将重置文献检索结果。'))return;
  existingRefs=[];mergedRefs=[];manuscriptText='';manuscriptHTML='';paperTopics=[];sections=[];_treeIndex={chapters:[],sections:[],subs:[],paragraphs:[],sentences:[]};
  document.getElementById('thesisBox').innerHTML='';
  document.getElementById('navTree').innerHTML='<i style="color:rgba(255,255,255,.25);font-size:.65rem;padding:8px;display:block">请先上传论文</i>';
  var nm=document.getElementById('navTreeMeta');if(nm)nm.style.display='none';
  document.getElementById('refs').innerHTML='<div style="text-align:center;padding:60px;color:#9ca3af;font-size:.82rem">← 请先上传论文</div>';
  document.getElementById('kwBar').style.display='none';
  document.getElementById('statusBar').innerHTML='等待上传论文…';document.getElementById('upStatus').innerHTML='等待上传';
  updateDashboard([]);ttp('已清空');
}

// 引用句高亮：给包含参考文献标记的句子加浅底色

// 引用句高亮：给包含参考文献标记的句子加淡蓝底色
function highlightRefSentences(){
  try {
  var markers = document.querySelectorAll('#thesisBox .cite-marker');
  if (!markers.length) return;
  var processedParas = {};
  for (var mi = 0; mi < markers.length; mi++) {
    var marker = markers[mi];
    var para = marker.parentElement;
    if (!para) continue;
    if (!para._refSentId) para._refSentId = 'rs_' + Math.random().toString(36).slice(2, 8);
    if (processedParas[para._refSentId]) continue;

    // Build a flat list of all child nodes (text + elements)
    var kids = [];
    for (var c = para.firstChild; c; c = c.nextSibling) kids.push(c);

    // Build text mapping: kidIdx -> character range in paragraph textContent
    var fullText = '';
    var kidMap = []; // [{node, start, end}]
    for (var i = 0; i < kids.length; i++) {
      var kt = kids[i].textContent || '';
      kidMap.push({ node: kids[i], start: fullText.length, end: fullText.length + kt.length });
      fullText += kt;
    }

    // Find marker index and its character position
    var mIdx = kids.indexOf(marker);
    if (mIdx < 0) continue;
    var mPos = kidMap[mIdx].start;

    // Sentence start
    var sStart = 0;
    for (var si = mPos - 1; si >= 0; si--) {
      var ch = fullText.charAt(si);
      if (ch === '。' || ch === '！' || ch === '？' || ch === '.' || ch === '?' || ch === '!') { sStart = si + 1; break; }
    }
    while (sStart < mPos && /\s/.test(fullText.charAt(sStart))) sStart++;

    // Sentence end
    var sEnd = fullText.length;
    for (var ei = mPos + 1; ei < fullText.length; ei++) {
      var ch2 = fullText.charAt(ei);
      if ((ch2 === '。' || ch2 === '！' || ch2 === '？' || ch2 === '.' || ch2 === '?' || ch2 === '!') && ei > mPos + 3) { sEnd = ei + 1; break; }
    }
    if (sEnd - sStart < 8) continue;

    // Find which kids intersect [sStart, sEnd)
    var firstKid = -1, lastKid = -1;
    for (var ki = 0; ki < kidMap.length; ki++) {
      if (firstKid < 0 && kidMap[ki].end > sStart) firstKid = ki;
      if (kidMap[ki].start < sEnd) lastKid = ki;
    }
    if (firstKid < 0 || lastKid < 0) continue;

    // Create wrapper span
    var wrapper = document.createElement('span');
    wrapper.className = 'ref-sentence';
    wrapper.title = '此句含参考文献引用';

    // Reference point: insert wrapper before firstKid's node
    var refNode = kids[firstKid];
    refNode.parentElement.insertBefore(wrapper, refNode);

    // Move nodes into wrapper (process in reverse to avoid index shifts from splitText)
    for (var mi2 = lastKid; mi2 >= firstKid; mi2--) {
      var kn = kidMap[mi2];
      if (kn.node.nodeType === 3) {
        var cs = Math.max(0, sStart - kn.start);
        var ce = Math.min(kn.node.textContent.length, sEnd - kn.start);
        if (cs <= 0 && ce >= kn.node.textContent.length) {
          // Whole text node is in range
          wrapper.insertBefore(kn.node, wrapper.firstChild);
        } else {
          // Need partial split
          if (ce < kn.node.textContent.length) kn.node.splitText(ce);
          if (cs > 0) {
            kn.node.splitText(cs);
            wrapper.insertBefore(kn.node.nextSibling, wrapper.firstChild);
          } else {
            wrapper.insertBefore(kn.node, wrapper.firstChild);
          }
        }
      } else {
        // Element node: move entire element into wrapper
        wrapper.insertBefore(kn.node, wrapper.firstChild);
      }
    }

    processedParas[para._refSentId] = true;
  }
  } catch(e) { console.warn("highlightRefSentences:", e.message); }
}


// 点击目录/标题跳转到对应区域 + 高亮目录项
function navClickToSec(id){
  var el3=document.getElementById(id);
  if(el3){el3.scrollIntoView({behavior:'smooth',block:'start'});el3.style.transition='background .3s';el3.style.background='rgba(175,82,222,0.15)';setTimeout(function(){el3.style.background=''},2200);}
  var tns=document.querySelectorAll('.tree-node');
  for(var ti=0;ti<tns.length;ti++){tns[ti].classList.remove('sel');if(tns[ti].getAttribute('data-id')===id){tns[ti].classList.add('sel');tns[ti].scrollIntoView({block:'nearest'});}}
}
function clearRefSentenceHighlights(){
  var spans = document.querySelectorAll('#thesisBox .ref-sentence');
  for (var i = 0; i < spans.length; i++) {
    var s = spans[i], p = s.parentElement;
    while (s.firstChild) p.insertBefore(s.firstChild, s);
    p.removeChild(s);
  }
}

// 知识图谱
var kgApiUrl='http://localhost:5000/kg_api/generate',kgCurrentData=null,kgCurrentView='network';
function showKnowledgeGraph(){if(!manuscriptText){alert('请先上传论文');return}kgCurrentData=null;document.getElementById('kgOverlay').style.display='flex';kgCurrentView='network';generateKnowledgeGraph();}

function exportKGAsPNG(){
  var svg=document.getElementById('kgSvg');
  if(!svg){ttp('请先打开知识图谱');return;}
  // Clone visible SVG content
  var clone=svg.cloneNode(true);
  clone.setAttribute('width',svg.clientWidth||1200);
  clone.setAttribute('height',svg.clientHeight||700);
  clone.style.cssText='background:#fafafa';
  var data=new XMLSerializer().serializeToString(clone);
  var svgBlob=new Blob([data],{type:'image/svg+xml;charset=utf-8'});
  var url=URL.createObjectURL(svgBlob);
  var img=new Image();img.onload=function(){
    var canvas=document.createElement('canvas');
    canvas.width=img.width;canvas.height=img.height;
    var ctx=canvas.getContext('2d');ctx.fillStyle='#fafafa';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0);
    var a=document.createElement('a');a.href=canvas.toDataURL('image/png');
    a.download='知识图谱.png';a.click();
    URL.revokeObjectURL(url);
  };
  img.src=url;
  ttp('知识图谱已导出为PNG');
}

function closeKnowledgeGraph(){document.getElementById('kgOverlay').style.display='none';kgCurrentData=null;}
function switchKGView(view){
  kgCurrentView=view;
  ['cloud','network','timeline'].forEach(function(v){var el=document.getElementById('kgTab'+v.charAt(0).toUpperCase()+v.slice(1));if(el)el.classList.toggle('active',v===view);});
  var cp=document.getElementById('kgCloudPanel'),sv=document.getElementById('kgSvg'),tc=document.getElementById('kgTimelineCanvas');
  var gp=document.getElementById('kgGraphPanel'),ph=document.getElementById('kgPlaceholder');
  if(view==='cloud'){
    if(cp)cp.style.display='block';
    if(gp)gp.style.display='none';
    if(ph)ph.style.display='none';
    renderWordCloud();
  }else if(view==='timeline'){
    if(cp)cp.style.display='none';
    if(gp)gp.style.display='block';
    if(sv)sv.style.display='none';
    if(tc)tc.style.display='none';
    if(ph)ph.style.display='none';
    var tlSvg2=document.querySelector('#kgGraphPanel > svg.tl-svg');
    if(tlSvg2)tlSvg2.parentElement.removeChild(tlSvg2);
    renderTimeline();
  }else{
    if(cp)cp.style.display='none';
    if(gp)gp.style.display='block';
    if(sv)sv.style.display='block';
    if(tc)tc.style.display='none';
    if(ph)ph.style.display='none';
    var tlSvg3=document.querySelector('#kgGraphPanel > svg.tl-svg');
    if(tlSvg3)tlSvg3.style.display='none';
  }
}

async function generateKnowledgeGraph(){
  var ph=document.getElementById('kgPlaceholder'),sv=document.getElementById('kgSvg');
  ph.style.display='block';sv.style.display='none';sv.innerHTML='';
  var cp=document.getElementById('kgCloudPanel');if(cp)cp.style.display='none';
  var tc=document.getElementById('kgTimelineCanvas');if(tc)tc.style.display='none';
  document.getElementById('kgTabCloud').classList.remove('active');document.getElementById('kgTabNetwork').classList.add('active');
  document.getElementById('kgTabTimeline').classList.remove('active');
  ph.innerHTML='<div style="font-size:2.5rem;margin-bottom:16px">⚙️</div><div>正在调用Python后端生成知识图谱...</div>';
  var req={paper_topics:paperTopics,sections:sections,merged_refs:mergedRefs.map(function(r){return{title:r.title||'',journal:r.journal||'',year:r.year||'',ch:r.ch||1,conf:r.conf||0,displayNum:r.displayNum||0}}),manuscript_text:manuscriptText};
  try{
    var resp=await fetch(kgApiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req)});
    if(!resp.ok)throw new Error('API: '+resp.status);
    var r=await resp.json();if(!r.success)throw new Error(r.error||'error');
    kgCurrentData=r.data;renderKnowledgeGraph(r.data);
  }catch(e){console.warn('[KG] fallback JS:',e);generateKnowledgeGraphJS();}
}
function generateKnowledgeGraphJS(){
  kgCurrentData=null;
  var ph=document.getElementById('kgPlaceholder'),sv=document.getElementById('kgSvg');
  ph.style.display='block';sv.style.display='none';sv.innerHTML='';
  if(!paperTopics.length&&!sections.length&&!mergedRefs.length){ph.innerHTML='<div style="font-size:3rem;margin-bottom:16px">📄</div><div>请先上传论文并检索文献</div>';return;}
  var ents=[],links=[],ls=new Set();
  paperTopics.slice(0,15).forEach(function(t,i){ents.push({id:'topic_'+i,label:t.label,fullLabel:t.label,count:t.count||0,type:'keyword',radius:5+Math.min((t.count||1)*.5,8)});});
  sections.forEach(function(cs){ents.push({id:'ch_'+cs.ch,label:cs.name.replace(/第[一二三四五六七八九十\d]+章\s*/,'').substring(0,12),fullLabel:cs.name,type:'chapter',radius:12});
    if(cs.sections)cs.sections.forEach(function(sec){var sid='sec_'+sec.num.replace(/\./g,'_');ents.push({id:sid,label:sec.title.substring(0,10),fullLabel:sec.num+' '+sec.title,type:'section',radius:7});links.push({source:'ch_'+cs.ch,target:sid,type:'has',id:'link_'+cs.ch+'_'+sid});});});
  var rl=Math.min(30,mergedRefs.length);
  for(var ri=0;ri<rl;ri++){var rf=mergedRefs[ri];if(rf.title)ents.push({id:'ref_'+ri,label:rf.title.substring(0,30)+(rf.title.length>30?'...':''),fullLabel:rf.title,count:rf.conf||0,type:'reference',radius:4+Math.min((rf.conf||0)*.1,6),year:rf.year,ch:rf.ch});}
  sections.forEach(function(cs){paperTopics.slice(0,15).forEach(function(t,i){var kw=t.label.toLowerCase(),lid='kw_ch_'+i+'_'+cs.ch;if((cs.text||manuscriptText||'').toLowerCase().indexOf(kw)>=0&&!ls.has(lid)){links.push({source:'topic_'+i,target:'ch_'+cs.ch,type:'in',id:lid});ls.add(lid);}})});
  mergedRefs.slice(0,rl).forEach(function(r,ri){if(r.ch){var lid='ch_ref_'+r.ch+'_'+ri;if(!ls.has(lid)){links.push({source:'ch_'+r.ch,target:'ref_'+ri,type:'cites',id:lid});ls.add(lid);}}});
  kgCurrentData={entities:ents,links:links,stats:{total_entities:ents.length,total_links:links.length}};renderKnowledgeGraph(kgCurrentData);
}
function renderKnowledgeGraph(data){
  var ph=document.getElementById('kgPlaceholder'),sv=document.getElementById('kgSvg');
  ph.style.display='none';sv.style.display='block';sv.innerHTML='';
  var ents=data.entities||[],links=data.links||[];
  if(!ents.length){ph.style.display='block';sv.style.display='none';ph.innerHTML='<div style="font-size:3rem;margin-bottom:16px">📄</div><div>暂无数据</div>';return;}
  kgCurrentData=data;
  // Reset tabs to network
  document.getElementById('kgTabCloud').classList.remove('active');document.getElementById('kgTabNetwork').classList.add('active');
  document.getElementById('kgTabTimeline').classList.remove('active');
  var cp=document.getElementById('kgCloudPanel');if(cp)cp.style.display='none';
  var tc=document.getElementById('kgTimelineCanvas');if(tc)tc.style.display='none';
  sv.style.display='block';
  // Render network
  renderNetworkGraph(data);
  // Pre-render word cloud data
  renderWordCloud();
}
// ====== 交互式词云（全屏，带频次+关联线） ======
var _wcScale2 = 1, _wcTx2 = 0, _wcTy2 = 0, _wcPan2 = false, _wcPx2 = 0, _wcPy2 = 0;
// 关键词演变渲染
function renderKeywordEvolution(){
  var cp2=document.getElementById('kgCloudPanel');if(!cp2||kgCurrentView!=='cloud')return;
  var tps5=paperTopics.slice(0,12);if(!tps5.length)return;
  var bcs8=(sections||[]).filter(function(s){return!/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name)});
  var h5='<div style="font-size:.68rem;font-weight:600;color:#1d1d1f;margin:10px 0">📈 关键词演变（各章出现强度）</div>';
  h5+='<div style="display:flex;flex-direction:column;gap:3px">';
  tps5.forEach(function(t){h5+='<div style="display:flex;align-items:center;gap:4px;font-size:.6rem"><span style="min-width:50px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+t.label+'</span>';
    bcs8.forEach(function(cs){var ct5=((cs.text||'').match(new RegExp(t.label,'g'))||[]).length;var bh=Math.min(14,Math.max(2,ct5));h5+='<div style="flex:1;height:12px;background:rgba(0,0,0,0.03);border-radius:2px;position:relative"><div style="position:absolute;bottom:0;left:0;width:100%;height:'+bh+'px;background:#0071e3;opacity:'+(0.2+Math.min(1,ct5/20)).toFixed(2)+';border-radius:2px;transition:height .3s" title="'+cs.name+': '+ct5+'次"></div></div>';});h5+='</div>';});
  h5+='</div>';cp2.innerHTML=h5;
}

function renderWordCloud(){
  var cp = document.getElementById('kgCloudPanel');
  if (!cp || kgCurrentView !== 'cloud') return;
  cp.style.display = 'block';

  // Merge paper topics + reference keywords
  var refKws = {};
  var rl2 = (typeof mergedRefs !== 'undefined' && mergedRefs.length) ? mergedRefs : (typeof existingRefs !== 'undefined' ? existingRefs : []);
  rl2.forEach(function(r) { if (r.title) extractTitleKws(r.title).forEach(function(w) { refKws[w] = (refKws[w] || 0) + 1; }); });
  var refTopicList = Object.entries(refKws).filter(function(e) { return e[1] >= 2 && e[0].length >= 2; }).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 20).map(function(e) { return { label: e[0], count: e[1] }; });
  var topics = paperTopics.slice(0, 30).concat(refTopicList).sort(function(a, b) { return b.count - a.count; }).slice(0, 50);
  if (!topics.length) { cp.innerHTML = '<div style="text-align:center;padding:60px;color:#86868b;font-size:.9rem">暂无主题词数据</div>'; return; }

  var maxC = topics[0].count, minC = topics[topics.length - 1].count;
  var colors = ['#0071e3','#af52de','#30d158','#ff9f0a','#ff3b30','#5ac8fa','#ff375f','#64d2ff','#32d74b','#ffd60a','#bf5af2','#ff6482','#00c7be'];

  var words = [];
  topics.forEach(function(t, i) {
    var ratio = (t.count - minC) / Math.max(1, maxC - minC);
    var fs = Math.max(12, Math.min(44, 13 + ratio * 29));
    var weight = 400 + Math.round(ratio * 500);
    words.push({ label: t.label, count: t.count, fs: fs, weight: weight, color: colors[i % colors.length], idx: i, ratio: ratio });
  });

  // Measure and spiral-place
  var placed = [], tempEl = document.createElement('span');
  tempEl.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  document.body.appendChild(tempEl);
  var pw2 = cp.clientWidth - 20, ph2 = cp.clientHeight - 20, cx2 = pw2 / 2, cy2 = ph2 / 2;
  words.forEach(function(w) {
    tempEl.style.fontSize = w.fs + 'px'; tempEl.style.fontWeight = w.weight;
    tempEl.textContent = w.label;
    var tw = tempEl.offsetWidth, th = tempEl.offsetHeight;
    var r = 0, a = Math.random() * Math.PI * 2, bestX = cx2 - tw/2, bestY = cy2 - th/2, bestDist = Infinity;
    for (r = 0; r < Math.max(pw2, ph2); r += 3) {
      for (var step = 0; step < 20; step++) {
        a += 0.35;
        var x = cx2 + r * Math.cos(a) - tw/2, y = cy2 + r * Math.sin(a) - th/2;
        if (x < 5 || y < 65 || x + tw > cp.clientWidth - 5 || y + th > cp.clientHeight - 8) continue;
        var overlap = false;
        for (var pi = 0; pi < placed.length; pi++) {
          var p = placed[pi];
          if (!(x + tw + 8 < p.x || x > p.x + p.w + 8 || y + th + 4 < p.y || y > p.y + p.h + 4)) { overlap = true; break; }
        }
        if (!overlap) { var dist = Math.abs(x + tw/2 - cx2) + Math.abs(y + th/2 - cy2); if (dist < bestDist) { bestDist = dist; bestX = x; bestY = y; } }
      }
      if (bestDist < Infinity && r > 10) break;
    }
    w.x = Math.round(bestX); w.y = Math.round(bestY); w.w = tw; w.h = th;
    placed.push(w);
  });
  document.body.removeChild(tempEl);

  // Correlations: words that appear in same chapters
  var wordLinks = [];
  var byCh = {};
  words.forEach(function(w) {
    byCh[w.label] = [];
    (typeof sections !== 'undefined' ? sections : []).forEach(function(cs) {
      if ((cs.text || manuscriptText || '').indexOf(w.label) >= 0) byCh[w.label].push(cs.ch);
    });
  });
  for (var i = 0; i < words.length; i++) {
    for (var j = i + 1; j < words.length && wordLinks.length < 60; j++) {
      var shared = byCh[words[i].label].filter(function(ch) { return byCh[words[j].label].indexOf(ch) >= 0; });
      if (shared.length >= 2) wordLinks.push({ from: i, to: j, strength: shared.length });
    }
  }

  // Build HTML
  var h = '<div style="position:relative;width:100%;height:100%;overflow:hidden;cursor:grab;background:radial-gradient(ellipse at center,rgba(175,82,222,0.03) 0%,transparent 70%),rgba(0,0,0,0.01);border-radius:14px" id="wcContainer">';
  h += '<div style="position:absolute;top:14px;left:20px;right:20px;display:flex;justify-content:space-between;align-items:baseline;pointer-events:none;z-index:3">';
  h += '<div style="font-size:.8rem;font-weight:700;color:#1d1d1f">☁️ 关键词词云 · <span style="font-weight:400;color:#86868b">' + words.length + ' 词 · ' + wordLinks.length + ' 条关联</span></div>';
  h += '<div style="font-size:.62rem;color:#86868b">🖱 缩放 | 拖拽 | 悬停词查看关联词</div>';
  h += '</div>';
  h += '<svg id="wcSvg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1"><g id="wcLinkGroup"></g></svg>';
  h += '<div id="wcInner" style="position:relative;width:100%;height:100%;z-index:2">';
  words.forEach(function(w) {
    var opacity = 0.35 + w.ratio * 0.6;
    h += '<span class="wc-word" data-idx="' + w.idx + '" data-label="' + w.label.replace(/"/g,'&quot;').replace(/'/g,'&#39;') + '" style="position:absolute;left:' + w.x + 'px;top:' + w.y + 'px;font-size:' + w.fs + 'px;font-weight:' + w.weight + ';color:' + w.color + ';opacity:' + opacity.toFixed(2) + ';white-space:nowrap;cursor:pointer;transition:transform .15s,opacity .2s;line-height:1;user-select:none;text-shadow:0 1px 3px rgba(255,255,255,.6)">' + w.label + '<sup style="font-size:.42em;font-weight:500;opacity:.75;margin-left:1px">' + w.count + '</sup></span>';
  });
  h += '</div>';
  h += '<div style="position:absolute;bottom:10px;left:20px;right:20px;font-size:.6rem;color:#86868b;pointer-events:none;z-index:3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🔝 ' + words.slice(0, 6).map(function(t){return '<span style="color:'+t.color+';font-weight:600">'+t.label+'('+t.count+')</span>';}).join(' · ') + '</div>';
  h += '</div>';
  cp.innerHTML = h;

  // Draw link lines
  setTimeout(function() {
    var svg = document.getElementById('wcSvg'), lg = document.getElementById('wcLinkGroup');
    var ctr = document.getElementById('wcContainer');
    if (!svg || !lg || !ctr) return;
    var rect3 = ctr.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + rect3.width + ' ' + rect3.height);
    wordLinks.forEach(function(link, li) {
      var a = words[link.from], b = words[link.to];
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x + a.w / 2); line.setAttribute('y1', a.y + a.h / 2 - 12);
      line.setAttribute('x2', b.x + b.w / 2); line.setAttribute('y2', b.y + b.h / 2 - 12);
      var alpha = Math.min(0.35, 0.05 + link.strength * 0.08);
      line.setAttribute('stroke', 'rgba(175,82,222,' + alpha.toFixed(2) + ')');
      line.setAttribute('stroke-width', Math.max(0.8, link.strength * 0.6));
      line.setAttribute('class', 'wc-link');
      line.setAttribute('data-from', link.from); line.setAttribute('data-to', link.to);
      lg.appendChild(line);
    });
  }, 60);

  // Attach events
  _wcScale2 = 1; _wcTx2 = 0; _wcTy2 = 0;
  var container = document.getElementById('wcContainer'), inner = document.getElementById('wcInner');
  var wcWords = cp.querySelectorAll('.wc-word');
  wcWords.forEach(function(el) {
    el.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.2)'; this.style.zIndex = '10'; this.style.opacity = '1';
      var label = this.getAttribute('data-label');
      var relLabels = new Set(); relLabels.add(label);
      wordLinks.forEach(function(l) {
        if (words[l.from].label === label) relLabels.add(words[l.to].label);
        if (words[l.to].label === label) relLabels.add(words[l.from].label);
      });
      wcWords.forEach(function(w2) {
        var l2 = w2.getAttribute('data-label');
        if (!relLabels.has(l2)) w2.style.opacity = '0.12';
      });
      var links = document.querySelectorAll('.wc-link');
      links.forEach(function(ln) {
        var f = parseInt(ln.getAttribute('data-from')), t = parseInt(ln.getAttribute('data-to'));
        if (words[f].label === label || words[t].label === label) ln.setAttribute('opacity', '1');
        else ln.setAttribute('opacity', '0.06');
      });
    });
    el.addEventListener('mouseleave', function() {
      this.style.transform = ''; this.style.zIndex = '';
      var r2 = words[parseInt(this.getAttribute('data-idx'))].ratio;
      this.style.opacity = (0.35 + r2 * 0.6).toFixed(2);
      wcWords.forEach(function(w2) { var r3 = words[parseInt(w2.getAttribute('data-idx'))].ratio; w2.style.opacity = (0.35 + r3 * 0.6).toFixed(2); });
      document.querySelectorAll('.wc-link').forEach(function(ln) { ln.setAttribute('opacity', '0.6'); });
    });
    el.addEventListener('click', function(ev) {
      ev.stopPropagation();
      var idx = parseInt(this.getAttribute('data-idx'));
      highlightKGNode('topic_' + idx, true);
      setTimeout(function() { highlightKGNode('topic_' + idx, false); }, 2000);
    });
  });

  // Zoom/pan
  if (container && inner) {
    container.addEventListener('wheel', function(ev) {
      ev.preventDefault();
      var rc = container.getBoundingClientRect();
      var mx = ev.clientX - rc.left, my = ev.clientY - rc.top;
      var delta = ev.deltaY > 0 ? 0.92 : 1.08;
      var ns = Math.max(0.35, Math.min(3.5, _wcScale2 * delta));
      _wcTx2 = mx - (mx - _wcTx2) * ns / _wcScale2;
      _wcTy2 = my - (my - _wcTy2) * ns / _wcScale2;
      _wcScale2 = ns;
      inner.style.transformOrigin = '0 0';
      inner.style.transform = 'translate(' + _wcTx2 + 'px,' + _wcTy2 + 'px) scale(' + _wcScale2 + ')';
    });
    container.addEventListener('mousedown', function(ev) {
      if (ev.button === 0) { _wcPan2 = true; _wcPx2 = ev.clientX - _wcTx2; _wcPy2 = ev.clientY - _wcTy2; container.style.cursor = 'grabbing'; }
    });
    document.addEventListener('mousemove', function(ev) {
      if (_wcPan2) { _wcTx2 = ev.clientX - _wcPx2; _wcTy2 = ev.clientY - _wcPy2; if (inner) inner.style.transform = 'translate(' + _wcTx2 + 'px,' + _wcTy2 + 'px) scale(' + _wcScale2 + ')'; }
    });
    document.addEventListener('mouseup', function() { _wcPan2 = false; if (container) container.style.cursor = 'grab'; });
  }
}

// ====== 网络图 ======
function renderNetworkGraph(data){
  var sv=document.getElementById('kgSvg'),ents=data.entities||[],links=data.links||[];
  sv.innerHTML='';
  var colors={keyword:'#3b82f6',chapter:'#10b981',section:'#8b5cf6',subsection:'#06b6d4',reference:'#f59e0b'};
  var lc={appears_in:'#3b82f6',has:'#94a3b8',cites:'#f59e0b',related:'#8b5cf6',in:'#3b82f6'};
  var gM=document.createElementNS('http://www.w3.org/2000/svg','g');gM.id='kg-main';
  var gL=document.createElementNS('http://www.w3.org/2000/svg','g');gL.id='kg-links';
  var gN=document.createElementNS('http://www.w3.org/2000/svg','g');gN.id='kg-nodes';
  sv.appendChild(gM);gM.appendChild(gL);gM.appendChild(gN);
  var pos={};ents.forEach(function(e){pos[e.id]={x:e.x||Math.random()*1200+100,y:e.y||Math.random()*600+100};});
  links.forEach(function(l){var s=pos[l.source],t=pos[l.target];if(s&&t){var ln=document.createElementNS('http://www.w3.org/2000/svg','line');ln.setAttribute('x1',s.x);ln.setAttribute('y1',s.y);ln.setAttribute('x2',t.x);ln.setAttribute('y2',t.y);ln.setAttribute('stroke',lc[l.type]||'#cbd5e1');ln.setAttribute('stroke-width','1.5');ln.setAttribute('stroke-dasharray','4,2');ln.setAttribute('opacity','0.5');ln.id='link_'+l.id;ln.setAttribute('class','kg-link');gL.appendChild(ln);}});
  ents.forEach(function(e){var p=pos[e.id];if(!p)return;var r=e.radius||5;var g=document.createElementNS('http://www.w3.org/2000/svg','g');g.id='node_'+e.id;g.setAttribute('class','kg-node');g.setAttribute('transform','translate('+p.x+','+p.y+')');var c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('r',r);c.setAttribute('fill',colors[e.type]||'#94a3b8');c.setAttribute('opacity','0.85');c.setAttribute('cursor','pointer');c.setAttribute('stroke','#fff');c.setAttribute('stroke-width','2');g.appendChild(c);
    var t=document.createElementNS('http://www.w3.org/2000/svg','text');var lb=e.label||(e.fullLabel||'');if(lb.length>8)lb=lb.substring(0,8)+'..';t.textContent=lb;t.setAttribute('pointer-events','none');t.setAttribute('font-weight','500');t.setAttribute('font-size','7');t.setAttribute('fill','#374151');
    if(e.type==='keyword'||e.type==='chapter'){t.setAttribute('text-anchor','middle');t.setAttribute('x','0');t.setAttribute('y',r+10);}else if(e.type==='section'||e.type==='subsection'){t.setAttribute('text-anchor','start');t.setAttribute('x',r+3);t.setAttribute('y','3');}else{t.setAttribute('text-anchor','end');t.setAttribute('x',-r-3);t.setAttribute('y','3');}
    g.appendChild(t);
    g.addEventListener('mouseenter',function(ev){showNodeTooltip(e,ev);highlightKGNode(e.id,true);});
    g.addEventListener('mouseleave',function(){hideNodeTooltip();highlightKGNode(e.id,false);});
    gN.appendChild(g);
  });
  var leg=document.createElementNS('http://www.w3.org/2000/svg','g');leg.setAttribute('transform','translate(20,20)');
  var lbg=document.createElementNS('http://www.w3.org/2000/svg','rect');lbg.setAttribute('width','150');lbg.setAttribute('height','130');lbg.setAttribute('fill','#fff');lbg.setAttribute('stroke','#e2e8f0');lbg.setAttribute('rx','8');leg.appendChild(lbg);
  [{l:'关键词',c:colors.keyword},{l:'章节',c:colors.chapter},{l:'小节',c:colors.section},{l:'参考文献',c:colors.reference}].forEach(function(item,i){var cy=28+i*26;var c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx','22');c.setAttribute('cy',cy);c.setAttribute('r','8');c.setAttribute('fill',item.c);leg.appendChild(c);var tt=document.createElementNS('http://www.w3.org/2000/svg','text');tt.setAttribute('x','38');tt.setAttribute('y',cy+4);tt.setAttribute('font-size','11');tt.setAttribute('fill','#374151');tt.textContent=item.l;leg.appendChild(tt);});
  if(data.stats){var sy=28+4*26+10;var st=document.createElementNS('http://www.w3.org/2000/svg','text');st.setAttribute('x','22');st.setAttribute('y',sy);st.setAttribute('font-size','9');st.setAttribute('fill','#94a3b8');st.textContent='节点:'+(data.stats.total_entities||0)+' 边:'+(data.stats.total_links||0);leg.appendChild(st);lbg.setAttribute('height',sy+15);}
  sv.appendChild(leg);
  var scale=1,tx=0,ty=0,pan=false,px=0,py=0,ndid=null;
  sv.addEventListener('wheel',function(ev){ev.preventDefault();var d=ev.deltaY>0?0.9:1.1;var r=sv.getBoundingClientRect();var ns=Math.max(0.3,Math.min(3,scale*d));tx=ev.clientX-r.left-(ev.clientX-r.left-tx)*ns/scale;ty=ev.clientY-r.top-(ev.clientY-r.top-ty)*ns/scale;scale=ns;gM.setAttribute('transform','translate('+tx+','+ty+') scale('+scale+')');});
  sv.addEventListener('mousedown',function(ev){if(ev.button===0&&ev.target===sv){pan=true;px=ev.clientX-tx;py=ev.clientY-ty;}});
  sv.addEventListener('mousemove',function(ev){if(pan){tx=ev.clientX-px;ty=ev.clientY-py;gM.setAttribute('transform','translate('+tx+','+ty+') scale('+scale+')');}if(ndid&&pos[ndid]){var r2=sv.getBoundingClientRect();var nx=(ev.clientX-r2.left-tx)/scale,ny=(ev.clientY-r2.top-ty)/scale;pos[ndid].x=nx;pos[ndid].y=ny;var nG=document.getElementById('node_'+ndid);if(nG)nG.setAttribute('transform','translate('+nx+','+ny+')');links.forEach(function(l){if(l.source===ndid||l.target===ndid){var ln=document.getElementById('link_'+l.id);if(ln){if(l.source===ndid){ln.setAttribute('x1',nx);ln.setAttribute('y1',ny);}else{ln.setAttribute('x2',nx);ln.setAttribute('y2',ny);}}}});}});
  sv.addEventListener('mouseup',function(){pan=false;ndid=null;});sv.addEventListener('mouseleave',function(){pan=false;ndid=null;});
  gN.querySelectorAll('.kg-node').forEach(function(nG){nG.addEventListener('mousedown',function(ev){if(ev.button===0){ndid=this.id.replace('node_','');ev.stopPropagation();}});});
}
// ====== 文献引用网络（引用关系可视化） ======
function renderRefNetwork(){
  var tc=document.getElementById('kgTimelineCanvas');
  if(!tc||kgCurrentView!=='timeline')return;
  // Placeholder for future citation network graph
  // Current implementation uses the timeline view canvas
}
// ====== 交互式时间线（SVG，论文散点+标题悬停） ======
// ====== 交互式时间线（重新设计：水平行布局，按年份分列，悬停详情） ======
function renderTimeline(){
  var tc = document.getElementById('kgTimelineCanvas');
  if (!tc || kgCurrentView !== 'timeline') return;
  tc.style.display = 'block';
  var parent = tc.parentElement;
  var w = parent.clientWidth - 8, h = parent.clientHeight - 8;
  var refs = (typeof mergedRefs !== 'undefined' && mergedRefs.length ? mergedRefs : (typeof existingRefs !== 'undefined' ? existingRefs : []))
    .filter(function(r) { return r.year && parseInt(r.year) >= 1990; })
    .map(function(r) { return { year: parseInt(r.year), title: (r.title || r.ci || '').substring(0, 60),
      journal: r.journal || '', type: r.subType || 'existing', displayNum: r.displayNum || 0,
      ch: r.ch || 1, conf: r.conf || 0, _full: r }; });
  if (!refs.length) {
    var tg = document.getElementById('kgGraphPanel');
    if (tg) tg.innerHTML = '<div style="text-align:center;padding:60px;color:#86868b"><div style="font-size:3rem;margin-bottom:16px">📅</div><div>暂缺年份数据</div></div>';
    return;
  }
  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', w); svg.setAttribute('height', h);
  svg.setAttribute('class','tl-svg');svg.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;background:#1c1c1e;border-radius:12px';
  var byYear = {}; refs.forEach(function(r) { if (!byYear[r.year]) byYear[r.year] = []; byYear[r.year].push(r); });
  var yKeys = Object.keys(byYear).map(Number).sort(function(a,b){return a-b;});
  var minY = yKeys[0], maxY = yKeys[yKeys.length-1], yRange = Math.max(1, maxY-minY);
  var margin = { top: 45, right: 30, bottom: 40, left: 30 };
  var pw = w - margin.left - margin.right, ph = h - margin.top - margin.bottom;
  var colW = Math.max(60, pw / yKeys.length);
  // Horizontal scroll if many years
  var totalW = yKeys.length * colW + margin.left + margin.right;
  if (totalW > w) { w = totalW; svg.setAttribute('width', w); pw = w - margin.left - margin.right; }

  // Background
  var bg = document.createElementNS(svgNS, 'rect');
  bg.setAttribute('width', w); bg.setAttribute('height', h);
  bg.setAttribute('fill', '#1c1c1e'); svg.appendChild(bg);

  // Title
  var tEl = document.createElementNS(svgNS, 'text');
  tEl.setAttribute('x', margin.left); tEl.setAttribute('y', 26);
  tEl.setAttribute('font-size', '14'); tEl.setAttribute('font-weight', '700');
  tEl.setAttribute('fill', '#f1f5f9'); tEl.textContent = '📅 文献时间线 ('+refs.length+'篇, '+minY+'-'+maxY+')';
  svg.appendChild(tEl);

  // Year axis line
  var axisY = margin.top + ph - 30;
  var axLine = document.createElementNS(svgNS, 'line');
  axLine.setAttribute('x1', margin.left); axLine.setAttribute('x2', margin.left + pw);
  axLine.setAttribute('y1', axisY); axLine.setAttribute('y2', axisY);
  axLine.setAttribute('stroke', 'rgba(255,255,255,.15)'); axLine.setAttribute('stroke-width', '2');
  svg.appendChild(axLine);

  // Year columns and dots
  yKeys.forEach(function(yr, yi) {
    var cx = margin.left + yi * colW + colW/2;
    var items = byYear[yr], count = items.length;
    // Year label
    var yLabel = document.createElementNS(svgNS, 'text');
    yLabel.setAttribute('x', cx); yLabel.setAttribute('y', axisY + 18);
    yLabel.setAttribute('text-anchor', 'middle'); yLabel.setAttribute('font-size', '11');
    yLabel.setAttribute('fill', yr % 5 === 0 ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.25)');
    yLabel.setAttribute('font-weight', yr % 5 === 0 ? '600' : '400');
    yLabel.textContent = yr;
    svg.appendChild(yLabel);
    // Connector line
    if (count > 0) {
      var ln = document.createElementNS(svgNS, 'line');
      ln.setAttribute('x1', cx); ln.setAttribute('x2', cx);
      ln.setAttribute('y1', axisY - 4); ln.setAttribute('y2', axisY - Math.min(ph-40, 10 + count * 14));
      ln.setAttribute('stroke', 'rgba(255,255,255,.06)'); ln.setAttribute('stroke-width', '1');
      svg.appendChild(ln);
    }
    // Dots stacked vertically above axis
    var colors = { existing: '#3b82f6', unchanged: '#3b82f6', displaced: '#a78bfa', appended: '#34d399', generated: '#f59e0b' };
    for (var ri = 0; ri < items.length; ri++) {
      var r = items[ri];
      var dy = axisY - 12 - ri * 14;
      if (dy < margin.top + 10) { dy = margin.top + 10 + (ri % 8) * 12; } // wrap if too tall
      var dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', cx); dot.setAttribute('cy', dy);
      dot.setAttribute('r', 4 + Math.min(6, (r.conf || 30) / 20));
      dot.setAttribute('fill', colors[r.type] || '#3b82f6');
      dot.setAttribute('opacity', '0.85'); dot.setAttribute('stroke', '#1c1c1e');
      dot.setAttribute('stroke-width', '1.5'); dot.setAttribute('cursor', 'pointer');
      dot.setAttribute('data-yr', yr); dot.setAttribute('data-idx', ri);
      (function(r2, cx2, dy2){
        dot.addEventListener('mouseenter', function(ev) {
          var tt = document.getElementById('kgTimelineTooltip');
          if (!tt) { tt = document.createElement('div'); tt.id = 'kgTimelineTooltip'; tt.style.cssText = 'position:absolute;background:rgba(30,27,46,.96);color:#f1f5f9;padding:10px 14px;border-radius:10px;font-size:.7rem;max-width:260px;line-height:1.5;pointer-events:none;z-index:99999;border:1px solid rgba(255,255,255,.1);box-shadow:0 8px 24px rgba(0,0,0,.4)'; document.body.appendChild(tt); }
          tt.innerHTML = '<div style=\"font-weight:700;margin-bottom:4px\">['+r2.year+'] '+(r2.title||'未知标题')+'</div>'+
            (r2.journal?'<div style=\"color:rgba(255,255,255,.4)\">'+r2.journal+'</div>':'')+
            (r2.displayNum?'<div style=\"color:#fbbf24;font-size:.62rem;margin-top:2px\">['+r2.displayNum+']</div>':'');
          tt.style.display = 'block';
          tt.style.left = (ev.clientX+14)+'px'; tt.style.top = (ev.clientY-10)+'px';
        });
        dot.addEventListener('mouseleave', function() {
          var tt = document.getElementById('kgTimelineTooltip');
          if (tt) tt.style.display = 'none';
        });
      })(r, cx, dy);
      svg.appendChild(dot);
    }
  });

  // Clean up and insert
  var oldTl = document.querySelector('#kgGraphPanel > svg.tl-svg');
  if (oldTl) oldTl.parentElement.removeChild(oldTl);
  var svEl = document.getElementById('kgSvg'); if (svEl) svEl.style.display = 'none';
  var ph2 = document.getElementById('kgPlaceholder'); if (ph2) ph2.style.display = 'none';
  tc.style.display = 'none';
  var tg2 = document.getElementById('kgGraphPanel'); if (tg2) tg2.appendChild(svg);
}
function highlightKGNode(nodeId,on){
  var sv=document.getElementById('kgSvg'),data=kgCurrentData;
  if(!sv||!data)return;
  var ents=data.entities||[],links=data.links||[],gN=sv.querySelector('#kg-nodes'),gL=sv.querySelector('#kg-links');
  if(!gN||!gL)return;
  var targetEnt=ents.find(function(e){return e.id===nodeId;});
  var cIds=new Set([nodeId]);links.forEach(function(l){if(l.source===nodeId)cIds.add(l.target);if(l.target===nodeId)cIds.add(l.source);});
  gN.querySelectorAll('.kg-node').forEach(function(n){var nid=n.id.replace('node_',''),cr=n.querySelector('circle');if(cIds.has(nid)){cr.setAttribute('opacity',on?'1':'0.85');cr.setAttribute('stroke-width',on?'4':'2');cr.setAttribute('stroke',on?'#fbbf24':'#fff');}else{cr.setAttribute('opacity',on?'0.15':'0.85');cr.setAttribute('stroke-width','2');cr.setAttribute('stroke','#fff');}});
  gL.querySelectorAll('.kg-link').forEach(function(l){var lid=l.id.replace('link_',''),hit=links.some(function(ll){return ll.id===lid&&(ll.source===nodeId||ll.target===nodeId);});if(hit){l.setAttribute('stroke',on?'#fbbf24':'#cbd5e1');l.setAttribute('stroke-width',on?'3':'1.5');l.setAttribute('opacity',on?'1':'0.5');}else{l.setAttribute('opacity',on?'0.08':'0.5');}});
  // Also highlight word in cloud
  if(targetEnt&&targetEnt.type==='keyword'){
    var canvas=document.querySelector('#kgCloudPanel canvas'),words=canvas&&canvas._words;
    if(words){var ti=words.findIndex(function(w){return w.label===targetEnt.label;});if(ti>=0)highlightCloudWord(ti,on);}
  }
}
function highlightCloudWord(idx,on){
  var canvas=document.querySelector('#kgCloudPanel canvas');
  if(!canvas||!canvas._words)return;
  var ctx=canvas.getContext('2d'),w=canvas._words[idx];
  if(!w)return;
  ctx.fillStyle=on?'rgba(251,191,36,0.3)':'#f8fafc';
  ctx.fillRect(w.x-3,w.y-w.h-1,w.w+6,w.h+3);
}

var kgTooltip=null;
function showNodeTooltip(e,ev){
  if(!kgTooltip){kgTooltip=document.createElement('div');kgTooltip.style='position:fixed;background:#1e293b;color:#fff;padding:10px 14px;border-radius:8px;font-size:.8rem;max-width:300px;z-index:999999;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);line-height:1.5';document.body.appendChild(kgTooltip);}
  var tn={keyword:'关键词',chapter:'章节',section:'小节',subsection:'子节',reference:'文献'},cm={keyword:'#60a5fa',chapter:'#34d399',section:'#a78bfa',subsection:'#22d3ee',reference:'#fbbf24'};
  kgTooltip.innerHTML='<div style="font-weight:600;margin-bottom:4px;color:'+(cm[e.type]||'#94a3b8')+'">'+(e.fullLabel||e.label||'')+'</div><div style="color:#94a3b8;font-size:.75rem">类型: '+(tn[e.type]||e.type)+(e.count?' | 频次:'+e.count:'')+(e.conf?' | 匹配:'+e.conf+'%':'')+'</div>';
  kgTooltip.style.display='block';kgTooltip.style.left=(ev.clientX+15)+'px';kgTooltip.style.top=(ev.clientY+15)+'px';
}
function hideNodeTooltip(){if(kgTooltip)kgTooltip.style.display='none';}

// ====== 一键导出报告 ======
// 章节关联度矩阵计算
function computeChapterCorrelation(){
  var bc7=(sections||[]).filter(function(s){return!/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name)});
  var n2=bc7.length;if(n2<2)return null;
  var m=[];
  for(var ci=0;ci<n2;ci++){m[ci]=[];var ki=extractTitleKws(bc7[ci].text||'');for(var cj=0;cj<n2;cj++){if(ci===cj){m[ci][cj]=1;continue;}
    var kj=extractTitleKws(bc7[cj].text||'');var ic=ki.filter(function(w){return kj.indexOf(w)>=0;}).length;
    m[ci][cj]=Math.round(ic/Math.max(1,new Set(ki.concat(kj)).size)*100);}}
  return{chapters:bc7.map(function(c){return c.name;}),matrix:m};
}

function exportReport(){
  if(!manuscriptText){alert('请先上传论文');return;}
  showLoad('生成报告...',20,'整合所有分析数据');
  setTimeout(function(){
    var rl=(typeof mergedRefs!=='undefined'&&mergedRefs.length)?mergedRefs:existingRefs;
    var chCount=sections.filter(function(s){return!/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name);}).length;
    var refCount=rl.length,cnCount=rl.filter(function(r){return isRefChinese(r);}).length;
    var h='<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>论文分析报告</title><style>body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;max-width:800px;margin:0 auto;padding:30px;color:#1e293b;line-height:1.8}h1{font-size:1.4rem;border-bottom:2px solid #7c3aed;padding-bottom:10px}h2{font-size:1rem;color:#7c3aed;margin-top:24px}table{width:100%;border-collapse:collapse;margin:8px 0;font-size:.85rem}th,td{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}th{background:#f1f5f9}</style></head><body>';
    h+='<h1>📋 论文分析报告</h1>';
    h+='<p>生成时间: '+new Date().toLocaleString()+' | 论文: '+(AppState&&AppState.thesis?AppState.thesis.fileName:'')+'</p>';
    h+='<h2>📊 基本统计</h2><table><tr><th>指标</th><th>数值</th></tr>';
    h+='<tr><td>总字数</td><td>'+Math.round(manuscriptText.length/1000)+'k</td></tr>';
    h+='<tr><td>章节数</td><td>'+chCount+'</td></tr>';
    h+='<tr><td>参考文献</td><td>'+refCount+' 条（中文 '+cnCount+'，英文 '+(refCount-cnCount)+'）</td></tr>';
    h+='</table>';
    if(rl.length){h+='<h2>📚 参考文献列表</h2><ol>';rl.forEach(function(r,i){h+='<li>'+formatGB7714(r).replace(/<[^>]+>/g,'')+'</li>';});h+='</ol>';}
    h+='<p style="color:#94a3b8;font-size:.75rem;margin-top:40px">由 学术论文AI一站式助手 自动生成</p></body></html>';
    var blob=new Blob([h],{type:'text/html;charset=utf-8'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='论文分析报告.html';a.click();
    updLoad('完成',100);setTimeout(hideLoad,500);
  },200);
}

// ====== BibTeX 导出 ======
function copyBibTeX(){
  var rl=(typeof mergedRefs!=='undefined'&&mergedRefs.length)?mergedRefs:existingRefs;
  if(!rl.length){ttp('请先检索文献');return;}
  var out=rl.map(function(r){
    var au=(r.authors||'未知作者').split(',')[0].trim().replace(/ .*/,'');
    var key=au+(r.year||'')+(r.title||'bib').replace(/[^a-zA-Z0-9]/g,'').substring(0,12);
    var lines=['@article{'+key+',','  author={'+(r.authors||'未知作者')+'},','  title={'+(r.title||'未知标题')+'},'];
    if(r.journal)lines.push('  journal={'+r.journal+'},');
    if(r.year)lines.push('  year={'+r.year+'},');
    if(r.doi)lines.push('  doi={'+r.doi+'},');
    lines.push('}');return lines.join('\n');
  }).join('\n\n');
  navigator.clipboard.writeText(out);ttp('BibTeX 已复制');
}

// ====== DOI 批量补全 ======
async function batchCompleteDOI(){
  var rl=(typeof mergedRefs!=='undefined'&&mergedRefs.length)?mergedRefs:existingRefs;
  if(!rl.length){ttp('请先检索文献');return;}
  var missing=rl.filter(function(r){return !r.doi&&r.title&&r.title.length>5;});
  if(!missing.length){ttp('所有文献均已有DOI');return;}
  showLoad('补全DOI...',0);var done=0;
  for(var i=0;i<Math.min(missing.length,20);i++){
    var r=missing[i];
    try{
      var resp=await fetch('/verify_api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:r.title||'',journal:r.journal||'',year:r.year||''})});
      if(resp.ok){var v=await resp.json();if(v.doi&&!r.doi){r.doi=v.doi;}}
    }catch(e){}
    done++;updLoad('补全中('+done+'/'+Math.min(missing.length,20)+')',Math.round(done/Math.min(missing.length,20)*100));
    await sleep(300);
  }
  hideLoad();
  if(typeof renderRefs==='function')renderRefs();
  else if(typeof renderExistingOnly==='function')renderExistingOnly();
  ttp('DOI补全完成');
}

// 优化原文句子弹窗
function showOptimizeSentence(refIdx){
  var r=mergedRefs[refIdx];if(!r||!r.title){alert('无法获取文献信息');return}
  var modal=document.createElement('div');
  modal.style='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML='<div style="background:#fff;border-radius:12px;padding:24px;width:90%;max-width:700px;max-height:80vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'+
      '<h3 style="margin:0;color:#1e293b">优化原文句子以提高匹配度</h3>'+
      '<button onclick="this.closest(\'div\').parentElement.remove()" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer">关闭</button>'+
    '</div>'+
    '<div style="margin-bottom:16px;padding:12px;background:#eff6ff;border-radius:8px">'+
      '<div style="font-size:.8rem;color:#64748b;margin-bottom:4px">当前文献</div>'+
      '<div style="font-weight:600">'+r.title+'</div>'+
      '<div style="font-size:.75rem;color:#64748b;margin-top:4px">匹配度: '+(r.conf||0)+'% | 重合率: '+(r._dupRate||0)+'%</div>'+
    '</div>'+
    '<div style="margin-bottom:12px">'+
      '<div style="font-size:.85rem;font-weight:600;margin-bottom:8px;color:#1e293b">建议在正文第'+(r.ch||'?')+'章中添加包含以下关键词的句子来引用此文献：</div>'+
      '<div style="background:#fef3c7;padding:12px;border-radius:8px;font-size:.85rem;line-height:1.6">'+
        '<div style="margin-top:8px;font-weight:600">'+
          extractTitleKws(r.title).slice(0,6).map(function(w){return'<span style="background:#dbeafe;padding:2px 6px;border-radius:4px;margin:2px;display:inline-block">'+w+'</span>'}).join('')+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div style="margin-bottom:12px">'+
      '<div style="font-size:.85rem;font-weight:600;margin-bottom:8px;color:#1e293b">优化建议</div>'+
      '<div style="background:#f0fdf4;padding:12px;border-radius:8px;font-size:.82rem;line-height:1.6">'+
        '<ul style="margin:0;padding-left:20px">'+
          '<li>在句子中添加文献的方法或结论</li><li>句子中嵌入文献标题中的核心关键词</li><li>确保修改后的句子在目标章节的正文末尾</li>'+
        '</ul>'+
      '</div>'+
    '</div>'+
    '<div style="text-align:right">'+
      '<button onclick="this.closest(\'div\').parentElement.remove()" style="background:#64748b;color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;margin-right:8px">关闭</button>'+
      '<button onclick="jumpToCite('+refIdx+');this.closest(\'div\').parentElement.remove()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer">跳转到原文</button>'+
    '</div>'+
  '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click',function(e){if(e.target===modal)modal.remove()});
}