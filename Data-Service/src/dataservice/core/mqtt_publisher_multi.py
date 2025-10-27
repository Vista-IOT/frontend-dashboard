"""
MQTT Publisher for Data-Service - Multi-Broker Support
Publishes selected IO tags to multiple MQTT brokers with flexible topic mapping
"""
import os
import json
import time
import threading
from typing import Dict, List, Any, Optional
from queue import Queue, Full, Empty
import paho.mqtt.client as mqtt
from .datastore import DATA_STORE
from .config_manager import config_manager


class MQTTBrokerClient:
    """Individual MQTT broker client handler"""
    
    def __init__(self, broker_id: str, broker_config: Dict[str, Any]):
        self.broker_id = broker_id
        self.config = broker_config
        self.client: Optional[mqtt.Client] = None
        self.connected = threading.Event()
        self.stop_event = threading.Event()
        self.thread: Optional[threading.Thread] = None
        
    def start(self):
        """Start broker connection"""
        if not self.config.get('enabled', False):
            return
            
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        
    def stop(self):
        """Stop broker connection"""
        self.stop_event.set()
        if self.client:
            try:
                self.client.disconnect()
                self.client.loop_stop()
            except Exception:
                pass
        self.connected.clear()
        
    def _on_connect(self, client, userdata, flags, rc):
        """MQTT connection callback"""
        if rc == 0:
            self.connected.set()
            print(f"[MQTT Publisher] Broker '{self.config.get('name')}' connected")
        else:
            self.connected.clear()
            print(f"[MQTT Publisher] Broker '{self.config.get('name')}' connection failed: {rc}")
            
    def _on_disconnect(self, client, userdata, rc):
        """MQTT disconnection callback"""
        self.connected.clear()
        print(f"[MQTT Publisher] Broker '{self.config.get('name')}' disconnected")
        
    def _run(self):
        """Main broker connection thread"""
        # Create MQTT client
        client_id = self.config.get('clientId', f'dataservice-{self.broker_id}')
        clean_session = self.config.get('cleanSession', True)
        self.client = mqtt.Client(client_id=client_id, clean_session=clean_session)
        
        # Set authentication
        username = self.config.get('username')
        if username:
            password = self.config.get('password', '')
            self.client.username_pw_set(username, password)
            
        # Set TLS for mqtts/wss protocols
        protocol = self.config.get('protocol', 'mqtt')
        if protocol in ['mqtts', 'wss']:
            try:
                import ssl
                self.client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
            except Exception as e:
                print(f"[MQTT Publisher] TLS setup error for '{self.config.get('name')}': {e}")
                
        # Set callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        
        # Start MQTT loop
        self.client.loop_start()
        
        # Connect to broker
        address = self.config.get('address', 'localhost')
        port = self.config.get('port', 1883)
        keepalive = self.config.get('keepAlive', 60)
        
        while not self.stop_event.is_set():
            try:
                if not self.connected.is_set():
                    print(f"[MQTT Publisher] Connecting to broker '{self.config.get('name')}' at {address}:{port}...")
                    self.client.connect(address, port, keepalive=keepalive)
                    time.sleep(2)
                else:
                    break
            except Exception as e:
                print(f"[MQTT Publisher] Connection error for '{self.config.get('name')}': {e}")
                time.sleep(5)
                
        # Keep thread alive
        while not self.stop_event.is_set():
            time.sleep(1)
            
        self.client.loop_stop()
        
    def publish(self, topic: str, payload: str, qos: int = 0, retain: bool = False) -> bool:
        """Publish message to broker"""
        if not self.connected.is_set():
            return False
            
        try:
            result = self.client.publish(topic, payload, qos=qos, retain=retain)
            return result.rc == mqtt.MQTT_ERR_SUCCESS
        except Exception as e:
            print(f"[MQTT Publisher] Publish error for '{self.config.get('name')}': {e}")
            return False


class MQTTPublisherMulti:
    """
    Multi-Broker MQTT Publisher
    Supports multiple brokers with individual topic mappings
    """
    
    def __init__(self):
        self._config: Dict[str, Any] = {}
        self._brokers: Dict[str, MQTTBrokerClient] = {}
        self._topic_threads: Dict[str, threading.Thread] = {}
        self._topic_stops: Dict[str, threading.Event] = {}
        self._stop = threading.Event()
        
        # Load configuration
        self._load_config()
        
    def _load_config(self):
        """Load MQTT configuration from persistent storage"""
        try:
            self._config = config_manager.get_mqtt_config()
            print(f"[MQTT Publisher] Loaded multi-broker configuration")
            print(f"[MQTT Publisher] Enabled: {self._config.get('enabled', False)}")
            print(f"[MQTT Publisher] Brokers: {len(self._config.get('brokers', []))}")
            print(f"[MQTT Publisher] Mappings: {len(self._config.get('mappings', []))}")
        except Exception as e:
            print(f"[MQTT Publisher] Error loading config: {e}")
            self._config = {'enabled': False, 'brokers': [], 'mappings': []}
            
    def update_config(self, config: Dict[str, Any]):
        """Update MQTT publisher configuration"""
        self._config = config
        
        # Save to persistent storage
        try:
            config_manager.save_mqtt_config(config)
            print(f"[MQTT Publisher] Configuration saved")
        except Exception as e:
            print(f"[MQTT Publisher] Error saving config: {e}")
            
        # Restart if running
        if self._stop.is_set() == False:
            self.stop()
            time.sleep(0.5)
            self.start()
            
    def get_config(self) -> Dict[str, Any]:
        """Get current configuration"""
        return self._config
        
    def start(self):
        """Start MQTT publisher"""
        if not self._config.get('enabled', False):
            print("[MQTT Publisher] Not enabled, skipping start")
            return
            
        self._stop.clear()
        
        # Start all enabled brokers
        brokers = self._config.get('brokers', [])
        for broker in brokers:
            if not broker.get('enabled', True):
                continue
                
            broker_id = broker.get('id')
            if broker_id:
                broker_client = MQTTBrokerClient(broker_id, broker)
                self._brokers[broker_id] = broker_client
                broker_client.start()
                
        # Wait for brokers to connect
        time.sleep(2)
        
        # Start topic publishers
        self._start_topic_publishers()
        
    def stop(self):
        """Stop MQTT publisher"""
        self._stop.set()
        
        # Stop all topic threads
        for topic_id, stop_event in self._topic_stops.items():
            stop_event.set()
            
        # Stop all brokers
        for broker_id, broker_client in self._brokers.items():
            broker_client.stop()
            
        self._brokers.clear()
        self._topic_threads.clear()
        self._topic_stops.clear()
        
    def _start_topic_publishers(self):
        """Start publisher threads for each topic mapping"""
        mappings = self._config.get('mappings', [])
        
        for mapping in mappings:
            if not mapping.get('enabled', True):
                continue
                
            mapping_id = mapping.get('id')
            if not mapping_id:
                continue
                
            broker_id = mapping.get('brokerId')
            if broker_id not in self._brokers:
                print(f"[MQTT Publisher] Broker {broker_id} not found for mapping {mapping_id}")
                continue
                
            # Stop existing thread if any
            if mapping_id in self._topic_stops:
                self._topic_stops[mapping_id].set()
                
            # Create new stop event and thread
            stop_event = threading.Event()
            self._topic_stops[mapping_id] = stop_event
            
            thread = threading.Thread(
                target=self._publish_mapping,
                args=(mapping, stop_event),
                daemon=True
            )
            self._topic_threads[mapping_id] = thread
            thread.start()
            
    def _publish_mapping(self, mapping: Dict[str, Any], stop_event: threading.Event):
        """Publish data for a specific topic mapping"""
        broker_id = mapping.get('brokerId')
        broker_client = self._brokers.get(broker_id)
        
        if not broker_client:
            print(f"[MQTT Publisher] No broker client for {broker_id}")
            return
            
        topic = mapping.get('topicName', 'data/tags')
        publish_rate = mapping.get('publishRate', 1000)
        interval_sec = publish_rate / 1000.0
        qos = mapping.get('qos', 0)
        retain = mapping.get('retained', False)
        data_format = mapping.get('format', 'json')
        selected_tags = mapping.get('selectedTags', [])
        
        broker_name = broker_client.config.get('name', broker_id)
        print(f"[MQTT Publisher] Started publishing to '{broker_name}'::{topic} (rate: {publish_rate}ms)")
        
        while not stop_event.is_set() and not self._stop.is_set():
            try:
                if broker_client.connected.is_set():
                    # Get data for selected tags
                    data = self._get_tag_data(selected_tags)
                    
                    if data:
                        # Format data
                        payload = self._format_data(data, data_format)
                        
                        # Publish
                        success = broker_client.publish(topic, payload, qos=qos, retain=retain)
                        if not success:
                            print(f"[MQTT Publisher] Failed to publish to '{broker_name}'::{topic}")
                            
                time.sleep(interval_sec)
            except Exception as e:
                print(f"[MQTT Publisher] Error publishing to '{broker_name}'::{topic}: {e}")
                time.sleep(interval_sec)
                
    def _get_tag_data(self, selected_tags: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get data for selected tags from DATA_STORE"""
        data = {}
        all_data = DATA_STORE.detailed_snapshot()
        
        if not selected_tags:
            # No tags selected, return all
            return all_data
            
        # Get data for selected tags
        for tag in selected_tags:
            tag_name = tag.get('name', '')
            tag_id = tag.get('id', '')
            
            # Try to match by name or ID
            for key, value_info in all_data.items():
                if tag_name and (tag_name in key or key.endswith(tag_name)):
                    data[key] = value_info
                    break
                elif tag_id and tag_id in key:
                    data[key] = value_info
                    break
                    
        return data
        
    def _format_data(self, data: Dict[str, Any], format_type: str) -> str:
        """Format data according to specified format"""
        timestamp = time.time()
        
        if format_type == 'json':
            output = {}
            for key, value_info in data.items():
                output[key] = {
                    'value': value_info.get('value'),
                    'quality': value_info.get('quality', 'GOOD'),
                    'timestamp': value_info.get('timestamp', timestamp)
                }
            return json.dumps(output)
            
        elif format_type == 'csv':
            lines = ['tag,value,quality,timestamp']
            for key, value_info in data.items():
                value = value_info.get('value', '')
                quality = value_info.get('quality', 'GOOD')
                ts = value_info.get('timestamp', timestamp)
                lines.append(f'{key},{value},{quality},{ts}')
            return '\n'.join(lines)
            
        elif format_type == 'plain':
            lines = []
            for key, value_info in data.items():
                value = value_info.get('value', '')
                quality = value_info.get('quality', 'GOOD')
                ts = value_info.get('timestamp', timestamp)
                lines.append(f'{key}={value} (quality={quality}, ts={ts})')
            return '\n'.join(lines)
            
        return json.dumps(data)
        
    def test_publish(self, mapping: Dict[str, Any]) -> Dict[str, Any]:
        """Test publish a single message"""
        try:
            broker_id = mapping.get('brokerId')
            broker_client = self._brokers.get(broker_id)
            
            if not broker_client:
                return {
                    'ok': False,
                    'error': f'Broker {broker_id} not found or not connected'
                }
                
            if not broker_client.connected.is_set():
                return {
                    'ok': False,
                    'error': 'Broker not connected'
                }
                
            topic = mapping.get('topicName', 'test/topic')
            qos = mapping.get('qos', 0)
            retain = mapping.get('retained', False)
            data_format = mapping.get('format', 'json')
            selected_tags = mapping.get('selectedTags', [])
            
            # Get data
            data = self._get_tag_data(selected_tags)
            
            # Format data
            payload = self._format_data(data, data_format)
            
            # Publish
            success = broker_client.publish(topic, payload, qos=qos, retain=retain)
            
            if success:
                return {
                    'ok': True,
                    'message': f'Test message published to {topic}',
                    'tag_count': len(data),
                    'payload_size': len(payload)
                }
            else:
                return {
                    'ok': False,
                    'error': 'Publish failed'
                }
                
        except Exception as e:
            return {
                'ok': False,
                'error': str(e)
            }
            
    def get_status(self) -> Dict[str, Any]:
        """Get publisher status"""
        brokers_status = []
        for broker_id, broker_client in self._brokers.items():
            brokers_status.append({
                'id': broker_id,
                'name': broker_client.config.get('name', broker_id),
                'connected': broker_client.connected.is_set(),
                'address': broker_client.config.get('address')
            })
            
        return {
            'enabled': self._config.get('enabled', False),
            'brokers': brokers_status,
            'active_mappings': len([m for m in self._config.get('mappings', []) if m.get('enabled', True)]),
            'total_mappings': len(self._config.get('mappings', []))
        }
