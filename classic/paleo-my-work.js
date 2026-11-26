// Additive personal work dashboard. The existing My Tasks feed and reply flows remain intact.
(() => {
  const panel = document.createElement('section');
  panel.id = 'myWorkHome';
  panel.className = 'myWorkHome';
  panel.setAttribute('aria-live', 'polite');
  const feed = document.querySelector('#feedArea');
  if (!feed) return;
  feed.insertBefore(panel, feed.firstChild);

  const text = (zh, en, vi) => uiLang === 'en' ? en : uiLang === 'vi' ? vi : zh;
  const done = status => ['done', 'closed', 'na'].includes(String(status || '').toLowerCase());
  const dateValue = value => {
    const match = String(value || '').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!match) return null;
    const [, year, month, day] = match;
    const parsed = Date.UTC(Number(year), Number(month) - 1, Number(day));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const today = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get = type => parts.find(part => part.type === type)?.value;
    return Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')));
  };
  const ownAuthor = post => {
    const author = String(post.author || '');
    return !!activeUser && (author === activeUser.name || author.startsWith(activeUser.name + ' ·') || author === activePersona);
  };
  function collect() {
    const owned = [], waiting = [];
    const readyPostIds = new Set((readinessProjects || []).map(project => project.postId).filter(Boolean));
    for (const project of readinessProjects || []) {
      const items = typeof projectItems === 'function' ? projectItems(project) : project.items || [];
      for (const item of items) {
        if (item.unit !== activeUser?.unit || done(item.status)) continue;
        const unitAssignment = (project.assignments || []).find(assignment => assignment.assignee === item.unit);
        const due = dateValue(item.due) ?? dateValue(unitAssignment?.due);
        owned.push({kind:'ready',project,item,unit:item.unit,due,caption:typeof templateItemText === 'function' ? templateItemText(item) : item.zh || item.id,
          state:item.status === 'issue' ? text('有異常','Issue reported','Có bất thường') : item.status === 'progress' ? text('處理中','In progress','Đang xử lý') : text('待回覆','Awaiting response','Chờ phản hồi')});
      }
    }
    for (const post of posts || []) {
      for (const assignment of post.assignments || []) {
        if (done(assignment.status)) continue;
        const due = dateValue(assignment.due) ?? dateValue(post.due);
        const row = {kind:'post',post,assignment,unit:assignment.assignee,due,caption:assignment.request || post.title,
          state:assignment.status === 'progress' ? text('處理中','In progress','Đang xử lý') : text('待回覆','Awaiting response','Chờ phản hồi')};
        if (isMine(assignment.assignee)) owned.push(row);
        else if (ownAuthor(post) && !readyPostIds.has(post.id)) waiting.push(row);
      }
    }
    const now = today();
    for (const row of [...owned, ...waiting]) row.days = row.due === null ? null : Math.round((row.due - now) / 86400000);
    const unique = rows => [...new Map(rows.map(row => [row.kind === 'ready' ? `${row.project.id}:${row.item.id}` : `${row.post.id}:${row.unit}`, row])).values()];
    return {owned:unique(owned).sort(sortRows),waiting:unique(waiting).sort(sortRows)};
  }
  function sortRows(a,b) {
    const rank = row => row.days === null ? 3 : row.days < 0 ? 0 : row.days <= 3 ? 1 : 2;
    return rank(a)-rank(b) || (a.days ?? 9999)-(b.days ?? 9999) || String(a.project?.model || a.post?.model || '').localeCompare(String(b.project?.model || b.post?.model || ''));
  }
  function dueLabel(row) {
    if (row.days === null) return text('未設定期限','No due date','Chưa có hạn');
    if (row.days < 0) return text(`逾期 ${Math.abs(row.days)} 天`,`${Math.abs(row.days)} days overdue`,`Quá hạn ${Math.abs(row.days)} ngày`);
    if (row.days === 0) return text('今天到期','Due today','Đến hạn hôm nay');
    return text(`${row.days} 天後到期`,`Due in ${row.days} days`,`Còn ${row.days} ngày`);
  }
  function openRow(row) {
    if (row.kind === 'ready') {
      view = 'readiness';
      render();
      openReadyDetail(row.project.id, row.unit);
      return;
    }
    view = 'feed';
    filter = 'all';
    query = '';
    const mode = document.querySelector('#paleoFeedMode');
    if (mode && activeUser) {
      const all = mode.querySelector('[data-feed-mode="all"]');
      all?.click();
    } else render();
    const card = document.querySelector(`#posts [data-action="detail"][data-id="${CSS.escape(row.post.id)}"]`)?.closest('.post');
    card?.scrollIntoView({block:'center'});
    card?.querySelector(`[data-action="detail"][data-id="${CSS.escape(row.post.id)}"]`)?.click();
  }
  function rowHtml(row) {
    const model = row.project?.model || row.post?.model || '';
    const color = row.project?.color || row.post?.color || '';
    const title = row.kind === 'ready' ? row.caption : row.post.title;
    const unit = row.unit || '';
    return `<button type="button" class="myWorkRow ${row.days !== null && row.days < 0 ? 'overdue' : row.days !== null && row.days <= 3 ? 'soon' : ''}" data-work-kind="${row.kind}" data-work-key="${esc(row.kind === 'ready' ? `${row.project.id}|${row.item.id}` : `${row.post.id}|${unit}`)}"><span class="myWorkCopy"><b>${esc(model)}${color ? ' · ' + esc(color) : ''}　${esc(title)}</b><small>${row.kind === 'ready' ? text('型體就緒檢核','Readiness checklist','Kiểm tra mức độ sẵn sàng') : esc(row.post.title)} · ${esc(unit)} · ${esc(row.state)}</small></span><span class="myWorkDue">${esc(dueLabel(row))}　›</span></button>`;
  }
  function draw() {
    panel.hidden = view !== 'mine' || !activeUser;
    if (panel.hidden) return;
    const {owned,waiting} = collect();
    const overdue = owned.filter(row => row.days !== null && row.days < 0).length;
    const soon = owned.filter(row => row.days !== null && row.days >= 0 && row.days <= 3).length;
    panel.innerHTML = `<div class="myWorkHeading"><div><h2>${text('今天要處理的工作','Your work at a glance','Công việc của bạn')}</h2><p>${esc(activeUser.unit)} · ${text('只彙整指派給本人／所屬單位的未完成項目','Open items assigned to you or your unit','Các mục đang mở được giao cho bạn hoặc bộ phận')}</p></div><button type="button" class="myWorkRefresh">${text('更新總覽','Refresh overview','Làm mới')}</button></div><div class="myWorkMetrics"><div><b>${owned.length}</b><span>${text('待處理','Open tasks','Việc đang mở')}</span></div><div class="risk"><b>${overdue}</b><span>${text('已逾期','Overdue','Quá hạn')}</span></div><div class="warning"><b>${soon}</b><span>${text('三天內到期','Due in 3 days','Đến hạn trong 3 ngày')}</span></div><div><b>${waiting.length}</b><span>${text('等待單位回覆','Waiting for teams','Chờ bộ phận phản hồi')}</span></div></div><div class="myWorkColumns"><section><h3>${text('指派給我／所屬單位','Assigned to me / my unit','Giao cho tôi / bộ phận')}</h3>${owned.slice(0,12).map(rowHtml).join('') || `<p class="myWorkEmpty">${text('目前沒有未完成的指派或檢核。','No open assignments or checklist items.','Không có việc được giao hoặc mục kiểm tra đang mở.')}</p>`}</section><section><h3>${text('我發起、等待他人回覆','I’m waiting for a response','Đang chờ phản hồi')}</h3>${waiting.slice(0,8).map(rowHtml).join('') || `<p class="myWorkEmpty">${text('目前沒有等待其他單位回覆的工作。','No work is waiting for another team.','Không có việc đang chờ bộ phận khác phản hồi.')}</p>`}</section></div><p class="myWorkNote">${text('點擊工作可開啟原有貼文或正式檢核，直接沿用既有回覆與儲存流程。','Open an item to use its existing post or checklist workflow.','Mở mục để tiếp tục dùng quy trình phản hồi và lưu hiện có.')}</p>`;
    panel.querySelector('.myWorkRefresh').onclick = draw;
    panel.onclick = event => {
      const button = event.target.closest('[data-work-kind]');
      if (!button) return;
      const [recordId, unitOrItem] = button.dataset.workKey.split('|');
      const row = button.dataset.workKind === 'ready'
        ? owned.find(item => item.kind === 'ready' && item.project.id === recordId && item.item.id === unitOrItem)
        : [...owned, ...waiting].find(item => item.kind === 'post' && item.post.id === recordId && item.unit === unitOrItem);
      if (row) openRow(row);
    };
  }
  const previousRender = render;
  render = () => { previousRender(); draw(); };
  window.addEventListener('classicPostsChanged', draw);
  window.addEventListener('classicProjectsChanged', draw);
  draw();
})();
