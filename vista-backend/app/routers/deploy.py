
import logging
import os
import subprocess
import sys
from fastapi import APIRouter, Request, HTTPException
import yaml
from typing import Dict, Any
from app.services.initializer import initialize_backend
from app.services.hardware_configurator import apply_network_configuration
from app.utils.config_summary import generate_config_summary
from app.logging_config import get_startup_logger
from app.services.polling_service import get_latest_polled_values, stop_all_polling, get_polling_threads_status
import threading
from pathlib import Path
import requests
import time
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
startup_logger = get_startup_logger()

router = APIRouter(
    prefix="/deploy",
    tags=["deploy"],
    responses={404: {"description": "Not found"}},
)


def restart_backend():
    """
    Restart the Vista backend application using the deployment script.
    """
    try:
        # Get the script directory (where run.py and deployment scripts are)
        script_dir = Path(__file__).parent.parent.parent  # Go up from app/routers/ to root
        
        startup_logger.info("🔄 Backend restart requested - switching to deployment script")
        logger.info("Initiating backend restart with new configuration...")
        
        # Use the deployment wrapper script for proper process management
        deploy_wrapper = script_dir / "deploy_wrapper.py"
        if deploy_wrapper.exists():
            # Run the deployment wrapper with restart command
            # The wrapper will log all output to startup.log
            subprocess.Popen(
                [sys.executable, str(deploy_wrapper), "restart"],
                cwd=str(script_dir),
                start_new_session=True
            )
            startup_logger.info("🚀 Backend deployment restart initiated - output will be logged to startup.log")
            logger.info("Backend deployment restart initiated successfully")
        else:
            logger.warning(f"Deployment script not found. Falling back to initialization only.")
            # Fallback: just initialize backend
            initialize_backend()
            
    except Exception as e:
        logger.error(f"Error restarting backend: {e}")
        # Fallback: just initialize backend
        initialize_backend()

@router.post("/config")
async def deploy_config(request: Request):
    """
    Accepts a YAML configuration, saves it, and triggers a full clean backend restart.
    This ensures all protocol threads are properly stopped and restarted without conflicts.
    """
    try:
        body = await request.body()
        config = yaml.safe_load(body)
        summary = generate_config_summary(config)
        logger.info("Received new configuration deployment:%s", summary)
        
        # Save configuration to a file for the backend to use
        config_dir = Path(__file__).parent.parent.parent / "config"
        config_dir.mkdir(exist_ok=True)
        config_file = config_dir / "deployed_config.yaml"
        
        with open(config_file, 'w') as f:
            yaml.dump(config, f, default_flow_style=False)
        
        logger.info(f"Configuration saved to {config_file}")
        
        # Trigger clean restart in background to allow response to be sent
        def delayed_clean_restart():
            import time
            time.sleep(1)  # Give time for response to be sent
            try:
                startup_logger.info("🔄 " + "="*60)
                startup_logger.info("🔄 CONFIGURATION DEPLOYMENT - CLEAN RESTART INITIATED")
                startup_logger.info("🔄 " + "="*60)
                logger.info("Performing clean restart to deploy new configuration...")
                
                # First, stop all existing polling threads
                startup_logger.info("🛑 Stopping all existing polling threads before restart...")
                stopped_count = stop_all_polling()
                startup_logger.info(f"🛑 Successfully stopped {stopped_count} polling threads")
                logger.info(f"Stopped {stopped_count} existing polling threads")
                
                # Give threads a moment to fully stop
                time.sleep(2)
                
                # Now restart the entire backend process for a completely clean state
                restart_backend()
                
            except Exception as e:
                logger.error(f"Error during clean restart: {e}")
                # Fallback: just initialize in-process (less clean but better than nothing)
                try:
                    initialize_backend()
                    logger.info("Fallback: Backend reinitialized in-process with new configuration")
                except Exception as fallback_e:
                    logger.error(f"Fallback initialization also failed: {fallback_e}")
        
        threading.Thread(target=delayed_clean_restart, daemon=True).start()
        
        return {
            "status": "success", 
            "message": "Configuration deployed successfully. Performing clean backend restart...",
            "config_summary": summary,
            "config_file": str(config_file),
            "restart_type": "full_clean_restart"
        }
    except yaml.YAMLError as e:
        logger.error(f"Error parsing YAML: {e}")
        raise HTTPException(status_code=400, detail="Invalid YAML format")
    except Exception as e:
        logger.error(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

@router.post("/reinit")
async def reinit_backend():
    """
    Reload configuration from frontend (localhost:3000/deploy/config) and reinitialize backend.
    This endpoint requires root privileges for network interface configuration.
    """
    try:
        startup_logger.info("🔄 " + "="*45)
        startup_logger.info("🔄 BACKEND REINITIALIZATION REQUESTED")
        startup_logger.info("🔄 " + "="*45)
        logger.info("Backend reinitialization requested via /deploy/reinit")
        
        # Check if we're running with sufficient privileges for network configuration
        import os
        if os.geteuid() != 0:
            logger.warning("Backend reinitialization requested, but not running as root. Network configuration may fail.")
            # Still try to initialize, but warn about potential issues
            initialize_backend()
            return {
                "status": "warning",
                "message": "Backend reinitialized, but not running as root. Network configuration may have failed.",
                "requires_root": True,
                "config_source": "localhost:3000/deploy/config"
            }
        
        # Initialize backend (this will fetch config from localhost:3000/deploy/config)
        initialize_backend()
        
        return {
            "status": "success",
            "message": "Backend reinitialized successfully with latest configuration from frontend",
            "config_source": "localhost:3000/deploy/config"
        }
    except Exception as e:
        logger.error(f"Failed to reinitialize backend: {e}")
        return {
            "status": "error",
            "message": f"Failed to reinitialize backend: {str(e)}"
        }

@router.get("/api/io/polled-values")
def get_polled_values():
    values = get_latest_polled_values()
    
    return JSONResponse(values)
