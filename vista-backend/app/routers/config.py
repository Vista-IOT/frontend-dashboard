from fastapi import APIRouter
from app.services.initializer import initialize_backend
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/config/reload")
async def reload_configuration():
    """Reload configuration and reinitialize backend services"""
    try:
        logger.info("Manual configuration reload requested")
        initialize_backend()
        return {"status": "success", "message": "Configuration reloaded successfully"}
    except Exception as e:
        logger.error(f"Failed to reload configuration: {e}")
        return {"status": "error", "message": f"Failed to reload configuration: {str(e)}"}
