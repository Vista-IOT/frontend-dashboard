"use client"

import { useState, useEffect } from "react"
import { 
  Plus, 
  Edit, 
  Trash2,
  Tags,
  MoreVertical,
  X,
  ChevronDown,
  Save,
  FileDown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"

const CONVERSION_OPTIONS = [
  { value: "UINT, Big Endian (ABCD)", defaultLength: 16 },
  { value: "INT, Big Endian (ABCD)", defaultLength: 16 },
  { value: "UINT32, Modicon Double Precision (reg1*10000+reg2)", defaultLength: 32 },
  { value: "FLOAT, Big Endian (ABCD)", defaultLength: 32 },
  { value: "FLOAT, Big Endian, Swap Word (CDAB)", defaultLength: 32 },
  { value: "INT, Big Endian, Swap Word (CDAB)", defaultLength: 16 },
  { value: "UINT, Big Endian, Swap Word (CDAB)", defaultLength: 16 },
  { value: "UINT, Packed BCD, Big Endian (ABCD)", defaultLength: 16 },
  { value: "UINT, Packed BCD, Big Endian Swap Word (CDAB)", defaultLength: 16 },
  { value: "INT, Little Endian (DCBA)", defaultLength: 16 },
  { value: "UINT, Little Endian (DCBA)", defaultLength: 16 },
  { value: "DOUBLE, Big Endian (ABCDEFGH)", defaultLength: 64 },
  { value: "DOUBLE, Little Endian (HGFEDCBA)", defaultLength: 64 },
  { value: "DOUBLE, Big Endian, Swap Byte (BADCFEHG)", defaultLength: 64 },
  { value: "DOUBLE, Little Endian, Swap Byte (GHEFCDAB)", defaultLength: 64 },
  { value: "FLOAT, Little Endian (DCBA)", defaultLength: 32 },
  { value: "INT64, Big Endian (ABCDEFGH)", defaultLength: 64 },
  { value: "INT64, Little Endian (HGFEDCBA)", defaultLength: 64 },
  { value: "INT64, Big Endian, Swap Byte (BADCFEHG)", defaultLength: 64 },
  { value: "INT64, Little Endian, Swap Byte (GHEFCDAB)", defaultLength: 64 },
  { value: "UINT64, Big Endian (ABCDEFGH)", defaultLength: 64 },
  { value: "UINT64, Little Endian (HGFEDCBA)", defaultLength: 64 },
  { value: "UINT64, Big Endian, Swap Byte (BADCFEHG)", defaultLength: 64 },
  { value: "UINT64, Little Endian, Swap Byte (GHEFCDAB)", defaultLength: 64 },
  { value: "INT, Text to Number", defaultLength: 16 },
];

// Define the IOTag interface
export interface IOTag {
  id: string
  name: string
  dataType: string
  registerType?: string // Added for register type
  address: string
  description: string
  source?: string
  defaultValue?: string | number
  scanRate?: number
  conversionType?: string
  scaleType?: string
  readWrite?: string
  startBit?: number
  lengthBit?: number
  spanLow?: number
  spanHigh?: number
  formula?: string
  scale?: number
  offset?: number
  clampToLow?: boolean
  clampToHigh?: boolean
  clampToZero?: boolean
  // New fields for Discrete type
  signalReversal?: boolean
  value0?: string
  value1?: string
}

interface Device {
  id: string
  name: string
  type: string
  enabled: boolean
  tags: IOTag[]
  [key: string]: any
}

interface IOTagDetailProps {
  device: Device
  portId: string
  onUpdate?: (portId: string, deviceId: string, tags: IOTag[]) => void
}

export function IOTagDetailView({ device, portId, onUpdate }: IOTagDetailProps) {
  const { toast } = useToast()
  
  // State for the table and selection
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagFormOpen, setTagFormOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<IOTag | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  
  const handleTagSelection = (tagId: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId)
      } else {
        return [...prev, tagId]
      }
    })
  }
  
  const handleAddTag = () => {
    setEditingTag(null)
    setTagFormOpen(true)
  }
  
  const handleEditTag = () => {
    if (selectedTags.length !== 1) return
    
    const tagToEdit = device.tags.find(tag => tag.id === selectedTags[0])
    if (tagToEdit) {
      setEditingTag(tagToEdit)
      setTagFormOpen(true)
    }
  }
  
  const handleDeleteClick = () => {
    if (selectedTags.length === 0) return
    setDeleteConfirmOpen(true)
  }
  
  const handleDeleteConfirm = () => {
    const updatedTags = device.tags.filter(tag => !selectedTags.includes(tag.id))
    
    if (onUpdate) {
      onUpdate(portId, device.id, updatedTags)
    }
    
    setSelectedTags([])
    setDeleteConfirmOpen(false)
    
    toast({
      title: "IO Tags Deleted",
      description: `Successfully deleted ${selectedTags.length} tag(s)`,
    })
  }
  
  const handleSaveTag = (newTag: IOTag) => {
    let updatedTags: IOTag[]
    
    if (editingTag) {
      // Update existing tag
      updatedTags = device.tags.map(tag => 
        tag.id === editingTag.id ? newTag : tag
      )
      
      toast({
        title: "IO Tag Updated",
        description: `Successfully updated tag: ${newTag.name}`,
      })
    } else {
      // Add new tag
      updatedTags = [...device.tags, newTag]
      
      toast({
        title: "IO Tag Added",
        description: `Successfully added tag: ${newTag.name}`,
      })
    }
    
    if (onUpdate) {
      onUpdate(portId, device.id, updatedTags)
    }
    
    setTagFormOpen(false)
    setEditingTag(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center">
            <Tags className="h-5 w-5 mr-2" /> IO Tags for {device.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure input/output tags for data acquisition and processing
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleAddTag}>
            <Plus className="h-4 w-4 mr-2" /> Add
          </Button>
          <Button 
            variant="outline" 
            onClick={handleEditTag}
            disabled={selectedTags.length !== 1}
          >
            <Edit className="h-4 w-4 mr-2" /> Modify
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDeleteClick}
            disabled={selectedTags.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Default Value</TableHead>
                <TableHead>Scan Rate</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Conversion Type</TableHead>
                <TableHead>Scale Type</TableHead>
                <TableHead>Read Write</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {device.tags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-6 text-muted-foreground">
                    No IO tags configured for this device. Click "Add" to create a new tag.
                  </TableCell>
                </TableRow>
              ) : (
                device.tags.map(tag => (
                  <TableRow 
                    key={tag.id} 
                    className={selectedTags.includes(tag.id) ? "bg-muted/50" : ""}
                    onClick={() => handleTagSelection(tag.id)}
                  >
                    <TableCell>
                      <Checkbox 
                        checked={selectedTags.includes(tag.id)} 
                        onCheckedChange={() => handleTagSelection(tag.id)} 
                      />
                    </TableCell>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell>{tag.dataType || "Analog"}</TableCell>
                    <TableCell>{tag.source || "Device"}</TableCell>
                    <TableCell>{tag.defaultValue || "0.0"}</TableCell>
                    <TableCell>{tag.scanRate || "1"}</TableCell>
                    <TableCell>{tag.address}</TableCell>
                    <TableCell>{tag.conversionType || "FLOAT, Big Endian (ABCD)"}</TableCell>
                    <TableCell>{tag.scaleType || "No Scale"}</TableCell>
                    <TableCell>{tag.readWrite || "Read/Write"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{tag.description}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Tag Form Dialog */}
      <Dialog open={tagFormOpen} onOpenChange={setTagFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTag ? "Modify IO Tag" : "Add New IO Tag"}</DialogTitle>
            <DialogDescription>
              Configure the IO tag properties for data acquisition and processing
            </DialogDescription>
          </DialogHeader>
          
          <TagForm 
            onSave={handleSaveTag} 
            onCancel={() => setTagFormOpen(false)} 
            existingTag={editingTag} 
          />
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedTags.length} IO tag(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface TagFormProps {
  onSave: (tag: IOTag) => void
  onCancel: () => void
  existingTag?: IOTag | null
}

function TagForm({ onSave, onCancel, existingTag }: TagFormProps) {
  const [activeTab, setActiveTab] = useState("basic")
  
  // Form state
  const [name, setName] = useState(existingTag?.name || "")
  const [dataType, setDataType] = useState(existingTag?.dataType || "Analog")
  const [registerType, setRegisterType] = useState(existingTag?.registerType || "")
  const [conversion, setConversion] = useState(existingTag?.conversionType || "") // Default to empty or existing
  const [address, setAddress] = useState(existingTag?.address || "")
  const [startBit, setStartBit] = useState(existingTag?.startBit || 0)
  const [lengthBit, setLengthBit] = useState(existingTag?.lengthBit || 64)
  const [spanLow, setSpanLow] = useState(existingTag?.spanLow || 0)
  const [spanHigh, setSpanHigh] = useState(existingTag?.spanHigh || 1000)
  const [defaultValue, setDefaultValue] = useState(existingTag?.defaultValue || 0.0)
  const [scanRate, setScanRate] = useState(existingTag?.scanRate || 1)
  const [readWrite, setReadWrite] = useState(existingTag?.readWrite || "Read/Write")
  const [description, setDescription] = useState(existingTag?.description || "")
  // New state for Discrete fields
  const [signalReversal, setSignalReversal] = useState(existingTag?.signalReversal ?? false)
  const [value0, setValue0] = useState(existingTag?.value0 || "")
  const [value1, setValue1] = useState(existingTag?.value1 || "")

  // When dataType changes, reset registerType and set default if applicable
  useEffect(() => {
    // Manage dependent fields and active tab when dataType changes
    if (dataType === "Analog") {
      setRegisterType(existingTag?.registerType && existingTag?.dataType === "Analog" ? existingTag.registerType : "Coil");
      // If a conversion is already selected, its length will be set by the other useEffect.
      // Otherwise, default to 64 or existing if no specific conversion is yet picked.
      if (!conversion) {
        setLengthBit(existingTag?.lengthBit || 64);
      }
      if (activeTab === "tagValueDescriptor") {
        setActiveTab("basic");
      }
    } else if (dataType === "Discrete") {
      setRegisterType(existingTag?.registerType && existingTag?.dataType === "Discrete" ? existingTag.registerType : "Input");
      setLengthBit(1); // Fixed length for Discrete
      setSignalReversal(existingTag?.signalReversal ?? false);
      setValue0(existingTag?.value0 || ""); // Default to empty string
      setValue1(existingTag?.value1 || ""); // Default to empty string
      // If switching to Discrete and the advanced tab was for analog, switch to basic
      if (activeTab === "advanced") {
        setActiveTab("basic");
      }
    } else {
      // Fallback for other types or if dataType is cleared
      setRegisterType("");
      setLengthBit(existingTag?.lengthBit || 64); // Or some other sensible default
      if (activeTab === "tagValueDescriptor" || activeTab === "advanced") {
        setActiveTab("basic");
      }
    }
  }, [dataType, conversion, existingTag?.dataType, existingTag?.registerType, existingTag?.lengthBit, existingTag?.signalReversal, existingTag?.value0, existingTag?.value1, activeTab]);

  // Effect to update lengthBit based on selected conversion for Analog type
  useEffect(() => {
    if (dataType === "Analog" && conversion) {
      const selectedOption = CONVERSION_OPTIONS.find(opt => opt.value === conversion);
      if (selectedOption) {
        setLengthBit(selectedOption.defaultLength);
      } else {
        // If conversion is somehow not in our list, revert to a default or make editable
        // For now, let's assume it will always be in the list if selected.
        // Consider setting a general default like 64 if needed, or clear it to force user input if not read-only.
        setLengthBit(existingTag?.lengthBit || 64); 
      }
    } else if (dataType !== "Analog") {
      // If not Analog, lengthBit is handled by the other useEffect (e.g., set to 1 for Discrete)
    }
  }, [dataType, conversion, existingTag?.lengthBit]);

  const [scaleType, setScaleType] = useState(existingTag?.scaleType || "No Scale")
  const [formula, setFormula] = useState(existingTag?.formula || "")
  const [scale, setScale] = useState(existingTag?.scale || 1)
  const [offset, setOffset] = useState(existingTag?.offset || 0)
  const [clampToLow, setClampToLow] = useState(existingTag?.clampToLow || false)
  const [clampToHigh, setClampToHigh] = useState(existingTag?.clampToHigh || false)
  const [clampToZero, setClampToZero] = useState(existingTag?.clampToZero || false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newTag: IOTag = {
      id: existingTag?.id || `tag-${Date.now()}`,
      name,
      dataType,
      registerType,
      conversionType: conversion,
      address,
      startBit,
      lengthBit: dataType === "Discrete" ? 1 : lengthBit, // Set lengthBit to 1 if Discrete
      spanLow,
      spanHigh,
      defaultValue,
      scanRate,
      readWrite,
      description,
      scaleType,
      formula,
      scale,
      offset,
      clampToLow,
      clampToHigh,
      clampToZero,
      // Add new discrete fields
      signalReversal: dataType === "Discrete" ? signalReversal : undefined,
      value0: dataType === "Discrete" ? value0 : undefined,
      value1: dataType === "Discrete" ? value1 : undefined
    }
    
    onSave(newTag)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="basic" className="flex-1">Basic</TabsTrigger>
          {dataType === "Analog" && (
            <TabsTrigger value="advanced" className="flex-1">Advanced</TabsTrigger>
          )}
          {dataType === "Discrete" && (
            <TabsTrigger value="tagValueDescriptor" className="flex-1">Tag Value Descriptor</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="basic" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter tag name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dataType">Data Type</Label>
              <Select value={dataType} onValueChange={setDataType}>
                <SelectTrigger id="dataType">
                  <SelectValue placeholder="Select data type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Analog">Analog</SelectItem>
                  <SelectItem value="Discrete">Discrete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registerType">Register Type</Label>
              <Select 
                value={registerType} 
                onValueChange={setRegisterType}
                disabled={!dataType} // Disable if dataType is not selected
              >
                <SelectTrigger id="registerType">
                  <SelectValue placeholder="Select register type" />
                </SelectTrigger>
                <SelectContent>
                  {dataType === "Analog" && (
                    <>
                      <SelectItem value="Coil">Coil</SelectItem>
                      <SelectItem value="Discrete Inputs">Discrete Inputs</SelectItem>
                    </>
                  )}
                  {dataType === "Discrete" && (
                    <>
                      <SelectItem value="Input">Input</SelectItem>
                      <SelectItem value="Holding">Holding</SelectItem>
                    </>
                  )}
                  {/* Show a disabled item if dataType is not selected or doesn't match Analog/Discrete */}
                  {(!dataType || (dataType !== "Analog" && dataType !== "Discrete")) && 
                    <SelectItem value="" disabled>Select Data Type first</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {dataType === "Discrete" && (
              <div className="space-y-2">
                <Label htmlFor="signalReversal">Signal Reversal</Label>
                <Select 
                  value={signalReversal ? "True" : "False"} 
                  onValueChange={(value) => setSignalReversal(value === "True")}
                >
                  <SelectTrigger id="signalReversal">
                    <SelectValue placeholder="Select signal reversal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="False">False</SelectItem>
                    <SelectItem value="True">True</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {dataType === "Analog" && (
            <div className="space-y-2">
              <Label htmlFor="conversion">Conversion</Label>
              <Select value={conversion} onValueChange={setConversion}>
                <SelectTrigger id="conversion">
                  <SelectValue placeholder="Select conversion type" />
                </SelectTrigger>
                <SelectContent>
                  {CONVERSION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter address"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="startBit">Start Bit</Label>
              <Input
                id="startBit"
                type="number"
                value={startBit}
                onChange={(e) => setStartBit(Number(e.target.value))}
                min={0}
              />
            </div>
            
            {/* Length (bit) - Conditional display and behavior */}
            {(dataType === "Analog" || dataType === "Discrete") && (
            <div className="space-y-2">
              <Label htmlFor="lengthBit">Length (bit)</Label>
              <Input
                id="lengthBit"
                type="number"
                value={lengthBit}
                onChange={(e) => {
                  // Only allow manual change if Analog and no specific conversion is selected (or if conversion doesn't dictate length)
                  if (dataType === "Analog" && !CONVERSION_OPTIONS.find(opt => opt.value === conversion)) {
                    setLengthBit(Number(e.target.value));
                  }
                }}
                readOnly={dataType === "Discrete" || (dataType === "Analog" && !!CONVERSION_OPTIONS.find(opt => opt.value === conversion))} // Read-only for Discrete or if Analog and conversion selected
                min={1}
              />
            </div>
            )}
            
            {dataType === "Analog" && (
            <div className="space-y-2">
              <Label htmlFor="spanLow">Span Low</Label>
              <Input
                id="spanLow"
                type="number"
                value={spanLow}
                onChange={(e) => setSpanLow(Number(e.target.value))}
              />
            </div>
            )}
            
            {dataType === "Analog" && (
            <div className="space-y-2">
              <Label htmlFor="spanHigh">Span High</Label>
              <Input
                id="spanHigh"
                type="number"
                value={spanHigh}
                onChange={(e) => setSpanHigh(Number(e.target.value))}
              />
            </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="defaultValue">Default Value</Label>
              <Input
                id="defaultValue"
                type="number"
                value={defaultValue}
                onChange={(e) => setDefaultValue(Number(e.target.value))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="scanRate">Scan Rate</Label>
              <Input
                id="scanRate"
                type="number"
                value={scanRate}
                onChange={(e) => setScanRate(Number(e.target.value))}
                min={1}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="readWrite">Read Write</Label>
              <Select value={readWrite} onValueChange={setReadWrite}>
                <SelectTrigger id="readWrite">
                  <SelectValue placeholder="Select read/write access" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Read/Write">Read/Write</SelectItem>
                  <SelectItem value="Read Only">Read Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a description (optional)"
                rows={3}
              />
            </div>
          </div>
        </TabsContent>
        
        {dataType === "Analog" && (
        <TabsContent value="advanced" className="space-y-4 pt-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="scaleType">Scaling Type</Label>
              <Select value={scaleType} onValueChange={setScaleType}>
                <SelectTrigger id="scaleType">
                  <SelectValue placeholder="Select scaling type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="No Scale">No Scale</SelectItem>
                  <SelectItem value="Scale 0-100% Input to Span">Scale 0-100% Input to Span</SelectItem>
                  <SelectItem value="Linear Scale, MX+B">Linear Scale, MX+B</SelectItem>
                  <SelectItem value="Scale Defined Input H/L to Span">Scale Defined Input H/L to Span</SelectItem>
                  <SelectItem value="Scale 12-Bit Input to Span">Scale 12-Bit Input to Span</SelectItem>
                  <SelectItem value="Scale 0-100% Square Root Input">Scale 0-100% Square Root Input</SelectItem>
                  <SelectItem value="Square Root of (Input/(F2-F1)) to Span">Square Root of (Input/(F2-F1)) to Span</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {scaleType === "Linear Scale, MX+B" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="formula">Formula</Label>
                  <Input
                    id="formula"
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                    placeholder="Enter formula"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="scale">Scale (M)</Label>
                  <Input
                    id="scale"
                    type="number"
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="offset">Offset (B)</Label>
                  <Input
                    id="offset"
                    type="number"
                    value={offset}
                    onChange={(e) => setOffset(Number(e.target.value))}
                  />
                </div>
              </div>
            )}
            
            <div className="border rounded-md p-4">
              <h3 className="text-sm font-medium mb-2">Clamp Settings</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="clampToLow" 
                    checked={clampToLow}
                    onCheckedChange={(checked) => setClampToLow(checked as boolean)}
                  />
                  <Label htmlFor="clampToLow">Clamp to span low</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="clampToHigh" 
                    checked={clampToHigh}
                    onCheckedChange={(checked) => setClampToHigh(checked as boolean)}
                  />
                  <Label htmlFor="clampToHigh">Clamp to span high</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="clampToZero" 
                    checked={clampToZero}
                    onCheckedChange={(checked) => setClampToZero(checked as boolean)}
                  />
                  <Label htmlFor="clampToZero">Clamp to zero</Label>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        )}

        {dataType === "Discrete" && (
          <TabsContent value="tagValueDescriptor" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="value0">Value 0</Label>
                <Input
                  id="value0"
                  value={value0}
                  onChange={(e) => setValue0(e.target.value)}
                  placeholder="Enter description for value 0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value1">Value 1</Label>
                <Input
                  id="value1"
                  value={value1}
                  onChange={(e) => setValue1(e.target.value)}
                  placeholder="Enter description for value 1"
                />
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
      
      <DialogFooter className="pt-6">
        <Button variant="outline" type="button" onClick={onCancel}>Close</Button>
        <Button type="submit">OK</Button>
      </DialogFooter>
    </form>
  )
}
