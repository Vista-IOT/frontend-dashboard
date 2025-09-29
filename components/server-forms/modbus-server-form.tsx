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
import { useConfigStore } from "@/lib/stores/configuration-store"
import { toast } from "sonner"
import { Loader2, Server, Plus, Trash2, Tag } from "lucide-react"
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog"

// Modbus TCP Server configuration schema
const serverConfigSchema = z.object({
  enabled: z.boolean().default(false),
  tcp: z.object({
    port: z
      .number({ invalid_type_error: "Port must be a number" })
      .min(1, "Port must be >= 1")
      .max(65535, "Port must be <= 65535")
      .default(502),
    maxConnections: z
      .number({ invalid_type_error: "Max connections must be a number" })
      .min(1)
      .max(100)
      .default(10),
    responseTimeoutMs: z
      .number({ invalid_type_error: "Timeout must be a number" })
      .min(100)
      .max(60000)
      .default(3000),
  }),
  unitId: z
    .number({ invalid_type_error: "Unit ID must be a number" })
    .min(1)
    .max(247)
    .default(1),
  allowBroadcastId: z.boolean().default(false),
});

// Server tag mapping interface - similar to Advantech Edge Link
interface ModbusServerTag {
  id: string;
  tagName: string;           // Name of the source tag
  tagType: string;           // IO, User, System, Stats, Calculation
  dataType: string;          // Analog, Digital, etc.
  defaultValue: string | number;
  modbusAddress: number;     // Modbus register address
  registerType: "Coil" | "Discrete Input" | "Input Register" | "Holding Register";
}

type ServerFormValues = z.infer<typeof serverConfigSchema>

export default function ModbusTcpServerForm() {
  const config = useConfigStore((s) => s.config)
  const setConfig = useConfigStore((s) => s.setConfig)
  
  // Server tags state
  const [serverTags, setServerTags] = useState<ModbusServerTag[]>([])
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [nextAddress, setNextAddress] = useState(1) // Auto-increment addresses

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverConfigSchema),
    defaultValues: {
      enabled: false,
      tcp: { port: 502, maxConnections: 10, responseTimeoutMs: 3000 },
      unitId: 1,
      allowBroadcastId: false,
    },
    mode: "onChange",
  })

  // Hydrate from existing config
  useEffect(() => {
    const serverCfg = (config as any)?.services?.modbusTcpServer
    if (serverCfg) {
      form.reset({
        enabled: Boolean(serverCfg.enabled ?? false),
        tcp: {
          port: Number(serverCfg.tcp?.port ?? 502),
          maxConnections: Number(serverCfg.tcp?.maxConnections ?? 10),
          responseTimeoutMs: Number(serverCfg.tcp?.responseTimeoutMs ?? 3000),
        },
        unitId: Number(serverCfg.unitId ?? 1),
        allowBroadcastId: Boolean(serverCfg.allowBroadcastId ?? false),
      })
      
      if (serverCfg.tags && Array.isArray(serverCfg.tags)) {
        setServerTags(serverCfg.tags)
        // Set next address to max + 1
        const maxAddr = Math.max(0, ...serverCfg.tags.map((t: any) => t.modbusAddress || 0))
        setNextAddress(maxAddr + 1)
      }
    }
  }, [config, form])

  const onSubmit = (values: ServerFormValues) => {
    const next = {
      ...config,
      services: {
        ...(config as any)?.services,
        modbusTcpServer: {
          ...values,
          tags: serverTags,
        },
      },
    }
    setConfig(next)
    toast.success("Modbus TCP Server configuration saved")
  }

  const handleAddTag = (selectedTag: any) => {
    // Determine tag type based on the source
    let tagType = "IO"
    if (selectedTag.type === "user") tagType = "User"
    else if (selectedTag.type === "system") tagType = "System"
    else if (selectedTag.type === "calculation") tagType = "Calculation"
    else if (selectedTag.type === "stats") tagType = "Stats"

    // Auto-assign register type based on data type
    let registerType: ModbusServerTag["registerType"] = "Holding Register"
    if (selectedTag.dataType === "Digital") {
      registerType = "Coil"
    }

    const newTag: ModbusServerTag = {
      id: selectedTag.id,
      tagName: selectedTag.name,
      tagType,
      dataType: selectedTag.dataType || "Analog",
      defaultValue: selectedTag.defaultValue || 0,
      modbusAddress: nextAddress,
      registerType,
    }

    setServerTags([...serverTags, newTag])
    setNextAddress(nextAddress + 1)
    setShowTagDialog(false)
    toast.success(`Tag "${selectedTag.name}" added to Modbus server`)
  }

  const handleRemoveTag = (tagId: string) => {
    setServerTags(serverTags.filter(tag => tag.id !== tagId))
    toast.success("Tag removed from Modbus server")
  }

  const handleAddressChange = (tagId: string, newAddress: number) => {
    setServerTags(serverTags.map(tag => 
      tag.id === tagId ? { ...tag, modbusAddress: newAddress } : tag
    ))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5"/> Modbus TCP Server
              </CardTitle>
              <CardDescription>
                Expose gateway data over Modbus TCP (port 502 by default)
              </CardDescription>
            </div>
            {form.formState.isSubmitting && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Server Enabled</div>
                  <div className="text-sm text-muted-foreground">Toggle to start/stop the Modbus TCP server</div>
                </div>
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tcp.port"
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
                        />
                      </FormControl>
                      <FormDescription>Default is 502</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tcp.maxConnections"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Connections</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={100} 
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))} 
                        />
                      </FormControl>
                      <FormDescription>Limit concurrent client connections</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tcp.responseTimeoutMs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Response Timeout (ms)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={100} 
                          max={60000} 
                          step={100} 
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))} 
                        />
                      </FormControl>
                      <FormDescription>How long to wait before timing out a request</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit ID</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={247} 
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))} 
                        />
                      </FormControl>
                      <FormDescription>Defaults to 1; some clients require a specific Unit ID</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="allowBroadcastId"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3 rounded-lg border p-4">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel>Allow Broadcast ID (0)</FormLabel>
                        <FormDescription>
                          Accept requests with Unit ID 0 (broadcast). Typically disabled.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Status:</span>
                <Badge variant={form.getValues("enabled") ? "default" : "secondary"}>
                  {form.getValues("enabled") ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Changes are saved to the active configuration
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => form.reset()}>
                  Reset
                </Button>
                <Button type="submit">Save Configuration</Button>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {/* Tags Table - Similar to Advantech Edge Link */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5"/> Server Tags
              </CardTitle>
              <CardDescription>
                Map tags to Modbus addresses for client access
              </CardDescription>
            </div>
            <Button onClick={() => setShowTagDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {serverTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tags added yet</p>
              <p className="text-sm">Click "Add Tag" to map tags to Modbus addresses</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Default Value</TableHead>
                    <TableHead>Register Type</TableHead>
                    <TableHead>Modbus Address</TableHead>
                    <TableHead className="w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serverTags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell className="font-medium">{tag.tagName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tag.tagType}</Badge>
                      </TableCell>
                      <TableCell>{tag.dataType}</TableCell>
                      <TableCell>{tag.defaultValue}</TableCell>
                      <TableCell>{tag.registerType}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={tag.modbusAddress}
                          onChange={(e) => handleAddressChange(tag.id, Number(e.target.value))}
                          className="w-20"
                          min={1}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTag(tag.id)}
                          className="text-destructive hover:text-destructive"
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
      />
    </div>
  )
}
