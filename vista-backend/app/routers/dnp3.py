import logging
import time
from typing import Any, Dict, Optional, List

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.services.dnp3_service import (
    dnp3_set_with_error_async,
    dnp3_get_with_error,
    dnp3_test_connection,
    DNP3DeviceConfig,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/deploy",
    tags=["dnp3"],
    responses={404: {"description": "Not found"}},
)

def _normalize_device_config(body: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize device configuration from frontend format to service format"""
    device = body.get("device", {})
    
    return {
        "name": device.get("name", "UnknownDevice"),
        "dnp3IpAddress": device.get("dnp3IpAddress") or device.get("ip", "192.168.1.100"),
        "dnp3PortNumber": device.get("dnp3PortNumber") or device.get("port", 20000),
        "dnp3LocalAddress": device.get("dnp3LocalAddress", 1),
        "dnp3RemoteAddress": device.get("dnp3RemoteAddress", 4),
        "dnp3TimeoutMs": device.get("dnp3TimeoutMs", 5000),
        "dnp3Retries": device.get("dnp3Retries", 3),
    }

@router.post("/test-connection")
async def test_dnp3_connection(body: Dict[str, Any]):
    """Test DNP3 connection to verify device is reachable"""
    try:
        device_config = _normalize_device_config(body)
        
        logger.info(f"Testing DNP3 connection to {device_config['dnp3IpAddress']}:{device_config['dnp3PortNumber']}")
        
        # Test the connection
        success, error_msg = dnp3_test_connection(device_config)
        
        if success:
            return JSONResponse(
                content={
                    "success": True,
                    "message": f"Successfully connected to DNP3 device at {device_config['dnp3IpAddress']}:{device_config['dnp3PortNumber']}",
                    "data": {
                        "ip": device_config['dnp3IpAddress'],
                        "port": device_config['dnp3PortNumber'],
                        "local_address": device_config['dnp3LocalAddress'],
                        "remote_address": device_config['dnp3RemoteAddress'],
                        "response_time": "< 1000ms"  # Placeholder - could be measured
                    }
                }
            )
        else:
            return JSONResponse(
                content={
                    "success": False,
                    "error": error_msg or "Unknown connection error",
                    "data": None
                },
                status_code=400
            )
            
    except Exception as e:
        logger.exception(f"Error testing DNP3 connection: {e}")
        return JSONResponse(
            content={
                "success": False,
                "error": f"Connection test failed: {str(e)}",
                "data": None
            },
            status_code=500
        )

@router.post("/read-point")
async def read_dnp3_point(body: Dict[str, Any]):
    """Read a single DNP3 point for testing purposes"""
    try:
        device_config = _normalize_device_config(body)
        tag_config = body.get("tag", {})
        
        if not tag_config.get("address"):
            return JSONResponse(
                content={
                    "success": False,
                    "error": "Tag address is required (e.g., 'AI.001', 'BI.005')",
                    "data": None
                },
                status_code=400
            )
        
        logger.info(f"Reading DNP3 point {tag_config['address']} from {device_config['dnp3IpAddress']}:{device_config['dnp3PortNumber']}")
        
        # Read the point value
        value, error_msg = dnp3_get_with_error(device_config, tag_config)
        
        if value is not None:
            return JSONResponse(
                content={
                    "success": True,
                    "message": f"Successfully read DNP3 point {tag_config['address']}",
                    "data": {
                        "address": tag_config['address'],
                        "value": value,
                        "type": type(value).__name__,
                        "timestamp": int(time.time())
                    }
                }
            )
        else:
            return JSONResponse(
                content={
                    "success": False,
                    "error": error_msg or f"Failed to read DNP3 point {tag_config['address']}",
                    "data": None
                },
                status_code=400
            )
            
    except Exception as e:
        logger.exception(f"Error reading DNP3 point: {e}")
        return JSONResponse(
            content={
                "success": False,
                "error": f"Read operation failed: {str(e)}",
                "data": None
            },
            status_code=500
        )

@router.post("/read-multiple-points")
async def read_multiple_dnp3_points(body: Dict[str, Any]):
    """Read multiple DNP3 points for bulk testing"""
    try:
        device_config = _normalize_device_config(body)
        tags_config = body.get("tags", [])
        
        if not tags_config:
            return JSONResponse(
                content={
                    "success": False,
                    "error": "At least one tag configuration is required",
                    "data": None
                },
                status_code=400
            )
        
        results = []
        
        for tag_config in tags_config:
            tag_name = tag_config.get("name", "UnknownTag")
            tag_address = tag_config.get("address")
            
            if not tag_address:
                results.append({
                    "name": tag_name,
                    "address": tag_address,
                    "success": False,
                    "error": "Missing address",
                    "value": None
                })
                continue
            
            try:
                # Read the point value
                value, error_msg = dnp3_get_with_error(device_config, tag_config)
                
                if value is not None:
                    results.append({
                        "name": tag_name,
                        "address": tag_address,
                        "success": True,
                        "value": value,
                        "type": type(value).__name__,
                        "error": None
                    })
                else:
                    results.append({
                        "name": tag_name,
                        "address": tag_address,
                        "success": False,
                        "value": None,
                        "error": error_msg or f"Failed to read point {tag_address}"
                    })
            except Exception as e:
                results.append({
                    "name": tag_name,
                    "address": tag_address,
                    "success": False,
                    "value": None,
                    "error": str(e)
                })
        
        successful_reads = sum(1 for r in results if r["success"])
        
        return JSONResponse(
            content={
                "success": True,
                "message": f"Read {successful_reads}/{len(results)} DNP3 points successfully",
                "data": {
                    "total_points": len(results),
                    "successful_reads": successful_reads,
                    "failed_reads": len(results) - successful_reads,
                    "results": results,
                    "timestamp": int(time.time())
                }
            }
        )
        
    except Exception as e:
        logger.exception(f"Error reading multiple DNP3 points: {e}")
        return JSONResponse(
            content={
                "success": False,
                "error": f"Bulk read operation failed: {str(e)}",
                "data": None
            },
            status_code=500
        )

@router.get("/point-types")
async def get_dnp3_point_types():
    """Get supported DNP3 point types"""
    return JSONResponse(
        content={
            "success": True,
            "data": {
                "point_types": [
                    {"code": "AI", "name": "Analog Input", "description": "Analog measurement values"},
                    {"code": "AO", "name": "Analog Output", "description": "Analog control values"},
                    {"code": "BI", "name": "Binary Input", "description": "Digital status inputs"},
                    {"code": "BO", "name": "Binary Output", "description": "Digital control outputs"},
                    {"code": "CTR", "name": "Counter", "description": "Counter/accumulator values"},
                    {"code": "DBI", "name": "Double-bit Input", "description": "Double-bit status inputs"},
                ],
                "address_format": "TYPE.INDEX (e.g., AI.001, BI.010, AO.005)"
            }
        }
    )

def _validate_write_payload(body: Dict[str, Any]):
    """Validate the payload for DNP3 write operations"""
    # Validate device configuration
    device = body.get("device", {})
    if not device:
        raise HTTPException(status_code=400, detail="Missing device configuration")
    
    if not (device.get("dnp3IpAddress") or device.get("ip")):
        raise HTTPException(status_code=400, detail="Missing device IP address")
    
    # Validate operation
    operation = body.get("operation", {})
    if not operation:
        raise HTTPException(status_code=400, detail="Missing operation")
    
    if not operation.get("address"):
        raise HTTPException(status_code=400, detail="Missing operation.address (DNP3 point address)")
    
    if "value" not in operation:
        raise HTTPException(status_code=400, detail="Missing operation.value")

@router.post("/api/dnp3/write")
async def dnp3_write_point(body: Dict[str, Any]):
    """
    Perform a DNP3 WRITE operation to a specific point.
    
    Similar to SNMP SET and OPC-UA WRITE endpoints.
    """
    start = time.time()
    _validate_write_payload(body)
    
    try:
        device_config = _normalize_device_config(body)
        operation = body.get("operation", {})
        address = operation.get("address")
        value = operation.get("value")
        verify = bool(operation.get("verify", True))
        
        # Create tag config for the write operation
        tag_config = {
            "address": address,
            "name": f"WriteTarget_{address}",
            "scale": operation.get("scale", 1),
            "offset": operation.get("offset", 0)
        }
        
        logger.info(f"[DNP3 WRITE] Writing value {value} to point {address} on {device_config['dnp3IpAddress']}:{device_config['dnp3PortNumber']}")
        
        # Perform DNP3 write
        success, write_error = await dnp3_set_with_error_async(device_config, tag_config, value)
        
        readback = {"verified": False}
        if success and verify:
            # Verify the write by reading back the value
            read_value, read_error = dnp3_get_with_error(device_config, tag_config)
            if read_error is None and read_value is not None:
                readback = {"verified": True, "value": read_value}
            else:
                readback = {"verified": False, "error": read_error or "Failed to read back written value"}
        
        elapsed_ms = int((time.time() - start) * 1000)
        
        if success:
            logger.info(f"[DNP3 WRITE] SUCCESS: Wrote value {value} to point {address}")
            return JSONResponse(
                content={
                    "success": True,
                    "message": "DNP3 WRITE OK",
                    "written": {"address": address, "value": value},
                    "readback": readback,
                    "elapsedMs": elapsed_ms,
                }
            )
        else:
            logger.error(f"[DNP3 WRITE] FAILED: {write_error}")
            return JSONResponse(
                content={
                    "success": False,
                    "message": write_error or "DNP3 WRITE failed",
                    "written": {"address": address, "value": value},
                    "readback": readback,
                    "elapsedMs": elapsed_ms,
                },
                status_code=400,
            )
            
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        logger.exception(f"Error in DNP3 write operation: {e}")
        return JSONResponse(
            content={
                "success": False,
                "message": f"DNP3 write operation failed: {str(e)}",
                "written": None,
                "readback": {"verified": False},
                "elapsedMs": elapsed_ms,
            },
            status_code=500,
        )

@router.post("/write-point")
async def write_dnp3_point(body: Dict[str, Any]):
    """
    Write a value to a DNP3 point for testing purposes.
    Alternative endpoint with simpler payload structure.
    """
    try:
        device_config = _normalize_device_config(body)
        tag_config = body.get("tag", {})
        operation = body.get("operation", {})
        
        # Support both tag.address and operation.address formats
        address = tag_config.get("address") or operation.get("address")
        value = tag_config.get("value") or operation.get("value")
        
        if not address:
            return JSONResponse(
                content={
                    "success": False,
                    "error": "DNP3 address is required (e.g., 'AO.001', 'BO.005')",
                    "data": None
                },
                status_code=400
            )
        
        if value is None:
            return JSONResponse(
                content={
                    "success": False,
                    "error": "Value is required for DNP3 write operation",
                    "data": None
                },
                status_code=400
            )
        
        # Parse address to validate it's writable
        if '.' not in address:
            return JSONResponse(
                content={
                    "success": False,
                    "error": f"Invalid DNP3 address format: {address}. Use format like 'AO.001' or 'BO.005'",
                    "data": None
                },
                status_code=400
            )
        
        point_type = address.split('.')[0].upper()
        if point_type not in ['AO', 'BO']:
            return JSONResponse(
                content={
                    "success": False,
                    "error": f"Point type {point_type} is not writable. Only AO (Analog Output) and BO (Binary Output) points can be written.",
                    "data": None
                },
                status_code=400
            )
        
        logger.info(f"Writing DNP3 point {address} = {value} on {device_config['dnp3IpAddress']}:{device_config['dnp3PortNumber']}")
        
        # Prepare tag config for write
        write_tag_config = {
            "address": address,
            "name": f"WriteTest_{address}",
            "scale": tag_config.get("scale", 1),
            "offset": tag_config.get("offset", 0)
        }
        
        # Write the point value
        success, error_msg = await dnp3_set_with_error_async(device_config, write_tag_config, value)
        
        if success:
            return JSONResponse(
                content={
                    "success": True,
                    "message": f"Successfully wrote value {value} to DNP3 point {address}",
                    "data": {
                        "address": address,
                        "value": value,
                        "type": type(value).__name__,
                        "timestamp": int(time.time())
                    }
                }
            )
        else:
            return JSONResponse(
                content={
                    "success": False,
                    "error": error_msg or f"Failed to write to DNP3 point {address}",
                    "data": None
                },
                status_code=400
            )
            
    except Exception as e:
        logger.exception(f"Error writing DNP3 point: {e}")
        return JSONResponse(
            content={
                "success": False,
                "error": f"Write operation failed: {str(e)}",
                "data": None
            },
            status_code=500
        )

