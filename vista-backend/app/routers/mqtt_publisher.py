"""
MQTT Publisher Router - Handles MQTT publisher configuration and forwards to Data-Service
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import httpx
import os

router = APIRouter(prefix="/api/mqtt-publisher", tags=["mqtt-publisher"])

# Data-Service URL
DATA_SERVICE_URL = os.getenv("DATA_SERVICE_URL", "http://localhost:8080")


@router.post("/config")
async def set_mqtt_publisher_config(config: Dict[str, Any]):
    """
    Set MQTT Publisher configuration and forward to Data-Service
    
    Body format:
    {
        "enabled": true,
        "brokers": [...],
        "mappings": [...]
    }
    """
    try:
        # Forward to Data-Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{DATA_SERVICE_URL}/mqtt-publisher/config",
                json=config
            )
            response.raise_for_status()
            
        return {
            "ok": True,
            "message": "MQTT Publisher configuration updated successfully"
        }
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update MQTT Publisher configuration: {str(e)}"
        )


@router.get("/config")
async def get_mqtt_publisher_config():
    """Get current MQTT Publisher configuration from Data-Service"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{DATA_SERVICE_URL}/mqtt-publisher/config")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        # Return default config if Data-Service is not available
        return {
            "enabled": False,
            "brokers": [],
            "mappings": []
        }


@router.get("/status")
async def get_mqtt_publisher_status():
    """Get MQTT Publisher status from Data-Service"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{DATA_SERVICE_URL}/mqtt-publisher/status")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        return {
            "enabled": False,
            "running": False,
            "brokers_count": 0,
            "mappings_count": 0,
            "broker_status": {},
            "error": str(e)
        }


@router.get("/mappings")
async def get_mqtt_publisher_mappings():
    """Get all MQTT Publisher mappings from Data-Service"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{DATA_SERVICE_URL}/mappings/mqtt-publisher")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        return {}


@router.delete("/mappings/{mapping_id}")
async def delete_mqtt_publisher_mapping(mapping_id: str):
    """Delete a specific MQTT Publisher mapping"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.delete(
                f"{DATA_SERVICE_URL}/mappings/mqtt-publisher/{mapping_id}"
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete mapping: {str(e)}"
        )


@router.post("/test-connection")
async def test_mqtt_connection(broker_config: Dict[str, Any]):
    """
    Test MQTT broker connection
    
    Body format:
    {
        "address": "mqtt.example.com",
        "port": 1883,
        "clientId": "test-client",
        "auth": {...},
        "tls": {...}
    }
    """
    import paho.mqtt.client as mqtt
    import threading
    
    result = {"connected": False, "error": None}
    connected_event = threading.Event()
    
    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            result["connected"] = True
            connected_event.set()
        else:
            result["error"] = f"Connection failed with code {rc}"
            connected_event.set()
    
    def on_disconnect(client, userdata, rc):
        pass
    
    try:
        client = mqtt.Client(
            client_id=broker_config.get('clientId', 'test-client'),
            clean_session=True
        )
        
        # Setup authentication
        if broker_config.get('auth', {}).get('enabled'):
            username = broker_config['auth'].get('username')
            password = broker_config['auth'].get('password')
            if username:
                client.username_pw_set(username, password)
        
        # Setup TLS
        if broker_config.get('tls', {}).get('enabled'):
            import ssl
            tls_config = broker_config['tls']
            cert_reqs = ssl.CERT_NONE if tls_config.get('allowInsecure') else ssl.CERT_REQUIRED
            client.tls_set(
                ca_certs=tls_config.get('caFile'),
                certfile=tls_config.get('certFile'),
                keyfile=tls_config.get('keyFile'),
                cert_reqs=cert_reqs
            )
            if not tls_config.get('verifyServer', True):
                client.tls_insecure_set(True)
        
        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        
        # Try to connect
        address = broker_config.get('address', 'localhost')
        port = broker_config.get('port', 1883)
        
        client.connect(address, port, keepalive=10)
        client.loop_start()
        
        # Wait for connection result (max 5 seconds)
        connected_event.wait(timeout=5)
        
        client.loop_stop()
        client.disconnect()
        
        if not result["connected"] and not result["error"]:
            result["error"] = "Connection timeout"
        
        return result
        
    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }
