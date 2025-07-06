"""
Main application for the Vista IoT Gateway.
This module initializes and runs the gateway and API server.
"""
import os
import logging
import asyncio
import argparse
import uvicorn
import signal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.gateway import IoTGateway
from .api.router import api_router, gateway_dependency

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="Vista IoT Gateway API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Set to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router)

# Gateway instance
gateway = None

@app.on_event("startup")
async def startup_event():
    """Initialize gateway when API server starts"""
    global gateway
    
    logger.info("Starting Vista IoT Gateway")
    
    # Only use database path (no config_path)
    db_path = os.environ.get("VISTA_DB_PATH")
    
    # If db_path is not specified, use default path in frontend directory
    if not db_path:
        frontend_dir = os.path.dirname(os.path.abspath(__file__)).split('/vista-iot-gateway-backend')[0]
        db_path = os.path.join(frontend_dir, "prisma", "dev.db")
        logger.info(f"Using default database path: {db_path}")
    
    # Initialize gateway with database support only
    gateway = IoTGateway(db_path=db_path)
    
    # Inject gateway into API dependency
    gateway_dependency.set_gateway(gateway)
    
    # Log loaded config summary
    config = gateway.config_manager.get_config()
    logger.debug(f"Loaded config summary: IO Ports: {len(config.get('io_setup', {}).get('ports', []))}, Devices: {sum(len(p.get('devices', [])) for p in config.get('io_setup', {}).get('ports', []))}, Tags: {sum(len(d.get('tags', [])) for p in config.get('io_setup', {}).get('ports', []) for d in p.get('devices', []))}")
    
    # Start gateway in background task
    asyncio.create_task(gateway.start())
    
    logger.info("Gateway initialized and starting")

@app.on_event("shutdown")
async def shutdown_event():
    """Stop gateway when API server stops"""
    global gateway
    
    if gateway:
        logger.info("Stopping Vista IoT Gateway")
        await gateway.stop()
        logger.info("Gateway stopped")

def handle_sigterm(signum, frame):
    """Handle SIGTERM signal gracefully"""
    logger.info("Received SIGTERM, shutting down")
    # Let the FastAPI shutdown event handle gateway shutdown
    raise SystemExit(0)

async def run_gateway_only(db_path: str = None):
    """
    Run gateway without the API server.
    Args:
        db_path: Path to the SQLite database file
    """
    global gateway
    
    # If db_path is not specified, use default path in frontend directory
    if not db_path:
        frontend_dir = os.path.dirname(os.path.abspath(__file__)).split('/vista-iot-gateway-backend')[0]
        db_path = os.path.join(frontend_dir, "prisma", "dev.db")
        logger.info(f"Using default database path: {db_path}")
    
    # Initialize gateway with database support only
    gateway = IoTGateway(db_path=db_path)
    
    # Register signal handlers
    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)
    
    try:
        # Start gateway
        await gateway.start()
        
        # Keep running until interrupted
        while True:
            await asyncio.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        logger.info("Gateway interrupted, shutting down")
    finally:
        # Stop gateway
        if gateway:
            await gateway.stop()
    
    logger.info("Gateway exited")

def main():
    """Main entry point for the application"""
    parser = argparse.ArgumentParser(description="Vista IoT Gateway")
    parser.add_argument("--db", help="Path to SQLite database file")
    parser.add_argument("--api-only", action="store_true", help="Run API server only")
    parser.add_argument("--gateway-only", action="store_true", help="Run gateway only (no API server)")
    parser.add_argument("--host", default="0.0.0.0", help="API server host")
    parser.add_argument("--port", type=int, default=8000, help="API server port")
    
    args = parser.parse_args()
    
    # Set database path in environment
    if args.db:
        os.environ["VISTA_DB_PATH"] = args.db
    
    if args.gateway_only:
        # Run gateway only
        asyncio.run(run_gateway_only(args.db))
    else:
        # Run API server with gateway
        uvicorn.run(
            "vista_iot.app:app",
            host=args.host,
            port=args.port,
            reload=False,
            log_level="info"
        )

if __name__ == "__main__":
    main()
