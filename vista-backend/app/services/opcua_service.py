# Updated to use centralized polling logger and enhanced error handling
from app.logging_config import get_polling_logger, get_error_logger, log_error_with_context
from app.services.last_seen import update_last_successful_timestamp

import asyncio
import logging
import time
import threading
import re
from typing import Dict, Any, Optional, Union, List, Tuple
from datetime import datetime

# Try to import asyncua (OPC-UA async library), fall back gracefully if not available
try:
    from asyncua import Client, ua
    from asyncua.common.node import Node
    from asyncua.crypto.security_policies import SecurityPolicyBasic256Sha256, SecurityPolicyBasic256, SecurityPolicyBasic128Rsa15
    ASYNCUA_AVAILABLE = True
    logger = get_polling_logger()
    logger.info("asyncua library loaded successfully")
except ImportError as e:
    ASYNCUA_AVAILABLE = False
    logger = get_polling_logger()
    logger.warning(f"asyncua library not available: {e}. OPC-UA functionality will be limited.")

logger = get_polling_logger()

# OPC-UA Status Codes and Verbose Descriptions
# Standard OPC-UA Status Codes (based on OPC 10000-6 specification)
OPCUA_STATUS_CODES = {
    # Good status codes
    0x00000000: "Good: Operation completed successfully",
    0x00000001: "GoodLocalOverride: Value was provided locally",
    0x00000002: "GoodNoData: No data available but operation completed successfully",
    0x00000003: "GoodMoreData: More data available than could be returned",
    0x00000004: "GoodClamped: Value was clamped to limits",
    
    # Uncertain status codes  
    0x40000000: "Uncertain: Operation completed but result is uncertain",
    0x40020000: "UncertainLastUsableValue: Last known good value returned",
    0x40030000: "UncertainSensorNotAccurate: Sensor accuracy is questionable",
    0x40040000: "UncertainEngineering: Engineering units may not match physical units",
    0x40050000: "UncertainInitialValue: Initial value or configuration value",
    
    # Bad status codes - General
    0x80000000: "Bad: Operation failed",
    0x80010000: "BadUnexpectedError: An unexpected error occurred",
    0x80020000: "BadInternalError: An internal error occurred",
    0x80030000: "BadOutOfMemory: Not enough memory to complete operation",
    0x80040000: "BadResourceUnavailable: An operating system resource is not available",
    0x80050000: "BadCommunicationError: A low level communication error occurred",
    0x80060000: "BadEncodingError: Error decoding a message received from the server",
    0x80070000: "BadDecodingError: Error decoding a message sent to the server",
    0x80080000: "BadEncodingLimitsExceeded: Message encoding limits exceeded",
    0x80090000: "BadRequestTooLarge: Request message too large",
    0x800A0000: "BadResponseTooLarge: Response message too large",
    0x800B0000: "BadUnknownResponse: Unknown response received from server",
    0x800C0000: "BadTimeout: The operation timed out",
    
    # Bad status codes - Service specific
    0x80100000: "BadServiceUnsupported: Service is not supported",
    0x80110000: "BadShutdown: The operation was cancelled because the application is shutting down",
    0x80120000: "BadServerNotConnected: The operation could not complete because the client is not connected to a server",
    0x80130000: "BadServerHalted: The server has stopped and cannot process any requests",
    0x80140000: "BadNothingToDo: No processing could be done because there was nothing to process",
    0x80150000: "BadTooManyOperations: Too many operations provided",
    0x80160000: "BadDataTypeIdUnknown: The extension object cannot be (de)serialized because the data type id is not recognized",
    
    # Bad status codes - Security
    0x80170000: "BadCertificateInvalid: The certificate provided as a parameter is not valid",
    0x80180000: "BadSecurityChecksFailed: An error occurred verifying security",
    0x80190000: "BadCertificateTimeInvalid: The Certificate has expired or is not yet valid",
    0x801A0000: "BadCertificateIssuerTimeInvalid: An Issuer Certificate has expired or is not yet valid",
    0x801B0000: "BadCertificateHostNameInvalid: The HostName used to connect to a Server does not match a HostName in the Certificate",
    0x801C0000: "BadCertificateUriInvalid: The URI specified in the ApplicationDescription does not match the URI in the Certificate",
    0x801D0000: "BadCertificateUseNotAllowed: The Certificate may not be used for the requested operation",
    0x801E0000: "BadCertificateIssuerUseNotAllowed: The Issuer Certificate may not be used for the requested operation",
    0x801F0000: "BadCertificateUntrusted: The Certificate is not trusted",
    0x80200000: "BadCertificateRevocationUnknown: It was not possible to determine if the Certificate has been revoked",
    0x80210000: "BadCertificateIssuerRevocationUnknown: It was not possible to determine if the Issuer Certificate has been revoked",
    0x80220000: "BadCertificateRevoked: The certificate has been revoked",
    0x80230000: "BadCertificateIssuerRevoked: The issuer certificate has been revoked",
    
    # Bad status codes - Channel/Session
    0x80240000: "BadUserAccessDenied: User does not have permission to perform the requested operation",
    0x80250000: "BadIdentityTokenInvalid: The user identity token is not valid",
    0x80260000: "BadIdentityTokenRejected: The user identity token is valid but the server has rejected it",
    0x80270000: "BadSecureChannelIdInvalid: The specified secure channel ID is not valid",
    0x80280000: "BadInvalidTimestamp: The timestamp is outside the range allowed by the server",
    0x80290000: "BadNonceInvalid: The nonce does appear to be not a random value or it is not the correct length",
    0x802A0000: "BadSessionIdInvalid: The session id is not valid",
    0x802B0000: "BadSessionClosed: The session was closed by the client",
    0x802C0000: "BadSessionNotActivated: The session cannot be used because ActivateSession has not been called",
    
    # Bad status codes - Node operations
    0x80340000: "BadNodeIdInvalid: The syntax of the node id is not valid",
    0x80350000: "BadNodeIdUnknown: The node id refers to a node that does not exist in the server address space",
    0x80360000: "BadAttributeIdInvalid: The attribute is not supported for the specified Node",
    0x80370000: "BadIndexRangeInvalid: The syntax of the index range parameter is invalid",
    0x80380000: "BadIndexRangeNoData: No data exists within the range of indexes specified",
    0x80390000: "BadDataEncodingInvalid: The data encoding is invalid",
    0x803A0000: "BadDataEncodingUnsupported: The server does not support the requested data encoding for the node",
    0x803B0000: "BadNotReadable: The access level does not allow reading or subscribing to the node",
    0x803C0000: "BadNotWritable: The access level does not allow writing to the node",
    0x803D0000: "BadOutOfRange: The value was out of range",
    0x803E0000: "BadNotSupported: The requested operation is not supported",
    0x803F0000: "BadNotFound: A requested item was not found or a search operation ended without success",
    0x80400000: "BadObjectDeleted: The object cannot be used because it has been deleted",
    0x80410000: "BadNotImplemented: Requested operation is not implemented",
    0x80420000: "BadMonitoringModeInvalid: The monitoring mode is invalid",
    0x80430000: "BadMonitoredItemIdInvalid: The monitoring item id does not refer to a valid monitored item",
    0x80440000: "BadMonitoredItemFilterInvalid: The monitored item filter parameter is not valid",
    0x80450000: "BadMonitoredItemFilterUnsupported: The server does not support the requested monitored item filter",
    0x80460000: "BadFilterNotAllowed: A monitoring filter cannot be used in combination with the attribute specified",
    
    # Bad status codes - Type system
    0x80470000: "BadStructureMissing: A mandatory structured parameter was missing or null",
    0x80480000: "BadEventFilterInvalid: The event filter is not valid",
    0x80490000: "BadContentFilterInvalid: The content filter is not valid",
    0x804A0000: "BadFilterOperatorInvalid: An unrecognized operator was provided in a filter",
    0x804B0000: "BadFilterOperatorUnsupported: A valid operator was provided, but the server does not provide support for this filter operator",
    0x804C0000: "BadFilterOperandCountMismatch: The number of operands provided for the filter operator was less then expected for the operand provided",
    0x804D0000: "BadFilterOperandInvalid: The operand used in a content filter is not valid",
    0x804E0000: "BadFilterElementInvalid: The referenced element is not a valid element in the content filter",
    0x804F0000: "BadFilterLiteralInvalid: The referenced literal is not a valid value",
    
    # Bad status codes - Subscription/Publishing
    0x80500000: "BadSubscriptionIdInvalid: The subscription id is not valid",
    0x80510000: "BadRequestHeaderInvalid: The header for the request is missing or invalid",
    0x80520000: "BadTimestampsToReturnInvalid: The timestamps to return parameter is invalid",
    0x80530000: "BadRequestCancelledByClient: The request was cancelled by the client",
    0x80540000: "BadTooManyArguments: Too many arguments were provided",
}

# OPC-UA Security Error Codes
OPCUA_SECURITY_ERROR_CODES = {
    0x80550000: "BadSecurityPolicyRejected: The security policy does not meet the requirements set by the server",
    0x80560000: "BadSecurityModeRejected: The security mode does not meet the requirements set by the server",
    0x80570000: "BadSecurityModeInsufficient: The security mode specified by the client is not sufficient for the server",
    0x80580000: "BadCertificateChainIncomplete: The certificate chain is incomplete",
    0x80590000: "BadUserSignatureInvalid: The signature generated with the client certificate is missing or invalid",
    0x805A0000: "BadApplicationSignatureInvalid: The signature generated with the application certificate is missing or invalid",
    0x805B0000: "BadNoValidCertificates: The client did not provide at least one software certificate that is valid and meets the profile requirements",
    0x805C0000: "BadRequestTypeInvalid: The server does not support the type of request",
    0x805D0000: "BadTooManyMatches: Too many matches were found for the search criteria",
    0x805E0000: "BadQueryTooComplex: The query is too complex and cannot be processed by the server",
    0x805F0000: "BadNoMatch: No match found for the search criteria",
}

# OPC-UA Connection Error Codes
OPCUA_CONNECTION_ERROR_CODES = {
    1: "CONNECTION_TIMEOUT: Connection attempt timed out",
    2: "CONNECTION_REFUSED: Connection was refused by the server", 
    3: "NETWORK_UNREACHABLE: Network is unreachable",
    4: "HOST_UNREACHABLE: Host is unreachable",
    5: "DNS_RESOLUTION_FAILED: DNS name resolution failed",
    6: "SSL_HANDSHAKE_FAILED: SSL/TLS handshake failed",
    7: "AUTHENTICATION_FAILED: User authentication failed",
    8: "SESSION_CREATION_FAILED: Failed to create session",
    9: "ENDPOINT_NOT_FOUND: Requested endpoint not found",
    10: "PROTOCOL_VERSION_UNSUPPORTED: Protocol version not supported"
}

def get_opcua_status_verbose(status_code: int) -> str:
    """Get verbose description for OPC-UA status code"""
    # Handle both integer and hex representations
    if isinstance(status_code, str):
        try:
            status_code = int(status_code, 16) if status_code.startswith('0x') else int(status_code)
        except ValueError:
            return f"Invalid status code format: {status_code}"
    
    # Check main status codes first
    verbose = OPCUA_STATUS_CODES.get(status_code)
    if verbose:
        return verbose
    
    # Check security error codes
    verbose = OPCUA_SECURITY_ERROR_CODES.get(status_code)
    if verbose:
        return verbose
    
    # Check status code families
    if (status_code & 0xFF000000) == 0x00000000:
        return f"Good: Unknown good status (0x{status_code:08X})"
    elif (status_code & 0xFF000000) == 0x40000000:
        return f"Uncertain: Unknown uncertain status (0x{status_code:08X})" 
    elif (status_code & 0xFF000000) == 0x80000000:
        return f"Bad: Unknown bad status (0x{status_code:08X})"
    else:
        return f"Unknown OPC-UA status code: 0x{status_code:08X}"

def get_opcua_connection_error_verbose(error_code: int) -> str:
    """Get verbose description for OPC-UA connection error code"""
    return OPCUA_CONNECTION_ERROR_CODES.get(error_code, f"Unknown connection error code: {error_code}")

def format_opcua_error(status_code: int, verbose_description: str) -> str:
    """Format OPC-UA error in standardized format: (STATUS_CODE - ERROR_DESCRIPTION)"""
    if isinstance(status_code, int):
        return f"(0x{status_code:08X} - {verbose_description})"
    else:
        return f"({status_code} - {verbose_description})"

def extract_opcua_error_details(error_result, status_code=None, connection_error_code=None):
    """Extract detailed error information from OPC-UA responses and exceptions"""
    error_info = {
        'error_type': None,
        'status_code': None,
        'connection_error_code': None,
        'error_message': str(error_result),
        'verbose_description': None,
        'severity': 'error',
        'additional_info': {}
    }
    
    # Handle asyncua specific errors
    if hasattr(error_result, '__class__'):
        error_info['error_type'] = error_result.__class__.__name__
    
    # Handle explicit status code
    if status_code is not None:
        error_info['status_code'] = status_code
        error_info['verbose_description'] = get_opcua_status_verbose(status_code)
        
        # Determine severity based on status code
        if isinstance(status_code, int):
            if (status_code & 0xFF000000) == 0x00000000:
                error_info['severity'] = 'info'
            elif (status_code & 0xFF000000) == 0x40000000:
                error_info['severity'] = 'warning'
            elif (status_code & 0xFF000000) == 0x80000000:
                error_info['severity'] = 'error'
    
    # Handle connection error codes
    if connection_error_code is not None:
        error_info['connection_error_code'] = connection_error_code
        conn_desc = get_opcua_connection_error_verbose(connection_error_code)
        if error_info['verbose_description']:
            error_info['verbose_description'] += f"; Connection: {conn_desc}"
        else:
            error_info['verbose_description'] = f"Connection: {conn_desc}"
    
    # Try to extract error information from exception/error objects
    if hasattr(error_result, 'code'):
        # asyncua UaError objects
        status_code = getattr(error_result, 'code', None)
        if status_code:
            error_info['status_code'] = status_code
            error_info['verbose_description'] = get_opcua_status_verbose(status_code)
    
    # Try to extract status codes from error message strings
    error_str = str(error_result).lower()
    
    # Common OPC-UA error patterns
    # Check errno patterns first (more specific)
    if "errno 110" in error_str:
        error_info["status_code"] = 0x800C0000
        error_info["verbose_description"] = get_opcua_status_verbose(0x800C0000)
    elif "errno 111" in error_str:
        error_info["status_code"] = 0x80120000
        error_info["verbose_description"] = get_opcua_status_verbose(0x80120000)
    elif "errno 113" in error_str or "connect call failed" in error_str:
        error_info["status_code"] = 0x80050000
        error_info["verbose_description"] = get_opcua_status_verbose(0x80050000)
    # Then check generic patterns
    elif "timeout" in error_str or "timed out" in error_str:
        error_info["status_code"] = 0x800C0000
        error_info["verbose_description"] = get_opcua_status_verbose(0x800C0000)
    elif "connection refused" in error_str or "refused" in error_str:
        error_info["status_code"] = 0x80120000
        error_info["verbose_description"] = get_opcua_status_verbose(0x80120000)
    elif "network" in error_str and "unreachable" in error_str:
        error_info["connection_error_code"] = 3
        error_info["verbose_description"] = get_opcua_connection_error_verbose(3)
    elif "host" in error_str and "unreachable" in error_str:
        error_info['connection_error_code'] = 4
        error_info['verbose_description'] = get_opcua_connection_error_verbose(4)
    elif 'dns' in error_str or 'name resolution' in error_str:
        error_info['connection_error_code'] = 5
        error_info['verbose_description'] = get_opcua_connection_error_verbose(5)
    elif 'ssl' in error_str or 'tls' in error_str:
        error_info['connection_error_code'] = 6
        error_info['verbose_description'] = get_opcua_connection_error_verbose(6)
    elif 'authentication' in error_str or 'auth' in error_str:
        error_info['connection_error_code'] = 7
        error_info['verbose_description'] = get_opcua_connection_error_verbose(7)
    elif 'session' in error_str:
        error_info['connection_error_code'] = 8
        error_info['verbose_description'] = get_opcua_connection_error_verbose(8)
    elif 'endpoint' in error_str:
        error_info['connection_error_code'] = 9
        error_info['verbose_description'] = get_opcua_connection_error_verbose(9)
    elif 'not supported' in error_str and 'version' in error_str:
        error_info['connection_error_code'] = 10
        error_info['verbose_description'] = get_opcua_connection_error_verbose(10)
    elif 'node' in error_str and ('unknown' in error_str or 'not found' in error_str):
        error_info['status_code'] = 0x80350000
        error_info['verbose_description'] = get_opcua_status_verbose(0x80350000)
    elif 'not readable' in error_str or 'access level' in error_str:
        error_info['status_code'] = 0x803B0000  
        error_info['verbose_description'] = get_opcua_status_verbose(0x803B0000)
    elif 'not writable' in error_str:
        error_info['status_code'] = 0x803C0000
        error_info['verbose_description'] = get_opcua_status_verbose(0x803C0000)
    elif 'out of range' in error_str:
        error_info['status_code'] = 0x803D0000
        error_info['verbose_description'] = get_opcua_status_verbose(0x803D0000)
    
    # Look for hex status codes in the error message
    hex_match = re.search(r'0x([0-9A-Fa-f]{8})', str(error_result))
    if hex_match:
        try:
            extracted_code = int(hex_match.group(1), 16)
            error_info['status_code'] = extracted_code
            if not error_info['verbose_description']:
                error_info['verbose_description'] = get_opcua_status_verbose(extracted_code)
        except ValueError:
            pass
    
    # If no specific error found, provide generic description
    if not error_info['verbose_description']:
        error_info['verbose_description'] = f"OPC-UA Error: {error_info['error_message']}"
    
    # Apply standardized formatting to verbose description
    if error_info.get("verbose_description") and (error_info.get("status_code") is not None or error_info.get("connection_error_code") is not None):
        # Use status code if available, otherwise use connection error code
        error_code = error_info.get("status_code") or error_info.get("connection_error_code")
        if error_code is not None:
            # Only format if not already formatted
            if not error_info["verbose_description"].startswith("("):
                error_info["verbose_description"] = format_opcua_error(error_code, error_info["verbose_description"])
    elif error_info.get("verbose_description") and not error_info["verbose_description"].startswith("("):
        # For generic errors, use a default error code
        error_info["verbose_description"] = format_opcua_error("UNKNOWN", error_info["verbose_description"])
    return error_info

def map_opcua_error_to_http_status(opcua_status_code: int = None, connection_error_code: int = None) -> int:
    """Map OPC-UA error codes to appropriate HTTP status codes"""
    
    # Handle connection errors first
    if connection_error_code:
        connection_mapping = {
            1: 408,  # CONNECTION_TIMEOUT -> Request Timeout
            2: 503,  # CONNECTION_REFUSED -> Service Unavailable  
            3: 503,  # NETWORK_UNREACHABLE -> Service Unavailable
            4: 503,  # HOST_UNREACHABLE -> Service Unavailable
            5: 502,  # DNS_RESOLUTION_FAILED -> Bad Gateway
            6: 495,  # SSL_HANDSHAKE_FAILED -> SSL Certificate Error (nginx extension)
            7: 401,  # AUTHENTICATION_FAILED -> Unauthorized
            8: 503,  # SESSION_CREATION_FAILED -> Service Unavailable
            9: 404,  # ENDPOINT_NOT_FOUND -> Not Found
            10: 505, # PROTOCOL_VERSION_UNSUPPORTED -> HTTP Version Not Supported
        }
        return connection_mapping.get(connection_error_code, 500)
    
    # Handle OPC-UA status codes
    if opcua_status_code:
        # Good status codes
        if (opcua_status_code & 0xFF000000) == 0x00000000:
            return 200  # OK
        
        # Uncertain status codes  
        elif (opcua_status_code & 0xFF000000) == 0x40000000:
            return 202  # Accepted (operation completed but result uncertain)
        
        # Bad status codes - map specific ones
        elif opcua_status_code in [0x80170000, 0x80180000, 0x80190000, 0x801A0000, 0x801B0000, 0x801C0000, 0x801D0000, 0x801E0000, 0x801F0000]:
            return 495  # SSL Certificate Error (certificate related)
        elif opcua_status_code in [0x80240000, 0x80250000, 0x80260000]:
            return 401  # Unauthorized (authentication/access denied)
        elif opcua_status_code in [0x80270000, 0x802A0000, 0x802B0000, 0x802C0000]:
            return 403  # Forbidden (session/channel issues)
        elif opcua_status_code in [0x80340000, 0x80350000, 0x803F0000]:
            return 404  # Not Found (node/item not found)
        elif opcua_status_code in [0x80360000, 0x80370000, 0x80390000, 0x803A0000]:
            return 400  # Bad Request (invalid parameters)
        elif opcua_status_code in [0x803B0000]:
            return 403  # Forbidden (not readable)
        elif opcua_status_code in [0x803C0000]:
            return 405  # Method Not Allowed (not writable)
        elif opcua_status_code in [0x803D0000]:
            return 400  # Bad Request (out of range)
        elif opcua_status_code in [0x803E0000, 0x80410000]:
            return 501  # Not Implemented (not supported/implemented)
        elif opcua_status_code in [0x800C0000]:
            return 408  # Request Timeout
        elif opcua_status_code in [0x80030000, 0x80040000, 0x80130000]:
            return 503  # Service Unavailable (resource/server issues)
        elif opcua_status_code in [0x80090000, 0x800A0000]:
            return 413  # Payload Too Large
        elif opcua_status_code in [0x80150000]:
            return 429  # Too Many Requests
        else:
            return 500  # Internal Server Error (generic bad status)
    
    # Default to Internal Server Error
    return 500

# Security policy mapping
SECURITY_POLICIES = {
    'Basic128Rsa15': SecurityPolicyBasic128Rsa15 if ASYNCUA_AVAILABLE else None,
    'Basic256': SecurityPolicyBasic256 if ASYNCUA_AVAILABLE else None,
    'Basic256Sha256': SecurityPolicyBasic256Sha256 if ASYNCUA_AVAILABLE else None,
}

# Security mode mapping  
SECURITY_MODES = {
    'None': ua.MessageSecurityMode.None_ if ASYNCUA_AVAILABLE else 0,
    'Sign': ua.MessageSecurityMode.Sign if ASYNCUA_AVAILABLE else 1,
    'SignAndEncrypt': ua.MessageSecurityMode.SignAndEncrypt if ASYNCUA_AVAILABLE else 2,
}

# User token type mapping
USER_TOKEN_TYPES = {
    'Anonymous': ua.UserTokenType.Anonymous if ASYNCUA_AVAILABLE else 0,
    'UsernamePassword': ua.UserTokenType.UserName if ASYNCUA_AVAILABLE else 1,
    'Certificate': ua.UserTokenType.Certificate if ASYNCUA_AVAILABLE else 2,
}

class OPCUADeviceConfig:
    """OPC-UA device configuration wrapper"""
    
    def __init__(self, device_config: Dict[str, Any]):
        self.device_config = device_config
        self.name = device_config.get('name', 'UnknownDevice')
        self.server_url = device_config.get('opcuaServerUrl', 'opc.tcp://localhost:4840')
        self.endpoint_selection = device_config.get('opcuaEndpointSelection')
        self.security_mode = device_config.get('opcuaSecurityMode', 'None')
        self.security_policy = device_config.get('opcuaSecurityPolicy', 'Basic256Sha256')
        self.auth_type = device_config.get('opcuaAuthType', 'Anonymous')
        self.username = device_config.get('opcuaUsername', '')
        self.password = device_config.get('opcuaPassword', '')
        self.client_cert_ref = device_config.get('opcuaClientCertRef')
        self.client_key_ref = device_config.get('opcuaClientKeyRef')
        self.accept_server_cert = device_config.get('opcuaAcceptServerCert', 'prompt')
        self.session_timeout = device_config.get('opcuaSessionTimeout', 60000)
        self.request_timeout = device_config.get('opcuaRequestTimeout', 5000)
        self.keep_alive_interval = device_config.get('opcuaKeepAliveInterval', 10000)
        self.reconnect_retries = device_config.get('opcuaReconnectRetries', 3)
        self.publishing_interval = device_config.get('opcuaPublishingInterval', 1000)
        self.sampling_interval = device_config.get('opcuaSamplingInterval', 1000)
        self.queue_size = device_config.get('opcuaQueueSize', 10)
        self.deadband_type = device_config.get('opcuaDeadbandType', 'None')
        self.deadband_value = device_config.get('opcuaDeadbandValue', 0)

    def get_endpoint_url(self) -> str:
        """Get the effective endpoint URL"""
        return self.endpoint_selection or self.server_url

async def discover_endpoints(server_url: str) -> Tuple[List[str], Optional[Dict]]:
    """
    Discover available endpoints on an OPC-UA server with enhanced error handling.
    
    Args:
        server_url: OPC-UA server URL
    
    Returns:
        Tuple of (endpoint URLs list, error_info dict)
    """
    if not ASYNCUA_AVAILABLE:
        error_info = extract_opcua_error_details("asyncua library not available for endpoint discovery")
        return [], error_info
    
    try:
        async with Client(url=server_url) as client:
            endpoints = await client.get_endpoints()
            endpoint_urls = []
            
            for endpoint in endpoints:
                endpoint_urls.append(endpoint.EndpointUrl)
                logger.debug(f"Discovered endpoint: {endpoint.EndpointUrl}")
            
            logger.info(f"Successfully discovered {len(endpoint_urls)} endpoints for {server_url}")
            return endpoint_urls, None
            
    except Exception as e:
        error_info = extract_opcua_error_details(e)
        logger.error(f"Error discovering endpoints for {server_url}: {error_info.get('verbose_description', str(e))}")
        return [], error_info

async def test_opcua_connection(device_config: OPCUADeviceConfig) -> Tuple[bool, Optional[Dict]]:
    """
    Test OPC-UA connection to a device with enhanced error handling.
    
    Args:
        device_config: OPC-UA device configuration
    
    Returns:
        Tuple of (success, error_info dict)
    """
    if not ASYNCUA_AVAILABLE:
        error_info = extract_opcua_error_details("asyncua library not available")
        return False, error_info
    
    client = None
    try:
        endpoint_url = device_config.get_endpoint_url()
        client = Client(url=endpoint_url)
        
        # Configure security
        if device_config.security_mode != 'None':
            security_policy = SECURITY_POLICIES.get(device_config.security_policy)
            security_mode = SECURITY_MODES.get(device_config.security_mode)
            
            if security_policy and security_mode:
                client.set_security(security_policy, security_mode)
        
        # Configure authentication
        if device_config.auth_type == 'UsernamePassword':
            client.set_user(device_config.username)
            client.set_password(device_config.password)
        elif device_config.auth_type == 'Certificate':
            # Certificate authentication would require loading cert files
            logger.warning("Certificate authentication not fully implemented")
        
        # Set timeouts
        client.session_timeout = device_config.session_timeout
        client.secure_channel_timeout = device_config.request_timeout
        
        # Test connection
        await client.connect()
        
        # Test basic read operation
        objects_node = client.get_objects_node()
        await objects_node.get_children()
        
        logger.info(f"OPC-UA connection test successful for {device_config.name}")
        return True, None
        
    except Exception as e:
        error_info = extract_opcua_error_details(e)
        logger.error(f"OPC-UA connection test failed for {device_config.name}: {error_info.get('verbose_description', str(e))}")
        return False, error_info
        
    finally:
        if client:
            try:
                await client.disconnect()
            except Exception:
                pass

async def read_opcua_node(client, node_id: str) -> Tuple[Any, Optional[Dict]]:
    """
    Read a single OPC-UA node value with enhanced error handling.
    
    Args:
        client: OPC-UA client instance
        node_id: Node ID to read
    
    Returns:
        Tuple of (value, error_info dict)
    """
    try:
        # Get node by ID
        node = client.get_node(node_id)
        
        # Read value and status
        data_value = await node.read_data_value()
        
        # Check status code
        if data_value.StatusCode and data_value.StatusCode.value != 0:
            error_info = extract_opcua_error_details(
                f"Bad status when reading node {node_id}",
                status_code=data_value.StatusCode.value
            )
            logger.warning(f"OPC-UA read warning for node {node_id}: {error_info.get('verbose_description')}")
            # Return value even with warnings for uncertain status codes
            if error_info.get('severity') == 'warning':
                return data_value.Value.Value if data_value.Value else None, error_info
            else:
                return None, error_info
        
        value = data_value.Value.Value if data_value.Value else None
        logger.debug(f"Successfully read OPC-UA node {node_id}: {value}")
        return value, None
        
    except Exception as e:
        error_info = extract_opcua_error_details(e)
        logger.error(f"Error reading OPC-UA node {node_id}: {error_info.get('verbose_description', str(e))}")
        return None, error_info

async def write_opcua_node(client, node_id: str, value: Any, data_type: Optional[str] = None) -> Tuple[bool, Optional[Dict]]:
    """
    Write a value to an OPC-UA node with enhanced error handling.
    
    Args:
        client: OPC-UA client instance
        node_id: Node ID to write
        value: Value to write
        data_type: Optional data type hint
    
    Returns:
        Tuple of (success, error_info dict)
    """
    try:
        # Get node by ID
        node = client.get_node(node_id)
        
        # Convert value if data type is specified
        converted_value = value
        if data_type:
            converted_value = convert_value_for_opcua(value, data_type)
        
        # Write value
        result = await node.write_value(converted_value)
        
        # Check if write operation returned a status code
        if hasattr(result, 'value') and result.value != 0:
            error_info = extract_opcua_error_details(
                f"Bad status when writing to node {node_id}",
                status_code=result.value
            )
            logger.error(f"OPC-UA write failed for node {node_id}: {error_info.get('verbose_description')}")
            return False, error_info
        
        logger.debug(f"Successfully wrote to OPC-UA node {node_id}: {converted_value}")
        return True, None
        
    except Exception as e:
        error_info = extract_opcua_error_details(e)
        logger.error(f"Error writing to OPC-UA node {node_id}: {error_info.get('verbose_description', str(e))}")
        return False, error_info

def convert_value_for_opcua(value: Any, data_type: str) -> Any:
    """
    Convert a value to the appropriate OPC-UA data type.
    
    Args:
        value: Value to convert
        data_type: Target data type
    
    Returns:
        Converted value
    """
    try:
        data_type = data_type.lower()
        
        if data_type in ['boolean', 'bool']:
            return bool(value)
        elif data_type in ['int16', 'short']:
            return int(value)
        elif data_type in ['uint16', 'ushort']:
            return int(value) if int(value) >= 0 else 0
        elif data_type in ['int32', 'int']:
            return int(value)
        elif data_type in ['uint32', 'uint']:
            return int(value) if int(value) >= 0 else 0
        elif data_type in ['float', 'single']:
            return float(value)
        elif data_type in ['double']:
            return float(value)
        elif data_type in ['string', 'str']:
            return str(value)
        else:
            logger.warning(f"Unknown OPC-UA data type '{data_type}', returning value as-is")
            return value
            
    except Exception as e:
        logger.error(f"Error converting value {value} to {data_type}: {e}")
        return value

async def poll_opcua_device_async(device_config: Dict[str, Any], tags: List[Dict[str, Any]], scan_time_ms: int = 1000) -> Dict[str, Any]:
    """
    Poll OPC-UA device asynchronously with enhanced error handling.
    
    Args:
        device_config: Device configuration dictionary
        tags: List of tag configurations
        scan_time_ms: Scan time in milliseconds
    
    Returns:
        Dictionary of tag results
    """
    if not ASYNCUA_AVAILABLE:
        error_info = extract_opcua_error_details("asyncua library not available for OPC-UA polling")
        logger.error("asyncua library not available for OPC-UA polling")
        return {}
    
    opcua_config = OPCUADeviceConfig(device_config)
    device_name = opcua_config.name
    
    logger.info(f"Starting OPC-UA polling for {device_name} at {opcua_config.get_endpoint_url()}")
    
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
    
    client = None
    reconnect_attempts = 0
    
    try:
        while True:
            current_thread = threading.current_thread()
            if hasattr(current_thread, '_stop_requested') and current_thread._stop_requested:
                logger.info(f"OPC-UA polling for {device_name} stopped by request")
                break
            
            try:
                # Connect if not already connected
                if client is None:
                    client = Client(url=opcua_config.get_endpoint_url())
                    
                    # Configure security
                    if opcua_config.security_mode != 'None':
                        security_policy = SECURITY_POLICIES.get(opcua_config.security_policy)
                        security_mode = SECURITY_MODES.get(opcua_config.security_mode)
                        
                        if security_policy and security_mode:
                            client.set_security(security_policy, security_mode)
                    
                    # Configure authentication
                    if opcua_config.auth_type == 'UsernamePassword':
                        client.set_user(opcua_config.username)
                        if hasattr(opcua_config, 'password') and opcua_config.password:
                            client.set_password(opcua_config.password)
                    
                    # Set timeouts
                    client.session_timeout = opcua_config.session_timeout
                    client.secure_channel_timeout = opcua_config.request_timeout
                    
                    # Connect to server
                    await client.connect()
                    logger.info(f"Connected to OPC-UA server {opcua_config.get_endpoint_url()}")
                    reconnect_attempts = 0
                
                # Poll each tag
                now = int(time.time())
                
                for tag in tags:
                    tag_id = tag.get('id', 'UnknownTagID')
                    tag_name = tag.get('name', 'UnknownTag')
                    node_id = tag.get('address')  # Using 'address' field for Node ID
                    
                    if not node_id:
                        error_info = extract_opcua_error_details("No Node ID specified in tag address")
                        logger.warning(f"Tag {tag_name} missing Node ID address")
                        results[tag_id] = {
                            "value": None,
                            "status": "missing_node_id",
                            "error": error_info.get('verbose_description'),
                            "error_details": error_info,
                            "timestamp": now,
                        }
                        # Update persistent last successful timestamp
                        update_last_successful_timestamp(device_name, tag_id, now)
                        continue
                    
                    # Read node value
                    raw_value, error_info = await read_opcua_node(client, node_id)
                    
                    if error_info is None:
                        # Apply scaling and offset if configured
                        scale = tag.get('scale', 1)
                        offset = tag.get('offset', 0)
                        
                        # Try to convert to numeric value for scaling
                        try:
                            if isinstance(raw_value, (int, float)):
                                final_value = (raw_value * scale) + offset
                            else:
                                # Keep as original type if not numeric
                                final_value = raw_value
                        except (TypeError, ValueError):
                            # Keep as string if conversion fails
                            final_value = raw_value
                        
                        logger.debug(f"OPC-UA {device_name} [{tag_name} @ {node_id}] = {final_value}")
                        
                        results[tag_id] = {
                            "value": final_value,
                            "status": "ok",
                            "error": None,
                            "error_details": None,
                            "timestamp": now,
                        }
                        # Update persistent last successful timestamp
                        update_last_successful_timestamp(device_name, tag_id, now)
                    else:
                        error_msg = error_info.get('verbose_description', f'OPC-UA read failed for Node ID {node_id}')
                        logger.error(f"OPC-UA read failed for {tag_name} @ {node_id}: {error_msg}")
                        results[tag_id] = {
                            "value": raw_value,  # Include value even if there are quality issues
                            "status": "opcua_read_failed",
                            "error": error_msg,
                            "error_details": error_info,
                            "timestamp": now,
                        }
                        # Update persistent last successful timestamp
                        update_last_successful_timestamp(device_name, tag_id, now)
                
                # Wait for the next polling cycle
                await asyncio.sleep(scan_time_ms / 1000.0)
                
            except Exception as e:
                error_info = extract_opcua_error_details(e)
                error_msg = error_info.get('verbose_description', str(e))
                logger.error(f"Error in OPC-UA polling cycle for {device_name}: {error_msg}")
                
                # Disconnect and reset client for reconnection attempt
                if client:
                    try:
                        await client.disconnect()
                    except Exception:
                        pass
                    client = None
                
                # Update all tag statuses with error
                now = int(time.time())
                for tag in tags:
                    tag_id = tag.get('id', 'UnknownTagID')
                    results[tag_id] = {
                        "value": None,
                        "status": "opcua_connection_error",
                        "error": error_msg,
                        "error_details": error_info,
                        "timestamp": now,
                    }
                
                # Implement reconnection logic
                reconnect_attempts += 1
                if reconnect_attempts <= opcua_config.reconnect_retries:
                    wait_time = min(5 * reconnect_attempts, 30)  # Exponential backoff, max 30s
                    logger.info(f"OPC-UA reconnection attempt {reconnect_attempts}/{opcua_config.reconnect_retries} for {device_name}, waiting {wait_time}s")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"Max reconnection attempts reached for {device_name}, waiting before retry")
                    await asyncio.sleep(60)  # Wait 60 seconds before trying again
                    reconnect_attempts = 0
    
    except Exception as e:
        logger.exception(f"Fatal error in OPC-UA polling for {device_name}: {e}")
    
    finally:
        if client:
            try:
                await client.disconnect()
                logger.info(f"Disconnected from OPC-UA server {opcua_config.get_endpoint_url()}")
            except Exception:
                pass
    
    return results

def poll_opcua_device_sync(device_config: Dict[str, Any], tags: List[Dict[str, Any]], scan_time_ms: int = 1000):
    """
    Synchronous wrapper for OPC-UA device polling that integrates with global polling storage.
    
    Args:
        device_config: Device configuration dictionary
        tags: List of tag configurations
        scan_time_ms: Scan time in milliseconds
    """
    if not ASYNCUA_AVAILABLE:
        error_info = extract_opcua_error_details("asyncua library not available for OPC-UA polling")
        logger.error("asyncua library not available for OPC-UA polling")
        return
    
    # Import global storage from polling service
    from app.services.polling_service import _latest_polled_values, _latest_polled_values_lock
    
    opcua_config = OPCUADeviceConfig(device_config)
    device_name = opcua_config.name
    
    logger.info(f"Starting OPC-UA polling for {device_name} at {opcua_config.get_endpoint_url()}")
    
    # Initialize device in global storage
    with _latest_polled_values_lock:
        if device_name not in _latest_polled_values:
            _latest_polled_values[device_name] = {}
        for tag in tags:
            tag_id = tag.get('id', 'UnknownTagID')
            _latest_polled_values[device_name][tag_id] = {
                "value": None,
                "status": "initializing",
                "error": None,
                "timestamp": int(time.time()),
            }
    
    try:
        # Run the async polling function in a new event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(poll_opcua_device_with_global_storage(device_config, tags, scan_time_ms))
        finally:
            loop.close()
    except Exception as e:
        error_info = extract_opcua_error_details(e)
        error_msg = error_info.get('verbose_description', str(e))
        logger.exception(f"Exception in OPC-UA sync polling for device {device_config.get('name')}: {error_msg}")
        # Update global storage with error
        with _latest_polled_values_lock:
            for tag in tags:
                tag_id = tag.get('id', 'UnknownTagID')
                _latest_polled_values[device_name][tag_id] = {
                    "value": None,
                    "status": "opcua_polling_error",
                    "error": error_msg,
                    "error_details": error_info,
                    "timestamp": int(time.time()),
                }

async def poll_opcua_device_with_global_storage(device_config: Dict[str, Any], tags: List[Dict[str, Any]], scan_time_ms: int = 1000):
    """
    Poll OPC-UA device with global storage integration and enhanced error handling.
    
    Args:
        device_config: Device configuration dictionary
        tags: List of tag configurations
        scan_time_ms: Scan time in milliseconds
    """
    if not ASYNCUA_AVAILABLE:
        error_info = extract_opcua_error_details("asyncua library not available for OPC-UA polling")
        logger.error("asyncua library not available for OPC-UA polling")
        return
    
    # Import global storage from polling service
    from app.services.polling_service import _latest_polled_values, _latest_polled_values_lock
    
    opcua_config = OPCUADeviceConfig(device_config)
    device_name = opcua_config.name
    
    logger.info(f"OPC-UA polling with global storage for {device_name} at {opcua_config.get_endpoint_url()}")
    
    client = None
    reconnect_attempts = 0
    
    try:
        while True:
            current_thread = threading.current_thread()
            if hasattr(current_thread, '_stop_requested') and current_thread._stop_requested:
                logger.info(f"OPC-UA polling for {device_name} stopped by request")
                break
            
            try:
                # Connect if not already connected
                if client is None:
                    client = Client(url=opcua_config.get_endpoint_url())
                    
                    # Configure security
                    if opcua_config.security_mode != 'None':
                        security_policy = SECURITY_POLICIES.get(opcua_config.security_policy)
                        security_mode = SECURITY_MODES.get(opcua_config.security_mode)
                        
                        if security_policy and security_mode:
                            client.set_security(security_policy, security_mode)
                    
                    # Configure authentication
                    if opcua_config.auth_type == 'UsernamePassword':
                        client.set_user(opcua_config.username)
                        if hasattr(opcua_config, 'password') and opcua_config.password:
                            client.set_password(opcua_config.password)
                    
                    # Set timeouts
                    client.session_timeout = opcua_config.session_timeout
                    client.secure_channel_timeout = opcua_config.request_timeout
                    
                    # Connect to server
                    await client.connect()
                    logger.info(f"Connected to OPC-UA server {opcua_config.get_endpoint_url()}")
                    reconnect_attempts = 0
                
                # Poll each tag
                now = int(time.time())
                
                for tag in tags:
                    tag_id = tag.get('id', 'UnknownTagID')
                    tag_name = tag.get('name', 'UnknownTag')
                    node_id = tag.get('address')  # Using 'address' field for Node ID
                    
                    if not node_id:
                        error_info = extract_opcua_error_details("No Node ID specified in tag address")
                        logger.warning(f"Tag {tag_name} missing Node ID address")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "missing_node_id",
                                "error": error_info.get('verbose_description'),
                                "error_details": error_info,
                                "timestamp": now,
                        }
                        # Update persistent last successful timestamp
                        update_last_successful_timestamp(device_name, tag_id, now)
                        continue
                    
                    # Read node value
                    raw_value, error_info = await read_opcua_node(client, node_id)
                    
                    if error_info is None:
                        # Apply scaling and offset if configured
                        scale = tag.get('scale', 1)
                        offset = tag.get('offset', 0)
                        
                        # Try to convert to numeric value for scaling
                        try:
                            if isinstance(raw_value, (int, float)):
                                final_value = (raw_value * scale) + offset
                            else:
                                # Keep as original type if not numeric
                                final_value = raw_value
                        except (TypeError, ValueError):
                            # Keep as string if conversion fails
                            final_value = raw_value
                        
                        logger.debug(f"OPC-UA {device_name} [{tag_name} @ {node_id}] = {final_value}")
                        
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": final_value,
                                "status": "ok",
                                "error": None,
                                "error_details": None,
                                "timestamp": now,
                        }
                        # Update persistent last successful timestamp
                        update_last_successful_timestamp(device_name, tag_id, now)
                    else:
                        error_msg = error_info.get('verbose_description', f'OPC-UA read failed for Node ID {node_id}')
                        logger.error(f"OPC-UA read failed for {tag_name} @ {node_id}: {error_msg}")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": raw_value,  # Include value even if there are quality issues
                                "status": "opcua_read_failed",
                                "error": error_msg,
                                "error_details": error_info,
                                "timestamp": now,
                        }
                        # Update persistent last successful timestamp
                        update_last_successful_timestamp(device_name, tag_id, now)
                
                # Wait for the next polling cycle
                await asyncio.sleep(scan_time_ms / 1000.0)
                
            except Exception as e:
                error_info = extract_opcua_error_details(e)
                error_msg = error_info.get('verbose_description', str(e))
                logger.error(f"Error in OPC-UA polling cycle for {device_name}: {error_msg}")
                
                # Disconnect and reset client for reconnection attempt
                if client:
                    try:
                        await client.disconnect()
                    except Exception:
                        pass
                    client = None
                
                # Update all tag statuses with error in global storage
                now = int(time.time())
                with _latest_polled_values_lock:
                    for tag in tags:
                        tag_id = tag.get('id', 'UnknownTagID')
                        _latest_polled_values[device_name][tag_id] = {
                            "value": None,
                            "status": "opcua_connection_error",
                            "error": error_msg,
                            "error_details": error_info,
                            "timestamp": now,
                        }
                        # Update persistent last successful timestamp
                        update_last_successful_timestamp(device_name, tag_id, now)
                
                # Implement reconnection logic
                reconnect_attempts += 1
                if reconnect_attempts <= opcua_config.reconnect_retries:
                    wait_time = min(5 * reconnect_attempts, 30)  # Exponential backoff, max 30s
                    logger.info(f"OPC-UA reconnection attempt {reconnect_attempts}/{opcua_config.reconnect_retries} for {device_name}, waiting {wait_time}s")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"Max reconnection attempts reached for {device_name}, waiting before retry")
                    await asyncio.sleep(60)  # Wait 60 seconds before trying again
                    reconnect_attempts = 0
    
    except Exception as e:
        logger.exception(f"Fatal error in OPC-UA polling for {device_name}: {e}")
    
    finally:
        if client:
            try:
                await client.disconnect()
                logger.info(f"Disconnected from OPC-UA server {opcua_config.get_endpoint_url()}")
            except Exception:
                pass

# Enhanced compatibility functions for external API calls
async def opcua_get_with_error_async(device_config: Dict[str, Any], node_id: str) -> Tuple[Any, Optional[Dict]]:
    """
    Read a single OPC-UA node with enhanced error handling (async version).
    """
    if not ASYNCUA_AVAILABLE:
        error_info = extract_opcua_error_details("asyncua library not available")
        return None, error_info
    
    opcua_config = OPCUADeviceConfig(device_config)
    client = None
    
    try:
        client = Client(url=opcua_config.get_endpoint_url())
        
        # Configure security and authentication (simplified for single reads)
        if opcua_config.security_mode != 'None':
            security_policy = SECURITY_POLICIES.get(opcua_config.security_policy)
            security_mode = SECURITY_MODES.get(opcua_config.security_mode)
            
            if security_policy and security_mode:
                client.set_security(security_policy, security_mode)
        
        if opcua_config.auth_type == 'UsernamePassword':
            client.set_user(opcua_config.username)
            if hasattr(opcua_config, 'password') and opcua_config.password:
                client.set_password(opcua_config.password)
        
        await client.connect()
        return await read_opcua_node(client, node_id)
        
    except Exception as e:
        error_info = extract_opcua_error_details(e)
        return None, error_info
    
    finally:
        if client:
            try:
                await client.disconnect()
            except Exception:
                pass

def opcua_get_with_error(device_config: Dict[str, Any], node_id: str) -> Tuple[Any, Optional[Dict]]:
    """
    Read a single OPC-UA node with enhanced error handling (sync version).
    """
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(opcua_get_with_error_async(device_config, node_id))
        finally:
            loop.close()
    except Exception as e:
        error_info = extract_opcua_error_details(e)
        return None, error_info

async def opcua_set_with_error_async(device_config: Dict[str, Any], node_id: str, value: Any, data_type: Optional[str] = None) -> Tuple[bool, Optional[Dict]]:
    """
    Write a value to an OPC-UA node with enhanced error handling (async version).
    """
    if not ASYNCUA_AVAILABLE:
        error_info = extract_opcua_error_details("asyncua library not available")
        return False, error_info
    
    opcua_config = OPCUADeviceConfig(device_config)
    client = None
    
    try:
        client = Client(url=opcua_config.get_endpoint_url())
        
        # Configure security and authentication (simplified for single writes)
        if opcua_config.security_mode != 'None':
            security_policy = SECURITY_POLICIES.get(opcua_config.security_policy)
            security_mode = SECURITY_MODES.get(opcua_config.security_mode)
            
            if security_policy and security_mode:
                client.set_security(security_policy, security_mode)
        
        if opcua_config.auth_type == 'UsernamePassword':
            client.set_user(opcua_config.username)
            if hasattr(opcua_config, 'password') and opcua_config.password:
                client.set_password(opcua_config.password)
        
        await client.connect()
        return await write_opcua_node(client, node_id, value, data_type)
        
    except Exception as e:
        error_info = extract_opcua_error_details(e)
        return False, error_info
    
    finally:
        if client:
            try:
                await client.disconnect()
            except Exception:
                pass

def opcua_set_with_error(device_config: Dict[str, Any], node_id: str, value: Any, data_type: Optional[str] = None) -> Tuple[bool, Optional[Dict]]:
    """
    Write a value to an OPC-UA node with enhanced error handling (sync version).
    """
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(opcua_set_with_error_async(device_config, node_id, value, data_type))
        finally:
            loop.close()
    except Exception as e:
        error_info = extract_opcua_error_details(e)
        return False, error_info
