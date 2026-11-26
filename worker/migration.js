
// Admin-only, server-to-server migration from the user's original Sites project.
// Credentials are supplied per request, used only in memory, and never archived.
const SOURCE = 'https://product-social-network.blnise.chatgpt.site';
const MAX_IMAGE = 1024 * 1024;
const response = (value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))).map(b=>b.toString(16).padStart(2,'0')).join('');
const validId = value => typeof value==='string' && /^[a-zA-Z0-9_:\-\u3400-\u9fff]{1,160}$/.test(value);
export async function handleMigration(request,env,user,fetcher=fetch,hash=digest) {
  if(user.role!=='admin')return response({error:'請先以 tino 管理員登入新站'},403);
  try {
    const d=await request.json();
    if(!['preview','import','report'].includes(d.action))return response({error:'不支援的搬遷操作'},400);
    if(d.action==='report'){
      const id=crypto.randomUUID();
      const report={id,source:SOURCE,at:new Date().toISOString(),actorId:user.id,results:d.results};
      await env.BUCKET.put('migration/reports/'+id+'.json',JSON.stringify(report));
      return response({id});
    }
    if(!d.sourceAccount||!d.sourcePassword)return response({error:'請填入原 Sites 帳號與密碼'},400);
    const headers={'content-type':'application/json',origin:SOURCE};
    if(d.sourceToken)headers['OAI-Sites-Authorization']=d.sourceToken;
    const login=await fetcher(SOURCE+'/api/login',{method:'POST',redirect:'error',headers,body:JSON.stringify({account:d.sourceAccount,password:d.sourcePassword})});
    if(!login.ok)return response({error:'原 Sites 登入失敗；請確認原站帳密與存取權限'},502);
    const session=login.headers.get('set-cookie')?.match(/paleo_session=[a-f0-9]{64}/)?.[0];
    if(!session)return response({error:'原站沒有回傳有效登入 Cookie'},502);
    const sourceHeaders={cookie:session};
    if(d.sourceToken)sourceHeaders['OAI-Sites-Authorization']=d.sourceToken;
    const read=async path=>{
      const r=await fetcher(SOURCE+path,{headers:sourceHeaders,redirect:'error'});
      if(!r.ok)throw Error('原站讀取失敗：'+path+'（'+r.status+'）');
      return r;
    };
    const readJSON=async path=>(await read(path)).json();
    const sourceData=async kind=>{
      if(kind==='posts'||kind==='projects')return readJSON('/api/classic-state?kind='+kind);
      if(kind==='knowledge')return readJSON('/api/knowledge-marks');
      if(kind==='templates')return readJSON('/api/checklist-templates');
      if(kind==='profiles')return readJSON('/api/users');
      throw Error('不支援的資料類型');
    };
    if(d.action==='preview'){
      const posts=await sourceData('posts'),projects=await sourceData('projects'),knowledge=await sourceData('knowledge'),templates=await sourceData('templates'),users=await sourceData('profiles');
      if(!Array.isArray(posts)||!Array.isArray(projects)||!Array.isArray(knowledge)||!Array.isArray(users))throw Error('原站資料格式不正確');
      const entries=[];
      for(const [kind,records] of [['posts',posts],['projects',projects],['knowledge',knowledge]])for(const r of records)entries.push({kind,id:r.id,bytes:new TextEncoder().encode(JSON.stringify(r)).length});
      for(const [unit,items] of Object.entries(templates))entries.push({kind:'templates',id:unit,bytes:new TextEncoder().encode(JSON.stringify(items)).length});
      for(const u of users.filter(u=>/^demo:tino[0-3]?$/.test(u.id||'')&&(u.nickname||u.avatar)))entries.push({kind:'profiles',id:u.id,bytes:new TextEncoder().encode(JSON.stringify({nickname:u.nickname||'',avatar:u.avatar||''})).length});
      for(const p of posts)for(const a of p.data?.mailAttachments||[])entries.push({kind:'attachment',id:a.attachmentId,postId:p.id,name:a.name,bytes:a.size});
      return response({source:SOURCE,posts:posts.length,comments:posts.reduce((n,p)=>n+(p.data?.comments||[]).length,0),projects:projects.length,checklistItems:projects.reduce((n,p)=>n+(p.data?.items||[]).length,0),images:entries.filter(e=>e.kind==='attachment').length,entries});
    }
    const {kind,id}=d;
    if(!validId(id))return response({error:'資料識別碼不正確'},400);
    let key,record,sourceHash;
    if(kind==='attachment'){
      if(!validId(d.postId))return response({error:'缺少圖片所屬貼文'},400);
      const posts=await sourceData('posts'),post=posts.find(p=>p.id===d.postId),a=post?.data?.mailAttachments?.find(a=>a.attachmentId===id);
      if(!a)throw Error('原站圖片清單不存在這張圖片');
      if(a.size>MAX_IMAGE)return response({error:'圖片超過 1 MiB，未壓縮或刪減原圖',kind,id},413);
      const binary=await read('/api/classic-attachments/'+encodeURIComponent(id)),bytes=await binary.arrayBuffer();
      if(bytes.byteLength!==a.size||bytes.byteLength>MAX_IMAGE)throw Error('原站圖片大小與清單不一致');
      sourceHash=await hash(bytes);
      const objectKey='classic/attachments/'+id+'.bin',metaKey='classic/attachments/'+id+'.json';
      const existing=await env.BUCKET.get(objectKey);
      if(existing && await hash(await existing.arrayBuffer())!==sourceHash)return response({status:'conflict',kind,id,error:'新站同編號圖片不同，保留新站原圖'},409);
      const oldMeta=await env.BUCKET.get(metaKey);
      const metadata={id,postId:d.postId,ownerId:post.actorId||user.id,name:a.name,mime:a.mime,size:bytes.byteLength,objectKey};
      if(oldMeta){
        const prior=JSON.parse(await oldMeta.text());
        if(prior.postId!==metadata.postId||prior.size!==metadata.size||prior.name!==metadata.name)return response({status:'conflict',kind,id,error:'新站圖片資訊不同，未覆蓋'},409);
      }
      const parent=await env.BUCKET.get('classic/posts/'+d.postId+'.json');if(!parent)throw Error('請先搬入圖片所屬貼文');
      if(!existing)await env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:a.mime}});
      if(!oldMeta)await env.BUCKET.put(metaKey,JSON.stringify(metadata),{httpMetadata:{contentType:'application/json'}});
      const stored=await env.BUCKET.get(objectKey),targetHash=await hash(await stored.arrayBuffer());
      if(targetHash!==sourceHash)throw Error('圖片搬遷後雜湊核對失敗');
      return response({status:existing&&oldMeta?'duplicate':'imported',kind,id,bytes:bytes.byteLength,sourceHash,targetHash});
    }
    const data=await sourceData(kind);
    if(kind==='templates'){
      record=data[id];if(!Array.isArray(record))throw Error('找不到原站檢核模板');
      sourceHash=await hash(JSON.stringify(record));
      const existing=await env.DB.prepare("SELECT details FROM audit_events WHERE entity_type='checklist_template' AND entity_id=? ORDER BY created_at DESC LIMIT 1").bind(id).first();
      if(existing){
        const prior=JSON.parse(existing.details);
        if(await hash(JSON.stringify(prior.items))===sourceHash)return response({status:'duplicate',kind,id,sourceHash,targetHash:sourceHash});
        await env.BUCKET.put('migration/conflicts/templates/'+id+'.json',JSON.stringify(record));
        return response({status:'conflict',kind,id,error:'新站已有不同檢核模板，原站版本另行保留'},409);
      }
      const detail=JSON.stringify({items:record,migrationSource:SOURCE,sourceHash});
      await env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),user.id,'migration','checklist_template',id,detail,new Date().toISOString()).run();
      const check=await env.DB.prepare("SELECT details FROM audit_events WHERE entity_type='checklist_template' AND entity_id=? ORDER BY created_at DESC LIMIT 1").bind(id).first();
      const targetHash=await hash(JSON.stringify(JSON.parse(check.details).items));
      if(targetHash!==sourceHash)throw Error('檢核模板核對失敗');
      return response({status:'imported',kind,id,sourceHash,targetHash});
    }
    if(kind==='profiles'){
      const u=data.find(u=>u.id===id);if(!u)throw Error('找不到原站個人檔案');
      record={nickname:u.nickname||'',avatar:u.avatar||''};key='profiles/'+encodeURIComponent(id)+'.json';
    }else{
      record=data.find(r=>r.id===id);if(!record)throw Error('找不到原站資料');
      key=kind==='knowledge'?'knowledge/marks/'+id+'.json':'classic/'+kind+'/'+id+'.json';
    }
    sourceHash=await hash(JSON.stringify(record));
    // Preserve an exact private source snapshot before changing target records.
    await env.BUCKET.put('migration/source/'+kind+'/'+id+'.json',JSON.stringify(record));
    const existing=await env.BUCKET.get(key);
    if(existing){
      const prior=JSON.parse(await existing.text());
      const priorSourceHash=prior.migration?.sourceHash;
      const sameSource=priorSourceHash===sourceHash;
      const unchanged=sameSource && JSON.stringify(prior.data)===JSON.stringify(record.data);
      const sameRecord=await hash(JSON.stringify(prior))===sourceHash;
      if(unchanged||sameRecord)return response({status:'duplicate',kind,id,sourceHash,targetHash:sourceHash});
      return response({status:'conflict',kind,id,error:'新站同編號資料已存在，未覆蓋；原站完整內容已另存快照'},409);
    }
    if(kind==='posts'||kind==='projects')record={...record,migration:{source:SOURCE,sourceHash,sourceActorId:record.actorId,sourceAuthorProfile:record.authorProfile||null,importedAt:new Date().toISOString()}};
    await env.BUCKET.put(key,JSON.stringify(record),{httpMetadata:{contentType:'application/json'}});
    const check=await env.BUCKET.get(key),stored=JSON.parse(await check.text());
    const original={...stored};if(kind==='posts'||kind==='projects')delete original.migration;
    const targetHash=await hash(JSON.stringify(original));
    if(targetHash!==sourceHash)throw Error('資料搬遷後雜湊核對失敗');
    return response({status:'imported',kind,id,sourceHash,targetHash});
  }catch(error){return response({error:error.message||'搬遷失敗'},error.status||502)}
}
