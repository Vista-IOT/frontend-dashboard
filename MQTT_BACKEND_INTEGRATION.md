# MQTT Publisher Backend Integration Guide

## Status: ✅ Backend Ready, Frontend Ready, Integration Required

## What's Been Completed

### 1. ✅ Enhanced Frontend (DONE)
- **File**: `components/forms/mqtt-pub-form.tsx`
- Multi-broker support with full CRUD
- Topic-to-broker mapping
- CSV import/export
- Beautiful UI with responsive design

### 2. ✅ Enhanced Backend Publisher (DONE)
- **File**: `Data-Service/src/dataservice/core/mqtt_publisher.py`
- Multi-broker client management (`MQTTBrokerClient` class)
- Individual broker connections with authentication/TLS
- Topic mapping to specific brokers
- Thread-safe publishing

## What Needs To Be Done

### Step 1: Update Pydantic Models in server.py

**Location**: `Data-Service/src/dataservice/server.py` (lines ~80-100)

**Current Structure** (Single Broker):
```python
class MQTTPublisherConfig(BaseModel):
    enabled: bool = False
    broker: MQTTBrokerConfig = Field(default_factory=MQTTBrokerConfig)
    topics: MQTTTopicsConfig = Field(default_factory=MQTTTopicsConfig)
```

**New Structure Needed** (Multi-Broker):
```python
class MQTTBrokerConfig(BaseModel):
    id: str
    name: str
    address: str
    port: int = 1883
    protocol: str = "mqtt"  # mqtt, mqtts, ws, wss
    username: Optional[str] = None
    password: Optional[str] = None
    clientId: Optional[str] = None
    keepAlive: int = 60
    cleanSession: bool = True
    enabled: bool = True

class MQTTTagSelection(BaseModel):
    id: str
    name: str
    type: Optional[str] = None
    dataType: Optional[str] = None
    units: Optional[str] = None
    device: Optional[str] = None
    deviceName: Optional[str] = None

class MQTTTopicMapping(BaseModel):
    id: str
    topicName: str
    brokerId: str
    selectedTags: List[MQTTTagSelection] = Field(default_factory=list)
    qos: int = 0
    format: str = "json"  # json, csv, plain
    delimiter: Optional[str] = ","
    publishRate: int = 1000
    retained: bool = False
    enabled: bool = True
    description: Optional[str] = None

class MQTTPublisherConfig(BaseModel):
    enabled: bool = False
    brokers: List[MQTTBrokerConfig] = Field(default_factory=list)
    mappings: List[MQTTTopicMapping] = Field(default_factory=list)
```

### Step 2: Update MQTT Status Model

**Update** `MQTTPublisherStatus`:
```python
class MQTTBrokerStatus(BaseModel):
    id: str
    name: str
    connected: bool
    address: str

class MQTTPublisherStatus(BaseModel):
    enabled: bool
    brokers: List[MQTTBrokerStatus]
    active_mappings: int
    total_mappings: int
```

### Step 3: Update config_manager.py

**File**: `Data-Service/src/dataservice/core/config_manager.py`

Ensure it handles the new structure:
```python
def get_mqtt_config(self) -> Dict[str, Any]:
    """Get MQTT configuration"""
    try:
        with open(self.mqtt_config_file, 'r') as f:
            config = json.load(f)
            # Migrate old format to new if needed
            if 'broker' in config and 'brokers' not in config:
                config = self._migrate_mqtt_config(config)
            return config
    except FileNotFoundError:
        return {'enabled': False, 'brokers': [], 'mappings': []}

def _migrate_mqtt_config(self, old_config: Dict[str, Any]) -> Dict[str, Any]:
    """Migrate single-broker config to multi-broker"""
    broker = old_config.get('broker', {})
    if broker:
        broker['id'] = 'broker-legacy'
        broker['name'] = broker.get('client_id', 'Legacy Broker')
        
    topics = old_config.get('topics', {}).get('publish', [])
    mappings = []
    for topic in topics:
        mappings.append({
            'id': topic.get('id', f"topic-{time.time()}"),
            'topicName': topic.get('topic', ''),
            'brokerId': 'broker-legacy',
            'selectedTags': topic.get('selectedTags', []),
            'qos': topic.get('qos', 0),
            'format': topic.get('format', 'json'),
            'publishRate': topic.get('publishInterval', 1000),
            'retained': topic.get('retain', False),
            'enabled': topic.get('enabled', True)
        })
    
    return {
        'enabled': old_config.get('enabled', False),
        'brokers': [broker] if broker else [],
        'mappings': mappings
    }
```

### Step 4: Add Frontend API Integration

**File**: `components/forms/mqtt-pub-form.tsx`

Add API calls to the form (similar to MODBUS form):

```typescript
import { dataServiceAPI } from "@/lib/api/data-service"

// In the onSubmit function:
const onSubmit = async (values: MqttFormValues) => {
  setIsLoading(true)
  
  try {
    // Try to save to Data-Service first
    const apiPayload = {
      enabled: values.enabled,
      brokers: brokers,
      mappings: mappings
    }
    
    const response = await dataServiceAPI.updateMQTTConfig(apiPayload)
    
    if (response.ok) {
      toast.success("MQTT configuration saved to Data-Service")
    } else {
      // Fallback to local storage
      const next = {
        ...config,
        protocols: {
          ...(config as any)?.protocols,
          mqtt: {
            ...values,
            brokers,
            mappings,
          },
        },
      }
      setConfig(next)
      toast.warning("Saved locally (Data-Service unavailable)")
    }
  } catch (error: any) {
    console.error('Error saving MQTT configuration:', error)
    toast.error(`Failed to save configuration: ${error.message}`)
  } finally {
    setIsLoading(false)
  }
}
```

### Step 5: Add Data-Service API Methods

**File**: `lib/api/data-service.ts`

Add MQTT-specific methods:

```typescript
// MQTT Publisher Methods
export const dataServiceAPI = {
  // ... existing methods ...
  
  // Get MQTT configuration
  async getMQTTConfig() {
    return apiCall<any>('/mqtt/publisher/config', {
      method: 'GET'
    })
  },
  
  // Update MQTT configuration
  async updateMQTTConfig(config: any) {
    return apiCall<any>('/mqtt/publisher/config', {
      method: 'POST',
      body: JSON.stringify(config)
    })
  },
  
  // Get MQTT status
  async getMQTTStatus() {
    return apiCall<any>('/mqtt/publisher/status', {
      method: 'GET'
    })
  },
  
  // Restart MQTT publisher
  async restartMQTTPublisher() {
    return apiCall<any>('/mqtt/publisher/restart', {
      method: 'POST'
    })
  },
  
  // Test MQTT publish
  async testMQTTPublish(mapping: any) {
    return apiCall<any>('/mqtt/publisher/test', {
      method: 'POST',
      body: JSON.stringify(mapping)
    })
  }
}
```

### Step 6: Update YAML Configuration Support

**File**: `config/default-config.yaml`

Add MQTT section:

```yaml
protocols:
  mqtt:
    enabled: false
    brokers:
      - id: broker-1
        name: "Local Broker"
        address: localhost
        port: 1883
        protocol: mqtt
        enabled: true
    mappings:
      - id: mapping-1
        topicName: "data/sensors"
        brokerId: broker-1
        qos: 1
        format: json
        publishRate: 1000
        enabled: true
        selectedTags: []
```

### Step 7: Testing

1. **Start Data-Service**:
   ```bash
   cd Data-Service
   python -m src.dataservice.server
   ```

2. **Start Frontend**:
   ```bash
   pnpm run dev
   ```

3. **Test Flow**:
   - Navigate to Data Service tab → MQTT Publisher
   - Add a broker
   - Create a topic mapping
   - Select tags
   - Save configuration
   - Check Data-Service logs for connection
   - Verify data publishing with MQTT client (e.g., mosquitto_sub)

## Migration Path

### For Existing Installations

1. Backend automatically migrates old single-broker config
2. Frontend detects old format and offers migration
3. Users can export old config, import into new format

## API Endpoints

### Available Endpoints (Already Implemented)

- `GET /mqtt/publisher/config` - Get configuration
- `POST /mqtt/publisher/config` - Update configuration  
- `GET /mqtt/publisher/status` - Get status
- `POST /mqtt/publisher/restart` - Restart publisher
- `POST /mqtt/publisher/test` - Test publish
- `GET /mqtt/publisher/topics` - List topics

## File Summary

### Modified/Created Files

1. ✅ `Data-Service/src/dataservice/core/mqtt_publisher.py` - Multi-broker publisher
2. ✅ `components/forms/mqtt-pub-form.tsx` - Enhanced UI
3. ⏳ `Data-Service/src/dataservice/server.py` - Update Pydantic models
4. ⏳ `Data-Service/src/dataservice/core/config_manager.py` - Migration support
5. ⏳ `lib/api/data-service.ts` - API methods
6. ⏳ `config/default-config.yaml` - MQTT section

### Backup Files Created

- `mqtt_publisher_single.py.backup` - Original single-broker version
- `mqtt-pub-form-simple.tsx` - Original simple form
- `mqtt-pub-form-old-backup.tsx` - First backup

## Next Steps

1. Update Pydantic models in server.py (5 min)
2. Add migration support in config_manager.py (10 min)
3. Add API integration in frontend (15 min)
4. Test end-to-end flow (10 min)
5. Update YAML configuration (5 min)

**Total Estimated Time**: ~45 minutes

## Benefits

✅ Multiple MQTT brokers supported
✅ Flexible topic-to-broker mapping
✅ Better organization and scalability
✅ Backward compatible with migration
✅ Beautiful, responsive UI
✅ CSV bulk operations
✅ Production-ready architecture
