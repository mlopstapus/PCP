import contextlib
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.pcp_server.config import settings
from src.pcp_server.mcp.server import mcp
from src.pcp_server.mcp.session import ApiKeyMiddleware
from src.pcp_server.mcp.tools import register_prompt_tools
from src.pcp_server.routers.auth import router as auth_router
from src.pcp_server.routers.apikeys import router as apikeys_router
from src.pcp_server.routers.metrics import router as metrics_router
from src.pcp_server.routers.objectives import router as objectives_router
from src.pcp_server.routers.policies import router as policies_router
from src.pcp_server.routers.projects import router as projects_router
from src.pcp_server.routers.prompts import router as prompts_router
from src.pcp_server.routers.teams import router as teams_router
from src.pcp_server.routers.users import router as users_router
from src.pcp_server.routers.workflows import router as workflows_router

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger("pcp")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PCP server starting up")
    await register_prompt_tools()
    logger.info("MCP tools registered")
    async with mcp.session_manager.run():
        yield
    logger.info("PCP server shutting down")


app = FastAPI(
    title="Prompt Control Plane",
    description="An open-source, self-hosted prompt registry distributed via MCP",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(apikeys_router)
app.include_router(metrics_router)
app.include_router(objectives_router)
app.include_router(policies_router)
app.include_router(projects_router)
app.include_router(prompts_router)
app.include_router(teams_router)
app.include_router(users_router)
app.include_router(workflows_router)
app.mount("/mcp", ApiKeyMiddleware(mcp.streamable_http_app()))


@app.get("/health")
async def health():
    return {"status": "ok"}
