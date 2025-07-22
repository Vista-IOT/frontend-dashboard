import asyncio
import threading
import time
import logging
from .config_loader import load_latest_config
from .initializer import initialize_backend
import json

logger = logging.getLogger(__name__)

class ConfigMonitor:
    def __init__(self, check_interval=30):
        self.check_interval = check_interval
        self.last_config_hash = None
        self.running = False
        self.thread = None

    def _get_config_hash(self, config):
        """Generate a hash of the configuration for comparison"""
        try:
            return hash(json.dumps(config, sort_keys=True))
        except Exception as e:
            logger.error(f"Error generating config hash: {e}")
            return None

    def _monitor_loop(self):
        """Monitor configuration changes"""
        logger.info(f"Configuration monitor started (checking every {self.check_interval}s)")
        
        while self.running:
            try:
                current_config = load_latest_config()
                current_hash = self._get_config_hash(current_config)
                
                if self.last_config_hash is None:
                    # First run, store the hash
                    self.last_config_hash = current_hash
                    logger.info("Configuration monitor initialized with current config")
                elif current_hash != self.last_config_hash:
                    # Configuration changed, reload
                    logger.info("Configuration change detected, reloading backend...")
                    self.last_config_hash = current_hash
                    initialize_backend()
                    logger.info("Backend reloaded due to configuration change")
                    
            except Exception as e:
                logger.error(f"Error in configuration monitor: {e}")
                
            time.sleep(self.check_interval)
        
        logger.info("Configuration monitor stopped")

    def start(self):
        """Start the configuration monitor"""
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self.thread.start()
            logger.info("Configuration monitor thread started")

    def stop(self):
        """Stop the configuration monitor"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
            logger.info("Configuration monitor stopped")

# Global monitor instance
config_monitor = ConfigMonitor(check_interval=30)  # Check every 30 seconds
