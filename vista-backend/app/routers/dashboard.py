"""
Dashboard router for the Vista IoT Backend.
Provides endpoints for system overview and monitoring.
"""
from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any
import logging

from ..services.dashboard import DashboardService
from ..models.responses import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    responses={404: {"description": "Not found"}},
)

@router.get("/overview", response_model=Dict[str, Any])
async def dashboard_overview():
    """
    Get system, protocol, and network overview for the dashboard.
    Returns a dict with status and data keys, matching /hardware/detect style.
    """
    try:
        return DashboardService.get_system_overview()
    except Exception as e:
        error_msg = f"Error in dashboard overview: {str(e)}"
        logger.exception(error_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
