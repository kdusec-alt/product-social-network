import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
const dir=await mkdtemp(path.join(os.tmpdir(),'psn-runtime-'));
const password=crypto.randomUUID(),profiles=JSON.stringify({tino:['Tino','PM','admin']});
let child;
async function start(){return new Promise((resolve,reject)=>{
  child=spawn(process.execPath,['scripts/server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir,DEMO_PASSWORD:password,DEMO_PROFILES_JSON:profiles},stdio:['ignore','pipe','pipe']});
  const timer=setTimeout(()=>reject(Error('Runtime startup timed out')),10000);let output='';
  child.stdout.on('data',b=>{output+=b;const match=output.match(/listening on 127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1])}});
  child.on('exit',code=>{clearTimeout(timer);if(!output.includes('listening on'))reject(Error('Runtime failed: '+code))});
})}
async function stop(){if(!child||child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM')})}
try{
  let origin=await start();let response=await fetch(origin+'/');assert.equal(response.status,200);assert.ok((await response.text()).includes('Product Social Network'));
  response=await fetch(origin+'/api/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({account:'tino',password})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];
  response=await fetch(origin+'/api/profile',{method:'PUT',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify({nickname:'Local Test',avatar:''})});assert.equal(response.status,200,await response.clone().text());
  // Simultaneous reads exercise cold D1 fallback setup without nested SQLite transactions.
  const reads=await Promise.all(['/api/profile','/api/storage','/api/users'].map(p=>fetch(origin+p,{headers:{cookie}})));assert.ok(reads.every(r=>r.status===200));
  response=await fetch(origin+'/api/me',{headers:{'oai-authenticated-user-id':'demo:tino','oai-authenticated-user-email':'tino@paleonet.demo'}});assert.equal(response.status,401);
  await stop();origin=await start();response=await fetch(origin+'/api/profile',{headers:{cookie}});assert.equal(response.status,200);assert.equal((await response.json()).nickname,'Local Test');
  console.log('Standalone intranet runtime passed: HTTP website/login, SQLite profile storage, concurrent reads, spoof rejection and data persistence after restart');
}finally{await stop();await rm(dir,{recursive:true,force:true})}
