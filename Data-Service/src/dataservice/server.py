import threading
import asyncio
import signal
import sys
import json
import time
import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
import os
import time
import threading
from typing import Optional, Dict, Any, List
from .servers.modbus_server import modbus_server_thread
from .servers.opcua_server import opcua_server_thread
from .servers.iec104_server import iec104_server_thread
from .servers.snmp_server import snmp_server_thread
from .core.datastore import DATA_STORE
from .core.mqtt_forwarder import MqttForwarder
from .core.mqtt_publisher import MQTTPublisher
from .core.config_manager import config_manager
from .core.mapping_store import MODBUS_MAPPING, IEC104_MAPPING, OPCUA_MAPPING, SNMP_MAPPING
from .core.ipc import IpcServer
from .bulk_opcua_mapping import auto_generate_opcua_mappings


# ====================== PYDANTIC MODELS FOR MQTT ======================

class MQTTAuthConfig(BaseModel):
    enabled: bool = False
    username: str = ""
    password: str = ""

class MQTTTLSConfig(BaseModel):
    enabled: bool = False
    verify_server: bool = True
    allow_insecure: bool = False
    cert_file: str = ""
    key_file: str = ""
    ca_file: str = ""

class MQTTBrokerConfig(BaseModel):
    address: str = "localhost"
    port: int = 1883
    client_id: str = "dataservice-mqtt-pub"
    keepalive: int = 60
    clean_session: bool = True
    protocol: str = "mqtt"
    auth: MQTTAuthConfig = Field(default_factory=MQTTAuthConfig)
    tls: MQTTTLSConfig = Field(default_factory=MQTTTLSConfig)

class MQTTTagSelection(BaseModel):
    id: str
    name: str
    deviceName: Optional[str] = None
    portName: Optional[str] = None
    device: Optional[str] = None
    port: Optional[str] = None
    type: Optional[str] = None

class MQTTPublishTopic(BaseModel):
    id: str
    topic: str
    tagType: str = "io-tag"
    tagFilter: str = ""
    selectedTags: List[MQTTTagSelection] = Field(default_factory=list)
    publishInterval: int = 1000
    qos: int = 0
    retain: bool = False
    format: str = "json"
    includeTimestamp: bool = True
    enabled: bool = True

class MQTTTopicsConfig(BaseModel):
    publish: List[MQTTPublishTopic] = Field(default_factory=list)
    subscribe: List[Dict[str, Any]] = Field(default_factory=list)

class MQTTPublisherConfig(BaseModel):
    enabled: bool = False
    broker: MQTTBrokerConfig = Field(default_factory=MQTTBrokerConfig)
    topics: MQTTTopicsConfig = Field(default_factory=MQTTTopicsConfig)

class MQTTPublisherStatus(BaseModel):
    enabled: bool
    connected: bool
    broker: str
    active_topics: int
    total_topics: int

class MQTTTestPublishRequest(BaseModel):
    topic: str
    qos: int = 0
    retain: bool = False
    format: str = "json"
    includeTimestamp: bool = True
    selectedTags: List[MQTTTagSelection] = Field(default_factory=list)
    tagFilter: str = ""

class MQTTTestPublishResponse(BaseModel):
    ok: bool
    message: Optional[str] = None
    error: Optional[str] = None
    tag_count: Optional[int] = None
    payload_size: Optional[int] = None

_START_TIME = time.time()


class ServiceManager:
    def __init__(self) -> None:
        self.modbus_stop = threading.Event()
        self.opcua_stop = threading.Event()
        self.iec104_stop = threading.Event()
        self.snmp_stop = threading.Event()
        self.modbus_thread: Optional[threading.Thread] = None
        self.opcua_thread: Optional[threading.Thread] = None
        self.iec104_thread: Optional[threading.Thread] = None
        self.snmp_thread: Optional[threading.Thread] = None

    def start_modbus(self):
        if self.modbus_thread and self.modbus_thread.is_alive():
            return
        self.modbus_stop.clear()
        self.modbus_thread = threading.Thread(target=modbus_server_thread, args=(self.modbus_stop,), daemon=True)
        self.modbus_thread.start()

    def stop_modbus(self):
        self.modbus_stop.set()

    def start_opcua(self):
        if self.opcua_thread and self.opcua_thread.is_alive():
            return
        self.opcua_stop.clear()
        def run():
            asyncio.run(opcua_server_thread(self.opcua_stop))
        self.opcua_thread = threading.Thread(target=run, daemon=True)
        self.opcua_thread.start()

    def stop_opcua(self):
        self.opcua_stop.set()

    def start_iec104(self):
        if self.iec104_thread and self.iec104_thread.is_alive():
            return
        self.iec104_stop.clear()
        self.iec104_thread = threading.Thread(target=iec104_server_thread, args=(self.iec104_stop,), daemon=True)
        self.iec104_thread.start()

    def stop_iec104(self):
        self.iec104_stop.set()

    def start_snmp(self):
        if self.snmp_thread and self.snmp_thread.is_alive():
            return
        self.snmp_stop.clear()
        self.snmp_thread = threading.Thread(target=snmp_server_thread, args=(self.snmp_stop,), daemon=True)
        self.snmp_thread.start()

    def stop_snmp(self):
        self.snmp_stop.set()


app = FastAPI(title="DataService", version="1.0.0")

# Add CORS middleware to allow frontend access
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
frontend_host = frontend_url.replace('http://', '').replace('https://', '').split(':')[0]
frontend_port = os.getenv('FRONTEND_PORT', '3000')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        frontend_url,
        f"http://{frontend_host}:{frontend_port}",
        f"http://localhost:{frontend_port}",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"  # Allow all origins for development - restrict in production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
services = ServiceManager()
mqtt_forwarder = MqttForwarder()
mqtt_publisher = MQTTPublisher()
ipc_server = IpcServer()


@app.on_event("startup")
def on_startup():
    services.start_modbus()
    services.start_opcua()
    services.start_iec104()
    # services.start_snmp()  # Disabled due to asyncio event loop issues
    mqtt_forwarder.start()
    ipc_server.start()


@app.on_event("shutdown")
def on_shutdown():
    services.stop_modbus()
    services.stop_opcua()
    services.stop_iec104()
    # services.stop_snmp()  # Disabled due to asyncio event loop issues
    mqtt_forwarder.stop()
    ipc_server.stop()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/data")
def get_data():
    return JSONResponse(DATA_STORE.snapshot())


@app.get("/stats")
def stats():
    data_stats = DATA_STORE.get_statistics()
    return {
        "keys": data_stats['total_points'],
        "addresses": data_stats['total_addresses'], 
        "uptime_sec": int(time.time() - _START_TIME),
        "heap_est_bytes": data_stats['total_points'] * 24  # rough estimate
    }


@app.get("/addr")
def get_address_space():
    """Get the current address space (for debugging/testing)"""
    space = DATA_STORE.address_space()
    # Pad to show at least first 10 addresses
    padded = {}
    for i in range(max(10, max(space.keys()) + 1) if space else 10):
        padded[str(i)] = space.get(i, 0)
    return JSONResponse(padded)


@app.post("/register")
def register(body: dict):
    key = body.get('key')
    address = body.get('address')
    default = body.get('default', 0)
    data_type = body.get('data_type', 'float')
    units = body.get('units', '')
    allow_conflict = bool(body.get('allow_address_conflict', False))
    
    if not isinstance(key, str) or key == '':
        raise HTTPException(400, 'key required')
    try:
        DATA_STORE.register(
            key, 
            address=address, 
            default=default,
            data_type=data_type,
            units=units,
            allow_address_conflict=allow_conflict
        )
        data_id = DATA_STORE.ensure_id(key)
        return {'ok': True, 'id': data_id}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/register/bulk")
def bulk_register(body: dict):
    """
    Bulk register multiple data points for quick data ingestion
    
    Body format:
    {
        "points": [
            {
                "key": "temperature",
                "address": 40001,
                "default": 25.0,
                "data_type": "float",
                "units": "°C"
            },
            {
                "key": "pressure", 
                "address": 40002,
                "default": 1013.25,
                "data_type": "float",
                "units": "hPa"
            }
        ],
        "allow_address_conflict": false
    }
    """
    points = body.get('points', [])
    allow_conflict = bool(body.get('allow_address_conflict', False))
    
    if not isinstance(points, list) or len(points) == 0:
        raise HTTPException(400, 'points must be a non-empty list')
    
    results = []
    errors = []
    
    for i, point in enumerate(points):
        try:
            key = point.get('key')
            address = point.get('address')
            default = point.get('default', 0)
            data_type = point.get('data_type', 'float')
            units = point.get('units', '')
            
            if not isinstance(key, str) or key == '':
                errors.append(f"Point {i}: key required")
                continue
                
            DATA_STORE.register(
                key,
                address=address,
                default=default,
                data_type=data_type,
                units=units,
                allow_address_conflict=allow_conflict
            )
            data_id = DATA_STORE.ensure_id(key)
            results.append({
                'index': i,
                'key': key,
                'id': data_id,
                'ok': True
            })
        except Exception as e:
            errors.append(f"Point {i} ({point.get('key', 'unknown')}): {str(e)}")
            results.append({
                'index': i,
                'key': point.get('key', 'unknown'),
                'ok': False,
                'error': str(e)
            })
    
    return {
        'ok': len(errors) == 0,
        'total_points': len(points),
        'successful': len([r for r in results if r.get('ok')]),
        'failed': len([r for r in results if not r.get('ok')]),
        'results': results,
        'errors': errors
    }


@app.post("/write")
def write(body: dict):
    key = body.get('key')
    address = body.get('address')
    value = body.get('value')
    if key is None and address is None:
        raise HTTPException(400, 'key or address required')
    DATA_STORE.write(key if key is not None else int(address), value)
    return {'ok': True}



# ====================== PROTOCOL-SPECIFIC MAPPING ENDPOINTS ======================

@app.post('/mappings/modbus')
def set_modbus_mapping(body: dict):
    """Set Modbus-specific mapping"""
    data_id = body.get('id')
    key = body.get('key')
    register_address = body.get('register_address')
    function_code = body.get('function_code', 3)
    data_type = body.get('data_type', 'int16')
    access = body.get('access', 'rw')
    scaling_factor = body.get('scaling_factor', 1.0)
    endianess = body.get('endianess', 'big')
    description = body.get('description', '')
    
    if not isinstance(data_id, str) or data_id == '':
        raise HTTPException(400, 'id required')
    if not isinstance(key, str) or key == '':
        raise HTTPException(400, 'key required')
    if not isinstance(register_address, int):
        raise HTTPException(400, 'register_address must be integer')
    
    try:
        MODBUS_MAPPING.set_mapping(
            data_id, key, register_address, function_code, 
            data_type, access, scaling_factor, endianess, description
        )
        return {'ok': True}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.get('/mappings/modbus')
def get_modbus_mappings():
    """Get all Modbus mappings"""
    return MODBUS_MAPPING.all()


@app.post('/mappings/snmp')
def set_snmp_mapping(body: dict):
    """Set SNMP-specific mapping"""
    data_id = body.get('id')
    key = body.get('key')
    oid = body.get('oid')
    syntax = body.get('syntax', 'Gauge32')
    access = body.get('access', 'read-only')
    description = body.get('description', '')
    index = body.get('index')
    
    if not isinstance(data_id, str) or data_id == '':
        raise HTTPException(400, 'id required')
    if not isinstance(key, str) or key == '':
        raise HTTPException(400, 'key required')
    if not isinstance(oid, str) or oid == '':
        raise HTTPException(400, 'oid required')
    
    try:
        SNMP_MAPPING.set_mapping(data_id, key, oid, syntax, access, description, index)
        return {'ok': True}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.get('/mappings/snmp')
def get_snmp_mappings():
    """Get all SNMP mappings"""
    return SNMP_MAPPING.all()

@app.post('/mappings/iec104')
def set_iec104_mapping(body: dict):
    data_id = body.get('id')
    key = body.get('key')
    ioa = body.get('ioa')
    type_id = body.get('type')
    if not isinstance(data_id, str) or data_id == '':
        raise HTTPException(400, 'id required')
    if not isinstance(key, str) or key == '':
        raise HTTPException(400, 'key required')
    if not isinstance(ioa, int):
        raise HTTPException(400, 'ioa must be integer')
    try:
        IEC104_MAPPING.set_mapping(data_id, key, ioa, type_id)
        return {'ok': True}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get('/mappings/iec104')
def get_iec104_mappings():
    return IEC104_MAPPING.all()


@app.post('/mappings/snmp')
def set_snmp_mapping(body: dict):
    data_id = body.get('id')
    key = body.get('key')
    oid_suffix = body.get('oid_suffix')
    type_id = body.get('type')
    if not isinstance(data_id, str) or data_id == '':
        raise HTTPException(400, 'id required')
    if not isinstance(key, str) or key == '':
        raise HTTPException(400, 'key required')
    if not isinstance(oid_suffix, int):
        raise HTTPException(400, 'oid_suffix must be integer')
    try:
        SNMP_MAPPING.set_mapping(data_id, key, oid_suffix, type_id)
        return {'ok': True}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get('/mappings/snmp')
def get_snmp_mappings():
    return SNMP_MAPPING.all()


@app.post("/services/{name}/enable")
def enable_service(name: str):
    name = name.lower()
    if name == 'modbus':
        services.start_modbus()
    elif name == 'opcua':
        services.start_opcua()
    elif name == 'iec104':
        services.start_iec104()
    elif name == 'snmp':
        pass  # SNMP service disabled due to asyncio event loop issues
    else:
        raise HTTPException(404, 'unknown service')
    return {'ok': True}


@app.post("/services/{name}/disable")
def disable_service(name: str):
    name = name.lower()
    if name == 'modbus':
        services.stop_modbus()
    elif name == 'opcua':
        services.stop_opcua()
    elif name == 'iec104':
        services.stop_iec104()
    elif name == 'snmp':
        pass  # SNMP service disabled due to asyncio event loop issues
    else:
        raise HTTPException(404, 'unknown service')
    return {'ok': True}


# ====================== DATA SERVICE SPECIFIC FEATURES ======================

@app.get("/detailed")
def get_detailed_data():
    """Get detailed data with metadata, quality, and timestamps"""
    return JSONResponse(DATA_STORE.detailed_snapshot())

@app.get("/history/{key}")
def get_history(key: str, limit: int = 100):
    """Get historical data for a specific key"""
    history = DATA_STORE.get_history(key, limit)
    if not history:
        raise HTTPException(404, f"No history found for key '{key}'")
    return JSONResponse(history)

@app.get("/datapoints")
def list_datapoints():
    """List all registered data points with their configuration"""
    detailed = DATA_STORE.detailed_snapshot()
    return JSONResponse([{
        'key': key,
        'address': info['address'],
        'data_type': info['data_type'],
        'units': info['units'],
        'current_value': info['value'],
        'quality': info['quality']
    } for key, info in detailed.items()])

@app.get("/statistics")
def get_statistics():
    """Get system statistics"""
    stats = DATA_STORE.get_statistics()
    stats.update({
        'uptime_seconds': time.time() - _START_TIME,
        'services': {
            'modbus': services.modbus_thread is not None and services.modbus_thread.is_alive(),
            'opcua': services.opcua_thread is not None and services.opcua_thread.is_alive(),
            'iec104': services.iec104_thread is not None and services.iec104_thread.is_alive(),
            'snmp': False  # Disabled
        }
    })
    return JSONResponse(stats)

@app.get("/address-space/info")
def get_address_space_info():
    """Get address space allocation information"""
    return JSONResponse(DATA_STORE.get_address_space_info())

@app.get("/health/detailed")
def health_detailed():
    """Detailed health check with service status"""
    services_status = {
        'modbus': {
            'running': services.modbus_thread is not None and services.modbus_thread.is_alive(),
            'port': int(os.getenv('MODBUS_PORT', '5020'))
        },
        'opcua': {
            'running': services.opcua_thread is not None and services.opcua_thread.is_alive(),
            'port': int(os.getenv('OPCUA_PORT', '4840'))
        },
        'iec104': {
            'running': services.iec104_thread is not None and services.iec104_thread.is_alive(),
            'port': int(os.getenv('IEC104_PORT', '2404'))
        },
        'snmp': {
            'running': False,
            'port': int(os.getenv('SNMP_PORT', '1161')),
            'status': 'disabled'
        }
    }
    
    # Check for data quality issues
    detailed = DATA_STORE.detailed_snapshot()
    quality_issues = sum(1 for info in detailed.values() if info['quality'] != 'GOOD')
    
    return JSONResponse({
        'status': 'healthy',
        'timestamp': time.time(),
        'uptime_seconds': time.time() - _START_TIME,
        'services': services_status,
        'data_quality': {
            'total_points': len(detailed),
            'quality_issues': quality_issues
        }
    })

@app.post("/simulate")
def simulate_data():
    """Simulate changing data values for testing"""
    import random
    
    # Simulate some changing values
    DATA_STORE.write('temperature', round(random.uniform(20.0, 35.0), 1))
    DATA_STORE.write('humidity', round(random.uniform(40.0, 80.0), 1))
    DATA_STORE.write('pressure', round(random.uniform(980.0, 1050.0), 1))
    
    # Update custom data points if they exist
    snapshot = DATA_STORE.snapshot()
    if 'power_consumption' in snapshot:
        DATA_STORE.write('power_consumption', round(random.uniform(100.0, 200.0), 2))
    if 'flow_rate' in snapshot:
        DATA_STORE.write('flow_rate', round(random.uniform(30.0, 70.0), 1))
    
    return {'ok': True, 'message': 'Data simulation updated'}


def main():
    # For backward-compat if directly executed
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '8080'))
    uvicorn.run("dataservice.server:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()

# ====================== PROTOCOL-SPECIFIC MAPPING ENDPOINTS ======================

@app.post('/mappings/modbus')
def set_modbus_mapping(body: dict):
    """Set Modbus-specific mapping with proper Modbus attributes"""
    data_id = body.get('id')
    key = body.get('key')
    register_address = body.get('register_address')
    function_code = body.get('function_code', 3)  # Default: Holding Register
    data_type = body.get('data_type', 'int16')
    access = body.get('access', 'rw')
    scaling_factor = body.get('scaling_factor', 1.0)
    endianess = body.get('endianess', 'big')
    description = body.get('description', '')
    
    if not isinstance(data_id, str) or data_id == '':
        raise HTTPException(400, 'id required')
    if not isinstance(key, str) or key == '':
        raise HTTPException(400, 'key required')
    if not isinstance(register_address, int):
        raise HTTPException(400, 'register_address must be integer')
    
    try:
        MODBUS_MAPPING.set_mapping(
            data_id, key, register_address, function_code, 
            data_type, access, scaling_factor, endianess, description
        )
        return {'ok': True}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.get('/mappings/modbus')
def get_modbus_mappings():
    """Get all Modbus mappings"""
    return MODBUS_MAPPING.all()

@app.post('/mappings/opcua')
def set_opcua_mapping(body: dict):
    """Set OPC-UA specific mapping - supports single or bulk with smart node_id generation"""
    
    # Check if this is a bulk request (has data_ids array)
    data_ids = body.get('data_ids')
    if data_ids and isinstance(data_ids, list):
        # Bulk mode - auto-generate mappings for multiple data_ids
        start_namespace = body.get('start_namespace', 2)
        start_node_id = body.get('start_node_id', 100)
        padding_strategy = body.get('padding_strategy', 'data_type')
        access_level = body.get('access_level', 'auto')
        timestamps = body.get('timestamps', 'auto')
        value_rank = body.get('value_rank', -1)
        
        try:
            result = auto_generate_opcua_mappings(
                data_ids=data_ids,
                start_namespace=start_namespace,
                start_node_id=start_node_id,
                padding_strategy=padding_strategy,
                access_level=access_level,
                timestamps=timestamps,
                value_rank=value_rank
            )
            return result
        except Exception as e:
            raise HTTPException(400, str(e))
    
    else:
        # Single mapping mode
        data_id = body.get('id')
        key = body.get('key')
        node_id = body.get('node_id')  # Now optional
        browse_name = body.get('browse_name')
        display_name = body.get('display_name')
        data_type = body.get('data_type', 'Float')
        value_rank = body.get('value_rank', -1)
        access_level = body.get('access_level', 'CurrentRead')
        timestamps = body.get('timestamps', 'Both')
        namespace = body.get('namespace', 2)
        description = body.get('description', '')
        
        # Validation
        if not isinstance(data_id, str) or data_id == '':
            raise HTTPException(400, 'id required')
        if not isinstance(key, str) or key == '':
            raise HTTPException(400, 'key required')
        
        # Auto-generate node_id if not provided
        if not node_id:
            try:
                # Use bulk function for single item to get smart node_id
                bulk_result = auto_generate_opcua_mappings(
                    data_ids=[data_id],
                    start_namespace=namespace,
                    start_node_id=body.get("start_node_id", 100),
                    padding_strategy="data_type",
                    access_level="auto" if access_level == "CurrentRead" else access_level,
                    timestamps="auto" if timestamps == "Both" else timestamps,
                    value_rank=value_rank
                )
                
                if bulk_result["ok"] and bulk_result["results"]:
                    result = bulk_result["results"][0]
                    return {
                        "ok": True, 
                        "node_id": result["node_id"],
                        "generated_mapping": result
                    }
                else:
                    raise HTTPException(400, f"Failed to auto-generate mapping: {bulk_result.get('errors', [])}")
                    
            except Exception as e:
                raise HTTPException(400, f"Auto-generation failed: {str(e)}")
        
        # Manual node_id provided - use existing logic
        else:
            try:
                OPCUA_MAPPING.set_mapping(
                    data_id, key, node_id, browse_name, display_name,
                    data_type, value_rank, access_level, timestamps, namespace, description
                )
                return {'ok': True, 'node_id': node_id}
            except Exception as e:
                raise HTTPException(400, str(e))

@app.get('/mappings/opcua')
def get_opcua_mappings():
    """Get all OPC-UA mappings"""
    return OPCUA_MAPPING.all()


# ====================== MQTT PUBLISHER ENDPOINTS ======================

@app.get('/mqtt/publisher/config', tags=["MQTT Publisher"])
def get_mqtt_publisher_config():
    """
    Get MQTT Publisher Configuration
    
    Returns the current MQTT publisher configuration including:
    - Broker settings (address, port, authentication, TLS)
    - Publish topics with tag selections
    - QoS, retain, format, and interval settings
    """
    return mqtt_publisher.get_config()


@app.post('/mqtt/publisher/config', tags=["MQTT Publisher"])
def set_mqtt_publisher_config(config: MQTTPublisherConfig):
    """
    Set MQTT Publisher Configuration
    
    Update the MQTT publisher configuration and restart the publisher.
    Configuration is automatically persisted to disk and will be loaded on restart.
    """
    try:
        mqtt_publisher.update_config(config.dict())
        return {'ok': True, 'message': 'MQTT publisher configuration updated'}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get('/mqtt/publisher/status', response_model=MQTTPublisherStatus, tags=["MQTT Publisher"])
def get_mqtt_publisher_status():
    """
    Get MQTT Publisher Status
    
    Returns real-time status of the MQTT publisher:
    - Connection status (connected/disconnected)
    - Broker address
    - Number of active topics
    - Total configured topics
    """
    return mqtt_publisher.get_status()


@app.post('/mqtt/publisher/test', response_model=MQTTTestPublishResponse, tags=["MQTT Publisher"])
def test_mqtt_publish(request: MQTTTestPublishRequest):
    """
    Test MQTT Publish
    
    Test publishing a message to verify configuration before deploying.
    Publishes a single test message with the specified settings.
    """
    try:
        result = mqtt_publisher.test_publish(request.dict())
        return result
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post('/mqtt/publisher/restart', tags=["MQTT Publisher"])
def restart_mqtt_publisher():
    """
    Restart MQTT Publisher
    
    Restart the MQTT publisher with the current configuration.
    Useful after making configuration changes or troubleshooting connection issues.
    """
    try:
        mqtt_publisher.stop()
        time.sleep(0.5)
        mqtt_publisher.start()
        return {'ok': True, 'message': 'MQTT publisher restarted'}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get('/mqtt/publisher/topics', tags=["MQTT Publisher"])
def list_mqtt_topics():
    """
    List MQTT Topics
    
    Get a list of all configured MQTT publish topics with their settings.
    """
    config = mqtt_publisher.get_config()
    topics = config.get('topics', {}).get('publish', [])
    
    return {
        'topics': [
            {
                'id': t.get('id'),
                'topic': t.get('topic'),
                'enabled': t.get('enabled', True),
                'tagCount': len(t.get('selectedTags', [])),
                'publishInterval': t.get('publishInterval', 1000),
                'qos': t.get('qos', 0),
                'format': t.get('format', 'json')
            }
            for t in topics
        ]
    }


