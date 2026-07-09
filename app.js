"use strict";var existingRefs=[],manuscriptText='',manuscriptHTML='',mergedRefs=[],paperTopics=[],zoomLevel=1,sections=[],selNavIdx=-1,searchRunning=false,appReady=false;
window.onerror=function(m,s,l,c,e){console.error(m,'@',s,':',l);document.getElementById('statusBar')&&(document.getElementById('statusBar').textContent='⚠ 出现错误，请刷新页面');return true};
// Init complete

// UTILS
function norm(s){return(s||'').toLowerCase().replace(/[^一-鿿a-z0-9]/g,'')}
function cnDigit(s){var m={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};return m[s]||parseInt(s)||0}
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

async function parseDocxStructure(buf){var zip=await JSZip.loadAsync(buf),xml=await zip.file('word/document.xml').async('string'),all=[],pm,pr=/<w:p[ >][\s\S]*?<\/w:p>/g;while((pm=pr.exec(xml))!==null){var p=pm[0],sm=p.match(/<w:pStyle[^>]*w:val="(\d+)"/),style=sm?sm[1]:'',tx=[],tm,tr=/<w:t[^>]*>([^<]*)<\/w:t>/g;while((tm=tr.exec(p))!==null)tx.push(tm[1]);all.push({style:style,text:tx.join(''),idx:all.length})}var tree=[],curCh=null,curSec=null;for(var i=0;i<all.length;i++){var a=all[i];if(a.style==='14'&&a.text){var m=a.text.match(/^第([一-龥\d]+)章\s*(.*)/),c=m?cnDigit(m[1]):(tree.length+1);curCh={ch:c,name:a.text,paraIdx:a.idx,sections:[]};tree.push(curCh);curSec=null}else if(a.style==='15'&&curCh&&a.text){var sm=a.text.match(/^(\d+\.\d+)\s*(.*)/);curSec={num:sm?sm[1]:a.text.substring(0,5),title:sm?sm[2]:a.text,paraIdx:a.idx,subs:[]};curCh.sections.push(curSec)}else if(a.style==='16'&&curSec&&a.text){var sm2=a.text.match(/^(\d+\.\d+\.\d+)\s*(.*)/);curSec.subs.push({num:sm2?sm2[1]:a.text.substring(0,7),title:sm2?sm2[2]:a.text,paraIdx:a.idx})}}return tree}

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
  var refMap=new Map();refs.forEach(function(r){if(r.num)refMap.set(r.num,r)});
  var tw=document.createTreeWalker(box,NodeFilter.SHOW_TEXT,null,false),nodes=[];
  for(var tn=tw.nextNode();tn;tn=tw.nextNode())nodes.push(tn);

  for(var i=nodes.length-1;i>=0;i--){
    var node=nodes[i],txt=node.textContent||'',p=node.parentElement;
    if(!beforeRefList(p))continue;
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

      // Set _domEl and _ctx for the ref
      matchRef._domEl=span;
      matchRef._paraEl=node.parentElement;
      // 已有文献已存_ctx的不覆盖
      if(!matchRef._isOriginal){matchRef._ctx=extractCtxBeforeMarker(txt,n);}
      // Calculate duplicate rate
      var ctx1=matchRef._ctx;
      if(ctx1){
        var kw3=extractTitleKws(matchRef.title||'');
        if(kw3.length>0){
          var sk3=extractTitleKws(ctx1);
          var o3=sk3.filter(function(w){return kw3.indexOf(w)>=0}).length;
          matchRef._dupRate=Math.min(95,Math.round(o3/Math.max(1,(sk3.length+kw3.length)/2)*100));
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

  }catch(e){}
}
function injectNewMarkers(refs){
  var box=document.getElementById('thesisBox');if(!box||!refs.length)return;
  if(!firstBodyChEl())return;

  // Group refs by chapter
  var byCh={};refs.forEach(function(r){var ck=r.ch||1;if(!byCh[ck])byCh[ck]=[];byCh[ck].push(r)});
  console.log('[inject] Total refs:',refs.length,'byCh keys:',Object.keys(byCh));

  // For each chapter, process sentences
  Object.keys(byCh).sort(function(a,b){return parseInt(a)-parseInt(b)}).forEach(function(chNum){
    var chRefs=byCh[chNum];if(!chRefs.length)return;
    var chEl=document.getElementById('ch-'+chNum);
    if(!chEl){
      console.warn('[inject] Chapter element ch-'+chNum+' not found, skipping');
      return
    }
    console.log('[inject] Processing chapter',chNum,'with',chRefs.length,'refs');

    // Find next chapter element to know boundary
    var nextChEl=null,found=false;
    var allChEls=box.querySelectorAll('[id^="ch-"]');
    for(var i=0;i<allChEls.length;i++){
      if(found){nextChEl=allChEls[i];break}
      if(allChEls[i]===chEl)found=true
    }

    // Collect all paragraph/sentence nodes in this chapter
    var paras=[];
    var cur=chEl.nextSibling;
    while(cur){
      if(nextChEl&&cur===nextChEl)break;
      if(cur.nodeType===1){
        var tag=(cur.tagName||'').toLowerCase();
        if(/^p$/.test(tag)){
          // 跳过正文尾部（参考文献之后的段落）
          var bb=typeof bodyBoundaryEl==='function'?bodyBoundaryEl():null;
          if(bb&&(cur.compareDocumentPosition(bb)&Node.DOCUMENT_POSITION_FOLLOWING)){cur=cur.nextSibling;continue;}
          if(cur.querySelector&&cur.querySelector('.cite-marker')){cur=cur.nextSibling;continue}
          paras.push(cur)
        }
      }
      cur=cur.nextSibling
    }

    // Extract sentences from paragraphs
    var allSentences=[];
    paras.forEach(function(p){
      var txt=p.textContent||'';
      var sentences=[],re3=/[。；！？\.\?\!]/g,m3,last2=0;
      while((m3=re3.exec(txt))!==null){
        var st=txt.substring(last2,m3.index+1).trim();
        if(st.length>=10)sentences.push({text:st,endPos:m3.index+1,para:p})
        last2=m3.index+1
      }
      var tl=txt.substring(last2).trim();
      if(tl.length>=10)sentences.push({text:tl,endPos:txt.length,para:p})
      allSentences=allSentences.concat(sentences)
    });

    // Match refs to sentences by keyword overlap
    var usedRefs=new Set();
    allSentences.forEach(function(sen){
      if(usedRefs.size>=chRefs.length)return;
      var bestRef=null,bestScore=0,bestDupRate=0;
      chRefs.forEach(function(r){
        if(usedRefs.has(r))return;
        // Calculate keyword match score
        var kw=extractTitleKws(r.title);
        var score=kw.reduce(function(s,w){return s+(sen.text.toLowerCase().indexOf(w)>=0?1:0)},0);
        // 重合度 = 句子关键词 ∩ 文献关键词 / 双向平均
        var sk=extractTitleKws(sen.text);
        var o2=sk.filter(function(w){return kw.indexOf(w)>=0}).length;
        var dupRate=kw.length>0?Math.round(o2/Math.max(1,(sk.length+kw.length)/2)*100):0;
        if(score>=2&&score>bestScore){bestScore=score;bestRef=r;bestDupRate=dupRate}
      });
      if(bestRef){
        usedRefs.add(bestRef);
        sen.ref=bestRef;
        sen.refScore=bestScore;
        sen.dupRate=bestDupRate;
        bestRef._dupRate=Math.max(bestRef._dupRate||0,bestDupRate)
      }
    });

    // Insert markers at end of matched sentences
    allSentences.forEach(function(sen){
      if(!sen.ref)return;
      var p=sen.para;if(!p)return;
      var txt=p.textContent||'';
      var markerText='['+(sen.ref.displayNum||'?')+']';
      var markerHtml='<span class="cite-marker generated" data-ref="'+(sen.ref.displayNum||'')+'" onclick="scrollToRef('+(sen.ref.displayNum||0)+')" title="建议引用'+markerText+'">'+markerText+'</span>';

      // Find the sentence in paragraph and insert marker before ending punctuation
      var senStart=txt.indexOf(sen.text);
      if(senStart<0)return;
      var insertPos=senStart+sen.text.length;

      // Find the last punctuation mark position
      var punctMatch=sen.text.match(/[。；！？\.\?\!]\s*$/);
      if(punctMatch){
        insertPos=senStart+sen.text.length-punctMatch[0].length
      }

      // Create marker span element
      var markerSpan=document.createElement('span');
      markerSpan.className='cite-marker generated';
      markerSpan.setAttribute('data-ref',sen.ref.displayNum||'');
      markerSpan.textContent='['+(sen.ref.displayNum||'?')+']';
      markerSpan.onclick=function(nn){return function(e){e.stopPropagation();scrollToRef(nn);};}(sen.ref.displayNum||0);
      markerSpan.title='建议引用['+(sen.ref.displayNum||'?')+']';

      // Insert marker into DOM at correct text position (preserves existing HTML)
      var tw=document.createTreeWalker(p,NodeFilter.SHOW_TEXT,null,false);
      var pos=0,targetNode=null,targetOffset=0,tn2;
      while((tn2=tw.nextNode())!==null){var len=tn2.textContent.length;if(pos+len>insertPos){targetNode=tn2;targetOffset=insertPos-pos;break;}pos+=len;}
      if(targetNode){var afterText=targetNode.splitText(targetOffset);targetNode.parentElement.insertBefore(markerSpan,afterText);}
      else{p.appendChild(markerSpan);}

      // Update ref DOM info
      sen.ref._domEl=markerSpan;
      var mel=markerSpan;
      if(mel){
        sen.ref._domEl=mel;
        sen.ref._ctx=extractCtxBeforeMarker(txt,sen.ref.displayNum);
        // Find section info
        var sp=sectionPathFor(markerSpan,sen.ref.displayNum);
        sen.ref._chName=sp.ch;
        sen.ref._secName=sp.sec;
        sen.ref._subName=sp.sub
      }
    });
  });
}
function scrollToRef(n){var el=document.getElementById('r'+(n-1))||document.getElementById('er'+(n-1));if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.transition='background .3s';el.style.background='#fef3c7';setTimeout(function(){el.style.background=''},2000)}else ttp('未找到['+n+']')}

function renderNavTree(tree){var c=document.getElementById('navTree');if(!tree||!tree.length){c.innerHTML='<i style="color:var(--m);font-size:.7rem;padding:8px;display:block">未检测到章节</i>';return}var h='',idx=0;for(var ci=0;ci<tree.length;ci++){var ch=tree[ci];h+='<div class="tree-node ch" data-idx="'+(idx++)+'" data-id="ch-'+ch.ch+'" onclick="navClick2(this)">'+ch.name+'</div>';for(var si=0;si<ch.sections.length;si++){var sec=ch.sections[si],sid='sec-'+sec.num.replace(/[.]/g,'-');h+='<div class="tree-node sec" data-idx="'+(idx++)+'" data-id="'+sid+'" onclick="navClick2(this)">'+sec.num+' '+sec.title+'</div>';for(var ui=0;ui<sec.subs.length;ui++){var sub=sec.subs[ui],uid='sub-'+sub.num.replace(/[.]/g,'-');h+='<div class="tree-node sub" data-idx="'+(idx++)+'" data-id="'+uid+'" onclick="navClick2(this)">'+sub.num+' '+sub.title+'</div>'}}}c.innerHTML=h}


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
async function extractRefsFromRawDocx(buf){var zip=await JSZip.loadAsync(buf),xml=await zip.file('word/document.xml').async('string'),idx=xml.lastIndexOf('参考文献');if(idx<0)return[];var tail=xml.substring(idx),paras=[],pm,pr=/<w:p[ >][\s\S]*?<\/w:p>/g;while((pm=pr.exec(tail))!==null)paras.push(pm[0]);if(paras.length<2)return[];var refs=[],sw=/^(致谢|附录|个人简历|声明|获奖|奖项|认证|荣誉|专利|Abstract|攻读|在读)/;for(var i=0;i<paras.length;i++){var t=extractTextFromXml(paras[i]);if(!t)continue;if(/^(?:HYPERLINK|PAGEREF|_Toc)/.test(t))continue;if(sw.test(t))break;if(t.length<10)continue;refs.push({num:refs.length+1,ci:t})}return refs}
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

// sectionPathFor 兼容旧调用，内部转发到 findSectionForElement
function sectionPathFor(el,refN){
  var box=document.getElementById('thesisBox');
  // 没有DOM元素时从数据取
  if(!el||(el&&!el.textContent)){
    var ref=mergedRefs.find(function(r){return r.displayNum===refN});
    if(ref){
      var chN2={};sections.forEach(function(cs){if(cs.ch&&cs.name)chN2[cs.ch]=cs.name});
      for(var i=1;i<=10;i++)if(!chN2[i])chN2[i]='第'+i+'章';
      var cn=ref.ch||1,sec2='',sub2='',st2='',sut2='';
      var co=sections.find(function(s){return s.ch===cn});
      if(co&&co.sections){
        if(ref._bestSec){var so=co.sections.find(function(s){return s.num===ref._bestSec});if(so){sec2=so.num;st2=so.title;}}
        if(ref._bestSub){co.sections.forEach(function(s){if(s.subs){var sso=s.subs.find(function(ss){return ss.num===ref._bestSub});if(sso){sub2=sso.num;sut2=sso.title;}}});}
      }
      return{ch:chN2[cn]||('第'+cn+'章'),sec:sec2?(sec2+(st2?' '+st2:'')):'',sub:sub2?(sub2+(sut2?' '+sut2:'')):'',ctx:''};
    }
    return{ch:'第1章',sec:'',sub:'',ctx:''};
  }
  // 有DOM元素：找到父段落，然后找锚点
  var paraEl=el;
  while(paraEl&&paraEl!==box&&!/^(?:p|h[1-6]|div|li|td|blockquote)$/i.test(paraEl.tagName||'')){
    paraEl=paraEl.parentElement;
  }
  return findSectionForElement(paraEl||el,refN);
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
    var t='',n=el.nextSibling,nextCh=si+1<bodyChs.length?('ch-'+bodyChs[si+1].ch):null;
    while(n){
      var nextId=n.id||'';
      if(nextCh&&nextId===nextCh)break;
      if(n.nodeType===3)t+=n.textContent+' ';
      else if(n.nodeType===1&&!n.id)t+=(n.textContent||'')+' ';
      n=n.nextSibling
    }
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

function assignChapters(refs,mode,total){
  if(!refs.length||!sections.length)return;
  if(!sections[0].text||sections[0].text===manuscriptText)populateChapterText();
  // Only use body chapters (excluding 参考文献/附录/致谢/获奖等)
  var bodyChs=sections.filter(function(s){return !/参考文献|附录|致谢|个人简历|声明|获奖|奖项|认证|荣誉|专利|攻读|在读/.test(s.name)});
  var n2=bodyChs.length,lastCh=bodyChs[n2-1].ch;
  if(!n2){console.warn('[assign] No body chapters found!');return}
  // Score against body chapters only
  var scores=refs.map(function(r){var kws=extractTitleKws(r.title||'');return bodyChs.map(function(cs){var ct=(cs.text||'').toLowerCase();var h=kws.reduce(function(s,w){return s+(ct.indexOf(w)>=0?1:0)},0);return kws.length>0?h/kws.length:0});});
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
        var st=(cs2.text||'').toLowerCase();
        var pat=(sec.num+'[\\s]*'+sec.title).toLowerCase();
        var idx2=st.indexOf(pat);
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
  // 正文词轮次（恢复：保证检索覆盖全面）
  var genEN=['construction','engineering','management','safety','monitoring','evaluation','prediction','analysis','design','optimization','machine learning','deep learning','neural network','artificial intelligence','big data','internet of things'];
  var genCN=['工程','施工','管理','安全','监测','评价','预测','分析','设计','优化','系统','模型','方法','技术','智能','网络','算法','风险','评估','控制'];
  var paraFreq2={},badRE2=/^(?:the|and|for|with|this|that|from|have|are|was|were|been|will|would|could|should|[一-鿿]?[的了是在和与等及或被把从对到向上向下只个性它他也都很这就那能会要可但而不因所以之为着中其已该并约]$)/;
  var box3=document.getElementById('thesisBox');
  if(box3){var paras3=box3.querySelectorAll('p');
    for(var pi2=0;pi2<Math.min(paras3.length,150);pi2++){
      var pt3=(paras3[pi2].textContent||'').replace(/[^一-鿿a-zA-Z]/g,' ');
      var pw3=new Set();pt3.split(/\s+/).filter(function(w){return w.length>=2&&!badRE2.test(w)}).forEach(function(w){pw3.add(w)});
      pw3.forEach(function(w){paraFreq2[w]=(paraFreq2[w]||0)+1});}}
  var relevantSet2=new Set();
  tpLabels.forEach(function(t){relevantSet2.add(t.toLowerCase())});
  allSecWords.forEach(function(w){relevantSet2.add(w.toLowerCase())});
  genCN.concat(genEN).forEach(function(w){relevantSet2.add(w.toLowerCase())});
  var paraKws2=[];
  Object.keys(paraFreq2).forEach(function(w){
    if(paraFreq2[w]>=3||relevantSet2.has(w.toLowerCase())||Array.from(relevantSet2).some(function(rw){return rw.indexOf(w)>=0||w.indexOf(rw)>=0}))paraKws2.push(w);});
  paraKws2.sort(function(a,b){return(paraFreq2[b]||0)-(paraFreq2[a]||0)});
  searchRounds.push(paraKws2.slice(0,60));
  // 主题词搭配领域通用词
  var extra3=[];
  tpLabels.slice(0,6).forEach(function(t){var gs=/[一-鿿]/.test(t)?genCN:genEN;gs.slice(0,5).forEach(function(g){extra3.push(t+' '+g)})});
  searchRounds.push(extra3.slice(0,40));
  // 合并去重各轮 → 1次HTTP请求
  searchRounds=searchRounds.map(function(r){return Array.from(new Set(r)).filter(Boolean)});
  var allTerms3=[];searchRounds.forEach(function(r){allTerms3=allTerms3.concat(r);});
  allTerms3=Array.from(new Set(allTerms3));
  if(!Array.isArray(allTerms3))allTerms3=[];
  var pool=[];var seen=new Set();
  var batchSize=40;
  updLoad('搜索('+allTerms3.length+'词,'+Math.ceil(allTerms3.length/batchSize)+'批)...',15);
  var fetches3=[];
  for(var bi=0;bi<allTerms3.length;bi+=batchSize){
    (function(batch){var p=fetch('/search_api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queries:batch,max_per_query:200})}).then(function(r){return r.json()}).then(function(rj){if(rj.success&&rj.results){rj.results.forEach(function(rr){var nk=norm(rr.title).substring(0,60);if(!seen.has(nk)){seen.add(nk);pool.push(rr);}})}}).catch(function(e){});fetches3.push(p);})(allTerms3.slice(bi,bi+batchSize));}
  await Promise.all(fetches3);
  updLoad('累计'+pool.length+'条',30);

if(!pool.length){hideLoad();searchRunning=false;alert('未检索到相关文献。\n\n可能原因：\n1. 论文主题词过于冷门\n2. 网络连接不稳定\n3. 搜索词数量不足\n\n建议：\n• 检查Python服务窗口日志\n• 访问 /ping 确认服务正常\n• 尝试减少检索文献总数');return}

  // STEP 3: 筛选排序 — 中英文分堆精选，确保比例精确（分片异步，避免卡死）
  var selected=[];
  try{
    updLoad('筛选排序...',73);
    await sleep(0);
    pool.sort(function(a,b){return(parseInt(b.year)||0)-(parseInt(a.year)||0)});

    updLoad('去重...',76);
    var existingTitles=existingRefs.map(function(er){return(er.title||'').toLowerCase()});
    function isDupWithExisting(rt){var rtL=(rt.title||'').toLowerCase(),rtK=extractTitleKws(rt.title||'');if(!rtK.length)return false;return existingTitles.some(function(et){var etK=extractTitleKws(et);if(!etK.length)return false;var overlap=rtK.filter(function(w){return etK.indexOf(w)>=0}).length;return overlap>=Math.min(3,Math.max(1,Math.floor(rtK.length*0.6)));});}

    // 分中文/英文两堆（去重后按年份排序）
    await sleep(0);
    var cnPool=[],enPool=[];
    for(var pi=0;pi<pool.length;pi++){var pr=pool[pi];if(isDupWithExisting(pr))continue;if(pr.isCN)cnPool.push(pr);else enPool.push(pr);}
    updLoad('中:'+cnPool.length+' 英:'+enPool.length+' → 目标'+total,78);

    // 按年排序（已排序但去重后保持）
    // 计算精确配额
    var enWanted=Math.round(total*Math.max(enPct,100-cnPct)/100);
    var cnWanted=total-enWanted;
    // 实际可取量
    var cnTake=Math.min(cnWanted,cnPool.length);
    var enTake=Math.min(enWanted,enPool.length);
    // 一方不够用另一方补
    var cnShort=cnWanted-cnTake,enShort=enWanted-enTake;
    if(cnShort>0){enTake=Math.min(enPool.length,enTake+cnShort);}
    if(enShort>0){cnTake=Math.min(cnPool.length,cnTake+enShort);}
    // 如果两方加起来还不够total，取全部
    if(cnTake+enTake<total){cnTake=cnPool.length;enTake=enPool.length;}
    // 截取
    updLoad('中文'+cnTake+'条 + 英文'+enTake+'条',80);
    await sleep(0);
    for(var ci2=0;ci2<cnTake;ci2++)selected.push(cnPool[ci2]);
    for(var ei2=0;ei2<enTake;ei2++)selected.push(enPool[ei2]);
    // 按年份重排最终结果
    selected.sort(function(a,b){return(parseInt(b.year)||0)-(parseInt(a.year)||0)});
    
  }catch(e3){console.warn('[step3] filter error:',e3.message);}

  try{updLoad('分配章节...',85);await sleep(0);var distMode=document.getElementById('fDist')&&document.getElementById('fDist').value||'auto';assignChapters(selected,distMode,total);}catch(e4){console.warn('[step4] assign error:',e4.message);}
  try{updLoad('四维度评估...',90);await sleep(0);await forEachChunked(selected,function(r){scoreReference(r,{source:'new',hasSentence:false});},50);}catch(e5){console.warn('[step5] score error:',e5.message);}

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

  // 2b. 未匹配到的文献：在最佳段落的最相关句子末尾插入标记（不替换原文，末尾插入）
  try{mergedRefs.forEach(function(r){
    if(r.source==="existing"||r._domEl||!r.ch)return;
    var chEl=document.getElementById("ch-"+r.ch);if(!chEl||!chEl.parentElement)return;
    var bodyBound=typeof bodyBoundaryEl==='function'?bodyBoundaryEl():null;
    var paras=[],sib=chEl.nextSibling;
    while(sib){if(sib.nodeType===1&&sib._slevel==="ch")break;
      if(sib.nodeType===1&&/^p$/i.test(sib.tagName)&&sib.textContent&&sib.textContent.length>20){
        if(bodyBound&&(sib.compareDocumentPosition(bodyBound)&Node.DOCUMENT_POSITION_FOLLOWING)){sib=sib.nextSibling;continue;}
        paras.push(sib);
      }
      sib=sib.nextSibling;}
    var rtKws=extractTitleKws(r.title||"");
    // 在所有段落的所有句子中找最佳匹配句
    var bestSentText=null,bestSentPara=null,bestSentScore=0,sentStartInPara=0,sentEndInPara=0;
    paras.forEach(function(pr){
      var pt=pr.textContent||"";
      var re3=/[。；！？\.\?\!]/g,m3,last3=0;
      while((m3=re3.exec(pt))!==null){
        var st=pt.substring(last3,m3.index+1).trim();
        if(st.length<10){last3=m3.index+1;continue;}
        var sc=rtKws.reduce(function(s,w){return s+(st.toLowerCase().indexOf(w)>=0?1:0)},0);
        if(sc>bestSentScore){bestSentScore=sc;bestSentText=st;bestSentPara=pr;sentStartInPara=last3;sentEndInPara=m3.index+1;}
        last3=m3.index+1;
      }
      var tl2=pt.substring(last3).trim();
      if(tl2.length>=10){var sc2=rtKws.reduce(function(s,w){return s+(tl2.toLowerCase().indexOf(w)>=0?1:0)},0);if(sc2>bestSentScore){bestSentScore=sc2;bestSentText=tl2;bestSentPara=pr;sentStartInPara=last3;sentEndInPara=pt.length;}}
    });
    if(!bestSentPara||bestSentScore<1)return;
    // 在最佳匹配句末尾（标点符号之后）插入引用标记
    var mrkSpan3=document.createElement('span');mrkSpan3.className='cite-marker generated';
    mrkSpan3.textContent='['+r.displayNum+']';
    mrkSpan3.onclick=function(nn){return function(e){e.stopPropagation();scrollToRef(nn);};}(r.displayNum);
    // 用 TreeWalker 定位句末文本节点，在标点后插入
    var tw4=document.createTreeWalker(bestSentPara,NodeFilter.SHOW_TEXT,null,false);
    var pos4=0,tgNode=null,tgOff=0;
    var tn4;
    while((tn4=tw4.nextNode())!==null){var ln4=tn4.textContent.length;if(pos4+ln4>=sentEndInPara){tgNode=tn4;tgOff=sentEndInPara-pos4;break;}pos4+=ln4;}
    if(tgNode){
      tgNode.splitText(tgOff);
      var afterNode=tgNode.nextSibling;
      tgNode.parentElement.insertBefore(mrkSpan3,afterNode);
    }else{bestSentPara.appendChild(mrkSpan3);}
    r._domEl=mrkSpan3;
    r._ctx=bestSentText||((bestSentPara.textContent||'').substring(0,80));
    r._hasSection=true;
  })}catch(es){console.warn("[auto] skip:",es.message);}
  // 2c. 极少数仍未匹配的：追加到章节下第一个段落的句末
  try{mergedRefs.forEach(function(r){
    if(r.source==="existing"||r._domEl||!r.ch)return;
    var chEl2=document.getElementById("ch-"+r.ch);if(!chEl2)return;
    var firstPara=chEl2.nextSibling;
    while(firstPara&&firstPara.nodeType!==1)firstPara=firstPara.nextSibling;
    if(!firstPara||!/^p$/i.test(firstPara.tagName||''))return;
    // 找到段落第一句的末尾
    var fpt=firstPara.textContent||"",mEnd=fpt.search(/[。！？\.\?\!]/),insertAt=mEnd>=0?mEnd+1:fpt.length;
    var tw5=document.createTreeWalker(firstPara,NodeFilter.SHOW_TEXT,null,false);
    var pos5=0,tgN2=null,tgO2=0,tn5;
    while((tn5=tw5.nextNode())!==null){var ln5=tn5.textContent.length;if(pos5+ln5>=insertAt){tgN2=tn5;tgO2=insertAt-pos5;break;}pos5+=ln5;}
    var mrk2=document.createElement('span');mrk2.className='cite-marker generated';
    mrk2.textContent='['+r.displayNum+']';mrk2.onclick=function(nn){return function(e){e.stopPropagation();scrollToRef(nn);};}(r.displayNum);
    if(tgN2){tgN2.splitText(tgO2);tgN2.parentElement.insertBefore(mrk2,tgN2.nextSibling);}else{firstPara.appendChild(mrk2);}
    r._domEl=mrk2;r._ctx=(firstPara.textContent||'').substring(0,60);r._hasSection=true;
  })}catch(es2){}

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
  var c=document.getElementById('refs'),chN={};
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

      // 确定位置：已有文献优先使用初始化时存储的章节/句子绑定
      var sp;
      if(r._chName && (r.subType==='unchanged' || r.subType==='displaced')){
        sp={ch:r._chName||chName,sec:r._secName||'',sub:r._subName||'',ctx:r._ctx||''};
      }else if(r._domEl){
        try{sp=findSectionForElement(r._domEl,r.displayNum);}catch(e){sp={ch:chName,sec:'',sub:'',ctx:r._ctx||''};}
      }else{
        // 新文献：从_bestSec取
        var _sec='',_sub='',_secTitle='',_subTitle='';
        if(r._bestSec && chObj && chObj.sections){
          var secObj=chObj.sections.find(function(s){return s.num===r._bestSec||s.num.startsWith(r._bestSec)});
          if(secObj){_sec=secObj.num;_secTitle=secObj.title;}
        }
        if(r._bestSub && chObj && chObj.sections){
          chObj.sections.forEach(function(s){if(s.subs){
            var subObj=s.subs.find(function(ss){return ss.num===r._bestSub});
            if(subObj){_sub=subObj.num;_subTitle=subObj.title;}
          }});
        }
        r._hasSection=!!_sec;
        if(!_sec){_sec='⚠ 未匹配';_secTitle='建议优化原文句子后重新检索'}
        sp={ch:chName,sec:_sec?(_sec+(_secTitle?' '+_secTitle:'')):(_secTitle||''),sub:_sub?(_sub+(_subTitle?' '+_subTitle:'')):(_subTitle||''),ctx:r._ctx||''};
      }
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
      h+='<div class="ref-bar"><span class="label">真实度</span><div class="bar-wrap"><div class="bar-fill '+cl+'" style="width:'+conf+'%"></div></div><span class="num">'+conf+'%</span></div>';
      h+='<div class="ref-bar"><span class="label">主题相关</span><div class="bar-wrap"><div class="bar-fill '+(r._topicRel>=70?'high':r._topicRel>=40?'medium':'low')+'" style="width:'+(r._topicRel||0)+'%"></div></div><span class="num">'+(r._topicRel||0)+'%</span></div>';
      h+='<div class="ref-bar"><span class="label">章节适配</span><div class="bar-wrap"><div class="bar-fill '+(r._secFit>=70?'high':r._secFit>=40?'medium':'low')+'" style="width:'+(r._secFit||0)+'%"></div></div><span class="num">'+(r._secFit||0)+'%</span></div>';
      h+='<div class="ref-bar"><span class="label">句子重合</span><div class="bar-wrap"><div class="bar-fill '+drCl+'" style="width:'+dupRate+'%"></div></div><span class="num">'+dupRate+'%</span></div>';
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
      var sp={ch:r._chName||(chN[r.ch||1]||('第'+(r.ch||1)+'章')),sec:r._secName||'',sub:r._subName||'',ctx:r._ctx||''};
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
      h+='<div class="ref-bar"><span class="label">真实度</span><div class="bar-wrap"><div class="bar-fill '+cl+'" style="width:'+conf+'%"></div></div><span class="num">'+conf+'%</span></div>';
      h+='<div class="ref-bar"><span class="label">主题相关</span><div class="bar-wrap"><div class="bar-fill '+(r._topicRel>=70?'high':r._topicRel>=40?'medium':'low')+'" style="width:'+(r._topicRel||0)+'%"></div></div><span class="num">'+(r._topicRel||0)+'%</span></div>';
      h+='<div class="ref-bar"><span class="label">章节适配</span><div class="bar-wrap"><div class="bar-fill '+(r._secFit>=70?'high':r._secFit>=40?'medium':'low')+'" style="width:'+(r._secFit||0)+'%"></div></div><span class="num">'+(r._secFit||0)+'%</span></div>';
      h+='<div class="ref-bar"><span class="label">句子重合</span><div class="bar-wrap"><div class="bar-fill '+drCl+'" style="width:'+dupRate+'%"></div></div><span class="num">'+dupRate+'%</span></div>';
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
async function batchVerify(){var list=mergedRefs.length?mergedRefs:existingRefs;if(!list.length)return ttp('请先检索');showLoad('批量校验中...',0);var done=0,total=list.length;
  // 并发校验（每批4个）
  for(var bi=0;bi<total;bi+=4){
    var batch=list.slice(bi,Math.min(bi+4,total));
    var results=await Promise.all(batch.map(function(r){var title=r.title||'',jr=r.journal||'',yr=r.year||'';if(!title&&r.ci){var m=parseRefMeta(r.ci);title=m.title;jr=m.journal;yr=m.yr}if(!title&&r.ci){title=r.ci.replace(/\s+/g,' ').substring(0,100).replace(/^\[\d+\]\s*/,'').trim()}return verifyRef(title,jr,yr,r.doi||'');}));
    for(var ri=0;ri<batch.length;ri++){var r=batch[ri],v=results[ri];r.conf=v.score||Math.min(35,r.conf||0);if(v.doi&&!r.doi)r.doi=v.doi;r._citations=v.citations||0;r._retracted=v.retracted;r._verified=v.verified;r._pubType=v.pub_type;r._verifySource=v.source;done++;}
    updLoad('校验中 ('+done+'/'+total+')',Math.round(done/total*100));
  }
  hideLoad();if(mergedRefs.length)renderRefs();else renderExistingOnly();ttp('校验完成: '+total+'条');}

// INIT - this runs LAST, after all functions are defined
(function(){
  var fi=document.getElementById('fileInput');
  if(!fi)return;
  fi.addEventListener('change',async function(e){
    var f=e.target.files[0];if(!f)return;
    var ext=(f.name||'').toLowerCase().split('.').pop();
    if(ext!=='docx'){alert('不支持 .'+ext+', 请上传 .docx 文件');return}

    if(typeof mammoth==='undefined'){
      // Wait for mammoth to load (big file, may still be downloading)
      showLoad('等待Word解析库加载...',0);
      for(var retry=0;retry<30&&typeof mammoth==='undefined';retry++){
        await new Promise(function(rr){setTimeout(rr,500)});
        updLoad('等待库加载...',Math.min(100,retry*5));
      }
      hideLoad();
      if(typeof mammoth==='undefined'){alert('mammoth.browser.min.js 加载超时。请刷新页面后重试，或检查该文件是否在相同目录。');return}
    }
    if(typeof JSZip==='undefined'){alert('jszip.min.js 未加载。请检查文件是否在相同目录。');return}

    showLoad('解析中...',0);var buf;
    try{buf=await f.arrayBuffer()}catch(er2){hideLoad();alert('文件读取失败: '+er2.message);return}
    try{
    // 清空跨文件缓存
    searchCache={};mergedRefs=[];
    updLoad('解析正文...','10',f.name);
    var result=await mammoth.convertToHtml({arrayBuffer:buf});manuscriptHTML=result.value;manuscriptText=manuscriptHTML.replace(/<[^>]+>/g,'\n').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\n{3,}/g,'\n\n')
    document.getElementById('thesisBox').innerHTML=manuscriptHTML;

    updLoad('构建章节树...','35');
    var tree=null;try{tree=await parseDocxStructure(buf)}catch(er2){console.warn(er2)}
    if(tree)markAnchors(tree);
    sections=tree?tree.map(function(tc){return{ch:tc.ch,name:tc.name,text:manuscriptText,sections:tc.sections}}):[];
    if(sections.length&&tree)populateChapterText();
    if(!sections.length){var chMap={},re=/第([一-鿿\d]+)章/g,m;while((m=re.exec(manuscriptText))!==null){var d=cnDigit(m[1]);if(chMap[d])continue;var af=manuscriptText.substring(m.index+m[0].length);if(!af.startsWith('\n'))continue;if(/PAGEREF|HYPERLINK|_Toc/.test(af.substring(0,250)))continue;chMap[d]={dig:d,pos:m.index}};var chs=Object.values(chMap).sort(function(a,b){return a.pos-b.pos});sections=chs.map(function(hi,ii){var af2=manuscriptText.substring(hi.pos+2),nl=af2.indexOf('\n'),t=(nl>0?af2.substring(0,nl):af2.substring(0,50)).trim().replace(/\s*\d+\.\d+.*$/,'').trim();return{ch:hi.dig,name:'第'+hi.dig+'章 '+t,text:manuscriptText,sections:[]}})}

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
      var refBoundary=null,tw=document.createTreeWalker(box,NodeFilter.SHOW_ELEMENT,null,false),el2=tw.firstChild();
      while(el2){var t2=(el2.textContent||'').replace(/\s+/g,'');if(t2.indexOf('参考文献')===0&&/^(p|h[1-6]|div)$/i.test(el2.tagName||'')){refBoundary=el2;break}el2=tw.nextNode()}
      rawRefs.forEach(function(r){var n2=r.num,nf='['+n2+']',tw2=document.createTreeWalker(box,NodeFilter.SHOW_ELEMENT,null,false),el3=tw2.firstChild(),best=null;while(el3){var tag=(el3.tagName||'').toLowerCase();if(/^(p|li|h[1-6]|div|td)$/.test(tag)){var txt3=el3.textContent||'',mi=txt3.indexOf(nf);while(mi>=0){var ac=txt3[mi+nf.length]||'';if(!/\d/.test(ac))break;mi=txt3.indexOf(nf,mi+1)}if(mi>=0){if(refBoundary&&(el3.compareDocumentPosition(refBoundary)&Node.DOCUMENT_POSITION_FOLLOWING)){}else best=el3}}el3=tw2.nextNode()}if(best){r._domEl=best;r.ch=chapterForElement(best);
      // 保存原始段落文本，之后用此文本提取句子
      r._ctx=extractCtxBeforeMarker(best.textContent||'',r.num);
      var sp0=locateRefInRawDOM(best,r.num);
      r._chName=sp0.ch;r._secName=sp0.sec;r._subName=sp0.sub;
    }})
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
    }catch(err){console.error('Parse error:',err);hideLoad();alert('解析失败: '+err.message+'\n\n建议用Word另存为新的.docx后重试')}
    // 结构化面板放在try外面，出错不影响正文展示
    try{structureThesisBox();}catch(e){console.warn('[struct] 跳过结构化:',e.message);}
  });

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

  // 主题词标签列表（完整字符串，非bigram）
  var tpLabels=(paperTopics||[]).map(function(t){return t.label.toLowerCase()});
  var titleLower=(r.title||r.ci||'').toLowerCase();

  // ② 主题相关度: 论文主题标签在文献标题中的命中比例
  if(tpLabels.length>0){
    var h1=0;tpLabels.forEach(function(t){if(titleLower.indexOf(t)>=0)h1++;});
    r._topicRel=Math.min(100,Math.round(h1/Math.max(1,Math.min(tpLabels.length,10))*100));
  }else{r._topicRel=0;}

  // ③ 章节适配度: 论文主题标签在章内容中的命中比例
  if(r.ch&&tpLabels.length>0){
    var chObj=sections.find(function(s){return s.ch===r.ch});
    var chText=((chObj&&chObj.text)||manuscriptText||'').toLowerCase();
    var h2=0;tpLabels.forEach(function(t){if(chText.indexOf(t)>=0)h2++;});
    r._secFit=Math.min(100,Math.round(h2/Math.max(1,Math.min(tpLabels.length,10))*100));
  }else{r._secFit=0;}

  // ④ 句子重合度: 句子文本中命中的主题词 / 总主题词数
  if(opts&&opts.hasSentence){
    var ctxText=(r._ctx||'').toLowerCase();
    if(!ctxText&&r._domEl){
      try{
        var rawTxt=(r._domEl.parentElement?(r._domEl.parentElement.innerText||r._domEl.parentElement.textContent):(r._domEl.textContent||''))||'';
        ctxText=(extractCtxBeforeMarker(rawTxt,r.displayNum||r.num)||'').toLowerCase();
      }catch(e){ctxText=(r._ctx||'').toLowerCase();}
      r._ctx=ctxText;
    }
    if(ctxText&&tpLabels.length>0){
      var h3=0;tpLabels.forEach(function(t){if(ctxText.indexOf(t)>=0)h3++;});
      r._dupRate=Math.min(100,Math.round(h3/Math.max(1,Math.min(tpLabels.length,10))*100));
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

    // 加箭头icon
    var ar=document.createElement('span');
    ar.className='toggle-arrow open';ar.innerHTML='&#9654;';
    ar.style.cssText='display:inline-flex;align-items:center;margin-right:4px;font-size:.7rem;cursor:pointer;vertical-align:middle';
    el.insertBefore(ar,el.firstChild);
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
  existingRefs=[];mergedRefs=[];manuscriptText='';manuscriptHTML='';paperTopics=[];sections=[];
  document.getElementById('thesisBox').innerHTML='<i style="color:#9ca3af">论文原文将在此显示</i>';
  document.getElementById('navTree').innerHTML='<i style="color:var(--m);font-size:.7rem;padding:8px;display:block">请先上传论文</i>';
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
// ====== 交互式时间线（SVG，论文散点+标题悬停） ======
function renderTimeline(){
  var tc = document.getElementById('kgTimelineCanvas');
  if (!tc || kgCurrentView !== 'timeline') return;
  tc.style.display = 'block';

  var parent = tc.parentElement;
  var w = parent.clientWidth - 8, h = parent.clientHeight - 8;

  // Gather refs with year data
  var refs = (typeof mergedRefs !== 'undefined' && mergedRefs.length ? mergedRefs : (typeof existingRefs !== 'undefined' ? existingRefs : []))
    .filter(function(r) { return r.year && parseInt(r.year) >= 1990; })
    .map(function(r) { return { year: parseInt(r.year), title: (r.title || r.ci || '').substring(0, 60),
      journal: r.journal || '', type: r.subType || 'existing', displayNum: r.displayNum || 0, ch: r.ch || 1 }; });

  if (!refs.length) {
    tc.style.display = 'none';
    var tg = document.getElementById('kgGraphPanel');
    if (tg) tg.innerHTML = '<div style="text-align:center;padding:60px;color:#86868b"><div style="font-size:3rem;margin-bottom:16px">📅</div><div style="font-size:.9rem;font-weight:600;margin-bottom:6px">暂缺年份数据</div><div style="font-size:.75rem">文献需包含年份信息才能生成时间线。<br>建议在参考文献模块中检索或补全DOI以获取年份。</div></div>';
    return;
  }

  // Create SVG
  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', w); svg.setAttribute('height', h);
  svg.setAttribute('class','tl-svg');svg.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;background:#fafafa;border-radius:12px';

  var margin = { top: 50, right: 40, bottom: 70, left: 60 };
  var pw = w - margin.left - margin.right;
  var ph = h - margin.top - margin.bottom;

  // Year range
  var years = {}; refs.forEach(function(r) { years[r.year] = (years[r.year] || 0) + 1; });
  var yKeys = Object.keys(years).map(Number).sort(function(a, b) { return a - b; });
  var minY = yKeys[0], maxY = yKeys[yKeys.length - 1];
  var range = Math.max(1, maxY - minY);

  // Group by year for stacking dots
  var byYear = {}; refs.forEach(function(r) {
    if (!byYear[r.year]) byYear[r.year] = [];
    byYear[r.year].push(r);
  });

  // Colors
  var colors = { existing: '#0071e3', displaced: '#af52de', appended: '#30d158', unchanged: '#0071e3' };

  // Background
  var bg = document.createElementNS(svgNS, 'rect');
  bg.setAttribute('width', w); bg.setAttribute('height', h);
  bg.setAttribute('fill', '#fafafa'); bg.setAttribute('rx', '12');
  svg.appendChild(bg);

  // Title
  var titleEl = document.createElementNS(svgNS, 'text');
  titleEl.setAttribute('x', margin.left); titleEl.setAttribute('y', 28);
  titleEl.setAttribute('font-size', '13'); titleEl.setAttribute('font-weight', '700');
  titleEl.setAttribute('fill', '#1d1d1f'); titleEl.textContent = '📅 文献时间线';
  svg.appendChild(titleEl);

  var subEl = document.createElementNS(svgNS, 'text');
  subEl.setAttribute('x', margin.left); subEl.setAttribute('y', 44);
  subEl.setAttribute('font-size', '10'); subEl.setAttribute('fill', '#86868b');
  subEl.textContent = refs.length + ' 篇文献 · ' + minY + '–' + maxY + ' · 🖱 悬停查看详情';
  svg.appendChild(subEl);

  // Grid lines
  for (var yr = minY; yr <= maxY; yr++) {
    var gx = margin.left + (yr - minY) / range * pw;
    var line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', gx); line.setAttribute('y1', margin.top);
    line.setAttribute('x2', gx); line.setAttribute('y2', margin.top + ph);
    line.setAttribute('stroke', yr % 5 === 0 ? '#d1d1d6' : '#e8e8ed');
    line.setAttribute('stroke-width', yr % 5 === 0 ? '1.5' : '0.5');
    svg.appendChild(line);

    if (yr % Math.max(1, Math.floor(range / 12)) === 0 || yr === minY || yr === maxY) {
      var label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', gx); label.setAttribute('y', margin.top + ph + 16);
      label.setAttribute('text-anchor', 'middle'); label.setAttribute('font-size', '11');
      label.setAttribute('fill', '#86868b'); label.setAttribute('font-weight', '500');
      label.textContent = yr;
      svg.appendChild(label);
    }
  }

  // Year groups as vertical columns
  var colW = Math.min(50, pw / Math.max(1, yKeys.length));

  // Draw count bars
  yKeys.forEach(function(yr, yi) {
    var bx = margin.left + (yr - minY) / range * pw - colW / 2;
    var cnt = years[yr];
    var bh = Math.max(8, (cnt / Math.max(1, Object.values(years).reduce(function(a,b){return Math.max(a,b);},0))) * ph * 0.7);
    var bar = document.createElementNS(svgNS, 'rect');
    bar.setAttribute('x', bx); bar.setAttribute('y', margin.top + ph - bh);
    bar.setAttribute('width', Math.max(4, colW - 4)); bar.setAttribute('height', bh);
    bar.setAttribute('fill', '#0071e3'); bar.setAttribute('opacity', '0.18');
    bar.setAttribute('rx', '4');
    svg.appendChild(bar);

    var cntLabel = document.createElementNS(svgNS, 'text');
    cntLabel.setAttribute('x', bx + Math.max(4, colW - 4) / 2);
    cntLabel.setAttribute('y', margin.top + ph - bh - 6);
    cntLabel.setAttribute('text-anchor', 'middle'); cntLabel.setAttribute('font-size', '10');
    cntLabel.setAttribute('fill', '#86868b'); cntLabel.setAttribute('font-weight', '600');
    if (cnt > 1) cntLabel.textContent = cnt + '篇';
    svg.appendChild(cntLabel);
  });

  // Paper dots and hidden detail panels
  var tooltip = document.createElementNS(svgNS, 'g');
  tooltip.setAttribute('id', 'kgTimelineTooltip');
  tooltip.setAttribute('visibility', 'hidden');
  svg.appendChild(tooltip);

  var ttBg = document.createElementNS(svgNS, 'rect');
  ttBg.setAttribute('fill', 'rgba(30,30,32,0.95)'); ttBg.setAttribute('rx', '8');
  tooltip.appendChild(ttBg);
  var ttTitle = document.createElementNS(svgNS, 'text');
  ttTitle.setAttribute('fill', '#fff'); ttTitle.setAttribute('font-size', '11'); ttTitle.setAttribute('font-weight', '600');
  tooltip.appendChild(ttTitle);
  var ttMeta = document.createElementNS(svgNS, 'text');
  ttMeta.setAttribute('fill', '#a1a1aa'); ttMeta.setAttribute('font-size', '10');
  tooltip.appendChild(ttMeta);
  var ttRef = document.createElementNS(svgNS, 'text');
  ttRef.setAttribute('fill', '#fbbf24'); ttRef.setAttribute('font-size', '9');
  tooltip.appendChild(ttRef);

  // Draw each paper
  refs.forEach(function(r, ri) {
    var yrCols = byYear[r.year];
    var idxInYear = yrCols.indexOf(r);
    var stackH = Math.min(18, ph / Math.max(1, yrCols.length) - 2);
    var dotR = Math.max(4, Math.min(8, stackH / 2 - 2));
    var numPerCol = Math.ceil(yrCols.length / Math.max(1, Math.floor(colW / (dotR * 2.5))));
    var col = Math.floor(idxInYear / Math.max(1, numPerCol));
    var row = idxInYear % Math.max(1, numPerCol);
    var dotX = margin.left + (r.year - minY) / range * pw - colW / 2 + col * (dotR * 3) + dotR + 2;
    var dotY = margin.top + ph - 10 - stackH + row * (dotR * 2.2) + dotR;

    var dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', dotX); dot.setAttribute('cy', dotY);
    dot.setAttribute('r', dotR);
    var cl = r.type === 'appended' ? '#30d158' : (r.type === 'displaced' ? '#af52de' : '#0071e3');
    dot.setAttribute('fill', cl); dot.setAttribute('opacity', '0.8');
    dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', '1');
    dot.setAttribute('cursor', 'pointer');
    dot.setAttribute('data-idx', ri);
    dot.setAttribute('class', 'kg-tl-dot');

    dot.addEventListener('mouseenter', function(ev) {
      var i = parseInt(this.getAttribute('data-idx'));
      var rr = refs[i];
      var lines = [];
      if (rr.title) {
        var t = rr.title;
        while (t.length > 30) { lines.push(t.substring(0, 30)); t = t.substring(30); }
        lines.push(t);
      }
      ttTitle.textContent = lines[0] || '';
      ttMeta.textContent = (rr.journal ? rr.journal + ' · ' : '') + rr.year;
      ttRef.textContent = rr.displayNum ? '编号 [' + rr.displayNum + ']' : '';

      var tx = dotX + 12, ty = dotY - 10;
      if (tx + 220 > w) tx = dotX - 220;
      if (ty < 10) ty = dotY + 20;
      ttBg.setAttribute('x', tx - 8); ttBg.setAttribute('y', ty - 8);
      ttBg.setAttribute('width', Math.max(200, (ttTitle.textContent.length * 7 + 40)));
      ttBg.setAttribute('height', 56);
      ttTitle.setAttribute('x', tx); ttTitle.setAttribute('y', ty + 6);
      ttMeta.setAttribute('x', tx); ttMeta.setAttribute('y', ty + 22);
      ttRef.setAttribute('x', tx); ttRef.setAttribute('y', ty + 38);
      tooltip.setAttribute('visibility', 'visible');
      this.setAttribute('r', dotR + 3);
      this.setAttribute('stroke', '#fbbf24'); this.setAttribute('stroke-width', '2');
    });

    dot.addEventListener('mouseleave', function() {
      tooltip.setAttribute('visibility', 'hidden');
      this.setAttribute('r', dotR);
      this.setAttribute('stroke', '#fff'); this.setAttribute('stroke-width', '1');
    });

    svg.appendChild(dot);
  });

  // Legend
  var legX = margin.left, legY = h - 26;
  [{l: '原文文献', c: '#0071e3'}, {l: '顺延文献', c: '#af52de'}, {l: '新增文献', c: '#30d158'}].forEach(function(item, i) {
    var lx = legX + i * 100;
    var c2 = document.createElementNS(svgNS, 'circle');
    c2.setAttribute('cx', lx); c2.setAttribute('cy', legY); c2.setAttribute('r', '5');
    c2.setAttribute('fill', item.c); svg.appendChild(c2);
    var lt = document.createElementNS(svgNS, 'text');
    lt.setAttribute('x', lx + 10); lt.setAttribute('y', legY + 4);
    lt.setAttribute('font-size', '10'); lt.setAttribute('fill', '#86868b');
    lt.textContent = item.l; svg.appendChild(lt);
  });

  // Clear old timeline SVG
  var oldTl = document.querySelector('#kgGraphPanel > svg.tl-svg');
  if (oldTl) oldTl.parentElement.removeChild(oldTl);
  // Hide network SVG and placeholder, show timeline SVG
  var svEl = document.getElementById('kgSvg');
  if (svEl) svEl.style.display = 'none';
  var ph = document.getElementById('kgPlaceholder');
  if (ph) ph.style.display = 'none';
  tc.style.display = 'none';
  var tg = document.getElementById('kgGraphPanel');
  if (tg) tg.appendChild(svg);
}

// ====== 高亮节点（双向联动） ======
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
    h+='<p style="color:#94a3b8;font-size:.75rem;margin-top:40px">由 论文AI利器 自动生成</p></body></html>';
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