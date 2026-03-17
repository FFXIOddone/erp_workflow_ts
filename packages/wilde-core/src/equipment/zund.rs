//! Zund cutter integration
//!
//! Reads job data from Zund Cut Center output files (.out)

use std::path::{Path, PathBuf};
use std::fs;
use std::collections::HashMap;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config};
use tokio::sync::mpsc;
use chrono::{DateTime, NaiveDateTime, Utc};

use crate::{Result, CoreError};
use super::{EquipmentStatus, EquipmentType, Status, EquipmentMetrics};

/// Zund job data parsed from .out file
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ZundJob {
    pub file_name: String,
    pub job_name: Option<String>,
    pub work_order: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i64>,
    pub total_cuts: u32,
    pub total_distance_m: f64,
    pub width_mm: Option<f64>,
    pub height_mm: Option<f64>,
    pub area_sqm: Option<f64>,
    pub tool_changes: u32,
    pub raw_data: HashMap<String, String>,
}

impl ZundJob {
    /// Calculate area in square feet
    pub fn area_sqft(&self) -> Option<f64> {
        self.area_sqm.map(|sqm| sqm * 10.764)
    }
    
    /// Try to extract WO number from job name
    pub fn extract_wo_number(&mut self) {
        if let Some(name) = &self.job_name {
            // Look for patterns like WO12345, WO-12345, WO_12345
            let re = regex::Regex::new(r"WO[-_]?(\d+)").ok();
            if let Some(re) = re {
                if let Some(captures) = re.captures(name) {
                    if let Some(num) = captures.get(1) {
                        self.work_order = Some(format!("WO-{}", num.as_str()));
                    }
                }
            }
        }
    }
}

/// Parse a Zund .out file
pub fn parse_out_file(path: &Path) -> Result<ZundJob> {
    let content = fs::read_to_string(path)?;
    let mut data = HashMap::new();
    
    // Parse key=value pairs
    for line in content.lines() {
        if let Some(pos) = line.find('=') {
            let key = line[..pos].trim().to_string();
            let value = line[pos + 1..].trim().to_string();
            data.insert(key, value);
        }
    }
    
    let mut job = ZundJob {
        file_name: path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        job_name: data.get("JobName").or_else(|| data.get("Name")).cloned(),
        work_order: None,
        start_time: parse_zund_datetime(data.get("StartTime")),
        end_time: parse_zund_datetime(data.get("EndTime")),
        duration_seconds: data.get("Duration")
            .or_else(|| data.get("TotalTime"))
            .and_then(|s| s.parse().ok()),
        total_cuts: data.get("TotalCuts")
            .or_else(|| data.get("Cuts"))
            .and_then(|s| s.parse().ok())
            .unwrap_or(0),
        total_distance_m: data.get("TotalDistance")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0),
        width_mm: data.get("Width").and_then(|s| s.parse().ok()),
        height_mm: data.get("Height").and_then(|s| s.parse().ok()),
        area_sqm: data.get("Area").and_then(|s| s.parse().ok()),
        tool_changes: data.get("ToolChanges").and_then(|s| s.parse().ok()).unwrap_or(0),
        raw_data: data,
    };
    
    job.extract_wo_number();
    
    Ok(job)
}

fn parse_zund_datetime(value: Option<&String>) -> Option<DateTime<Utc>> {
    value.and_then(|s| {
        // Try common formats
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
            .or_else(|_| NaiveDateTime::parse_from_str(s, "%d/%m/%Y %H:%M:%S"))
            .or_else(|_| NaiveDateTime::parse_from_str(s, "%m/%d/%Y %H:%M:%S"))
            .ok()
            .map(|dt| dt.and_utc())
    })
}

/// Zund folder watcher
pub struct ZundWatcher {
    folder_path: PathBuf,
    watcher: Option<RecommendedWatcher>,
}

/// Events from the Zund watcher
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ZundEvent {
    JobCompleted { job: ZundJob },
    Error { message: String },
}

impl ZundWatcher {
    pub fn new(folder_path: PathBuf) -> Self {
        Self {
            folder_path,
            watcher: None,
        }
    }

    /// Start watching for new .out files
    pub fn start(&mut self, event_tx: mpsc::UnboundedSender<ZundEvent>) -> Result<()> {
        let path = self.folder_path.clone();
        
        if !path.exists() {
            return Err(CoreError::NotFound(format!(
                "Zund folder not found: {:?}",
                path
            )));
        }

        let watcher = RecommendedWatcher::new(
            move |res: std::result::Result<notify::Event, notify::Error>| {
                if let Ok(event) = res {
                    if matches!(event.kind, notify::EventKind::Create(_)) {
                        for file_path in event.paths {
                            if file_path.extension().map(|e| e == "out").unwrap_or(false) {
                                // Wait a moment for file to be fully written
                                std::thread::sleep(std::time::Duration::from_millis(500));
                                
                                match parse_out_file(&file_path) {
                                    Ok(job) => {
                                        let _ = event_tx.send(ZundEvent::JobCompleted { job });
                                    }
                                    Err(e) => {
                                        let _ = event_tx.send(ZundEvent::Error {
                                            message: format!("Failed to parse {:?}: {}", file_path, e),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            },
            Config::default(),
        ).map_err(|e| CoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

        // Watch is set up, now store it
        self.watcher = Some(watcher);
        
        // Start watching
        if let Some(ref mut w) = self.watcher {
            w.watch(&self.folder_path, RecursiveMode::NonRecursive)
                .map_err(|e| CoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        }
        
        log::info!("Watching Zund folder: {:?}", self.folder_path);
        Ok(())
    }

    /// Get today's statistics from existing files
    pub fn get_today_stats(&self) -> Result<ZundDailyStats> {
        let today = chrono::Local::now().date_naive();
        let mut stats = ZundDailyStats::default();
        
        if let Ok(entries) = fs::read_dir(&self.folder_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                
                if path.extension().map(|e| e == "out").unwrap_or(false) {
                    // Check file modification date
                    if let Ok(metadata) = entry.metadata() {
                        if let Ok(modified) = metadata.modified() {
                            let file_date = DateTime::<Utc>::from(modified).date_naive();
                            
                            if file_date == today {
                                if let Ok(job) = parse_out_file(&path) {
                                    stats.add_job(&job);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(stats)
    }
}

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct ZundDailyStats {
    pub job_count: u32,
    pub total_cuts: u32,
    pub total_distance_m: f64,
    pub total_area_sqm: f64,
    pub total_runtime_seconds: i64,
}

impl ZundDailyStats {
    pub fn add_job(&mut self, job: &ZundJob) {
        self.job_count += 1;
        self.total_cuts += job.total_cuts;
        self.total_distance_m += job.total_distance_m;
        if let Some(area) = job.area_sqm {
            self.total_area_sqm += area;
        }
        if let Some(duration) = job.duration_seconds {
            self.total_runtime_seconds += duration;
        }
    }
    
    pub fn area_sqft(&self) -> f64 {
        self.total_area_sqm * 10.764
    }
    
    pub fn runtime_hours(&self) -> f64 {
        self.total_runtime_seconds as f64 / 3600.0
    }
}
