# Old logging import replaced
from app.logging_config import get_polling_logger, get_error_logger, log_error_with_context
import time
import threading
import socket
import struct
from typing import Dict, Any, Optional, Union, List, Tuple
from datetime import datetime
import asyncio

# Initialize specialized loggers
polling_logger = get_polling_logger()
error_logger = get_error_logger()

# =====================
# DNP3 Constants & Maps
# =====================
DNP3_DEFAULT_PORT = 20000
DNP3_START_BYTES = 0x0564  # 0x05 0x64
DNP3_MIN_FRAME_SIZE = 10

# Groups
DNP3_BINARY_INPUT = 1
DNP3_BINARY_OUTPUT = 10
DNP3_ANALOG_INPUT = 30
DNP3_ANALOG_OUTPUT = 41
DNP3_ANALOG_OUTPUT_STATUS = 40
DNP3_COUNTER = 20
DNP3_DOUBLE_BIT = 3

# Classes
DNP3_CLASS_0 = 60
DNP3_CLASS_1 = 61
DNP3_CLASS_2 = 62
DNP3_CLASS_3 = 63

# Functions
DNP3_FUNC_CONFIRM = 0x00
DNP3_FUNC_READ = 0x01
DNP3_FUNC_WRITE = 0x02
DNP3_FUNC_SELECT = 0x03
DNP3_FUNC_OPERATE = 0x04
DNP3_FUNC_RESPONSE = 0x81
DNP3_FUNC_UNSOLICITED = 0x82

# Point map with multiple variations for Advantech compatibility
POINT_TYPE_MAP = {
    'BI': DNP3_BINARY_INPUT,
    'BO': DNP3_BINARY_OUTPUT,
    'AI': DNP3_ANALOG_INPUT,
    'AO': DNP3_ANALOG_OUTPUT,
    'CTR': DNP3_COUNTER,
    'DBI': DNP3_DOUBLE_BIT,
}

# Advantech-specific variations to match device configuration
ADVANTECH_VARIATIONS = {
    DNP3_ANALOG_INPUT: [6],           # Group 30: Variation 6 - Long Floating Point (64-bit)
    DNP3_ANALOG_OUTPUT: [2],          # Group 40: Variation 2 - 16-bit (for status reads)
    DNP3_ANALOG_OUTPUT_STATUS: [2],   # Group 40: Variation 2 - 16-bit
    DNP3_BINARY_INPUT: [1],           # Group 1: Variation 1 - packed, without status
    DNP3_BINARY_OUTPUT: [2],          # Group 10: Variation 2 - with Status
    DNP3_COUNTER: [5],                # Group 20: Variation 5 - 32-bit without Flag
}

CLASS_MAP = {
    'Class 0': DNP3_CLASS_0,
    'Class 1': DNP3_CLASS_1,
    'Class 2': DNP3_CLASS_2,
    'Class 3': DNP3_CLASS_3,
}

# Block sizing for DNP3 CRC
_DNP3_BLOCK_SIZE = 16

# =====================
# CORRECTED DNP3 CRC-16 calculation
# =====================

def calculate_crc(data: bytes) -> int:
    """Correct DNP3 CRC-16 calculation per IEEE 1815 standard."""
    # IEEE 1815 DNP3 CRC-16 implementation
    # Polynomial: 0x3D65 (x^16 + x^13 + x^12 + x^11 + x^10 + x^8 + x^6 + x^5 + x^2 + 1)
    # Initial value: 0x0000
    # Little-endian transmission (LSB first, then MSB)
    crc = 0x0000  # Initialize to 0x0000 for DNP3 per IEEE 1815
    
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x0001:
                crc = (crc >> 1) ^ 0x3D65
            else:
                crc >>= 1
    
    return crc & 0xFFFF

def _add_block_crc(payload: bytes) -> bytes:
    """Append CRC every 16 bytes of payload."""
    out = bytearray()
    for i in range(0, len(payload), _DNP3_BLOCK_SIZE):
        block = payload[i:i + _DNP3_BLOCK_SIZE]
        out.extend(block)
        crc = calculate_crc(block)
        out.extend(struct.pack('<H', crc))
    return bytes(out)

def _strip_block_crc(payload_with_crc: bytes) -> bytes:
    """Remove CRC every 16 bytes starting right away. Assumes well-formed blocks."""
    out = bytearray()
    i = 0
    while i < len(payload_with_crc):
        # Determine block size (up to 16 bytes, but leave room for CRC)
        remaining = len(payload_with_crc) - i
        if remaining <= 2:  # Only CRC left, we're done
            break
            
        block_size = min(_DNP3_BLOCK_SIZE, remaining - 2)
        block = payload_with_crc[i:i + block_size]
        out.extend(block)
        
        # Skip the block and its CRC
        i += block_size + 2
        
    return bytes(out)

def _log_hex_dump(data: bytes, prefix: str = "", max_bytes: int = 256) -> None:
    """Log binary data as a hex dump for debugging."""
    if not data:
        logger.debug(f"{prefix}[EMPTY]")
        return
    
    # Limit the amount of data logged
    truncated = data[:max_bytes]
    hex_str = ' '.join(f'{b:02x}' for b in truncated)
    ascii_str = ''.join(chr(b) if 32 <= b <= 126 else '.' for b in truncated)
    
    logger.info(f"{prefix}Raw bytes ({len(data)} total): {hex_str}")
    logger.info(f"{prefix}ASCII: {ascii_str}")
    
    if len(data) > max_bytes:
        logger.info(f"{prefix}... (truncated, showing first {max_bytes} of {len(data)} bytes)")

# =====================
# Config
# =====================

class DNP3DeviceConfig:
    """DNP3 device configuration wrapper that reads from YAML config"""
    def __init__(self, device_config: Dict[str, Any]):
        self.device_config = device_config
        self.name = device_config.get('name', 'UnknownDevice')
        self.ip_address = device_config.get('dnp3IpAddress')
        self.port = device_config.get('dnp3PortNumber', DNP3_DEFAULT_PORT)
        self.local_address = device_config.get('dnp3LocalAddress', 1)
        self.remote_address = device_config.get('dnp3RemoteAddress', 4)
        self.timeout_ms = device_config.get('dnp3TimeoutMs', 5000)
        self.retries = device_config.get('dnp3Retries', 3)

        if not self.ip_address:
            raise ValueError(f"DNP3 device '{self.name}' missing required 'dnp3IpAddress' configuration")

    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'ip_address': self.ip_address,
            'port': self.port,
            'local_address': self.local_address,
            'remote_address': self.remote_address,
            'timeout_ms': self.timeout_ms,
            'retries': self.retries,
        }

# =====================
# Enhanced Client for Advantech
# =====================

class DNP3Client:
    """Enhanced DNP3 master-side client with corrected CRC."""
    def __init__(self, config: DNP3DeviceConfig):
        self.config = config
        self.socket: Optional[socket.socket] = None
        self.connected = False
        self.sequence = 0  # application seq (0-15)
        self.transport_seq = 0  # transport seq (0-63 but we keep 0-15)
        logger.info(f"Initialized DNP3 client for {config.name} at {config.ip_address}:{config.port}")

    # ---- Connection mgmt ----
    def _connect(self) -> bool:
        try:
            if self.socket:
                try:
                    self.socket.close()
                except Exception:
                    pass
                self.socket = None
                self.connected = False

            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            self.socket.settimeout(self.config.timeout_ms / 1000.0)
            logger.debug(f"Connecting to {self.config.name} at {self.config.ip_address}:{self.config.port}")
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
                except Exception:
                    pass
                self.socket = None
            return False

    def disconnect(self):
        if self.socket:
            try:
                self.socket.close()
                logger.debug(f"Disconnected from DNP3 device {self.config.name}")
            except Exception as e:
                logger.debug(f"Error closing DNP3 socket for {self.config.name}: {e}")
            finally:
                self.socket = None
                self.connected = False

    # ---- Corrected framing helpers ----
    def _link_header(self, payload_len: int, control: int = 0xC4) -> bytes:
        """Create DNP3 link header with CORRECTED CRC calculation."""
        start = b"\x05\x64"
        length = struct.pack('B', payload_len + 5)  # transport+APDU bytes + 5
        ctrl = struct.pack('B', control)
        dest = struct.pack('<H', self.config.remote_address)
        src = struct.pack('<H', self.config.local_address)
        
        # Build header without CRC
        hdr_wo_crc = start + length + ctrl + dest + src
        
        # Calculate CRC on the correct portion (excluding start bytes)
        crc_data = hdr_wo_crc[2:]  # Skip start bytes for CRC calculation
        hdr_crc = struct.pack('<H', calculate_crc(crc_data))
        
        return hdr_wo_crc + hdr_crc

    def _transport_header(self) -> bytes:
        # Single-fragment: FIR=1 FIN=1 ==> 0xC0 | (seq & 0x3F)
        self.transport_seq = (self.transport_seq + 1) & 0x3F
        return bytes([0xC0 | (self.transport_seq & 0x3F)])

    def _apdu(self, func: int, obj_bytes: bytes = b'') -> bytes:
        # App control: FIR=1 FIN=1 CON=0 UNS=0 | seq(0-15)
        self.sequence = (self.sequence + 1) & 0x0F
        app_ctl = 0xC0 | self.sequence
        return struct.pack('BB', app_ctl, func) + obj_bytes

    def _wrap_frame(self, apdu: bytes) -> bytes:
        tp = self._transport_header()
        payload = tp + apdu
        header = self._link_header(len(payload))
        return header + _add_block_crc(payload)

    def _send_and_recv(self, frame: bytes, retry_on_error: bool = True) -> Optional[bytes]:
        try:
            assert self.socket is not None
            
            # Log the outgoing frame
            logger.debug(f"🔼 Sending DNP3 frame to {self.config.name}:")
            _log_hex_dump(frame, f"🔼 {self.config.name} TX: ")
            
            self.socket.sendall(frame)
            
            # Set appropriate timeout
            self.socket.settimeout(self.config.timeout_ms / 1000.0)
            data = self.socket.recv(8192)
            
            # Log the incoming response
            if data:
                logger.info(f"🔽 Received DNP3 response from {self.config.name}:")
                _log_hex_dump(data, f"🔽 {self.config.name} RX: ")
            else:
                logger.warning(f"🔽 No data received from {self.config.name} (empty response)")
            
            return data if data else None
            
        except socket.timeout:
            logger.warning(f"⏱️ Timeout waiting for DNP3 response from {self.config.name}")
            return None
        except (BrokenPipeError, ConnectionResetError, OSError) as e:
            logger.warning(f"🔌 Connection lost with {self.config.name}: {e}")
            self.connected = False
            if self.socket:
                try:
                    self.socket.close()
                except:
                    pass
                self.socket = None
            
            # Retry once if requested
            if retry_on_error:
                logger.info(f"🔄 Attempting to reconnect and retry...")
                time.sleep(0.5)  # Brief delay before retry
                if self._connect():
                    return self._send_and_recv(frame, retry_on_error=False)
            return None
        except Exception as e:
            logger.error(f"Socket error communicating with {self.config.name}: {e}")
            return None

    # ---- Application primitives ----
    def _integrity_scan(self) -> bool:
        # Class 0, Variation 1, qualifier 0x06 (all objects)
        obj = struct.pack('<BBB', DNP3_CLASS_0, 1, 0x06)
        frame = self._wrap_frame(self._apdu(DNP3_FUNC_READ, obj))
        resp = self._send_and_recv(frame)
        return resp is not None


    def _class2_scan(self) -> Optional[bytes]:
        """Perform Class 2 scan for event data (required for some Advantech configurations)"""
        # Class 2, Variation 1, qualifier 0x06 (all objects)
        obj = struct.pack('<BBB', DNP3_CLASS_2, 1, 0x06)
        frame = self._wrap_frame(self._apdu(DNP3_FUNC_READ, obj))
        resp = self._send_and_recv(frame)
        return resp
    def _read_gv_index_with_variations(self, group: int, index: int) -> Optional[bytes]:
        """Try multiple variations for compatibility."""
        variations_to_try = ADVANTECH_VARIATIONS.get(group, [1])
        
        for i, variation in enumerate(variations_to_try):
            logger.info(f"🔍 Trying Group {group}, Variation {variation}, Index {index}")
            
            # Add small delay between variations to prevent device overload
            if i > 0:
                time.sleep(0.2)
            
            # Qualifier 0x28: count + index (16-bit), count=1, index=index
            obj = struct.pack('<BBBHH', group, variation, 0x28, 1, index)
            frame = self._wrap_frame(self._apdu(DNP3_FUNC_READ, obj))
            resp = self._send_and_recv(frame)
            
            if resp and len(resp) > 10:  # Got a response with data
                logger.info(f"✅ Got response with Group {group}, Variation {variation}")
                return resp
            else:
                logger.debug(f"❌ No response for Group {group}, Variation {variation}")
                
        return None

    # ---- Enhanced response parsing ----
    def _extract_apdu(self, response: bytes) -> Optional[bytes]:
        """Extract APDU with corrected CRC handling."""
        logger.info(f"📋 Extracting APDU from response (length: {len(response)})")
        
        if len(response) < 10:
            logger.warning(f"Response too short: {len(response)} bytes")
            return None
            
        if not (response[0] == 0x05 and response[1] == 0x64):
            logger.warning(f"Invalid DNP3 start bytes: 0x{response[0]:02x} 0x{response[1]:02x}")
            return None
            
        # Parse link layer header
        length = response[2]
        control = response[3]
        dest = struct.unpack('<H', response[4:6])[0]
        src = struct.unpack('<H', response[6:8])[0]
        header_crc = struct.unpack('<H', response[8:10])[0]
        
        logger.info(f"📋 Link layer - Length: {length}, Control: 0x{control:02x}, Dest: {dest}, Src: {src}, CRC: 0x{header_crc:04x}")
        
        # Verify header CRC
        header_data = response[2:8]  # Length through src address
        calculated_crc = calculate_crc(header_data)
        logger.info(f"📋 Header CRC check: calculated 0x{calculated_crc:04x}, received 0x{header_crc:04x}")
        
        # Strip header and get payload
        payload_with_crc = response[10:]
        logger.info(f"📋 Payload with CRC ({len(payload_with_crc)} bytes):")
        _log_hex_dump(payload_with_crc, "📋 Payload+CRC: ")
        
        if not payload_with_crc:
            logger.warning("No payload after header")
            return None
        
        # Strip block CRCs
        payload = _strip_block_crc(payload_with_crc)
        if not payload:
            logger.warning("No payload after CRC stripping")
            return None
            
        logger.info(f"📋 Payload after CRC removal ({len(payload)} bytes):")
        _log_hex_dump(payload, "📋 Payload: ")
        
        # First byte is transport header; rest is APDU
        if len(payload) < 2:
            logger.warning(f"Payload too short: {len(payload)} bytes")
            return None
            
        tp = payload[0]
        logger.info(f"📋 Transport header: 0x{tp:02x}")
        
        apdu = payload[1:]
        logger.info(f"📋 Extracted APDU ({len(apdu)} bytes):")
        _log_hex_dump(apdu, "📋 APDU: ")
        
        return apdu

    def _parse_single_value(self, apdu: bytes, wanted_group: int, index: int) -> Tuple[bool, Optional[Union[int, float, bool]], Optional[str]]:
        """Enhanced parsing with better error handling."""
        logger.info(f"🔍 Parsing APDU for group {wanted_group}, index {index}")
        _log_hex_dump(apdu, "🔍 APDU to parse: ")
        
        if len(apdu) < 2:
            error = "APDU too short"
            logger.warning(f"🔍 {error}")
            return False, None, error
            
        app_ctl = apdu[0]
        func = apdu[1]
        logger.info(f"🔍 App control: 0x{app_ctl:02x}, Function: 0x{func:02x}")
        
        # Handle unsolicited responses (0x82) - these often contain no data
        if func == DNP3_FUNC_UNSOLICITED:
            logger.warning("🔍 Received unsolicited response (0x82) - may contain no data")
            if len(apdu) == 4:  # Just app_ctl + func + IIN
                iin1 = apdu[2] if len(apdu) > 2 else 0
                iin2 = apdu[3] if len(apdu) > 3 else 0
                logger.info(f"🔍 Unsolicited IIN: 0x{iin1:02x} 0x{iin2:02x}")
                return False, None, "Unsolicited response with no object data"
        
        # Check for proper response function
        if func not in [DNP3_FUNC_RESPONSE, DNP3_FUNC_UNSOLICITED]:
            error = f"Unexpected function: 0x{func:02X}"
            logger.warning(f"🔍 {error}")
            return False, None, error
            
        # Parse IIN if present
        pos = 2
        if func == 0x81 and len(apdu) >= 4:
            iin1 = apdu[2]
            iin2 = apdu[3]
            logger.info(f"🔍 IIN flags: 0x{iin1:02x} 0x{iin2:02x}")
            
            if iin1 & 0x01:  # Object unknown
                return False, None, f"Object unknown for {wanted_group}.{index:03d} (IIN 0x01)"
            if iin1 & 0x02:  # Parameter error
                return False, None, f"Parameter error for {wanted_group}.{index:03d} (IIN 0x02)"
                
            pos = 4  # Skip IIN bytes
            
        # Parse objects
        try:
            object_count = 0
            while pos + 3 <= len(apdu):
                object_count += 1
                group = apdu[pos]
                variation = apdu[pos + 1]
                qualifier = apdu[pos + 2]
                logger.info(f"🔍 Object #{object_count}: Group {group}, Variation {variation}, Qualifier 0x{qualifier:02x}")
                pos += 3

                if qualifier == 0x17:  # start-stop (16-bit)
                    if pos + 4 > len(apdu):
                        logger.warning("🔍 Insufficient bytes for start/stop indices")
                        break
                        
                    start_idx, stop_idx = struct.unpack_from('<HH', apdu, pos)
                    logger.info(f"🔍 Range: {start_idx} to {stop_idx}")
                    pos += 4
                    
                    point_count = stop_idx - start_idx + 1
                    
                    if wanted_group == group and start_idx <= index <= stop_idx:
                        logger.info(f"🔍 Found matching object!")
                        
                        # Determine value size based on variation
                        if variation in [1, 2]:
                            value_size = 2
                        elif variation in [3, 4, 5]:
                            value_size = 4
                        elif variation == 6:
                            value_size = 8  # 64-bit floating point
                        else:
                            value_size = 2
                            
                        value_offset = (index - start_idx) * value_size
                        value_pos = pos + value_offset
                        
                        if value_pos + value_size <= len(apdu):
                            if value_size == 2:
                                raw = struct.unpack_from('<H', apdu, value_pos)[0]
                                logger.info(f"🔍 ✅ Found value: {raw}")
                                return True, float(raw), None
                            elif value_size == 4:
                                if variation == 5:  # 32-bit float
                                    raw = struct.unpack_from('<f', apdu, value_pos)[0]
                                else:  # 32-bit int
                                    raw = struct.unpack_from('<I', apdu, value_pos)[0]
                                logger.info(f"🔍 ✅ Found value: {raw}")
                                return True, float(raw), None
                            elif value_size == 8:
                                # 64-bit double precision float for variation 6
                                raw = struct.unpack_from('<d', apdu, value_pos)[0]
                                logger.info(f"🔍 ✅ Found 64-bit float value: {raw}")
                                return True, float(raw), None
                        else:
                            logger.warning(f"🔍 Value position {value_pos} out of bounds")
                    
                    # Skip this object's data
                    data_size = point_count * (4 if variation in [3, 4, 5, 6] else 2)
                    pos += data_size
                    
                elif qualifier == 0x28:  # count + index (16-bit)
                    if pos + 4 > len(apdu):
                        logger.warning("🔍 Insufficient bytes for count/index")
                        break
                        
                    count, first_index = struct.unpack_from('<HH', apdu, pos)
                    logger.info(f"🔍 Count: {count}, First index: {first_index}")
                    pos += 4
                    
                    if wanted_group == group and first_index <= index < first_index + count:
                        logger.info(f"🔍 Found matching object!")
                        
                        # Determine value size based on variation
                        if variation in [1, 2]:
                            value_size = 2
                        elif variation in [3, 4, 5]:
                            value_size = 4
                        elif variation == 6:
                            value_size = 8  # 64-bit floating point
                        else:
                            value_size = 2
                            
                        value_offset = (index - first_index) * value_size
                        value_pos = pos + value_offset
                        
                        if value_pos + value_size <= len(apdu):
                            if value_size == 2:
                                raw = struct.unpack_from('<H', apdu, value_pos)[0]
                                logger.info(f"🔍 ✅ Found value: {raw}")
                                return True, float(raw), None
                            elif value_size == 4:
                                if variation == 5:  # 32-bit float
                                    raw = struct.unpack_from('<f', apdu, value_pos)[0]
                                else:  # 32-bit int
                                    raw = struct.unpack_from('<I', apdu, value_pos)[0]
                                logger.info(f"🔍 ✅ Found value: {raw}")
                                return True, float(raw), None
                            elif value_size == 8:
                                # 64-bit double precision float for variation 6
                                raw = struct.unpack_from('<d', apdu, value_pos)[0]
                                logger.info(f"🔍 ✅ Found 64-bit float value: {raw}")
                                return True, float(raw), None
                        else:
                            logger.warning(f"🔍 Value position {value_pos} out of bounds")
                    
                    # Skip this object's data
                    data_size = count * (4 if variation in [3, 4, 5, 6] else 2)
                    pos += data_size
                    
                elif qualifier == 0x06:
                    # All objects - try heuristic search
                    logger.info("🔍 All objects qualifier - searching for data")
                    remaining = apdu[pos:]
                    
                    # Simple heuristic: look for our group number
                    for i in range(len(remaining) - 6):
                        if remaining[i] == wanted_group and i + 6 < len(remaining):
                            try:
                                # Try to extract a 16-bit value
                                raw = struct.unpack_from('<H', remaining, i + 4)[0]
                                logger.info(f"🔍 ✅ Heuristic found value: {raw}")
                                return True, float(raw), None
                            except:
                                continue
                    break
                else:
                    logger.info(f"🔍 Unhandled qualifier: 0x{qualifier:02x}")
                    break
                    
            if object_count == 0:
                logger.warning("🔍 No objects found in APDU")
                
        except Exception as e:
            error = f"Parse error: {e}"
            logger.error(f"🔍 {error}")
            return False, None, error
            
        return False, None, "Value not found in response"

    # ---- Public API ----
    def read_point(self, point_type: str, point_index: int) -> Tuple[Optional[Union[int, float, bool]], Optional[str]]:
        """Read DNP3 point with enhanced error handling."""
        # Connect with retries
        retry_count = 0
        while retry_count < self.config.retries:
            if self._connect():
                break
            retry_count += 1
            if retry_count < self.config.retries:
                time.sleep(0.5)
        if not self.connected:
            return None, f"Failed to connect after {self.config.retries} attempts"

        try:
            # Integrity scan
            logger.info(f"🔍 Performing integrity scan for {self.config.name}")
            if not self._integrity_scan():
                logger.warning(f"🔍 Integrity scan failed for {self.config.name}")
                # Continue anyway, sometimes integrity scan fails but reads work

            # Small delay after integrity scan
            time.sleep(0.1)

            # Map point type to group
            group_map = {
                "AI": DNP3_ANALOG_INPUT,
                "BI": DNP3_BINARY_INPUT,
                "AO": DNP3_ANALOG_OUTPUT_STATUS,
                "BO": DNP3_BINARY_OUTPUT,
                "CTR": DNP3_COUNTER,
            }

            group = group_map.get(point_type.upper())
            if group is None:
                return None, f"Unknown point type: {point_type}"

            logger.info(f"🔍 Reading {point_type}.{point_index:03d} (Group {group})")

            # Try reading the requested index
            for attempt in range(self.config.retries):
                logger.info(f"🔍 Read attempt {attempt + 1}/{self.config.retries}")
                
                # Reconnect if connection was lost
                if not self.connected:
                    logger.info(f"🔄 Reconnecting for attempt {attempt + 1}")
                    if not self._connect():
                        continue
                
                # For AO points (Group 40), try Class 2 scan first since they're configured as Class 2
                if group == DNP3_ANALOG_OUTPUT_STATUS:
                    logger.info(f"🔍 Trying Class 2 scan for AO.{point_index:03d}")
                    resp = self._class2_scan()
                    if resp:
                        apdu = self._extract_apdu(resp)
                        if apdu:
                            ok, value, err = self._parse_single_value(apdu, group, point_index)
                            if ok:
                                logger.info(f"✅ Successfully read {point_type}.{point_index:03d} via Class 2: {value}")
                                return value, None
                
                resp = self._read_gv_index_with_variations(group, point_index)
                if not resp:
                    # Add delay before next attempt
                    if attempt < self.config.retries - 1:
                        time.sleep(0.5)
                    continue
                    
                apdu = self._extract_apdu(resp)
                if not apdu:
                    continue
                    
                ok, value, err = self._parse_single_value(apdu, group, point_index)
                if ok:
                    logger.info(f"✅ Successfully read {point_type}.{point_index:03d}: {value}")
                    return value, None
                else:
                    logger.warning(f"🔍 Parse failed: {err}")
                    
            return None, f"No valid response for {point_type}.{point_index:03d}"
            
        except Exception as e:
            error_msg = f"Error reading {point_type}.{point_index:03d}: {e}"
            logger.error(error_msg)
            return None, error_msg
        finally:
            self.disconnect()

    def test_connection(self) -> Tuple[bool, Optional[str]]:
        try:
            if self._connect():
                ok = self._integrity_scan()
                self.disconnect()
                if ok:
                    return True, None
                return False, "No response to integrity scan"
            else:
                return False, f"Failed to connect to {self.config.ip_address}:{self.config.port}"
        except Exception as e:
            return False, str(e)

    def write_ao_value(self, index: int, value: Union[int, float]) -> Tuple[bool, Optional[str]]:
        """Write AO value."""
        if not self._connect():
            return False, "Failed to connect"
        try:
            self._integrity_scan()
            value16 = int(round(float(value))) & 0xFFFF
            ok = self._select_operate_ao(variation=2, index=index, value_16bit=value16)
            return (True, None) if ok else (False, "Select/Operate failed")
        except Exception as e:
            return False, f"Error writing AO.{index:03d}: {e}"
        finally:
            self.disconnect()

# =====================
# Service Layer
# =====================

class DNP3Service:
    """DNP3 service with corrected CRC"""
    def __init__(self):
        self.clients: Dict[str, DNP3Client] = {}

    def get_client(self, device_config: DNP3DeviceConfig) -> Optional[DNP3Client]:
        key = f"{device_config.ip_address}:{device_config.port}:{device_config.local_address}:{device_config.remote_address}"
        try:
            client = DNP3Client(device_config)
            self.clients[key] = client
            return client
        except Exception as e:
            logger.error(f"Failed to create DNP3 client: {e}")
            return None

    def read_tag_value(self, device_config: DNP3DeviceConfig, tag_config: Dict[str, Any]) -> Tuple[Optional[Union[int, float, bool]], Optional[str]]:
        try:
            client = self.get_client(device_config)
            if not client:
                return None, "Failed to create client"

            address = tag_config.get('address', '')
            if not address:
                return None, "No address specified"

            # Use dnp3PointIndex from config if available, otherwise parse from address
            if "dnp3PointIndex" in tag_config:
                point_index = tag_config["dnp3PointIndex"] - 1  # Convert EdgeLink number to 0-based DNP3 index
                # Extract point type from address (e.g., "AI" from "AI.000")
                if "." in address:
                    point_type = address.split(".")[0]
                else:
                    return None, f"Invalid address format: {address}"
            else:
                # Fallback to parsing address string
                normalized_address = address.replace(",", ".")
                if "." not in normalized_address:
                    return None, f"Invalid address format: {address}"
                try:
                    point_type, point_index_str = normalized_address.split(".", 1)
                    point_index = int(point_index_str)
                except ValueError:
                    return None, f"Invalid point index: {address}"

            logger.info(f"🔍 Reading {address} (type: {point_type}, index: {point_index})")
            value, error = client.read_point(point_type, point_index)
            
            if value is None:
                return None, error

            # Apply scaling
            scale = tag_config.get('scale', 1)
            offset = tag_config.get('offset', 0)
            if isinstance(value, (int, float)):
                scaled_value = (float(value) * scale) + offset
                logger.info(f"✅ Read {address}: raw={value}, scaled={scaled_value}")
                return scaled_value, None
            else:
                return value, None
                
        except Exception as e:
            logger.exception(f"Exception reading tag: {e}")
            return None, str(e)

    def test_connection(self, device_config: DNP3DeviceConfig) -> Tuple[bool, Optional[str]]:
        try:
            client = self.get_client(device_config)
            if not client:
                return False, "Failed to create client"
            return client.test_connection()
        except Exception as e:
            logger.exception(f"Error testing connection: {e}")
            return False, str(e)

    def write_tag_value(self, device_config: DNP3DeviceConfig, tag_config: Dict[str, Any], value: Union[int, float, bool]) -> Tuple[bool, Optional[str]]:
        try:
            client = self.get_client(device_config)
            if not client:
                return False, "Failed to create client"

            address = tag_config.get('address', '')
            normalized_address = address.replace(',', '.')
            ptype, pidx_str = normalized_address.split('.', 1)
            pidx = int(pidx_str)

            if ptype.upper() != 'AO':
                return False, f"Writes only supported for AO (got {ptype})"

            ok, err = client.write_ao_value(pidx, value)
            return ok, err
        except Exception as e:
            return False, str(e)

    def cleanup_clients(self):
        for client in self.clients.values():
            client.disconnect()
        self.clients.clear()

# Global service instance
dnp3_service = DNP3Service()

# =====================
# Module-level helpers
# =====================

def dnp3_get_with_error(device_config: Dict[str, Any], tag_config: Dict[str, Any]) -> Tuple[Optional[Union[int, float, bool]], Optional[str]]:
    try:
        dnp3_config = DNP3DeviceConfig(device_config)
        return dnp3_service.read_tag_value(dnp3_config, tag_config)
    except Exception as e:
        logger.exception(f"Error in dnp3_get_with_error: {e}")
        return None, str(e)

def dnp3_test_connection(device_config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    try:
        dnp3_config = DNP3DeviceConfig(device_config)
        return dnp3_service.test_connection(dnp3_config)
    except Exception as e:
        logger.exception(f"Error testing connection: {e}")
        return False, str(e)

def poll_dnp3_device_sync(device_config: Dict[str, Any], tags: List[Dict[str, Any]], scan_time_ms=2000):
    """Polling function for DNP3 devices."""
    if not tags:
        logger.warning("No DNP3 tags configured")
        return

    from app.services.polling_service import _latest_polled_values, _latest_polled_values_lock

    try:
        dnp3_config = DNP3DeviceConfig(device_config)
        device_name = dnp3_config.name

        logger.info(f"Starting DNP3 polling for {device_name}")

        # Initialize storage
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

        # Polling loop
        while True:
            current_thread = threading.current_thread()
            if hasattr(current_thread, '_stop_requested') and current_thread._stop_requested:
                logger.info(f"DNP3 polling stopped for {device_name}")
                break

            for tag in tags:
                try:
                    tag_id = tag.get('id', 'UnknownTagID')
                    tag_name = tag.get('name', 'UnknownTag')

                    value, error = dnp3_service.read_tag_value(dnp3_config, tag)

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
                    logger.exception(f"Error polling tag {tag.get('name', 'unknown')}: {e}")

            time.sleep(scan_time_ms / 1000.0)

    except Exception as e:
        logger.exception(f"Fatal error in DNP3 polling: {e}")
    finally:
        dnp3_service.cleanup_clients()

async def dnp3_set_with_error_async(device_config: Dict[str, Any], tag_config: Dict[str, Any], value: Union[int, float, bool]) -> Tuple[bool, Optional[str]]:
    """Async wrapper for DNP3 write."""
    try:
        dnp3_config = DNP3DeviceConfig(device_config)
        ok, err = dnp3_service.write_tag_value(dnp3_config, tag_config, value)
        return ok, err
    except Exception as e:
        logger.exception(f"Error in dnp3_set_with_error_async: {e}")
        return False, str(e)
