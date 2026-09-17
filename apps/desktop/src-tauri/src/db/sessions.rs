use super::models::{DocumentationDraftDto, EvaluationResultDto, SessionFlagDto, SessionRecordDto};
use super::{now_ms_string, LOCAL_USER_ID};
use rusqlite::{params, Connection, Row};

/// Every read of a session record goes through this one statement: the
/// session, its latest documentation attempt, and that attempt's evaluation,
/// in a single query.
///
/// It replaces a per-session loop that ran three queries for each session
/// (Phase 7 accepted debt A10) while keeping the previous loader's
/// semantics exactly:
/// - the attempt is the session's latest by `submitted_at`;
/// - the evaluation is the attempt's first by `rowid`;
/// - a session with no attempt row gets an empty draft and no evaluation.
///
/// The timestamp columns hold epoch-millisecond *strings*, so ordering casts
/// them to integers; sorting the text lexicographically would misorder
/// values of different digit lengths (Phase 7 accepted debt A13). `s.id`
/// breaks ties so the order is fully deterministic.
const SESSION_SELECT: &str = "
    SELECT s.id, s.scenario_id, s.scenario_version, s.scenario_title, s.mode, s.status,
           s.started_at, s.active_ms, s.paused_ms, s.completed_at, s.flags_json,
           a.id AS attempt_id, a.chief_complaint, a.hpi, a.ros, a.physical_exam,
           a.assessment, a.plan, a.additional_notes,
           e.id AS eval_id, e.overall_score, e.category_scores_json, e.errors_json,
           e.time_efficiency_ratio, e.scoring_weights_json, e.evaluated_at
    FROM simulation_sessions s
    LEFT JOIN documentation_attempts a ON a.id = (
        SELECT a2.id FROM documentation_attempts a2
        WHERE a2.session_id = s.id
        ORDER BY CAST(a2.submitted_at AS INTEGER) DESC
        LIMIT 1)
    LEFT JOIN evaluation_results e ON e.id = (
        SELECT e2.id FROM evaluation_results e2
        WHERE e2.attempt_id = a.id
        ORDER BY e2.rowid
        LIMIT 1)";

const NEWEST_FIRST: &str = " ORDER BY CAST(s.started_at AS INTEGER) DESC, s.id DESC";

fn record_from_row(row: &Row) -> rusqlite::Result<SessionRecordDto> {
    let flags_json: String = row.get("flags_json")?;
    let flags: Vec<SessionFlagDto> = serde_json::from_str(&flags_json).unwrap_or_default();

    let attempt_id: Option<String> = row.get("attempt_id")?;
    let (draft, evaluation) = match attempt_id {
        None => (DocumentationDraftDto::default(), None),
        Some(_) => {
            let draft = DocumentationDraftDto {
                chief_complaint: row.get("chief_complaint")?,
                hpi: row.get("hpi")?,
                ros: row.get("ros")?,
                physical_exam: row.get("physical_exam")?,
                assessment: row.get("assessment")?,
                plan: row.get("plan")?,
                additional_notes: row.get("additional_notes")?,
            };
            let eval_id: Option<String> = row.get("eval_id")?;
            let evaluation = match eval_id {
                None => None,
                Some(_) => Some(EvaluationResultDto {
                    overall_score: row.get("overall_score")?,
                    category_scores: serde_json::from_str(
                        &row.get::<_, String>("category_scores_json")?,
                    )
                    .unwrap_or(serde_json::Value::Null),
                    errors: serde_json::from_str(&row.get::<_, String>("errors_json")?)
                        .unwrap_or(serde_json::Value::Null),
                    scoring_weights_used: serde_json::from_str(
                        &row.get::<_, String>("scoring_weights_json")?,
                    )
                    .unwrap_or(serde_json::Value::Null),
                    time_efficiency_ratio: row.get("time_efficiency_ratio")?,
                    evaluated_at: row.get::<_, String>("evaluated_at")?.parse().unwrap_or(0),
                }),
            };
            (draft, evaluation)
        }
    };

    Ok(SessionRecordDto {
        id: row.get("id")?,
        scenario_id: row.get("scenario_id")?,
        scenario_version: row.get("scenario_version")?,
        scenario_title: row.get("scenario_title")?,
        mode: row.get("mode")?,
        status: row.get("status")?,
        started_at: row.get::<_, String>("started_at")?.parse().unwrap_or(0),
        active_ms: row.get("active_ms")?,
        paused_ms: row.get("paused_ms")?,
        completed_at: row
            .get::<_, Option<String>>("completed_at")?
            .and_then(|c| c.parse().ok()),
        flags,
        draft,
        evaluation,
    })
}

fn query_records(
    conn: &Connection,
    filter: &str,
    args: &[&dyn rusqlite::ToSql],
) -> rusqlite::Result<Vec<SessionRecordDto>> {
    let sql = format!("{SESSION_SELECT}{filter}{NEWEST_FIRST}");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(args, record_from_row)?;
    rows.collect()
}

/// Upserts a full session record: the session row, its single attempt, and
/// its evaluation result (if present), all in one transaction so a crash
/// mid-write can't leave the three tables inconsistent.
pub fn save_session(conn: &mut Connection, record: &SessionRecordDto) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    let flags_json = serde_json::to_string(&record.flags).unwrap_or_else(|_| "[]".to_string());

    tx.execute(
        "INSERT INTO simulation_sessions
            (id, user_id, scenario_id, scenario_version, scenario_title, mode, status,
             started_at, active_ms, paused_ms, completed_at, flags_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            active_ms = excluded.active_ms,
            paused_ms = excluded.paused_ms,
            completed_at = excluded.completed_at,
            flags_json = excluded.flags_json",
        params![
            record.id,
            LOCAL_USER_ID,
            record.scenario_id,
            record.scenario_version,
            record.scenario_title,
            record.mode,
            record.status,
            record.started_at.to_string(),
            record.active_ms,
            record.paused_ms,
            record.completed_at.map(|c| c.to_string()),
            flags_json,
        ],
    )?;

    // The attempt row is upserted on every save, not only on final
    // submission - this is what makes autosave meaningful. A session that
    // is only in_progress/paused has no evaluation yet, but its draft text
    // must still survive a crash (Architecture Package Section 10/29:
    // "interrupted sessions must not lose work").
    let attempt_id = format!("{}-attempt", record.id);
    tx.execute(
        "INSERT INTO documentation_attempts
            (id, session_id, chief_complaint, hpi, ros, physical_exam, assessment, plan, additional_notes, submitted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET
            chief_complaint = excluded.chief_complaint,
            hpi = excluded.hpi,
            ros = excluded.ros,
            physical_exam = excluded.physical_exam,
            assessment = excluded.assessment,
            plan = excluded.plan,
            additional_notes = excluded.additional_notes,
            submitted_at = excluded.submitted_at",
        params![
            attempt_id,
            record.id,
            record.draft.chief_complaint,
            record.draft.hpi,
            record.draft.ros,
            record.draft.physical_exam,
            record.draft.assessment,
            record.draft.plan,
            record.draft.additional_notes,
            now_ms_string(),
        ],
    )?;

    if let Some(evaluation) = &record.evaluation {
        let eval_id = format!("{}-eval", record.id);
        tx.execute(
            "INSERT INTO evaluation_results
                (id, attempt_id, overall_score, category_scores_json, errors_json,
                 time_efficiency_ratio, scoring_weights_json, evaluated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                overall_score = excluded.overall_score,
                category_scores_json = excluded.category_scores_json,
                errors_json = excluded.errors_json,
                time_efficiency_ratio = excluded.time_efficiency_ratio,
                scoring_weights_json = excluded.scoring_weights_json,
                evaluated_at = excluded.evaluated_at",
            params![
                eval_id,
                attempt_id,
                evaluation.overall_score,
                serde_json::to_string(&evaluation.category_scores).unwrap_or_default(),
                serde_json::to_string(&evaluation.errors).unwrap_or_default(),
                evaluation.time_efficiency_ratio,
                serde_json::to_string(&evaluation.scoring_weights_used).unwrap_or_default(),
                evaluation.evaluated_at.to_string(),
            ],
        )?;
    }

    tx.commit()
}

pub fn get_session(conn: &Connection, id: &str) -> rusqlite::Result<Option<SessionRecordDto>> {
    Ok(query_records(conn, " WHERE s.id = ?1", &[&id])?
        .into_iter()
        .next())
}

/// Every session, newest first.
pub fn list_sessions(conn: &Connection) -> rusqlite::Result<Vec<SessionRecordDto>> {
    query_records(conn, "", &[])
}

/// Sessions left `in_progress` or `paused` - the crash-recovery candidates -
/// newest first.
pub fn find_interrupted_sessions(conn: &Connection) -> rusqlite::Result<Vec<SessionRecordDto>> {
    query_records(conn, " WHERE s.status IN ('in_progress', 'paused')", &[])
}
