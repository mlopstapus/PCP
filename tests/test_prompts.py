"""Tests for the prompt CRUD REST API and expansion endpoint."""

import pytest


@pytest.mark.asyncio
async def test_create_prompt(client):
    resp = await client.post(
        "/api/v1/prompts",
        json={
            "name": "test-prompt",
            "description": "A test prompt",
            "version": {
                "version": "1.0.0",
                "system_template": "You are a helpful assistant.",
                "user_template": "Help me with: {{ input }}",
                "input_schema": {
                    "type": "object",
                    "properties": {"input": {"type": "string"}},
                    "required": ["input"],
                },
                "tags": ["test"],
            },
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "test-prompt"
    assert data["description"] == "A test prompt"
    assert data["is_deprecated"] is False
    assert data["latest_version"]["version"] == "1.0.0"
    assert data["latest_version"]["tags"] == ["test"]


@pytest.mark.asyncio
async def test_create_prompt_duplicate(client):
    payload = {
        "name": "dup-prompt",
        "version": {
            "version": "1.0.0",
            "user_template": "Hello {{ input }}",
        },
    }
    resp1 = await client.post("/api/v1/prompts", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/prompts", json=payload)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_create_prompt_invalid_name(client):
    resp = await client.post(
        "/api/v1/prompts",
        json={
            "name": "Invalid Name!",
            "version": {"version": "1.0.0", "user_template": "hi"},
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_prompts(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "list-a",
            "version": {"version": "1.0.0", "user_template": "a {{ input }}"},
        },
    )
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "list-b",
            "version": {"version": "1.0.0", "user_template": "b {{ input }}"},
        },
    )
    resp = await client.get("/api/v1/prompts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    names = [p["name"] for p in data["items"]]
    assert "list-a" in names
    assert "list-b" in names


@pytest.mark.asyncio
async def test_get_prompt(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "get-me",
            "description": "Fetch this",
            "version": {"version": "1.0.0", "user_template": "{{ input }}"},
        },
    )
    resp = await client.get("/api/v1/prompts/get-me")
    assert resp.status_code == 200
    assert resp.json()["name"] == "get-me"


@pytest.mark.asyncio
async def test_get_prompt_not_found(client):
    resp = await client.get("/api/v1/prompts/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_new_version(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "versioned",
            "version": {"version": "1.0.0", "user_template": "v1 {{ input }}"},
        },
    )
    resp = await client.put(
        "/api/v1/prompts/versioned",
        json={"version": "2.0.0", "user_template": "v2 {{ input }}"},
    )
    assert resp.status_code == 201
    assert resp.json()["version"] == "2.0.0"

    versions_resp = await client.get("/api/v1/prompts/versioned/versions")
    assert versions_resp.status_code == 200
    versions = versions_resp.json()
    assert len(versions) == 2


@pytest.mark.asyncio
async def test_deprecate_prompt(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "to-deprecate",
            "version": {"version": "1.0.0", "user_template": "{{ input }}"},
        },
    )
    resp = await client.delete("/api/v1/prompts/to-deprecate")
    assert resp.status_code == 204

    get_resp = await client.get("/api/v1/prompts/to-deprecate")
    assert get_resp.json()["is_deprecated"] is True


@pytest.mark.asyncio
async def test_expand_prompt(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "expand-me",
            "version": {
                "version": "1.0.0",
                "system_template": "You are a {{ role }}.",
                "user_template": "Do this: {{ task }}",
            },
        },
    )
    resp = await client.post(
        "/api/v1/expand/expand-me",
        json={"input": {"role": "planner", "task": "build a house"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["prompt_name"] == "expand-me"
    assert data["system_message"] == "You are a planner."
    assert data["user_message"] == "Do this: build a house"


@pytest.mark.asyncio
async def test_expand_prompt_not_found(client):
    resp = await client.post("/api/v1/expand/nope", json={"input": {}})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_expand_prompt_missing_variable(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "strict-expand",
            "version": {
                "version": "1.0.0",
                "user_template": "{{ required_var }}",
            },
        },
    )
    resp = await client.post("/api/v1/expand/strict-expand", json={"input": {}})
    assert resp.status_code == 422
    assert "required_var" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_expand_specific_version(client):
    """Expand a specific version of a prompt, not just the latest."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "multi-ver",
            "version": {
                "version": "1.0.0",
                "system_template": "v1 system",
                "user_template": "v1: {{ input }}",
            },
        },
    )
    await client.put(
        "/api/v1/prompts/multi-ver",
        json={
            "version": "2.0.0",
            "system_template": "v2 system",
            "user_template": "v2: {{ input }}",
        },
    )
    resp = await client.post(
        "/api/v1/expand/multi-ver/versions/1.0.0",
        json={"input": {"input": "hello"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["prompt_version"] == "1.0.0"
    assert data["system_message"] == "v1 system"
    assert data["user_message"] == "v1: hello"


@pytest.mark.asyncio
async def test_expand_specific_version_not_found(client):
    """Expanding a nonexistent version returns 404."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "ver-404",
            "version": {"version": "1.0.0", "user_template": "{{ input }}"},
        },
    )
    resp = await client.post(
        "/api/v1/expand/ver-404/versions/9.9.9",
        json={"input": {"input": "test"}},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_expand_deprecated_prompt(client):
    """Expanding a deprecated prompt returns 404."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "dep-expand",
            "version": {"version": "1.0.0", "user_template": "{{ input }}"},
        },
    )
    await client.delete("/api/v1/prompts/dep-expand")
    resp = await client.post(
        "/api/v1/expand/dep-expand", json={"input": {"input": "test"}}
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_expand_no_system_template(client):
    """Expanding a prompt without a system template returns null system_message."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "no-system",
            "version": {"version": "1.0.0", "user_template": "Just: {{ input }}"},
        },
    )
    resp = await client.post(
        "/api/v1/expand/no-system", json={"input": {"input": "hi"}}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["system_message"] is None
    assert data["user_message"] == "Just: hi"


@pytest.mark.asyncio
async def test_list_prompts_with_tag_filter(client):
    """Listing prompts with ?tag= filters correctly."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "tagged-a",
            "version": {
                "version": "1.0.0",
                "user_template": "{{ input }}",
                "tags": ["alpha"],
            },
        },
    )
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "tagged-b",
            "version": {
                "version": "1.0.0",
                "user_template": "{{ input }}",
                "tags": ["beta"],
            },
        },
    )
    resp = await client.get("/api/v1/prompts", params={"tag": "alpha"})
    assert resp.status_code == 200
    data = resp.json()
    names = [p["name"] for p in data["items"]]
    assert "tagged-a" in names
    assert "tagged-b" not in names


@pytest.mark.asyncio
async def test_list_prompts_pagination(client):
    """Listing prompts respects page and page_size."""
    for i in range(3):
        await client.post(
            "/api/v1/prompts",
            json={
                "name": f"page-{i}",
                "version": {"version": "1.0.0", "user_template": "{{ input }}"},
            },
        )
    resp = await client.get("/api/v1/prompts", params={"page": 1, "page_size": 2})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) <= 2
    assert data["total"] >= 3
    assert data["page"] == 1
    assert data["page_size"] == 2


@pytest.mark.asyncio
async def test_deprecate_not_found(client):
    """Deprecating a nonexistent prompt returns 404."""
    resp = await client.delete("/api/v1/prompts/no-such-prompt")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_version_not_found(client):
    """Creating a version for a nonexistent prompt returns 404."""
    resp = await client.put(
        "/api/v1/prompts/no-such-prompt",
        json={"version": "1.0.0", "user_template": "{{ input }}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_versions_not_found(client):
    """Getting versions for a nonexistent prompt returns 404."""
    resp = await client.get("/api/v1/prompts/no-such-prompt/versions")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_version(client):
    """Creating a duplicate version returns 409."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "dup-ver",
            "version": {"version": "1.0.0", "user_template": "{{ input }}"},
        },
    )
    resp = await client.put(
        "/api/v1/prompts/dup-ver",
        json={"version": "1.0.0", "user_template": "{{ input }}"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_include_prompt_basic(client):
    """include_prompt() inlines another prompt's expanded content."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "helper",
            "version": {
                "version": "1.0.0",
                "system_template": "I am the helper system.",
                "user_template": "Helper says: {{ input }}",
            },
        },
    )
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "composer",
            "version": {
                "version": "1.0.0",
                "user_template": (
                    "Main task: {{ input }}\n\nContext:\n{{ include_prompt('helper') }}"
                ),
            },
        },
    )
    resp = await client.post(
        "/api/v1/expand/composer", json={"input": {"input": "do something"}}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "Main task: do something" in data["user_message"]
    assert "I am the helper system." in data["user_message"]
    assert "Helper says: do something" in data["user_message"]


@pytest.mark.asyncio
async def test_include_prompt_not_found(client):
    """include_prompt() with a nonexistent prompt returns an error marker."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "bad-include",
            "version": {
                "version": "1.0.0",
                "user_template": "Before {{ include_prompt('nonexistent') }} After",
            },
        },
    )
    resp = await client.post(
        "/api/v1/expand/bad-include", json={"input": {}}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "prompt not found" in data["user_message"]
    assert "Before" in data["user_message"]
    assert "After" in data["user_message"]


@pytest.mark.asyncio
async def test_include_prompt_nested(client):
    """include_prompt() works with nested includes (A includes B includes C)."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "leaf",
            "version": {
                "version": "1.0.0",
                "user_template": "LEAF:{{ input }}",
            },
        },
    )
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "middle",
            "version": {
                "version": "1.0.0",
                "user_template": "MIDDLE[{{ include_prompt('leaf') }}]",
            },
        },
    )
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "outer",
            "version": {
                "version": "1.0.0",
                "user_template": "OUTER[{{ include_prompt('middle') }}]",
            },
        },
    )
    resp = await client.post(
        "/api/v1/expand/outer", json={"input": {"input": "x"}}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "OUTER[" in data["user_message"]
    assert "MIDDLE[" in data["user_message"]
    assert "LEAF:x" in data["user_message"]


@pytest.mark.asyncio
async def test_include_prompt_max_depth(client):
    """include_prompt() stops at max depth and returns an error marker."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "recursive-a",
            "version": {
                "version": "1.0.0",
                "user_template": "A[{{ include_prompt('recursive-b') }}]",
            },
        },
    )
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "recursive-b",
            "version": {
                "version": "1.0.0",
                "user_template": "B[{{ include_prompt('recursive-a') }}]",
            },
        },
    )
    resp = await client.post(
        "/api/v1/expand/recursive-a", json={"input": {}}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "max depth" in data["user_message"]


@pytest.mark.asyncio
async def test_include_prompt_in_system_template(client):
    """include_prompt() works inside system_template too."""
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "sys-helper",
            "version": {
                "version": "1.0.0",
                "system_template": "Helper guidance here.",
                "user_template": "Helper user.",
            },
        },
    )
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "sys-composer",
            "version": {
                "version": "1.0.0",
                "system_template": "Main system.\n{{ include_prompt('sys-helper') }}",
                "user_template": "Do: {{ input }}",
            },
        },
    )
    resp = await client.post(
        "/api/v1/expand/sys-composer", json={"input": {"input": "work"}}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "Main system." in data["system_message"]
    assert "Helper guidance here." in data["system_message"]
    assert data["user_message"] == "Do: work"


@pytest.mark.asyncio
async def test_pin_version(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "pin-test",
            "version": {
                "version": "1.0.0",
                "user_template": "v1: {{ input }}",
            },
        },
    )
    await client.put(
        "/api/v1/prompts/pin-test",
        json={"version": "2.0.0", "user_template": "v2: {{ input }}"},
    )
    # Pin to v1
    resp = await client.post("/api/v1/prompts/pin-test/rollback/1.0.0")
    assert resp.status_code == 200

    # Expand without version should use pinned v1
    expand_resp = await client.post(
        "/api/v1/expand/pin-test", json={"input": {"input": "hello"}}
    )
    assert expand_resp.status_code == 200
    assert expand_resp.json()["prompt_version"] == "1.0.0"
    assert "v1: hello" in expand_resp.json()["user_message"]


@pytest.mark.asyncio
async def test_pin_version_not_found(client):
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "pin-404",
            "version": {"version": "1.0.0", "user_template": "{{ input }}"},
        },
    )
    resp = await client.post("/api/v1/prompts/pin-404/rollback/9.9.9")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
