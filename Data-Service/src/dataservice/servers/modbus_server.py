import os
import struct
from dotenv import load_dotenv
from pyModbusTCP.server import ModbusServer
from ..core.datastore import DATA_STORE
from ..core.mapping_store import MODBUS_MAPPING
from threading import Event
import time

# Load environment variables
load_dotenv()

class DataBank:
    def __init__(self):
        self.server = None
        self.register_cache = {}  # Cache for register values
        self.used_registers = set()  # Track which registers are currently in use
    
    def update_from_mappings(self):
        """Update modbus data bank using the Modbus mappings"""
        if not (self.server and self.server.is_run):
            return
            
        try:
            # Get all Modbus mappings
            mappings = MODBUS_MAPPING.all()
            
            # Track new register usage
            new_used_registers = set()
            
            # Group mappings by register address for efficient updates
            register_updates = {}
            
            for data_id, mapping in mappings.items():
                key = mapping['key']
                register_address = mapping['register_address']
                data_type = mapping['data_type']
                scaling_factor = mapping.get('scaling_factor', 1.0)
                
                # Get current value from data store
                value = DATA_STORE.read(key)
                if value is None:
                    continue
                
                # Apply scaling
                scaled_value = float(value) * scaling_factor
                
                # Convert to Modbus register format based on data type
                registers = self._value_to_registers(scaled_value, data_type)
                
                # Store registers starting at the mapped address
                for i, reg_value in enumerate(registers):
                    addr = register_address + i
                    register_updates[addr] = reg_value
                    new_used_registers.add(addr)  # Track this register as in use
            
            # Clear registers that are no longer in use (deleted mappings)
            unused_registers = self.used_registers - new_used_registers
            if unused_registers:
                print(f"Modbus: Clearing {len(unused_registers)} unused registers")
                for addr in sorted(unused_registers):
                    self.server.data_bank.set_holding_registers(addr, [0])
            
            # Apply all register updates
            if register_updates:
                # Find the range of registers to update
                min_addr = min(register_updates.keys())
                max_addr = max(register_updates.keys())
                
                # Read current register bank state
                current_registers = self.server.data_bank.get_holding_registers(min_addr, max_addr - min_addr + 1)
                if current_registers is None:
                    current_registers = [0] * (max_addr - min_addr + 1)
                
                # Update with our new values
                for addr, value in register_updates.items():
                    if min_addr <= addr <= max_addr:
                        current_registers[addr - min_addr] = value
                
                # Write back to server
                self.server.data_bank.set_holding_registers(min_addr, current_registers)
                
                # Debug output
                print(f"Modbus: Updated {len(register_updates)} registers from {min_addr} to {max_addr}")
            
            # Update the used registers set
            self.used_registers = new_used_registers
            
            # If no mappings, clear all previously used registers
            if not mappings and self.used_registers:
                print(f"Modbus: No mappings, clearing all {len(self.used_registers)} used registers")
                for addr in sorted(self.used_registers):
                    self.server.data_bank.set_holding_registers(addr, [0])
                self.used_registers.clear()
                
        except Exception as e:
            print(f"Modbus mapping update error: {e}")
    
    def _value_to_registers(self, value, data_type):
        """Convert a value to Modbus register format based on data type"""
        try:
            if data_type == 'float32':
                # Convert float to two 16-bit registers (IEEE 754)
                packed = struct.pack('>f', float(value))  # Big-endian float
                reg1, reg2 = struct.unpack('>HH', packed)
                return [reg1, reg2]
            elif data_type == 'int32':
                # Convert int32 to two 16-bit registers
                int_val = int(value)
                reg1 = (int_val >> 16) & 0xFFFF  # High word
                reg2 = int_val & 0xFFFF          # Low word
                return [reg1, reg2]
            elif data_type == 'int16':
                # Single 16-bit register
                return [int(value) & 0xFFFF]
            elif data_type == 'uint16':
                # Single unsigned 16-bit register
                return [int(abs(value)) & 0xFFFF]
            else:
                # Default to int16
                return [int(value) & 0xFFFF]
        except Exception as e:
            print(f"Modbus register conversion error for {data_type}: {e}")
            return [0]

def modbus_server_thread(stop_event: Event):
    host = os.getenv('SERVER_HOST', '0.0.0.0')
    port = int(os.getenv('MODBUS_PORT', '5020'))
    
    server = ModbusServer(host=host, port=port, no_block=True)
    data_bank = DataBank()
    data_bank.server = server
    
    print(f"Modbus TCP server starting on {host}:{port}")
    
    try:
        server.start()
        
        # Initialize all holding registers to 0 (addresses 0-65535)
        # This prevents garbage values in unmapped registers
        print("Initializing Modbus registers to 0...")
        server.data_bank.set_holding_registers(0, [0] * 1000)  # Initialize first 1000 registers
        
        print(f"✓ Modbus TCP server started successfully on {host}:{port}")
        print("✓ Using Modbus mapping store for register addresses")
        print("✓ All registers initialized to 0")
        
        # Periodic update loop using mappings
        update_counter = 0
        while not stop_event.is_set():
            try:
                # Update registers from mappings
                data_bank.update_from_mappings()
                
                # Debug output every 10 seconds
                update_counter += 1
                if update_counter % 10 == 0:
                    mappings_count = len(MODBUS_MAPPING.all())
                    print(f"Modbus: Active mappings: {mappings_count}")
                    
                time.sleep(1)
            except Exception as e:
                print(f"Modbus update loop error: {e}")
                time.sleep(1)
                
    except Exception as e:
        print(f"Modbus server error: {e}")
    finally:
        if server.is_run:
            server.stop()
        print("Modbus TCP server stopped")
