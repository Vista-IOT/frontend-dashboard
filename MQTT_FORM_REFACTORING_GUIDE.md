# MQTT Publisher Form Refactoring - Integration Guide

## 📦 New Files Created

### 1. Broker Configuration Modal
**File**: `components/dialogs/mqtt-broker-modal.tsx`
- **Component**: `MQTTBrokerModal`
- **Exports**: `MqttBroker` interface
- **Purpose**: Modal dialog for adding/editing MQTT brokers

### 2. Topic Mapping Modal
**File**: `components/dialogs/mqtt-topic-mapping-modal.tsx`
- **Component**: `MQTTTopicMappingModal`
- **Exports**: `TopicBrokerMapping` interface
- **Purpose**: Modal dialog for adding/editing topic-to-broker mappings

### 3. Refactored Main Form
**File**: `components/forms/mqtt-pub-form-new.tsx`
- **Component**: `MQTTPubForm`
- **Purpose**: Main form with tabular display of brokers and mappings

## 🔄 How to Integrate

### Step 1: Update Your Import
Find where you're importing the old MQTT form and update it:

```typescript
// OLD - Remove this
import { MQTTPubForm } from "@/components/forms/mqtt-pub-form"

// NEW - Use this instead
import { MQTTPubForm } from "@/components/forms/mqtt-pub-form-new"
```

### Step 2: Verify Dependencies
All required UI components are already available in your project:
- ✅ `@/components/ui/button`
- ✅ `@/components/ui/input`
- ✅ `@/components/ui/select`
- ✅ `@/components/ui/dialog`
- ✅ `@/components/ui/checkbox`
- ✅ `@/components/ui/card`
- ✅ `@/components/ui/table`
- ✅ `@/components/ui/badge`
- ✅ `@/components/ui/separator`
- ✅ `@/components/dialogs/tag-selection-dialog`
- ✅ `react-hook-form`
- ✅ `zod`
- ✅ `sonner` (toast notifications)
- ✅ `lucide-react` (icons)

### Step 3: Test the New Form
1. Navigate to the MQTT configuration section
2. Click "Add Broker" - should open the broker modal
3. Fill in broker details across the organized sections
4. Click "Add Broker" to save
5. Broker should appear in the table
6. Click "Add Mapping" to create topic mappings
7. Select broker and configure topic settings
8. Add tags via the tag selector
9. Save the complete configuration

## 📋 Features Comparison

### Old Form (mqtt-pub-form.tsx)
- ❌ All fields on single page
- ❌ Cluttered UI with nested sections
- ❌ Difficult to manage multiple brokers
- ❌ No clear visual separation
- ❌ Hard to scan configuration

### New Form (mqtt-pub-form-new.tsx)
- ✅ Modular dialog-based approach
- ✅ Clean tabular display
- ✅ Easy to add/edit/remove items
- ✅ Clear visual hierarchy
- ✅ Consistent with other forms (Modbus, OPC-UA, etc.)
- ✅ Better mobile responsiveness
- ✅ Organized sections in modals
- ✅ Visual indicators (badges, status)

## 🎨 UI Components Used

### Broker Modal Sections
1. **Basic Configuration**
   - Broker Name, Address, Port, Protocol
   - Client ID, Keep Alive, Clean Session

2. **Authentication**
   - Toggle to enable/disable
   - Username & Password fields

3. **TLS/SSL Configuration**
   - Toggle to enable/disable
   - Verify Server, Allow Insecure options
   - Certificate file paths (CA, Client Cert, Client Key)

### Topic Mapping Modal Sections
1. **Topic Configuration**
   - Topic Name, Broker Selection

2. **Publishing Settings**
   - QoS Level (0-2), Publish Interval
   - Format (JSON/CSV/Plain/XML), Retain flag
   - Include Timestamp option

3. **Format-Specific Options**
   - CSV Delimiter (when format=csv)
   - Include Headers (when format=csv)

4. **Tags Section**
   - Add/Remove tags
   - Visual tag cards with data type display

### Main Form Sections
1. **Enable/Disable Toggle**
   - Top-level switch to enable MQTT publisher

2. **Brokers Table**
   - Columns: Name, Address, Port, Protocol, Auth, TLS, Status, Actions
   - Actions: Edit, Delete
   - Empty state with helpful message

3. **Topic Mappings Table**
   - Columns: Topic, Broker, Format, QoS, Tags, Interval, Status, Actions
   - Actions: Edit, Delete
   - Empty state with helpful message

## 🔌 API Integration

### State Management
```typescript
// Updates Zustand store at this path:
updateConfig(['protocols', 'mqtt'], values)
```

### Configuration Structure
```typescript
{
  enabled: boolean,
  brokers: [
    {
      id: string,
      name: string,
      address: string,
      port: number,
      clientId: string,
      keepalive: number,
      cleanSession: boolean,
      protocol: "mqtt" | "mqtts" | "ws" | "wss",
      auth: { enabled, username?, password? },
      tls: { enabled, verifyServer, allowInsecure, certFile?, keyFile?, caFile? },
      enabled: boolean
    }
  ],
  mappings: [
    {
      id: string,
      topicName: string,
      brokerId: string,
      selectedTags: Array<{ id, name, dataType?, ... }>,
      qos: 0 | 1 | 2,
      retain: boolean,
      publishInterval: number,
      format: "json" | "csv" | "plain" | "xml",
      delimiter?: string,
      includeTimestamp: boolean,
      includeHeaders: boolean,
      enabled: boolean
    }
  ]
}
```

## 🚀 Deployment Checklist

- [ ] Update imports in your routing/dashboard file
- [ ] Test adding a new broker
- [ ] Test editing an existing broker
- [ ] Test deleting a broker
- [ ] Test adding a topic mapping
- [ ] Test editing a topic mapping
- [ ] Test deleting a topic mapping
- [ ] Test tag selection in mappings
- [ ] Test form submission/save
- [ ] Verify data persistence in Zustand store
- [ ] Test on mobile/tablet devices
- [ ] Verify all toast notifications appear

## 📝 Notes

- The new form maintains all functionality from the old form
- All data structures are compatible with the backend
- Form validation uses Zod schemas (same as before)
- Toast notifications use Sonner (same as before)
- Tag selection uses existing TagSelectionDialog component
- No breaking changes to the API or data format

## ❓ Troubleshooting

### Modal doesn't open
- Check that `showBrokerModal` state is being set correctly
- Verify Dialog component is imported from `@/components/ui/dialog`

### Tags not appearing in mapping
- Ensure `TagSelectionDialog` is properly imported
- Check that `handleTagsSelected` callback is being called
- Verify `currentMappingIndex` is set correctly

### Table not updating
- Ensure `form.setValue()` is being called to update form state
- Check that `brokers` and `mappings` are being watched correctly
- Verify Zod schema validation is passing

### Styling issues
- Ensure Tailwind CSS is properly configured
- Check that all UI components are imported correctly
- Verify Badge, Badge variants are available

## 📞 Support

For issues or questions about the refactored form:
1. Check the component files for inline comments
2. Review the Zod schemas for data structure
3. Verify all imports are correct
4. Check browser console for TypeScript/React errors
