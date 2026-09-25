//! IPC data contract: the shared fixtures in `apps/desktop/ipc-contract/` are
//! what the React frontend sends and receives. Every DTO documents itself as
//! mirroring a `nexus-core` type "exactly" through hand-written serde renames;
//! these tests are what make that claim true rather than assumed.
//!
//! A mistyped or missing rename would otherwise fail silently at runtime -
//! the frontend would receive `undefined` for a field - while every other
//! Rust and TypeScript test stayed green.

use super::models::{CompetencyRecordDto, DeliveryEventDto, SessionRecordDto, UserProfileDto};
use super::{competency, delivery, init_connection, profile, sessions};
use rusqlite::Connection;
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

const SESSION_COMPLETED: &str = include_str!("../../../ipc-contract/session-record.completed.json");
const SESSION_IN_PROGRESS: &str =
    include_str!("../../../ipc-contract/session-record.in-progress.json");
const COMPETENCY: &str = include_str!("../../../ipc-contract/competency-record.json");
const PROFILE: &str = include_str!("../../../ipc-contract/user-profile.json");

static COUNTER: AtomicU64 = AtomicU64::new(0);

struct TempDb {
    path: PathBuf,
    conn: Option<Connection>,
}

impl TempDb {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "haa-nexus-contract-test-{}-{}.sqlite",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::SeqCst)
        ));
        let _ = std::fs::remove_file(&path);
        let conn = init_connection(path.clone()).expect("init failed");
        Self {
            path,
            conn: Some(conn),
        }
    }
    fn conn(&self) -> &Connection {
        self.conn.as_ref().unwrap()
    }
    fn conn_mut(&mut self) -> &mut Connection {
        self.conn.as_mut().unwrap()
    }
}

impl Drop for TempDb {
    fn drop(&mut self) {
        self.conn = None;
        let _ = std::fs::remove_file(&self.path);
        let _ = std::fs::remove_file(self.path.with_extension("sqlite-wal"));
        let _ = std::fs::remove_file(self.path.with_extension("sqlite-shm"));
    }
}

fn fixture(json: &str) -> Value {
    serde_json::from_str(json).expect("fixture is not valid JSON")
}

/// Deserializes the fixture into `T` - failing on any missing or mistyped
/// field - and serializes it back, which must reproduce the fixture exactly:
/// no field dropped, renamed, or added.
fn assert_exact_round_trip<T: DeserializeOwned + Serialize>(json: &str) -> T {
    let expected = fixture(json);
    let dto: T = serde_json::from_value(expected.clone())
        .unwrap_or_else(|e| panic!("fixture does not deserialize into the DTO: {e}"));
    let actual = serde_json::to_value(&dto).expect("serialize failed");
    assert_eq!(
        actual, expected,
        "DTO does not round-trip the IPC fixture exactly"
    );
    dto
}

// --- serde contract ------------------------------------------------------

#[test]
fn completed_session_record_matches_the_ipc_contract_exactly() {
    assert_exact_round_trip::<SessionRecordDto>(SESSION_COMPLETED);
}

#[test]
fn in_progress_session_record_with_nulls_matches_the_ipc_contract_exactly() {
    assert_exact_round_trip::<SessionRecordDto>(SESSION_IN_PROGRESS);
}

#[test]
fn competency_record_matches_the_ipc_contract_exactly() {
    assert_exact_round_trip::<CompetencyRecordDto>(COMPETENCY);
}

#[test]
fn user_profile_matches_the_ipc_contract_exactly() {
    assert_exact_round_trip::<UserProfileDto>(PROFILE);
}

#[test]
fn a_record_missing_a_required_field_is_rejected_rather_than_defaulted() {
    let mut broken = fixture(SESSION_COMPLETED);
    broken.as_object_mut().unwrap().remove("scenarioVersion");
    assert!(serde_json::from_value::<SessionRecordDto>(broken).is_err());
}

// --- through real SQLite ---------------------------------------------------

#[test]
fn session_records_survive_a_database_round_trip_byte_for_byte() {
    let mut db = TempDb::new();
    for json in [SESSION_COMPLETED, SESSION_IN_PROGRESS] {
        let dto: SessionRecordDto = serde_json::from_str(json).unwrap();
        sessions::save_session(db.conn_mut(), &dto).unwrap();
        let loaded = sessions::get_session(db.conn(), &dto.id)
            .unwrap()
            .expect("session missing");
        assert_eq!(
            serde_json::to_value(&loaded).unwrap(),
            fixture(json),
            "session {} changed on its way through SQLite",
            dto.id
        );
    }
}

#[test]
fn competency_records_survive_a_database_round_trip_byte_for_byte() {
    let db = TempDb::new();
    let dto: CompetencyRecordDto = serde_json::from_str(COMPETENCY).unwrap();
    competency::upsert_competency_record(db.conn(), &dto).unwrap();
    let loaded = competency::get_competency_record(db.conn(), &dto.population, &dto.domain)
        .unwrap()
        .expect("record missing");
    assert_eq!(serde_json::to_value(&loaded).unwrap(), fixture(COMPETENCY));
}

// --- competency batch atomicity ---------------------------------------------

#[test]
fn a_batch_of_competency_records_is_written_all_or_nothing() {
    // An attempt is folded into every domain or into none. A half-written
    // fold cannot be repaired by submitting again, because submission is
    // idempotent, so the batch has to be atomic rather than best-effort.
    let mut db = TempDb::new();
    let template: CompetencyRecordDto = serde_json::from_str(COMPETENCY).unwrap();

    let mut good = template.clone();
    good.domain = "accuracy".to_string();
    let mut bad = template.clone();
    bad.domain = "completeness".to_string();
    // `level` has a CHECK constraint, so this row is refused by SQLite.
    bad.level = "not_a_real_level".to_string();

    let result = competency::upsert_competency_records(db.conn_mut(), &[good.clone(), bad]);
    assert!(result.is_err(), "a rejected row must fail the batch");

    let survivor =
        competency::get_competency_record(db.conn(), &good.population, &good.domain).unwrap();
    assert!(
        survivor.is_none(),
        "the valid row was committed even though the batch failed"
    );
}

#[test]
fn a_valid_competency_batch_writes_every_record() {
    let mut db = TempDb::new();
    let template: CompetencyRecordDto = serde_json::from_str(COMPETENCY).unwrap();
    let domains = ["accuracy", "completeness", "terminology"];
    let batch: Vec<CompetencyRecordDto> = domains
        .iter()
        .map(|d| {
            let mut r = template.clone();
            r.domain = (*d).to_string();
            r
        })
        .collect();

    competency::upsert_competency_records(db.conn_mut(), &batch).unwrap();

    for domain in domains {
        assert!(
            competency::get_competency_record(db.conn(), &batch[0].population, domain)
                .unwrap()
                .is_some(),
            "{domain} missing after a successful batch"
        );
    }
}

// --- status / mode CHECK constraints ----------------------------------------

/// Every `SessionStatus` in the TypeScript union, in the same order as
/// `simulation-engine/types.ts`. `schemaContract.test.ts` proves this list
/// matches the migration's CHECK constraint; this proves SQLite actually
/// stores each value.
///
/// Most of these are never written today - nothing produces `evaluation_failed`,
/// `retried`, `interrupted`, `abandoned` or `not_started` yet - which is
/// precisely why they need a test: the first code to use one would otherwise
/// discover at runtime, in a learner's session, that the column rejects it.
const ALL_STATUSES: [&str; 8] = [
    "not_started",
    "in_progress",
    "paused",
    "completed",
    "interrupted",
    "abandoned",
    "evaluation_failed",
    "retried",
];

const ALL_MODES: [&str; 3] = ["practice", "simulation", "assessment"];

#[test]
fn every_session_status_and_mode_in_the_domain_is_accepted_by_sqlite() {
    let mut db = TempDb::new();
    let template: SessionRecordDto = serde_json::from_str(SESSION_IN_PROGRESS).unwrap();

    for mode in ALL_MODES {
        for status in ALL_STATUSES {
            let mut dto = template.clone();
            dto.id = format!("contract-{mode}-{status}");
            dto.mode = mode.to_string();
            dto.status = status.to_string();

            sessions::save_session(db.conn_mut(), &dto)
                .unwrap_or_else(|e| panic!("SQLite refused mode={mode} status={status}: {e}"));

            let loaded = sessions::get_session(db.conn(), &dto.id)
                .unwrap()
                .expect("session missing");
            assert_eq!(loaded.mode, mode, "mode changed on the way through SQLite");
            assert_eq!(
                loaded.status, status,
                "status changed on the way through SQLite"
            );
        }
    }
}

#[test]
fn a_status_outside_the_domain_union_is_rejected_by_the_check_constraint() {
    // The constraint is doing real work: it is not a comment. If this ever
    // passes, the CHECK has been dropped and the test above proves nothing.
    let mut db = TempDb::new();
    let mut dto: SessionRecordDto = serde_json::from_str(SESSION_IN_PROGRESS).unwrap();
    dto.id = "contract-bogus-status".to_string();
    dto.status = "not_a_real_status".to_string();
    assert!(sessions::save_session(db.conn_mut(), &dto).is_err());
}

#[test]
fn the_profile_survives_a_database_round_trip_byte_for_byte() {
    let db = TempDb::new();
    let dto: UserProfileDto = serde_json::from_str(PROFILE).unwrap();
    profile::save_profile(db.conn(), &dto).unwrap();
    let loaded = profile::get_profile(db.conn())
        .unwrap()
        .expect("profile missing");
    assert_eq!(serde_json::to_value(&loaded).unwrap(), fixture(PROFILE));
}

// --- migration 004: the exposure ledger (D12 work package 8) --------------

/// One well-formed ledger row, so each test below differs from the valid case
/// in exactly one way.
fn insert_delivery(conn: &Connection, delivery_id: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "INSERT INTO delivery_events (
            delivery_id, session_id, learner_ref, population,
            item_id, item_revision, corpus_release_id, policy_version,
            envelope_id, tier_at_delivery, modality, difficulty_level,
            jurisdictions, delivered_at, delivered_on, slot_index, trace
         ) VALUES (?1, 'S-1', 'learner-7f3a', 'practice',
            'NEXUS-L1-PRIV-000001', 1, 'release-abc', 'training.default@1',
            'training.free@1', 'free', 'DIRECT_KNOWLEDGE', 1,
            '[\"US\"]', '2026-09-25T09:00:00Z', '2026-09-25', 0, '{}')",
        rusqlite::params![delivery_id],
    )
}

#[test]
fn migration_004_creates_the_delivery_ledger() {
    let db = TempDb::new();
    insert_delivery(db.conn(), "D-0001").expect("a well-formed delivery should insert");
    let count: i64 = db
        .conn()
        .query_row("SELECT COUNT(*) FROM delivery_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn the_schema_version_reaches_four() {
    let db = TempDb::new();
    let version: String = db
        .conn()
        .query_row(
            "SELECT value FROM application_metadata WHERE key = 'schema_version'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(version, "4");
}

#[test]
fn a_duplicate_delivery_id_is_refused_rather_than_counted_twice() {
    // A silently accepted duplicate would inflate every exposure count, which
    // is the one thing the ledger exists to measure.
    let db = TempDb::new();
    insert_delivery(db.conn(), "D-0001").unwrap();
    assert!(insert_delivery(db.conn(), "D-0001").is_err());
}

#[test]
fn correctness_cannot_be_recorded_without_the_choice_that_produced_it() {
    let db = TempDb::new();
    insert_delivery(db.conn(), "D-0001").unwrap();
    assert!(db
        .conn()
        .execute(
            "UPDATE delivery_events SET correct = 1 WHERE delivery_id = 'D-0001'",
            [],
        )
        .is_err());
    db.conn()
        .execute(
            "UPDATE delivery_events SET correct = 1, answered_choice_id = 'a' WHERE delivery_id = 'D-0001'",
            [],
        )
        .expect("an answer with its choice should record");
}

#[test]
fn an_answer_cannot_precede_its_delivery() {
    let db = TempDb::new();
    insert_delivery(db.conn(), "D-0001").unwrap();
    assert!(db
        .conn()
        .execute(
            "UPDATE delivery_events SET answered_choice_id = 'a', answered_at = '2026-09-25T08:00:00Z' WHERE delivery_id = 'D-0001'",
            [],
        )
        .is_err());
}

#[test]
fn a_population_outside_the_d5_split_is_rejected() {
    // D5: Practice and Assessment stay distinguishable by constraint, not by
    // convention.
    let db = TempDb::new();
    assert!(db
        .conn()
        .execute(
            "UPDATE delivery_events SET population = 'exam' WHERE delivery_id = 'D-0001'",
            [],
        )
        .is_ok()); // no rows yet: the UPDATE matches nothing
    insert_delivery(db.conn(), "D-0001").unwrap();
    assert!(db
        .conn()
        .execute(
            "UPDATE delivery_events SET population = 'exam' WHERE delivery_id = 'D-0001'",
            [],
        )
        .is_err());
}

// --- exposure ledger IPC contract (D12 work package 8) -------------------

const DELIVERY_EVENT: &str = include_str!("../../../ipc-contract/delivery-event.json");

#[test]
fn delivery_event_matches_the_ipc_contract_exactly() {
    assert_exact_round_trip::<DeliveryEventDto>(DELIVERY_EVENT);
}

#[test]
fn a_delivery_survives_a_database_round_trip_byte_for_byte() {
    let db = TempDb::new();
    let dto: DeliveryEventDto = serde_json::from_str(DELIVERY_EVENT).unwrap();
    delivery::append_delivery_event(db.conn(), &dto).unwrap();
    let loaded = delivery::list_deliveries_for_learner(db.conn(), "learner-7f3a", None).unwrap();
    assert_eq!(loaded.len(), 1);
    assert_eq!(
        serde_json::to_value(&loaded[0]).unwrap(),
        fixture(DELIVERY_EVENT)
    );
}

#[test]
fn an_empty_ledger_answers_with_an_empty_list_rather_than_an_error() {
    let db = TempDb::new();
    assert!(delivery::list_deliveries_for_learner(db.conn(), "nobody", None)
        .unwrap()
        .is_empty());
    assert!(delivery::list_deliveries_for_session(db.conn(), "no-such-run")
        .unwrap()
        .is_empty());
}

#[test]
fn a_duplicate_delivery_is_reported_as_an_error_across_the_boundary() {
    let db = TempDb::new();
    let dto: DeliveryEventDto = serde_json::from_str(DELIVERY_EVENT).unwrap();
    delivery::append_delivery_event(db.conn(), &dto).unwrap();
    assert!(delivery::append_delivery_event(db.conn(), &dto).is_err());
}

#[test]
fn an_answer_is_recorded_once_and_a_second_attempt_reports_false() {
    // False rather than an overwrite: a learner's recorded answer is history,
    // and quietly rewriting it would make the ledger unauditable.
    let db = TempDb::new();
    let dto: DeliveryEventDto = serde_json::from_str(DELIVERY_EVENT).unwrap();
    delivery::append_delivery_event(db.conn(), &dto).unwrap();

    let first = delivery::record_delivery_answer(
        db.conn(),
        &dto.delivery_id,
        "a",
        true,
        "2026-09-25T09:00:30Z",
    )
    .unwrap();
    assert!(first);

    let second = delivery::record_delivery_answer(
        db.conn(),
        &dto.delivery_id,
        "b",
        false,
        "2026-09-25T09:01:00Z",
    )
    .unwrap();
    assert!(!second);

    let loaded = delivery::list_deliveries_for_session(db.conn(), &dto.session_id).unwrap();
    assert_eq!(loaded[0].answered_choice_id.as_deref(), Some("a"));
    assert_eq!(loaded[0].correct, Some(true));
}

#[test]
fn answering_a_delivery_that_is_not_there_reports_false_rather_than_failing() {
    let db = TempDb::new();
    let recorded =
        delivery::record_delivery_answer(db.conn(), "D-absent", "a", true, "2026-09-25T09:00:30Z")
            .unwrap();
    assert!(!recorded);
}

#[test]
fn a_learner_sees_only_their_own_deliveries() {
    let db = TempDb::new();
    let mine: DeliveryEventDto = serde_json::from_str(DELIVERY_EVENT).unwrap();
    let mut theirs = mine.clone();
    theirs.delivery_id = "other-delivery".to_string();
    theirs.learner_ref = "learner-other".to_string();

    delivery::append_delivery_event(db.conn(), &mine).unwrap();
    delivery::append_delivery_event(db.conn(), &theirs).unwrap();

    let loaded = delivery::list_deliveries_for_learner(db.conn(), "learner-7f3a", None).unwrap();
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].learner_ref, "learner-7f3a");
}

#[test]
fn the_since_bound_filters_by_delivery_date() {
    let db = TempDb::new();
    let older: DeliveryEventDto = serde_json::from_str(DELIVERY_EVENT).unwrap();
    let mut newer = older.clone();
    newer.delivery_id = "newer-delivery".to_string();
    newer.delivered_at = "2026-10-02T09:00:00Z".to_string();
    newer.delivered_on = "2026-10-02".to_string();

    delivery::append_delivery_event(db.conn(), &older).unwrap();
    delivery::append_delivery_event(db.conn(), &newer).unwrap();

    let recent =
        delivery::list_deliveries_for_learner(db.conn(), "learner-7f3a", Some("2026-10-01")).unwrap();
    assert_eq!(recent.len(), 1);
    assert_eq!(recent[0].delivery_id, "newer-delivery");
}
