
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
        
        # Use the advanced deployment script for proper process management
        deploy_script = script_dir / "deploy_advanced.sh"
        if deploy_script.exists():
            # Run the advanced deployment script
            subprocess.Popen(
                [str(deploy_script), "deploy"],
                cwd=str(script_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True
            )
            logger.info("Advanced backend deployment initiated successfully")
        else:
            # Fallback to simple deployment script
            simple_script = script_dir / "deploy_simple.sh"
            if simple_script.exists():
                subprocess.Popen(
                    [str(simple_script), "bg"],
                    cwd=str(script_dir),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True
                )
                logger.info("Simple backend restart initiated successfully")
            else:
                logger.warning(f"No deployment scripts found. Falling back to initialization only.")
                # Fallback: just initialize backend
                initialize_backend()
            
    except Exception as e:
        logger.error(f"Error restarting backend: {e}")
        # Fallback: just initialize backend
        initialize_backend()

@router.post("/config")
async def deploy_config(request: Request):
    """
    Accepts a YAML configuration, reinitializes backend, and triggers a fresh restart.
    """
    try:
        body = await request.body()
        config = yaml.safe_load(body)
        summary = generate_config_summary(config)
        logger.info("Received new configuration deployment:%s", summary)
        
        # Save configuration to a temporary file for the restart process
        config_dir = Path(__file__).parent.parent.parent / "config"
        config_dir.mkdir(exist_ok=True)
        config_file = config_dir / "deployed_config.yaml"
        
        with open(config_file, 'w') as f:
            yaml.dump(config, f, default_flow_style=False)
        
        logger.info(f"Configuration saved to {config_file}")
        
        # Trigger backend restart in background to allow response to be sent
        def delayed_restart():
            import time
            time.sleep(1)  # Give time for response to be sent
            restart_backend()
        
        threading.Thread(target=delayed_restart, daemon=True).start()
        
        return {
            "status": "success", 
            "message": "Configuration received. Backend is restarting with new configuration...",
            "config_summary": summary
        }
    except yaml.YAMLError as e:
        logger.error(f"Error parsing YAML: {e}")
        raise HTTPException(status_code=400, detail="Invalid YAML format")
    except Exception as e:
        logger.error(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")

# New API route for polled values
from fastapi import APIRouter
from fastapi.responses import JSONResponse

@router.get("/api/io/polled-values")
def get_polled_values():
    return JSONResponse(get_latest_polled_values()) 