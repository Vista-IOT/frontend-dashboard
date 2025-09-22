# Updated to use centralized polling logger
from app.logging_config import get_polling_logger, get_error_logger, log_error_with_context

import logging
import time
import struct
from typing import Dict, Any, Optional, Union, List, Tuple
from datetime import datetime

# Try to import pymodbus, fall back gracefully if not available
try:
    from pymodbus.client import ModbusTcpClient, ModbusSerialClient
    from pymodbus.exceptions import ModbusException, ConnectionException
    from pymodbus.pdu import ExceptionResponse
    PYMODBUS_AVAILABLE = True
    logger = get_polling_logger()
    logger.info("pymodbus library loaded successfully")
except ImportError as e:
    PYMODBUS_AVAILABLE = False
    logger = get_polling_logger()
    logger.warning(f"pymodbus library not available: {e}. Modbus functionality will be limited.")

logger = get_polling_logger()

# Modbus function codes
MODBUS_READ_COILS = 1
MODBUS_READ_DISCRETE_INPUTS = 2
MODBUS_READ_HOLDING_REGISTERS = 3
MODBUS_READ_INPUT_REGISTERS = 4
MODBUS_WRITE_SINGLE_COIL = 5
MODBUS_WRITE_SINGLE_REGISTER = 6
MODBUS_WRITE_MULTIPLE_COILS = 15
MODBUS_WRITE_MULTIPLE_REGISTERS = 16

# Modbus exception codes with descriptions
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

# Data type conversion settings
MODBUS_DATA_TYPES = {
    'INT16': {'size': 1, 'signed': True, 'float': False},
    'UINT16': {'size': 1, 'signed': False, 'float': False},
    'INT32': {'size': 2, 'signed': True, 'float': False},
    'UINT32': {'size': 2, 'signed': False, 'float': False},
    'FLOAT32': {'size': 2, 'signed': False, 'float': True},
    'BOOL': {'size': 1, 'signed': False, 'float': False},
}

# Byte order options
BYTE_ORDER_TYPES = {
    'ABCD': '>HH',  # Big Endian
    'CDAB': '<HH',  # Little Endian
    'BADC': '>HH',  # Big Endian with word swap
    'DCBA': '<HH',  # Little Endian with word swap
}


class ModbusDeviceConfig:
    """Modbus device configuration wrapper"""
    
    def __init__(self, device_config: Dict[str, Any]):
        self.device_config = device_config
        self.name = device_config.get('name', 'UnknownDevice')
        self.ip_address = device_config.get('ipAddress', 'localhost')
        self.port_number = device_config.get('portNumber', 502)
        self.unit_number = device_config.get('unitNumber', 1)
        self.timeout = device_config.get('timeout', 3)
        self.retry_on_empty = device_config.get('retryOnEmpty', False)
        self.retry_on_invalid = device_config.get('retryOnInvalid', False)
        self.remove_null_values = device_config.get('removeNullValues', False)
        
        # Serial settings for RTU (if applicable)
        port_config = device_config.get('portConfig', {})
        self.serial_settings = port_config.get('serialSettings', {})


def get_modbus_exception_verbose(exception_code: int) -> str:
    """Get verbose description for Modbus exception code"""
    return MODBUS_EXCEPTION_CODES.get(exception_code, "Unknown Modbus exception code.")


def convert_value_for_modbus(value: Any, data_type: str, byte_order: str = 'ABCD') -> Union[int, List[int]]:
    """
    Convert a value to the appropriate format for Modbus writing.
    
    Args:
        value: Value to convert
        data_type: Target data type (INT16, UINT16, INT32, UINT32, FLOAT32, BOOL)
        byte_order: Byte order for multi-register values (ABCD, CDAB, BADC, DCBA)
    
    Returns:
        Converted value(s) ready for Modbus write
    """
    try:
        data_type = data_type.upper()
        byte_order = byte_order.upper()
        
        if data_type == 'BOOL':
            return bool(value)
        elif data_type == 'INT16':
            int_val = int(value)
            if int_val < -32768 or int_val > 32767:
                raise ValueError(f"Value {int_val} out of range for INT16 (-32768 to 32767)")
            return int_val if int_val >= 0 else int_val + 65536
        elif data_type == 'UINT16':
            int_val = int(value)
            if int_val < 0 or int_val > 65535:
                raise ValueError(f"Value {int_val} out of range for UINT16 (0 to 65535)")
            return int_val
        elif data_type == 'INT32':
            int_val = int(value)
            if int_val < -2147483648 or int_val > 2147483647:
                raise ValueError(f"Value {int_val} out of range for INT32")
            
            # Convert to unsigned 32-bit for register representation
            if int_val < 0:
                int_val = int_val + 4294967296
            
            high_reg = (int_val >> 16) & 0xFFFF
            low_reg = int_val & 0xFFFF
            
            # Apply byte ordering
            if byte_order == 'ABCD':  # Big Endian
                return [high_reg, low_reg]
            elif byte_order == 'CDAB':  # Little Endian
                return [low_reg, high_reg]
            elif byte_order == 'BADC':  # Big Endian with word swap
                return [low_reg, high_reg]
            elif byte_order == 'DCBA':  # Little Endian with word swap
                return [high_reg, low_reg]
            else:
                return [high_reg, low_reg]  # Default to ABCD
                
        elif data_type == 'UINT32':
            int_val = int(value)
            if int_val < 0 or int_val > 4294967295:
                raise ValueError(f"Value {int_val} out of range for UINT32 (0 to 4294967295)")
            
            high_reg = (int_val >> 16) & 0xFFFF
            low_reg = int_val & 0xFFFF
            
            # Apply byte ordering
            if byte_order == 'ABCD':  # Big Endian
                return [high_reg, low_reg]
            elif byte_order == 'CDAB':  # Little Endian
                return [low_reg, high_reg]
            elif byte_order == 'BADC':  # Big Endian with word swap
                return [low_reg, high_reg]
            elif byte_order == 'DCBA':  # Little Endian with word swap
                return [high_reg, low_reg]
            else:
                return [high_reg, low_reg]  # Default to ABCD
                
        elif data_type == 'FLOAT32':
            float_val = float(value)
            
            # Pack float to bytes then unpack as two 16-bit integers
            if byte_order == 'ABCD':  # Big Endian
                packed = struct.pack('>f', float_val)
                high_reg, low_reg = struct.unpack('>HH', packed)
                return [high_reg, low_reg]
            elif byte_order == 'CDAB':  # Little Endian
                packed = struct.pack('<f', float_val)
                low_reg, high_reg = struct.unpack('<HH', packed)
                return [low_reg, high_reg]
            elif byte_order == 'BADC':  # Big Endian with word swap
                packed = struct.pack('>f', float_val)
                high_reg, low_reg = struct.unpack('>HH', packed)
                return [low_reg, high_reg]
            elif byte_order == 'DCBA':  # Little Endian with word swap
                packed = struct.pack('<f', float_val)
                low_reg, high_reg = struct.unpack('<HH', packed)
                return [high_reg, low_reg]
            else:
                # Default to ABCD
                packed = struct.pack('>f', float_val)
                high_reg, low_reg = struct.unpack('>HH', packed)
                return [high_reg, low_reg]
        else:
            logger.warning(f"Unknown Modbus data type '{data_type}', treating as UINT16")
            return int(value) & 0xFFFF
            
    except Exception as e:
        logger.error(f"Error converting value {value} to {data_type}: {e}")
        raise ValueError(f"Failed to convert value {value} to {data_type}: {str(e)}")


def parse_modbus_address(address: Union[str, int]) -> Tuple[str, int]:
    """
    Parse Modbus address and determine register type and actual address.
    
    Args:
        address: Modbus address (can be string like "40001" or integer)
    
    Returns:
        Tuple of (register_type, actual_address)
    """
    try:
        addr = int(address)
        
        if 1 <= addr <= 9999:  # Coils
            return 'coil', addr - 1
        elif 10001 <= addr <= 19999:  # Discrete Inputs
            return 'discrete_input', addr - 10001
        elif 30001 <= addr <= 39999:  # Input Registers
            return 'input_register', addr - 30001
        elif 40001 <= addr <= 49999:  # Holding Registers
            return 'holding_register', addr - 40001
        else:
            # Assume it's a raw address for holding registers
            return 'holding_register', addr
            
    except ValueError:
        raise ValueError(f"Invalid Modbus address format: {address}")


async def test_modbus_connection(device_config: ModbusDeviceConfig) -> Tuple[bool, Optional[str]]:
    """
    Test Modbus TCP connection to a device.
    
    Args:
        device_config: Modbus device configuration
    
    Returns:
        Tuple of (success, error_message)
    """
    if not PYMODBUS_AVAILABLE:
        return False, "pymodbus library not available"
    
    client = None
    try:
        client = ModbusTcpClient(
            host=device_config.ip_address,
            port=device_config.port_number,
            timeout=device_config.timeout
        )
        
        # Test connection
        if not client.connect():
            return False, f"Failed to connect to {device_config.ip_address}:{device_config.port_number}"
        
        # Test basic read operation (try to read 1 holding register)
        try:
            result = client.read_holding_registers(
                address=0, 
                count=1, 
                device_id=device_config.unit_number
            )
            if result.isError():
                # Connection works but device might not have registers at address 0
                # This is still considered a successful connection test
                logger.debug(f"Modbus connection test successful, but read test returned: {result}")
            
        except Exception as read_error:
            # Connection is established, read test is not critical for connection validation
            logger.debug(f"Modbus connection established but read test failed: {read_error}")
        
        logger.info(f"Modbus TCP connection test successful for {device_config.name}")
        return True, None
        
    except Exception as e:
        error_msg = f"Modbus TCP connection test failed for {device_config.name}: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
        
    finally:
        if client and client.is_socket_open():
            try:
                client.close()
            except Exception:
                pass


async def read_modbus_register(client: ModbusTcpClient, address: Union[str, int], data_type: str = 'UINT16', byte_order: str = 'ABCD', unit_id: int = 1) -> Tuple[Any, Optional[str]]:
    """
    Read a single Modbus register value.
    
    Args:
        client: Modbus TCP client instance
        address: Register address
        data_type: Data type to read (INT16, UINT16, INT32, UINT32, FLOAT32, BOOL)
        byte_order: Byte order for multi-register values
        unit_id: Modbus unit ID
    
    Returns:
        Tuple of (value, error_message)
    """
    try:
        register_type, actual_address = parse_modbus_address(address)
        
        if register_type == 'coil':
            result = client.read_coils(address=actual_address, count=1, device_id=unit_id)
            if result.isError():
                return None, f"Modbus read error: {result}"
            return bool(result.bits[0]), None
            
        elif register_type == 'discrete_input':
            result = client.read_discrete_inputs(address=actual_address, count=1, device_id=unit_id)
            if result.isError():
                return None, f"Modbus read error: {result}"
            return bool(result.bits[0]), None
            
        elif register_type in ['holding_register', 'input_register']:
            # Determine how many registers to read based on data type
            register_count = MODBUS_DATA_TYPES.get(data_type.upper(), {}).get('size', 1)
            
            if register_type == 'holding_register':
                result = client.read_holding_registers(address=actual_address, count=register_count, device_id=unit_id)
            else:
                result = client.read_input_registers(address=actual_address, count=register_count, device_id=unit_id)
            
            if result.isError():
                return None, f"Modbus read error: {result}"
            
            # Convert registers to requested data type
            registers = result.registers
            return convert_registers_to_value(registers, data_type, byte_order), None
        else:
            return None, f"Unsupported register type: {register_type}"
            
    except Exception as e:
        error_msg = f"Error reading Modbus register {address}: {str(e)}"
        logger.error(error_msg)
        return None, error_msg


def convert_registers_to_value(registers: List[int], data_type: str, byte_order: str = 'ABCD') -> Any:
    """Convert raw register values to the specified data type"""
    try:
        data_type = data_type.upper()
        
        if data_type == 'INT16':
            value = registers[0]
            return value if value <= 32767 else value - 65536
        elif data_type == 'UINT16':
            return registers[0]
        elif data_type in ['INT32', 'UINT32', 'FLOAT32']:
            if len(registers) < 2:
                raise ValueError("Need at least 2 registers for 32-bit data types")
            
            # Apply byte ordering
            if byte_order == 'ABCD':  # Big Endian
                high_reg, low_reg = registers[0], registers[1]
            elif byte_order == 'CDAB':  # Little Endian
                low_reg, high_reg = registers[0], registers[1]
            elif byte_order == 'BADC':  # Big Endian with word swap
                low_reg, high_reg = registers[0], registers[1]
            elif byte_order == 'DCBA':  # Little Endian with word swap
                high_reg, low_reg = registers[0], registers[1]
            else:
                high_reg, low_reg = registers[0], registers[1]  # Default to ABCD
            
            if data_type == 'FLOAT32':
                if byte_order in ['ABCD', 'BADC']:
                    packed = struct.pack('>HH', high_reg, low_reg)
                    return struct.unpack('>f', packed)[0]
                else:
                    packed = struct.pack('<HH', low_reg, high_reg)
                    return struct.unpack('<f', packed)[0]
            elif data_type == 'INT32':
                value = (high_reg << 16) | low_reg
                return value if value <= 2147483647 else value - 4294967296
            elif data_type == 'UINT32':
                return (high_reg << 16) | low_reg
        else:
            return registers[0]  # Default to raw register value
            
    except Exception as e:
        logger.error(f"Error converting registers {registers} to {data_type}: {e}")
        return registers[0] if registers else 0


async def write_modbus_register(client: ModbusTcpClient, address: Union[str, int], value: Any, data_type: str = 'UINT16', byte_order: str = 'ABCD', unit_id: int = 1) -> Tuple[bool, Optional[str]]:
    """
    Write a value to a Modbus register.
    
    Args:
        client: Modbus TCP client instance
        address: Register address
        value: Value to write
        data_type: Data type (INT16, UINT16, INT32, UINT32, FLOAT32, BOOL)
        byte_order: Byte order for multi-register values
        unit_id: Modbus unit ID
    
    Returns:
        Tuple of (success, error_message)
    """
    try:
        register_type, actual_address = parse_modbus_address(address)
        
        if register_type == 'coil':
            # Write single coil
            bool_value = bool(value)
            result = client.write_coil(address=actual_address, value=bool_value, device_id=unit_id)
            if result.isError():
                return False, f"Modbus write error: {result}"
            logger.debug(f"Successfully wrote coil {address}: {bool_value}")
            return True, None
            
        elif register_type == 'holding_register':
            # Convert value based on data type
            converted_values = convert_value_for_modbus(value, data_type, byte_order)
            
            if data_type.upper() == 'BOOL':
                # For boolean writes to holding registers, write 0 or 1
                result = client.write_register(address=actual_address, value=1 if converted_values else 0, device_id=unit_id)
            elif isinstance(converted_values, list):
                # Multi-register write
                result = client.write_registers(address=actual_address, values=converted_values, device_id=unit_id)
            else:
                # Single register write
                result = client.write_register(address=actual_address, value=converted_values, device_id=unit_id)
            
            if result.isError():
                return False, f"Modbus write error: {result}"
            
            logger.debug(f"Successfully wrote holding register {address}: {value} -> {converted_values}")
            return True, None
            
        elif register_type in ['discrete_input', 'input_register']:
            return False, f"Cannot write to {register_type} - read-only register type"
        else:
            return False, f"Unsupported register type: {register_type}"
            
    except Exception as e:
        error_msg = f"Error writing to Modbus register {address}: {str(e)}"
        logger.error(error_msg)
        return False, error_msg


# Compatibility functions for external API calls
async def modbus_get_with_error_async(device_config: Dict[str, Any], address: Union[str, int], data_type: str = 'UINT16', byte_order: str = 'ABCD') -> Tuple[Any, Optional[str]]:
    """
    Read a single Modbus register with error handling (async version).
    """
    if not PYMODBUS_AVAILABLE:
        return None, "pymodbus library not available"
    
    modbus_config = ModbusDeviceConfig(device_config)
    client = None
    
    try:
        client = ModbusTcpClient(
            host=modbus_config.ip_address,
            port=modbus_config.port_number,
            timeout=modbus_config.timeout
        )
        
        if not client.connect():
            return None, f"Failed to connect to {modbus_config.ip_address}:{modbus_config.port_number}"
        
        return await read_modbus_register(client, address, data_type, byte_order, modbus_config.unit_number)
        
    except Exception as e:
        return None, f"Modbus read error: {str(e)}"
    
    finally:
        if client and client.is_socket_open():
            try:
                client.close()
            except Exception:
                pass


def modbus_get_with_error(device_config: Dict[str, Any], address: Union[str, int], data_type: str = 'UINT16', byte_order: str = 'ABCD') -> Tuple[Any, Optional[str]]:
    """
    Read a single Modbus register with error handling (sync version).
    """
    import asyncio
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(modbus_get_with_error_async(device_config, address, data_type, byte_order))
        finally:
            loop.close()
    except Exception as e:
        return None, f"Modbus sync read error: {str(e)}"


async def modbus_set_with_error_async(device_config: Dict[str, Any], address: Union[str, int], value: Any, data_type: str = 'UINT16', byte_order: str = 'ABCD') -> Tuple[bool, Optional[str]]:
    """
    Write a value to a Modbus register with error handling (async version).
    """
    if not PYMODBUS_AVAILABLE:
        return False, "pymodbus library not available"
    
    modbus_config = ModbusDeviceConfig(device_config)
    client = None
    
    try:
        client = ModbusTcpClient(
            host=modbus_config.ip_address,
            port=modbus_config.port_number,
            timeout=modbus_config.timeout
        )
        
        if not client.connect():
            return False, f"Failed to connect to {modbus_config.ip_address}:{modbus_config.port_number}"
        
        return await write_modbus_register(client, address, value, data_type, byte_order, modbus_config.unit_number)
        
    except Exception as e:
        return False, f"Modbus write error: {str(e)}"
    
    finally:
        if client and client.is_socket_open():
            try:
                client.close()
            except Exception:
                pass


def modbus_set_with_error(device_config: Dict[str, Any], address: Union[str, int], value: Any, data_type: str = 'UINT16', byte_order: str = 'ABCD') -> Tuple[bool, Optional[str]]:
    """
    Write a value to a Modbus register with error handling (sync version).
    """
    import asyncio
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(modbus_set_with_error_async(device_config, address, value, data_type, byte_order))
        finally:
            loop.close()
    except Exception as e:
        return False, f"Modbus sync write error: {str(e)}"
