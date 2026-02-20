import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.pcp_server.auth import require_admin
from src.pcp_server.database import get_db
from src.pcp_server.models import User
from src.pcp_server.schemas import (
    TeamCreate,
    TeamListResponse,
    TeamResponse,
    TeamUpdate,
)
from src.pcp_server.services import team_service

router = APIRouter(prefix="/api/v1/teams", tags=["teams"])


@router.post("", response_model=TeamResponse, status_code=201)
async def create_team(
    data: TeamCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await team_service.create_team(db, data)
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail=f"Team slug '{data.slug}' already exists")
        raise


@router.get("", response_model=TeamListResponse)
async def list_teams(
    parent_team_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await team_service.list_teams(db, parent_team_id=parent_team_id)


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(team_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await team_service.get_team(db, team_id)
    if not result:
        raise HTTPException(status_code=404, detail="Team not found")
    return result


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: uuid.UUID,
    data: TeamUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await team_service.update_team(db, team_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Team not found")
    return result


@router.post("/insert-between/{child_team_id}", response_model=TeamResponse, status_code=201)
async def insert_team_between(
    child_team_id: uuid.UUID,
    data: TeamCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new team between a child and its current parent. The child is reparented under the new team."""
    try:
        return await team_service.insert_team_between(db, data, child_team_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail=f"Team slug '{data.slug}' already exists")
        raise


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    deleted = await team_service.delete_team(db, team_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Team not found")
