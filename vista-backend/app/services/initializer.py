import threading
import time
import os
from .config_loader import load_latest_config
from .hardware_configurator import configure_hardware, apply_network_configuration
from .polling_service import start_polling_from_config
from .network_configurator import get_current_wifi_interface_config
from app.utils.config_summary import generate_config_summary
import logging

logger = logging.getLogger(__name__)
_init_lock = threading.Lock()

def initialize_backend():
    with _init_lock:
        logger.info('--- Re-initializing backend (config reload + hardware apply) ---')
        
        # First, detect and preserve current WiFi configuration
        wifi_config = get_current_wifi_interface_config()
        if wifi_config:
            logger.info(f"🛜 Detected active WiFi interface: {wifi_config['interface']} with IP {wifi_config['ip']}")
            logger.info(f"   Gateway: {wifi_config['gateway'] or 'N/A'}")
            logger.info(f"   This WiFi configuration will be preserved to maintain connectivity")
        else:
            logger.warning("⚠️  No active WiFi interface detected")
        
        config = load_latest_config()
        # Log the config summary
        summary = generate_config_summary(config)
        logger.info("Configuration summary on startup:%s", summary)
        
        # Check if we have root privileges for network configuration
        has_root = os.geteuid() == 0
        if has_root:
            logger.info('Running as root - applying network configuration changes')
            # Apply network configuration changes when we have root privileges
            apply_network_configuration(config)
        else:
            logger.warning('Not running as root - only checking hardware configuration (network changes will not be applied)')
            # Only check hardware configuration without applying changes
            configure_hardware(config, apply_network_changes=False)
            
        # Give network interfaces time to come up after configuration
        logger.info('Waiting 2 seconds for network interfaces to stabilize...')
        time.sleep(2)
        start_polling_from_config(config)
        logger.info('--- Re-initialization complete ---')
