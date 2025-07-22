from typing import Dict, Any

def generate_config_summary(config: Dict[str, Any]) -> str:
    """Generates a human-readable summary of the configuration."""
    if not isinstance(config, dict):
        return "Invalid configuration format: not a dictionary."

    summary_lines = ["--- Configuration Summary ---"]

    # Device Info
    device_info = config.get('device', {})
    if device_info:
        name = device_info.get('name', 'N/A')
        model = device_info.get('model', 'N/A')
        summary_lines.append(f"Device: {name} ({model})")

    # Network Info
    network_info = config.get('network', {})
    if isinstance(network_info, dict):
        interfaces = network_info.get('interfaces', {})
        num_interfaces = len(interfaces) if isinstance(interfaces, dict) else 0
        enabled_ifaces = [iface for iface, details in interfaces.items() if isinstance(details, dict) and details.get('enabled')]
        summary_lines.append(f"Network: {num_interfaces} interfaces ({len(enabled_ifaces)} enabled).")

    # Protocols Info
    protocols_info = config.get('protocols', {})
    if isinstance(protocols_info, dict):
        enabled_protocols = [p.upper() for p, details in protocols_info.items() if isinstance(details, dict) and details.get('enabled')]
        if enabled_protocols:
            summary_lines.append(f"Enabled Protocols: {', '.join(enabled_protocols)}")

    # IO Setup
    io_setup = config.get('io_setup', {})
    if isinstance(io_setup, dict):
        ports = io_setup.get('ports', [])
        num_ports = len(ports) if isinstance(ports, list) else 0
        num_devices = 0
        num_tags = 0
        if isinstance(ports, list):
            for port in ports:
                if not isinstance(port, dict): continue
                devices = port.get('devices', [])
                if isinstance(devices, list):
                    num_devices += len(devices)
                    for device in devices:
                        if not isinstance(device, dict): continue
                        tags = device.get('tags', [])
                        if isinstance(tags, list):
                            num_tags += len(tags)
        summary_lines.append(f"IO Setup: {num_ports} ports, {num_devices} devices, {num_tags} IO tags.")

    # Other Tag Types
    user_tags = len(config.get('user_tags', [])) if isinstance(config.get('user_tags'), list) else 0
    calc_tags = len(config.get('calculation_tags', [])) if isinstance(config.get('calculation_tags'), list) else 0
    stats_tags = len(config.get('stats_tags', [])) if isinstance(config.get('stats_tags'), list) else 0
    system_tags = len(config.get('system_tags', [])) if isinstance(config.get('system_tags'), list) else 0
    summary_lines.append(f"Defined Tags: {user_tags} User, {calc_tags} Calculation, {stats_tags} Stats, {system_tags} System.")
    
    summary_lines.append("---------------------------")
    
    return "\n" + "\n".join(summary_lines) 