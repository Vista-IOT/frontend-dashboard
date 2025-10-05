"use client"

import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { toast } from "sonner"
import { Loader2, Server, Plus, Trash2, Tag, RefreshCw, Activity, AlertCircle, Settings, FileSpreadsheet, Download, Upload, HelpCircle } from "lucide-react"
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Import Data-Service API client
import { 
  dataServiceAPI, 
  isDataServiceError,
  mapFrontendDataTypeToDataService,
  mapFrontendTypeIDToIEC104Type,
  mapFrontendDataTypeToIEC104Type,
  determineIEC104Access,
  type IEC104Mapping,
  type DataServiceResponse
} from "@/lib/api/data-service"

// Import CSV integration
import { IEC104CSVIntegration, type IEC104ServerTag, getSampleCSVContent } from './iec104-csv-integration'

// IEC104 TCP Server configuration schema (aligned with Data-Service)
const serverConfigSchema = z.object({
  enabled: z.boolean().default(false),
  port: z
    .number({ invalid_type_error: "Port must be a number" })
    .min(1, "Port must be >= 1")
    .max(65535, "Port must be <= 65535")
    .default(2404), // Data-Service uses port 2404 by default
})

// Data-Service health status interface
interface DataServiceHealth {
  status: string
  timestamp: number
  uptime_seconds: number
  services: {
    iec104: {
      running: boolean
      port: number
    }
  }
  data_quality: {
    total_points: number
    quality_issues: number
  }
}

type ServerFormValues = z.infer<typeof serverConfigSchema>

export default function IEC104TcpServerForm() {
  const config = useConfigStore((s) => s.config)
  const setConfig = useConfigStore((s) => s.setConfig)
  
  // Server tags state
  const [serverTags, setServerTags] = useState<IEC104ServerTag[]>([])
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [nextAddress, setNextAddress] = useState(1) // Start from IOA 1
  
  // Data-Service integration state
  const [isConnected, setIsConnected] = useState(false)
  const [serverHealth, setServerHealth] = useState<DataServiceHealth | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [existingMappings, setExistingMappings] = useState<Record<string, any>>({})
  const [initialized, setInitialized] = useState(false)
  
  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverConfigSchema),
    defaultValues: {
      enabled: false,
      port: 5020, // Data-Service default port
    },
    mode: "onChange",
  })

  // Check Data-Service connection and sync state - memoized to prevent infinite loops
  const checkDataServiceConnection = useCallback(async () => {
    if (isLoading) return // Prevent concurrent calls

    try {
      const healthResponse = await dataServiceAPI.getDetailedHealth()
      if (healthResponse.ok) {
        setIsConnected(true)
        setServerHealth(healthResponse.data)
        
        // Update form with actual server status
        const actualEnabled = healthResponse.data.services?.iec104?.running || false
        const actualPort = healthResponse.data.services?.iec104?.port || 5020
        
        form.setValue('enabled', actualEnabled, { shouldDirty: false })
        form.setValue('port', actualPort, { shouldDirty: false })
        
      } else {
        setIsConnected(false)
        console.warn('Data-Service not available:', healthResponse.error)
      }
    } catch (error) {
      setIsConnected(false)
      console.warn('Failed to connect to Data-Service:', error)
    }
  }, [form, isLoading])

  const syncExistingMappings = useCallback(async () => {
    try {
      const mappingsResponse = await dataServiceAPI.getIEC104Mappings()
      if (mappingsResponse.ok) {
        const mappings = mappingsResponse.data || {}
        setExistingMappings(mappings)
        
        // Convert existing mappings to server tags for display
        const tags: IEC104ServerTag[] = Object.entries(mappings).map(([dataId, mapping]: [string, any]) => {
          // Map function code to register type
          const getRegisterType = (fc: number): IEC104ServerTag["registerType"] => {
            switch (fc) {
              case 1: return 'M_DP_NA_1'
              case 2: return 'M_ME_NB_1'
              case 3: return 'M_ME_NA_1'
              case 4: return 'M_SP_NA_1'
              default: return 'M_ME_NA_1'
            }
          }

          return {
            id: dataId,
            tagName: mapping.key,
            tagType: 'IO', // Default
            dataType: mapping.data_type || 'int16',
            defaultValue: 0,
            iec104Address: mapping.ioa,
            registerType: getRegisterType(mapping.type),
            functionCode: mapping.type || 3,
            access: mapping.access || 'rw',
            scalingFactor: mapping.scaling_factor || 1.0,
            endianess: mapping.endianess || 'big',
            units: '',
            description: mapping.description || '',
            dataId,
          }
        })
        
        setServerTags(tags)
        
        // Set next address after existing mappings
        if (tags.length > 0) {
          const maxAddr = Math.max(...tags.map(t => t.iec104Address))
          setNextAddress(maxAddr + 1)
        }
      }
    } catch (error) {
      console.warn('Failed to sync existing mappings:', error)
    }
  }, [])

  // Initial data load - only run once
  useEffect(() => {
    if (!initialized) {
      checkDataServiceConnection()
      syncExistingMappings()
      setInitialized(true)
    }
  }, [initialized, checkDataServiceConnection, syncExistingMappings])

  // Periodic health check - separate effect to avoid conflicts
  useEffect(() => {
    if (!initialized) return

    const interval = setInterval(checkDataServiceConnection, 15000) // Check every 15 seconds
    return () => clearInterval(interval)
  }, [initialized, checkDataServiceConnection])

  // Hydrate from existing config (but prioritize Data-Service state) - only when not connected
  useEffect(() => {
    const serverCfg = (config as any)?.services?.iec104TcpServer
    if (serverCfg && !isConnected && initialized) {
      form.reset({
        enabled: Boolean(serverCfg.enabled ?? false),
        port: Number(serverCfg.port ?? 5020),
      })
      
      if (serverCfg.tags && Array.isArray(serverCfg.tags)) {
        setServerTags(serverCfg.tags)
        const maxAddr = Math.max(0, ...serverCfg.tags.map((t: any) => t.iec104Address || 0))
        setNextAddress(maxAddr + 1)
      }
    }
  }, [config, form, isConnected, initialized])

  const onSubmit = async (values: ServerFormValues) => {
    setIsLoading(true)
    
    try {
      // If Data-Service is available, use it
      if (isConnected) {
        if (values.enabled) {
          // Enable the IEC104 service
          const enableResponse = await dataServiceAPI.enableIEC104Service()
          if (isDataServiceError(enableResponse)) {
            throw new Error(enableResponse.error)
          }
          
          toast.success("IEC104 TCP Server enabled via Data-Service")
        } else {
          // Disable the IEC104 service
          const disableResponse = await dataServiceAPI.disableIEC104Service()
          if (isDataServiceError(disableResponse)) {
            throw new Error(disableResponse.error)
          }
          
          toast.success("IEC104 TCP Server disabled via Data-Service")
        }
        
        // Update server health after change
        setTimeout(checkDataServiceConnection, 2000) // Delay to allow service to start/stop
        
      } else {
        // Fallback to local config storage
        const next = {
          ...config,
          services: {
            ...(config as any)?.services,
            iec104TcpServer: {
              ...values,
              tags: serverTags,
            },
          },
        }
        setConfig(next)
        toast.success("IEC104 TCP Server configuration saved locally")
      }
    } catch (error: any) {
      console.error('Error saving IEC104 configuration:', error)
      toast.error(`Failed to save configuration: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Generate Data-Service key in format: deviceName.tagId
  const generateDataServiceKey = (tag: any): string => {
    const deviceName = tag.deviceName || tag.device || "UNKNOWN"
    // Use the existing tag ID instead of generating new timestamp
    return `${deviceName}:${tag.id}`
  }

  const handleAddTags = async (selectedTags: any[]) => {
    if (!Array.isArray(selectedTags) || selectedTags.length === 0) {
      toast.error('No tags selected')
      return
    }

    setIsLoading(true)
    
    try {
      if (!isConnected) {
        // Fallback to local storage behavior for multiple tags
        const newTags: IEC104ServerTag[] = selectedTags.map((selectedTag, index) => ({
          id: selectedTag.id,
          tagName: selectedTag.name,
          tagType: selectedTag.type || 'IO',
          dataType: selectedTag.dataType || 'Analog',
          defaultValue: selectedTag.defaultValue || 0,
          iec104Address: nextAddress + index,
          registerType: selectedTag.dataType === 'Digital' ? 'M_DP_NA_1' : 'M_ME_NA_1',
          functionCode: selectedTag.dataType === 'Digital' ? 1 : 3,
          access: 'rw',
          scalingFactor: 1.0,
          endianess: 'big',
          units: selectedTag.units || '',
          description: `Mapping for ${selectedTag.name}`,
        }))
        
        setServerTags(prev => [...prev, ...newTags])
        setNextAddress(prev => prev + selectedTags.length)
        toast.success(`${selectedTags.length} tags added locally`)
        return
      }

      // Step 1: Decide between single or bulk registration
      if (selectedTags.length === 1) {
        // Use single registration endpoint for better error handling
        await handleSingleTagRegistration(selectedTags[0])
      } else {
        // Use bulk registration endpoint for multiple tags
        await handleBulkTagRegistration(selectedTags)
      }
      
    } catch (error: any) {
      console.error('Error adding tags:', error)
      toast.error(`Failed to add tags: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSingleTagRegistration = async (selectedTag: any) => {
    // Step 1: Register the data point in Data-Service
    const dataServiceDataType = mapFrontendDataTypeToDataService(selectedTag.dataType || 'Analog')
    
    const registerResponse = await dataServiceAPI.registerDataPoint({
      key: generateDataServiceKey(selectedTag),
      default: selectedTag.defaultValue || 0,
      data_type: dataServiceDataType,
      units: selectedTag.units || '',
      allow_address_conflict: false,
    })
    
    if (isDataServiceError(registerResponse)) {
      throw new Error(registerResponse.error)
    }
    
    const dataId = registerResponse.data.id
    
    // Step 2: Create IEC104 mapping
    const registerType = selectedTag.dataType === 'Digital' ? 'M_DP_NA_1' : 'M_ME_NA_1'
    const functionCode = mapFrontendTypeIDToIEC104Type(registerType)
    const iec104DataType = mapFrontendDataTypeToIEC104Type(selectedTag.dataType || 'Analog')
    const access = determineIEC104Access(registerType)
    
    const mappingResponse = await dataServiceAPI.createIEC104Mapping({
      id: dataId,
      key: generateDataServiceKey(selectedTag),
      ioa: nextAddress,
      type: functionCode,
    })
    
    if (isDataServiceError(mappingResponse)) {
      throw new Error(mappingResponse.error)
    }
    
    // Step 3: Update local state
    const newTag: IEC104ServerTag = {
      id: dataId,
      tagName: selectedTag.name,
      tagType: selectedTag.type || 'IO',
      dataType: iec104DataType,
      defaultValue: selectedTag.defaultValue || 0,
      iec104Address: nextAddress,
      registerType,
      functionCode,
      access,
      scalingFactor: 1.0,
      endianess: 'big',
      units: selectedTag.units || '',
      description: `Auto-generated mapping for ${selectedTag.name}`,
      dataId,
    }
    
    setServerTags(prev => [...prev, newTag])
    setNextAddress(prev => prev + 1)
    
    toast.success(`Tag "${selectedTag.name}" added to Data-Service IEC104 server`)
    
    // Refresh mappings to stay in sync
    setTimeout(syncExistingMappings, 1000)
  }

  const handleBulkTagRegistration = async (selectedTags: any[]) => {
    // Step 1: Bulk register data points in Data-Service
    const bulkRegisterRequest = {
      points: selectedTags.map((tag) => ({
        key: generateDataServiceKey(tag),
        default: tag.defaultValue || 0,
        data_type: mapFrontendDataTypeToDataService(tag.dataType || 'Analog'),
        units: tag.units || '',
      })),
      allow_address_conflict: false,
    }
    
    const bulkRegisterResponse = await dataServiceAPI.bulkRegister(bulkRegisterRequest)
    
    if (isDataServiceError(bulkRegisterResponse)) {
      throw new Error(bulkRegisterResponse.error)
    }

    // Step 2: Process results and create IEC104 mappings for successful registrations
    const bulkResult = bulkRegisterResponse.data
    const newTags: IEC104ServerTag[] = []
    let currentAddress = nextAddress

    for (let i = 0; i < selectedTags.length; i++) {
      const selectedTag = selectedTags[i]
      const result = bulkResult.results.find(r => r.index === i)
      
      if (result && result.ok) {
        // Create IEC104 mapping for this successfully registered tag
        const registerType = selectedTag.dataType === 'Digital' ? 'M_DP_NA_1' : 'M_ME_NA_1'
        const functionCode = mapFrontendTypeIDToIEC104Type(registerType)
        const iec104DataType = mapFrontendDataTypeToIEC104Type(selectedTag.dataType || 'Analog')
        const access = determineIEC104Access(registerType)
        
        try {
          const mappingResponse = await dataServiceAPI.createIEC104Mapping({
            id: result.id,
            key: generateDataServiceKey(selectedTag),
            ioa: currentAddress,
            type: functionCode,
          })
          
          if (!isDataServiceError(mappingResponse)) {
            const newTag: IEC104ServerTag = {
              id: result.id,
              tagName: selectedTag.name,
              tagType: selectedTag.type || 'IO',
              dataType: iec104DataType,
              defaultValue: selectedTag.defaultValue || 0,
              iec104Address: currentAddress,
              registerType,
              functionCode,
              access,
              scalingFactor: 1.0,
              endianess: 'big',
              units: selectedTag.units || '',
              description: `Bulk-generated mapping for ${selectedTag.name}`,
              dataId: result.id,
            }
            
            newTags.push(newTag)
            currentAddress++
          } else {
            console.warn(`Failed to create IEC104 mapping for ${selectedTag.name}:`, mappingResponse.error)
          }
        } catch (mappingError) {
          console.warn(`Error creating IEC104 mapping for ${selectedTag.name}:`, mappingError)
        }
      } else {
        console.warn(`Failed to register tag ${selectedTag.name}:`, result?.error || 'Unknown error')
      }
    }

    // Step 3: Update local state with successfully processed tags
    if (newTags.length > 0) {
      setServerTags(prev => [...prev, ...newTags])
      setNextAddress(currentAddress)
    }

    // Show results
    if (bulkResult.successful > 0 && bulkResult.failed === 0) {
      toast.success(`Successfully added ${bulkResult.successful} tags to Data-Service IEC104 server`)
    } else if (bulkResult.successful > 0 && bulkResult.failed > 0) {
      toast.warning(`Added ${bulkResult.successful} tags, ${bulkResult.failed} failed. Check console for details.`)
    } else {
      toast.error(`Failed to add tags. ${bulkResult.errors.join(', ')}`)
    }

    // Refresh mappings to stay in sync
    setTimeout(syncExistingMappings, 1000)
  }

  // Keep the old single-tag method for backward compatibility, but redirect to new method
  const handleAddTag = async (selectedTag: any) => {
    await handleAddTags([selectedTag])
  }

  const handleRemoveTag = async (tagId: string) => {
    const tag = serverTags.find(t => t.id === tagId)
    if (!tag) return

    if (!isConnected) {
      // Fallback to local removal
      setServerTags(prev => prev.filter(t => t.id !== tagId))
      toast.success("Tag removed locally")
      return
    }

    // Note: Data-Service doesn't have a delete mapping endpoint currently
    // We'll remove from local state and warn the user
    setServerTags(prev => prev.filter(t => t.id !== tagId))
    
    toast.warning(`Tag "${tag.tagName}" removed from display. Note: Data-Service mapping still exists. Restart Data-Service to clear all mappings.`)
  }

  const handleTagUpdate = (tagId: string, updates: Partial<IEC104ServerTag>) => {
    setServerTags(prev => prev.map(tag => 
      tag.id === tagId ? { ...tag, ...updates } : tag
    ))
    
    if (isConnected) {
      toast.info("Changes updated locally. Note: Data-Service mappings require service restart to apply changes.")
    }
  }

  const refreshDataServiceStatus = async () => {
    setIsLoading(true)
    try {
      await checkDataServiceConnection()
      await syncExistingMappings()
      toast.success("Data-Service status refreshed")
    } catch (error) {
      toast.error("Failed to refresh Data-Service status")
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to get register type options
  const getRegisterTypeOptions = () => [
    { value: "M_DP_NA_1", label: "M_DP_NA_1 - Double Point Information", functionCode: 1 },
    { value: "M_ME_NB_1", label: "M_ME_NB_1 - Measured Value, Scaled", functionCode: 2 },
    { value: "M_ME_NA_1", label: "M_ME_NA_1 - Measured Value, Normalized", functionCode: 3 },
    { value: "M_SP_NA_1", label: "M_SP_NA_1 - Single Point Information", functionCode: 4 },
  ]

  // Helper function to get data type options
  const getDataTypeOptions = () => [
    { value: "int16", label: "INT16 (16-bit Integer)" },
    { value: "int32", label: "INT32 (32-bit Integer)" },
    { value: "float32", label: "FLOAT32 (32-bit Float)" },
    { value: "bool", label: "BOOL (Boolean)" },
  ]

  // Helper function to download sample CSV
  const downloadSampleCSV = () => {
    const content = getSampleCSVContent()
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', 'iec104-tags-sample.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
    
    toast.success('Sample CSV template downloaded')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5"/> IEC104 TCP Server
                {isConnected ? (
                  <Badge variant="default" className="ml-2">
                    <Activity className="h-3 w-3 mr-1" />
                    Data-Service Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="ml-2">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Local Mode
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isConnected 
                  ? `Connected to Data-Service on port ${serverHealth?.services?.iec104?.port || 5020}. Server is ${serverHealth?.services?.iec104?.running ? 'running' : 'stopped'}.`
                  : "Data-Service unavailable. Configuration will be saved locally."
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshDataServiceStatus}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Server Enabled</div>
                  <div className="text-sm text-muted-foreground">
                    {isConnected 
                      ? "Toggle Data-Service IEC104 server" 
                      : "Toggle local configuration (restart required)"
                    }
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TCP Port</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={65535} 
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))} 
                          disabled={isConnected} // Port is fixed in Data-Service
                        />
                      </FormControl>
                      <FormDescription>
                        {isConnected ? "Port is managed by Data-Service (IEC104_PORT env var)" : "Default is 5020"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col space-y-1 pt-2">
                  <span className="text-sm font-medium">Service Status</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={form.getValues("enabled") ? "default" : "secondary"}>
                      {form.getValues("enabled") ? "Enabled" : "Disabled"}
                    </Badge>
                    {isConnected && (
                      <Badge variant="outline">
                        {Object.keys(existingMappings).length} mappings
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {serverHealth && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium">Uptime</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.floor(serverHealth.uptime_seconds / 60)} minutes
                    </span>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium">Data Points</span>
                    <span className="text-sm text-muted-foreground">
                      {serverHealth.data_quality.total_points}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium">Quality Issues</span>
                    <span className="text-sm text-muted-foreground">
                      {serverHealth.data_quality.quality_issues}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {isConnected 
                  ? "Changes are applied immediately to Data-Service"
                  : "Changes are saved to local configuration"
                }
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => form.reset()}>
                  Reset
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Configuration
                </Button>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {/* Tags Table - Enhanced with CSV Import/Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5"/> Server Tags & Mappings
              </CardTitle>
              <CardDescription>
                Map single or multiple tags to IEC104 register addresses for client access
                {isConnected && ` (${serverTags.length} active mappings)`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* CSV Import/Export */}
              {isConnected && (
                <TooltipProvider>
                  <div className="flex items-center gap-2">
                    <IEC104CSVIntegration
                      serverTags={serverTags}
                      onTagsUpdated={setServerTags}
                      nextAddress={nextAddress}
                      onNextAddressUpdate={setNextAddress}
                      isConnected={isConnected}
                      disabled={isLoading}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={downloadSampleCSV}
                          disabled={isLoading}
                        >
                          <HelpCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Download CSV template with sample data</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              )}
              
              <Button 
                onClick={() => setShowTagDialog(true)}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tag
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {serverTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tags added yet</p>
              <p className="text-sm">Click "Add Tags" to map single or multiple tags to IEC104 addresses</p>
              {isConnected && (
                <p className="text-sm mt-2">
                  Or use <FileSpreadsheet className="h-4 w-4 inline" /> CSV Import for bulk operations
                </p>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Tag Name</TableHead>
                    <TableHead className="w-[200px]">Type ID</TableHead>
                    <TableHead className="w-[150px]">IOA</TableHead>
                    <TableHead className="w-[200px]">Data Type</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Scaling</TableHead>
                    <TableHead>Endianess</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serverTags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell className="font-medium">{tag.tagName}</TableCell>
                      <TableCell >
                        <Select
                          value={tag.registerType}
                          
                          onValueChange={(value) => {
                            const option = getRegisterTypeOptions().find(opt => opt.value === value)
                            if (option) {
                              handleTagUpdate(tag.id, {
                                registerType: value as IEC104ServerTag["registerType"],
                                functionCode: option.functionCode,
                                access: determineIEC104Access(value) as "r" | "rw"
                              })
                            }
                          }}
                          disabled={isConnected && tag.dataId} // Disable if managed by Data-Service
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getRegisterTypeOptions().map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={tag.iec104Address}
                          onChange={(e) => handleTagUpdate(tag.id, { iec104Address: Number(e.target.value) })}
                          className="w-[150px]"
                          min={1}
                          disabled={isConnected && tag.dataId} // Disable if managed by Data-Service
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tag.dataType}
                          onValueChange={(value) => handleTagUpdate(tag.id, { dataType: value })}
                          disabled={isConnected && tag.dataId}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getDataTypeOptions().map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tag.access === 'r' ? 'secondary' : 'default'}>
                          {tag.access === 'r' ? 'Read-Only' : 'Read-Write'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={tag.scalingFactor}
                          onChange={(e) => handleTagUpdate(tag.id, { scalingFactor: Number(e.target.value) })}
                          className="w-16"
                          disabled={isConnected && tag.dataId}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tag.endianess}
                          onValueChange={(value) => handleTagUpdate(tag.id, { endianess: value as "big" | "little" })}
                          disabled={isConnected && tag.dataId}
                        >
                          <SelectTrigger className="w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="big">Big</SelectItem>
                            <SelectItem value="little">Little</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tag.units || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTag(tag.id)}
                          className="text-destructive hover:text-destructive"
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Tag Selection Dialog */}
      <TagSelectionDialog
        open={showTagDialog}
        onOpenChange={setShowTagDialog}
        onSelectTag={handleAddTag}
        onSelectTags={handleAddTags}
        multiSelect={true}
      />
    </div>
  )
}
