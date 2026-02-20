import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.pcp_server.auth import require_admin
from src.pcp_server.database import get_db
from src.pcp_server.models import User
from src.pcp_server.schemas import (
    EffectivePoliciesResponse,
    PolicyCreate,
    PolicyResponse,
    PolicyUpdate,
)
from src.pcp_server.services import policy_service
from src.pcp_server.services.team_service import get_team_chain

router = APIRouter(prefix="/api/v1/policies", tags=["policies"])


@router.post("", response_model=PolicyResponse, status_code=201)
async def create_policy(
    data: PolicyCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await policy_service.create_policy(db, data)


@router.get("/effective", response_model=EffectivePoliciesResponse)
async def get_effective_policies(
    user_id: uuid.UUID | None = Query(None),
    team_id: uuid.UUID | None = Query(None),
    project_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    if team_id:
        return await resolve_team_effective_policies(db, team_id)
    if user_id:
        return await policy_service.resolve_effective(db, user_id, project_id)
    raise HTTPException(status_code=400, detail="Provide user_id or team_id")


async def resolve_team_effective_policies(
    db: AsyncSession, team_id: uuid.UUID
) -> EffectivePoliciesResponse:
    from src.pcp_server.models import Policy, Team
    from sqlalchemy import select
    chain = await get_team_chain(db, team_id)
    inherited: list[PolicyResponse] = []
    local: list[PolicyResponse] = []
    for i, team in enumerate(chain):
        result = await db.execute(
            select(Policy)
            .where(Policy.team_id == team.id, Policy.is_active.is_(True))
            .order_by(Policy.priority.desc())
        )
        for p in result.scalars().all():
            pr = PolicyResponse.model_validate(p)
            if i == 0:
                pr.is_inherited = False
                local.append(pr)
            else:
                pr.is_inherited = True
                inherited.append(pr)
    inherited.sort(key=lambda p: p.priority, reverse=True)
    local.sort(key=lambda p: p.priority, reverse=True)
    return EffectivePoliciesResponse(inherited=inherited, local=local)


@router.get("/{policy_id}", response_model=PolicyResponse)
async def get_policy(policy_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await policy_service.get_policy(db, policy_id)
    if not result:
        raise HTTPException(status_code=404, detail="Policy not found")
    return result


@router.put("/{policy_id}", response_model=PolicyResponse)
async def update_policy(
    policy_id: uuid.UUID,
    data: PolicyUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await policy_service.update_policy(db, policy_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Policy not found")
    return result


@router.delete("/{policy_id}", status_code=204)
async def delete_policy(
    policy_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    deleted = await policy_service.delete_policy(db, policy_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Policy not found")
