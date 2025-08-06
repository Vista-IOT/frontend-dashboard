"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useConfigStore } from "@/lib/stores/configuration-store"
import React, { useState, useEffect, createContext, useContext } from "react"
import { RefreshCw, Plus, X, FileSpreadsheet, Download, Upload, Check, Trash2, ChevronDown, ChevronRight, Server, Cpu, Tag, UserCircle, FileDigit, BarChart, Cog, Terminal } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog"

const modbusFormSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["tcp", "rtu"]),
  tcp: z.object({
    port: z.number().min(1).max(65535),
    max_connections: z.number().min(1).max(100),
    timeout: z.number().min(1).max(3600)
  }),
  serial: z.object({
    port: z.string(),
    baudrate: z.number().min(1200).max(115200),
    data_bits: z.number().min(5).max(8),
    parity: z.enum(["none", "even", "odd"]),
    stop_bits: z.number().min(1).max(2)
  }),
  slave_id: z.number().min(1).max(247)
})

type ModbusFormValues = z.infer<typeof modbusFormSchema>

// Define the IO Tag interface
interface IOTag {
  id: string;
  name: string;
  dataType: string;
  address: string;
  description: string;
}

// Define the IO Port interface
interface Port {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  devices: Device[];
  description?: string;
  scanTime?: number;
  timeOut?: number;
  retryCount?: number;
  autoRecoverTime?: number;
  scanMode?: string;
  serialSettings?: any;
}

// Define the Device interface for IO Ports
interface Device {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  unitNumber?: number;
  description?: string;
  tagWriteType?: string;
  addDeviceNameAsPrefix?: boolean;
  extensionProperties?: any;
  tags?: IOTag[];
}

// Define the tag interface
interface ModbusTag {
  id: string;
  name: string;
  tagType: string;
  address: string;
  modbusAddress: string;
  dataType: string;
  littleEndian: boolean;
  reverseWord: boolean;
}

// Define the device interface
interface ModbusDevice {
  id: string;
  deviceId: number;
  name: string;
  tags: ModbusTag[];
}

interface ModbusFormProps {
  separateAdvancedConfig?: boolean;
}

// Global IO ports context
export interface IOPortsContextType {
  ioPorts: Port[];
  setIoPorts: React.Dispatch<React.SetStateAction<Port[]>>;
}

// Import this context if it exists, otherwise create it
// In a real application, you'd have this defined in a shared context file
const IOPortsContext = createContext<IOPortsContextType>({ioPorts: [], setIoPorts: () => {}});
export const useIOPorts = () => useContext(IOPortsContext);

export function ModbusForm({ separateAdvancedConfig = false }: ModbusFormProps) {
  const { updateConfig, getConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"tcp" | "rtu">("tcp")
  
  // State for Modbus TCP settings
  const [modbusTcpEnabled, setModbusTcpEnabled] = useState(true)
  const [modbusTcpPort, setModbusTcpPort] = useState(502)
  const [modbusTcpMaxUsers, setModbusTcpMaxUsers] = useState(4)
  const [modbusTcpIdleTime, setModbusTcpIdleTime] = useState(120)
  const [modbusRtuOverTcp, setModbusRtuOverTcp] = useState(false)
  
  // State for tag selection dialog
  const [tagSelectionDialogOpen, setTagSelectionDialogOpen] = useState(false)
  
  // IO tags tree structure - For this POC component, we'll use the global app state
  // In a real application, this would come from a context or state management solution
  const [ioPorts, setIoPorts] = useState<Port[]>([])
  const [expandedPorts, setExpandedPorts] = useState<string[]>([])
  const [expandedDevices, setExpandedDevices] = useState<string[]>([])
  
  // State for Modbus RTU settings
  const [modbusRtuEnabled, setModbusRtuEnabled] = useState(false)
  const [modbusRtuPort, setModbusRtuPort] = useState("COM1")
  const [modbusRtuBaudRate, setModbusRtuBaudRate] = useState(9600)
  const [modbusRtuDataBit, setModbusRtuDataBit] = useState(8)
  const [modbusRtuStopBit, setModbusRtuStopBit] = useState(1)
  const [modbusRtuParity, setModbusRtuParity] = useState<"none" | "even" | "odd">("none")
  
  // State for device and tags
  const [devices, setDevices] = useState<ModbusDevice[]>([
    {
      id: "device1",
      deviceId: 1,
      name: "Energy Meter",
      tags: []
    }
  ])
  
  const [selectedDevice, setSelectedDevice] = useState<ModbusDevice | null>(devices[0])
  const [selectedDeviceId, setSelectedDeviceId] = useState<number>(1)

  const form = useForm<ModbusFormValues>({
    resolver: zodResolver(modbusFormSchema),
    defaultValues: {
      enabled: false,
      mode: "tcp",
      tcp: {
        port: 502,
        max_connections: 5,
        timeout: 60
      },
      serial: {
        port: "/dev/ttyUSB0",
        baudrate: 9600,
        data_bits: 8,
        parity: "none",
        stop_bits: 1
      },
      slave_id: 1
    }
  })

  useEffect(() => {
    const fetchIoPorts = async () => {
      try {
        const storedPorts = localStorage.getItem('io_ports_data')
        if (storedPorts) {
          setIoPorts(JSON.parse(storedPorts))
        }
        
        const handleIoPortsUpdate = (event: StorageEvent) => {
          if (event.key === 'io_ports_data' && event.newValue) {
            try {
              const updatedPorts = JSON.parse(event.newValue)
              if (updatedPorts) {
                setIoPorts(updatedPorts)
              }
            } catch (error) {
              console.error('Error parsing updated IO ports data:', error)
            }
          }
        }
        
        window.addEventListener('storage', handleIoPortsUpdate)
        
        return () => {
          window.removeEventListener('storage', handleIoPortsUpdate)
        }
      } catch (error) {
        console.error('Error fetching IO ports data:', error)
      }
    }
    
    const config = getConfig()?.protocols?.modbus;
    
    if (config) {
      setModbusTcpEnabled(config.enabled || false) // Use main config enabled, not tcp.enabled
      setModbusTcpPort(config.tcp?.port || 502)
      setModbusTcpMaxUsers(config.tcp?.max_connections || 4)
      setModbusTcpIdleTime(config.tcp?.timeout || 120)
      setModbusRtuOverTcp(false) // This property doesn't exist in the interface, default to false
      
      setModbusRtuEnabled(config.enabled || false) // Use main config enabled, not rtu.enabled
      setModbusRtuPort(config.serial?.port || "COM1")
      setModbusRtuBaudRate(config.serial?.baudrate || 9600)
      setModbusRtuDataBit(config.serial?.data_bits || 8)
      setModbusRtuStopBit(config.serial?.stop_bits || 1)
      const parity = config.serial?.parity
      setModbusRtuParity(parity === "even" || parity === "odd" ? parity : "none")
      
      form.reset({
        enabled: config.enabled || false,
        mode: (config.mode === "tcp" || config.mode === "rtu") ? config.mode : "tcp",
        tcp: {
          port: config.tcp?.port || 502,
          max_connections: config.tcp?.max_connections || 4,
          timeout: config.tcp?.timeout || 120
        },
        serial: {
          port: config.serial?.port || "COM1",
          baudrate: config.serial?.baudrate || 9600,
          data_bits: config.serial?.data_bits || 8,
          parity: (config.serial?.parity === "even" || config.serial?.parity === "odd") ? config.serial.parity : "none",
          stop_bits: config.serial?.stop_bits || 1
        },
        slave_id: config.slave_id || 1
      })
      
      setActiveTab((config.mode === "tcp" || config.mode === "rtu") ? config.mode : "tcp")
    }
    
    fetchIoPorts()
    
    const pollInterval = setInterval(() => {
      try {
        const storedPorts = localStorage.getItem('io_ports_data')
        if (storedPorts) {
          const parsedPorts = JSON.parse(storedPorts)
          if (JSON.stringify(parsedPorts) !== JSON.stringify(ioPorts)) {
            setIoPorts(parsedPorts)
          }
        }
      } catch (error) {
        console.error('Error in polling IO ports data:', error)
      }
    }, 2000)
    
    return () => {
      clearInterval(pollInterval)
    }
  }, []);

  const onSubmit = async (values: ModbusFormValues) => {
    setIsSaving(true)
    try {
      updateConfig(['protocols', 'modbus'], {
        enabled: values.enabled,
        mode: values.mode,
        tcp: values.tcp,
        serial: values.serial,
        slave_id: values.slave_id
      })
      toast.success('Modbus settings saved successfully!', {
        duration: 3000
      })
    } catch (error) {
      console.error('Error saving Modbus settings:', error)
      toast.error('Failed to save Modbus settings', {
        duration: 5000
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Helper functions
  const handleDeviceIdChange = (value: number) => {
    setSelectedDeviceId(value)
    const device = devices.find(d => d.deviceId === value)
    if (device) {
      setSelectedDevice(device)
    }
  }
  
  const addNewTag = () => {
    // Open the tag selection dialog instead of directly adding a tag
    setTagSelectionDialogOpen(true)
  }
  
  // Toggle expansion of a port in the tree
  const togglePortExpansion = (portId: string) => {
    setExpandedPorts(prev => {
      if (prev.includes(portId)) {
        return prev.filter(id => id !== portId);
      } else {
        return [...prev, portId];
      }
    });
  }
  
  // Toggle expansion of a device in the tree
  const toggleDeviceExpansion = (deviceId: string) => {
    setExpandedDevices(prev => {
      if (prev.includes(deviceId)) {
        return prev.filter(id => id !== deviceId);
      } else {
        return [...prev, deviceId];
      }
    });
  }
  
  // Select a tag from the tree and add it to the current device
  const selectTagFromTree = (tag: IOTag, deviceName: string, portName: string) => {
    // Implement logic to add selected tag to the current device's tags
    if (selectedDevice) {
      // Generate a unique ID for the new tag
      const newTagId = `tag-${Date.now()}`
      
      // Create a new tag object
      const newTag: ModbusTag = {
        id: newTagId,
        name: `${deviceName}:${tag.name}`,
        tagType: "holding", // Default to holding register
        address: tag.address, // Use the original tag's address
        modbusAddress: tag.address,
        dataType: tag.dataType || "uint16", // Default to uint16
        littleEndian: false,
        reverseWord: false
      }
      
      // Update the selected device with the new tag
      const updatedDevice = {
        ...selectedDevice,
        tags: [...selectedDevice.tags, newTag]
      }
      
      setSelectedDevice(updatedDevice)
      
      // Update the devices array
      setDevices(prev => prev.map(device => 
        device.id === selectedDevice.id ? updatedDevice : device
      ))
      
      // Close the tag selection dialog
      setTagSelectionDialogOpen(false)
    }
  }

  const handleTagSelection = (tag: any) => {
    if (selectedDevice) {
      // Generate a unique ID for the new tag
      const newTagId = `tag-${Date.now()}`
      
      // Create a new tag object
      const newTag: ModbusTag = {
        id: newTagId,
        name: tag.name,
        tagType: "holding", // Default to holding register
        address: tag.address || tag.id, // Use the original tag's address or id
        modbusAddress: tag.address || tag.id,
        dataType: tag.dataType || "uint16", // Default to uint16
        littleEndian: false,
        reverseWord: false
      }
      
      // Update the selected device with the new tag
      const updatedDevice = {
        ...selectedDevice,
        tags: [...selectedDevice.tags, newTag]
      }
      
      setSelectedDevice(updatedDevice)
      
      // Update the devices array
      setDevices(prev => prev.map(device => 
        device.id === selectedDevice.id ? updatedDevice : device
      ))
      
      // Close the tag selection dialog
      setTagSelectionDialogOpen(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Enable Modbus</FormLabel>
                    <FormDescription>
                      Enable or disable Modbus protocol
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
          </CardContent>
        </Card>

        {/* If not separate, render advanced config inside the form */}
        {form.watch("enabled") && !separateAdvancedConfig && (
            <>
              <div className="space-y-4">

                {/* Modbus TCP Settings */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <CardTitle className="text-base">Modbus TCP Settings</CardTitle>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs">Enable</span>
                          <Switch 
                            checked={modbusTcpEnabled} 
                            onCheckedChange={setModbusTcpEnabled} 
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {modbusTcpEnabled && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="tcp-port">Port</Label>
                              <Input 
                                id="tcp-port" 
                                type="number" 
                                value={modbusTcpPort} 
                                onChange={(e) => setModbusTcpPort(parseInt(e.target.value))} 
                                placeholder="502" 
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="tcp-max-users">Max Users</Label>
                              <Input 
                                id="tcp-max-users" 
                                type="number" 
                                value={modbusTcpMaxUsers} 
                                onChange={(e) => setModbusTcpMaxUsers(parseInt(e.target.value))} 
                                placeholder="4" 
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="tcp-idle-time">Idle Time (s)</Label>
                              <Input 
                                id="tcp-idle-time" 
                                type="number" 
                                value={modbusTcpIdleTime} 
                                onChange={(e) => setModbusTcpIdleTime(parseInt(e.target.value))} 
                                placeholder="120" 
                              />
                            </div>
                            <div className="flex items-center space-x-2 pt-6">
                              <Checkbox 
                                id="rtu-over-tcp" 
                                checked={modbusRtuOverTcp} 
                                onCheckedChange={(checked) => 
                                  setModbusRtuOverTcp(checked === true)}
                              />
                              <Label htmlFor="rtu-over-tcp">RTU over TCP</Label>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Modbus RTU Settings */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <CardTitle className="text-base">Modbus RTU Settings</CardTitle>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs">Enable</span>
                          <Switch 
                            checked={modbusRtuEnabled} 
                            onCheckedChange={setModbusRtuEnabled} 
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {modbusRtuEnabled && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="rtu-port">Port</Label>
                              <Select 
                                value={modbusRtuPort} 
                                onValueChange={setModbusRtuPort}
                              >
                                <SelectTrigger id="rtu-port">
                                  <SelectValue placeholder="Select port" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="COM1">COM1</SelectItem>
                                  <SelectItem value="COM2">COM2</SelectItem>
                                  <SelectItem value="COM3">COM3</SelectItem>
                                  <SelectItem value="COM4">COM4</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="rtu-baud-rate">Baud Rate</Label>
                              <Select 
                                value={modbusRtuBaudRate.toString()} 
                                onValueChange={(value) => setModbusRtuBaudRate(parseInt(value))}
                              >
                                <SelectTrigger id="rtu-baud-rate">
                                  <SelectValue placeholder="Select baud rate" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="9600">9600</SelectItem>
                                  <SelectItem value="19200">19200</SelectItem>
                                  <SelectItem value="38400">38400</SelectItem>
                                  <SelectItem value="57600">57600</SelectItem>
                                  <SelectItem value="115200">115200</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="rtu-data-bit">Data Bits</Label>
                              <Select 
                                value={modbusRtuDataBit.toString()} 
                                onValueChange={(value) => setModbusRtuDataBit(parseInt(value))}
                              >
                                <SelectTrigger id="rtu-data-bit">
                                  <SelectValue placeholder="Data bits" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="7">7</SelectItem>
                                  <SelectItem value="8">8</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="rtu-stop-bit">Stop Bits</Label>
                              <Select 
                                value={modbusRtuStopBit.toString()} 
                                onValueChange={(value) => setModbusRtuStopBit(parseInt(value))}
                              >
                                <SelectTrigger id="rtu-stop-bit">
                                  <SelectValue placeholder="Stop bits" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1</SelectItem>
                                  <SelectItem value="2">2</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="rtu-parity">Parity</Label>
                              <Select 
                                value={modbusRtuParity} 
                                onValueChange={(value: "none" | "even" | "odd") => setModbusRtuParity(value)}
                              >
                                <SelectTrigger id="rtu-parity">
                                  <SelectValue placeholder="Parity" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="even">Even</SelectItem>
                                  <SelectItem value="odd">Odd</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Tag Table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Tag Configuration</CardTitle>
                  </CardHeader>
                  <div className="px-2 sm:px-4 md:px-6 pb-2">
                    <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-2 border-b mb-2">
                      {devices.map((device) => (
                        <Badge 
                          key={device.id}
                          variant={selectedDevice?.id === device.id ? "default" : "outline"} 
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedDevice(device);
                            setSelectedDeviceId(device.deviceId);
                          }}
                        >
                          Device {device.deviceId}: {device.name}
                        </Badge>
                      ))}
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => {
                        const newDevice = {
                          id: `device-${Date.now()}`,
                          deviceId: devices.length + 1,
                          name: `Device ${devices.length + 1}`,
                          tags: []
                        };
                        setDevices([...devices, newDevice]);
                        setSelectedDevice(newDevice);
                        setSelectedDeviceId(newDevice.deviceId);
                      }}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardContent>
                    {/* Mobile view: Card-based tag list */}
                    <div className="block md:hidden space-y-4">
                      {selectedDevice?.tags?.map((tag) => (
                        <Card key={tag.id} className="p-4 border">
                          <div className="flex justify-between items-start mb-3">
                            <div className="w-full">
                              <Label htmlFor={`tag-name-${tag.id}`} className="text-xs mb-1 block">Name</Label>
                              <Input 
                                id={`tag-name-${tag.id}`}
                                value={tag.name} 
                                onChange={(e) => {
                                  if (selectedDevice) {
                                    const updatedTags = selectedDevice.tags.map(t => 
                                      t.id === tag.id ? { ...t, name: e.target.value } : t
                                    )
                                    const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                    setSelectedDevice(updatedDevice)
                                    setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                  }
                                }} 
                                className="h-8 w-full" 
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                if (selectedDevice) {
                                  const updatedDevice = {
                                    ...selectedDevice,
                                    tags: selectedDevice.tags.filter(t => t.id !== tag.id)
                                  }
                                  setSelectedDevice(updatedDevice)
                                  setDevices(prev => prev.map(d => 
                                    d.id === updatedDevice.id ? updatedDevice : d
                                  ))
                                }
                              }}
                              className="h-8 w-8 ml-2"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <Label htmlFor={`tag-type-${tag.id}`} className="text-xs mb-1 block">Tag Type</Label>
                              <div className="relative">
                                <select
                                  id={`tag-type-${tag.id}`}
                                  className="w-full h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                  value={tag.tagType || ""}
                                  onChange={(e) => {
                                    if (selectedDevice) {
                                      const value = e.target.value;
                                      const updatedTags = selectedDevice.tags.map(t => 
                                        t.id === tag.id ? { ...t, tagType: value } : t
                                      )
                                      const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                      setSelectedDevice(updatedDevice)
                                      setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                    }
                                  }}
                                >
                                  <option value="" disabled>Select type</option>
                                  <option value="coil">Coil</option>
                                  <option value="discrete_input">Discrete Input</option>
                                  <option value="holding_register">Holding Register</option>
                                  <option value="input_register">Input Register</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                  <ChevronDown className="h-4 w-4 opacity-50" />
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <Label htmlFor={`tag-address-${tag.id}`} className="text-xs mb-1 block">Address</Label>
                              <Input 
                                id={`tag-address-${tag.id}`}
                                value={tag.address} 
                                onChange={(e) => {
                                  if (selectedDevice) {
                                    const updatedTags = selectedDevice.tags.map(t => 
                                      t.id === tag.id ? { ...t, address: e.target.value } : t
                                    )
                                    const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                    setSelectedDevice(updatedDevice)
                                    setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                  }
                                }} 
                                className="h-8 w-full" 
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <Label htmlFor={`tag-data-type-${tag.id}`} className="text-xs mb-1 block">Data Type</Label>
                              <div className="relative">
                                <select
                                  id={`tag-data-type-${tag.id}`}
                                  className="w-full h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                  value={tag.dataType || ""}
                                  onChange={(e) => {
                                    if (selectedDevice) {
                                      const value = e.target.value;
                                      const updatedTags = selectedDevice.tags.map(t => 
                                        t.id === tag.id ? { ...t, dataType: value } : t
                                      )
                                      const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                      setSelectedDevice(updatedDevice)
                                      setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                    }
                                  }}
                                >
                                  <option value="" disabled>Select data type</option>
                                  <option value="uint16">UINT16</option>
                                  <option value="int16">INT16</option>
                                  <option value="uint32">UINT32</option>
                                  <option value="int32">INT32</option>
                                  <option value="float32">FLOAT32</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                  <ChevronDown className="h-4 w-4 opacity-50" />
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={`little-endian-${tag.id}`} 
                                    checked={tag.littleEndian} 
                                    onCheckedChange={(checked) => {
                                      if (selectedDevice) {
                                        const updatedTags = selectedDevice.tags.map(t => 
                                          t.id === tag.id ? { ...t, littleEndian: !!checked } : t
                                        )
                                        const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                        setSelectedDevice(updatedDevice)
                                        setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                      }
                                    }} 
                                  />
                                  <Label htmlFor={`little-endian-${tag.id}`} className="text-xs">Little Endian</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={`reverse-word-${tag.id}`} 
                                    checked={tag.reverseWord} 
                                    onCheckedChange={(checked) => {
                                      if (selectedDevice) {
                                        const updatedTags = selectedDevice.tags.map(t => 
                                          t.id === tag.id ? { ...t, reverseWord: !!checked } : t
                                        )
                                        const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                        setSelectedDevice(updatedDevice)
                                        setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                      }
                                    }} 
                                  />
                                  <Label htmlFor={`reverse-word-${tag.id}`} className="text-xs">Reverse Word</Label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                      
                      <div className="mt-4">
                        <Button variant="outline" size="sm" onClick={addNewTag}>
                          <Plus className="h-4 w-4 mr-1" /> Add Tag
                        </Button>
                      </div>
                    </div>
                    
                    {/* Desktop view: Table-based tag list */}
                    <div className="hidden md:block rounded-md border overflow-x-auto">
                      <Table className="min-w-[800px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Name</TableHead>
                            <TableHead className="w-[150px]">Tag Type</TableHead>
                            <TableHead className="w-[120px]">Address</TableHead>
                            <TableHead className="w-[120px]">Data Type</TableHead>
                            <TableHead className="w-[150px]">Options</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedDevice?.tags?.map((tag) => (
                            <TableRow key={tag.id}>
                              <TableCell>
                                <Input 
                                  value={tag.name} 
                                  onChange={(e) => {
                                    if (selectedDevice) {
                                      const updatedTags = selectedDevice.tags.map(t => 
                                        t.id === tag.id ? { ...t, name: e.target.value } : t
                                      )
                                      const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                      setSelectedDevice(updatedDevice)
                                      setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                    }
                                  }} 
                                  className="h-8 w-full" 
                                />
                              </TableCell>
                              <TableCell>
                                <Select 
                                  value={tag.tagType} 
                                  onValueChange={(value) => {
                                    if (selectedDevice) {
                                      const updatedTags = selectedDevice.tags.map(t => 
                                        t.id === tag.id ? { ...t, tagType: value } : t
                                      )
                                      const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                      setSelectedDevice(updatedDevice)
                                      setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Coil">Coil</SelectItem>
                                    <SelectItem value="Discrete Input">Discrete Input</SelectItem>
                                    <SelectItem value="Holding Register">Holding Register</SelectItem>
                                    <SelectItem value="Input Register">Input Register</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input 
                                  value={tag.address} 
                                  onChange={(e) => {
                                    if (selectedDevice) {
                                      const updatedTags = selectedDevice.tags.map(t => 
                                        t.id === tag.id ? { ...t, address: e.target.value, modbusAddress: e.target.value } : t
                                      )
                                      const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                      setSelectedDevice(updatedDevice)
                                      setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                    }
                                  }} 
                                  className="h-8" 
                                />
                              </TableCell>
                              <TableCell>
                                <Select 
                                  value={tag.dataType} 
                                  onValueChange={(value) => {
                                    if (selectedDevice) {
                                      const updatedTags = selectedDevice.tags.map(t => 
                                        t.id === tag.id ? { ...t, dataType: value } : t
                                      )
                                      const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                      setSelectedDevice(updatedDevice)
                                      setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="UInt16">Unsigned Integer (16 bits)</SelectItem>
                                    <SelectItem value="UInt32">Unsigned Integer (32 bits)</SelectItem>
                                    <SelectItem value="UInt64">Unsigned Integer (64 bits)</SelectItem>
                                    <SelectItem value="Int16">Signed Integer (16 bits)</SelectItem>
                                    <SelectItem value="Int32">Signed Integer (32 bits)</SelectItem>
                                    <SelectItem value="Int64">Signed Integer (64 bits)</SelectItem>
                                    <SelectItem value="Float">Float (32 bits)</SelectItem>
                                    <SelectItem value="Double">Double (64 bits)</SelectItem>
                                    <SelectItem value="BCD16">BCD (16 bits)</SelectItem>
                                    <SelectItem value="BCD32">BCD (32 bits)</SelectItem>
                                    <SelectItem value="BCD64">BCD (64 bits)</SelectItem>
                                    <SelectItem value="Text">Text</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox 
                                      id={`little-endian-${tag.id}`} 
                                      checked={tag.littleEndian} 
                                      onCheckedChange={(checked) => {
                                        if (selectedDevice) {
                                          const updatedTags = selectedDevice.tags.map(t => 
                                            t.id === tag.id ? { ...t, littleEndian: checked === true } : t
                                          )
                                          const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                          setSelectedDevice(updatedDevice)
                                          setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                        }
                                      }} 
                                    />
                                    <Label htmlFor={`little-endian-${tag.id}`} className="text-xs">Little Endian</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox 
                                      id={`reverse-word-${tag.id}`} 
                                      checked={tag.reverseWord} 
                                      onCheckedChange={(checked) => {
                                        if (selectedDevice) {
                                          const updatedTags = selectedDevice.tags.map(t => 
                                            t.id === tag.id ? { ...t, reverseWord: checked === true } : t
                                          )
                                          const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                          setSelectedDevice(updatedDevice)
                                          setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                        }
                                      }} 
                                    />
                                    <Label htmlFor={`reverse-word-${tag.id}`} className="text-xs">Reverse Word</Label>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => {
                                    if (selectedDevice) {
                                      const updatedDevice = {
                                        ...selectedDevice,
                                        tags: selectedDevice.tags.filter(t => t.id !== tag.id)
                                      }
                                      setSelectedDevice(updatedDevice)
                                      setDevices(prev => prev.map(d => 
                                        d.id === updatedDevice.id ? updatedDevice : d
                                      ))
                                    }
                                  }}
                                  className="h-8 w-8"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4">
                      <Button variant="outline" size="sm" onClick={addNewTag}>
                        <Plus className="h-4 w-4 mr-1" /> Add Tag
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Button variant="outline" className="w-full sm:w-auto">Discard Changes</Button>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Upload className="h-4 w-4 mr-1" /> Import
                </Button>
                <Button className="w-full sm:w-auto">
                  <Check className="h-4 w-4 mr-1" /> Apply Changes
                </Button>
              </div>
            </>
        )}

        {/* Save button moved above the advanced configuration section */}
      </form>
      
      {/* Tag Selection Dialog */}
      <TagSelectionDialog
        open={tagSelectionDialogOpen}
        onOpenChange={setTagSelectionDialogOpen}
        onSelectTag={handleTagSelection}
      />

      {/* If separate, render advanced config outside the form */}
      {form.watch("enabled") && separateAdvancedConfig && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Advanced Modbus Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Modbus TCP and RTU Configuration */}
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-medium">Modbus Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                    {/* Modbus TCP Configuration (Left Side) */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Modbus TCP Configuration</h3>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="modbus-tcp-enabled" />
                          <Label htmlFor="modbus-tcp-enabled">Modbus TCP</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Configure the system as a Modbus TCP server over Ethernet networks
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="tcp-port">Port Number</Label>
                            <Input id="tcp-port" type="number" defaultValue="502" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tcp-max-users">Max Users</Label>
                            <Input id="tcp-max-users" type="number" defaultValue="4" />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="tcp-idle-time">Idle Time (s)</Label>
                          <Input id="tcp-idle-time" type="number" defaultValue="120" />
                        </div>
                        
                        <div className="flex items-center space-x-2 pt-2">
                          <Checkbox id="modbus-rtu-over-tcp" />
                          <Label htmlFor="modbus-rtu-over-tcp">Modbus RTU Over TCP</Label>
                        </div>
                      </div>
                    </div>

                    {/* Modbus RTU Configuration (Right Side) */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Modbus RTU Configuration</h3>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="modbus-rtu-enabled" />
                          <Label htmlFor="modbus-rtu-enabled">Modbus RTU</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Configure the system to communicate with Modbus devices over a serial interface
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="rtu-port">Port</Label>
                          <Select defaultValue="COM1">
                            <SelectTrigger id="rtu-port">
                              <SelectValue placeholder="Select port" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="COM1">COM1</SelectItem>
                              <SelectItem value="COM2">COM2</SelectItem>
                              <SelectItem value="COM3">COM3</SelectItem>
                              <SelectItem value="COM4">COM4</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="rtu-baud-rate">Baud Rate</Label>
                          <Select defaultValue="9600">
                            <SelectTrigger id="rtu-baud-rate">
                              <SelectValue placeholder="Select baud rate" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1200">1200</SelectItem>
                              <SelectItem value="2400">2400</SelectItem>
                              <SelectItem value="4800">4800</SelectItem>
                              <SelectItem value="9600">9600</SelectItem>
                              <SelectItem value="19200">19200</SelectItem>
                              <SelectItem value="38400">38400</SelectItem>
                              <SelectItem value="57600">57600</SelectItem>
                              <SelectItem value="115200">115200</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="rtu-data-bit">Data Bit</Label>
                            <Select defaultValue="8">
                              <SelectTrigger id="rtu-data-bit">
                                <SelectValue placeholder="Data bit" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="7">7</SelectItem>
                                <SelectItem value="8">8</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="rtu-stop-bit">Stop Bit</Label>
                            <Select defaultValue="1">
                              <SelectTrigger id="rtu-stop-bit">
                                <SelectValue placeholder="Stop bit" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="rtu-parity">Parity</Label>
                            <Select defaultValue="none">
                              <SelectTrigger id="rtu-parity">
                                <SelectValue placeholder="Parity" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="even">Even</SelectItem>
                                <SelectItem value="odd">Odd</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tag Table */}
              <Card>
                <CardHeader className="py-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">Tag Configuration</CardTitle>
                  <Button variant="outline" size="sm" onClick={addNewTag}>
                    <Plus className="h-4 w-4 mr-1" /> Add Tag
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>Data Type</TableHead>
                          <TableHead>Options</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDevice?.tags.map(tag => (
                          <TableRow key={tag.id}>
                            <TableCell>
                              <Input 
                                value={tag.name} 
                                onChange={(e) => {
                                  if (selectedDevice) {
                                    const updatedTags = selectedDevice.tags.map(t => 
                                      t.id === tag.id ? { ...t, name: e.target.value } : t
                                    )
                                    const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                    setSelectedDevice(updatedDevice)
                                    setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                  }
                                }} 
                                className="h-8" 
                              />
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={tag.tagType} 
                                onValueChange={(value) => {
                                  if (selectedDevice) {
                                    const updatedTags = selectedDevice.tags.map(t => 
                                      t.id === tag.id ? { ...t, tagType: value } : t
                                    )
                                    const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                    setSelectedDevice(updatedDevice)
                                    setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Coil">Coil</SelectItem>
                                  <SelectItem value="Discrete Input">Discrete Input</SelectItem>
                                  <SelectItem value="Holding Register">Holding Register</SelectItem>
                                  <SelectItem value="Input Register">Input Register</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={tag.address} 
                                onChange={(e) => {
                                  if (selectedDevice) {
                                    const updatedTags = selectedDevice.tags.map(t => 
                                      t.id === tag.id ? { ...t, address: e.target.value, modbusAddress: e.target.value } : t
                                    )
                                    const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                    setSelectedDevice(updatedDevice)
                                    setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                  }
                                }} 
                                className="h-8" 
                              />
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={tag.dataType} 
                                onValueChange={(value) => {
                                  if (selectedDevice) {
                                    const updatedTags = selectedDevice.tags.map(t => 
                                      t.id === tag.id ? { ...t, dataType: value } : t
                                    )
                                    const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                    setSelectedDevice(updatedDevice)
                                    setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Boolean">Boolean</SelectItem>
                                  <SelectItem value="Int16">Int16</SelectItem>
                                  <SelectItem value="UInt16">UInt16</SelectItem>
                                  <SelectItem value="Int32">Int32</SelectItem>
                                  <SelectItem value="UInt32">UInt32</SelectItem>
                                  <SelectItem value="Float">Float</SelectItem>
                                  <SelectItem value="Double">Double</SelectItem>
                                  <SelectItem value="String">String</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={`little-endian-${tag.id}`} 
                                    checked={tag.littleEndian} 
                                    onCheckedChange={(checked) => {
                                      if (selectedDevice) {
                                        const updatedTags = selectedDevice.tags.map(t => 
                                          t.id === tag.id ? { ...t, littleEndian: checked === true } : t
                                        )
                                        const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                        setSelectedDevice(updatedDevice)
                                        setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                      }
                                    }} 
                                  />
                                  <Label htmlFor={`little-endian-${tag.id}`} className="text-xs">Little Endian</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={`reverse-word-${tag.id}`} 
                                    checked={tag.reverseWord} 
                                    onCheckedChange={(checked) => {
                                      if (selectedDevice) {
                                        const updatedTags = selectedDevice.tags.map(t => 
                                          t.id === tag.id ? { ...t, reverseWord: checked === true } : t
                                        )
                                        const updatedDevice = { ...selectedDevice, tags: updatedTags }
                                        setSelectedDevice(updatedDevice)
                                        setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d))
                                      }
                                    }} 
                                  />
                                  <Label htmlFor={`reverse-word-${tag.id}`} className="text-xs">Reverse Word</Label>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  if (selectedDevice) {
                                    const updatedDevice = {
                                      ...selectedDevice,
                                      tags: selectedDevice.tags.filter(t => t.id !== tag.id)
                                    }
                                    setSelectedDevice(updatedDevice)
                                    setDevices(prev => prev.map(d => 
                                      d.id === updatedDevice.id ? updatedDevice : d
                                    ))
                                  }
                                }}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline">Discard Changes</Button>
                  <div className="flex space-x-2">
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-1" /> Export
                    </Button>
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-1" /> Import
                    </Button>
                    <Button>
                      <Check className="h-4 w-4 mr-1" /> Apply Changes
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}
    </Form>
  )
}
