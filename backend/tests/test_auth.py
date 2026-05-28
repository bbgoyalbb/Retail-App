"""
Integration tests for authentication flows (Fix 7.3)
"""
import pytest
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient
import os

from server import app
from auth import get_password_hash, create_access_token

@pytest.fixture
async def client():
    """Test client fixture"""
    return TestClient(app)

@pytest.fixture
async def test_db():
    """Test database fixture"""
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_uri)
    db = client.retail_test
    
    # Clean up before tests
    await db.users.delete_many({})
    
    yield db
    
    # Clean up after tests
    await db.users.delete_many({})
    client.close()

@pytest.mark.asyncio
async def test_register_user(client, test_db):
    """Test user registration"""
    response = client.post("/auth/register", json={
        "username": "testuser",
        "password": "TestPass123",
        "full_name": "Test User",
        "role": "cashier"
    })
    assert response.status_code == 403  # Requires auth
    
    # Create admin first
    admin = await test_db.users.insert_one({
        "username": "admin",
        "password_hash": get_password_hash("admin123"),
        "full_name": "Admin",
        "role": "admin",
        "is_active": True
    })
    
    # Login as admin
    login_response = client.post("/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    
    # Register new user with admin token
    headers = {"Authorization": f"Bearer {token}"}
    register_response = client.post("/auth/register", json={
        "username": "testuser",
        "password": "TestPass123",
        "full_name": "Test User",
        "role": "cashier"
    }, headers=headers)
    
    assert register_response.status_code == 200
    data = register_response.json()
    assert data["username"] == "testuser"
    assert data["role"] == "cashier"

@pytest.mark.asyncio
async def test_login_user(client, test_db):
    """Test user login"""
    # Create test user
    await test_db.users.insert_one({
        "username": "testuser",
        "password_hash": get_password_hash("TestPass123"),
        "full_name": "Test User",
        "role": "cashier",
        "is_active": True
    })
    
    response = client.post("/auth/login", json={
        "username": "testuser",
        "password": "TestPass123"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["username"] == "testuser"

@pytest.mark.asyncio
async def test_login_invalid_credentials(client, test_db):
    """Test login with invalid credentials"""
    response = client.post("/auth/login", json={
        "username": "nonexistent",
        "password": "wrongpass"
    })
    
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_rate_limiting(client, test_db):
    """Test login rate limiting"""
    # Attempt multiple failed logins
    for _ in range(6):
        response = client.post("/auth/login", json={
            "username": "testuser",
            "password": "wrongpass"
        })
    
    # Should be rate limited
    assert response.status_code == 429
