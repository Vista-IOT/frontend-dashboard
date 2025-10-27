"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { RefreshCw, Plus, Trash2, Edit, Server, Tag, HelpCircle, FileSpreadsheet, Settings } from "lucide-react"
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog"
import { MQTTBrokerCSVIntegration, MQTTTopicCSVIntegration, getSampleBrokerCSVContent, getSampleTopicCSVContent } from "./mqtt-csv-integration"

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
  })).default([]),
  qos: z.number().min(0).max(2),
  format: z.enum(["json", "csv", "plain"]),
  delimiter: z.string().optional(),
  publishRate: z.number().min(100).default(1000),
  retained: z.boolean().default(false),
  enabled: z.boolean(),
  description: z.string().optional(),
})

const mqttPubFormSchema = z.object({
  enabled: z.boolean(),
  brokers: z.array(mqttBrokerSchema),
  mappings: z.array(topicMappingSchema),
})

type MqttBroker = z.infer<typeof mqttBrokerSchema>
type TopicMapping = z.infer<typeof topicMappingSchema>

export function MQTTPubForm() {
  const { updateConfig, getConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)
  
  // Broker management state
  const [showBrokerModal, setShowBrokerModal] = useState(false)
  const [editingBrokerIndex, setEditingBrokerIndex] = useState<number | null>(null)
  
  // Mapping management state
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [editingMappingIndex, setEditingMappingIndex] = useState<number | null>(null)
  
  // Tag selection state
  const [showTagSelector, setShowTagSelector] = useState(false)
  const [currentMappingIndex, setCurrentMappingIndex] = useState<number | null>(null)

  const form = useForm<z.infer<typeof mqttPubFormSchema>>({
    resolver: zodResolver(mqttPubFormSchema),
    defaultValues: {
      enabled: true,
      brokers: [],
      mappings: [],
    }
  })

  const brokers = form.watch("brokers")
  const mappings = form.watch("mappings")

  // Broker Management Functions
  const addBroker = () => {
    const newBroker: MqttBroker = {
      id: `broker-${Date.now()}`,
      name: "New Broker",
      address: "localhost",
      port: 1883,
      protocol: "mqtt",
      enabled: true,
    }
    form.setValue("brokers", [...brokers, newBroker])
    toast.success("Broker added")
  }

  const removeBroker = (id: string) => {
    form.setValue("brokers", brokers.filter(b => b.id !== id))
    form.setValue("mappings", mappings.filter(m => m.brokerId !== id))
    toast.success("Broker removed")
  }

  // Mapping Management Functions
  const addMapping = () => {
    if (brokers.length === 0) {
      toast.error("Please add a broker first")
      return
    }
    const newMapping: TopicBrokerMapping = {
      id: `mapping-${Date.now()}`,
      topicName: "data/tags",
      brokerId: brokers[0].id,
      selectedTags: [],
      qos: 0,
      format: "json",
      delimiter: ",",
      enabled: true,
    }
    form.setValue("mappings", [...mappings, newMapping])
    toast.success("Mapping added")
  }

  const removeMapping = (id: string) => {
    form.setValue("mappings", mappings.filter(m => m.id !== id))
    toast.success("Mapping removed")
  }

  // Tag Selection Functions
  const openTagSelectionDialog = (mappingIndex: number) => {
    setCurrentMappingIndex(mappingIndex)
    setShowTagSelector(true)
  }

  const handleTagSelection = (tags: any[]) => {
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
      updateConfig(['protocols', 'mqtt'], values)
      toast.success('MQTT configuration saved!')
    } catch (error) {
      toast.error('Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">MQTT Publishing Configuration</h2>
          <p className="text-muted-foreground">
            Manage MQTT brokers and topic-to-broker mappings
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Brokers Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>MQTT Brokers</CardTitle>
                  <CardDescription>
                    Manage broker connections ({brokers.length} broker{brokers.length !== 1 ? 's' : ''})
                  </CardDescription>
                </div>
                <Button type="button" onClick={addBroker}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Broker
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {brokers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  No brokers configured. Click "Add Broker" to get started.
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
                    {brokers.map((broker) => (
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
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeBroker(broker.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Mappings Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Topic to Broker Mappings</CardTitle>
                  <CardDescription>
                    Configure topic mappings ({mappings.length} mapping{mappings.length !== 1 ? 's' : ''})
                  </CardDescription>
                </div>
                <Button type="button" onClick={addMapping} disabled={brokers.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Mapping
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {mappings.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  {brokers.length === 0 
                    ? "Add a broker first to create mappings" 
                    : "No mappings configured. Click 'Add Mapping' to get started."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead>Broker</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping, index) => {
                      const broker = brokers.find(b => b.id === mapping.brokerId)
                      return (
                        <TableRow key={mapping.id}>
                          <TableCell className="font-medium">{mapping.topicName}</TableCell>
                          <TableCell>{broker?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openTagSelectionDialog(index)}
                            >
                              {mapping.selectedTags.length > 0 
                                ? `${mapping.selectedTags.length} tags` 
                                : 'Select Tags'}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{mapping.format.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={mapping.enabled ? "default" : "secondary"}>
                              {mapping.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeMapping(mapping.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
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

      {/* Tag Selection Dialog */}
      <TagSelectionDialog
        open={showTagSelector}
        onOpenChange={setShowTagSelector}
        multiSelect={true}
        selectedTags={currentMappingIndex !== null ? mappings[currentMappingIndex]?.selectedTags || [] : []}
        onSelectTags={handleTagSelection}
      />
    </div>
  )
}
