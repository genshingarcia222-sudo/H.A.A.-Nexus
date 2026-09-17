//! Versioned SQLite schema migrations (Phase 8.2.1; clears Phase 7
//! condition C1).
//!
//! Before this module, `001_initial.sql` was executed unconditionally on
//! every boot. That was only safe because every statement in it is
//! `CREATE ... IF NOT EXISTS`; it gave no way to make a change that is *not*
//! naturally repeatable, such as adding a column or widening the
//! `simulation_sessions.mode` CHECK constraint that Assessment mode will need.
//!
//! # How it works
//!
//! - Migrations are numbered SQL files in `migrations/`, embedded into the
//!   binary with `include_str!` and listed in [`MIGRATIONS`] in order.
//! - The authoritative schema version is the integer stored in
//!   `application_metadata['schema_version']`, as Architecture Package
//!   Section 20 specifies. A database with no such row is version 0.
//! - On open, every migration whose version is above the stored version is
//!   applied, in order, **each in its own transaction together with the
//!   version bump**. A migration either fully applies and is recorded, or
//!   fully rolls back and the stored version is unchanged. It is never
//!   partially applied, and never applied twice.
//!
//! # Upgrading databases created before versioning existed
//!
//! Such a database already has the full `001` schema but no version row, so
//! it reads as version 0 and `001` runs again. That is a no-op, because
//! `001` consists only of `IF NOT EXISTS` DDL, after which version 1 is
//! recorded. No learner data is touched. A test pins `001`'s idempotency so
//! this upgrade path cannot be broken by a later edit to that file.
//!
//! Only `001` needs that property. Every later migration runs exactly once
//! and may use ordinary, non-repeatable DDL.
//!
//! # Table rebuilds and foreign keys
//!
//! SQLite cannot `ALTER` a CHECK constraint; changing one needs the
//! documented rebuild (create the new table, copy rows, drop the old table,
//! rename). With foreign-key enforcement on, dropping a parent table such as
//! `simulation_sessions` fails, and `PRAGMA foreign_keys` is silently ignored
//! inside a transaction. So each migration runs with enforcement switched
//! off *outside* its transaction, the transaction checks
//! `PRAGMA foreign_key_check` before committing and rolls back on any
//! violation, and enforcement is switched back on afterwards whether the
//! migration succeeded or failed.

use rusqlite::{Connection, OptionalExtension};
use std::fmt;

/// One numbered schema migration.
#[derive(Debug, Clone, Copy)]
pub struct Migration {
    /// Must equal the migration's 1-based position in the list.
    pub version: u32,
    pub name: &'static str,
    pub sql: &'static str,
}

/// Every migration the app ships, in order. Append new migrations here;
/// never edit or reorder one that has already been released.
pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "001_initial",
        sql: include_str!("../../migrations/001_initial.sql"),
    },
    Migration {
        version: 2,
        name: "002_assessment_mode",
        sql: include_str!("../../migrations/002_assessment_mode.sql"),
    },
];

const SCHEMA_VERSION_KEY: &str = "schema_version";

#[derive(Debug)]
pub enum MigrationError {
    Sqlite(rusqlite::Error),
    /// The migration list itself is malformed - a build defect, not a
    /// runtime condition.
    InvalidMigrationList(String),
    /// The database was written by a newer build than this one. Refused
    /// outright: an older build cannot know what a newer schema means, and
    /// carrying on risks corrupting data it does not understand.
    DatabaseNewerThanApp {
        database: u32,
        app: u32,
    },
    /// `schema_version` exists but is not a valid version number. Refused
    /// rather than guessed at, since a wrong guess could re-run migrations.
    CorruptSchemaVersion(String),
    /// A migration failed and was rolled back. The database remains at
    /// `version - 1`.
    MigrationFailed {
        version: u32,
        name: &'static str,
        cause: Box<MigrationError>,
    },
    /// A migration left rows violating a foreign key. Rolled back.
    ForeignKeyViolation {
        version: u32,
        name: &'static str,
    },
}

impl fmt::Display for MigrationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Sqlite(e) => write!(f, "SQLite error: {e}"),
            Self::InvalidMigrationList(msg) => write!(f, "invalid migration list: {msg}"),
            Self::DatabaseNewerThanApp { database, app } => write!(
                f,
                "database schema version {database} is newer than this build supports ({app})"
            ),
            Self::CorruptSchemaVersion(value) => {
                write!(f, "stored schema_version is not a valid version: {value:?}")
            }
            Self::MigrationFailed {
                version,
                name,
                cause,
            } => write!(
                f,
                "migration {version} ({name}) failed and was rolled back: {cause}"
            ),
            Self::ForeignKeyViolation { version, name } => write!(
                f,
                "migration {version} ({name}) left foreign-key violations and was rolled back"
            ),
        }
    }
}

impl std::error::Error for MigrationError {}

impl From<rusqlite::Error> for MigrationError {
    fn from(e: rusqlite::Error) -> Self {
        Self::Sqlite(e)
    }
}

/// The version recorded in the database, or 0 if none has been recorded
/// (a fresh database, or one created before versioning existed).
pub fn current_schema_version(conn: &Connection) -> Result<u32, MigrationError> {
    let metadata_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'application_metadata')",
        [],
        |row| row.get(0),
    )?;
    if !metadata_exists {
        return Ok(0);
    }

    let stored: Option<String> = conn
        .query_row(
            "SELECT value FROM application_metadata WHERE key = ?1",
            [SCHEMA_VERSION_KEY],
            |row| row.get(0),
        )
        .optional()?;

    match stored {
        None => Ok(0),
        Some(value) => value
            .parse::<u32>()
            .map_err(|_| MigrationError::CorruptSchemaVersion(value)),
    }
}

fn validate(migrations: &[Migration]) -> Result<(), MigrationError> {
    for (index, migration) in migrations.iter().enumerate() {
        let expected = index as u32 + 1;
        if migration.version != expected {
            return Err(MigrationError::InvalidMigrationList(format!(
                "migration {} ({}) is at position {expected}; versions must be contiguous from 1",
                migration.version, migration.name
            )));
        }
    }
    Ok(())
}

/// Applies every pending migration in order. Returns the resulting version.
pub fn run_migrations(
    conn: &mut Connection,
    migrations: &[Migration],
) -> Result<u32, MigrationError> {
    validate(migrations)?;
    let latest = migrations.len() as u32;
    let current = current_schema_version(conn)?;

    if current > latest {
        return Err(MigrationError::DatabaseNewerThanApp {
            database: current,
            app: latest,
        });
    }

    for migration in &migrations[current as usize..] {
        apply(conn, migration)?;
    }

    Ok(latest)
}

fn apply(conn: &mut Connection, migration: &Migration) -> Result<(), MigrationError> {
    // Must happen outside a transaction - see the module docs.
    conn.pragma_update(None, "foreign_keys", "OFF")?;
    let outcome = apply_in_transaction(conn, migration);
    // Restore enforcement whatever happened above. If both the migration and
    // the restore fail, the migration's error is the one worth reporting.
    let restored = conn.pragma_update(None, "foreign_keys", "ON");
    outcome?;
    restored?;
    Ok(())
}

fn apply_in_transaction(
    conn: &mut Connection,
    migration: &Migration,
) -> Result<(), MigrationError> {
    let failed = |cause: MigrationError| MigrationError::MigrationFailed {
        version: migration.version,
        name: migration.name,
        cause: Box::new(cause),
    };

    // Dropping `tx` without committing rolls everything back, including the
    // DDL, so every early return below leaves the database untouched.
    let tx = conn.transaction().map_err(|e| failed(e.into()))?;

    tx.execute_batch(migration.sql)
        .map_err(|e| failed(e.into()))?;

    let has_violations = tx
        .prepare("PRAGMA foreign_key_check")
        .and_then(|mut stmt| stmt.exists([]))
        .map_err(|e| failed(e.into()))?;
    if has_violations {
        return Err(MigrationError::ForeignKeyViolation {
            version: migration.version,
            name: migration.name,
        });
    }

    tx.execute(
        "INSERT INTO application_metadata (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![SCHEMA_VERSION_KEY, migration.version.to_string()],
    )
    .map_err(|e| failed(e.into()))?;

    tx.commit().map_err(|e| failed(e.into()))
}
