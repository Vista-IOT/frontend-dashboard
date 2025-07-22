import threading
import time
from .config_loader import load_latest_config
from .hardware_configurator import configure_hardware
from .polling_service import start_polling_from_config
from app.utils.config_summary import generate_config_summary
import logging

logger = logging.getLogger(__name__)
_init_lock = threading.Lock()

def initialize_backend():
    with _init_lock:
        logger.info('--- Re-initializing backend (config reload + hardware apply) ---')
        config = load_latest_config()
        # Log the config summary
        summary = generate_config_summary(config)
        logger.info("Configuration summary on startup:%s", summary)
        configure_hardware(config)
        # Give network interfaces time to come up after configuration
        logger.info('Waiting 2 seconds for network interfaces to stabilize...')
        time.sleep(2)
        start_polling_from_config(config)
        logger.info('--- Re-initialization complete ---') 