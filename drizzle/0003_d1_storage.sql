CREATE TABLE IF NOT EXISTS storage_objects (
    key TEXT PRIMARY KEY, value BLOB NOT NULL, metadata TEXT NOT NULL DEFAULT '{}',
    size INTEGER NOT NULL CHECK(size >= 0), updated_at TEXT NOT NULL,
    CHECK(length(value) <= 1048576), CHECK(length(CAST(key AS BLOB)) <= 512));
CREATE TABLE IF NOT EXISTS storage_usage (id INTEGER PRIMARY KEY CHECK(id=1), bytes INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO storage_usage(id,bytes) SELECT 1,COALESCE(SUM(size),0) FROM storage_objects;
CREATE TRIGGER IF NOT EXISTS storage_quota_insert BEFORE INSERT ON storage_objects BEGIN
    SELECT CASE WHEN (SELECT bytes FROM storage_usage WHERE id=1) + NEW.size - COALESCE((SELECT size FROM storage_objects WHERE key=NEW.key),0) > 314572800
    THEN RAISE(ABORT,'STORAGE_QUOTA') END; END;
CREATE TRIGGER IF NOT EXISTS storage_quota_update BEFORE UPDATE ON storage_objects BEGIN
    SELECT CASE WHEN (SELECT bytes FROM storage_usage WHERE id=1) + NEW.size - OLD.size > 314572800
    THEN RAISE(ABORT,'STORAGE_QUOTA') END; END;
CREATE TRIGGER IF NOT EXISTS storage_count_insert AFTER INSERT ON storage_objects BEGIN UPDATE storage_usage SET bytes=bytes+NEW.size WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS storage_count_update AFTER UPDATE ON storage_objects BEGIN UPDATE storage_usage SET bytes=bytes+NEW.size-OLD.size WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS storage_count_delete AFTER DELETE ON storage_objects BEGIN UPDATE storage_usage SET bytes=bytes-OLD.size WHERE id=1; END;
