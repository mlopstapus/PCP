import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.pcp_server.models import Project
from src.pcp_server.schemas import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)


async def create_project(db: AsyncSession, data: ProjectCreate) -> ProjectResponse:
    project = Project(name=data.name, slug=data.slug, description=data.description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


async def list_projects(db: AsyncSession) -> ProjectListResponse:
    count_result = await db.execute(select(func.count()).select_from(Project))
    total = count_result.scalar_one()

    result = await db.execute(select(Project).order_by(Project.name))
    projects = result.scalars().all()

    return ProjectListResponse(
        items=[ProjectResponse.model_validate(p) for p in projects],
        total=total,
    )


async def get_project(db: AsyncSession, project_id: uuid.UUID) -> ProjectResponse | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return None
    return ProjectResponse.model_validate(project)


async def update_project(
    db: AsyncSession, project_id: uuid.UUID, data: ProjectUpdate
) -> ProjectResponse | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return None

    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description

    await db.commit()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


async def delete_project(db: AsyncSession, project_id: uuid.UUID) -> bool:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return False
    await db.delete(project)
    await db.commit()
    return True
