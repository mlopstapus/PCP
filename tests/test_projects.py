"""Tests for the Project CRUD API."""

import pytest


@pytest.mark.asyncio
async def test_create_project(client):
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "My Project", "slug": "my-project", "description": "Test project"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Project"
    assert data["slug"] == "my-project"
    assert data["description"] == "Test project"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_project_duplicate_slug(client):
    await client.post(
        "/api/v1/projects",
        json={"name": "First", "slug": "dup-slug"},
    )
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "Second", "slug": "dup-slug"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_projects(client):
    await client.post("/api/v1/projects", json={"name": "Alpha", "slug": "alpha"})
    await client.post("/api/v1/projects", json={"name": "Beta", "slug": "beta"})
    resp = await client.get("/api/v1/projects")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    slugs = [p["slug"] for p in data["items"]]
    assert "alpha" in slugs
    assert "beta" in slugs


@pytest.mark.asyncio
async def test_get_project(client):
    create_resp = await client.post(
        "/api/v1/projects", json={"name": "Get Me", "slug": "get-me"}
    )
    project_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/projects/{project_id}")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "get-me"


@pytest.mark.asyncio
async def test_get_project_not_found(client):
    resp = await client.get("/api/v1/projects/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_project(client):
    create_resp = await client.post(
        "/api/v1/projects", json={"name": "Old Name", "slug": "update-me"}
    )
    project_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/v1/projects/{project_id}",
        json={"name": "New Name", "description": "Updated"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["description"] == "Updated"


@pytest.mark.asyncio
async def test_update_project_not_found(client):
    resp = await client.put(
        "/api/v1/projects/00000000-0000-0000-0000-000000000000",
        json={"name": "Nope"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_project(client):
    create_resp = await client.post(
        "/api/v1/projects", json={"name": "Delete Me", "slug": "delete-me"}
    )
    project_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/projects/{project_id}")
    assert resp.status_code == 204

    get_resp = await client.get(f"/api/v1/projects/{project_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_project_not_found(client):
    resp = await client.delete("/api/v1/projects/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404
