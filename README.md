# PCP — Prompt Control Plane

An open-source, self-hosted prompt registry distributed via [MCP (Model Context Protocol)](https://modelcontextprotocol.io/).

Define prompts once, distribute them to every developer's AI tool (Claude, Windsurf, Copilot) as `sh-*` MCP tools. PCP never calls an LLM — it serves expanded prompts, and the IDE's own LLM does the work.

## Quickstart (docker-compose)

```bash
git clone <repo> && cd pcp
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install -e ".[dev]"

# Start Postgres
docker-compose up -d postgres

# Run migrations and seed example prompts
alembic upgrade head
python scripts/seed.py

# Start the server
uvicorn src.pcp_server.main:app --reload --port 8000
```

- **REST API:** http://localhost:8000/api/v1/prompts
- **MCP endpoint:** http://localhost:8000/mcp/
- **OpenAPI docs:** http://localhost:8000/docs
- **Health check:** http://localhost:8000/health

## Deploy with Helm (Kubernetes)

```bash
# Add a PostgreSQL instance (e.g. Bitnami)
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install sh-postgresql bitnami/postgresql \
  --set auth.username=pcp \
  --set auth.password=pcp \
  --set auth.database=pcp

# Install PCP
helm install pcp charts/pcp \
  --set postgresql.host=sh-postgresql \
  --set postgresql.password=pcp \
  --set authToken=my-secret-token

# Verify
kubectl get pods -l app.kubernetes.io/name=pcp
kubectl port-forward svc/pcp 8000:8000
curl http://localhost:8000/health
```

See [`charts/pcp/values.yaml`](charts/pcp/values.yaml) for all configuration options.

## Connect Your AI Tool

### Windsurf

Open MCP settings (⌘+Shift+P → "MCP: Configure MCP Servers") and add:

```json
{
  "mcpServers": {
    "pcp": {
      "serverUrl": "http://localhost:8000/mcp/"
    }
  }
}
```

### Claude Code

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pcp": {
      "transport": "sse",
      "url": "http://localhost:8000/mcp/"
    }
  }
}
```

### GitHub Copilot

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "pcp": {
      "url": "http://localhost:8000/mcp/"
    }
  }
}
```

Once connected, you get these tools automatically:

**Entrypoints** — start here:

| Tool | Description |
|------|-------------|
| `sh-new` | Start a new feature or task — plans, implements, tests, and iterates with user feedback |
| `sh-finish` | Finalize work — run tests, document, commit, review, and improve prompts |

**Building blocks** — used by the entrypoints, or individually for targeted work:

| Tool | Description |
|------|-------------|
| `sh-plan` | Generate a structured implementation plan |
| `sh-feature` | Implement a new feature |
| `sh-iterate` | Incrementally improve existing code based on feedback |
| `sh-fix` | Diagnose and fix a bug or error |
| `sh-refactor` | Restructure code without changing behavior |
| `sh-test` | Generate tests for code |
| `sh-review` | Perform a thorough code review |
| `sh-document` | Generate documentation |
| `sh-commit` | Commit changes to the repository |
| `sh-ralph` | Iteratively improve PCP prompts based on session takeaways |
| `sh-list` | List all available prompts |
| `sh-search` | Search prompts by name or tag |

## API Examples

**Create a prompt:**

```bash
curl -X POST http://localhost:8000/api/v1/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-prompt",
    "description": "A custom prompt",
    "version": {
      "version": "1.0.0",
      "system_template": "You are a helpful assistant.",
      "user_template": "Help me with: {{ input }}",
      "tags": ["general"]
    }
  }'
```

**Expand a prompt:**

```bash
curl -X POST http://localhost:8000/api/v1/expand/my-prompt \
  -H "Content-Type: application/json" \
  -d '{"input": {"input": "building a REST API"}}'
```

**List prompts:**

```bash
curl http://localhost:8000/api/v1/prompts
```

## How It Works

1. Admin creates prompts via REST API (or seed script from YAML files in `prompts/`)
2. PCP dynamically registers each prompt as a `sh-{name}` MCP tool
3. Developers connect their AI tool to PCP's MCP endpoint
4. Developer invokes `sh-plan build a feature store`
5. AI tool calls the `sh-plan` MCP tool → PCP expands the Jinja2 template → returns `system_message` + `user_message`
6. The IDE's own LLM uses the returned prompt to generate the response

## Prompt Composition

Prompts can include other prompts using `include_prompt()` in their Jinja2 templates. This lets a prompt pull in context from other prompts at expansion time.

```yaml
user_template: >
  Plan this feature: {{ input }}

  Consider the review perspective:
  {{ include_prompt('review') }}
```

When expanded, `include_prompt('review')` fetches the `review` prompt, renders its system + user templates with the same input variables, and inlines the result.

- **Nested includes** are supported (A includes B includes C)
- **Max depth of 3** prevents infinite recursion
- **Missing prompts** return a safe error marker instead of failing

## Running Tests

```bash
python -m pytest tests/ -v
```

## Tech Stack

- **Python 3.12+**, FastAPI, SQLAlchemy 2.0 (async), Alembic
- **PostgreSQL** for storage
- **Jinja2** (sandboxed) for template expansion
- **MCP Python SDK** for MCP server (Streamable HTTP transport)
- **Helm 3** for Kubernetes deployment
- **GitHub Actions** for CI (lint, test, build, helm lint)

## Documentation

- [Architecture & Design](docs/architecture.md)
- [Deploy to OpenShift CRC](docs/deploy-openshift-crc.md)

## License

Apache 2.0 — see [LICENSE](LICENSE)