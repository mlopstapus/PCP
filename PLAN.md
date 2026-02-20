# Session-Aware Context Injection for MCP Tools

## Overview

Automatically inject effective policies and objectives into the LLM context **once per MCP session**, on the first tool call. This makes governance context transparent — no extra user action, no repeated injection on every call.

---

## Problem

Today, policies and objectives are injected into prompt templates during `expand_prompt()`, but MCP tool calls (e.g., `pcp-feature`, `pcp-fix`) only get this context if a `user_id` is available — which falls back to the prompt's owner. There's no session-level identity, and the LLM never sees the raw policies/objectives as standalone context. A user has to manually call `pcp-context` with their UUID.

## Solution: First-Tool-Call Injection

On the **first** MCP tool call in a session, prepend the user's effective policies and objectives to the tool response. Subsequent calls in the same session skip the injection.

### How It Works

1. **User identity from API key:** MCP clients connect with `Authorization: Bearer pcp_...`. We resolve the user from the API key at the first tool call and cache it per session.
2. **Session tracking:** Use `id(ctx.session)` as the session key. Maintain an in-memory `dict` mapping session IDs to `SessionState` (user, context_delivered flag).
3. **First-call injection:** Every tool function checks the session state. If context hasn't been delivered yet, resolve effective policies + objectives and prepend them to the tool's response.
4. **Cleanup:** Sessions are removed from the dict when the MCP session disconnects (or via a TTL sweep as a safety net).

### File Changes

| File | Change |
|------|--------|
| `src/pcp_server/mcp/session.py` | **New.** `SessionState` dataclass, `SessionManager` class with `get_or_create()`, `mark_context_delivered()`, `cleanup()` |
| `src/pcp_server/mcp/tools.py` | Add `ctx: Context` param to all tool functions. On first call, resolve user from API key, fetch policies/objectives, prepend to response. |
| `src/pcp_server/mcp/server.py` | Update instructions to mention auto-injected context. |
| `tests/test_mcp_session.py` | **New.** Tests for session tracking and first-call injection. |

### Session State

```python
@dataclass
class SessionState:
    user_id: uuid.UUID | None = None
    context_delivered: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
```

### Context Format (prepended to first tool response)

```
═══ SESSION CONTEXT (auto-injected) ═══

Policies:
  - [prepend] require-tests: All code changes must include tests. (inherited)
  - [append] security-review: Flag any credential handling for review. (local)

Objectives:
  - Improve platform reliability
  - Reduce deployment time to under 5 minutes

═══════════════════════════════════════
```

### User Resolution Flow

1. Tool function receives `ctx: Context`
2. Check `session_manager.get(session_id)` — if context already delivered, skip
3. If not, extract API key from the MCP session's HTTP headers
4. Call `apikey_service.validate_key()` to resolve the user
5. Call `policy_service.resolve_effective()` + `objective_service.resolve_effective()`
6. Format and prepend to tool response
7. Mark `context_delivered = True`

### Edge Cases

- **No auth header / invalid key:** Skip injection silently, log a warning. Tools still work.
- **No policies or objectives:** Inject a minimal "No policies or objectives configured" note.
- **Session reconnect:** New session = new injection (by design — policies may have changed).

---

## Acceptance Criteria

1. First `pcp-*` tool call in a session includes policies + objectives in the response
2. Second and subsequent calls do NOT include the context block
3. Different sessions get independent injection
4. Works with API key auth; gracefully degrades without auth
5. Existing tests continue to pass
6. New tests cover: first-call injection, no-repeat, no-auth fallback

---

## Out of Scope

- Per-tool opt-out of injection
- Caching policies across sessions (always fresh)
- MCP Resources-based approach (clients don't auto-read)
- Frontend changes
