import time

from fastapi import APIRouter, Depends, HTTPException, Query
from jinja2 import UndefinedError
from sqlalchemy.ext.asyncio import AsyncSession

from src.pcp_server.database import get_db
from src.pcp_server.schemas import (
    ExpandRequest,
    ExpandResponse,
    NewVersionCreate,
    PromptCreate,
    PromptListResponse,
    PromptResponse,
    PromptVersionResponse,
)
from src.pcp_server.mcp.tools import register_prompt_tool, unregister_prompt_tool
from src.pcp_server.services import metrics_service, prompt_service

router = APIRouter(prefix="/api/v1", tags=["prompts"])


@router.post("/prompts", response_model=PromptResponse, status_code=201)
async def create_prompt(data: PromptCreate, db: AsyncSession = Depends(get_db)):
    try:
        result = await prompt_service.create_prompt(db, data)
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail=f"Prompt '{data.name}' already exists")
        raise
    register_prompt_tool(result.name, result.description)
    return result


@router.get("/prompts", response_model=PromptListResponse)
async def list_prompts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tag: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await prompt_service.list_prompts(db, page=page, page_size=page_size, tag=tag)


@router.get("/prompts/{name}", response_model=PromptResponse)
async def get_prompt(name: str, db: AsyncSession = Depends(get_db)):
    result = await prompt_service.get_prompt(db, name)
    if not result:
        raise HTTPException(status_code=404, detail=f"Prompt '{name}' not found")
    return result


@router.get("/prompts/{name}/versions", response_model=list[PromptVersionResponse])
async def get_prompt_versions(name: str, db: AsyncSession = Depends(get_db)):
    result = await prompt_service.get_prompt_versions(db, name)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Prompt '{name}' not found")
    return result


@router.put("/prompts/{name}", response_model=PromptVersionResponse, status_code=201)
async def create_version(
    name: str, data: NewVersionCreate, db: AsyncSession = Depends(get_db)
):
    try:
        result = await prompt_service.create_version(db, name, data)
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail=f"Version '{data.version}' already exists for prompt '{name}'",
            )
        raise
    if not result:
        raise HTTPException(status_code=404, detail=f"Prompt '{name}' not found")
    return result


@router.delete("/prompts/{name}", status_code=204)
async def deprecate_prompt(name: str, db: AsyncSession = Depends(get_db)):
    success = await prompt_service.deprecate_prompt(db, name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Prompt '{name}' not found")
    unregister_prompt_tool(name)


@router.post("/prompts/{name}/rollback/{version}", response_model=PromptResponse)
async def rollback_prompt(name: str, version: str, db: AsyncSession = Depends(get_db)):
    result = await prompt_service.pin_version(db, name, version)
    if not result:
        raise HTTPException(
            status_code=404, detail=f"Prompt '{name}' or version '{version}' not found"
        )
    return result


@router.post("/expand/{name}", response_model=ExpandResponse)
async def expand_prompt(name: str, data: ExpandRequest, db: AsyncSession = Depends(get_db)):
    t0 = time.perf_counter()
    status = 200
    version_str = "latest"
    try:
        result = await prompt_service.expand_prompt(db, name, data)
        if not result:
            status = 404
            raise HTTPException(status_code=404, detail=f"Prompt '{name}' not found")
        version_str = result.prompt_version
        return result
    except UndefinedError as e:
        status = 422
        raise HTTPException(status_code=422, detail=f"Template variable error: {e}")
    finally:
        latency = (time.perf_counter() - t0) * 1000
        await metrics_service.record_usage(db, name, version_str, status, latency)


@router.post("/expand/{name}/versions/{version}", response_model=ExpandResponse)
async def expand_prompt_version(
    name: str, version: str, data: ExpandRequest, db: AsyncSession = Depends(get_db)
):
    t0 = time.perf_counter()
    status = 200
    try:
        result = await prompt_service.expand_prompt(db, name, data, version=version)
        if not result:
            status = 404
            raise HTTPException(
                status_code=404, detail=f"Prompt '{name}' version '{version}' not found"
            )
        return result
    except UndefinedError as e:
        status = 422
        raise HTTPException(status_code=422, detail=f"Template variable error: {e}")
    finally:
        latency = (time.perf_counter() - t0) * 1000
        await metrics_service.record_usage(db, name, version, status, latency)
