use crate::db::models::{CompetencyRecordDto, SessionRecordDto, UserProfileDto};
use crate::db::{competency, profile, sessions, DbState};
use tauri::State;

fn map_err(e: rusqlite::Error) -> String {
    // User-facing errors should be understandable (Architecture Package
    // Section 57); the detailed rusqlite error still reaches the log via
    // Display, this is just what crosses the IPC boundary to JS.
    format!("Database error: {e}")
}

#[tauri::command]
pub fn save_session(state: State<DbState>, record: SessionRecordDto) -> Result<(), String> {
    let mut conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    sessions::save_session(&mut conn, &record).map_err(map_err)
}

#[tauri::command]
pub fn get_session(state: State<DbState>, id: String) -> Result<Option<SessionRecordDto>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    sessions::get_session(&conn, &id).map_err(map_err)
}

#[tauri::command]
pub fn list_sessions(state: State<DbState>) -> Result<Vec<SessionRecordDto>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    let ids = sessions::list_session_ids(&conn).map_err(map_err)?;
    let mut records = Vec::with_capacity(ids.len());
    for id in ids {
        if let Some(record) = sessions::get_session(&conn, &id).map_err(map_err)? {
            records.push(record);
        }
    }
    Ok(records)
}

#[tauri::command]
pub fn find_interrupted_sessions(state: State<DbState>) -> Result<Vec<SessionRecordDto>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    let ids = sessions::find_interrupted_session_ids(&conn).map_err(map_err)?;
    let mut records = Vec::with_capacity(ids.len());
    for id in ids {
        if let Some(record) = sessions::get_session(&conn, &id).map_err(map_err)? {
            records.push(record);
        }
    }
    Ok(records)
}

#[tauri::command]
pub fn get_profile(state: State<DbState>) -> Result<Option<UserProfileDto>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    profile::get_profile(&conn).map_err(map_err)
}

#[tauri::command]
pub fn save_profile(state: State<DbState>, profile: UserProfileDto) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    crate::db::profile::save_profile(&conn, &profile).map_err(map_err)
}

#[tauri::command]
pub fn list_competency_records(state: State<DbState>) -> Result<Vec<CompetencyRecordDto>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    competency::list_competency_records(&conn).map_err(map_err)
}

#[tauri::command]
pub fn upsert_competency_record(
    state: State<DbState>,
    record: CompetencyRecordDto,
) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    competency::upsert_competency_record(&conn, &record).map_err(map_err)
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
