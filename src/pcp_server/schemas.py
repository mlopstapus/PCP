import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PromptVersionCreate(BaseModel):
    version: str = Field(..., examples=["1.0.0"])
    system_template: str | None = None
    user_template: str = Field(..., examples=["Generate a PRD for: {{ feature_description }}"])
    input_schema: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class PromptCreate(BaseModel):
    name: str = Field(..., pattern=r"^[a-z0-9-]+$", examples=["feature-prd"])
    description: str | None = None
    version: PromptVersionCreate


class PromptVersionResponse(BaseModel):
    id: uuid.UUID
    prompt_id: uuid.UUID
    version: str
    system_template: str | None
    user_template: str
    input_schema: dict
    tags: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class PromptResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_deprecated: bool
    created_at: datetime
    updated_at: datetime
    latest_version: PromptVersionResponse | None = None

    model_config = {"from_attributes": True}


class PromptListResponse(BaseModel):
    items: list[PromptResponse]
    total: int
    page: int
    page_size: int


class NewVersionCreate(BaseModel):
    version: str = Field(..., examples=["1.1.0"])
    system_template: str | None = None
    user_template: str
    input_schema: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class ExpandRequest(BaseModel):
    input: dict = Field(default_factory=dict)


class ExpandResponse(BaseModel):
    prompt_name: str
    prompt_version: str
    system_message: str | None
    user_message: str


# --- Project schemas ---

class ProjectCreate(BaseModel):
    name: str = Field(..., examples=["My Project"])
    slug: str = Field(..., pattern=r"^[a-z0-9-]+$", examples=["my-project"])
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int


# --- API Key schemas ---

class ApiKeyCreate(BaseModel):
    name: str = Field(..., examples=["production"])
    scopes: list[str] = Field(default_factory=lambda: ["read", "expand"])
    expires_at: datetime | None = None


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    prefix: str
    scopes: list[str]
    expires_at: datetime | None
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None

    model_config = {"from_attributes": True}


class ApiKeyCreatedResponse(BaseModel):
    key: ApiKeyResponse
    raw_key: str = Field(..., description="Shown once. Store it securely.")


# --- Workflow schemas ---

class WorkflowStep(BaseModel):
    id: str = Field(..., examples=["step-1"])
    prompt_name: str = Field(..., examples=["feature-prd"])
    prompt_version: str | None = None
    input_mapping: dict = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list)
    output_key: str = Field(..., examples=["prd_output"])


class WorkflowCreate(BaseModel):
    project_id: uuid.UUID
    name: str = Field(..., examples=["PRD Pipeline"])
    description: str | None = None
    steps: list[WorkflowStep] = Field(default_factory=list)


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    steps: list[WorkflowStep] | None = None


class WorkflowResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: str | None
    steps: list[WorkflowStep]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowRunRequest(BaseModel):
    input: dict = Field(default_factory=dict)


class WorkflowStepResult(BaseModel):
    step_id: str
    prompt_name: str
    prompt_version: str
    system_message: str | None
    user_message: str
    status: str = "success"
    error: str | None = None


class WorkflowRunResponse(BaseModel):
    workflow_id: uuid.UUID
    workflow_name: str
    steps: list[WorkflowStepResult]
    outputs: dict
