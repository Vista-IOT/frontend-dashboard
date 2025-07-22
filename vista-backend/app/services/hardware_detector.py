"""
Hardware detection utilities for the Vista IoT Backend.
Provides functionality to detect and monitor system hardware resources.
"""
import os
import re
import subprocess
import platform
import logging
import glob
import json
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
                'ttyS*',     # Standard serial ports
                'ttyUSB*',   # USB-to-serial converters
                'ttyACM*',   # CDC ACM devices (Arduino, etc.)
                'ttyAMA*',   # AMBA serial ports (Raspberry Pi)
                'ttyAS*',    # ARM serial ports
                'ttymxc*',   # i.MX serial ports
                'ttyO*',     # OMAP serial ports
                'rfcomm*'    # Bluetooth serial ports
            ]
            
            for pattern in port_patterns:
                try:
                    # Use glob to find matching devices
                    port_paths = glob.glob(os.path.join(dev_dir, pattern))
                    
                    for port_path in port_paths:
                        port_name = os.path.basename(port_path)
                        port_type = "Unknown"
                        
                        # Try to determine port type based on name
                        if 'USB' in port_name:
                            port_type = "USB-to-Serial"
                        elif 'AMA' in port_name or 'AS' in port_name:
                            port_type = "Hardware UART"
                        elif 'ACM' in port_name:
                            port_type = "CDC ACM"
                        elif 'ttyS' in port_name:
                            port_type = "Standard Serial"
                        elif 'rfcomm' in port_name:
                            port_type = "Bluetooth Serial"
                        
                        # Check if port is accessible
                        is_accessible = os.path.exists(port_path)
                        
                        port_info = {
                            "name": port_name,
                            "path": port_path,
                            "type": port_type,
                            "description": f"Serial port {port_name}",
                            "connected": is_accessible
                        }
                        
                        # Try to get additional info for USB devices
                        try:
                            if 'USB' in port_name:
                                usb_info = HardwareDetector._get_usb_serial_info(port_name)
                                if usb_info:
                                    port_info["usb_info"] = usb_info
                        except Exception as e:
                            logger.debug(f"Could not get additional info for {port_name}: {e}")
                        
                        ports.append(port_info)
                        
                except Exception as e:
                    logger.error(f"Error detecting serial ports with pattern {pattern}: {e}")
        
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
    def _get_usb_serial_info(port_name: str) -> Optional[Dict[str, Any]]:
        """Get USB device information for a USB serial port."""
        try:
            # Extract device number from port name (e.g., ttyUSB0 -> 0)
            device_num = re.search(r'\d+$', port_name)
            if not device_num:
                return None
            
            # Try to find the USB device in sysfs
            usb_path = f"/sys/class/tty/{port_name}/device"
            if os.path.exists(usb_path):
                # Follow symlinks to find USB device info
                real_path = os.path.realpath(usb_path)
                usb_device_path = real_path
                
                # Walk up the directory tree to find USB device info
                while usb_device_path and not os.path.exists(os.path.join(usb_device_path, 'idVendor')):
                    usb_device_path = os.path.dirname(usb_device_path)
                
                if usb_device_path and os.path.exists(os.path.join(usb_device_path, 'idVendor')):
                    info = {}
                    for attr in ['idVendor', 'idProduct', 'manufacturer', 'product', 'serial']:
                        attr_path = os.path.join(usb_device_path, attr)
                        if os.path.exists(attr_path):
                            try:
                                with open(attr_path, 'r') as f:
                                    info[attr] = f.read().strip()
                            except:
                                pass
                    return info if info else None
        except Exception as e:
            logger.debug(f"Error getting USB info for {port_name}: {e}")
        
        return None

    @staticmethod
    def _is_wifi_interface(interface_name: str) -> bool:
        """Check if an interface is a WiFi interface using multiple detection methods."""
        # Method 1: Check common WiFi interface name patterns
        wifi_patterns = [
            r'^wlan\d+$',      # wlan0, wlan1, etc.
            r'^wl\w+$',        # wlp3s0, etc.
            r'^wifi\d+$',      # wifi0, wifi1, etc.
            r'^ath\d+$',       # ath0, ath1 (Atheros)
            r'^ra\d+$',        # ra0, ra1 (Ralink)
            r'^rtl\d+$',       # rtl0, rtl1 (Realtek)
        ]
        
        for pattern in wifi_patterns:
            if re.match(pattern, interface_name):
                return True
        
        # Method 2: Check if interface has wireless extensions
        try:
            # Check if interface appears in iwconfig output (indicates wireless capability)
            result = subprocess.run(
                ['iwconfig', interface_name],
                capture_output=True,
                text=True,
                timeout=2
            )
            # If iwconfig doesn't return an error and doesn't say "no wireless extensions"
            if result.returncode == 0 and "no wireless extensions" not in result.stderr.lower():
                return True
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        
        # Method 3: Check sysfs for wireless directory
        try:
            wireless_path = f"/sys/class/net/{interface_name}/wireless"
            if os.path.exists(wireless_path):
                return True
        except:
            pass
        
        # Method 4: Check if interface has a phy directory (indicating wireless)
        try:
            phy_path = f"/sys/class/net/{interface_name}/phy80211"
            if os.path.exists(phy_path):
                return True
        except:
            pass
        
        return False

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
                    try:
                        data = json.loads(result.stdout)
                        for iface in data:
                            interface_name = iface.get('ifname', '')
                            
                            # Determine interface type using improved detection
                            interface_type = "Other"
                            if interface_name == 'lo':
                                interface_type = "Loopback"
                            elif HardwareDetector._is_wifi_interface(interface_name):
                                interface_type = "WiFi"
                            elif interface_name.startswith('eth') or interface_name.startswith('en'):
                                interface_type = "Ethernet"
                            elif interface_name.startswith('br'):
                                interface_type = "Bridge"
                            elif interface_name.startswith('tun') or interface_name.startswith('tap'):
                                interface_type = "VPN/Tunnel"
                            elif interface_name.startswith('docker') or interface_name.startswith('veth'):
                                interface_type = "Container"
                            
                            interfaces.append({
                                "name": interface_name,
                                "type": interface_type,
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
                    interface_type = "Other"
                    description = interface.Description or ""
                    if "Ethernet" in description:
                        interface_type = "Ethernet"
                    elif any(wifi_term in description.lower() for wifi_term in ["wireless", "wifi", "802.11", "wlan"]):
                        interface_type = "WiFi"
                    
                    interfaces.append({
                        "name": description,
                        "type": interface_type,
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
        """Detect GPIO capabilities using modern GPIO character device interface."""
        gpio_info = {
            "available": False,
            "chip_count": 0,
            "gpio_chips": []
        }
        
        if platform.system() == 'Linux':
            try:
                # Look for GPIO character devices in /dev
                gpio_chips = glob.glob('/dev/gpiochip*')
                
                if gpio_chips:
                    gpio_info["available"] = True
                    gpio_info["chip_count"] = len(gpio_chips)
                    
                    # Try to get detailed info using gpiodetect if available
                    try:
                        result = subprocess.run(
                            ['gpiodetect'],
                            capture_output=True,
                            text=True,
                            timeout=5
                        )
                        
                        if result.returncode == 0:
                            # Parse gpiodetect output
                            for line in result.stdout.split('\n'):
                                if line.strip():
                                    # Format: gpiochip0 [label] (ngpio lines)
                                    match = re.match(r'(gpiochip\d+)\s+\[([^\]]+)\]\s+\((\d+)\s+lines\)', line)
                                    if match:
                                        chip_name, label, ngpio = match.groups()
                                        gpio_info["gpio_chips"].append({
                                            "name": chip_name,
                                            "path": f"/dev/{chip_name}",
                                            "label": label,
                                            "ngpio": int(ngpio)
                                        })
                    except (subprocess.TimeoutExpired, FileNotFoundError):
                        # gpiodetect not available or timed out, use basic detection
                        logger.debug("gpiodetect not available, using basic GPIO detection")
                        
                        for chip_path in gpio_chips:
                            chip_name = os.path.basename(chip_path)
                            chip_info = {
                                "name": chip_name,
                                "path": chip_path,
                                "label": "Unknown",
                                "ngpio": 0
                            }
                            
                            # Try to get info from sysfs if available
                            sys_path = f"/sys/class/gpio/{chip_name}"
                            if os.path.exists(sys_path):
                                try:
                                    label_path = os.path.join(sys_path, 'label')
                                    if os.path.exists(label_path):
                                        with open(label_path, 'r') as f:
                                            chip_info["label"] = f.read().strip()
                                except:
                                    pass
                                    
                                try:
                                    ngpio_path = os.path.join(sys_path, 'ngpio')
                                    if os.path.exists(ngpio_path):
                                        with open(ngpio_path, 'r') as f:
                                            chip_info["ngpio"] = int(f.read().strip())
                                except:
                                    pass
                            
                            gpio_info["gpio_chips"].append(chip_info)
                
                # Also check for legacy sysfs GPIO interface
                legacy_gpio_path = '/sys/class/gpio'
                if os.path.exists(legacy_gpio_path) and not gpio_info["available"]:
                    gpio_info["available"] = True
                    gpio_info["legacy_interface"] = True
                    
                    # Count available GPIO chips in legacy interface
                    try:
                        legacy_chips = [d for d in os.listdir(legacy_gpio_path) if d.startswith('gpiochip')]
                        gpio_info["chip_count"] = len(legacy_chips)
                    except:
                        pass
                        
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
                                "path": f"/dev/bus/usb/{bus.zfill(3)}/{device.zfill(3)}"
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
                        device_id_part = pnp_device.DeviceID.split(chr(92))[1]
                        device_info = c.query(
                            f"SELECT * FROM Win32_PnPEntity WHERE DeviceID='{device_id_part}'"
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
