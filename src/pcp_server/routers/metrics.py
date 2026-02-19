from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.pcp_server.database import get_db
from src.pcp_server.services import metrics_service

router = APIRouter(prefix="/api/v1", tags=["metrics"])


@router.get("/metrics/dashboard")
async def dashboard_stats(db: AsyncSession = Depends(get_db)):
    return await metrics_service.get_dashboard_stats(db)
