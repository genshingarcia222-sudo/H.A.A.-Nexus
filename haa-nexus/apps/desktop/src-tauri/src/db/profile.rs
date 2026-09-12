use super::models::UserProfileDto;
use super::LOCAL_USER_ID;
use rusqlite::{params, Connection, OptionalExtension};

pub fn get_profile(conn: &Connection) -> rusqlite::Result<Option<UserProfileDto>> {
    conn.query_row(
        "SELECT display_name, updated_at FROM users WHERE id = ?1",
        params![LOCAL_USER_ID],
        |row| {
            let updated_at: String = row.get("updated_at")?;
            Ok(UserProfileDto {
                display_name: row.get("display_name")?,
                updated_at: updated_at.parse().unwrap_or(0),
            })
        },
    )
    .optional()
}

pub fn save_profile(conn: &Connection, profile: &UserProfileDto) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE users SET display_name = ?1, updated_at = ?2 WHERE id = ?3",
        params![
            profile.display_name,
            profile.updated_at.to_string(),
            LOCAL_USER_ID
        ],
    )?;
    Ok(())
}
