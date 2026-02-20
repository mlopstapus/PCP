# PCP Architecture

**Prompt Control Plane — An Open-Source, Self-Hosted Prompt Registry with Hierarchical Governance, Distributed via MCP**

---

## Overview

PCP is an infrastructure layer for managing, versioning, and distributing LLM prompts across any AI-powered IDE or tool. It solves the fragmentation problem where prompts are siloed inside individual tools (Windsurf, Claude Code, Copilot) with no portability, versioning, or observability.

The primary distribution mechanism is **MCP (Model Context Protocol)** — PCP exposes an MCP server that Claude, Windsurf, GitHub Copilot, and any MCP-compatible client can connect to natively. Developers don't need a separate CLI or plugin; their existing AI tools connect directly to the company's PCP instance over the corporate network.

PCP does **not** call LLMs — it serves expanded prompts to the IDE, and the IDE's own LLM does the work.

PCP includes a **hierarchical governance model** based on recursive teams, enabling organizations to define cascading policies and objectives that are automatically enforced during prompt expansion.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **MCP Server** | `mcp` Python SDK (Anthropic) | Native integration with Claude, Windsurf, Copilot; Streamable HTTP transport for remote access |
| **API Server** | Python 3.12+, FastAPI | Async-first, excellent OpenAPI docs, Pydantic validation |
| **ORM / DB** | SQLAlchemy 2.0 (async) + Alembic | Mature, async support, migration management |
| **Database** | PostgreSQL 16 | JSONB for schemas, robust, StatefulSet-friendly |
| **Template Engine** | Jinja2 (sandboxed) | Industry standard, already a FastAPI dependency |
| **Auth** | Bearer token (API key, user-scoped) | Simple, stateless |
| **Frontend** | Next.js 14, TailwindCSS, shadcn/ui | Modern React with server components, dark-mode UI |
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
              |  | REST API (FastAPI)| |
              |  +------------------+  |
              |  | Policy Engine    |  |  <-- enforces policies on expand
              |  +------------------+  |
              +-----------+------------+
                          |
                          v
               +------------------+
               |   Postgres DB    |
               | - Teams / Users  |
               | - Policies       |
               | - Objectives     |
               | - Projects       |
               | - Prompts        |
               | - Versions       |
               | - API Keys       |
               | - Workflows      |
               +------------------+
```

---

## Core Concepts

### Hierarchical Governance

PCP organizes entities in a recursive team hierarchy:

```
Team (root)
├── Team (child)
│   ├── Team (grandchild)
│   │   └── Users
│   └── Users
└── Users
```

- **Teams** are recursive — a team can have a parent team, forming a tree
- **Users** belong to exactly one team
- **Policies** and **Objectives** are attached to teams, projects, or users
- **Projects** are owned by teams, with a designated lead and cross-team members

### Two-Layer Inheritance Model

Both policies and objectives follow a two-layer model:

- **Inherited (immutable)**: All policies/objectives from parent teams in the chain, coalesced into one read-only set. Users cannot modify these.
- **Local (mutable)**: Policies/objectives from the user's own team, plus personal objectives. Users can add to these.

When a project is specified, its independent policies/objectives are layered into the local set.

### Policy Enforcement Types

Policies are enforced during prompt expansion:

| Type | Behavior |
|------|----------|
| `prepend` | Content is prepended to the system message |
| `append` | Content is appended to the user message |
| `inject` | Content is injected as a `{{ policies }}` template variable |
| `validate` | Post-render validation (future) |

### Prompt

A versioned template with:
- **name** — unique identifier, kebab-case (e.g., `feature-prd`)
- **description** — human-readable purpose
- **system_template** — Jinja2 template for system message
- **user_template** — Jinja2 template for user message
- **input_schema** — JSON Schema defining required variables
- **version** — semver string (e.g., `1.0.0`)
- **tags** — list of strings for categorization
- **user_id** — optional owner (user-scoped)

### Execution Model

PCP is a **prompt source**, not an LLM proxy. It never calls an LLM.

1. Developer invokes `sh-plan "build a feature store"` in their AI tool
2. AI tool calls the `sh-plan` MCP tool on the PCP server
3. PCP looks up the `plan` prompt, resolves the user's effective policies and objectives
4. PCP applies policy enforcement (prepend/append/inject) to the templates
5. PCP expands Jinja2 templates with input variables + policy/objective context
6. PCP returns the expanded `system_message` + `user_message` + applied policies + objectives
7. The AI tool's own LLM uses the returned prompt to generate the response

### MCP Integration

PCP exposes an MCP server over Streamable HTTP transport. Every prompt in the registry is automatically exposed as an MCP tool with an `sh-` prefix.

**Dynamically registered tools:**

| MCP Tool | Description |
|----------|-------------|
| `sh-{name}` | Any prompt in the registry becomes `sh-{name}` |
| `sh-list` | List all available prompts |
| `sh-search` | Search prompts by tag or name |
| `sh-context` | Show effective policies and objectives for a user |

**Key design decisions:**
- **`sh-` prefix** — explicit routing; no ambiguity with local skills
- **Dynamic registration** — new prompt → new MCP tool automatically
- **Optional `project` parameter** — each tool accepts an optional project UUID to layer project context
- **PCP returns prompts, not LLM responses**
- **Bearer token auth** via user-scoped API keys

---

## Data Model

### Tables

**`teams`** — Recursive team hierarchy

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | VARCHAR(255) | NOT NULL |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL |
| `description` | TEXT | |
| `owner_id` | UUID | FK → users.id (nullable) |
| `parent_team_id` | UUID | FK → teams.id (nullable, self-referential) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**`users`** — Users belong to one team

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `team_id` | UUID | FK → teams.id, NOT NULL |
| `username` | VARCHAR(255) | UNIQUE, NOT NULL |
| `display_name` | VARCHAR(255) | |
| `email` | VARCHAR(255) | |
| `is_active` | BOOLEAN | DEFAULT true |

**`policies`** — Attached to teams or projects

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `team_id` | UUID | FK → teams.id (nullable) |
| `project_id` | UUID | FK → projects.id (nullable) |
| `name` | VARCHAR(255) | NOT NULL |
| `enforcement_type` | VARCHAR(50) | prepend / append / inject / validate |
| `content` | TEXT | NOT NULL |
| `priority` | INTEGER | DEFAULT 0 |
| `is_active` | BOOLEAN | DEFAULT true |

**`objectives`** — Attached to teams, projects, or users

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `team_id` | UUID | FK → teams.id (nullable) |
| `project_id` | UUID | FK → projects.id (nullable) |
| `user_id` | UUID | FK → users.id (nullable) |
| `title` | VARCHAR(500) | NOT NULL |
| `parent_objective_id` | UUID | FK → objectives.id (nullable) |
| `is_inherited` | BOOLEAN | DEFAULT false |
| `status` | VARCHAR(50) | DEFAULT 'active' |

**`projects`** — Team-owned with lead and cross-team members

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `team_id` | UUID | FK → teams.id, NOT NULL |
| `lead_user_id` | UUID | FK → users.id (nullable) |
| `name` | VARCHAR(255) | NOT NULL |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL |

**`project_members`** — Cross-team membership

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `project_id` | UUID | FK → projects.id, NOT NULL |
| `user_id` | UUID | FK → users.id, NOT NULL |
| `role` | VARCHAR(100) | DEFAULT 'member' |
| | | UNIQUE(project_id, user_id) |

**`prompts`** — User-scoped prompt definitions

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | VARCHAR(255) | UNIQUE, NOT NULL |
| `description` | TEXT | |
| `user_id` | UUID | FK → users.id (nullable) |
| `is_deprecated` | BOOLEAN | DEFAULT false |
| `active_version_id` | UUID | FK → prompt_versions.id (nullable) |

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
| | | UNIQUE(prompt_id, version) |

**`api_keys`** — User-scoped API keys

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users.id, NOT NULL |
| `name` | VARCHAR(255) | NOT NULL |
| `key_hash` | VARCHAR(255) | UNIQUE, NOT NULL |
| `prefix` | VARCHAR(12) | NOT NULL |
| `scopes` | JSONB | DEFAULT '["read","expand"]' |

**`workflows`** — User-scoped, optionally project-associated

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users.id, NOT NULL |
| `project_id` | UUID | FK → projects.id (nullable) |
| `name` | VARCHAR(255) | NOT NULL |
| `steps` | JSONB | NOT NULL |

---

## Project Structure

```
pcp/
├── src/pcp_server/
│   ├── main.py                # FastAPI app + MCP server entrypoint
│   ├── config.py              # Settings (pydantic-settings)
│   ├── database.py            # SQLAlchemy engine + session
│   ├── models.py              # All ORM models (Team, User, Policy, etc.)
│   ├── schemas.py             # Pydantic request/response schemas
│   ├── routers/
│   │   ├── teams.py           # Team CRUD
│   │   ├── users.py           # User CRUD
│   │   ├── policies.py        # Policy CRUD + effective resolution
│   │   ├── objectives.py      # Objective CRUD + effective resolution
│   │   ├── projects.py        # Project CRUD + member management
│   │   ├── prompts.py         # Prompt CRUD + expand endpoints
│   │   ├── workflows.py       # Workflow CRUD + run
│   │   ├── apikeys.py         # User-scoped API key management
│   │   └── metrics.py         # Usage analytics
│   ├── mcp/
│   │   ├── server.py          # MCP server setup
│   │   └── tools.py           # Dynamic sh-* tool registration + sh-context
│   └── services/
│       ├── team_service.py    # Team CRUD + chain walking
│       ├── user_service.py    # User CRUD
│       ├── policy_service.py  # Policy CRUD + two-layer resolution
│       ├── objective_service.py # Objective CRUD + two-layer resolution
│       ├── project_service.py # Project CRUD + member management
│       ├── prompt_service.py  # Prompt CRUD + policy-enforced expansion
│       ├── workflow_service.py # Workflow CRUD + execution
│       ├── apikey_service.py  # API key generation + validation
│       └── metrics_service.py # Usage tracking
├── frontend/                  # Next.js 14 admin dashboard
│   └── src/
│       ├── app/               # Pages: dashboard, teams, prompts, workflows, settings, metrics
│       ├── components/        # Navbar, project-switcher, playground, UI primitives
│       └── lib/api.ts         # Typed API client
├── alembic/                   # Database migrations
├── charts/pcp/                # Helm chart for Kubernetes
├── tests/                     # pytest test suite
├── Dockerfile
├── docker-compose.yaml
└── pyproject.toml
```

---

## Future Extensions

- RBAC (admin/editor/viewer roles per team)
- Audit logging
- CLI tool for admin use
- Git-backed prompt sync (GitOps)
- OIDC / SSO integration
- Policy `validate` enforcement type (post-render checks)
- Objective tracking and completion metrics
