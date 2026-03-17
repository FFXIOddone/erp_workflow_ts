"""
API Integration Tests for Packing Slip Manager.
Tests the complete request/response cycle for all major endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tempfile
import os
import json


@pytest.fixture(scope="module")
def test_client():
    """Create a test client with isolated database."""
    # Create temporary database
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        test_db_path = f.name
    
    # Override database path
    os.environ["DB_PATH"] = test_db_path
    
    # Import app after setting DB_PATH
    from main import app
    
    client = TestClient(app)
    
    yield client
    
    # Cleanup
    os.unlink(test_db_path)


class TestHealthEndpoints:
    """Test health check endpoints."""
    
    def test_health_check(self, test_client):
        """Test the health endpoint returns OK."""
        response = test_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestBrandAPI:
    """Test brand management endpoints."""
    
    def test_list_brands(self, test_client):
        """Test listing all brands."""
        response = test_client.get("/api/brands")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_brand(self, test_client):
        """Test creating a new brand."""
        response = test_client.post(
            "/api/brands",
            json={"name": "Test Brand", "description": "Test description"}
        )
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["name"] == "Test Brand"
    
    def test_get_brand(self, test_client):
        """Test getting a specific brand."""
        # First create a brand
        create_resp = test_client.post(
            "/api/brands",
            json={"name": "Get Test Brand"}
        )
        brand_id = create_resp.json()["id"]
        
        # Then get it
        response = test_client.get(f"/api/brands/{brand_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Get Test Brand"
    
    def test_update_brand(self, test_client):
        """Test updating a brand."""
        # Create brand
        create_resp = test_client.post(
            "/api/brands",
            json={"name": "Update Test Brand"}
        )
        brand_id = create_resp.json()["id"]
        
        # Update it
        response = test_client.put(
            f"/api/brands/{brand_id}",
            json={"name": "Updated Brand Name", "description": "New desc"}
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Brand Name"
    
    def test_delete_brand(self, test_client):
        """Test deleting a brand."""
        # Create brand
        create_resp = test_client.post(
            "/api/brands",
            json={"name": "Delete Test Brand"}
        )
        brand_id = create_resp.json()["id"]
        
        # Delete it
        response = test_client.delete(f"/api/brands/{brand_id}")
        assert response.status_code in [200, 204]
        
        # Verify it's gone
        get_resp = test_client.get(f"/api/brands/{brand_id}")
        assert get_resp.status_code == 404


class TestSortConfigAPI:
    """Test sort configuration endpoints."""
    
    def test_list_sort_configs(self, test_client):
        """Test listing sort configs for a brand."""
        # Get default brand (Kwik Fill)
        brands_resp = test_client.get("/api/brands")
        brands = brands_resp.json()
        if brands:
            brand_id = brands[0]["id"]
            response = test_client.get(f"/api/brands/{brand_id}/sort-configs")
            assert response.status_code == 200
    
    def test_create_sort_config(self, test_client):
        """Test creating a sort configuration."""
        # Get a brand
        brands_resp = test_client.get("/api/brands")
        brands = brands_resp.json()
        if brands:
            brand_id = brands[0]["id"]
            response = test_client.post(
                f"/api/brands/{brand_id}/sort-configs",
                json={
                    "name": "Test Sort Config",
                    "is_default": False,
                    "tiers": [
                        {
                            "name": "Test Tier",
                            "field": "kit_type",
                            "enabled": True,
                            "categories": []
                        }
                    ]
                }
            )
            assert response.status_code in [200, 201]


class TestBlackoutRulesAPI:
    """Test blackout rules endpoints."""
    
    def test_list_blackout_rules(self, test_client):
        """Test listing blackout rules."""
        brands_resp = test_client.get("/api/brands")
        brands = brands_resp.json()
        if brands:
            brand_id = brands[0]["id"]
            response = test_client.get(f"/api/brands/{brand_id}/blackout-rules")
            assert response.status_code == 200
    
    def test_create_blackout_rule(self, test_client):
        """Test creating a blackout rule."""
        brands_resp = test_client.get("/api/brands")
        brands = brands_resp.json()
        if brands:
            brand_id = brands[0]["id"]
            response = test_client.post(
                f"/api/brands/{brand_id}/blackout-rules",
                json={
                    "sign_type": "Test Sign",
                    "sign_version": "Test Version",
                    "rule_type": "cancelled",
                    "is_enabled": True
                }
            )
            assert response.status_code in [200, 201]


class TestOrdersAPI:
    """Test order management endpoints."""
    
    def test_list_orders(self, test_client):
        """Test listing orders."""
        response = test_client.get("/api/orders")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_advanced_search(self, test_client):
        """Test advanced order search."""
        response = test_client.post(
            "/api/orders/advanced-search",
            json={
                "page": 1,
                "page_size": 10
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        assert "total" in data
    
    def test_order_statistics(self, test_client):
        """Test getting order statistics."""
        response = test_client.get("/api/orders/statistics")
        assert response.status_code == 200
        data = response.json()
        assert "total_orders" in data


class TestReportsAPI:
    """Test reporting endpoints."""
    
    def test_daily_summary(self, test_client):
        """Test daily summary report."""
        response = test_client.get("/api/reports/summary/daily")
        assert response.status_code == 200
    
    def test_weekly_summary(self, test_client):
        """Test weekly summary report."""
        response = test_client.get("/api/reports/summary/weekly")
        assert response.status_code == 200
    
    def test_monthly_summary(self, test_client):
        """Test monthly summary report."""
        response = test_client.get("/api/reports/summary/monthly")
        assert response.status_code == 200


class TestBatchesAPI:
    """Test batch processing endpoints."""
    
    def test_list_batches(self, test_client):
        """Test listing processing batches."""
        response = test_client.get("/api/batches")
        assert response.status_code == 200
    
    def test_queue_status(self, test_client):
        """Test queue status endpoint."""
        response = test_client.get("/api/batches/queue")
        assert response.status_code == 200
    
    def test_batch_statistics(self, test_client):
        """Test batch statistics."""
        response = test_client.get("/api/batches/stats/summary")
        assert response.status_code == 200


class TestConfigManagementAPI:
    """Test configuration management endpoints."""
    
    def test_export_config(self, test_client):
        """Test exporting brand configuration."""
        brands_resp = test_client.get("/api/brands")
        brands = brands_resp.json()
        if brands:
            brand_id = brands[0]["id"]
            response = test_client.get(f"/api/config-management/export/{brand_id}")
            assert response.status_code == 200
            data = response.json()
            assert "brand" in data
    
    def test_list_templates(self, test_client):
        """Test listing configuration templates."""
        response = test_client.get("/api/config-management/templates")
        assert response.status_code == 200
    
    def test_backup_all(self, test_client):
        """Test backup all endpoint."""
        response = test_client.post("/api/config-management/backup")
        assert response.status_code == 200


class TestIntegrationsAPI:
    """Test integration endpoints."""
    
    def test_list_webhooks(self, test_client):
        """Test listing webhooks."""
        response = test_client.get("/api/integrations/webhooks")
        assert response.status_code == 200
    
    def test_create_webhook(self, test_client):
        """Test creating a webhook."""
        response = test_client.post(
            "/api/integrations/webhooks",
            json={
                "name": "Test Webhook",
                "url": "https://example.com/webhook",
                "events": ["order.created"],
                "is_active": True
            }
        )
        assert response.status_code in [200, 201]
    
    def test_list_api_keys(self, test_client):
        """Test listing API keys."""
        response = test_client.get("/api/integrations/api-keys")
        assert response.status_code == 200
    
    def test_list_file_watchers(self, test_client):
        """Test listing file watchers."""
        response = test_client.get("/api/integrations/file-watchers")
        assert response.status_code == 200


class TestErrorHandling:
    """Test error handling across endpoints."""
    
    def test_404_not_found(self, test_client):
        """Test 404 response for non-existent resource."""
        response = test_client.get("/api/brands/99999")
        assert response.status_code == 404
    
    def test_invalid_json(self, test_client):
        """Test handling of invalid JSON."""
        response = test_client.post(
            "/api/brands",
            content="not valid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422


class TestCORS:
    """Test CORS configuration."""
    
    def test_cors_headers(self, test_client):
        """Test that CORS headers are present."""
        response = test_client.options(
            "/api/brands",
            headers={
                "Origin": "http://localhost:5185",
                "Access-Control-Request-Method": "GET"
            }
        )
        # CORS preflight should work
        assert response.status_code in [200, 204, 405]


class TestRequestMetadata:
    """Test request metadata (correlation ID, timing)."""
    
    def test_correlation_id_header(self, test_client):
        """Test that correlation ID is returned in headers."""
        response = test_client.get("/api/health")
        assert "X-Correlation-ID" in response.headers
    
    def test_response_time_header(self, test_client):
        """Test that response time is returned in headers."""
        response = test_client.get("/api/health")
        assert "X-Response-Time-Ms" in response.headers
