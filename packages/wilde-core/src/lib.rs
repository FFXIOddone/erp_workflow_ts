//! Wilde Signs ERP - Tauri Core Library
//!
//! Shared Rust functionality for all Tauri station apps:
//! - File operations (native file access, drag & drop)
//! - Serial port communication (equipment)
//! - Hotfolder management (RIP integration)
//! - Offline SQLite cache
//! - Equipment drivers (Zund, printers)

pub mod file_ops;
pub mod hotfolder;
pub mod offline;
pub mod serial;
pub mod equipment;
pub mod api;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum CoreError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Serial port error: {0}")]
    Serial(#[from] serialport::Error),
    
    #[error("API error: {0}")]
    Api(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Configuration error: {0}")]
    Config(String),
}

pub type Result<T> = std::result::Result<T, CoreError>;

/// Application configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppConfig {
    /// API server URL
    pub api_url: String,
    /// Network drive base path
    pub network_drive_path: Option<String>,
    /// Hotfolder configurations
    pub hotfolders: Vec<HotfolderConfig>,
    /// Current station type
    pub station_type: StationType,
    /// Offline mode enabled
    pub offline_enabled: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HotfolderConfig {
    pub name: String,
    pub path: String,
    pub rip_type: RipType,
    pub auto_cleanup: bool,
    pub cleanup_minutes: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RipType {
    Onyx,
    Flexi,
    Caldera,
    VersaWorks,
    Wasatch,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StationType {
    Printing,
    Production,
    Shipping,
    Design,
    OrderEntry,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_url: "http://localhost:8001/api".to_string(),
            network_drive_path: None,
            hotfolders: Vec::new(),
            station_type: StationType::Production,
            offline_enabled: true,
        }
    }
}

/// Initialize the core library
pub fn init() -> Result<()> {
    env_logger::init();
    log::info!("Tauri Core initialized");
    Ok(())
}
