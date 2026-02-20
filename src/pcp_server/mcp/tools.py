"""
Dynamic MCP tool registration for PCP prompts.

Each prompt in the registry becomes a `sh-{name}` MCP tool.
Static utility tools: `sh-list`, `sh-search`, `sh-context`.
"""

import json
import logging
import uuid as uuid_mod

from mcp.server.fastmcp import Context

from src.pcp_server.database import async_session
from src.pcp_server.mcp.server import mcp
from src.pcp_server.mcp.session import get_current_api_key, session_manager
from src.pcp_server.schemas import ExpandRequest
from src.pcp_server.services import (
    apikey_service,
    objective_service,
    policy_service,
    prompt_service,
)

logger = logging.getLogger("pcp.mcp.tools")


async def _maybe_inject_session_context(ctx: Context) -> str | None:
    """Resolve user from API key and return context block on first call per session.

    Returns the formatted context string to prepend, or None if context was
    already delivered or no user could be resolved.
    """
    session_key = id(ctx.session)
    state = session_manager.get_or_create(session_key)

    if state.context_delivered:
        return None

    # Resolve user from API key
    api_key_raw = get_current_api_key()
    if not api_key_raw:
        logger.debug("No API key in request — skipping session context injection")
        state.context_delivered = True
        return None

    async with async_session() as db:
        api_key = await apikey_service.validate_key(db, api_key_raw)
        if not api_key:
            logger.warning("Invalid API key — skipping session context injection")
            state.context_delivered = True
            return None

        state.user_id = api_key.user_id

        policies = await policy_service.resolve_effective(db, api_key.user_id)
        objectives = await objective_service.resolve_effective(db, api_key.user_id)

    lines = ["═══ SESSION CONTEXT (auto-injected) ═══", ""]

    # Policies
    lines.append("Policies:")
    all_policies = list(policies.inherited) + list(policies.local)
    if all_policies:
        for p in all_policies:
            scope = "inherited" if p.is_inherited else "local"
            lines.append(f"  - [{p.enforcement_type.value}] {p.name}: {p.content[:120]} ({scope})")
    else:
        lines.append("  (none configured)")

    lines.append("")

    # Objectives
    lines.append("Objectives:")
    all_objectives = list(objectives.inherited) + list(objectives.local)
    if all_objectives:
        for o in all_objectives:
            desc = f" — {o.description[:80]}" if o.description else ""
            lines.append(f"  - {o.title}{desc}")
    else:
        lines.append("  (none configured)")

    lines.append("")
    lines.append("═══════════════════════════════════════")

    state.context_delivered = True
    return "\n".join(lines)


@mcp.tool(name="sh-list")
async def pcp_list(ctx: Context) -> str:
    """List all available prompts in the PCP registry."""
    context_block = await _maybe_inject_session_context(ctx)
    async with async_session() as db:
        names = await prompt_service.get_all_prompt_names(db)
    if not names:
        result = "No prompts registered yet."
    else:
        lines = ["Available prompts:"]
        for name in names:
            lines.append(f"  - sh-{name}")
        result = "\n".join(lines)
    if context_block:
        return context_block + "\n\n" + result
    return result


@mcp.tool(name="sh-search")
async def pcp_search(query: str, ctx: Context) -> str:
    """Search prompts by name or tag.

    Args:
        query: Search term to match against prompt names, descriptions, and tags.
    """
    context_block = await _maybe_inject_session_context(ctx)
    async with async_session() as db:
        listing = await prompt_service.list_prompts(db, page=1, page_size=100)

    matches = []
    q = query.lower()
    for p in listing.items:
        name_match = q in p.name.lower()
        desc_match = p.description and q in p.description.lower()
        tag_match = p.latest_version and any(q in t.lower() for t in p.latest_version.tags)
        if name_match or desc_match or tag_match:
            desc = p.description or "No description"
            has_tags = p.latest_version and p.latest_version.tags
            tags = ", ".join(p.latest_version.tags) if has_tags else "none"
            matches.append(f"  - sh-{p.name}: {desc} [tags: {tags}]")

    if not matches:
        result = f"No prompts matching '{query}'."
    else:
        result = f"Prompts matching '{query}':\n" + "\n".join(matches)
    if context_block:
        return context_block + "\n\n" + result
    return result


@mcp.tool(name="sh-context")
async def pcp_context(user_id: str, ctx: Context, project_id: str | None = None) -> str:
    """Show effective policies and objectives for a user, optionally within a project context.

    Args:
        user_id: UUID of the user to resolve context for.
        project_id: Optional UUID of the project to layer on top.
    """
    # sh-context is an explicit call — still inject session context if first call
    context_block = await _maybe_inject_session_context(ctx)
    try:
        uid = uuid_mod.UUID(user_id)
    except ValueError:
        return "Error: invalid user_id UUID."
    pid = None
    if project_id:
        try:
            pid = uuid_mod.UUID(project_id)
        except ValueError:
            return "Error: invalid project_id UUID."

    async with async_session() as db:
        policies = await policy_service.resolve_effective(db, uid, pid)
        objectives = await objective_service.resolve_effective(db, uid, pid)

    lines = ["=== Effective Policies ==="]
    if policies.inherited:
        lines.append("Inherited (immutable):")
        for p in policies.inherited:
            lines.append(f"  - [{p.enforcement_type.value}] {p.name}: {p.content[:80]}")
    if policies.local:
        lines.append("Local (mutable):")
        for p in policies.local:
            lines.append(f"  - [{p.enforcement_type.value}] {p.name}: {p.content[:80]}")
    if not policies.inherited and not policies.local:
        lines.append("  (none)")

    lines.append("\n=== Effective Objectives ===")
    if objectives.inherited:
        lines.append("Inherited (immutable):")
        for o in objectives.inherited:
            lines.append(f"  - {o.title}")
    if objectives.local:
        lines.append("Local (mutable):")
        for o in objectives.local:
            lines.append(f"  - {o.title}")
    if not objectives.inherited and not objectives.local:
        lines.append("  (none)")

    result = "\n".join(lines)
    if context_block:
        return context_block + "\n\n" + result
    return result


async def register_prompt_tools() -> None:
    """Dynamically register an MCP tool for each prompt in the DB."""
    async with async_session() as db:
        listing = await prompt_service.list_prompts(db, page=1, page_size=1000)

    for prompt in listing.items:
        register_prompt_tool(prompt.name, prompt.description)


def unregister_prompt_tool(prompt_name: str) -> None:
    """Remove an sh-{name} tool (e.g. on deprecation)."""
    tool_name = f"sh-{prompt_name}"
    mcp._tool_manager._tools.pop(tool_name, None)


def register_prompt_tool(prompt_name: str, description: str | None) -> None:
    """Register (or re-register) a single sh-{name} tool."""
    tool_name = f"sh-{prompt_name}"
    tool_description = description or f"Expand the '{prompt_name}' prompt with your input."

    async def _tool_fn(input: str, ctx: Context, project: str | None = None) -> str:  # noqa: A002
        try:
            parsed = json.loads(input)
            if not isinstance(parsed, dict):
                parsed = {"input": input}
        except (json.JSONDecodeError, TypeError):
            parsed = {"input": input}

        project_id = None
        if project:
            try:
                project_id = uuid_mod.UUID(project)
            except ValueError:
                pass

        async with async_session() as db:
            result = await prompt_service.expand_prompt(
                db,
                prompt_name,
                ExpandRequest(input=parsed, project_id=project_id),
            )
        if not result:
            return f"Error: prompt '{prompt_name}' not found."

        context_block = await _maybe_inject_session_context(ctx)

        parts = []
        if result.system_message:
            parts.append(f"[System]\n{result.system_message}")
        parts.append(f"[User]\n{result.user_message}")
        if result.applied_policies:
            parts.append(f"[Policies Applied]\n{', '.join(result.applied_policies)}")
        tool_result = "\n\n".join(parts)
        if context_block:
            return context_block + "\n\n" + tool_result
        return tool_result

    _tool_fn.__name__ = tool_name
    _tool_fn.__qualname__ = tool_name
    _tool_fn.__doc__ = tool_description

    mcp.tool(name=tool_name)(_tool_fn)
