use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub mod competency;
pub mod migrations;
pub mod models;
pub mod profile;
pub mod sessions;

#[cfg(test)]
mod migration_tests;
#[cfg(test)]
mod tests;

use migrations::{run_migrations, MigrationError, MIGRATIONS};

/// The single local user row for the MVP (no accounts/auth - see
/// Architecture Package Section 47: "local profile", not multi-account).
pub const LOCAL_USER_ID: &str = "local-user";

pub struct DbState(pub Mutex<Connection>);

pub fn init_connection(db_path: PathBuf) -> Result<Connection, MigrationError> {
    let mut conn = Connection::open(db_path)?;

    // WAL + NORMAL synchronous: crash-safe without paying full fsync cost
    // on every write (Architecture Package Section 20). Set before any
    // migration runs, because SQLite cannot switch into WAL mode from inside
    // the transaction each migration is applied in.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;

    // Applies only migrations newer than the recorded schema version - see
    // `migrations.rs`. A failed migration is rolled back and returned as an
    // error, so the app refuses to start rather than run on a half-migrated
    // database.
    run_migrations(&mut conn, MIGRATIONS)?;

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
