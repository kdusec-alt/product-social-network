CREATE TABLE IF NOT EXISTS direct_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id),
  recipient_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS direct_messages_sender_time ON direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS direct_messages_recipient_time ON direct_messages(recipient_id, created_at DESC);
CREATE TABLE IF NOT EXISTS direct_message_attachments (
  message_id TEXT PRIMARY KEY REFERENCES direct_messages(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  object_key TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
