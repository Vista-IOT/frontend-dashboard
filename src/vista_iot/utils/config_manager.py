import os
import yaml
import json
import logging
from typing import Dict, Any, Optional
from ..database.db_handler import DatabaseHandler
from sqlalchemy import text

logger = logging.getLogger(__name__)

class ConfigManager:
    def __init__(self):
        self.db = DatabaseHandler()
        self.config: Dict[str, Any] = {}
        self.load_config()

    def load_config(self):
        """Load configuration from database and YAML files."""
        try:
            # Load default configuration
            default_config_path = os.path.join(
                os.path.dirname(__file__), 
                "../../../config/default-config.yaml"
            )
            if os.path.exists(default_config_path):
                with open(default_config_path, 'r') as f:
                    self.config = yaml.safe_load(f)
            
            # Update with database configuration
            self._update_from_database()
            
            logger.info("Configuration loaded successfully")
        except Exception as e:
            logger.error(f"Error loading configuration: {str(e)}")
            # Use minimal default configuration
            self.config = {
                "device": {
                    "name": "Vista-IoT-Gateway",
                    "model": "Default",
                    "version": "1.0.0"
                }
            }

    def _update_from_database(self):
        """Update configuration with data from database."""
        try:
            # Get IO ports configuration
            io_ports = self.db.get_io_ports()
            self.config["io_setup"] = {
                "ports": [port.dict() for port in io_ports]
            }

            # Get bridges configuration
            bridges = self.db.get_bridges()
            destinations = self.db.get_destinations()
            
            self.config["communication_forward"] = {
                "bridges": [bridge.dict() for bridge in bridges],
                "destinations": [dest.dict() for dest in destinations]
            }

        except Exception as e:
            logger.error(f"Error updating configuration from database: {str(e)}")

    def get_config(self) -> Dict[str, Any]:
        """Get the complete configuration."""
        return self.config

    def get_io_ports(self):
        """Get IO ports configuration."""
        return self.db.get_io_ports()

    def get_bridges(self):
        """Get bridges configuration."""
        return self.db.get_bridges()

    def get_destinations(self):
        """Get destinations configuration."""
        return self.db.get_destinations()

    def save_config_snapshot(self, config: Dict[str, Any]):
        """Save a snapshot of the current configuration."""
        try:
            # Convert to YAML string
            config_yaml = yaml.dump(config, default_flow_style=False)
            
            # Save to database
            with self.db.Session() as session:
                session.execute(
                    text("""
                        INSERT INTO ConfigSnapshot (raw)
                        VALUES (:config)
                    """),
                    {"config": config_yaml}
                )
                session.commit()
            
            logger.info("Configuration snapshot saved successfully")
        except Exception as e:
            logger.error(f"Error saving configuration snapshot: {str(e)}")
            raise 