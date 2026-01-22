#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod scan;

use scan::{cancel_scan, start_multi_scan, start_scan, ScanManager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .manage(ScanManager::default())
    .invoke_handler(tauri::generate_handler![start_scan, start_multi_scan, cancel_scan])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn main() {
  run();
}

