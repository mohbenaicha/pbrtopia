// No console window behind the release exe.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    texturium_lib::run();
}
