from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    "Prompt Control Plane",
    instructions=(
        "PCP is a prompt registry. Use sh-list to see available prompts, "
        "sh-search to find prompts by tag or name, and sh-{name} to expand "
        "a specific prompt with your input."
    ),
    streamable_http_path="/",
)
