import { createD1Bucket, StorageError } from './storage.js';
import { assets } from './assets.js';
import { readinessTemplates } from './templates.js';
import { legacySeed } from './legacy-seed.js';

const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const err = (message,status=400) => json({error:message},status);
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const s = (value,max=1000) => String(value??'').trim().slice(0,max);
const allowedStatus = new Set(['open','progress','verify','closed']);

const hex=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function demoUser(request,env){const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)paleo_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)return null;return env.DB.prepare('SELECT u.* FROM demo_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hex(token),now()).first()}
async function demoLogin(request,env){const d=await body(request),account=s(d.account,30).toLowerCase(),password=s(d.password,100),profile=JSON.parse(env.DEMO_PROFILES_JSON||'{}')[account];if(!env.DEMO_PASSWORD||!profile||await hex('PaleoNet-demo:'+password)!==await hex('PaleoNet-demo:'+env.DEMO_PASSWORD))return err('帳號或密碼錯誤',401);const uid='demo:'+account,email=account+'@paleonet.demo';await env.DB.prepare('INSERT OR IGNORE INTO users(id,email,display_name,unit,role,created_at) VALUES(?,?,?,?,?,?)').bind(uid,email,profile[0],profile[1],profile[2],now()).run();const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');const expiry=new Date(Date.now()+7*86400000).toISOString();await env.DB.prepare('INSERT INTO demo_sessions VALUES(?,?,?)').bind(await hex(token),uid,expiry).run();const response=json({ok:true},200,{'set-cookie':`paleo_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`});response.headers.append('set-cookie','paleo_signed_out=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');return response}
async function userFor(request, env) {
  const demo=await demoUser(request,env);if(demo)return demo;
  if(/(?:^|;\s*)paleo_signed_out=1(?:;|$)/.test(request.headers.get('cookie')||''))return null;
  if(env.TRUST_SITES_HEADERS!=='true')return null;
  const uid = request.headers.get('oai-authenticated-user-id');
  const email = s(request.headers.get('oai-authenticated-user-email'),320).toLowerCase();
  if (!uid || !email) return null;
  let user = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(uid).first();
  if (user) return user;
  const invite = email === String(env.OWNER_EMAIL||'').trim().toLowerCase() ? {email,unit:'PM',role:'admin',display_name:env.OWNER_NAME||'Administrator'} : await env.DB.prepare('SELECT * FROM invites WHERE email=?').bind(email).first();
  if (!invite) return {pending:true,email};
  let display = request.headers.get('oai-authenticated-user-full-name');
  if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') try { display=decodeURIComponent(display); } catch {}
  await env.DB.prepare('INSERT OR IGNORE INTO users(id,email,display_name,unit,role,created_at) VALUES(?,?,?,?,?,?)').bind(uid,email,s(display||invite.display_name||email,100),invite.unit,invite.role,now()).run();
  user = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(uid).first();
  await env.DB.prepare('UPDATE assignments SET assignee_id=? WHERE assignee_email=? AND assignee_id IS NULL').bind(uid,email).run();
  return user;
}
async function audit(env,user,action,type,entity,details={}) {
  await env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?)').bind(id(),user.id,action,type,entity,JSON.stringify(details),now()).run();
}
async function body(request) {
  if (Number(request.headers.get('content-length')||0)>1024*1024) throw Error('內容太大');
  return request.json();
}
function originOkay(request) {
  const origin=request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
async function listPosts(env,user,url) {
  const model=url.searchParams.get('model');
  const q=s(url.searchParams.get('q'),100);
  const sql=`SELECT p.*,m.code,m.color,m.season,m.factory,m.phase,m.launch_date,u.display_name author,u.unit author_unit,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comment_count,
    (SELECT COUNT(*) FROM assignments a WHERE a.post_id=p.id AND a.status!='done') pending_count
    FROM posts p JOIN models m ON m.id=p.model_id JOIN users u ON u.id=p.author_id WHERE p.source!='deleted' AND (? IS NULL OR p.model_id=?) AND (?='' OR (p.title||' '||p.body||' '||m.code||' '||m.color) LIKE '%'||?||'%') ORDER BY p.created_at DESC LIMIT 300`;
  let rows=(await env.DB.prepare(sql).bind(model,model,q,q).all()).results;
  if(url.searchParams.get('mine')==='1') rows=rows.filter(p=>p.author_id===user.id);
  if(url.searchParams.get('status')) rows=rows.filter(p=>p.status===url.searchParams.get('status'));
  if(rows.length){const ids=rows.map(p=>p.id),files=(await env.DB.prepare(`SELECT id,post_id,name FROM attachments WHERE post_id IN (${ids.map(()=>'?').join(',')}) ORDER BY created_at`).bind(...ids).all()).results;const byPost=new Map();for(const f of files){if(!byPost.has(f.post_id))byPost.set(f.post_id,[]);byPost.get(f.post_id).push(f)}rows=rows.map(p=>({...p,attachments:byPost.get(p.id)||[]}));}
  return rows;
}
async function notify(env,post,actor,assignees) {
  for (const a of assignees) {
    const recipients=a.email ? await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(a.email).all() : await env.DB.prepare('SELECT id FROM users WHERE unit=?').bind(a.unit).all();
    for (const u of recipients.results) if(u.id!==actor.id) await env.DB.prepare('INSERT INTO notifications VALUES(?,?,?,?,?,?,?,NULL)').bind(id(),u.id,post,actor.id,'assignment',a.request||'請回饋進度',now()).run();
  }
}
async function handleApi(request,env,url) {
  if(url.pathname==='/api/login'&&request.method==='POST'){if(!originOkay(request))return err('來源驗證失敗',403);return demoLogin(request,env)}
  if(url.pathname==='/api/logout'&&request.method==='POST'){if(!originOkay(request))return err('來源驗證失敗',403);const token=(request.headers.get('cookie')||'').match(/paleo_session=([a-f0-9]{64})/)?.[1];if(token)await env.DB.prepare('DELETE FROM demo_sessions WHERE token_hash=?').bind(await hex(token)).run();const response=json({ok:true},200,{'set-cookie':'paleo_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'});response.headers.append('set-cookie','paleo_signed_out=1; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800');return response}
  const user=await userFor(request,env);
  if(!user) return err('請登入',401);
  if(user.pending) return err('帳號尚未受邀，請聯繫 PM 管理員',403);
  const method=request.method, path=url.pathname;
  if(method!=='GET' && !originOkay(request)) return err('來源驗證失敗',403);
  if(path==='/api/profile' && ['GET','PUT'].includes(method)) {
    const key='profiles/'+encodeURIComponent(user.id)+'.json';
    if(method==='GET'){
      const object=await env.BUCKET.get(key);
      return json(object?JSON.parse(await object.text()):{nickname:'',avatar:''});
    }
    const {nickname,avatar}=await body(request);
    if(typeof nickname!=='string'||!nickname.trim()||nickname.length>64||
       typeof avatar!=='string'||avatar.length>180000||(avatar&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(avatar)))return err('請確認姓名與照片');
    const profile={nickname:nickname.trim(),avatar};
    await env.BUCKET.put(key,JSON.stringify(profile));
    return json(profile);
  }
  if(path==='/api/storage' && method==='GET') {
    if(user.role!=='admin')return err('僅管理員可查看容量',403);
    return json(env.BUCKET.stats?await env.BUCKET.stats():{backend:'r2'});
  }
  if(path==='/api/me') return json({user:{id:user.id,email:user.email,name:user.display_name,unit:user.unit,role:user.role}});
  if(path==='/api/knowledge-marks' && method==='GET') {
    const listing=await env.BUCKET.list({prefix:'knowledge/marks/',limit:1000}),rows=[];
    for(const object of listing.objects){const stored=await env.BUCKET.get(object.key);if(!stored)continue;try{rows.push(JSON.parse(await stored.text()))}catch{}}
    return json(rows);
  }
  if(path==='/api/knowledge-marks' && method==='POST') {
    const d=await body(request),postId=s(d.postId,120),commentName=s(d.commentName,160),commentTime=s(d.commentTime,100),commentText=s(d.commentText,3000),reason=s(d.reason,500);
    if(!postId||!commentText||!reason)return err('貼文、回覆及標記原因不可空白');
    const stored=await env.BUCKET.get(`classic/posts/${postId}.json`);let found=false;
    if(stored){let record;try{record=JSON.parse(await stored.text())}catch{return err('原始貼文格式錯誤',409)}const comments=record.data?.comments||[];found=comments.some(c=>s(c.name||c.author||c.display_name||c.unit,160)===commentName&&s(c.time||c.created_at||c.createdAt,100)===commentTime&&s(c.text||c.body,3000)===commentText)}
    if(!found){const row=await env.DB.prepare('SELECT c.id FROM comments c LEFT JOIN users u ON u.id=c.author_id WHERE c.post_id=? AND c.created_at=? AND c.body=? AND (u.display_name=? OR (u.display_name||\' · \'||u.unit)=?)').bind(postId,commentTime,commentText,commentName,commentName).first();found=!!row}
    if(!found)return err('找不到這則原始回覆',404);
    const markId=id(),mark={id:markId,postId,comment:{name:commentName,time:commentTime,text:commentText},markedById:user.id,markedByName:user.display_name,unit:user.unit,reason,createdAt:now()};
    await env.BUCKET.put(`knowledge/marks/${markId}.json`,JSON.stringify(mark),{httpMetadata:{contentType:'application/json'}});
    await audit(env,user,'create','knowledge_mark',markId,{postId,reason});return json(mark,201);
  }
  const knowledgeMarkPath=path.match(/^\/api\/knowledge-marks\/([a-zA-Z0-9_-]+)$/);
  if(knowledgeMarkPath&&method==='DELETE') {
    const markId=knowledgeMarkPath[1],key=`knowledge/marks/${markId}.json`,stored=await env.BUCKET.get(key);if(!stored)return err('找不到標記',404);
    let mark;try{mark=JSON.parse(await stored.text())}catch{return err('標記資料格式錯誤',409)}
    if(mark.markedById!==user.id&&user.role!=='admin')return err('只有標記者或管理者可取消',403);
    await env.BUCKET.delete(key);await audit(env,user,'delete','knowledge_mark',markId,{postId:mark.postId});return json({ok:true});
  }
  const classicKind=url.searchParams.get('kind');
  if(path==='/api/classic-state' && method==='GET') {
    if(!['posts','projects'].includes(classicKind))return err('資料類型不正確');
    const prefix=`classic/${classicKind}/`,listing=await env.BUCKET.list({prefix,limit:1000});
    const rows=[];
    for(const object of listing.objects){const stored=await env.BUCKET.get(object.key);if(!stored)continue;try{const record=JSON.parse(await stored.text());if(!record.deleted)rows.push(record)}catch{}}
    if(classicKind==='posts'){
      const profiles=new Map();
      for(const row of rows){
        if(!row.actorId)continue;
        if(!profiles.has(row.actorId)){
          const object=await env.BUCKET.get('profiles/'+encodeURIComponent(row.actorId)+'.json');
          let profile=null;
          if(object)try{profile=JSON.parse(await object.text())}catch{}
          profiles.set(row.actorId,profile);
        }
        row.authorProfile=profiles.get(row.actorId);
      }
    }
    return json(rows);
  }
  const classicAttachmentPath=path.match(/^\/api\/classic-attachments\/([a-zA-Z0-9_-]+)$/);
  if(path==='/api/classic-attachments' && method==='POST') {
    const postId=s(url.searchParams.get('post'),120),name=s(url.searchParams.get('name'),240),mime=s(url.searchParams.get('mime'),80).toLowerCase();
    if(!/^[a-zA-Z0-9_-]+$/.test(postId)||!name||!['image/png','image/jpeg','image/gif','image/webp','image/bmp'].includes(mime))return err('郵件圖片資料不正確');
    const postObject=await env.BUCKET.get(`classic/posts/${postId}.json`);if(!postObject)return err('找不到對應貼文',404);
    let postRecord;try{postRecord=JSON.parse(await postObject.text())}catch{return err('貼文資料格式錯誤',409)}
    if(postRecord.deleted)return err('貼文已刪除',404);
    if(postRecord.actorId!==user.id&&user.role!=='admin')return err('只有發文者或管理者可新增郵件圖片',403);
    const length=Number(request.headers.get('content-length')||0);if(length>8*1024*1024)return err('單張圖片上限 8 MB',413);
    const data=await request.arrayBuffer();if(!data.byteLength||data.byteLength>8*1024*1024)return err('圖片大小需大於 0 且不超過 8 MB',413);
    const attachmentId=id(),objectKey=`classic/attachments/${attachmentId}.bin`;
    await env.BUCKET.put(objectKey,data,{httpMetadata:{contentType:mime}});
    await env.BUCKET.put(`classic/attachments/${attachmentId}.json`,JSON.stringify({id:attachmentId,postId,ownerId:user.id,name,mime,size:data.byteLength,objectKey}),{httpMetadata:{contentType:'application/json'}});
    await audit(env,user,'create','classic_attachment',attachmentId,{postId,name,mime,size:data.byteLength});
    return json({id:attachmentId,name,mime,size:data.byteLength},201);
  }
  if(classicAttachmentPath&&method==='GET') {
    const attachmentId=classicAttachmentPath[1],metadataObject=await env.BUCKET.get(`classic/attachments/${attachmentId}.json`);if(!metadataObject)return err('找不到郵件圖片',404);
    let metadata;try{metadata=JSON.parse(await metadataObject.text())}catch{return err('圖片資料格式錯誤',409)}
    const postObject=await env.BUCKET.get(`classic/posts/${metadata.postId}.json`);if(!postObject)return err('找不到對應貼文',404);
    let postRecord;try{postRecord=JSON.parse(await postObject.text())}catch{return err('貼文資料格式錯誤',409)}if(postRecord.deleted)return err('貼文已刪除',404);
    const image=await env.BUCKET.get(metadata.objectKey);if(!image)return err('圖片檔案不存在',404);
    const response=new Response(image.body,{headers:{'content-type':metadata.mime,'content-length':String(metadata.size),'content-disposition':`inline; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,'cache-control':'private, max-age=300','x-content-type-options':'nosniff'}});return response;
  }
  const classicPath=path.match(/^\/api\/classic-state\/(posts|projects)\/([a-zA-Z0-9_-]+)$/);
  if(classicPath && ['PUT','DELETE'].includes(method)) {
    const [,kind,entityId]=classicPath,key=`classic/${kind}/${entityId}.json`,stored=await env.BUCKET.get(key);
    let previous=null;if(stored)try{previous=JSON.parse(await stored.text())}catch{}
    if(method==='DELETE') {
      if(kind!=='posts'||!previous)return err('找不到貼文',404);
      if(previous.actorId!==user.id&&user.role!=='admin')return err('只有發文者或管理者可刪除',403);
      await env.BUCKET.put(key,JSON.stringify({...previous,deleted:true,updatedAt:now()}));
      await audit(env,user,'delete','classic_post',entityId);return json({ok:true});
    }
    const raw=await request.text();if(raw.length>9*1024*1024)return err('資料超過 9 MB',413);
    let entry;try{entry=JSON.parse(raw)}catch{return err('資料格式不正確')}
    if(!entry||entry.id!==entityId||typeof entry!=='object')return err('資料編號不一致');
    if(previous?.deleted)return err('此資料已刪除',409);
    if(kind==='posts'&&!previous&&user.role!=='admin'&&entry.author!==user.display_name&&!String(entry.author||'').startsWith(user.display_name+' ·'))return err('只能匯入自己的貼文',403);
    if(kind==='projects'&&!previous&&user.role!=='admin'&&user.unit!=='PM')return err('只有 PM 可建立型體',403);
    if(kind==='projects' && previous && user.role!=='admin'&&user.unit!=='PM') {
      const before=previous.data?.items||[],after=entry.items||[];
      if(before.some(item=>item.unit!==user.unit&&JSON.stringify(item)!==JSON.stringify(after.find(row=>row.id===item.id&&row.unit===item.unit))))return err('只能更新所屬單位的檢核',403);
    }
    let data=entry;
    if(kind==='posts'&&previous&&previous.actorId!==user.id&&user.role!=='admin') {
      const existing=previous.data,oldComments=existing.comments||[],incoming=entry.comments||[];
      const added=incoming.filter(comment=>!oldComments.some(row=>row.name===comment.name&&row.time===comment.time&&row.text===comment.text));
      data={...existing,comments:[...oldComments,...added]};
    }
    const record={id:entityId,data,actorId:previous?.actorId||user.id,updatedAt:now()};
    await env.BUCKET.put(key,JSON.stringify(record),{httpMetadata:{contentType:'application/json'}});
    await audit(env,user,previous?'update':'create',kind==='posts'?'classic_post':'classic_project',entityId);
    return json(record);
  }
  if(path==='/api/checklist-templates' && method==='GET') {
    const templates=JSON.parse(JSON.stringify(readinessTemplates));
    const changes=(await env.DB.prepare("SELECT entity_id,details FROM audit_events WHERE entity_type='checklist_template' ORDER BY created_at DESC").bind().all()).results;
    const seen=new Set();
    for(const change of changes){if(seen.has(change.entity_id)||!(change.entity_id in templates))continue;seen.add(change.entity_id);try{const rows=JSON.parse(change.details).items;if(Array.isArray(rows))templates[change.entity_id]=rows}catch{}}
    return json(templates);
  }
  if(path==='/api/checklist-templates' && method==='PUT') {
    const d=await body(request),unit=s(d.unit,60),items=d.items;
    if(!(unit in readinessTemplates))return err('找不到單位',404);
    if(user.role!=='admin'&&user.unit!=='PM'&&user.unit!==unit)return err('只能維護所屬單位的檢核項目',403);
    if(!Array.isArray(items)||items.length>300)return err('檢核項目數量不正確');
    const clean=items.map(item=>({id:s(item.id,50),zh:s(item.zh,500),vi:s(item.vi,500),en:s(item.en,500),owners:s(item.owners,300),targetRule:s(item.targetRule,300),dimension:s(item.dimension,80),source:s(item.source,500)}));
    if(clean.some(item=>!item.id||!item.zh)||new Set(clean.map(item=>item.id)).size!==clean.length)return err('檢核編號與內容不可重複或留空');
    const latest=await env.DB.prepare("SELECT details FROM audit_events WHERE entity_type='checklist_template' AND entity_id=? ORDER BY created_at DESC LIMIT 1").bind(unit).first();
    let previous=readinessTemplates[unit];try{if(latest)previous=JSON.parse(latest.details).items||previous}catch{}
    const oldIds=new Set(previous.map(item=>item.id)),newIds=new Set(clean.map(item=>item.id));
    for(const old of previous)if(!newIds.has(old.id))await env.DB.prepare('DELETE FROM checklist_items WHERE unit=? AND template_id=?').bind(unit,old.id).run();
    for(const item of clean){
      if(oldIds.has(item.id))await env.DB.prepare('UPDATE checklist_items SET title_zh=?,title_vi=?,title_en=?,target_rule=? WHERE unit=? AND template_id=?').bind(item.zh,item.vi,item.en,item.targetRule,unit,item.id).run();
      else {const models=(await env.DB.prepare('SELECT id FROM models').bind().all()).results;for(const model of models)await env.DB.prepare('INSERT INTO checklist_items(id,model_id,template_id,unit,title_zh,title_vi,title_en,target_rule,status,note) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id(),model.id,item.id,unit,item.zh,item.vi,item.en,item.targetRule,'pending','').run()}
    }
    await audit(env,user,'template_update','checklist_template',unit,{items:clean});return json({ok:true});
  }
  if(path==='/api/legacy-import' && method==='POST') {
    if(user.role!=='admin')return err('僅管理員可搬入舊資料',403);
    const d=await body(request),old=Array.isArray(d.posts)&&d.posts.length?d.posts.slice(0,500):legacySeed,projects=Array.isArray(d.projects)?d.projects.slice(0,100):[];
    let models=0,posts=0,comments=0,items=0;
    const ensureModel=async p=>{const code=s(p.model,50).toUpperCase(),color=s(p.color,50).toUpperCase();if(!code||!color)return null;let m=await env.DB.prepare('SELECT id FROM models WHERE code=? AND color=?').bind(code,color).first();if(m)return m.id;const mid=id(),time=now();await env.DB.prepare('INSERT INTO models VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(mid,code,color,s(p.season,40),s(p.factory,40),'preparation',s(p.launch,20),'',user.id,time,time).run();models++;for(const [unit,rows] of Object.entries(readinessTemplates))for(const row of rows)await env.DB.prepare('INSERT INTO checklist_items(id,model_id,template_id,unit,title_zh,title_vi,title_en,target_rule,status,note) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id(),mid,row.id,unit,s(row.zh,500),s(row.vi,500),s(row.en,500),s(row.targetRule||'',300),'pending','').run();return mid};
    for(const p of old){const mid=await ensureModel(p);if(!mid)continue;const key='legacy:'+s(p.id||p.model+'-'+p.color+'-'+p.title,150);if(await env.DB.prepare('SELECT id FROM posts WHERE source_hash=?').bind(key).first())continue;const pid=id(),time=now(),status=({block:'open',progress:'progress',verify:'verify',closed:'closed'})[p.status]||'open',authorName=s(p.author,100)||'MRC 舊資料',authorId='legacy:'+await hex(authorName);await env.DB.prepare('INSERT OR IGNORE INTO users(id,email,display_name,unit,role,created_at) VALUES(?,?,?,?,?,?)').bind(authorId,authorId.slice(7)+'@legacy.paleonet.demo',authorName,s(authorName.split(' · ')[1]||'MRC',60),'member',time).run();await env.DB.prepare('INSERT INTO posts(id,model_id,kind,title,body,status,owner_unit,due_at,source,source_hash,author_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(pid,mid,'issue',s(p.title,180),s(p.body,10000),status,s(p.owner,60),null,s(p.source,30)||'MRC',key,authorId,time,time).run();posts++;
      for(const c of (Array.isArray(p.comments)?p.comments.slice(0,100):[])){const content=s(c.text||c.body,3000);if(content){await env.DB.prepare('INSERT INTO comments VALUES(?,?,?,?,?)').bind(id(),pid,user.id,`${s(c.name,100)} · ${content}`,time).run();comments++}}
      for(const a of (Array.isArray(p.assignments)?p.assignments.slice(0,20):[])){await env.DB.prepare('INSERT INTO assignments VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id(),pid,null,null,s(a.assignee,60),s(a.request,500),({done:'done',progress:'progress',issue:'blocked'})[a.status]||'pending',s(a.due,20)||null,time,null).run()}
    }
    for(const p of projects){const mid=await ensureModel(p);if(!mid)continue;for(const entry of (Array.isArray(p.items)?p.items.slice(0,300):[])){const template=s(entry.id,50),unit=s(entry.unit,60);if(!template||!unit)continue;const row=await env.DB.prepare('SELECT id,status,note FROM checklist_items WHERE model_id=? AND template_id=? AND unit=?').bind(mid,template,unit).first();if(!row)continue;if(row.status!=='pending'||row.note)continue;const status=({done:'done',progress:'progress',issue:'issue',na:'na'})[entry.status]||'pending',note=s(entry.response||entry.note,3000);if(status!=='pending'||note){await env.DB.prepare('UPDATE checklist_items SET status=?,note=?,updated_at=?,updated_by=? WHERE id=?').bind(status,note,now(),user.id,row.id).run();items++}}}
    await audit(env,user,'legacy_import','migration','MRC',{models,posts,comments,items});return json({models,posts,comments,items});
  }
  if(path==='/api/users' && method==='GET') {
    for(const [account,profile] of Object.entries(JSON.parse(env.DEMO_PROFILES_JSON||'{}')).filter(([account])=>account!=='demo')){const uid='demo:'+account,email=account+'@paleonet.demo';await env.DB.prepare('INSERT OR IGNORE INTO users(id,email,display_name,unit,role,created_at) VALUES(?,?,?,?,?,?)').bind(uid,email,profile[0],profile[1],profile[2],now()).run()}
    const members=(await env.DB.prepare(`SELECT id,email,display_name name,unit,role,'active' access_status,created_at FROM users WHERE email NOT LIKE '%@legacy.paleonet.demo'
    UNION ALL SELECT NULL id,i.email,COALESCE(NULLIF(i.display_name,''),i.email) name,i.unit,i.role,'invited' access_status,i.created_at FROM invites i WHERE NOT EXISTS(SELECT 1 FROM users u WHERE lower(u.email)=lower(i.email))
    ORDER BY unit,name`).all()).results;
    await Promise.all(members.map(async member=>{
      if(!member.id)return;
      const object=await env.BUCKET.get('profiles/'+encodeURIComponent(member.id)+'.json');
      if(!object)return;
      try{const profile=JSON.parse(await object.text());member.avatar=profile.avatar||'';member.nickname=profile.nickname||''}catch{}
    }));
    return json(members);
  }
  if(path==='/api/messages' && method==='GET') {
    const withId=s(url.searchParams.get('with'),100);
    if(withId){
      if(withId===user.id)return err('無法與自己建立聊天',400);
      const other=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(withId).first();if(!other)return err('找不到成員',404);
      return json((await env.DB.prepare(`SELECT m.id,m.sender_id,m.recipient_id,m.body,m.created_at,s.display_name sender_name,s.unit sender_unit,r.display_name recipient_name,r.unit recipient_unit,a.message_id photo_id,a.name photo_name
        FROM direct_messages m JOIN users s ON s.id=m.sender_id JOIN users r ON r.id=m.recipient_id LEFT JOIN direct_message_attachments a ON a.message_id=m.id
        WHERE (m.sender_id=? AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=?) ORDER BY m.created_at ASC LIMIT 300`).bind(user.id,withId,withId,user.id).all()).results);
    }
    return json((await env.DB.prepare(`SELECT m.id,m.sender_id,m.recipient_id,m.body,m.created_at,s.display_name sender_name,s.unit sender_unit,r.display_name recipient_name,r.unit recipient_unit,a.message_id photo_id,a.name photo_name
      FROM direct_messages m JOIN users s ON s.id=m.sender_id JOIN users r ON r.id=m.recipient_id LEFT JOIN direct_message_attachments a ON a.message_id=m.id
      WHERE m.sender_id=? OR m.recipient_id=? ORDER BY m.created_at DESC LIMIT 500`).bind(user.id,user.id).all()).results);
  }
  const dmPhotoPath=path.match(/^\/api\/messages\/([^/]+)\/photo$/);
  if(dmPhotoPath && method==='POST') {
    const message=await env.DB.prepare('SELECT id FROM direct_messages WHERE id=? AND sender_id=?').bind(dmPhotoPath[1],user.id).first();if(!message)return err('找不到可附加照片的訊息',404);
    const mime=s(request.headers.get('content-type'),100),size=Number(request.headers.get('content-length')||0);if(!['image/jpeg','image/png','image/webp','image/gif'].includes(mime)||size>8*1024*1024)return err('請上傳 8 MB 以下 JPG、PNG、WebP 或 GIF 照片');const raw=await request.arrayBuffer();if(raw.byteLength>8*1024*1024)return err('檔案太大');
    const key=`messages/${message.id}/${id()}`;await env.BUCKET.put(key,raw,{httpMetadata:{contentType:mime}});await env.DB.prepare('INSERT OR REPLACE INTO direct_message_attachments(message_id,user_id,object_key,name,mime,size,created_at) VALUES(?,?,?,?,?,?,?)').bind(message.id,user.id,key,s(url.searchParams.get('name'),180)||'chat-photo',mime,raw.byteLength,now()).run();return json({ok:true});
  }
  const dmFilePath=path.match(/^\/api\/message-files\/([^/]+)$/);
  if(dmFilePath && method==='GET') {
    const attachment=await env.DB.prepare('SELECT a.* FROM direct_message_attachments a JOIN direct_messages m ON m.id=a.message_id WHERE a.message_id=? AND (m.sender_id=? OR m.recipient_id=?)').bind(dmFilePath[1],user.id,user.id).first();if(!attachment)return err('找不到照片',404);const obj=await env.BUCKET.get(attachment.object_key);if(!obj)return err('照片不存在',404);return new Response(obj.body,{headers:{'content-type':attachment.mime,'cache-control':'private, max-age=300','x-content-type-options':'nosniff'}});
  }
  if(path==='/api/messages' && method==='POST') {
    const d=await body(request),to=s(d.to,100),text=s(d.body,4000);
    if(!to||to===user.id||!text)return err('請選擇成員並輸入訊息');
    if(!await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(to).first())return err('找不到成員',404);
    const mid=id(),time=now();await env.DB.prepare('INSERT INTO direct_messages(id,sender_id,recipient_id,body,created_at) VALUES(?,?,?,?,?)').bind(mid,user.id,to,text,time).run();
    await audit(env,user,'send','direct_message',mid,{recipient_id:to,characters:text.length});return json({id:mid,created_at:time},201);
  }
  if(path==='/api/invites' && method==='GET') return user.role==='admin'?json((await env.DB.prepare('SELECT email,display_name,unit,role,created_at FROM invites ORDER BY created_at DESC').all()).results):err('權限不足',403);
  if(path==='/api/invites' && method==='POST') {
    if(user.role!=='admin') return err('權限不足',403);
    const d=await body(request),email=s(d.email,320).toLowerCase(),unit=s(d.unit,60),name=s(d.name,100);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!unit) return err('請輸入有效郵件與單位');
    const role=d.role==='admin'?'admin':'member';
    await env.DB.prepare('INSERT INTO invites VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,unit=excluded.unit,role=excluded.role').bind(email,name||email,unit,role,user.id,now()).run();
    await audit(env,user,'invite','user',email,{unit,role});return json({ok:true});
  }
  if(path==='/api/knowledge' && method==='GET') {
    const [modelRows,postRows,itemRows,commentRows,historyRows]=await Promise.all([
      env.DB.prepare('SELECT m.id,m.code,m.color,m.season,m.factory,m.phase,m.launch_date,m.readiness_date,m.updated_at,u.display_name creator FROM models m LEFT JOIN users u ON m.creator_id=u.id ORDER BY m.updated_at DESC LIMIT 300').all(),
      env.DB.prepare("SELECT p.id,p.model_id,p.kind,p.title,p.body,p.status,p.owner_unit,p.due_at,p.source,p.created_at,p.updated_at,u.display_name author,u.unit author_unit FROM posts p LEFT JOIN users u ON p.author_id=u.id WHERE COALESCE(p.source,'')!='deleted' ORDER BY p.created_at DESC LIMIT 1000").all(),
      env.DB.prepare('SELECT c.id,c.model_id,c.template_id,c.unit,c.title_zh,c.title_vi,c.title_en,c.target_rule,c.status,c.note,c.updated_at,c.updated_by,u.display_name updated_by_name FROM checklist_items c LEFT JOIN users u ON c.updated_by=u.id ORDER BY c.model_id,c.unit,c.template_id LIMIT 50000').all(),
      env.DB.prepare('SELECT c.id,c.post_id,c.body,c.created_at,u.display_name author,u.unit author_unit FROM comments c LEFT JOIN users u ON c.author_id=u.id ORDER BY c.created_at LIMIT 10000').all(),
      env.DB.prepare("SELECT a.entity_id,a.details,a.created_at,u.display_name actor FROM audit_events a LEFT JOIN users u ON a.actor_id=u.id WHERE a.entity_type='checklist' ORDER BY a.created_at DESC LIMIT 10000").all()
    ]);
    const models=modelRows.results||[],byId=new Map(models.map(row=>[row.id,{...row,items:[],posts:[]}])),commentsByPost=new Map(),historyByItem=new Map();
    for(const row of commentRows.results||[]){if(!commentsByPost.has(row.post_id))commentsByPost.set(row.post_id,[]);commentsByPost.get(row.post_id).push({id:row.id,name:row.author||'Unknown',unit:row.author_unit||'',time:row.created_at,text:row.body||''})}
    for(const row of historyRows.results||[]){if(!historyByItem.has(row.entity_id))historyByItem.set(row.entity_id,[]);let details={};try{details=JSON.parse(row.details||'{}')}catch{}historyByItem.get(row.entity_id).push({at:row.created_at,by:row.actor||'',...details})}
    for(const row of itemRows.results||[]){const product=byId.get(row.model_id);if(product)product.items.push({...row,history:historyByItem.get(row.id)||[]})}
    const unmatchedPosts=[];
    for(const row of postRows.results||[]){const product=byId.get(row.model_id),post={...row,model:product?.code||'',color:product?.color||'',comments:commentsByPost.get(row.id)||[],databasePost:true};if(product)product.posts.push(post);else unmatchedPosts.push(post)}
    return json({products:[...byId.values()],unmatchedPosts,source:'models-posts-checklist-comments'});
  }
  if(path==='/api/models' && method==='GET') return json((await env.DB.prepare(`SELECT m.*,u.display_name creator,(SELECT COUNT(*) FROM posts p WHERE p.model_id=m.id AND p.status!='closed') open_count,(SELECT COUNT(*) FROM checklist_items c WHERE c.model_id=m.id) check_total,(SELECT COUNT(*) FROM checklist_items c WHERE c.model_id=m.id AND c.status IN ('done','na')) check_done,(SELECT COUNT(*) FROM checklist_items c WHERE c.model_id=m.id AND c.status='issue') check_issue FROM models m JOIN users u ON m.creator_id=u.id ORDER BY m.updated_at DESC LIMIT 300`).all()).results);
  if(path==='/api/models' && method==='POST') {
    if(user.role!=='admin' && user.unit!=='PM') return err('只有 PM 可建立型體',403);
    const d=await body(request),code=s(d.code,50).toUpperCase(),color=s(d.color,50).toUpperCase();if(!code||!color)return err('型體與配色必填');
    const mid=id(),time=now();
    try { await env.DB.prepare('INSERT INTO models VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(mid,code,color,s(d.season,40),s(d.factory,40),s(d.phase,30)||'preparation',s(d.launchDate,20),s(d.readinessDate,20),user.id,time,time).run(); }
    catch(e) { if(String(e).includes('UNIQUE')) return err('此型體配色已建立',409); throw e; }
    for(const [unit,items] of Object.entries(readinessTemplates)) for(const item of items) {
      await env.DB.prepare('INSERT INTO checklist_items(id,model_id,template_id,unit,title_zh,title_vi,title_en,target_rule,status,note) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id(),mid,item.id,unit,s(item.zh,500),s(item.vi,500),s(item.en,500),s(item.targetRule||item.target||'',300),'pending','').run();
    }
    await audit(env,user,'create','model',mid);return json({id:mid},201);
  }
  const modelPath=path.match(/^\/api\/models\/([^/]+)$/);
  const checklistPath=path.match(/^\/api\/models\/([^/]+)\/checklist$/);
  if(checklistPath && method==='GET'){
    const rows=(await env.DB.prepare('SELECT c.*,u.display_name updated_by_name FROM checklist_items c LEFT JOIN users u ON u.id=c.updated_by WHERE c.model_id=? ORDER BY c.unit,c.template_id').bind(checklistPath[1]).all()).results;
    const history=(await env.DB.prepare("SELECT a.entity_id,a.details,a.created_at,u.display_name actor FROM audit_events a JOIN users u ON u.id=a.actor_id WHERE a.entity_type='checklist' AND a.entity_id IN (SELECT id FROM checklist_items WHERE model_id=?) ORDER BY a.created_at DESC").bind(checklistPath[1]).all()).results;
    const byItem=new Map();for(const event of history){if(!byItem.has(event.entity_id))byItem.set(event.entity_id,[]);byItem.get(event.entity_id).push({at:event.created_at,by:event.actor,...JSON.parse(event.details)})}
    return json(rows.map(row=>({...row,history:byItem.get(row.id)||[]})));
  }
  const checklistItem=path.match(/^\/api\/checklist\/([^/]+)$/);
  if(checklistItem && method==='PATCH'){
    const item=await env.DB.prepare('SELECT * FROM checklist_items WHERE id=?').bind(checklistItem[1]).first();if(!item)return err('找不到檢核項目',404);
    if(user.role!=='admin'&&user.unit!==item.unit)return err('僅負責單位或管理員可更新',403);
    const d=await body(request),status=['pending','progress','done','issue','na'].includes(d.status)?d.status:item.status,note=s(d.note,3000),time=now();
    if(!note && status!==item.status)return err('請記錄本次進度或備註');
    await env.DB.prepare('UPDATE checklist_items SET status=?,note=?,updated_at=?,updated_by=? WHERE id=?').bind(status,note,time,user.id,item.id).run();
    await audit(env,user,'checklist_update','checklist',item.id,{modelId:item.model_id,unit:item.unit,status,note});return json({ok:true});
  }
  if(modelPath && method==='PATCH') {
    if(user.role!=='admin' && user.unit!=='PM')return err('只有 PM 可更新型體節點',403);
    const d=await body(request),phase=['preparation','trial','validation','prelaunch','production'].includes(d.phase)?d.phase:'preparation';
    await env.DB.prepare('UPDATE models SET phase=?,launch_date=?,readiness_date=?,updated_at=? WHERE id=?').bind(phase,s(d.launchDate,20),s(d.readinessDate,20),now(),modelPath[1]).run();
    await audit(env,user,'update','model',modelPath[1],{phase});return json({ok:true});
  }
  if(path==='/api/posts' && method==='GET') return json(await listPosts(env,user,url));
  if(path==='/api/posts' && method==='POST') {
    const d=await body(request),model=await env.DB.prepare('SELECT id FROM models WHERE id=?').bind(s(d.modelId,50)).first();
    if(!model)return err('請先選擇型體');const title=s(d.title,180),text=s(d.body,10000);if(!title)return err('問題標題必填');
    const pid=id(),time=now(),kind=d.kind==='discussion'?'discussion':'issue';
    try { await env.DB.prepare('INSERT INTO posts(id,model_id,kind,title,body,status,owner_unit,due_at,source,source_hash,author_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(pid,model.id,kind,title,text,'open',s(d.ownerUnit,60),d.dueAt||null,s(d.source,30)||'manual',d.sourceHash||null,user.id,time,time).run(); }
    catch(e){if(String(e).includes('UNIQUE'))return err('這封郵件已匯入',409);throw e;}
    const assignees=Array.isArray(d.assignments)?d.assignments.slice(0,20):[];
    for(const item of assignees){const unit=s(item.unit,60),email=s(item.email,320).toLowerCase(),req=s(item.request,500),due=s(item.dueAt,20)||null;if(!unit&&!email)continue;
      const target=email?await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first():null;
      await env.DB.prepare('INSERT INTO assignments VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id(),pid,target?.id||null,email||null,unit,req,'pending',due,time,null).run();}
    await notify(env,pid,user,assignees);await audit(env,user,'create','post',pid,{kind,assignments:assignees.length});return json({id:pid},201);
  }
  const postPath=path.match(/^\/api\/posts\/([^/]+)$/);
  if(postPath && method==='GET'){
    const p=await env.DB.prepare("SELECT p.*,m.code,m.color,m.launch_date,u.display_name author,u.unit author_unit FROM posts p JOIN models m ON p.model_id=m.id JOIN users u ON p.author_id=u.id WHERE p.id=? AND p.source!='deleted'").bind(postPath[1]).first();if(!p)return err('找不到貼文',404);
    const [assignments,comments,attachments,history]=await Promise.all([
      env.DB.prepare('SELECT a.*,u.display_name assignee FROM assignments a LEFT JOIN users u ON u.id=a.assignee_id WHERE a.post_id=? ORDER BY a.rowid').bind(p.id).all(),
      env.DB.prepare('SELECT c.*,u.display_name author,u.unit FROM comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=? ORDER BY c.created_at').bind(p.id).all(),
      env.DB.prepare('SELECT id,post_id,comment_id,name,mime,size,created_at FROM attachments WHERE post_id=? ORDER BY created_at').bind(p.id).all(),
      env.DB.prepare("SELECT a.*,u.display_name actor FROM audit_events a JOIN users u ON u.id=a.actor_id WHERE a.entity_id=? OR (a.entity_type='assignment' AND a.entity_id IN (SELECT id FROM assignments WHERE post_id=?)) ORDER BY a.created_at DESC LIMIT 100").bind(p.id,p.id).all()]);
    return json({...p,assignments:assignments.results,comments:comments.results,attachments:attachments.results,history:history.results});
  }
  if(postPath && method==='PATCH'){
    const d=await body(request),p=await env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(postPath[1]).first();if(!p)return err('找不到貼文',404);
    if(user.id!==p.author_id&&user.role!=='admin'&&user.unit!==p.owner_unit)return err('權限不足',403);
    const status=allowedStatus.has(d.status)?d.status:p.status,note=s(d.note,3000);
    if(status==='closed'&&!note)return err('結案時請填驗證結果');
    await env.DB.prepare('UPDATE posts SET status=?,updated_at=?,closed_at=? WHERE id=?').bind(status,now(),status==='closed'?now():null,p.id).run();
    if(note)await env.DB.prepare('INSERT INTO comments VALUES(?,?,?,?,?)').bind(id(),p.id,user.id,note,now()).run();
    await audit(env,user,'status','post',p.id,{from:p.status,to:status,note});return json({ok:true});
  }
  if(postPath && method==='DELETE'){
    const p=await env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(postPath[1]).first();if(!p)return err('找不到貼文',404);
    if(user.id!==p.author_id&&user.role!=='admin')return err('權限不足',403);
    const time=now();await env.DB.prepare("UPDATE posts SET status='closed',source='deleted',updated_at=?,closed_at=? WHERE id=?").bind(time,time,p.id).run();await audit(env,user,'delete','post',p.id);return json({ok:true});
  }
  if(path==='/api/comments' && method==='POST'){
    const d=await body(request),pid=s(d.postId,50),p=await env.DB.prepare('SELECT id FROM posts WHERE id=?').bind(pid).first();if(!p)return err('找不到貼文',404);
    const content=s(d.body,3000);if(!content)return err('請填回覆');const cid=id(),time=now();
    await env.DB.prepare('INSERT INTO comments VALUES(?,?,?,?,?)').bind(cid,pid,user.id,content,time).run();
    await env.DB.prepare('UPDATE posts SET updated_at=? WHERE id=?').bind(time,pid).run();await audit(env,user,'comment','post',pid,{commentId:cid});return json({id:cid},201);
  }
  const assignmentPath=path.match(/^\/api\/assignments\/([^/]+)$/);
  if(assignmentPath && method==='PATCH'){
    const a=await env.DB.prepare('SELECT a.*,p.author_id,p.owner_unit FROM assignments a JOIN posts p ON a.post_id=p.id WHERE a.id=?').bind(assignmentPath[1]).first();if(!a)return err('找不到指定回饋',404);
    if(user.role!=='admin'&&user.id!==a.author_id&&user.id!==a.assignee_id&&user.unit!==a.unit&&user.unit!==a.owner_unit)return err('權限不足',403);
    const d=await body(request),status=['pending','progress','done','blocked'].includes(d.status)?d.status:a.status,note=s(d.note,3000);
    if(!note)return err('請記錄本次進度或備註');const time=now();
    await env.DB.prepare('UPDATE assignments SET status=?,updated_at=?,updated_by=? WHERE id=?').bind(status,time,user.id,a.id).run();
    await env.DB.prepare('INSERT INTO comments VALUES(?,?,?,?,?)').bind(id(),a.post_id,user.id,`@${a.unit||a.assignee_email} · ${note}`,time).run();
    await env.DB.prepare('UPDATE posts SET updated_at=? WHERE id=?').bind(time,a.post_id).run();await audit(env,user,'assignment_update','assignment',a.id,{status,note});return json({ok:true});
  }
  if(path==='/api/notifications' && method==='GET'){
    const due=(await env.DB.prepare("SELECT a.*,p.title FROM assignments a JOIN posts p ON p.id=a.post_id WHERE a.status!='done' AND p.status!='closed' AND a.due_at < ? AND (a.assignee_id=? OR (a.assignee_id IS NULL AND a.assignee_email=?) OR (a.assignee_id IS NULL AND a.assignee_email IS NULL AND a.unit=?)) LIMIT 50").bind(now().slice(0,10),user.id,user.email,user.unit).all()).results;
    for(const a of due){const existing=await env.DB.prepare("SELECT id FROM notifications WHERE user_id=? AND post_id=? AND kind='overdue' AND substr(created_at,1,10)=?").bind(user.id,a.post_id,now().slice(0,10)).first();if(!existing)await env.DB.prepare('INSERT INTO notifications VALUES(?,?,?,?,?,?,?,NULL)').bind(id(),user.id,a.post_id,a.updated_by||a.author_id||user.id,'overdue',`已逾期：${a.request||a.title}`,now()).run()}
    return json((await env.DB.prepare('SELECT n.*,p.title,m.code,m.color FROM notifications n JOIN posts p ON p.id=n.post_id JOIN models m ON m.id=p.model_id WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 100').bind(user.id).all()).results);
  }
  const noticePath=path.match(/^\/api\/notifications\/([^/]+)$/);
  if(noticePath&&method==='PATCH'){await env.DB.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').bind(now(),noticePath[1],user.id).run();return json({ok:true});}
  if(path==='/api/upload'&&method==='POST'){
    const postId=s(url.searchParams.get('post'),50),commentId=s(url.searchParams.get('comment'),50),mime=s(request.headers.get('content-type'),100);
    const size=Number(request.headers.get('content-length')||0);if(!postId||!mime.startsWith('image/')||size>8*1024*1024)return err('僅可上傳 8 MB 以下照片');
    if(!await env.DB.prepare('SELECT id FROM posts WHERE id=?').bind(postId).first())return err('找不到貼文',404);
    const raw=await request.arrayBuffer();if(raw.byteLength>8*1024*1024)return err('檔案太大');
    const aid=id(),key=`posts/${postId}/${aid}`;await env.BUCKET.put(key,raw,{httpMetadata:{contentType:mime}});
    await env.DB.prepare('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?)').bind(aid,postId,commentId||null,user.id,key,s(url.searchParams.get('name'),180)||'照片',mime,raw.byteLength,now()).run();
    await audit(env,user,'upload','attachment',aid,{postId,size:raw.byteLength});return json({id:aid},201);
  }
  const filePath=path.match(/^\/api\/files\/([^/]+)$/);
  if(filePath&&method==='GET'){
    const file=await env.DB.prepare('SELECT * FROM attachments WHERE id=?').bind(filePath[1]).first();if(!file)return err('找不到照片',404);
    const obj=await env.BUCKET.get(file.object_key);if(!obj)return err('照片不存在',404);
    return new Response(obj.body,{headers:{'content-type':file.mime,'cache-control':'private, max-age=300','x-content-type-options':'nosniff'}});
  }
  if(path==='/api/report'&&method==='GET'){
    const rows=await listPosts(env,user,new URL(request.url));const csv=[['型體','配色','問題','狀態','主責單位','期限','建立人','建立時間'],...rows.map(p=>[p.code,p.color,p.title,p.status,p.owner_unit,p.due_at||'',p.author,p.created_at])].map(row=>row.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
    await audit(env,user,'download','report','meeting',{count:rows.length});return new Response('\uFEFF'+csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="PaleoNet-meeting.csv"','cache-control':'no-store'}});
  }
  if(path==='/api/audit'&&method==='GET')return user.role==='admin'?json((await env.DB.prepare('SELECT a.*,u.display_name actor FROM audit_events a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100').all()).results):err('權限不足',403);
  return err('找不到功能',404);
}
export default {async fetch(request,env) {
  const url=new URL(request.url);
  try {
    if(url.pathname.startsWith('/api/'))return await handleApi(request,{...env,BUCKET:env.BUCKET||createD1Bucket(env.DB)},url);
    if(url.pathname==='/'||url.pathname==='/index.html')return Response.redirect(url.origin+'/classic/index.html',302);
    if(url.pathname==='/classic'||url.pathname==='/classic/')return Response.redirect(url.origin+'/classic/index.html',302);
    const path=url.pathname==='/'?'/index.html':url.pathname;
    if(path.includes('..'))return err('無效路徑',400);
    const asset=assets[path];if(!asset)return new Response('Not found',{status:404});
    const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
    return new Response(bytes,{headers:{'content-type':asset.type,'cache-control':'no-cache','x-content-type-options':'nosniff'}});
  } catch(e) {if(e instanceof StorageError)return err(e.message,e.status);return err('系統暫時無法處理，請稍後重試',500);}
}};
