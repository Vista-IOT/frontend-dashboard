"""
Response models for API endpoints
"""
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

class ApiResponse(BaseModel):
    """Base API response model"""
    status: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    details: Optional[str] = None

class SerialPortInfo(BaseModel):
    """Serial port information model"""
    name: str
    path: str
    type: str
    description: str
    connected: bool
    usb_info: Optional[Dict[str, str]] = None

class NetworkInterfaceInfo(BaseModel):
    """Network interface information model"""
    name: str
    type: str
    mac: str
    state: str
    ip_addresses: List[str]
    mtu: int

class GPIOChipInfo(BaseModel):
    """GPIO chip information model"""
    name: str
    path: str
    label: str
    ngpio: int

class GPIOInfo(BaseModel):
    """GPIO information model"""
    available: bool
    chip_count: int
    gpio_chips: List[GPIOChipInfo]
    legacy_interface: Optional[bool] = None

class USBDeviceInfo(BaseModel):
    """USB device information model"""
    bus: Optional[str] = None
    device: Optional[str] = None
    vendor_id: Optional[str] = None
    product_id: Optional[str] = None
    description: str
    path: Optional[str] = None
    manufacturer: Optional[str] = None
    device_id: Optional[str] = None
    service: Optional[str] = None
    status: Optional[str] = None

class SystemInfo(BaseModel):
    """System information model"""
    platform: str
    machine: str
    processor: str
    system: str
    release: str
    version: str

class HardwareDetectionResponse(BaseModel):
    """Hardware detection response model"""
    serial_ports: List[SerialPortInfo]
    network_interfaces: List[NetworkInterfaceInfo]
    gpio: GPIOInfo
    usb_devices: List[USBDeviceInfo]
    system: SystemInfo

class MemoryInfo(BaseModel):
    """Memory information model"""
    used: int
    free: int
    total: int
    percent: float
    unit: str

class StorageInfo(BaseModel):
    """Storage information model"""
    used: int
    free: int
    total: int
    percent: float
    unit: str

class NetworkInterfaceStatus(BaseModel):
    """Network interface status model"""
    name: str
    ip: str
    status: str
    tx: str
    rx: str

class DashboardData(BaseModel):
    """Dashboard data model"""
    system_uptime: str
    cpu_load: float
    memory: MemoryInfo
    storage: StorageInfo
    protocols: Dict[str, str]
    network_interfaces: List[NetworkInterfaceStatus]
