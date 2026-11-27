(() => {
  const $ = selector => document.querySelector(selector);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const words = {
    zh:{chat:'即時聊天',search:'搜尋成員…',message:'輸入訊息…',send:'傳送',members:'成員名單',membersTitle:'成員名單',searchStart:'搜尋成員，或從下方聊天紀錄繼續對話',history:'聊天紀錄',empty:'目前沒有可顯示的成員',self:'本人',chatAction:'聊天',invited:'已邀請',me:'我',login:'登入後可搜尋並聯絡授權成員。',needLogin:'請先登入後使用聊天',noMessages:'尚無訊息，傳送第一則訊息',photo:'查看照片'},
    en:{chat:'Chat',search:'Search members…',message:'Write a message…',send:'Send',members:'Members',membersTitle:'Member list',searchStart:'Search members or continue a conversation below',history:'Conversations',empty:'No members to display',self:'You',chatAction:'Chat',invited:'Invited',me:'Me',login:'Sign in to search and contact authorized members.',needLogin:'Please sign in to use chat',noMessages:'No messages yet. Send the first one.',photo:'View photo'},
    vi:{chat:'Trò chuyện trực tiếp',search:'Tìm thành viên…',message:'Nhập tin nhắn…',send:'Gửi',members:'Thành viên',membersTitle:'Danh sách thành viên',searchStart:'Tìm thành viên hoặc tiếp tục trò chuyện bên dưới',history:'Lịch sử trò chuyện',empty:'Không có thành viên để hiển thị',self:'Bạn',chatAction:'Trò chuyện',invited:'Đã mời',me:'Tôi',login:'Đăng nhập để tìm và liên hệ thành viên được cấp quyền.',needLogin:'Vui lòng đăng nhập để sử dụng trò chuyện',noMessages:'Chưa có tin nhắn. Hãy gửi tin nhắn đầu tiên.',photo:'Xem ảnh'}
  };
  const text = key => (words[uiLang] || words.zh)[key] || words.zh[key] || key;
  const demoIds = new Set(['demo:tino','demo:tino1','demo:tino2','demo:tino3']);
  let current = null, people = [], selected = null, thread = [], recent = [], busy = false;
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
  const bell=$('#notifyBell');
  if(bell)bell.before($('#chatLauncher'));
  let unreadOnly=false;
  const filters=document.createElement('div');filters.className='chatFilters';
  $('#chatContacts').before(filters);
  for(const [i,label] of [paleoLabel('全部','All','Tất cả'),paleoLabel('未讀','Unread','Chưa đọc')].entries()){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{unreadOnly=!!i;renderContacts()};filters.append(b)
  }
  function renderContacts() {
    filters.hidden=!!selected;
    [...filters.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(!!i===unreadOnly)));
    const query = ($('#chatSearch')?.value || '').trim().toLocaleLowerCase();
    const visible = people.filter(person => person.id && person.id !== current?.id && person.access_status !== 'invited' && `${person.name} ${person.nickname||''} ${person.unit} ${person.email}`.toLocaleLowerCase().includes(query));
    if ($('#chatContacts')) $('#chatContacts').innerHTML = query ? peopleRows(visible.filter(p=>!unreadOnly||unread.has(p.id))) : `<p class="chatEmpty">${text('searchStart')}</p>${recent.length ? `<h3 class="chatHistoryTitle">${text('history')}</h3>` + recent.filter(m=>!unreadOnly||unread.has(m.sender_id===current.id?m.recipient_id:m.sender_id)).map(message => {
      const id = message.sender_id === current?.id ? message.recipient_id : message.sender_id;
      const person = people.find(item => item.id === id);
      if (!person) return '';
      return `<button class="chatRecent" type="button" data-chat-person="${safe(id)}"><span class="chatPortrait">${person.avatar?`<img src="${safe(person.avatar)}" alt="">`:initials(person)}</span><b>${safe(person.nickname || person.name)} ${unread.get(id)||''}</b><small>${safe(message.body).slice(0,90)}</small><time>${safe(new Date(message.created_at).toLocaleString())}</time></button>`;
    }).join('') : ''}`;
  }
  let audio, initialized=false, lastTyping=0, unread=new Map();
  document.addEventListener('pointerdown',()=>{try{audio ||= new AudioContext();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}});
  window.chatChime=()=>{if(audio?.state!=='running')return;const tone=audio.createOscillator(),gain=audio.createGain();tone.connect(gain);gain.connect(audio.destination);gain.gain.setValueAtTime(.1,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.22);tone.frequency.value=740;tone.start();tone.stop(audio.currentTime+.22)};
  const signal=(data)=>api('/api/messages/state',{method:'POST',body:JSON.stringify(data)});
  document.addEventListener('input',e=>{if(e.target.id==='chatMessage'&&selected&&Date.now()-lastTyping>2000){lastTyping=Date.now();signal({peer:selected.id,typing:true}).catch(()=>{})}});
  window.openBellChat = openPerson;
  async function refreshRecent() {
    if (!current) return;
    const rows = await api('/api/messages');
    unread=new Map();for(const m of rows)if(m.recipient_id===current.id&&!m.is_read)unread.set(m.sender_id,(unread.get(m.sender_id)||0)+1);
    const total=[...unread.values()].reduce((a,b)=>a+b,0);$('#chatLauncher').dataset.unread=total||'';
    const keys = new Set(notifications.map(n => n.id));
    let added = false;
    for (const message of rows.slice().reverse()) {
      const id = 'dm:' + current.id + ':' + message.id;
      if (message.recipient_id !== current.id || keys.has(id)) continue;
      notifications.unshift({id, recipient:activePersona, actor:message.sender_name, chatSender:message.sender_id,
        title:text('chat'), model:'', color:'', time:new Date(message.created_at).toLocaleString(), read:!!message.is_read});
      added = true;
    }
    if (added){saveNotify();if(initialized)window.chatChime()}initialized=true;
    const seen = new Set();
    recent = rows.filter(message => {
      const id = message.sender_id === current.id ? message.recipient_id : message.sender_id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (!selected) renderContacts();
  }
  function showContacts() {
    selected = null;
    $('#chatTitle').textContent = text('chat');
    $('#chatBack').hidden = true;
    $('#chatSearch').hidden = false;
    $('#chatContacts').hidden = false;
    $('#chatThread').hidden = true;
    $('#chatForm').hidden = true;
    renderContacts();
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
    filters.hidden=true;selected = person; replyId=''; photo.value=''; syncDraft(); lastPerson='';
    $('#chatPanel').hidden = false;
    $('#chatBack').hidden = false;
    $('#chatSearch').hidden = true;
    $('#chatContacts').hidden = true;
    $('#chatThread').hidden = false;
    $('#chatForm').hidden = false;
    $('#chatTitle').textContent = `${text('chat')} · ${person.name}`;
    await refreshThread();
    $('#chatMessage').focus();
  }
  async function refreshThread() {
    if (!selected || !current || busy) return;
    try {
      const personId = selected.id;
      const rows = await api('/api/messages?with=' + encodeURIComponent(personId));
      if (selected?.id !== personId) return;
      const pane=$('#chatThread'), oldTop=pane.scrollTop;
      const follow=lastPerson!==personId || pane.scrollHeight-pane.clientHeight-oldTop<32;
      lastPerson=personId;
      thread = rows;
      const markup = rows.length ? rows.map(message => `<div data-mid="${safe(message.id)}" class="chatBubble ${message.sender_id === current.id ? 'mine' : ''}"><small>${safe(message.sender_name)} · ${new Date(message.created_at).toLocaleString()}</small>${displayBody(message)}${message.sender_id===current.id ? '<small>'+ (message.is_read?'已讀':'未讀取')+'</small>':''}${message.body && message.photo_id ? `<a class="chatMedia" href="/api/message-files/${encodeURIComponent(message.photo_id)}" target="_blank" rel="noopener"><img class="chatInline" src="/api/message-files/${encodeURIComponent(message.photo_id)}" alt="${safe(message.photo_name||text('photo'))}"><span hidden>${text('photo')}</span></a>` : ''}</div>`).join('') : `<div class="chatEmpty">${text('noMessages')}</div>`;
      if(pane._markup!==markup){
        const oldImages=new Map([...pane.querySelectorAll('img.chatInline')].map(img=>[img.src,img]));
        const fragment=document.createElement('template');fragment.innerHTML=markup;
        fragment.content.querySelectorAll('img.chatInline').forEach(img=>{const old=oldImages.get(img.src);if(old)img.replaceWith(old)});
        pane.replaceChildren(fragment.content);pane._markup=markup;
      }
      pane.scrollTop=follow?pane.scrollHeight:oldTop;
      const status=await api('/api/messages/typing?with='+encodeURIComponent(personId));
      if(selected?.id!==personId || $('#chatPanel').hidden)return;
      $('#chatTitle').textContent=text('chat')+' · '+selected.name+(status.typing?' · 對方輸入中…':'');
      const incoming=rows.filter(m=>m.recipient_id===current.id&&!m.is_read);
      if(incoming.length&&!document.hidden&&document.hasFocus()){
        await signal({peer:personId,seen:incoming.at(-1).id});
        const ids=new Set(incoming.map(m=>'dm:'+current.id+':'+m.id));notifications.forEach(n=>{if(ids.has(n.id))n.read=true});saveNotify();
      }

    } catch (error) { $('#chatThread').innerHTML = `<div class="chatEmpty">${safe(error.message)}</div>`; }
  }
  function configureStorageButton() {
    let button = document.querySelector('#storageUsageButton');
    if (!button) {
      button = document.createElement('button');button.id = 'storageUsageButton';button.type = 'button';
      document.querySelector('#accountPanel').appendChild(button);
      button.onclick = async () => {
        try {
          const data = await api('/api/storage');
          const dialog = document.createElement('dialog');
          dialog.style.cssText='max-width:480px;width:90%;border:1px solid #dbe4ed;border-radius:12px;padding:24px';
          const title=document.createElement('h3');title.textContent=button.textContent;
          const details=document.createElement('p');details.style.whiteSpace='pre-line';
          const mib=value=>(Number(value)/1048576).toFixed(2)+' MiB';
          const copy=uiLang==='en'?['Stored objects','Database size','Single item limit','Close']:uiLang==='vi'?['Dữ liệu lưu trữ','Dung lượng cơ sở dữ liệu','Giới hạn mỗi mục','Đóng']:['共用物件用量','資料庫用量','單一項目上限','關閉'];
          details.textContent=data.backend==='d1'?`${copy[0]}: ${mib(data.objectBytes)} / ${mib(data.objectBudgetBytes)}\n${copy[1]}: ${mib(data.databaseBytes)}\n${copy[2]}: ${mib(data.objectLimitBytes)}`:'R2';
          const close=document.createElement('button');close.textContent=copy[3];close.onclick=()=>dialog.close();
          dialog.append(title,details,close);dialog.addEventListener('close',()=>dialog.remove());document.body.appendChild(dialog);dialog.showModal();
        } catch(error) {toast(error.message)}
      };
    }
    button.hidden=current?.role!=='admin';
    button.textContent=uiLang==='en'?'Storage usage':uiLang==='vi'?'Dung lượng lưu trữ':'儲存用量';
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
      configureStorageButton();
      window.dispatchEvent(new Event("profileIdentity"));
      try {
        await refreshPeople();
        await refreshRecent();
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
    const back = event.target.closest('#chatBack');
    const open = event.target.closest('[data-chat-person]');
    try {
      if (launch) {
        if (!current) return toast(text('needLogin'));
        $('#chatPanel').hidden = !$('#chatPanel').hidden;
        if (!$('#chatPanel').hidden) { showContacts(); await refreshPeople(); await refreshRecent(); $('#chatSearch').focus(); }
      } else if (close) $('#chatPanel').hidden = true;
      else if (back) { showContacts(); await refreshRecent(); $('#chatSearch').focus(); }
      else if (open) await openPerson(open.dataset.chatPerson);
    } catch (error) { toast(error.message); }
  });
  let lastPerson='',replyId='';
  const form=$('#chatForm'), photo=document.createElement('input'),draft=document.createElement('button');
  photo.type='file';photo.accept='image/*';photo.hidden=true;
  draft.type='button';draft.hidden=true;
  function syncDraft(){draft.textContent=[replyId?'引用回覆':'',photo.files[0]?.name].filter(Boolean).join(' · ')+' ×';draft.hidden=!replyId&&!photo.files.length}
  draft.onclick=()=>{replyId='';photo.value='';syncDraft()};photo.onchange=syncDraft;
  function control(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;form.append(b);return b}
  form.append(photo,draft);
  const field=$('#chatMessage'), send=form.querySelector('[type=submit]');
  const entry=document.createElement('div');entry.className='chatEntry';
  const picker=document.createElement('div');picker.className='chatEmojiGrid';picker.hidden=true;
  function icon(button,label,glyph){button.className='chatTool';button.textContent=glyph;button.title=label;button.setAttribute('aria-label',label)}
  const attach=control('',()=>photo.click());icon(attach,'選擇圖片','⊕');
  const smile=control('',()=>{picker.hidden=!picker.hidden});icon(smile,'表情符號','☺');
  for(const value of ['😊','👍','❤️','😂','🙏','🎉','✅','👀','💪','🙂','👏','👌']){
    const b=document.createElement('button');b.type='button';b.textContent=value;b.onclick=()=>{field.setRangeText(value,field.selectionStart,field.selectionEnd,'end');picker.hidden=true;field.focus();updateSend()};picker.append(b);
  }
  function updateSend(){icon(send,text('send'),field.value.trim()||photo.files.length?'➤':'👍')}
  entry.append(field,smile);form.replaceChildren(photo,draft,attach,entry,send,picker);
  draft.className='chatDraft';field.addEventListener('input',updateSend);photo.addEventListener('change',updateSend);updateSend();
  $('#chatThread').addEventListener('error',e=>{if(e.target.matches('img.chatInline')){e.target.hidden=true;e.target.nextElementSibling.hidden=false}},true);
    const prefix=/^↩\[([^\]\n]{1,100})\]\n/;
  function displayBody(m){if(!m.body)return '<i>訊息已收回</i>';const ref=m.body.match(prefix);if(!ref)return safe(m.body);
    const original=thread.find(row=>row.id===ref[1]);return '<blockquote>'+safe(original?.body?.replace(prefix,'').slice(0,90)||'原訊息無法顯示')+'</blockquote>'+safe(m.body.slice(ref[0].length))}
  $('#chatThread').oncontextmenu=async e=>{
    const row=e.target.closest('[data-mid]');if(!row)return;e.preventDefault();
    const m=thread.find(x=>x.id===row.dataset.mid);if(!m?.body)return;
    if(m.sender_id===current.id && Date.now()-Date.parse(m.created_at)<=180000){
      if(confirm('收回這則訊息？')){try{await api('/api/messages/'+encodeURIComponent(m.id)+'/recall',{method:'POST'});await refreshThread();await refreshRecent()}catch(error){toast(error.message)}}return}
    replyId=m.id;syncDraft();$('#chatMessage').focus({preventScroll:true});
  };
  $('#chatForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const body = $('#chatMessage').value.trim() || (photo.files.length?'':'👍');
    let file=photo.files[0];if ((!body&&!file) || !selected || busy) return;if(file&&file.size>8*1024*1024)return toast('圖片上限 8 MB');
    busy = true;
    try {
      if(file && !['image/jpeg','image/png','image/gif','image/webp','image/avif','image/bmp','image/x-icon','image/vnd.microsoft.icon','image/apng'].includes(file.type)){
        const bitmap=await createImageBitmap(file).catch(()=>{throw Error('此瀏覽器無法解碼這張圖片，請轉成 PNG 或 JPG')});
        const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob||blob.size>8388608)throw Error('轉換後圖片超過上限或無法解碼');file=new File([blob],file.name+'.png',{type:'image/png'});
      }
      const created=await api('/api/messages', {method:'POST', body:JSON.stringify({to:selected.id, body:(replyId?'↩['+replyId+']\n':'')+(body||'📷')})});
      if(file){const res=await fetch('/api/messages/'+encodeURIComponent(created.id)+'/photo?name='+encodeURIComponent(file.name),{method:'POST',headers:{'content-type':file.type},body:file});if(!res.ok){await api('/api/messages/'+encodeURIComponent(created.id)+'/recall',{method:'POST'});throw Error('圖片上傳失敗')}}
      replyId='';photo.value='';syncDraft();
      $('#chatMessage').value = '';updateSend();
      busy = false;
      await refreshThread();
      await refreshRecent();
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
    updateSend();
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
  setInterval(() => { if (current) { refreshPeople().catch(() => {}); refreshRecent().catch(() => {}); if (!$('#chatPanel').hidden) refreshThread(); } }, 5000);
})();
