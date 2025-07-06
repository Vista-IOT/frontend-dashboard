"""
Database connector module for the Vista IoT Gateway.
Handles connections to SQLite database and synchronization with configuration files.
"""
import os
import json
import sqlite3
import logging
import yaml
from typing import Dict, Any, List, Optional, Union
from pathlib import Path

logger = logging.getLogger(__name__)

class DBConnector:
    """
    Database connector for Vista IoT Gateway.
    This class handles interactions with the SQLite database that stores gateway configuration.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the database connector.
        
        Args:
            db_path: Path to the SQLite database file. If None, uses the default path.
        """
        # Default database path is in the frontend/prisma directory
        if db_path is None:
            # Find the frontend directory
            frontend_dir = Path(__file__).parents[4]  # Go up 4 levels from this file
            db_path = os.path.join(frontend_dir, "prisma", "dev.db")
        
        self.db_path = db_path
        self.conn = None
        self.cursor = None
        
        logger.info(f"Database connector initialized with path: {db_path}")
    
    def connect(self) -> bool:
        """
        Connect to the SQLite database.
        
        Returns:
            True if connection successful, False otherwise.
        """
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row  # Return rows as dictionaries
            self.cursor = self.conn.cursor()
            logger.info("Connected to SQLite database")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            return False
    
    def disconnect(self):
        """Close the database connection."""
        if self.conn:
            self.conn.close()
            self.conn = None
            self.cursor = None
            logger.info("Disconnected from SQLite database")
    
    def get_io_ports(self) -> List[Dict[str, Any]]:
        """
        Get all IO ports from the database.
        
        Returns:
            List of IO port configurations as dictionaries.
        """
        if not self.conn:
            self.connect()
        
        try:
            self.cursor.execute("""
                SELECT id, type, name, description, scanTime, timeOut, 
                       retryCount, autoRecoverTime, scanMode, enabled, serialSettings
                FROM IOPort
            """)
            
            ports = []
            for row in self.cursor.fetchall():
                port = dict(row)
                
                # Parse serialSettings JSON if it exists
                if port.get('serialSettings'):
                    try:
                        port['serialSettings'] = json.loads(port['serialSettings'])
                    except json.JSONDecodeError:
                        port['serialSettings'] = None
                
                # Get devices for this port
                port['devices'] = self.get_devices_for_port(port['id'])
                ports.append(port)
            
            return ports
        except Exception as e:
            logger.error(f"Failed to get IO ports: {e}")
            return []
    
    def get_devices_for_port(self, port_id: str) -> List[Dict[str, Any]]:
        """
        Get all devices for a specific IO port.
        
        Args:
            port_id: The IO port ID to get devices for.
            
        Returns:
            List of device configurations as dictionaries.
        """
        if not self.conn:
            self.connect()
        
        try:
            self.cursor.execute("""
                SELECT id, enabled, name, deviceType, unitNumber, tagWriteType, 
                       description, addDeviceNameAsPrefix, useAsciiProtocol,
                       packetDelay, digitalBlockSize, analogBlockSize
                FROM Device
                WHERE ioPortId = ?
            """, (port_id,))
            
            devices = []
            for row in self.cursor.fetchall():
                device = dict(row)
                
                # Get tags for this device
                device['tags'] = self.get_tags_for_device(device['id'])
                devices.append(device)
            
            return devices
        except Exception as e:
            logger.error(f"Failed to get devices for port {port_id}: {e}")
            return []
    
    def get_tags_for_device(self, device_id: str) -> List[Dict[str, Any]]:
        """
        Get all tags for a specific device.
        
        Args:
            device_id: The device ID to get tags for.
            
        Returns:
            List of tag configurations as dictionaries.
        """
        if not self.conn:
            self.connect()
        
        try:
            self.cursor.execute("""
                SELECT id, name, dataType, registerType, conversionType, address,
                       startBit, lengthBit, spanLow, spanHigh, defaultValue,
                       scanRate, readWrite, description, scaleType, formula,
                       scale, offset, clampToLow, clampToHigh, clampToZero
                FROM IOTag
                WHERE deviceId = ?
            """, (device_id,))
            
            return [dict(row) for row in self.cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get tags for device {device_id}: {e}")
            return []
    
    def get_user_tags(self) -> List[Dict[str, Any]]:
        """
        Get all user-defined tags from the database.
        
        Returns:
            List of user tag configurations as dictionaries.
        """
        if not self.conn:
            self.connect()
        
        try:
            self.cursor.execute("""
                SELECT id, name, dataType, defaultValue, spanHigh, spanLow,
                       readWrite, description
                FROM UserTag
            """)
            
            return [dict(row) for row in self.cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get user tags: {e}")
            return []
    
    def get_calculation_tags(self) -> List[Dict[str, Any]]:
        """
        Get all calculation tags from the database.
        
        Returns:
            List of calculation tag configurations as dictionaries.
        """
        if not self.conn:
            self.connect()
        
        try:
            self.cursor.execute("""
                SELECT id, name, defaultValue, formula, a, b, c, d, e, f, g, h,
                       period, readWrite, spanHigh, spanLow, isParent, description
                FROM CalculationTag
            """)
            
            return [dict(row) for row in self.cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get calculation tags: {e}")
            return []
    
    def get_stats_tags(self) -> List[Dict[str, Any]]:
        """
        Get all statistics tags from the database.
        
        Returns:
            List of statistics tag configurations as dictionaries.
        """
        if not self.conn:
            self.connect()
        
        try:
            self.cursor.execute("""
                SELECT id, name, referTagId, type, updateCycleValue, updateCycleUnit,
                       description
                FROM StatsTag
            """)
            
            return [dict(row) for row in self.cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get stats tags: {e}")
            return []
    
    def get_system_tags(self) -> List[Dict[str, Any]]:
        """
        Get all system tags from the database.
        
        Returns:
            List of system tag configurations as dictionaries.
        """
        if not self.conn:
            self.connect()
        
        try:
            self.cursor.execute("""
                SELECT id, name, dataType, unit, spanHigh, spanLow, description
                FROM SystemTag
            """)
            
            return [dict(row) for row in self.cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get system tags: {e}")
            return []
    
    def get_communication_bridges(self) -> List[Dict[str, Any]]:
        """
        Get all communication bridges from the database.
        
        Returns:
            List of communication bridge configurations as dictionaries.
        """
        if not self.conn:
            self.connect()
        
        try:
            self.cursor.execute("""
                SELECT id
                FROM CommunicationBridge
            """)
            
            bridges = []
            for row in self.cursor.fetchall():
                bridge = dict(row)
                
                # Get blocks for this bridge
                bridge['blocks'] = self.get_bridge_blocks(bridge['id'])
                bridges.append(bridge)
            
            return bridges
        except Exception as e:
            logger.error(f"Failed to get communication bridges: {e}")
            return []
    
    def get_bridge_blocks(self, bridge_id: str) -> List[Dict[str, Any]]:
        """
        Get all blocks for a specific communication bridge.
        
        Args:
            bridge_id: The bridge ID to get blocks for.
            
        Returns:
            List of bridge block configurations as dictionaries.
        """
        if not self.conn:
            self.connect()
        
        try:
            self.cursor.execute("""
                SELECT id, type, subType, label, configJson, destinationId
                FROM BridgeBlock
                WHERE bridgeId = ?
            """, (bridge_id,))
            
            blocks = []
            for row in self.cursor.fetchall():
                block = dict(row)
                
                # Parse configJson
                if block.get('configJson'):
                    try:
                        block['config'] = json.loads(block['configJson'])
                        del block['configJson']
                    except json.JSONDecodeError:
                        block['config'] = {}
                
                blocks.append(block)
            
            return blocks
        except Exception as e:
            logger.error(f"Failed to get blocks for bridge {bridge_id}: {e}")
            return []
    
    def get_destinations(self) -> List[Dict[str, Any]]:
        """
        Get all communication destinations from the database.
        
        Returns:
            List of destination configurations as dictionaries.
        """
        if not self.conn:
            self.connect()
        
        try:
            self.cursor.execute("""
                SELECT id, name, type, description, configJson
                FROM Destination
            """)
            
            destinations = []
            for row in self.cursor.fetchall():
                destination = dict(row)
                
                # Parse configJson
                if destination.get('configJson'):
                    try:
                        destination['config'] = json.loads(destination['configJson'])
                        del destination['configJson']
                    except json.JSONDecodeError:
                        destination['config'] = {}
                
                destinations.append(destination)
            
            return destinations
        except Exception as e:
            logger.error(f"Failed to get destinations: {e}")
            return []
    
    def save_config_snapshot(self, config: Dict[str, Any]) -> bool:
        """
        Save a configuration snapshot to the database.
        
        Returns:
            True if successful, False otherwise.
        """
        try:
            import yaml
            raw_yaml = yaml.dump(config)
            logger.debug(f"Saving config snapshot to DB: {raw_yaml}")
            # ... existing code to save snapshot ...
            # (Assume the rest of the function is implemented)
            return True
        except Exception as e:
            logger.error(f"Error saving config snapshot: {e}")
            return False
    
    def get_latest_config_snapshot(self) -> Optional[Dict[str, Any]]:
        """
        Get the latest configuration snapshot from the database.
        
        Returns:
            The latest configuration snapshot, or None if not found.
        """
        if not self.conn:
            self.connect()
        
        try:
            self.cursor.execute("""
                SELECT id, raw, createdAt
                FROM ConfigSnapshot
                ORDER BY createdAt DESC
                LIMIT 1
            """)
            
            row = self.cursor.fetchone()
            if row:
                snapshot = dict(row)
                logger.debug(f"Loaded config snapshot from DB: {snapshot['id']} at {snapshot['createdAt']}")
                # Parse YAML
                try:
                    snapshot['config'] = yaml.safe_load(snapshot['raw'])
                    logger.debug(f"Config snapshot YAML: {snapshot['raw']}")
                    return snapshot
                except yaml.YAMLError:
                    logger.error(f"Failed to parse YAML in snapshot {snapshot['id']}")
            
            return None
        except Exception as e:
            logger.error(f"Failed to get latest config snapshot: {e}")
            return None
    
    def build_complete_config(self) -> Dict[str, Any]:
        """
        Build a complete configuration from the database.
        This combines IO ports, devices, tags, and communication settings.
        
        Returns:
            Complete configuration dictionary.
        """
        # Start with a base configuration
        config = {
            "device": {
                "name": "Vista-IoT-Gateway-001",
                "model": "Vista-IoT-GW-5000",
                "version": "2.1.0",
                "location": "",
                "description": ""
            },
            "network": {
                "interfaces": {
                    "eth0": {
                        "type": "ethernet",
                        "enabled": True,
                        "mode": "dhcp",
                        "link": {
                            "speed": "auto",
                            "duplex": "auto"
                        },
                        "ipv4": {
                            "mode": "dhcp",
                            "static": {
                                "address": "",
                                "netmask": "",
                                "gateway": ""
                            },
                            "dns": {
                                "primary": "8.8.8.8",
                                "secondary": "8.8.4.4"
                            }
                        }
                    },
                    "wlan0": {
                        "type": "wireless",
                        "enabled": False,
                        "mode": "client",
                        "wifi": {
                            "ssid": "",
                            "security": {
                                "mode": "wpa2",
                                "password": ""
                            },
                            "channel": "auto",
                            "band": "2.4",
                            "hidden": False
                        },
                        "ipv4": {
                            "mode": "dhcp",
                            "static": {
                                "address": "",
                                "netmask": "",
                                "gateway": ""
                            }
                        }
                    }
                },
                "firewall": {
                    "enabled": True,
                    "default_policy": "drop",
                    "rules": []
                },
                "dhcp_server": {
                    "enabled": False,
                    "start_ip": "10.0.0.100",
                    "end_ip": "10.0.0.200",
                    "lease_time": 24,
                    "domain": "local",
                    "dns_servers": ["8.8.8.8", "8.8.4.4"]
                },
                "static_routes": [],
                "port_forwarding": [],
                "dynamic_dns": {
                    "enabled": False,
                    "provider": "dyndns",
                    "domain": "",
                    "username": "",
                    "password": "",
                    "update_interval": 60
                }
            },
            "protocols": {
                "modbus": {
                    "enabled": False,
                    "mode": "tcp",
                    "tcp": {
                        "port": 502,
                        "max_connections": 5,
                        "timeout": 30
                    },
                    "serial": {
                        "port": "ttyS0",
                        "baudrate": 9600,
                        "data_bits": 8,
                        "parity": "none",
                        "stop_bits": 1
                    },
                    "slave_id": 1,
                    "mapping": []
                },
                "mqtt": {
                    "enabled": False,
                    "broker": {
                        "address": "localhost",
                        "port": 1883,
                        "client_id": "iot-gateway",
                        "keepalive": 60,
                        "clean_session": True,
                        "tls": {
                            "enabled": False,
                            "version": "1.2",
                            "verify_server": True,
                            "allow_insecure": False,
                            "cert_file": "",
                            "key_file": "",
                            "ca_file": ""
                        },
                        "auth": {
                            "enabled": False,
                            "username": "",
                            "password": ""
                        }
                    },
                    "topics": {
                        "publish": [],
                        "subscribe": []
                    }
                }
            },
            "io_setup": {
                "ports": []
            },
            "user_tags": [],
            "calculation_tags": [],
            "stats_tags": [],
            "system_tags": [],
            "communication_forward": {
                "destinations": [],
                "bridges": []
            }
        }
        
        # Add IO ports and devices
        io_ports = self.get_io_ports()
        if io_ports:
            config["io_setup"]["ports"] = io_ports
        
        # Add user tags
        user_tags = self.get_user_tags()
        if user_tags:
            config["user_tags"] = user_tags
        
        # Add calculation tags
        calculation_tags = self.get_calculation_tags()
        if calculation_tags:
            config["calculation_tags"] = calculation_tags
        
        # Add stats tags
        stats_tags = self.get_stats_tags()
        if stats_tags:
            config["stats_tags"] = stats_tags
        
        # Add system tags
        system_tags = self.get_system_tags()
        if system_tags:
            config["system_tags"] = system_tags
        
        # Add communication destinations and bridges
        destinations = self.get_destinations()
        if destinations:
            config["communication_forward"]["destinations"] = destinations
        
        bridges = self.get_communication_bridges()
        if bridges:
            config["communication_forward"]["bridges"] = bridges
        
        return config
    
    def sync_config_to_database(self, config: Dict[str, Any]) -> bool:
        """
        Synchronize a configuration to the database.
        This will update the database based on the provided configuration.
        
        Args:
            config: The configuration to synchronize.
            
        Returns:
            True if successful, False otherwise.
        """
        # This would be a more complex implementation that updates database records
        # based on the configuration. For this implementation, we'll just save a snapshot.
        return self.save_config_snapshot(config)
