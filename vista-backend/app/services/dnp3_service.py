import logging
import time
import threading
import socket
import struct
from typing import Dict, Any, Optional, Union, List, Tuple
from datetime import datetime
import asyncio

# Try to import pydnp3, fall back gracefully if not available
try:
    import pydnp3
    PYDNP3_AVAILABLE = True
    logger = logging.getLogger(__name__)
    logger.info("pydnp3 library loaded successfully")
except ImportError as e:
    PYDNP3_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning(f"pydnp3 library not available: {e}. Using simple TCP implementation for DNP3.")

logger = logging.getLogger(__name__)

# DNP3 Constants
DNP3_DEFAULT_PORT = 20000
DNP3_HEADER_SIZE = 10
DNP3_DATA_LINK_HEADER_SIZE = 10

# DNP3 Object Groups
DNP3_BINARY_INPUT = 1
DNP3_BINARY_OUTPUT = 10
DNP3_ANALOG_INPUT = 30
DNP3_ANALOG_OUTPUT = 40
DNP3_COUNTER = 20
DNP3_DOUBLE_BIT = 3

# DNP3 Point Type Mapping
POINT_TYPE_MAP = {
    'BI': DNP3_BINARY_INPUT,
    'BO': DNP3_BINARY_OUTPUT,
    'AI': DNP3_ANALOG_INPUT,
    'AO': DNP3_ANALOG_OUTPUT,
    'CTR': DNP3_COUNTER,
    'DBI': DNP3_DOUBLE_BIT,
}

class DNP3DeviceConfig:
    """DNP3 device configuration wrapper"""
    
    def __init__(self, device_config: Dict[str, Any]):
        self.device_config = device_config
        self.name = device_config.get('name', 'UnknownDevice')
        self.ip_address = device_config.get('dnp3IpAddress', '192.168.1.100')
        self.port = device_config.get('dnp3PortNumber', DNP3_DEFAULT_PORT)
        self.local_address = device_config.get('dnp3LocalAddress', 1)
        self.remote_address = device_config.get('dnp3RemoteAddress', 4)
        self.timeout_ms = device_config.get('dnp3TimeoutMs', 5000)
        self.retries = device_config.get('dnp3Retries', 3)
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/debugging"""
        return {
            'name': self.name,
            'ip_address': self.ip_address,
            'port': self.port,
            'local_address': self.local_address,
            'remote_address': self.remote_address,
            'timeout_ms': self.timeout_ms,
            'retries': self.retries,
        }

class SimpleDNP3Client:
    """Simple DNP3 client implementation for basic read operations"""
    
    def __init__(self, ip_address: str, port: int, local_address: int, remote_address: int, timeout: int = 5):
        self.ip_address = ip_address
        self.port = port
        self.local_address = local_address
        self.remote_address = remote_address
        self.timeout = timeout
        self.socket = None
        self.connected = False
        
    def connect(self) -> bool:
        """Connect to DNP3 outstation"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.ip_address, self.port))
            self.connected = True
            logger.debug(f"Connected to DNP3 outstation at {self.ip_address}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to DNP3 outstation: {e}")
            self.connected = False
            return False
            
    def disconnect(self):
        """Disconnect from DNP3 outstation"""
        if self.socket:
            try:
                self.socket.close()
            except Exception as e:
                logger.error(f"Error closing DNP3 socket: {e}")
            finally:
                self.socket = None
                self.connected = False
                
    def _create_read_request(self, group: int, variation: int, start_index: int, stop_index: int = None) -> bytes:
        """Create a DNP3 read request frame"""
        if stop_index is None:
            stop_index = start_index
            
        # Simplified DNP3 frame creation
        # This is a basic implementation - in production, use a proper DNP3 library
        
        # Data Link Layer Header (10 bytes)
        start_bytes = 0x0564  # Start bytes
        length = 0x05  # Minimum length
        control = 0x44  # Control byte
        dest = self.remote_address & 0xFFFF
        src = self.local_address & 0xFFFF
        crc = 0x0000  # CRC (simplified)
        
        # Application Layer
        app_control = 0xC0  # First fragment, final fragment, function code = READ (1)
        function_code = 0x01  # READ function
        
        # Object header
        obj_group = group
        obj_variation = variation
        qualifier = 0x06  # 16-bit start/stop
        
        # Pack the frame
        frame = struct.pack('<HBBHHH', start_bytes, length, control, dest, src, crc)
        frame += struct.pack('<BBB', app_control, function_code, 0)  # IIN (Internal Indication)
        frame += struct.pack('<BBB', obj_group, obj_variation, qualifier)
        frame += struct.pack('<HH', start_index, stop_index)
        
        return frame
        
    def read_point(self, point_type: str, point_index: int) -> Optional[Union[int, float, bool]]:
        """Read a single DNP3 point"""
        if not self.connected:
            if not self.connect():
                return None
                
        try:
            # Map point type to DNP3 object group
            group = POINT_TYPE_MAP.get(point_type.upper())
            if group is None:
                logger.error(f"Unknown DNP3 point type: {point_type}")
                return None
                
            # Create and send read request
            request = self._create_read_request(group, 1, point_index)  # Variation 1 (default)
            self.socket.send(request)
            
            # Read response (simplified)
            response = self.socket.recv(1024)
            if len(response) < DNP3_HEADER_SIZE:
                logger.error("Invalid DNP3 response received")
                return None
                
            # Parse response (simplified parsing)
            # In a real implementation, you would properly parse the DNP3 frame
            if len(response) > 20:  # Basic sanity check
                # For analog inputs, try to extract a value
                if point_type.upper() == 'AI':
                    # Extract 16-bit value (simplified)
                    if len(response) >= 22:
                        value = struct.unpack('<H', response[20:22])[0]
                        return float(value)
                elif point_type.upper() in ['BI', 'BO']:
                    # Extract binary value (simplified)
                    if len(response) >= 21:
                        value = response[20] & 0x01
                        return bool(value)
                        
            logger.warning(f"Could not parse DNP3 response for {point_type}.{point_index}")
            return None
            
        except Exception as e:
            logger.error(f"Error reading DNP3 point {point_type}.{point_index}: {e}")
            return None

class DNP3Service:
    """DNP3 service for device communication"""
    
    def __init__(self):
        self.clients = {}  # Cache of DNP3 clients
        
    def get_client(self, device_config: DNP3DeviceConfig) -> Optional[SimpleDNP3Client]:
        """Get or create a DNP3 client for the device"""
        client_key = f"{device_config.ip_address}:{device_config.port}"
        
        if client_key not in self.clients:
            self.clients[client_key] = SimpleDNP3Client(
                device_config.ip_address,
                device_config.port,
                device_config.local_address,
                device_config.remote_address,
                device_config.timeout_ms // 1000
            )
            
        return self.clients[client_key]
        
    def read_tag_value(self, device_config: DNP3DeviceConfig, tag_config: Dict[str, Any]) -> Tuple[Optional[Union[int, float, bool]], Optional[str]]:
        """Read a single tag value from DNP3 device"""
        try:
            client = self.get_client(device_config)
            if not client:
                return None, "Failed to create DNP3 client"
                
            # Parse DNP3 address (format: "AI.001", "BI.005", etc.)
            address = tag_config.get('address', '')
            if '.' not in address:
                return None, f"Invalid DNP3 address format: {address}"
                
            point_type, point_index_str = address.split('.', 1)
            try:
                point_index = int(point_index_str)
            except ValueError:
                return None, f"Invalid point index in address: {address}"
                
            # Read the point value
            value = client.read_point(point_type, point_index)
            if value is None:
                return None, f"Failed to read DNP3 point {address}"
                
            # Apply scaling if configured
            scale = tag_config.get('scale', 1)
            offset = tag_config.get('offset', 0)
            
            if isinstance(value, (int, float)):
                scaled_value = (value * scale) + offset
                
                # Apply clamping if configured
                if tag_config.get('clampToLow', False):
                    span_low = tag_config.get('spanLow', 0)
                    scaled_value = max(scaled_value, span_low)
                    
                if tag_config.get('clampToHigh', False):
                    span_high = tag_config.get('spanHigh', 1000)
                    scaled_value = min(scaled_value, span_high)
                    
                if tag_config.get('clampToZero', False) and scaled_value < 0:
                    scaled_value = 0
                    
                return scaled_value, None
            else:
                return value, None
                
        except Exception as e:
            logger.exception(f"Exception reading DNP3 tag {tag_config.get('name', 'unknown')}: {e}")
            return None, str(e)
            
    def test_connection(self, device_config: DNP3DeviceConfig) -> Tuple[bool, Optional[str]]:
        """Test connection to DNP3 device"""
        try:
            client = self.get_client(device_config)
            if client.connect():
                client.disconnect()
                return True, None
            else:
                return False, f"Failed to connect to {device_config.ip_address}:{device_config.port}"
        except Exception as e:
            return False, str(e)
            
    def cleanup_clients(self):
        """Clean up all DNP3 clients"""
        for client in self.clients.values():
            client.disconnect()
        self.clients.clear()

# Global service instance
dnp3_service = DNP3Service()

def dnp3_get_with_error(device_config: Dict[str, Any], tag_config: Dict[str, Any]) -> Tuple[Optional[Union[int, float, bool]], Optional[str]]:
    """Get DNP3 tag value with error handling (similar to snmp_get_with_error)"""
    try:
        dnp3_config = DNP3DeviceConfig(device_config)
        return dnp3_service.read_tag_value(dnp3_config, tag_config)
    except Exception as e:
        logger.exception(f"Error in dnp3_get_with_error: {e}")
        return None, str(e)

def dnp3_test_connection(device_config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """Test DNP3 connection (similar to SNMP/OPC-UA test functions)"""
    try:
        dnp3_config = DNP3DeviceConfig(device_config)
        return dnp3_service.test_connection(dnp3_config)
    except Exception as e:
        logger.exception(f"Error testing DNP3 connection: {e}")
        return False, str(e)

def poll_dnp3_device_sync(device_config: Dict[str, Any], tags: List[Dict[str, Any]], scan_time_ms: int = 2000):
    """Poll DNP3 device synchronously (similar to poll_snmp_device_sync)"""
    import subprocess
    import json
    
    try:
        device_id = device_config.get('id', 'UnknownID')
        device_name = device_config.get('name', 'UnknownDevice')
        dnp3_config = DNP3DeviceConfig(device_config)
        
        logger.info(
            f"Polling DNP3 device: id={device_id}, name={device_name}, "
            f"address={dnp3_config.ip_address}:{dnp3_config.port}, "
            f"local_addr={dnp3_config.local_address}, remote_addr={dnp3_config.remote_address}, "
            f"scan_time_ms={scan_time_ms}"
        )
        
        # This will be imported from polling_service to avoid circular import
        from app.services.polling_service import _latest_polled_values, _latest_polled_values_lock, ping_host
        
        # Initialize device in global storage
        with _latest_polled_values_lock:
            if device_name not in _latest_polled_values:
                _latest_polled_values[device_name] = {}
        
        # Check if device is reachable
        ping_ok, ping_err = ping_host(dnp3_config.ip_address)
        if not ping_ok:
            with _latest_polled_values_lock:
                for tag in tags:
                    tag_id = tag.get('id', 'UnknownTagID')
                    _latest_polled_values[device_name][tag_id] = {
                        "value": None,
                        "status": "ping_failed",
                        "error": ping_err or f"Device {dnp3_config.ip_address} is not reachable by ping.",
                        "timestamp": int(time.time()),
                    }
            logger.error(f"DNP3 Device {dnp3_config.ip_address} is not reachable by ping. Skipping polling.")
            return
        
        while True:
            # Check if stop was requested (for graceful shutdown)
            current_thread = threading.current_thread()
            if hasattr(current_thread, '_stop_requested') and current_thread._stop_requested:
                logger.info(f"DNP3 polling for {device_name} stopped by request")
                break
                
            try:
                now = int(time.time())
                
                # Poll each tag
                for tag in tags:
                    tag_id = tag.get('id', 'UnknownTagID')
                    tag_name = tag.get('name', 'UnknownTag')
                    address = tag.get('address')  # DNP3 point address (e.g., "AI.001")
                    
                    if not address:
                        logger.warning(f"Tag {tag_name} missing DNP3 address")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "missing_address",
                                "error": "No DNP3 address specified in tag",
                                "timestamp": now,
                            }
                        continue
                    
                    try:
                        # Read the DNP3 point value
                        raw_value, dnp3_error = dnp3_get_with_error(device_config, tag)
                        
                        if raw_value is not None:
                            logger.debug(f"DNP3 {device_name} [{tag_name} @ {address}] = {raw_value}")
                            
                            with _latest_polled_values_lock:
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": raw_value,
                                    "status": "ok",
                                    "error": None,
                                    "timestamp": now,
                                }
                        else:
                            error_msg = dnp3_error or f"DNP3 read failed for address {address}"
                            logger.error(f"DNP3 read failed for {tag_name} @ {address}: {error_msg}")
                            with _latest_polled_values_lock:
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "dnp3_read_failed",
                                    "error": error_msg,
                                    "timestamp": now,
                                }
                    
                    except Exception as e:
                        logger.error(f"Error polling DNP3 tag {tag_name}: {e}")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "dnp3_error",
                                "error": str(e),
                                "timestamp": now,
                            }
                
                # Wait for the next polling cycle
                time.sleep(scan_time_ms / 1000.0)
                
            except KeyboardInterrupt:
                logger.info(f"DNP3 polling for {device_name} interrupted by user")
                break
            except Exception as e:
                logger.exception(f"Unexpected error in DNP3 polling cycle for {device_name}: {e}")
                time.sleep(5)  # Wait 5 seconds before retrying
            
    except Exception as e:
        logger.exception(f"Exception in DNP3 polling thread for device {device_config.get('name')}: {e}")
    finally:
        # Cleanup DNP3 clients on thread exit
        try:
            dnp3_service.cleanup_clients()
        except Exception as e:
            logger.error(f"Error cleaning up DNP3 clients: {e}")
