"use client"

import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useEffect, useState } from "react"
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
import { Loader2, Server, Plus, Trash2, Tag, RefreshCw, Activity, AlertCircle, Settings, FileSpreadsheet, Download, Upload, HelpCircle, Edit, Network } from "lucide-react"
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { MQTTBrokerCSVIntegration, MQTTTopicCSVIntegration, getSampleBrokerCSVContent, getSampleTopicCSVContent } from "./mqtt-csv-integration"

// MQTT Publisher configuration schema
const mqttConfigSchema = z.object({
  enabled: z.boolean().default(false),
})

// Broker Schema
const mqttBrokerSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Broker name is required"),
  address: z.string().min(1, "Broker address is required"),
  port: z.number().min(1).max(65535),
  protocol: z.enum(["mqtt", "mqtts", "ws", "wss"]),
  username: z.string().optional(),
  password: z.string().optional(),
  clientId: z.string().optional(),
  keepAlive: z.number().default(60),
  cleanSession: z.boolean().default(true),
  enabled: z.boolean(),
})

// Topic Mapping Schema
const topicMappingSchema = z.object({
  id: z.string(),
  topicName: z.string().min(1, "Topic name is required"),
  brokerId: z.string().min(1, "Broker is required"),
  selectedTags: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string().optional(),
    dataType: z.string().optional(),
    units: z.string().optional(),
    device: z.string().optional(),
    deviceName: z.string().optional(),
  })).default([]),
  qos: z.number().min(0).max(2),
  format: z.enum(["json", "csv", "plain"]),
  delimiter: z.string().optional(),
  publishRate: z.number().min(100).default(1000),
  retained: z.boolean().default(false),
  enabled: z.boolean(),
  description: z.string().optional(),
})

type MqttFormValues = z.infer<typeof mqttConfigSchema>
type MqttBroker = z.infer<typeof mqttBrokerSchema>
type TopicMapping = z.infer<typeof topicMappingSchema>

export function MQTTPubForm() {
  const config = useConfigStore((s) => s.config)
  const setConfig = useConfigStore((s) => s.setConfig)
  
  // Broker and mapping state
  const [brokers, setBrokers] = useState<MqttBroker[]>([])
  const [mappings, setMappings] = useState<TopicMapping[]>([])
  
  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [editingBrokerId, setEditingBrokerId] = useState<string | null>(null)
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null)
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [currentMappingId, setCurrentMappingId] = useState<string | null>(null)
  
  const form = useForm<MqttFormValues>({
    resolver: zodResolver(mqttConfigSchema),
    defaultValues: {
      enabled: false,
    },
    mode: "onChange",
  })

  // Hydrate from existing config
  useEffect(() => {
    const mqttCfg = (config as any)?.protocols?.mqtt
    if (mqttCfg) {
      form.reset({
        enabled: Boolean(mqttCfg.enabled ?? false),
      })
      
      if (mqttCfg.brokers && Array.isArray(mqttCfg.brokers)) {
        setBrokers(mqttCfg.brokers)
      }
      
      if (mqttCfg.mappings && Array.isArray(mqttCfg.mappings)) {
        setMappings(mqttCfg.mappings)
      }
    }
  }, [config, form])

  const onSubmit = async (values: MqttFormValues) => {
    setIsLoading(true)
    
    try {
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
      toast.success("MQTT Publisher configuration saved")
    } catch (error: any) {
      console.error('Error saving MQTT configuration:', error)
      toast.error(`Failed to save configuration: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Broker Management Functions
  const addBroker = () => {
    const newBroker: MqttBroker = {
      id: `broker-${Date.now()}`,
      name: "New Broker",
      address: "localhost",
      port: 1883,
      protocol: "mqtt",
      username: "",
      password: "",
      clientId: `apm-client-${Date.now()}`,
      keepAlive: 60,
      cleanSession: true,
      enabled: true,
    }
    setBrokers(prev => [...prev, newBroker])
    setEditingBrokerId(newBroker.id)
    toast.success("Broker added")
  }

  const removeBroker = (id: string) => {
    setBrokers(prev => prev.filter(b => b.id !== id))
    // Remove mappings that reference this broker
    setMappings(prev => prev.filter(m => m.brokerId !== id))
    toast.success("Broker removed")
  }

  const updateBroker = (id: string, updates: Partial<MqttBroker>) => {
    setBrokers(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  // Mapping Management Functions
  const addMapping = () => {
    if (brokers.length === 0) {
      toast.error("Please add a broker first")
      return
    }
    const newMapping: TopicMapping = {
      id: `mapping-${Date.now()}`,
      topicName: "data/tags",
      brokerId: brokers[0].id,
      selectedTags: [],
      qos: 0,
      format: "json",
      delimiter: ",",
      publishRate: 1000,
      retained: false,
      enabled: true,
      description: "",
    }
    setMappings(prev => [...prev, newMapping])
    setEditingMappingId(newMapping.id)
    toast.success("Mapping added")
  }

  const removeMapping = (id: string) => {
    setMappings(prev => prev.filter(m => m.id !== id))
    toast.success("Mapping removed")
  }

  const updateMapping = (id: string, updates: Partial<TopicMapping>) => {
    setMappings(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
  }

  // Tag Selection Functions
  const openTagSelection = (mappingId: string) => {
    setCurrentMappingId(mappingId)
    setShowTagDialog(true)
  }

  const handleTagSelection = (selectedTags: any[]) => {
    if (currentMappingId) {
      updateMapping(currentMappingId, { selectedTags })
      toast.success(`${selectedTags.length} tag(s) selected`)
    }
    setShowTagDialog(false)
    setCurrentMappingId(null)
  }

  // CSV helper functions
  const downloadSampleBrokerCSV = () => {
    const content = getSampleBrokerCSVContent()
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', 'mqtt-brokers-sample.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
    
    toast.success('Sample broker CSV template downloaded')
  }

  const downloadSampleTopicCSV = () => {
    const content = getSampleTopicCSVContent()
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', 'mqtt-topics-sample.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
    
    toast.success('Sample topic CSV template downloaded')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5"/> MQTT Publisher
              </CardTitle>
              <CardDescription>
                Configure MQTT publishing for IO tags to multiple brokers and topics
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </div>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">MQTT Publishing Enabled</div>
                  <div className="text-sm text-muted-foreground">
                    Enable or disable MQTT publishing globally
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

              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium">Status</span>
                  <Badge variant={form.getValues("enabled") ? "default" : "secondary"}>
                    {form.getValues("enabled") ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium">Brokers</span>
                  <span className="text-sm text-muted-foreground">{brokers.length} configured</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium">Mappings</span>
                  <span className="text-sm text-muted-foreground">{mappings.length} configured</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Configuration is saved locally
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

      {/* Brokers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5"/> MQTT Brokers
              </CardTitle>
              <CardDescription>
                Manage MQTT broker connections ({brokers.length} broker{brokers.length !== 1 ? 's' : ''})
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <div className="flex items-center gap-2">
                  <MQTTBrokerCSVIntegration
                    brokers={brokers}
                    onBrokersUpdated={setBrokers}
                    disabled={isLoading}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={downloadSampleBrokerCSV}
                        disabled={isLoading}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download CSV template for brokers</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              
              <Button onClick={addBroker} disabled={isLoading}>
                <Plus className="h-4 w-4 mr-2" />
                Add Broker
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {brokers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No brokers configured</p>
              <p className="text-sm">Click "Add Broker" to create a new broker connection</p>
              <p className="text-sm mt-2">
                Or use <FileSpreadsheet className="h-4 w-4 inline" /> CSV Import for bulk operations
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead className="w-[200px]">Address</TableHead>
                    <TableHead className="w-[100px]">Port</TableHead>
                    <TableHead className="w-[100px]">Protocol</TableHead>
                    <TableHead className="w-[150px]">Client ID</TableHead>
                    <TableHead className="w-[120px]">Username</TableHead>
                    <TableHead className="w-[100px]">Keep Alive</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brokers.map((broker) => (
                    <TableRow key={broker.id}>
                      <TableCell>
                        <Input
                          value={broker.name}
                          onChange={(e) => updateBroker(broker.id, { name: e.target.value })}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={broker.address}
                          onChange={(e) => updateBroker(broker.id, { address: e.target.value })}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={broker.port}
                          onChange={(e) => updateBroker(broker.id, { port: Number(e.target.value) })}
                          className="w-full"
                          min={1}
                          max={65535}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={broker.protocol}
                          onValueChange={(value) => updateBroker(broker.id, { protocol: value as any })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mqtt">MQTT</SelectItem>
                            <SelectItem value="mqtts">MQTTS</SelectItem>
                            <SelectItem value="ws">WS</SelectItem>
                            <SelectItem value="wss">WSS</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={broker.clientId || ""}
                          onChange={(e) => updateBroker(broker.id, { clientId: e.target.value })}
                          className="w-full"
                          placeholder="Client ID"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={broker.username || ""}
                          onChange={(e) => updateBroker(broker.id, { username: e.target.value })}
                          className="w-full"
                          placeholder="Username"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={broker.keepAlive}
                          onChange={(e) => updateBroker(broker.id, { keepAlive: Number(e.target.value) })}
                          className="w-full"
                          min={1}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={broker.enabled}
                          onCheckedChange={(checked) => updateBroker(broker.id, { enabled: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBroker(broker.id)}
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

      {/* Topic Mappings Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5"/> Topic Mappings
              </CardTitle>
              <CardDescription>
                Map IO tags to MQTT topics and brokers ({mappings.length} mapping{mappings.length !== 1 ? 's' : ''})
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <div className="flex items-center gap-2">
                  <MQTTTopicCSVIntegration
                    topics={mappings.map(m => ({
                      ...m,
                      brokerName: brokers.find(b => b.id === m.brokerId)?.name || 'Unknown'
                    }))}
                    brokers={brokers}
                    onTopicsUpdated={(topics) => {
                      // Convert back to mappings with broker IDs
                      const updatedMappings = topics.map(topic => {
                        const broker = brokers.find(b => b.name === topic.brokerName)
                        return {
                          ...topic,
                          brokerId: broker?.id || brokers[0]?.id || '',
                        }
                      })
                      setMappings(updatedMappings)
                    }}
                    disabled={isLoading || brokers.length === 0}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={downloadSampleTopicCSV}
                        disabled={isLoading}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download CSV template for topics</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              
              <Button onClick={addMapping} disabled={isLoading || brokers.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add Mapping
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No topic mappings configured</p>
              {brokers.length === 0 ? (
                <p className="text-sm">Add a broker first to create mappings</p>
              ) : (
                <>
                  <p className="text-sm">Click "Add Mapping" to map tags to topics</p>
                  <p className="text-sm mt-2">
                    Or use <FileSpreadsheet className="h-4 w-4 inline" /> CSV Import for bulk operations
                  </p>
                </>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Topic Name</TableHead>
                    <TableHead className="w-[150px]">Broker</TableHead>
                    <TableHead className="w-[120px]">Selected Tags</TableHead>
                    <TableHead className="w-[80px]">QoS</TableHead>
                    <TableHead className="w-[100px]">Format</TableHead>
                    <TableHead className="w-[120px]">Publish Rate (ms)</TableHead>
                    <TableHead className="w-[100px]">Retained</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping) => {
                    const broker = brokers.find(b => b.id === mapping.brokerId)
                    return (
                      <TableRow key={mapping.id}>
                        <TableCell>
                          <Input
                            value={mapping.topicName}
                            onChange={(e) => updateMapping(mapping.id, { topicName: e.target.value })}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping.brokerId}
                            onValueChange={(value) => updateMapping(mapping.id, { brokerId: value })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {brokers.map(b => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTagSelection(mapping.id)}
                            disabled={isLoading}
                          >
                            {mapping.selectedTags.length > 0 
                              ? `${mapping.selectedTags.length} tag${mapping.selectedTags.length !== 1 ? 's' : ''}`
                              : 'Select Tags'}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={String(mapping.qos)}
                            onValueChange={(value) => updateMapping(mapping.id, { qos: Number(value) })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0</SelectItem>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping.format}
                            onValueChange={(value) => updateMapping(mapping.id, { format: value as any })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="json">JSON</SelectItem>
                              <SelectItem value="csv">CSV</SelectItem>
                              <SelectItem value="plain">Plain</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={mapping.publishRate}
                            onChange={(e) => updateMapping(mapping.id, { publishRate: Number(e.target.value) })}
                            className="w-full"
                            min={100}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={mapping.retained}
                            onCheckedChange={(checked) => updateMapping(mapping.id, { retained: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={mapping.enabled}
                            onCheckedChange={(checked) => updateMapping(mapping.id, { enabled: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMapping(mapping.id)}
                            className="text-destructive hover:text-destructive"
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
        multiSelect={true}
        selectedTags={currentMappingId ? mappings.find(m => m.id === currentMappingId)?.selectedTags || [] : []}
        onSelectTags={handleTagSelection}
      />
    </div>
  )
}
