# Updated to use centralized polling logger
import asyncio
from app.logging_config import get_polling_logger, get_error_logger, log_error_with_context
import logging
import subprocess
import time
import threading
from typing import Dict, Any, Optional, Union

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

async def snmp_get_pysnmp_detailed(device_config: Dict[str, Any], oid: str) -> (Optional[str], Optional[str]):
    """
    Execute SNMP GET using pysnmp library and return (value, error_message).
    """
    if not PYSNMP_AVAILABLE:
        return None, "pysnmp not available"
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

            if errorIndication:
                return None, f"pysnmp error: {errorIndication}"
            if errorStatus:
                return None, f"pysnmp error: {errorStatus.prettyPrint()} at index {errorIndex}"
            return str(varBinds[0][1]), None
        finally:
            if transport is not None:
                try:
                    await transport.close()
                except Exception:
                    pass
    except Exception as e:
        return None, f"pysnmp exception: {e}"

def snmp_get_command_line_detailed(device_config: Dict[str, Any], oid: str, timeout: int = 5, retries: int = 1) -> (Optional[str], Optional[str]):
    """
    Execute SNMP GET using command line tool and return (value, error_message).
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
            return raw_value, None
        # Build verbose error message
        stderr = (result.stderr or '').strip()
        stdout = (result.stdout or '').strip()
        msg = stderr or stdout or 'No response'
        return None, f"snmpget error: {msg}"
    except subprocess.TimeoutExpired:
        return None, "snmpget timeout: target did not respond in time"
    except Exception as e:
        return None, f"snmpget exception: {e}"

def snmp_get_with_error(device_config: Dict[str, Any], oid: str, timeout: int = 5, retries: int = 1) -> (Optional[str], Optional[str]):
    """
    Unified SNMP GET returning (value, error_message). Tries pysnmp then CLI.
    """
    # Try pysnmp first
    try:
        value = None
        error = None
        if PYSNMP_AVAILABLE:
            value, error = asyncio.run(snmp_get_pysnmp_detailed(device_config, oid))
            if value is not None:
                return value, None
        # Fallback to command line
        cli_value, cli_error = snmp_get_command_line_detailed(device_config, oid, timeout, retries)
        return cli_value, cli_error
    except Exception as e:
        return None, f"unified snmp_get error: {e}"

# Async variants for use inside FastAPI event loop
async def snmp_get_with_error_async(device_config: Dict[str, Any], oid: str, timeout: int = 5, retries: int = 1) -> (Optional[str], Optional[str]):
    try:
        if PYSNMP_AVAILABLE:
            val, err = await snmp_get_pysnmp_detailed(device_config, oid)
            if val is not None:
                return val, None
        # CLI fallback in executor to avoid blocking loop
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, snmp_get_command_line_detailed, device_config, oid, timeout, retries)
    except Exception as e:
        return None, f"unified snmp_get_async error: {e}"

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


async def snmp_set_pysnmp_detailed(device_config: Dict[str, Any], oid: str, asn_type: str, value: str) -> (bool, Optional[str]):
    """Perform SNMP SET via pysnmp; return (success, error)."""
    if not PYSNMP_AVAILABLE:
        return False, "pysnmp not available"
    try:
        snmp_version = device_config.get('snmpVersion', 'v2c')
        ip = device_config.get('ip')
        port = device_config.get('port', 161)

        var_bind_value = _map_asn_to_pysnmp_value(asn_type, value)
        if var_bind_value is None:
            return False, "pysnmp not available"

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

            if errorIndication:
                return False, f"pysnmp error: {errorIndication}"
            if errorStatus:
                return False, f"pysnmp error: {errorStatus.prettyPrint()} at index {errorIndex}"
            return True, None
        finally:
            if transport is not None:
                try:
                    await transport.close()
                except Exception:
                    pass
    except ValueError as ve:
        return False, str(ve)
    except Exception as e:
        return False, f"pysnmp exception: {e}"


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


def snmp_set_command_line_detailed(device_config: Dict[str, Any], oid: str, asn_type: str, value: str, timeout: int = 5, retries: int = 1) -> (bool, Optional[str]):
    """Execute snmpset and return (success, error)."""
    try:
        cmd = build_snmpset_command_line(device_config, oid, asn_type, value, timeout, retries)
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout + 5,
        )
        if result.returncode == 0:
            return True, None
        stderr = (result.stderr or '').strip()
        stdout = (result.stdout or '').strip()
        msg = stderr or stdout or 'No response'
        return False, f"snmpset error: {msg}"
    except subprocess.TimeoutExpired:
        return False, "snmpset timeout: target did not respond in time"
    except Exception as e:
        return False, f"snmpset exception: {e}"


def snmp_set_with_error(device_config: Dict[str, Any], oid: str, asn_type: str, value: str, timeout: int = 5, retries: int = 1) -> (bool, Optional[str]):
    """Unified SNMP SET: try pysnmp first, then CLI; returns (success, error)."""
    try:
        if PYSNMP_AVAILABLE:
            ok, err = asyncio.run(snmp_set_pysnmp_detailed(device_config, oid, asn_type, value))
            if ok:
                return True, None
        # Fallback to CLI
        return snmp_set_command_line_detailed(device_config, oid, asn_type, value, timeout, retries)
    except Exception as e:
        return False, f"unified snmp_set error: {e}"

async def snmp_set_with_error_async(device_config: Dict[str, Any], oid: str, asn_type: str, value: str, timeout: int = 5, retries: int = 1) -> (bool, Optional[str]):
    try:
        if PYSNMP_AVAILABLE:
            ok, err = await snmp_set_pysnmp_detailed(device_config, oid, asn_type, value)
            if ok:
                return True, None
        loop = asyncio.get_running_loop()
        ok, err = await loop.run_in_executor(None, snmp_set_command_line_detailed, device_config, oid, asn_type, value, timeout, retries)
        return ok, err
    except Exception as e:
        return False, f"unified snmp_set_async error: {e}"

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
                    
                    # Get SNMP value using unified function
                    raw_value = snmp_get(device_config, oid)
                    
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
                        results[tag_id] = {
                            "value": None,
                            "status": "snmp_get_failed",
                            "error": f"SNMP GET failed for OID {oid}",
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

