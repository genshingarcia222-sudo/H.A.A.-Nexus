-- H.A.A. Nexus - initial schema (Phase 5)
-- Mirrors Architecture Package Section 8. Tables marked "not yet written"
-- below are created now for schema parity with the architecture doc and to
-- avoid a breaking migration later, but nothing in Phase 5's Rust commands
-- reads or writes them yet.
--
-- Timestamp convention: every *_at / *_ms column stores the string form of
-- a millisecond Unix epoch integer (e.g. "1700000000000"), matching the
-- JS side's Date.now()/number convention directly. This is a deliberate
-- simplification over ISO-8601 TEXT timestamps - it avoids a datetime
-- parsing dependency in Rust for the MVP and round-trips exactly with the
-- TypeScript layer's numbers.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    display_name    TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id             TEXT PRIMARY KEY REFERENCES users(id),
    theme               TEXT DEFAULT 'clinical-light',
    accessibility_json  TEXT,
    updated_at          TEXT NOT NULL
);

-- Not yet written: scenario content is bundled with the app (Phase 2/3),
-- not imported into SQLite. These tables exist for schema parity and are
-- the natural home for a future "custom/downloaded scenario packs" feature.
CREATE TABLE IF NOT EXISTS scenarios (
    scenario_id     TEXT NOT NULL PRIMARY KEY,
    latest_version  TEXT NOT NULL,
    title           TEXT NOT NULL,
    specialty       TEXT NOT NULL,
    encounter_type  TEXT NOT NULL,
    difficulty      INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 6),
    tags_json       TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS scenario_versions (
    scenario_id     TEXT NOT NULL,
    version         TEXT NOT NULL,
    content_json    TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    PRIMARY KEY (scenario_id, version),
    FOREIGN KEY (scenario_id) REFERENCES scenarios(scenario_id)
);

-- Not yet written: terminology is bundled as part of scenario content
-- (Phase 2) rather than a separate importable dictionary yet.
CREATE TABLE IF NOT EXISTS terminology (
    id                          TEXT PRIMARY KEY,
    lay_term                    TEXT NOT NULL,
    clinical_term                TEXT NOT NULL,
    accepted_alternatives_json  TEXT,
    category                    TEXT,
    context                     TEXT,
    explanation                 TEXT,
    common_mistakes_json        TEXT
);
CREATE INDEX IF NOT EXISTS idx_terminology_lay ON terminology(lay_term);

-- Not yet written: lessons are a Phase 6 (Training/Remediation) concern.
CREATE TABLE IF NOT EXISTS training_lessons (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    category        TEXT NOT NULL,
    content_json    TEXT NOT NULL,
    version         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS simulation_sessions (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id),
    scenario_id       TEXT NOT NULL,
    scenario_version  TEXT NOT NULL,
    scenario_title    TEXT NOT NULL, -- denormalized for cheap history listing
    mode              TEXT NOT NULL CHECK (mode IN ('practice','simulation')),
    status            TEXT NOT NULL CHECK (status IN
                        ('not_started','in_progress','paused','completed',
                         'interrupted','abandoned','evaluation_failed','retried')),
    started_at        TEXT NOT NULL,
    active_ms         INTEGER NOT NULL DEFAULT 0,
    paused_ms         INTEGER NOT NULL DEFAULT 0,
    completed_at      TEXT,
    flags_json        TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON simulation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON simulation_sessions(status);

CREATE TABLE IF NOT EXISTS documentation_attempts (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES simulation_sessions(id),
    chief_complaint TEXT NOT NULL DEFAULT '',
    hpi             TEXT NOT NULL DEFAULT '',
    ros             TEXT NOT NULL DEFAULT '',
    physical_exam   TEXT NOT NULL DEFAULT '',
    assessment      TEXT NOT NULL DEFAULT '',
    plan            TEXT NOT NULL DEFAULT '',
    additional_notes TEXT NOT NULL DEFAULT '',
    submitted_at    TEXT NOT NULL,
    is_duplicate_of TEXT REFERENCES documentation_attempts(id)
);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON documentation_attempts(session_id);

CREATE TABLE IF NOT EXISTS evaluation_results (
    id                      TEXT PRIMARY KEY,
    attempt_id              TEXT NOT NULL REFERENCES documentation_attempts(id),
    overall_score           REAL NOT NULL,
    category_scores_json    TEXT NOT NULL,
    errors_json             TEXT NOT NULL,
    time_efficiency_ratio   REAL,
    scoring_weights_json    TEXT NOT NULL,
    evaluated_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evaluations_attempt ON evaluation_results(attempt_id);

CREATE TABLE IF NOT EXISTS competency_records (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users(id),
    domain                  TEXT NOT NULL,
    level                   TEXT NOT NULL CHECK (level IN
                              ('unassessed','introduced','developing','competent','advanced','mastered')),
    avg_score               REAL,
    recent_score            REAL,
    trend                   TEXT,
    attempt_count           INTEGER NOT NULL DEFAULT 0,
    recent_scores_json      TEXT NOT NULL DEFAULT '[]',
    confidence              REAL NOT NULL DEFAULT 0,
    updated_at              TEXT NOT NULL,
    UNIQUE(user_id, domain)
);

-- Not yet written: the recommendation engine's rule table lands in Phase 6.
CREATE TABLE IF NOT EXISTS recommendations (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id),
    reason              TEXT NOT NULL,
    recommended_type    TEXT NOT NULL CHECK (recommended_type IN ('lesson','scenario')),
    recommended_id      TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    dismissed           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS application_metadata (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_versions (
    package_type    TEXT NOT NULL,
    package_id      TEXT NOT NULL,
    version         TEXT NOT NULL,
    imported_at     TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    PRIMARY KEY (package_type, package_id, version)
);

-- Not yet written: no sync engine exists until Phase 10. Present now so
-- that phase doesn't require a schema migration to retrofit it.
CREATE TABLE IF NOT EXISTS sync_queue (
    id              TEXT PRIMARY KEY,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    operation       TEXT NOT NULL CHECK (operation IN ('create','update','delete')),
    payload_json    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','conflict')),
    retry_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL
);
