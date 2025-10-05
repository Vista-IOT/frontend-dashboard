"use client"

import React from 'react'
import { CSVImportExport, type CSVColumnConfig } from '@/components/common/csv-import-export'
import { dataServiceAPI, isDataServiceError, mapFrontendDataTypeToDataService, mapFrontendRegisterTypeToFunctionCode, mapFrontendDataTypeToModbusType, determineRegisterAccess } from '@/lib/api/data-service'
import { toast } from 'sonner'

// Define the CSV structure for Modbus server tags
export interface ModbusServerTagCSV {
  id?: string
  tagName: string
  registerType: string
  modbusAddress: number
  dataType: string
  access: string
  scalingFactor: number
  endianess: string
  units: string
  description: string
  defaultValue: string | number
}

// Define the full tag structure (what we use internally)
export interface ModbusServerTag extends ModbusServerTagCSV {
  id: string
  tagType: string
  functionCode: number
  dataId?: string
}

// CSV column configuration for Modbus server tags
const csvColumns: CSVColumnConfig<ModbusServerTagCSV>[] = [
  { 
    key: 'tagName', 
    header: 'Tag Name', 
    required: true 
  },
  { 
    key: 'registerType', 
    header: 'Register Type', 
    defaultValue: 'Holding Register',
    transform: (value: string) => {
      const validTypes = ['Coil', 'Discrete Input', 'Input Register', 'Holding Register']
      return validTypes.includes(value) ? value : 'Holding Register'
    }
  },
  { 
    key: 'modbusAddress', 
    header: 'Modbus Address', 
    required: true,
    transform: (value: string) => {
      const parsed = parseInt(value)
      if (isNaN(parsed) || parsed < 1) {
        throw new Error('Address must be a positive integer')
      }
      return parsed
    }
  },
  { 
    key: 'dataType', 
    header: 'Data Type', 
    defaultValue: 'int16',
    transform: (value: string) => {
      const validTypes = ['int16', 'int32', 'float32', 'bool', 'uint16', 'uint32']
      return validTypes.includes(value.toLowerCase()) ? value.toLowerCase() : 'int16'
    }
  },
  { 
    key: 'access', 
    header: 'Access', 
    defaultValue: 'rw',
    transform: (value: string) => {
      return ['r', 'rw'].includes(value.toLowerCase()) ? value.toLowerCase() : 'rw'
    }
  },
  { 
    key: 'scalingFactor', 
    header: 'Scaling Factor', 
    defaultValue: 1.0,
    transform: (value: string) => {
      const parsed = parseFloat(value)
      return isNaN(parsed) ? 1.0 : parsed
    }
  },
  { 
    key: 'endianess', 
    header: 'Endianess', 
    defaultValue: 'big',
    transform: (value: string) => {
      return ['big', 'little'].includes(value.toLowerCase()) ? value.toLowerCase() : 'big'
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
    transform: (value: string) => {
      // Try to parse as number first, fallback to string
      const parsed = parseFloat(value)
      return isNaN(parsed) ? value : parsed
    }
  }
]

interface ModbusCSVIntegrationProps {
  serverTags: ModbusServerTag[]
  onTagsUpdated: (tags: ModbusServerTag[]) => void
  nextAddress: number
  onNextAddressUpdate: (address: number) => void
  isConnected: boolean
  disabled?: boolean
}

export function ModbusCSVIntegration({
  serverTags,
  onTagsUpdated,
  nextAddress,
  onNextAddressUpdate,
  isConnected,
  disabled = false
}: ModbusCSVIntegrationProps) {

  // Convert internal tags to CSV format for export
  const convertTagsForExport = (tags: ModbusServerTag[]): ModbusServerTagCSV[] => {
    return tags.map(tag => ({
      tagName: tag.tagName,
      registerType: tag.registerType,
      modbusAddress: tag.modbusAddress,
      dataType: tag.dataType,
      access: tag.access,
      scalingFactor: tag.scalingFactor,
      endianess: tag.endianess,
      units: tag.units,
      description: tag.description,
      defaultValue: tag.defaultValue
    }))
  }

  // Validate a CSV row
  const validateRow = (row: ModbusServerTagCSV, index: number): string[] => {
    const errors: string[] = []

    // Check for duplicate tag names (within the import batch)
    const tagName = row.tagName?.trim()
    if (!tagName) {
      errors.push('Tag name is required')
    }

    // Check for duplicate addresses (within the import batch and existing tags)
    const existingAddresses = serverTags.map(t => t.modbusAddress)
    if (existingAddresses.includes(row.modbusAddress)) {
      errors.push(`Address ${row.modbusAddress} already exists`)
    }

    // Validate address range
    if (row.modbusAddress < 1 || row.modbusAddress > 65535) {
      errors.push('Address must be between 1 and 65535')
    }

    return errors
  }

  // Handle CSV import
  const handleImport = async (importedTags: ModbusServerTagCSV[]) => {
    if (!isConnected) {
      toast.error('Data-Service not connected. Cannot import tags.')
      return
    }

    if (importedTags.length === 0) {
      toast.error('No valid tags found in CSV file')
      return
    }

    try {
      // Step 1: Bulk register data points using the existing API
      const bulkRegisterRequest = {
        points: importedTags.map(tag => ({
          key: tag.tagName,
          default: tag.defaultValue,
          data_type: mapFrontendDataTypeToDataService(tag.dataType),
          units: tag.units || '',
        })),
        allow_address_conflict: false
      }

      const registerResponse = await dataServiceAPI.bulkRegister(bulkRegisterRequest)
      
      if (isDataServiceError(registerResponse)) {
        throw new Error(registerResponse.error)
      }

      const registerResult = registerResponse.data
      toast.success(`Registered ${registerResult.successful} data points`)
      
      if (registerResult.failed > 0) {
        toast.warning(`${registerResult.failed} data points failed to register`)
        console.warn('Registration errors:', registerResult.errors)
      }

      // Step 2: Create Modbus mappings for successfully registered data points
      const successfulTags: ModbusServerTag[] = []
      const mappingErrors: string[] = []
      
      for (const result of registerResult.results) {
        if (!result.ok) continue

        // Find the corresponding imported tag
        const importedTag = importedTags[result.index]
        if (!importedTag) continue

        try {
          // Create Modbus mapping
          const mappingResponse = await dataServiceAPI.createModbusMapping({
            id: result.id,
            key: result.key,
            register_address: importedTag.modbusAddress,
            function_code: mapFrontendRegisterTypeToFunctionCode(importedTag.registerType),
            data_type: mapFrontendDataTypeToModbusType(importedTag.dataType),
            access: importedTag.access,
            scaling_factor: importedTag.scalingFactor,
            endianess: importedTag.endianess as 'big' | 'little',
            description: importedTag.description || `Imported mapping for ${result.key}`,
          })

          if (isDataServiceError(mappingResponse)) {
            mappingErrors.push(`Failed to create mapping for ${result.key}: ${mappingResponse.error}`)
            continue
          }

          // Add to successful tags
          const newTag: ModbusServerTag = {
            id: result.id,
            tagName: result.key,
            tagType: 'IO', // Default type
            dataType: importedTag.dataType,
            defaultValue: importedTag.defaultValue,
            modbusAddress: importedTag.modbusAddress,
            registerType: importedTag.registerType as any,
            functionCode: mapFrontendRegisterTypeToFunctionCode(importedTag.registerType),
            access: importedTag.access as 'r' | 'rw',
            scalingFactor: importedTag.scalingFactor,
            endianess: importedTag.endianess as 'big' | 'little',
            units: importedTag.units,
            description: importedTag.description,
            dataId: result.id,
          }
          
          successfulTags.push(newTag)

        } catch (error: any) {
          mappingErrors.push(`Error creating mapping for ${result.key}: ${error.message}`)
        }
      }

      // Step 3: Update UI with new tags
      if (successfulTags.length > 0) {
        onTagsUpdated([...serverTags, ...successfulTags])
        
        // Update next address
        const maxAddr = Math.max(...successfulTags.map(t => t.modbusAddress), nextAddress - 1)
        onNextAddressUpdate(maxAddr + 1)
        
        toast.success(`Successfully imported ${successfulTags.length} tags with Modbus mappings`)
      }

      // Show mapping errors if any
      if (mappingErrors.length > 0) {
        toast.error(`${mappingErrors.length} mapping errors occurred`, {
          description: mappingErrors.slice(0, 3).join('; ') + (mappingErrors.length > 3 ? '...' : '')
        })
      }

    } catch (error: any) {
      console.error('CSV import error:', error)
      toast.error(`Import failed: ${error.message}`)
    }
  }

  return (
    <CSVImportExport
      data={convertTagsForExport(serverTags)}
      filename={`modbus-server-tags-${new Date().toISOString().split('T')[0]}.csv`}
      columns={csvColumns}
      onImport={handleImport}
      validateRow={validateRow}
      disabled={disabled}
      generateId={() => `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`}
      className="flex space-x-2"
    />
  )
}

// Export sample CSV content for reference
export const getSampleCSVContent = (): string => {
  const sampleData = [
    {
      tagName: 'reactor_temperature',
      registerType: 'Holding Register',
      modbusAddress: 40001,
      dataType: 'float32',
      access: 'rw',
      scalingFactor: 1.0,
      endianess: 'big',
      units: '°C',
      description: 'Reactor core temperature',
      defaultValue: 25.5
    },
    {
      tagName: 'reactor_pressure',
      registerType: 'Holding Register', 
      modbusAddress: 40003,
      dataType: 'float32',
      access: 'rw',
      scalingFactor: 1.0,
      endianess: 'big',
      units: 'hPa',
      description: 'Reactor pressure sensor',
      defaultValue: 1013.25
    },
    {
      tagName: 'motor_status',
      registerType: 'Coil',
      modbusAddress: 1,
      dataType: 'bool',
      access: 'rw',
      scalingFactor: 1.0,
      endianess: 'big',
      units: '',
      description: 'Motor on/off status',
      defaultValue: 0
    }
  ]

  const headers = csvColumns.map(col => col.header).join(',')
  const rows = sampleData.map(row => 
    csvColumns.map(col => {
      const value = (row as any)[col.key]
      return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
    }).join(',')
  ).join('\n')

  return headers + '\n' + rows
}
