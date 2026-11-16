// Storage-backends R12: the app declares its own commands in the app manifest, so only what capabilities/default.json grants to the main window can be called.
// Keep this list equal to the handler list in src/lib.rs and the permissions in capabilities/default.json (tests/storage-desktop/commandManifest.test.ts checks it).
const COMMANDS: &[&str] = &[
    "env_read",
    "db_get",
    "db_list",
    "db_commit",
    "file_read_chunk",
    "file_write_begin",
    "file_write_chunk",
    "file_write_commit",
    "file_write_abort",
    "file_remove",
    "file_list",
    "file_free_space",
    "library_status",
    "library_open",
    "library_use_default",
    "library_choose",
    "library_show_in_folder",
    "pick_save_file",
    "pick_folder",
    "handle_folder_has",
    "handle_create_file",
    "handle_write_chunk",
    "handle_commit",
    "handle_abort",
    "handle_release",
];

fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS))).expect("failed to run the Tauri build step");
}
