//! Order Entry - Tauri Commands
//!
//! Native commands for creating orders, customer lookup, and QuickBooks integration

use std::path::PathBuf;
use wilde_core::{file_ops, hotfolder};

/// Open a file in its default application
#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    file_ops::open_file(&PathBuf::from(path))
        .map_err(|e| e.to_string())
}

/// Open a folder in the system file manager
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    file_ops::open_folder(&PathBuf::from(path))
        .map_err(|e| e.to_string())
}

/// Open a file in a specific application (e.g., Onyx, Flexi)
#[tauri::command]
fn open_file_with(path: String, app: String) -> Result<(), String> {
    file_ops::open_file_with(&PathBuf::from(path), &app)
        .map_err(|e| e.to_string())
}

/// Copy a file to a hotfolder
#[tauri::command]
fn send_to_hotfolder(file_path: String, hotfolder_path: String) -> Result<String, String> {
    file_ops::send_to_hotfolder(&PathBuf::from(file_path), &PathBuf::from(hotfolder_path))
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// List files in a directory
#[tauri::command]
fn list_files(path: String) -> Result<Vec<file_ops::FileInfo>, String> {
    file_ops::list_files(&PathBuf::from(path))
        .map_err(|e| e.to_string())
}

/// Find a work order folder on the network drive
#[tauri::command]
fn find_wo_folder(base_path: String, wo_number: String, customer_name: Option<String>) -> Option<String> {
    file_ops::find_wo_folder(
        &PathBuf::from(base_path),
        &wo_number,
        customer_name.as_deref(),
    ).map(|p| p.to_string_lossy().to_string())
}

/// Check if a path exists
#[tauri::command]
fn path_exists(path: String) -> bool {
    file_ops::path_exists(&PathBuf::from(path))
}

/// Get hotfolder status
#[tauri::command]
fn get_hotfolder_status(configs: Vec<wilde_core::HotfolderConfig>) -> Vec<hotfolder::HotfolderStatus> {
    let manager = hotfolder::HotfolderManager::new(configs);
    manager.get_status()
}

/// Copy network path to clipboard
#[tauri::command]
fn copy_network_path(base_path: String, relative_path: String) -> String {
    file_ops::get_network_path(&PathBuf::from(base_path), &PathBuf::from(relative_path))
        .to_string_lossy()
        .to_string()
}

/// Get file info
#[tauri::command]
fn fetch_file_info(path: String) -> Result<file_ops::FileInfo, String> {
    let path = PathBuf::from(&path);
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    
    let name = path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    
    Ok(file_ops::FileInfo {
        name,
        path,
        is_directory: metadata.is_dir(),
        size: if metadata.is_file() { Some(metadata.len()) } else { None },
        modified: metadata.modified().ok(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Order Entry");
}