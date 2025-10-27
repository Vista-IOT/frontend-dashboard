# MQTT Publisher Form - Data Persistence & Tag Selection Guide

## Overview
The new MQTT Publisher form now implements **complete data persistence** following the same patterns as Modbus and SNMP forms. All configuration is automatically saved to Zustand store and persists across page reloads.

---

## Data Persistence Architecture

### 1. **Initial Config Loading**

When the form component mounts, it loads existing configuration from the Zustand store:

```typescript
// Load initial config from Zustand store
const getInitialConfig = () => {
  const config = getConfig()
  const mqttConfig = config?.protocols?.mqtt
  return {
    enabled: mqttConfig?.enabled || false,
    brokers: mqttConfig?.brokers || [],
    mappings: mqttConfig?.mappings || [],
  }
}

const form = useForm<MqttPubFormValues>({
  resolver: zodResolver(mqttPubFormSchema),
  defaultValues: getInitialConfig()
})

// Load config on mount
useEffect(() => {
  const initialConfig = getInitialConfig()
  form.reset(initialConfig)
}, [])
```

**Key Points:**
- ✅ Loads from `config.protocols.mqtt` path in Zustand
- ✅ Provides sensible defaults if no config exists
- ✅ Resets form on component mount to ensure fresh data

### 2. **Form State Management**

The form watches for changes to brokers and mappings arrays:

```typescript
const brokers = form.watch("brokers") || []
const mappings = form.watch("mappings") || []
```

**Benefits:**
- Real-time UI updates when data changes
- Tables automatically reflect new/edited/deleted items
- No manual state synchronization needed

### 3. **Saving Configuration**

When user clicks "Save Configuration", data is persisted to Zustand:

```typescript
const onSubmit = async (values: MqttPubFormValues) => {
  setIsSaving(true)
  try {
    // Save to Zustand store at the correct path
    updateConfig(['protocols', 'mqtt'], {
      enabled: values.enabled,
      brokers: values.brokers,
      mappings: values.mappings
    })
    
    toast.success('MQTT Publisher configuration saved successfully!', {
      duration: 3000
    })
  } catch (error) {
    console.error('Error saving MQTT configuration:', error)
    toast.error('Failed to save MQTT configuration', {
      duration: 5000
    })
  } finally {
    setIsSaving(false)
  }
}
```

**Data Flow:**
1. User clicks "Save Configuration" button
2. Form validation runs (Zod schemas)
3. `updateConfig()` updates Zustand store
4. Store persists to localStorage/backend
5. Success toast notification shown
6. Data persists across page reloads

---

## Multiple Tag Selection

### 1. **Tag Selection Dialog Integration**

The topic mapping modal now supports **multiple tag selection** like Modbus:

```typescript
// Open tag selector
const openTagSelector = (mappingIndex: number) => {
  setCurrentMappingIndex(mappingIndex)
  setShowTagSelector(true)
}

// Handle tags selected
const handleTagsSelected = (tags: any[]) => {
  if (currentMappingIndex !== null) {
    const updatedMappings = [...mappings]
    updatedMappings[currentMappingIndex].selectedTags = tags
    form.setValue("mappings", updatedMappings)
  }
  setShowTagSelector(false)
}
```

### 2. **Enhanced Tag Display**

Tags are now displayed with rich information:

```typescript
{formData.selectedTags && formData.selectedTags.length > 0 ? (
  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/30">
    {formData.selectedTags.map((tag, idx) => (
      <div key={tag.id} className="flex items-center justify-between bg-background p-3 rounded border">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{tag.name}</p>
          <div className="flex gap-2 mt-1 flex-wrap">
            {tag.dataType && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                {tag.dataType}
              </span>
            )}
            {tag.type && (
              <span className="text-xs bg-secondary/10 text-secondary-foreground px-2 py-0.5 rounded">
                {tag.type}
              </span>
            )}
          </div>
          {tag.description && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{tag.description}</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setFormData({
              ...formData,
              selectedTags: formData.selectedTags?.filter((_, i) => i !== idx)
            })
          }}
          className="ml-2 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    ))}
  </div>
) : (
  <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-lg bg-muted/20">
    <p className="text-sm text-muted-foreground text-center">No tags selected yet</p>
    <p className="text-xs text-muted-foreground text-center mt-1">Click "Add Tags" to select tags for publishing</p>
  </div>
)}
```

**Features:**
- ✅ Display tag name, data type, and description
- ✅ Visual badges for tag metadata
- ✅ Remove individual tags with X button
- ✅ Empty state with helpful message
- ✅ Scrollable list (max-height: 16rem)
- ✅ Hover effects for better UX

### 3. **Tag Selection Flow**

**Step-by-step process:**

1. **User clicks "Add Tags" button** in topic mapping modal
2. **Tag selector dialog opens** with available tags
3. **User selects multiple tags** (same as Modbus form)
4. **Selected tags appear** in the modal with rich display
5. **User can remove tags** individually
6. **User saves mapping** with selected tags
7. **Tags persist** when configuration is saved

---

## Data Structure

### Broker Configuration
```typescript
interface MqttBroker {
  id: string
  name: string
  address: string
  port: number
  clientId: string
  keepalive: number
  cleanSession: boolean
  protocol: "mqtt" | "mqtts" | "ws" | "wss"
  auth: {
    enabled: boolean
    username?: string
    password?: string
  }
  tls: {
    enabled: boolean
    verifyServer: boolean
    allowInsecure: boolean
    certFile?: string
    keyFile?: string
    caFile?: string
  }
  enabled: boolean
}
```

### Topic Mapping Configuration
```typescript
interface TopicBrokerMapping {
  id: string
  topicName: string
  brokerId: string
  selectedTags: Array<{
    id: string
    name: string
    type?: string
    description?: string
    dataType?: string
    path?: string
  }>
  qos: number
  retain: boolean
  publishInterval: number
  format: "json" | "csv" | "plain" | "xml"
  delimiter?: string
  includeTimestamp: boolean
  includeHeaders: boolean
  enabled: boolean
}
```

### Complete MQTT Configuration
```typescript
interface MqttPubFormValues {
  enabled: boolean
  brokers: MqttBroker[]
  mappings: TopicBrokerMapping[]
}
```

---

## Persistence Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Page Load / Mount                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  getInitialConfig() reads from Zustand store                │
│  config.protocols.mqtt                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Form initializes with loaded data                          │
│  useEffect() calls form.reset(initialConfig)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  User modifies form (add/edit/delete brokers/mappings)      │
│  form.watch() updates UI in real-time                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  User clicks "Save Configuration"                           │
│  onSubmit() triggered                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Zod validation runs                                        │
│  Validates all brokers and mappings                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  updateConfig(['protocols', 'mqtt'], values)                │
│  Saves to Zustand store                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Zustand persists to localStorage/backend                   │
│  Toast notification shown                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Page reload / navigation                                   │
│  Data persists and reloads on next visit                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Comparison with Other Forms

### Modbus Form Pattern
- ✅ Uses `updateConfig(['protocols', 'modbus'], values)`
- ✅ Loads initial config from Zustand on mount
- ✅ Supports multiple tag selection
- ✅ Persists across page reloads

### SNMP Form Pattern
- ✅ Uses `updateConfig(['protocols', 'snmp'], values)`
- ✅ Loads initial config from Zustand on mount
- ✅ Supports multiple tag selection with tree structure
- ✅ Persists across page reloads

### New MQTT Form Pattern
- ✅ Uses `updateConfig(['protocols', 'mqtt'], values)`
- ✅ Loads initial config from Zustand on mount
- ✅ **Now supports multiple tag selection** ✨
- ✅ **Persists across page reloads** ✨
- ✅ Follows same architecture as Modbus/SNMP

---

## Testing Data Persistence

### Test Case 1: Add and Save Broker
1. Open MQTT Publisher form
2. Click "Add Broker"
3. Fill in broker details
4. Click "Add Broker" to save
5. Click "Save Configuration"
6. Reload page
7. **Expected**: Broker data persists

### Test Case 2: Add Mapping with Tags
1. Add at least one broker
2. Click "Add Mapping"
3. Fill in topic details
4. Click "Add Tags"
5. Select multiple tags
6. Click "Add Mapping" to save
7. Click "Save Configuration"
8. Reload page
9. **Expected**: Mapping and tags persist

### Test Case 3: Edit Existing Configuration
1. Add broker and mapping
2. Save configuration
3. Reload page
4. Click "Edit" on broker row
5. Modify broker settings
6. Click "Update Broker"
7. Click "Save Configuration"
8. Reload page
9. **Expected**: Changes persist

### Test Case 4: Delete Items
1. Add broker and mapping
2. Save configuration
3. Click "Delete" on broker row
4. Click "Save Configuration"
5. Reload page
6. **Expected**: Deleted broker is gone

---

## Troubleshooting

### Issue: Data not persisting after save
**Solution**: 
- Check browser console for errors
- Verify Zustand store is properly initialized
- Check that `updateConfig()` is being called
- Verify localStorage is enabled

### Issue: Form shows empty on reload
**Solution**:
- Check that `getInitialConfig()` is reading correct path
- Verify Zustand store has data: `getConfig().protocols.mqtt`
- Check that `useEffect()` is calling `form.reset()`

### Issue: Tags not showing in mapping
**Solution**:
- Verify `TagSelectionDialog` is properly imported
- Check that `handleTagsSelected()` is being called
- Verify `currentMappingIndex` is set correctly
- Check that tags array is not undefined

### Issue: Validation errors on save
**Solution**:
- Check Zod schema validation messages
- Verify all required fields are filled
- Check that broker IDs match in mappings
- Verify tag objects have required properties

---

## Key Implementation Details

### 1. **Zustand Store Integration**
```typescript
const { updateConfig, getConfig } = useConfigStore()
```
- `getConfig()` retrieves full configuration
- `updateConfig(path, data)` updates at specific path
- Automatically persists to localStorage

### 2. **Form Validation**
```typescript
const form = useForm<MqttPubFormValues>({
  resolver: zodResolver(mqttPubFormSchema),
  defaultValues: getInitialConfig()
})
```
- Zod schemas validate all data types
- Resolver integrates with React Hook Form
- Validation runs before submission

### 3. **Real-time Updates**
```typescript
const brokers = form.watch("brokers") || []
const mappings = form.watch("mappings") || []
```
- `watch()` subscribes to form value changes
- Tables re-render automatically
- No manual state sync needed

### 4. **Modal Integration**
```typescript
<MQTTTopicMappingModal
  open={showMappingModal}
  onOpenChange={setShowMappingModal}
  onSave={saveMapping}
  brokers={brokers}
  initialData={editingMappingIndex !== null ? mappings[editingMappingIndex] : null}
  onOpenTagSelector={() => {
    setShowMappingModal(false)
    setShowTagSelector(true)
  }}
/>
```
- Modals receive current form data
- Changes update form state
- Tag selector integrates seamlessly

---

## Summary

✅ **Data Persistence**: Configuration persists across page reloads
✅ **Multiple Tags**: Support for selecting multiple tags per mapping
✅ **Rich Display**: Tags shown with name, type, and description
✅ **Consistent Pattern**: Follows Modbus/SNMP form architecture
✅ **Validation**: Zod schemas ensure data integrity
✅ **User Feedback**: Toast notifications for success/error
✅ **Easy Management**: Add/edit/delete operations are intuitive

The new MQTT Publisher form now provides a complete, production-ready solution for managing MQTT configurations with full data persistence! 🎉
