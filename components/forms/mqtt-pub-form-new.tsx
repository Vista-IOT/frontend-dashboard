"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Plus, Trash2, Edit2 } from "lucide-react"
import { MQTTBrokerModal, type MqttBroker } from "@/components/dialogs/mqtt-broker-modal"
import { MQTTTopicMappingModal, type TopicBrokerMapping } from "@/components/dialogs/mqtt-topic-mapping-modal"
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog"
import { Separator } from "@/components/ui/separator"

// ============================================================================
// SCHEMAS
// ============================================================================

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
  delimiter: z.string().optional(),
  includeTimestamp: z.boolean(),
  includeHeaders: z.boolean(),
  enabled: z.boolean(),
})

const mqttPubFormSchema = z.object({
  enabled: z.boolean(),
  brokers: z.array(mqttBrokerSchema),
  mappings: z.array(topicBrokerMappingSchema),
})

type MqttPubFormValues = z.infer<typeof mqttPubFormSchema>

// ============================================================================
// MAIN FORM COMPONENT
// ============================================================================

export function MQTTPubForm() {
  const { updateConfig, getConfig, saveConfigToBackend } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)

  // Modal states
  const [showBrokerModal, setShowBrokerModal] = useState(false)
  const [editingBrokerIndex, setEditingBrokerIndex] = useState<number | null>(null)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [editingMappingIndex, setEditingMappingIndex] = useState<number | null>(null)
  const [showTagSelector, setShowTagSelector] = useState(false)
  const [currentMappingIndex, setCurrentMappingIndex] = useState<number | null>(null)
  const [tempMappingData, setTempMappingData] = useState<Partial<TopicBrokerMapping> | null>(null)

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

  const brokers = form.watch("brokers") || []
  const mappings = form.watch("mappings") || []

  // ========== Broker Management ==========
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
    form.setValue("mappings", mappings.filter(m => m.brokerId !== id))
  }

  // ========== Mapping Management ==========
  const addMapping = () => {
    setEditingMappingIndex(null)
    setTempMappingData(null)  // Reset temp data for new mapping
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
    setTempMappingData(null)
  }

  const removeMapping = (id: string) => {
    form.setValue("mappings", mappings.filter(m => m.id !== id))
  }

  const openTagSelector = (mappingIndex: number) => {
    setCurrentMappingIndex(mappingIndex)
    setShowTagSelector(true)
  }

  const handleTagsSelected = (tags: any[]) => {
    if (editingMappingIndex !== null) {
      // Editing existing mapping - update directly in mappings array
      const updatedMappings = [...mappings]
      updatedMappings[editingMappingIndex].selectedTags = tags
      form.setValue("mappings", updatedMappings)
    } else {
      // Adding new mapping - store tags in temp data
      setTempMappingData(prev => ({
        ...prev,
        selectedTags: tags
      }))
    }
    // Reopen the mapping modal after tags are selected
    setShowTagSelector(false)
    setShowMappingModal(true)
  }

  const onSubmit = async (values: MqttPubFormValues) => {
    setIsSaving(true)
    try {
      // Save to Zustand store at the correct path
      updateConfig(['protocols', 'mqtt'], {
        enabled: values.enabled,
        brokers: values.brokers,
        mappings: values.mappings
      })
      
      // Persist to backend
      await saveConfigToBackend()
      
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

  const getBrokerName = (brokerId: string) => {
    return brokers.find(b => b.id === brokerId)?.name || 'Unknown'
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Enable/Disable Toggle */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>MQTT Publisher</CardTitle>
                <CardDescription>
                  Configure MQTT broker connections and topic publishing
                </CardDescription>
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
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardHeader>
        </Card>

        {/* MQTT Brokers Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  MQTT Brokers
                </CardTitle>
                <CardDescription>
                  Manage MQTT broker connections ({brokers.length} broker{brokers.length !== 1 ? 's' : ''})
                </CardDescription>
              </div>
              <Button type="button" onClick={addBroker} size="sm">
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
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Port</TableHead>
                      <TableHead>Protocol</TableHead>
                      <TableHead>Auth</TableHead>
                      <TableHead>TLS</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brokers.map((broker, index) => (
                      <TableRow key={broker.id}>
                        <TableCell className="font-medium">{broker.name}</TableCell>
                        <TableCell className="text-sm">{broker.address}</TableCell>
                        <TableCell className="text-sm">{broker.port}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {broker.protocol.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={broker.auth?.enabled ? "default" : "secondary"} className="text-xs">
                            {broker.auth?.enabled ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={broker.tls?.enabled ? "default" : "secondary"} className="text-xs">
                            {broker.tls?.enabled ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={broker.enabled ? "default" : "secondary"} className="text-xs">
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
                              <Edit2 className="h-4 w-4" />
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Topic to Broker Mappings Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Topic to Broker Mappings
                </CardTitle>
                <CardDescription>
                  Map topics to brokers and configure tag publishing ({mappings.length} mapping{mappings.length !== 1 ? 's' : ''})
                </CardDescription>
              </div>
              <Button 
                type="button" 
                onClick={addMapping} 
                size="sm"
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
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead>Broker</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>QoS</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Interval</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping, index) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium text-sm">{mapping.topicName}</TableCell>
                        <TableCell className="text-sm">{getBrokerName(mapping.brokerId)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {mapping.format.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{mapping.qos}</TableCell>
                        <TableCell>
                          {mapping.selectedTags && mapping.selectedTags.length > 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              {mapping.selectedTags.length} tag{mapping.selectedTags.length !== 1 ? 's' : ''}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">No tags</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{mapping.publishInterval}ms</TableCell>
                        <TableCell>
                          <Badge variant={mapping.enabled ? "default" : "secondary"} className="text-xs">
                            {mapping.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => editMapping(index)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeMapping(mapping.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>

        {/* Modals */}
        <MQTTBrokerModal
          open={showBrokerModal}
          onOpenChange={setShowBrokerModal}
          onSave={saveBroker}
          initialData={editingBrokerIndex !== null ? brokers[editingBrokerIndex] : null}
        />

        <MQTTTopicMappingModal
          open={showMappingModal}
          onOpenChange={(open) => {
            setShowMappingModal(open)
            // Reset temp data when modal closes
            if (!open) {
              setTempMappingData(null)
            }
          }}
          onSave={(data) => {
            // If we have temp mapping data with tags, merge it
            if (tempMappingData?.selectedTags) {
              saveMapping({
                ...data,
                selectedTags: tempMappingData.selectedTags
              })
            } else {
              saveMapping(data)
            }
          }}
          brokers={brokers}
          initialData={editingMappingIndex !== null ? mappings[editingMappingIndex] : tempMappingData}
          onOpenTagSelector={() => {
            setShowMappingModal(false)
            setShowTagSelector(true)
          }}
        />

        <TagSelectionDialog
          open={showTagSelector}
          onOpenChange={setShowTagSelector}
          onSelectTags={handleTagsSelected}
          multiSelect={true}
          selectedTags={
            editingMappingIndex !== null 
              ? mappings[editingMappingIndex]?.selectedTags || [] 
              : tempMappingData?.selectedTags || []
          }
        />
      </form>
    </Form>
  )
}
