// Release builds are a windowed application, not a console one.
//
// Without this, Windows opens a console behind the app window for every
// release build - the defect Phase 7 recorded as an open Phase 9 item. It is
// conditional on `not(debug_assertions)` so `tauri dev` keeps its console,
// where `println!` and panic output are how a developer sees what the Rust
// side is doing.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Phase 5: SQLite-backed persistence for sessions, profile, and competency
// records. Scenario content itself still ships as bundled JSON (Phase 2/3),
// not imported into the DB - see migrations/001_initial.sql for the full
// schema and which tables are actively used vs. schema-parity placeholders.

mod commands;
mod db;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data directory");
            std::fs::create_dir_all(&app_data_dir).expect("failed to create app data directory");
            let db_path = app_data_dir.join("haa-nexus.sqlite");

            let conn = db::init_connection(db_path).expect("failed to initialize database");
            app.manage(db::DbState(std::sync::Mutex::new(conn)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::save_session,
            commands::get_session,
            commands::list_sessions,
            commands::find_interrupted_sessions,
            commands::get_profile,
            commands::save_profile,
            commands::list_competency_records,
            commands::get_competency_record,
            commands::upsert_competency_record,
            commands::upsert_competency_records,
            commands::append_delivery_event,
            commands::record_delivery_answer,
            commands::list_deliveries_for_learner,
            commands::list_deliveries_for_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running H.A.A. Nexus");
}

/// The release-hardening attribute is easy to delete by accident and its
/// absence is invisible until someone installs a release build and sees a
/// console window behind it. Scanning the source is the only way to assert it
/// from a test, since `debug_assertions` is always on under `cargo test`.
#[cfg(test)]
mod release_hardening_tests {
    #[test]
    fn release_builds_are_windowed_not_console() {
        let source = include_str!("main.rs");
        assert!(
            source.contains(r#"#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]"#),
            "main.rs must keep the windows_subsystem attribute, or release builds open a console window"
        );
    }
}
