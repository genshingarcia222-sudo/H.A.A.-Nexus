//! Phase 8.2.1 verification for the versioned migration runner.
//!
//! Like `tests.rs`, these use real on-disk SQLite files rather than
//! `:memory:`, because WAL mode, reopening, and transaction rollback of DDL
//! are part of what is being verified.

use super::migrations::{
    current_schema_version, run_migrations, Migration, MigrationError, MIGRATIONS,
};
use super::models::{DocumentationDraftDto, EvaluationResultDto, SessionRecordDto};
use super::{ensure_local_user, init_connection, sessions};
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// A temp-file database path that removes the file and its WAL sidecars on drop.
struct TempDb {
    path: PathBuf,
}

impl TempDb {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "haa-nexus-migration-test-{}-{}.sqlite",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::SeqCst)
        ));
        let _ = std::fs::remove_file(&path);
        Self { path }
    }

    /// A connection configured like `init_connection`, but with no
    /// migrations run - so a test can decide exactly which ones apply.
    fn open_unmigrated(&self) -> Connection {
        let conn = Connection::open(&self.path).expect("open failed");
        conn.pragma_update(None, "journal_mode", "WAL").unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        conn
    }
}

impl Drop for TempDb {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
        let _ = std::fs::remove_file(self.path.with_extension("sqlite-wal"));
        let _ = std::fs::remove_file(self.path.with_extension("sqlite-shm"));
    }
}

fn initial() -> Migration {
    MIGRATIONS[0]
}

fn count(conn: &Connection, sql: &str) -> i64 {
    conn.query_row(sql, [], |row| row.get(0))
        .expect("count failed")
}

fn table_exists(conn: &Connection, name: &str) -> bool {
    count(
        conn,
        &format!("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '{name}'"),
    ) == 1
}

fn foreign_keys_on(conn: &Connection) -> bool {
    count(conn, "PRAGMA foreign_keys") == 1
}

fn completed_session(id: &str) -> SessionRecordDto {
    SessionRecordDto {
        id: id.to_string(),
        scenario_id: "SCRIBE-FM-014".to_string(),
        scenario_version: "1.0".to_string(),
        scenario_title: "Three-Day Cough, Family Medicine".to_string(),
        mode: "practice".to_string(),
        status: "completed".to_string(),
        started_at: 1_700_000_000_000,
        active_ms: 90_000,
        paused_ms: 0,
        completed_at: Some(1_700_000_090_000),
        flags: vec![],
        draft: DocumentationDraftDto {
            hpi: "Learner's documentation that must survive every migration.".to_string(),
            ..Default::default()
        },
        evaluation: Some(EvaluationResultDto {
            overall_score: 91.0,
            category_scores: serde_json::json!({ "accuracy": 100.0 }),
            errors: serde_json::json!([]),
            scoring_weights_used: serde_json::json!({ "accuracy": 0.3 }),
            time_efficiency_ratio: 0.9,
            evaluated_at: 1_700_000_090_000,
        }),
    }
}

// --- the shipped migration list ---------------------------------------

#[test]
fn shipped_migration_list_is_contiguous_and_applies_cleanly() {
    for (index, migration) in MIGRATIONS.iter().enumerate() {
        assert_eq!(migration.version as usize, index + 1, "{}", migration.name);
    }
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();
    assert_eq!(
        run_migrations(&mut conn, MIGRATIONS).unwrap(),
        MIGRATIONS.len() as u32
    );
}

#[test]
fn initial_migration_is_idempotent_ddl_so_pre_versioning_databases_can_upgrade() {
    // The upgrade path for databases created before versioning depends on
    // 001 being safe to run against a database that already has its schema.
    // Pin that property so a later edit to 001 cannot silently break it.
    let sql = initial().sql;
    for line in sql.lines() {
        let upper = line.trim().to_uppercase();
        if upper.starts_with("CREATE TABLE") || upper.starts_with("CREATE INDEX") {
            assert!(
                upper.contains("IF NOT EXISTS"),
                "001 must stay idempotent; found: {line}"
            );
        }
        for forbidden in ["DROP ", "ALTER ", "INSERT ", "UPDATE ", "DELETE "] {
            assert!(
                !upper.starts_with(forbidden),
                "001 must contain only idempotent DDL; found: {line}"
            );
        }
    }

    // And behaviourally: executing it twice raw is harmless.
    let db = TempDb::new();
    let conn = db.open_unmigrated();
    conn.execute_batch(sql).unwrap();
    conn.execute_batch(sql).unwrap();
}

// --- fresh install ------------------------------------------------------

#[test]
fn a_fresh_database_starts_at_version_zero() {
    let db = TempDb::new();
    let conn = db.open_unmigrated();
    assert_eq!(current_schema_version(&conn).unwrap(), 0);
}

#[test]
fn a_fresh_database_is_migrated_to_the_latest_version_and_records_it() {
    let db = TempDb::new();
    let conn = init_connection(db.path.clone()).unwrap();

    assert_eq!(
        current_schema_version(&conn).unwrap(),
        MIGRATIONS.len() as u32
    );
    let stored: String = conn
        .query_row(
            "SELECT value FROM application_metadata WHERE key = 'schema_version'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(stored, "1");
    assert!(table_exists(&conn, "simulation_sessions"));
    assert!(foreign_keys_on(&conn));
}

// --- ordering and idempotency -------------------------------------------

const CREATE_LOG: Migration = Migration {
    version: 2,
    name: "002_test_create_log",
    // Deliberately NOT idempotent: re-applying it would fail on the CREATE.
    sql: "CREATE TABLE migration_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, step TEXT NOT NULL);
          INSERT INTO migration_log (step) VALUES ('two');",
};

const APPEND_LOG: Migration = Migration {
    version: 3,
    name: "003_test_append_log",
    // Depends on 002's table, so it can only succeed if 002 ran first.
    sql: "INSERT INTO migration_log (step) VALUES ('three');",
};

#[test]
fn pending_migrations_apply_in_order() {
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();

    assert_eq!(
        run_migrations(&mut conn, &[initial(), CREATE_LOG, APPEND_LOG]).unwrap(),
        3
    );

    let steps: Vec<String> = conn
        .prepare("SELECT step FROM migration_log ORDER BY seq")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(steps, ["two", "three"]);
    assert_eq!(current_schema_version(&conn).unwrap(), 3);
}

#[test]
fn only_migrations_newer_than_the_stored_version_are_applied() {
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();
    run_migrations(&mut conn, &[initial(), CREATE_LOG]).unwrap();
    assert_eq!(current_schema_version(&conn).unwrap(), 2);

    // A later build ships 003. Only 003 may run; 002 would fail if re-run.
    run_migrations(&mut conn, &[initial(), CREATE_LOG, APPEND_LOG]).unwrap();

    assert_eq!(count(&conn, "SELECT COUNT(*) FROM migration_log"), 2);
    assert_eq!(current_schema_version(&conn).unwrap(), 3);
}

#[test]
fn rerunning_with_nothing_pending_applies_nothing() {
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();
    let list = [initial(), CREATE_LOG, APPEND_LOG];

    run_migrations(&mut conn, &list).unwrap();
    run_migrations(&mut conn, &list).unwrap();
    run_migrations(&mut conn, &list).unwrap();

    assert_eq!(count(&conn, "SELECT COUNT(*) FROM migration_log"), 2);
    assert_eq!(current_schema_version(&conn).unwrap(), 3);
}

#[test]
fn reopening_an_already_migrated_database_reapplies_nothing_and_keeps_data() {
    let db = TempDb::new();
    {
        let mut conn = init_connection(db.path.clone()).unwrap();
        sessions::save_session(&mut conn, &completed_session("s-1")).unwrap();
    }
    for _ in 0..3 {
        let conn = init_connection(db.path.clone()).unwrap();
        assert_eq!(current_schema_version(&conn).unwrap(), 1);
        assert_eq!(count(&conn, "SELECT COUNT(*) FROM simulation_sessions"), 1);
        assert_eq!(count(&conn, "SELECT COUNT(*) FROM evaluation_results"), 1);
    }
}

// --- upgrading a database created before versioning ---------------------

#[test]
fn a_pre_versioning_database_upgrades_to_version_one_without_losing_learner_data() {
    let db = TempDb::new();

    // Recreate exactly what every pre-8.2.1 build produced: the 001 schema,
    // the local user, real learner data, and no schema_version row.
    {
        let mut conn = db.open_unmigrated();
        conn.execute_batch(initial().sql).unwrap();
        ensure_local_user(&conn).unwrap();
        sessions::save_session(&mut conn, &completed_session("legacy-1")).unwrap();
        assert_eq!(current_schema_version(&conn).unwrap(), 0);
    }

    let conn = init_connection(db.path.clone()).unwrap();

    assert_eq!(current_schema_version(&conn).unwrap(), 1);
    assert_eq!(count(&conn, "SELECT COUNT(*) FROM users"), 1);
    let record = sessions::get_session(&conn, "legacy-1")
        .unwrap()
        .expect("legacy session was lost");
    assert_eq!(
        record.draft.hpi,
        "Learner's documentation that must survive every migration."
    );
    assert_eq!(
        record.evaluation.expect("evaluation lost").overall_score,
        91.0
    );
}

// --- failure behaviour --------------------------------------------------

const FAILING: Migration = Migration {
    version: 2,
    name: "002_test_fails_halfway",
    // The CREATE succeeds, then the INSERT fails. Nothing may survive.
    sql: "CREATE TABLE half_applied (id INTEGER);
          INSERT INTO table_that_does_not_exist VALUES (1);",
};

#[test]
fn a_failing_migration_rolls_back_entirely_and_keeps_the_previous_version() {
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();
    run_migrations(&mut conn, &[initial()]).unwrap();

    let err = run_migrations(&mut conn, &[initial(), FAILING]).unwrap_err();

    assert!(
        matches!(err, MigrationError::MigrationFailed { version: 2, .. }),
        "unexpected error: {err}"
    );
    assert!(
        !table_exists(&conn, "half_applied"),
        "DDL from a failed migration survived"
    );
    assert_eq!(current_schema_version(&conn).unwrap(), 1);
}

#[test]
fn a_failing_migration_stops_the_run_so_later_migrations_do_not_apply() {
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();

    let later = Migration {
        version: 3,
        name: "003_test_after_failure",
        sql: "CREATE TABLE should_never_exist (id INTEGER);",
    };
    assert!(run_migrations(&mut conn, &[initial(), FAILING, later]).is_err());

    assert!(!table_exists(&conn, "should_never_exist"));
    assert_eq!(current_schema_version(&conn).unwrap(), 1);
}

#[test]
fn foreign_key_enforcement_is_restored_after_a_failed_migration() {
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();
    run_migrations(&mut conn, &[initial()]).unwrap();

    let _ = run_migrations(&mut conn, &[initial(), FAILING]);

    assert!(
        foreign_keys_on(&conn),
        "foreign keys left OFF after failure"
    );
}

#[test]
fn a_migration_is_recoverable_once_fixed() {
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();
    run_migrations(&mut conn, &[initial()]).unwrap();
    assert!(run_migrations(&mut conn, &[initial(), FAILING]).is_err());

    let fixed = Migration {
        version: 2,
        name: "002_test_fixed",
        sql: "CREATE TABLE half_applied (id INTEGER);",
    };
    assert_eq!(run_migrations(&mut conn, &[initial(), fixed]).unwrap(), 2);
    assert!(table_exists(&conn, "half_applied"));
}

#[test]
fn a_migration_that_leaves_foreign_key_violations_is_rolled_back() {
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();
    run_migrations(&mut conn, &[initial()]).unwrap();
    ensure_local_user(&conn).unwrap();
    sessions::save_session(&mut conn, &completed_session("s-1")).unwrap();

    // Enforcement is off while a migration runs, so this DELETE succeeds
    // mid-transaction and orphans the session. The pre-commit check must
    // catch it.
    let orphaning = Migration {
        version: 2,
        name: "002_test_orphans_sessions",
        sql: "DELETE FROM users;",
    };
    let err = run_migrations(&mut conn, &[initial(), orphaning]).unwrap_err();

    assert!(
        matches!(err, MigrationError::ForeignKeyViolation { version: 2, .. }),
        "unexpected error: {err}"
    );
    assert_eq!(count(&conn, "SELECT COUNT(*) FROM users"), 1);
    assert_eq!(current_schema_version(&conn).unwrap(), 1);
    assert!(foreign_keys_on(&conn));
}

#[test]
fn init_connection_refuses_a_database_with_a_corrupt_schema_version() {
    // `init_connection` only ever runs the shipped list, so a failing
    // migration cannot be injected through it. This proves the part of its
    // contract that can be: it propagates a migration error instead of
    // opening the database anyway.
    let db = TempDb::new();
    {
        let mut conn = db.open_unmigrated();
        run_migrations(&mut conn, &[initial()]).unwrap();
        conn.execute(
            "UPDATE application_metadata SET value = 'not-a-number' WHERE key = 'schema_version'",
            [],
        )
        .unwrap();
    }
    let err = init_connection(db.path.clone()).unwrap_err();
    assert!(matches!(err, MigrationError::CorruptSchemaVersion(ref v) if v == "not-a-number"));
}

// --- refusing unsafe states ---------------------------------------------

#[test]
fn a_database_from_a_newer_build_is_refused_and_left_untouched() {
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();
    run_migrations(&mut conn, &[initial()]).unwrap();
    conn.execute(
        "UPDATE application_metadata SET value = '5' WHERE key = 'schema_version'",
        [],
    )
    .unwrap();

    let err = run_migrations(&mut conn, MIGRATIONS).unwrap_err();

    assert!(matches!(
        err,
        MigrationError::DatabaseNewerThanApp {
            database: 5,
            app: 1
        }
    ));
    assert_eq!(current_schema_version(&conn).unwrap(), 5);
}

#[test]
fn a_malformed_migration_list_is_rejected_before_anything_is_applied() {
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();
    let gap = Migration {
        version: 3,
        name: "003_test_skips_two",
        sql: "CREATE TABLE should_never_exist (id INTEGER);",
    };

    let err = run_migrations(&mut conn, &[initial(), gap]).unwrap_err();

    assert!(matches!(err, MigrationError::InvalidMigrationList(_)));
    assert!(
        !table_exists(&conn, "simulation_sessions"),
        "001 ran despite an invalid list"
    );
    assert_eq!(current_schema_version(&conn).unwrap(), 0);
}

// --- rehearsal: the table rebuild Assessment mode will need --------------

/// Widens `simulation_sessions.mode` using SQLite's documented table-rebuild
/// procedure. Test-only, and deliberately uses a placeholder value rather
/// than "assessment": this proves the runner can carry a CHECK-constraint
/// change safely, without adding any mode to the product.
const REBUILD_WIDENING_MODE: Migration = Migration {
    version: 2,
    name: "002_test_rebuild_sessions_mode",
    sql: r#"
        CREATE TABLE simulation_sessions_new (
            id                TEXT PRIMARY KEY,
            user_id           TEXT NOT NULL REFERENCES users(id),
            scenario_id       TEXT NOT NULL,
            scenario_version  TEXT NOT NULL,
            scenario_title    TEXT NOT NULL,
            mode              TEXT NOT NULL CHECK (mode IN ('practice','simulation','rehearsal_placeholder')),
            status            TEXT NOT NULL CHECK (status IN
                                ('not_started','in_progress','paused','completed',
                                 'interrupted','abandoned','evaluation_failed','retried')),
            started_at        TEXT NOT NULL,
            active_ms         INTEGER NOT NULL DEFAULT 0,
            paused_ms         INTEGER NOT NULL DEFAULT 0,
            completed_at      TEXT,
            flags_json        TEXT NOT NULL DEFAULT '[]'
        );
        INSERT INTO simulation_sessions_new SELECT * FROM simulation_sessions;
        DROP TABLE simulation_sessions;
        ALTER TABLE simulation_sessions_new RENAME TO simulation_sessions;
        CREATE INDEX idx_sessions_user ON simulation_sessions(user_id);
        CREATE INDEX idx_sessions_status ON simulation_sessions(status);
    "#,
};

#[test]
fn a_mode_check_constraint_can_be_widened_by_table_rebuild_without_losing_data() {
    let db = TempDb::new();
    let mut conn = db.open_unmigrated();
    run_migrations(&mut conn, &[initial()]).unwrap();
    ensure_local_user(&conn).unwrap();
    sessions::save_session(&mut conn, &completed_session("before-rebuild")).unwrap();

    let insert_with_mode = |conn: &Connection, id: &str, mode: &str| {
        conn.execute(
            "INSERT INTO simulation_sessions
                (id, user_id, scenario_id, scenario_version, scenario_title, mode, status, started_at)
             VALUES (?1, 'local-user', 'SCRIBE-FM-014', '1.0', 't', ?2, 'in_progress', '0')",
            rusqlite::params![id, mode],
        )
    };
    assert!(
        insert_with_mode(&conn, "x", "rehearsal_placeholder").is_err(),
        "precondition: the old CHECK should reject the new value"
    );

    assert_eq!(
        run_migrations(&mut conn, &[initial(), REBUILD_WIDENING_MODE]).unwrap(),
        2
    );

    // Existing session, its attempt and its evaluation all survive and
    // still join up through the rebuilt parent table.
    let record = sessions::get_session(&conn, "before-rebuild")
        .unwrap()
        .expect("session lost in rebuild");
    assert_eq!(record.mode, "practice");
    assert_eq!(
        record.draft.hpi,
        "Learner's documentation that must survive every migration."
    );
    assert_eq!(
        record.evaluation.expect("evaluation lost").overall_score,
        91.0
    );

    // The widened constraint accepts the new value and still rejects junk.
    insert_with_mode(&conn, "new-mode", "rehearsal_placeholder").unwrap();
    assert!(insert_with_mode(&conn, "junk", "not_a_mode").is_err());

    // Foreign keys are back on and still enforced against the rebuilt table.
    assert!(foreign_keys_on(&conn));
    assert!(conn
        .execute(
            "INSERT INTO documentation_attempts (id, session_id, submitted_at)
             VALUES ('orphan', 'no-such-session', '0')",
            [],
        )
        .is_err());
    assert_eq!(
        count(&conn, "SELECT COUNT(*) FROM pragma_foreign_key_check"),
        0
    );

    // Indexes dropped with the old table were recreated.
    for index in ["idx_sessions_user", "idx_sessions_status"] {
        assert_eq!(
            count(
                &conn,
                &format!(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = '{index}'"
                )
            ),
            1,
            "{index} missing after rebuild"
        );
    }
}
