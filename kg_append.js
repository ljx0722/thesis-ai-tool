// 兼容旧调用：clearAll 委托到 changeThesis 逻辑，避免重复维护
function clearAll(){
  if(typeof changeThesis==='function'){
    if(!confirm('确定要清空所有数据吗？这将重置文献检索结果。'))return;
    // changeThesis 会弹上传遮罩；这里只重置状态
    existingRefs=[];mergedRefs=[];manuscriptText='';manuscriptHTML='';paperTopics=[];sections=[];
    _thesisLoaded=false;
    var tb=document.getElementById('thesisBox');
    if(tb){
      var ws=document.getElementById('workspaceContent');
      if(ws){ Array.prototype.forEach.call(tb.children,function(ch){ if(ch!==ws) ch.style.display='none'; }); ws.style.display=''; }
      else tb.innerHTML='<div id="workspaceContent" class="workspace-content"><div class="workspace-hero"><div class="workspace-icon">📋</div><h2 class="workspace-title">欢迎使用论文搭子 ThesisBuddy</h2><p class="workspace-sub">从想法到答辩，继续你的论文全流程</p></div></div>';
    }
    var nt=document.getElementById('navTree'); if(nt) nt.innerHTML='<i style="color:var(--m);font-size:.7rem;padding:8px;display:block">请先上传论文</i>';
    var refs=document.getElementById('refs'); if(refs) refs.innerHTML='<div style="text-align:center;padding:60px;color:#9ca3af;font-size:.82rem">← 请先上传论文</div>';
    var kw=document.getElementById('kwBar'); if(kw) kw.style.display='none';
    var sb=document.getElementById('statusBar'); if(sb) sb.innerHTML='等待上传论文…';
    var us=document.getElementById('upStatus'); if(us) us.innerHTML='等待上传';
    if(typeof updateDashboard==='function') updateDashboard([]);
    if(typeof updateNavStates==='function') updateNavStates();
    if(typeof ttp==='function') ttp('已清空');
    return;
  }
  if(!confirm('确定要清空所有数据吗？这将重置文献检索结果。'))return;
  existingRefs=[];mergedRefs=[];manuscriptText='';manuscriptHTML='';paperTopics=[];sections=[];
  document.getElementById('thesisBox').innerHTML='<i style="color:#9ca3af">论文原文将在此显示</i>';
  document.getElementById('navTree').innerHTML='<i style="color:var(--m);font-size:.7rem;padding:8px;display:block">请先上传论文</i>';
  document.getElementById('refs').innerHTML='<div style="text-align:center;padding:60px;color:#9ca3af;font-size:.82rem">← 请先上传论文</div>';
  document.getElementById('kwBar').style.display='none';
  document.getElementById('statusBar').innerHTML='等待上传论文…';document.getElementById('upStatus').innerHTML='等待上传';
  if(typeof updateDashboard==='function') updateDashboard([]);
  if(typeof ttp==='function') ttp('已清空');
}
