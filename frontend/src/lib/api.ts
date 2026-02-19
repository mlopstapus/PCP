const API_BASE = "/api/v1";

async function fetchAPI<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new APIError(res.status, body);
  }

  return res.json();
}

export class APIError extends Error {
  constructor(public status: number, public body: string) {
    super(`API error ${status}: ${body}`);
    this.name = "APIError";
  }
}

// --- Types ---

export interface PromptVersion {
  id: string;
  version: string;
  system_template: string | null;
  user_template: string;
  input_schema: Record<string, unknown> | null;
  tags: string[];
  created_at: string;
}

export interface Prompt {
  id: string;
  name: string;
  description: string | null;
  is_deprecated: boolean;
  created_at: string;
  updated_at: string;
  latest_version: PromptVersion | null;
}

export interface PromptListResponse {
  items: Prompt[];
  total: number;
  page: number;
  page_size: number;
}

export interface ExpandResponse {
  prompt_name: string;
  prompt_version: string;
  system_message: string | null;
  user_message: string;
}

// --- Prompt endpoints ---

export async function listPrompts(
  page = 1,
  pageSize = 20,
  tag?: string
): Promise<PromptListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (tag) params.set("tag", tag);
  return fetchAPI<PromptListResponse>(`/prompts?${params}`);
}

export async function getPrompt(name: string): Promise<Prompt> {
  return fetchAPI<Prompt>(`/prompts/${encodeURIComponent(name)}`);
}

export async function createPrompt(data: {
  name: string;
  description?: string;
  version: {
    version: string;
    system_template?: string;
    user_template: string;
    input_schema?: Record<string, unknown>;
    tags?: string[];
  };
}): Promise<Prompt> {
  return fetchAPI<Prompt>("/prompts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createVersion(
  name: string,
  data: {
    version: string;
    system_template?: string;
    user_template: string;
    input_schema?: Record<string, unknown>;
    tags?: string[];
  }
): Promise<PromptVersion> {
  return fetchAPI<PromptVersion>(`/prompts/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deprecatePrompt(name: string): Promise<void> {
  await fetchAPI(`/prompts/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function getVersions(name: string): Promise<PromptVersion[]> {
  return fetchAPI<PromptVersion[]>(
    `/prompts/${encodeURIComponent(name)}/versions`
  );
}

export async function expandPrompt(
  name: string,
  input: Record<string, unknown>,
  version?: string
): Promise<ExpandResponse> {
  const path = version
    ? `/expand/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`
    : `/expand/${encodeURIComponent(name)}`;
  return fetchAPI<ExpandResponse>(path, {
    method: "POST",
    body: JSON.stringify({ input }),
  });
}

export async function pinVersion(
  name: string,
  version: string
): Promise<Prompt> {
  return fetchAPI<Prompt>(
    `/prompts/${encodeURIComponent(name)}/rollback/${encodeURIComponent(version)}`,
    { method: "POST" }
  );
}

// --- Project types ---

export interface Project_t {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  items: Project_t[];
  total: number;
}

// --- Project endpoints ---

export async function listProjects(): Promise<ProjectListResponse> {
  return fetchAPI<ProjectListResponse>("/projects");
}

export async function getProject(id: string): Promise<Project_t> {
  return fetchAPI<Project_t>(`/projects/${id}`);
}

export async function createProject(data: {
  name: string;
  slug: string;
  description?: string;
}): Promise<Project_t> {
  return fetchAPI<Project_t>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(
  id: string,
  data: { name?: string; description?: string }
): Promise<Project_t> {
  return fetchAPI<Project_t>(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await fetchAPI(`/projects/${id}`, { method: "DELETE" });
}

// --- API Key types ---

export interface ApiKey_t {
  id: string;
  project_id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface ApiKeyCreatedResponse {
  key: ApiKey_t;
  raw_key: string;
}

// --- API Key endpoints ---

export async function listApiKeys(projectId: string): Promise<ApiKey_t[]> {
  return fetchAPI<ApiKey_t[]>(`/projects/${projectId}/api-keys`);
}

export async function createApiKey(
  projectId: string,
  data: { name: string; scopes?: string[] }
): Promise<ApiKeyCreatedResponse> {
  return fetchAPI<ApiKeyCreatedResponse>(`/projects/${projectId}/api-keys`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await fetchAPI(`/api-keys/${keyId}`, { method: "DELETE" });
}

// --- Workflow types ---

export interface WorkflowStep_t {
  id: string;
  prompt_name: string;
  prompt_version: string | null;
  input_mapping: Record<string, string>;
  depends_on: string[];
  output_key: string;
}

export interface Workflow_t {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  steps: WorkflowStep_t[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepResult {
  step_id: string;
  prompt_name: string;
  prompt_version: string;
  system_message: string | null;
  user_message: string;
  status: string;
  error: string | null;
}

export interface WorkflowRunResponse {
  workflow_id: string;
  workflow_name: string;
  steps: WorkflowStepResult[];
  outputs: Record<string, string>;
}

export async function listWorkflows(projectId: string): Promise<Workflow_t[]> {
  return fetchAPI<Workflow_t[]>(`/projects/${projectId}/workflows`);
}

export async function getWorkflow(id: string): Promise<Workflow_t> {
  return fetchAPI<Workflow_t>(`/workflows/${id}`);
}

export async function createWorkflow(data: {
  project_id: string;
  name: string;
  description?: string;
  steps: WorkflowStep_t[];
}): Promise<Workflow_t> {
  return fetchAPI<Workflow_t>("/workflows", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateWorkflow(
  id: string,
  data: { name?: string; description?: string; steps?: WorkflowStep_t[] }
): Promise<Workflow_t> {
  return fetchAPI<Workflow_t>(`/workflows/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteWorkflow(id: string): Promise<void> {
  await fetchAPI(`/workflows/${id}`, { method: "DELETE" });
}

export async function runWorkflow(
  id: string,
  input: Record<string, string>
): Promise<WorkflowRunResponse> {
  return fetchAPI<WorkflowRunResponse>(`/workflows/${id}/run`, {
    method: "POST",
    body: JSON.stringify({ input }),
  });
}

// --- Metrics types ---

export interface TopPrompt {
  name: string;
  count: number;
  avg_latency_ms: number;
}

export interface DailyUsage {
  date: string;
  count: number;
}

export interface DashboardStats {
  total_prompts: number;
  total_versions: number;
  total_expands: number;
  expands_24h: number;
  avg_latency_ms: number;
  error_rate_pct: number;
  top_prompts: TopPrompt[];
  daily_usage: DailyUsage[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchAPI<DashboardStats>("/metrics/dashboard");
}

// --- Health ---

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch("/health");
  return res.json();
}
