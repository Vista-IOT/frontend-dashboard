from fastapi import APIRouter
from app.services.initializer import initialize_backend
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/config/reload")
async def reload_configuration():
    """Reload configuration from localhost:3000/deploy/config and reinitialize backend services"""
    try:
        logger.info("Manual configuration reload requested")
        
        # Check if we're running with sufficient privileges for network configuration
        import os
        if os.geteuid() != 0:
            logger.warning("Configuration reload requested, but not running as root. Network configuration may fail.")
            initialize_backend()
            return {
                "status": "warning", 
                "message": "Configuration reloaded, but not running as root. Network configuration may have failed.",
                "requires_root": True,
                "config_source": "localhost:3000/deploy/config"
            }
        
        initialize_backend()
        return {
            "status": "success", 
            "message": "Configuration reloaded successfully",
            "config_source": "localhost:3000/deploy/config"
        }
    except Exception as e:
        logger.error(f"Failed to reload configuration: {e}")
        return {"status": "error", "message": f"Failed to reload configuration: {str(e)}"}
