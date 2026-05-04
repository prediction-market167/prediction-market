import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_register_and_login():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/auth/register", json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "secret123",
        })
        assert response.status_code == 201
        assert response.json()["email"] == "test@example.com"
