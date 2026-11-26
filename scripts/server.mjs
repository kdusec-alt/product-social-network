// Standalone intranet runtime: Node.js + SQLite, without Cloudflare credentials.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import app from '../dist/server/index.js';
const dataDir=path.resolve(process.env.DATA_DIR||'data');fs.mkdirSync(dataDir,{recursive:true});
const sqlite=new DatabaseSync(path.join(dataDir,'product-social-network.sqlite'));
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
sqlite.exec('CREATE TABLE IF NOT EXISTS _app_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){
  if(sqlite.prepare('SELECT name FROM _app_migrations WHERE name=?').get(file))continue;
  sqlite.exec('BEGIN');try{sqlite.exec(fs.readFileSync(path.join('drizzle',file),'utf8'));sqlite.prepare('INSERT INTO _app_migrations VALUES(?,?)').run(file,new Date().toISOString());sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}
}
const DB={prepare(sql){let args=[];return{bind(...values){args=values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return this},async first(){return sqlite.prepare(sql).get(...args)||null},_all(){return{results:sqlite.prepare(sql).all(...args)}},async all(){return this._all()},async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}}},
  async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(stmt._all());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
if(!process.env.DEMO_PASSWORD||!process.env.DEMO_PROFILES_JSON)throw Error('Set DEMO_PASSWORD and DEMO_PROFILES_JSON in the private runtime environment before starting.');
JSON.parse(process.env.DEMO_PROFILES_JSON);
const env={DB,DEMO_PASSWORD:process.env.DEMO_PASSWORD,DEMO_PROFILES_JSON:process.env.DEMO_PROFILES_JSON,OWNER_EMAIL:process.env.OWNER_EMAIL||''};
const server=http.createServer(async(req,res)=>{
  try{
    const host=req.headers.host||'localhost';const origin=process.env.PUBLIC_ORIGIN||`http://${host}`;
    const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(key.startsWith('oai-authenticated-'))continue;if(Array.isArray(value))for(const v of value)headers.append(key,v);else if(value!==undefined)headers.set(key,value)}
    const body=['GET','HEAD'].includes(req.method)?undefined:Readable.toWeb(req);
    const response=await app.fetch(new Request(new URL(req.url,origin),{method:req.method,headers,body,...(body?{duplex:'half'}:{})}),env);
    res.statusCode=response.status;response.headers.forEach((v,k)=>{if(k!=='set-cookie')res.setHeader(k,v)});
    const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
    if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
  }catch(error){console.error('Request failed:',error.message);if(!res.headersSent){res.statusCode=500;res.setHeader('content-type','application/json');res.end(JSON.stringify({error:'系統暫時無法處理'}))}else res.end()}
});
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
server.listen(port,host,()=>console.log(`Product Social Network listening on ${host}:${server.address().port}`));
process.on('SIGTERM',()=>server.close(()=>{sqlite.close();process.exit(0)}));
