import asyncio
import logging
import time
import threading
from typing import Dict, Any, Optional, Union, List, Tuple
from datetime import datetime

# Try to import asyncua (OPC-UA async library), fall back gracefully if not available
try:
    from asyncua import Client, ua
    from asyncua.common.node import Node
    from asyncua.crypto.security_policies import SecurityPolicyBasic256Sha256, SecurityPolicyBasic256, SecurityPolicyBasic128Rsa15
    ASYNCUA_AVAILABLE = True
    logger = logging.getLogger(__name__)
    logger.info("asyncua library loaded successfully")
except ImportError as e:
    ASYNCUA_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning(f"asyncua library not available: {e}. OPC-UA functionality will be limited.")

logger = logging.getLogger(__name__)

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


async def discover_endpoints(server_url: str) -> List[str]:
    """
    Discover available endpoints on an OPC-UA server.
    
    Args:
        server_url: OPC-UA server URL
    
    Returns:
        List of discovered endpoint URLs
    """
    if not ASYNCUA_AVAILABLE:
        logger.error("asyncua library not available for endpoint discovery")
        return []
    
    try:
        async with Client(url=server_url) as client:
            endpoints = await client.get_endpoints()
            endpoint_urls = []
            
            for endpoint in endpoints:
                endpoint_urls.append(endpoint.EndpointUrl)
                logger.debug(f"Discovered endpoint: {endpoint.EndpointUrl}")
            
            return endpoint_urls
            
    except Exception as e:
        logger.error(f"Error discovering endpoints for {server_url}: {e}")
        return []


async def test_opcua_connection(device_config: OPCUADeviceConfig) -> Tuple[bool, Optional[str]]:
    """
    Test OPC-UA connection to a device.
    
    Args:
        device_config: OPC-UA device configuration
    
    Returns:
        Tuple of (success, error_message)
    """
    if not ASYNCUA_AVAILABLE:
        return False, "asyncua library not available"
    
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
        error_msg = f"OPC-UA connection test failed for {device_config.name}: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
        
    finally:
        if client:
            try:
                await client.disconnect()
            except Exception:
                pass


async def read_opcua_node(client: Client, node_id: str) -> Tuple[Any, Optional[str]]:
    """
    Read a single OPC-UA node value.
    
    Args:
        client: OPC-UA client instance
        node_id: Node ID to read
    
    Returns:
        Tuple of (value, error_message)
    """
    try:
        # Get node by ID
        node = client.get_node(node_id)
        
        # Read value
        value = await node.read_value()
        
        logger.debug(f"Successfully read OPC-UA node {node_id}: {value}")
        return value, None
        
    except Exception as e:
        error_msg = f"Error reading OPC-UA node {node_id}: {str(e)}"
        logger.error(error_msg)
        return None, error_msg


async def write_opcua_node(client: Client, node_id: str, value: Any, data_type: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """
    Write a value to an OPC-UA node.

    Args:
        client: OPC-UA client instance
        node_id: Node ID to write
        value: Value to write
        data_type: Optional data type hint

    Returns:
        Tuple of (success, error_message)
    """
    try:
        logger.info(f"[OPCUA CORE] Getting OPC-UA node for ID: {node_id}")
        # Get node by ID
        node = client.get_node(node_id)
        
        logger.info(f"[OPCUA CORE] Original value: {value}, Data type: {data_type}")
        # Convert value if data type is specified
        converted_value = value
        if data_type:
            converted_value = convert_value_for_opcua(value, data_type)
        
        logger.info(f"[OPCUA CORE] Converted value: {converted_value} (type: {type(converted_value)})")
        logger.info(f"[OPCUA CORE] Writing value {converted_value} to node {node_id}...")
        
        # Write value
        await node.write_value(converted_value)
        
        logger.info(f"[OPCUA CORE] SUCCESS: Wrote value {converted_value} to OPC-UA node {node_id}")
        return True, None
        
    except Exception as e:
        error_msg = f"Error writing to OPC-UA node {node_id}: {str(e)}"
        logger.error(error_msg)
        return False, error_msg


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
    Poll OPC-UA device asynchronously.
    
    Args:
        device_config: Device configuration dictionary
        tags: List of tag configurations
        scan_time_ms: Scan time in milliseconds
    
    Returns:
        Dictionary of tag results
    """
    if not ASYNCUA_AVAILABLE:
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
                        logger.warning(f"Tag {tag_name} missing Node ID address")
                        results[tag_id] = {
                            "value": None,
                            "status": "missing_node_id",
                            "error": "No Node ID specified in tag address",
                            "timestamp": now,
                        }
                        continue
                    
                    # Read node value
                    raw_value, error = await read_opcua_node(client, node_id)
                    
                    if raw_value is not None and error is None:
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
                            "timestamp": now,
                        }
                    else:
                        error_msg = error or f"OPC-UA read failed for Node ID {node_id}"
                        logger.error(f"OPC-UA read failed for {tag_name} @ {node_id}: {error_msg}")
                        results[tag_id] = {
                            "value": None,
                            "status": "opcua_read_failed",
                            "error": error_msg,
                            "timestamp": now,
                        }
                
                # Wait for the next polling cycle
                await asyncio.sleep(scan_time_ms / 1000.0)
                
            except Exception as e:
                logger.error(f"Error in OPC-UA polling cycle for {device_name}: {e}")
                
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
                        "error": str(e),
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
        logger.exception(f"Exception in OPC-UA sync polling for device {device_config.get('name')}: {e}")
        # Update global storage with error
        with _latest_polled_values_lock:
            for tag in tags:
                tag_id = tag.get('id', 'UnknownTagID')
                _latest_polled_values[device_name][tag_id] = {
                    "value": None,
                    "status": "opcua_polling_error",
                    "error": str(e),
                    "timestamp": int(time.time()),
                }


async def poll_opcua_device_with_global_storage(device_config: Dict[str, Any], tags: List[Dict[str, Any]], scan_time_ms: int = 1000):
    """
    Poll OPC-UA device with global storage integration (similar to SNMP implementation).
    
    Args:
        device_config: Device configuration dictionary
        tags: List of tag configurations
        scan_time_ms: Scan time in milliseconds
    """
    if not ASYNCUA_AVAILABLE:
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
                        logger.warning(f"Tag {tag_name} missing Node ID address")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "missing_node_id",
                                "error": "No Node ID specified in tag address",
                                "timestamp": now,
                            }
                        continue
                    
                    # Read node value
                    raw_value, error = await read_opcua_node(client, node_id)
                    
                    if raw_value is not None and error is None:
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
                                "timestamp": now,
                            }
                    else:
                        error_msg = error or f"OPC-UA read failed for Node ID {node_id}"
                        logger.error(f"OPC-UA read failed for {tag_name} @ {node_id}: {error_msg}")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "opcua_read_failed",
                                "error": error_msg,
                                "timestamp": now,
                            }
                
                # Wait for the next polling cycle
                await asyncio.sleep(scan_time_ms / 1000.0)
                
            except Exception as e:
                logger.error(f"Error in OPC-UA polling cycle for {device_name}: {e}")
                
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
                            "error": str(e),
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


# Compatibility functions for external API calls
async def opcua_get_with_error_async(device_config: Dict[str, Any], node_id: str) -> Tuple[Any, Optional[str]]:
    """
    Read a single OPC-UA node with error handling (async version).
    """
    if not ASYNCUA_AVAILABLE:
        return None, "asyncua library not available"
    
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
        return None, f"OPC-UA read error: {str(e)}"
    
    finally:
        if client:
            try:
                await client.disconnect()
            except Exception:
                pass


def opcua_get_with_error(device_config: Dict[str, Any], node_id: str) -> Tuple[Any, Optional[str]]:
    """
    Read a single OPC-UA node with error handling (sync version).
    """
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(opcua_get_with_error_async(device_config, node_id))
        finally:
            loop.close()
    except Exception as e:
        return None, f"OPC-UA sync read error: {str(e)}"


async def opcua_set_with_error_async(device_config: Dict[str, Any], node_id: str, value: Any, data_type: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """
    Write a value to an OPC-UA node with error handling (async version).
    """
    if not ASYNCUA_AVAILABLE:
        return False, "asyncua library not available"
    
    opcua_config = OPCUADeviceConfig(device_config)
    client = None
    
    try:
        endpoint_url = opcua_config.get_endpoint_url()
        logger.info(f"[OPCUA SERVICE] Creating OPC-UA client for endpoint: {endpoint_url}")
        logger.info(f"[OPCUA SERVICE] Security Mode: {opcua_config.security_mode}, Auth Type: {opcua_config.auth_type}")
        client = Client(url=endpoint_url)
        logger.info(f"[OPCUA SERVICE] Client created successfully for {endpoint_url}")
        
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
        logger.info(f"[OPCUA SERVICE] Successfully connected to OPC-UA server: {endpoint_url}")
        logger.info(f"[OPCUA SERVICE] Attempting to write to node {node_id} with value {value}")
        return await write_opcua_node(client, node_id, value, data_type)
        
    except Exception as e:
        return False, f"OPC-UA write error: {str(e)}"
    
    finally:
        if client:
            try:
        endpoint_url = opcua_config.get_endpoint_url()
        logger.info(f"[OPCUA SERVICE] Creating OPC-UA client for endpoint: {endpoint_url}")
        logger.info(f"[OPCUA SERVICE] Security Mode: {opcua_config.security_mode}, Auth Type: {opcua_config.auth_type}")
                await client.disconnect()
            except Exception:
                pass


def opcua_set_with_error(device_config: Dict[str, Any], node_id: str, value: Any, data_type: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """
    Write a value to an OPC-UA node with error handling (sync version).
    """
    try:
        endpoint_url = opcua_config.get_endpoint_url()
        logger.info(f"[OPCUA SERVICE] Creating OPC-UA client for endpoint: {endpoint_url}")
        logger.info(f"[OPCUA SERVICE] Security Mode: {opcua_config.security_mode}, Auth Type: {opcua_config.auth_type}")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
        endpoint_url = opcua_config.get_endpoint_url()
        logger.info(f"[OPCUA SERVICE] Creating OPC-UA client for endpoint: {endpoint_url}")
        logger.info(f"[OPCUA SERVICE] Security Mode: {opcua_config.security_mode}, Auth Type: {opcua_config.auth_type}")
            return loop.run_until_complete(opcua_set_with_error_async(device_config, node_id, value, data_type))
        finally:
            loop.close()
    except Exception as e:
        return False, f"OPC-UA sync write error: {str(e)}"