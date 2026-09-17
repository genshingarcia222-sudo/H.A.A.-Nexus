-- H.A.A. Nexus - migration 002 (Phase 8.3): allow 'assessment' session mode.
--
-- SQLite cannot ALTER a CHECK constraint, so simulation_sessions is rebuilt
-- using SQLite's documented procedure: create the new table, copy every row,
-- drop the old table, rename, and recreate its indexes.
--
-- The migration runner (src/db/migrations.rs) applies this exactly once, in
-- a single transaction with the schema_version bump, with foreign-key
-- enforcement switched off outside that transaction and checked with
-- PRAGMA foreign_key_check before commit. documentation_attempts rows keep
-- referencing simulation_sessions(id) by table name, so they resolve to the
-- rebuilt table once it is renamed.
--
-- Only the `mode` CHECK changes. Every column, type, default and the
-- `status` CHECK are identical to 001_initial.sql. Columns are named
-- explicitly in the copy so it cannot depend on column order.

CREATE TABLE simulation_sessions_new (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id),
    scenario_id       TEXT NOT NULL,
    scenario_version  TEXT NOT NULL,
    scenario_title    TEXT NOT NULL, -- denormalized for cheap history listing
    mode              TEXT NOT NULL CHECK (mode IN ('practice','simulation','assessment')),
    status            TEXT NOT NULL CHECK (status IN
                        ('not_started','in_progress','paused','completed',
                         'interrupted','abandoned','evaluation_failed','retried')),
    started_at        TEXT NOT NULL,
    active_ms         INTEGER NOT NULL DEFAULT 0,
    paused_ms         INTEGER NOT NULL DEFAULT 0,
    completed_at      TEXT,
    flags_json        TEXT NOT NULL DEFAULT '[]'
);

INSERT INTO simulation_sessions_new
    (id, user_id, scenario_id, scenario_version, scenario_title, mode, status,
     started_at, active_ms, paused_ms, completed_at, flags_json)
SELECT
     id, user_id, scenario_id, scenario_version, scenario_title, mode, status,
     started_at, active_ms, paused_ms, completed_at, flags_json
FROM simulation_sessions;

DROP TABLE simulation_sessions;

ALTER TABLE simulation_sessions_new RENAME TO simulation_sessions;

CREATE INDEX idx_sessions_user ON simulation_sessions(user_id);
CREATE INDEX idx_sessions_status ON simulation_sessions(status);
