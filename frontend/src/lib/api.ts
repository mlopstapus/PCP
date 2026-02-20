const API_BASE = "/api/v1";
const TOKEN_KEY = "pcp-auth-token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function fetchAPI<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getStoredToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
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

// =====================================================================
// Auth types & endpoints
// =====================================================================

export interface AuthUser {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  role: string;
  team_id: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface Invitation_t {
  id: string;
  email: string;
  team_id: string;
  role: string;
  token: string;
  invited_by_id: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export async function getOrgStatus(): Promise<{ has_org: boolean }> {
  return fetchAPI<{ has_org: boolean }>("/auth/status");
}

export async function register(data: {
  org_name: string;
  org_slug: string;
  email: string;
  username: string;
  password: string;
  display_name?: string;
}): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMe(): Promise<AuthUser> {
  return fetchAPI<AuthUser>("/auth/me");
}

export async function createInvitation(data: {
  email: string;
  team_id: string;
  role?: string;
}): Promise<Invitation_t> {
  return fetchAPI<Invitation_t>("/auth/invitations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listInvitations(): Promise<Invitation_t[]> {
  return fetchAPI<Invitation_t[]>("/auth/invitations");
}

export async function revokeInvitation(id: string): Promise<void> {
  await fetchAPI(`/auth/invitations/${id}`, { method: "DELETE" });
}

export async function getInvitationInfo(
  token: string
): Promise<{ email: string; team_id: string; role: string }> {
  return fetchAPI<{ email: string; team_id: string; role: string }>(
    `/auth/invitations/token/${token}`
  );
}

export async function acceptInvitation(
  token: string,
  data: { username: string; password: string; display_name?: string }
): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>(`/auth/invitations/${token}/accept`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// =====================================================================
// Team types & endpoints
// =====================================================================

export interface Team_t {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string | null;
  parent_team_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamListResponse {
  items: Team_t[];
  total: number;
}

export async function listTeams(parentTeamId?: string): Promise<TeamListResponse> {
  const params = new URLSearchParams();
  if (parentTeamId) params.set("parent_team_id", parentTeamId);
  const qs = params.toString();
  return fetchAPI<TeamListResponse>(`/teams${qs ? `?${qs}` : ""}`);
}

export async function getTeam(id: string): Promise<Team_t> {
  return fetchAPI<Team_t>(`/teams/${id}`);
}

export async function createTeam(data: {
  name: string;
  slug: string;
  description?: string;
  parent_team_id?: string;
}): Promise<Team_t> {
  return fetchAPI<Team_t>("/teams", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function insertTeamBetween(
  childTeamId: string,
  data: { name: string; slug: string; description?: string }
): Promise<Team_t> {
  return fetchAPI<Team_t>(`/teams/insert-between/${childTeamId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTeam(
  id: string,
  data: { name?: string; description?: string; owner_id?: string }
): Promise<Team_t> {
  return fetchAPI<Team_t>(`/teams/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTeam(id: string): Promise<void> {
  await fetchAPI(`/teams/${id}`, { method: "DELETE" });
}

// =====================================================================
// User types & endpoints
// =====================================================================

export interface User_t {
  id: string;
  team_id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  items: User_t[];
  total: number;
}

export async function listUsers(teamId?: string): Promise<UserListResponse> {
  const params = new URLSearchParams();
  if (teamId) params.set("team_id", teamId);
  const qs = params.toString();
  return fetchAPI<UserListResponse>(`/users${qs ? `?${qs}` : ""}`);
}

export async function getUser(id: string): Promise<User_t> {
  return fetchAPI<User_t>(`/users/${id}`);
}

export async function createUser(data: {
  username: string;
  display_name?: string;
  email?: string;
  team_id: string;
}): Promise<User_t> {
  return fetchAPI<User_t>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateUser(
  id: string,
  data: { display_name?: string; email?: string; is_active?: boolean }
): Promise<User_t> {
  return fetchAPI<User_t>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteUser(id: string): Promise<void> {
  await fetchAPI(`/users/${id}`, { method: "DELETE" });
}

// =====================================================================
// Policy types & endpoints
// =====================================================================

export type EnforcementType = "prepend" | "append" | "inject" | "validate";

export interface Policy_t {
  id: string;
  team_id: string | null;
  project_id: string | null;
  name: string;
  description: string | null;
  enforcement_type: EnforcementType;
  content: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  is_inherited: boolean;
}

export interface EffectivePoliciesResponse {
  inherited: Policy_t[];
  local: Policy_t[];
}

export async function createPolicy(data: {
  team_id?: string;
  project_id?: string;
  name: string;
  description?: string;
  enforcement_type: EnforcementType;
  content: string;
  priority?: number;
}): Promise<Policy_t> {
  return fetchAPI<Policy_t>("/policies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPolicy(id: string): Promise<Policy_t> {
  return fetchAPI<Policy_t>(`/policies/${id}`);
}

export async function updatePolicy(
  id: string,
  data: {
    name?: string;
    description?: string;
    enforcement_type?: EnforcementType;
    content?: string;
    priority?: number;
    is_active?: boolean;
  }
): Promise<Policy_t> {
  return fetchAPI<Policy_t>(`/policies/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePolicy(id: string): Promise<void> {
  await fetchAPI(`/policies/${id}`, { method: "DELETE" });
}

export async function getEffectivePolicies(
  userId: string,
  projectId?: string
): Promise<EffectivePoliciesResponse> {
  const params = new URLSearchParams({ user_id: userId });
  if (projectId) params.set("project_id", projectId);
  return fetchAPI<EffectivePoliciesResponse>(`/policies/effective?${params}`);
}

export async function getTeamEffectivePolicies(
  teamId: string
): Promise<EffectivePoliciesResponse> {
  const params = new URLSearchParams({ team_id: teamId });
  return fetchAPI<EffectivePoliciesResponse>(`/policies/effective?${params}`);
}

// =====================================================================
// Objective types & endpoints
// =====================================================================

export interface Objective_t {
  id: string;
  team_id: string | null;
  project_id: string | null;
  user_id: string | null;
  title: string;
  description: string | null;
  parent_objective_id: string | null;
  is_inherited: boolean;
  status: string;
  created_at: string;
}

export interface EffectiveObjectivesResponse {
  inherited: Objective_t[];
  local: Objective_t[];
}

export async function createObjective(data: {
  team_id?: string;
  project_id?: string;
  user_id?: string;
  title: string;
  description?: string;
  parent_objective_id?: string;
}): Promise<Objective_t> {
  return fetchAPI<Objective_t>("/objectives", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getObjective(id: string): Promise<Objective_t> {
  return fetchAPI<Objective_t>(`/objectives/${id}`);
}

export async function updateObjective(
  id: string,
  data: { title?: string; description?: string; status?: string }
): Promise<Objective_t> {
  return fetchAPI<Objective_t>(`/objectives/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteObjective(id: string): Promise<void> {
  await fetchAPI(`/objectives/${id}`, { method: "DELETE" });
}

export async function getEffectiveObjectives(
  userId: string,
  projectId?: string
): Promise<EffectiveObjectivesResponse> {
  const params = new URLSearchParams({ user_id: userId });
  if (projectId) params.set("project_id", projectId);
  return fetchAPI<EffectiveObjectivesResponse>(`/objectives/effective?${params}`);
}

export async function getTeamEffectiveObjectives(
  teamId: string
): Promise<EffectiveObjectivesResponse> {
  const params = new URLSearchParams({ team_id: teamId });
  return fetchAPI<EffectiveObjectivesResponse>(`/objectives/effective?${params}`);
}

// =====================================================================
// Prompt types & endpoints
// =====================================================================

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
  user_id: string | null;
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
  applied_policies: string[];
  objectives: string[];
}

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
  user_id?: string;
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
  version?: string,
  projectId?: string
): Promise<ExpandResponse> {
  const path = version
    ? `/expand/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`
    : `/expand/${encodeURIComponent(name)}`;
  const body: Record<string, unknown> = { input };
  if (projectId) body.project_id = projectId;
  return fetchAPI<ExpandResponse>(path, {
    method: "POST",
    body: JSON.stringify(body),
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

// =====================================================================
// Project types & endpoints (team-owned, with lead & members)
// =====================================================================

export interface Project_t {
  id: string;
  team_id: string;
  lead_user_id: string | null;
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

export interface ProjectMember_t {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export async function listProjects(teamId?: string): Promise<ProjectListResponse> {
  const params = new URLSearchParams();
  if (teamId) params.set("team_id", teamId);
  const qs = params.toString();
  return fetchAPI<ProjectListResponse>(`/projects${qs ? `?${qs}` : ""}`);
}

export async function getProject(id: string): Promise<Project_t> {
  return fetchAPI<Project_t>(`/projects/${id}`);
}

export async function createProject(data: {
  team_id: string;
  name: string;
  slug: string;
  description?: string;
  lead_user_id?: string;
}): Promise<Project_t> {
  return fetchAPI<Project_t>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(
  id: string,
  data: { name?: string; description?: string; lead_user_id?: string }
): Promise<Project_t> {
  return fetchAPI<Project_t>(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await fetchAPI(`/projects/${id}`, { method: "DELETE" });
}

export async function addProjectMember(
  projectId: string,
  data: { user_id: string; role?: string }
): Promise<ProjectMember_t> {
  return fetchAPI<ProjectMember_t>(`/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listProjectMembers(
  projectId: string
): Promise<ProjectMember_t[]> {
  return fetchAPI<ProjectMember_t[]>(`/projects/${projectId}/members`);
}

export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<void> {
  await fetchAPI(`/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  });
}

// =====================================================================
// API Key types & endpoints (user-scoped)
// =====================================================================

export interface ApiKey_t {
  id: string;
  user_id: string;
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

export async function listApiKeys(userId: string): Promise<ApiKey_t[]> {
  return fetchAPI<ApiKey_t[]>(`/users/${userId}/api-keys`);
}

export async function createApiKey(
  userId: string,
  data: { name: string; scopes?: string[] }
): Promise<ApiKeyCreatedResponse> {
  return fetchAPI<ApiKeyCreatedResponse>(`/users/${userId}/api-keys`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await fetchAPI(`/api-keys/${keyId}`, { method: "DELETE" });
}

// =====================================================================
// Workflow types & endpoints (user-scoped, optionally project-associated)
// =====================================================================

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
  user_id: string;
  project_id: string | null;
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

export async function listWorkflows(
  userId?: string,
  projectId?: string
): Promise<Workflow_t[]> {
  const params = new URLSearchParams();
  if (userId) params.set("user_id", userId);
  if (projectId) params.set("project_id", projectId);
  const qs = params.toString();
  return fetchAPI<Workflow_t[]>(`/workflows${qs ? `?${qs}` : ""}`);
}

export async function getWorkflow(id: string): Promise<Workflow_t> {
  return fetchAPI<Workflow_t>(`/workflows/${id}`);
}

export async function createWorkflow(data: {
  user_id: string;
  project_id?: string;
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

// =====================================================================
// Metrics types & endpoints
// =====================================================================

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

// =====================================================================
// Health
// =====================================================================

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch("/health");
  return res.json();
}
