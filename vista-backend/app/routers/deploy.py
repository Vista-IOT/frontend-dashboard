
import logging
import os
import subprocess
import sys
from fastapi import APIRouter, Request, HTTPException
import yaml
from typing import Dict, Any
from app.services.initializer import initialize_backend
from app.utils.config_summary import generate_config_summary
from app.services.polling_service import get_latest_polled_values
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
    Accepts a YAML configuration, saves it, and triggers backend reinitialization.
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
        
        # Trigger backend reinitialization in background to allow response to be sent
        def delayed_reinit():
            import time
            time.sleep(1)  # Give time for response to be sent
            try:
                initialize_backend()
                logger.info("Backend reinitialized with new configuration")
            except Exception as e:
                logger.error(f"Error during backend reinitialization: {e}")
        
        threading.Thread(target=delayed_reinit, daemon=True).start()
        
        return {
            "status": "success", 
            "message": "Configuration deployed successfully. Backend is reinitializing...",
            "config_summary": summary,
            "config_file": str(config_file)
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
    return JSONResponse(get_latest_polled_values())
