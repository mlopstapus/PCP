import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.pcp_server.database import get_db
from src.pcp_server.schemas import (
    WorkflowCreate,
    WorkflowResponse,
    WorkflowRunRequest,
    WorkflowRunResponse,
    WorkflowUpdate,
)
from src.pcp_server.services import workflow_service

router = APIRouter(prefix="/api/v1", tags=["workflows"])


@router.post("/workflows", response_model=WorkflowResponse, status_code=201)
async def create_workflow(data: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    return await workflow_service.create_workflow(db, data)


@router.get("/projects/{project_id}/workflows", response_model=list[WorkflowResponse])
async def list_workflows(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await workflow_service.list_workflows(db, project_id)


@router.get("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await workflow_service.get_workflow(db, workflow_id)
    if not result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return result


@router.put("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: uuid.UUID, data: WorkflowUpdate, db: AsyncSession = Depends(get_db)
):
    result = await workflow_service.update_workflow(db, workflow_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return result


@router.delete("/workflows/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    deleted = await workflow_service.delete_workflow(db, workflow_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow not found")


@router.post("/workflows/{workflow_id}/run", response_model=WorkflowRunResponse)
async def run_workflow(
    workflow_id: uuid.UUID, data: WorkflowRunRequest, db: AsyncSession = Depends(get_db)
):
    try:
        result = await workflow_service.run_workflow(db, workflow_id, data.input)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return result
