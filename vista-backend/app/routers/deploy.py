
import logging
from fastapi import APIRouter, Request, HTTPException
import yaml
from typing import Dict, Any
from app.services.initializer import initialize_backend
from app.utils.config_summary import generate_config_summary
import threading

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/deploy",
    tags=["deploy"],
    responses={404: {"description": "Not found"}},
)


@router.post("/config")
async def deploy_config(request: Request):
    """
    Accepts a YAML configuration and logs a summary of its content.
    """
    try:
        body = await request.body()
        config = yaml.safe_load(body)
        summary = generate_config_summary(config)
        logger.info("Received new configuration deployment:%s", summary)
        # Trigger backend re-initialization in the background
        threading.Thread(target=initialize_backend, daemon=True).start()
        return {"status": "success", "message": "Configuration received and backend re-initialized."}
    except yaml.YAMLError as e:
        logger.error(f"Error parsing YAML: {e}")
        raise HTTPException(status_code=400, detail="Invalid YAML format")
    except Exception as e:
        logger.error(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred") 