"""Tests for MCP session-aware context injection."""

import pytest

from src.pcp_server.mcp.session import SessionManager, SessionState, _current_api_key


class TestSessionState:
    def test_defaults(self):
        state = SessionState()
        assert state.user_id is None
        assert state.context_delivered is False
        assert state.created_at is not None


class TestSessionManager:
    def test_get_or_create_new(self):
        mgr = SessionManager()
        state = mgr.get_or_create(42)
        assert state.context_delivered is False
        assert mgr.active_count == 1

    def test_get_or_create_existing(self):
        mgr = SessionManager()
        s1 = mgr.get_or_create(42)
        s1.context_delivered = True
        s2 = mgr.get_or_create(42)
        assert s2.context_delivered is True
        assert s1 is s2

    def test_different_sessions_independent(self):
        mgr = SessionManager()
        s1 = mgr.get_or_create(1)
        s2 = mgr.get_or_create(2)
        s1.context_delivered = True
        assert s2.context_delivered is False
        assert mgr.active_count == 2

    def test_remove(self):
        mgr = SessionManager()
        mgr.get_or_create(42)
        mgr.remove(42)
        assert mgr.active_count == 0

    def test_remove_nonexistent(self):
        mgr = SessionManager()
        mgr.remove(999)  # should not raise

    def test_cleanup_stale(self):
        from datetime import datetime, timedelta, timezone

        mgr = SessionManager()
        state = mgr.get_or_create(1)
        # Make it old
        state.created_at = datetime.now(timezone.utc) - timedelta(hours=25)
        mgr.get_or_create(2)  # fresh

        removed = mgr.cleanup_stale(max_age_hours=24)
        assert removed == 1
        assert mgr.active_count == 1


class TestApiKeyContextVar:
    def test_default_is_none(self):
        from src.pcp_server.mcp.session import get_current_api_key

        assert get_current_api_key() is None

    def test_set_and_get(self):
        from src.pcp_server.mcp.session import get_current_api_key

        token = _current_api_key.set("pcp_test123")
        try:
            assert get_current_api_key() == "pcp_test123"
        finally:
            _current_api_key.reset(token)

    def test_reset(self):
        from src.pcp_server.mcp.session import get_current_api_key

        token = _current_api_key.set("pcp_test123")
        _current_api_key.reset(token)
        assert get_current_api_key() is None


class TestApiKeyMiddleware:
    @pytest.mark.asyncio
    async def test_extracts_pcp_key(self):
        """Middleware should set the context var for pcp_ prefixed keys."""
        from src.pcp_server.mcp.session import ApiKeyMiddleware, get_current_api_key

        captured_key = None

        async def inner_app(scope, receive, send):
            nonlocal captured_key
            captured_key = get_current_api_key()

        middleware = ApiKeyMiddleware(inner_app)
        scope = {
            "type": "http",
            "headers": [
                (b"authorization", b"Bearer pcp_abc123"),
            ],
        }
        await middleware(scope, None, None)
        assert captured_key == "pcp_abc123"

    @pytest.mark.asyncio
    async def test_ignores_non_pcp_key(self):
        """Middleware should not set context var for non-pcp keys."""
        from src.pcp_server.mcp.session import ApiKeyMiddleware, get_current_api_key

        captured_key = None

        async def inner_app(scope, receive, send):
            nonlocal captured_key
            captured_key = get_current_api_key()

        middleware = ApiKeyMiddleware(inner_app)
        scope = {
            "type": "http",
            "headers": [
                (b"authorization", b"Bearer some-jwt-token"),
            ],
        }
        await middleware(scope, None, None)
        assert captured_key is None

    @pytest.mark.asyncio
    async def test_no_auth_header(self):
        """Middleware should handle missing auth header gracefully."""
        from src.pcp_server.mcp.session import ApiKeyMiddleware, get_current_api_key

        captured_key = None

        async def inner_app(scope, receive, send):
            nonlocal captured_key
            captured_key = get_current_api_key()

        middleware = ApiKeyMiddleware(inner_app)
        scope = {"type": "http", "headers": []}
        await middleware(scope, None, None)
        assert captured_key is None

    @pytest.mark.asyncio
    async def test_resets_after_request(self):
        """Context var should be reset after the middleware completes."""
        from src.pcp_server.mcp.session import ApiKeyMiddleware, get_current_api_key

        async def inner_app(scope, receive, send):
            pass

        middleware = ApiKeyMiddleware(inner_app)
        scope = {
            "type": "http",
            "headers": [(b"authorization", b"Bearer pcp_abc123")],
        }
        await middleware(scope, None, None)
        # After middleware completes, context var should be reset
        assert get_current_api_key() is None

    @pytest.mark.asyncio
    async def test_passthrough_non_http(self):
        """Non-HTTP scopes should pass through without setting context var."""
        from src.pcp_server.mcp.session import ApiKeyMiddleware, get_current_api_key

        called = False

        async def inner_app(scope, receive, send):
            nonlocal called
            called = True

        middleware = ApiKeyMiddleware(inner_app)
        scope = {"type": "lifespan"}
        await middleware(scope, None, None)
        assert called
        assert get_current_api_key() is None
