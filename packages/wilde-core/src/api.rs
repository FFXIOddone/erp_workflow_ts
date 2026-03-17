//! API client for communicating with the ERP server

use std::time::Duration;
use reqwest::{Client, header};
use serde::{de::DeserializeOwned, Serialize};
use crate::{Result, CoreError};

/// ERP API client
pub struct ApiClient {
    client: Client,
    base_url: String,
    auth_token: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub role: String,
    pub allowed_stations: Vec<String>,
}

impl ApiClient {
    /// Create a new API client
    pub fn new(base_url: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");
        
        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            auth_token: None,
        }
    }

    /// Set the authentication token
    pub fn set_token(&mut self, token: String) {
        self.auth_token = Some(token);
    }

    /// Clear the authentication token
    pub fn clear_token(&mut self) {
        self.auth_token = None;
    }

    /// Check if authenticated
    pub fn is_authenticated(&self) -> bool {
        self.auth_token.is_some()
    }

    /// Build request with auth header
    fn auth_headers(&self) -> header::HeaderMap {
        let mut headers = header::HeaderMap::new();
        if let Some(token) = &self.auth_token {
            headers.insert(
                header::AUTHORIZATION,
                header::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
            );
        }
        headers
    }

    /// Login to the API
    pub async fn login(&mut self, username: &str, password: &str) -> Result<LoginResponse> {
        let response = self.post::<_, LoginResponse>(
            "/auth/login",
            &LoginRequest {
                username: username.to_string(),
                password: password.to_string(),
            },
        ).await?;
        
        if let Some(data) = response.data {
            self.auth_token = Some(data.token.clone());
            Ok(data)
        } else {
            Err(CoreError::Api(response.error.unwrap_or_else(|| "Login failed".to_string())))
        }
    }

    /// GET request
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<ApiResponse<T>> {
        let url = format!("{}{}", self.base_url, path);
        
        let response = self.client.get(&url)
            .headers(self.auth_headers())
            .send()
            .await
            .map_err(|e| CoreError::Api(e.to_string()))?;
        
        self.handle_response(response).await
    }

    /// GET request with query params
    pub async fn get_with_params<T, Q>(&self, path: &str, params: &Q) -> Result<ApiResponse<T>>
    where
        T: DeserializeOwned,
        Q: Serialize + ?Sized,
    {
        let url = format!("{}{}", self.base_url, path);
        
        let response = self.client.get(&url)
            .headers(self.auth_headers())
            .query(params)
            .send()
            .await
            .map_err(|e| CoreError::Api(e.to_string()))?;
        
        self.handle_response(response).await
    }

    /// POST request
    pub async fn post<B, T>(&self, path: &str, body: &B) -> Result<ApiResponse<T>>
    where
        B: Serialize + ?Sized,
        T: DeserializeOwned,
    {
        let url = format!("{}{}", self.base_url, path);
        
        let response = self.client.post(&url)
            .headers(self.auth_headers())
            .json(body)
            .send()
            .await
            .map_err(|e| CoreError::Api(e.to_string()))?;
        
        self.handle_response(response).await
    }

    /// PUT request
    pub async fn put<B, T>(&self, path: &str, body: &B) -> Result<ApiResponse<T>>
    where
        B: Serialize + ?Sized,
        T: DeserializeOwned,
    {
        let url = format!("{}{}", self.base_url, path);
        
        let response = self.client.put(&url)
            .headers(self.auth_headers())
            .json(body)
            .send()
            .await
            .map_err(|e| CoreError::Api(e.to_string()))?;
        
        self.handle_response(response).await
    }

    /// PATCH request
    pub async fn patch<B, T>(&self, path: &str, body: &B) -> Result<ApiResponse<T>>
    where
        B: Serialize + ?Sized,
        T: DeserializeOwned,
    {
        let url = format!("{}{}", self.base_url, path);
        
        let response = self.client.patch(&url)
            .headers(self.auth_headers())
            .json(body)
            .send()
            .await
            .map_err(|e| CoreError::Api(e.to_string()))?;
        
        self.handle_response(response).await
    }

    /// DELETE request
    pub async fn delete<T: DeserializeOwned>(&self, path: &str) -> Result<ApiResponse<T>> {
        let url = format!("{}{}", self.base_url, path);
        
        let response = self.client.delete(&url)
            .headers(self.auth_headers())
            .send()
            .await
            .map_err(|e| CoreError::Api(e.to_string()))?;
        
        self.handle_response(response).await
    }

    async fn handle_response<T: DeserializeOwned>(&self, response: reqwest::Response) -> Result<ApiResponse<T>> {
        let status = response.status();
        
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(CoreError::Api("Unauthorized - please log in again".to_string()));
        }
        
        let text = response.text().await
            .map_err(|e| CoreError::Api(e.to_string()))?;
        
        serde_json::from_str(&text)
            .map_err(|e| CoreError::Api(format!("Failed to parse response: {} - Body: {}", e, text)))
    }

    /// Check if server is reachable
    pub async fn health_check(&self) -> bool {
        self.client.get(&format!("{}/health", self.base_url))
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }
}

/// Sync manager for offline functionality
pub struct SyncManager {
    api: ApiClient,
    db: crate::offline::OfflineDb,
}

impl SyncManager {
    pub fn new(api: ApiClient, db: crate::offline::OfflineDb) -> Self {
        Self { api, db }
    }

    /// Sync pending changes to server
    pub async fn sync_pending_changes(&self) -> Result<SyncResult> {
        let pending = self.db.get_pending_changes()?;
        let mut synced = 0;
        let mut failed = 0;
        
        for change in pending {
            match self.sync_change(&change).await {
                Ok(_) => {
                    self.db.mark_synced(change.id)?;
                    synced += 1;
                }
                Err(e) => {
                    log::warn!("Failed to sync change {}: {}", change.id, e);
                    self.db.increment_retry(change.id)?;
                    failed += 1;
                }
            }
        }
        
        Ok(SyncResult { synced, failed })
    }

    async fn sync_change(&self, change: &crate::offline::PendingChange) -> Result<()> {
        match change.entity_type.as_str() {
            "work_order" => {
                match change.action.as_str() {
                    "update_status" => {
                        self.api.patch::<_, serde_json::Value>(
                            &format!("/orders/{}", change.entity_id),
                            &serde_json::from_str::<serde_json::Value>(&change.data)?,
                        ).await?;
                    }
                    _ => {
                        log::warn!("Unknown action: {}", change.action);
                    }
                }
            }
            "time_entry" => {
                self.api.post::<_, serde_json::Value>(
                    "/time-entries",
                    &serde_json::from_str::<serde_json::Value>(&change.data)?,
                ).await?;
            }
            _ => {
                log::warn!("Unknown entity type: {}", change.entity_type);
            }
        }
        
        Ok(())
    }

    /// Fetch and cache work orders
    pub async fn fetch_work_orders(&self, limit: usize) -> Result<usize> {
        #[derive(serde::Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct OrdersResponse {
            orders: Vec<serde_json::Value>,
        }
        
        let response = self.api.get_with_params::<OrdersResponse, _>(
            "/orders",
            &[("limit", limit.to_string()), ("status", "IN_PROGRESS".to_string())],
        ).await?;
        
        let mut count = 0;
        if let Some(data) = response.data {
            for order in data.orders {
                if let (Some(id), Some(number)) = (
                    order.get("id").and_then(|v| v.as_str()),
                    order.get("orderNumber").and_then(|v| v.as_str()),
                ) {
                    self.db.save_work_order(id, number, &serde_json::to_string(&order)?)?;
                    count += 1;
                }
            }
        }
        
        Ok(count)
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SyncResult {
    pub synced: usize,
    pub failed: usize,
}
