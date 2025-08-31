from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging

from app.services.iec104_service import (
    iec104_get_with_error,
    iec104_set_with_error
)

router = APIRouter(prefix="/deploy/api/iec104", tags=["iec104"])
logger = logging.getLogger(__name__)

class IEC104WriteRequest(BaseModel):
    deviceId: str
    tagId: str
    value: Any
    address: str
    publicAddress: Optional[int] = None
    pointNumber: Optional[int] = None

class IEC104ReadRequest(BaseModel):
    deviceConfig: Dict[str, Any]
    address: str

class IEC104Response(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None

@router.post("/write")
async def write_iec104_point(request: IEC104WriteRequest):
    """Write a value to an IEC-104 point"""
    try:
        logger.info(f"IEC-104 write request: device={request.deviceId}, tag={request.tagId}, address={request.address}, value={request.value}")
        
        # Create device config from request (you might need to get full config from store)
        device_config = {
            'iec104IpAddress': '192.168.1.100',  # Default or get from config
            'iec104PortNumber': 2404,
            'iec104AsduAddress': request.publicAddress or 1
        }
        
        success, error = iec104_set_with_error(device_config, request.address, request.value)
        
        if success:
            logger.info(f"IEC-104 write successful: {request.address} = {request.value}")
            return IEC104Response(
                success=True,
                data={
                    "address": request.address,
                    "value": request.value,
                    "written": True
                }
            )
        else:
            logger.error(f"IEC-104 write failed: {error}")
            return IEC104Response(
                success=False,
                error=error or "Write operation failed"
            )
            
    except Exception as e:
        logger.error(f"Exception in IEC-104 write: {e}")
        return IEC104Response(
            success=False,
            error=str(e)
        )

@router.post("/read")
async def read_iec104_point(request: IEC104ReadRequest):
    """Read a value from an IEC-104 point"""
    try:
        logger.info(f"IEC-104 read request: address={request.address}")
        
        value, error = iec104_get_with_error(request.deviceConfig, request.address)
        
        if value is not None:
            return IEC104Response(
                success=True,
                data={
                    "address": request.address,
                    "value": value
                }
            )
        else:
            return IEC104Response(
                success=False,
                error=error or "Read operation failed"
            )
            
    except Exception as e:
        logger.error(f"Exception in IEC-104 read: {e}")
        return IEC104Response(
            success=False,
            error=str(e)
        )

@router.get("/status")
async def get_iec104_status():
    """Get IEC-104 service status"""
    return {
        "service": "iec104",
        "status": "available",
        "message": "IEC-104 service ready"
    }
