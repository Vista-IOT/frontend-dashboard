"""
IO Manager module for the Vista IoT Gateway.
This module manages all IO ports, devices, and tags.
"""
import logging
import asyncio
from typing import Dict, Any, List, Optional, Union
import time
from datetime import datetime

logger = logging.getLogger(__name__)

class IOManager:
    """
    IO Manager class that handles all IO operations.
    This includes managing IO ports, devices, and tags.
    """
    
    def __init__(self, config_manager):
        """
        Initialize the IO Manager with the configuration manager.
        
        Args:
            config_manager: The configuration manager instance
        """
        self.config_manager = config_manager
        self.is_running = False
        self.ports = {}
        self.devices = {}
        self.tags = {}
        self.tag_values = {}
        self.tag_quality = {}
        self.tag_timestamps = {}
        self.scan_tasks = {}
        self.tag_callbacks = {}
        
        logger.info("IO Manager initialized")
    
    async def initialize(self):
        """
        Initialize the IO Manager with the current configuration.
        This includes setting up IO ports, devices, and tags.
        """
        logger.info("Initializing IO Manager")
        
        # Get IO ports configuration
        io_ports = self.config_manager.get_value("io_setup.ports", [])
        
        if not io_ports:
            # Try to get IO ports directly from database
            io_ports = self.config_manager.get_io_ports()
            if not io_ports:
                logger.warning("No IO ports found in configuration")
        
        # Initialize IO ports
        for port_config in io_ports:
            try:
                port_id = port_config.get("id")
                if not port_id:
                    continue
                
                # Create a port instance
                port = IOPort(port_id, port_config, self)
                self.ports[port_id] = port
                
                # Initialize devices for this port
                for device_config in port_config.get("devices", []):
                    device_id = device_config.get("id")
                    if not device_id:
                        continue
                    
                    # Create a device instance
                    device = IODevice(device_id, device_config, port)
                    self.devices[device_id] = device
                    
                    # Initialize tags for this device
                    for tag_config in device_config.get("tags", []):
                        tag_id = tag_config.get("id")
                        if not tag_id:
                            continue
                        
                        # Create a tag instance
                        tag = IOTag(tag_id, tag_config, device)
                        self.tags[tag_id] = tag
                        
                        # Initialize tag value, quality, and timestamp
                        default_value = tag_config.get("defaultValue", 0)
                        self.tag_values[tag_id] = default_value
                        self.tag_quality[tag_id] = "Good"
                        self.tag_timestamps[tag_id] = datetime.now().isoformat()
            except Exception as e:
                logger.error(f"Error initializing IO port {port_config.get('name', 'unknown')}: {e}")
        
        # Initialize user tags
        user_tags = self.config_manager.get_value("user_tags", [])
        if not user_tags:
            # Try to get user tags directly from database
            user_tags = self.config_manager.get_user_tags()
        
        for tag_config in user_tags:
            tag_id = tag_config.get("id")
            if not tag_id:
                continue
            
            # Create a user tag instance
            tag = UserTag(tag_id, tag_config)
            self.tags[tag_id] = tag
            
            # Initialize tag value, quality, and timestamp
            default_value = tag_config.get("defaultValue", 0)
            self.tag_values[tag_id] = default_value
            self.tag_quality[tag_id] = "Good"
            self.tag_timestamps[tag_id] = datetime.now().isoformat()
        
        # Initialize calculation tags
        calc_tags = self.config_manager.get_value("calculation_tags", [])
        if not calc_tags:
            # Try to get calculation tags directly from database
            calc_tags = self.config_manager.get_calculation_tags()
        
        for tag_config in calc_tags:
            tag_id = tag_config.get("id")
            if not tag_id:
                continue
            
            # Create a calculation tag instance
            tag = CalculationTag(tag_id, tag_config, self)
            self.tags[tag_id] = tag
            
            # Initialize tag value, quality, and timestamp
            default_value = tag_config.get("defaultValue", 0)
            self.tag_values[tag_id] = default_value
            self.tag_quality[tag_id] = "Good"
            self.tag_timestamps[tag_id] = datetime.now().isoformat()
        
        # Initialize statistics tags
        stats_tags = self.config_manager.get_value("stats_tags", [])
        if not stats_tags:
            # Try to get statistics tags directly from database
            stats_tags = self.config_manager.get_stats_tags()
        
        for tag_config in stats_tags:
            tag_id = tag_config.get("id")
            if not tag_id:
                continue
            
            # Create a statistics tag instance
            tag = StatsTag(tag_id, tag_config, self)
            self.tags[tag_id] = tag
            
            # Initialize tag value, quality, and timestamp
            self.tag_values[tag_id] = 0
            self.tag_quality[tag_id] = "Good"
            self.tag_timestamps[tag_id] = datetime.now().isoformat()
        
        # Initialize system tags
        system_tags = self.config_manager.get_value("system_tags", [])
        if not system_tags:
            # Try to get system tags directly from database
            system_tags = self.config_manager.get_system_tags()
        
        for tag_config in system_tags:
            tag_id = tag_config.get("id")
            if not tag_id:
                continue
            
            # Create a system tag instance
            tag = SystemTag(tag_id, tag_config)
            self.tags[tag_id] = tag
            
            # Initialize tag value, quality, and timestamp
            self.tag_values[tag_id] = 0
            self.tag_quality[tag_id] = "Good"
            self.tag_timestamps[tag_id] = datetime.now().isoformat()
        
        # Start the IO Manager
        self.is_running = True
        
        # Start scanning for each port
        for port_id, port in self.ports.items():
            if port.enabled:
                self.scan_tasks[port_id] = asyncio.create_task(self._scan_port(port))
        
        # Start updating calculation tags
        for tag_id, tag in self.tags.items():
            if isinstance(tag, CalculationTag):
                self.scan_tasks[f"calc_{tag_id}"] = asyncio.create_task(self._update_calculation_tag(tag))
            elif isinstance(tag, StatsTag):
                self.scan_tasks[f"stats_{tag_id}"] = asyncio.create_task(self._update_stats_tag(tag))
        
        logger.info(f"IO Manager initialized with {len(self.ports)} ports, {len(self.devices)} devices, and {len(self.tags)} tags")
    
    async def stop(self):
        """
        Stop the IO Manager and all its scanning tasks.
        """
        logger.info("Stopping IO Manager")
        self.is_running = False
        
        # Cancel all scanning tasks
        for task_id, task in self.scan_tasks.items():
            try:
                task.cancel()
                logger.debug(f"Cancelled scan task {task_id}")
            except Exception as e:
                logger.error(f"Error cancelling scan task {task_id}: {e}")
        
        # Clear all collections
        self.scan_tasks = {}
        self.ports = {}
        self.devices = {}
        self.tags = {}
        self.tag_values = {}
        self.tag_quality = {}
        self.tag_timestamps = {}
        self.tag_callbacks = {}
        
        logger.info("IO Manager stopped")
    
    async def _scan_port(self, port):
        """
        Scan a port for new data.
        
        Args:
            port: The port to scan
        """
        logger.info(f"Starting scan task for port {port.id}")
        
        scan_interval = port.scan_time / 1000.0  # Convert to seconds
        
        while self.is_running and port.enabled:
            try:
                # Scan all devices on this port
                for device_id, device in self.devices.items():
                    if device.port_id == port.id and device.enabled:
                        await self._scan_device(device)
                
                # Sleep until next scan
                await asyncio.sleep(scan_interval)
            except asyncio.CancelledError:
                logger.info(f"Scan task for port {port.id} cancelled")
                break
            except Exception as e:
                logger.error(f"Error scanning port {port.id}: {e}")
                await asyncio.sleep(1)  # Sleep before retry
    
    async def _scan_device(self, device):
        """
        Scan a device for new data.
        
        Args:
            device: The device to scan
        """
        try:
            # In a real implementation, this would communicate with the actual device
            # For now, we'll just simulate reading from the device
            for tag_id, tag in self.tags.items():
                if isinstance(tag, IOTag) and tag.device_id == device.id:
                    # Simulate reading a value (in a real system, this would be a real read)
                    # For now, we'll just keep the current value
                    current_value = self.tag_values.get(tag_id, 0)
                    
                    # Update tag value, quality, and timestamp
                    self.tag_values[tag_id] = current_value
                    self.tag_quality[tag_id] = "Good"
                    self.tag_timestamps[tag_id] = datetime.now().isoformat()
                    
                    # Trigger callbacks for this tag
                    if tag_id in self.tag_callbacks:
                        for callback in self.tag_callbacks[tag_id]:
                            try:
                                callback(tag_id, current_value, "Good")
                            except Exception as e:
                                logger.error(f"Error in callback for tag {tag_id}: {e}")
        except Exception as e:
            logger.error(f"Error scanning device {device.id}: {e}")
    
    async def _update_calculation_tag(self, tag):
        """
        Update a calculation tag based on its formula.
        
        Args:
            tag: The calculation tag to update
        """
        logger.info(f"Starting update task for calculation tag {tag.id}")
        
        update_interval = tag.period  # Seconds
        
        while self.is_running:
            try:
                # Calculate the tag value based on the formula
                value = await self._evaluate_formula(tag)
                
                # Update tag value, quality, and timestamp
                self.tag_values[tag.id] = value
                self.tag_quality[tag.id] = "Good"
                self.tag_timestamps[tag.id] = datetime.now().isoformat()
                
                # Trigger callbacks for this tag
                if tag.id in self.tag_callbacks:
                    for callback in self.tag_callbacks[tag.id]:
                        try:
                            callback(tag.id, value, "Good")
                        except Exception as e:
                            logger.error(f"Error in callback for tag {tag.id}: {e}")
                
                # Sleep until next update
                await asyncio.sleep(update_interval)
            except asyncio.CancelledError:
                logger.info(f"Update task for calculation tag {tag.id} cancelled")
                break
            except Exception as e:
                logger.error(f"Error updating calculation tag {tag.id}: {e}")
                await asyncio.sleep(1)  # Sleep before retry
    
    async def _update_stats_tag(self, tag):
        """
        Update a statistics tag based on its reference tag and type.
        
        Args:
            tag: The statistics tag to update
        """
        logger.info(f"Starting update task for statistics tag {tag.id}")
        
        # Calculate update interval in seconds
        if tag.update_cycle_unit == "sec":
            update_interval = tag.update_cycle_value
        elif tag.update_cycle_unit == "min":
            update_interval = tag.update_cycle_value * 60
        elif tag.update_cycle_unit == "hour":
            update_interval = tag.update_cycle_value * 3600
        elif tag.update_cycle_unit == "day":
            update_interval = tag.update_cycle_value * 86400
        else:
            update_interval = 60  # Default to 1 minute
        
        # History of values for this tag's reference
        history = []
        
        while self.is_running:
            try:
                # Get current value of reference tag
                reference_value = self.tag_values.get(tag.refer_tag_id, 0)
                
                # Add to history
                history.append(reference_value)
                
                # Limit history size based on update cycle
                max_history_size = 1000  # Arbitrary limit to prevent memory issues
                if len(history) > max_history_size:
                    history = history[-max_history_size:]
                
                # Calculate statistics based on type
                if tag.type == "Max" and history:
                    value = max(history)
                elif tag.type == "Min" and history:
                    value = min(history)
                elif tag.type == "Average" and history:
                    value = sum(history) / len(history)
                elif tag.type == "Sum" and history:
                    value = sum(history)
                else:
                    value = 0
                
                # Update tag value, quality, and timestamp
                self.tag_values[tag.id] = value
                self.tag_quality[tag.id] = "Good"
                self.tag_timestamps[tag.id] = datetime.now().isoformat()
                
                # Trigger callbacks for this tag
                if tag.id in self.tag_callbacks:
                    for callback in self.tag_callbacks[tag.id]:
                        try:
                            callback(tag.id, value, "Good")
                        except Exception as e:
                            logger.error(f"Error in callback for tag {tag.id}: {e}")
                
                # Sleep until next update
                await asyncio.sleep(update_interval)
            except asyncio.CancelledError:
                logger.info(f"Update task for statistics tag {tag.id} cancelled")
                break
            except Exception as e:
                logger.error(f"Error updating statistics tag {tag.id}: {e}")
                await asyncio.sleep(1)  # Sleep before retry
    
    async def _evaluate_formula(self, tag):
        """
        Evaluate a calculation tag's formula.
        
        Args:
            tag: The calculation tag to evaluate
            
        Returns:
            The calculated value
        """
        try:
            # Get values for operands
            a_value = self.tag_values.get(tag.a_tag_id, 0) if tag.a_tag_id else 0
            b_value = self.tag_values.get(tag.b_tag_id, 0) if tag.b_tag_id else 0
            c_value = self.tag_values.get(tag.c_tag_id, 0) if tag.c_tag_id else 0
            d_value = self.tag_values.get(tag.d_tag_id, 0) if tag.d_tag_id else 0
            e_value = self.tag_values.get(tag.e_tag_id, 0) if tag.e_tag_id else 0
            f_value = self.tag_values.get(tag.f_tag_id, 0) if tag.f_tag_id else 0
            g_value = self.tag_values.get(tag.g_tag_id, 0) if tag.g_tag_id else 0
            h_value = self.tag_values.get(tag.h_tag_id, 0) if tag.h_tag_id else 0
            
            # Create a safe evaluation context
            context = {
                "A": a_value, "a": a_value,
                "B": b_value, "b": b_value,
                "C": c_value, "c": c_value,
                "D": d_value, "d": d_value,
                "E": e_value, "e": e_value,
                "F": f_value, "f": f_value,
                "G": g_value, "g": g_value,
                "H": h_value, "h": h_value,
                "abs": abs, "max": max, "min": min, "pow": pow,
                "round": round, "sum": sum
            }
            
            # Special cases for common formulas
            formula = tag.formula.upper()
            if formula == "A+B":
                return a_value + b_value
            elif formula == "A-B":
                return a_value - b_value
            elif formula == "A*B":
                return a_value * b_value
            elif formula == "A/B":
                return a_value / b_value if b_value != 0 else 0
            elif formula == "(A+B)/2":
                return (a_value + b_value) / 2
            elif formula == "A+B+C":
                return a_value + b_value + c_value
            elif formula == "A+B+C+D":
                return a_value + b_value + c_value + d_value
            elif formula == "ABS(A)":
                return abs(a_value)
            elif formula == "MAX(A,B)":
                return max(a_value, b_value)
            elif formula == "MIN(A,B)":
                return min(a_value, b_value)
            
            # For more complex formulas, we would use a safer evaluation approach
            # This is a simplified implementation
            logger.warning(f"Complex formula not implemented: {tag.formula}")
            return 0
        except Exception as e:
            logger.error(f"Error evaluating formula for tag {tag.id}: {e}")
            return 0
    
    def get_tag(self, tag_id: str) -> Dict[str, Any]:
        """
        Get a tag by its ID.
        
        Args:
            tag_id: The tag ID to retrieve
            
        Returns:
            Dictionary with tag information, or None if not found
        """
        tag = self.tags.get(tag_id)
        if not tag:
            return None
        
        # Get tag value, quality, and timestamp
        value = self.tag_values.get(tag_id, 0)
        quality = self.tag_quality.get(tag_id, "Bad")
        timestamp = self.tag_timestamps.get(tag_id, datetime.now().isoformat())
        
        return {
            "id": tag_id,
            "name": tag.name,
            "value": value,
            "quality": quality,
            "timestamp": timestamp,
            "dataType": tag.data_type if hasattr(tag, "data_type") else "Analog",
            "readWrite": tag.read_write if hasattr(tag, "read_write") else "ReadOnly"
        }
    
    def get_all_tags(self) -> List[Dict[str, Any]]:
        """
        Get all tags with their current values.
        
        Returns:
            List of dictionaries with tag information
        """
        result = []
        
        for tag_id in self.tags:
            tag_info = self.get_tag(tag_id)
            if tag_info:
                result.append(tag_info)
        
        return result
    
    def update_tag_value(self, tag_id: str, value: Any) -> bool:
        """
        Update a tag's value.
        
        Args:
            tag_id: The tag ID to update
            value: The new value
            
        Returns:
            True if successful, False otherwise
        """
        if tag_id not in self.tags:
            logger.warning(f"Tag {tag_id} not found")
            return False
        
        tag = self.tags[tag_id]
        
        # Check if tag is writable
        if hasattr(tag, "read_write") and tag.read_write == "ReadOnly":
            logger.warning(f"Cannot write to read-only tag {tag_id}")
            return False
        
        # Update tag value, quality, and timestamp
        self.tag_values[tag_id] = value
        self.tag_quality[tag_id] = "Good"
        self.tag_timestamps[tag_id] = datetime.now().isoformat()
        
        # Trigger callbacks for this tag
        if tag_id in self.tag_callbacks:
            for callback in self.tag_callbacks[tag_id]:
                try:
                    callback(tag_id, value, "Good")
                except Exception as e:
                    logger.error(f"Error in callback for tag {tag_id}: {e}")
        
        logger.debug(f"Updated tag {tag_id} to value {value}")
        return True
    
    def register_tag_callback(self, tag_id: str, callback) -> bool:
        """
        Register a callback for a tag's value changes.
        
        Args:
            tag_id: The tag ID to register for
            callback: The callback function
            
        Returns:
            True if successful, False otherwise
        """
        if tag_id not in self.tags:
            logger.warning(f"Tag {tag_id} not found")
            return False
        
        if tag_id not in self.tag_callbacks:
            self.tag_callbacks[tag_id] = []
        
        self.tag_callbacks[tag_id].append(callback)
        logger.debug(f"Registered callback for tag {tag_id}")
        return True
    
    def unregister_tag_callback(self, tag_id: str, callback) -> bool:
        """
        Unregister a callback for a tag's value changes.
        
        Args:
            tag_id: The tag ID to unregister from
            callback: The callback function
            
        Returns:
            True if successful, False otherwise
        """
        if tag_id not in self.tag_callbacks:
            logger.warning(f"No callbacks registered for tag {tag_id}")
            return False
        
        if callback in self.tag_callbacks[tag_id]:
            self.tag_callbacks[tag_id].remove(callback)
            logger.debug(f"Unregistered callback for tag {tag_id}")
            return True
        
        logger.warning(f"Callback not found for tag {tag_id}")
        return False


class IOPort:
    """
    IO Port class that represents a physical or virtual IO port.
    """
    
    def __init__(self, port_id, config, manager):
        """
        Initialize the IO Port.
        
        Args:
            port_id: The port ID
            config: The port configuration
            manager: The IO Manager instance
        """
        self.id = port_id
        self.type = config.get("type", "")
        self.name = config.get("name", "")
        self.description = config.get("description", "")
        self.scan_time = config.get("scanTime", 1000)  # milliseconds
        self.time_out = config.get("timeOut", 3000)  # milliseconds
        self.retry_count = config.get("retryCount", 3)
        self.auto_recover_time = config.get("autoRecoverTime", 10)  # seconds
        self.scan_mode = config.get("scanMode", "serial")
        self.enabled = config.get("enabled", True)
        self.serial_settings = config.get("serialSettings", {})
        self.manager = manager


class IODevice:
    """
    IO Device class that represents a physical or virtual IO device.
    """
    
    def __init__(self, device_id, config, port):
        """
        Initialize the IO Device.
        
        Args:
            device_id: The device ID
            config: The device configuration
            port: The parent IO Port instance
        """
        self.id = device_id
        self.port_id = port.id
        self.enabled = config.get("enabled", True)
        self.name = config.get("name", "")
        self.device_type = config.get("deviceType", "")
        self.unit_number = config.get("unitNumber", 1)
        self.tag_write_type = config.get("tagWriteType", "Single Write")
        self.description = config.get("description", "")
        self.add_device_name_as_prefix = config.get("addDeviceNameAsPrefix", True)
        self.use_ascii_protocol = config.get("useAsciiProtocol", 0)
        self.packet_delay = config.get("packetDelay", 20)
        self.digital_block_size = config.get("digitalBlockSize", 512)
        self.analog_block_size = config.get("analogBlockSize", 64)
        self.port = port


class IOTag:
    """
    IO Tag class that represents a data point from a device.
    """
    
    def __init__(self, tag_id, config, device):
        """
        Initialize the IO Tag.
        
        Args:
            tag_id: The tag ID
            config: The tag configuration
            device: The parent IO Device instance
        """
        self.id = tag_id
        self.device_id = device.id
        self.name = config.get("name", "")
        self.data_type = config.get("dataType", "Analog")
        self.register_type = config.get("registerType", "")
        self.conversion_type = config.get("conversionType", "")
        self.address = config.get("address", "")
        self.start_bit = config.get("startBit", 0)
        self.length_bit = config.get("lengthBit", 16)
        self.span_low = config.get("spanLow", 0)
        self.span_high = config.get("spanHigh", 100)
        self.default_value = config.get("defaultValue", 0)
        self.scan_rate = config.get("scanRate", 1)
        self.read_write = config.get("readWrite", "Read Only")
        self.description = config.get("description", "")
        self.scale_type = config.get("scaleType", "No Scale")
        self.formula = config.get("formula", "")
        self.scale = config.get("scale", 1.0)
        self.offset = config.get("offset", 0.0)
        self.clamp_to_low = config.get("clampToLow", False)
        self.clamp_to_high = config.get("clampToHigh", False)
        self.clamp_to_zero = config.get("clampToZero", False)
        self.device = device


class UserTag:
    """
    User Tag class that represents a user-defined data point.
    """
    
    def __init__(self, tag_id, config):
        """
        Initialize the User Tag.
        
        Args:
            tag_id: The tag ID
            config: The tag configuration
        """
        self.id = tag_id
        self.name = config.get("name", "")
        self.data_type = config.get("dataType", "Analog")
        self.default_value = config.get("defaultValue", 0)
        self.span_high = config.get("spanHigh", 100)
        self.span_low = config.get("spanLow", 0)
        self.read_write = config.get("readWrite", "Read/Write")
        self.description = config.get("description", "")


class CalculationTag:
    """
    Calculation Tag class that represents a calculated data point.
    """
    
    def __init__(self, tag_id, config, manager):
        """
        Initialize the Calculation Tag.
        
        Args:
            tag_id: The tag ID
            config: The tag configuration
            manager: The IO Manager instance
        """
        self.id = tag_id
        self.name = config.get("name", "")
        self.data_type = config.get("dataType", "Analog")
        self.default_value = config.get("defaultValue", 0)
        self.formula = config.get("formula", "")
        
        # Store the tag references
        self.a = config.get("a", "")
        self.b = config.get("b", "")
        self.c = config.get("c", "")
        self.d = config.get("d", "")
        self.e = config.get("e", "")
        self.f = config.get("f", "")
        self.g = config.get("g", "")
        self.h = config.get("h", "")
        
        # Store the tag IDs (will be resolved during initialization)
        self.a_tag_id = config.get("aTagId", "")
        self.b_tag_id = config.get("bTagId", "")
        self.c_tag_id = config.get("cTagId", "")
        self.d_tag_id = config.get("dTagId", "")
        self.e_tag_id = config.get("eTagId", "")
        self.f_tag_id = config.get("fTagId", "")
        self.g_tag_id = config.get("gTagId", "")
        self.h_tag_id = config.get("hTagId", "")
        
        self.period = config.get("period", 1)  # seconds
        self.read_write = config.get("readWrite", "Read Only")
        self.span_high = config.get("spanHigh", 100)
        self.span_low = config.get("spanLow", 0)
        self.is_parent = config.get("isParent", False)
        self.description = config.get("description", "")
        self.address = config.get("address", "")
        self.manager = manager


class StatsTag:
    """
    Statistics Tag class that represents a statistical data point.
    """
    
    def __init__(self, tag_id, config, manager):
        """
        Initialize the Statistics Tag.
        
        Args:
            tag_id: The tag ID
            config: The tag configuration
            manager: The IO Manager instance
        """
        self.id = tag_id
        self.name = config.get("name", "")
        self.refer_tag_id = config.get("referTagId", "")
        self.type = config.get("type", "Average")  # Average, Max, Min, Sum
        self.update_cycle_value = config.get("updateCycleValue", 60)
        self.update_cycle_unit = config.get("updateCycleUnit", "min")  # sec, min, hour, day
        self.description = config.get("description", "")
        self.manager = manager


class SystemTag:
    """
    System Tag class that represents a system-level data point.
    """
    
    def __init__(self, tag_id, config):
        """
        Initialize the System Tag.
        
        Args:
            tag_id: The tag ID
            config: The tag configuration
        """
        self.id = tag_id
        self.name = config.get("name", "")
        self.data_type = config.get("dataType", "Analog")
        self.unit = config.get("unit", "")
        self.span_high = config.get("spanHigh", 100)
        self.span_low = config.get("spanLow", 0)
        self.description = config.get("description", "")
