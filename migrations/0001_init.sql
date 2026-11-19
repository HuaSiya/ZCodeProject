-- 轻投票初始数据结构

CREATE TABLE polls (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  max_choices INTEGER NOT NULL DEFAULT 1,
  is_listed INTEGER NOT NULL DEFAULT 0,
  deadline_at INTEGER,
  closed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id TEXT NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE poll_voters (
  poll_id TEXT NOT NULL,
  voter_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (poll_id, voter_key)
);

CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id TEXT NOT NULL,
  option_id INTEGER NOT NULL,
  voter_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (poll_id, option_id, voter_key)
);

CREATE INDEX idx_options_poll ON options (poll_id, position);
CREATE INDEX idx_votes_poll ON votes (poll_id, option_id);
CREATE INDEX idx_poll_voters_poll ON poll_voters (poll_id);
CREATE INDEX idx_polls_listed ON polls (is_listed, created_at);

CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_rate_limits_ip ON rate_limits (ip_hash, kind, created_at);
