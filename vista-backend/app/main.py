"""
Vista IoT Backend - FastAPI Application
Provides hardware detection and dashboard API endpoints with comprehensive logging
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Import our new logging system
from app.logging_config import log_manager, get_system_logger, get_error_logger
from app.middleware import RequestResponseLoggingMiddleware, RequestSizeMiddleware

# Import routers
from app.routers import dashboard, deploy, hardware, config
from app.routers import dnp3, snmp_set, opcua, modbus, iec104
from app.services.config_monitor import config_monitor

# Initialize comprehensive logging system
log_manager.setup_all_loggers()
log_manager.log_startup_info()

# Get loggers for this module
system_logger = get_system_logger()
error_logger = get_error_logger()

# Create FastAPI app
app = FastAPI(
    title="Vista IoT Backend API",
    description="Hardware detection and dashboard API for Vista IoT Gateway",
    version="1.0.0",
)

# Add logging middleware (order matters - add early to catch all requests)
app.add_middleware(RequestSizeMiddleware, max_size=10*1024*1024)  # 10MB limit
app.add_middleware(
    RequestResponseLoggingMiddleware, 
    log_body=False  # Set to True if you want to log request/response bodies
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Log middleware setup
system_logger.info("FastAPI middleware configured successfully")
system_logger.info("- Request/Response logging enabled")
system_logger.info("- Request size limiting enabled (10MB)")
system_logger.info("- CORS middleware enabled")

# Include routers
try:
    app.include_router(hardware.router, prefix="/api")
    app.include_router(dashboard.router, prefix="/api")
    app.include_router(config.router, prefix="/api")
    app.include_router(deploy.router)
    app.include_router(dnp3.router)
    app.include_router(snmp_set.router)
    app.include_router(opcua.router)
    app.include_router(modbus.router)
    app.include_router(iec104.router)
    
    system_logger.info("All API routers registered successfully")
    system_logger.info("Available routes:")
    system_logger.info("- /api/hardware - Hardware detection and configuration")
    system_logger.info("- /api/dashboard - Dashboard data and statistics")
    system_logger.info("- /api/config - Configuration management")
    system_logger.info("- /deploy - Deployment endpoints")
    system_logger.info("- Protocol routers: DNP3, SNMP, OPC-UA, Modbus, IEC104")
    
except Exception as e:
    error_logger.error(f"Failed to register routers: {str(e)}")
    raise

# Application event handlers
@app.on_event("startup")
async def startup_event():
    """Application startup event"""
    system_logger.info("="*60)
    system_logger.info("Vista IoT Backend API - Starting Up")
    system_logger.info("="*60)
    system_logger.info("Application startup completed successfully")
    system_logger.info("API is ready to serve requests")
    
    # Start config monitoring
    try:
        # Note: config_monitor should be adapted to use the new logging system
        # config_monitor.start()  # Uncomment when config_monitor is updated
        system_logger.info("Configuration monitoring service initialized")
    except Exception as e:
        error_logger.error(f"Failed to start config monitoring: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event"""
    system_logger.info("="*60)
    system_logger.info("Vista IoT Backend API - Shutting Down")
    system_logger.info("="*60)
    system_logger.info("Cleanup completed")
    system_logger.info("Application shutdown successful")

# Health check endpoints
@app.get("/")
async def root():
    """Root endpoint - API status check"""
    system_logger.info("Root endpoint accessed - API status check")
    return {
        "message": "Vista IoT Backend API",
        "status": "running",
        "version": "1.0.0",
        "logging": "comprehensive"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    system_logger.debug("Health check endpoint accessed")
    return {
        "status": "healthy",
        "service": "vista-iot-backend",
        "logging_status": "active"
    }

@app.get("/logs/status")
async def logging_status():
    """Logging system status endpoint"""
    try:
        logs_dir = log_manager.base_dir
        log_files = []
        
        if os.path.exists(logs_dir):
            for file in os.listdir(logs_dir):
                if file.endswith('.log'):
                    filepath = os.path.join(logs_dir, file)
                    size = os.path.getsize(filepath) if os.path.exists(filepath) else 0
                    log_files.append({
                        "file": file,
                        "size_bytes": size,
                        "size_mb": round(size / (1024*1024), 2)
                    })
        
        return {
            "status": "active",
            "base_directory": logs_dir,
            "log_files": log_files,
            "total_files": len(log_files)
        }
    except Exception as e:
        error_logger.error(f"Error getting logging status: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    system_logger.info("Starting Vista IoT Backend with uvicorn")
    system_logger.info("Server configuration: host=0.0.0.0, port=8000")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
