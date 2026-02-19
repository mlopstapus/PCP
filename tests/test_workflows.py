"""Tests for the Workflow CRUD and execution endpoints."""

import pytest


@pytest.fixture
async def project_id(client):
    resp = await client.post(
        "/api/v1/projects", json={"name": "WF Project", "slug": "wf-project"}
    )
    return resp.json()["id"]


@pytest.fixture
async def seeded_prompts(client):
    """Create two prompts for workflow testing."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "greet",
            "version": {
                "version": "1.0.0",
                "user_template": "Hello {{ name }}, welcome!",
            },
        },
    )
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "summarize",
            "version": {
                "version": "1.0.0",
                "user_template": "Summarize: {{ text }}",
            },
        },
    )


@pytest.mark.asyncio
async def test_create_workflow(client, project_id):
    resp = await client.post(
        "/api/v1/workflows",
        json={
            "project_id": project_id,
            "name": "Test Workflow",
            "description": "A test workflow",
            "steps": [
                {
                    "id": "s1",
                    "prompt_name": "greet",
                    "output_key": "greeting",
                    "input_mapping": {"name": "{{ input.name }}"},
                }
            ],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Workflow"
    assert len(data["steps"]) == 1
    assert data["steps"][0]["id"] == "s1"


@pytest.mark.asyncio
async def test_list_workflows(client, project_id):
    await client.post(
        "/api/v1/workflows",
        json={
            "project_id": project_id,
            "name": "WF A",
            "steps": [],
        },
    )
    await client.post(
        "/api/v1/workflows",
        json={
            "project_id": project_id,
            "name": "WF B",
            "steps": [],
        },
    )
    resp = await client.get(f"/api/v1/projects/{project_id}/workflows")
    assert resp.status_code == 200
    names = [w["name"] for w in resp.json()]
    assert "WF A" in names
    assert "WF B" in names


@pytest.mark.asyncio
async def test_get_workflow(client, project_id):
    create = await client.post(
        "/api/v1/workflows",
        json={"project_id": project_id, "name": "Get Me", "steps": []},
    )
    wf_id = create.json()["id"]
    resp = await client.get(f"/api/v1/workflows/{wf_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Get Me"


@pytest.mark.asyncio
async def test_get_workflow_not_found(client):
    resp = await client.get("/api/v1/workflows/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_workflow(client, project_id):
    create = await client.post(
        "/api/v1/workflows",
        json={"project_id": project_id, "name": "Old Name", "steps": []},
    )
    wf_id = create.json()["id"]
    resp = await client.put(
        f"/api/v1/workflows/{wf_id}",
        json={"name": "New Name"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_workflow(client, project_id):
    create = await client.post(
        "/api/v1/workflows",
        json={"project_id": project_id, "name": "Delete Me", "steps": []},
    )
    wf_id = create.json()["id"]
    resp = await client.delete(f"/api/v1/workflows/{wf_id}")
    assert resp.status_code == 204
    get = await client.get(f"/api/v1/workflows/{wf_id}")
    assert get.status_code == 404


@pytest.mark.asyncio
async def test_delete_workflow_not_found(client):
    resp = await client.delete("/api/v1/workflows/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_run_single_step_workflow(client, project_id, seeded_prompts):
    create = await client.post(
        "/api/v1/workflows",
        json={
            "project_id": project_id,
            "name": "Single Step",
            "steps": [
                {
                    "id": "s1",
                    "prompt_name": "greet",
                    "output_key": "greeting",
                    "input_mapping": {"name": "{{ input.name }}"},
                }
            ],
        },
    )
    wf_id = create.json()["id"]
    resp = await client.post(
        f"/api/v1/workflows/{wf_id}/run",
        json={"input": {"name": "Alice"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["steps"]) == 1
    assert data["steps"][0]["status"] == "success"
    assert "Alice" in data["steps"][0]["user_message"]
    assert "greeting" in data["outputs"]


@pytest.mark.asyncio
async def test_run_chained_workflow(client, project_id, seeded_prompts):
    create = await client.post(
        "/api/v1/workflows",
        json={
            "project_id": project_id,
            "name": "Chained",
            "steps": [
                {
                    "id": "s1",
                    "prompt_name": "greet",
                    "output_key": "greeting",
                    "input_mapping": {"name": "{{ input.name }}"},
                },
                {
                    "id": "s2",
                    "prompt_name": "summarize",
                    "output_key": "summary",
                    "input_mapping": {"text": "{{ steps.s1.greeting }}"},
                    "depends_on": ["s1"],
                },
            ],
        },
    )
    wf_id = create.json()["id"]
    resp = await client.post(
        f"/api/v1/workflows/{wf_id}/run",
        json={"input": {"name": "Bob"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["steps"]) == 2
    assert data["steps"][0]["status"] == "success"
    assert data["steps"][1]["status"] == "success"
    assert "Bob" in data["steps"][0]["user_message"]
    assert "Summarize:" in data["steps"][1]["user_message"]


@pytest.mark.asyncio
async def test_run_workflow_not_found(client):
    resp = await client.post(
        "/api/v1/workflows/00000000-0000-0000-0000-000000000000/run",
        json={"input": {}},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_run_workflow_missing_prompt(client, project_id):
    create = await client.post(
        "/api/v1/workflows",
        json={
            "project_id": project_id,
            "name": "Bad Prompt",
            "steps": [
                {
                    "id": "s1",
                    "prompt_name": "nonexistent",
                    "output_key": "out",
                    "input_mapping": {},
                }
            ],
        },
    )
    wf_id = create.json()["id"]
    resp = await client.post(
        f"/api/v1/workflows/{wf_id}/run",
        json={"input": {}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["steps"][0]["status"] == "error"
    assert "not found" in data["steps"][0]["error"]
