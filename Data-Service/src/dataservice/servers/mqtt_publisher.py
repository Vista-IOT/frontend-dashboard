"""
MQTT Publisher Server - Publishes data from DATA_STORE to MQTT brokers
based on configured topic mappings.
"""
import os
import json
import time
import threading
from queue import Queue, Full, Empty
from typing import Dict, List, Any, Optional
import paho.mqtt.client as mqtt
from concurrent.futures import ThreadPoolExecutor
from ..core.datastore import DATA_STORE, DataPoint
from ..core.mapping_store import ProtocolMapping


class MQTTPublisherMapping(ProtocolMapping):
    """MQTT Publisher specific mapping for topic-to-tag configurations"""
    
    def set_mapping(self, mapping_id: str, 
                   topic_name: str,
                   broker_id: str,
                   selected_tags: List[Dict[str, Any]],
                   qos: int = 0,
                   retain: bool = False,
                   publish_interval: int = 1000,
                   format: str = "json",
                   delimiter: str = ",",
                   include_timestamp: bool = True,
                   include_headers: bool = True,
                   enabled: bool = True):
        """
        Set MQTT Publisher mapping
        
        Args:
            mapping_id: Unique mapping identifier
            topic_name: MQTT topic to publish to
            broker_id: Reference to broker configuration
            selected_tags: List of tags to include in this topic
            qos: MQTT QoS level (0, 1, 2)
            retain: MQTT retain flag
            publish_interval: Publishing interval in milliseconds
            format: Output format (json, csv, plain, xml)
            delimiter: CSV delimiter
            include_timestamp: Include timestamp in payload
            include_headers: Include headers (for CSV)
            enabled: Enable/disable this mapping
        """
        # Store the key as the topic_name for consistency with other mappings
        protocol_attrs = {
            "topic_name": topic_name,
            "broker_id": broker_id,
            "selected_tags": selected_tags,
            "qos": qos,
            "retain": retain,
            "publish_interval": publish_interval,
            "format": format,
            "delimiter": delimiter,
            "include_timestamp": include_timestamp,
            "include_headers": include_headers,
            "enabled": enabled
        }
        super().set_mapping(mapping_id, topic_name, **protocol_attrs)


class MQTTBrokerConnection:
    """Manages a single MQTT broker connection"""
    
    def __init__(self, broker_config: Dict[str, Any]):
        self.config = broker_config
        self.broker_id = broker_config['id']
        self.client_id = broker_config.get('clientId', f'iot-gateway-{self.broker_id}')
        self.connected = threading.Event()
        self.stop_event = threading.Event()
        self.publish_queue: Queue = Queue(maxsize=1000)
        
        # Create MQTT client
        self.client = mqtt.Client(client_id=self.client_id, clean_session=broker_config.get('cleanSession', True))
        
        # Setup authentication if enabled
        if broker_config.get('auth', {}).get('enabled'):
            username = broker_config['auth'].get('username')
            password = broker_config['auth'].get('password')
            if username:
                self.client.username_pw_set(username, password)
        
        # Setup TLS if enabled
        if broker_config.get('tls', {}).get('enabled'):
            import ssl
            tls_config = broker_config['tls']
            cert_reqs = ssl.CERT_NONE if tls_config.get('allowInsecure') else ssl.CERT_REQUIRED
            self.client.tls_set(
                ca_certs=tls_config.get('caFile'),
                certfile=tls_config.get('certFile'),
                keyfile=tls_config.get('keyFile'),
                cert_reqs=cert_reqs
            )
            if not tls_config.get('verifyServer', True):
                self.client.tls_insecure_set(True)
        
        # Setup callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        
    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"✓ MQTT Publisher: Connected to broker '{self.config['name']}' ({self.config['address']}:{self.config['port']})")
            self.connected.set()
        else:
            print(f"✗ MQTT Publisher: Failed to connect to broker '{self.config['name']}' (rc={rc})")
            self.connected.clear()
    
    def _on_disconnect(self, client, userdata, rc):
        print(f"✗ MQTT Publisher: Disconnected from broker '{self.config['name']}' (rc={rc})")
        self.connected.clear()
    
    def connect(self):
        """Connect to the MQTT broker"""
        try:
            address = self.config['address']
            port = self.config['port']
            keepalive = self.config.get('keepalive', 60)
            
            self.client.connect(address, port, keepalive)
            self.client.loop_start()
            return True
        except Exception as e:
            print(f"✗ MQTT Publisher: Error connecting to broker '{self.config['name']}': {e}")
            return False
    
    def disconnect(self):
        """Disconnect from the MQTT broker"""
        self.stop_event.set()
        try:
            self.client.loop_stop()
            self.client.disconnect()
        except Exception as e:
            print(f"Error disconnecting from broker '{self.config['name']}': {e}")
    
    def publish(self, topic: str, payload: str, qos: int = 0, retain: bool = False):
        """Publish a message to the broker"""
        if not self.connected.is_set():
            # Queue for later if not connected
            try:
                self.publish_queue.put_nowait((topic, payload, qos, retain))
            except Full:
                # Drop oldest message
                try:
                    self.publish_queue.get_nowait()
                    self.publish_queue.put_nowait((topic, payload, qos, retain))
                except:
                    pass
            return False
        
        try:
            result = self.client.publish(topic, payload, qos=qos, retain=retain)
            return result.rc == mqtt.MQTT_ERR_SUCCESS
        except Exception as e:
            print(f"Error publishing to broker '{self.config['name']}': {e}")
            return False
    
    def process_queue(self):
        """Process queued messages"""
        if not self.connected.is_set():
            return
        
        processed = 0
        while processed < 10:  # Process up to 10 messages per call
            try:
                topic, payload, qos, retain = self.publish_queue.get_nowait()
                self.publish(topic, payload, qos, retain)
                processed += 1
            except Empty:
                break


class MQTTPublisher:
    """
    A dedicated publisher for a single MQTT mapping.
    Runs in its own thread.
    """
    def __init__(self, mapping: Dict[str, Any], broker: MQTTBrokerConnection, datastore_ready: threading.Event):
        self.mapping = mapping
        self.broker = broker
        self.datastore_ready = datastore_ready
        self.stop_event = threading.Event()
        self.thread: Optional[threading.Thread] = None

    def _run(self):
        """Main publishing loop for this mapping"""
        
        # Wait for datastore to be ready
        self.datastore_ready.wait()
        
        publish_interval_ms = self.mapping.get('publishInterval', 1000)
        publish_interval_sec = publish_interval_ms / 1000.0
        
        while not self.stop_event.is_set():
            try:
                self._publish_once()
                time.sleep(publish_interval_sec)
            except Exception as e:
                print(f"Error in publisher for topic '{self.mapping['topicName']}': {e}")
                time.sleep(1)

    def _publish_once(self):
        """Publish data for the mapping once"""
        
        # Collect tag values from DATA_STORE
        selected_tags = self.mapping.get('selectedTags', [])
        tag_values = {}
        
        for tag in selected_tags:
            tag_name = tag.get('name')
            if tag_name:
                # Read directly from DATA_STORE
                value = DATA_STORE.read(tag_name)
                tag_values[tag_name] = value
        
        # Skip if no tags to publish
        if not tag_values:
            return
        
        # Format payload
        payload = self._format_payload(tag_values)
        
        # Publish to broker
        topic = self.mapping['topicName']
        qos = self.mapping.get('qos', 0)
        retain = self.mapping.get('retain', False)
        
        self.broker.publish(topic, payload, qos, retain)

    def _format_payload(self, tag_values: Dict[str, Any]) -> str:
        """Format payload based on mapping configuration"""
        format_type = self.mapping.get('format', 'json')
        include_timestamp = self.mapping.get('includeTimestamp', True)
        
        # Add timestamp if requested
        if include_timestamp:
            tag_values['timestamp'] = time.time()
        
        if format_type == 'json':
            return json.dumps(tag_values)
        
        elif format_type == 'csv':
            delimiter = self.mapping.get('delimiter', ',')
            include_headers = self.mapping.get('includeHeaders', True)
            
            keys = list(tag_values.keys())
            values = [str(tag_values[k]) for k in keys]
            
            if include_headers:
                return delimiter.join(keys) + '\n' + delimiter.join(values)
            else:
                return delimiter.join(values)
        
        elif format_type == 'plain':
            # Simple key=value format
            return ' '.join([f"{k}={v}" for k, v in tag_values.items()])
        
        elif format_type == 'xml':
            # Simple XML format
            xml_parts = ['<?xml version="1.0"?>', '<data>']
            for key, value in tag_values.items():
                xml_parts.append(f'  <{key}>{value}</{key}>')
            xml_parts.append('</data>')
            return '\n'.join(xml_parts)
        
        else:
            # Default to JSON
            return json.dumps(tag_values)

    def start(self):
        """Start the publisher thread"""
        if self.thread and self.thread.is_alive():
            return
        
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self):
        """Stop the publisher thread"""
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=2)


class MQTTPublisherServer:
    """
    MQTT Publisher Server - Manages multiple broker connections and publishes
    data from DATA_STORE based on topic mappings using a thread pool.
    """
    
    def __init__(self, datastore_ready: threading.Event):
        self.brokers: Dict[str, MQTTBrokerConnection] = {}
        self.publishers: Dict[str, MQTTPublisher] = {}
        self.mapping_store = MQTTPublisherMapping()
        self.datastore_ready = datastore_ready
        self.stop_event = threading.Event()
        self._lock = threading.RLock()
        
    def update_brokers(self, broker_configs: List[Dict[str, Any]]):
        """Update broker configurations"""
        with self._lock:
            current_broker_ids = {b['id'] for b in broker_configs}
            
            # Stop publishers and disconnect brokers that are no longer in config
            for broker_id in list(self.brokers.keys()):
                if broker_id not in current_broker_ids:
                    self._stop_publishers_for_broker(broker_id)
                    self.brokers[broker_id].disconnect()
                    del self.brokers[broker_id]
            
            # Add or update brokers
            for broker_config in broker_configs:
                broker_id = broker_config['id']
                
                if not broker_config.get('enabled', True):
                    if broker_id in self.brokers:
                        self._stop_publishers_for_broker(broker_id)
                        self.brokers[broker_id].disconnect()
                        del self.brokers[broker_id]
                    continue
                
                if broker_id in self.brokers:
                    if self.brokers[broker_id].config != broker_config:
                        self._stop_publishers_for_broker(broker_id)
                        self.brokers[broker_id].disconnect()
                        broker_conn = MQTTBrokerConnection(broker_config)
                        broker_conn.connect()
                        self.brokers[broker_id] = broker_conn
                else:
                    broker_conn = MQTTBrokerConnection(broker_config)
                    broker_conn.connect()
                    self.brokers[broker_id] = broker_conn
    
    def update_mappings(self, mapping_configs: List[Dict[str, Any]]):
        """Update topic mappings and start/stop publisher threads"""
        with self._lock:
            current_mapping_ids = {m['id'] for m in mapping_configs}
            
            # Stop publishers for removed mappings
            for mapping_id in list(self.publishers.keys()):
                if mapping_id not in current_mapping_ids:
                    self.publishers[mapping_id].stop()
                    del self.publishers[mapping_id]
            
            # Start or update publishers for new/changed mappings
            for mapping_config in mapping_configs:
                mapping_id = mapping_config['id']
                
                if not mapping_config.get('enabled', True):
                    if mapping_id in self.publishers:
                        self.publishers[mapping_id].stop()
                        del self.publishers[mapping_id]
                    continue
                
                broker_id = mapping_config['brokerId']
                if broker_id not in self.brokers:
                    continue
                
                broker = self.brokers[broker_id]
                
                if mapping_id in self.publishers:
                    # If mapping config changed, restart publisher
                    if self.publishers[mapping_id].mapping != mapping_config:
                        self.publishers[mapping_id].stop()
                        publisher = MQTTPublisher(mapping_config, broker, self.datastore_ready)
                        publisher.start()
                        self.publishers[mapping_id] = publisher
                else:
                    # Start new publisher
                    publisher = MQTTPublisher(mapping_config, broker, self.datastore_ready)
                    publisher.start()
                    self.publishers[mapping_id] = publisher
            
            print(f"Updated {len(self.publishers)} MQTT publisher threads")

    def _stop_publishers_for_broker(self, broker_id: str):
        """Stop all publishers associated with a specific broker"""
        for mapping_id, publisher in list(self.publishers.items()):
            if publisher.broker.broker_id == broker_id:
                publisher.stop()
                del self.publishers[mapping_id]

    def stop(self):
        """Stop all publisher threads and disconnect brokers"""
        with self._lock:
            for publisher in self.publishers.values():
                publisher.stop()
            self.publishers.clear()
            
            for broker in self.brokers.values():
                broker.disconnect()
            self.brokers.clear()
        
        print("✓ MQTT Publisher Server stopped")


# Global instance - requires datastore_ready event
datastore_ready_event = threading.Event()
MQTT_PUBLISHER_MAPPING = MQTTPublisherMapping()
mqtt_publisher_server = MQTTPublisherServer(datastore_ready=datastore_ready_event)


def mqtt_publisher_thread(stop_event: threading.Event, broker_configs: List[Dict], mapping_configs: List[Dict]):
    """
    Thread function for MQTT publisher server
    Compatible with the server.py ServiceManager pattern
    """
    global mqtt_publisher_server
    
    # Update configurations
    mqtt_publisher_server.update_brokers(broker_configs)
    mqtt_publisher_server.update_mappings(mapping_configs)
    
    # Start the server
    mqtt_publisher_server.start()
    
    # Wait for stop event
    while not stop_event.is_set():
        time.sleep(1)
    
    # Stop the server
    mqtt_publisher_server.stop()
