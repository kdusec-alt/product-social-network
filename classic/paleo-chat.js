(() => {
  const $ = selector => document.querySelector(selector);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const words = {
    zh:{chat:'即時聊天',search:'搜尋成員…',message:'輸入訊息…',send:'傳送',members:'成員名單',membersTitle:'成員名單',searchStart:'搜尋成員以開始聊天',empty:'目前沒有可顯示的成員',self:'本人',chatAction:'聊天',invited:'已邀請',me:'我',login:'登入後可搜尋並聯絡授權成員。',needLogin:'請先登入後使用聊天',noMessages:'尚無訊息，傳送第一則訊息',photo:'查看照片'},
    en:{chat:'Chat',search:'Search members…',message:'Write a message…',send:'Send',members:'Members',membersTitle:'Member list',searchStart:'Search for a member to start chatting',empty:'No members to display',self:'You',chatAction:'Chat',invited:'Invited',me:'Me',login:'Sign in to search and contact authorized members.',needLogin:'Please sign in to use chat',noMessages:'No messages yet. Send the first one.',photo:'View photo'},
    vi:{chat:'Trò chuyện trực tiếp',search:'Tìm thành viên…',message:'Nhập tin nhắn…',send:'Gửi',members:'Thành viên',membersTitle:'Danh sách thành viên',searchStart:'Tìm thành viên để bắt đầu trò chuyện',empty:'Không có thành viên để hiển thị',self:'Bạn',chatAction:'Trò chuyện',invited:'Đã mời',me:'Tôi',login:'Đăng nhập để tìm và liên hệ thành viên được cấp quyền.',needLogin:'Vui lòng đăng nhập để sử dụng trò chuyện',noMessages:'Chưa có tin nhắn. Hãy gửi tin nhắn đầu tiên.',photo:'Xem ảnh'}
  };
  const text = key => (words[uiLang] || words.zh)[key] || words.zh[key] || key;
  const demoIds = new Set(['demo:demo1','demo:demo2','demo:demo3','demo:demo4']);
  let current = null, people = [], selected = null, thread = [], busy = false;
  async function api(path, options = {}) {
    const response = await fetch(path, {credentials:'same-origin', ...options, headers:{...(options.body ? {'content-type':'application/json'} : {}), ...options.headers}});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }
  function initials(person) { return safe((person.name || '?').trim().slice(0,2).toUpperCase()); }
  function peopleRows(rows, memberOnly = false) {
    return rows.filter(person => person.id && (memberOnly || person.id !== current?.id) && (!memberOnly || demoIds.has(person.id))).map(person =>
      `<div class="memberRow"><span class="memberAvatar">${person.avatar ? `<img src="${safe(person.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : initials(person)}</span><span class="memberIdentity"><b>${safe(person.nickname||person.name)}</b><small>${safe(person.unit)}${person.id === current?.id ? ' · '+text('me') : person.access_status === 'invited' ? ' · '+text('invited') : ''}</small></span>${person.id === current?.id ? `<button class="memberChat" type="button" disabled>${text('self')}</button>` : `<button class="memberChat" type="button" data-chat-person="${safe(person.id)}">${text('chatAction')}</button>`}</div>`
    ).join('') || `<p class="chatEmpty">${text('empty')}</p>`;
  }
  function renderMembers() {
    const query = ($('#memberSearch')?.value || '').trim().toLocaleLowerCase();
    const demos = people.filter(person => demoIds.has(person.id));
    const visible = demos.filter(person => `${person.name} ${person.nickname||''} ${person.unit} ${person.email}`.toLocaleLowerCase().includes(query));
    if ($('#memberList')) $('#memberList').innerHTML = peopleRows(visible, true);
  }
  function renderContacts() {
    const query = ($('#chatSearch')?.value || '').trim().toLocaleLowerCase();
    const visible = people.filter(person => person.id && person.id !== current?.id && person.access_status !== 'invited' && `${person.name} ${person.nickname||''} ${person.unit} ${person.email}`.toLocaleLowerCase().includes(query));
    if ($('#chatContacts')) $('#chatContacts').innerHTML = query ? peopleRows(visible) : `<p class="chatEmpty">${text('searchStart')}</p>`;
  }
  async function refreshPeople() {
    if (!current) return;
    people = await api('/api/users');
    renderMembers();
    renderContacts();
  }
  async function openPerson(id) {
    const person = people.find(item => item.id === id);
    if (!person || !current) return;
    selected = person;
    $('#chatPanel').hidden = false;
    $('#chatThread').hidden = false;
    $('#chatForm').hidden = false;
    $('#chatTitle').textContent = `${text('chat')} · ${person.name}`;
    await refreshThread();
    $('#chatMessage').focus();
  }
  async function refreshThread() {
    if (!selected || !current || busy) return;
    try {
      const rows = await api('/api/messages?with=' + encodeURIComponent(selected.id));
      thread = rows;
      $('#chatThread').innerHTML = rows.length ? rows.map(message => `<div class="chatBubble ${message.sender_id === current.id ? 'mine' : ''}"><small>${safe(message.sender_name)} · ${new Date(message.created_at).toLocaleString()}</small>${safe(message.body)}${message.photo_id ? `<br><a href="/api/message-files/${encodeURIComponent(message.photo_id)}" target="_blank" rel="noopener">${text('photo')}</a>` : ''}</div>`).join('') : `<div class="chatEmpty">${text('noMessages')}</div>`;
      $('#chatThread').scrollTop = $('#chatThread').scrollHeight;
    } catch (error) { $('#chatThread').innerHTML = `<div class="chatEmpty">${safe(error.message)}</div>`; }
  }
  async function ensureIdentity() {
    try {
      const data = await api('/api/me');
      current = data.user;
      const account = current.id.startsWith('demo:') ? current.id.slice(5) : current.email;
      const initialsValue = account === 'demo' ? 'TC' : account.startsWith('demo') ? account.slice(-1).toUpperCase().padStart(2, 'T') : (current.name || '?').slice(0,2).toUpperCase();
      window.verifiedWatermarkAccount=account;
      activeUser = {account, verifiedAccount:account, name:current.name, unit:current.unit, initials:initialsValue};
      sessionStorage.setItem('mrcDemoSession', JSON.stringify(activeUser));
      applyAccount();
      window.dispatchEvent(new Event("profileIdentity"));
      try {
        await refreshPeople();
      } catch (error) {
        // Member/profile storage failures do not invalidate a verified session.
        const list = $('#memberList');
        if (list) list.textContent = error.message;
        toast(error.message);
      }
    } catch {
      current = null;
      window.verifiedWatermarkAccount='';activeUser = null;
      sessionStorage.removeItem('mrcDemoSession');
      applyAccount();
      $('#memberList').innerHTML = `<p class="help">${text('login')}</p>`;
    }
  }
  window.addEventListener('profileUpdated',()=>refreshPeople().catch(()=>{}));
  $('#memberSearch')?.addEventListener('input', renderMembers);
  $('#chatSearch')?.addEventListener('input', renderContacts);
  document.addEventListener('click', async event => {
    const launch = event.target.closest('#chatLauncher');
    const close = event.target.closest('#chatClose');
    const open = event.target.closest('[data-chat-person]');
    try {
      if (launch) {
        if (!current) return toast(text('needLogin'));
        selected = null;
        $('#chatTitle').textContent = text('chat');
        $('#chatThread').hidden = true;
        $('#chatForm').hidden = true;
        $('#chatPanel').hidden = !$('#chatPanel').hidden;
        if (!$('#chatPanel').hidden) { await refreshPeople(); $('#chatSearch').focus(); }
      } else if (close) $('#chatPanel').hidden = true;
      else if (open) await openPerson(open.dataset.chatPerson);
    } catch (error) { toast(error.message); }
  });
  $('#chatForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const body = $('#chatMessage').value.trim();
    if (!body || !selected || busy) return;
    busy = true;
    try {
      await api('/api/messages', {method:'POST', body:JSON.stringify({to:selected.id, body})});
      $('#chatMessage').value = '';
      busy = false;
      await refreshThread();
      await refreshPeople();
    } catch (error) { toast(error.message); }
    finally { busy = false; }
  });
  if ($('#loginForm')) $('#loginForm').onsubmit = async event => {
    event.preventDefault();
    const account = $('#loginAccount').value.trim().toLowerCase();
    const password = $('#loginPassword').value;
    $('#loginError').textContent = '';
    try {
      await api('/api/login', {method:'POST', body:JSON.stringify({account, password})});
      sessionStorage.removeItem('mrcDemoSession');
      location.reload();
    } catch (error) { $('#loginError').textContent = error.message; }
  };
  if ($('#logoutButton')) $('#logoutButton').onclick = async event => {
    event.preventDefault();
    const button = $('#logoutButton');button.disabled = true;
    try {
      await api('/api/logout', {method:'POST'});
      sessionStorage.removeItem('mrcDemoSession');
      current = null;window.verifiedWatermarkAccount='';activeUser = null;$('#accountPanel').classList.remove('show');
      location.reload();
    } catch (error) { button.disabled = false;toast(error.message); }
  };
  const originalRender = render;
  function applyChatLanguage() {
    const launcher = $('#chatLauncher');
    if (launcher) {
      launcher.innerHTML = '<svg class="chatIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 4.5h15.6a1.7 1.7 0 0 1 1.7 1.7v9.1a1.7 1.7 0 0 1-1.7 1.7h-8.1l-4.8 3v-3H4.2a1.7 1.7 0 0 1-1.7-1.7V6.2a1.7 1.7 0 0 1 1.7-1.7Zm1.2 3.2v1.8h13.2V7.7H5.4Zm0 4v1.8h9.2v-1.8H5.4Z"/></svg><span>' + text('chat') + '</span>';
      launcher.setAttribute('aria-label', text('chat'));
    }
    if ($('#chatPanel') && !selected) $('#chatTitle').textContent = text('chat');
    if ($('#chatSearch')) { $('#chatSearch').placeholder = text('search'); $('#chatSearch').setAttribute('aria-label', text('search')); }
    if ($('#chatMessage')) $('#chatMessage').placeholder = text('message');
    const send = $('#chatForm button'); if (send) send.textContent = text('send');
    const membersHeading = $('#membersArea h2'); if (membersHeading) membersHeading.textContent = text('membersTitle');
    if ($('#memberSearch')) { $('#memberSearch').placeholder = text('search'); $('#memberSearch').setAttribute('aria-label', text('search')); }
  }
  render = () => {
    originalRender();
    applyChatLanguage();
    const nav = $('#nav');
    if (nav && !nav.querySelector('[data-view="members"]')) {
      const button = document.createElement('button');
      button.dataset.view = 'members';
      button.textContent = (uiLang === 'en' ? '♙　Members' : uiLang === 'vi' ? '♙　Thành viên' : '♙　成員名單');
      nav.insertBefore(button, nav.children[1] || null);
    }
    const memberView = view === 'members';
    $('#membersArea')?.classList.toggle('show', memberView);
    if (memberView) {
      $('#pageTitle').textContent = uiLang === 'en' ? 'Member list' : uiLang === 'vi' ? 'Danh sách thành viên' : '成員名單';
      $('#pageSub').hidden = true;
      $('#summary').style.display = 'none';
      $('#newPost').style.display = 'none';
      $('#feedArea').style.display = 'none';
      $('#legacyArea').classList.remove('show');
      for (const id of ['readinessArea','modelsArea','meetingArea']) { const panel = document.getElementById(id); if (panel) { panel.classList.remove('show'); panel.style.display = 'none'; } }
      nav?.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === 'members'));
      renderMembers();
    } else {
      $('#summary').style.display = '';
      for (const id of ['readinessArea','modelsArea','meetingArea']) { const panel = document.getElementById(id); if (panel) panel.style.display = ''; }
    }
  };
  render();
  ensureIdentity();
  setInterval(() => { if (current) { refreshPeople().catch(() => {}); refreshThread(); } }, 5000);
})();
