import time
import logging
import threading
from pymodbus.client import ModbusTcpClient, ModbusSerialClient
import subprocess
import struct
import serial
# from app.services.snmp_service import poll_snmp_device  # Not needed anymore, using command line snmpget

logger = logging.getLogger(__name__)

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

# Global dict to store latest polled values and status: {device_name: {tag_id: {value, status, error, timestamp}}}
_latest_polled_values = {}
_latest_polled_values_lock = threading.Lock()

def get_latest_polled_values():
    with _latest_polled_values_lock:
        import copy
        return copy.deepcopy(_latest_polled_values)

def ping_host(ip, count=2, timeout=1):
    try:
        # logger.info(f"Attempting to ping {ip} with count={count}, timeout={timeout}")
        # logger.info(f"Running as: {subprocess.run(['whoami'], capture_output=True, text=True).stdout.strip()}")
        result = subprocess.run(
            ['ping', '-c', str(count), '-W', str(timeout), ip],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        # logger.info(f"Ping command exit code: {result.returncode}")
        # logger.info(f"Ping stdout: {result.stdout}")
        if result.stderr:
            # logger.info(f"Ping stderr: {result.stderr}")
            pass
        if result.returncode == 0:
            # logger.info(f"Ping to {ip} successful")
            return True, None
        else:
            err = f"Ping to {ip} failed:\n{result.stdout}\n{result.stderr}"
            # logger.error(err)
            return False, err
    except Exception as e:
        # logger.error(f"Exception during ping to {ip}: {e}")
        return False, str(e)

def get_tag_conversion_type(tag):
    ct = tag.get('conversionType')
    if not ct or not isinstance(ct, str):
        # logger.warning(f"Tag {tag.get('name', 'unknown')} missing or invalid conversionType, defaulting to 'INT, Big Endian (ABCD)'")
        return 'INT, Big Endian (ABCD)'
    return ct

def get_tag_length_bit(tag):
    lb = tag.get('lengthBit')
    try:
        lb_int = int(lb)
        if lb_int not in (16, 32):
            # logger.warning(f"Tag {tag.get('name', 'unknown')} has invalid lengthBit {lb}, defaulting to 16")
            return 16
        return lb_int
    except Exception:
        # logger.warning(f"Tag {tag.get('name', 'unknown')} missing or invalid lengthBit, defaulting to 16")
        return 16

def convert_register_value(registers, pos, tag_config):
    try:
        conversion_type = get_tag_conversion_type(tag_config)
        length_bit = get_tag_length_bit(tag_config)
        scale = tag_config.get('scale', 1)
        offset = tag_config.get('offset', 0)
        # logger.debug(f"Converting tag {tag_config.get('name')}: conversion={conversion_type}, length={length_bit}, scale={scale}, offset={offset}")
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
        # logger.error(f"Error converting value for tag {tag_config.get('name', 'unknown')}: {e}")
        return 0

def poll_modbus_tcp_device(device_config, tags, scan_time_ms=1000):
    try:
        device_id = device_config.get('id', 'UnknownID')
        device_name = device_config.get('name', 'UnknownDevice')
        ip = device_config.get('ipAddress')
        port = device_config.get('portNumber', 502)
        unit = device_config.get('unitNumber', 1)
        # logger.info(
        #     f"Polling Modbus TCP device: id={device_id}, name={device_name}, ip={ip}, port={port}, unit={unit}, scan_time_ms={scan_time_ms}"
        # )
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
            # logger.error(f"Device {ip} is not reachable by ping. Skipping polling.")
            return
        client = ModbusTcpClient(ip, port=port)
        if not client.connect():
            # logger.error(f"Failed to connect to {ip}:{port}")
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
        # logger.info(f"Connected to {ip}:{port}")
        addresses = []
        for tag in tags:
            try:
                addr = int(tag['address'])
                if addr >= 40001:
                    addr = addr - 40001
                addresses.append(addr)
            except Exception as e:
                # logger.error(f"Invalid address for tag {tag.get('name')}: {e}")
                pass
        if not addresses:
            # logger.warning(f"No valid addresses found for device {device_name}")
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
        # logger.info(f"Reading {count} registers starting from address {min_addr} (calculated from tag configurations)")
        # Modbus protocol allows a maximum of 125 registers per read
        MAX_REGISTERS_PER_READ = 125

        # If count > MAX_REGISTERS_PER_READ, split into multiple reads
        try:
            while True:
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
                        # logger.error(f"Exception during Modbus read: {error_msg}")
                        with _latest_polled_values_lock:
                            for tag in tags:
                                tag_id = tag.get('id', 'UnknownTagID')
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "modbus_exception",
                                    "error": error_msg,
                                    "timestamp": now,
                                }
                        time.sleep(scan_time_ms / 1000.0)
                        break
                    if result.isError():
                        # logger.error(f"Error reading registers from {device_name}: {result}")
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
                        break
                    else:
                        all_registers.extend(result.registers)
                    current_addr += read_count
                    total_needed -= read_count
                else:
                    # Only process tags if all reads succeeded
                    now = int(time.time())
                    # logger.info(f"Raw registers [{min_addr}-{min_addr+count-1}]: {all_registers}")
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
                                # logger.info(f"{device_name} [{tag_name} @ {address}] = {converted_value} ({get_tag_conversion_type(tag)}, {get_tag_length_bit(tag)}-bit)")
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": converted_value,
                                    "status": "ok",
                                    "error": None,
                                    "timestamp": now,
                                }
                            except Exception as e:
                                # logger.error(f"Error processing tag {tag_name}: {e}")
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "conversion_error",
                                    "error": str(e),
                                    "timestamp": now,
                                }
                time.sleep(scan_time_ms / 1000.0)
        finally:
            client.close()
    except Exception as e:
        # logger.exception(f"Exception in polling thread for device {device_config.get('name')}: {e}")
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
        
        logger.info(
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
                logger.error(f"Invalid address for tag {tag.get('name')}: {e}")
                pass
        
        if not addresses:
            logger.warning(f"No valid addresses found for RTU device {device_name}")
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
            try:
                if not client.connect():
                    logger.error(f"Failed to connect to RTU device on {serial_port}")
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
                        logger.error(error_msg)
                        with _latest_polled_values_lock:
                            for tag in tags:
                                tag_id = tag.get('id', 'UnknownTagID')
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "rtu_exception",
                                    "error": error_msg,
                                    "timestamp": now,
                                }
                        break
                    
                    if result.isError():
                        logger.error(f"RTU error reading registers from {device_name}: {result}")
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
                        break
                    else:
                        all_registers.extend(result.registers)
                    
                    current_addr += read_count
                    total_needed -= read_count
                else:
                    # Process tags only if all reads succeeded
                    now = int(time.time())
                    logger.debug(f"RTU Raw registers [{min_addr}-{min_addr+count-1}]: {all_registers}")
                    
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
                                
                                logger.debug(f"RTU {device_name} [{tag_name} @ {address}] = {converted_value} "
                                           f"({get_tag_conversion_type(tag)}, {get_tag_length_bit(tag)}-bit)")
                                
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": converted_value,
                                    "status": "ok",
                                    "error": None,
                                    "timestamp": now,
                                }
                            except Exception as e:
                                logger.error(f"Error processing RTU tag {tag_name}: {e}")
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "rtu_conversion_error",
                                    "error": str(e),
                                    "timestamp": now,
                                }
                
            except serial.SerialException as se:
                logger.error(f"Serial port error for RTU device {device_name}: {se}")
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
                logger.error(f"Unexpected error in RTU polling for {device_name}: {e}")
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
        logger.exception(f"Exception in RTU polling thread for device {device_config.get('name')}: {e}")

def poll_snmp_device_sync(device_config, tags, scan_time_ms=60000):
    """Poll SNMP device using synchronous SNMP operations to avoid asyncio issues"""
    import subprocess
    import json
    
    try:
        device_id = device_config.get('id', 'UnknownID')
        device_name = device_config.get('name', 'UnknownDevice')
        ip = device_config.get('ipAddress')
        port = device_config.get('portNumber', 161)
        community = device_config.get('community', 'public')
        
        logger.info(
            f"Polling SNMP device: id={device_id}, name={device_name}, "
            f"ip={ip}, port={port}, community={community}, scan_time_ms={scan_time_ms}"
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
            logger.error(f"SNMP Device {ip} is not reachable by ping. Skipping polling.")
            return
        
        while True:
            try:
                now = int(time.time())
                
                # Poll each tag (OID) using snmpget command
                for tag in tags:
                    tag_id = tag.get('id', 'UnknownTagID')
                    tag_name = tag.get('name', 'UnknownTag')
                    oid = tag.get('address')  # Using 'address' field for OID
                    
                    if not oid:
                        logger.warning(f"Tag {tag_name} missing OID address")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "missing_oid",
                                "error": "No OID specified in tag address",
                                "timestamp": now,
                            }
                        continue
                    
                    try:
                        # Use snmpget command line tool instead of pysnmp to avoid asyncio issues
                        cmd = [
                            'snmpget',
                            '-v2c',
                            '-c', community,
                            '-t', '5',  # 5 second timeout
                            '-r', '1',  # 1 retry
                            f'{ip}:{port}',
                            oid
                        ]
                        
                        result = subprocess.run(
                            cmd,
                            capture_output=True,
                            text=True,
                            timeout=10
                        )
                        
                        if result.returncode == 0 and result.stdout.strip():
                            # Parse SNMP output
                            output = result.stdout.strip()
                            # Extract value from output like "SNMPv2-MIB::sysDescr.0 = STRING: Linux..."
                            if '=' in output:
                                value_part = output.split('=', 1)[1].strip()
                                if ':' in value_part:
                                    raw_value = value_part.split(':', 1)[1].strip()
                                else:
                                    raw_value = value_part
                            else:
                                raw_value = output
                            
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
                            
                            logger.debug(f"SNMP {device_name} [{tag_name} @ {oid}] = {final_value}")
                            
                            with _latest_polled_values_lock:
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": final_value,
                                    "status": "ok",
                                    "error": None,
                                    "timestamp": now,
                                }
                        else:
                            error_msg = f"SNMP GET failed for OID {oid}: {result.stderr.strip() if result.stderr else 'No response'}"
                            logger.error(f"SNMP GET failed for {tag_name} @ {oid}: {error_msg}")
                            with _latest_polled_values_lock:
                                _latest_polled_values[device_name][tag_id] = {
                                    "value": None,
                                    "status": "snmp_get_failed",
                                    "error": error_msg,
                                    "timestamp": now,
                                }
                    
                    except subprocess.TimeoutExpired:
                        error_msg = f"SNMP GET timeout for OID {oid}"
                        logger.error(f"SNMP timeout for {tag_name} @ {oid}")
                        with _latest_polled_values_lock:
                            _latest_polled_values[device_name][tag_id] = {
                                "value": None,
                                "status": "snmp_timeout",
                                "error": error_msg,
                                "timestamp": now,
                            }
                    
                    except Exception as e:
                        logger.error(f"Error polling SNMP tag {tag_name}: {e}")
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
                logger.info(f"SNMP polling for {device_name} interrupted by user")
                break
            except Exception as e:
                logger.exception(f"Unexpected error in SNMP polling cycle for {device_name}: {e}")
                time.sleep(5)  # Wait 5 seconds before retrying
            
    except Exception as e:
        logger.exception(f"Exception in SNMP polling thread for device {device_config.get('name')}: {e}")

def start_polling_from_config(config):
    # logger.info('Starting polling from config...')
    if config is None:
        logger.warning('No configuration provided to start_polling_from_config. Skipping polling setup.')
        return
    io_setup = config.get('io_setup', {})
    ports = io_setup.get('ports', [])
    for port in ports:
        if not port.get('enabled', False):
            continue
        for device in port.get('devices', []):
            if not device.get('enabled', False):
                continue
            device_type = device.get('deviceType', '').lower()
            
            if device_type == 'modbus tcp':
                tags = device.get('tags', [])
                scan_time = port.get('scanTime', 1000)
                logger.info(f"Spawning TCP polling thread for device {device.get('name')} at {device.get('ipAddress')}:{device.get('portNumber')}")
                t = threading.Thread(target=poll_modbus_tcp_device, args=(device, tags, scan_time), daemon=True)
                t.start()
                
            elif device_type == 'modbus rtu':
                tags = device.get('tags', [])
                scan_time = port.get('scanTime', 1000)
                # Pass port config to device for serial settings
                device_with_port = {**device, 'portConfig': port}
                logger.info(f"Spawning RTU polling thread for device {device.get('name')} on port {port.get('serialSettings', {}).get('port', 'unknown')}")
                t = threading.Thread(target=poll_modbus_rtu_device, args=(device_with_port, tags, scan_time), daemon=True)
                t.start()
                
            elif device_type == 'snmp':
                tags = device.get('tags', [])
                scan_time = port.get('scanTime', 60000)  # Default to 60 seconds for SNMP
                logger.info(f"Spawning SNMP polling thread for device {device.get('name')} at {device.get('ipAddress')}:{device.get('portNumber', 161)}")
                t = threading.Thread(target=poll_snmp_device_sync, args=(device, tags, scan_time), daemon=True)
                t.start()
