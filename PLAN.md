# PCP Frontend — Implementation Plan

## Overview

Build a modern, dark-mode prompt management platform for PCP. Inspired by Supabase and Langfuse aesthetics — dark backgrounds (#0a0a0a / #111), green accents (#22c55e), clean sans-serif typography, card-based layouts, subtle borders, and smooth transitions.

**Tech stack:** Next.js 14 (App Router), TailwindCSS, shadcn/ui, Lucide icons, TypeScript.
**Location:** `/frontend` directory alongside the existing Python backend.
**API:** Connects to the existing FastAPI backend at `/api/v1/`.

---

## Existing API Surface

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/prompts?page=&page_size=&tag=` | List prompts (paginated, filterable) |
| POST | `/api/v1/prompts` | Create prompt + initial version |
| GET | `/api/v1/prompts/{name}` | Get prompt detail |
| PUT | `/api/v1/prompts/{name}` | Create new version |
| DELETE | `/api/v1/prompts/{name}` | Deprecate prompt |
| GET | `/api/v1/prompts/{name}/versions` | List all versions |
| POST | `/api/v1/expand/{name}` | Expand (test) prompt |
| POST | `/api/v1/expand/{name}/versions/{version}` | Expand specific version |
| GET | `/health` | Health check |

### New API Endpoints Required

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/projects` | Create project |
| GET | `/api/v1/projects` | List projects |
| GET | `/api/v1/projects/{id}` | Get project detail |
| PUT | `/api/v1/projects/{id}` | Update project |
| DELETE | `/api/v1/projects/{id}` | Delete project |
| POST | `/api/v1/projects/{id}/api-keys` | Generate API key for project |
| GET | `/api/v1/projects/{id}/api-keys` | List API keys |
| DELETE | `/api/v1/api-keys/{id}` | Revoke API key |
| POST | `/api/v1/workflows` | Create workflow |
| GET | `/api/v1/workflows` | List workflows |
| GET | `/api/v1/workflows/{id}` | Get workflow detail |
| PUT | `/api/v1/workflows/{id}` | Update workflow |
| DELETE | `/api/v1/workflows/{id}` | Delete workflow |
| POST | `/api/v1/workflows/{id}/run` | Execute workflow |
| POST | `/api/v1/prompts/{name}/rollback/{version}` | Pin/rollback to a specific version |
| GET | `/api/v1/metrics/usage` | Aggregated usage stats (filters: project, prompt, api_key, date range) |
| GET | `/api/v1/metrics/usage/timeseries` | Usage counts over time (hourly/daily buckets) |
| GET | `/api/v1/metrics/usage/top-prompts` | Top N most-invoked prompts |
| GET | `/api/v1/metrics/usage/by-key` | Usage breakdown by API key (who is calling what) |
| GET | `/api/v1/metrics/tokens` | Token consumption summary (filters: project, prompt, model, date range) |
| GET | `/api/v1/metrics/tokens/by-model` | Token usage and cost breakdown by model |
| GET | `/api/v1/metrics/cost` | Cost summary with daily/monthly totals and projections |
| POST | `/api/v1/metrics/report` | Report token usage for an expand call (async callback) |
| GET | `/api/v1/settings/model-pricing` | List model pricing entries |
| PUT | `/api/v1/settings/model-pricing/{model}` | Create or update model pricing |

---

## Data Model Changes

### Project

```
Project
├── id: UUID
├── name: str
├── slug: str (unique)
├── description: str | None
├── created_at: datetime
└── updated_at: datetime

Prompt.project_id → Project.id  (nullable for migration, required going forward)
```

### API Key

```
ApiKey
├── id: UUID
├── project_id → Project.id
├── name: str (e.g. "production", "ci-pipeline")
├── key_hash: str (bcrypt hash, raw key shown once on creation)
├── prefix: str (first 8 chars for identification, e.g. "pcp_a3f1...")
├── scopes: list[str] (e.g. ["read", "expand", "write"])
├── expires_at: datetime | None
├── is_active: bool
├── created_at: datetime
└── last_used_at: datetime | None
```

### Workflow

```
Workflow
├── id: UUID
├── project_id → Project.id
├── name: str
├── description: str | None
├── steps: list[WorkflowStep]  (JSON column)
├── created_at: datetime
└── updated_at: datetime

WorkflowStep
├── id: str (step identifier)
├── prompt_name: str
├── prompt_version: str | None (None = latest)
├── input_mapping: dict (maps step inputs from previous step outputs or static values)
├── depends_on: list[str] (step IDs this step depends on)
└── output_key: str (key name for this step's output in the workflow context)
```

### Prompt Version — Active Pin

```
Prompt (add fields)
├── active_version_id: UUID | None → PromptVersion.id
└── (existing fields)
```

### Usage Event (Metrics)

```
UsageEvent
├── id: UUID
├── project_id → Project.id
├── prompt_name: str
├── prompt_version: str
├── api_key_id: UUID | None → ApiKey.id
├── api_key_name: str | None (denormalized for display)
├── source: str (e.g. "mcp", "api", "playground")
├── status: str ("success", "error")
├── latency_ms: int | None
├── model: str | None (e.g. "gpt-4o", "claude-sonnet-4-20250514", "gemini-2.0-flash")
├── input_tokens: int | None
├── output_tokens: int | None
├── total_tokens: int | None
├── cost_usd: float | None (calculated from model pricing table)
├── error_message: str | None
├── created_at: datetime (indexed, partitioned by month for scale)
└── metadata: dict | None (extra context, e.g. client info)

ModelPricing (reference table for cost calculation)
├── id: UUID
├── model: str (unique, e.g. "gpt-4o")
├── provider: str (e.g. "openai", "anthropic", "google")
├── input_cost_per_1k: float (USD per 1K input tokens)
├── output_cost_per_1k: float (USD per 1K output tokens)
├── is_active: bool
├── created_at: datetime
└── updated_at: datetime
```

Usage events are recorded on every prompt expand call. The expand endpoints
(both REST and MCP) emit a UsageEvent after execution. Events are write-once
and immutable — no updates or deletes.

Token counts and model info are reported by the caller via optional fields in
the expand request or via a separate `POST /api/v1/metrics/report` callback.
Cost is calculated server-side using the ModelPricing table. The pricing table
is seeded with common models and can be updated via the settings UI.

---

## Pages & Components

### Page 1: Project Switcher & Dashboard — `/`

Landing page with project context.

- **Project selector:** Dropdown in navbar to switch between projects (persisted in localStorage)
- **Dashboard cards:** Total prompts, total versions, active workflows, recent activity
- **Quick actions:** "New Prompt", "New Workflow", "Manage Keys"

### Page 2: Prompt List — `/prompts`

All prompts within the selected project.

- **Header/Nav:** PCP logo, project switcher, dark navbar, "New Prompt" button (green accent)
- **Search bar:** Full-text filter by name (client-side over fetched list)
- **Tag filter:** Clickable tag pills to filter by tag (uses `?tag=` query param)
- **Prompt cards/table rows:** Name, description, active version (pinned), latest version, tags, created date, deprecated badge
- **Pagination:** Page controls at bottom
- **Empty state:** Friendly message + CTA to create first prompt

### Page 3: Prompt Detail — `/prompts/[name]`

Deep-dive into a single prompt with all its versions.

- **Header:** Prompt name, description, deprecated badge, "New Version" button, "Deprecate" button
- **Active version indicator:** Green badge showing which version is pinned as active
- **Latest version panel:** System template, user template, input schema, tags — displayed in syntax-highlighted code blocks
- **Version history:** Timeline of all versions with version number, date, and diff indicator
  - **Click a version** to view its full templates
  - **Diff view:** Side-by-side or inline diff between any two versions
  - **Rollback button:** Pin any previous version as the active version
- **Expand/Test panel (Playground):** Interactive form to test the prompt
  - Auto-generates input fields from `input_schema`
  - "Expand" button sends to `/api/v1/expand/{name}`
  - Shows rendered system_message and user_message in a preview pane
  - **Side-by-side comparison:** Test two versions with the same input simultaneously

### Page 4: Create Prompt — `/prompts/new`

Form to create a new prompt with its initial version.

- **Fields:** name (slug validation), description, version (default "1.0.0"), system_template (optional), user_template, tags (multi-input), input_schema (JSON editor)
- **Live preview:** Shows how the template will look
- **Submit** → POST `/api/v1/prompts`
- **Redirect** to detail page on success

### Page 5: New Version — `/prompts/[name]/new-version`

Form to add a new version to an existing prompt.

- **Pre-filled** with the latest version's templates for easy iteration
- **Diff preview:** Shows what changed from the previous version before submitting
- **Fields:** version, system_template, user_template, tags, input_schema
- **Submit** → PUT `/api/v1/prompts/{name}` → redirect to detail

### Page 6: Workflow Builder — `/workflows`

Visual workflow editor for chaining prompts together.

- **Workflow list:** Card grid of existing workflows with name, step count, last run
- **Create/Edit workflow:** `/workflows/new` and `/workflows/[id]`
  - **Canvas:** Visual DAG editor showing prompt steps as connected nodes
  - **Step config panel:** Select prompt, version, define input mapping (reference previous step outputs via `{{ steps.step_id.output }}`)
  - **Validation:** Ensure all required inputs are mapped, no circular dependencies
  - **Test run:** Execute the full workflow with sample inputs, show step-by-step output
- **Step types:**
  - **Prompt step:** Expand a prompt with mapped inputs
  - **Conditional step (future):** Branch based on output content

### Page 7: API Keys — `/settings/api-keys`

Manage API keys for programmatic access.

- **Key list:** Table with name, prefix (`pcp_a3f1...`), scopes, created date, last used, status
- **Create key:** Modal with name, scope checkboxes (read, expand, write, admin), optional expiry
- **Show once:** Display full key in a copy-to-clipboard modal immediately after creation (never shown again)
- **Revoke:** Confirmation dialog → soft-delete (set `is_active = false`)

### Page 8: Metrics Dashboard — `/metrics`

Governance and usage analytics for prompt invocations.

- **Summary cards:** Total invocations (24h / 7d / 30d), unique prompts used, unique API keys active, error rate, total tokens consumed, total cost (USD)
- **Usage over time chart:** Line/area chart showing invocation counts over time (toggle hourly/daily), filterable by prompt and API key
- **Token consumption chart:** Stacked area chart of input vs output tokens over time, broken down by model
- **Cost tracker:** Running cost (daily/weekly/monthly) with bar chart by model, projected monthly spend based on current trend
- **Top prompts table:** Ranked list of most-invoked prompts with count, avg latency, error rate, tokens consumed, cost, sparkline trend
- **Usage by model:** Table showing token consumption and cost per model — see which models are burning budget
- **Usage by API key:** Table showing which keys are calling which prompts, with counts and cost — answers "who is using what and how much does it cost"
- **Recent invocations feed:** Live-scrolling table of recent expand calls with timestamp, prompt, version, model, tokens, cost, source, status, latency
- **Filters:** Date range picker, project scope, prompt name, API key, model, status (success/error)
- **Export:** Download filtered usage data as CSV

### Page 9: Project Settings — `/settings`

Project configuration.

- **General:** Project name, description, slug
- **API Keys:** (links to Page 7)
- **Model Pricing:** Table of models with input/output cost per 1K tokens, add/edit/deactivate models
- **Danger zone:** Delete project (with confirmation, requires typing project name)

---

## Implementation Phases

### Phase 1: Project Scaffold & Layout

1. Initialize Next.js 14 app in `/frontend` with TypeScript, TailwindCSS, App Router
2. Install and configure shadcn/ui (dark theme default)
3. Set up Tailwind config with PCP color palette (dark bg, green-500 accent)
4. Create root layout with dark theme, global styles, Geist font
5. Create shared `Navbar` component (logo, project switcher, nav links, "New Prompt" CTA)
6. Create `Sidebar` component for settings pages
7. Create API client module (`lib/api.ts`) with typed fetch wrappers for all endpoints
8. Add `next.config.js` proxy rewrite from `/api` → `http://localhost:8000/api` for dev
9. Add CORS middleware to FastAPI backend

**Acceptance:** `npm run dev` shows dark-themed shell with navbar. API client types match backend schemas.

### Phase 2: Prompt List & Detail Pages

1. Build prompt list page at `app/prompts/page.tsx`
2. Fetch prompts with `GET /api/v1/prompts`
3. Render as card grid (responsive: 1 col mobile, 2 col md, 3 col lg)
4. Each card: name, description truncated, version badge, tag pills, timestamp
5. Search input with client-side filtering
6. Tag filter bar (extract unique tags from all prompts)
7. Pagination controls
8. Empty state and loading skeleton states
9. Build detail page at `app/prompts/[name]/page.tsx`
10. Version history timeline with clickable entries
11. Deprecate button with confirmation dialog

**Acceptance:** Can browse, search, filter, view detail, and deprecate prompts.

### Phase 3: Prompt Playground & Version Comparison

1. Add collapsible "Playground" panel to the detail page
2. Parse `input_schema` to auto-generate form fields
3. "Expand" button → `POST /api/v1/expand/{name}` with form values
4. Display rendered system_message and user_message in styled output blocks
5. Version selector to test against specific versions
6. Side-by-side comparison mode: pick two versions, same input, compare outputs
7. Inline diff view between any two versions (templates)
8. Error display for template variable errors (422 responses)

**Acceptance:** Can interactively test any prompt/version, compare versions side-by-side, view diffs.

### Phase 4: Create Prompt & New Version Forms

1. Build create prompt page at `app/prompts/new/page.tsx`
2. Form with validation: name (slug pattern `^[a-z0-9-]+$`), description, version, system_template, user_template, tags, input_schema
3. Tag input component (type + enter to add, click to remove)
4. JSON editor for input_schema (textarea with validation)
5. Submit → `POST /api/v1/prompts` → redirect to detail
6. Build new version page at `app/prompts/[name]/new-version/page.tsx`
7. Pre-fill from latest version, show diff preview
8. Submit → `PUT /api/v1/prompts/{name}` → redirect to detail
9. Toast notifications for success/error

**Acceptance:** Can create prompts and versions through the UI. Validation prevents bad input.

### Phase 5: Multi-Project Support (Backend + Frontend)

1. **Backend:** Add `Project` model, Alembic migration, CRUD endpoints
2. **Backend:** Add `project_id` FK to `Prompt` model (nullable for backward compat), migration
3. **Backend:** Scope prompt queries by project (via header `X-Project-Id` or query param)
4. **Frontend:** Project switcher dropdown in navbar (persisted in localStorage)
5. **Frontend:** Project creation page/modal
6. **Frontend:** Dashboard page (`/`) with project-scoped stats
7. **Frontend:** All prompt/workflow fetches include project context
8. **Backend:** Default project auto-created on first run for existing prompts

**Acceptance:** Can create projects, switch between them, prompts are scoped per project.

### Phase 6: API Keys & Authentication

1. **Backend:** Add `ApiKey` model, Alembic migration
2. **Backend:** Key generation endpoint (returns raw key once, stores bcrypt hash)
3. **Backend:** Auth middleware — validate `Authorization: Bearer pcp_...` header against key hash
4. **Backend:** Scope enforcement (read, expand, write, admin)
5. **Backend:** Track `last_used_at` on each authenticated request
6. **Frontend:** API Keys settings page with create/revoke UI
7. **Frontend:** "Show once" modal with copy-to-clipboard for new keys
8. **Frontend:** Session management — frontend uses a session cookie or stored key

**Acceptance:** API endpoints require valid key. Keys can be created, listed, revoked. Scopes enforced.

### Phase 7: Workflow Builder

1. **Backend:** Add `Workflow` model with JSON `steps` column, Alembic migration
2. **Backend:** CRUD endpoints for workflows
3. **Backend:** Workflow execution engine — iterate steps in dependency order, pass outputs forward
4. **Frontend:** Workflow list page at `app/workflows/page.tsx`
5. **Frontend:** Visual workflow editor with node-based canvas (use `reactflow` library)
6. **Frontend:** Step configuration panel — select prompt, map inputs from previous steps
7. **Frontend:** Workflow test runner — execute with sample input, show step-by-step results
8. **Frontend:** Validation — circular dependency detection, missing input mappings

**Acceptance:** Can create, edit, and test multi-step workflows that chain prompts together.

### Phase 8: Version Management Enhancements

1. **Backend:** Add `active_version_id` to Prompt model, migration
2. **Backend:** Rollback/pin endpoint `POST /api/v1/prompts/{name}/rollback/{version}`
3. **Backend:** Expand endpoint respects pinned version when no version specified
4. **Frontend:** Active version badge on detail page
5. **Frontend:** "Pin as active" button on each version in the history timeline
6. **Frontend:** Rollback confirmation dialog

**Acceptance:** Can pin any version as active. Expand uses pinned version by default. Rollback works.

### Phase 9: Metrics & Governance Dashboard

1. **Backend:** Add `UsageEvent` and `ModelPricing` models, Alembic migration (indexed on `created_at`, `prompt_name`, `project_id`, `api_key_id`, `model`)
2. **Backend:** Seed `ModelPricing` with common models (GPT-4o, Claude Sonnet, Gemini Flash, etc.)
3. **Backend:** Emit usage events from expand endpoints (REST + MCP) — async insert so it doesn't slow down responses
4. **Backend:** `POST /metrics/report` callback for callers to report token counts and model after expand
5. **Backend:** Cost calculation service — look up model pricing, compute `cost_usd` from token counts
6. **Backend:** Aggregation query endpoints: `/metrics/usage`, `/metrics/usage/timeseries`, `/metrics/usage/top-prompts`, `/metrics/usage/by-key`, `/metrics/tokens`, `/metrics/tokens/by-model`, `/metrics/cost`
7. **Backend:** Support filters: date range, project, prompt name, API key, model, status
8. **Backend:** Model pricing CRUD endpoints under `/settings/model-pricing`
9. **Frontend:** Metrics page at `app/metrics/page.tsx`
10. **Frontend:** Summary stat cards (invocations, unique prompts, active keys, error rate, total tokens, total cost)
11. **Frontend:** Invocation time-series chart using `recharts` (line/area, hourly/daily toggle)
12. **Frontend:** Token consumption stacked area chart (input vs output, by model)
13. **Frontend:** Cost tracker — bar chart by model, projected monthly spend
14. **Frontend:** Top prompts table with sparkline trends, token + cost columns
15. **Frontend:** Usage-by-model table and usage-by-key table (governance views)
16. **Frontend:** Recent invocations feed with model, tokens, cost columns
17. **Frontend:** Date range picker, prompt/key/model filters, CSV export
18. **Frontend:** Model pricing settings page (add/edit/deactivate models)

**Acceptance:** Dashboard shows real-time usage, token consumption, and cost data. Can filter by date, prompt, key, model. Governance team can see who invoked what, how many tokens consumed, and cost. Cost projections displayed. CSV export works.

### Phase 10: Polish & Production Readiness

1. Update `docker-compose.yaml` with frontend service
2. Add `frontend/Dockerfile` (multi-stage: build + nginx or standalone Next.js)
3. Responsive design pass (mobile-friendly)
4. Loading states, error boundaries, 404 pages
5. Import/export prompts as YAML (download button on detail, upload on create)
6. Audit log UI (who changed what, when — read from backend audit table)
7. README update with frontend dev instructions
8. E2E tests with Playwright for critical flows

**Acceptance:** Full end-to-end workflow works in Docker. Responsive. Production-ready.

---

## Design Tokens

```
Background:     #0a0a0a (page), #111111 (cards), #1a1a1a (elevated)
Border:         #262626 (subtle), #333333 (hover)
Text:           #fafafa (primary), #a1a1aa (secondary), #71717a (muted)
Accent:         #22c55e (green-500), #16a34a (green-600 hover)
Error:          #ef4444
Warning:        #f59e0b
Info:           #3b82f6
Code bg:        #0d0d0d
Font:           Geist Sans (body), Geist Mono (code)
Border radius:  0.5rem (cards), 0.375rem (buttons/inputs)
```

---

## Out of Scope (Future)

- Real-time collaboration (multiplayer editing)
- Prompt marketplace / public sharing
- LLM-powered prompt suggestions / auto-improvement
- Conditional/branching logic in workflows (v2)
- Environment support (dev/staging/prod version pinning per env)
- Webhook/notification support (Slack, email on prompt changes)
- SSO / OAuth integration
