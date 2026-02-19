"""Tests for the metrics dashboard endpoint and usage tracking."""

import pytest


@pytest.mark.asyncio
async def test_dashboard_stats_empty(client):
    resp = await client.get("/api/v1/metrics/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_prompts"] == 0
    assert data["total_versions"] == 0
    assert data["total_expands"] == 0
    assert data["expands_24h"] == 0
    assert data["avg_latency_ms"] == 0
    assert data["error_rate_pct"] == 0
    assert data["top_prompts"] == []
    assert data["daily_usage"] == []


@pytest.mark.asyncio
async def test_usage_recorded_on_expand(client):
    # Create a prompt
    await client.post(
        "/api/v1/prompts",
        json={
            "name": "metrics-test",
            "version": {
                "version": "1.0.0",
                "user_template": "Hello {{ name }}",
            },
        },
    )

    # Expand it a few times
    for _ in range(3):
        resp = await client.post(
            "/api/v1/expand/metrics-test",
            json={"input": {"name": "world"}},
        )
        assert resp.status_code == 200

    # Check dashboard
    stats = await client.get("/api/v1/metrics/dashboard")
    data = stats.json()
    assert data["total_prompts"] == 1
    assert data["total_expands"] == 3
    assert data["expands_24h"] == 3
    assert data["avg_latency_ms"] > 0
    assert data["error_rate_pct"] == 0
    assert len(data["top_prompts"]) == 1
    assert data["top_prompts"][0]["name"] == "metrics-test"
    assert data["top_prompts"][0]["count"] == 3


@pytest.mark.asyncio
async def test_usage_recorded_on_expand_error(client):
    # Expand a non-existent prompt (404)
    resp = await client.post(
        "/api/v1/expand/nonexistent",
        json={"input": {}},
    )
    assert resp.status_code == 404

    stats = await client.get("/api/v1/metrics/dashboard")
    data = stats.json()
    assert data["total_expands"] == 1
    assert data["error_rate_pct"] == 100.0
