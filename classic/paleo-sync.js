(() => {
  const base = new URL('../api/classic-state',location.href).pathname;
  const known = {posts:new Map(),projects:new Map()};
  window.classicAuthorProfiles=new Map();
  let ready = false, busy = false, queued = false, identity = null;
  const local = kind => kind === 'posts' ? posts : readinessProjects;
  const store = kind => localStorage.setItem(kind === 'posts' ? 'mrcDemoPosts' : readyKey, JSON.stringify(local(kind)));
  let lastSyncError='',lastSyncErrorAt=0;
  function reportSyncError(error) {
    console.warn('VP sync:',error.message);
    if(lastSyncError!==error.message||Date.now()-lastSyncErrorAt>30000){
      lastSyncError=error.message;lastSyncErrorAt=Date.now();
      const prefix=uiLang==='en'?'Not synced: ':uiLang==='vi'?'Chưa đồng bộ: ':'尚未同步：';
      toast(prefix+error.message);
    }
  }
  async function request(path,options) {
    const response=await fetch(base+path,{credentials:'same-origin',...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||'同步失敗');
    return data;
  }
  async function remote(kind) { return request('?kind='+kind); }
  window.persistClassicPost = async post => {
    const record = await request('/posts/'+encodeURIComponent(post.id),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(post)});
    known.posts.set(post.id,JSON.stringify(record.data));
    Object.assign(post,record.data);
    return record.data;
  };
  window.uploadClassicMailImage = async (postId,item) => {
    const params=new URLSearchParams({post:postId,name:item.name,mime:item.mime||'application/octet-stream'});
    const response=await fetch(new URL('../api/classic-attachments?'+params,location.href),{method:'POST',credentials:'same-origin',headers:{'content-type':item.mime||'application/octet-stream'},body:item.data});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error||'圖片上傳失敗');
    return result;
  };
  const own = post => identity?.role === 'admin' || post.author === identity?.name || String(post.author||'').startsWith(identity?.name+' ·');
  function apply(kind,records) {
    if(kind==='posts')for(const record of records)window.classicAuthorProfiles.set(record.id,record.authorProfile||null);
    const current=local(kind),remoteIds=new Set(records.map(record=>record.id));
    const previousIds=new Set(known[kind].keys());
    const remaining=current.filter(item=>!previousIds.has(item.id)&&!remoteIds.has(item.id));
    const latest=records.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).map(record=>record.data);
    const next=[...latest,...remaining];
    if(kind==='posts')posts=next;else readinessProjects=next;
    known[kind]=new Map(records.map(record=>[record.id,JSON.stringify(record.data)]));
    store(kind);
  }
  async function flushKind(kind) {
    const cache=known[kind],items=local(kind);
    for(const item of items) {
      const text=JSON.stringify(item);
      if(cache.get(item.id)===text)continue;
      if(kind==='posts'&&!cache.has(item.id)&&!own(item))continue;
      try {
        const record=await request('/'+kind+'/'+encodeURIComponent(item.id),{method:'PUT',headers:{'content-type':'application/json'},body:text});
        cache.set(item.id,JSON.stringify(record.data));
        if(kind==='posts'&&JSON.stringify(record.data)!==text)Object.assign(item,record.data);
      } catch(error) { reportSyncError(error); }
    }
    if(kind==='posts')for(const id of [...cache.keys()])if(!items.some(item=>item.id===id)){
      try {await request('/posts/'+encodeURIComponent(id),{method:'DELETE'});cache.delete(id)}catch(error){reportSyncError(error)}
    }
  }
  async function flush(){if(!ready)return;if(busy){queued=true;return}busy=true;try{do{queued=false;await flushKind('projects');await flushKind('posts')}while(queued)}finally{busy=false}}
  const updates=document.createElement('button');
  updates.type='button';updates.className='quick';updates.hidden=true;
  updates.textContent='有新動態，點此更新';
  document.querySelector('#posts').before(updates);
  function detectMentions(records) {
    const names = new Set([activePersona, activeUnit, activeUser?.name, activeUser?.account, identity?.name, identity?.unit].filter(Boolean).map(x=>x.toLowerCase()));
    const existing = new Set(notifications.filter(n=>isMine(n.recipient)).map(n=>n.postId));
    let changed=false;
    for (const {data:p} of records) {
      if(existing.has(p.id) || !(p.tagRefs||[]).some(t=>t.marker==='@' && names.has(String(t.name).toLowerCase()))) continue;
      notifications.unshift({id:'mention:'+identity.id+':'+p.id, recipient:activePersona, actor:p.author, postId:p.id,
        model:p.model,color:p.color,title:p.title,time:p.time,read:false});
      existing.add(p.id);changed=true;
    }
    if(changed){saveNotify();if(ready)window.chatChime?.()}
  }
  async function refresh(applyChanges=false){
    if(!ready||busy||document.hidden)return;
    busy=true;
    try {
      const rows=await Promise.all([remote('projects'),remote('posts')]);
      detectMentions(rows[1]);
      const kinds=['projects','posts'];
      const changed=kinds.some((kind,i)=>rows[i].length!==known[kind].size||
        rows[i].some(row=>known[kind].get(row.id)!==JSON.stringify(row.data)));
      updates.hidden=!changed;
      if(changed&&applyChanges){
        kinds.forEach((kind,i)=>apply(kind,rows[i]));
        updates.hidden=true;render();
      }
    }catch(error){console.warn('VP refresh:',error.message)}finally{busy=false}
  }
  updates.onclick=()=>refresh(true);
  async function start(){
    try {
      if(window.paleoApiReady)await window.paleoApiReady;
      const response=await fetch(new URL('../api/me',location.href),{credentials:'same-origin'});if(!response.ok)return;
      identity=(await response.json()).user;
      const [projects,postRows]=await Promise.all([remote('projects'),remote('posts')]);
      detectMentions(postRows);
      const localProjects=[...readinessProjects],localPosts=[...posts];
      apply('projects',projects);apply('posts',postRows);ready=true;
      if(identity.role==='admin'){
        for(const project of localProjects)if(!known.projects.has(project.id)&&!readinessProjects.some(p=>p.id===project.id))readinessProjects.push(project);
        for(const post of localPosts)if(!known.posts.has(post.id)&&!posts.some(p=>p.id===post.id))posts.push(post);
      }else{
        for(const post of localPosts)if(own(post)&&!known.posts.has(post.id)&&!posts.some(p=>p.id===post.id))posts.push(post);
      }
      await flush();store('posts');store('projects');render();
    }catch(error){reportSyncError(error)}
  }
  window.addEventListener('classicPostsChanged',flush);
  window.addEventListener('classicProjectsChanged',flush);
  start();setInterval(refresh,30000);
})();
