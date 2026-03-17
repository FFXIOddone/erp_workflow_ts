//! Offline sync and SQLite cache module
//!
//! Local SQLite database for offline operation with sync to server

use std::path::PathBuf;
use rusqlite::{Connection, params};
use chrono::{DateTime, Utc};
use crate::{Result, CoreError};

/// Offline database manager
pub struct OfflineDb {
    conn: Connection,
}

impl OfflineDb {
    /// Open or create the offline database
    pub fn new(app_data_dir: &PathBuf) -> Result<Self> {
        let db_path = app_data_dir.join("offline.db");
        let conn = Connection::open(&db_path)?;
        
        let db = Self { conn };
        db.init_schema()?;
        
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(r#"
            -- Work orders cache
            CREATE TABLE IF NOT EXISTS work_orders (
                id TEXT PRIMARY KEY,
                order_number TEXT NOT NULL,
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                synced_at TEXT
            );
            
            -- Pending changes (to sync when online)
            CREATE TABLE IF NOT EXISTS pending_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                action TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                retries INTEGER DEFAULT 0
            );
            
            -- Cache for customers
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            
            -- Sync metadata
            CREATE TABLE IF NOT EXISTS sync_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            
            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_work_orders_number ON work_orders(order_number);
            CREATE INDEX IF NOT EXISTS idx_pending_changes_entity ON pending_changes(entity_type, entity_id);
        "#)?;
        
        Ok(())
    }

    /// Save a work order to local cache
    pub fn save_work_order(&self, id: &str, order_number: &str, data: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO work_orders (id, order_number, data, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, order_number, data, Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    /// Get a work order from local cache
    pub fn get_work_order(&self, id: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT data FROM work_orders WHERE id = ?1")?;
        let result = stmt.query_row(params![id], |row| row.get::<_, String>(0));
        
        match result {
            Ok(data) => Ok(Some(data)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Get all cached work orders
    pub fn get_all_work_orders(&self) -> Result<Vec<CachedWorkOrder>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, order_number, data, updated_at, synced_at FROM work_orders ORDER BY updated_at DESC"
        )?;
        
        let orders = stmt.query_map([], |row| {
            Ok(CachedWorkOrder {
                id: row.get(0)?,
                order_number: row.get(1)?,
                data: row.get(2)?,
                updated_at: row.get(3)?,
                synced_at: row.get(4)?,
            })
        })?;
        
        let mut result = Vec::new();
        for order in orders {
            result.push(order?);
        }
        
        Ok(result)
    }

    /// Queue a change for sync
    pub fn queue_change(&self, entity_type: &str, entity_id: &str, action: &str, data: &str) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO pending_changes (entity_type, entity_id, action, data, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![entity_type, entity_id, action, data, Utc::now().to_rfc3339()],
        )?;
        
        Ok(self.conn.last_insert_rowid())
    }

    /// Get pending changes for sync
    pub fn get_pending_changes(&self) -> Result<Vec<PendingChange>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, entity_type, entity_id, action, data, created_at, retries FROM pending_changes ORDER BY created_at"
        )?;
        
        let changes = stmt.query_map([], |row| {
            Ok(PendingChange {
                id: row.get(0)?,
                entity_type: row.get(1)?,
                entity_id: row.get(2)?,
                action: row.get(3)?,
                data: row.get(4)?,
                created_at: row.get(5)?,
                retries: row.get(6)?,
            })
        })?;
        
        let mut result = Vec::new();
        for change in changes {
            result.push(change?);
        }
        
        Ok(result)
    }

    /// Mark a change as synced (remove it)
    pub fn mark_synced(&self, change_id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM pending_changes WHERE id = ?1", params![change_id])?;
        Ok(())
    }

    /// Increment retry count for a failed sync
    pub fn increment_retry(&self, change_id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE pending_changes SET retries = retries + 1 WHERE id = ?1",
            params![change_id],
        )?;
        Ok(())
    }

    /// Get count of pending changes
    pub fn pending_count(&self) -> Result<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM pending_changes",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    /// Set sync metadata
    pub fn set_metadata(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    /// Get sync metadata
    pub fn get_metadata(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT value FROM sync_metadata WHERE key = ?1")?;
        let result = stmt.query_row(params![key], |row| row.get::<_, String>(0));
        
        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Cleanup old cached data
    pub fn cleanup_old_data(&self, max_orders: usize) -> Result<usize> {
        // Keep only the most recent N orders
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM work_orders",
            [],
            |row| row.get(0),
        )?;
        
        if count as usize <= max_orders {
            return Ok(0);
        }
        
        let to_delete = count as usize - max_orders;
        
        self.conn.execute(
            "DELETE FROM work_orders WHERE id IN (
                SELECT id FROM work_orders ORDER BY updated_at ASC LIMIT ?1
            )",
            params![to_delete as i64],
        )?;
        
        Ok(to_delete)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CachedWorkOrder {
    pub id: String,
    pub order_number: String,
    pub data: String,
    pub updated_at: String,
    pub synced_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PendingChange {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: String,
    pub action: String,
    pub data: String,
    pub created_at: String,
    pub retries: i32,
}

/// Calculate optimal number of orders to cache based on device storage
pub fn calculate_max_cached_orders(available_mb: u64) -> usize {
    // Estimate per order:
    // - JSON data: ~5 KB
    // - Thumbnails: ~50 KB
    // - Docs: ~100 KB
    // Total: ~160 KB per order
    
    const KB_PER_ORDER: u64 = 160;
    const MIN_ORDERS: usize = 20;
    const MAX_ORDERS: usize = 500;
    
    // Use 80% of available space for orders
    let usable_kb = (available_mb * 1024 * 80) / 100;
    let calculated = (usable_kb / KB_PER_ORDER) as usize;
    
    calculated.clamp(MIN_ORDERS, MAX_ORDERS)
}
