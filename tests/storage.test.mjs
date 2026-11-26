import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createD1Bucket,FILE_LIMIT,OBJECT_BUDGET} from '../worker/storage.js';
import app from '../dist/server/index.js';
const db=new DatabaseSync(':memory:');
for(const f of ['0000_paleonet.sql','0001_demo_sessions.sql','0002_direct_messages.sql'])db.exec((await import('node:fs')).readFileSync('drizzle/'+f,'utf8'));
const DB={prepare(sql){let args=[];return {bind(...v){args=v.map(x=>x instanceof ArrayBuffer?new Uint8Array(x):x);return this},first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>db.prepare(sql).run(...args)}},async batch(stmts){db.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.all());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
const store=createD1Bucket(DB);
await store.put('test/unicode','中文 🌏',{httpMetadata:{contentType:'text/plain'}});
assert.equal(await (await store.get('test/unicode')).text(),'中文 🌏');
const original=new Uint8Array([0,255,128,0,10]);await store.put('test/binary',original);
assert.deepEqual(new Uint8Array(await (await store.get('test/binary')).arrayBuffer()),original);
const before=await store.stats();await store.put('test/binary',new Uint8Array([1]));const after=await store.stats();assert.equal(before.objectBytes-after.objectBytes,4);
await store.put('test/x_1','x');await store.put('test/xA1','y');assert.equal((await store.list({prefix:'test/x_'})).objects.length,1);
const first=await store.list({prefix:'test/',limit:2});assert.equal(first.truncated,true);const second=await store.list({prefix:'test/',limit:2,cursor:first.cursor});assert.equal(first.objects.length+second.objects.length,4);
await assert.rejects(store.put('too-large',new Uint8Array(FILE_LIMIT+1)),e=>e.status===413);
assert.equal(await store.get('too-large'),null);
await store.delete('test/binary');assert.equal(await store.get('test/binary'),null);await store.delete('not-found');
const actualUsage=(await store.stats()).objectBytes;
db.prepare('UPDATE storage_usage SET bytes=? WHERE id=1').run(OBJECT_BUDGET);
await assert.rejects(store.put('over-budget','x'),e=>e.status===507);assert.equal(await store.get('over-budget'),null);
// Smaller replacements are allowed at the quota boundary, without a transient double charge.
await store.put('test/unicode','a');
db.prepare('UPDATE storage_usage SET bytes=(SELECT COALESCE(SUM(size),0) FROM storage_objects) WHERE id=1').run();
const used=await store.stats();assert.ok(used.objectBytes<actualUsage);
const password=crypto.randomUUID();const profiles={tino:['Tino','PM','admin'],tino1:['Tino 1','DCC','member'],tino2:['Tino 2','PED','member'],tino3:['Tino 3','QM','member']};
const env={DB,DEMO_PASSWORD:password,DEMO_PROFILES_JSON:JSON.stringify(profiles)};
const cookies={};
async function req(path,account,method='GET',data,raw=false){const headers={origin:'https://test.example',...(cookies[account]?{cookie:cookies[account]}:{})};if(data!==undefined)headers['content-type']=raw?'image/png':'application/json';return app.fetch(new Request('https://test.example'+path,{method,headers,body:data===undefined?undefined:raw?data:JSON.stringify(data)}),env)}
for(const account of Object.keys(profiles)){const r=await req('/api/login',account,'POST',{account,password});assert.equal(r.status,200,await r.clone().text());cookies[account]=r.headers.get('set-cookie').split(';')[0];}
const members=await (await req('/api/users','tino')).json();for(const a of Object.keys(profiles))assert.ok(members.some(m=>m.id==='demo:'+a));
const post={id:'SHARE',author:'Tino',model:'TEST-1',color:'TEST-001',title:'Shared',comments:[]};assert.equal((await req('/api/classic-state/posts/SHARE','tino','PUT',post)).status,200);
assert.equal((await (await req('/api/classic-state?kind=posts','tino1')).json())[0].data.title,'Shared');
assert.equal((await req('/api/classic-state/posts/SHARE','tino1','DELETE')).status,403);
const upload=await req('/api/classic-attachments?post=SHARE&name=test.png&mime=image/png','tino','POST',original,true);assert.equal(upload.status,201,await upload.clone().text());const attachment=await upload.json();
const download=await req('/api/classic-attachments/'+attachment.id,'tino1');assert.equal(download.status,200);assert.deepEqual(new Uint8Array(await download.arrayBuffer()),original);
assert.equal((await req('/api/classic-attachments/'+attachment.id,'anonymous')).status,401);
assert.equal((await req('/api/classic-attachments?post=SHARE&name=big.png&mime=image/png','tino','POST',new Uint8Array(FILE_LIMIT+1),true)).status,413);
assert.equal((await req('/api/storage','tino1')).status,403);assert.equal((await req('/api/storage','tino')).status,200);
assert.equal((await req('/api/messages','tino','POST',{to:'demo:tino1',body:'Hello'})).status,201);
const dm=await (await req('/api/messages?with=demo:tino','tino1')).json();assert.equal(dm[0].body,'Hello');
console.log('D1 storage passed: binary/text roundtrip, overwrite/delete quota accounting, pagination, size/quota rejection, four logins/members, shared post/attachment ACLs and direct messages');

const spoof=await app.fetch(new Request('https://test.example/api/me',{headers:{'oai-authenticated-user-id':'demo:tino','oai-authenticated-user-email':'tino@paleonet.demo'}}),env);assert.equal(spoof.status,401);
