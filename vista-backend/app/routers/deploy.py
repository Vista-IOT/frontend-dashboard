
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


def hot_reload_configuration(config_file_path: Path):
    """
    Hot reload configuration without stopping the backend process.
    This is much better than killing and restarting the entire process.
    """
    try:
        startup_logger.info("🔥 " + "="*60)
        startup_logger.info("🔥 HOT CONFIGURATION RELOAD INITIATED")
        startup_logger.info("🔥 " + "="*60)
        startup_logger.info(f"📂 Loading new configuration from: {config_file_path}")
        
        # Step 1: Stop existing polling threads gracefully
        startup_logger.info("🛑 Gracefully stopping existing polling threads...")
        stopped_count = stop_all_polling()
        startup_logger.info(f"✅ Successfully stopped {stopped_count} polling threads")
        logger.info(f"Stopped {stopped_count} existing polling threads")
        
        # Step 2: Give threads a moment to fully stop
        startup_logger.info("⏳ Waiting for threads to fully terminate...")
        time.sleep(2)
        
        # Step 3: Reinitialize backend with new configuration
        startup_logger.info("🔄 Reinitializing backend with new configuration...")
        success = initialize_backend()
        
        if success:
            startup_logger.info("🎉 " + "="*60)
            startup_logger.info("🎉 HOT RELOAD COMPLETED SUCCESSFULLY")
            startup_logger.info("🎉 " + "="*60)
            startup_logger.info("✅ Backend continues running with new configuration")
            startup_logger.info("📡 All services reloaded without downtime")
            logger.info("Hot configuration reload completed successfully")
            return True
        else:
            startup_logger.error("❌ Backend reinitialization failed during hot reload")
            logger.error("Backend reinitialization failed during hot reload")
            return False
            
    except Exception as e:
        startup_logger.error(f"💥 Hot reload failed with error: {e}")
        logger.error(f"Hot reload failed: {e}", exc_info=True)
        return False


@router.post("/config")
async def deploy_config(request: Request):
    """
    Deploy new configuration using hot reload (no process restart).
    This maintains log visibility and avoids downtime.
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
        
        # Perform hot reload in background to allow response to be sent
        def delayed_hot_reload():
            time.sleep(0.5)  # Give time for response to be sent
            success = hot_reload_configuration(config_file)
            if success:
                logger.info("Configuration deployment completed successfully via hot reload")
            else:
                logger.error("Configuration deployment failed during hot reload")
        
        threading.Thread(target=delayed_hot_reload, daemon=True).start()
        
        return {
            "status": "success", 
            "message": "Configuration deployed successfully via hot reload (no downtime)",
            "config_summary": summary,
            "config_file": str(config_file),
            "reload_type": "hot_reload",
            "benefits": [
                "No service downtime",
                "Logs remain visible", 
                "Active connections preserved",
                "Faster deployment"
            ]
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
            success = initialize_backend()
            return {
                "status": "warning" if success else "error",
                "message": "Backend reinitialized, but not running as root. Network configuration may have failed." if success else "Backend reinitialization failed",
                "requires_root": True,
                "config_source": "localhost:3000/deploy/config"
            }
        
        # Initialize backend (this will fetch config from localhost:3000/deploy/config or local file)
        success = initialize_backend()
        
        return {
            "status": "success" if success else "error",
            "message": "Backend reinitialized successfully with latest configuration from frontend" if success else "Backend reinitialization failed",
            "config_source": "localhost:3000/deploy/config or local config file"
        }
    except Exception as e:
        logger.error(f"Failed to reinitialize backend: {e}")
        return {
            "status": "error",
            "message": f"Failed to reinitialize backend: {str(e)}"
        }

@router.get("/api/io/polled-values")
async def get_polled_values():
    values = get_latest_polled_values()
    
    return JSONResponse(values)

