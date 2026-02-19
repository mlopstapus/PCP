import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.pcp_server.database import get_db
from src.pcp_server.schemas import (
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyResponse,
)
from src.pcp_server.services import apikey_service

router = APIRouter(tags=["api-keys"])


@router.post(
    "/api/v1/projects/{project_id}/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=201,
)
async def create_api_key(
    project_id: uuid.UUID,
    data: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
):
    key, raw_key = await apikey_service.create_api_key(
        db,
        project_id=project_id,
        name=data.name,
        scopes=data.scopes,
        expires_at=data.expires_at,
    )
    return ApiKeyCreatedResponse(
        key=ApiKeyResponse.model_validate(key),
        raw_key=raw_key,
    )


@router.get(
    "/api/v1/projects/{project_id}/api-keys",
    response_model=list[ApiKeyResponse],
)
async def list_api_keys(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    keys = await apikey_service.list_api_keys(db, project_id)
    return [ApiKeyResponse.model_validate(k) for k in keys]


@router.delete("/api/v1/api-keys/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    revoked = await apikey_service.revoke_api_key(db, key_id)
    if not revoked:
        raise HTTPException(status_code=404, detail="API key not found")
