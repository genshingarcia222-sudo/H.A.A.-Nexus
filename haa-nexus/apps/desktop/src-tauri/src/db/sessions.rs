use super::models::{DocumentationDraftDto, EvaluationResultDto, SessionFlagDto, SessionRecordDto};
use super::{now_ms_string, LOCAL_USER_ID};
use rusqlite::{params, Connection, OptionalExtension, Row};

fn draft_from_row(row: &Row) -> rusqlite::Result<DocumentationDraftDto> {
    Ok(DocumentationDraftDto {
        chief_complaint: row.get("chief_complaint")?,
        hpi: row.get("hpi")?,
        ros: row.get("ros")?,
        physical_exam: row.get("physical_exam")?,
        assessment: row.get("assessment")?,
        plan: row.get("plan")?,
        additional_notes: row.get("additional_notes")?,
    })
}

/// Loads one session's full record (session + latest attempt + its
/// evaluation, if any) via a few sequential queries. Kept simple rather
/// than one large JOIN, since a session has at most one attempt in the
/// MVP's current flow (retries create a new session, not multiple attempts
/// per session).
fn load_session(conn: &Connection, session_id: &str) -> rusqlite::Result<Option<SessionRecordDto>> {
    let session_row = conn
        .query_row(
            "SELECT id, scenario_id, scenario_version, scenario_title, mode, status,
                    started_at, active_ms, paused_ms, completed_at, flags_json
             FROM simulation_sessions WHERE id = ?1",
            params![session_id],
            |row| {
                let flags_json: String = row.get("flags_json")?;
                let flags: Vec<SessionFlagDto> =
                    serde_json::from_str(&flags_json).unwrap_or_default();
                Ok((
                    row.get::<_, String>("id")?,
                    row.get::<_, String>("scenario_id")?,
                    row.get::<_, String>("scenario_version")?,
                    row.get::<_, String>("scenario_title")?,
                    row.get::<_, String>("mode")?,
                    row.get::<_, String>("status")?,
                    row.get::<_, String>("started_at")?,
                    row.get::<_, i64>("active_ms")?,
                    row.get::<_, i64>("paused_ms")?,
                    row.get::<_, Option<String>>("completed_at")?,
                    flags,
                ))
            },
        )
        .optional()?;

    let Some((
        id,
        scenario_id,
        scenario_version,
        scenario_title,
        mode,
        status,
        started_at,
        active_ms,
        paused_ms,
        completed_at,
        flags,
    )) = session_row
    else {
        return Ok(None);
    };

    let attempt = conn
        .query_row(
            "SELECT id, chief_complaint, hpi, ros, physical_exam, assessment, plan, additional_notes
             FROM documentation_attempts WHERE session_id = ?1 ORDER BY submitted_at DESC LIMIT 1",
            params![id],
            |row| Ok((row.get::<_, String>("id")?, draft_from_row(row)?)),
        )
        .optional()?;

    let (draft, evaluation) = match attempt {
        Some((attempt_id, draft)) => {
            let evaluation = conn
                .query_row(
                    "SELECT overall_score, category_scores_json, errors_json, time_efficiency_ratio,
                            scoring_weights_json, evaluated_at
                     FROM evaluation_results WHERE attempt_id = ?1",
                    params![attempt_id],
                    |row| {
                        Ok(EvaluationResultDto {
                            overall_score: row.get("overall_score")?,
                            category_scores: serde_json::from_str(&row.get::<_, String>("category_scores_json")?)
                                .unwrap_or(serde_json::Value::Null),
                            errors: serde_json::from_str(&row.get::<_, String>("errors_json")?)
                                .unwrap_or(serde_json::Value::Null),
                            scoring_weights_used: serde_json::from_str(
                                &row.get::<_, String>("scoring_weights_json")?,
                            )
                            .unwrap_or(serde_json::Value::Null),
                            time_efficiency_ratio: row.get("time_efficiency_ratio")?,
                            evaluated_at: row.get::<_, String>("evaluated_at")?.parse().unwrap_or(0),
                        })
                    },
                )
                .optional()?;
            (draft, evaluation)
        }
        None => (DocumentationDraftDto::default(), None),
    };

    Ok(Some(SessionRecordDto {
        id,
        scenario_id,
        scenario_version,
        scenario_title,
        mode,
        status,
        started_at: started_at.parse().unwrap_or(0),
        active_ms,
        paused_ms,
        completed_at: completed_at.and_then(|s| s.parse().ok()),
        flags,
        draft,
        evaluation,
    }))
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
    load_session(conn, id)
}

pub fn list_session_ids(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT id FROM simulation_sessions ORDER BY started_at DESC")?;
    let ids = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(ids)
}

pub fn find_interrupted_session_ids(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn
        .prepare("SELECT id FROM simulation_sessions WHERE status IN ('in_progress', 'paused')")?;
    let ids = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(ids)
}
