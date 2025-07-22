"""
Vista IoT Backend - FastAPI Application
Provides hardware detection and dashboard API endpoints
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import hardware, dashboard, deploy

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Vista IoT Backend API",
    description="Hardware detection and dashboard API for Vista IoT Gateway",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(hardware.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(deploy.router)

@app.get("/")
async def root():
    """Root endpoint - API status check"""
    return {
        "message": "Vista IoT Backend API",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "vista-iot-backend"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
