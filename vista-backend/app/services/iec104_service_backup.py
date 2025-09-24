# Updated to use centralized polling logger
from app.logging_config import get_polling_logger, get_error_logger, log_error_with_context

import c104
import time
import logging
from typing import Dict, Any, List, Tuple, Optional
from enum import IntEnum

logger = get_polling_logger()

# IEC 60870-5-104 Protocol Constants (for backward compatibility)
class TypeID(IntEnum):
    """IEC-104 Type Identification"""
    M_SP_NA_1 = 1   # Single-point information
    M_DP_NA_1 = 3   # Double-point information
    M_ST_NA_1 = 5   # Step position information
    M_BO_NA_1 = 7   # Bitstring of 32 bit
    M_ME_NA_1 = 9   # Measured value, normalized value
    M_ME_NB_1 = 11  # Measured value, scaled value
    M_ME_NC_1 = 13  # Measured value, short floating point number
    M_IT_NA_1 = 15  # Integrated totals
    C_SC_NA_1 = 45  # Single command
    C_DC_NA_1 = 46  # Double command
    C_RC_NA_1 = 47  # Regulating step command
    C_SE_NA_1 = 48  # Set-point command, normalized value
    C_SE_NB_1 = 49  # Set-point command, scaled value
    C_SE_NC_1 = 50  # Set-point command, short floating point number
    C_IC_NA_1 = 100 # Interrogation command

class CauseOfTransmission(IntEnum):
    """IEC-104 Cause of Transmission"""
    PERIODIC = 1
    BACKGROUND_SCAN = 2
    SPONTANEOUS = 3
    INITIALIZED = 4
    REQUEST = 5
    ACTIVATION = 6
    ACTIVATION_CON = 7
    DEACTIVATION = 8
    DEACTIVATION_CON = 9
    ACTIVATION_TERMINATION = 10
    INTERROGATED_BY_STATION = 20
    INTERROGATED_BY_GROUP_1 = 21

def parse_iec104_address(address: str) -> Tuple[str, int, Optional[str]]:
    """
    Parse IEC-104 address in format 'TYPE:IOA' or just 'IOA'
    Returns: (type_id, ioa, error)
    """
    try:
        if ':' in address:
            # Format: M_ME_NA_1:1794
            type_part, ioa_part = address.split(':', 1)
            type_id = type_part.strip()
            ioa = int(ioa_part.strip())
            return type_id, ioa, None
        else:
            # Format: 1794 (just IOA, assume default type)
            ioa = int(address.strip())
            return "M_SP_NA_1", ioa, None
    except ValueError as e:
        return "M_SP_NA_1", 0, f"Invalid address format '{address}': {e}"

def convert_c104_value_to_python(info, type_id: str):
    """
    Convert c104 library objects to Python primitive types for serialization
    """
    try:
        if not info or not hasattr(info, 'value'):
            return None
            
        value = info.value
        
        # Convert c104 objects to Python primitives
        if hasattr(value, '__float__'):
            return float(value)
        elif hasattr(value, '__int__'):
            return int(value)
        elif hasattr(value, '__bool__'):
            return bool(value)
        elif isinstance(value, (int, float, bool, str)):
            return value
        else:
            # For any other c104 object, try to extract numeric value
            try:
                return float(str(value))
            except (ValueError, TypeError):
                return str(value)
                
    except Exception as e:
        logger.warning(f"Error converting c104 value to Python type: {e}")
        return None

class IEC104Client:
    """IEC-104 Client wrapper using c104 library"""
    
    def __init__(self, host: str, port: int = 2404, asdu_address: int = 1):
        self.host = str(host)
        self.port = int(port)
        self.asdu_address = int(asdu_address)
        
        # Initialize c104 client and connection
        self.client = c104.Client()
        self.connection = None
        self.station = None
        self.connected = False
        self.points_cache = {}  # Cache points by IOA
        
    def connect(self) -> bool:
        """Connect to the IEC-104 server"""
        try:
            if self.connected:
                return True
                
            # Add connection to client
            self.connection = self.client.add_connection(
                ip=self.host,
                port=self.port,
                init=c104.Init.ALL
            )
            
            if not self.connection:
                logger.error(f"Failed to create connection to {self.host}:{self.port}")
                return False
                
            # Add station with the specified ASDU address
            self.station = self.connection.add_station(common_address=self.asdu_address)
            
            if not self.station:
                logger.error(f"Failed to create station with ASDU {self.asdu_address}")
                return False
                
            # Start the client
            self.client.start()
            
            # Connect to the server
            self.connection.connect()
            
            # Wait for connection to establish
            time.sleep(1.0)
            
            # Check if connected and unmute if needed
            if self.connection.is_connected:
                if self.connection.is_muted:
                    logger.info(f"Connection to {self.host}:{self.port} is muted, unmuting...")
                    self.connection.unmute()
                    time.sleep(0.5)
                    
                self.connected = True
                logger.info(f"IEC-104 connection to {self.host}:{self.port} successful (state: {self.connection.state})")
                return True
            else:
                logger.error(f"IEC-104 connection to {self.host}:{self.port} failed (state: {self.connection.state})")
                return False
            
        except Exception as e:
            logger.error(f"Error connecting to IEC-104 server: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Disconnect from the IEC-104 server"""
        try:
            if self.connection and self.connected:
                self.connection.disconnect()
                self.connected = False
                
            if self.client and self.client.is_running:
                self.client.stop()
                
            self.points_cache.clear()
            logger.info(f"Disconnected from IEC-104 server {self.host}:{self.port}")
            
        except Exception as e:
            logger.error(f"Error disconnecting from IEC-104 server: {e}")
            
    def _ensure_point(self, ioa: int, type_id: str):
        """Ensure a point exists for the given IOA and type"""
        if ioa in self.points_cache:
            return self.points_cache[ioa]
            
        # Map type_id string to c104 Type enum
        type_mapping = {
            "M_SP_NA_1": c104.Type.M_SP_NA_1,
            "M_DP_NA_1": c104.Type.M_DP_NA_1,
            "M_ST_NA_1": c104.Type.M_ST_NA_1,
            "M_ME_NA_1": c104.Type.M_ME_NA_1,
            "M_ME_NB_1": c104.Type.M_ME_NB_1,
            "M_ME_NC_1": c104.Type.M_ME_NC_1,
            "M_IT_NA_1": c104.Type.M_IT_NA_1,
            "C_SC_NA_1": c104.Type.C_SC_NA_1,
            "C_DC_NA_1": c104.Type.C_DC_NA_1,
            "C_RC_NA_1": c104.Type.C_RC_NA_1,
            "C_SE_NA_1": c104.Type.C_SE_NA_1,
            "C_SE_NB_1": c104.Type.C_SE_NB_1,
            "C_SE_NC_1": c104.Type.C_SE_NC_1,
        }
        
        c104_type = type_mapping.get(type_id, c104.Type.M_SP_NA_1)
        
        # First try to get existing point
        point = self.station.get_point(io_address=ioa)
        
        if not point:
            # Add the point if it doesn't exist
            point = self.station.add_point(io_address=ioa, type=c104_type)
            
        if point:
            self.points_cache[ioa] = point
            
        return point
            
    def read_point(self, ioa: int, type_id: str = "M_SP_NA_1") -> Tuple[Any, Optional[str]]:
        """Read a single point using c104 library"""
        try:
            if not self.connected or not self.station:
                return None, "Client not connected"
                
            # Ensure point exists
            point = self._ensure_point(ioa, type_id)
            if not point:
                return None, f"Failed to create/get point with IOA {ioa}"
                
            # Trigger interrogation to get fresh data
            try:
                self.connection.interrogation(station=self.asdu_address)
                time.sleep(0.5)  # Wait for response
            except Exception as interr_e:
                logger.debug(f"Interrogation failed: {interr_e}")
                
            # Read the point value and convert to Python primitive
            try:
                info = point.info
                if info and hasattr(info, 'value'):
                    # Convert c104 value to Python primitive for serialization
                    python_value = convert_c104_value_to_python(info, type_id)
                    return python_value, None
                else:
                    return None, f"No data available for point {ioa} (type: {type_id})"
            except Exception as read_e:
                return None, f"Error reading point value: {read_e}"
            
        except Exception as e:
            logger.error(f"Error reading IEC-104 point {ioa}: {e}")
            return None, str(e)
    
    def write_point(self, ioa: int, value: Any, type_id: str = "C_SC_NA_1") -> Tuple[bool, Optional[str]]:
        """Write a single point using c104 library"""
        try:
            if not self.connected or not self.station:
                return False, "Client not connected"
                
            # Ensure point exists
            point = self._ensure_point(ioa, type_id)
            if not point:
                return False, f"Failed to create/get point with IOA {ioa}"
                
            # Create the appropriate command object, set it on point, then transmit
            success = False
            try:
                if type_id == "C_SC_NA_1":
                    # Single command - accepts boolean directly
                    cmd = c104.SingleCmd(bool(value))
                    point.info = cmd
                    success = point.transmit(c104.Cot.ACTIVATION)
                elif type_id == "C_DC_NA_1":
                    # Double command - expects c104.Double enum
                    double_state = c104.Double.ON if value else c104.Double.OFF
                    cmd = c104.DoubleCmd(double_state)
                    point.info = cmd
                    success = point.transmit(c104.Cot.ACTIVATION)
                elif type_id == "C_RC_NA_1":
                    # Step command - expects c104.Step enum
                    step_dir = c104.Step.HIGHER if int(value) > 0 else c104.Step.LOWER
                    cmd = c104.StepCmd(step_dir)
                    point.info = cmd
                    success = point.transmit(c104.Cot.ACTIVATION)
                elif type_id == "C_SE_NA_1":
                    # Normalized set point command - needs NormalizedFloat wrapper
                    norm_float = c104.NormalizedFloat(float(value))
                    cmd = c104.NormalizedCmd(norm_float)
                    point.info = cmd
                    success = point.transmit(c104.Cot.ACTIVATION)
                elif type_id == "C_SE_NB_1":
                    # Scaled set point command - expects Int16 directly as target
                    int16_val = c104.Int16(int(value))
                    cmd = c104.ScaledCmd(int16_val)
                    point.info = cmd
                    success = point.transmit(c104.Cot.ACTIVATION)
                elif type_id == "C_SE_NC_1":
                    # Float set point command - ShortCmd expects float directly as target
                    cmd = c104.ShortCmd(float(value))
                    point.info = cmd
                    success = point.transmit(c104.Cot.ACTIVATION)
                else:
                    return False, f"Unsupported command type: {type_id}"
                    
            except Exception as cmd_e:
                return False, f"Command transmission error: {cmd_e}"
                
            if success:
                logger.info(f"Successfully sent command to point {ioa}")
                return True, None
            else:
                return False, "Failed to transmit command"
                
        except Exception as e:
            logger.error(f"Error writing IEC-104 point {ioa}: {e}")
            return False, str(e)
def poll_iec104_device_sync(device_config: Dict[str, Any], tags: List[Dict[str, Any]], scan_time_ms: int = 1000):
    """
    Poll IEC-104 device synchronously using c104 library - matches other protocol patterns.
    This function runs in a continuous loop like other protocol polling functions.
    """
    
    # Extract IEC-104 specific configuration (following same pattern as DNP3/OPC-UA)
    host = device_config.get('iec104IpAddress') or device_config.get('ip')
    port = device_config.get('iec104PortNumber') or device_config.get('port', 2404)
    asdu_address = device_config.get('iec104AsduAddress') or device_config.get('asdu_address', 1)
    device_name = device_config.get('name', 'UnknownIEC104Device')
    
    if not host:
        logger.error(f"IEC-104 device '{device_name}': No host specified in device config (iec104IpAddress or ip)")
        return
    
    # Import global storage from polling service to match other protocols
    from app.services.polling_service import _latest_polled_values, _latest_polled_values_lock
    
    logger.info(f"IEC-104 device '{device_name}': Starting polling to {host}:{port}, ASDU={asdu_address}")
    
    # Initialize device in global storage (same pattern as DNP3/SNMP)
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
    
    # Create client with extracted config
    client = IEC104Client(host, port, asdu_address)
    
    try:
        # Continuous polling loop (same pattern as other protocols)
        while True:
            try:
                start_time = time.time()
                
                if not client.connect():
                    logger.error(f"IEC-104 device '{device_name}': Failed to connect to {host}:{port}")
                    # Update all tags with connection error
                    with _latest_polled_values_lock:
                        for tag in tags:
                            tag_id = tag.get('id', 'UnknownTagID')
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "error",
                                "error": "Connection failed",
                                "timestamp": int(time.time()),
                            }
                    time.sleep(scan_time_ms / 1000.0)
                    continue
                    
                successful_reads = 0
                
                for tag in tags:
                    tag_id = tag.get('id', 'UnknownTagID')
                    tag_address = tag.get('address')
                    tag_name = tag.get('name', f'tag_{tag_address}')
                    
                    if tag_address is not None:
                        # Parse the address to extract type and IOA
                        type_id, ioa, parse_error = parse_iec104_address(str(tag_address))
                        
                        if parse_error:
                            with _latest_polled_values_lock:
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "error",
                                    "error": parse_error,
                                    "timestamp": int(time.time()),
                                }
                            logger.warning(f"IEC-104 device '{device_name}': Address parse error for tag '{tag_name}': {parse_error}")
                            continue
                            
                        # Use type from address or fall back to tag type or iec104PointType
                        if type_id == "M_SP_NA_1":  # Default from parsing
                            type_id = tag.get('type') or tag.get('iec104PointType', 'M_ME_NA_1')
                        
                        logger.debug(f"IEC-104 device '{device_name}': Reading tag '{tag_name}' IOA={ioa}, Type={type_id}")
                        value, error = client.read_point(ioa, type_id)
                        
                        with _latest_polled_values_lock:
                            if error:
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "error",
                                    "error": error,
                                    "timestamp": int(time.time()),
                                }
                                logger.warning(f"IEC-104 device '{device_name}': Error reading tag '{tag_name}' (IOA {ioa}): {error}")
                            else:
                                # Ensure value is a Python primitive for serialization
                                safe_value = value
                                if hasattr(value, '__float__'):
                                    safe_value = float(value)
                                elif hasattr(value, '__int__'):
                                    safe_value = int(value)
                                elif hasattr(value, '__bool__'):
                                    safe_value = bool(value)
                                    
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": safe_value,
                                    "status": "good",
                                    "error": None,
                                    "timestamp": int(time.time()),
                                }
                                successful_reads += 1
                                logger.info(f"IEC-104 device '{device_name}': Successfully read tag '{tag_name}' (IOA {ioa}): {safe_value}")
                    else:
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "error", 
                                "error": "No address specified",
                                "timestamp": int(time.time()),
                            }
                        logger.warning(f"IEC-104 device '{device_name}': Tag '{tag_name}' has no address specified")
                
                elapsed_time = (time.time() - start_time) * 1000
                logger.info(f"IEC-104 device '{device_name}': Polled {len(tags)} tags ({successful_reads} successful) in {elapsed_time:.1f}ms")
                
                # Sleep for the remaining scan time
                sleep_time = max(0, (scan_time_ms / 1000.0) - (time.time() - start_time))
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    
            except Exception as e:
                logger.error(f"IEC-104 device '{device_name}': Error during polling cycle: {e}")
                # Update all tags with error status
                with _latest_polled_values_lock:
                    for tag in tags:
                        tag_id = tag.get('id', 'UnknownTagID')
                        _latest_polled_values[device_name][tag_id] = {
                            "value": None,
                            "status": "error",
                            "error": str(e),
                            "timestamp": int(time.time()),
                        }
                time.sleep(scan_time_ms / 1000.0)
                
    except Exception as e:
        logger.exception(f"IEC-104 device '{device_name}': Exception in polling thread: {e}")
        
    finally:
        try:
            client.disconnect()
        except:
            pass
        logger.info(f"IEC-104 device '{device_name}': Polling thread stopped")

def iec104_get_with_error(device_config: Dict[str, Any], address: str) -> Tuple[Any, Optional[str]]:
    """Get single IEC-104 point value with error handling using c104 library"""
    # Extract IEC-104 specific configuration
    host = device_config.get('iec104IpAddress') or device_config.get('ip')
    port = device_config.get('iec104PortNumber') or device_config.get('port', 2404)
    asdu_address = device_config.get('iec104AsduAddress') or device_config.get('asdu_address', 1)
    
    if not host:
        return None, "No host specified in device config (iec104IpAddress or ip)"
        
    if not address:
        return None, "No address specified"
    
    # Parse the address
    type_id, ioa, parse_error = parse_iec104_address(address)
    if parse_error:
        return None, parse_error
        
    client = IEC104Client(host, port, asdu_address)
    
    try:
        if not client.connect():
            return None, f"Failed to connect to {host}:{port}"
            
        value, error = client.read_point(ioa, type_id)
        return value, error
        
    except Exception as e:
        logger.error(f"Error getting IEC-104 point {address}: {e}")
        return None, str(e)
        
    finally:
        try:
            client.disconnect()
        except:
            pass

def iec104_set_with_error(device_config: Dict[str, Any], address: str, value: Any, public_address: int = None, point_number: int = None) -> Tuple[bool, Optional[str]]:
    """Set single IEC-104 point value with error handling using c104 library"""
    # Extract IEC-104 specific configuration
    host = device_config.get('iec104IpAddress') or device_config.get('ip')
    port = device_config.get('iec104PortNumber') or device_config.get('port', 2404)
    asdu_address = device_config.get('iec104AsduAddress') or device_config.get('asdu_address', 1)
    
    if not host:
        return False, "No host specified in device config (iec104IpAddress or ip)"
        
    if not address:
        return False, "No address specified"
    
    # Parse the address
    type_id, ioa, parse_error = parse_iec104_address(address)
    if parse_error:
        return False, parse_error
        
    # Convert read types to write types
    if type_id.startswith('M_'):
        type_id = type_id.replace('M_SP_NA_1', 'C_SC_NA_1').replace('M_ME_NA_1', 'C_SE_NA_1').replace('M_ME_NB_1', 'C_SE_NB_1').replace('M_ME_NC_1', 'C_SE_NC_1')
        
    client = IEC104Client(host, port, asdu_address)
    
    try:
        if not client.connect():
            return False, f"Failed to connect to {host}:{port}"
            
        success, error = client.write_point(ioa, value, type_id)
        return success, error
        
    except Exception as e:
        logger.error(f"Error setting IEC-104 point {address}: {e}")
        return False, str(e)
        
    finally:
        try:
            client.disconnect()
        except:
            pass
