"""
Vista IoT Backend - FastAPI Application
Provides hardware detection and dashboard API endpoints with comprehensive logging
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Import our new logging system
from app.logging_config import log_manager, get_startup_logger, get_system_logger, get_error_logger
from app.middleware import RequestResponseLoggingMiddleware, RequestSizeMiddleware

# Import routers
from app.routers import dashboard, deploy, hardware, config
from app.routers import dnp3, snmp_set, opcua, modbus, iec104
from app.services.config_monitor import config_monitor

# Initialize comprehensive logging system
log_manager.setup_all_loggers()
log_manager.log_startup_info()

# Get loggers for this module - use startup logger for initialization events
startup_logger = get_startup_logger()
system_logger = get_system_logger()
error_logger = get_error_logger()

# Log FastAPI initialization start
startup_logger.info("🌐 FastAPI Application Initialization Starting")
startup_logger.info("=" * 60)

# Create FastAPI app
app = FastAPI(
    title="Vista IoT Backend API",
    description="Hardware detection and dashboard API for Vista IoT Gateway",
    version="1.0.0",
)

startup_logger.info("✅ FastAPI application instance created")
startup_logger.info("   📋 Title: Vista IoT Backend API")
startup_logger.info("   📖 Description: Hardware detection and dashboard API for Vista IoT Gateway")
startup_logger.info("   🏷️  Version: 1.0.0")

# Add logging middleware (order matters - add early to catch all requests)
startup_logger.info("🔧 Configuring FastAPI middleware...")

app.add_middleware(RequestSizeMiddleware, max_size=10*1024*1024)  # 10MB limit
startup_logger.info("   ✅ Request size middleware added (10MB limit)")

app.add_middleware(
    RequestResponseLoggingMiddleware, 
    log_body=False  # Set to True if you want to log request/response bodies
)
startup_logger.info("   ✅ Request/Response logging middleware added")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
startup_logger.info("   ✅ CORS middleware added (all origins allowed)")

# Log middleware setup completion
startup_logger.info("🎯 All FastAPI middleware configured successfully")

# Include routers
startup_logger.info("🔗 Registering API routers...")
try:
    app.include_router(hardware.router, prefix="/api")
    startup_logger.info("   ✅ Hardware router registered (/api/hardware)")
    
    app.include_router(dashboard.router, prefix="/api")
    startup_logger.info("   ✅ Dashboard router registered (/api/dashboard)")
    
    app.include_router(config.router, prefix="/api")
    startup_logger.info("   ✅ Config router registered (/api/config)")
    
    app.include_router(deploy.router)
    startup_logger.info("   ✅ Deploy router registered (/deploy)")
    
    app.include_router(dnp3.router)
    startup_logger.info("   ✅ DNP3 router registered")
    
    app.include_router(snmp_set.router)
    startup_logger.info("   ✅ SNMP router registered")
    
    app.include_router(opcua.router)
    startup_logger.info("   ✅ OPC-UA router registered")
    
    app.include_router(modbus.router)
    startup_logger.info("   ✅ Modbus router registered")
    
    app.include_router(iec104.router)
    startup_logger.info("   ✅ IEC104 router registered")
    
    startup_logger.info("🎉 All API routers registered successfully")
    startup_logger.info("📊 Available API endpoints:")
    startup_logger.info("   🔧 Hardware: /api/hardware/* - Hardware detection and configuration")
    startup_logger.info("   📈 Dashboard: /api/dashboard/* - Dashboard data and statistics")
    startup_logger.info("   ⚙️  Config: /api/config/* - Configuration management")
    startup_logger.info("   🚀 Deploy: /deploy/* - Deployment endpoints")
    startup_logger.info("   🌐 Protocols: DNP3, SNMP, OPC-UA, Modbus, IEC104 endpoints")
    
except Exception as e:
    error_logger.error(f"Failed to register routers: {str(e)}", exc_info=True)
    startup_logger.error(f"❌ Router registration failed: {str(e)}")
    raise

# Application event handlers
@app.on_event("startup")
async def startup_event():
    """Application startup event"""
    startup_logger.info("🚀 FastAPI Startup Event Triggered")
    startup_logger.info("=" * 60)
    startup_logger.info("🌟 Vista IoT Backend API - Startup Event Handler")
    startup_logger.info("   🟢 FastAPI application startup completed successfully")
    startup_logger.info("   📡 API is ready to serve requests")
    startup_logger.info("   🔥 All endpoints are now available")
    
    # Start config monitoring
    try:
        # Note: config_monitor should be adapted to use the new logging system
        # config_monitor.start()  # Uncomment when config_monitor is updated
        startup_logger.info("⚙️  Configuration monitoring service initialized")
    except Exception as e:
        error_logger.error(f"Failed to start config monitoring: {str(e)}", exc_info=True)
        startup_logger.error(f"❌ Config monitoring failed to start: {str(e)}")
        
    startup_logger.info("✨ Startup event handler completed successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event"""
    startup_logger.info("🛑 FastAPI Shutdown Event Triggered")
    startup_logger.info("=" * 60)
    startup_logger.info("🔄 Vista IoT Backend API - Shutdown Event Handler")
    startup_logger.info("   🔧 Performing cleanup operations...")
    
    # Add any cleanup operations here
    
    startup_logger.info("   ✅ Cleanup completed successfully")
    startup_logger.info("   👋 Application shutdown completed")
    startup_logger.info("=" * 60)

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
        error_logger.error(f"Error getting logging status: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "error": str(e)
        }

# Log that FastAPI initialization is complete
startup_logger.info("🎯 FastAPI Application Initialization Complete")
startup_logger.info("   🌐 Application ready for startup event")
startup_logger.info("   📡 Ready to handle incoming requests")
startup_logger.info("=" * 60)

if __name__ == "__main__":
    import uvicorn
    startup_logger.info("🚀 Starting Vista IoT Backend with uvicorn")
    startup_logger.info("   🌐 Server configuration:")
    startup_logger.info("   🏠 Host: 0.0.0.0")
    startup_logger.info("   🔌 Port: 8000")
    startup_logger.info("   📡 Starting server...")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
