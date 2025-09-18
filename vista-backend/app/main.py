"""
Vista IoT Backend - FastAPI Application
Provides hardware detection and dashboard API endpoints
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from logging.handlers import RotatingFileHandler

from app.routers import dashboard, deploy, hardware, config
from app.routers import dnp3
from app.routers import snmp_set, opcua, modbus
from app.routers import iec104
from app.services.config_monitor import config_monitor

# Configure general logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)

# Set up DNP3-specific logging to separate file
def setup_dnp3_logging():
    """Setup separate logging for DNP3 service with detailed output"""
    # Create logs directory if it doesn't exist
    logs_dir = "/home/ach1lles/Projects/IOT-GATEWAY/frontend-dashboard/vista-backend/logs"
    os.makedirs(logs_dir, exist_ok=True)
    
    # Configure DNP3 logger
    dnp3_logger = logging.getLogger('app.services.dnp3_service')
    dnp3_logger.setLevel(logging.DEBUG)  # Capture all DNP3 debug messages
    
    # Remove existing handlers to avoid duplicates
    for handler in dnp3_logger.handlers[:]:
        dnp3_logger.removeHandler(handler)
    
    # File handler for DNP3 logs with rotation
    dnp3_file_handler = RotatingFileHandler(
        filename=os.path.join(logs_dir, 'dnp3_detailed.log'),
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    dnp3_file_handler.setLevel(logging.DEBUG)
    
    # Console handler for DNP3 logs (to also see in console)
    dnp3_console_handler = logging.StreamHandler()
    dnp3_console_handler.setLevel(logging.INFO)
    
    # Detailed formatter for file
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(funcName)s:%(lineno)d] - %(message)s'
    )
    
    # Simple formatter for console
    simple_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    dnp3_file_handler.setFormatter(detailed_formatter)
    dnp3_console_handler.setFormatter(simple_formatter)
    
    dnp3_logger.addHandler(dnp3_file_handler)
    dnp3_logger.addHandler(dnp3_console_handler)
    
    # Prevent propagation to root logger to avoid duplicate console messages
    dnp3_logger.propagate = False
    
    print(f"✅ DNP3 detailed logging configured:")
    print(f"   📁 Log file: {os.path.join(logs_dir, 'dnp3_detailed.log')}")
    print(f"   📊 File level: DEBUG (all details)")
    print(f"   🖥️  Console level: INFO (summary messages)")

# Setup DNP3 logging
setup_dnp3_logging()

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
app.include_router(config.router, prefix="/api")
app.include_router(deploy.router)
app.include_router(snmp_set.router)
app.include_router(dnp3.router)
app.include_router(opcua.router)
app.include_router(modbus.router)
app.include_router(iec104.router)

# Application lifecycle events
@app.on_event("startup")
async def startup_event():
    """Start configuration monitor on application startup"""
    logger.info("Starting Vista IoT Backend...")
    config_monitor.start()

@app.on_event("shutdown")
async def shutdown_event():
    """Stop configuration monitor on application shutdown"""
    logger.info("Shutting down Vista IoT Backend...")
    config_monitor.stop()

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
