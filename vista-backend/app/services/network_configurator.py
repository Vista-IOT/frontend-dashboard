
import subprocess
import logging
import json
import re

logger = logging.getLogger(__name__)

def get_current_wifi_interface_config():
    """Detects WiFi interface and gets its current IP configuration."""
    try:
        # First, get all interfaces
        result = subprocess.run(
            ['ip', '-j', 'addr', 'show'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            
            # Look for WiFi interfaces
            wifi_patterns = [r'^wl\w+$', r'^wlan\d+$', r'^wifi\d+$']
            
            for iface in data:
                interface_name = iface.get('ifname', '')
                
                # Check if this looks like a WiFi interface
                is_wifi = any(re.match(pattern, interface_name) for pattern in wifi_patterns)
                
                if is_wifi:
                    # Check if interface is UP and has an IP
                    flags = iface.get('flags', [])
                    addr_info = iface.get('addr_info', [])
                    
                    if 'UP' in flags:
                        for addr in addr_info:
                            if addr.get('family') == 'inet' and addr.get('scope') == 'global':
                                ip_address = addr.get('local')
                                prefix_len = addr.get('prefixlen', 24)
                                
                                # Convert prefix length back to netmask
                                netmask_bits = (0xffffffff << (32 - prefix_len)) & 0xffffffff
                                netmask = '.'.join([
                                    str((netmask_bits >> 24) & 0xff),
                                    str((netmask_bits >> 16) & 0xff),
                                    str((netmask_bits >> 8) & 0xff),
                                    str(netmask_bits & 0xff)
                                ])
                                
                                # Get gateway
                                gateway = _get_current_gateway(interface_name)
                                
                                logger.info(f"Detected WiFi interface '{interface_name}' with IP: {ip_address}/{prefix_len}")
                                return {
                                    'interface': interface_name,
                                    'ip': ip_address,
                                    'netmask': netmask,
                                    'gateway': gateway
                                }
        
        logger.warning("No active WiFi interface with IP address found")
        return None
        
    except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception) as e:
        logger.error(f"Error detecting WiFi interface: {e}")
        return None

def _netmask_to_cidr(netmask: str) -> int:
    """Converts a dotted-decimal netmask to CIDR prefix length."""
    if not netmask:
        return 0
    try:
        return sum(bin(int(x)).count('1') for x in netmask.split('.'))
    except (ValueError, AttributeError):
        logger.error(f"Invalid netmask format: {netmask}")
        return 0

def _get_current_wifi_ip(interface_name: str) -> dict:
    """Gets the current WiFi IP configuration for fallback purposes."""
    try:
        result = subprocess.run(
            ['ip', '-j', 'addr', 'show', interface_name],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            if data and len(data) > 0:
                iface = data[0]
                addr_info = iface.get('addr_info', [])
                
                # Find IPv4 address
                for addr in addr_info:
                    if addr.get('family') == 'inet' and addr.get('scope') == 'global':
                        ip_address = addr.get('local')
                        prefix_len = addr.get('prefixlen', 24)
                        
                        # Convert prefix length back to netmask
                        netmask_bits = (0xffffffff << (32 - prefix_len)) & 0xffffffff
                        netmask = '.'.join([
                            str((netmask_bits >> 24) & 0xff),
                            str((netmask_bits >> 16) & 0xff),
                            str((netmask_bits >> 8) & 0xff),
                            str(netmask_bits & 0xff)
                        ])
                        
                        # Try to get gateway from route table
                        gateway = _get_current_gateway(interface_name)
                        
                        return {
                            'ip': ip_address,
                            'netmask': netmask,
                            'gateway': gateway
                        }
        
        logger.warning(f"Could not get current IP configuration for {interface_name}")
        return {'ip': None, 'netmask': None, 'gateway': None}
        
    except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception) as e:
        logger.error(f"Error getting current WiFi IP for {interface_name}: {e}")
        return {'ip': None, 'netmask': None, 'gateway': None}

def _get_current_gateway(interface_name: str) -> str:
    """Gets the current default gateway for the interface."""
    try:
        result = subprocess.run(
            ['ip', 'route', 'show', 'default'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            # Parse output like: "default via 10.10.112.1 dev wlp3s0 proto dhcp src 10.10.125.216 metric 600"
            for line in result.stdout.split('\n'):
                if interface_name in line and 'via' in line:
                    match = re.search(r'via\s+(\S+)', line)
                    if match:
                        return match.group(1)
        
        return None
        
    except (subprocess.TimeoutExpired, Exception) as e:
        logger.error(f"Error getting current gateway for {interface_name}: {e}")
        return None

def run_command(command, timeout=None):
    """Executes a shell command and logs its output."""
    try:
        logger.info(f"Executing command: {' '.join(command)}{f' (timeout: {timeout}s)' if timeout else ''}")
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            logger.warning(f"Command timed out after {timeout} seconds: {' '.join(command)}")
            process.kill()
            try:
                # Give the process a moment to cleanup after kill
                stdout, stderr = process.communicate(timeout=2)
            except subprocess.TimeoutExpired:
                # Force terminate if it still won't die
                process.terminate()
                stdout, stderr = "", "Process forcefully terminated due to timeout"
            return False
        
        if process.returncode == 0:
            logger.info(f"Command successful. Output:\n{stdout}")
            return True
        else:
            logger.error(f"Command failed with exit code {process.returncode}. Error:\n{stderr}")
            return False
    except FileNotFoundError:
        logger.error(f"Command not found: {command[0]}. Is the command's package installed and in the system's PATH?")
        return False
    except Exception as e:
        logger.error(f"An exception occurred while running command: {e}")
        return False

def configure_static_ip(interface_name, ip_address, netmask, gateway):
    """Configures a static IP address for a network interface using only ip commands."""
    if not all([interface_name, ip_address, netmask]):
        logger.error(f"Cannot configure static IP for '{interface_name}'. One or more required parameters (interface, IP, netmask) are missing.")
        logger.error(f"Provided: IP='{ip_address}', Netmask='{netmask}'")
        return False

    cidr_prefix = _netmask_to_cidr(netmask)
    if not cidr_prefix:
        logger.error(f"Invalid netmask '{netmask}' for interface '{interface_name}'. Aborting static configuration.")
        return False

    logger.info(f"Applying static IP configuration for '{interface_name}' using ip commands only...")
    success = True
    
    # 1. Temporarily disable NetworkManager management of this interface (if nmcli exists)
    logger.info(f"Attempting to disable NetworkManager management for '{interface_name}'")
    if not run_command(['nmcli', 'device', 'set', interface_name, 'managed', 'no']):
        logger.warning(f"Could not disable NetworkManager for '{interface_name}' (nmcli may not be available). Proceeding anyway.")
    
    # 2. Bring the interface down to safely change its settings
    if not run_command(['ip', 'link', 'set', interface_name, 'down']):
        logger.error(f"Failed to bring interface '{interface_name}' down")
        success = False
    
    # 3. Flush existing IP addresses to ensure a clean slate
    if success and not run_command(['ip', 'addr', 'flush', 'dev', interface_name]):
        logger.error(f"Failed to flush IP addresses for interface '{interface_name}'")
        success = False
    
    # 4. Assign the new static IP address and netmask
    if success and not run_command(['ip', 'addr', 'add', f'{ip_address}/{cidr_prefix}', 'dev', interface_name]):
        logger.error(f"Failed to assign IP address '{ip_address}/{cidr_prefix}' to interface '{interface_name}'")
        success = False
    
    # 5. Bring the interface back up
    if success and not run_command(['ip', 'link', 'set', interface_name, 'up']):
        logger.error(f"Failed to bring interface '{interface_name}' up")
        success = False
    
    # 6. Set the default gateway using 'replace' to handle existing routes cleanly
    if success and gateway:
        if not run_command(['ip', 'route', 'replace', 'default', 'via', gateway, 'dev', interface_name]):
            logger.error(f"Failed to set default gateway '{gateway}' for interface '{interface_name}'")
            success = False
    
    # 7. Verify the IP configuration was applied
    if success:
        # Wait a moment for the configuration to take effect
        import time
        time.sleep(1)
        
        # Check if the IP was actually set
        try:
            result = subprocess.check_output(['ip', 'addr', 'show', interface_name]).decode('utf-8')
            if ip_address in result:
                logger.info(f"✅ Static IP configuration successfully applied for '{interface_name}': {ip_address}/{cidr_prefix}")
                if gateway:
                    logger.info(f"   Gateway: {gateway}")
                return True
            else:
                logger.error(f"❌ IP address '{ip_address}' not found on interface '{interface_name}' after configuration")
                return False
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to verify IP configuration for '{interface_name}': {e}")
            return False
    else:
        logger.error(f"❌ Failed to apply static IP configuration for '{interface_name}'")
        return False

def re_enable_networkmanager(interface_name):
    """Re-enables NetworkManager management of an interface."""
    logger.info(f"Re-enabling NetworkManager management for '{interface_name}'")
    run_command(['nmcli', 'device', 'set', interface_name, 'managed', 'yes'])

def _detect_dhcp_client():
    """Detects which DHCP client is available on the system."""
    import shutil
    
    # Check for dhclient first (ISC DHCP client)
    if shutil.which('dhclient'):
        return 'dhclient'
    
    # Check for dhcpcd (dhcpcd client)
    if shutil.which('dhcpcd'):
        return 'dhcpcd'
    
    # No DHCP client found
    return None

def configure_dhcp(interface_name):
    """Configures a network interface to use DHCP with fallback to static IP."""
    if not interface_name:
        logger.error("Cannot configure DHCP. Interface name is missing.")
        return

    # First, preserve current IP configuration before making changes
    logger.info(f"Preserving current IP configuration for '{interface_name}' before DHCP attempt...")
    current_config = _get_current_wifi_ip(interface_name)
    
    logger.info(f"Applying DHCP configuration for '{interface_name}'...")
    
    # For DHCP, we can let NetworkManager handle it, so re-enable management
    logger.info(f"Re-enabling NetworkManager management for DHCP on '{interface_name}'")
    run_command(['nmcli', 'device', 'set', interface_name, 'managed', 'yes'])
    
    # Detect which DHCP client is available
    dhcp_client = _detect_dhcp_client()
    
    if not dhcp_client:
        logger.error("No DHCP client found (dhclient or dhcpcd). Falling back to static IP configuration...")
        dhcp_success = False
    elif dhcp_client == 'dhclient':
        # Using 'dhclient' (ISC DHCP client)
        # 1. Release any existing IP to be safe
        run_command(['dhclient', '-r', interface_name], timeout=10)
        
        # 2. Request a new IP with 30-second timeout
        dhcp_success = run_command(['dhclient', interface_name], timeout=30)
    elif dhcp_client == 'dhcpcd':
        # Using 'dhcpcd' client
        # 1. Release any existing IP to be safe
        run_command(['dhcpcd', '-k', interface_name], timeout=10)
        
        # 2. Request a new IP with 30-second timeout
        dhcp_success = run_command(['dhcpcd', interface_name], timeout=30)
    
    if dhcp_success:
        logger.info(f"DHCP configuration applied successfully for '{interface_name}'.")
    else:
        logger.warning(f"DHCP failed for '{interface_name}'. Falling back to static IP configuration...")
        
        # Use preserved IP configuration to maintain existing connectivity
        if current_config['ip']:
            # Use current WiFi IP as fallback to maintain connectivity
            fallback_ip = current_config['ip']
            fallback_netmask = current_config['netmask'] or "255.255.255.0"  # Default to /24 if unknown
            fallback_gateway = current_config['gateway'] or None
            
            logger.info(f"Using preserved WiFi IP as fallback: {fallback_ip}/{fallback_netmask}, gateway: {fallback_gateway or 'N/A'}")
            logger.info(f"This preserves your laptop's original WiFi connectivity")
        else:
            # Get current IP one more time in case it changed
            retry_config = _get_current_wifi_ip(interface_name)
            if retry_config['ip']:
                fallback_ip = retry_config['ip']
                fallback_netmask = retry_config['netmask'] or "255.255.255.0"
                fallback_gateway = retry_config['gateway'] or None
                logger.info(f"Using current WiFi IP as fallback: {fallback_ip}/{fallback_netmask}, gateway: {fallback_gateway or 'N/A'}")
            else:
                # Last resort: use hardcoded fallback IP
                fallback_ip = "10.0.0.5"
                fallback_netmask = "255.255.255.0"
                fallback_gateway = "10.0.0.1"
                logger.warning(f"Could not detect any WiFi IP - using hardcoded fallback: {fallback_ip}/{fallback_netmask}, gateway: {fallback_gateway}")
                logger.warning(f"This may disrupt your WiFi connectivity. Consider configuring a static IP manually.")
        
        configure_static_ip(interface_name, fallback_ip, fallback_netmask, fallback_gateway)
        
        logger.info(f"Fallback static IP configuration applied for '{interface_name}'.")
