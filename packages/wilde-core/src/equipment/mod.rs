//! Equipment integration module

pub mod zund;
pub mod printer;

use crate::Result;

/// Equipment status
#[derive(Debug, Clone, serde::Serialize)]
pub struct EquipmentStatus {
    pub id: String,
    pub name: String,
    pub equipment_type: EquipmentType,
    pub status: Status,
    pub current_job: Option<String>,
    pub last_activity: Option<String>,
    pub metrics: Option<EquipmentMetrics>,
}

#[derive(Debug, Clone, Copy, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EquipmentType {
    Cutter,
    Printer,
    Laminator,
    Other,
}

#[derive(Debug, Clone, Copy, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Idle,
    Running,
    Paused,
    Error,
    Offline,
    Maintenance,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct EquipmentMetrics {
    pub today_jobs: u32,
    pub today_runtime_minutes: u32,
    pub today_area_sqft: Option<f64>,
    pub today_cuts: Option<u32>,
}
