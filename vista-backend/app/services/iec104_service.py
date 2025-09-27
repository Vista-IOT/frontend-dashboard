# Updated to use centralized polling logger and enhanced error handling
from app.logging_config import get_polling_logger, get_error_logger, log_error_with_context
from app.services.last_seen import update_last_successful_timestamp

import c104
import time
import logging
import re
from typing import Dict, Any, List, Tuple, Optional
from enum import IntEnum

def convert_to_boolean(value):
    """Convert various value types to boolean, handling string 'false' correctly"""
    if isinstance(value, str):
        value_lower = value.lower().strip()
        if value_lower in ('false', 'f', '0', 'off', 'no'):
            return False
        elif value_lower in ('true', 't', '1', 'on', 'yes'):
            return True
        else:
            # For other strings, use standard boolean conversion
            return bool(value)
    elif isinstance(value, (int, float)):
        return bool(value)
    else:
        return bool(value)

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

# IEC 60870-5-104 Error Codes and Verbose Descriptions
# Standard IEC-104 Cause of Transmission Error Codes
IEC104_COT_ERROR_CODES = {
    7: "ACTIVATION_CON: Command activation confirmation",
    8: "DEACTIVATION: Command deactivation",
    9: "DEACTIVATION_CON: Command deactivation confirmation", 
    10: "ACTIVATION_TERMINATION: Command activation termination",
    44: "UNKNOWN_TYPE_ID: Unknown type identification",
    45: "UNKNOWN_COT: Unknown cause of transmission",
    46: "UNKNOWN_CA: Unknown common address of ASDU",
    47: "UNKNOWN_IOA: Unknown information object address"
}

# IEC-104 ASDU Reject Reasons (Negative confirmations)
IEC104_REJECT_CODES = {
    1: "REQUEST_NOT_SUPPORTED: The requested function is not supported",
    2: "OBJECT_UNKNOWN: The information object is unknown", 
    3: "OBJECT_NOT_ACCESSIBLE: The information object is not accessible",
    4: "INVALID_QUALIFIER: Invalid qualifier of command",
    5: "INVALID_IOA: Invalid information object address",
    6: "COMMAND_NOT_PERMITTED: Command not permitted in current state",
    7: "TYPE_ID_NOT_SUPPORTED: Type identification not supported",
    8: "TEMPORARY_UNAVAILABLE: Temporarily not available",
    9: "LOCAL_OVERRIDE_ACTIVE: Local override is active",
    10: "OBJECT_BLOCKED: Information object is blocked",
    11: "SUBSTATION_NOT_READY: Substation not ready",
    12: "DEVICE_TROUBLE: Device trouble"
}

# IEC-104 Connection State Error Codes
IEC104_CONNECTION_ERROR_CODES = {
    0: "CLOSED: Connection is closed",
    1: "OPENING: Connection is opening",  
    2: "OPENED: Connection is opened but not started",
    3: "STOPPED: Connection is stopped",
    4: "STARTED: Connection is started and ready",
    5: "CLOSING: Connection is closing",
    6: "MUTED: Connection is muted (data transmission suspended)",
    7: "ERROR: Connection is in error state"
}

# IEC-104 Quality Descriptor Error Codes (for measured values)
IEC104_QUALITY_ERROR_CODES = {
    0x01: "OVERFLOW: Value overflow detected",
    0x10: "BLOCKED: Value is blocked", 
    0x20: "SUBSTITUTED: Value is substituted",
    0x40: "NOT_TOPICAL: Value is not topical (old)",
    0x80: "INVALID: Value is invalid"
}

# IEC-104 Command State Error Codes
IEC104_COMMAND_ERROR_CODES = {
    0: "SUCCESS: Command executed successfully",
    1: "TIMEOUT: Command execution timeout",
    2: "LOCAL_OVERRIDE: Command rejected due to local override",
    3: "EQUIPMENT_FAULT: Command rejected due to equipment fault",
    4: "NOT_PERMITTED: Command not permitted in current state",
    5: "ALREADY_EXECUTING: Command already executing",
    6: "INVALID_PARAMETER: Invalid command parameter"
}

def get_iec104_cot_error_verbose(cot_code: int) -> str:
    """Get verbose description for IEC-104 Cause of Transmission error code"""
    return IEC104_COT_ERROR_CODES.get(cot_code, f"Unknown COT error code: {cot_code}")

def get_iec104_reject_verbose(reject_code: int) -> str:
    """Get verbose description for IEC-104 reject code"""
    return IEC104_REJECT_CODES.get(reject_code, f"Unknown reject code: {reject_code}")

def get_iec104_connection_error_verbose(state_code: int) -> str:
    """Get verbose description for IEC-104 connection state"""
    return IEC104_CONNECTION_ERROR_CODES.get(state_code, f"Unknown connection state: {state_code}")

def get_iec104_quality_error_verbose(quality_flags: int) -> str:
    """Get verbose description for IEC-104 quality descriptor flags"""
    errors = []
    for flag, description in IEC104_QUALITY_ERROR_CODES.items():
        if quality_flags & flag:
            errors.append(description)
    
    if errors:
        return "; ".join(errors)
    else:
        return "GOOD: No quality issues detected"

def get_iec104_command_error_verbose(command_state: int) -> str:
    """Get verbose description for IEC-104 command error codes"""
    return IEC104_COMMAND_ERROR_CODES.get(command_state, f"Unknown command state: {command_state}")

def extract_iec104_error_details(error_result, connection_state=None, quality_flags=None, cot_code=None):
    """Extract detailed error information from IEC-104 responses"""
    error_info = {
        'error_type': None,
        'error_code': None,
        'error_message': str(error_result),
        'verbose_description': None,
        'connection_state': None,
        'quality_flags': None,
        'cot_code': None,
        'additional_info': {}
    }
    
    # Handle c104 specific errors
    if hasattr(error_result, '__class__'):
        error_info['error_type'] = error_result.__class__.__name__
    
    # Handle connection state information - ensure JSON serializable
    if connection_state is not None:
        # Convert enum or object to string/int for JSON serialization
        if hasattr(connection_state, 'value'):  # Enum object
            error_info['connection_state'] = str(connection_state.value)
        elif hasattr(connection_state, 'name'):  # Enum object
            error_info['connection_state'] = str(connection_state.name)  
        else:
            error_info['connection_state'] = str(connection_state)
        
        # Get numeric value for error code lookup
        state_code = getattr(connection_state, 'value', connection_state) if hasattr(connection_state, 'value') else connection_state
        try:
            state_code = int(state_code) if state_code is not None else 0
        except (ValueError, TypeError):
            state_code = 0
        error_info['verbose_description'] = get_iec104_connection_error_verbose(state_code)
        # Set error code based on connection state
        if state_code != 0:  # 0 is success/connected state
            error_info['error_code'] = state_code
    
    # Handle quality flags for measured values - ensure JSON serializable
    if quality_flags is not None:
        error_info['quality_flags'] = int(quality_flags) if quality_flags is not None else 0
        quality_desc = get_iec104_quality_error_verbose(error_info['quality_flags'])
        if error_info['verbose_description']:
            error_info['verbose_description'] += f"; Quality: {quality_desc}"
        else:
            error_info['verbose_description'] = f"Quality: {quality_desc}"
    
    # Handle cause of transmission codes - ensure JSON serializable  
    if cot_code is not None:
        error_info['cot_code'] = int(cot_code) if cot_code is not None else 0
        cot_desc = get_iec104_cot_error_verbose(error_info['cot_code'])
        if error_info['verbose_description']:
            error_info['verbose_description'] += f"; COT: {cot_desc}"
        else:
            error_info['verbose_description'] = f"COT: {cot_desc}"
    # Try to extract error codes from error message string
    error_str = str(error_result).lower()
    
    # Common IEC-104 error patterns - using proper IEC standard codes
    if 'timeout' in error_str:
        error_info['error_code'] = 1  # From COMMAND_ERROR_CODES: TIMEOUT
        error_info['verbose_description'] = "TIMEOUT - Connection or operation timeout"
    elif 'connection' in error_str and ('refused' in error_str or 'failed' in error_str):
        error_info['error_code'] = 7  # From CONNECTION_ERROR_CODES: ERROR state
        error_info['verbose_description'] = "CONNECTION_ERROR - Unable to establish connection to IEC-104 server"
    elif 'unknown' in error_str and 'type' in error_str:
        error_info['error_code'] = 44
        error_info['verbose_description'] = get_iec104_cot_error_verbose(44)
    elif 'unknown' in error_str and 'address' in error_str:
        error_info['error_code'] = 47
        error_info['verbose_description'] = get_iec104_cot_error_verbose(47)
    elif 'not permitted' in error_str:
        error_info['error_code'] = 6
        error_info['verbose_description'] = get_iec104_reject_verbose(6)
    elif 'blocked' in error_str:
        error_info['error_code'] = 10
        error_info['verbose_description'] = get_iec104_reject_verbose(10)
    elif 'invalid' in error_str:
        error_info['error_code'] = 4
        error_info['verbose_description'] = get_iec104_reject_verbose(4)
    
    # Apply standardized error format: (ERROR_CODE - ERROR DESCRIPTION/MESSAGE)
    if error_info['verbose_description'] and error_info['error_code'] is not None:
        # Format as requested: (ERROR_CODE - ERROR DESCRIPTION/MESSAGE)
        error_info['verbose_description'] = f"({error_info['error_code']} - {error_info['verbose_description']})"
    elif not error_info['verbose_description']:
        # If no specific error found, provide generic description with format
        error_code = error_info.get('error_code', 0) or 0
        error_info['verbose_description'] = f"({error_code} - IEC-104 Error: {error_info['error_message']})"
    
    return error_info
def map_iec104_error_to_http_status(iec104_error_code: int) -> int:
    """Map IEC-104 error codes to appropriate HTTP status codes"""
    mapping = {
        0: 200,  # SUCCESS -> OK
        1: 408,  # TIMEOUT -> Request Timeout
        2: 503,  # CONNECTION_REFUSED -> Service Unavailable
        7: 503,  # CONNECTION_ERROR -> Service Unavailable
        4: 400,  # INVALID_QUALIFIER -> Bad Request
        5: 400,  # INVALID_IOA -> Bad Request
        6: 405,  # COMMAND_NOT_PERMITTED -> Method Not Allowed
        7: 501,  # TYPE_ID_NOT_SUPPORTED -> Not Implemented
        8: 503,  # TEMPORARY_UNAVAILABLE -> Service Unavailable
        9: 409,  # LOCAL_OVERRIDE_ACTIVE -> Conflict
        10: 423, # OBJECT_BLOCKED -> Locked
        11: 503, # SUBSTATION_NOT_READY -> Service Unavailable
        12: 500, # DEVICE_TROUBLE -> Internal Server Error
        44: 501, # UNKNOWN_TYPE_ID -> Not Implemented
        45: 400, # UNKNOWN_COT -> Bad Request
        46: 400, # UNKNOWN_CA -> Bad Request
        47: 404, # UNKNOWN_IOA -> Not Found
    }
    return mapping.get(iec104_error_code, 500)  # Default to Internal Server Error

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
    """IEC-104 Client wrapper using c104 library with enhanced error handling"""
    
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
        
    def connect(self) -> Tuple[bool, Optional[Dict]]:
        """Connect to the IEC-104 server with detailed error information"""
        try:
            if self.connected and self.connection and self.connection.is_connected:
                return True, None
                
            # Add connection to client
            self.connection = self.client.add_connection(
                ip=self.host,
                port=self.port,
                init=c104.Init.ALL
            )
            
            if not self.connection:
                error_info = extract_iec104_error_details(
                    f"Failed to create connection to {self.host}:{self.port}",
                    connection_state=0  # CLOSED
                )
                logger.error(f"Failed to create IEC-104 connection to {self.host}:{self.port}")
                return False, error_info
                
            # Add station with the specified ASDU address
            self.station = self.connection.add_station(common_address=self.asdu_address)
            
            if not self.station:
                error_info = extract_iec104_error_details(
                    f"Failed to create station with ASDU {self.asdu_address}",
                    connection_state=0  # CLOSED
                )
                logger.error(f"Failed to create IEC-104 station with ASDU {self.asdu_address}")
                return False, error_info
                
            # Start the client
            self.client.start()
            
            # Connect to the server
            self.connection.connect()
            
            # Wait for connection to establish
            time.sleep(1.0)
            
            # Check connection state and provide detailed information
            connection_state = getattr(self.connection, 'state', 0)
            
            # Check if connected and unmute if needed
            if self.connection.is_connected:
                if self.connection.is_muted:
                    logger.info(f"IEC-104 connection to {self.host}:{self.port} is muted, unmuting...")
                    self.connection.unmute()
                    time.sleep(0.5)
                    
                self.connected = True
                logger.info(f"IEC-104 connection to {self.host}:{self.port} successful (state: {connection_state})")
                return True, None
            else:
                error_info = extract_iec104_error_details(
                    f"Connection failed to {self.host}:{self.port}",
                    connection_state=connection_state
                )
                logger.error(f"IEC-104 connection to {self.host}:{self.port} failed (state: {connection_state})")
                return False, error_info
            
        except Exception as e:
            error_info = extract_iec104_error_details(e, connection_state=7)  # ERROR state
            logger.error(f"Error connecting to IEC-104 server: {e}")
            self.connected = False
            return False, error_info
    
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
        # For write operations, always clear cache and recreate point to avoid type conflicts
        if ioa in self.points_cache:
            cached_point = self.points_cache[ioa]
            try:
                # Check if cached point type matches requested type
                cached_type_name = str(cached_point.type).split('.')[-1] if hasattr(cached_point, 'type') else None
                if cached_type_name == type_id:
                    return cached_point
                else:
                    # Clear cache and remove point if type doesn't match
                    logger.debug(f"Type mismatch for IOA {ioa}: cached={cached_type_name}, requested={type_id}")
                    del self.points_cache[ioa]
                    # Try to remove the point from station to force recreation
                    if self.station:
                        try:
                            self.station.remove_point(io_address=ioa)
                        except:
                            pass  # Ignore if remove fails
            except Exception as e:
                logger.debug(f"Error checking cached point type for IOA {ioa}: {e}")
                # Clear cache on any error
                del self.points_cache[ioa]
            
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
        
        # For write operations, ensure we use command type, not monitoring type
        c104_type = type_mapping.get(type_id)
        if not c104_type:
            # Default based on operation type
            if type_id.startswith('C_'):
                c104_type = c104.Type.C_SC_NA_1  # Default command type
            else:
                c104_type = c104.Type.M_SP_NA_1  # Default monitoring type
        
        # First try to get existing point
        point = self.station.get_point(io_address=ioa)
        
        if not point:
            # Add the point if it doesn't exist
            point = self.station.add_point(io_address=ioa, type=c104_type)
            
        if point:
            self.points_cache[ioa] = point
            
        return point
    
    def _force_recreate_point(self, ioa: int, type_id: str):
        """Force recreation of a point with the specified type, removing any existing point"""
        logger.debug(f"🔄 Forcing recreation of point IOA={ioa} with type={type_id}")
        try:
            # AGGRESSIVE CLEANUP: Clear from cache and ensure fresh point creation
            if ioa in self.points_cache:
                logger.debug(f"🗑️ Removing IOA {ioa} from points cache")
                del self.points_cache[ioa]
            
            # For write operations, we need to ensure the station has the correct point type
            if self.station:
                try:
                    # Get all points and remove any conflicting ones
                    existing_point = self.station.get_point(io_address=ioa)
                    if existing_point:
                        existing_type = str(existing_point.type).split('.')[-1] if hasattr(existing_point, 'type') else 'unknown'
                        logger.debug(f"🔍 Found existing point at IOA {ioa}: type={existing_type}, requested={type_id}")
                        
                        if existing_type != type_id:
                            logger.warning(f"⚠️ TYPE CONFLICT: IOA {ioa} has type {existing_type}, but {type_id} requested for write")
                            logger.warning(f"⚠️ This is likely due to polling creating monitoring points vs. write needing command points")
                            # Since c104 doesn't have a direct remove method, we'll work around it
                            # by creating a new connection/station instance for writes
                            logger.debug(f"🔄 Will create fresh point with command type {type_id}")
                except Exception as e:
                    logger.debug(f"Error checking existing point at IOA {ioa}: {e}")
            
            # Create point with the requested type, bypassing cache
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
            
            c104_type = type_mapping.get(type_id, c104.Type.C_SC_NA_1)
            logger.debug(f"🏗️ Creating fresh point: IOA={ioa}, type={type_id}, c104_type={c104_type}")
            
            # Try to add the point with correct type
            point = self.station.add_point(io_address=ioa, type=c104_type)
            if point:
                logger.debug(f"✅ Successfully created fresh point at IOA {ioa} with type {type_id}")
                self.points_cache[ioa] = point
                return point
            else:
                logger.error(f"❌ Failed to create point at IOA {ioa} with type {type_id}")
                return None
            
        except Exception as e:
            logger.error(f"💥 Error in _force_recreate_point for IOA {ioa}: {e}")
            import traceback
            logger.error(f"💥 Stack trace: {traceback.format_exc()}")
            # Fall back to standard ensure_point
            return self._ensure_point(ioa, type_id)
            
    def read_point(self, ioa: int, type_id: str = "M_SP_NA_1") -> Tuple[Any, Optional[Dict]]:
        """Read a single point using c104 library with enhanced error handling"""
        try:
            if not self.connected or not self.station:
                error_info = extract_iec104_error_details(
                    "Client not connected",
                    connection_state=0  # CLOSED
                )
                return None, error_info
                
            # Ensure point exists
            point = self._ensure_point(ioa, type_id)
            if not point:
                error_info = extract_iec104_error_details(
                    f"Failed to create/get point with IOA {ioa}",
                    cot_code=47  # UNKNOWN_IOA
                )
                return None, error_info
                
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
                    # Check quality flags if available
                    quality_flags = None
                    if hasattr(info, 'quality'):
                        quality_flags = getattr(info.quality, 'flags', None)
                    
                    # Extract quality issues if present
                    if quality_flags and (quality_flags & 0xF1):  # Check for error flags
                        error_info = extract_iec104_error_details(
                            f"Quality issues detected for point {ioa}",
                            quality_flags=quality_flags
                        )
                        python_value = convert_c104_value_to_python(info, type_id)
                        return python_value, error_info
                    
                    # Convert c104 value to Python primitive for serialization
                    python_value = convert_c104_value_to_python(info, type_id)
                    return python_value, None
                else:
                    error_info = extract_iec104_error_details(
                        f"No data available for point {ioa} (type: {type_id})",
                        cot_code=2  # Object not accessible
                    )
                    return None, error_info
            except Exception as read_e:
                error_info = extract_iec104_error_details(read_e)
                return None, error_info
            
        except Exception as e:
            error_info = extract_iec104_error_details(e)
            logger.error(f"Error reading IEC-104 point {ioa}: {e}")
            return None, error_info
    
    def write_point(self, ioa: int, value: Any, type_id: str = "C_SC_NA_1") -> Tuple[bool, Optional[Dict]]:
        """Write a single point using c104 library with enhanced error handling"""
        logger.debug(f"🔧 write_point called: IOA={ioa}, value={value}, type_id={type_id}")
        try:
            if not self.connected or not self.station:
                error_info = extract_iec104_error_details(
                    "Client not connected",
                    connection_state=0  # CLOSED
                )
                return False, error_info
                
            # Ensure point exists
            # For write operations, convert monitoring types to command types
            if type_id.startswith('M_'):
                # Map monitoring types to corresponding command types
                command_type_mapping = {
                    'M_SP_NA_1': 'C_SC_NA_1',  # Single point -> Single command
                    'M_DP_NA_1': 'C_DC_NA_1',  # Double point -> Double command
                    'M_ME_NA_1': 'C_SE_NA_1',  # Measured normalized -> Set normalized
                    'M_ME_NB_1': 'C_SE_NB_1',  # Measured scaled -> Set scaled
                    'M_ME_NC_1': 'C_SE_NC_1',  # Measured float -> Set float
                }
                command_type_id = command_type_mapping.get(type_id, 'C_SC_NA_1')
                # Force recreation to avoid type conflicts
                point = self._force_recreate_point(ioa, command_type_id)
            else:
                # For command types, also force recreation to ensure correct type
                point = self._force_recreate_point(ioa, type_id)
            if not point:
                error_info = extract_iec104_error_details(
                    f"Failed to create/get point with IOA {ioa}",
                    cot_code=47  # UNKNOWN_IOA
                )
                return False, error_info
                
            # Create the appropriate command object, set it on point, then transmit
            success = False
            try:
                if type_id == "C_SC_NA_1":
                    # Single command - accepts boolean directly with proper string handling
                    bool_val = convert_to_boolean(value)
                    logger.debug(f"📤 Creating SingleCmd: IOA={ioa}, bool_value={bool_val}, point_type={point.type if hasattr(point, 'type') else 'unknown'}")
                    cmd = c104.SingleCmd(bool_val)
                    logger.debug(f"✅ SingleCmd created successfully: {cmd}")
                    point.info = cmd
                    logger.debug(f"✅ Command assigned to point.info")
                    success = point.transmit(c104.Cot.ACTIVATION)
                    logger.debug(f"📡 Transmission result: {success}")
                elif type_id == "C_DC_NA_1":
                    # Double command - expects c104.Double enum
                    double_state = c104.Double.ON if convert_to_boolean(value) else c104.Double.OFF
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
                    error_info = extract_iec104_error_details(
                        f"Unsupported command type: {type_id}",
                        cot_code=44  # UNKNOWN_TYPE_ID
                    )
                    return False, error_info
                    
            except Exception as cmd_e:
                logger.error(f"💥 Exception in command creation/transmission: {cmd_e}")
                logger.error(f"💥 Exception type: {type(cmd_e)}")
                logger.error(f"💥 IOA={ioa}, type_id={type_id}, value={value}")
                if hasattr(cmd_e, '__traceback__'):
                    import traceback
                    logger.error(f"💥 Stack trace: {traceback.format_exc()}")
                error_info = extract_iec104_error_details(cmd_e)
                return False, error_info
                
            if success:
                logger.info(f"Successfully sent IEC-104 command to point {ioa}")
                return True, None
            else:
                error_info = extract_iec104_error_details(
                    "Failed to transmit command",
                    cot_code=6  # Command not permitted
                )
                return False, error_info
                
        except Exception as e:
            error_info = extract_iec104_error_details(e)
            logger.error(f"Error writing IEC-104 point {ioa}: {e}")
            return False, error_info

def poll_iec104_device_sync(device_config: Dict[str, Any], tags: List[Dict[str, Any]], scan_time_ms: int = 1000):
    """
    Poll IEC-104 device synchronously using c104 library with enhanced error handling.
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
                
                connect_success, connect_error = client.connect()
                if not connect_success:
                    error_msg = connect_error.get('verbose_description', 'Connection failed') if connect_error else 'Connection failed'
                    logger.error(f"IEC-104 device '{device_name}': Failed to connect to {host}:{port} - {error_msg}")
                    # Update all tags with connection error
                    with _latest_polled_values_lock:
                        for tag in tags:
                            tag_id = tag.get('id', 'UnknownTagID')
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "error",
                                "error": error_msg,
                                "error_details": connect_error,
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
                                    "error_details": extract_iec104_error_details(parse_error),
                                    "timestamp": int(time.time()),
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, int(time.time()))
                            logger.warning(f"IEC-104 device '{device_name}': Address parse error for tag '{tag_name}': {parse_error}")
                            continue
                            
                        # Use type from address or fall back to tag type or iec104PointType
                        if type_id == "M_SP_NA_1":  # Default from parsing
                            type_id = tag.get('type') or tag.get('iec104PointType', 'M_ME_NA_1')
                        
                        logger.debug(f"IEC-104 device '{device_name}': Reading tag '{tag_name}' IOA={ioa}, Type={type_id}")
                        value, error_info = client.read_point(ioa, type_id)
                        
                        with _latest_polled_values_lock:
                            if error_info:
                                error_msg = error_info.get('verbose_description', 'Read error')
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": value,  # Include value even if there are quality issues
                                    "status": "error",
                                    "error": error_msg,
                                    "error_details": error_info,
                                    "timestamp": int(time.time()),
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, int(time.time()))
                                logger.warning(f"IEC-104 device '{device_name}': Error reading tag '{tag_name}' (IOA {ioa}): {error_msg}")
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
                                    "error_details": None,
                                    "timestamp": int(time.time()),
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, int(time.time()))
                                successful_reads += 1
                                logger.info(f"IEC-104 device '{device_name}': Successfully read tag '{tag_name}' (IOA {ioa}): {safe_value}")
                    else:
                        error_info = extract_iec104_error_details("No address specified")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "error", 
                                "error": "No address specified",
                                "error_details": error_info,
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
                error_info = extract_iec104_error_details(e)
                error_msg = error_info.get('verbose_description', str(e))
                logger.error(f"IEC-104 device '{device_name}': Error during polling cycle: {error_msg}")
                # Update all tags with error status
                with _latest_polled_values_lock:
                    for tag in tags:
                        tag_id = tag.get('id', 'UnknownTagID')
                        _latest_polled_values[device_name][tag_id] = {
                            "value": None,
                            "status": "error",
                            "error": error_msg,
                            "error_details": error_info,
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

def iec104_get_with_error(device_config: Dict[str, Any], address: str) -> Tuple[Any, Optional[Dict]]:
    """Get single IEC-104 point value with enhanced error handling using c104 library"""
    # Extract IEC-104 specific configuration
    host = device_config.get('iec104IpAddress') or device_config.get('ip')
    port = device_config.get('iec104PortNumber') or device_config.get('port', 2404)
    asdu_address = device_config.get('iec104AsduAddress') or device_config.get('asdu_address', 1)
    
    if not host:
        error_info = extract_iec104_error_details("No host specified in device config (iec104IpAddress or ip)")
        return None, error_info
        
    if not address:
        error_info = extract_iec104_error_details("No address specified")
        return None, error_info
    
    # Parse the address
    type_id, ioa, parse_error = parse_iec104_address(address)
    if parse_error:
        error_info = extract_iec104_error_details(parse_error)
        return None, error_info
        
    client = IEC104Client(host, port, asdu_address)
    
    try:
        connect_success, connect_error = client.connect()
        if not connect_success:
            return None, connect_error
            
        value, error_info = client.read_point(ioa, type_id)
        return value, error_info
        
    except Exception as e:
        error_info = extract_iec104_error_details(e)
        logger.error(f"Error getting IEC-104 point {address}: {e}")
        return None, error_info
        
    finally:
        try:
            client.disconnect()
        except:
            pass

def iec104_set_with_error(device_config: Dict[str, Any], address: str, value: Any, public_address: int = None, point_number: int = None) -> Tuple[bool, Optional[Dict]]:
    """Set single IEC-104 point value with enhanced error handling using c104 library"""
    # Extract IEC-104 specific configuration
    host = device_config.get('iec104IpAddress') or device_config.get('ip')
    port = device_config.get('iec104PortNumber') or device_config.get('port', 2404)
    asdu_address = device_config.get('iec104AsduAddress') or device_config.get('asdu_address', 1)
    
    if not host:
        error_info = extract_iec104_error_details("No host specified in device config (iec104IpAddress or ip)")
        return False, error_info
        
    if not address:
        error_info = extract_iec104_error_details("No address specified")
        return False, error_info
    
    # Parse the address
    type_id, ioa, parse_error = parse_iec104_address(address)
    if parse_error:
        error_info = extract_iec104_error_details(parse_error)
        return False, error_info
        
    # Convert read types to write types
    if type_id.startswith('M_'):
        # Map monitoring types to corresponding command types (same as in write_point)
        command_type_mapping = {
            'M_SP_NA_1': 'C_SC_NA_1',  # Single point -> Single command
            'M_DP_NA_1': 'C_DC_NA_1',  # Double point -> Double command
            'M_ME_NA_1': 'C_SE_NA_1',  # Measured normalized -> Set normalized
            'M_ME_NB_1': 'C_SE_NB_1',  # Measured scaled -> Set scaled
            'M_ME_NC_1': 'C_SE_NC_1',  # Measured float -> Set float
        }
        type_id = command_type_mapping.get(type_id, 'C_SC_NA_1')
        
    client = IEC104Client(host, port, asdu_address)
    
    try:
        connect_success, connect_error = client.connect()
        if not connect_success:
            return False, connect_error
            
        success, error_info = client.write_point(ioa, value, type_id)
        return success, error_info
        
    except Exception as e:
        error_info = extract_iec104_error_details(e)
        logger.error(f"Error setting IEC-104 point {address}: {e}")
        return False, error_info
        
    finally:
        try:
            client.disconnect()
        except:
            pass
