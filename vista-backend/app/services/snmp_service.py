# Updated to use centralized polling logger
import asyncio
import re

from app.logging_config import get_polling_logger, get_error_logger, log_error_with_context
import logging
import subprocess
import time
import threading
from typing import Dict, Any, Optional, Union

# Initialize logger at module level
logger = get_polling_logger()

# SNMP Error Code Mappings and Enhanced Error Handling
# Standard SNMP Error Status Codes (RFC 3416)
SNMP_ERROR_CODES = {
    0: "noError: The request completed successfully",
    1: "tooBig: The response is too large to fit in a single SNMP message", 
    2: "noSuchName: The specified OID does not exist on the target device",
    3: "badValue: The value specified for the variable is invalid",
    4: "readOnly: Attempt to set the value of a read-only variable", 
    5: "genErr: A general error occurred during the operation",
    6: "noAccess: The variable is not accessible for the requested operation",
    7: "wrongType: The data type specified is incorrect for this variable",
    8: "wrongLength: The value length is inappropriate for this variable",
    9: "wrongEncoding: The value is incorrectly encoded",
    10: "wrongValue: The value is out of range or inappropriate",
    11: "noCreation: The variable cannot be created",
    12: "inconsistentValue: The value is inconsistent with other variables", 
    13: "resourceUnavailable: Required resources are not available",
    14: "commitFailed: The set operation could not be committed",
    15: "undoFailed: The set operation could not be undone",
    16: "authorizationError: Access denied due to authorization failure",
    17: "notWritable: The variable is not writable in its current state",
    18: "inconsistentName: The variable name is inconsistent"
}

def get_snmp_error_verbose(error_code: int) -> str:
    """Get verbose description for SNMP error code"""
    return SNMP_ERROR_CODES.get(error_code, f"Unknown SNMP error code: {error_code}")

def extract_snmp_error_details(error_result, error_indication=None, error_index=None):
    """Extract detailed error information from SNMP responses"""
    error_info = {
        'error_code': None,
        'error_index': None,
        'error_message': str(error_result),
        'verbose_description': None,
        'error_indication': None
    }
    
    # Handle pysnmp error objects
    if hasattr(error_result, 'errorStatus'):
        error_info['error_code'] = int(error_result.errorStatus)
        error_info['verbose_description'] = get_snmp_error_verbose(error_info['error_code'])
    
    if hasattr(error_result, 'errorIndex'):
        error_info['error_index'] = int(error_result.errorIndex)
    
    # Handle separate error indication and index (from pysnmp async calls)
    if error_indication is not None:
        error_info['error_indication'] = str(error_indication)
    
    if error_index is not None:
        error_info['error_index'] = int(error_index)
    
    # Try to extract error code from error string if not found in object
    if error_info['error_code'] is None:
        # Look for patterns like "errorStatus: 2" or similar
        error_str = str(error_result)
        code_match = re.search(r'errorStatus[:\s]+(\d+)', error_str, re.IGNORECASE)
        if code_match:
            error_info['error_code'] = int(code_match.group(1))
            error_info['verbose_description'] = get_snmp_error_verbose(error_info['error_code'])
    
    return error_info

def map_snmp_error_to_http_status(snmp_error_code: int) -> int:
    """Map SNMP error codes to appropriate HTTP status codes"""
    mapping = {
        0: 200,  # noError -> OK
        1: 413,  # tooBig -> Payload Too Large
        2: 404,  # noSuchName -> Not Found
        3: 400,  # badValue -> Bad Request
        4: 405,  # readOnly -> Method Not Allowed
        5: 500,  # genErr -> Internal Server Error
        6: 403,  # noAccess -> Forbidden
        7: 400,  # wrongType -> Bad Request
        8: 400,  # wrongLength -> Bad Request
        9: 400,  # wrongEncoding -> Bad Request
        10: 400, # wrongValue -> Bad Request
        11: 400, # noCreation -> Bad Request
        12: 400, # inconsistentValue -> Bad Request
        13: 503, # resourceUnavailable -> Service Unavailable
        14: 500, # commitFailed -> Internal Server Error
        15: 500, # undoFailed -> Internal Server Error
        16: 401, # authorizationError -> Unauthorized
        17: 405, # notWritable -> Method Not Allowed
        18: 400, # inconsistentName -> Bad Request
    }
    return mapping.get(snmp_error_code, 500)  # Default to Internal Server Error

def format_enhanced_snmp_error(error_details: dict, operation: str = "SNMP operation", oid: str = None) -> str:
    """Format a comprehensive SNMP error message with all available details"""
    parts = [f"{operation} failed"]
    
    if oid:
        parts.append(f" for OID {oid}")
    
    if error_details['error_code'] is not None:
        parts.append(f" [Error Code {error_details['error_code']}]")
    
    if error_details['verbose_description']:
        parts.append(f": {error_details['verbose_description']}")
    
    if error_details['error_index'] is not None:
        parts.append(f" (at index {error_details['error_index']})")
    
    if error_details['error_indication']:
        parts.append(f" - {error_details['error_indication']}")
    
    return "".join(parts)

# Try to import pysnmp, fall back gracefully if not available
try:
    from pysnmp.hlapi.v3arch.asyncio import (
        SnmpEngine,
        CommunityData,
        UdpTransportTarget,
        ContextData,
        ObjectType,
        ObjectIdentity,
        get_cmd,
        next_cmd,
        set_cmd,
    )
    from pysnmp.hlapi.v3arch import (
        UsmUserData,
        usmHMACMD5AuthProtocol,
        usmHMACSHAAuthProtocol,
        usmHMAC128SHA224AuthProtocol,
        usmHMAC192SHA256AuthProtocol,
        usmHMAC256SHA384AuthProtocol,
        usmHMAC384SHA512AuthProtocol,
        usmDESPrivProtocol,
        usmAesCfb128Protocol,
        usmAesCfb192Protocol,
        usmAesCfb256Protocol,
    )
    PYSNMP_AVAILABLE = True
    logger = get_polling_logger()
    logger.info("pysnmp library loaded successfully")
except ImportError as e:
    PYSNMP_AVAILABLE = False
    logger = get_polling_logger()
    logger.warning(f"pysnmp library not available: {e}. Falling back to command-line tools.")

logger = get_polling_logger()

# Protocol mapping for pysnmp (only if available)
if PYSNMP_AVAILABLE:
    AUTH_PROTOCOLS = {
        'MD5': usmHMACMD5AuthProtocol,
        'SHA1': usmHMACSHAAuthProtocol,
        'SHA224': usmHMAC128SHA224AuthProtocol,
        'SHA256': usmHMAC192SHA256AuthProtocol,
        'SHA384': usmHMAC256SHA384AuthProtocol,
        'SHA512': usmHMAC384SHA512AuthProtocol,
    }

    PRIV_PROTOCOLS = {
        'DES': usmDESPrivProtocol,
        'AES128': usmAesCfb128Protocol,
        'AES192': usmAesCfb192Protocol,
        'AES256': usmAesCfb256Protocol,
    }
else:
    AUTH_PROTOCOLS = {}
    PRIV_PROTOCOLS = {}

def build_snmp_command_line(device_config: Dict[str, Any], oid: str, timeout: int = 5, retries: int = 1) -> list:
    """
    Build SNMP command line arguments for subprocess execution.
    
    Args:
        device_config: Device configuration dictionary containing SNMP settings
        oid: OID to query
        timeout: Timeout in seconds
        retries: Number of retries
    
    Returns:
        List of command arguments for subprocess.run
    """
    try:
        snmp_version = device_config.get('snmpVersion', 'v2c')
        ip = device_config.get('ip')
        port = device_config.get('port', 161)
        
        # Base command
        cmd = ['snmpget']
        
        if snmp_version == 'v1':
            cmd.extend(['-v1'])
            community = device_config.get('community', 'public')
            cmd.extend(['-c', community])
            
        elif snmp_version == 'v2c':
            cmd.extend(['-v2c'])
            community = device_config.get('community', 'public')
            cmd.extend(['-c', community])
            
        elif snmp_version == 'v3':
            cmd.extend(['-v3'])
            
            # Security level
            security_level = device_config.get('snmpV3SecurityLevel', 'noAuthNoPriv')
            if security_level == 'noAuthNoPriv':
                cmd.extend(['-l', 'noAuthNoPriv'])
            elif security_level == 'authNoPriv':
                cmd.extend(['-l', 'authNoPriv'])
            elif security_level == 'authPriv':
                cmd.extend(['-l', 'authPriv'])
            
            # Username (required for v3)
            username = device_config.get('snmpV3Username', '')
            if username:
                cmd.extend(['-u', username])
            
            # Authentication protocol and password
            if security_level in ['authNoPriv', 'authPriv']:
                auth_protocol = device_config.get('snmpV3AuthProtocol', '')
                auth_password = device_config.get('snmpV3AuthPassword', '')
                
                if auth_protocol and auth_password:
                    # Map frontend protocols to net-snmp protocols
                    auth_map = {
                        'MD5': 'MD5',
                        'SHA1': 'SHA',
                        'SHA224': 'SHA-224',
                        'SHA256': 'SHA-256',
                        'SHA384': 'SHA-384',
                        'SHA512': 'SHA-512'
                    }
                    net_snmp_auth = auth_map.get(auth_protocol, auth_protocol)
                    cmd.extend(['-a', net_snmp_auth])
                    cmd.extend(['-A', auth_password])
            
            # Privacy protocol and password
            if security_level == 'authPriv':
                priv_protocol = device_config.get('snmpV3PrivProtocol', '')
                priv_password = device_config.get('snmpV3PrivPassword', '')
                
                if priv_protocol and priv_password:
                    # Map frontend protocols to net-snmp protocols
                    priv_map = {
                        'DES': 'DES',
                        'AES128': 'AES',
                        'AES192': 'AES-192',
                        'AES256': 'AES-256'
                    }
                    net_snmp_priv = priv_map.get(priv_protocol, priv_protocol)
                    cmd.extend(['-x', net_snmp_priv])
                    cmd.extend(['-X', priv_password])
            
            # Context name (optional)
            context_name = device_config.get('snmpV3ContextName', '')
            if context_name:
                cmd.extend(['-n', context_name])
            
            # Context engine ID (optional)
            context_engine_id = device_config.get('snmpV3ContextEngineId', '')
            if context_engine_id:
                cmd.extend(['-e', context_engine_id])
        
        # Common parameters
        cmd.extend(['-t', str(timeout)])
        cmd.extend(['-r', str(retries)])
        
        # Target
        cmd.append(f'{ip}:{port}')
        
        # OID
        cmd.append(oid)
        
        logger.debug(f"Built SNMP command for {snmp_version}: {' '.join(cmd)}")
        return cmd
        
    except Exception as e:
        logger.error(f"Error building SNMP command: {e}")
        # Fallback to basic v2c command
        return ['snmpget', '-v2c', '-c', 'public', '-t', str(timeout), '-r', str(retries), f'{ip}:{port}', oid]

def snmp_get_command_line(device_config: Dict[str, Any], oid: str, timeout: int = 5, retries: int = 1) -> Optional[str]:
    """
    Execute SNMP GET using command line tool (fallback method).
    
    Args:
        device_config: Device configuration dictionary
        oid: OID to query
        timeout: Timeout in seconds
        retries: Number of retries
    
    Returns:
        SNMP value as string or None if failed
    """
    try:
        cmd = build_snmp_command_line(device_config, oid, timeout, retries)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout + 5  # Add buffer for subprocess timeout
        )
        
        if result.returncode == 0 and result.stdout.strip():
            # Parse SNMP output
            output = result.stdout.strip()
            # Extract value from output like "SNMPv2-MIB::sysDescr.0 = STRING: Linux..."
            if '=' in output:
                value_part = output.split('=', 1)[1].strip()
                if ':' in value_part:
                    raw_value = value_part.split(':', 1)[1].strip()
                else:
                    raw_value = value_part
            else:
                raw_value = output
            
            logger.debug(f"SNMP GET {oid} = {raw_value}")
            return raw_value
        else:
            error_msg = f"SNMP GET failed for OID {oid}: {result.stderr.strip() if result.stderr else 'No response'}"
            logger.error(f"SNMP GET failed for {oid}: {error_msg}")
            return None
            
    except subprocess.TimeoutExpired:
        logger.error(f"SNMP GET timeout for OID {oid}")
        return None
    except Exception as e:
        logger.error(f"Error in SNMP GET for {oid}: {e}")
        return None

async def snmp_get_pysnmp(device_config: Dict[str, Any], oid: str) -> Optional[str]:
    """
    Execute SNMP GET using pysnmp library (preferred method).
    
    Args:
        device_config: Device configuration dictionary
        oid: OID to query
    
    Returns:
        SNMP value as string or None if failed
    """
    if not PYSNMP_AVAILABLE:
        logger.warning("pysnmp not available, skipping pysnmp attempt")
        return None

async def snmp_get_pysnmp_detailed(device_config: Dict[str, Any], oid: str) -> (Optional[str], Optional[str], Optional[dict]):
    """
    Execute SNMP GET using pysnmp library and return (value, error_message, error_details).
    """
    if not PYSNMP_AVAILABLE:
        return None, "pysnmp not available", None
    try:
        snmp_version = device_config.get('snmpVersion', 'v2c')
        ip = device_config.get('ip')
        port = device_config.get('port', 161)

        transport = None
        try:
            transport = await UdpTransportTarget.create((ip, port))

            if snmp_version in ['v1', 'v2c']:
                community = device_config.get('community', 'public')
                mp_model = 0 if snmp_version == 'v1' else 1
                errorIndication, errorStatus, errorIndex, varBinds = await get_cmd(
                    SnmpEngine(),
                    CommunityData(community, mpModel=mp_model),
                    transport,
                    ContextData(),
                    ObjectType(ObjectIdentity(oid)),
                )
            else:
                username = device_config.get('snmpV3Username', '')
                security_level = device_config.get('snmpV3SecurityLevel', 'noAuthNoPriv')
                usm_data = UsmUserData(username)
                if security_level in ['authNoPriv', 'authPriv']:
                    auth_protocol_name = device_config.get('snmpV3AuthProtocol', '')
                    auth_password = device_config.get('snmpV3AuthPassword', '')
                    if auth_protocol_name and auth_password:
                        auth_protocol = AUTH_PROTOCOLS.get(auth_protocol_name)
                        if auth_protocol:
                            usm_data = UsmUserData(username, authProtocol=auth_protocol, authKey=auth_password)
                if security_level == 'authPriv':
                    priv_protocol_name = device_config.get('snmpV3PrivProtocol', '')
                    priv_password = device_config.get('snmpV3PrivPassword', '')
                    if priv_protocol_name and priv_password:
                        priv_protocol = PRIV_PROTOCOLS.get(priv_protocol_name)
                        if priv_protocol:
                            usm_data = UsmUserData(
                                username,
                                authProtocol=usm_data.authProtocol,
                                authKey=usm_data.authKey,
                                privProtocol=priv_protocol,
                                privKey=priv_password,
                            )
                errorIndication, errorStatus, errorIndex, varBinds = await get_cmd(
                    SnmpEngine(),
                    usm_data,
                    transport,
                    ContextData(),
                    ObjectType(ObjectIdentity(oid)),
                )

            # Use enhanced error handling
            if errorIndication:
                error_details = extract_snmp_error_details(errorIndication, errorIndication, errorIndex)
                enhanced_error = format_enhanced_snmp_error(error_details, "SNMP GET", oid)
                return None, enhanced_error, error_details
            
            if errorStatus:
                error_details = extract_snmp_error_details(errorStatus, errorIndication, errorIndex)
                enhanced_error = format_enhanced_snmp_error(error_details, "SNMP GET", oid)
                return None, enhanced_error, error_details
            
            return str(varBinds[0][1]), None, None
        finally:
            if transport is not None:
                try:
                    await transport.close()
                except Exception:
                    pass
    except Exception as e:
        error_details = {'error_message': str(e), 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': str(e)}
        enhanced_error = format_enhanced_snmp_error(error_details, "SNMP GET", oid)
        return None, enhanced_error, error_details

def snmp_get_command_line_detailed(device_config: Dict[str, Any], oid: str, timeout: int = 5, retries: int = 1) -> (Optional[str], Optional[str], Optional[dict]):
    """
    Execute SNMP GET using command line tool and return (value, error_message, error_details).
    """
    try:
        cmd = build_snmp_command_line(device_config, oid, timeout, retries)
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout + 5,
        )
        if result.returncode == 0 and result.stdout.strip():
            output = result.stdout.strip()
            if '=' in output:
                value_part = output.split('=', 1)[1].strip()
                if ':' in value_part:
                    raw_value = value_part.split(':', 1)[1].strip()
                else:
                    raw_value = value_part
            else:
                raw_value = output
            return raw_value, None, None
        
        # Build enhanced error message from CLI output
        stderr = (result.stderr or '').strip()
        stdout = (result.stdout or '').strip()
        msg = stderr or stdout or 'No response'
        
        # Try to extract SNMP error codes from CLI error messages
        error_details = {'error_message': msg, 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': None}
        
        # Look for common SNMP CLI error patterns
        if 'no such name' in msg.lower() or 'no such object' in msg.lower():
            error_details['error_code'] = 2
            error_details['verbose_description'] = get_snmp_error_verbose(2)
        elif 'bad value' in msg.lower():
            error_details['error_code'] = 3
            error_details['verbose_description'] = get_snmp_error_verbose(3)
        elif 'timeout' in msg.lower():
            error_details['error_indication'] = 'Request timeout'
        elif 'authorization' in msg.lower() or 'authentication' in msg.lower():
            error_details['error_code'] = 16
            error_details['verbose_description'] = get_snmp_error_verbose(16)
        
        enhanced_error = format_enhanced_snmp_error(error_details, "SNMP GET", oid)
        return None, enhanced_error, error_details
        
    except subprocess.TimeoutExpired:
        error_details = {'error_message': 'Request timeout', 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': 'snmpget timeout: target did not respond in time'}
        enhanced_error = format_enhanced_snmp_error(error_details, "SNMP GET", oid)
        return None, enhanced_error, error_details
    except Exception as e:
        error_details = {'error_message': str(e), 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': f'snmpget exception: {e}'}
        enhanced_error = format_enhanced_snmp_error(error_details, "SNMP GET", oid)
        return None, enhanced_error, error_details

def snmp_get_with_error(device_config: Dict[str, Any], oid: str, timeout: int = 5, retries: int = 1) -> (Optional[str], Optional[str]):
    """
    Unified SNMP GET returning (value, error_message). Tries pysnmp then CLI.
    """
    # Try pysnmp first
    try:
        value = None
        error = None
        if PYSNMP_AVAILABLE:
            value, error, _ = asyncio.run(snmp_get_pysnmp_detailed(device_config, oid))
            if value is not None:
                return value, None
        # Fallback to command line
        cli_value, cli_error, _ = snmp_get_command_line_detailed(device_config, oid, timeout, retries)
        return cli_value, cli_error
    except Exception as e:
        return None, f"unified snmp_get error: {e}"

# Enhanced version with detailed error info
def snmp_get_with_error_detailed(device_config: Dict[str, Any], oid: str, timeout: int = 5, retries: int = 1) -> (Optional[str], Optional[str], Optional[dict], Optional[int]):
    """
    Unified SNMP GET returning (value, error_message, error_details, http_status_code).
    """
    try:
        value = None
        error = None
        error_details = None
        
        if PYSNMP_AVAILABLE:
            value, error, error_details = asyncio.run(snmp_get_pysnmp_detailed(device_config, oid))
            if value is not None:
                return value, None, None, 200
        
        # Fallback to command line if pysnmp failed or unavailable
        if value is None:
            cli_value, cli_error, cli_error_details = snmp_get_command_line_detailed(device_config, oid, timeout, retries)
            if cli_value is not None:
                return cli_value, None, None, 200
            else:
                error = cli_error
                error_details = cli_error_details
        
        # Determine HTTP status code from error details
        http_status = 500  # Default
        if error_details and error_details.get('error_code') is not None:
            http_status = map_snmp_error_to_http_status(error_details['error_code'])
        elif 'timeout' in (error or '').lower():
            http_status = 408  # Request Timeout
        elif 'authorization' in (error or '').lower() or 'authentication' in (error or '').lower():
            http_status = 401  # Unauthorized
        
        return None, error, error_details, http_status
        
    except Exception as e:
        error_details = {'error_message': str(e), 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': f'unified snmp_get error: {e}'}
        return None, f"unified snmp_get error: {e}", error_details, 500

# Async variants for use inside FastAPI event loop
async def snmp_get_with_error_async(device_config: Dict[str, Any], oid: str, timeout: int = 5, retries: int = 1) -> (Optional[str], Optional[str]):
    try:
        if PYSNMP_AVAILABLE:
            val, err, _ = await snmp_get_pysnmp_detailed(device_config, oid)
            if val is not None:
                return val, None
        # CLI fallback in executor to avoid blocking loop
        loop = asyncio.get_running_loop()
        cli_value, cli_error, _ = await loop.run_in_executor(None, snmp_get_command_line_detailed, device_config, oid, timeout, retries)
        return cli_value, cli_error
    except Exception as e:
        return None, f"unified snmp_get_async error: {e}"

async def snmp_get_with_error_async_detailed(device_config: Dict[str, Any], oid: str, timeout: int = 5, retries: int = 1) -> (Optional[str], Optional[str], Optional[dict], Optional[int]):
    """
    Enhanced async SNMP GET returning (value, error_message, error_details, http_status_code).
    """
    try:
        if PYSNMP_AVAILABLE:
            val, err, err_details = await snmp_get_pysnmp_detailed(device_config, oid)
            if val is not None:
                return val, None, None, 200
        else:
            err_details = None
        
        # CLI fallback in executor to avoid blocking loop
        loop = asyncio.get_running_loop()
        cli_value, cli_error, cli_error_details = await loop.run_in_executor(None, snmp_get_command_line_detailed, device_config, oid, timeout, retries)
        
        if cli_value is not None:
            return cli_value, None, None, 200
        
        # Determine appropriate error details and HTTP status
        error_details = err_details or cli_error_details
        error = err or cli_error
        
        http_status = 500  # Default
        if error_details and error_details.get('error_code') is not None:
            http_status = map_snmp_error_to_http_status(error_details['error_code'])
        elif 'timeout' in (error or '').lower():
            http_status = 408
        elif 'authorization' in (error or '').lower() or 'authentication' in (error or '').lower():
            http_status = 401
        
        return None, error, error_details, http_status
        
    except Exception as e:
        error_details = {'error_message': str(e), 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': f'unified snmp_get_async error: {e}'}
        return None, f"unified snmp_get_async error: {e}", error_details, 500

# -------------------------------
# SNMP SET Implementation
# -------------------------------

def _map_asn_to_pysnmp_value(asn_type: str, value: str):
    """Map friendly ASN type to pysnmp RFC1902 value instance."""
    try:
        from pysnmp.proto.rfc1902 import (
            Integer,
            OctetString,
            ObjectIdentifier,
            IpAddress,
            TimeTicks,
            Gauge32,
            Unsigned32,
        )
    except Exception:
        # If pysnmp not available, return None and let caller fallback to CLI
        return None

    t = (asn_type or "").lower()
    if t in ("integer", "integer32", "bool", "boolean"):
        # Booleans map to 1/2 per SNMP truth convention
        if t in ("bool", "boolean"):
            v = 1 if str(value).strip().lower() in ("true", "1", "yes", "on") else 2
            return Integer(v)
        return Integer(int(value))
    if t in ("unsigned", "unsigned32", "gauge", "gauge32"):
        return Unsigned32(int(value))
    if t in ("string", "octetstring", "octet-string"):
        return OctetString(str(value))
    if t in ("oid", "objectid", "objectidentifier"):
        return ObjectIdentifier(str(value))
    if t in ("timeticks", "time", "ticks"):
        return TimeTicks(int(value))
    if t in ("ipaddress", "ip"):
        return IpAddress(str(value))

    # Not supported (e.g., Float) -> raise to let caller report
    raise ValueError(f"Unsupported ASN type for SET: {asn_type}")


async def snmp_set_pysnmp_detailed(device_config: Dict[str, Any], oid: str, asn_type: str, value: str) -> (bool, Optional[str], Optional[dict]):
    """Perform SNMP SET via pysnmp; return (success, error, error_details)."""
    if not PYSNMP_AVAILABLE:
        return False, "pysnmp not available", None
    try:
        snmp_version = device_config.get('snmpVersion', 'v2c')
        ip = device_config.get('ip')
        port = device_config.get('port', 161)

        var_bind_value = _map_asn_to_pysnmp_value(asn_type, value)
        if var_bind_value is None:
            return False, "pysnmp not available", None

        transport = None
        try:
            transport = await UdpTransportTarget.create((ip, port))

            if snmp_version in ['v1', 'v2c']:
                community = device_config.get('community', 'public')
                mp_model = 0 if snmp_version == 'v1' else 1
                errorIndication, errorStatus, errorIndex, varBinds = await set_cmd(
                    SnmpEngine(),
                    CommunityData(community, mpModel=mp_model),
                    transport,
                    ContextData(),
                    ObjectType(ObjectIdentity(oid), var_bind_value),
                )
            else:
                username = device_config.get('snmpV3Username', '')
                security_level = device_config.get('snmpV3SecurityLevel', 'noAuthNoPriv')
                usm_data = UsmUserData(username)
                if security_level in ['authNoPriv', 'authPriv']:
                    auth_protocol_name = device_config.get('snmpV3AuthProtocol', '')
                    auth_password = device_config.get('snmpV3AuthPassword', '')
                    if auth_protocol_name and auth_password:
                        auth_protocol = AUTH_PROTOCOLS.get(auth_protocol_name)
                        if auth_protocol:
                            usm_data = UsmUserData(username, authProtocol=auth_protocol, authKey=auth_password)
                if security_level == 'authPriv':
                    priv_protocol_name = device_config.get('snmpV3PrivProtocol', '')
                    priv_password = device_config.get('snmpV3PrivPassword', '')
                    if priv_protocol_name and priv_password:
                        priv_protocol = PRIV_PROTOCOLS.get(priv_protocol_name)
                        if priv_protocol:
                            usm_data = UsmUserData(
                                username,
                                authProtocol=usm_data.authProtocol,
                                authKey=usm_data.authKey,
                                privProtocol=priv_protocol,
                                privKey=priv_password,
                            )
                errorIndication, errorStatus, errorIndex, varBinds = await set_cmd(
                    SnmpEngine(),
                    usm_data,
                    transport,
                    ContextData(),
                    ObjectType(ObjectIdentity(oid), var_bind_value),
                )

            # Use enhanced error handling
            if errorIndication:
                error_details = extract_snmp_error_details(errorIndication, errorIndication, errorIndex)
                enhanced_error = format_enhanced_snmp_error(error_details, "SNMP SET", oid)
                return False, enhanced_error, error_details
            
            if errorStatus:
                error_details = extract_snmp_error_details(errorStatus, errorIndication, errorIndex)
                enhanced_error = format_enhanced_snmp_error(error_details, "SNMP SET", oid)
                return False, enhanced_error, error_details
            
            return True, None, None
        finally:
            if transport is not None:
                try:
                    await transport.close()
                except Exception:
                    pass
    except ValueError as ve:
        error_details = {'error_message': str(ve), 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': str(ve)}
        return False, str(ve), error_details
    except Exception as e:
        error_details = {'error_message': str(e), 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': f'pysnmp exception: {e}'}
        enhanced_error = format_enhanced_snmp_error(error_details, "SNMP SET", oid)
        return False, enhanced_error, error_details


def build_snmpset_command_line(device_config: Dict[str, Any], oid: str, asn_type: str, value: str, timeout: int = 5, retries: int = 1) -> list:
    """Build snmpset CLI command."""
    # Reuse build_snmp_command_line up to target, then add oid type value
    base = build_snmp_command_line(device_config, oid, timeout, retries)
    # Convert first token 'snmpget' to 'snmpset'
    if base and base[0] == 'snmpget':
        base[0] = 'snmpset'
    # base already contains the OID at the end; remove it to append with type
    if base and base[-1] == oid:
        base = base[:-1]

    t = (asn_type or "").lower()
    type_token = None
    value_arg = str(value)
    if t in ("integer", "integer32", "bool", "boolean"):
        type_token = 'i'
        if t in ("bool", "boolean"):
            value_arg = '1' if str(value).strip().lower() in ("true", "1", "yes", "on") else '2'
    elif t in ("unsigned", "unsigned32", "gauge", "gauge32"):
        type_token = 'u'
    elif t in ("string", "octetstring", "octet-string"):
        type_token = 's'
    elif t in ("oid", "objectid", "objectidentifier"):
        type_token = 'o'
    elif t in ("timeticks", "time", "ticks"):
        type_token = 't'
    elif t in ("ipaddress", "ip"):
        type_token = 'a'
    else:
        raise ValueError(f"Unsupported ASN type for snmpset: {asn_type}")

    return [*base, oid, type_token, value_arg]


def snmp_set_command_line_detailed(device_config: Dict[str, Any], oid: str, asn_type: str, value: str, timeout: int = 5, retries: int = 1) -> (bool, Optional[str], Optional[dict]):
    """Execute snmpset and return (success, error, error_details)."""
    try:
        cmd = build_snmpset_command_line(device_config, oid, asn_type, value, timeout, retries)
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout + 5,
        )
        if result.returncode == 0:
            return True, None, None
        
        # Build enhanced error message from CLI output
        stderr = (result.stderr or '').strip()
        stdout = (result.stdout or '').strip()
        msg = stderr or stdout or 'No response'
        
        # Try to extract SNMP error codes from CLI error messages
        error_details = {'error_message': msg, 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': None}
        
        # Look for common SNMP CLI error patterns
        if 'no such name' in msg.lower() or 'no such object' in msg.lower():
            error_details['error_code'] = 2
            error_details['verbose_description'] = get_snmp_error_verbose(2)
        elif 'bad value' in msg.lower():
            error_details['error_code'] = 3
            error_details['verbose_description'] = get_snmp_error_verbose(3)
        elif 'read only' in msg.lower() or 'not-writable' in msg.lower():
            error_details['error_code'] = 4
            error_details['verbose_description'] = get_snmp_error_verbose(4)
        elif 'wrong type' in msg.lower():
            error_details['error_code'] = 7
            error_details['verbose_description'] = get_snmp_error_verbose(7)
        elif 'authorization' in msg.lower() or 'authentication' in msg.lower():
            error_details['error_code'] = 16
            error_details['verbose_description'] = get_snmp_error_verbose(16)
        elif 'timeout' in msg.lower():
            error_details['error_indication'] = 'Request timeout'
        
        enhanced_error = format_enhanced_snmp_error(error_details, "SNMP SET", oid)
        return False, enhanced_error, error_details
        
    except subprocess.TimeoutExpired:
        error_details = {'error_message': 'Request timeout', 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': 'snmpset timeout: target did not respond in time'}
        enhanced_error = format_enhanced_snmp_error(error_details, "SNMP SET", oid)
        return False, enhanced_error, error_details
    except Exception as e:
        error_details = {'error_message': str(e), 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': f'snmpset exception: {e}'}
        enhanced_error = format_enhanced_snmp_error(error_details, "SNMP SET", oid)
        return False, enhanced_error, error_details


def snmp_set_with_error(device_config: Dict[str, Any], oid: str, asn_type: str, value: str, timeout: int = 5, retries: int = 1) -> (bool, Optional[str]):
    """Unified SNMP SET: try pysnmp first, then CLI; returns (success, error)."""
    try:
        if PYSNMP_AVAILABLE:
            ok, err, _ = asyncio.run(snmp_set_pysnmp_detailed(device_config, oid, asn_type, value))
            if ok:
                return True, None
        # Fallback to CLI
        ok, err, _ = snmp_set_command_line_detailed(device_config, oid, asn_type, value, timeout, retries)
        return ok, err
    except Exception as e:
        return False, f"unified snmp_set error: {e}"

def snmp_set_with_error_detailed(device_config: Dict[str, Any], oid: str, asn_type: str, value: str, timeout: int = 5, retries: int = 1) -> (bool, Optional[str], Optional[dict], Optional[int]):
    """Enhanced SNMP SET: returns (success, error, error_details, http_status_code)."""
    try:
        success = False
        error = None
        error_details = None
        
        if PYSNMP_AVAILABLE:
            success, error, error_details = asyncio.run(snmp_set_pysnmp_detailed(device_config, oid, asn_type, value))
            if success:
                return True, None, None, 200
        
        # Fallback to CLI if pysnmp failed or unavailable
        if not success:
            cli_success, cli_error, cli_error_details = snmp_set_command_line_detailed(device_config, oid, asn_type, value, timeout, retries)
            if cli_success:
                return True, None, None, 200
            else:
                error = cli_error
                error_details = cli_error_details
        
        # Determine HTTP status code from error details
        http_status = 500  # Default
        if error_details and error_details.get('error_code') is not None:
            http_status = map_snmp_error_to_http_status(error_details['error_code'])
        elif 'timeout' in (error or '').lower():
            http_status = 408  # Request Timeout
        elif 'authorization' in (error or '').lower() or 'authentication' in (error or '').lower():
            http_status = 401  # Unauthorized
        
        return False, error, error_details, http_status
        
    except Exception as e:
        error_details = {'error_message': str(e), 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': f'unified snmp_set error: {e}'}
        return False, f"unified snmp_set error: {e}", error_details, 500

async def snmp_set_with_error_async(device_config: Dict[str, Any], oid: str, asn_type: str, value: str, timeout: int = 5, retries: int = 1) -> (bool, Optional[str]):
    try:
        if PYSNMP_AVAILABLE:
            ok, err, _ = await snmp_set_pysnmp_detailed(device_config, oid, asn_type, value)
            if ok:
                return True, None
        loop = asyncio.get_running_loop()
        ok, err, _ = await loop.run_in_executor(None, snmp_set_command_line_detailed, device_config, oid, asn_type, value, timeout, retries)
        return ok, err
    except Exception as e:
        return False, f"unified snmp_set_async error: {e}"

async def snmp_set_with_error_async_detailed(device_config: Dict[str, Any], oid: str, asn_type: str, value: str, timeout: int = 5, retries: int = 1) -> (bool, Optional[str], Optional[dict], Optional[int]):
    """Enhanced async SNMP SET: returns (success, error, error_details, http_status_code)."""
    try:
        if PYSNMP_AVAILABLE:
            ok, err, err_details = await snmp_set_pysnmp_detailed(device_config, oid, asn_type, value)
            if ok:
                return True, None, None, 200
        else:
            err_details = None
        
        loop = asyncio.get_running_loop()
        cli_ok, cli_err, cli_err_details = await loop.run_in_executor(None, snmp_set_command_line_detailed, device_config, oid, asn_type, value, timeout, retries)
        
        if cli_ok:
            return True, None, None, 200
        
        # Determine appropriate error details and HTTP status
        error_details = err_details or cli_err_details
        error = err or cli_err
        
        http_status = 500  # Default
        if error_details and error_details.get('error_code') is not None:
            http_status = map_snmp_error_to_http_status(error_details['error_code'])
        elif 'timeout' in (error or '').lower():
            http_status = 408
        elif 'authorization' in (error or '').lower() or 'authentication' in (error or '').lower():
            http_status = 401
        
        return False, error, error_details, http_status
        
    except Exception as e:
        error_details = {'error_message': str(e), 'error_code': None, 'error_index': None, 'verbose_description': None, 'error_indication': f'unified snmp_set_async error: {e}'}
        return False, f"unified snmp_set_async error: {e}", error_details, 500

def snmp_get(device_config: Dict[str, Any], oid: str, timeout: int = 5, retries: int = 1) -> Optional[str]:
    """Compatibility wrapper returning only the value."""
    value, _err = snmp_get_with_error(device_config, oid, timeout, retries)
    return value

def poll_snmp_device_sync(device_config: Dict[str, Any], tags: list, scan_time_ms: int = 60000) -> Dict[str, Any]:
    """
    Poll SNMP device using synchronous SNMP operations.
    
    Args:
        device_config: Device configuration dictionary
        tags: List of tag configurations
        scan_time_ms: Scan time in milliseconds
    
    Returns:
        Dictionary of tag results
    """
    device_name = device_config.get('name', 'UnknownDevice')
    ip = device_config.get('ip')
    port = device_config.get('port', 161)
    
    logger.info(f"Starting SNMP polling for {device_name} at {ip}:{port}")
    
    # Initialize results storage
    results = {}
    for tag in tags:
        tag_id = tag.get('id', 'UnknownTagID')
        results[tag_id] = {
            "value": None,
            "status": "initializing",
            "error": None,
            "timestamp": int(time.time()),
        }
    
    try:
        while True:
            current_thread = threading.current_thread()
            if hasattr(current_thread, '_stop_requested') and current_thread._stop_requested:
                logger.info(f"SNMP polling for {device_name} stopped by request")
                break
                
            try:
                now = int(time.time())
                
                # Poll each tag (OID)
                for tag in tags:
                    tag_id = tag.get('id', 'UnknownTagID')
                    tag_name = tag.get('name', 'UnknownTag')
                    oid = tag.get('address')  # Using 'address' field for OID
                    
                    if not oid:
                        logger.warning(f"Tag {tag_name} missing OID address")
                        results[tag_id] = {
                            "value": None,
                            "status": "missing_oid",
                            "error": "No OID specified in tag address",
                            "timestamp": now,
                        }
                        continue
                    
                    # Get SNMP value using enhanced function
                    raw_value, snmp_error, error_details, http_status = snmp_get_with_error_detailed(device_config, oid)
                    
                    if raw_value is not None:
                        # Apply scaling and offset if configured
                        scale = tag.get('scale', 1)
                        offset = tag.get('offset', 0)
                        
                        # Try to convert to numeric value for scaling
                        try:
                            numeric_value = float(raw_value)
                            final_value = (numeric_value * scale) + offset
                        except ValueError:
                            # Keep as string if not numeric
                            final_value = raw_value
                        
                        logger.debug(f"SNMP {device_name} [{tag_name} @ {oid}] = {final_value}")
                        
                        results[tag_id] = {
                            "value": final_value,
                            "status": "ok",
                            "error": None,
                            "timestamp": now,
                        }
                    else:
                        # Use enhanced error message if available
                        error_msg = snmp_error or f"SNMP GET failed for OID {oid}"
                        status_code = "snmp_get_failed"
                        
                        # Provide more specific status based on error details
                        if error_details and error_details.get('error_code') is not None:
                            error_code = error_details['error_code']
                            if error_code == 2:
                                status_code = "snmp_no_such_name"
                            elif error_code == 16:
                                status_code = "snmp_auth_error"
                            elif error_code in [3, 7, 8, 9, 10]:
                                status_code = "snmp_bad_value"
                            elif error_code == 4:
                                status_code = "snmp_read_only"
                            elif error_code in [13, 14, 15]:
                                status_code = "snmp_resource_error"
                        elif 'timeout' in (snmp_error or '').lower():
                            status_code = "snmp_timeout"
                        
                        logger.error(f"SNMP GET failed for {tag_name} @ {oid}: {error_msg}")
                        results[tag_id] = {
                            "value": None,
                            "status": status_code,
                            "error": error_msg,
                            "timestamp": now,
                        }
                
                # Wait for the next polling cycle
                time.sleep(scan_time_ms / 1000.0)
                
            except KeyboardInterrupt:
                logger.info(f"SNMP polling for {device_name} interrupted by user")
                break
            except Exception as e:
                logger.exception(f"Unexpected error in SNMP polling cycle for {device_name}: {e}")
                time.sleep(5)  # Wait 5 seconds before retrying
                
    except Exception as e:
        logger.exception(f"Fatal error in SNMP polling for {device_name}: {e}")
    
    return results

# Legacy async function for backward compatibility
async def poll_snmp_device(ip: str, oids: list, community: str = 'public', port: int = 161, scan_time_s: int = 60):
    """
    Legacy async SNMP polling function for backward compatibility.
    """
    device_config = {
        'ip': ip,
        'port': port,
        'community': community,
        'snmpVersion': 'v2c'
    }
    
    # Convert oids to tags format
    tags = [{'id': f'oid_{i}', 'name': f'OID_{i}', 'address': oid} for i, oid in enumerate(oids)]
    
    return poll_snmp_device_sync(device_config, tags, scan_time_s * 1000)
