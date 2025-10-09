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
import { Loader2, Server, Plus, Trash2, Tag, RefreshCw, Activity, AlertCircle, Settings, FileSpreadsheet, Download, Upload, HelpCircle, Database, MapPin } from "lucide-react"
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import OPCUACSVIntegration, { getSampleCSVContent, type OPCUAServerTag } from "./opcua-csv-integration"

// Import Data-Service API client
import { dataServiceAPI, isDataServiceError, type DataServiceResponse } from "@/lib/api/data-service"

// OPC-UA Server configuration schema (aligned with Data-Service)
const serverConfigSchema = z.object({
  enabled: z.boolean().default(false),
  port: z
    .number({ invalid_type_error: "Port must be a number" })
    .min(1, "Port must be >= 1")
    .max(65535, "Port must be <= 65535")
    .default(4840), // Data-Service uses port 4840 by default for OPC-UA
})

// Data-Service health status interface
interface DataServiceHealth {
  status: string
  timestamp: number
  uptime_seconds: number
  services: {
    opcua: {
      running: boolean
      port: number
    }
  }
  data_quality: {
    total_points: number
    quality_issues: number
  }
}

// Data-Service data point interface
interface DataServiceDataPoint {
  key: string
  address: number
  data_type: string
  units: string
  current_value: any
  quality: string
}

// OPC-UA Mapping interface (Data-Service format)
interface OPCUAMapping {
  key: string
  node_id?: string // Optional - backend auto-generates if not provided
  browse_name: string
  display_name: string
  data_type: string
  value_rank: number
  access_level: string
  timestamps: string
  namespace: number
  description: string
}

type ServerFormValues = z.infer<typeof serverConfigSchema>

export default function OpcuaTcpServerForm() {
  const config = useConfigStore((s) => s.config)
  const setConfig = useConfigStore((s) => s.setConfig)
  
  // Server tags state
  const [serverTags, setServerTags] = useState<OPCUAServerTag[]>([])
  const [showTagDialog, setShowTagDialog] = useState(false)
  
  // Data-Service integration state
  const [isConnected, setIsConnected] = useState(false)
  const [serverHealth, setServerHealth] = useState<DataServiceHealth | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [registeredDataPoints, setRegisteredDataPoints] = useState<DataServiceDataPoint[]>([])
  const [existingMappings, setExistingMappings] = useState<Record<string, OPCUAMapping>>({})
  const [initialized, setInitialized] = useState(false)
  
  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverConfigSchema),
    defaultValues: {
      enabled: false,
      port: 4840, // Data-Service default OPC-UA port
    },
    mode: "onChange",
  })

  // Check Data-Service connection and sync state
  const checkDataServiceConnection = useCallback(async () => {
    if (isLoading) return

    try {
      const healthResponse = await dataServiceAPI.getDetailedHealth()
      if (healthResponse.ok) {
        setIsConnected(true)
        setServerHealth(healthResponse.data)
        
        // Update form with actual server status
        const actualEnabled = healthResponse.data.services?.opcua?.running || false
        const actualPort = healthResponse.data.services?.opcua?.port || 4840
        
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

  // Sync registered data points from Data-Service
  const syncRegisteredDataPoints = useCallback(async () => {
    try {
      const dataPointsResponse = await dataServiceAPI.getDataPoints()
      if (dataPointsResponse.ok) {
        setRegisteredDataPoints(dataPointsResponse.data || [])
      }
    } catch (error) {
      console.warn('Failed to sync registered data points:', error)
    }
  }, [])

  // Sync existing OPC-UA mappings from Data-Service
  const syncExistingMappings = useCallback(async () => {
    try {
      const mappingsResponse = await dataServiceAPI.getOpcuaMappings()
      if (mappingsResponse.ok) {
        const mappings = mappingsResponse.data || {}
        setExistingMappings(mappings)
        
        // Convert existing mappings to server tags for display
        const tags: OPCUAServerTag[] = Object.entries(mappings).map(([dataId, mapping]: [string, any]) => ({
          id: dataId,
          tagName: mapping.key,
          tagType: 'IO',
          dataType: mapping.data_type || 'Double',
          defaultValue: 0,
          nodeId: mapping.node_id,
          browseName: mapping.browse_name,
          displayName: mapping.display_name,
          valueRank: mapping.value_rank || -1,
          accessLevel: mapping.access_level || 'CurrentReadOrWrite',
          timestamps: mapping.timestamps || 'Both',
          namespace: mapping.namespace || 2,
          units: '',
          description: mapping.description || '',
          dataId,
        }))
        
        setServerTags(tags)
      }
    } catch (error) {
      console.warn('Failed to sync existing OPC-UA mappings:', error)
    }
  }, [])

  // Initial data load
  useEffect(() => {
    if (!initialized) {
      checkDataServiceConnection()
      syncRegisteredDataPoints()
      syncExistingMappings()
      setInitialized(true)
    }
  }, [initialized, checkDataServiceConnection, syncRegisteredDataPoints, syncExistingMappings])

  // Periodic health check
  useEffect(() => {
    if (!initialized) return

    const interval = setInterval(() => {
      checkDataServiceConnection()
    }, 15000) // Check every 15 seconds
    
    return () => clearInterval(interval)
  }, [initialized, checkDataServiceConnection])

  // Hydrate from existing config when not connected to Data-Service
  useEffect(() => {
    const serverCfg = (config as any)?.services?.opcuaTcpServer
    if (serverCfg && !isConnected && initialized) {
      form.reset({
        enabled: Boolean(serverCfg.enabled ?? false),
        port: Number(serverCfg.port ?? 4840),
      })
      
      if (serverCfg.tags && Array.isArray(serverCfg.tags)) {
        setServerTags(serverCfg.tags)
      }
    }
  }, [config, form, isConnected, initialized])

  const onSubmit = async (values: ServerFormValues) => {
    setIsLoading(true)
    
    try {
      if (isConnected) {
        // Use Data-Service API to control OPC-UA server
        if (values.enabled) {
          const enableResponse = await dataServiceAPI.enableOpcuaService()
          if (isDataServiceError(enableResponse)) {
            throw new Error(enableResponse.error)
          }
          toast.success("OPC-UA Server enabled via Data-Service")
        } else {
          const disableResponse = await dataServiceAPI.disableOpcuaService()
          if (isDataServiceError(disableResponse)) {
            throw new Error(disableResponse.error)
          }
          toast.success("OPC-UA Server disabled via Data-Service")
        }
        
        // Update server health after change
        setTimeout(checkDataServiceConnection, 2000)
        
      } else {
        // Fallback to local config storage
        const next = {
          ...config,
          services: {
            ...(config as any)?.services,
            opcuaTcpServer: {
              ...values,
              tags: serverTags,
            },
          },
        }
        setConfig(next)
        toast.success("OPC-UA Server configuration saved locally")
      }
    } catch (error: any) {
      console.error('Error saving OPC-UA configuration:', error)
      toast.error(`Failed to save configuration: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Enhanced workflow for adding tags with proper Data-Service integration
  const handleAddTags = async (selectedTags: any[]) => {
    if (!Array.isArray(selectedTags) || selectedTags.length === 0) {
      toast.error('No tags selected')
      return
    }

    setIsLoading(true)
    
    try {
      if (!isConnected) {
        // Fallback to local storage behavior
        const newTags: OPCUAServerTag[] = selectedTags.map((selectedTag) => {
          const nodeId = generateNodeIdFromTag(selectedTag)
          const browseName = generateBrowseName(selectedTag.name, selectedTag.deviceName || selectedTag.device)
          
          return {
            id: selectedTag.id,
            tagName: selectedTag.name,
            tagType: selectedTag.type || 'IO',
            dataType: mapFrontendDataTypeToOpcua(selectedTag.dataType || 'Analog'),
            defaultValue: selectedTag.defaultValue || 0,
            nodeId: generatedNodeId,
            browseName,
            displayName: browseName,
            valueRank: -1,
            accessLevel: 'CurrentReadOrWrite',
            timestamps: 'Both',
            namespace: 2,
            units: selectedTag.units || '',
            description: `Mapping for ${selectedTag.name}`,
          }
        })
        
        setServerTags(prev => [...prev, ...newTags])
        toast.success(`${selectedTags.length} tags added locally`)
        return
      }

      // Data-Service workflow: Register data points, then create OPC-UA mappings
      const successfulTags: OPCUAServerTag[] = []
      const errors: string[] = []

      for (const selectedTag of selectedTags) {
        try {
          // Step 1: Register data point in Data-Service datastore
          const dataServiceKey = generateDataServiceKey(selectedTag)
          const dataServiceDataType = mapFrontendDataTypeToDataService(selectedTag.dataType || 'Analog')
          
          const registerResponse = await dataServiceAPI.registerDataPoint({
            key: dataServiceKey,
            default: selectedTag.defaultValue || 0,
            data_type: dataServiceDataType,
            units: selectedTag.units || '',
            allow_address_conflict: false,
          })
          
          if (isDataServiceError(registerResponse)) {
            errors.push(`Failed to register ${selectedTag.name}: ${registerResponse.error}`)
            continue
          }
          
          const dataId = registerResponse.data.id
          
          // Step 2: Create OPC-UA mapping with proper node ID allocation
          const opcuaDataType = mapFrontendDataTypeToOpcua(selectedTag.dataType || 'Analog')
          const browseName = generateBrowseName(selectedTag.name, selectedTag.deviceName || selectedTag.device)
          const accessLevel = determineAccessLevel(selectedTag)
          
          const mappingResponse = await dataServiceAPI.createOpcuaMapping({
            id: dataId,
            key: dataServiceKey,
            // node_id removed - backend auto-generates
            browse_name: browseName,
            display_name: browseName,
            data_type: opcuaDataType,
            value_rank: -1, // Scalar
            access_level: accessLevel,
            timestamps: 'Both',
            namespace: 2,
            description: `Auto-generated mapping for ${selectedTag.name} from device ${selectedTag.deviceName || selectedTag.device}`,
          })
          
          if (isDataServiceError(mappingResponse)) {
            errors.push(`Failed to create OPC-UA mapping for ${selectedTag.name}: ${mappingResponse.error}`)
            continue
          }
          
          
          // Get the auto-generated node_id from backend response
          const generatedNodeId = mappingResponse.data?.node_id || "auto-generated"
          // Step 3: Create local tag representation
          const newTag: OPCUAServerTag = {
            id: dataId,
            tagName: selectedTag.name,
            tagType: selectedTag.type || 'IO',
            dataType: opcuaDataType,
            defaultValue: selectedTag.defaultValue || 0,
            nodeId: generatedNodeId,
            browseName,
            displayName: browseName,
            valueRank: -1,
            accessLevel,
            timestamps: 'Both',
            namespace: 2,
            units: selectedTag.units || '',
            description: `Auto-generated mapping for ${selectedTag.name}`,
            dataId,
          }
          
          successfulTags.push(newTag)
          
        } catch (error: any) {
          errors.push(`Error processing ${selectedTag.name}: ${error.message}`)
        }
      }

      // Update local state with successfully processed tags
      if (successfulTags.length > 0) {
        setServerTags(prev => [...prev, ...successfulTags])
      }

      // Show results
      if (successfulTags.length === selectedTags.length) {
        toast.success(`Successfully registered and mapped ${successfulTags.length} tags to OPC-UA`)
      } else if (successfulTags.length > 0) {
        toast.warning(`Successfully processed ${successfulTags.length} out of ${selectedTags.length} tags`)
        if (errors.length > 0) {
          console.warn('Tag processing errors:', errors)
        }
      } else {
        toast.error(`Failed to process any tags. Check console for details.`)
        console.error('Tag processing errors:', errors)
      }

      // Refresh data
      setTimeout(() => {
        syncRegisteredDataPoints()
        syncExistingMappings()
      }, 1000)
      
    } catch (error: any) {
      console.error('Error adding OPC-UA tags:', error)
      toast.error(`Failed to add tags: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    const tag = serverTags.find(t => t.id === tagId)
    if (!tag) return

    if (!isConnected) {
      setServerTags(prev => prev.filter(t => t.id !== tagId))
      toast.success("Tag removed locally")
      return
    }

    // Remove from local state (Data-Service doesn't have delete mapping endpoint)
    setServerTags(prev => prev.filter(t => t.id !== tagId))
    
    toast.warning(`Tag "${tag.tagName}" removed from display. Restart Data-Service to clear server-side mappings.`)
  }

  const handleTagUpdate = (tagId: string, updates: Partial<OPCUAServerTag>) => {
    setServerTags(prev => prev.map(tag => 
      tag.id === tagId ? { ...tag, ...updates } : tag
    ))
    
    if (isConnected) {
      toast.info("Local changes updated. Data-Service mappings require service restart to apply changes.")
    }
  }

  const refreshDataServiceStatus = async () => {
    setIsLoading(true)
    try {
      await checkDataServiceConnection()
      await syncRegisteredDataPoints()
      await syncExistingMappings()
      toast.success("Data-Service status and mappings refreshed")
    } catch (error) {
      toast.error("Failed to refresh Data-Service status")
    } finally {
      setIsLoading(false)
    }
  }

  const downloadSampleCSV = () => {
    const content = getSampleCSVContent()
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', 'opcua-tags-sample.csv')
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
                <Server className="h-5 w-5"/> OPC-UA Server
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
                  ? `Connected to Data-Service on port ${serverHealth?.services?.opcua?.port || 4840}. Server is ${serverHealth?.services?.opcua?.running ? 'running' : 'stopped'}.`
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
                      ? "Toggle Data-Service OPC-UA server" 
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
                          disabled={isConnected}
                        />
                      </FormControl>
                      <FormDescription>
                        {isConnected ? "Port is managed by Data-Service (OPCUA_PORT env var)" : "Default is 4840"}
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
                      <>
                        <Badge variant="outline">
                          <Database className="h-3 w-3 mr-1" />
                          {registeredDataPoints.length} data points
                        </Badge>
                        <Badge variant="outline">
                          <MapPin className="h-3 w-3 mr-1" />
                          {Object.keys(existingMappings).length} mappings
                        </Badge>
                      </>
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

      {/* Tags Table - Enhanced with proper Data-Service workflow */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5"/> OPC-UA Node Mappings
              </CardTitle>
              <CardDescription>
                Register data points and map them to OPC-UA nodes for client access
                {isConnected && ` (${serverTags.length} active mappings)`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <div className="flex items-center gap-2">
                  <OPCUACSVIntegration
                    serverTags={serverTags}
                    onTagsUpdated={setServerTags}
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
              
              <Button 
                onClick={() => setShowTagDialog(true)}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tags
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {serverTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No OPC-UA mappings created yet</p>
              <p className="text-sm">Click "Add Tags" to register data points and create OPC-UA mappings</p>
              <div className="text-sm mt-2 space-y-1">
                <p><FileSpreadsheet className="h-4 w-4 inline" /> Use CSV Import for bulk operations</p>
                {isConnected && (
                  <p className="text-blue-600">
                    <Database className="h-4 w-4 inline" /> {registeredDataPoints.length} data points available in Data-Service
                  </p>
                )}
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Data Point Key</TableHead>
                    <TableHead className="w-[200px]">Node ID</TableHead>
                    <TableHead className="w-[120px]">Data Type</TableHead>
                    <TableHead className="w-[150px]">Access Level</TableHead>
                    <TableHead className="w-[100px]">Namespace</TableHead>
                    <TableHead>Browse Name</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serverTags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell className="font-medium">{tag.tagName}</TableCell>
                      <TableCell>
                        <Input
                          value={tag.nodeId}
                          onChange={(e) => handleTagUpdate(tag.id, { nodeId: e.target.value })}
                          className="w-[180px]"
                          disabled={isConnected && tag.dataId}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tag.dataType}
                          onValueChange={(value) => handleTagUpdate(tag.id, { dataType: value })}
                          disabled={isConnected && tag.dataId}
                        >
                          <SelectTrigger className="w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Boolean">Boolean</SelectItem>
                            <SelectItem value="Int16">Int16</SelectItem>
                            <SelectItem value="Int32">Int32</SelectItem>
                            <SelectItem value="Float">Float</SelectItem>
                            <SelectItem value="Double">Double</SelectItem>
                            <SelectItem value="String">String</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tag.accessLevel}
                          onValueChange={(value) => handleTagUpdate(tag.id, { accessLevel: value })}
                          disabled={isConnected && tag.dataId}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CurrentRead">Read Only</SelectItem>
                            <SelectItem value="CurrentWrite">Write Only</SelectItem>
                            <SelectItem value="CurrentReadOrWrite">Read/Write</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={tag.namespace}
                          onChange={(e) => handleTagUpdate(tag.id, { namespace: Number(e.target.value) })}
                          className="w-16"
                          min={0}
                          disabled={isConnected && tag.dataId}
                        />
                      </TableCell>
                      <TableCell className="text-sm">{tag.browseName}</TableCell>
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
        onSelectTag={(tag) => handleAddTags([tag])}
        onSelectTags={handleAddTags}
        multiSelect={true}
      />
    </div>
  )
}

// FIXED: Helper functions for proper Data-Service integration
function generateDataServiceKey(selectedTag: any): string {
  const deviceName = selectedTag.deviceName || selectedTag.device || "DEVICE"
  // Generate unique tag name with timestamp to match backend format
  const timestamp = Date.now()
  const tagName = `tag-${timestamp}`
  return `${deviceName}:${tagName}`
// DEPRECATED: }
// DEPRECATED: 
// DEPRECATED: function generateNodeIdFromTag(selectedTag: any, dataId?: string): string {
// DEPRECATED:   // Use string-based node IDs with the tag key for better organization
// DEPRECATED:   const deviceName = selectedTag.deviceName || selectedTag.device || "DEVICE"
// DEPRECATED:   // Use the original tag name for the node ID (display purposes)
// DEPRECATED:   const originalTagName = selectedTag.name || "TAG"
// DEPRECATED:   // Clean the tag name if it already contains the device name
// DEPRECATED:   const cleanTagName = originalTagName.startsWith(`${deviceName}:`) 
// DEPRECATED:     ? originalTagName.substring(`${deviceName}:`.length)
// DEPRECATED:     : originalTagName
  return `ns=2;s=${deviceName}:${cleanTagName}`
}

function generateBrowseName(tagName: string, deviceName?: string): string {
  if (deviceName) {
    // Clean the tag name if it already contains the device name
    const cleanTagName = tagName.startsWith(`${deviceName}:`) 
      ? tagName.substring(`${deviceName}:`.length)
      : tagName
    return `${deviceName}:${cleanTagName}`
  }
  return tagName
}

function determineAccessLevel(selectedTag: any): string {
  // Determine access level based on tag type and properties
  const tagType = selectedTag.type?.toLowerCase() || 'io'
  const isReadOnly = selectedTag.readOnly || selectedTag.readonly
  
  if (isReadOnly) {
    return 'CurrentRead'
  }
  
  if (tagType.includes('input') || tagType.includes('sensor')) {
    return 'CurrentRead'
  }
  
  if (tagType.includes('output') || tagType.includes('control')) {
    return 'CurrentReadOrWrite'
  }
  
  return 'CurrentReadOrWrite' // Default
}

function mapFrontendDataTypeToDataService(frontendType: string): string {
  const mapping: Record<string, string> = {
    'Analog': 'float',
    'Digital': 'bool',
    'UInt16': 'int',
    'UInt32': 'int',
    'Int16': 'int',
    'Int32': 'int',
    'Float': 'float',
    'Boolean': 'bool',
    'String': 'string',
  }
  return mapping[frontendType] || 'float'
}

function mapFrontendDataTypeToOpcua(frontendType: string): string {
  const mapping: Record<string, string> = {
    'UInt16': 'Int32',
    'UInt32': 'Int32',
    'Int16': 'Int16',
    'Int32': 'Int32',
    'Float': 'Float',
    'Boolean': 'Boolean',
    'Analog': 'Double',
    'Digital': 'Boolean',
    'String': 'String',
  }
  return mapping[frontendType] || 'Double'
}
