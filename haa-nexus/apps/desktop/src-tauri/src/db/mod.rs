use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub mod competency;
pub mod models;
pub mod profile;
pub mod sessions;

/// Embedded at compile time so the migration ships inside the binary -
/// no separate file to install alongside the executable.
const INITIAL_MIGRATION: &str = include_str!("../../migrations/001_initial.sql");

/// The single local user row for the MVP (no accounts/auth - see
/// Architecture Package Section 47: "local profile", not multi-account).
pub const LOCAL_USER_ID: &str = "local-user";

pub struct DbState(pub Mutex<Connection>);

pub fn init_connection(db_path: PathBuf) -> rusqlite::Result<Connection> {
    let conn = Connection::open(db_path)?;

    // WAL + NORMAL synchronous: crash-safe without paying full fsync cost
    // on every write (Architecture Package Section 20).
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;

    conn.execute_batch(INITIAL_MIGRATION)?;

    ensure_local_user(&conn)?;

    Ok(conn)
}

fn ensure_local_user(conn: &Connection) -> rusqlite::Result<()> {
    let now = now_ms_string();
    conn.execute(
        "INSERT OR IGNORE INTO users (id, display_name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        rusqlite::params![LOCAL_USER_ID, "Learner", now],
    )?;
    Ok(())
}

/// Current time as the string-epoch-ms convention documented in the migration file.
pub fn now_ms_string() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    now.as_millis().to_string()
}
