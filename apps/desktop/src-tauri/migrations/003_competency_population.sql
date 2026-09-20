-- H.A.A. Nexus - migration 003 (Phase 8.3, decision D5): separate Practice
-- and Assessment competency.
--
-- D5: a completed Assessment must not mutate, overwrite, or become
-- indistinguishable from Practice competency. The old table enforced
-- UNIQUE(user_id, domain), which structurally allowed exactly one record per
-- domain - so whichever population wrote last won, and the other was gone.
-- The key becomes UNIQUE(user_id, population, domain), which makes an
-- accidental overwrite impossible rather than merely unlikely.
--
-- SQLite cannot ALTER a UNIQUE constraint, so the table is rebuilt using the
-- same documented procedure as 002: create, copy, drop, rename. The migration
-- runner (src/db/migrations.rs) applies this exactly once, in a single
-- transaction with the schema_version bump.
--
-- Existing rows are 'practice'. Every record written before this migration was
-- produced under the pre-D5 mode-agnostic fold, and Assessment was unreachable
-- for most of that period (it required Pro from `34f727c` onward and could not
-- be started at all before that). Assigning them to practice keeps the
-- training history a learner already has; it does not claim they were
-- assessments.
--
-- `id` is rebuilt as user-population-domain so the primary key cannot collide
-- across populations. Rows are copied with explicit column names so the copy
-- cannot depend on column order.

CREATE TABLE competency_records_new (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users(id),
    population              TEXT NOT NULL CHECK (population IN ('practice','assessment')),
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
    UNIQUE(user_id, population, domain)
);

INSERT INTO competency_records_new
    (id, user_id, population, domain, level, avg_score, recent_score, trend,
     attempt_count, recent_scores_json, confidence, updated_at)
SELECT
     user_id || '-practice-' || domain, user_id, 'practice', domain, level,
     avg_score, recent_score, trend, attempt_count, recent_scores_json,
     confidence, updated_at
FROM competency_records;

DROP TABLE competency_records;

ALTER TABLE competency_records_new RENAME TO competency_records;
