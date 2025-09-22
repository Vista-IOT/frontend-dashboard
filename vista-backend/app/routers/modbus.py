from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, Optional, List, Union
import logging

from app.services.modbus_service import (
    test_modbus_connection,
    modbus_get_with_error_async,
    modbus_set_with_error_async,
    ModbusDeviceConfig,
    PYMODBUS_AVAILABLE
)

router = APIRouter(prefix="/deploy/api/modbus", tags=["modbus"])
logger = logging.getLogger(__name__)


# Request/Response models
class ModbusTestConnectionRequest(BaseModel):
    ipAddress: str
    portNumber: Optional[int] = 502
    unitNumber: Optional[int] = 1
    timeout: Optional[int] = 3


class ModbusReadRequest(BaseModel):
    deviceConfig: Dict[str, Any]
    address: Union[str, int]
    dataType: Optional[str] = "UINT16"
    byteOrder: Optional[str] = "ABCD"


class ModbusWriteRequest(BaseModel):
    deviceConfig: Dict[str, Any]
    address: Union[str, int]
    value: Any
    dataType: Optional[str] = "UINT16"
    byteOrder: Optional[str] = "ABCD"


class ModbusResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None


@router.get("/status")
async def get_modbus_status():
    """Get Modbus service status"""
    return {
        "status": "available" if PYMODBUS_AVAILABLE else "unavailable",
        "pymodbus_available": PYMODBUS_AVAILABLE,
        "message": "Modbus service ready" if PYMODBUS_AVAILABLE else "pymodbus library not installed"
    }


@router.post("/test-connection")
async def test_connection(request: ModbusTestConnectionRequest):
    """
    Test connection to a Modbus TCP device.
    """
    if not PYMODBUS_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Modbus library (pymodbus) not available"
        )
    
    try:
        # Convert request to device config format
        device_config = {
            'name': 'TestDevice',
            'ipAddress': request.ipAddress,
            'portNumber': request.portNumber,
            'unitNumber': request.unitNumber,
            'timeout': request.timeout,
        }
        
        modbus_config = ModbusDeviceConfig(device_config)
        logger.info(f"Testing Modbus TCP connection to: {modbus_config.ip_address}:{modbus_config.port_number}")
        
        success, error = await test_modbus_connection(modbus_config)
        
        if error:
            logger.error(f"[MODBUS TEST] FAILED to connect to {modbus_config.ip_address}:{modbus_config.port_number}: {error}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    'success': False,
                    'error': error,
                    'endpoint': f"{modbus_config.ip_address}:{modbus_config.port_number}",
                    'operation': 'modbus_test_connection'
                }
            )
        else:
            logger.info(f"[MODBUS TEST] SUCCESS: Connected to {modbus_config.ip_address}:{modbus_config.port_number}")
            return ModbusResponse(
                success=True,
                data={"connected": True, "endpoint": f"{modbus_config.ip_address}:{modbus_config.port_number}"},
                error=None
            )
        
    except Exception as e:
        logger.error(f"[MODBUS TEST] EXCEPTION testing connection to {request.ipAddress}:{request.portNumber}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                'success': False,
                'error': str(e),
                'endpoint': f"{request.ipAddress}:{request.portNumber}",
                'operation': 'modbus_test_connection'
            }
        )


@router.post("/read")
async def read_register(request: ModbusReadRequest):
    """
    Read a value from a Modbus register.
    """
    if not PYMODBUS_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Modbus library (pymodbus) not available"
        )
    
    try:
        logger.info(f"Reading Modbus register: {request.address} (type: {request.dataType}, order: {request.byteOrder})")
        value, error = await modbus_get_with_error_async(
            request.deviceConfig, 
            request.address, 
            request.dataType, 
            request.byteOrder
        )
        
        if error:
            logger.error(f"[MODBUS READ] FAILED to read register {request.address}: {error}")
            # Determine appropriate HTTP status code based on error type
            if 'Failed to connect' in error or 'Connection' in error:
                http_status = status.HTTP_503_SERVICE_UNAVAILABLE
            elif 'timeout' in error.lower() or 'timed out' in error.lower():
                http_status = status.HTTP_408_REQUEST_TIMEOUT
            elif 'Invalid' in error or 'illegal' in error.lower():
                http_status = status.HTTP_400_BAD_REQUEST
            else:
                http_status = status.HTTP_500_INTERNAL_SERVER_ERROR
                
            raise HTTPException(
                status_code=http_status,
                detail={
                    'success': False,
                    'error': error,
                    'address': request.address,
                    'operation': 'modbus_read'
                }
            )
        else:
            return ModbusResponse(
                success=True,
                data={
                    "address": request.address, 
                    "value": value,
                    "dataType": request.dataType,
                    "byteOrder": request.byteOrder
                },
                error=None
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions (from error handling above)
        raise
    except Exception as e:
        logger.error(f"[MODBUS READ] EXCEPTION reading register {request.address}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                'success': False,
                'error': str(e),
                'address': request.address,
                'operation': 'modbus_read'
            }
        )


@router.post("/write")
async def write_register(request: ModbusWriteRequest):
    """
    Write a value to a Modbus register.
    """
    if not PYMODBUS_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Modbus library (pymodbus) not available"
        )
    
    try:
        # Create ModbusDeviceConfig to get connection details for logging
        modbus_config = ModbusDeviceConfig(request.deviceConfig)
        device_endpoint = f"{modbus_config.ip_address}:{modbus_config.port_number}"
        
        # Extract device info for logging
        device_name = request.deviceConfig.get("name", "Unknown")
        unit_number = modbus_config.unit_number
        
        logger.info(f"[MODBUS WRITE] Device Config Details:")
        logger.info(f"  - Device Name: {device_name}")
        logger.info(f"  - Endpoint: {device_endpoint}")
        logger.info(f"  - Unit ID: {unit_number}")
        logger.info(f"  - Register Address: {request.address}")
        logger.info(f"  - Value: {request.value}")
        logger.info(f"  - Data Type: {request.dataType}")
        logger.info(f"  - Byte Order: {request.byteOrder}")

        success, error = await modbus_set_with_error_async(
            request.deviceConfig, 
            request.address, 
            request.value, 
            request.dataType, 
            request.byteOrder
        )
        
        if error:
            logger.error(f"[MODBUS WRITE] FAILED to write to register {request.address} on {device_endpoint}: {error}")
            # Determine appropriate HTTP status code based on error type
            if 'Failed to connect' in error or 'Connection' in error:
                http_status = status.HTTP_503_SERVICE_UNAVAILABLE
            elif 'timeout' in error.lower() or 'timed out' in error.lower():
                http_status = status.HTTP_408_REQUEST_TIMEOUT
            elif 'Invalid' in error or 'illegal' in error.lower():
                http_status = status.HTTP_400_BAD_REQUEST
            else:
                http_status = status.HTTP_500_INTERNAL_SERVER_ERROR
                
            raise HTTPException(
                status_code=http_status,
                detail={
                    'success': False,
                    'error': error,
                    'device': device_endpoint,
                    'address': request.address,
                    'operation': 'modbus_write'
                }
            )
        else:
            logger.info(f"[MODBUS WRITE] SUCCESS: Wrote value {request.value} to register {request.address} on {device_endpoint}")
            return ModbusResponse(
                success=True,
                data={
                    "address": request.address, 
                    "value": request.value, 
                    "written": True, 
                    "endpoint": device_endpoint,
                    "dataType": request.dataType,
                    "byteOrder": request.byteOrder
                },
                error=None
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions (from error handling above)
        raise
    except Exception as e:
        logger.error(f"[MODBUS WRITE] EXCEPTION writing to register {request.address}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                'success': False,
                'error': str(e),
                'address': request.address,
                'operation': 'modbus_write'
            }
        )


@router.get("/health")
async def health_check():
    """
    Health check endpoint for Modbus service.
    """
    return {
        "service": "modbus",
        "status": "healthy" if PYMODBUS_AVAILABLE else "degraded",
        "pymodbus_available": PYMODBUS_AVAILABLE,
        "timestamp": int(__import__('time').time())
    }


@router.get("/data-types")
async def get_supported_data_types():
    """
    Get list of supported Modbus data types.
    """
    return {
        "dataTypes": [
            "BOOL",
            "INT16", 
            "UINT16",
            "INT32",
            "UINT32", 
            "FLOAT32"
        ],
        "byteOrders": [
            "ABCD",  # Big Endian
            "CDAB",  # Little Endian  
            "BADC",  # Big Endian with word swap
            "DCBA"   # Little Endian with word swap
        ],
        "addressTypes": {
            "coils": "1-9999 (Boolean outputs)",
            "discreteInputs": "10001-19999 (Boolean inputs)",
            "inputRegisters": "30001-39999 (16-bit read-only registers)",
            "holdingRegisters": "40001-49999 (16-bit read/write registers)"
        }
    }
