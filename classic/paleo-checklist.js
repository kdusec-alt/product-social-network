(() => {
  const $ = selector => document.querySelector(selector);
  const storageKey = 'mrcChecklistTemplatesV1';
  const units = checklist.map(row => row[0]);
  $('#legacyArea').insertAdjacentHTML('afterend','<section id="checklistAdminArea" class="checklistAdminArea"></section>');
  const navButton=document.createElement('button');navButton.dataset.view='checklist-admin';$('#nav').append(navButton);
  let selectedUnit = units[0];
  let editingId = '';
  let serverUser = null;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') for (const unit of units) {
      if (Array.isArray(saved[unit])) readinessTemplates[unit] = saved[unit].filter(item => item && typeof item.id === 'string');
    }
  } catch {}

  function manager() { return serverUser?.role === 'admin' || serverUser?.unit === 'PM'; }
  function canEdit(unit) { return !!serverUser && (manager() || serverUser.unit === unit); }
  function wording(zh, en, vi) { return uiLang === 'en' ? en : uiLang === 'vi' ? vi : zh; }
  function saveTemplates() {
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(units.map(unit => [unit, readinessTemplates[unit] || []]))));
    readyPersist();
  }
  async function persistUnit(unit, items) {
    const response = await fetch('/api/checklist-templates', {method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({unit,items})});
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(result.error || '無法儲存檢核項目');
  }
  function syncProjects(unit, next, previous, remove = false) {
    for (const project of readinessProjects) {
      const items = projectItems(project);
      if (!items.some(item => item.unit === unit) && !readyAssignments(project).some(a => a.assignee === unit)) continue;
      if (remove) project.items = items.filter(item => !(item.unit === unit && item.id === previous.id));
      else if (previous) {
        project.items = items;
        for (const item of project.items.filter(item => item.unit === unit && item.id === previous.id)) {
          Object.assign(item, {zh:next.zh, vi:next.vi, en:next.en, dimension:next.dimension, owners:next.owners, targetRule:next.targetRule});
        }
      } else if (!items.some(item => item.unit === unit && item.id === next.id)) {
        project.items = [...items, {...next, unit, status:'pending', response:'', due:'', updated:'', updatedBy:''}];
      }
    }
  }
  function nextId(unit) {
    const used = new Set((readinessTemplates[unit] || []).map(item => item.id));
    let number = 1;
    while (used.has(`${unit}-${String(number).padStart(2,'0')}`)) number++;
    return `${unit}-${String(number).padStart(2,'0')}`;
  }
  function fixNav() {
    const labels = {
      feed:['▣　動態牆','▣　Feed','▣　Bảng tin'], members:['♙　成員名單','♙　Members','♙　Danh sách thành viên'],
      mine:['◎　我的待辦','◎　My tasks','◎　Việc của tôi'], knowledge:['▤　產品問題知識庫','▤　Product knowledge base','▤　Cơ sở tri thức sản phẩm'],
      models:['▤　型體總覽','▤　Models','▤　Tổng quan mã giày'], meeting:['▣　會議模式','▣　Meeting','▣　Cuộc họp'],
      legacy:['▦　原有檢核入口','▦　Original checklist','▦　Kiểm tra cũ'],
      'checklist-admin':['▦　MRC 檢核項目','▦　MRC checklist items','▦　Mục kiểm tra MRC']
    };
    $('#nav')?.querySelectorAll('[data-view]').forEach(button => {
      const key = button.dataset.view, label = labels[key];
      if (!label) return;
      const count = key === 'mine' ? button.querySelector('.count')?.textContent || '0' : '';
      button.innerHTML = label[uiLang === 'en' ? 1 : uiLang === 'vi' ? 2 : 0] + (key === 'mine' ? ` <span class="count" id="mineCount">${esc(count)}</span>` : '');
    });
    if (view === 'checklist-admin') $('#pageTitle').textContent = wording('MRC 檢核項目','MRC checklist items','Mục kiểm tra MRC');
    if (view === 'members') $('#pageTitle').textContent = wording('成員名單','Members','Danh sách thành viên');
  }
  function renderAdmin() {
    const area = $('#checklistAdminArea');
    if (!area || view !== 'checklist-admin') return;
    const items = readinessTemplates[selectedUnit] || [];
    const projects = readinessProjects.filter(project => projectItems(project).some(item => item.unit === selectedUnit));
    area.innerHTML = `<div class="checklistAdmin card"><h2>${wording('MRC 檢核項目','MRC checklist items','Mục kiểm tra MRC')}</h2><div class="checklistUnits">${units.map(unit => `<button type="button" data-check-unit="${esc(unit)}" class="${selectedUnit === unit ? 'active' : ''}">${esc(unit)} · ${(readinessTemplates[unit] || []).length}</button>`).join('')}</div><div class="checklistToolbar"><h3>${esc(selectedUnit)} · ${esc(checklist.find(row => row[0] === selectedUnit)?.[1] || '')}</h3>${canEdit(selectedUnit) ? `<button class="quick" type="button" data-check-add>＋ ${wording('新增檢核項目','Add item','Thêm mục')}</button>` : ''}</div><div class="checklistItems">${items.map(item => `<div class="checklistItem"><div><b>${esc(item.id)}</b><span>${esc(templateItemText(item))}</span><small>${esc(item.owners || '')}　${esc(item.targetRule || '')}</small></div>${canEdit(selectedUnit) ? `<button type="button" data-check-edit="${esc(item.id)}">${wording('編輯','Edit','Sửa')}</button><button type="button" data-check-remove="${esc(item.id)}">${wording('刪除','Remove','Xóa')}</button>` : ''}</div>`).join('') || `<p>${wording('目前沒有檢核項目','No checklist items','Chưa có mục kiểm tra')}</p>`}</div><h3>${wording('使用此單位檢核的型體','Models using this checklist','Mã giày dùng danh sách này')}</h3><div class="checklistProjects">${projects.map(project => `<button type="button" data-check-project="${esc(project.id)}">${esc(project.model)} / ${esc(project.color)} →</button>`).join('') || `<p>${wording('目前沒有型體','No models yet','Chưa có mã giày')}</p>`}</div></div>`;
  }
  function form(item) {
    editingId = item?.id || '';
    modal(editingId ? wording('編輯檢核項目','Edit checklist item','Sửa mục kiểm tra') : wording('新增檢核項目','Add checklist item','Thêm mục kiểm tra'), `<div class="checklistForm"><p>${esc(selectedUnit)} · ${esc(item?.id || nextId(selectedUnit))}</p><label>${wording('檢核內容','Checklist item','Nội dung kiểm tra')}<textarea id="checkTitle" required>${esc(item?.zh || '')}</textarea></label><label>${wording('越文','Vietnamese','Tiếng Việt')}<textarea id="checkVi">${esc(item?.vi || '')}</textarea></label><label>${wording('英文','English','Tiếng Anh')}<textarea id="checkEn">${esc(item?.en || '')}</textarea></label><label>${wording('權責','Owner','Phụ trách')}<input id="checkOwner" value="${esc(item?.owners || '')}"></label><label>${wording('目標日規則','Target date rule','Quy tắc ngày mục tiêu')}<input id="checkTarget" value="${esc(item?.targetRule || '')}"></label><label>${wording('分類','Category','Phân loại')}<input id="checkDimension" value="${esc(item?.dimension || '')}"></label></div>`, 'checklist-template');
    $('#submitModal').textContent = wording('儲存項目','Save item','Lưu mục');
  }
  document.addEventListener('click', async event => {
    const unitButton = event.target.closest('[data-check-unit]');
    if (unitButton) { selectedUnit = unitButton.dataset.checkUnit; renderAdmin(); return; }
    const projectButton = event.target.closest('[data-check-project]');
    if (projectButton) { openReadyDetail(projectButton.dataset.checkProject, selectedUnit); return; }
    if (view !== 'checklist-admin' || !canEdit(selectedUnit)) return;
    if (event.target.closest('[data-check-add]')) { form(null); return; }
    const edit = event.target.closest('[data-check-edit]');
    if (edit) { const item = (readinessTemplates[selectedUnit] || []).find(x => x.id === edit.dataset.checkEdit); if (item) form(item); return; }
    const remove = event.target.closest('[data-check-remove]');
    if (remove) {
      const items = readinessTemplates[selectedUnit] || [], item = items.find(x => x.id === remove.dataset.checkRemove);
      if (!item || !window.confirm(`${wording('刪除','Remove','Xóa')} ${item.id}？`)) return;
      const nextItems=items.filter(x => x.id !== item.id);
      try { await persistUnit(selectedUnit,nextItems); } catch(error) { toast(error.message); return; }
      readinessTemplates[selectedUnit] = nextItems;
      syncProjects(selectedUnit, null, item, true); saveTemplates(); render();
    }
  });
  const oldSubmit = $('#submitModal').onclick;
  $('#submitModal').onclick = async () => {
    if (modalMode !== 'checklist-template') return oldSubmit();
    if (!canEdit(selectedUnit)) return toast('權限不足');
    const zh = $('#checkTitle').value.trim();
    if (!zh) { $('#checkTitle').focus(); return; }
    const items = readinessTemplates[selectedUnit] || [], previous = items.find(x => x.id === editingId);
    const next = { ...(previous || {}), id:previous?.id || nextId(selectedUnit), zh, vi:$('#checkVi').value.trim() || zh, en:$('#checkEn').value.trim() || zh, owners:$('#checkOwner').value.trim(), targetRule:$('#checkTarget').value.trim(), dimension:$('#checkDimension').value.trim(), source:zh };
    const nextItems=items.map(item=>item.id===previous?.id?next:item);
    if (!previous) nextItems.push(next);
    try { await persistUnit(selectedUnit,nextItems); } catch(error) { toast(error.message); return; }
    readinessTemplates[selectedUnit] = nextItems;
    syncProjects(selectedUnit, next, previous); saveTemplates(); close(); render();
  };
  const oldRender = render;
  render = () => { oldRender();const admin=view==='checklist-admin';$('#checklistAdminArea').classList.toggle('show',admin);if(admin){$('#feedArea').style.display='none';$('#summary').style.display='none';$('#newPost').style.display='none';for(const id of ['readinessArea','modelsArea','meetingArea'])document.getElementById(id)?.classList.remove('show');$('#nav').querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view==='checklist-admin'))}fixNav();renderAdmin(); };
  render();
  Promise.all([fetch('/api/me',{credentials:'same-origin'}),fetch('/api/checklist-templates',{credentials:'same-origin'})]).then(async ([auth,templateResponse])=>{
    if(!auth.ok||!templateResponse.ok)return;
    serverUser=(await auth.json()).user;
    const templates=await templateResponse.json();
    for(const unit of units)if(Array.isArray(templates[unit]))readinessTemplates[unit]=templates[unit];
    saveTemplates();render();
  }).catch(()=>{});
})();
