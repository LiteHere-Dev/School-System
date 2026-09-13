-- School Management System — V151 schema
-- Run once against a fresh database:
--   psql -U school_user -d school_db -f schema.sql

-- ── Core KV store ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kv_store (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Auth: Active sessions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  session_id   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  user_name    TEXT NOT NULL,
  user_role    TEXT NOT NULL,
  user_email   TEXT NOT NULL,
  jwt_token    TEXT NOT NULL,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  force_logout BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_active_idx  ON sessions(is_active);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

-- ── Auth: Login history ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_history (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT,
  user_name    TEXT,
  user_role    TEXT,
  user_email   TEXT,
  ip_address   TEXT,
  user_agent   TEXT,
  success      BOOLEAN NOT NULL,
  fail_reason  TEXT,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_hist_user_idx ON login_history(user_id);
CREATE INDEX IF NOT EXISTS login_hist_time_idx ON login_history(logged_in_at DESC);

-- ── V151: System Activity Timeline ────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_timeline (
  id         BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'system',
  actor      TEXT,
  details    JSONB,
  severity   TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS timeline_created_idx  ON system_timeline(created_at DESC);
CREATE INDEX IF NOT EXISTS timeline_category_idx ON system_timeline(category);

-- ── V151: Error Log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_log (
  id         BIGSERIAL PRIMARY KEY,
  source     TEXT NOT NULL,
  level      TEXT NOT NULL DEFAULT 'error',
  message    TEXT NOT NULL,
  stack      TEXT,
  context    JSONB,
  resolved   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS error_log_created_idx  ON error_log(created_at DESC);
CREATE INDEX IF NOT EXISTS error_log_resolved_idx ON error_log(resolved);

-- ── V151: Backups ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backups (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  size_bytes   BIGINT,
  table_counts JSONB,
  data         JSONB NOT NULL,
  status       TEXT NOT NULL DEFAULT 'complete',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS backups_created_idx ON backups(created_at DESC);

-- ── V151: Database Migrations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS migration_history (
  id          SERIAL PRIMARY KEY,
  version     TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sql_up      TEXT NOT NULL,
  sql_down    TEXT,
  applied_by  TEXT,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  rolled_back BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE system_timeline IS 'Chronological log of system events: logins, backups, migrations, server starts.';
COMMENT ON TABLE error_log       IS 'Application errors from server and frontend. Admin can mark as resolved.';
COMMENT ON TABLE backups         IS 'Full kv_store snapshots. Auto-created daily, manual via Admin > Backups.';
COMMENT ON TABLE migration_history IS 'Tracks schema migrations with up/down SQL and rollback status.';
