#!/usr/bin/env python3
"""
Startup script for Vista IoT Backend
"""
import uvicorn
from app.main import app
from app.services.config_loader import load_latest_config
from app.services.hardware_configurator import configure_hardware
import logging

# Configure logging at the application entry point
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

def run_startup_logic():
    """
    Executes the startup logic: loading config and configuring hardware.
    """
    logger.info("--- Kicking off startup logic ---")
    
    # 1. Load the latest configuration from the database
    config = load_latest_config()
    
    # 2. Configure hardware based on the loaded config
    configure_hardware(config)

    logger.info("--- Startup logic complete ---")


if __name__ == "__main__":
    # Run the startup logic before starting the server
    run_startup_logic()

    # Start the FastAPI server
    uvicorn.run(app, host="0.0.0.0", port=8000)
