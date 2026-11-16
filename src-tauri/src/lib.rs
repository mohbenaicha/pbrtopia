//! The desktop shell (storage-backends R12, R14, R15): one window, one running copy per app, and the commands the page may call.
//! The page reaches the library folder, the vault file and the files the user picks in dialogs that Rust opened; nothing else.

mod commands;
mod state;
mod wire_error;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _working_directory| {
            // R14: a second launch brings the first window to the front and exits (the plugin ends the second copy).
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = state::AppState::new(app.handle())?;
            app.manage(state);            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::env::env_read,
            commands::records::db_get,
            commands::records::db_list,
            commands::records::db_commit,
            commands::files::file_read_chunk,
            commands::files::file_write_begin,
            commands::files::file_write_chunk,
            commands::files::file_write_commit,
            commands::files::file_write_abort,
            commands::files::file_remove,
            commands::files::file_list,
            commands::files::file_free_space,
            commands::library::library_status,
            commands::library::library_open,
            commands::library::library_use_default,
            commands::library::library_choose,
            commands::library::library_show_in_folder,
            commands::handles::pick_save_file,
            commands::handles::pick_folder,
            commands::handles::handle_folder_has,
            commands::handles::handle_create_file,
            commands::handles::handle_write_chunk,
            commands::handles::handle_commit,
            commands::handles::handle_abort,
            commands::handles::handle_release,
        ])
        .run(tauri::generate_context!())
        .expect("the desktop app could not start");
}
