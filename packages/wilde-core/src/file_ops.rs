//! File operations module
//!
//! Native file system access for:
//! - Opening files in default applications
//! - Opening folders in Explorer/Finder
//! - Copying files to hotfolders
//! - Reading network drive paths

use std::path::{Path, PathBuf};
use std::process::Command;
use crate::{CoreError, Result};

/// Open a file in its default application
pub fn open_file(path: &Path) -> Result<()> {
    log::info!("Opening file: {:?}", path);
    
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path.to_string_lossy()])
            .spawn()?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()?;
    }
    
    Ok(())
}

/// Open a folder in the system file manager
pub fn open_folder(path: &Path) -> Result<()> {
    log::info!("Opening folder: {:?}", path);
    
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()?;
    }
    
    Ok(())
}

/// Open a file in a specific application
pub fn open_file_with(path: &Path, app: &str) -> Result<()> {
    log::info!("Opening file {:?} with {}", path, app);
    
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", app, &path.to_string_lossy()])
            .spawn()?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-a", app])
            .arg(path)
            .spawn()?;
    }
    
    Ok(())
}

/// Open the Zund Cut Queue and search for a CutID
pub fn open_zund_cut_queue(cut_id: &str) -> Result<()> {
    log::info!("Opening Zund Cut Queue for CutID: {}", cut_id);

    #[cfg(target_os = "windows")]
    {
        let script = r#"
$cutId = $env:ERP_ZUND_CUTID
if (-not $cutId) {
    throw 'CutID not provided.'
}

function Activate-CutQueueWindow {
    param([object]$Shell)

    foreach ($title in @('Cut Queue', 'Zund Cut Center', 'CutServer')) {
        if ($Shell.AppActivate($title)) {
            return $true
        }
    }

    return $false
}

$shell = New-Object -ComObject WScript.Shell

if (-not (Activate-CutQueueWindow -Shell $shell)) {
    $shortcutPath = 'C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Zund Cut Center\Cut Queue.lnk'
    $targetPath = $null
    $targetArgs = '-queue'
    $workingDir = $null

    if (Test-Path $shortcutPath) {
        $shortcut = $shell.CreateShortcut($shortcutPath)
        if ($shortcut.TargetPath) { $targetPath = $shortcut.TargetPath }
        if ($shortcut.Arguments) { $targetArgs = $shortcut.Arguments }
        if ($shortcut.WorkingDirectory) { $workingDir = $shortcut.WorkingDirectory }
    }

    if (-not $targetPath) {
        $candidateTargets = @(
            'C:\Program Files (x86)\Zund Systemtechnik\Zund Cut Center\CutServer.exe',
            'C:\Program Files\Zund Systemtechnik\Zund Cut Center\CutServer.exe'
        )
        $targetPath = $candidateTargets | Where-Object { Test-Path $_ } | Select-Object -First 1
    }

    if (-not $targetPath) {
        throw 'Zund Cut Queue executable not found.'
    }

    if (-not $workingDir) {
        $workingDir = Split-Path -Parent $targetPath
    }

    Start-Process -FilePath $targetPath -ArgumentList $targetArgs -WorkingDirectory $workingDir | Out-Null
    Start-Sleep -Milliseconds 1500

    if (-not (Activate-CutQueueWindow -Shell $shell)) {
        throw 'Could not activate the Zund Cut Queue window.'
    }
}

Set-Clipboard -Value $cutId
Start-Sleep -Milliseconds 150
$shell.SendKeys('^f')
Start-Sleep -Milliseconds 200
$shell.SendKeys('^a')
Start-Sleep -Milliseconds 100
$shell.SendKeys('^v')
Start-Sleep -Milliseconds 100
$shell.SendKeys('{ENTER}')
"#;

        let status = Command::new("powershell")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-STA", "-Command", script])
            .env("ERP_ZUND_CUTID", cut_id)
            .status()?;

        if !status.success() {
            return Err(CoreError::Config("Failed to open Zund Cut Queue".to_string()));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        return Err(CoreError::Config(
            "Zund Cut Queue automation is only available on Windows".to_string(),
        ));
    }

    Ok(())
}

/// Copy a file to a destination folder
pub fn copy_file(src: &Path, dest_folder: &Path) -> Result<PathBuf> {
    let file_name = src.file_name()
        .ok_or_else(|| CoreError::NotFound("No filename".to_string()))?;
    
    let dest_path = dest_folder.join(file_name);
    
    log::info!("Copying {:?} to {:?}", src, dest_path);
    std::fs::copy(src, &dest_path)?;
    
    Ok(dest_path)
}

/// Copy a file to a hotfolder (for RIP integration)
pub fn send_to_hotfolder(file_path: &Path, hotfolder_path: &Path) -> Result<PathBuf> {
    if !hotfolder_path.exists() {
        return Err(CoreError::NotFound(format!(
            "Hotfolder not found: {:?}",
            hotfolder_path
        )));
    }
    
    copy_file(file_path, hotfolder_path)
}

/// Get the full network path for a file
pub fn get_network_path(base_path: &Path, relative_path: &Path) -> PathBuf {
    base_path.join(relative_path)
}

/// List files in a directory
pub fn list_files(path: &Path) -> Result<Vec<FileInfo>> {
    let mut files = Vec::new();
    
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        let metadata = entry.metadata()?;
        
        files.push(FileInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            path,
            is_directory: metadata.is_dir(),
            size: if metadata.is_file() { Some(metadata.len()) } else { None },
            modified: metadata.modified().ok(),
        });
    }
    
    // Sort: directories first, then by name
    files.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(files)
}

/// File information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: PathBuf,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub modified: Option<std::time::SystemTime>,
}

/// Check if a path exists and is accessible
pub fn path_exists(path: &Path) -> bool {
    path.exists()
}

/// Find work order folder by WO number
pub fn find_wo_folder(base_path: &Path, wo_number: &str, customer_name: Option<&str>) -> Option<PathBuf> {
    // Try to find customer folder first
    if let Some(customer) = customer_name {
        let customer_lower = customer.to_lowercase();
        
        if let Ok(entries) = std::fs::read_dir(base_path) {
            for entry in entries.flatten() {
                let folder_name = entry.file_name().to_string_lossy().to_lowercase();
                
                // Check if customer folder matches
                if folder_name.contains(&customer_lower) || customer_lower.contains(&folder_name) {
                    let customer_path = entry.path();
                    
                    // Look for WO folder inside
                    if let Some(wo_folder) = find_wo_in_folder(&customer_path, wo_number) {
                        return Some(wo_folder);
                    }
                }
            }
        }
    }
    
    // Fallback: search all customer folders
    if let Ok(entries) = std::fs::read_dir(base_path) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(wo_folder) = find_wo_in_folder(&entry.path(), wo_number) {
                    return Some(wo_folder);
                }
            }
        }
    }
    
    None
}

fn find_wo_in_folder(folder: &Path, wo_number: &str) -> Option<PathBuf> {
    if let Ok(entries) = std::fs::read_dir(folder) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_uppercase();
            
            // Match patterns: WO12345, WO-12345, WO12345_description
            if name.starts_with(&format!("WO{}", wo_number))
                || name.starts_with(&format!("WO-{}", wo_number))
                || name.starts_with(&format!("WO_{}", wo_number))
            {
                return Some(entry.path());
            }
        }
    }
    None
}
