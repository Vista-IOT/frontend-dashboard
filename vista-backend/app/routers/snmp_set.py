import logging
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.services.snmp_service import (
    snmp_get_with_error_async,
    snmp_set_with_error_async,
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


@router.post("/api/snmp/set")
async def snmp_set(body: Dict[str, Any]):
	"""
	Perform an SNMP SET operation.

	Note: For first delivery, we perform a write via CLI snmpset or pysnmp (to be implemented),
	then optionally verify with a GET for readability. Here, we stub with GET-based flow until
	set is implemented in snmp_service for symmetry with get.
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

	# Perform SNMP SET
	ok, set_err = await snmp_set_with_error_async(dev_config, oid, asn_type, str(value))

	readback = {"verified": False}
	if ok and verify:
		# Verify via GET
		read_val, get_err = await snmp_get_with_error_async(dev_config, oid)
		if get_err is None:
			readback = {"verified": True, "value": read_val}
		else:
			readback = {"verified": False, "error": get_err}

	elapsed_ms = int((time.time() - start) * 1000)
	if ok:
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
		return JSONResponse(
			{
				"success": False,
				"message": set_err or "SNMP SET failed",
				"written": {"oid": oid, "type": asn_type, "value": value},
				"readback": readback,
				"elapsedMs": elapsed_ms,
			},
			status_code=400,
		)


