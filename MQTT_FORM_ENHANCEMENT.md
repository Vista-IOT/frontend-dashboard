# MQTT Publisher Form Enhancement

## Summary
Enhanced the MQTT Publisher form in the Data Service tab to match the MODBUS Server form architecture with comprehensive broker management, topic mapping, and CSV import/export functionality.

## Changes Made

### 1. Enhanced UI Structure
- **Global Toggle**: MQTT Enable/Disable switch at the top with status indicators
- **Status Dashboard**: Shows enabled/disabled status, number of brokers, and number of mappings
- **Three-Card Layout**:
  1. Main configuration card with enable toggle
  2. Broker management card with inline table editing
  3. Topic mapping card with tag selection

### 2. Broker Management (Tabular CRUD)
- **Add/Remove Brokers**: Create and delete broker connections
- **Inline Editing**: Edit all broker properties directly in the table
  - Name
  - Address
  - Port (1-65535)
  - Protocol (mqtt, mqtts, ws, wss)
  - Client ID
  - Username
  - Keep Alive (seconds)
  - Enabled toggle per broker
- **CSV Import/Export**: Bulk operations for broker management
  - Import multiple brokers from CSV
  - Export current brokers to CSV
  - Download sample CSV template

### 3. Topic Mapping Management (Tabular CRUD)
- **Add/Remove Mappings**: Create and delete topic-to-broker mappings
- **Inline Editing**: Edit all mapping properties in the table
  - Topic Name
  - Broker Selection (dropdown of configured brokers)
  - QoS (0, 1, 2)
  - Format (JSON, CSV, Plain)
  - Publish Rate (milliseconds)
  - Retained message toggle
  - Enabled toggle per mapping
- **Tag Selection**: Multi-select dialog to choose IO tags for each topic
- **CSV Import/Export**: Bulk operations for topic mappings
  - Import multiple mappings from CSV
  - Export current mappings to CSV
  - Download sample CSV template with proper broker references

### 4. CSV Integration
The form leverages the existing `mqtt-csv-integration.tsx` which provides:
- **MQTTBrokerCSVIntegration**: Handles broker import/export
- **MQTTTopicCSVIntegration**: Handles topic mapping import/export
- Validation on import (duplicate detection, broker reference validation)
- Sample CSV templates with example data

### 5. Configuration Storage
- Configuration is saved to the config store under `protocols.mqtt`
- Structure:
  ```json
  {
    "enabled": true,
    "brokers": [...],
    "mappings": [...]
  }
  ```
- Brokers have unique IDs for stable references
- Mappings reference brokers by ID (not name) for consistency

## Files Modified

1. **`components/forms/mqtt-pub-form.tsx`**: Complete rewrite
   - Old version backed up as `mqtt-pub-form-old-backup.tsx`
   - New implementation follows MODBUS Server form pattern
   
2. **`components/forms/mqtt-csv-integration.tsx`**: Already existed
   - Provides CSV import/export utilities
   - Includes validation logic

## Key Features

### User Experience
- ✅ Enable/disable MQTT publishing with one toggle
- ✅ Inline table editing - no modal dialogs required
- ✅ Instant feedback with toast notifications
- ✅ Visual status indicators (badges, switches)
- ✅ Empty state messages with helpful guidance
- ✅ Responsive layout with scroll areas for large datasets

### Data Management
- ✅ Full CRUD operations for brokers
- ✅ Full CRUD operations for topic mappings
- ✅ Automatic cleanup (removing a broker removes its mappings)
- ✅ CSV bulk import/export for both brokers and topics
- ✅ Validation on CSV import
- ✅ Sample CSV templates available

### Tag Integration
- ✅ Multi-select tag dialog
- ✅ Tag count display in mapping table
- ✅ Selected tags stored with each mapping

## Testing
- ✅ Build successful (`npm run build`)
- ✅ No TypeScript errors
- ✅ Compatible with existing imports in `dataService.tsx`
- ✅ CSV integration utilities already tested

## Usage Example

1. **Enable MQTT Publishing**: Toggle the switch at the top
2. **Add a Broker**: 
   - Click "Add Broker"
   - Edit broker details inline in the table
   - Or use CSV import for bulk broker addition
3. **Create Topic Mappings**:
   - Click "Add Mapping" 
   - Select broker from dropdown
   - Edit topic name and settings inline
   - Click "Select Tags" to choose IO tags
4. **Save Configuration**: Click "Save Configuration" button
5. **Export/Import**: Use CSV buttons to backup or restore configuration

## Architecture Inspiration
This implementation closely follows the MODBUS Server form pattern:
- Same card structure
- Same table-based inline editing
- Same CSV integration approach
- Same empty state handling
- Same validation and error handling patterns

## Next Steps (Optional)
- Add Data-Service API integration (like MODBUS form has)
- Add connection status indicators per broker
- Add test publish functionality
- Add topic subscription management
- Add MQTT message preview/monitoring
