
import {handleMigration} from '../worker/migration.js';
const expect=(value,message)=>{if(!value)throw Error(message)};
const sourceRecord={id:'POST-1',actorId:'demo:tino',data:{id:'POST-1',title:'Original',comments:[{text:'Original reply'}],mailAttachments:[{attachmentId:'PHOTO-1',name:'test.png',mime:'image/png',size:3}]},updatedAt:'2026-11-01'};
const originalBytes=new Uint8Array([1,2,255]);
const sourceFetch=async url=>{
  if(url.endsWith('/api/login'))return new Response('{}',{headers:{'set-cookie':'paleo_session='+'a'.repeat(64)+'; HttpOnly'}});
  if(url.includes('classic-state?kind=posts'))return Response.json([sourceRecord]);
  if(url.includes('classic-state?kind=projects'))return Response.json([]);
  if(url.endsWith('/api/knowledge-marks'))return Response.json([]);
  if(url.endsWith('/api/checklist-templates'))return Response.json({'生管':[{id:'PC-1',zh:'Check'}]});
  if(url.endsWith('/api/users'))return Response.json([]);
  if(url.endsWith('/api/classic-attachments/PHOTO-1'))return new Response(originalBytes);
  throw Error('Unexpected URL '+url);
};
const objects=new Map();
const BUCKET={async put(key,value){objects.set(key,value)},async get(key){if(!objects.has(key))return null;const v=objects.get(key);return{text:async()=>String(v),arrayBuffer:async()=>v instanceof ArrayBuffer?v:v.buffer}},async delete(key){objects.delete(key)}};
const env={BUCKET},admin={id:'demo:tino',role:'admin'},member={id:'demo:tino1',role:'member'};
const req=data=>({json:async()=>({sourceAccount:'source',sourcePassword:'fixture-only',...data})});
const hash=async value=>typeof value==='string'?value:Array.from(new Uint8Array(value)).join(',');
let r=await handleMigration(req({action:'preview'}),env,member,sourceFetch,hash);expect(r.status===403,'Members must not migrate');
r=await handleMigration(req({action:'preview'}),env,admin,sourceFetch,hash);const plan=await r.json();expect(plan.posts===1&&plan.comments===1&&plan.images===1,'Preview must count content and images');
r=await handleMigration(req({action:'import',kind:'posts',id:'POST-1'}),env,admin,sourceFetch,hash);expect((await r.json()).status==='imported','Import must preserve a complete post');
const imported=JSON.parse(objects.get('classic/posts/POST-1.json'));expect(imported.data.comments[0].text==='Original reply','Comments must remain unchanged');
r=await handleMigration(req({action:'import',kind:'posts',id:'POST-1'}),env,admin,sourceFetch,hash);expect((await r.json()).status==='duplicate','Reimport must be idempotent');
r=await handleMigration(req({action:'import',kind:'attachment',id:'PHOTO-1',postId:'POST-1'}),env,admin,sourceFetch,hash);const image=await r.json();expect(image.sourceHash===image.targetHash&&image.bytes===3,'Image bytes must match');
expect(!JSON.stringify([...objects.values()]).includes('fixture-only'),'Source password must never be archived');
imported.data.title='New destination edit';objects.set('classic/posts/POST-1.json',JSON.stringify(imported));
r=await handleMigration(req({action:'import',kind:'posts',id:'POST-1'}),env,admin,sourceFetch,hash);expect(r.status===409,'Destination edits must cause a conflict');
expect(JSON.parse(objects.get('classic/posts/POST-1.json')).data.title==='New destination edit','Conflicts must not overwrite new data');
console.log('Migration tests passed: admin ACL, source counts, full comments, duplicate detection, lossless image hashes, credential exclusion and destination conflict preservation');

let auditDetail=null;
env.DB={prepare(sql){let args=[];return{bind(...v){args=v;return this},async first(){return auditDetail?{details:auditDetail}:null},async run(){auditDetail=args[5];return {success:true}}}}};
r=await handleMigration(req({action:'import',kind:'templates',id:'生管'}),env,admin,sourceFetch,hash);expect(r.status===200&&(await r.json()).status==='imported','Chinese template unit names must migrate');
