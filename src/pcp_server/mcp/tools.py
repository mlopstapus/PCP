"""
Dynamic MCP tool registration for PCP prompts.

Each prompt in the registry becomes a `sh-{name}` MCP tool.
Static utility tools: `sh-list`, `sh-search`.
"""

import json

from src.pcp_server.database import async_session
from src.pcp_server.mcp.server import mcp
from src.pcp_server.schemas import ExpandRequest
from src.pcp_server.services import prompt_service


@mcp.tool(name="sh-list")
async def pcp_list() -> str:
    """List all available prompts in the PCP registry."""
    async with async_session() as db:
        names = await prompt_service.get_all_prompt_names(db)
    if not names:
        return "No prompts registered yet."
    lines = ["Available prompts:"]
    for name in names:
        lines.append(f"  - sh-{name}")
    return "\n".join(lines)


@mcp.tool(name="sh-search")
async def pcp_search(query: str) -> str:
    """Search prompts by name or tag.

    Args:
        query: Search term to match against prompt names, descriptions, and tags.
    """
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
        return f"No prompts matching '{query}'."
    return f"Prompts matching '{query}':\n" + "\n".join(matches)


async def register_prompt_tools() -> None:
    """Dynamically register an MCP tool for each prompt in the DB."""
    async with async_session() as db:
        listing = await prompt_service.list_prompts(db, page=1, page_size=1000)

    for prompt in listing.items:
        _register_one(prompt.name, prompt.description)


def _register_one(prompt_name: str, description: str | None) -> None:
    """Register a single sh-{name} tool."""
    tool_name = f"sh-{prompt_name}"
    tool_description = description or f"Expand the '{prompt_name}' prompt with your input."

    async def _tool_fn(input: str) -> str:  # noqa: A002
        try:
            parsed = json.loads(input)
            if not isinstance(parsed, dict):
                parsed = {"input": input}
        except (json.JSONDecodeError, TypeError):
            parsed = {"input": input}
        async with async_session() as db:
            result = await prompt_service.expand_prompt(
                db, prompt_name, ExpandRequest(input=parsed)
            )
        if not result:
            return f"Error: prompt '{prompt_name}' not found."

        parts = []
        if result.system_message:
            parts.append(f"[System]\n{result.system_message}")
        parts.append(f"[User]\n{result.user_message}")
        return "\n\n".join(parts)

    _tool_fn.__name__ = tool_name
    _tool_fn.__qualname__ = tool_name
    _tool_fn.__doc__ = tool_description

    mcp.tool(name=tool_name)(_tool_fn)
