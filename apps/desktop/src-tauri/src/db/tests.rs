//! Phase 7 (Pre-Commercialization Audit & Stabilization Gate) verification
//! for the SQLite layer.
//!
//! Until this module existed, `cargo test` reported "0 tests" and the only
//! evidence for persistence integrity was a one-off Python script that
//! executed the schema by hand (see CHANGELOG, Phase 5). That validated the
//! *schema*; it did not validate the *Rust code that runs it*. These tests
//! close that gap by exercising the real `rusqlite` code paths against a
//! real on-disk database (not `:memory:`), so WAL mode, the transaction in
//! `save_session`, and the reopen path are all genuinely covered.

use super::models::{
    CompetencyRecordDto, DocumentationDraftDto, EvaluationResultDto, SessionFlagDto,
    SessionRecordDto, UserProfileDto,
};
use super::{competency, init_connection, profile, sessions, LOCAL_USER_ID};
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// A real temp-file database that cleans itself (and its WAL sidecars) up.
/// Deliberately not `:memory:` - WAL mode and the reopen path are part of
/// what this suite is meant to verify.
struct TestDb {
    path: PathBuf,
    conn: Option<Connection>,
}

impl TestDb {
    fn new() -> Self {
        let unique = format!(
            "haa-nexus-test-{}-{}.sqlite",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::SeqCst)
        );
        let path = std::env::temp_dir().join(unique);
        let _ = std::fs::remove_file(&path);
        let conn = init_connection(path.clone()).expect("init_connection failed");
        Self {
            path,
            conn: Some(conn),
        }
    }

    fn conn(&self) -> &Connection {
        self.conn.as_ref().expect("connection was taken")
    }

    fn conn_mut(&mut self) -> &mut Connection {
        self.conn.as_mut().expect("connection was taken")
    }

    /// Drops and reopens the database, the way an app restart would.
    fn reopen(&mut self) {
        self.conn = None;
        self.conn = Some(init_connection(self.path.clone()).expect("reopen failed"));
    }

    fn count(&self, sql: &str) -> i64 {
        self.conn()
            .query_row(sql, [], |row| row.get::<_, i64>(0))
            .expect("count query failed")
    }
}

impl Drop for TestDb {
    fn drop(&mut self) {
        self.conn = None;
        let _ = std::fs::remove_file(&self.path);
        let _ = std::fs::remove_file(self.path.with_extension("sqlite-wal"));
        let _ = std::fs::remove_file(self.path.with_extension("sqlite-shm"));
    }
}

fn draft(hpi: &str) -> DocumentationDraftDto {
    DocumentationDraftDto {
        chief_complaint: "Cough x3 days.".to_string(),
        hpi: hpi.to_string(),
        ros: "Denies fever.".to_string(),
        physical_exam: String::new(),
        assessment: String::new(),
        plan: String::new(),
        additional_notes: String::new(),
    }
}

fn evaluation() -> EvaluationResultDto {
    EvaluationResultDto {
        overall_score: 87.5,
        category_scores: serde_json::json!({ "accuracy": 100.0, "completeness": 75.0 }),
        errors: serde_json::json!([{ "id": "err-1", "errorType": "omission" }]),
        scoring_weights_used: serde_json::json!({ "accuracy": 0.3 }),
        time_efficiency_ratio: 1.25,
        evaluated_at: 1_700_000_000_000,
    }
}

fn record(
    id: &str,
    status: &str,
    hpi: &str,
    eval: Option<EvaluationResultDto>,
) -> SessionRecordDto {
    SessionRecordDto {
        id: id.to_string(),
        scenario_id: "SCRIBE-FM-014".to_string(),
        scenario_version: "1.0".to_string(),
        scenario_title: "Three-Day Cough, Family Medicine".to_string(),
        mode: "practice".to_string(),
        status: status.to_string(),
        started_at: 1_700_000_000_000,
        active_ms: 42_000,
        paused_ms: 0,
        completed_at: eval.as_ref().map(|_| 1_700_000_100_000),
        flags: vec![SessionFlagDto {
            beat_id: "beat-1".to_string(),
            flag_type: "important".to_string(),
            timestamp: 1_700_000_050_000,
        }],
        draft: draft(hpi),
        evaluation: eval,
    }
}

// --- migration / schema integrity -------------------------------------

#[test]
fn migration_creates_every_table_the_schema_declares() {
    let db = TestDb::new();
    let expected = [
        "users",
        "user_settings",
        "scenarios",
        "scenario_versions",
        "terminology",
        "training_lessons",
        "simulation_sessions",
        "documentation_attempts",
        "evaluation_results",
        "competency_records",
        "recommendations",
        "application_metadata",
        "content_versions",
        "sync_queue",
    ];
    for table in expected {
        let found: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                [table],
                |row| row.get(0),
            )
            .expect("sqlite_master query failed");
        assert_eq!(found, 1, "table `{table}` missing from migration");
    }
}

#[test]
fn wal_mode_and_foreign_keys_are_actually_enabled() {
    let db = TestDb::new();
    let journal: String = db
        .conn()
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .expect("pragma failed");
    assert_eq!(journal.to_lowercase(), "wal");

    let fk: i64 = db
        .conn()
        .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
        .expect("pragma failed");
    assert_eq!(fk, 1, "foreign key enforcement is off");
}

#[test]
fn reopening_the_database_is_idempotent() {
    let mut db = TestDb::new();
    assert_eq!(db.count("SELECT COUNT(*) FROM users"), 1);

    // The migration is re-executed on every boot (CREATE TABLE IF NOT
    // EXISTS + INSERT OR IGNORE), so a restart must not duplicate the
    // local user or fail on existing tables.
    db.reopen();
    db.reopen();

    assert_eq!(db.count("SELECT COUNT(*) FROM users"), 1);
    let id: String = db
        .conn()
        .query_row("SELECT id FROM users", [], |row| row.get(0))
        .expect("user query failed");
    assert_eq!(id, LOCAL_USER_ID);
}

// --- autosave / interruption ------------------------------------------

#[test]
fn autosave_persists_the_draft_for_a_session_with_no_evaluation_yet() {
    // This is the exact regression the Phase 5 CHANGELOG describes catching:
    // an implementation that only wrote the draft on completion would
    // silently lose in-progress work.
    let mut db = TestDb::new();
    let rec = record("s-1", "in_progress", "Non-productive cough x3 days.", None);
    sessions::save_session(db.conn_mut(), &rec).expect("save failed");

    let loaded = sessions::get_session(db.conn(), "s-1")
        .expect("load failed")
        .expect("session missing");

    assert_eq!(loaded.status, "in_progress");
    assert_eq!(loaded.draft.hpi, "Non-productive cough x3 days.");
    assert_eq!(loaded.draft.chief_complaint, "Cough x3 days.");
    assert!(
        loaded.evaluation.is_none(),
        "no evaluation should exist yet"
    );
}

#[test]
fn autosave_survives_an_application_restart() {
    let mut db = TestDb::new();
    let rec = record(
        "s-1",
        "in_progress",
        "Draft written before the crash.",
        None,
    );
    sessions::save_session(db.conn_mut(), &rec).expect("save failed");

    db.reopen();

    let loaded = sessions::get_session(db.conn(), "s-1")
        .expect("load failed")
        .expect("session did not survive restart");
    assert_eq!(loaded.draft.hpi, "Draft written before the crash.");
}

#[test]
fn repeated_autosaves_update_in_place_rather_than_accumulating_rows() {
    let mut db = TestDb::new();
    for hpi in ["first pass", "second pass", "third pass"] {
        let rec = record("s-1", "in_progress", hpi, None);
        sessions::save_session(db.conn_mut(), &rec).expect("save failed");
    }

    assert_eq!(db.count("SELECT COUNT(*) FROM simulation_sessions"), 1);
    assert_eq!(db.count("SELECT COUNT(*) FROM documentation_attempts"), 1);

    let loaded = sessions::get_session(db.conn(), "s-1")
        .expect("load failed")
        .expect("session missing");
    assert_eq!(loaded.draft.hpi, "third pass");
}

#[test]
fn submitting_after_autosave_attaches_the_evaluation_to_the_same_attempt() {
    let mut db = TestDb::new();
    sessions::save_session(db.conn_mut(), &record("s-1", "in_progress", "draft", None))
        .expect("autosave failed");
    sessions::save_session(
        db.conn_mut(),
        &record("s-1", "completed", "final note", Some(evaluation())),
    )
    .expect("submit failed");

    assert_eq!(db.count("SELECT COUNT(*) FROM simulation_sessions"), 1);
    assert_eq!(db.count("SELECT COUNT(*) FROM documentation_attempts"), 1);
    assert_eq!(db.count("SELECT COUNT(*) FROM evaluation_results"), 1);

    let loaded = sessions::get_session(db.conn(), "s-1")
        .expect("load failed")
        .expect("session missing");
    assert_eq!(loaded.status, "completed");
    assert_eq!(loaded.draft.hpi, "final note");
    let eval = loaded.evaluation.expect("evaluation should be present");
    assert_eq!(eval.overall_score, 87.5);
    assert_eq!(eval.time_efficiency_ratio, 1.25);
}

#[test]
fn find_interrupted_returns_only_in_progress_and_paused_sessions() {
    let mut db = TestDb::new();
    sessions::save_session(db.conn_mut(), &record("s-live", "in_progress", "a", None)).unwrap();
    sessions::save_session(db.conn_mut(), &record("s-paused", "paused", "b", None)).unwrap();
    sessions::save_session(
        db.conn_mut(),
        &record("s-done", "completed", "c", Some(evaluation())),
    )
    .unwrap();
    sessions::save_session(db.conn_mut(), &record("s-gone", "abandoned", "d", None)).unwrap();

    let mut ids = sessions::find_interrupted_session_ids(db.conn()).expect("query failed");
    ids.sort();
    assert_eq!(ids, vec!["s-live".to_string(), "s-paused".to_string()]);
}

// --- durability / traceability ----------------------------------------

#[test]
fn a_completed_attempt_stays_traceable_to_its_exact_scenario_version() {
    // Architecture Package Section 27: an attempt is bound to
    // scenarioId + version, so later content updates can never
    // retroactively change what an old attempt was scored against.
    let mut db = TestDb::new();
    sessions::save_session(
        db.conn_mut(),
        &record("s-1", "completed", "note", Some(evaluation())),
    )
    .unwrap();

    db.reopen();

    let loaded = sessions::get_session(db.conn(), "s-1")
        .expect("load failed")
        .expect("session missing");
    assert_eq!(loaded.scenario_id, "SCRIBE-FM-014");
    assert_eq!(loaded.scenario_version, "1.0");
    assert_eq!(loaded.flags.len(), 1);
    assert_eq!(loaded.flags[0].beat_id, "beat-1");
    assert_eq!(
        loaded.evaluation.expect("evaluation missing").evaluated_at,
        1_700_000_000_000
    );
}

#[test]
fn a_missing_session_reads_back_as_none_rather_than_erroring() {
    let db = TestDb::new();
    let loaded = sessions::get_session(db.conn(), "does-not-exist").expect("query failed");
    assert!(loaded.is_none());
}

#[test]
fn sessions_are_listed_newest_first() {
    let mut db = TestDb::new();
    for (id, started) in [
        ("s-old", 1_700_000_000_000i64),
        ("s-new", 1_700_000_900_000),
    ] {
        let mut rec = record(id, "completed", "note", Some(evaluation()));
        rec.started_at = started;
        sessions::save_session(db.conn_mut(), &rec).unwrap();
    }

    let ids = sessions::list_session_ids(db.conn()).expect("list failed");
    assert_eq!(ids, vec!["s-new".to_string(), "s-old".to_string()]);
}

// --- profile / competency ---------------------------------------------

#[test]
fn profile_round_trips_and_defaults_to_the_seeded_local_user() {
    let db = TestDb::new();
    let seeded = profile::get_profile(db.conn())
        .expect("get failed")
        .expect("seeded profile missing");
    assert_eq!(seeded.display_name, "Learner");

    profile::save_profile(
        db.conn(),
        &UserProfileDto {
            display_name: "Ada".to_string(),
            updated_at: 1_700_000_500_000,
        },
    )
    .expect("save failed");

    let loaded = profile::get_profile(db.conn())
        .expect("get failed")
        .expect("profile missing");
    assert_eq!(loaded.display_name, "Ada");
    assert_eq!(loaded.updated_at, 1_700_000_500_000);
}

#[test]
fn competency_upsert_keeps_exactly_one_row_per_domain() {
    let db = TestDb::new();
    let mut rec = CompetencyRecordDto {
        domain: "accuracy".to_string(),
        level: "developing".to_string(),
        avg_score: 60.0,
        recent_score: 60.0,
        trend: "flat".to_string(),
        attempt_count: 3,
        confidence: 0.3,
        recent_scores: vec![55.0, 60.0, 65.0],
        updated_at: 1_700_000_000_000,
    };
    competency::upsert_competency_record(db.conn(), &rec).expect("first upsert failed");

    rec.level = "competent".to_string();
    rec.avg_score = 80.0;
    rec.attempt_count = 5;
    rec.recent_scores = vec![55.0, 60.0, 65.0, 90.0, 95.0];
    competency::upsert_competency_record(db.conn(), &rec).expect("second upsert failed");

    assert_eq!(db.count("SELECT COUNT(*) FROM competency_records"), 1);

    let all = competency::list_competency_records(db.conn()).expect("list failed");
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].level, "competent");
    assert_eq!(all[0].avg_score, 80.0);
    assert_eq!(all[0].attempt_count, 5);
    assert_eq!(all[0].recent_scores.len(), 5);
}

#[test]
fn competency_records_survive_a_restart() {
    let mut db = TestDb::new();
    let rec = CompetencyRecordDto {
        domain: "completeness".to_string(),
        level: "advanced".to_string(),
        avg_score: 91.0,
        recent_score: 93.0,
        trend: "up".to_string(),
        attempt_count: 8,
        confidence: 0.8,
        recent_scores: vec![88.0, 91.0, 93.0],
        updated_at: 1_700_000_000_000,
    };
    competency::upsert_competency_record(db.conn(), &rec).unwrap();

    db.reopen();

    let all = competency::list_competency_records(db.conn()).expect("list failed");
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].domain, "completeness");
    assert_eq!(all[0].trend, "up");
    assert_eq!(all[0].confidence, 0.8);
}
