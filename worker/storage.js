// Portable SQLite object storage. Existing R2 bindings remain supported.
export const FILE_LIMIT = 1024 * 1024;
export const OBJECT_BUDGET = 300 * 1024 * 1024;
export const DB_WRITE_GUARD = 400 * 1024 * 1024;
export class StorageError extends Error {
  constructor(message, status = 413) { super(message); this.status = status; }
}
export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS storage_objects (
    key TEXT PRIMARY KEY, value BLOB NOT NULL, metadata TEXT NOT NULL DEFAULT '{}',
    size INTEGER NOT NULL CHECK(size >= 0), updated_at TEXT NOT NULL,
    CHECK(length(value) <= ${FILE_LIMIT}), CHECK(length(CAST(key AS BLOB)) <= 512))`,
  `CREATE TABLE IF NOT EXISTS storage_usage (id INTEGER PRIMARY KEY CHECK(id=1), bytes INTEGER NOT NULL DEFAULT 0)`,
  `INSERT OR IGNORE INTO storage_usage(id,bytes) SELECT 1,COALESCE(SUM(size),0) FROM storage_objects`,
  `CREATE TRIGGER IF NOT EXISTS storage_quota_insert BEFORE INSERT ON storage_objects BEGIN
    SELECT CASE WHEN (SELECT bytes FROM storage_usage WHERE id=1) + NEW.size - COALESCE((SELECT size FROM storage_objects WHERE key=NEW.key),0) > ${OBJECT_BUDGET}
    THEN RAISE(ABORT,'STORAGE_QUOTA') END; END`,
  `CREATE TRIGGER IF NOT EXISTS storage_quota_update BEFORE UPDATE ON storage_objects BEGIN
    SELECT CASE WHEN (SELECT bytes FROM storage_usage WHERE id=1) + NEW.size - OLD.size > ${OBJECT_BUDGET}
    THEN RAISE(ABORT,'STORAGE_QUOTA') END; END`,
  `CREATE TRIGGER IF NOT EXISTS storage_count_insert AFTER INSERT ON storage_objects BEGIN UPDATE storage_usage SET bytes=bytes+NEW.size WHERE id=1; END`,
  `CREATE TRIGGER IF NOT EXISTS storage_count_update AFTER UPDATE ON storage_objects BEGIN UPDATE storage_usage SET bytes=bytes+NEW.size-OLD.size WHERE id=1; END`,
  `CREATE TRIGGER IF NOT EXISTS storage_count_delete AFTER DELETE ON storage_objects BEGIN UPDATE storage_usage SET bytes=bytes-OLD.size WHERE id=1; END`
];
const initialized = new WeakMap();
async function initialize(db) {
  if (!db) throw new StorageError('資料庫尚未綁定',503);
  if (!initialized.has(db)) {
    const pending = db.batch(schemaStatements.map(sql => db.prepare(sql))).catch(error => {initialized.delete(db);throw error;});
    initialized.set(db,pending);
  }
  await initialized.get(db);
}
function bytesOf(value) {
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  if (Array.isArray(value)) return new Uint8Array(value); // D1 BLOB results are byte arrays.
  throw new StorageError('不支援的檔案資料格式',400);
}
export function createD1Bucket(db) {
  return {
    async get(key) {
      await initialize(db);
      const row=await db.prepare('SELECT value,metadata,size FROM storage_objects WHERE key=?').bind(key).first();
      if(!row)return null;
      const bytes=bytesOf(row.value);
      return {body:bytes,size:bytes.byteLength,httpMetadata:JSON.parse(row.metadata),
        text:async()=>new TextDecoder().decode(bytes),
        arrayBuffer:async()=>bytes.slice().buffer};
    },
    async put(key,value,options={}) {
      const bytes=bytesOf(value),metadata=JSON.stringify(options.httpMetadata||{});
      if(bytes.byteLength>FILE_LIMIT)throw new StorageError('免費測試版每個附件或資料項目上限 1 MiB，請縮小圖片或內容');
      if(new TextEncoder().encode(key).length>512||metadata.length>4096)throw new StorageError('檔案名稱或描述過長',400);
      await initialize(db);
      // Reserve headroom for SQL rows, indexes and SQLite page overhead.
      const pages=await db.batch([db.prepare('PRAGMA page_count'),db.prepare('PRAGMA page_size')]);
      const databaseBytes=Number(pages[0].results[0].page_count)*Number(pages[1].results[0].page_size);
      if(databaseBytes>=DB_WRITE_GUARD)throw new StorageError('測試資料庫已達 400 MiB 寫入保護線，請先匯出並清理資料',507);
      const size=bytes.byteLength+new TextEncoder().encode(key+metadata).length;
      try {
        await db.prepare(`INSERT INTO storage_objects(key,value,metadata,size,updated_at) VALUES(?,?,?,?,?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value,metadata=excluded.metadata,size=excluded.size,updated_at=excluded.updated_at`)
          .bind(key,bytes.slice().buffer,metadata,size,new Date().toISOString()).run();
      } catch(error) {
        if(String(error).includes('STORAGE_QUOTA'))throw new StorageError('測試物件儲存已達 300 MiB 上限，請先清理資料',507);
        throw error;
      }
    },
    async delete(key) {
      await initialize(db);
      await db.prepare('DELETE FROM storage_objects WHERE key=?').bind(key).run();
    },
    async list({prefix='',limit=1000,cursor}={}) {
      await initialize(db);
      const count=Math.min(1000,Math.max(1,Number(limit)||1000));
      const result=await db.prepare(`SELECT key,size FROM storage_objects WHERE key>=? AND key<? AND key>? ORDER BY key LIMIT ?`)
        .bind(prefix,prefix+'\u{10ffff}',cursor||'',count+1).all();
      const truncated=result.results.length>count,objects=result.results.slice(0,count);
      return {objects,truncated,cursor:truncated?objects.at(-1).key:undefined};
    },
    async stats() {
      await initialize(db);
      const results=await db.batch([db.prepare('SELECT bytes FROM storage_usage WHERE id=1'),db.prepare('SELECT COUNT(*) AS count FROM storage_objects'),db.prepare('PRAGMA page_count'),db.prepare('PRAGMA page_size')]);
      return {backend:'d1',objectBytes:results[0].results[0].bytes,objectCount:results[1].results[0].count,
        databaseBytes:results[2].results[0].page_count*results[3].results[0].page_size,
        objectLimitBytes:FILE_LIMIT,objectBudgetBytes:OBJECT_BUDGET,databaseWriteGuardBytes:DB_WRITE_GUARD};
    }
  };
}
