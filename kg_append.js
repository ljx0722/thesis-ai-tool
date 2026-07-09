
// 清空所有数据
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
