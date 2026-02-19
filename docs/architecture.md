# PCP Architecture

**Prompt Control Plane — An Open-Source, Self-Hosted Prompt Registry Distributed via MCP**

---

## Overview

PCP is an infrastructure layer for managing, versioning, and distributing LLM prompts across any AI-powered IDE or tool. It solves the fragmentation problem where prompts are siloed inside individual tools (Windsurf, Claude Code, Copilot) with no portability, versioning, or observability.

The primary distribution mechanism is **MCP (Model Context Protocol)** — PCP exposes an MCP server that Claude, Windsurf, GitHub Copilot, and any MCP-compatible client can connect to natively. Developers don't need a separate CLI or plugin; their existing AI tools connect directly to the company's PCP instance over the corporate network.

PCP does **not** call LLMs — it serves expanded prompts to the IDE, and the IDE's own LLM does the work.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **MCP Server** | `mcp` Python SDK (Anthropic) | Native integration with Claude, Windsurf, Copilot; Streamable HTTP transport for remote access |
| **API Server** | Python 3.12+, FastAPI | Async-first, excellent OpenAPI docs, Pydantic validation |
| **ORM / DB** | SQLAlchemy 2.0 (async) + Alembic | Mature, async support, migration management |
| **Database** | PostgreSQL 16 | JSONB for schemas, robust, StatefulSet-friendly |
| **Template Engine** | Jinja2 (sandboxed) | Industry standard, already a FastAPI dependency |
| **Auth** | Bearer token (API key) | Simple, stateless |
| **Testing** | pytest + pytest-asyncio + httpx | Async test support, API integration tests |
| **Containerization** | Docker (multi-stage) | Minimal image size, reproducible builds |
| **Packaging** | Helm 3 chart | Self-hosted K8s deployment; one `helm install` to deploy |
| **CI/CD** | GitHub Actions | Build, test, publish chart + container image |
| **Linting** | Ruff | Fast, replaces flake8 + black + isort |

---

## High-Level Architecture

```
  +-------------+  +-------------+  +-------------+
  |   Claude    |  |  Windsurf   |  |   Copilot   |
  |   Code      |  |             |  |             |
  +------+------+  +------+------+  +------+------+
         |                |                |
         +----------- MCP (HTTP) ----------+
                          |
                          v
              +-----------+------------+
              |     PCP Server         |
              |  +------------------+  |
              |  | MCP Server       |  |
              |  +------------------+  |
              |  | REST API (FastAPI)| |  <-- admin prompt management
              |  +------------------+  |
              +-----------+------------+
                          |
                          v
               +------------------+
               |   Postgres DB    |
               | - Prompts        |
               | - Versions       |
               +------------------+
```

---

## Core Concepts

### Prompt

A versioned template with:
- **name** — unique identifier, kebab-case (e.g., `feature-prd`)
- **description** — human-readable purpose
- **system_template** — Jinja2 template for system message
- **user_template** — Jinja2 template for user message
- **input_schema** — JSON Schema defining required variables
- **version** — semver string (e.g., `1.0.0`)
- **tags** — list of strings for categorization

### Execution Model

PCP is a **prompt source**, not an LLM proxy. It never calls an LLM.

1. Developer invokes `sh-plan "build a feature store"` in their AI tool
2. AI tool calls the `sh-plan` MCP tool on the PCP server
3. PCP looks up the `plan` prompt, validates input against `input_schema`
4. PCP expands Jinja2 templates with input variables
5. PCP returns the expanded `system_message` + `user_message` to the AI tool
6. The AI tool's own LLM uses the returned prompt to generate the response

### MCP Integration

PCP exposes an MCP server over Streamable HTTP transport. Every prompt in the registry is automatically exposed as an MCP tool with a `sh-` prefix.

**Dynamically registered tools:**

| MCP Tool | Description |
|----------|-------------|
| `sh-{name}` | Any prompt in the registry becomes `sh-{name}` |
| `sh-list` | List all available prompts |
| `sh-search` | Search prompts by tag or name |

**Key design decisions:**
- **`sh-` prefix** — explicit routing; no ambiguity with local skills
- **Dynamic registration** — new prompt → new MCP tool automatically
- **PCP returns prompts, not LLM responses**
- **Bearer token auth** via MCP connection headers

---

## Data Model

### Tables

**`prompts`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default gen_random_uuid() |
| `name` | VARCHAR(255) | UNIQUE, NOT NULL, CHECK (name ~ '^[a-z0-9-]+$') |
| `description` | TEXT | |
| `is_deprecated` | BOOLEAN | DEFAULT false |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() |

**`prompt_versions`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `prompt_id` | UUID | FK → prompts.id, NOT NULL |
| `version` | VARCHAR(50) | NOT NULL |
| `system_template` | TEXT | |
| `user_template` | TEXT | NOT NULL |
| `input_schema` | JSONB | DEFAULT '{}' |
| `tags` | JSONB | DEFAULT '[]' |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| | | UNIQUE(prompt_id, version) |

---

## Project Structure

```
pcp/
├── src/pcp_server/
│   ├── main.py              # FastAPI app + MCP server entrypoint
│   ├── config.py            # Settings (pydantic-settings)
│   ├── database.py          # SQLAlchemy engine + session
│   ├── models.py            # Prompt + PromptVersion ORM models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── routers/
│   │   └── prompts.py       # Prompt CRUD + expand endpoints
│   ├── mcp/
│   │   ├── server.py        # MCP server setup
│   │   └── tools.py         # Dynamic sh-* tool registration
│   └── services/
│       └── prompt_service.py  # CRUD + Jinja2 expansion
├── alembic/                 # Database migrations
├── charts/pcp/              # Helm chart for Kubernetes
├── prompts/                 # Example prompt library (YAML)
├── tests/
├── scripts/seed.py          # Load example prompts into DB
├── Dockerfile
├── docker-compose.yaml
└── pyproject.toml
```

---

## Future Extensions

- Workflow engine (multi-step prompt pipelines)
- RBAC (admin/editor/viewer roles)
- Audit logging
- CLI tool for admin use
- GUI admin dashboard
- Git-backed prompt sync (GitOps)
- OIDC / SSO integration
