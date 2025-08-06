from fastapi import APIRouter
from app.services.initializer import initialize_backend
from app.services.hardware_configurator import apply_network_configuration
from app.services.config_loader import load_latest_config
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

@router.post("/config/apply-network")
async def apply_network_config():
    """Apply network configuration changes (requires root privileges)"""
    try:
        logger.info("Network configuration application requested")
        
        # Check if we're running with sufficient privileges
        import os
        if os.geteuid() != 0:
            return {
                "status": "error",
                "message": "Network configuration requires root privileges. Please run the backend with sudo.",
                "requires_root": True
            }
        
        config = load_latest_config()
        if not config:
            return {
                "status": "error",
                "message": "No configuration found. Please deploy a configuration first."
            }
        
        apply_network_configuration(config)
        return {
            "status": "success",
            "message": "Network configuration applied successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to apply network configuration: {e}")
        return {"status": "error", "message": f"Failed to apply network configuration: {str(e)}"}
