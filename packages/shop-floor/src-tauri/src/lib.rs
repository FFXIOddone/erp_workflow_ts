//! Shop Floor — unified Tauri station app for Wilde Signs ERP
//!
//! Consolidates Design, Printing, Production, Shipping, and Order Entry
//! into a single binary. Station view is determined at login based on the
//! user's `allowedStations` field.

use std::path::PathBuf;
use wilde_core::{file_ops, hotfolder};

// ── File Operations ──────────────────────────────────────────────

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    file_ops::open_file(&PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    file_ops::open_folder(&PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_file_with(path: String, app: String) -> Result<(), String> {
    file_ops::open_file_with(&PathBuf::from(path), &app).map_err(|e| e.to_string())
}

#[tauri::command]
fn send_to_hotfolder(file_path: String, hotfolder_path: String) -> Result<String, String> {
    file_ops::send_to_hotfolder(&PathBuf::from(file_path), &PathBuf::from(hotfolder_path))
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_files(path: String) -> Result<Vec<file_ops::FileInfo>, String> {
    file_ops::list_files(&PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
fn find_wo_folder(
    base_path: String,
    wo_number: String,
    customer_name: Option<String>,
) -> Option<String> {
    file_ops::find_wo_folder(&PathBuf::from(base_path), &wo_number, customer_name.as_deref())
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    file_ops::path_exists(&PathBuf::from(path))
}

#[tauri::command]
fn get_hotfolder_status(
    configs: Vec<wilde_core::HotfolderConfig>,
) -> Vec<hotfolder::HotfolderStatus> {
    let manager = hotfolder::HotfolderManager::new(configs);
    manager.get_status()
}

#[tauri::command]
fn copy_network_path(base_path: String, relative_path: String) -> String {
    file_ops::get_network_path(&PathBuf::from(base_path), &PathBuf::from(relative_path))
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn fetch_file_info(path: String) -> Result<file_ops::FileInfo, String> {
    let path = PathBuf::from(&path);
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(file_ops::FileInfo {
        name,
        path,
        is_directory: metadata.is_dir(),
        size: if metadata.is_file() {
            Some(metadata.len())
        } else {
            None
        },
        modified: metadata.modified().ok(),
    })
}

// ── App Version ─────────────────────────────────────────────────

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ── Entry Point ─────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            open_file,
            open_folder,
            open_file_with,
            send_to_hotfolder,
            list_files,
            find_wo_folder,
            path_exists,
            get_hotfolder_status,
            copy_network_path,
            fetch_file_info,
            get_app_version,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            let msg = format!("Failed to start Shop Floor:\n\n{}", e);
            // Log to file
            if let Ok(exe) = std::env::current_exe() {
                let log_path = exe.with_file_name("crash.log");
                let _ = std::fs::write(&log_path, &msg);
            }
            if let Some(appdata) = std::env::var_os("APPDATA") {
                let dir = std::path::PathBuf::from(appdata).join("Wilde Signs Shop Floor");
                let _ = std::fs::create_dir_all(&dir);
                let _ = std::fs::write(dir.join("crash.log"), &msg);
            }
            // Show a Windows message box
            #[cfg(windows)]
            {
                use std::ffi::OsStr;
                use std::os::windows::ffi::OsStrExt;
                use std::iter::once;
                let wide_msg: Vec<u16> = OsStr::new(&msg).encode_wide().chain(once(0)).collect();
                let wide_title: Vec<u16> = OsStr::new("Shop Floor Error").encode_wide().chain(once(0)).collect();
                unsafe {
                    #[link(name = "user32")]
                    extern "system" {
                        fn MessageBoxW(hwnd: *mut std::ffi::c_void, text: *const u16, caption: *const u16, utype: u32) -> i32;
                    }
                    MessageBoxW(std::ptr::null_mut(), wide_msg.as_ptr(), wide_title.as_ptr(), 0x10);
                }
            }
            std::process::exit(1);
        });
}
