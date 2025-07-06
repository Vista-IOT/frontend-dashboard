import asyncio
import logging
from typing import Dict, Optional, List
from pymodbus.client import AsyncModbusSerialClient
from pymodbus.exceptions import ModbusException
from pymodbus.pdu import ExceptionResponse
from ..core.models import IOPort, Device, IOTag, TagValue, RegisterType, DataType

logger = logging.getLogger(__name__)

class ModbusHandler:
    def __init__(self, port: IOPort):
        self.port = port
        self.client: Optional[AsyncModbusSerialClient] = None
        self.connected = False
        self.tag_values: Dict[str, TagValue] = {}
        self._stop_event = asyncio.Event()

    async def connect(self) -> bool:
        if not self.port.serial_settings:
            logger.error(f"No serial settings configured for port {self.port.name}")
            return False

        try:
            self.client = AsyncModbusSerialClient(
                port=self.port.serial_settings.port,
                baudrate=self.port.serial_settings.baud_rate,
                bytesize=self.port.serial_settings.data_bit,
                parity=self.port.serial_settings.parity,
                stopbits=self.port.serial_settings.stop_bit,
                timeout=self.port.time_out / 1000.0,  # Convert to seconds
                retries=self.port.retry_count,
                retry_on_empty=True
            )
            self.connected = await self.client.connect()
            logger.info(f"Connected to {self.port.serial_settings.port}")
            return self.connected
        except Exception as e:
            logger.error(f"Failed to connect to {self.port.serial_settings.port}: {str(e)}")
            return False

    async def disconnect(self):
        if self.client:
            self.client.close()
        self.connected = False
        self._stop_event.set()

    def _parse_address(self, address: str) -> int:
        """Convert address string to integer."""
        try:
            return int(address.strip(), 0)  # Handles hex, octal, and decimal
        except ValueError:
            logger.error(f"Invalid address format: {address}")
            return 0

    async def _read_tag(self, device: Device, tag: IOTag) -> Optional[TagValue]:
        """Read a single tag from the device."""
        if not self.client or not self.connected:
            return None

        try:
            address = self._parse_address(tag.address)
            unit = device.unit_number

            # Read based on register type
            if tag.register_type == RegisterType.HOLDING:
                result = await self.client.read_holding_registers(address, 1, slave=unit)
            elif tag.register_type == RegisterType.INPUT:
                result = await self.client.read_input_registers(address, 1, slave=unit)
            elif tag.register_type == RegisterType.COIL:
                result = await self.client.read_coils(address, 1, slave=unit)
            elif tag.register_type == RegisterType.DISCRETE_INPUT:
                result = await self.client.read_discrete_inputs(address, 1, slave=unit)
            else:
                logger.error(f"Unsupported register type: {tag.register_type}")
                return None

            if isinstance(result, ExceptionResponse):
                logger.error(f"Modbus exception reading {tag.name}: {str(result)}")
                return None

            if not hasattr(result, 'registers') and not hasattr(result, 'bits'):
                logger.error(f"Invalid response reading {tag.name}")
                return None

            # Extract value based on register type
            raw_value = result.registers[0] if hasattr(result, 'registers') else result.bits[0]

            # Convert value based on data type
            value = self._convert_value(raw_value, tag.data_type)

            # Apply scaling if configured
            if tag.scale is not None:
                value = value * tag.scale
            if tag.offset is not None:
                value = value + tag.offset

            return TagValue(
                tag_id=tag.id,
                value=value,
                timestamp=asyncio.get_event_loop().time(),
                quality="good"
            )

        except ModbusException as e:
            logger.error(f"Modbus error reading {tag.name}: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error reading {tag.name}: {str(e)}")
            return None

    def _convert_value(self, raw_value: int, data_type: DataType) -> Any:
        """Convert raw register value to specified data type."""
        try:
            if data_type == DataType.INT16:
                # Convert to signed 16-bit
                return raw_value if raw_value < 32768 else raw_value - 65536
            elif data_type == DataType.BOOLEAN:
                return bool(raw_value)
            elif data_type == DataType.FLOAT32:
                # Would need two registers for proper float32
                return float(raw_value)
            else:
                return raw_value
        except Exception as e:
            logger.error(f"Error converting value: {str(e)}")
            return raw_value

    async def read_device_tags(self, device: Device) -> List[TagValue]:
        """Read all tags from a device."""
        if not device.enabled:
            return []

        tag_values = []
        for tag in device.tags:
            if tag_value := await self._read_tag(device, tag):
                tag_values.append(tag_value)
                self.tag_values[tag.id] = tag_value

        return tag_values

    async def start_scanning(self):
        """Start the scanning loop for all devices."""
        self._stop_event.clear()
        while not self._stop_event.is_set():
            if not self.connected:
                try:
                    self.connected = await self.connect()
                except Exception as e:
                    logger.error(f"Connection error: {str(e)}")
                    await asyncio.sleep(self.port.auto_recover_time / 1000.0)
                    continue

            for device in self.port.devices:
                if device.enabled:
                    await self.read_device_tags(device)
                    if device.packet_delay > 0:
                        await asyncio.sleep(device.packet_delay / 1000.0)

            # Wait for next scan cycle
            await asyncio.sleep(self.port.scan_time / 1000.0)

    def get_tag_value(self, tag_id: str) -> Optional[TagValue]:
        """Get the last known value for a tag."""
        return self.tag_values.get(tag_id)

    def get_all_tag_values(self) -> Dict[str, TagValue]:
        """Get all known tag values."""
        return self.tag_values.copy() 