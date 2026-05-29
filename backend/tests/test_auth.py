"""
Integration tests for authentication flows (Fix 7.3)
NOTE: These tests require a real MongoDB connection. Skipped until MongoDB is available in test environment.
"""
import pytest
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
import os

from server import app
from auth import get_password_hash, create_access_token

# Skip all auth tests - they require real MongoDB connection
pytestmark = pytest.mark.skip(reason="Auth integration tests require real MongoDB connection")

@pytest.fixture
async def client():
    """Async test client fixture using httpx with ASGI transport"""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def test_db():
    """Test database fixture - uses retail_test to avoid affecting production data"""
    mongo_uri = os.getenv("MONGO_URL", os.getenv("MONGO_URI", "mongodb://localhost:27017"))
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
    response = await client.post("/api/auth/register", json={
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
    login_response = await client.post("/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    # Register new user with admin token
    headers = {"Authorization": f"Bearer {token}"}
    register_response = await client.post("/api/auth/register", json={
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

    response = await client.post("/api/auth/login", json={
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
    response = await client.post("/api/auth/login", json={
        "username": "nonexistent",
        "password": "wrongpass"
    })

    assert response.status_code == 401

@pytest.mark.asyncio
async def test_rate_limiting(client, test_db):
    """Test login rate limiting"""
    # Attempt multiple failed logins
    for _ in range(6):
        response = await client.post("/api/auth/login", json={
            "username": "testuser",
            "password": "wrongpass"
        })

    # Should be rate limited
    assert response.status_code == 429
