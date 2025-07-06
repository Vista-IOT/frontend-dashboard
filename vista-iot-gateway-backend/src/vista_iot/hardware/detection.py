"""
Hardware detection utilities for the Vista IoT Gateway.
Provides functionality to detect and monitor system hardware resources.
"""
import os
import re
import subprocess
import platform
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class HardwareDetector:
    """Class for detecting and monitoring hardware resources."""

    @staticmethod
    def detect_serial_ports() -> List[Dict[str, Any]]:
        """Detect all available serial ports on the system."""
        ports = []
        
        if platform.system() == 'Linux':
            # Check /dev for common serial port patterns
            dev_dir = '/dev'
            port_patterns = [
                'ttyS*',    # Standard serial ports
                'ttyUSB*',  # USB-to-serial converters
                'ttyACM*',  # CDC ACM devices (Arduino, etc.)
                'ttyAMA*',  # AMBA serial ports (Raspberry Pi)
                'ttymxc*',  # i.MX serial ports
                'ttyO*',    # OMAP serial ports
                'rfcomm*'   # Bluetooth serial ports
            ]
            
            for pattern in port_patterns:
                try:
                    port_matches = []
                    for port in os.listdir(dev_dir):
                        if port.startswith(pattern[:-1]):  # Remove the *
                            port_path = os.path.join(dev_dir, port)
                            port_type = "Unknown"
                            
                            # Try to determine port type
                            if 'USB' in port:
                                port_type = "USB-to-Serial"
                            elif 'AMA' in port:
                                port_type = "Hardware UART"
                            elif 'ACM' in port:
                                port_type = "CDC ACM"
                            
                            port_info = {
                                "name": port,
                                "path": port_path,
                                "type": port_type,
                                "description": f"Serial port {port}",
                                "connected": os.path.exists(port_path)
                            }
                            port_matches.append(port_info)
                    
                    ports.extend(port_matches)
                except Exception as e:
                    logger.error(f"Error detecting serial ports: {e}")
        
        elif platform.system() == 'Windows':
            try:
                import winreg
                import itertools
                
                # Windows registry path for serial communications ports
                path = 'HARDWARE\\DEVICEMAP\\SERIALCOMM'
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path)
                
                for i in itertools.count():
                    try:
                        val = winreg.EnumValue(key, i)
                        ports.append({
                            "name": val[1],
                            "path": val[1],
                            "type": "Serial Port",
                            "description": val[0],
                            "connected": True
                        })
                    except WindowsError:
                        break
            except Exception as e:
                logger.error(f"Error detecting Windows serial ports: {e}")
            
        return ports

    @staticmethod
    def detect_network_interfaces() -> List[Dict[str, Any]]:
        """Detect all network interfaces on the system."""
        interfaces = []
        
        if platform.system() == 'Linux':
            try:
                # Get network interfaces using ip command
                result = subprocess.run(
                    ['ip', '-j', 'addr', 'show'],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    import json
                    try:
                        data = json.loads(result.stdout)
                        for iface in data:
                            interfaces.append({
                                "name": iface.get('ifname', ''),
                                "type": "Ethernet" if 'eth' in iface.get('ifname', '') else 
                                       'WiFi' if 'wlan' in iface.get('ifname', '') else 
                                       'Loopback' if 'lo' == iface.get('ifname', '') else 'Other',
                                "mac": iface.get('address', ''),
                                "state": iface.get('operstate', 'UNKNOWN').upper(),
                                "ip_addresses": [addr.get('local', '') for addr in iface.get('addr_info', []) if 'local' in addr],
                                "mtu": iface.get('mtu', 0)
                            })
                    except json.JSONDecodeError:
                        logger.error("Failed to parse network interface information")
            except Exception as e:
                logger.error(f"Error detecting network interfaces: {e}")
        elif platform.system() == 'Windows':
            try:
                import wmi
                c = wmi.WMI()
                for interface in c.Win32_NetworkAdapterConfiguration(IPEnabled=1):
                    interfaces.append({
                        "name": interface.Description,
                        "type": "Ethernet" if "Ethernet" in interface.Description else "WiFi" if "Wireless" in interface.Description else "Other",
                        "mac": interface.MACAddress,
                        "state": "UP",
                        "ip_addresses": [ip for ip in interface.IPAddress if ip] if interface.IPAddress else [],
                        "mtu": 1500  # Default MTU for Windows
                    })
            except Exception as e:
                logger.error(f"Error detecting Windows network interfaces: {e}")
        
        return interfaces

    @staticmethod
    def detect_gpio() -> Dict[str, Any]:
        """Detect GPIO capabilities."""
        gpio_info = {
            "available": False,
            "chip_count": 0,
            "gpio_chips": []
        }
        
        if platform.system() == 'Linux':
            gpio_chip_path = '/sys/class/gpio'
            if os.path.exists(gpio_chip_path):
                gpio_info["available"] = True
                try:
                    # List all GPIO chips
                    gpio_chips = [d for d in os.listdir('/dev') if d.startswith('gpiochip')]
                    gpio_info["chip_count"] = len(gpio_chips)
                    
                    # Get detailed info for each chip
                    for chip in gpio_chips:
                        chip_path = os.path.join('/sys/class/gpio', chip)
                        if os.path.exists(chip_path):
                            chip_info = {
                                "name": chip,
                                "path": f"/dev/{chip}",
                                "label": "Unknown",
                                "ngpio": 0
                            }
                            
                            # Try to read chip info
                            try:
                                with open(os.path.join(chip_path, 'label'), 'r') as f:
                                    chip_info["label"] = f.read().strip()
                            except:
                                pass
                                    
                            try:
                                with open(os.path.join(chip_path, 'ngpio'), 'r') as f:
                                    chip_info["ngpio"] = int(f.read().strip())
                            except:
                                pass
                                    
                            gpio_info["gpio_chips"].append(chip_info)
                            
                except Exception as e:
                    logger.error(f"Error detecting GPIO: {e}")
        
        return gpio_info

    @staticmethod
    def detect_usb_devices() -> List[Dict[str, Any]]:
        """Detect USB devices connected to the system."""
        usb_devices = []
        
        if platform.system() == 'Linux':
            try:
                # Use lsusb to get USB device information
                result = subprocess.run(
                    ['lsusb'],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    for line in result.stdout.split('\n'):
                        if not line.strip():
                            continue
                            
                        # Parse lsusb output
                        match = re.match(
                            r'Bus (\d+) Device (\d+): ID ([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\s+(.+)',
                            line
                        )
                        
                        if match:
                            bus, device, vid, pid, desc = match.groups()
                            usb_devices.append({
                                "bus": f"Bus {bus}",
                                "device": f"Device {device}",
                                "vendor_id": vid,
                                "product_id": pid,
                                "description": desc,
                                "path": f"/dev/bus/usb/{bus.zfill(3)}/{device}"
                            })
            except Exception as e:
                logger.error(f"Error detecting USB devices: {e}")
        elif platform.system() == 'Windows':
            try:
                import wmi
                c = wmi.WMI()
                for usb in c.Win32_USBControllerDevice():
                    try:
                        pnp_device = usb.Dependent
                        device_info = c.query(
                            f"SELECT * FROM Win32_PnPEntity WHERE DeviceID='{pnp_device.DeviceID.split('\\')[1]}'"
                        )
                        if device_info:
                            device = device_info[0]
                            usb_devices.append({
                                "description": device.Description or "Unknown USB Device",
                                "manufacturer": device.Manufacturer or "Unknown",
                                "device_id": device.DeviceID,
                                "service": device.Service or "",
                                "status": device.Status or ""
                            })
                    except Exception as e:
                        logger.error(f"Error getting USB device info: {e}")
            except Exception as e:
                logger.error(f"Error detecting Windows USB devices: {e}")
        
        return usb_devices

    @classmethod
    def detect_all_hardware(cls) -> Dict[str, Any]:
        """
        Detect all hardware resources on the system.
        
        Returns:
            Dictionary containing information about all detected hardware.
        """
        return {
            "serial_ports": cls.detect_serial_ports(),
            "network_interfaces": cls.detect_network_interfaces(),
            "gpio": cls.detect_gpio(),
            "usb_devices": cls.detect_usb_devices(),
            "system": {
                "platform": platform.platform(),
                "machine": platform.machine(),
                "processor": platform.processor(),
                "system": platform.system(),
                "release": platform.release(),
                "version": platform.version()
            }
        }
