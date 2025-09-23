import logging
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.services.snmp_service import (
    snmp_get_with_error_async_detailed,
    snmp_set_with_error_async_detailed,
)

logger = logging.getLogger(__name__)

router = APIRouter(
	prefix="/deploy",
	tags=["snmp"],
	responses={404: {"description": "Not found"}},
)


def _normalize_device_config(body: Dict[str, Any]) -> Dict[str, Any]:
	device = body.get("device", {})
	snmp = body.get("snmp", {})
	v3 = snmp.get("v3", {}) or {}

	return {
		"ip": device.get("ip") or device.get("ipAddress"),
		"port": device.get("port") or device.get("portNumber", 161),
		"community": snmp.get("community"),
		"snmpVersion": snmp.get("version", "v2c"),
		"snmpV3SecurityLevel": v3.get("securityLevel", "noAuthNoPriv"),
		"snmpV3Username": v3.get("username", ""),
		"snmpV3AuthProtocol": v3.get("authProtocol", ""),
		"snmpV3AuthPassword": v3.get("authPassword", ""),
		"snmpV3PrivProtocol": v3.get("privProtocol", ""),
		"snmpV3PrivPassword": v3.get("privPassword", ""),
		"snmpV3ContextName": v3.get("contextName", ""),
		"snmpV3ContextEngineId": v3.get("contextEngineId", ""),
	}


def _validate_payload(body: Dict[str, Any]):
	operation = body.get("operation", {})
	if not operation:
		raise HTTPException(status_code=400, detail="Missing operation")
	if not operation.get("oid"):
		raise HTTPException(status_code=400, detail="Missing operation.oid")
	if not operation.get("type"):
		raise HTTPException(status_code=400, detail="Missing operation.type")
	if "value" not in operation:
		raise HTTPException(status_code=400, detail="Missing operation.value")

	device = body.get("device", {})
	snmp = body.get("snmp", {})
	if not (device.get("ip") or device.get("ipAddress")):
		raise HTTPException(status_code=400, detail="Missing device IP address")
	if snmp.get("version") in ("v1", "v2c") and not snmp.get("community"):
		raise HTTPException(status_code=400, detail="Missing SNMP community for v1/v2c")
	if snmp.get("version") == "v3":
		v3 = (snmp.get("v3") or {})
		if not v3.get("username"):
			raise HTTPException(status_code=400, detail="Missing SNMPv3 username")


def _create_error_response(error_details: Optional[dict], error_message: str, http_status: int, operation: Dict[str, Any], elapsed_ms: int):
	"""Create standardized error response with enhanced SNMP error details"""
	
	response_data = {
		"success": False,
		"message": error_message,
		"written": {"oid": operation.get("oid"), "type": operation.get("type"), "value": operation.get("value")},
		"readback": {"verified": False},
		"elapsedMs": elapsed_ms,
	}
	
	# Add enhanced error details if available
	if error_details:
		response_data["errorDetails"] = {
			"errorCode": error_details.get("error_code"),
			"errorIndex": error_details.get("error_index"), 
			"verboseDescription": error_details.get("verbose_description"),
			"errorIndication": error_details.get("error_indication"),
		}
		
		# Remove None values to keep response clean
		response_data["errorDetails"] = {k: v for k, v in response_data["errorDetails"].items() if v is not None}
	
	return JSONResponse(response_data, status_code=http_status)


@router.post("/api/snmp/set")
async def snmp_set(body: Dict[str, Any]):
	"""
	Perform an SNMP SET operation with enhanced error handling.

	Note: For first delivery, we perform a write via CLI snmpset or pysnmp,
	then optionally verify with a GET for readability. Enhanced error handling
	provides detailed SNMP error codes and descriptions.
	"""
	start = time.time()
	_validate_payload(body)
	dev_config = _normalize_device_config(body)
	operation = body.get("operation", {})
	oid = operation.get("oid")
	value = operation.get("value")
	asn_type = operation.get("type")
	timeout_ms = int(operation.get("timeoutMs", 2000))
	retries = int(operation.get("retries", 1))
	verify = bool(operation.get("verify", True))
	timeout_s = timeout_ms // 1000  # Convert to seconds

	try:
		# Perform SNMP SET with enhanced error handling
		success, set_error, set_error_details, set_http_status = await snmp_set_with_error_async_detailed(
			dev_config, oid, asn_type, str(value), timeout_s, retries
		)

		readback = {"verified": False}
		if success and verify:
			# Verify via GET with enhanced error handling
			read_val, get_error, get_error_details, get_http_status = await snmp_get_with_error_async_detailed(
				dev_config, oid, timeout_s, retries
			)
			if read_val is not None:
				readback = {"verified": True, "value": read_val}
			else:
				readback = {
					"verified": False, 
					"error": get_error,
					"errorDetails": get_error_details if get_error_details else None
				}

		elapsed_ms = int((time.time() - start) * 1000)
		
		if success:
			return JSONResponse(
				{
					"success": True,
					"message": "SET OK",
					"written": {"oid": oid, "type": asn_type, "value": value},
					"readback": readback,
					"elapsedMs": elapsed_ms,
				}
			)
		else:
			# Use appropriate HTTP status code based on SNMP error
			http_status = set_http_status or status.HTTP_500_INTERNAL_SERVER_ERROR
			error_message = set_error or "SNMP SET failed"
			
			logger.error(f"[SNMP SET] FAILED for OID {oid}: {error_message}")
			if set_error_details and set_error_details.get('error_code') is not None:
				logger.error(f"[SNMP SET] Error Code {set_error_details['error_code']}: {set_error_details.get('verbose_description', 'Unknown error')}")
			
			return _create_error_response(set_error_details, error_message, http_status, operation, elapsed_ms)
			
	except HTTPException:
		# Re-raise validation errors
		raise
	except Exception as e:
		elapsed_ms = int((time.time() - start) * 1000)
		logger.exception(f"[SNMP SET] EXCEPTION for OID {oid}: {e}")
		
		# Create generic error details for unexpected exceptions
		error_details = {
			"error_message": str(e),
			"error_code": None,
			"error_index": None,
			"verbose_description": None,
			"error_indication": f"Unexpected exception: {str(e)}"
		}
		
		return _create_error_response(error_details, f"Unexpected error: {str(e)}", status.HTTP_500_INTERNAL_SERVER_ERROR, operation, elapsed_ms)


@router.get("/api/snmp/get/{oid}")
async def snmp_get(oid: str, ip: str, community: str = "public", version: str = "v2c", port: int = 161):
	"""
	Perform an SNMP GET operation with enhanced error handling.
	
	This endpoint provides detailed error information including SNMP error codes
	and verbose descriptions for debugging purposes.
	"""
	start = time.time()
	
	# Build device config from query parameters
	dev_config = {
		"ip": ip,
		"port": port,
		"community": community,
		"snmpVersion": version,
	}
	
	try:
		# Perform SNMP GET with enhanced error handling
		value, error, error_details, http_status = await snmp_get_with_error_async_detailed(dev_config, oid)
		
		elapsed_ms = int((time.time() - start) * 1000)
		
		if value is not None:
			return JSONResponse({
				"success": True,
				"message": "GET OK",
				"data": {
					"oid": oid,
					"value": value,
				},
				"elapsedMs": elapsed_ms,
			})
		else:
			# Use appropriate HTTP status code based on SNMP error
			http_status = http_status or status.HTTP_500_INTERNAL_SERVER_ERROR
			error_message = error or f"SNMP GET failed for OID {oid}"
			
			logger.error(f"[SNMP GET] FAILED for OID {oid}: {error_message}")
			if error_details and error_details.get('error_code') is not None:
				logger.error(f"[SNMP GET] Error Code {error_details['error_code']}: {error_details.get('verbose_description', 'Unknown error')}")
			
			response_data = {
				"success": False,
				"message": error_message,
				"data": {"oid": oid, "value": None},
				"elapsedMs": elapsed_ms,
			}
			
			# Add enhanced error details if available
			if error_details:
				response_data["errorDetails"] = {
					"errorCode": error_details.get("error_code"),
					"errorIndex": error_details.get("error_index"),
					"verboseDescription": error_details.get("verbose_description"),
					"errorIndication": error_details.get("error_indication"),
				}
				# Remove None values
				response_data["errorDetails"] = {k: v for k, v in response_data["errorDetails"].items() if v is not None}
			
			return JSONResponse(response_data, status_code=http_status)
			
	except Exception as e:
		elapsed_ms = int((time.time() - start) * 1000)
		logger.exception(f"[SNMP GET] EXCEPTION for OID {oid}: {e}")
		
		return JSONResponse({
			"success": False,
			"message": f"Unexpected error: {str(e)}",
			"data": {"oid": oid, "value": None},
			"elapsedMs": elapsed_ms,
			"errorDetails": {
				"errorIndication": f"Unexpected exception: {str(e)}"
			}
		}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/api/snmp/error-codes")
async def get_snmp_error_codes():
	"""
	Get a list of all standard SNMP error codes and their descriptions.
	
	This endpoint is useful for developers to understand what different
	SNMP error codes mean and how to handle them.
	"""
	from app.services.snmp_service import SNMP_ERROR_CODES
	
	return JSONResponse({
		"success": True,
		"message": "SNMP error codes retrieved successfully",
		"data": {
			"errorCodes": SNMP_ERROR_CODES,
			"description": "Standard SNMP Error Status Codes as defined in RFC 3416"
		}
	})
