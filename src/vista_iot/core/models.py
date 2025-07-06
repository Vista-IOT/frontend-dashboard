from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from enum import Enum

class DataType(str, Enum):
    INT16 = "int16"
    INT32 = "int32"
    FLOAT32 = "float32"
    FLOAT64 = "float64"
    STRING = "string"
    ASCII = "ascii"
    BOOLEAN = "boolean"

class RegisterType(str, Enum):
    HOLDING = "holding"
    INPUT = "input"
    COIL = "coil"
    DISCRETE_INPUT = "discrete_input"

class IOTag(BaseModel):
    id: str
    name: str
    data_type: DataType
    register_type: RegisterType
    address: str
    description: Optional[str] = None
    scan_rate: Optional[int] = 1000  # milliseconds
    conversion_type: Optional[str] = None
    scale_type: Optional[str] = None
    read_write: Optional[str] = "read"
    start_bit: Optional[int] = None
    length_bit: Optional[int] = None
    span_low: Optional[float] = None
    span_high: Optional[float] = None
    formula: Optional[str] = None
    scale: Optional[float] = None
    offset: Optional[float] = None
    value: Optional[Any] = None
    last_update: Optional[float] = None

class SerialSettings(BaseModel):
    port: str
    baud_rate: int = 9600
    data_bit: int = 8
    stop_bit: Union[int, str] = 1
    parity: str = "N"
    rts: bool = False
    dtr: bool = False
    enabled: bool = True

class Device(BaseModel):
    id: str
    enabled: bool = True
    name: str
    device_type: str
    unit_number: int
    tag_write_type: str
    description: Optional[str] = None
    add_device_name_as_prefix: bool = False
    use_ascii_protocol: int = 0
    packet_delay: int = 0
    digital_block_size: int = 1
    analog_block_size: int = 1
    tags: List[IOTag] = []

class IOPort(BaseModel):
    id: str
    type: str
    name: str
    description: Optional[str] = None
    scan_time: int = 1000
    time_out: int = 1000
    retry_count: int = 3
    auto_recover_time: int = 5000
    scan_mode: str = "cyclic"
    enabled: bool = True
    serial_settings: Optional[SerialSettings] = None
    devices: List[Device] = []

class TagValue(BaseModel):
    tag_id: str
    value: Any
    timestamp: float
    quality: str = "good"

class DestinationType(str, Enum):
    MQTT_BROKER = "mqtt-broker"
    AWS_IOT = "aws-iot"
    AWS_MQTT = "aws-mqtt"
    REST_API = "rest-api"
    VIRTUAL_MEMORY_MAP = "virtual-memory-map"

class BridgeBlockType(str, Enum):
    SOURCE = "source"
    DESTINATION = "destination"
    INTERMEDIATE = "intermediate"

class BridgeBlock(BaseModel):
    id: str
    type: BridgeBlockType
    sub_type: Optional[str] = None
    label: str
    config: Dict[str, Any] = {}

class Bridge(BaseModel):
    id: str
    blocks: List[BridgeBlock]

class Destination(BaseModel):
    id: str
    name: str
    type: DestinationType
    config: Dict[str, Any]
    description: Optional[str] = None 