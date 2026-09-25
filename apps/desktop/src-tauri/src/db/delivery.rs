use super::models::{DeliveryEventDto, SelectionTraceDto};
use rusqlite::{params, Connection};

/// The exposure ledger's storage layer (D12 work package 8).
///
/// Append-only, and the API is the enforcement: there is `append`, there is
/// `record_answer`, and there is no update or delete. The table's own
/// constraints repeat the same rules, so a caller that bypassed this module
/// would still be refused by SQLite.
///
/// Nothing here decides anything about selection. Rows are written after a
/// decision has been made and read back so a later session can prefer what a
/// learner has not seen.

fn row_to_event(row: &rusqlite::Row) -> rusqlite::Result<DeliveryEventDto> {
    let jurisdictions_json: String = row.get("jurisdictions")?;
    let trace_json: String = row.get("trace")?;
    let correct: Option<i64> = row.get("correct")?;

    Ok(DeliveryEventDto {
        delivery_id: row.get("delivery_id")?,
        session_id: row.get("session_id")?,
        learner_ref: row.get("learner_ref")?,
        cohort_ref: row.get("cohort_ref")?,
        population: row.get("population")?,
        item_id: row.get("item_id")?,
        item_revision: row.get("item_revision")?,
        concept_id: row.get("concept_id")?,
        corpus_release_id: row.get("corpus_release_id")?,
        policy_version: row.get("policy_version")?,
        envelope_id: row.get("envelope_id")?,
        tier_at_delivery: row.get("tier_at_delivery")?,
        modality: row.get("modality")?,
        difficulty_level: row.get("difficulty_level")?,
        jurisdictions: serde_json::from_str(&jurisdictions_json).unwrap_or_default(),
        delivered_at: row.get("delivered_at")?,
        delivered_on: row.get("delivered_on")?,
        slot_index: row.get("slot_index")?,
        answered_choice_id: row.get("answered_choice_id")?,
        correct: correct.map(|value| value != 0),
        answered_at: row.get("answered_at")?,
        // A trace that will not parse is a bug in whatever wrote it. Rather
        // than fail the whole read, the row comes back with an empty trace
        // whose reasons say so - the delivery itself is still history.
        trace: serde_json::from_str::<SelectionTraceDto>(&trace_json).unwrap_or(SelectionTraceDto {
            novelty: "UNSEEN".to_string(),
            best_novelty_available: "UNSEEN".to_string(),
            cross_user_over_exposed: false,
            cross_user_share: None,
            diversity_cost: 0.0,
            pool_size: 0,
            stratum_key: String::new(),
            reasons: vec!["TRACE_UNREADABLE".to_string()],
        }),
    })
}

/// Records one delivery. A duplicate `delivery_id` is refused by the primary
/// key rather than accepted, because a silently accepted copy would inflate
/// every exposure count the ledger exists to measure.
pub fn append_delivery_event(conn: &Connection, event: &DeliveryEventDto) -> rusqlite::Result<()> {
    let jurisdictions = serde_json::to_string(&event.jurisdictions).unwrap_or_else(|_| "[]".to_string());
    let trace = serde_json::to_string(&event.trace).unwrap_or_else(|_| "{}".to_string());

    conn.execute(
        "INSERT INTO delivery_events (
            delivery_id, session_id, learner_ref, cohort_ref, population,
            item_id, item_revision, concept_id,
            corpus_release_id, policy_version, envelope_id, tier_at_delivery,
            modality, difficulty_level, jurisdictions,
            delivered_at, delivered_on, slot_index,
            answered_choice_id, correct, answered_at, trace
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
        params![
            event.delivery_id,
            event.session_id,
            event.learner_ref,
            event.cohort_ref,
            event.population,
            event.item_id,
            event.item_revision,
            event.concept_id,
            event.corpus_release_id,
            event.policy_version,
            event.envelope_id,
            event.tier_at_delivery,
            event.modality,
            event.difficulty_level,
            jurisdictions,
            event.delivered_at,
            event.delivered_on,
            event.slot_index,
            event.answered_choice_id,
            event.correct.map(|value| if value { 1 } else { 0 }),
            event.answered_at,
            trace,
        ],
    )?;
    Ok(())
}

/// Fills in the answer for one delivery, exactly once.
///
/// The `answered_choice_id IS NULL` clause is what makes it once: a second
/// attempt matches no row and is reported as such, rather than overwriting
/// what the learner actually did.
pub fn record_delivery_answer(
    conn: &Connection,
    delivery_id: &str,
    answered_choice_id: &str,
    correct: bool,
    answered_at: &str,
) -> rusqlite::Result<bool> {
    let updated = conn.execute(
        "UPDATE delivery_events
            SET answered_choice_id = ?2, correct = ?3, answered_at = ?4
          WHERE delivery_id = ?1 AND answered_choice_id IS NULL",
        params![
            delivery_id,
            answered_choice_id,
            if correct { 1 } else { 0 },
            answered_at
        ],
    )?;
    Ok(updated == 1)
}

const SELECT_COLUMNS: &str = "delivery_id, session_id, learner_ref, cohort_ref, population,
     item_id, item_revision, concept_id, corpus_release_id, policy_version, envelope_id,
     tier_at_delivery, modality, difficulty_level, jurisdictions, delivered_at, delivered_on,
     slot_index, answered_choice_id, correct, answered_at, trace";

/// One learner's deliveries, oldest first, optionally from a date.
///
/// Ordered so the exposure snapshot can be folded in a single pass, and
/// scoped to one learner because that is the only view a device has: a
/// single install cannot see anyone else's history.
pub fn list_deliveries_for_learner(
    conn: &Connection,
    learner_ref: &str,
    since: Option<&str>,
) -> rusqlite::Result<Vec<DeliveryEventDto>> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM delivery_events
          WHERE learner_ref = ?1 AND (?2 IS NULL OR delivered_on >= ?2)
          ORDER BY delivered_at ASC, slot_index ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![learner_ref, since], row_to_event)?;
    rows.collect()
}

/// One session's deliveries, in the order they were served.
pub fn list_deliveries_for_session(
    conn: &Connection,
    session_id: &str,
) -> rusqlite::Result<Vec<DeliveryEventDto>> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM delivery_events
          WHERE session_id = ?1 ORDER BY slot_index ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![session_id], row_to_event)?;
    rows.collect()
}
