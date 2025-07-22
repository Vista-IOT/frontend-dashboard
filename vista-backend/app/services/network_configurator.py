
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

def run_command(command):
    """Executes a shell command and logs its output."""
    try:
        logger.info(f"Executing command: {' '.join(command)}")
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate()
        
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
    """Configures a static IP address for a network interface."""
    if not all([interface_name, ip_address, netmask]):
        logger.error(f"Cannot configure static IP for '{interface_name}'. One or more required parameters (interface, IP, netmask) are missing.")
        logger.error(f"Provided: IP='{ip_address}', Netmask='{netmask}'")
        return

    cidr_prefix = _netmask_to_cidr(netmask)
    if not cidr_prefix:
        logger.error(f"Invalid netmask '{netmask}' for interface '{interface_name}'. Aborting static configuration.")
        return

    logger.info(f"Applying static IP configuration for '{interface_name}'...")
    
    # 1. Bring the interface down to safely change its settings
    run_command(['ip', 'link', 'set', interface_name, 'down'])
    
    # 2. Flush existing IP addresses to ensure a clean slate
    run_command(['ip', 'addr', 'flush', 'dev', interface_name])
    
    # 3. Assign the new static IP address and netmask
    run_command(['ip', 'addr', 'add', f'{ip_address}/{cidr_prefix}', 'dev', interface_name])
    
    # 4. Bring the interface back up
    run_command(['ip', 'link', 'set', interface_name, 'up'])
    
    # 5. Set the default gateway using 'replace' to handle existing routes cleanly
    if gateway:
        run_command(['ip', 'route', 'replace', 'default', 'via', gateway, 'dev', interface_name])
        
    logger.info(f"Static IP configuration applied for '{interface_name}'.")

def configure_dhcp(interface_name):
    """Configures a network interface to use DHCP."""
    if not interface_name:
        logger.error("Cannot configure DHCP. Interface name is missing.")
        return

    logger.info(f"Applying DHCP configuration for '{interface_name}'...")
    
    # Using 'dhclient', a common DHCP client
    # 1. Release any existing IP to be safe
    run_command(['dhclient', '-r', interface_name])
    
    # 2. Request a new IP
    run_command(['dhclient', interface_name])
    
    logger.info(f"DHCP configuration applied for '{interface_name}'.") 