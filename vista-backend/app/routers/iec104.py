from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging

from app.services.iec104_service import (
    iec104_get_with_error,
    iec104_set_with_error,
    map_iec104_error_to_http_status
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
    error_details: Optional[Dict[str, Any]] = None

def _normalize_device_config(body: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize device configuration from request body"""
    device = body.get("device", {})
    
    return {
        'iec104IpAddress': device.get('iec104IpAddress'),
        'iec104PortNumber': device.get('iec104PortNumber', 2404),
        'iec104AsduAddress': device.get('iec104AsduAddress', 1)
    }

def _handle_error_response(error_info: Optional[Dict[str, Any]], operation: str) -> IEC104Response:
    """Handle error response with enhanced error details"""
    if error_info:
        error_message = error_info.get('verbose_description') or error_info.get('error_message', f'{operation} operation failed')
        return IEC104Response(
            success=False,
            error=error_message,
            error_details=error_info
        )
    else:
        return IEC104Response(
            success=False,
            error=f"{operation} operation failed"
        )

@router.post("/write")
async def write_iec104_point(body: Dict[str, Any]):
    """Write a value to an IEC-104 point"""
    try:
        logger.info(f"IEC-104 write request: {body}")
        
        # Extract request data
        device_id = body.get('deviceId')
        tag_id = body.get('tagId')
        value = body.get('value')
        address = body.get('address')
        public_address = body.get('publicAddress')
        point_number = body.get('pointNumber')
        
        if not all([device_id, tag_id, value is not None, address]):
            return IEC104Response(
                success=False,
                error="Missing required fields: deviceId, tagId, value, address"
            )
        
        logger.info(f"IEC-104 write: device={device_id}, tag={tag_id}, address={address}, IOA={point_number}, ASDU={public_address}, value={value}")
        
        # Get device configuration from request body
        device_config = body.get('device', {})
        
        # If device config is not in request body, use default config
        if not device_config:
            # Use configuration from your YAML
            iec104_config = {
                'iec104IpAddress': '10.0.0.1',  # From your config
                'iec104PortNumber': 2404,
                'iec104AsduAddress': 1
            }
        else:
            iec104_config = _normalize_device_config(body)
        
        # Validate required configuration
        if not iec104_config['iec104IpAddress']:
            return IEC104Response(
                success=False,
                error="IEC-104 IP address not configured for device"
            )
        
        logger.info(f"Using IEC-104 config: {iec104_config['iec104IpAddress']}:{iec104_config['iec104PortNumber']}")
        
        # Call the service with IEC-104 specific parameters
        success, error_info = iec104_set_with_error(
            iec104_config, 
            address, 
            value, 
            public_address, 
            point_number
        )
        
        if success:
            logger.info(f"IEC-104 write successful: {address} IOA={point_number} ASDU={public_address} = {value}")
            return IEC104Response(
                success=True,
                data={
                    "address": address,
                    "ioa": point_number,
                    "asdu": public_address,
                    "value": value,
                    "written": True
                }
            )
        else:
            logger.error(f"IEC-104 write failed: {error_info}")
            return _handle_error_response(error_info, "Write")
            
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
        
        value, error_info = iec104_get_with_error(request.deviceConfig, request.address)
        
        if error_info is None:
            return IEC104Response(
                success=True,
                data={
                    "address": request.address,
                    "value": value
                }
            )
        else:
            logger.error(f"IEC-104 read failed: {error_info}")
            return _handle_error_response(error_info, "Read")
            
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
