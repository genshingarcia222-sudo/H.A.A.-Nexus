use super::models::CompetencyRecordDto;
use super::LOCAL_USER_ID;
use rusqlite::{params, Connection, OptionalExtension};

fn row_to_record(row: &rusqlite::Row) -> rusqlite::Result<CompetencyRecordDto> {
    let recent_scores_json: String = row.get("recent_scores_json")?;
    Ok(CompetencyRecordDto {
        population: row.get("population")?,
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
/// One population's record for one domain (decision D5). Practice and
/// Assessment are separate rows, so both arguments are part of the key - there
/// is no lookup that returns "the" record for a domain.
pub fn get_competency_record(
    conn: &Connection,
    population: &str,
    domain: &str,
) -> rusqlite::Result<Option<CompetencyRecordDto>> {
    conn.query_row(
        "SELECT population, domain, level, avg_score, recent_score, trend, attempt_count, recent_scores_json, confidence, updated_at
         FROM competency_records WHERE user_id = ?1 AND population = ?2 AND domain = ?3",
        params![LOCAL_USER_ID, population, domain],
        row_to_record,
    )
    .optional()
}

pub fn list_competency_records(conn: &Connection) -> rusqlite::Result<Vec<CompetencyRecordDto>> {
    let mut stmt = conn.prepare(
        "SELECT population, domain, level, avg_score, recent_score, trend, attempt_count, recent_scores_json, confidence, updated_at
         FROM competency_records WHERE user_id = ?1",
    )?;
    let records = stmt
        .query_map(params![LOCAL_USER_ID], row_to_record)?
        .filter_map(|r| r.ok())
        .collect();
    Ok(records)
}

/// Writes several competency records in one transaction.
///
/// An attempt is folded into every domain or into none of them. Writing them
/// one at a time let a failure partway through leave an attempt counted in
/// some domains and not others, which submitting again could not repair
/// because submission is idempotent.
pub fn upsert_competency_records(
    conn: &mut Connection,
    records: &[CompetencyRecordDto],
) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    for record in records {
        upsert_competency_record(&tx, record)?;
    }
    tx.commit()
}

pub fn upsert_competency_record(
    conn: &Connection,
    record: &CompetencyRecordDto,
) -> rusqlite::Result<()> {
    // The id carries the population too, so a practice row and an assessment
    // row for the same domain cannot collide on the primary key (D5).
    let id = format!("{}-{}-{}", LOCAL_USER_ID, record.population, record.domain);
    conn.execute(
        "INSERT INTO competency_records
            (id, user_id, population, domain, level, avg_score, recent_score, trend, attempt_count, recent_scores_json, confidence, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(user_id, population, domain) DO UPDATE SET
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
            record.population,
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
