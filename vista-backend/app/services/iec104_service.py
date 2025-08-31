import socket
import struct
import time
import logging
import threading
from typing import Dict, Any, List, Tuple, Optional

logger = logging.getLogger(__name__)

class IEC104Client:
    def __init__(self, host: str, port: int = 2404, asdu_address: int = 1):
        self.host = host
        self.port = port
        self.asdu_address = asdu_address
        self.socket = None
        self.connected = False
        self.send_sequence = 0
        self.receive_sequence = 0
        
    def connect(self) -> bool:
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(10)
            self.socket.connect((self.host, self.port))
            self.connected = True
            logger.info(f"Connected to IEC-104 server {self.host}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to IEC-104 server: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
            self.socket = None
        self.connected = False
    
    def send_startdt(self) -> bool:
        """Send STARTDT command"""
        try:
            startdt = b'\x68\x04\x07\x00\x00\x00'
            self.socket.send(startdt)
            return True
        except Exception as e:
            logger.error(f"Failed to send STARTDT: {e}")
            return False
    
    def read_point(self, ioa: int, type_id: str = "M_ME_NA_1") -> Tuple[Any, Optional[str]]:
        """Read a single point"""
        try:
            if not self.connected:
                return None, "Not connected"
            
            # Simulate reading - in real implementation, would parse ASDU
            # For now, return a mock value
            value = 100.0 + (ioa % 100)  # Mock value based on IOA
            return value, None
            
        except Exception as e:
            return None, str(e)

def poll_iec104_device_sync(device_config: Dict[str, Any], tags: List[Dict[str, Any]], scan_time_ms: int = 1000):
    """Poll IEC-104 device synchronously"""
    from app.services.polling_service import _latest_polled_values, _latest_polled_values_lock
    
    device_name = device_config.get('name', 'UnknownDevice')
    ip = device_config.get('iec104IpAddress', '192.168.1.100')
    port = device_config.get('iec104PortNumber', 2404)
    asdu_address = device_config.get('iec104AsduAddress', 1)
    
    logger.info(f"Starting IEC-104 polling for {device_name} at {ip}:{port}")
    
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
    
    client = IEC104Client(ip, port, asdu_address)
    
    while True:
        current_thread = threading.current_thread()
        if hasattr(current_thread, '_stop_requested') and current_thread._stop_requested:
            logger.info(f"IEC-104 polling for {device_name} stopped by request")
            break
        
        try:
            if not client.connected:
                if not client.connect():
                    time.sleep(5)
                    continue
                client.send_startdt()
            
            now = int(time.time())
            
            for tag in tags:
                tag_id = tag.get('id', 'UnknownTagID')
                tag_name = tag.get('name', 'UnknownTag')
                address = tag.get('address', '')
                
                # Parse IEC-104 address (e.g., M_SP_NA_1.1001)
                try:
                    parts = address.split('.')
                    if len(parts) != 2:
                        raise ValueError("Invalid address format")
                    
                    type_id = parts[0]
                    ioa = int(parts[1])
                    
                    # Read point value
                    value, error = client.read_point(ioa, type_id)
                    
                    if value is not None:
                        # Apply scaling
                        scale = tag.get('scale', 1)
                        offset = tag.get('offset', 0)
                        final_value = (value * scale) + offset
                        
                        logger.debug(f"IEC-104 {device_name} [{tag_name} @ {address}] = {final_value}")
                        
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": final_value,
                                "status": "ok",
                                "error": None,
                                "timestamp": now,
                            }
                    else:
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
    """Read single IEC-104 point"""
    ip = device_config.get('iec104IpAddress', '192.168.1.100')
    port = device_config.get('iec104PortNumber', 2404)
    asdu_address = device_config.get('iec104AsduAddress', 1)
    
    client = IEC104Client(ip, port, asdu_address)
    
    try:
        if not client.connect():
            return None, "Connection failed"
        
        client.send_startdt()
        
        # Parse address
        parts = address.split('.')
        if len(parts) != 2:
            return None, "Invalid address format"
        
        type_id = parts[0]
        ioa = int(parts[1])
        
        return client.read_point(ioa, type_id)
        
    except Exception as e:
        return None, str(e)
    finally:
        client.disconnect()

def iec104_set_with_error(device_config: Dict[str, Any], address: str, value: Any) -> Tuple[bool, Optional[str]]:
    """Write single IEC-104 point"""
    try:
        # Mock implementation - would implement actual IEC-104 command
        logger.info(f"IEC-104 write to {address}: {value}")
        return True, None
    except Exception as e:
        return False, str(e)

def write_iec104_point(client: IEC104Client, ioa: int, value: Any, type_id: str = "C_SC_NA_1") -> Tuple[bool, Optional[str]]:
    """Write a value to IEC-104 point"""
    try:
        if not client.connected:
            return False, "Not connected"
        
        # In real implementation, would construct proper IEC-104 ASDU and send command
        # For now, mock the write operation
        logger.info(f"IEC-104 writing {value} to point {ioa} (type: {type_id})")
        
        # Simulate write command - in real implementation:
        # 1. Create ASDU with command type
        # 2. Set IOA (Information Object Address)
        # 3. Set value and quality descriptor
        # 4. Send I-format frame
        # 5. Wait for confirmation
        
        # Mock success
        return True, None
        
    except Exception as e:
        return False, str(e)

# Enhanced write function
def iec104_set_with_error(device_config: Dict[str, Any], address: str, value: Any) -> Tuple[bool, Optional[str]]:
    """Write single IEC-104 point with enhanced functionality"""
    ip = device_config.get('iec104IpAddress', '192.168.1.100')
    port = device_config.get('iec104PortNumber', 2404)
    asdu_address = device_config.get('iec104AsduAddress', 1)
    
    client = IEC104Client(ip, port, asdu_address)
    
    try:
        if not client.connect():
            return False, "Connection failed"
        
        client.send_startdt()
        
        # Parse address
        parts = address.split('.')
        if len(parts) != 2:
            return False, "Invalid address format"
        
        type_id = parts[0]
        ioa = int(parts[1])
        
        return write_iec104_point(client, ioa, value, type_id)
        
    except Exception as e:
        return False, str(e)
    finally:
        client.disconnect()
