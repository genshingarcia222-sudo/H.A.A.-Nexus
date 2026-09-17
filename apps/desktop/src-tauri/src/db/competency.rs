use super::models::CompetencyRecordDto;
use super::LOCAL_USER_ID;
use rusqlite::{params, Connection, OptionalExtension};

fn row_to_record(row: &rusqlite::Row) -> rusqlite::Result<CompetencyRecordDto> {
    let recent_scores_json: String = row.get("recent_scores_json")?;
    Ok(CompetencyRecordDto {
        domain: row.get("domain")?,
        level: row.get("level")?,
        avg_score: row.get("avg_score")?,
        recent_score: row.get("recent_score")?,
        trend: row.get("trend")?,
        attempt_count: row.get("attempt_count")?,
        confidence: row.get("confidence")?,
        recent_scores: serde_json::from_str(&recent_scores_json).unwrap_or_default(),
        updated_at: row.get::<_, String>("updated_at")?.parse().unwrap_or(0),
    })
}

/// One domain's record, or `None` if that domain has never been scored.
/// Replaces listing every record to find one (Phase 7 accepted debt A10).
pub fn get_competency_record(
    conn: &Connection,
    domain: &str,
) -> rusqlite::Result<Option<CompetencyRecordDto>> {
    conn.query_row(
        "SELECT domain, level, avg_score, recent_score, trend, attempt_count, recent_scores_json, confidence, updated_at
         FROM competency_records WHERE user_id = ?1 AND domain = ?2",
        params![LOCAL_USER_ID, domain],
        row_to_record,
    )
    .optional()
}

pub fn list_competency_records(conn: &Connection) -> rusqlite::Result<Vec<CompetencyRecordDto>> {
    let mut stmt = conn.prepare(
        "SELECT domain, level, avg_score, recent_score, trend, attempt_count, recent_scores_json, confidence, updated_at
         FROM competency_records WHERE user_id = ?1",
    )?;
    let records = stmt
        .query_map(params![LOCAL_USER_ID], row_to_record)?
        .filter_map(|r| r.ok())
        .collect();
    Ok(records)
}

pub fn upsert_competency_record(
    conn: &Connection,
    record: &CompetencyRecordDto,
) -> rusqlite::Result<()> {
    let id = format!("{}-{}", LOCAL_USER_ID, record.domain);
    conn.execute(
        "INSERT INTO competency_records
            (id, user_id, domain, level, avg_score, recent_score, trend, attempt_count, recent_scores_json, confidence, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(user_id, domain) DO UPDATE SET
            level = excluded.level,
            avg_score = excluded.avg_score,
            recent_score = excluded.recent_score,
            trend = excluded.trend,
            attempt_count = excluded.attempt_count,
            recent_scores_json = excluded.recent_scores_json,
            confidence = excluded.confidence,
            updated_at = excluded.updated_at",
        params![
            id,
            LOCAL_USER_ID,
            record.domain,
            record.level,
            record.avg_score,
            record.recent_score,
            record.trend,
            record.attempt_count,
            serde_json::to_string(&record.recent_scores).unwrap_or_else(|_| "[]".to_string()),
            record.confidence,
            record.updated_at.to_string(),
        ],
    )?;
    Ok(())
}
