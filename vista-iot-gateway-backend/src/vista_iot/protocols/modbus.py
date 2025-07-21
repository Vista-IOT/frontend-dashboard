"""
Modbus protocol implementation for the Vista IoT Gateway.
Supports Modbus RTU and Modbus TCP.
"""
import asyncio
import logging
from typing import Dict, Any, Optional, List, Union
import time
import threading
import struct
from ..database.db_connector import DBConnector
try:
    from pymodbus.server.async_io import StartTcpServer
    from pymodbus.datastore import ModbusSequentialDataBlock, ModbusSlaveContext, ModbusServerContext
    from pymodbus.client import ModbusTcpClient
except ImportError:
    StartTcpServer = None
    ModbusSequentialDataBlock = None
    ModbusSlaveContext = None
    ModbusServerContext = None
    ModbusTcpClient = None

logger = logging.getLogger(__name__)

class ModbusManager:
    """
    Manages Modbus protocol communications, including TCP and RTU modes.
    """
    
    def __init__(self, config_manager, vmm=None):
        """
        Initialize the Modbus Manager.
        
        Args:
            config_manager: The configuration manager instance
            vmm: Optional reference to the in-memory Virtual Memory Map
        """
        self.config_manager = config_manager
        self.config = {}
        self.is_running = False
        self.clients = {}
        self.servers = {}
        self.registers = {
            "coils": {},           # 0xxxxx range
            "discrete_inputs": {}, # 1xxxxx range
            "holding": {},         # 4xxxxx range
            "input": {}            # 3xxxxx range
        }
        self.callbacks = {}
        self.vmm = vmm
        
        logger.info("ModbusManager initialized")
    
    async def initialize(self):
        """
        Initialize the Modbus protocol handler based on configuration.
        """
        logger.info("Initializing Modbus Manager")
        
        # Get Modbus configuration
        self.config = self.config_manager.get_value("protocols.modbus", {})
        
        if not self.config.get("enabled", False):
            logger.info("Modbus is disabled in configuration, not starting")
            return
        
        # Initialize register maps
        await self._initialize_register_maps()
        
        # Initialize server or client based on mode
        mode = self.config.get("mode", "tcp")
        
        if mode == "tcp":
            await self._initialize_tcp_server()
            # Also start slave server to expose VMM
            await self.start_slave_server()
        elif mode in ["rtu", "ascii"]:
            await self._initialize_serial_client()
        else:
            logger.error(f"Unsupported Modbus mode: {mode}")
            return
        
        self.is_running = True
        
        # Start the device polling task
        asyncio.create_task(self.poll_devices())
        
        logger.info(f"Modbus Manager initialized in {mode} mode")
    
    async def _initialize_register_maps(self):
        """Initialize Modbus register maps from configuration."""
        mappings = self.config.get("mapping", [])
        
        for mapping in mappings:
            register_address = mapping.get("register")
            register_type = mapping.get("type")
            
            # Convert register address to the correct format
            if register_type == "coil":
                # Coils use 0xxxxx addresses
                register_key = register_address
                register_dict = self.registers["coils"]
            elif register_type == "discrete_input":
                # Discrete inputs use 1xxxxx addresses
                register_key = register_address
                register_dict = self.registers["discrete_inputs"]
            elif register_type == "holding":
                # Holding registers use 4xxxxx addresses
                register_key = register_address
                register_dict = self.registers["holding"]
            elif register_type == "input":
                # Input registers use 3xxxxx addresses
                register_key = register_address
                register_dict = self.registers["input"]
            else:
                logger.warning(f"Unknown register type: {register_type}")
                continue
            
            # Initialize register with default value (0)
            register_dict[register_key] = 0
            
            logger.debug(f"Initialized register {register_type}:{register_key}")
    
    async def _initialize_tcp_server(self):
        """Initialize Modbus TCP server."""
        tcp_config = self.config.get("tcp", {})
        port = tcp_config.get("port", 502)
        max_connections = tcp_config.get("max_connections", 5)
        
        try:
            # In a real implementation, this would use a library like pymodbus
            # to set up a real Modbus TCP server
            logger.info(f"Starting Modbus TCP server on port {port}")
            
            # Placeholder for actual server implementation
            self.servers["tcp"] = {
                "port": port,
                "max_connections": max_connections,
                "running": True
            }
            
        except Exception as e:
            logger.error(f"Failed to start Modbus TCP server: {e}", exc_info=True)
    
    async def _initialize_serial_client(self):
        """Initialize Modbus RTU/ASCII serial client."""
        serial_config = self.config.get("serial", {})
        port = serial_config.get("port", "ttyS0")
        baudrate = serial_config.get("baudrate", 9600)
        data_bits = serial_config.get("data_bits", 8)
        parity = serial_config.get("parity", "none")
        stop_bits = serial_config.get("stop_bits", 1)
        
        try:
            # In a real implementation, this would use a library like pymodbus
            # to set up a real Modbus serial client
            logger.info(f"Starting Modbus Serial client on port {port}")
            
            # Placeholder for actual client implementation
            self.clients["serial"] = {
                "port": port,
                "baudrate": baudrate,
                "data_bits": data_bits,
                "parity": parity,
                "stop_bits": stop_bits,
                "running": True
            }
            
        except Exception as e:
            logger.error(f"Failed to start Modbus Serial client: {e}", exc_info=True)
    
    async def stop(self):
        """
        Stop all Modbus communication gracefully.
        """
        logger.info("Stopping Modbus Manager")
        
        # Stop TCP servers
        for server_name, server in self.servers.items():
            try:
                # In a real implementation, this would properly shut down the server
                logger.info(f"Stopping Modbus {server_name} server")
                server["running"] = False
            except Exception as e:
                logger.error(f"Error stopping Modbus {server_name} server: {e}")
        
        # Stop serial clients
        for client_name, client in self.clients.items():
            try:
                # In a real implementation, this would properly close the connection
                logger.info(f"Stopping Modbus {client_name} client")
                client["running"] = False
            except Exception as e:
                logger.error(f"Error stopping Modbus {client_name} client: {e}")
        
        self.is_running = False
        logger.info("Modbus Manager stopped")
    
    def read_register(self, register_type: str, address: int) -> Union[int, bool, None]:
        """
        Read a value from a Modbus register.
        
        Args:
            register_type: The register type ('coil', 'discrete_input', 'holding', 'input')
            address: The register address
            
        Returns:
            The register value, or None if not found
        """
        if not self.is_running:
            logger.warning("Cannot read register: Modbus Manager is not running")
            return None
        
        # Map register type to internal register dict
        if register_type == "coil":
            register_dict = self.registers["coils"]
        elif register_type == "discrete_input":
            register_dict = self.registers["discrete_inputs"]
        elif register_type == "holding":
            register_dict = self.registers["holding"]
        elif register_type == "input":
            register_dict = self.registers["input"]
        else:
            logger.warning(f"Unknown register type: {register_type}")
            return None
        
        # Return register value if it exists
        if address in register_dict:
            return register_dict[address]
        else:
            logger.warning(f"Register {register_type}:{address} not found")
            return None
    
    def write_register(self, register_type: str, address: int, value: Union[int, bool]) -> bool:
        """
        Write a value to a Modbus register.
        
        Args:
            register_type: The register type ('coil', 'holding')
            address: The register address
            value: The value to write
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_running:
            logger.warning("Cannot write register: Modbus Manager is not running")
            return False
        
        # Only coils and holding registers are writable
        if register_type == "coil":
            register_dict = self.registers["coils"]
            # Convert value to boolean for coils
            value = bool(value)
        elif register_type == "holding":
            register_dict = self.registers["holding"]
            # Ensure value is an integer for holding registers
            value = int(value)
        else:
            logger.warning(f"Cannot write to register type: {register_type}")
            return False
        
        # Write to register
        register_dict[address] = value
        
        # Call any callbacks registered for this register
        self._handle_register_callbacks(register_type, address, value)
        
        logger.debug(f"Wrote value {value} to register {register_type}:{address}")
        return True
    
    def register_callback(self, register_type: str, address: int, callback):
        """
        Register a callback function for changes to a specific register.
        
        Args:
            register_type: The register type
            address: The register address
            callback: The callback function to call when the register changes
        """
        key = f"{register_type}:{address}"
        if key not in self.callbacks:
            self.callbacks[key] = []
        
        self.callbacks[key].append(callback)
        logger.debug(f"Registered callback for register {key}")
    
    def _handle_register_callbacks(self, register_type: str, address: int, value: Any):
        """
        Call registered callbacks for a register change.
        
        Args:
            register_type: The register type
            address: The register address
            value: The new register value
        """
        key = f"{register_type}:{address}"
        if key in self.callbacks:
            for callback in self.callbacks[key]:
                try:
                    callback(value)
                except Exception as e:
                    logger.error(f"Error in callback for register {key}: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get the current status of the Modbus Manager.
        
        Returns:
            Dictionary with status information
        """
        return {
            "running": self.is_running,
            "mode": self.config.get("mode", "tcp"),
            "servers": self.servers,
            "clients": self.clients,
            "register_counts": {
                "coils": len(self.registers["coils"]),
                "discrete_inputs": len(self.registers["discrete_inputs"]),
                "holding": len(self.registers["holding"]),
                "input": len(self.registers["input"])
            }
        }

    async def start_slave_server(self):
        """
        Start a Modbus TCP slave/server that exposes the VirtualMemoryMap from in-memory data.
        """
        if StartTcpServer is None:
            logger.error("pymodbus is not installed. Modbus slave server cannot be started.")
            return
        logger.info("Starting Modbus TCP slave server for VirtualMemoryMap")
        # Get unit id from system tag
        system_tags = self.config_manager.get_value("system_tags", [])
        unit_id = 1
        for st in system_tags:
            if st.get("name") == "#SYS_UNIT_ID":
                try:
                    unit_id = int(st.get("defaultValue", 1))
                except Exception:
                    unit_id = 1
        # Build register blocks from in-memory VMM
        holding = {}
        vmm = self.vmm.values() if self.vmm else []
        for entry in vmm:
            try:
                addr = int(entry["address"])
                val = int(float(entry["value"]))
                holding[addr] = val
            except Exception:
                continue
        # Create Modbus data store
        block = ModbusSequentialDataBlock(0, [holding.get(i, 0) for i in range(max(holding.keys() or [0]) + 1)])
        store = ModbusSlaveContext(hr=block, zero_mode=True)
        context = ModbusServerContext(slaves={unit_id: store}, single=False)
        # Run server in a thread to avoid blocking
        def run_server():
            StartTcpServer(context, address=("0.0.0.0", self.config.get("tcp", {}).get("port", 502)))
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        logger.info(f"Modbus TCP slave server started on port {self.config.get('tcp', {}).get('port', 502)} for VMM")
    
    async def poll_devices(self):
        """
        Continuously poll configured Modbus devices and update VMM.
        """
        if not self.is_running:
            return
            
        logger.info("Starting Modbus device polling")
        
        while self.is_running:
            try:
                # Get IO setup configuration
                io_ports = self.config_manager.get_value("io_setup.ports", [])
                
                for port in io_ports:
                    if not port.get("enabled", True):
                        continue
                        
                    for device in port.get("devices", []):
                        if not device.get("enabled", True) or device.get("deviceType") != "Modbus TCP":
                            continue
                            
                        # Connect to device
                        ip_address = device.get("ipAddress", "10.0.0.1")
                        port_number = device.get("portNumber", 502)
                        unit_id = device.get("unitNumber", 180)
                        
                        if ModbusTcpClient is not None:
                            client = ModbusTcpClient(ip_address, port=port_number)
                            
                            if client.connect():
                                logger.debug(f"Connected to Modbus device {device.get('name')} at {ip_address}:{port_number}")
                                
                                # Read all tags for this device
                                for tag in device.get("tags", []):
                                    try:
                                        await self._read_tag(client, tag, unit_id)
                                    except Exception as e:
                                        logger.error(f"Error reading tag {tag.get('name')}: {e}")
                                
                                client.close()
                            else:
                                logger.warning(f"Failed to connect to Modbus device at {ip_address}:{port_number}")
                        else:
                            logger.warning("pymodbus not available, cannot poll devices")
                
                # Wait before next poll cycle
                await asyncio.sleep(1.0)  # Poll every second
                
            except Exception as e:
                logger.error(f"Error in device polling loop: {e}")
                await asyncio.sleep(5.0)  # Wait longer on error
    
    async def _read_tag(self, client, tag, unit_id):
        """
        Read a single tag from a Modbus device and update VMM.
        """
        tag_name = tag.get("name")
        address = int(tag.get("address", 0))
        register_type = tag.get("registerType", "Coil").lower()
        
        try:
            if register_type == "coil":
                result = client.read_coils(address=address, count=1, slave=unit_id)
                if not result.isError():
                    value = result.bits[0]
                    # Update VMM
                    if self.vmm is not None:
                        self.vmm[str(address)] = {
                            "address": str(address),
                            "value": value,
                            "dataType": "Digital",
                            "unitId": unit_id,
                            "updatedAt": time.time()
                        }
                    logger.debug(f"Read coil {tag_name} at address {address}: {value}")
                
            elif register_type == "holding":
                # Read as 32-bit float (2 registers)
                result = client.read_holding_registers(address=address, count=2, slave=unit_id)
                if not result.isError():
                    registers = result.registers
                    # Convert to float
                    value = self._convert_registers_to_float(registers[0], registers[1])
                    
                    # Update VMM
                    if self.vmm is not None:
                        self.vmm[str(address)] = {
                            "address": str(address),
                            "value": value,
                            "dataType": "Analog",
                            "unitId": unit_id,
                            "updatedAt": time.time()
                        }
                    logger.debug(f"Read holding register {tag_name} at address {address}: {value}")
                
        except Exception as e:
            logger.error(f"Error reading tag {tag_name}: {e}")
    
    def _convert_registers_to_float(self, high_reg, low_reg):
        """
        Convert two 16-bit registers to a 32-bit float.
        """
        try:
            packed = struct.pack('>HH', high_reg, low_reg)
            return struct.unpack('>f', packed)[0]
        except Exception as e:
            logger.error(f"Error converting registers to float: {e}")
            return 0.0
