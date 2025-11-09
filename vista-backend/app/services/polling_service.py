import time
# Old logging import replaced
import threading
from pymodbus.client import ModbusTcpClient, ModbusSerialClient
import subprocess
import struct
import serial
import json
import os
from app.logging_config import get_polling_logger, get_error_logger, log_error_with_context, get_startup_logger
from app.services.snmp_service import poll_snmp_device_sync, snmp_get_with_error_detailed, snmp_get
from app.services.opcua_service import poll_opcua_device_sync, opcua_get_with_error
from app.services.dnp3_service import poll_dnp3_device_sync, dnp3_get_with_error
from app.services.iec104_service import poll_iec104_device_sync, iec104_get_with_error
from app.services.last_seen import (
    load_last_successful_timestamps,
    update_last_successful_timestamp,
    get_last_successful_timestamp
)


# Connectivity Error Codes for Network/Ping Operations
CONNECTIVITY_ERROR_CODES = {
    0: "SUCCESS: Host is reachable",
    1: "TIMEOUT: Request timeout, host did not respond in time",
    2: "HOST_UNREACHABLE: Host is unreachable (network or routing issue)",
    3: "PACKET_LOSS: Partial packet loss detected",
    4: "NETWORK_UNREACHABLE: Network is unreachable",
    5: "HOST_DOWN: Host appears to be down or not responding",
    99: "CONNECTION_ERROR: General connectivity error"
}

def format_connectivity_error(error_code: int, verbose_description: str) -> str:
    """Format connectivity error in standardized format: (ERROR_CODE - ERROR DESCRIPTION/MESSAGE)"""
    return f"({error_code} - {verbose_description})"

def extract_ping_error_details(ping_output: str, stderr: str = "") -> tuple[int, str]:
    """Extract error code and formatted description from ping output"""
    combined_output = (ping_output + stderr).lower()
    
    if "100% packet loss" in combined_output:
        error_code = 5  # HOST_DOWN
        description = "HOST_DOWN: Host appears to be down or not responding"
    elif "packet loss" in combined_output:
        error_code = 3  # PACKET_LOSS
        description = "PACKET_LOSS: Partial packet loss detected"
    elif "timeout" in combined_output or "no response" in combined_output:
        error_code = 1  # TIMEOUT
        description = "TIMEOUT: Request timeout, host did not respond in time"
    elif "unreachable" in combined_output and "network" in combined_output:
        error_code = 4  # NETWORK_UNREACHABLE
        description = "NETWORK_UNREACHABLE: Network is unreachable"
    elif "unreachable" in combined_output:
        error_code = 2  # HOST_UNREACHABLE
        description = "HOST_UNREACHABLE: Host is unreachable (network or routing issue)"
    else:
        error_code = 99  # CONNECTION_ERROR
        description = "CONNECTION_ERROR: General connectivity error"
    
    return error_code, format_connectivity_error(error_code, description)
# Initialize specialized loggers
polling_logger = get_polling_logger()
error_logger = get_error_logger()

MODBUS_EXCEPTION_CODES = {
    1: "Illegal Function: The function code received in the query is not recognized or allowed.",
    2: "Illegal Data Address: The data address received in the query is not an allowable address.",
    3: "Illegal Data Value: A value contained in the query data field is not an allowable value.",
    4: "Slave Device Failure: An unrecoverable error occurred while the slave was attempting to perform the requested action.",
    5: "Acknowledge: The slave has accepted the request and is processing it, but a long duration of time will be required.",
    6: "Slave Device Busy: The slave is engaged in processing a long-duration command.",
    8: "Memory Parity Error: The slave attempted to read extended memory, but detected a parity error.",
    10: "Gateway Path Unavailable: The gateway is misconfigured or overloaded.",
    11: "Gateway Target Device Failed to Respond: No response was obtained from the target device.",
}

def get_modbus_exception_verbose(exception_code):
    return MODBUS_EXCEPTION_CODES.get(exception_code, "Unknown Modbus exception code.")

    """Get the last successful timestamp for a tag"""
    with _last_successful_timestamps_lock:
        return _last_successful_timestamps.get(device_name, {}).get(tag_id, None)
    return MODBUS_EXCEPTION_CODES.get(exception_code, "Unknown Modbus exception code.")

# Global dict to store latest polled values and status: {device_name: {tag_id: {value, status, error, timestamp, last_successful_timestamp}}}
_latest_polled_values = {}
_latest_polled_values_lock = threading.Lock()

def get_latest_polled_values():
    with _latest_polled_values_lock:
        import copy
        import json
        
        # Enrich with last successful timestamps
        enriched_values = copy.deepcopy(_latest_polled_values)
        for device_name, device_data in enriched_values.items():
            for tag_id, tag_data in device_data.items():
                # Skip if tag_data is not a dict (e.g., direct name mappings from virtual tags)
                if not isinstance(tag_data, dict):
                    continue
                    
                # Add last successful timestamp to each tag
                tag_data["last_successful_timestamp"] = get_last_successful_timestamp(device_name, tag_id)
                
                # Sanitize non-JSON-serializable values
                sanitized_data = {}
                for key, value in tag_data.items():
                    try:
                        # Test if the value is JSON serializable
                        json.dumps(value)
                        sanitized_data[key] = value
                    except (TypeError, ValueError):
                        # Convert non-serializable objects to strings
                        if hasattr(value, '__dict__'):
                            # For objects with __dict__, try to extract useful info
                            sanitized_data[key] = str(value)
                        elif hasattr(value, 'value'):
                            # For enums, use the value
                            sanitized_data[key] = str(value.value) 
                        elif hasattr(value, 'name'):
                            # For enums, use the name
                            sanitized_data[key] = str(value.name)
                        else:
                            # Fallback to string representation
                            sanitized_data[key] = str(value)
                
                # Replace the tag data with sanitized version
                enriched_values[device_name][tag_id] = sanitized_data
        
        return enriched_values

def ping_host(ip, count=2, timeout=1):
    try:
        polling_logger.info(f"Attempting to ping {ip} with count={count}, timeout={timeout}")
        polling_logger.info(f"Running as: {subprocess.run(['whoami'], capture_output=True, text=True).stdout.strip()}")
        result = subprocess.run(
            ['ping', '-c', str(count), '-W', str(timeout), ip],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        polling_logger.info(f"Ping command exit code: {result.returncode}")
        polling_logger.info(f"Ping stdout: {result.stdout}")
        if result.stderr:
            polling_logger.info(f"Ping stderr: {result.stderr}")
            pass
        if result.returncode == 0:
            polling_logger.info(f"Ping to {ip} successful")
            return True, None
        else:
            # Extract error details and apply standardized formatting
            error_code, formatted_error = extract_ping_error_details(result.stdout, result.stderr)
            # polling_logger.error(formatted_error)
            return False, formatted_error
    except Exception as e:
        # polling_logger.error(f"Exception during ping to {ip}: {e}")
        # Format exception as connection error
        error_code, formatted_error = extract_ping_error_details(str(e))
        return False, formatted_error

def get_tag_conversion_type(tag):
    ct = tag.get('conversionType')
    if not ct or not isinstance(ct, str):
        # polling_logger.warning(f"Tag {tag.get('name', 'unknown')} missing or invalid conversionType, defaulting to 'INT, Big Endian (ABCD)'")
        return 'INT, Big Endian (ABCD)'
    return ct

def get_tag_length_bit(tag):
    lb = tag.get('lengthBit')
    try:
        lb_int = int(lb)
        if lb_int not in (16, 32):
            # polling_logger.warning(f"Tag {tag.get('name', 'unknown')} has invalid lengthBit {lb}, defaulting to 16")
            return 16
        return lb_int
    except Exception:
        # polling_logger.warning(f"Tag {tag.get('name', 'unknown')} missing or invalid lengthBit, defaulting to 16")
        return 16

def convert_register_value(registers, pos, tag_config):
    try:
        conversion_type = get_tag_conversion_type(tag_config)
        length_bit = get_tag_length_bit(tag_config)
        scale = tag_config.get('scale', 1)
        offset = tag_config.get('offset', 0)
        # polling_logger.debug(f"Converting tag {tag_config.get('name')}: conversion={conversion_type}, length={length_bit}, scale={scale}, offset={offset}")
        raw_value = 0
        if length_bit == 16:
            if pos < len(registers):
                raw_value = registers[pos]
                if "INT" in conversion_type.upper():
                    if raw_value > 32767:
                        raw_value = raw_value - 65536
        elif length_bit == 32:
            if pos + 1 < len(registers):
                high_reg = registers[pos]
                low_reg = registers[pos + 1]
                if "ABCD" in conversion_type:
                    if "FLOAT" in conversion_type.upper():
                        packed = struct.pack('>HH', high_reg, low_reg)
                        raw_value = struct.unpack('>f', packed)[0]
                    else:
                        raw_value = (high_reg << 16) | low_reg
                elif "CDAB" in conversion_type:
                    if "FLOAT" in conversion_type.upper():
                        packed = struct.pack('<HH', low_reg, high_reg)
                        raw_value = struct.unpack('<f', packed)[0]
                    else:
                        raw_value = (low_reg << 16) | high_reg
                elif "BADC" in conversion_type:
                    if "FLOAT" in conversion_type.upper():
                        packed = struct.pack('>HH', low_reg, high_reg)
                        raw_value = struct.unpack('>f', packed)[0]
                    else:
                        raw_value = (low_reg << 16) | high_reg
                elif "DCBA" in conversion_type:
                    if "FLOAT" in conversion_type.upper():
                        packed = struct.pack('<HH', high_reg, low_reg)
                        raw_value = struct.unpack('<f', packed)[0]
                    else:
                        raw_value = (high_reg << 16) | low_reg
                if "INT" in conversion_type.upper() and "FLOAT" not in conversion_type.upper():
                    if raw_value > 2147483647:
                        raw_value = raw_value - 4294967296
        final_value = (raw_value * scale) + offset
        if tag_config.get('clampToLow', False):
            span_low = tag_config.get('spanLow', 0)
            final_value = max(final_value, span_low)
        if tag_config.get('clampToHigh', False):
            span_high = tag_config.get('spanHigh', 1000)
            final_value = min(final_value, span_high)
        if tag_config.get('clampToZero', False) and final_value < 0:
            final_value = 0
        return final_value
    except Exception as e:
        # polling_logger.error(f"Error converting value for tag {tag_config.get('name', 'unknown')}: {e}")
        return 0

def poll_modbus_tcp_device(device_config, tags, scan_time_ms=1000):
    try:
        device_id = device_config.get('id', 'UnknownID')
        device_name = device_config.get('name', 'UnknownDevice')
        ip = device_config.get('ipAddress')
        port = device_config.get('portNumber', 502)
        unit = device_config.get('unitNumber', 1)
        polling_logger.info(f"Polling Modbus TCP device: id={device_id}, name={device_name}, ip={ip}, port={port}, unit={unit}, scan_time_ms={scan_time_ms}")
        ping_ok, ping_err = ping_host(ip)
        with _latest_polled_values_lock:
            if device_name not in _latest_polled_values:
                _latest_polled_values[device_name] = {}
            for tag in tags:
                tag_id = tag.get('id', 'UnknownTagID')
                if not ping_ok:
                    _latest_polled_values[device_name][tag_id] = {
                        "value": None,
                        "status": "ping_failed",
                        "error": ping_err or f"Device {ip} is not reachable by ping.",
                        "timestamp": int(time.time()),
                    }
        if not ping_ok:
            polling_logger.error(f"Device {ip} is not reachable by ping. Skipping polling.")
            return
        client = ModbusTcpClient(ip, port=port)
        if not client.connect():
            polling_logger.error(f"Failed to connect to {ip}:{port}")
            with _latest_polled_values_lock:
                for tag in tags:
                    tag_id = tag.get('id', 'UnknownTagID')
                    _latest_polled_values[device_name][tag_id] = {
                        "value": None,
                        "status": "modbus_connect_failed",
                        "error": f"Failed to connect to {ip}:{port}",
                        "timestamp": int(time.time()),
                    }
            return False
        polling_logger.info(f"Connected to {ip}:{port}")
        addresses = []
        for tag in tags:
            try:
                addr = int(tag['address'])
                if addr >= 40001:
                    addr = addr - 40001
                addresses.append(addr)
            except Exception as e:
                # polling_logger.error(f"Invalid address for tag {tag.get('name')}: {e}")
                pass
        if not addresses:
            polling_logger.warning(f"No valid addresses found for device {device_name}")
            return
        min_addr = min(addresses)
        max_registers_needed = 0
        for tag in tags:
            addr = int(tag['address'])
            if addr >= 40001:
                addr = addr - 40001
            length_bit = get_tag_length_bit(tag)
            registers_needed = 2 if length_bit == 32 else 1
            max_registers_needed = max(max_registers_needed, addr + registers_needed - min_addr)
        count = max_registers_needed
        polling_logger.info(f"Reading {count} registers starting from address {min_addr} (calculated from tag configurations)")
        # Modbus protocol allows a maximum of 125 registers per read
        MAX_REGISTERS_PER_READ = 125

        # If count > MAX_REGISTERS_PER_READ, split into multiple reads
        try:
            while True:
                # Check if stop was requested (for graceful shutdown)
                current_thread = threading.current_thread()
                if hasattr(current_thread, '_stop_requested') and current_thread._stop_requested:
                    polling_logger.info(f"TCP polling for {device_name} stopped by request")
                    break
                all_registers = []
                total_needed = count
                current_addr = min_addr
                while total_needed > 0:
                    read_count = min(total_needed, MAX_REGISTERS_PER_READ)
                    try:
                        result = client.read_holding_registers(address=current_addr, count=read_count, device_id=unit)
                    except Exception as exc:
                        now = int(time.time())
                        error_msg = str(exc)
                        polling_logger.error(f"Exception during Modbus read: {error_msg}")
                        with _latest_polled_values_lock:
                            for tag in tags:
                                tag_id = tag.get('id', 'UnknownTagID')
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "modbus_exception",
                                    "error": error_msg,
                                    "timestamp": now,
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, now)
                        time.sleep(scan_time_ms / 1000.0)
                        break
                    if result.isError():
                        polling_logger.error(f"Error reading registers from {device_name}: {result}")
                        verbose_msg = None
                        if hasattr(result, 'exception_code'):
                            code = result.exception_code
                            verbose_msg = get_modbus_exception_verbose(code)
                            error_msg = f"{result} - {verbose_msg}"
                        else:
                            error_msg = str(result)
                        now = int(time.time())
                        with _latest_polled_values_lock:
                            for tag in tags:
                                tag_id = tag.get('id', 'UnknownTagID')
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "modbus_error",
                                    "error": error_msg,
                                    "timestamp": now,
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, now)
                        break
                    else:
                        all_registers.extend(result.registers)
                    current_addr += read_count
                    total_needed -= read_count
                else:
                    # Only process tags if all reads succeeded
                    now = int(time.time())
                    polling_logger.info(f"Raw registers [{min_addr}-{min_addr+count-1}]: {all_registers}")
                    with _latest_polled_values_lock:
                        for tag in tags:
                            tag_id = tag.get('id', 'UnknownTagID')
                            tag_name = tag.get('name', 'UnknownTag')
                            try:
                                address = int(tag['address'])
                                if address >= 40001:
                                    reg_addr = address - 40001
                                else:
                                    reg_addr = address
                                pos = reg_addr - min_addr
                                converted_value = convert_register_value(all_registers, pos, tag)
                                polling_logger.info(f"{device_name} [{tag_name} @ {address}] = {converted_value} ({get_tag_conversion_type(tag)}, {get_tag_length_bit(tag)}-bit)")
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": converted_value,
                                    "status": "ok",
                                    "error": None,
                                    "timestamp": now,
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, now)
                            except Exception as e:
                                polling_logger.error(f"Error processing tag {tag_name}: {e}")
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "conversion_error",
                                    "error": str(e),
                                    "timestamp": now,
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, now)
                time.sleep(scan_time_ms / 1000.0)
        finally:
            client.close()
    except Exception as e:
        polling_logger.exception(f"Exception in polling thread for device {device_config.get('name')}: {e}")
        pass

def poll_modbus_rtu_device(device_config, tags, scan_time_ms=1000):
    """Poll Modbus RTU device over serial connection"""
    try:
        device_id = device_config.get('id', 'UnknownID')
        device_name = device_config.get('name', 'UnknownDevice')
        unit = device_config.get('unitNumber', 1)
        
        # Get serial settings from device's parent port
        port_config = device_config.get('portConfig', {})
        serial_settings = port_config.get('serialSettings', {})
        
        serial_port = serial_settings.get('port', '/dev/ttyUSB0')
        baudrate = serial_settings.get('baudRate', 9600)
        parity = serial_settings.get('parity', 'None')
        stopbits = serial_settings.get('stopBit', 1)
        bytesize = serial_settings.get('dataBit', 8)
        
        # Convert parity to pymodbus format
        parity_map = {'None': 'N', 'Even': 'E', 'Odd': 'O'}
        parity_char = parity_map.get(parity, 'N')
        
        polling_logger.info(
            f"Polling Modbus RTU device: id={device_id}, name={device_name}, "
            f"port={serial_port}, baud={baudrate}, parity={parity_char}, "
            f"stopbits={stopbits}, bytesize={bytesize}, unit={unit}, scan_time_ms={scan_time_ms}"
        )
        
        # Initialize device in global storage
        with _latest_polled_values_lock:
            if device_name not in _latest_polled_values:
                _latest_polled_values[device_name] = {}
        
        # Create Modbus RTU client
        client = ModbusSerialClient(
            port=serial_port,
            baudrate=baudrate,
            parity=parity_char,
            stopbits=stopbits,
            bytesize=bytesize,
            timeout=3
        )
        
        # Calculate address range similar to TCP implementation
        addresses = []
        for tag in tags:
            try:
                addr = int(tag['address'])
                if addr >= 40001:
                    addr = addr - 40001
                addresses.append(addr)
            except Exception as e:
                polling_logger.error(f"Invalid address for tag {tag.get('name')}: {e}")
                pass
        
        if not addresses:
            polling_logger.warning(f"No valid addresses found for RTU device {device_name}")
            return
        
        min_addr = min(addresses)
        max_registers_needed = 0
        for tag in tags:
            addr = int(tag['address'])
            if addr >= 40001:
                addr = addr - 40001
            length_bit = get_tag_length_bit(tag)
            registers_needed = 2 if length_bit == 32 else 1
            max_registers_needed = max(max_registers_needed, addr + registers_needed - min_addr)
        
        count = max_registers_needed
        MAX_REGISTERS_PER_READ = 125
        
        while True:
            # Check if stop was requested (for graceful shutdown)
            current_thread = threading.current_thread()
            if hasattr(current_thread, '_stop_requested') and current_thread._stop_requested:
                polling_logger.info(f"RTU polling for {device_name} stopped by request")
                break
                
            try:
                if not client.connect():
                    polling_logger.error(f"Failed to connect to RTU device on {serial_port}")
                    with _latest_polled_values_lock:
                        for tag in tags:
                            tag_id = tag.get('id', 'UnknownTagID')
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "serial_connect_failed",
                                "error": f"Failed to connect to serial port {serial_port}",
                                "timestamp": int(time.time()),
                            }
                    time.sleep(scan_time_ms / 1000.0)
                    continue
                
                # Read registers in batches (same logic as TCP)
                all_registers = []
                total_needed = count
                current_addr = min_addr
                
                while total_needed > 0:
                    read_count = min(total_needed, MAX_REGISTERS_PER_READ)
                    try:
                        result = client.read_holding_registers(
                            address=current_addr, 
                            count=read_count, 
                            device_id=unit
        )
                    except Exception as exc:
                        now = int(time.time())
                        error_msg = f"RTU read exception: {str(exc)}"
                        polling_logger.error(error_msg)
                        with _latest_polled_values_lock:
                            for tag in tags:
                                tag_id = tag.get('id', 'UnknownTagID')
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "rtu_exception",
                                    "error": error_msg,
                                    "timestamp": now,
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, now)
                        break
                    
                    if result.isError():
                        polling_logger.error(f"RTU error reading registers from {device_name}: {result}")
                        verbose_msg = None
                        if hasattr(result, 'exception_code'):
                            code = result.exception_code
                            verbose_msg = get_modbus_exception_verbose(code)
                            error_msg = f"RTU Modbus Error: {result} - {verbose_msg}"
                        else:
                            error_msg = f"RTU Error: {str(result)}"
                        
                        now = int(time.time())
                        with _latest_polled_values_lock:
                            for tag in tags:
                                tag_id = tag.get('id', 'UnknownTagID')
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "rtu_modbus_error",
                                    "error": error_msg,
                                    "timestamp": now,
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, now)
                        break
                    else:
                        all_registers.extend(result.registers)
                    
                    current_addr += read_count
                    total_needed -= read_count
                else:
                    # Process tags only if all reads succeeded
                    now = int(time.time())
                    polling_logger.debug(f"RTU Raw registers [{min_addr}-{min_addr+count-1}]: {all_registers}")
                    
                    with _latest_polled_values_lock:
                        for tag in tags:
                            tag_id = tag.get('id', 'UnknownTagID')
                            tag_name = tag.get('name', 'UnknownTag')
                            try:
                                address = int(tag['address'])
                                if address >= 40001:
                                    reg_addr = address - 40001
                                else:
                                    reg_addr = address
                                pos = reg_addr - min_addr
                                converted_value = convert_register_value(all_registers, pos, tag)
                                
                                polling_logger.debug(f"RTU {device_name} [{tag_name} @ {address}] = {converted_value} "
                                           f"({get_tag_conversion_type(tag)}, {get_tag_length_bit(tag)}-bit)")
                                
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": converted_value,
                                    "status": "ok",
                                    "error": None,
                                    "timestamp": now,
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, now)
                            except Exception as e:
                                polling_logger.error(f"Error processing RTU tag {tag_name}: {e}")
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "rtu_conversion_error",
                                    "error": str(e),
                                    "timestamp": now,
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, now)
                
            except serial.SerialException as se:
                polling_logger.error(f"Serial port error for RTU device {device_name}: {se}")
                with _latest_polled_values_lock:
                    for tag in tags:
                        tag_id = tag.get('id', 'UnknownTagID')
                        _latest_polled_values[device_name][tag_id] = {
                            "value": None,
                            "status": "serial_port_error",
                            "error": f"Serial port error: {str(se)}",
                            "timestamp": int(time.time()),
                        }
            except Exception as e:
                polling_logger.error(f"Unexpected error in RTU polling for {device_name}: {e}")
                with _latest_polled_values_lock:
                    for tag in tags:
                        tag_id = tag.get('id', 'UnknownTagID')
                        _latest_polled_values[device_name][tag_id] = {
                            "value": None,
                            "status": "rtu_polling_error",
                            "error": str(e),
                            "timestamp": int(time.time()),
                        }
            finally:
                if client.is_socket_open():
                    client.close()
            
            time.sleep(scan_time_ms / 1000.0)
            
    except Exception as e:
        polling_logger.exception(f"Exception in RTU polling thread for device {device_config.get('name')}: {e}")

def poll_snmp_device_sync(device_config, tags, scan_time_ms=60000):
    """Poll SNMP device using synchronous SNMP operations to avoid asyncio issues"""
    import subprocess
    import json
    
    try:
        device_id = device_config.get('id', 'UnknownID')
        device_name = device_config.get('name', 'UnknownDevice')
        ip = device_config.get('ipAddress') or device_config.get('ip')
        port = device_config.get('portNumber', 161) or device_config.get('port', 161)
        community = device_config.get('community', 'public')
        
        # Create normalized device config for SNMP service
        snmp_device_config = {
            'ip': ip,
            'port': port,
            'community': community,
            'snmpVersion': device_config.get('snmpVersion', 'v2c'),
            'snmpV3SecurityLevel': device_config.get('snmpV3SecurityLevel', 'noAuthNoPriv'),
            'snmpV3Username': device_config.get('snmpV3Username', ''),
            'snmpV3AuthProtocol': device_config.get('snmpV3AuthProtocol', ''),
            'snmpV3AuthPassword': device_config.get('snmpV3AuthPassword', ''),
            'snmpV3PrivProtocol': device_config.get('snmpV3PrivProtocol', ''),
            'snmpV3PrivPassword': device_config.get('snmpV3PrivPassword', ''),
            'snmpV3ContextName': device_config.get('snmpV3ContextName', ''),
            'snmpV3ContextEngineId': device_config.get('snmpV3ContextEngineId', ''),
        }
        
        polling_logger.info(
            f"Polling SNMP device: id={device_id}, name={device_name}, "
            f"ip={ip}, port={port}, version={snmp_device_config['snmpVersion']}, "
            f"community={community}, scan_time_ms={scan_time_ms}"
        )
        
        # Initialize device in global storage
        with _latest_polled_values_lock:
            if device_name not in _latest_polled_values:
                _latest_polled_values[device_name] = {}
        
        # Check if device is reachable
        ping_ok, ping_err = ping_host(ip)
        if not ping_ok:
            with _latest_polled_values_lock:
                for tag in tags:
                    tag_id = tag.get('id', 'UnknownTagID')
                    _latest_polled_values[device_name][tag_id] = {
                        "value": None,
                        "status": "ping_failed",
                        "error": ping_err or f"Device {ip} is not reachable by ping.",
                        "timestamp": int(time.time()),
                    }
            polling_logger.error(f"SNMP Device {ip} is not reachable by ping. Skipping polling.")
            return
        
        while True:
            # Check if stop was requested (for graceful shutdown)
            current_thread = threading.current_thread()
            if hasattr(current_thread, '_stop_requested') and current_thread._stop_requested:
                polling_logger.info(f"SNMP polling for {device_name} stopped by request")
                break
                
            try:
                now = int(time.time())
                
                # Poll each tag (OID) using snmpget command
                for tag in tags:
                    tag_id = tag.get('id', 'UnknownTagID')
                    tag_name = tag.get('name', 'UnknownTag')
                    oid = tag.get('address')  # Using 'address' field for OID
                    
                    if not oid:
                        polling_logger.warning(f"Tag {tag_name} missing OID address")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "missing_oid",
                                "error": "No OID specified in tag address",
                                "timestamp": now,
                            }
                        continue
                    
                    try:
                        # Use enhanced SNMP service for all versions (v1, v2c, v3)
                        raw_value, snmp_error, error_details, http_status = snmp_get_with_error_detailed(snmp_device_config, oid)
                        
                        if raw_value is not None and raw_value != "":
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
                            
                            polling_logger.debug(f"SNMP {device_name} [{tag_name} @ {oid}] = {final_value}")
                            
                            with _latest_polled_values_lock:
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": final_value,
                                    "status": "ok",
                                    "error": None,
                                    "timestamp": now,
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, now)
                        elif raw_value == "":
                            # Handle empty string as "noSuchName" error (OID not available)
                            from app.services.snmp_service import get_snmp_error_verbose, format_enhanced_snmp_error
                            error_details_empty = {
                                'error_code': 2,  # noSuchName
                                'error_index': None,
                                'verbose_description': get_snmp_error_verbose(2),
                                'error_message': f'Empty response for OID {oid}',
                                'error_indication': 'OID not available on target device'
                            }
                            enhanced_error = format_enhanced_snmp_error(error_details_empty, "SNMP GET", oid)
                            status_code = "snmp_no_such_name"
                            
                            polling_logger.error(f"SNMP GET failed for {tag_name} @ {oid} [Error Code 2]: OID not available on target device")
                            
                            with _latest_polled_values_lock:
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": status_code,
                                    "error": enhanced_error,
                                    "timestamp": now,
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, now)
                        else:
                            # Use enhanced error message if available
                            error_msg = snmp_error or f"SNMP GET failed for OID {oid}"
                            status_code = "snmp_get_failed"
                            
                            # Provide more specific status based on error details
                            if error_details and error_details.get('error_code') is not None:
                                error_code = error_details['error_code']
                                if error_code == 2:
                                    status_code = "snmp_no_such_name"
                                elif error_code == 16:
                                    status_code = "snmp_auth_error"
                                elif error_code in [3, 7, 8, 9, 10]:
                                    status_code = "snmp_bad_value"
                                elif error_code == 4:
                                    status_code = "snmp_read_only"
                                elif error_code in [13, 14, 15]:
                                    status_code = "snmp_resource_error"
                            elif 'timeout' in (snmp_error or '').lower():
                                status_code = "snmp_timeout"
                            
                            # Log detailed error information
                            if error_details and error_details.get('error_code') is not None:
                                polling_logger.error(f"SNMP GET failed for {tag_name} @ {oid} [Error Code {error_details['error_code']}]: {error_details.get('verbose_description', 'Unknown error')}")
                            else:
                                polling_logger.error(f"SNMP GET failed for {tag_name} @ {oid}: {error_msg}")
                            
                            with _latest_polled_values_lock:
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": status_code,
                                    "error": error_msg,
                                    "timestamp": now,
                                }
                                # Update persistent last successful timestamp
                                update_last_successful_timestamp(device_name, tag_id, now)
                    
                    except Exception as e:
                        polling_logger.error(f"Error polling SNMP tag {tag_name}: {e}")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "snmp_error",
                                "error": str(e),
                                "timestamp": now,
                            }
                
                # Wait for the next polling cycle
                time.sleep(scan_time_ms / 1000.0)
                
            except KeyboardInterrupt:
                polling_logger.info(f"SNMP polling for {device_name} interrupted by user")
                break
            except Exception as e:
                polling_logger.exception(f"Unexpected error in SNMP polling cycle for {device_name}: {e}")
                time.sleep(5)  # Wait 5 seconds before retrying
            
    except Exception as e:
        polling_logger.exception(f"Exception in SNMP polling thread for device {device_config.get('name')}: {e}")

def start_polling_from_config(config):
    # Import here to avoid circular import issues
    from gateway_manager import gateway_manager
    
    # polling_logger.info('Starting polling from config...')
    
    # Load persistent last successful timestamps
    load_last_successful_timestamps()
    if config is None:
        polling_logger.warning('No configuration provided to start_polling_from_config. Skipping polling setup.')
        return
    
    # First, stop all existing polling threads
    polling_logger.info('Stopping existing polling threads before starting new ones...')
    gateway_manager.stop_all_polling_threads()
    
    # Wait a moment for threads to stop
    time.sleep(1)
    
    # Initialize virtual tags (user tags + calculation tags)
    try:
        from app.services.virtual_tag_service import initialize_virtual_tags
        initialize_virtual_tags(config)
        polling_logger.info('Virtual tags (user tags + calculation tags) initialized successfully')
    except Exception as e:
        polling_logger.error(f'Failed to initialize virtual tags: {e}')
    
    io_setup = config.get('io_setup', {})
    ports = io_setup.get('ports', [])
    for port in ports:
        if not port.get('enabled', False):
            continue
        for device in port.get('devices', []):
            if not device.get('enabled', False):
                continue
            device_type = device.get('deviceType', '').lower()
            device_name = device.get('name', 'UnknownDevice')
            
            if device_type == 'modbus tcp':
                tags = device.get('tags', [])
                scan_time = port.get('scanTime', 1000)
                thread_name = f"tcp-{device_name}"
                polling_logger.info(f"Starting managed TCP polling thread for device {device_name} at {device.get('ipAddress')}:{device.get('portNumber')}")
                gateway_manager.start_polling_thread(
                    thread_name,
                    poll_modbus_tcp_device,
                    (device, tags, scan_time)
                )
                
            elif device_type == 'modbus rtu':
                tags = device.get('tags', [])
                scan_time = port.get('scanTime', 1000)
                # Pass port config to device for serial settings
                device_with_port = {**device, 'portConfig': port}
                thread_name = f"rtu-{device_name}"
                polling_logger.info(f"Starting managed RTU polling thread for device {device_name} on port {port.get('serialSettings', {}).get('port', 'unknown')}")
                gateway_manager.start_polling_thread(
                    thread_name,
                    poll_modbus_rtu_device,
                    (device_with_port, tags, scan_time)
                )
                
            elif device_type == 'snmp':
                tags = device.get('tags', [])
                scan_time = port.get('scanTime', 60000)  # Default to 60 seconds for SNMP
                thread_name = f"snmp-{device_name}"
                polling_logger.info(f"Starting managed SNMP polling thread for device {device_name} at {device.get('ipAddress')}:{device.get('portNumber', 161)}")
                gateway_manager.start_polling_thread(
                    thread_name,
                    poll_snmp_device_sync,
                    (device, tags, scan_time)
                )
                
            elif device_type == 'opc-ua':
                tags = device.get('tags', [])
                scan_time = port.get('scanTime', 1000)  # Default to 1 second for OPC-UA
                thread_name = f"opcua-{device_name}"
                polling_logger.info(f"Starting managed OPC-UA polling thread for device {device_name} at {device.get('opcuaServerUrl')}")
                gateway_manager.start_polling_thread(
                    thread_name,
                    poll_opcua_device_sync,
                    (device, tags, scan_time)
                )
                
            elif device_type == 'dnp3.0' or device_type == 'dnp-3':
                tags = device.get('tags', [])
                scan_time = port.get('scanTime', 2000)  # Default to 2 seconds for DNP3
                thread_name = f"dnp3-{device_name}"
                polling_logger.info(f"Starting managed DNP3 polling thread for device {device_name} at {device.get('dnp3IpAddress', 'unknown')}:{device.get('dnp3PortNumber', 20000)}")
                gateway_manager.start_polling_thread(
                    thread_name,
                    poll_dnp3_device_sync,
                    (device, tags, scan_time)
                )

            elif device_type == 'iec-104' or device_type == 'iec104':
                tags = device.get('tags', [])
                scan_time = port.get('scanTime', 1000)  # Default to 1 second for IEC-104
                thread_name = f"iec104-{device_name}"
                polling_logger.info(f"Starting managed IEC-104 polling thread for device {device_name} at {device.get('iec104IpAddress', 'unknown')}:{device.get('iec104PortNumber', 2404)}")
                gateway_manager.start_polling_thread(
                    thread_name,
                    poll_iec104_device_sync,
                    (device, tags, scan_time)
                )
            else:
                polling_logger.warning(f"Unknown device type: {device_type} for device {device_name}")

def stop_all_polling():
    """Stop all active polling threads"""
    from gateway_manager import gateway_manager
    startup_logger = get_startup_logger()
    startup_logger.info("🛑 Stopping all polling threads for configuration deployment...")
    stopped_count = gateway_manager.stop_all_polling_threads()
    startup_logger.info(f"🛑 Successfully stopped {stopped_count} polling threads")
    return stopped_count

def get_polling_threads_status():
    """Get status of all polling threads"""
    from gateway_manager import gateway_manager
    return gateway_manager.get_active_threads_status()

