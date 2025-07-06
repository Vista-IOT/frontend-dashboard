"""
Configuration schema for the Vista IoT Gateway.
This module defines the schema for validation of configuration data.
"""
from typing import Dict, Any, List, Union, Optional
from pydantic import BaseModel, Field, validator

# Common Models
class BaseItemModel(BaseModel):
    """Base model with ID and name fields"""
    id: str
    name: str
    description: Optional[str] = ""

# Device Section
class DeviceConfig(BaseModel):
    """Device identification and basic information"""
    name: str
    model: str
    version: str
    location: Optional[str] = ""
    description: Optional[str] = ""

# Network Section
class IPv4StaticConfig(BaseModel):
    """IPv4 static configuration"""
    address: str = ""
    netmask: str = ""
    gateway: str = ""

class DNSConfig(BaseModel):
    """DNS server configuration"""
    primary: str = ""
    secondary: str = ""

class IPv4Config(BaseModel):
    """IPv4 configuration for a network interface"""
    mode: str  # "static" or "dhcp"
    static: IPv4StaticConfig = Field(default_factory=IPv4StaticConfig)
    dns: Optional[DNSConfig] = Field(default_factory=DNSConfig)

class LinkConfig(BaseModel):
    """Network link configuration"""
    speed: str  # "auto", "10", "100", "1000"
    duplex: str  # "auto", "half", "full"

class WifiSecurityConfig(BaseModel):
    """WiFi security configuration"""
    mode: str  # "none", "wep", "wpa", "wpa2"
    password: str = ""

class WifiConfig(BaseModel):
    """WiFi configuration"""
    ssid: str = ""
    security: WifiSecurityConfig = Field(default_factory=WifiSecurityConfig)
    channel: str = "auto"
    band: str = "2.4"
    hidden: bool = False

class NetworkInterfaceConfig(BaseModel):
    """Base network interface configuration"""
    type: str  # "ethernet", "wireless", etc.
    enabled: bool = True
    mode: str = "dhcp"  # For wireless: "client", "ap"
    ipv4: IPv4Config

class EthernetInterfaceConfig(NetworkInterfaceConfig):
    """Ethernet-specific interface configuration"""
    link: LinkConfig

class WirelessInterfaceConfig(NetworkInterfaceConfig):
    """Wireless-specific interface configuration"""
    wifi: WifiConfig

class FirewallRule(BaseItemModel):
    """Firewall rule configuration"""
    action: str  # "allow", "drop"
    protocol: str  # "tcp", "udp", "icmp", "all"
    source_ip: str
    destination_ip: Optional[str] = ""
    source_port: Optional[str] = ""
    destination_port: Optional[str] = ""

class FirewallConfig(BaseModel):
    """Firewall configuration"""
    enabled: bool = True
    default_policy: str = "drop"  # "allow", "drop"
    rules: List[FirewallRule] = []

class DHCPServerConfig(BaseModel):
    """DHCP server configuration"""
    enabled: bool = False
    start_ip: str
    end_ip: str
    lease_time: int = 24  # hours
    domain: str = "local"
    dns_servers: List[str] = []

class StaticRoute(BaseItemModel):
    """Static route configuration"""
    destination: str
    netmask: str
    gateway: str
    interface: str
    metric: int = 0

class PortForwarding(BaseItemModel):
    """Port forwarding configuration"""
    protocol: str  # "tcp", "udp"
    external_port: int
    internal_ip: str
    internal_port: int

class DynamicDNSConfig(BaseModel):
    """Dynamic DNS configuration"""
    enabled: bool = False
    provider: str = "dyndns"
    domain: str = ""
    username: str = ""
    password: str = ""
    update_interval: int = 60  # minutes

class NetworkConfig(BaseModel):
    """Complete network configuration"""
    interfaces: Dict[str, Union[EthernetInterfaceConfig, WirelessInterfaceConfig]]
    firewall: FirewallConfig = Field(default_factory=FirewallConfig)
    dhcp_server: DHCPServerConfig
    static_routes: List[StaticRoute] = []
    port_forwarding: List[PortForwarding] = []
    dynamic_dns: DynamicDNSConfig = Field(default_factory=DynamicDNSConfig)

# Protocols Section
class ModbusTCPConfig(BaseModel):
    """Modbus TCP configuration"""
    port: int = 502
    max_connections: int = 5
    timeout: int = 30  # seconds

class ModbusSerialConfig(BaseModel):
    """Modbus serial configuration"""
    port: str = "ttyS0"
    baudrate: int = 9600
    data_bits: int = 8
    parity: str = "none"  # "none", "odd", "even"
    stop_bits: int = 1

class ModbusMapping(BaseItemModel):
    """Modbus register mapping"""
    register: int
    type: str  # "coil", "discrete_input", "holding", "input"

class ModbusConfig(BaseModel):
    """Modbus protocol configuration"""
    enabled: bool = False
    mode: str = "tcp"  # "tcp", "rtu", "ascii"
    tcp: ModbusTCPConfig = Field(default_factory=ModbusTCPConfig)
    serial: ModbusSerialConfig = Field(default_factory=ModbusSerialConfig)
    slave_id: int = 1
    mapping: List[ModbusMapping] = []

class MQTTTlsConfig(BaseModel):
    """MQTT TLS configuration"""
    enabled: bool = False
    version: str = "1.2"
    verify_server: bool = True
    allow_insecure: bool = False
    cert_file: str = ""
    key_file: str = ""
    ca_file: str = ""

class MQTTAuthConfig(BaseModel):
    """MQTT authentication configuration"""
    enabled: bool = False
    username: str = ""
    password: str = ""

class MQTTBrokerConfig(BaseModel):
    """MQTT broker configuration"""
    address: str = "localhost"
    port: int = 1883
    client_id: str = "iot-gateway"
    keepalive: int = 60
    clean_session: bool = True
    tls: MQTTTlsConfig = Field(default_factory=MQTTTlsConfig)
    auth: MQTTAuthConfig = Field(default_factory=MQTTAuthConfig)

class MQTTTopicConfig(BaseModel):
    """MQTT topic configuration"""
    path: str
    qos: int = 0
    retain: Optional[bool] = None

class MQTTTopicsConfig(BaseModel):
    """MQTT topics configuration"""
    publish: List[MQTTTopicConfig] = []
    subscribe: List[MQTTTopicConfig] = []

class MQTTConfig(BaseModel):
    """MQTT protocol configuration"""
    enabled: bool = False
    broker: MQTTBrokerConfig = Field(default_factory=MQTTBrokerConfig)
    topics: MQTTTopicsConfig = Field(default_factory=MQTTTopicsConfig)

class ProtocolsConfig(BaseModel):
    """Protocols configuration"""
    modbus: ModbusConfig = Field(default_factory=ModbusConfig)
    mqtt: MQTTConfig = Field(default_factory=MQTTConfig)

# Hardware Section
class ComPortConfig(BaseModel):
    """COM port configuration"""
    mode: str  # "rs232", "rs485"
    baudrate: int
    data_bits: int
    parity: str  # "none", "odd", "even"
    stop_bits: int
    flow_control: str  # "none", "hardware", "software"

class WatchdogConfig(BaseModel):
    """Watchdog configuration"""
    enabled: bool = False
    timeout: int = 30  # seconds
    action: str = "restart"  # "restart", "shutdown", "custom"
    custom_command: str = ""

class GPIOPinConfig(BaseModel):
    """GPIO pin configuration"""
    id: str
    state: bool = False

class GPIOConfig(BaseModel):
    """GPIO configuration"""
    inputs: List[GPIOPinConfig] = []
    outputs: List[GPIOPinConfig] = []

class HardwareConfig(BaseModel):
    """Hardware configuration"""
    com_ports: Dict[str, ComPortConfig]
    watchdog: WatchdogConfig = Field(default_factory=WatchdogConfig)
    gpio: GPIOConfig = Field(default_factory=GPIOConfig)

# Security Section
class SSHConfig(BaseModel):
    """SSH server configuration"""
    enabled: bool = True
    port: int = 22
    allow_root: bool = False
    password_auth: bool = False

class UserConfig(BaseItemModel):
    """User configuration"""
    username: str

class CertificateConfig(BaseItemModel):
    """Certificate configuration"""
    pass

class SecurityConfig(BaseModel):
    """Security configuration"""
    ssh: SSHConfig = Field(default_factory=SSHConfig)
    users: List[UserConfig] = []
    certificates: List[CertificateConfig] = []

# Logging Section
class RemoteSyslogConfig(BaseModel):
    """Remote syslog configuration"""
    enabled: bool = False
    server: str = ""
    port: int = 514

class LoggingConfig(BaseModel):
    """Logging configuration"""
    level: str = "info"  # "debug", "info", "warning", "error", "critical"
    max_size: str = "10M"
    max_files: int = 5
    remote_syslog: RemoteSyslogConfig = Field(default_factory=RemoteSyslogConfig)

# Maintenance Section
class AutoUpdateConfig(BaseModel):
    """Auto-update configuration"""
    enabled: bool = False
    schedule: str = "0 0 * * 0"  # cron format
    channel: str = "stable"  # "stable", "beta", "dev"

class BackupConfig(BaseModel):
    """Backup configuration"""
    enabled: bool = False
    schedule: str = "0 0 * * *"  # cron format
    retain: int = 7  # days
    location: str = "local"  # "local", "remote"

class MaintenanceConfig(BaseModel):
    """Maintenance configuration"""
    auto_update: AutoUpdateConfig = Field(default_factory=AutoUpdateConfig)
    backup: BackupConfig = Field(default_factory=BackupConfig)

# IO Setup Section
class SerialSettingsConfig(BaseModel):
    """Serial port settings for IO"""
    port: str
    baudRate: int
    dataBit: int
    stopBit: int
    parity: str
    rts: bool = False
    dtr: bool = False
    enabled: bool = True

class TagConfig(BaseItemModel):
    """IO tag configuration"""
    dataType: str  # "Analog", "Digital"
    registerType: str  # "Holding Register", "Input Register", "Coil", "Discrete Input"
    address: str
    startBit: int = 0
    lengthBit: int
    spanLow: float
    spanHigh: float
    defaultValue: float
    scanRate: int
    readWrite: str  # "Read Only", "Write Only", "Read/Write"
    description: str = ""
    scaleType: str  # "No Scale", "Linear Scale", "Square Root", "Custom"
    formula: str = ""
    scale: float = 1.0
    offset: float = 0.0
    clampToLow: bool = False
    clampToHigh: bool = False
    clampToZero: bool = False
    conversionType: str

class DeviceConfig(BaseItemModel):
    """IO device configuration"""
    enabled: bool = True
    deviceType: str  # "Modbus RTU", "Modbus TCP", etc.
    unitNumber: int
    tagWriteType: str  # "Single Write", "Multiple Write"
    description: str = ""
    addDeviceNameAsPrefix: bool = True
    useAsciiProtocol: int = 0
    packetDelay: int
    digitalBlockSize: int
    analogBlockSize: int
    tags: List[TagConfig] = []

class IOPortConfig(BaseItemModel):
    """IO port configuration"""
    type: str  # "builtin", "tcpip", "serial"
    description: str = ""
    scanTime: int
    timeOut: int
    retryCount: int
    autoRecoverTime: int
    scanMode: str  # "serial", "tcp"
    enabled: bool = True
    serialSettings: Optional[SerialSettingsConfig] = None
    devices: List[DeviceConfig] = []

class IOSetupConfig(BaseModel):
    """IO setup configuration"""
    ports: List[IOPortConfig] = []

# User-defined Tags
class UserTagConfig(BaseItemModel):
    """User-defined tag configuration"""
    dataType: str  # "Analog", "Digital"
    defaultValue: float
    spanHigh: float
    spanLow: float
    readWrite: str  # "Read Only", "Write Only", "Read/Write"
    description: str = ""

# Calculation Tags
class CalculationTagConfig(BaseItemModel):
    """Calculation tag configuration"""
    dataType: str  # "Analog", "Digital"
    defaultValue: float
    formula: str
    a: str = ""
    b: str = ""
    c: str = ""
    d: str = ""
    e: str = ""
    f: str = ""
    g: str = ""
    h: str = ""
    period: int
    readWrite: str  # "Read Only", "Write Only", "Read/Write"
    spanHigh: float
    spanLow: float
    isParent: bool = False
    description: str = ""
    address: str

# Statistics Tags
class StatsTagConfig(BaseItemModel):
    """Statistics tag configuration"""
    referTag: str
    type: str  # "Max", "Min", "Average", "Sum", etc.
    updateCycleValue: int
    updateCycleUnit: str  # "sec", "min", "hour", "day"
    description: str = ""

# System Tags
class SystemTagConfig(BaseModel):
    """System tag configuration"""
    id: str
    name: str
    dataType: str  # "Analog", "Digital"
    unit: str = ""
    spanHigh: float
    spanLow: float
    description: str = ""

# Communication Forward Section
class MQTTForwardBrokerTlsConfig(BaseModel):
    """MQTT forwarding TLS configuration"""
    enabled: bool = False
    version: str = "1.2"
    verifyServer: bool = True
    allowInsecure: bool = False
    certFile: str = ""
    keyFile: str = ""
    caFile: str = ""

class MQTTForwardBrokerAuthConfig(BaseModel):
    """MQTT forwarding authentication configuration"""
    enabled: bool = False
    username: str = ""
    password: str = ""

class MQTTForwardBrokerConfig(BaseModel):
    """MQTT forwarding broker configuration"""
    address: str
    port: int = 1883
    clientId: str
    keepalive: int = 60
    cleanSession: bool = True
    tls: MQTTForwardBrokerTlsConfig = Field(default_factory=MQTTForwardBrokerTlsConfig)
    auth: MQTTForwardBrokerAuthConfig = Field(default_factory=MQTTForwardBrokerAuthConfig)

class MQTTForwardTopicConfig(BaseModel):
    """MQTT forwarding topic configuration"""
    path: str
    qos: int = 0
    retain: Optional[bool] = None

class MQTTForwardTopicsConfig(BaseModel):
    """MQTT forwarding topics configuration"""
    publish: List[MQTTForwardTopicConfig] = []
    subscribe: List[MQTTForwardTopicConfig] = []

class AWSCredentialsConfig(BaseModel):
    """AWS credentials configuration"""
    accessKeyId: str
    secretAccessKey: str

class AWSCertificatesConfig(BaseModel):
    """AWS certificates configuration"""
    certFile: str
    keyFile: str
    caFile: str

class AWSConfig(BaseModel):
    """AWS configuration"""
    region: str
    thingName: str
    shadow: str
    endpoint: str
    credentials: AWSCredentialsConfig
    certificates: AWSCertificatesConfig

class APIAuthConfig(BaseModel):
    """API authentication configuration"""
    type: str  # "none", "basic", "bearer", "oauth2"
    credentials: Dict[str, str]

class APIConfig(BaseModel):
    """API configuration"""
    baseUrl: str
    method: str  # "GET", "POST", "PUT", "DELETE"
    headers: Dict[str, str]
    timeout: int
    retries: int

class DataMappingConfig(BaseModel):
    """Data mapping configuration"""
    urlTemplate: str
    bodyTemplate: str
    contentType: str

class MemoryConfig(BaseModel):
    """Memory configuration for virtual memory mapping"""
    address: str
    dataType: str
    length: int
    endianness: str
    scaling: Dict[str, Any]

class CommunicationDestinationConfig(BaseItemModel):
    """Communication destination configuration"""
    type: str  # "mqtt-broker", "aws-iot", "rest-api", "virtual-memory-map"
    broker: Optional[MQTTForwardBrokerConfig] = None
    topics: Optional[MQTTForwardTopicsConfig] = None
    aws: Optional[AWSConfig] = None
    api: Optional[APIConfig] = None
    auth: Optional[APIAuthConfig] = None
    dataMapping: Optional[DataMappingConfig] = None
    memory: Optional[MemoryConfig] = None
    description: str = ""

class CommunicationBlockConfig(BaseItemModel):
    """Communication block configuration"""
    type: str  # "source", "intermediate", "destination"
    subType: str
    label: str
    config: Dict[str, Any]

class CommunicationBridgeConfig(BaseModel):
    """Communication bridge configuration"""
    id: str
    blocks: List[CommunicationBlockConfig] = []

class CommunicationForwardConfig(BaseModel):
    """Communication forwarding configuration"""
    destinations: List[CommunicationDestinationConfig] = []
    bridges: List[CommunicationBridgeConfig] = []

# Root Configuration Schema
class GatewayConfig(BaseModel):
    """Root configuration schema for the Vista IoT Gateway"""
    device: DeviceConfig
    network: NetworkConfig
    protocols: ProtocolsConfig
    hardware: HardwareConfig
    security: SecurityConfig
    logging: LoggingConfig
    maintenance: MaintenanceConfig
    io_setup: IOSetupConfig
    user_tags: List[UserTagConfig] = []
    calculation_tags: List[CalculationTagConfig] = []
    stats_tags: List[StatsTagConfig] = []
    system_tags: List[SystemTagConfig] = []
    communication_forward: CommunicationForwardConfig = Field(default_factory=CommunicationForwardConfig)

    class Config:
        """Pydantic model configuration"""
        extra = "forbid"  # Disallow extra fields not in the schema
