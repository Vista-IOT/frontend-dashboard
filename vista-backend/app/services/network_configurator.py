
import subprocess
import logging

logger = logging.getLogger(__name__)

def _netmask_to_cidr(netmask: str) -> int:
    """Converts a dotted-decimal netmask to CIDR prefix length."""
    if not netmask:
        return 0
    try:
        return sum(bin(int(x)).count('1') for x in netmask.split('.'))
    except (ValueError, AttributeError):
        logger.error(f"Invalid netmask format: {netmask}")
        return 0

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
        return

    cidr_prefix = _netmask_to_cidr(netmask)
    if not cidr_prefix:
        logger.error(f"Invalid netmask '{netmask}' for interface '{interface_name}'. Aborting static configuration.")
        return

    logger.info(f"Applying static IP configuration for '{interface_name}' using ip commands only...")
    
    # 1. Temporarily disable NetworkManager management of this interface
    logger.info(f"Temporarily disabling NetworkManager management for '{interface_name}'")
    run_command(['nmcli', 'device', 'set', interface_name, 'managed', 'no'])
    
    # 2. Bring the interface down to safely change its settings
    run_command(['ip', 'link', 'set', interface_name, 'down'])
    
    # 3. Flush existing IP addresses to ensure a clean slate
    run_command(['ip', 'addr', 'flush', 'dev', interface_name])
    
    # 4. Assign the new static IP address and netmask
    run_command(['ip', 'addr', 'add', f'{ip_address}/{cidr_prefix}', 'dev', interface_name])
    
    # 5. Bring the interface back up
    run_command(['ip', 'link', 'set', interface_name, 'up'])
    
    # 6. Set the default gateway using 'replace' to handle existing routes cleanly
    if gateway:
        run_command(['ip', 'route', 'replace', 'default', 'via', gateway, 'dev', interface_name])
    
    # 7. Keep NetworkManager disabled for this interface to prevent override
    logger.info(f"Keeping NetworkManager management disabled for '{interface_name}' to prevent IP override")
        
    logger.info(f"Static IP configuration applied for '{interface_name}' using ip commands only.")

def re_enable_networkmanager(interface_name):
    """Re-enables NetworkManager management of an interface."""
    logger.info(f"Re-enabling NetworkManager management for '{interface_name}'")
    run_command(['nmcli', 'device', 'set', interface_name, 'managed', 'yes'])

def configure_dhcp(interface_name):
    """Configures a network interface to use DHCP with fallback to static IP."""
    if not interface_name:
        logger.error("Cannot configure DHCP. Interface name is missing.")
        return

    logger.info(f"Applying DHCP configuration for '{interface_name}'...")
    
    # For DHCP, we can let NetworkManager handle it, so re-enable management
    logger.info(f"Re-enabling NetworkManager management for DHCP on '{interface_name}'")
    run_command(['nmcli', 'device', 'set', interface_name, 'managed', 'yes'])
    
    # Using 'dhclient', a common DHCP client
    # 1. Release any existing IP to be safe
    run_command(['dhclient', '-r', interface_name], timeout=10)
    
    # 2. Request a new IP with 30-second timeout
    dhcp_success = run_command(['dhclient', interface_name], timeout=30)
    
    if dhcp_success:
        logger.info(f"DHCP configuration applied successfully for '{interface_name}'.")
    else:
        logger.warning(f"DHCP failed for '{interface_name}'. Falling back to static IP configuration...")
        
        # Fallback to static IP: 10.0.0.5/24 with gateway 10.0.0.1
        fallback_ip = "10.0.0.5"
        fallback_netmask = "255.255.255.0"
        fallback_gateway = "10.0.0.1"
        
        logger.info(f"Configuring fallback static IP: {fallback_ip}/{fallback_netmask}, gateway: {fallback_gateway}")
        configure_static_ip(interface_name, fallback_ip, fallback_netmask, fallback_gateway)
        
        logger.info(f"Fallback static IP configuration applied for '{interface_name}'.")
