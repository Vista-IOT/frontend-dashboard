"""
MQTT Publisher API Endpoints
Separate file for MQTT-related endpoints to keep server.py organized
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import time

# Import models from server.py
from .server import (
    MQTTPublisherConfig,
    MQTTPublisherStatus,
    MQTTTestPublishRequest,
    MQTTTestPublishResponse
)

# This will be set by server.py
mqtt_publisher = None

router = APIRouter(prefix="/mqtt/publisher", tags=["MQTT Publisher"])


@router.get("/config", response_model=Dict[str, Any])
def get_mqtt_publisher_config():
    """
    Get MQTT Publisher Configuration
    
    Returns the current MQTT publisher configuration including:
    - Broker settings (address, port, authentication, TLS)
    - Publish topics with tag selections
    - QoS, retain, format, and interval settings
    """
    return mqtt_publisher.get_config()


@router.post("/config")
def set_mqtt_publisher_config(config: MQTTPublisherConfig):
    """
    Set MQTT Publisher Configuration
    
    Update the MQTT publisher configuration and restart the publisher.
    Configuration is automatically persisted to disk and will be loaded on restart.
    
    **Request Body:**
    - `enabled`: Enable/disable MQTT publishing
    - `broker`: Broker connection settings
        - `address`: MQTT broker address
        - `port`: MQTT broker port (default: 1883)
        - `client_id`: Client identifier
        - `auth`: Authentication settings (username/password)
        - `tls`: TLS/SSL settings (certificates, verification)
    - `topics`: Publishing topics configuration
        - `publish`: Array of publish topic configurations
            - `topic`: MQTT topic path
            - `selectedTags`: Array of IO tags to publish
            - `publishInterval`: Publish interval in milliseconds
            - `qos`: Quality of Service (0, 1, or 2)
            - `retain`: Retain message flag
            - `format`: Data format (json, csv, plain)
    
    **Example:**
    ```json
    {
      "enabled": true,
      "broker": {
        "address": "mqtt.example.com",
        "port": 1883,
        "client_id": "dataservice-mqtt-pub"
      },
      "topics": {
        "publish": [
          {
            "id": "topic-1",
            "topic": "sensors/temperature",
            "selectedTags": [...],
            "publishInterval": 5000,
            "qos": 1,
            "format": "json"
          }
        ]
      }
    }
    ```
    """
    try:
        mqtt_publisher.update_config(config.dict())
        return {'ok': True, 'message': 'MQTT publisher configuration updated'}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/status", response_model=MQTTPublisherStatus)
def get_mqtt_publisher_status():
    """
    Get MQTT Publisher Status
    
    Returns real-time status of the MQTT publisher:
    - Connection status (connected/disconnected)
    - Broker address
    - Number of active topics
    - Total configured topics
    
    **Response:**
    ```json
    {
      "enabled": true,
      "connected": true,
      "broker": "mqtt.example.com",
      "active_topics": 2,
      "total_topics": 3
    }
    ```
    """
    return mqtt_publisher.get_status()


@router.post("/test", response_model=MQTTTestPublishResponse)
def test_mqtt_publish(request: MQTTTestPublishRequest):
    """
    Test MQTT Publish
    
    Test publishing a message to verify configuration before deploying.
    Publishes a single test message with the specified settings.
    
    **Request Body:**
    - `topic`: MQTT topic to publish to
    - `selectedTags`: Array of tags to include in test message
    - `qos`: Quality of Service level
    - `retain`: Retain message flag
    - `format`: Data format (json, csv, plain)
    - `includeTimestamp`: Include timestamps in data
    
    **Response:**
    ```json
    {
      "ok": true,
      "message": "Test message published to sensors/temperature",
      "tag_count": 5,
      "payload_size": 234
    }
    ```
    """
    try:
        result = mqtt_publisher.test_publish(request.dict())
        return result
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/restart")
def restart_mqtt_publisher():
    """
    Restart MQTT Publisher
    
    Restart the MQTT publisher with the current configuration.
    Useful after making configuration changes or troubleshooting connection issues.
    
    **Response:**
    ```json
    {
      "ok": true,
      "message": "MQTT publisher restarted"
    }
    ```
    """
    try:
        mqtt_publisher.stop()
        time.sleep(0.5)
        mqtt_publisher.start()
        return {'ok': True, 'message': 'MQTT publisher restarted'}
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/topics")
def list_mqtt_topics():
    """
    List MQTT Topics
    
    Get a list of all configured MQTT publish topics with their settings.
    
    **Response:**
    ```json
    {
      "topics": [
        {
          "id": "topic-1",
          "topic": "sensors/temperature",
          "enabled": true,
          "tagCount": 5,
          "publishInterval": 5000,
          "qos": 1
        }
      ]
    }
    ```
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
