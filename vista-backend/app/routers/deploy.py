
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
from app.services.polling_service import get_latest_polled_values, stop_all_polling, get_polling_threads_status
import threading
from pathlib import Path
import requests
import time
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

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
        
        logger.info("Initiating backend restart with new configuration...")
        
        # Use the deployment script for proper process management
        deploy_script = script_dir / "deploy.py"
        if deploy_script.exists():
            # Run the deployment script with restart command
            subprocess.Popen(
                [sys.executable, str(deploy_script), "restart"],
                cwd=str(script_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True
            )
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
                logger.info("Performing clean restart to deploy new configuration...")
                
                # First, stop all existing polling threads
                stopped_count = stop_all_polling()
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
    # logger.info(f"Polled values: {values}")
    
    # # Log each tag's value or error message
    # for device_name, tags in values.items():
    #     for tag_id, tag_info in tags.items():
    #         if tag_info['status'] == 'ok':
    #             logger.info(f"Tag {tag_id} from device {device_name} polled successfully with value: {tag_info['value']}")
    #         else:
    #             logger.error(f"Tag {tag_id} from device {device_name} failed to poll with error: {tag_info['error']}")
    
    return JSONResponse(values)
