import time
import logging
import threading
from pymodbus.client import ModbusTcpClient
import subprocess
import struct

logger = logging.getLogger(__name__)

# Global dict to store latest polled values: {device_name: {tag_id: value}}
_latest_polled_values = {}
_latest_polled_values_lock = threading.Lock()

def get_latest_polled_values():
    with _latest_polled_values_lock:
        # Return a deep copy to avoid race conditions
        import copy
        return copy.deepcopy(_latest_polled_values)

def ping_host(ip, count=2, timeout=1):
    try:
        logger.info(f"Attempting to ping {ip} with count={count}, timeout={timeout}")
        logger.info(f"Running as: {subprocess.run(['whoami'], capture_output=True, text=True).stdout.strip()}")
        result = subprocess.run(
            ['ping', '-c', str(count), '-W', str(timeout), ip],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        logger.info(f"Ping command exit code: {result.returncode}")
        logger.info(f"Ping stdout: {result.stdout}")
        if result.stderr:
            logger.info(f"Ping stderr: {result.stderr}")
        if result.returncode == 0:
            logger.info(f"Ping to {ip} successful")
            return True
        else:
            logger.error(f"Ping to {ip} failed:\n{result.stdout}\n{result.stderr}")
            return False
    except Exception as e:
        logger.error(f"Exception during ping to {ip}: {e}")
        return False

def get_tag_conversion_type(tag):
    ct = tag.get('conversionType')
    if not ct or not isinstance(ct, str):
        logger.warning(f"Tag {tag.get('name', 'unknown')} missing or invalid conversionType, defaulting to 'INT, Big Endian (ABCD)'")
        return 'INT, Big Endian (ABCD)'
    return ct

def get_tag_length_bit(tag):
    lb = tag.get('lengthBit')
    try:
        lb_int = int(lb)
        if lb_int not in (16, 32):
            logger.warning(f"Tag {tag.get('name', 'unknown')} has invalid lengthBit {lb}, defaulting to 16")
            return 16
        return lb_int
    except Exception:
        logger.warning(f"Tag {tag.get('name', 'unknown')} missing or invalid lengthBit, defaulting to 16")
        return 16

def convert_register_value(registers, pos, tag_config):
    try:
        conversion_type = get_tag_conversion_type(tag_config)
        length_bit = get_tag_length_bit(tag_config)
        scale = tag_config.get('scale', 1)
        offset = tag_config.get('offset', 0)
        logger.debug(f"Converting tag {tag_config.get('name')}: conversion={conversion_type}, length={length_bit}, scale={scale}, offset={offset}")
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
        logger.error(f"Error converting value for tag {tag_config.get('name', 'unknown')}: {e}")
        return 0

def poll_modbus_tcp_device(device_config, tags, scan_time_ms=1000):
    try:
        device_id = device_config.get('id', 'UnknownID')
        device_name = device_config.get('name', 'UnknownDevice')
        ip = device_config.get('ipAddress')
        port = device_config.get('portNumber', 502)
        unit = device_config.get('unitNumber', 1)
        logger.info(
            f"Polling Modbus TCP device: id={device_id}, name={device_name}, ip={ip}, port={port}, unit={unit}, scan_time_ms={scan_time_ms}"
        )
        if not ping_host(ip):
            logger.error(f"Device {ip} is not reachable by ping. Skipping polling.")
            return
        client = ModbusTcpClient(ip, port=port)
        if not client.connect():
            logger.error(f"Failed to connect to {ip}:{port}")
            return False
        logger.info(f"Connected to {ip}:{port}")
        addresses = []
        for tag in tags:
            try:
                addr = int(tag['address'])
                if addr >= 40001:
                    addr = addr - 40001
                addresses.append(addr)
            except Exception as e:
                logger.error(f"Invalid address for tag {tag.get('name')}: {e}")
        if not addresses:
            logger.warning(f"No valid addresses found for device {device_name}")
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
        logger.info(f"Reading {count} registers starting from address {min_addr} (calculated from tag configurations)")
        try:
            while True:
                result = client.read_holding_registers(address=min_addr, count=count, slave=unit)
                if result.isError():
                    logger.error(f"Error reading registers from {device_name}: {result}")
                else:
                    registers = result.registers
                    logger.info(f"Raw registers [{min_addr}-{min_addr+count-1}]: {registers}")
                    with _latest_polled_values_lock:
                        if device_name not in _latest_polled_values:
                            _latest_polled_values[device_name] = {}
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
                            converted_value = convert_register_value(registers, pos, tag)
                            logger.info(f"{device_name} [{tag_name} @ {address}] = {converted_value} ({get_tag_conversion_type(tag)}, {get_tag_length_bit(tag)}-bit)")
                            with _latest_polled_values_lock:
                                _latest_polled_values[device_name][tag_id] = converted_value
                        except Exception as e:
                            logger.error(f"Error processing tag {tag_name}: {e}")
                time.sleep(scan_time_ms / 1000.0)
        finally:
            client.close()
    except Exception as e:
        logger.exception(f"Exception in polling thread for device {device_config.get('name')}: {e}")

def start_polling_from_config(config):
    logger.info('Starting polling from config...')
    io_setup = config.get('io_setup', {})
    ports = io_setup.get('ports', [])
    for port in ports:
        if not port.get('enabled', False):
            continue
        for device in port.get('devices', []):
            if not device.get('enabled', False):
                continue
            if device.get('deviceType', '').lower() == 'modbus tcp':
                tags = device.get('tags', [])
                scan_time = port.get('scanTime', 1000)
                logger.info(f"Spawning polling thread for device {device.get('name')} at {device.get('ipAddress')}:{device.get('portNumber')}")
                t = threading.Thread(target=poll_modbus_tcp_device, args=(device, tags, scan_time), daemon=True)
                t.start() 