
import logging
from .hardware_detector import HardwareDetector
from . import network_configurator

logger = logging.getLogger(__name__)

def _get_default_netmask(ip_address: str) -> str:
    """Infers a default network mask based on the IP address."""
    if not ip_address:
        return ""
    try:
        first_octet = int(ip_address.split('.')[0])
        if first_octet == 10:
            logger.info(f"IP {ip_address} is in a Class A private range. Using default netmask 255.0.0.0")
            return "255.0.0.0"
        
        # For most other typical LAN scenarios (including 192.168.x.x and 172.16.x.x subnets)
        # a /24 mask is the most common and safest default.
        logger.info(f"Using common default netmask 255.255.255.0 for IP {ip_address}")
        return "255.255.255.0"
    except (ValueError, IndexError):
        logger.error(f"Invalid IP address format: {ip_address}. Cannot determine default netmask.")
        return ""

def _configure_network(config, detected_interfaces):
    """Checks and logs network interface configurations."""
    logger.info("--- Configuring Network Interfaces ---")
    configured_interfaces = config.get('network', {}).get('interfaces', {})
    
    detected_names = [iface['name'] for iface in detected_interfaces]
    logger.info(f"Detected: {detected_names}")
    logger.info(f"Configured: {list(configured_interfaces.keys())}")

    for name, iface_config in configured_interfaces.items():
        if iface_config.get('enabled', False):
            if name in detected_names:
                logger.info(f"✅ Interface '{name}' is configured and available. Applying settings...")
                ipv4_config = iface_config.get('ipv4', {})
                mode = ipv4_config.get('mode', 'dhcp')
                
                if mode == 'static':
                    static_settings = ipv4_config.get('static', {})
                    ip = static_settings.get('address')
                    netmask = static_settings.get('netmask')
                    gateway = static_settings.get('gateway')
                    
                    if ip and not netmask:
                        inferred_netmask = _get_default_netmask(ip)
                        if inferred_netmask:
                            logger.info(f"  - Netmask not provided for '{name}'. Auto-assigning default: '{inferred_netmask}'.")
                            netmask = inferred_netmask

                    if ip and netmask:
                        logger.info(f"  - Mode: static, IP: {ip}, Netmask: {netmask}, Gateway: {gateway or 'N/A'}")
                        network_configurator.configure_static_ip(name, ip, netmask, gateway)
                    else:
                        logger.warning(f"⚠️ Interface '{name}' is set to static mode, but IP or netmask is missing or invalid. Skipping configuration.")
                        logger.warning(f"  - Provided: IP='{ip}', Netmask='{netmask}'")
                else:
                    logger.info(f"  - Mode: dhcp")
                    network_configurator.configure_dhcp(name)
            else:
                logger.warning(f"⚠️ Interface '{name}' is configured but not available on the system.")
        else:
            logger.info(f"🔵 Interface '{name}' is configured but disabled. Skipping.")

def _configure_serial(config, detected_ports):
    """Checks and logs serial port configurations."""
    logger.info("--- Configuring Serial Ports ---")
    configured_ports = config.get('hardware', {}).get('com_ports', {})
    
    detected_names = [port['name'] for port in detected_ports]
    logger.info(f"Detected: {detected_names}")
    logger.info(f"Configured: {list(configured_ports.keys())}")

    for name, port_config in configured_ports.items():
        # Note: Serial port config doesn't have a top-level 'enabled' flag in the default schema.
        # We assume if it's configured, it's intended for use.
        if name in detected_names:
            logger.info(f"✅ Serial Port '{name}' is configured and available.")
            logger.info(f"  - Mode: {port_config.get('mode')}, Baudrate: {port_config.get('baudrate')}")
        else:
            logger.warning(f"⚠️ Serial Port '{name}' is configured but not available on the system.")

def _configure_gpio(config, detected_gpio):
    """Checks and logs GPIO configurations."""
    logger.info("--- Configuring GPIO ---")
    configured_gpio = config.get('hardware', {}).get('gpio', {})
    
    if detected_gpio and detected_gpio.get('available'):
        logger.info("✅ GPIO is available on the system.")
        if configured_gpio:
            inputs = len(configured_gpio.get('inputs', []))
            outputs = len(configured_gpio.get('outputs', []))
            logger.info(f"  - Configured with {inputs} inputs and {outputs} outputs.")
    else:
        logger.warning("⚠️ GPIO is not available on the system, but is present in configuration.")

def configure_hardware(config):
    """
    Checks the loaded configuration against all detected hardware and logs the status.
    """
    if not config:
        logger.warning("No configuration provided. Skipping hardware configuration.")
        return

    logger.info("--- Starting comprehensive hardware configuration check ---")
    
    all_hardware = HardwareDetector.detect_all_hardware()
    
    if not all_hardware:
        logger.error("Could not detect any hardware. Aborting configuration.")
        return

    _configure_network(config, all_hardware.get('network_interfaces', []))
    _configure_serial(config, all_hardware.get('serial_ports', []))
    _configure_gpio(config, all_hardware.get('gpio', {}))

    logger.info("--- Hardware configuration check complete ---") 