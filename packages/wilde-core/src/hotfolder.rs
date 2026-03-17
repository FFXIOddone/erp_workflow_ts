//! Hotfolder management module
//!
//! Watch and manage RIP hotfolders for automatic file processing

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use tokio::sync::mpsc;

use crate::{HotfolderConfig, RipType, Result, CoreError};

/// Hotfolder event types
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum HotfolderEvent {
    FileAdded { path: PathBuf, hotfolder: String },
    FileRemoved { path: PathBuf, hotfolder: String },
    FileProcessed { path: PathBuf, hotfolder: String },
    Error { message: String, hotfolder: String },
}

/// Hotfolder manager
pub struct HotfolderManager {
    configs: Vec<HotfolderConfig>,
    watchers: HashMap<String, RecommendedWatcher>,
    file_timestamps: Arc<Mutex<HashMap<PathBuf, Instant>>>,
}

impl HotfolderManager {
    pub fn new(configs: Vec<HotfolderConfig>) -> Self {
        Self {
            configs,
            watchers: HashMap::new(),
            file_timestamps: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start watching all configured hotfolders
    pub fn start(&mut self, event_tx: mpsc::UnboundedSender<HotfolderEvent>) -> Result<()> {
        let configs = self.configs.clone();
        for config in configs {
            self.watch_hotfolder(config, event_tx.clone())?;
        }
        Ok(())
    }

    fn watch_hotfolder(
        &mut self,
        config: HotfolderConfig,
        event_tx: mpsc::UnboundedSender<HotfolderEvent>,
    ) -> Result<()> {
        let path = PathBuf::from(&config.path);
        
        if !path.exists() {
            log::warn!("Hotfolder does not exist: {:?}", path);
            return Ok(());
        }

        let name = config.name.clone();
        let timestamps = self.file_timestamps.clone();

        let mut watcher = RecommendedWatcher::new(
            move |res: std::result::Result<notify::Event, notify::Error>| {
                match res {
                    Ok(event) => {
                        for path in event.paths {
                            match event.kind {
                                notify::EventKind::Create(_) => {
                                    let mut ts = timestamps.lock().unwrap();
                                    ts.insert(path.clone(), Instant::now());
                                    
                                    let _ = event_tx.send(HotfolderEvent::FileAdded {
                                        path,
                                        hotfolder: name.clone(),
                                    });
                                }
                                notify::EventKind::Remove(_) => {
                                    let mut ts = timestamps.lock().unwrap();
                                    ts.remove(&path);
                                    
                                    let _ = event_tx.send(HotfolderEvent::FileRemoved {
                                        path,
                                        hotfolder: name.clone(),
                                    });
                                }
                                _ => {}
                            }
                        }
                    }
                    Err(e) => {
                        let _ = event_tx.send(HotfolderEvent::Error {
                            message: e.to_string(),
                            hotfolder: name.clone(),
                        });
                    }
                }
            },
            Config::default(),
        ).map_err(|e| CoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

        watcher.watch(&path, RecursiveMode::NonRecursive)
            .map_err(|e| CoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        
        self.watchers.insert(config.name.clone(), watcher);
        log::info!("Watching hotfolder: {} at {:?}", config.name, path);
        
        Ok(())
    }

    /// Cleanup old files in hotfolders (called periodically)
    pub fn cleanup(&self) -> Result<Vec<PathBuf>> {
        let mut cleaned = Vec::new();
        let timestamps = self.file_timestamps.lock().unwrap();
        
        for config in &self.configs {
            if !config.auto_cleanup {
                continue;
            }
            
            let path = PathBuf::from(&config.path);
            let max_age = Duration::from_secs(config.cleanup_minutes as u64 * 60);
            
            if let Ok(entries) = std::fs::read_dir(&path) {
                for entry in entries.flatten() {
                    let file_path = entry.path();
                    
                    if let Some(timestamp) = timestamps.get(&file_path) {
                        if timestamp.elapsed() > max_age {
                            if let Ok(_) = std::fs::remove_file(&file_path) {
                                log::info!("Cleaned up old hotfolder file: {:?}", file_path);
                                cleaned.push(file_path);
                            }
                        }
                    }
                }
            }
        }
        
        Ok(cleaned)
    }

    /// Get status of all hotfolders
    pub fn get_status(&self) -> Vec<HotfolderStatus> {
        self.configs.iter().map(|config| {
            let path = PathBuf::from(&config.path);
            let exists = path.exists();
            let file_count = if exists {
                std::fs::read_dir(&path)
                    .map(|entries| entries.count())
                    .unwrap_or(0)
            } else {
                0
            };
            
            HotfolderStatus {
                name: config.name.clone(),
                path: config.path.clone(),
                rip_type: config.rip_type,
                exists,
                file_count,
                is_watching: self.watchers.contains_key(&config.name),
            }
        }).collect()
    }

    /// Send a file to a specific hotfolder
    pub fn send_to_hotfolder(&self, file_path: &Path, hotfolder_name: &str) -> Result<PathBuf> {
        let config = self.configs.iter()
            .find(|c| c.name == hotfolder_name)
            .ok_or_else(|| CoreError::NotFound(format!("Hotfolder not found: {}", hotfolder_name)))?;
        
        crate::file_ops::send_to_hotfolder(file_path, Path::new(&config.path))
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct HotfolderStatus {
    pub name: String,
    pub path: String,
    pub rip_type: RipType,
    pub exists: bool,
    pub file_count: usize,
    pub is_watching: bool,
}
