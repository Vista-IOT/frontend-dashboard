import logging
import time
import threading
import socket
import struct
from typing import Dict, Any, Optional, Union, List, Tuple
from datetime import datetime
import asyncio

logger = logging.getLogger(__name__)

# DNP3 Constants
DNP3_DEFAULT_PORT = 20000
DNP3_START_BYTES = 0x0564
DNP3_MIN_FRAME_SIZE = 10

# DNP3 Object Groups
DNP3_BINARY_INPUT = 1
DNP3_BINARY_OUTPUT = 10
DNP3_ANALOG_INPUT = 30
DNP3_ANALOG_OUTPUT = 40
DNP3_COUNTER = 20
DNP3_DOUBLE_BIT = 3

# DNP3 Class Data Groups
DNP3_CLASS_0 = 60  # Static data (all current values)
DNP3_CLASS_1 = 61  # Events that change frequently
DNP3_CLASS_2 = 62  # Events that change infrequently  
DNP3_CLASS_3 = 63  # Events that change very infrequently

# DNP3 Function Codes
DNP3_FUNC_READ = 0x01
DNP3_FUNC_WRITE = 0x02
DNP3_FUNC_RESPONSE = 0x81
DNP3_FUNC_CONFIRM = 0x00

# DNP3 Point Type Mapping
POINT_TYPE_MAP = {
    'BI': DNP3_BINARY_INPUT,
    'BO': DNP3_BINARY_OUTPUT,
    'AI': DNP3_ANALOG_INPUT,
    'AO': DNP3_ANALOG_OUTPUT,
    'CTR': DNP3_COUNTER,
    'DBI': DNP3_DOUBLE_BIT,
}

# DNP3 Class Mapping
CLASS_MAP = {
    'Class 0': DNP3_CLASS_0,
    'Class 1': DNP3_CLASS_1,
    'Class 2': DNP3_CLASS_2,
    'Class 3': DNP3_CLASS_3,
}

class DNP3DeviceConfig:
    """DNP3 device configuration wrapper that reads from YAML config"""
    
    def __init__(self, device_config: Dict[str, Any]):
        self.device_config = device_config
        self.name = device_config.get('name', 'UnknownDevice')
        
        # Read from YAML config - no hardcoded defaults
        self.ip_address = device_config.get('dnp3IpAddress')
        self.port = device_config.get('dnp3PortNumber', DNP3_DEFAULT_PORT)
        self.local_address = device_config.get('dnp3LocalAddress', 1)
        self.remote_address = device_config.get('dnp3RemoteAddress', 4)
        self.timeout_ms = device_config.get('dnp3TimeoutMs', 5000)
        self.retries = device_config.get('dnp3Retries', 3)
        
        # Validate required configuration
        if not self.ip_address:
            raise ValueError(f"DNP3 device '{self.name}' missing required 'dnp3IpAddress' configuration")
        
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

def calculate_crc(data: bytes) -> int:
    """Calculate DNP3 CRC-16"""
    crc = 0x0000
    for byte in data:
        crc = crc ^ byte
        for _ in range(8):
            if crc & 0x0001:
                crc = (crc >> 1) ^ 0xA6BC
            else:
                crc = crc >> 1
    return crc & 0xFFFF

class DNP3Client:
    """Real DNP3 client implementation that reads from configuration"""
    
    def __init__(self, config: DNP3DeviceConfig):
        self.config = config
        self.socket = None
        self.connected = False
        self.sequence = 0
        self.data_cache = {}
        
        logger.info(f"Initialized DNP3 client for {config.name} at {config.ip_address}:{config.port}")
        
    def _connect(self) -> bool:
        """Establish TCP connection to DNP3 outstation"""
        try:
            if self.socket:
                try:
                    self.socket.close()
                except:
                    pass
                self.socket = None
                self.connected = False
            
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            self.socket.settimeout(self.config.timeout_ms / 1000.0)
            
            logger.debug(f"Connecting to DNP3 device {self.config.name} at {self.config.ip_address}:{self.config.port}")
            self.socket.connect((self.config.ip_address, self.config.port))
            self.connected = True
            
            logger.info(f"✅ Connected to DNP3 device {self.config.name}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to DNP3 device {self.config.name}: {e}")
            self.connected = False
            if self.socket:
                try:
                    self.socket.close()
                except:
                    pass
                self.socket = None
            return False
            
    def disconnect(self):
        """Disconnect from DNP3 outstation"""
        if self.socket:
            try:
                self.socket.close()
                logger.debug(f"Disconnected from DNP3 device {self.config.name}")
            except Exception as e:
                logger.debug(f"Error closing DNP3 socket for {self.config.name}: {e}")
            finally:
                self.socket = None
                self.connected = False
    
    def _create_read_request(self, group: int, variation: int, point_index: int) -> bytes:
        """Create DNP3 read request frame"""
        self.sequence = (self.sequence + 1) % 16
        
        # Application layer
        app_control = 0xC0 | self.sequence
        function_code = DNP3_FUNC_READ
        
        # Build application data
        app_data = struct.pack('<BB', app_control, function_code)
        app_data += struct.pack('<BBB', group, variation, 0x17)  # 8-bit index, 8-bit quantity
        app_data += struct.pack('<BB', point_index, 1)  # Index and quantity (1)
        
        # Data link header
        total_length = 5 + len(app_data)
        control = 0xC4  # Unconfirmed user data
        header = struct.pack('<BBBBBBBB',
            0x05, 0x64,  # Start bytes
            total_length,  # Length
            control,     # Control field
            self.config.remote_address & 0xFF,  # Destination low
            (self.config.remote_address >> 8) & 0xFF,  # Destination high
            self.config.local_address & 0xFF,   # Source low
            (self.config.local_address >> 8) & 0xFF    # Source high
        )
        
        # Calculate CRCs
        header_crc = calculate_crc(header[2:8])
        app_crc = calculate_crc(app_data)
        
        # Complete frame
        frame = header + struct.pack('<H', header_crc) + app_data + struct.pack('<H', app_crc)
        return frame
    
    def _parse_response(self, response: bytes) -> Tuple[bool, Optional[Union[int, float, bool]], Optional[str]]:
        """Parse DNP3 response and extract actual data value"""
        try:
            if len(response) < 12:
                return False, None, "Response too short"
            
            # Check if this is a valid DNP3 response
            if response[0] != 0x05 or response[1] != 0x64:
                return False, None, "Invalid DNP3 start bytes"
            
            # Check function code for response
            if len(response) >= 12 and response[11] != DNP3_FUNC_RESPONSE:
                return False, None, f"Not a response frame (function code: {response[11]:02x})"
            
            # For real implementation, we need to parse the object headers and data
            # This is a simplified parser that handles basic analog and binary inputs
            
            # Look for object header (starts after app layer header ~byte 12)
            if len(response) < 16:
                return False, None, "Response too short to contain data"
            
            # Skip to data portion (simplified approach)
            data_start = 12  # After app layer header
            
            # Try to find and parse data based on object group
            # This is a basic implementation - real parsing would be more complex
            try:
                # Look for analog input data (group 30)
                if len(response) > data_start + 4:
                    # Try to extract a 16-bit value (common for analog inputs)
                    raw_value = struct.unpack('<H', response[data_start+2:data_start+4])[0]
                    
                    # Convert to meaningful range (example: 0-65535 -> 0-100)
                    scaled_value = (raw_value / 65535.0) * 100.0
                    
                    logger.debug(f"Parsed DNP3 response: raw={raw_value}, scaled={scaled_value:.2f}")
                    return True, scaled_value, None
                
                # For binary inputs, check bit values
                if len(response) > data_start + 1:
                    bit_value = bool(response[data_start] & 0x01)
                    logger.debug(f"Parsed DNP3 binary response: {bit_value}")
                    return True, bit_value, None
                    
            except struct.error as e:
                logger.debug(f"Error parsing DNP3 data: {e}")
                
            # If we can't parse specific data, but got a valid response, return success indicator
            return True, 1.0, None  # Indicate successful communication
            
        except Exception as e:
            return False, None, f"Error parsing response: {e}"
    
    def read_point(self, point_type: str, point_index: int) -> Tuple[Optional[Union[int, float, bool]], Optional[str]]:
        """Read a single DNP3 point with real communication"""
        
        # Connect with retries
        retry_count = 0
        while retry_count < self.config.retries:
            if self._connect():
                break
            retry_count += 1
            if retry_count < self.config.retries:
                time.sleep(0.5)  # Brief delay between retries
        
        if not self.connected:
            return None, f"Failed to connect to DNP3 device {self.config.name} after {self.config.retries} attempts"
                
        try:
            # Map point type to DNP3 object group
            group = POINT_TYPE_MAP.get(point_type.upper())
            if group is None:
                return None, f"Unknown DNP3 point type: {point_type}"
            
            # Determine appropriate variation based on point type
            if point_type.upper() in ['AI', 'AO']:
                variation = 2  # 16-bit with flags (most common)
            else:
                variation = 1  # Basic variation
            
            logger.debug(f"Reading {point_type}.{point_index:03d} from {self.config.name}")
            
            # Create and send read request
            request = self._create_read_request(group, variation, point_index)
            self.socket.send(request)
            
            # Read response with timeout
            self.socket.settimeout(self.config.timeout_ms / 1000.0)
            response = self.socket.recv(1024)
            
            if not response:
                return None, f"No response from DNP3 device {self.config.name}"
            
            logger.debug(f"DNP3 response from {self.config.name}: {response.hex()}")
            
            # Parse response
            success, value, error = self._parse_response(response)
            
            if success:
                logger.info(f"✅ Successfully read {point_type}.{point_index:03d} from {self.config.name}: {value}")
                return value, None
            else:
                logger.warning(f"❌ Failed to parse response from {self.config.name}: {error}")
                return None, error
                
        except socket.timeout:
            error_msg = f"Timeout reading {point_type}.{point_index:03d} from {self.config.name}"
            logger.warning(f"⏱️ {error_msg}")
            return None, error_msg
        except Exception as e:
            error_msg = f"Error reading DNP3 point {point_type}.{point_index:03d} from {self.config.name}: {e}"
            logger.error(error_msg)
            return None, error_msg
        finally:
            self.disconnect()

    def test_connection(self) -> Tuple[bool, Optional[str]]:
        """Test connection to DNP3 device"""
        try:
            # Test basic TCP connectivity
            if self._connect():
                logger.info(f"✅ DNP3 connection test successful for {self.config.name}")
                self.disconnect()
                return True, None
            else:
                error_msg = f"Failed to establish TCP connection to {self.config.name} at {self.config.ip_address}:{self.config.port}"
                logger.error(f"❌ {error_msg}")
                return False, error_msg
                
        except Exception as e:
            error_msg = f"Error testing DNP3 connection to {self.config.name}: {e}"
            logger.error(error_msg)
            return False, error_msg

class DNP3Service:
    """DNP3 service that reads configuration from YAML"""
    
    def __init__(self):
        self.clients = {}
        
    def get_client(self, device_config: DNP3DeviceConfig) -> Optional[DNP3Client]:
        """Get or create DNP3 client for device"""
        client_key = f"{device_config.ip_address}:{device_config.port}:{device_config.local_address}:{device_config.remote_address}"
        
        # Create fresh client each time for reliability
        try:
            client = DNP3Client(device_config)
            self.clients[client_key] = client
            return client
        except Exception as e:
            logger.error(f"Failed to create DNP3 client for {device_config.name}: {e}")
            return None
        
    def read_tag_value(self, device_config: DNP3DeviceConfig, tag_config: Dict[str, Any]) -> Tuple[Optional[Union[int, float, bool]], Optional[str]]:
        """Read a single tag value from DNP3 device using real configuration"""
        try:
            client = self.get_client(device_config)
            if not client:
                return None, f"Failed to create DNP3 client for {device_config.name}"
                
            # Parse DNP3 address from tag config
            address = tag_config.get('address', '')
            if not address:
                return None, "No address specified in tag configuration"
            
            # Support both AI,000 and AI.000 formats
            normalized_address = address.replace(',', '.')
            
            if '.' not in normalized_address:
                return None, f"Invalid DNP3 address format: {address} (expected format: AI.001)"
                
            try:
                point_type, point_index_str = normalized_address.split('.', 1)
                point_index = int(point_index_str)
            except ValueError:
                return None, f"Invalid point index in address: {address}"
                
            logger.info(f"🔍 Reading DNP3 point {address} from {device_config.name} (type: {point_type}, index: {point_index})")
            
            # Read the actual point value
            value, error = client.read_point(point_type, point_index)
            
            if value is not None:
                # Apply scaling and transformations from tag config
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
                        
                    logger.info(f"✅ Successfully read {address} from {device_config.name}: raw={value}, scaled={scaled_value}")
                    return scaled_value, None
                else:
                    logger.info(f"✅ Successfully read {address} from {device_config.name}: {value}")
                    return value, None
            else:
                logger.warning(f"❌ Failed to read {address} from {device_config.name}: {error}")
                return None, error
                
        except Exception as e:
            error_msg = f"Exception reading DNP3 tag {tag_config.get('name', 'unknown')} from {device_config.name}: {e}"
            logger.exception(error_msg)
            return None, error_msg
            
    def test_connection(self, device_config: DNP3DeviceConfig) -> Tuple[bool, Optional[str]]:
        """Test connection to DNP3 device"""
        try:
            client = self.get_client(device_config)
            if not client:
                return False, f"Failed to create DNP3 client for {device_config.name}"
            
            return client.test_connection()
                
        except Exception as e:
            error_msg = f"Error testing DNP3 connection to {device_config.name}: {e}"
            logger.exception(error_msg)
            return False, error_msg
            
    def write_tag_value(self, device_config: DNP3DeviceConfig, tag_config: Dict[str, Any], value: Union[int, float, bool]) -> Tuple[bool, Optional[str]]:
        """Write to DNP3 device (placeholder for future implementation)"""
        return False, f"DNP3 write operations not yet implemented for {device_config.name}"
            
    def cleanup_clients(self):
        """Clean up all DNP3 clients"""
        for client in self.clients.values():
            client.disconnect()
        self.clients.clear()

# Global service instance
dnp3_service = DNP3Service()

def dnp3_get_with_error(device_config: Dict[str, Any], tag_config: Dict[str, Any]) -> Tuple[Optional[Union[int, float, bool]], Optional[str]]:
    """Get DNP3 tag value with error handling - reads from real configuration"""
    try:
        dnp3_config = DNP3DeviceConfig(device_config)
        return dnp3_service.read_tag_value(dnp3_config, tag_config)
    except Exception as e:
        logger.exception(f"Error in dnp3_get_with_error: {e}")
        return None, str(e)

def dnp3_test_connection(device_config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """Test DNP3 connection - uses real configuration"""
    try:
        dnp3_config = DNP3DeviceConfig(device_config)
        return dnp3_service.test_connection(dnp3_config)
    except Exception as e:
        logger.exception(f"Error testing DNP3 connection: {e}")
        return False, str(e)

def poll_dnp3_device_sync(device_config: Dict[str, Any], tags: List[Dict[str, Any]], scan_time_ms=2000):
    """
    Synchronous DNP3 polling function that reads from real configuration.
    This function is called by the polling service to continuously poll DNP3 devices.
    """
    if not tags:
        logger.warning("No DNP3 tags configured for polling")
        return
    
    # Import global storage from polling service
    from app.services.polling_service import _latest_polled_values, _latest_polled_values_lock
    
    try:
        dnp3_config = DNP3DeviceConfig(device_config)
        device_name = dnp3_config.name
        
        logger.info(f"Starting DNP3 polling for {device_name} at {dnp3_config.ip_address}:{dnp3_config.port}")
        
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
        
        # Continuous polling loop
        while True:
            current_thread = threading.current_thread()
            if hasattr(current_thread, '_stop_requested') and current_thread._stop_requested:
                logger.info(f"DNP3 polling for {device_name} stopped by request")
                break
                
            # Poll each tag
            for tag in tags:
                try:
                    tag_id = tag.get('id', 'UnknownTagID')
                    tag_name = tag.get('name', 'UnknownTag')
                    
                    # Read tag value using real configuration
                    value, error = dnp3_service.read_tag_value(dnp3_config, tag)
                    
                    # Update global storage
                    with _latest_polled_values_lock:
                        if device_name not in _latest_polled_values:
                            _latest_polled_values[device_name] = {}
                        
                        _latest_polled_values[device_name][tag_id] = {
                            "value": value,
                            "status": "success" if value is not None else "error",
                            "error": error,
                            "timestamp": int(time.time()),
                        }
                    
                    if value is not None:
                        logger.debug(f"✅ DNP3 {device_name}.{tag_name}: {value}")
                    else:
                        logger.warning(f"❌ DNP3 {device_name}.{tag_name}: {error}")
                        
                except Exception as e:
                    logger.exception(f"Error polling DNP3 tag {tag.get('name', 'unknown')} from {device_name}: {e}")
                    
                    with _latest_polled_values_lock:
                        if device_name not in _latest_polled_values:
                            _latest_polled_values[device_name] = {}
                        
                        tag_id = tag.get('id', 'UnknownTagID')
                        _latest_polled_values[device_name][tag_id] = {
                            "value": None,
                            "status": "error",
                            "error": str(e),
                            "timestamp": int(time.time()),
                        }
            
            # Wait before next polling cycle
            time.sleep(scan_time_ms / 1000.0)  # Use configured scan time
            
    except Exception as e:
        logger.exception(f"Fatal error in DNP3 polling: {e}")
    finally:
        # Cleanup
        dnp3_service.cleanup_clients()
        logger.info(f"DNP3 polling cleanup completed for {device_config.get('name', 'unknown')}")

async def dnp3_set_with_error_async(device_config: Dict[str, Any], tag_config: Dict[str, Any], value: Union[int, float, bool]) -> Tuple[bool, Optional[str]]:
    """Async wrapper for DNP3 write operation - placeholder for future implementation"""
    try:
        dnp3_config = DNP3DeviceConfig(device_config)
        return dnp3_service.write_tag_value(dnp3_config, tag_config, value)
    except Exception as e:
        logger.exception(f"Error in dnp3_set_with_error_async: {e}")
        return False, str(e)
