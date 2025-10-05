"use client"

import React from 'react'
import { CSVImportExport, type CSVColumnConfig } from '@/components/common/csv-import-export'
import { dataServiceAPI, isDataServiceError, mapFrontendDataTypeToDataService } from '@/lib/api/data-service'
import { toast } from 'sonner'

// Define the CSV structure for OPC-UA server tags
export interface OPCUAServerTagCSV {
  id?: string
  tagName: string
  nodeId: string
  dataType: string
  accessLevel: string
  timestamps: string
  namespace: number
  units: string
  description: string
  defaultValue: string | number
  browseName?: string
  displayName?: string
}

// Define the full tag structure (what we use internally)
export interface OPCUAServerTag extends OPCUAServerTagCSV {
  id: string
  tagType: string
  valueRank: number
  dataId?: string
}

// CSV column configuration for OPC-UA server tags
const csvColumns: CSVColumnConfig<OPCUAServerTagCSV>[] = [
  { 
    key: 'tagName', 
    header: 'Tag Name', 
    required: true 
  },
  { 
    key: 'nodeId', 
    header: 'Node ID', 
    required: true,
    defaultValue: 'ns=2;s=Variable1',
    transform: (value: string) => {
      // Basic validation for OPC-UA Node ID format
      if (!value.includes('ns=') || !value.includes(';')) {
        return `ns=2;s=${value}` // Auto-format simple strings
      }
      return value
    }
  },
  { 
    key: 'dataType', 
    header: 'Data Type', 
    defaultValue: 'Float',
    transform: (value: string) => {
      const validTypes = ['Boolean', 'Int32', 'Float', 'Double', 'String']
      return validTypes.includes(value) ? value : 'Float'
    }
  },
  { 
    key: 'accessLevel', 
    header: 'Access Level', 
    defaultValue: 'CurrentReadOrWrite',
    transform: (value: string) => {
      const validAccess = ['CurrentRead', 'CurrentWrite', 'CurrentReadOrWrite']
      return validAccess.includes(value) ? value : 'CurrentReadOrWrite'
    }
  },
  { 
    key: 'timestamps', 
    header: 'Timestamps', 
    defaultValue: 'Both',
    transform: (value: string) => {
      const validTimestamps = ['None', 'Server', 'Source', 'Both']
      return validTimestamps.includes(value) ? value : 'Both'
    }
  },
  { 
    key: 'namespace', 
    header: 'Namespace', 
    defaultValue: 2,
    transform: (value: string) => {
      const parsed = parseInt(value)
      return isNaN(parsed) || parsed < 0 ? 2 : parsed
    }
  },
  { 
    key: 'units', 
    header: 'Units', 
    defaultValue: ''
  },
  { 
    key: 'description', 
    header: 'Description', 
    defaultValue: ''
  },
  { 
    key: 'defaultValue', 
    header: 'Default Value', 
    defaultValue: 0,
    transform: (value: string, record: Partial<OPCUAServerTagCSV>) => {
      const dataType = record.dataType || 'Float'
      if (dataType === 'Boolean') {
        return ['true', '1', 'on', 'yes'].includes(value.toLowerCase()) ? true : false
      } else if (dataType === 'String') {
        return value
      } else {
        const parsed = parseFloat(value)
        return isNaN(parsed) ? 0 : parsed
      }
    }
  },
  { 
    key: 'browseName', 
    header: 'Browse Name', 
    defaultValue: '',
    transform: (value: string, record: Partial<OPCUAServerTagCSV>) => {
      return value || record.tagName || ''
    }
  },
  { 
    key: 'displayName', 
    header: 'Display Name', 
    defaultValue: '',
    transform: (value: string, record: Partial<OPCUAServerTagCSV>) => {
      return value || record.tagName || ''
    }
  }
]

// Sample CSV content generator
export function getSampleCSVContent(): string {
  const sampleData: OPCUAServerTagCSV[] = [
    {
      tagName: 'Temperature_01',
      nodeId: 'ns=2;s=Temperature01',
      dataType: 'Float',
      accessLevel: 'CurrentReadOrWrite',
      timestamps: 'Both',
      namespace: 2,
      units: '°C',
      description: 'Temperature sensor 1',
      defaultValue: 25.5,
      browseName: 'Temperature_01',
      displayName: 'Temperature Sensor 1'
    },
    {
      tagName: 'Pressure_01',
      nodeId: 'ns=2;s=Pressure01',
      dataType: 'Float',
      accessLevel: 'CurrentReadOrWrite',
      timestamps: 'Both',
      namespace: 2,
      units: 'bar',
      description: 'Pressure sensor 1',
      defaultValue: 1.013,
      browseName: 'Pressure_01',
      displayName: 'Pressure Sensor 1'
    },
    {
      tagName: 'Motor_Status',
      nodeId: 'ns=2;s=MotorStatus',
      dataType: 'Boolean',
      accessLevel: 'CurrentReadOrWrite',
      timestamps: 'Both',
      namespace: 2,
      units: '',
      description: 'Motor running status',
      defaultValue: false,
      browseName: 'Motor_Status',
      displayName: 'Motor Running Status'
    },
    {
      tagName: 'Counter_Value',
      nodeId: 'ns=2;s=CounterValue',
      dataType: 'Int32',
      accessLevel: 'CurrentReadOrWrite',
      timestamps: 'Both',
      namespace: 2,
      units: 'count',
      description: 'Production counter',
      defaultValue: 0,
      browseName: 'Counter_Value',
      displayName: 'Production Counter'
    }
  ]

  const headers = csvColumns.map(col => col.header).join(',')
  const rows = sampleData.map(row => 
    csvColumns.map(col => {
      const value = row[col.key as keyof OPCUAServerTagCSV] || ''
      // Escape commas and quotes in CSV
      const stringValue = String(value)
      return stringValue.includes(',') || stringValue.includes('"') ? 
        `"${stringValue.replace(/"/g, '""')}"` : stringValue
    }).join(',')
  ).join('\n')

  return `${headers}\n${rows}`
}

// Helper function to convert CSV tags to internal tag structure
export function convertCSVToServerTags(csvTags: OPCUAServerTagCSV[]): OPCUAServerTag[] {
  return csvTags.map((csvTag, index) => ({
    ...csvTag,
    id: csvTag.id || `csv-tag-${Date.now()}-${index}`,
    tagType: 'IO',
    valueRank: -1, // Scalar
    browseName: csvTag.browseName || csvTag.tagName,
    displayName: csvTag.displayName || csvTag.tagName,
  }))
}

// Helper function to convert internal tags to CSV structure
export function convertServerTagsToCSV(serverTags: OPCUAServerTag[]): OPCUAServerTagCSV[] {
  return serverTags.map(tag => ({
    id: tag.id,
    tagName: tag.tagName,
    nodeId: tag.nodeId,
    dataType: tag.dataType,
    accessLevel: tag.accessLevel,
    timestamps: tag.timestamps,
    namespace: tag.namespace,
    units: tag.units || '',
    description: tag.description || '',
    defaultValue: tag.defaultValue,
    browseName: tag.browseName,
    displayName: tag.displayName,
  }))
}

// Generate Data-Service key in format: deviceName:tagId
function generateDataServiceKey(tag: OPCUAServerTagCSV): string {
  // For CSV imports, we'll use a default device name since we don't have that info
  return `OPC-UA-Server:${tag.tagName}`
}

// Main CSV Integration Props
interface OPCUACSVIntegrationProps {
  serverTags: OPCUAServerTag[]
  onTagsUpdated: (tags: OPCUAServerTag[]) => void
  nextNodeId: string
  onNextNodeIdUpdate: (nodeId: string) => void
  isConnected: boolean
  disabled?: boolean
}

export default function OPCUACSVIntegration({
  serverTags,
  onTagsUpdated,
  nextNodeId,
  onNextNodeIdUpdate,
  isConnected,
  disabled = false
}: OPCUACSVIntegrationProps) {

  const handleImport = async (csvTags: OPCUAServerTagCSV[]) => {
    if (csvTags.length === 0) {
      toast.error('No valid tags found in CSV')
      return
    }

    if (!isConnected) {
      // Fallback to local storage for CSV imports
      const convertedTags = convertCSVToServerTags(csvTags)
      onTagsUpdated([...serverTags, ...convertedTags])
      toast.success(`${csvTags.length} tags imported locally`)
      return
    }

    let successCount = 0

    for (const csvTag of csvTags) {
      try {
        // Step 1: Register the data point in Data-Service
        const dataServiceDataType = mapFrontendDataTypeToDataService(csvTag.dataType)
        
        const registerResponse = await dataServiceAPI.registerDataPoint({
          key: generateDataServiceKey(csvTag),
          default: csvTag.defaultValue,
          data_type: dataServiceDataType,
          units: csvTag.units || '',
          allow_address_conflict: false,
        })
        
        if (isDataServiceError(registerResponse)) {
          console.warn(`Failed to register CSV tag ${csvTag.tagName}:`, registerResponse.error)
          continue
        }
        
        const dataId = registerResponse.data.id
        
        // Step 2: Create OPC-UA mapping
        const mappingResponse = await dataServiceAPI.createOpcuaMapping({
          id: dataId,
          key: generateDataServiceKey(csvTag),
          node_id: csvTag.nodeId,
          browse_name: csvTag.browseName || csvTag.tagName,
          display_name: csvTag.displayName || csvTag.tagName,
          data_type: csvTag.dataType,
          value_rank: -1,
          access_level: csvTag.accessLevel,
          timestamps: csvTag.timestamps,
          namespace: csvTag.namespace,
          description: csvTag.description,
        })
        
        if (isDataServiceError(mappingResponse)) {
          console.warn(`Failed to create OPC-UA mapping for CSV tag ${csvTag.tagName}:`, mappingResponse.error)
          continue
        }
        
        successCount++
        
      } catch (error) {
        console.warn(`Error processing CSV tag ${csvTag.tagName}:`, error)
      }
    }

    if (successCount > 0) {
      // Refresh the tags list (this should trigger a re-sync)
      setTimeout(() => {
        // Trigger a refresh of the parent component
        window.location.reload()
      }, 1000)
    }

    // Show results
    if (successCount === csvTags.length) {
      toast.success(`Successfully imported ${successCount} tags to Data-Service OPC-UA server`)
    } else if (successCount > 0) {
      toast.warning(`Imported ${successCount} out of ${csvTags.length} tags. Check console for details.`)
    } else {
      toast.error(`Failed to import tags. Check console for details.`)
    }
  }

  const handleExport = () => {
    const csvTags = convertServerTagsToCSV(serverTags)
    return csvTags
  }

  return (
    <CSVImportExport<OPCUAServerTagCSV>
      columns={csvColumns}
      onImport={handleImport}
      onExport={handleExport}
      exportData={convertServerTagsToCSV(serverTags)}
      disabled={disabled}
      importButtonText="Import OPC-UA Tags"
      exportButtonText="Export OPC-UA Tags"
      sampleFileName="opcua-tags-sample.csv"
    />
  )
}
