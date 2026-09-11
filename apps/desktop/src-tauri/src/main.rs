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
            commands::upsert_competency_record,
        ])
        .run(tauri::generate_context!())
        .expect("error while running H.A.A. Nexus");
}
