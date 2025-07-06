"""
API router for the Vista IoT Gateway.
Provides RESTful endpoints for configuration and control.
"""
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from pydantic import BaseModel

from .hardware_router import router as hardware_router

logger = logging.getLogger(__name__)

# API models for request/response
class ConfigUpdateRequest(BaseModel):
    """Request model for updating configuration"""
    config: Dict[str, Any]
    save: bool = True

class TagValueRequest(BaseModel):
    """Request model for updating tag values"""
    value: Any

class TagValueResponse(BaseModel):
    """Response model for tag values"""
    id: str
    name: str
    value: Any
    timestamp: str
    quality: str

class SystemStatusResponse(BaseModel):
    """Response model for system status"""
    running: bool
    uptime: float
    system: Dict[str, Any]
    modules: Dict[str, str]
    last_update: str

# Create the main API router with /api prefix
api_router = APIRouter(prefix="/api")

# Create sub-router for gateway endpoints
gateway_router = APIRouter(
    prefix="",
    tags=["gateway"],
    responses={404: {"description": "Not found"}},
)

# Include sub-routers
api_router.include_router(gateway_router)
api_router.include_router(hardware_router)

# Alias for backward compatibility
router = gateway_router

# Gateway instance will be injected as a dependency
class GatewayDependency:
    """Dependency for getting the gateway instance"""
    def __init__(self):
        self.gateway = None
    
    def set_gateway(self, gateway):
        """Set the gateway instance"""
        self.gateway = gateway
    
    def get_gateway(self):
        """Get the gateway instance"""
        if not self.gateway:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Gateway not initialized"
            )
        return self.gateway

# Create dependency
gateway_dependency = GatewayDependency()

def get_gateway():
    """Dependency to get the gateway instance"""
    return gateway_dependency.get_gateway()

# API endpoints
@gateway_router.get("/status", response_model=SystemStatusResponse)
async def get_status(gateway=Depends(get_gateway)):
    """Get the current status of the gateway"""
    return gateway.get_status()

@gateway_router.post("/launch")
async def launch_backend(background_tasks: BackgroundTasks, request: Request):
    """Launch the backend with the specified configuration"""
    data = await request.json()
    config_path = data.get("configPath")
    
    # In a real implementation, this would launch a new backend process
    # For now, we'll just return success and let the client refresh
    logger.info(f"Request to launch backend with config: {config_path}")
    
    # Since we're already running (this endpoint is part of the backend),
    # we'll just simulate a restart in the background
    background_tasks.add_task(gateway_dependency.get_gateway().restart)
    
    return {"status": "success", "message": "Backend launch initiated"}

@gateway_router.get("/config")
async def get_config(gateway=Depends(get_gateway)):
    """Get the current configuration"""
    return gateway.get_config()

@gateway_router.put("/config")
async def update_config(
    request: ConfigUpdateRequest,
    background_tasks: BackgroundTasks,
    gateway=Depends(get_gateway)
):
    """Update the configuration"""
    success = gateway.update_config(request.config, request.save)
    
    if success:
        # Schedule a restart if required
        if request.config.get("restart", False):
            background_tasks.add_task(gateway.restart)
        
        return {"status": "success", "message": "Configuration updated"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update configuration"
        )

@gateway_router.post("/restart")
async def restart_gateway(background_tasks: BackgroundTasks, gateway=Depends(get_gateway)):
    """Restart the gateway"""
    # Schedule restart in background to allow API to respond
    background_tasks.add_task(gateway.restart)
    return {"status": "success", "message": "Gateway restart scheduled"}

@gateway_router.get("/tags")
async def get_all_tags(gateway=Depends(get_gateway)):
    """Get all tags and their current values"""
    # Assuming the gateway has an IO module with a get_all_tags method
    if "io" not in gateway.modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IO module not available"
        )
    
    io_module = gateway.modules["io"]
    return io_module.get_all_tags()

@gateway_router.get("/tags/{tag_id}", response_model=TagValueResponse)
async def get_tag(tag_id: str, gateway=Depends(get_gateway)):
    """Get a specific tag value"""
    # Assuming the gateway has an IO module with a get_tag method
    if "io" not in gateway.modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IO module not available"
        )
    
    io_module = gateway.modules["io"]
    tag = io_module.get_tag(tag_id)
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} not found"
        )
    
    return tag

@gateway_router.put("/tags/{tag_id}")
async def update_tag(tag_id: str, request: TagValueRequest, gateway=Depends(get_gateway)):
    """Update a tag value"""
    # Assuming the gateway has an IO module with an update_tag method
    if "io" not in gateway.modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IO module not available"
        )
    
    io_module = gateway.modules["io"]
    success = io_module.update_tag_value(tag_id, request.value)
    
    if success:
        return {"status": "success", "message": f"Tag {tag_id} updated"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to update tag {tag_id}"
        )

# Protocol-specific endpoints
@gateway_router.get("/protocols")
async def get_protocols(gateway=Depends(get_gateway)):
    """Get information about active protocols"""
    protocols = {}
    
    # Collect information from each protocol module
    for module_name, module in gateway.modules.items():
        if module_name in ["modbus", "mqtt"]:
            protocols[module_name] = module.get_status()
    
    return protocols

@gateway_router.get("/protocols/modbus/registers")
async def get_modbus_registers(gateway=Depends(get_gateway)):
    """Get Modbus register values"""
    if "modbus" not in gateway.modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modbus module not available"
        )
    
    modbus_module = gateway.modules["modbus"]
    return {
        "coils": modbus_module.registers["coils"],
        "discrete_inputs": modbus_module.registers["discrete_inputs"],
        "holding": modbus_module.registers["holding"],
        "input": modbus_module.registers["input"]
    }

@gateway_router.put("/protocols/modbus/registers/{register_type}/{address}")
async def update_modbus_register(
    register_type: str,
    address: int,
    request: TagValueRequest,
    gateway=Depends(get_gateway)
):
    """Update a Modbus register value"""
    if "modbus" not in gateway.modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modbus module not available"
        )
    
    modbus_module = gateway.modules["modbus"]
    
    # Validate register type
    if register_type not in ["coil", "holding"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot write to register type: {register_type}"
        )
    
    success = modbus_module.write_register(register_type, address, request.value)
    
    if success:
        return {"status": "success", "message": f"Register {register_type}:{address} updated"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update register {register_type}:{address}"
        )
