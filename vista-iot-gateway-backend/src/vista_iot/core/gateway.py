import logging
from typing import Dict, Any, Optional, List, Union
import os
import sys
import time
import asyncio
import yaml
from datetime import datetime
import json

from .config_manager import ConfigManager

logger = logging.getLogger(__name__)

class IoTGateway:
    """
    Main IoT Gateway class that manages the entire system.
    This is the central coordinator for all gateway functionality.
    """
    
    def __init__(self, config_path: Optional[str] = None, db_path: Optional[str] = None):
        """
        Initialize the IoT Gateway with the specified configuration.
        
        Args:
            config_path: Path to the user configuration file. If None, only default config is used.
            db_path: Path to the SQLite database file. If None, uses the default path.
        """
        self.config_path = config_path
        self.db_path = db_path
        self.config_manager = ConfigManager(config_path, db_path)
        self.modules = {}
        self.running = False
        self.start_time = None
        
        # Initialize system information
        self.system_info = {
            "uptime": 0,
            "cpu_usage": 0.0,
            "memory_usage": 0.0,
            "disk_usage": 0.0,
            "last_update": None
        }
        
        # Setup logging
        self._setup_logging()
        
        logger.info(f"IoT Gateway initialized with config: {config_path}")
    
    def _setup_logging(self):
        """Configure logging based on configuration settings"""
        log_config = self.config_manager.get_value("logging", {})
        
        log_level = getattr(logging, log_config.get("level", "INFO").upper())
        log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        
        # Configure root logger
        logging.basicConfig(
            level=log_level,
            format=log_format,
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler("gateway.log")
            ]
        )
        
        # TODO: Add remote syslog if enabled in config
        if log_config.get("remote_syslog", {}).get("enabled", False):
            # Add remote syslog handler here
            pass
    
    async def start(self):
        """
        Start the IoT Gateway and all its modules.
        This is an asynchronous method to allow for concurrent operation of modules.
        """
        if self.running:
            logger.warning("Gateway is already running")
            return
        
        logger.info("Starting IoT Gateway")
        self.running = True
        self.start_time = time.time()
        
        # Validate configuration
        validation_result = self.config_manager.validate_config()
        if not validation_result.get("valid", False):
            logger.error(f"Configuration validation failed: {validation_result.get('errors', [])}")
            # Continue anyway, but log the errors
        # Validate hardware
        self.validate_hardware()
        
        try:
            # Initialize and start all required modules based on configuration
            await self._initialize_modules()
            
            # Start the main gateway loop
            await self._main_loop()
            
        except Exception as e:
            logger.error(f"Error starting gateway: {e}", exc_info=True)
            self.running = False
            raise
    
    async def stop(self):
        """
        Stop the IoT Gateway and all its modules gracefully.
        """
        if not self.running:
            logger.warning("Gateway is not running")
            return
        
        logger.info("Stopping IoT Gateway")
        self.running = False
        
        # Stop all modules in reverse order of initialization
        for module_name, module in reversed(list(self.modules.items())):
            try:
                logger.info(f"Stopping module: {module_name}")
                if hasattr(module, 'stop') and callable(module.stop):
                    if asyncio.iscoroutinefunction(module.stop):
                        await module.stop()
                    else:
                        module.stop()
            except Exception as e:
                logger.error(f"Error stopping module {module_name}: {e}", exc_info=True)
        
        self.modules = {}
        logger.info("IoT Gateway stopped")
    
    async def _initialize_modules(self):
        """
        Initialize all modules based on the configuration.
        Modules are loaded dynamically based on what's enabled in the config.
        """
        # Load protocol modules
        await self._initialize_protocol_modules()
        
        # Load hardware modules
        await self._initialize_hardware_modules()
        
        # Load IO modules
        await self._initialize_io_modules()
        
        # Load communication modules
        await self._initialize_communication_modules()
        
        logger.info(f"Initialized {len(self.modules)} modules")
    
    async def _initialize_protocol_modules(self):
        """Initialize protocol modules based on configuration"""
        protocols_config = self.config_manager.get_value("protocols", {})
        
        # Initialize Modbus if enabled
        if protocols_config.get("modbus", {}).get("enabled", False):
            try:
                # This would be replaced with actual module import and initialization
                from ..protocols import modbus
                modbus_module = modbus.ModbusManager(self.config_manager)
                await modbus_module.initialize()
                self.modules["modbus"] = modbus_module
                logger.info("Modbus module initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Modbus module: {e}", exc_info=True)
        
        # Initialize MQTT if enabled
        if protocols_config.get("mqtt", {}).get("enabled", False):
            try:
                # This would be replaced with actual module import and initialization
                from ..protocols import mqtt
                mqtt_module = mqtt.MQTTManager(self.config_manager)
                await mqtt_module.initialize()
                self.modules["mqtt"] = mqtt_module
                logger.info("MQTT module initialized")
            except Exception as e:
                logger.error(f"Failed to initialize MQTT module: {e}", exc_info=True)
    
    async def _initialize_hardware_modules(self):
        """Initialize hardware modules based on configuration"""
        hardware_config = self.config_manager.get_value("hardware", {})
        
        # Initialize serial ports
        if hardware_config.get("com_ports"):
            try:
                # This would be replaced with actual module import and initialization
                from ..hardware import serial
                serial_module = serial.SerialManager(self.config_manager)
                await serial_module.initialize()
                self.modules["serial"] = serial_module
                logger.info("Serial module initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Serial module: {e}", exc_info=True)
        
        # Initialize GPIO if configured
        if hardware_config.get("gpio", {}).get("inputs") or hardware_config.get("gpio", {}).get("outputs"):
            try:
                # This would be replaced with actual module import and initialization
                from ..hardware import gpio
                gpio_module = gpio.GPIOManager(self.config_manager)
                await gpio_module.initialize()
                self.modules["gpio"] = gpio_module
                logger.info("GPIO module initialized")
            except Exception as e:
                logger.error(f"Failed to initialize GPIO module: {e}", exc_info=True)
        
        # Initialize watchdog if enabled
        if hardware_config.get("watchdog", {}).get("enabled", False):
            try:
                # This would be replaced with actual module import and initialization
                from ..hardware import watchdog
                watchdog_module = watchdog.WatchdogManager(self.config_manager)
                await watchdog_module.initialize()
                self.modules["watchdog"] = watchdog_module
                logger.info("Watchdog module initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Watchdog module: {e}", exc_info=True)
    
    async def _initialize_io_modules(self):
        """Initialize IO modules based on configuration"""
        io_setup = self.config_manager.get_value("io_setup", {})
        
        if io_setup.get("ports"):
            try:
                # This would be replaced with actual module import and initialization
                from ..io import io_manager
                io_module = io_manager.IOManager(self.config_manager)
                await io_module.initialize()
                self.modules["io"] = io_module
                logger.info("IO module initialized")
            except Exception as e:
                logger.error(f"Failed to initialize IO module: {e}", exc_info=True)
    
    async def _initialize_communication_modules(self):
        """Initialize communication modules based on configuration"""
        comm_config = self.config_manager.get_value("communication_forward", {})
        
        if comm_config.get("destinations") and comm_config.get("bridges"):
            try:
                # This would be replaced with actual module import and initialization
                from ..communication import comm_manager
                comm_module = comm_manager.CommunicationManager(self.config_manager)
                await comm_module.initialize()
                self.modules["communication"] = comm_module
                logger.info("Communication module initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Communication module: {e}", exc_info=True)
    
    async def _main_loop(self):
        """
        Main gateway event loop.
        This runs until the gateway is stopped and coordinates all module activities.
        """
        logger.info("Starting main gateway loop")
        
        update_interval = 1.0  # 1 second update interval
        last_system_update = 0.0
        
        try:
            while self.running:
                current_time = time.time()
                
                # Update system information every 5 seconds
                if current_time - last_system_update >= 5.0:
                    self._update_system_info()
                    last_system_update = current_time
                
                # TODO: Implement other periodic tasks
                
                # Sleep for a short time to prevent CPU hogging
                await asyncio.sleep(update_interval)
                
        except asyncio.CancelledError:
            logger.info("Main gateway loop cancelled")
            self.running = False
        except Exception as e:
            logger.error(f"Error in main gateway loop: {e}", exc_info=True)
            self.running = False
            raise
    
    def _update_system_info(self):
        """Update system information metrics"""
        try:
            self.system_info["uptime"] = time.time() - self.start_time
            
            # TODO: Implement actual system metrics collection
            # This would involve platform-specific code to gather CPU, memory, disk usage
            
            self.system_info["last_update"] = datetime.now().isoformat()
            
            # Update system tags if they're defined
            system_tags = self.config_manager.get_value("system_tags", [])
            if system_tags and "io" in self.modules:
                for tag in system_tags:
                    if tag["name"] == "#SYS_UPTIME":
                        # Update the uptime tag with current value
                        self.modules["io"].update_tag_value(tag["id"], self.system_info["uptime"])
                    # Similar updates for other system tags
            
        except Exception as e:
            logger.error(f"Error updating system info: {e}", exc_info=True)
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get the current status of the gateway.
        
        Returns:
            Dictionary with gateway status information.
        """
        return {
            "running": self.running,
            "uptime": self.system_info["uptime"],
            "system": self.system_info,
            "modules": {name: "running" if module and getattr(module, "is_running", False) else "stopped"
                      for name, module in self.modules.items()},
            "last_update": datetime.now().isoformat()
        }

    def get_config(self) -> Dict[str, Any]:
        """
        Get the current configuration.
        
        Returns:
            The complete configuration dictionary.
        """
        return self.config_manager.get_config()
    
    def update_config(self, config_updates: Dict[str, Any], save: bool = True) -> bool:
        """
        Update the gateway configuration with the provided updates.
        
        Args:
            config_updates: Dictionary with configuration updates
            save: Whether to save the configuration to disk
            
        Returns:
            True if successful, False otherwise
        """
        # Apply updates to config
        for path, value in _flatten_dict(config_updates).items():
            self.config_manager.set_value(path, value)
        
        # Save if requested
        if save:
            return self.config_manager.save_config()
        return True
    
    async def restart(self):
        """
        Restart the gateway by stopping and starting all modules, and reload config from DB.
        """
        logger.info("Restarting gateway")
        await self.stop()
        # Reload config from DB
        self.config_manager.load_config()
        logger.debug(f"Config after restart: {json.dumps(self.config_manager.get_config(), indent=2)}")
        # Validate hardware after reload
        self.validate_hardware()
        await self.start()
        logger.info("Gateway restarted")

    def validate_hardware(self):
        """
        Validate that all hardware requirements in the config are available on the system.
        Logs verbose success or error messages for each requirement.
        """
        logger.info("Validating hardware requirements from config...")
        # --- Serial Ports ---
        serial_ports = set()
        io_ports = self.config_manager.get_value("io_setup.ports", [])
        for port in io_ports:
            serial_settings = port.get("serialSettings", {})
            port_name = serial_settings.get("port") or port.get("name")
            if port_name:
                serial_ports.add(port_name)
        import platform
        import os
        import glob
        if platform.system() == "Linux":
            available_ports = set(os.path.basename(p) for p in glob.glob("/dev/ttyS*"))
            available_ports.update(os.path.basename(p) for p in glob.glob("/dev/ttyUSB*"))
        elif platform.system() == "Windows":
            # On Windows, COM ports are named COM1, COM2, etc.
            available_ports = set(f"COM{i}" for i in range(1, 33))
        else:
            available_ports = set()
        for port in serial_ports:
            if port in available_ports:
                logger.info(f"[HARDWARE OK] Serial port '{port}' is available.")
            else:
                logger.error(f"[HARDWARE ERROR] Serial port '{port}' is NOT available on this system.")
        # --- Network Interfaces ---
        net_ifaces = self.config_manager.get_value("network.interfaces", {})
        ifaces_needed = set(net_ifaces.keys())
        if platform.system() == "Linux":
            sys_ifaces = set(os.listdir("/sys/class/net"))
        elif platform.system() == "Windows":
            import psutil
            sys_ifaces = set(psutil.net_if_addrs().keys())
        else:
            sys_ifaces = set()
        for iface in ifaces_needed:
            if iface in sys_ifaces:
                logger.info(f"[HARDWARE OK] Network interface '{iface}' is available.")
            else:
                logger.error(f"[HARDWARE ERROR] Network interface '{iface}' is NOT available on this system.")
        # --- GPIO ---
        gpio_needed = self.config_manager.get_value("hardware.gpio", {})
        if gpio_needed.get("inputs") or gpio_needed.get("outputs"):
            if os.path.exists("/sys/class/gpio"):
                logger.info("[HARDWARE OK] GPIO interface is available.")
            else:
                logger.error("[HARDWARE ERROR] GPIO interface is NOT available on this system.")
        logger.info("Hardware validation complete.")


def _flatten_dict(d: Dict[str, Any], parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
    """
    Flatten a nested dictionary into dot notation.
    
    Args:
        d: The dictionary to flatten
        parent_key: The parent key to prepend
        sep: The separator to use between keys
        
    Returns:
        A flattened dictionary
    """
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(_flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)
