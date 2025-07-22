#!/usr/bin/env python3
"""
Startup script for Vista IoT Backend
"""
import uvicorn
from app.main import app
from app.services.initializer import initialize_backend
import logging

# Configure logging at the application entry point
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    # Run the new startup logic before starting the server
    initialize_backend()

    # Start the FastAPI server
    uvicorn.run(app, host="0.0.0.0", port=8000)
