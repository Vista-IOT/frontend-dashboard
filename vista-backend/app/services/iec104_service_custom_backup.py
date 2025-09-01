import socket
import struct
import time
import logging
import threading
from typing import Dict, Any, List, Tuple, Optional
from enum import IntEnum

logger = logging.getLogger(__name__)

# IEC 60870-5-104 Protocol Constants
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

class IEC104Client:
    def __init__(self, host: str, port: int = 2404, asdu_address: int = 1):
        self.host = str(host)
        self.port = int(port)
        self.asdu_address = int(asdu_address)
        self.socket = None
        self.connected = False
        self.send_seq = 0
        self.receive_seq = 0
        
    def connect(self) -> bool:
        """Establish TCP connection to IEC-104 server"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(10)
            self.socket.connect((self.host, self.port))
            self.connected = True
            logger.info(f"Connected to IEC-104 server {self.host}:{self.port}")
            
            # Send STARTDT (Start Data Transfer) command
            if self._send_startdt():
                logger.info("STARTDT command sent successfully")
                return True
            else:
                self.disconnect()
                return False
                
        except Exception as e:
            logger.error(f"Failed to connect to IEC-104 server {self.host}:{self.port}: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Close connection"""
        if self.socket:
            try:
                # Send STOPDT before closing
                self._send_stopdt()
                self.socket.close()
            except:
                pass
            self.socket = None
        self.connected = False
    
    def _send_startdt(self) -> bool:
        """Send STARTDT (Start Data Transfer) frame"""
        try:
            # STARTDT frame: 0x68 0x04 0x07 0x00 0x00 0x00
            startdt = b'\x68\x04\x07\x00\x00\x00'
            self.socket.send(startdt)
            
            # Wait for STARTDT CON
            response = self.socket.recv(6)
            if len(response) >= 6 and response[:4] == b'\x68\x04\x0b\x00':
                logger.debug("Received STARTDT CON")
                return True
            else:
                logger.error(f"Invalid STARTDT response: {response.hex()}")
                return False
        except Exception as e:
            logger.error(f"Failed to send STARTDT: {e}")
            return False
    
    def _send_stopdt(self) -> bool:
        """Send STOPDT (Stop Data Transfer) frame"""
        try:
            # STOPDT frame: 0x68 0x04 0x13 0x00 0x00 0x00
            stopdt = b'\x68\x04\x13\x00\x00\x00'
            self.socket.send(stopdt)
            return True
        except Exception as e:
            logger.error(f"Failed to send STOPDT: {e}")
            return False
    
    def _send_interrogation(self, target_asdu: int = None) -> bool:
        """Send general interrogation command"""
        try:
            self.send_seq += 1
            
            # Use target ASDU or default to client's ASDU (which comes from device config)
            asdu_addr = target_asdu if target_asdu is not None else self.asdu_address
            
            # ASDU for general interrogation (C_IC_NA_1)
            asdu_data = struct.pack('<BBBB', 
                TypeID.C_IC_NA_1,           # Type ID
                0x01,                       # VSQ (Variable Structure Qualifier) 
                CauseOfTransmission.ACTIVATION, # COT
                asdu_addr                   # Common Address (use device ASDU, not tag public address)
            )
            
            # Information Object (IOA = 0 for general interrogation)
            io_data = struct.pack('<HB', 0, 20)  # IOA=0, QOI=20 (station interrogation)
            
            # Combine ASDU
            full_asdu = asdu_data + io_data
            
            # I-frame header
            frame_length = len(full_asdu) + 4
            i_frame = struct.pack('<BBHH',
                0x68,           # Start byte
                frame_length,   # Length
                self.send_seq << 1,  # Send sequence number
                self.receive_seq << 1  # Receive sequence number
            ) + full_asdu
            
            self.socket.send(i_frame)
            logger.info(f"Sent interrogation command for ASDU {asdu_addr}, frame: {i_frame.hex()}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send interrogation: {e}")
            return False
    
    def _parse_asdu_response(self, data: bytes) -> List[Dict[str, Any]]:
        """Parse ASDU response and extract information objects"""
        try:
            if len(data) < 6:
                return []
            
            # Check if this is an I-frame (bit 0 = 0)
            if len(data) < 6 or (data[2] & 0x01) != 0:
                logger.debug("Not an I-frame, skipping")
                return []
            
            # Skip I-frame header (6 bytes) and parse ASDU
            asdu_start = 6
            if len(data) <= asdu_start + 4:
                return []
            
            type_id = data[asdu_start]
            vsq = data[asdu_start + 1]
            cot = data[asdu_start + 2]
            asdu_addr = data[asdu_start + 3]
            
            logger.info(f"ASDU Response: TypeID={type_id}, VSQ={vsq}, COT={cot}, ASDU_ADDR={asdu_addr}")
            
            objects = []
            io_start = asdu_start + 4
            
            # Parse information objects based on type
            if type_id == TypeID.M_SP_NA_1:  # Single point
                while io_start + 3 <= len(data):
                    ioa = struct.unpack('<H', data[io_start:io_start+2])[0]
                    siq = data[io_start+2]  # Single point information with quality
                    value = bool(siq & 0x01)
                    quality = (siq >> 4) & 0x0F
                    
                    objects.append({
                        'ioa': ioa,
                        'value': value,
                        'quality': quality,
                        'type': 'single_point'
                    })
                    io_start += 3
                    
            elif type_id == TypeID.M_ME_NC_1:  # Measured value, float
                while io_start + 7 <= len(data):
                    ioa = struct.unpack('<H', data[io_start:io_start+2])[0]
                    value = struct.unpack('<f', data[io_start+2:io_start+6])[0]
                    quality = data[io_start+6]
                    
                    objects.append({
                        'ioa': ioa,
                        'value': value,
                        'quality': quality,
                        'type': 'float'
                    })
                    io_start += 7
                    
            elif type_id == TypeID.M_ME_NA_1:  # Measured value, normalized
                while io_start + 5 <= len(data):
                    ioa = struct.unpack('<H', data[io_start:io_start+2])[0]
                    value_raw = struct.unpack('<H', data[io_start+2:io_start+4])[0]
                    quality = data[io_start+4]
                    
                    # Convert normalized value to float (-1.0 to +1.0)
                    value = (value_raw - 32768) / 32767.0
                    
                    objects.append({
                        'ioa': ioa,
                        'value': value,
                        'quality': quality,
                        'type': 'normalized'
                    })
                    io_start += 5
            
            return objects
            
        except Exception as e:
            logger.error(f"Error parsing ASDU response: {e}")
            return []
    
    def read_point(self, ioa: int, type_id: str = "M_SP_NA_1") -> Tuple[Any, Optional[str]]:
        """Read a single point using real IEC-104 protocol"""
        try:
            if not self.connected:
                return None, "Not connected"
            
            ioa = int(ioa)
            
            # Send interrogation command using the device's ASDU address (not tag's public address)
            if not self._send_interrogation(self.asdu_address):
                return None, "Failed to send interrogation command"
            
            # Receive and parse responses
            start_time = time.time()
            all_ioas_found = []
            
            while time.time() - start_time < 5.0:  # 5 second timeout
                try:
                    # Receive frame
                    data = self.socket.recv(1024)
                    if not data:
                        continue
                    
                    logger.debug(f"Received frame: {data.hex()}")
                    
                    # Parse response
                    objects = self._parse_asdu_response(data)
                    
                    # Collect all IOAs for debugging
                    for obj in objects:
                        all_ioas_found.append(obj['ioa'])
                        if obj['ioa'] == ioa:
                            logger.info(f"IEC-104 read point {ioa}: {obj['value']} (real value from Advantech)")
                            return obj['value'], None
                    
                except socket.timeout:
                    continue
                except Exception as e:
                    logger.debug(f"Error receiving frame: {e}")
                    continue
            
            # If we get here, the specific IOA wasn't found
            if all_ioas_found:
                logger.warning(f"IOA {ioa} not found. Available IOAs from device: {sorted(set(all_ioas_found))}")
                return None, f"Point {ioa} not available. Device has IOAs: {sorted(set(all_ioas_found))}"
            else:
                logger.warning(f"No IOAs found in device response for ASDU {self.asdu_address}")
                return None, f"No points available from device (ASDU {self.asdu_address})"
            
        except Exception as e:
            logger.error(f"Error in read_point for IOA {ioa}: {e}")
            return None, str(e)
    
    def write_point(self, ioa: int, value: Any, type_id: str = "C_SC_NA_1") -> Tuple[bool, Optional[str]]:
        """Write a value to IEC-104 point using real protocol"""
        try:
            if not self.connected:
                return False, "Not connected"
            
            ioa = int(ioa)
            
            # Convert value to appropriate type
            try:
                if isinstance(value, str):
                    if '.' in value:
                        value = float(value)
                    else:
                        value = int(value)
            except (ValueError, TypeError):
                pass
            
            # Build command ASDU based on type
            self.send_seq += 1
            
            if type_id == "M_SP_NA_1":
                # For single point, use single command
                asdu_data = struct.pack('<BBBB',
                    TypeID.C_SC_NA_1,
                    0x01,  # VSQ
                    CauseOfTransmission.ACTIVATION,
                    self.asdu_address  # Use device ASDU address
                )
                
                # Single command information object
                sco = 0x01 if bool(value) else 0x00  # Single Command Object
                io_data = struct.pack('<HB', ioa, sco)
                
            elif type_id == "M_ME_NC_1":
                # For float measured value, use float set-point command
                asdu_data = struct.pack('<BBBB',
                    TypeID.C_SE_NC_1,
                    0x01,  # VSQ
                    CauseOfTransmission.ACTIVATION,
                    self.asdu_address  # Use device ASDU address
                )
                
                # Floating point set-point command
                io_data = struct.pack('<HfB', ioa, float(value), 0x00)  # QOS = 0
                
            elif type_id == "M_ME_NA_1":
                # For normalized measured value, use normalized set-point command
                asdu_data = struct.pack('<BBBB',
                    TypeID.C_SE_NA_1,
                    0x01,  # VSQ
                    CauseOfTransmission.ACTIVATION,
                    self.asdu_address  # Use device ASDU address
                )
                
                # Normalize value to range -1.0 to +1.0 and convert to 16-bit
                normalized = max(-1.0, min(1.0, float(value) / 1000.0))  # Assume max range 1000
                value_16bit = int((normalized + 1.0) * 32767.5)
                io_data = struct.pack('<HHB', ioa, value_16bit, 0x00)  # QOS = 0
                
            else:
                # Default to single command for unknown types
                asdu_data = struct.pack('<BBBB',
                    TypeID.C_SC_NA_1,
                    0x01,  # VSQ
                    CauseOfTransmission.ACTIVATION,
                    self.asdu_address  # Use device ASDU address
                )
                
                sco = 0x01 if bool(value) else 0x00
                io_data = struct.pack('<HB', ioa, sco)
            
            # Build complete I-frame
            full_asdu = asdu_data + io_data
            frame_length = len(full_asdu) + 4
            
            i_frame = struct.pack('<BBHH',
                0x68,           # Start byte
                frame_length,   # Length
                self.send_seq << 1,  # Send sequence number
                self.receive_seq << 1  # Receive sequence number
            ) + full_asdu
            
            # Send command
            self.socket.send(i_frame)
            logger.info(f"Sent IEC-104 write command for IOA {ioa} to ASDU {self.asdu_address}: {value}")
            
            # Wait for confirmation
            start_time = time.time()
            while time.time() - start_time < 5.0:
                try:
                    response = self.socket.recv(1024)
                    if len(response) >= 10:
                        # Check for activation confirmation
                        if len(response) > 8:
                            cot = response[8]  # Cause of transmission in ASDU
                            if cot == CauseOfTransmission.ACTIVATION_CON:
                                logger.info(f"IEC-104 write confirmed for IOA {ioa}: {value}")
                                return True, None
                except socket.timeout:
                    continue
                except Exception as e:
                    logger.debug(f"Error waiting for confirmation: {e}")
                    break
            
            logger.warning(f"IEC-104 write timeout for IOA {ioa}")
            return False, "Write command timeout - no confirmation received"
            
        except Exception as e:
            logger.error(f"Error in write_point for IOA {ioa}: {e}")
            return False, str(e)

def poll_iec104_device_sync(device_config: Dict[str, Any], tags: List[Dict[str, Any]], scan_time_ms: int = 1000):
    """Poll IEC-104 device synchronously using real protocol"""
    from app.services.polling_service import _latest_polled_values, _latest_polled_values_lock
    
    device_name = device_config.get('name', 'UnknownDevice')
    ip = device_config.get('iec104IpAddress')
    port = device_config.get('iec104PortNumber', 2404)
    asdu_address = device_config.get('iec104AsduAddress', 1)  # Use device ASDU address
    
    if not ip:
        logger.error(f"No IEC-104 IP address configured for device {device_name}")
        return
    
    logger.info(f"Starting real IEC-104 polling for {device_name} at {ip}:{port} (Device ASDU: {asdu_address})")
    
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
    
    # Create client with device ASDU address
    client = IEC104Client(ip, port, asdu_address)
    
    while True:
        current_thread = threading.current_thread()
        if hasattr(current_thread, '_stop_requested') and current_thread._stop_requested:
            logger.info(f"IEC-104 polling for {device_name} stopped by request")
            break
        
        try:
            if not client.connected:
                if not client.connect():
                    logger.warning(f"IEC-104 connection failed for {device_name} at {ip}:{port}, retrying in 5 seconds...")
                    # Update all tags to show connection error
                    with _latest_polled_values_lock:
                        for tag in tags:
                            tag_id = tag.get('id', 'UnknownTagID')
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "connection_failed",
                                "error": f"Cannot connect to {ip}:{port}",
                                "timestamp": int(time.time()),
                            }
                    time.sleep(5)
                    continue
            
            now = int(time.time())
            
            for tag in tags:
                tag_id = tag.get('id', 'UnknownTagID')
                tag_name = tag.get('name', 'UnknownTag')
                address = tag.get('address', '')
                
                # Get IEC-104 specific parameters
                # NOTE: iec104PublicAddress is NOT the ASDU address, it's a tag-specific parameter
                # The ASDU address comes from device configuration: iec104AsduAddress
                point_number = tag.get('iec104PointNumber')
                
                try:
                    if not address:
                        raise ValueError("Empty address")
                    
                    if not point_number:
                        raise ValueError("Missing iec104PointNumber")
                    
                    # Address is now just the type (e.g., M_SP_NA_1)
                    type_id = str(address)
                    ioa = int(point_number)
                    
                    logger.debug(f"Reading IEC-104 point: type={type_id}, IOA={ioa}, device_ASDU={asdu_address}")
                    
                    # Read point value using device ASDU address (not tag public address)
                    value, error = client.read_point(ioa, type_id)
                    
                    if value is not None:
                        # Apply scaling from configuration
                        scale = float(tag.get('scale', 1))
                        offset = float(tag.get('offset', 0))
                        final_value = (float(value) * scale) + offset
                        
                        logger.info(f"IEC-104 {device_name} [{tag_name} @ {type_id}.{ioa}] = {final_value} (real from Advantech)")
                        
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": final_value,
                                "status": "ok",
                                "error": None,
                                "timestamp": now,
                            }
                    else:
                        logger.warning(f"IEC-104 read failed for {tag_name} @ {type_id}.{ioa}: {error}")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "iec104_read_failed",
                                "error": error or "Read failed",
                                "timestamp": now,
                            }
                
                except Exception as e:
                    logger.error(f"Error processing IEC-104 tag {tag_name}: {e}")
                    with _latest_polled_values_lock:
                        _latest_polled_values[device_name][tag_id] = {
                            "value": None,
                            "status": "iec104_tag_error",
                            "error": str(e),
                            "timestamp": now,
                        }
            
            time.sleep(scan_time_ms / 1000.0)
            
        except Exception as e:
            logger.error(f"IEC-104 polling error for {device_name}: {e}")
            client.disconnect()
            time.sleep(5)
    
    client.disconnect()

def iec104_get_with_error(device_config: Dict[str, Any], address: str) -> Tuple[Any, Optional[str]]:
    """Read single IEC-104 point using real protocol"""
    ip = device_config.get('iec104IpAddress')
    port = device_config.get('iec104PortNumber', 2404)
    asdu_address = device_config.get('iec104AsduAddress', 1)  # Use device ASDU address
    
    if not ip:
        return None, "IEC-104 IP address not configured"
    
    client = IEC104Client(ip, port, asdu_address)
    
    try:
        if not client.connect():
            return None, f"Connection failed to {ip}:{port}"
        
        # For direct calls, parse address as TYPE.IOA format for backward compatibility
        if '.' in address:
            parts = str(address).split('.')
            if len(parts) != 2:
                return None, f"Invalid address format: {address}"
            type_id = str(parts[0])
            ioa = int(parts[1])
        else:
            # New format: address is just the type, IOA comes from somewhere else
            type_id = str(address)
            ioa = 1  # Default IOA for direct calls
        
        return client.read_point(ioa, type_id)
        
    except Exception as e:
        return None, str(e)
    finally:
        client.disconnect()

def iec104_set_with_error(device_config: Dict[str, Any], address: str, value: Any, public_address: int = None, point_number: int = None) -> Tuple[bool, Optional[str]]:
    """Write single IEC-104 point using real protocol"""
    ip = device_config.get('iec104IpAddress')
    port = device_config.get('iec104PortNumber', 2404)
    asdu_address = device_config.get('iec104AsduAddress', 1)  # Use device ASDU address
    
    if not ip:
        return False, "IEC-104 IP address not configured"
    
    client = IEC104Client(ip, port, asdu_address)
    
    try:
        if not client.connect():
            return False, f"Connection failed to {ip}:{port}"
        
        # Handle both old format (TYPE.IOA) and new format (TYPE only)
        if '.' in address:
            # Old format: M_SP_NA_1.2
            parts = str(address).split('.')
            if len(parts) != 2:
                return False, f"Invalid address format: {address}"
            type_id = str(parts[0])
            ioa = int(parts[1])
        else:
            # New format: address is just type, use point_number for IOA
            type_id = str(address)
            ioa = int(point_number) if point_number is not None else 1
        
        logger.info(f"IEC-104 write: type={type_id}, IOA={ioa}, device_ASDU={asdu_address}, value={value}")
        
        return client.write_point(ioa, value, type_id)
        
    except Exception as e:
        return False, str(e)
    finally:
        client.disconnect()
