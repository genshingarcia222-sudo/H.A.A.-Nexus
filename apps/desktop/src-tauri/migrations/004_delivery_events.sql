-- H.A.A. Nexus - migration 004 (D12 work package 8): the exposure ledger.
--
-- Records which question was delivered to which learner, in which session,
-- and why. The delivery layer (nexus-core `training-engine/delivery.ts`)
-- produces a trace per delivered item; this is where it is kept so that a
-- later session can prefer what a learner has not seen, and so that "why did
-- this learner get this question?" has an answer.
--
-- Three properties this table exists to hold:
--
--   Append-only. There is no UPDATE path except filling an answer exactly
--   once, and no DELETE path at all. History that can be rewritten cannot be
--   audited, and a silently accepted duplicate inflates every exposure count -
--   which is why `delivery_id` is the primary key rather than a rowid alias.
--
--   Outside the corpus. Rows reference content by id and revision; content
--   never references a row. Nothing a learner does can change what a
--   question's correct answer is.
--
--   Pseudonymous. `learner_ref` is a stable handle, never a name or an email.
--   Architecture Package Section 27 keeps this data on the device; if a shared
--   ledger ever exists, it carries counts, not identities.
--
-- `population` repeats the D5 separation at the storage layer: Practice and
-- Assessment deliveries are distinguishable forever, not by convention but by
-- a column with a CHECK on it.
--
-- This migration is additive. It creates one new table and its indexes, and
-- touches no existing table, so a rollback is a DROP and nothing else.

CREATE TABLE IF NOT EXISTS delivery_events (
    delivery_id         TEXT PRIMARY KEY,
    session_id          TEXT NOT NULL,
    learner_ref         TEXT NOT NULL,
    cohort_ref          TEXT,
    population          TEXT NOT NULL CHECK (population IN ('practice', 'assessment')),

    item_id             TEXT NOT NULL,
    item_revision       INTEGER NOT NULL CHECK (item_revision >= 1),
    concept_id          TEXT,

    corpus_release_id   TEXT NOT NULL,
    policy_version      TEXT NOT NULL,
    envelope_id         TEXT NOT NULL,
    tier_at_delivery    TEXT NOT NULL,

    modality            TEXT NOT NULL,
    difficulty_level    INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 6),
    jurisdictions       TEXT NOT NULL,

    delivered_at        TEXT NOT NULL,
    delivered_on        TEXT NOT NULL,
    slot_index          INTEGER NOT NULL CHECK (slot_index >= 0),

    answered_choice_id  TEXT,
    correct             INTEGER CHECK (correct IN (0, 1)),
    answered_at         TEXT,

    -- The selection trace, as canonical JSON. It is evidence about one
    -- decision rather than queryable state; the columns above carry everything
    -- selection needs to read back.
    trace               TEXT NOT NULL,

    -- Correctness without the choice that produced it is a score nobody can
    -- audit, so the pair is enforced here as well as in the schema.
    CHECK (correct IS NULL OR answered_choice_id IS NOT NULL),
    CHECK (answered_at IS NULL OR answered_at >= delivered_at)
);

-- "What has this learner seen, and how recently?" - the per-learner novelty
-- lookup the selector's snapshot is built from.
CREATE INDEX IF NOT EXISTS idx_delivery_events_learner_concept
    ON delivery_events (learner_ref, concept_id, delivered_on);

-- "How often has this concept been served under comparable conditions?" - the
-- cross-user share, which is only measurable at all on a shared ledger.
CREATE INDEX IF NOT EXISTS idx_delivery_events_stratum
    ON delivery_events (envelope_id, modality, difficulty_level, delivered_at);

-- One session's deliveries, in order.
CREATE INDEX IF NOT EXISTS idx_delivery_events_session
    ON delivery_events (session_id, slot_index);
