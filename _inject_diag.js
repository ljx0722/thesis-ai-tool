var fs=require('fs');
var c=fs.readFileSync('app.js','utf8');

var marker='    // === 标题层级校准弹窗 ===';
var diag=[
'',
'    // ====== 诊断：打印所有扫描到的文本 ======',
"    console.groupCollapsed('[diag] All body elements scanned');",
"    var allEls4=box.querySelectorAll('p,h1,h2,h3,h4,h5,h6');",
"    for(var di=0;di<Math.min(allEls4.length,60);di++){",
"      var dt=(allEls4[di].textContent||'').trim();",
"      var tg=(allEls4[di].tagName||'').toLowerCase();",
"      if(dt&&dt.length>1&&dt.length<120){",
"        var isCH=/^第/.test(dt);",
"        var isSEC=/^\\d+\\./.test(dt);",
"        var tags=isCH?'CH ':(isSEC?'SEC ':'   ');",
"        console.log(di,tags,'<'+tg+'>',dt.substring(0,80));",
"      }",
"    }",
"    console.groupEnd();",
"    console.log('[diag] headingCandidates:',headingCandidates.length,'pastCh1:',pastCh1,'refBound:',!!refBound);",
"    var lvls={'-1':0,'0':0,'1':0,'2':0};headingCandidates.forEach(function(h){lvls[h.level]=(lvls[h.level]||0)+1;});",
"    console.log('[diag] level breakdown:',JSON.stringify(lvls));",
'',
'    // === 标题层级校准弹窗 ===',
].join('\n');

c=c.replace(marker,diag);
fs.writeFileSync('app.js',c,'utf8');
console.log('Diagnostic injected at',c.indexOf('console.groupCollapsed'));
