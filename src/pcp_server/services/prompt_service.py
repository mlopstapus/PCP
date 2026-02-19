import re

from jinja2 import StrictUndefined
from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy import String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.pcp_server.models import Prompt, PromptVersion
from src.pcp_server.schemas import (
    ExpandRequest,
    ExpandResponse,
    NewVersionCreate,
    PromptCreate,
    PromptListResponse,
    PromptResponse,
    PromptVersionResponse,
)


def _prompt_response(prompt: Prompt) -> PromptResponse:
    latest = prompt.versions[0] if prompt.versions else None
    return PromptResponse(
        id=prompt.id,
        name=prompt.name,
        description=prompt.description,
        is_deprecated=prompt.is_deprecated,
        created_at=prompt.created_at,
        updated_at=prompt.updated_at,
        latest_version=PromptVersionResponse.model_validate(latest) if latest else None,
    )


async def create_prompt(db: AsyncSession, data: PromptCreate) -> PromptResponse:
    prompt = Prompt(name=data.name, description=data.description)
    db.add(prompt)
    await db.flush()

    version = PromptVersion(
        prompt_id=prompt.id,
        version=data.version.version,
        system_template=data.version.system_template,
        user_template=data.version.user_template,
        input_schema=data.version.input_schema,
        tags=data.version.tags,
    )
    db.add(version)
    await db.commit()

    result = await db.execute(
        select(Prompt).where(Prompt.id == prompt.id).options(selectinload(Prompt.versions))
    )
    prompt = result.scalar_one()
    return _prompt_response(prompt)


async def list_prompts(
    db: AsyncSession, page: int = 1, page_size: int = 20, tag: str | None = None
) -> PromptListResponse:
    query = select(Prompt).options(selectinload(Prompt.versions))
    count_query = select(func.count()).select_from(Prompt)

    if tag:
        query = query.join(Prompt.versions).where(
            PromptVersion.tags.cast(String).contains(tag)
        )
        count_query = (
            select(func.count(Prompt.id.distinct()))
            .select_from(Prompt)
            .join(Prompt.versions)
            .where(PromptVersion.tags.cast(String).contains(tag))
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = query.offset((page - 1) * page_size).limit(page_size).order_by(Prompt.name)
    result = await db.execute(query)
    prompts = result.scalars().unique().all()

    return PromptListResponse(
        items=[_prompt_response(p) for p in prompts],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_prompt(db: AsyncSession, name: str) -> PromptResponse | None:
    result = await db.execute(
        select(Prompt).where(Prompt.name == name).options(selectinload(Prompt.versions))
    )
    prompt = result.scalar_one_or_none()
    if not prompt:
        return None
    return _prompt_response(prompt)


async def get_prompt_versions(db: AsyncSession, name: str) -> list[PromptVersionResponse] | None:
    result = await db.execute(
        select(Prompt).where(Prompt.name == name).options(selectinload(Prompt.versions))
    )
    prompt = result.scalar_one_or_none()
    if not prompt:
        return None
    return [PromptVersionResponse.model_validate(v) for v in prompt.versions]


async def create_version(
    db: AsyncSession, name: str, data: NewVersionCreate
) -> PromptVersionResponse | None:
    result = await db.execute(select(Prompt).where(Prompt.name == name))
    prompt = result.scalar_one_or_none()
    if not prompt:
        return None

    version = PromptVersion(
        prompt_id=prompt.id,
        version=data.version,
        system_template=data.system_template,
        user_template=data.user_template,
        input_schema=data.input_schema,
        tags=data.tags,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return PromptVersionResponse.model_validate(version)


async def deprecate_prompt(db: AsyncSession, name: str) -> bool:
    result = await db.execute(select(Prompt).where(Prompt.name == name))
    prompt = result.scalar_one_or_none()
    if not prompt:
        return False
    prompt.is_deprecated = True
    await db.commit()
    return True


MAX_INCLUDE_DEPTH = 3


async def pin_version(
    db: AsyncSession, name: str, version: str
) -> PromptResponse | None:
    result = await db.execute(
        select(Prompt).where(Prompt.name == name).options(selectinload(Prompt.versions))
    )
    prompt = result.scalar_one_or_none()
    if not prompt:
        return None
    target = next((v for v in prompt.versions if v.version == version), None)
    if not target:
        return None
    prompt.active_version_id = target.id
    await db.commit()
    await db.refresh(prompt)
    return _prompt_response(prompt)


async def _fetch_prompt_version(
    db: AsyncSession, name: str, version: str | None = None
) -> PromptVersion | None:
    query = select(Prompt).where(Prompt.name == name).options(selectinload(Prompt.versions))
    result = await db.execute(query)
    prompt = result.scalar_one_or_none()
    if not prompt or not prompt.versions or prompt.is_deprecated:
        return None
    if version:
        return next((v for v in prompt.versions if v.version == version), None)
    if prompt.active_version_id:
        pinned = next((v for v in prompt.versions if v.id == prompt.active_version_id), None)
        if pinned:
            return pinned
    return prompt.versions[0]


def _render_template(
    env: SandboxedEnvironment, template_str: str, variables: dict
) -> str:
    return env.from_string(template_str).render(**variables)


def _build_include_prompt(
    prompt_cache: dict[str, PromptVersion],
    env: SandboxedEnvironment,
    variables: dict,
    depth: int,
) -> callable:
    def include_prompt(name: str) -> str:
        if depth >= MAX_INCLUDE_DEPTH:
            return f"[include_prompt('{name}'): max depth ({MAX_INCLUDE_DEPTH}) exceeded]"
        pv = prompt_cache.get(name)
        if not pv:
            return f"[include_prompt('{name}'): prompt not found]"

        inner_env = SandboxedEnvironment(undefined=StrictUndefined)
        inner_include = _build_include_prompt(prompt_cache, inner_env, variables, depth + 1)
        inner_env.globals["include_prompt"] = inner_include

        parts = []
        if pv.system_template:
            parts.append(_render_template(inner_env, pv.system_template, variables))
        parts.append(_render_template(inner_env, pv.user_template, variables))
        return "\n\n".join(parts)

    return include_prompt


async def _prefetch_included_prompts(
    db: AsyncSession, template_str: str | None
) -> set[str]:
    if not template_str:
        return set()
    return set(re.findall(r"include_prompt\(['\"]([a-z0-9-]+)['\"]\)", template_str))


async def expand_prompt(
    db: AsyncSession, name: str, data: ExpandRequest, version: str | None = None
) -> ExpandResponse | None:
    pv = await _fetch_prompt_version(db, name, version)
    if not pv:
        return None

    referenced_names: set[str] = set()
    referenced_names |= await _prefetch_included_prompts(db, pv.system_template)
    referenced_names |= await _prefetch_included_prompts(db, pv.user_template)

    prompt_cache: dict[str, PromptVersion] = {}
    fetch_queue = list(referenced_names)
    seen = set()
    for _ in range(MAX_INCLUDE_DEPTH):
        next_queue: list[str] = []
        for ref_name in fetch_queue:
            if ref_name in seen:
                continue
            seen.add(ref_name)
            ref_pv = await _fetch_prompt_version(db, ref_name)
            if ref_pv:
                prompt_cache[ref_name] = ref_pv
                next_queue += list(
                    await _prefetch_included_prompts(db, ref_pv.system_template)
                    | await _prefetch_included_prompts(db, ref_pv.user_template)
                )
        fetch_queue = next_queue
        if not fetch_queue:
            break

    env = SandboxedEnvironment(undefined=StrictUndefined)
    include_fn = _build_include_prompt(prompt_cache, env, data.input, depth=0)
    env.globals["include_prompt"] = include_fn

    system_message = None
    if pv.system_template:
        system_message = _render_template(env, pv.system_template, data.input)

    user_message = _render_template(env, pv.user_template, data.input)

    return ExpandResponse(
        prompt_name=name,
        prompt_version=pv.version,
        system_message=system_message,
        user_message=user_message,
    )


async def get_all_prompt_names(db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(Prompt.name).where(Prompt.is_deprecated.is_(False)).order_by(Prompt.name)
    )
    return list(result.scalars().all())
