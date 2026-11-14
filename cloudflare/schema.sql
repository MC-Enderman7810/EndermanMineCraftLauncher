CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  date TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '公告',
  url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '其他',
  message TEXT NOT NULL,
  app TEXT NOT NULL DEFAULT 'EMCL',
  version TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_date ON announcements(date DESC);

CREATE TABLE IF NOT EXISTS dev_devices (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  host TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  arch TEXT NOT NULL DEFAULT '',
  app TEXT NOT NULL DEFAULT 'EMCL 开发者版',
  version TEXT NOT NULL DEFAULT '',
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_dev_devices_seen ON dev_devices(last_seen DESC);
