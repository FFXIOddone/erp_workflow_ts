"""
API Integration Tests for Brand Endpoints
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest import mock

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.models import Base, Brand


class TestBrandAPI:
    """Integration tests for /api/brands endpoints."""
    
    @pytest.fixture(autouse=True)
    def setup_client(self, test_engine):
        """Set up test client with test database."""
        import main
        from main import app
        
        # Create test session factory
        TestSession = sessionmaker(bind=test_engine)
        
        # Patch the global Session in main
        main.Session = TestSession
        
        # Seed a test brand
        session = TestSession()
        brand = Brand(name="Kwik Fill", code="KF", description="Default brand")
        session.add(brand)
        session.commit()
        self.test_brand_id = brand.id
        session.close()
        
        self.client = TestClient(app)
        self.test_session = TestSession
    
    def test_health_endpoint(self):
        """Test the health check endpoint."""
        response = self.client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
    
    def test_list_brands_returns_list(self):
        """Test that list brands returns a list."""
        response = self.client.get("/api/brands")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) >= 1
    
    def test_create_brand_validation(self):
        """Test brand creation with invalid data."""
        response = self.client.post("/api/brands", json={})
        # Should fail validation - name is required
        assert response.status_code == 422
    
    def test_get_nonexistent_brand(self):
        """Test getting a brand that doesn't exist."""
        response = self.client.get("/api/brands/99999")
        assert response.status_code == 404
    
    def test_delete_nonexistent_brand(self):
        """Test deleting a brand that doesn't exist."""
        response = self.client.delete("/api/brands/99999")
        assert response.status_code == 404
