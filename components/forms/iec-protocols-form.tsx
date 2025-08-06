"use client"

import { useState, useEffect } from "react"
import React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Check, Download, FileSpreadsheet, Upload, X, AlertTriangle, ChevronDown, ChevronRight, Server, Cpu, Tag } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"
import { IEC61850Form } from "./iec61850-form"
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog"

// Edit IP Dialog Component
function EditIPDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [ipAddress, setIpAddress] = useState("")
  
  const handleSave = () => {
    // Logic to save the IP address would go here
    onOpenChange(false)
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Edit IP
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center gap-4 py-4">
          <Label htmlFor="ip-address" className="w-8">IP:</Label>
          <Input 
            id="ip-address" 
            value={ipAddress} 
            onChange={(e) => setIpAddress(e.target.value)} 
            placeholder="Enter IP address"
          />
        </div>
        
        <DialogFooter>
          <div className="flex gap-2">
            <Button type="button" onClick={handleSave}>OK</Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Advanced Settings Dialog Component
function IEC104AdvancedSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [activeTab, setActiveTab] = useState("general")
  const [doAccessType, setDoAccessType] = useState("any")
  const [aoAccessType, setAoAccessType] = useState("any")
  const [editIPDialogOpen, setEditIPDialogOpen] = useState(false)
  const [currentSection, setCurrentSection] = useState<"do" | "ao">("do")
  
  const handleAddIP = (section: "do" | "ao") => {
    setCurrentSection(section)
    setEditIPDialogOpen(true)
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Edit IP Dialog */}
      <EditIPDialog 
        open={editIPDialogOpen} 
        onOpenChange={setEditIPDialogOpen} 
      />
      
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>IEC-104 Advance Setting</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="scope">Scope</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4 mt-4">
            {/* Top Row - Time-related Settings */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="t0" className="w-16">t0(s):</Label>
                <Input id="t0" defaultValue="30" className="max-w-[100px]" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="t2" className="w-16">t2(s):</Label>
                <Input id="t2" defaultValue="10" className="max-w-[100px]" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="k" className="w-16">k(APDUs):</Label>
                <Input id="k" defaultValue="12" className="max-w-[100px]" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="t1" className="w-16">t1(s):</Label>
                <Input id="t1" defaultValue="15" className="max-w-[100px]" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="t3" className="w-16">t3(s):</Label>
                <Input id="t3" defaultValue="30" className="max-w-[100px]" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="w" className="w-16">w(APDUs):</Label>
                <Input id="w" defaultValue="8" className="max-w-[100px]" />
              </div>
            </div>
            
            {/* Middle Row - Length Settings and Time Tag */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="common-address-length" className="w-40">Common Address Length:</Label>
                <Input id="common-address-length" defaultValue="2" className="max-w-[100px]" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="time-tag" className="w-24">Time Tag:</Label>
                <Select defaultValue="cp56">
                  <SelectTrigger id="time-tag" className="w-[180px]">
                    <SelectValue placeholder="Select time tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cp56">CP56 Time2a</SelectItem>
                    <SelectItem value="cp24">CP24 Time</SelectItem>
                    <SelectItem value="cp32">CP32 Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="info-address-length" className="w-40">Info Address Length:</Label>
                <Input id="info-address-length" defaultValue="3" className="max-w-[100px]" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="transmit-cause-length" className="w-40">Transmit Cause Length:</Label>
                <Input id="transmit-cause-length" defaultValue="2" className="max-w-[100px]" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="asdu-data-length" className="w-40">ASDU Data Length:</Label>
                <Input id="asdu-data-length" defaultValue="253" className="max-w-[100px]" />
              </div>
            </div>
            
            {/* Bottom - Description Text Area */}
            <div className="space-y-2">
              <Label htmlFor="description">Description:</Label>
              <Textarea id="description" className="min-h-[100px]" placeholder="Enter description here..." />
            </div>
          </TabsContent>
          
          <TabsContent value="scope" className="mt-4 space-y-6">
            {/* DO Access Control Section */}
            <div className="border rounded-md p-4">
              <h3 className="text-lg font-medium mb-4">DO Access Control</h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id="do-any-ip" 
                    name="do-access-type" 
                    value="any" 
                    checked={doAccessType === "any"}
                    onChange={() => setDoAccessType("any")}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="do-any-ip">Any IP Address</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id="do-specific-ip" 
                    name="do-access-type" 
                    value="specific" 
                    checked={doAccessType === "specific"}
                    onChange={() => setDoAccessType("specific")}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="do-specific-ip">These IP Address</Label>
                </div>
                
                <div className="flex gap-4">
                  <Textarea 
                    className="flex-1 min-h-[100px]" 
                    placeholder="Enter IP addresses, one per line"
                    disabled={doAccessType === "any"}
                  />
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={doAccessType === "any"}
                      onClick={() => handleAddIP("do")}
                    >
                      Add
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={doAccessType === "any"}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* AO Access Control Section */}
            <div className="border rounded-md p-4">
              <h3 className="text-lg font-medium mb-4">AO Access Control</h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id="ao-any-ip" 
                    name="ao-access-type" 
                    value="any" 
                    checked={aoAccessType === "any"}
                    onChange={() => setAoAccessType("any")}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="ao-any-ip">Any IP Address</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id="ao-specific-ip" 
                    name="ao-access-type" 
                    value="specific" 
                    checked={aoAccessType === "specific"}
                    onChange={() => setAoAccessType("specific")}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="ao-specific-ip">These IP Address</Label>
                </div>
                
                <div className="flex gap-4">
                  <Textarea 
                    className="flex-1 min-h-[100px]" 
                    placeholder="Enter IP addresses, one per line"
                    disabled={aoAccessType === "any"}
                  />
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={aoAccessType === "any"}
                      onClick={() => handleAddIP("ao")}
                    >
                      Add
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={aoAccessType === "any"}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button">OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function IECProtocolsForm() {
  const { toast } = useToast()
  const [activeChannel, setActiveChannel] = useState(1)
  const [activeIOTab, setActiveIOTab] = useState("DI")
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false)
  const [tagSelectionDialogOpen, setTagSelectionDialogOpen] = useState(false)
  const [expandedPorts, setExpandedPorts] = useState<string[]>(['io-tag'])
  const [expandedDevices, setExpandedDevices] = useState<string[]>([])
  const [currentSection, setCurrentSection] = useState<"DI" | "AI" | "Counter" | "DO" | "AO">("DI")
  const [ioPorts, setIoPorts] = useState<any[]>([])
  const [selectedPointIdForTag, setSelectedPointIdForTag] = useState<string | null>(null)
  
  // Fetch IO ports data from localStorage
  useEffect(() => {
    const fetchIoPorts = () => {
      try {
        const storedPorts = localStorage.getItem('io_ports_data')
        if (storedPorts) {
          const parsedPorts = JSON.parse(storedPorts)
          console.log('Fetched IO ports data:', parsedPorts)
          setIoPorts(parsedPorts)
        }
      } catch (error) {
        console.error('Error fetching IO ports data:', error)
      }
    }
    
    // Initial fetch
    fetchIoPorts()
    
    // Set up event listener for changes
    const handleIoPortsUpdate = (event: StorageEvent) => {
      if (event.key === 'io_ports_data' && event.newValue) {
        try {
          const updatedPorts = JSON.parse(event.newValue)
          console.log('IO ports data updated:', updatedPorts)
          setIoPorts(updatedPorts)
        } catch (error) {
          console.error('Error parsing updated IO ports data:', error)
        }
      }
    }
    
    window.addEventListener('storage', handleIoPortsUpdate)
    
    // Also check for updates every 2 seconds (as a fallback)
    const intervalId = setInterval(fetchIoPorts, 2000)
    
    return () => {
      window.removeEventListener('storage', handleIoPortsUpdate)
      clearInterval(intervalId)
    }
  }, [])
  
  // Sample data for the tables - using high ID value (999999) for the "Double click to edit" row
  const [diPoints, setDiPoints] = useState([
    { id: 999999, tagName: "Double click to edit", valueType: "", publicAddress: "", pointNumber: "", soe: "" }
  ])
  
  const [doPoints, setDoPoints] = useState([
    { id: 999999, tagName: "Double click to edit", valueType: "", publicAddress: "", pointNumber: "" }
  ])
  
  const [aiPoints, setAiPoints] = useState([
    { id: 999999, tagName: "Double click to edit", valueType: "", publicAddress: "", pointNumber: "", kValue: "", baseValue: "", changePercent: "" }
  ])
  
  const [counterPoints, setCounterPoints] = useState([
    { id: 999999, tagName: "Double click to edit", valueType: "", publicAddress: "", pointNumber: "", kValue: "", baseValue: "", changePercent: "" }
  ])
  
  const [aoPoints, setAoPoints] = useState([
    { id: 999999, tagName: "Double click to edit", valueType: "", publicAddress: "", pointNumber: "", kValue: "", baseValue: "" }
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "Settings saved",
      description: "IEC protocol settings have been updated.",
    })
  }
  
  const handleDiscard = () => {
    toast({
      title: "Changes discarded",
      description: "Your changes have been discarded.",
    })
  }
  
  const handleExport = () => {
    toast({
      title: "Export initiated",
      description: "Exporting configuration to Excel.",
    })
  }
  
  const handleImport = () => {
    toast({
      title: "Import initiated",
      description: "Importing configuration from Excel.",
    })
  }
  
  const handleAdvancedSettings = () => {
    setAdvancedSettingsOpen(true)
  }
  
  const handleTagSelection = (tag: any) => {
    if (selectedPointIdForTag !== null) {
      // Update points based on current section
      const updatePoints = (points: any[]) => 
        points.map(point => 
          point.id === selectedPointIdForTag ? { ...point, tagName: tag.name, selectedTag: tag.id } : point
        )
      
      switch (currentSection) {
        case "DI":
          setDiPoints(updatePoints)
          break
        case "DO":
          setDoPoints(updatePoints)
          break
        case "AI":
          setAiPoints(updatePoints)
          break
        case "Counter":
          setCounterPoints(updatePoints)
          break
        case "AO":
          setAoPoints(updatePoints)
          break
      }
      
      setTagSelectionDialogOpen(false)
      setSelectedPointIdForTag(null)
    }
  }
  
  // Toggle expansion of a port in the tree
  const togglePortExpansion = (portId: string) => {
    setExpandedPorts(prev => {
      if (prev.includes(portId)) {
        return prev.filter(id => id !== portId)
      } else {
        return [...prev, portId]
      }
    })
  }
  
  // Toggle expansion of a device in the tree
  const toggleDeviceExpansion = (deviceId: string) => {
    setExpandedDevices(prev => {
      if (prev.includes(deviceId)) {
        return prev.filter(id => id !== deviceId)
      } else {
        return [...prev, deviceId]
      }
    })
  }
  
  // Select a tag from the tree and add it to the current section
  const selectTagFromTree = (tag: IOTag, deviceName: string, portName: string) => {
    if (selectedPointIdForTag !== null) {
      // Update points based on current section
      const updatePoints = (points: any[]) => 
        points.map(point => 
          point.id === selectedPointIdForTag ? { ...point, tagName: `${deviceName}:${tag.name}`, selectedTag: tag.id } : point
        )
      
      switch (currentSection) {
        case "DI":
          setDiPoints(updatePoints)
          break
        case "DO":
          setDoPoints(updatePoints)
          break
        case "AI":
          setAiPoints(updatePoints)
          break
        case "Counter":
          setCounterPoints(updatePoints)
          break
        case "AO":
          setAoPoints(updatePoints)
          break
      }
      
      setTagSelectionDialogOpen(false)
      setSelectedPointIdForTag(null)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Advanced Settings Dialog */}
      <IEC104AdvancedSettingsDialog 
        open={advancedSettingsOpen} 
        onOpenChange={setAdvancedSettingsOpen} 
      />
      
      {/* Tag Selection Dialog */}
      <TagSelectionDialog
        open={tagSelectionDialogOpen}
        onOpenChange={setTagSelectionDialogOpen}
        onSelectTag={handleTagSelection}
      />
      
      <Tabs defaultValue="iec104">
        <TabsList className="mb-4">
          <TabsTrigger value="iec104">IEC 60870-5-104</TabsTrigger>
          <TabsTrigger value="iec61850">IEC 61850</TabsTrigger>
        </TabsList>



        <TabsContent value="iec104">
          <div className="space-y-4">
            {/* Top Bar with Global Actions */}
            <div className="flex justify-between items-center p-2 bg-gray-100 rounded-md">
              <div className="flex gap-2">
                <Button type="submit" variant="outline" className="flex items-center gap-1">
                  <Check className="h-4 w-4 text-green-500" />
                  Apply
                </Button>
                <Button type="button" variant="outline" className="flex items-center gap-1" onClick={handleDiscard}>
                  <X className="h-4 w-4 text-red-500" />
                  Discard
                </Button>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex items-center gap-1" onClick={handleExport}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Export To Microsoft Excel
                </Button>
                <Button type="button" variant="outline" className="flex items-center gap-1" onClick={handleImport}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Import From Microsoft Excel
                </Button>
              </div>
            </div>
            
            {/* Channel Status/Selection */}
            <div className="p-4 bg-white border rounded-md">
              <div className="mb-2 font-medium">Channel Status:</div>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((channel) => (
                  <Button 
                    key={channel}
                    type="button" 
                    variant={activeChannel === channel ? "default" : "outline"}
                    onClick={() => setActiveChannel(channel)}
                    className="w-10 h-10"
                  >
                    {channel}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Channel-Specific Settings */}
            <div className="p-4 bg-white border rounded-md">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Checkbox id="enable-channel" defaultChecked />
                  <Label htmlFor="enable-channel">Enable Channel</Label>
                </div>
                
                <div className="flex-1">
                  <Select defaultValue="channel1">
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="channel1">Channel 1</SelectItem>
                      <SelectItem value="channel2">Channel 2</SelectItem>
                      <SelectItem value="channel3">Channel 3</SelectItem>
                      <SelectItem value="channel4">Channel 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex items-center gap-1"
                  onClick={handleAdvancedSettings}
                >
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Advance Setting
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="port">Port:</Label>
                  <Input id="port" defaultValue="2404" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asdu-address">ASDU Address:</Label>
                  <Input id="asdu-address" defaultValue="1" />
                </div>
              </div>
            </div>
            
            {/* I/O Point Type Tabs */}
            <div className="p-4 bg-white border rounded-md">
              <Tabs value={activeIOTab} onValueChange={setActiveIOTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="DI">DI</TabsTrigger>
                  <TabsTrigger value="AI">AI</TabsTrigger>
                  <TabsTrigger value="Counter">Counter</TabsTrigger>
                  <TabsTrigger value="DO">DO</TabsTrigger>
                  <TabsTrigger value="AO">AO</TabsTrigger>
                </TabsList>
                
                <TabsContent value="DI">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>TagName</TableHead>
                        <TableHead>ValueType</TableHead>
                        <TableHead>Public Address</TableHead>
                        <TableHead>Point Number</TableHead>
                        <TableHead>SOE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diPoints.map((point) => (
                        <TableRow key={point.id}>
                          <TableCell className="font-medium">*</TableCell>
                          <TableCell className="cursor-pointer" onDoubleClick={() => handleTagSelection("DI")}>{point.tagName}</TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.valueType
                            ) : (
                              <Select defaultValue={point.valueType || "M_SP_NA_1"}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="M_SP_NA_1">single-point-information(M_SP_NA_1)</SelectItem>
                                  <SelectItem value="M_DP_NA_1">double-point-information(M_DP_NA_1)</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.publicAddress
                            ) : (
                              <Input defaultValue={point.publicAddress || "2"} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.pointNumber
                            ) : (
                              <Input defaultValue={point.pointNumber} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.soe
                            ) : (
                              <Select defaultValue={point.soe || "No SOE"}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select SOE" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="No SOE">No SOE</SelectItem>
                                  <SelectItem value="SOE">SOE</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
                
                <TabsContent value="AI">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>TagName</TableHead>
                        <TableHead>ValueType</TableHead>
                        <TableHead>Public Address</TableHead>
                        <TableHead>Point Number</TableHead>
                        <TableHead>KValue</TableHead>
                        <TableHead>BaseValue</TableHead>
                        <TableHead>Change(%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiPoints.map((point) => (
                        <TableRow key={point.id}>
                          <TableCell className="font-medium">*</TableCell>
                          <TableCell className="cursor-pointer" onDoubleClick={() => handleTagSelection("AI")}>{point.tagName}</TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.valueType
                            ) : (
                              <Select defaultValue={point.valueType || "M_ME_NA_1"}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="M_ME_NA_1">Measured value, normalized value(M_ME_NA_1)</SelectItem>
                                  <SelectItem value="M_ME_NB_1">Measured value, scaled value(M_ME_NB_1)</SelectItem>
                                  <SelectItem value="M_ME_NC_1">Measured value, short floating point value(M_ME_NC_1)</SelectItem>
                                  <SelectItem value="M_ME_ND_1">Measured value, normalized value without quality descriptor(M_ME_ND_1)</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.publicAddress
                            ) : (
                              <Input defaultValue={point.publicAddress || "2"} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.pointNumber
                            ) : (
                              <Input defaultValue={point.pointNumber} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.kValue
                            ) : (
                              <Input defaultValue={point.kValue || "1"} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.baseValue
                            ) : (
                              <Input defaultValue={point.baseValue || "1"} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.changePercent
                            ) : (
                              <Input defaultValue={point.changePercent || "10"} className="w-full h-8" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
                
                <TabsContent value="Counter">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>TagName</TableHead>
                        <TableHead>ValueType</TableHead>
                        <TableHead>Public Address</TableHead>
                        <TableHead>Point Number</TableHead>
                        <TableHead>KValue</TableHead>
                        <TableHead>BaseValue</TableHead>
                        <TableHead>Change(%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {counterPoints.map((point) => (
                        <TableRow key={point.id}>
                          <TableCell className="font-medium">*</TableCell>
                          <TableCell className="cursor-pointer" onDoubleClick={() => handleTagSelection("Counter")}>{point.tagName}</TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.valueType
                            ) : (
                              <Select defaultValue={point.valueType || "M_IT_NA_1"}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="M_IT_NA_1">Integrated totals(M_IT_NA_1)</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.publicAddress
                            ) : (
                              <Input defaultValue={point.publicAddress || "2"} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.pointNumber
                            ) : (
                              <Input defaultValue={point.pointNumber} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.kValue
                            ) : (
                              <Input defaultValue={point.kValue || "1"} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.baseValue
                            ) : (
                              <Input defaultValue={point.baseValue || "0"} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.changePercent
                            ) : (
                              <Input defaultValue={point.changePercent || "10"} className="w-full h-8" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
                
                <TabsContent value="DO">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>TagName</TableHead>
                        <TableHead>ValueType</TableHead>
                        <TableHead>Public Address</TableHead>
                        <TableHead>Point Number</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doPoints.map((point) => (
                        <TableRow key={point.id}>
                          <TableCell className="font-medium">*</TableCell>
                          <TableCell className="cursor-pointer" onDoubleClick={() => handleTagSelection("DO")}>{point.tagName}</TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.valueType
                            ) : (
                              <Select defaultValue={point.valueType || "C_SC_NA_1"}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="C_SC_NA_1">Single command(C_SC_NA_1)</SelectItem>
                                  <SelectItem value="C_DC_NA_1">Double command(C_DC_NA_1)</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.publicAddress
                            ) : (
                              <Input defaultValue={point.publicAddress || "2"} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.pointNumber
                            ) : (
                              <Input defaultValue={point.pointNumber} className="w-full h-8" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
                
                <TabsContent value="AO">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>TagName</TableHead>
                        <TableHead>ValueType</TableHead>
                        <TableHead>Public Address</TableHead>
                        <TableHead>Point Number</TableHead>
                        <TableHead>KValue</TableHead>
                        <TableHead>BaseValue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aoPoints.map((point) => (
                        <TableRow key={point.id}>
                          <TableCell className="font-medium">*</TableCell>
                          <TableCell className="cursor-pointer" onDoubleClick={() => handleTagSelection("AO")}>{point.tagName}</TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.valueType
                            ) : (
                              <Select defaultValue={point.valueType || "C_SE_NA_1"}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="C_RC_NA_1">regulating step command(C_RC_NA_1)</SelectItem>
                                  <SelectItem value="C_SE_NA_1">set point command, normalized value point number(C_SE_NA_1)</SelectItem>
                                  <SelectItem value="C_SE_NB_1">set point command, scaled value point number(C_SE_NB_1)</SelectItem>
                                  <SelectItem value="C_SE_NC_1">set point command, short floating point number(C_SE_NC_1)</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.publicAddress
                            ) : (
                              <Input defaultValue={point.publicAddress || "2"} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.pointNumber
                            ) : (
                              <Input defaultValue={point.pointNumber} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.kValue
                            ) : (
                              <Input defaultValue={point.kValue || "1"} className="w-full h-8" />
                            )}
                          </TableCell>
                          <TableCell>
                            {point.tagName === "Double click to edit" ? (
                              point.baseValue
                            ) : (
                              <Input defaultValue={point.baseValue || "0"} className="w-full h-8" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="iec61850">
          <IEC61850Form />
        </TabsContent>
      </Tabs>
    </form>
  )
}

