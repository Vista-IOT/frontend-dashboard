"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { RefreshCw, Plus, Trash2, Send, Download, Upload, HelpCircle, Tag, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog"

// Broker Schema
const mqttBrokerSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Broker name is required"),
  address: z.string().min(1, "Broker address is required"),
  port: z.number().min(1).max(65535),
  clientId: z.string().min(1, "Client ID is required"),
  keepalive: z.number().min(0).max(3600),
  cleanSession: z.boolean(),
  protocol: z.enum(["mqtt", "mqtts", "ws", "wss"]),
  auth: z.object({
    enabled: z.boolean(),
    username: z.string().optional(),
    password: z.string().optional(),
  }),
  tls: z.object({
    enabled: z.boolean(),
    verifyServer: z.boolean(),
    allowInsecure: z.boolean(),
    certFile: z.string().optional(),
    keyFile: z.string().optional(),
    caFile: z.string().optional(),
  }),
  enabled: z.boolean(),
})

// Topic to Broker Mapping Schema
const topicBrokerMappingSchema = z.object({
  id: z.string(),
  topicName: z.string().min(1, "Topic name is required"),
  brokerId: z.string().min(1, "Broker is required"),
  selectedTags: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string().optional(),
    description: z.string().optional(),
    dataType: z.string().optional(),
    path: z.string().optional(),
  })).optional().default([]),
  qos: z.number().min(0).max(2),
  retain: z.boolean(),
  publishInterval: z.number().min(100).max(3600000),
  format: z.enum(["json", "csv", "plain", "xml"]),
  delimiter: z.string().optional(), // For CSV format
  includeTimestamp: z.boolean(),
  includeHeaders: z.boolean(), // For CSV format
  enabled: z.boolean(),
})

const mqttPubFormSchema = z.object({
  enabled: z.boolean(),
  brokers: z.array(mqttBrokerSchema),
  mappings: z.array(topicBrokerMappingSchema),
})

type MqttBroker = z.infer<typeof mqttBrokerSchema>
type TopicBrokerMapping = z.infer<typeof topicBrokerMappingSchema>

export function MQTTPubForm() {
  const { updateConfig, getConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [publisherStatus, setPublisherStatus] = useState<any>(null)
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)
  
  // Broker management state
  const [showBrokerModal, setShowBrokerModal] = useState(false)
  const [editingBrokerIndex, setEditingBrokerIndex] = useState<number | null>(null)
  
  // Mapping management state
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [editingMappingIndex, setEditingMappingIndex] = useState<number | null>(null)
  
  // Tag selection state
  const [showTagSelector, setShowTagSelector] = useState(false)
  const [currentMappingIndex, setCurrentMappingIndex] = useState<number | null>(null)

  // Get all available tags from the configuration
  const config = getConfig()
  
  // Load MQTT configuration from backend on mount
  useEffect(() => {
    loadConfigFromBackend()
  }, [])
  
  const loadConfigFromBackend = async () => {
    try {
      setIsLoadingConfig(true)
      const dataServiceUrl = process.env.NEXT_PUBLIC_DATA_SERVICE_URL || 'http://localhost:8080'
      const response = await fetch(`${dataServiceUrl}/mqtt/publisher/config`)
      
      if (response.ok) {
        const backendConfig = await response.json()
        
        // If backend has configuration, sync it to frontend
        if (backendConfig && Object.keys(backendConfig).length > 0) {
          console.log('[MQTT Pub] Loaded config from backend:', backendConfig)
          
          // Update local config store
          updateConfig(['protocols', 'mqtt'], backendConfig)
          
          // Update form with backend values
          form.reset({
            enabled: backendConfig.enabled || false,
            broker: {
              address: backendConfig.broker?.address || 'localhost',
              port: backendConfig.broker?.port || 1883,
              clientId: backendConfig.broker?.client_id || `iot-gateway-${Date.now()}`,
              keepalive: backendConfig.broker?.keepalive || 60,
              cleanSession: backendConfig.broker?.clean_session ?? true,
              protocol: backendConfig.broker?.protocol || 'mqtt',
            },
            auth: {
              enabled: backendConfig.broker?.auth?.enabled || false,
              username: backendConfig.broker?.auth?.username || '',
              password: backendConfig.broker?.auth?.password || '',
            },
            tls: {
              enabled: backendConfig.broker?.tls?.enabled || false,
              verifyServer: backendConfig.broker?.tls?.verify_server ?? true,
              allowInsecure: backendConfig.broker?.tls?.allow_insecure || false,
              certFile: backendConfig.broker?.tls?.cert_file || '',
              keyFile: backendConfig.broker?.tls?.key_file || '',
              caFile: backendConfig.broker?.tls?.ca_file || '',
            },
            topics: backendConfig.topics?.publish || [],
          })
          
          toast.success('Configuration loaded from backend', {
            duration: 2000,
            description: `${backendConfig.topics?.publish?.length || 0} topic(s) loaded`
          })
        }
      }
    } catch (error) {
      console.error('[MQTT Pub] Failed to load config from backend:', error)
      // Don't show error toast on initial load - just use local config
    } finally {
      setIsLoadingConfig(false)
    }
  }
  const allTags = {
    "io-tag": config.io_setup?.devices?.flatMap(d => 
      d.ports?.flatMap(p => p.tags?.map(t => ({
        id: t.id,
        name: t.name || t.address,
        device: d.name,
        type: "io-tag"
      })) || []) || []
    ) || [],
    "calc-tag": [], // Add calc tags if available in config
    "user-tag": [], // Add user tags if available in config
    "system-tag": [], // Add system tags if available in config
  }

  const form = useForm<z.infer<typeof mqttPubFormSchema>>({
    resolver: zodResolver(mqttPubFormSchema),
    defaultValues: {
      enabled: getConfig().protocols?.mqtt?.enabled || false,
      brokers: [],
      mappings: [],
    }
  })

  const brokers = form.watch("brokers")
  const mappings = form.watch("mappings")

  // Broker Management Functions
  const addBroker = () => {
    setEditingBrokerIndex(null)
    setShowBrokerModal(true)
  }

  const editBroker = (index: number) => {
    setEditingBrokerIndex(index)
    setShowBrokerModal(true)
  }

  const saveBroker = (brokerData: Partial<MqttBroker>) => {
    if (editingBrokerIndex !== null) {
      const updatedBrokers = [...brokers]
      updatedBrokers[editingBrokerIndex] = {
        ...updatedBrokers[editingBrokerIndex],
        ...brokerData,
      }
      form.setValue("brokers", updatedBrokers)
    } else {
      const newBroker: MqttBroker = {
        id: `broker-${Date.now()}`,
        name: brokerData.name || "",
        address: brokerData.address || "",
        port: brokerData.port || 1883,
        clientId: brokerData.clientId || `iot-gateway-${Date.now()}`,
        keepalive: brokerData.keepalive || 60,
        cleanSession: brokerData.cleanSession ?? true,
        protocol: brokerData.protocol || "mqtt",
        auth: brokerData.auth || { enabled: false, username: "", password: "" },
        tls: brokerData.tls || { enabled: false, verifyServer: true, allowInsecure: false },
        enabled: brokerData.enabled ?? true,
      }
      form.setValue("brokers", [...brokers, newBroker])
    }
    setShowBrokerModal(false)
    setEditingBrokerIndex(null)
  }

  const removeBroker = (id: string) => {
    form.setValue("brokers", brokers.filter(b => b.id !== id))
    // Also remove mappings associated with this broker
    form.setValue("mappings", mappings.filter(m => m.brokerId !== id))
  }

  // Mapping Management Functions
  const addMapping = () => {
    setEditingMappingIndex(null)
    setShowMappingModal(true)
  }

  const editMapping = (index: number) => {
    setEditingMappingIndex(index)
    setShowMappingModal(true)
  }

  const saveMapping = (mappingData: Partial<TopicBrokerMapping>) => {
    if (editingMappingIndex !== null) {
      const updatedMappings = [...mappings]
      updatedMappings[editingMappingIndex] = {
        ...updatedMappings[editingMappingIndex],
        ...mappingData,
      }
      form.setValue("mappings", updatedMappings)
    } else {
      const newMapping: TopicBrokerMapping = {
        id: `mapping-${Date.now()}`,
        topicName: mappingData.topicName || "",
        brokerId: mappingData.brokerId || "",
        selectedTags: mappingData.selectedTags || [],
        qos: mappingData.qos ?? 0,
        retain: mappingData.retain ?? false,
        publishInterval: mappingData.publishInterval ?? 1000,
        format: mappingData.format || "json",
        delimiter: mappingData.delimiter || ",",
        includeTimestamp: mappingData.includeTimestamp ?? true,
        includeHeaders: mappingData.includeHeaders ?? true,
        enabled: mappingData.enabled ?? true,
      }
      form.setValue("mappings", [...mappings, newMapping])
    }
    setShowMappingModal(false)
    setEditingMappingIndex(null)
  }

  const removeMapping = (id: string) => {
    form.setValue("mappings", mappings.filter(m => m.id !== id))
  }

  const openTagSelector = (mappingIndex: number) => {
    setCurrentMappingIndex(mappingIndex)
    setShowTagSelector(true)
  }

  const handleTagsSelected = (tags: any[]) => {
    if (currentMappingIndex !== null) {
      const updatedMappings = [...mappings]
      updatedMappings[currentMappingIndex].selectedTags = tags
      form.setValue("mappings", updatedMappings)
    }
    setShowTagSelector(false)
  }

  const onSubmit = async (values: z.infer<typeof mqttPubFormSchema>) => {
    setIsSaving(true)
    try {
      // Update the entire MQTT configuration including broker, auth, TLS, and topics
      const mqttConfig = {
        enabled: values.enabled,
        broker: {
          address: values.broker.address,
          port: values.broker.port,
          client_id: values.broker.clientId,
          keepalive: values.broker.keepalive,
          clean_session: values.broker.cleanSession,
          protocol: values.broker.protocol,
          auth: {
            enabled: values.auth.enabled,
            username: values.auth.username,
            password: values.auth.password,
          },
          tls: {
            enabled: values.tls.enabled,
            verify_server: values.tls.verifyServer,
            allow_insecure: values.tls.allowInsecure,
            cert_file: values.tls.certFile,
            key_file: values.tls.keyFile,
            ca_file: values.tls.caFile,
          }
        },
        topics: {
          publish: values.topics,
          subscribe: getConfig().protocols?.mqtt?.topics?.subscribe || [],
        }
      }
      
      // Save to local config store
      updateConfig(['protocols', 'mqtt'], mqttConfig)
      
      // Send to backend for persistence
      const dataServiceUrl = process.env.NEXT_PUBLIC_DATA_SERVICE_URL || 'http://localhost:8080'
      const response = await fetch(`${dataServiceUrl}/mqtt/publisher/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mqttConfig),
      })
      
      if (!response.ok) {
        throw new Error(`Backend save failed: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log('[MQTT Pub] Configuration saved to backend:', result)
      
      toast.success('MQTT Pub configuration saved successfully!', {
        duration: 3000,
        description: `Broker: ${values.broker.address}:${values.broker.port}, ${values.topics.length} topic(s) configured. Persisted to backend.`
      })
    } catch (error) {
      console.error('Error saving MQTT Pub settings:', error)
      toast.error('Failed to save MQTT Pub settings', {
        duration: 5000,
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const testPublish = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId)
    if (!topic) return

    try {
      toast.info(`Testing publish to topic: ${topic.topic}`, {
        duration: 2000
      })
      
      // Here you would make an API call to test the MQTT publish
      // await fetch('/api/mqtt/test-publish', { method: 'POST', body: JSON.stringify(topic) })
      
      toast.success('Test message published successfully!', {
        duration: 3000
      })
    } catch (error) {
      toast.error('Failed to publish test message', {
        duration: 3000
      })
    }
  }

  const exportToCSV = () => {
    try {
      const headers = ['Topic', 'Tag Type', 'Tag Filter', 'QoS', 'Retain', 'Publish Interval (ms)', 'Format', 'Include Timestamp', 'Enabled']
      const rows = topics.map(t => [
        t.topic,
        t.tagType,
        t.tagFilter || '',
        t.qos,
        t.retain ? 'true' : 'false',
        t.publishInterval,
        t.format,
        t.includeTimestamp ? 'true' : 'false',
        t.enabled ? 'true' : 'false'
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mqtt-pub-topics-${Date.now()}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success('MQTT topics exported to CSV', {
        duration: 3000
      })
    } catch (error) {
      toast.error('Failed to export CSV', {
        duration: 3000
      })
    }
  }

  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
        
        const newTopics: MqttPubTopic[] = []
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim())
          
          const newTopic: MqttPubTopic = {
            id: `topic-${Date.now()}-${i}`,
            topic: values[0] || 'data/tags',
            tagType: (values[1] as any) || 'io-tag',
            tagFilter: values[2] || '',
            selectedTags: [],
            qos: parseInt(values[3]) || 0,
            retain: values[4] === 'true',
            publishInterval: parseInt(values[5]) || 1000,
            format: (values[6] as any) || 'json',
            includeTimestamp: values[7] === 'true',
            enabled: values[8] === 'true',
          }
          newTopics.push(newTopic)
        }

        form.setValue('topics', [...topics, ...newTopics])
        toast.success(`Imported ${newTopics.length} MQTT topic(s)`, {
          duration: 3000
        })
      } catch (error) {
        toast.error('Failed to import CSV. Please check the file format.', {
          duration: 3000
        })
      }
    }
    reader.readAsText(file)
    event.target.value = '' // Reset input
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">MQTT Publishing Configuration</h2>
          <p className="text-muted-foreground">
            Configure MQTT topics to publish tag data from IO tags, calc tags, user tags, and system tags
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadConfigFromBackend}
          disabled={isLoadingConfig}
        >
          {isLoadingConfig ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync from Backend
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable MQTT Publishing</FormLabel>
                      <FormDescription>
                        Enable or disable all MQTT publishing topics
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* MQTT Broker Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>MQTT Broker Configuration</CardTitle>
                  <CardDescription>Configure connection to your MQTT broker</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="broker.address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Broker Address</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="mqtt.example.com or 192.168.1.100" />
                          </FormControl>
                          <FormDescription className="text-xs">
                            MQTT broker hostname or IP address
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="broker.port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Port</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Default: 1883 (MQTT), 8883 (MQTTS)
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="broker.clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client ID</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="iot-gateway-client" />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Unique identifier for this MQTT client
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="broker.protocol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Protocol</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select protocol" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="mqtt">MQTT (TCP)</SelectItem>
                              <SelectItem value="mqtts">MQTTS (TLS)</SelectItem>
                              <SelectItem value="ws">WebSocket</SelectItem>
                              <SelectItem value="wss">WebSocket Secure</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="broker.keepalive"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Keep Alive (seconds)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Connection keep-alive interval
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="broker.cleanSession"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Clean Session</FormLabel>
                            <FormDescription className="text-xs">
                              Start with a clean session on connect
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Authentication Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Authentication</CardTitle>
                  <CardDescription>Configure MQTT broker authentication</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="auth.enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Enable Authentication</FormLabel>
                          <FormDescription className="text-xs">
                            Require username and password
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("auth.enabled") && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="auth.username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="mqtt-user" />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="auth.password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="••••••••" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* TLS/SSL Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>TLS/SSL Configuration</CardTitle>
                  <CardDescription>Configure secure connection settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="tls.enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Enable TLS/SSL</FormLabel>
                          <FormDescription className="text-xs">
                            Use encrypted connection to broker
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("tls.enabled") && (
                    <>
                      <div className="flex gap-4">
                        <FormField
                          control={form.control}
                          name="tls.verifyServer"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="!mt-0">Verify Server Certificate</FormLabel>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="tls.allowInsecure"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="!mt-0">Allow Insecure Connection</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid gap-4">
                        <FormField
                          control={form.control}
                          name="tls.caFile"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CA Certificate File (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="/path/to/ca.crt" />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Path to Certificate Authority file
                              </FormDescription>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="tls.certFile"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client Certificate File (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="/path/to/client.crt" />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Path to client certificate file
                              </FormDescription>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="tls.keyFile"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client Key File (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="/path/to/client.key" />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Path to client private key file
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* MQTT Brokers Section */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <RefreshCw className="h-5 w-5" />
                          MQTT Brokers
                        </CardTitle>
                        <CardDescription>
                          Manage MQTT broker connections ({brokers.length} broker{brokers.length !== 1 ? 's' : ''})
                        </CardDescription>
                      </div>
                      <Button type="button" onClick={addBroker} size="default">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Broker
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {brokers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10">
                        <p className="text-sm text-muted-foreground mb-4">
                          No MQTT brokers configured
                        </p>
                        <Button type="button" onClick={addBroker} variant="outline" size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Your First Broker
                        </Button>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>Port</TableHead>
                            <TableHead>Protocol</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {brokers.map((broker, index) => (
                            <TableRow key={broker.id}>
                              <TableCell className="font-medium">{broker.name}</TableCell>
                              <TableCell>{broker.address}</TableCell>
                              <TableCell>{broker.port}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{broker.protocol.toUpperCase()}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={broker.enabled ? "default" : "secondary"}>
                                  {broker.enabled ? "Enabled" : "Disabled"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => editBroker(index)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => removeBroker(broker.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Topic to Broker Mappings Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Tag className="h-5 w-5" />
                          Topic to Broker Mappings
                        </CardTitle>
                        <CardDescription>
                          Map topics to brokers and configure tag publishing ({mappings.length} mapping{mappings.length !== 1 ? 's' : ''})
                        </CardDescription>
                      </div>
                      <Button 
                        type="button" 
                        onClick={addMapping} 
                        size="default"
                        disabled={brokers.length === 0}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Mapping
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {mappings.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10">
                        <p className="text-sm text-muted-foreground mb-4">
                          {brokers.length === 0 
                            ? "Add a broker first to create topic mappings" 
                            : "No topic mappings configured"}
                        </p>
                        {brokers.length > 0 && (
                          <Button type="button" onClick={addMapping} variant="outline" size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Your First Mapping
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Topic</TableHead>
                            <TableHead>Broker</TableHead>
                            <TableHead>Tags</TableHead>
                            <TableHead>Format</TableHead>
                            <TableHead>QoS</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mappings.map((mapping, index) => (
                            <TableRow key={topic.id}>
                              <TableCell className="font-medium">{topic.topic}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{topic.tagType}</Badge>
                              </TableCell>
                              <TableCell>
                                {topic.selectedTags && topic.selectedTags.length > 0 ? (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className="text-xs">
                                      {topic.selectedTags.length} tag{topic.selectedTags.length !== 1 ? 's' : ''}
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">No tags</span>
                                )}
                              </TableCell>
                              <TableCell>{topic.qos}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{topic.format}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={topic.enabled ? "default" : "secondary"}>
                                  {topic.enabled ? "Enabled" : "Disabled"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => editTopic(index)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => testPublish(topic.id)}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => removeTopic(topic.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Topic Add/Edit Modal */}
              <TopicModal
                open={showTopicModal}
                onOpenChange={setShowTopicModal}
                topic={editingTopicIndex !== null ? topics[editingTopicIndex] : null}
                onSave={saveTopicFromModal}
                onOpenTagSelector={() => {
                  if (editingTopicIndex !== null) {
                    openTagSelector(editingTopicIndex)
                  }
                }}
              />

              <div className="flex justify-end gap-4">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Tag Selection Helper - Keep this section as is */}
      <Card>
        <CardHeader>
          <CardTitle>Available Tags</CardTitle>
          <CardDescription>
            View all available tags that can be published via MQTT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Device/Source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTags["io-tag"].length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No tags configured. Add devices and tags in the IO Setup section.
                  </TableCell>
                </TableRow>
              ) : (
                allTags["io-tag"].slice(0, 10).map((tag: any) => (
                  <TableRow key={tag.id}>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{tag.type}</Badge>
                    </TableCell>
                    <TableCell>{tag.device}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Available</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {allTags["io-tag"].length > 10 && (
            <p className="text-sm text-muted-foreground mt-2">
              Showing 10 of {allTags["io-tag"].length} tags
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tag Selection Dialog */}
      <TagSelectionDialog
        open={showTagSelector}
        onOpenChange={setShowTagSelector}
        multiSelect={true}
        selectedTags={currentTopicIndex !== null ? topics[currentTopicIndex]?.selectedTags || [] : []}
        onSelectTags={handleTagsSelected}
      />
    </div>
  )
}

// Topic Modal Component
interface TopicModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  topic: MqttPubTopic | null
  onSave: (topicData: Partial<MqttPubTopic>) => void
  onOpenTagSelector: () => void
}

function TopicModal({ open, onOpenChange, topic, onSave, onOpenTagSelector }: TopicModalProps) {
  const [formData, setFormData] = useState<Partial<MqttPubTopic>>({
    topic: "",
    tagType: "io-tag",
    tagFilter: "",
    selectedTags: [],
    qos: 0,
    retain: false,
    publishInterval: 1000,
    enabled: true,
    format: "json",
    includeTimestamp: true,
  })

  useEffect(() => {
    if (topic) {
      setFormData(topic)
    } else {
      setFormData({
        topic: "",
        tagType: "io-tag",
        tagFilter: "",
        selectedTags: [],
        qos: 0,
        retain: false,
        publishInterval: 1000,
        enabled: true,
        format: "json",
        includeTimestamp: true,
      })
    }
  }, [topic, open])

  const handleSave = () => {
    onSave(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{topic ? 'Edit Topic' : 'Add New Topic'}</DialogTitle>
          <DialogDescription>
            Configure MQTT topic settings and select tags to publish
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Topic</label>
              <Input
                placeholder="data/tags"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tag Type</label>
              <Select
                value={formData.tagType}
                onValueChange={(value: any) => setFormData({ ...formData, tagType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tag type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="io-tag">IO Tags</SelectItem>
                  <SelectItem value="calc-tag">Calc Tags</SelectItem>
                  <SelectItem value="user-tag">User Tags</SelectItem>
                  <SelectItem value="system-tag">System Tags</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tag Filter (Optional)</label>
              <Input
                placeholder="device:*, tag:temp*"
                value={formData.tagFilter}
                onChange={(e) => setFormData({ ...formData, tagFilter: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Filter tags by name pattern (e.g., temp*, *pressure)
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Selected Tags</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenTagSelector}
                className="w-full"
              >
                <Tag className="mr-2 h-4 w-4" />
                {formData.selectedTags?.length ? `${formData.selectedTags.length} tag(s) selected` : 'Select Tags'}
              </Button>
              {formData.selectedTags && formData.selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.selectedTags.map((tag) => (
                    <Badge key={tag.id} variant="secondary" className="text-xs">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">QoS Level</label>
              <Select
                value={formData.qos?.toString()}
                onValueChange={(value) => setFormData({ ...formData, qos: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select QoS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 - At most once</SelectItem>
                  <SelectItem value="1">1 - At least once</SelectItem>
                  <SelectItem value="2">2 - Exactly once</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Format</label>
              <Select
                value={formData.format}
                onValueChange={(value: any) => setFormData({ ...formData, format: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="plain">Plain Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Publish Interval (ms)</label>
              <Input
                type="number"
                placeholder="1000"
                value={formData.publishInterval}
                onChange={(e) => setFormData({ ...formData, publishInterval: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.retain}
                onCheckedChange={(checked) => setFormData({ ...formData, retain: checked as boolean })}
              />
              <label className="text-sm font-medium">Retain Message</label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.includeTimestamp}
                onCheckedChange={(checked) => setFormData({ ...formData, includeTimestamp: checked as boolean })}
              />
              <label className="text-sm font-medium">Include Timestamp</label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked as boolean })}
              />
              <label className="text-sm font-medium">Enabled</label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            {topic ? 'Save Changes' : 'Add Topic'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
