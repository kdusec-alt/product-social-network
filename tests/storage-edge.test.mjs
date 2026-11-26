import assert from 'node:assert/strict';
import {databaseSize,DB_WRITE_GUARD,createD1Bucket} from '../worker/storage.js';
const db={prepare(sql){assert.ok(!sql.toUpperCase().startsWith('PRAGMA'));return {async all(){return {results:[{ok:1}],meta:{size_after:123456}}}}}};
assert.equal(await databaseSize(db),123456);
assert.equal(await databaseSize({databaseSize:async()=>654321}),654321);
let writes=0;
const full={async batch(){return []},prepare(sql){assert.ok(!sql.toUpperCase().startsWith('PRAGMA'));return{async all(){return {results:[],meta:{size_after:DB_WRITE_GUARD}}},bind(){return this},async run(){writes++}}}};
await assert.rejects(createD1Bucket(full).put('test','x'),e=>e.status===507);assert.equal(writes,0);
console.log('D1 compatibility passed: no disallowed PRAGMA, metadata size and write guard');
