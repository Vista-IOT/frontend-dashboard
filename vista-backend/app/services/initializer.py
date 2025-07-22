import threading
from .config_loader import load_latest_config
from .hardware_configurator import configure_hardware
import logging

logger = logging.getLogger(__name__)
_init_lock = threading.Lock()

def initialize_backend():
    with _init_lock:
        logger.info('--- Re-initializing backend (config reload + hardware apply) ---')
        config = load_latest_config()
        configure_hardware(config)
        logger.info('--- Re-initialization complete ---') 