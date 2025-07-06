import os
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from ..core.models import (
    IOPort, Device, IOTag, Bridge, BridgeBlock, Destination,
    SerialSettings, DataType, RegisterType, BridgeBlockType, DestinationType
)

logger = logging.getLogger(__name__)

class DatabaseHandler:
    def __init__(self, db_url: str = None):
        if db_url is None:
            # Default to the frontend's database
            frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../vista-iot-gateway-frontend'))
            db_url = f"sqlite:///{frontend_dir}/prisma/dev.db"
        
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)

    def _row_to_dict(self, row: Any) -> Dict:
        """Convert SQLAlchemy row to dictionary."""
        return {key: value for key, value in row._mapping.items()}

    def get_io_ports(self) -> List[IOPort]:
        """Read IO port configuration from database."""
        with self.Session() as session:
            # Query for IO ports
            ports_result = session.execute(text("""
                SELECT * FROM IOPort WHERE enabled = true
            """))
            
            ports = []
            for port_row in ports_result:
                port_data = self._row_to_dict(port_row)
                
                # Query for devices in this port
                devices_result = session.execute(text("""
                    SELECT * FROM Device WHERE portId = :port_id
                """), {"port_id": port_data["id"]})
                
                devices = []
                for device_row in devices_result:
                    device_data = self._row_to_dict(device_row)
                    
                    # Query for tags in this device
                    tags_result = session.execute(text("""
                        SELECT * FROM IOTag WHERE deviceId = :device_id
                    """), {"device_id": device_data["id"]})
                    
                    tags = []
                    for tag_row in tags_result:
                        tag_data = self._row_to_dict(tag_row)
                        tag = IOTag(
                            id=tag_data["id"],
                            name=tag_data["name"],
                            data_type=DataType(tag_data["dataType"]),
                            register_type=RegisterType(tag_data["registerType"]),
                            address=tag_data["address"],
                            description=tag_data.get("description"),
                            scan_rate=tag_data.get("scanRate"),
                            conversion_type=tag_data.get("conversionType"),
                            scale_type=tag_data.get("scaleType"),
                            read_write=tag_data.get("readWrite"),
                            start_bit=tag_data.get("startBit"),
                            length_bit=tag_data.get("lengthBit"),
                            span_low=tag_data.get("spanLow"),
                            span_high=tag_data.get("spanHigh"),
                            formula=tag_data.get("formula"),
                            scale=tag_data.get("scale"),
                            offset=tag_data.get("offset")
                        )
                        tags.append(tag)
                    
                    device = Device(
                        id=device_data["id"],
                        enabled=device_data["enabled"],
                        name=device_data["name"],
                        device_type=device_data["deviceType"],
                        unit_number=device_data["unitNumber"],
                        tag_write_type=device_data["tagWriteType"],
                        description=device_data.get("description"),
                        add_device_name_as_prefix=device_data.get("addDeviceNameAsPrefix", False),
                        use_ascii_protocol=device_data.get("useAsciiProtocol", 0),
                        packet_delay=device_data.get("packetDelay", 0),
                        digital_block_size=device_data.get("digitalBlockSize", 1),
                        analog_block_size=device_data.get("analogBlockSize", 1),
                        tags=tags
                    )
                    devices.append(device)
                
                # Parse serial settings if available
                serial_settings = None
                if port_data.get("serialSettings"):
                    serial_data = port_data["serialSettings"]
                    serial_settings = SerialSettings(
                        port=serial_data["port"],
                        baud_rate=serial_data.get("baudRate", 9600),
                        data_bit=serial_data.get("dataBit", 8),
                        stop_bit=serial_data.get("stopBit", 1),
                        parity=serial_data.get("parity", "N"),
                        rts=serial_data.get("rts", False),
                        dtr=serial_data.get("dtr", False),
                        enabled=serial_data.get("enabled", True)
                    )
                
                port = IOPort(
                    id=port_data["id"],
                    type=port_data["type"],
                    name=port_data["name"],
                    description=port_data.get("description"),
                    scan_time=port_data.get("scanTime", 1000),
                    time_out=port_data.get("timeOut", 1000),
                    retry_count=port_data.get("retryCount", 3),
                    auto_recover_time=port_data.get("autoRecoverTime", 5000),
                    scan_mode=port_data.get("scanMode", "cyclic"),
                    enabled=port_data.get("enabled", True),
                    serial_settings=serial_settings,
                    devices=devices
                )
                ports.append(port)
            
            return ports

    def get_bridges(self) -> List[Bridge]:
        """Read bridge configuration from database."""
        with self.Session() as session:
            bridges_result = session.execute(text("""
                SELECT * FROM Bridge
            """))
            
            bridges = []
            for bridge_row in bridges_result:
                bridge_data = self._row_to_dict(bridge_row)
                
                # Query for blocks in this bridge
                blocks_result = session.execute(text("""
                    SELECT * FROM BridgeBlock WHERE bridgeId = :bridge_id ORDER BY position
                """), {"bridge_id": bridge_data["id"]})
                
                blocks = []
                for block_row in blocks_result:
                    block_data = self._row_to_dict(block_row)
                    block = BridgeBlock(
                        id=block_data["id"],
                        type=BridgeBlockType(block_data["type"]),
                        sub_type=block_data.get("subType"),
                        label=block_data["label"],
                        config=block_data.get("config", {})
                    )
                    blocks.append(block)
                
                bridge = Bridge(
                    id=bridge_data["id"],
                    blocks=blocks
                )
                bridges.append(bridge)
            
            return bridges

    def get_destinations(self) -> List[Destination]:
        """Read destination configuration from database."""
        with self.Session() as session:
            destinations_result = session.execute(text("""
                SELECT * FROM Destination
            """))
            
            destinations = []
            for dest_row in destinations_result:
                dest_data = self._row_to_dict(dest_row)
                destination = Destination(
                    id=dest_data["id"],
                    name=dest_data["name"],
                    type=DestinationType(dest_data["type"]),
                    config=dest_data.get("config", {}),
                    description=dest_data.get("description")
                )
                destinations.append(destination)
            
            return destinations 