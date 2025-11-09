import threading
from typing import Dict, Any, Optional


class ProtocolMapping:
    """Base class for protocol-specific mappings"""
    
    def __init__(self):
        self._lock = threading.RLock()
        self._mappings: Dict[str, Dict[str, Any]] = {}

    def set_mapping(self, data_id: str, key: str, **protocol_attrs):
        """Set mapping with protocol-specific attributes"""
        with self._lock:
            mapping = {"key": key}
            mapping.update(protocol_attrs)
            self._mappings[data_id] = mapping

    def get_mapping(self, data_id: str) -> Optional[Dict[str, Any]]:
        """Get mapping for a data ID"""
        with self._lock:
            return self._mappings.get(data_id)

    def remove_mapping(self, data_id: str):
        """Remove mapping"""
        with self._lock:
            self._mappings.pop(data_id, None)

    def all(self) -> Dict[str, Dict[str, Any]]:
        """Get all mappings"""
        with self._lock:
            return self._mappings.copy()

    def find_by_key(self, key: str) -> Optional[Dict[str, Any]]:
        """Find mapping by key"""
        with self._lock:
            for data_id, mapping in self._mappings.items():
                if mapping.get("key") == key:
                    return {"id": data_id, **mapping}
            return None


class ModbusMapping(ProtocolMapping):
    """Modbus-specific mapping with proper Modbus attributes"""
    
    def _get_register_count(self, data_type: str) -> int:
        """Get number of registers needed for data type"""
        register_counts = {
            'int16': 1,
            'uint16': 1,
            'int32': 2,
            'uint32': 2,
            'float32': 2,
            'float': 2,
            'int64': 4,
            'uint64': 4,
            'float64': 4,
            'double': 4,
            'bool': 1,
            'string': 1  # Variable, but minimum 1
        }
        return register_counts.get(data_type.lower(), 1)
    
    def _check_address_overlap(self, data_id: str, register_address: int, data_type: str):
        """Check if the register address overlaps with existing mappings"""
        register_count = self._get_register_count(data_type)
        new_start = register_address
        new_end = register_address + register_count - 1
        
        with self._lock:
            for existing_id, mapping in self._mappings.items():
                # Skip checking against itself if updating
                if existing_id == data_id:
                    continue
                    
                existing_addr = mapping.get('register_address')
                existing_type = mapping.get('data_type', 'int16')
                existing_count = self._get_register_count(existing_type)
                existing_start = existing_addr
                existing_end = existing_addr + existing_count - 1
                
                # Check for overlap
                if not (new_end < existing_start or new_start > existing_end):
                    existing_key = mapping.get('key', 'unknown')
                    raise ValueError(
                        f"Register address conflict: {register_address}-{new_end} overlaps with "
                        f"existing mapping '{existing_key}' at {existing_start}-{existing_end}. "
                        f"Suggested address: {existing_end + 1}"
                    )
    
    def set_mapping(self, data_id: str, key: str, 
                   register_address: int,
                   function_code: int = 3,  # Default: Holding Register (FC=3)
                   data_type: str = "int16",
                   access: str = "rw",  # read-write
                   scaling_factor: float = 1.0,
                   endianess: str = "big",  # big-endian
                   description: str = ""):
        """
        Set Modbus mapping with address overlap detection
        
        Args:
            register_address: Modbus register address (e.g., 40001)
            function_code: 1=Coil, 2=Discrete Input, 3=Holding Register, 4=Input Register
            data_type: int16, int32, float32, bool
            access: r (read-only), rw (read-write)
            scaling_factor: scaling factor for the value
            endianess: big, little
        """
        # Check for address overlap before setting
        self._check_address_overlap(data_id, register_address, data_type)
        
        protocol_attrs = {
            "register_address": register_address,
            "function_code": function_code,
            "data_type": data_type,
            "access": access,
            "scaling_factor": scaling_factor,
            "endianess": endianess,
            "description": description
        }
        super().set_mapping(data_id, key, **protocol_attrs)


class IEC104Mapping(ProtocolMapping):
    """IEC 60870-5-104 specific mapping"""
    
    def set_mapping(self, data_id: str, key: str,
                   ioa: int,  # Information Object Address
                   type_id: str = "M_ME_NC_1",  # Measured value, short floating point
                   cause: str = "spontaneous",  # Cause of transmission
                   quality: bool = True,  # Include quality descriptor
                   timestamp: bool = True,  # Include timestamp
                   access: str = "r",  # read-only for measurements
                   description: str = ""):
        """
        Set IEC104 mapping
        
        Args:
            ioa: Information Object Address
            type_id: IEC104 Type ID (M_ME_NA_1, M_ME_NB_1, M_ME_NC_1, etc.)
            cause: Cause of transmission (spontaneous, periodic, request)
            quality: Include quality descriptor
            timestamp: Include timestamp
            access: r (read-only), rw (read-write for commands)
        """
        protocol_attrs = {
            "ioa": ioa,
            "type": type_id,
            "cause": cause,
            "quality": quality,
            "timestamp": timestamp,
            "access": access,
            "description": description
        }
        super().set_mapping(data_id, key, **protocol_attrs)


class OPCUAMapping(ProtocolMapping):
    """OPC-UA specific mapping"""
    
    def set_mapping(self, data_id: str, key: str,
                   node_id: str,  # e.g., "ns=2;s=Temperature"
                   browse_name: str = None,
                   display_name: str = None,
                   data_type: str = "Float",  # OPC-UA data type
                   value_rank: int = -1,  # Scalar
                   access_level: str = "CurrentRead",  # CurrentRead, CurrentWrite, CurrentReadOrWrite
                   timestamps: str = "Both",  # None, Server, Source, Both
                   namespace: int = 2,
                   description: str = ""):
        """
        Set OPC-UA mapping
        
        Args:
            node_id: OPC-UA Node ID
            browse_name: Browse name (defaults to key)
            display_name: Display name (defaults to key)
            data_type: OPC-UA data type (Float, Int32, Boolean, String, etc.)
            value_rank: -1=Scalar, 0=Array, >0=specific dimension
            access_level: CurrentRead, CurrentWrite, CurrentReadOrWrite
            timestamps: None, Server, Source, Both
            namespace: Namespace index
        """
        protocol_attrs = {
            "node_id": node_id,
            "browse_name": browse_name or key,
            "display_name": display_name or key,
            "data_type": data_type,
            "value_rank": value_rank,
            "access_level": access_level,
            "timestamps": timestamps,
            "namespace": namespace,
            "description": description
        }
        super().set_mapping(data_id, key, **protocol_attrs)


class SNMPMapping(ProtocolMapping):
    """SNMP specific mapping"""
    
    def set_mapping(self, data_id: str, key: str,
                   oid: str,  # e.g., "1.3.6.1.4.1.9999.1.1.1"
                   syntax: str = "Gauge32",  # SNMP syntax
                   access: str = "read-only",
                   description: str = "",
                   index: Optional[int] = None):  # For table entries
        """
        Set SNMP mapping
        
        Args:
            oid: SNMP Object Identifier
            syntax: INTEGER, Gauge32, Counter32, Counter64, OCTET_STRING, etc.
            access: read-only, read-write
            description: MIB description
            index: Index for table entries
        """
        protocol_attrs = {
            "oid": oid,
            "syntax": syntax,
            "access": access,
            "description": description,
            "index": index
        }
        super().set_mapping(data_id, key, **protocol_attrs)


# Global instances
MODBUS_MAPPING = ModbusMapping()
IEC104_MAPPING = IEC104Mapping()
OPCUA_MAPPING = OPCUAMapping()
SNMP_MAPPING = SNMPMapping()
