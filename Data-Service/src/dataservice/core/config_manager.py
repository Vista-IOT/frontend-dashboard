"""
Configuration Manager for Data-Service
Handles persistent storage of configurations (MQTT, protocols, etc.)
"""
import os
import json
import threading
from typing import Dict, Any, Optional
from pathlib import Path


class ConfigManager:
    """
    Manages persistent configuration storage for Data-Service.
    Configurations are stored in JSON files and automatically loaded on startup.
    """
    
    def __init__(self, config_dir: str = None):
        """
        Initialize configuration manager
        
        Args:
            config_dir: Directory to store configuration files. 
                       Defaults to ./config in the Data-Service directory
        """
        if config_dir is None:
            # Default to config directory in Data-Service root
            base_dir = Path(__file__).parent.parent.parent.parent
            config_dir = base_dir / "config"
        
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        self._configs: Dict[str, Any] = {}
        self._lock = threading.Lock()
        
        # Configuration files
        self.mqtt_config_file = self.config_dir / "mqtt_publisher.json"
        
        # Load existing configurations
        self._load_all_configs()
    
    def _load_all_configs(self):
        """Load all configuration files on startup"""
        self._load_mqtt_config()
    
    def _load_mqtt_config(self):
        """Load MQTT publisher configuration from file"""
        try:
            if self.mqtt_config_file.exists():
                with open(self.mqtt_config_file, 'r') as f:
                    config = json.load(f)
                    self._configs['mqtt_publisher'] = config
                    print(f"[ConfigManager] Loaded MQTT publisher config from {self.mqtt_config_file}")
            else:
                # Default MQTT configuration
                self._configs['mqtt_publisher'] = {
                    'enabled': False,
                    'broker': {
                        'address': 'localhost',
                        'port': 1883,
                        'client_id': 'dataservice-mqtt-pub',
                        'keepalive': 60,
                        'clean_session': True,
                        'protocol': 'mqtt',
                        'auth': {
                            'enabled': False,
                            'username': '',
                            'password': ''
                        },
                        'tls': {
                            'enabled': False,
                            'verify_server': True,
                            'allow_insecure': False,
                            'cert_file': '',
                            'key_file': '',
                            'ca_file': ''
                        }
                    },
                    'topics': {
                        'publish': [],
                        'subscribe': []
                    }
                }
                print(f"[ConfigManager] Using default MQTT publisher config")
        except Exception as e:
            print(f"[ConfigManager] Error loading MQTT config: {e}")
            self._configs['mqtt_publisher'] = {'enabled': False, 'broker': {}, 'topics': {'publish': [], 'subscribe': []}}
    
    def get_mqtt_config(self) -> Dict[str, Any]:
        """Get MQTT publisher configuration"""
        with self._lock:
            return self._configs.get('mqtt_publisher', {}).copy()
    
    def save_mqtt_config(self, config: Dict[str, Any]) -> bool:
        """
        Save MQTT publisher configuration to file
        
        Args:
            config: MQTT configuration dictionary
            
        Returns:
            True if saved successfully, False otherwise
        """
        try:
            with self._lock:
                self._configs['mqtt_publisher'] = config
                
                # Write to file with pretty formatting
                with open(self.mqtt_config_file, 'w') as f:
                    json.dump(config, f, indent=2)
                
                print(f"[ConfigManager] Saved MQTT publisher config to {self.mqtt_config_file}")
                return True
        except Exception as e:
            print(f"[ConfigManager] Error saving MQTT config: {e}")
            return False
    
    def get_config(self, config_name: str) -> Optional[Dict[str, Any]]:
        """
        Get configuration by name
        
        Args:
            config_name: Name of the configuration (e.g., 'mqtt_publisher')
            
        Returns:
            Configuration dictionary or None if not found
        """
        with self._lock:
            return self._configs.get(config_name, {}).copy()
    
    def save_config(self, config_name: str, config: Dict[str, Any], filename: str = None) -> bool:
        """
        Save configuration to file
        
        Args:
            config_name: Name of the configuration
            config: Configuration dictionary
            filename: Optional custom filename (defaults to config_name.json)
            
        Returns:
            True if saved successfully, False otherwise
        """
        try:
            with self._lock:
                self._configs[config_name] = config
                
                if filename is None:
                    filename = f"{config_name}.json"
                
                filepath = self.config_dir / filename
                
                with open(filepath, 'w') as f:
                    json.dump(config, f, indent=2)
                
                print(f"[ConfigManager] Saved {config_name} config to {filepath}")
                return True
        except Exception as e:
            print(f"[ConfigManager] Error saving {config_name} config: {e}")
            return False
    
    def reload_configs(self):
        """Reload all configurations from files"""
        print("[ConfigManager] Reloading all configurations...")
        self._load_all_configs()
    
    def get_config_file_path(self, config_name: str) -> Path:
        """Get the file path for a configuration"""
        return self.config_dir / f"{config_name}.json"
    
    def list_configs(self) -> list:
        """List all available configuration names"""
        with self._lock:
            return list(self._configs.keys())
    
    def backup_config(self, config_name: str) -> bool:
        """
        Create a backup of a configuration file
        
        Args:
            config_name: Name of the configuration to backup
            
        Returns:
            True if backup created successfully, False otherwise
        """
        try:
            import shutil
            from datetime import datetime
            
            source_file = self.config_dir / f"{config_name}.json"
            if not source_file.exists():
                return False
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_file = self.config_dir / f"{config_name}_backup_{timestamp}.json"
            
            shutil.copy2(source_file, backup_file)
            print(f"[ConfigManager] Created backup: {backup_file}")
            return True
        except Exception as e:
            print(f"[ConfigManager] Error creating backup: {e}")
            return False


# Global configuration manager instance
config_manager = ConfigManager()
