(() => {
  const steps = [
    ['build','建檔','Record','Tạo hồ sơ','CM'],
    ['spa','SPA 技包收到','SPA package','Nhận tài liệu SPA','CM'],
    ['rfc','RFC 確認','RFC confirmed','Xác nhận RFC','CM'],
    ['trial','客戶試作','Customer trial','Thử mẫu khách hàng','CM'],
    ['confirm','客戶確認','Customer approval','Khách hàng xác nhận','CM'],
    ['pfc','ZZ 版 PFC 上傳','ZZ PFC upload','Tải ZZ PFC','CM'],
    ['ipw','IPW','IPW','IPW','CM'],
    ['material','材料就緒','Material ready','Vật tư sẵn sàng','資材'],
    ['chemical','化工上線','Chemical start','Bắt đầu hóa công','生管'],
    ['forming','成型上線 CCW','Forming CCW','Gò đế CCW','生管']
    ,['buy','BUY DATE','Buy date','Ngày mua','生管']
    ,['mbom','MBOM 確認日','MBOM confirmed','Xác nhận MBOM','生管']
    ,['cutting','裁管上線日','Cutting start','Ngày lên chuyền cắt','生管']
    ,['second','二加上線日','Second assembly start','Ngày lên chuyền 2','生管']
    ,['stitching','針車上線日','Stitching start','Ngày lên chuyền may','生管']
    ,['cqc','前導 CQC 上線日','Pilot CQC start','Ngày CQC chạy thử','成型']
  ];
  const tr = (zh,en,vi) => uiLang === 'en' ? en : uiLang === 'vi' ? vi : zh;
  const fmt = v => /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(v || '') ? v.replaceAll('/','-') : '';
  function inferred(project, step) {
    if (step[0] === 'build') return {date:fmt(project.createdAt?.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/)?.[0]), source:'MRC'};
    if (step[0] === 'forming' && fmt(project.launch)) return {date:fmt(project.launch), source:'PM'};
    const names={spa:/SPA|技包/i,rfc:/RFC/i,trial:/試作|試做|trial/i,confirm:/客戶確認|customer approval/i,pfc:/PFC/i,ipw:/IPW/i,material:/材料|採購|到料/i,chemical:/化工|底加/i,forming:/成型|CCW/i,buy:/BUY DATE|購買日|採購日/i,mbom:/MBOM/i,cutting:/裁管|裁斷/i,second:/二加/i,stitching:/針車/i,cqc:/前導|CQC/i};
    const unit=step[4],items=(project.items||[]).filter(item=>item.unit===unit || (unit==='生管'&&item.unit==='廠務'));
    const matches=items.filter(item=>names[step[0]]?.test([item.zh,item.vi,item.en,item.response,item.note].join(' ')));
    for(const item of matches){const text=[item.response,item.note,...(item.history||[]).map(h=>h.note)].join(' ');const date=fmt(item.actualDate)||fmt(item.targetDate)||fmt(text.match(/20\d{2}[/-]\d{1,2}[/-]\d{1,2}/)?.[0]);if(date)return {date,source:item.unit+' · '+item.id,planned:!item.actualDate}}
    const assignment=(project.assignments||[]).find(a=>a.assignee===unit&&fmt(a.due));
    return assignment ? {date:fmt(assignment.due),source:unit+' · '+tr('指定期限','Due date','Hạn được giao'),planned:true} : {date:'',source:''};
  }
  function values(project){return steps.map(step=>{const entered=fmt(project.timeline?.[step[0]]);return {...step,date:entered||inferred(project,step).date,source:entered?'CM':inferred(project,step).source,planned:!entered&&inferred(project,step).planned}})}
  function timelineFields(project){return `<div class="timelineForm">${values(project).map(e=>`<label>${esc(tr(e[1],e[2],e[3]))} · ${esc(e[4])}<input type="date" data-timeline="${e[0]}" value="${esc(fmt(project.timeline?.[e[0]])||e.date)}"><small>${esc(e.source||'—')}</small></label>`).join('')}<label class="timelineNoteLabel">${tr('生管 · 派工與上線節點備註','Production planning · Dispatch and launch notes','Kế hoạch sản xuất · Ghi chú phân công và lên chuyền')}<textarea id="timelineNote" rows="3">${esc(project.timelineNote||'')}</textarea></label></div>`}
  function timeline(project){const events=values(project),known=events.filter(e=>e.date).length;return `<section class="modelTimeline"><div class="modelTimelineTitle"><b>${tr('主時程門檻','Model timeline','Mốc tiến độ chính')}</b><small>${known}/${events.length}</small><button type="button" data-timeline-edit="${esc(project.id)}">${tr('維護時程','Edit dates','Cập nhật mốc')}</button></div><div class="timelineRail">${events.map(e=>`<div class="timelineNode ${e.date?'hasDate':'missing'}"><span class="timelineDot"></span><b>${esc(tr(e[1],e[2],e[3]))}</b><time>${esc(e.date||'—')}</time><small>${esc(e.source||tr('待確認','Pending','Chờ xác nhận'))}${e.planned?' · '+tr('規劃','Planned','Kế hoạch'):''}</small></div>`).join('')}</div></section>`}
  const originalPost=postHtml;
  postHtml=post=>{const project=readinessProjects.find(p=>p.postId===post.id);if(!project)return originalPost(post);return originalPost(post).replace('<div class="actions">',timeline(project)+'<div class="actions">')};
  const originalForm=openReadyForm;
  openReadyForm=()=>{originalForm();const grid=document.querySelector('#modalContent .grid2');if(grid)grid.insertAdjacentHTML('beforeend',`<div class="field"><label>${tr('成型上線 CCW','Forming CCW','Gò đế CCW')}</label><input type="date" data-new-timeline="forming"></div><div class="field"><label>IPW</label><input type="date" data-new-timeline="ipw"></div>`)};
  const submit=document.querySelector('#submitModal');const previousSubmit=submit.onclick;
  submit.onclick=()=>{
    if(modalMode.startsWith('readiness-detail:')){const project=readinessProjects.find(p=>p.id===modalMode.slice(17));if(project){project.timeline={...(project.timeline||{}),...Object.fromEntries([...document.querySelectorAll('.readyInlineTimeline [data-timeline]')].map(input=>[input.dataset.timeline,input.value]))};project.timelineNote=document.querySelector('.readyInlineTimeline #timelineNote')?.value||project.timelineNote||'';}}
    if(modalMode==='timeline-edit'){
      const project=readinessProjects.find(p=>p.id===document.querySelector('#timelineForm')?.dataset.project);
      if(!project)return;project.timeline=Object.fromEntries([...document.querySelectorAll('[data-timeline]')].map(input=>[input.dataset.timeline,input.value]));project.timelineNote=document.querySelector('#timelineNote')?.value.trim()||'';
      readyPersist();close();render();return;
    }
    const creating=modalMode==='readiness-new';const ids=new Set(readinessProjects.map(p=>p.id));const entered=creating?Object.fromEntries([...document.querySelectorAll('[data-new-timeline]')].map(input=>[input.dataset.newTimeline,input.value])):null;
    previousSubmit();if(creating){const project=readinessProjects.find(p=>!ids.has(p.id));if(project){project.timeline=entered;readyPersist();render()}}
  };
  document.addEventListener('click',event=>{const button=event.target.closest('[data-timeline-edit]');if(!button)return;const project=readinessProjects.find(p=>p.id===button.dataset.timelineEdit);if(!project)return;
    modal(tr('主時程門檻','Model timeline','Mốc tiến độ chính'),`<div id="timelineForm" data-project="${esc(project.id)}">${timelineFields(project)}</div>`,'timeline-edit')});
  document.addEventListener('click',event=>{const button=event.target.closest('[data-task]');if(!button)return;const post=posts.find(p=>p.id===button.dataset.post),project=readinessProjects.find(p=>p.postId===post?.id),unit=post?.assignments?.[Number(button.dataset.task)]?.assignee;if(!project||!unit)return;event.preventDefault();event.stopImmediatePropagation();openReadyDetail(project.id,unit)},true);
  const priorPanel=renderReadyUnitPanel;
  renderReadyUnitPanel=(project,unit)=>{priorPanel(project,unit);if(unit!=='生管')return;const panel=document.querySelector('#readyUnitPanel');if(!panel)return;panel.insertAdjacentHTML('afterbegin',`<label class="timelineUnitNote">${tr('派工與上線節點備註','Dispatch and launch notes','Ghi chú phân công và lên chuyền')}<textarea rows="3" id="readyTimelineNote">${esc(project.timelineNote||'')}</textarea></label>`);panel.querySelector('#readyTimelineNote').oninput=e=>{project.timelineNote=e.target.value;project._dirty=(project._dirty||0)+1}};
  const priorDetail=openReadyDetail;
  openReadyDetail=(id,unit)=>{priorDetail(id,unit);const project=readinessProjects.find(p=>p.id===id),shell=document.querySelector('.readyWorkspaceShell');if(!project||!shell)return;shell.querySelector('.notice')?.insertAdjacentHTML('afterend',`<details class="readyInlineTimeline"><summary>${tr('主時程門檻 · 維護所有時程','Model timeline · Edit all dates','Mốc tiến độ · Cập nhật tất cả')}</summary>${timelineFields(project)}</details>`)};
  const priorReadiness=renderReadiness;
  renderReadiness=()=>{priorReadiness();document.querySelectorAll('[data-ready-detail]').forEach(button=>{const project=readinessProjects.find(p=>p.id===button.dataset.readyDetail);if(!project)return;button.insertAdjacentHTML('beforebegin',`<button class="quick readyTimelineShortcut" type="button" data-ready-timeline="${esc(project.id)}">${tr('維護時程門檻','Edit timeline','Cập nhật tiến độ')} →</button>`)})};
  const priorRender=render;
  render=()=>{priorRender();const box=document.querySelector('#priority');if(!box)return;const projects=[...readinessProjects].reverse().slice(0,4);const notices=projects.map(p=>`<button type="button" class="mrcPriority" data-priority-ready="${esc(p.id)}"><b>${esc(p.model)} · ${esc(p.color)}</b><span>MRC ${tr('型體就緒 · 新建與維護','Readiness · New and updates','Sẵn sàng · Mới và cập nhật')}</span></button>`).join('');box.insertAdjacentHTML('afterbegin',notices)};
  document.addEventListener('click',event=>{const ready=event.target.closest('[data-priority-ready]');if(ready){openReadyDetail(ready.dataset.priorityReady);return}const shortcut=event.target.closest('[data-ready-timeline]');if(shortcut){const project=readinessProjects.find(p=>p.id===shortcut.dataset.readyTimeline);if(project)modal(tr('主時程門檻','Model timeline','Mốc tiến độ chính'),`<div id="timelineForm" data-project="${esc(project.id)}">${timelineFields(project)}</div>`,'timeline-edit')}});
  render();
})();
