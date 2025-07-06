import os
import yaml
import logging
import json
from typing import Dict, Any, Optional, Union, List
from pathlib import Path

from ..database.db_connector import DBConnector

logger = logging.getLogger(__name__)

class ConfigManager:
    """
    ConfigManager handles the loading, validation, and management of the gateway configuration.
    It provides access to configuration settings and handles persistence of configuration changes.
    """
    
    def __init__(self, config_path: Optional[str] = None, db_path: Optional[str] = None):
        """
        Initialize the ConfigManager with the specified configuration file path.
        
        Args:
            config_path: Path to the configuration file. If None, will use default paths.
            db_path: Path to the SQLite database. If None, uses the default path.
        """
        self.config_path = config_path
        self.default_config_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), 
            "../../../config/default-config.yaml"
        )
        self.config = {}
        
        # Initialize database connector
        self.db_connector = DBConnector(db_path)
        
        # Load configuration with database support
        self.load_config()
    
    def load_config(self) -> Dict[str, Any]:
        """
        Load the configuration from multiple sources.
        Order of precedence: 
        1. Default configuration (YAML file)
        2. User configuration file (if specified)
        3. Database configuration (if available)
        
        Returns:
            The loaded configuration as a dictionary.
        """
        # Load default configuration
        try:
            with open(self.default_config_path, 'r') as f:
                self.config = yaml.safe_load(f)
                logger.info(f"Loaded default configuration from {self.default_config_path}")
        except Exception as e:
            logger.error(f"Failed to load default configuration: {e}")
            self.config = {}
        
        # If a specific config file is provided, overlay it
        if self.config_path and os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r') as f:
                    user_config = yaml.safe_load(f)
                    if user_config:
                        self._merge_configs(self.config, user_config)
                    logger.info(f"Loaded user configuration from {self.config_path}")
            except Exception as e:
                logger.error(f"Failed to load user configuration: {e}")
        
        # Try to load configuration from database
        try:
            db_config = self.load_from_database()
            if db_config:
                # Merge database configuration with higher priority
                self._merge_configs(self.config, db_config)
                logger.info("Loaded configuration from database")
                logger.debug(f"Config after DB load: IO Ports: {len(self.config.get('io_setup', {}).get('ports', []))}, Devices: {sum(len(p.get('devices', [])) for p in self.config.get('io_setup', {}).get('ports', []))}, Tags: {sum(len(d.get('tags', [])) for p in self.config.get('io_setup', {}).get('ports', []) for d in p.get('devices', []))}")
                # Optionally log full config if DEBUG
                if logger.isEnabledFor(logging.DEBUG):
                    import json
                    logger.debug(f"Full loaded config: {json.dumps(self.config, indent=2)}")
        except Exception as e:
            logger.warning(f"Failed to load configuration from database: {e}")
        
        return self.config
    
    def save_config(self, config_path: Optional[str] = None) -> bool:
        """
        Save the current configuration to disk.
        
        Args:
            config_path: Optional path to save the configuration. If None, uses the path from initialization.
            
        Returns:
            True if the save was successful, False otherwise.
        """
        save_path = config_path or self.config_path
        if not save_path:
            logger.error("No config path specified for saving")
            return False
        
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            
            # Save the config
            with open(save_path, 'w') as f:
                yaml.dump(self.config, f, default_flow_style=False)
            
            logger.info(f"Configuration saved to {save_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to save configuration to {save_path}: {e}")
            return False
    
    def get_config(self) -> Dict[str, Any]:
        """
        Get the complete configuration dictionary.
        
        Returns:
            The current configuration.
        """
        return self.config
    
    def get_value(self, path: str, default: Any = None) -> Any:
        """
        Get a configuration value by its dot-notation path.
        
        Args:
            path: Dot-notation path to the configuration value (e.g., "network.interfaces.eth0.enabled")
            default: Default value to return if the path doesn't exist
            
        Returns:
            The configuration value, or the default if not found.
        """
        parts = path.split('.')
        current = self.config
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return default
        
        return current
    
    def set_value(self, path: str, value: Any) -> bool:
        """
        Set a configuration value by its dot-notation path.
        
        Args:
            path: Dot-notation path to the configuration value (e.g., "network.interfaces.eth0.enabled")
            value: The value to set
            
        Returns:
            True if the value was set successfully, False otherwise.
        """
        parts = path.split('.')
        current = self.config
        
        # Navigate to the parent of the target node
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        
        # Set the value
        if isinstance(current, dict):
            current[parts[-1]] = value
            return True
        return False
    
    def validate_config(self) -> Dict[str, Any]:
        """
        Validate the current configuration against the schema.
        
        Returns:
            A dictionary with validation results.
        """
        # This is a placeholder for a more complex validation logic
        # In a real implementation, you would validate against a schema
        validation_result = {
            "valid": True,
            "errors": []
        }
        
        # Basic validation
        if not self.config.get("device", {}).get("name"):
            validation_result["valid"] = False
            validation_result["errors"].append("Device name is required")
        
        # Validate network configuration
        if not self.config.get("network", {}).get("interfaces"):
            validation_result["valid"] = False
            validation_result["errors"].append("At least one network interface must be configured")
        
        return validation_result
    
    def _merge_configs(self, base: Dict[str, Any], overlay: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recursively merge two configuration dictionaries, with overlay taking precedence.
        
        Args:
            base: The base configuration
            overlay: The configuration to overlay on the base
            
        Returns:
            The merged configuration dictionary.
        """
        for key, value in overlay.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._merge_configs(base[key], value)
            else:
                base[key] = value
        return base
        
    def load_from_database(self) -> Dict[str, Any]:
        """
        Load configuration from the SQLite database.
        
        Returns:
            The configuration loaded from the database, or an empty dict if none found.
        """
        try:
            # First try to get the latest snapshot
            snapshot = self.db_connector.get_latest_config_snapshot()
            if snapshot and 'config' in snapshot:
                return snapshot['config']
            
            # If no snapshot, build config from individual components
            return self.db_connector.build_complete_config()
        except Exception as e:
            logger.error(f"Error loading from database: {e}")
            return {}
    
    def save_to_database(self) -> bool:
        """
        Save the current configuration to the database.
        
        Returns:
            True if successful, False otherwise.
        """
        try:
            return self.db_connector.sync_config_to_database(self.config)
        except Exception as e:
            logger.error(f"Error saving to database: {e}")
            return False
    
    def get_io_ports(self) -> List[Dict[str, Any]]:
        """
        Get all IO ports from the database.
        
        Returns:
            List of IO port configurations.
        """
        return self.db_connector.get_io_ports()
    
    def get_user_tags(self) -> List[Dict[str, Any]]:
        """
        Get all user-defined tags from the database.
        
        Returns:
            List of user tag configurations.
        """
        return self.db_connector.get_user_tags()
    
    def get_calculation_tags(self) -> List[Dict[str, Any]]:
        """
        Get all calculation tags from the database.
        
        Returns:
            List of calculation tag configurations.
        """
        return self.db_connector.get_calculation_tags()
    
    def get_stats_tags(self) -> List[Dict[str, Any]]:
        """
        Get all statistics tags from the database.
        
        Returns:
            List of statistics tag configurations.
        """
        return self.db_connector.get_stats_tags()
    
    def get_system_tags(self) -> List[Dict[str, Any]]:
        """
        Get all system tags from the database.
        
        Returns:
            List of system tag configurations.
        """
        return self.db_connector.get_system_tags()
    
    def get_communication_bridges(self) -> List[Dict[str, Any]]:
        """
        Get all communication bridges from the database.
        
        Returns:
            List of communication bridge configurations.
        """
        return self.db_connector.get_communication_bridges()
    
    def get_destinations(self) -> List[Dict[str, Any]]:
        """
        Get all communication destinations from the database.
        
        Returns:
            List of destination configurations.
        """
        return self.db_connector.get_destinations()
