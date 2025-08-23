from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import logging

from app.services.opcua_service import (
    discover_endpoints,
    test_opcua_connection,
    opcua_get_with_error_async,
    opcua_set_with_error_async,
    OPCUADeviceConfig,
    ASYNCUA_AVAILABLE
)

router = APIRouter(prefix="/deploy", tags=["opcua"])
logger = logging.getLogger(__name__)


# Request/Response models
class OPCUADiscoverRequest(BaseModel):
    url: str


class OPCUATestConnectionRequest(BaseModel):
    url: str
    endpointSelection: Optional[str] = None
    securityMode: str = "None"
    securityPolicy: str = "Basic256Sha256"
    authType: str = "Anonymous"
    username: Optional[str] = None
    password: Optional[str] = None
    sessionTimeout: int = 60000
    requestTimeout: int = 5000


class OPCUAReadRequest(BaseModel):
    deviceConfig: Dict[str, Any]
    nodeId: str


class OPCUAWriteRequest(BaseModel):
    deviceConfig: Dict[str, Any]
    nodeId: str
    value: Any
    dataType: Optional[str] = None


class OPCUAResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None


@router.get("/status")
async def get_opcua_status():
    """Get OPC-UA service status"""
    return {
        "status": "available" if ASYNCUA_AVAILABLE else "unavailable",
        "asyncua_available": ASYNCUA_AVAILABLE,
        "message": "OPC-UA service ready" if ASYNCUA_AVAILABLE else "asyncua library not installed"
    }


@router.post("/discover")
async def discover_opcua_endpoints(request: OPCUADiscoverRequest):
    """
    Discover available endpoints on an OPC-UA server.
    """
    if not ASYNCUA_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPC-UA library (asyncua) not available"
        )
    
    try:
        logger.info(f"Discovering endpoints for OPC-UA server: {request.url}")
        endpoints = await discover_endpoints(request.url)
        
        return OPCUAResponse(
            success=True,
            data={"endpoints": endpoints},
            error=None
        )
        
    except Exception as e:
        logger.error(f"Error discovering OPC-UA endpoints: {e}")
        return OPCUAResponse(
            success=False,
            data=None,
            error=str(e)
        )


@router.post("/test-connection")
async def test_connection(request: OPCUATestConnectionRequest):
    """
    Test connection to an OPC-UA server.
    """
    if not ASYNCUA_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPC-UA library (asyncua) not available"
        )
    
    try:
        # Convert request to device config format
        device_config = {
            'name': 'TestDevice',
            'opcuaServerUrl': request.url,
            'opcuaEndpointSelection': request.endpointSelection,
            'opcuaSecurityMode': request.securityMode,
            'opcuaSecurityPolicy': request.securityPolicy,
            'opcuaAuthType': request.authType,
            'opcuaUsername': request.username or '',
            'opcuaPassword': request.password or '',
            'opcuaSessionTimeout': request.sessionTimeout,
            'opcuaRequestTimeout': request.requestTimeout,
        }
        
        opcua_config = OPCUADeviceConfig(device_config)
        logger.info(f"Testing OPC-UA connection to: {opcua_config.get_endpoint_url()}")
        
        success, error = await test_opcua_connection(opcua_config)
        
        return OPCUAResponse(
            success=success,
            data={"connected": success} if success else None,
            error=error
        )
        
    except Exception as e:
        logger.error(f"Error testing OPC-UA connection: {e}")
        return OPCUAResponse(
            success=False,
            data=None,
            error=str(e)
        )


@router.post("/read")
async def read_node(request: OPCUAReadRequest):
    """
    Read a value from an OPC-UA node.
    """
    if not ASYNCUA_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPC-UA library (asyncua) not available"
        )
    
    try:
        logger.info(f"Reading OPC-UA node: {request.nodeId}")
        value, error = await opcua_get_with_error_async(request.deviceConfig, request.nodeId)
        
        if error:
            return OPCUAResponse(
                success=False,
                data=None,
                error=error
            )
        else:
            return OPCUAResponse(
                success=True,
                data={"nodeId": request.nodeId, "value": value},
                error=None
            )
            
    except Exception as e:
        logger.error(f"Error reading OPC-UA node {request.nodeId}: {e}")
        return OPCUAResponse(
            success=False,
            data=None,
            error=str(e)
        )


@router.post("/api/opcua/write")
async def write_node(request: OPCUAWriteRequest):
    """
    Write a value to an OPC-UA node.
    """
    if not ASYNCUA_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPC-UA library (asyncua) not available"
        )
    
    try:
        # Extract endpoint from device config
        device_config = request.deviceConfig
        server_url = device_config.get("opcuaServerUrl") or "Unknown endpoint"
        
        logger.info(f"[OPCUA] Writing to node {request.nodeId} on endpoint {server_url} with value: {request.value}")

        success, error = await opcua_set_with_error_async(
            device_config, 
            request.nodeId, 
            request.value, 
            request.dataType
        )
        
        if error:
            logger.error(f"[OPCUA] Failed to write to node {request.nodeId} on {server_url}: {error}")
            return OPCUAResponse(
                success=False,
                data=None,
                error=error
            )
        else:
            logger.info(f"[OPCUA] Successfully wrote value to node {request.nodeId} on {server_url}")
            return OPCUAResponse(
                success=True,
                data={"nodeId": request.nodeId, "value": request.value, "written": True},
                error=None
            )
            
    except Exception as e:
        logger.error(f"[OPCUA] Exception writing to node {request.nodeId} on {server_url}: {e}")
        return OPCUAResponse(
            success=False,
            data=None,
            error=str(e)
        )



@router.get("/health")
async def health_check():
    """
    Health check endpoint for OPC-UA service.
    """
    return {
        "service": "opcua",
        "status": "healthy" if ASYNCUA_AVAILABLE else "degraded",
        "asyncua_available": ASYNCUA_AVAILABLE,
        "timestamp": int(__import__('time').time())
    }
