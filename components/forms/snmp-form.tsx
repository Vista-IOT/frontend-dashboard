"use client"

import { useState, useEffect, createContext, useContext } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Download, ChevronRight, ChevronDown, Tag, Server, Cpu, BarChart, FileDigit, UserCircle, Cog } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog"

// Define ASN Type options
const ASN_TYPE_OPTIONS = [
  "Bool",
  "Unsigned8",
  "Integer8",
  "Unsigned16",
  "Integer16",
  "Unsigned32",
  "Integer32",
  "UInteger64",
  "Integer64",
  "Ipaddress",
  "Timeticks",
  "Float",
  "Double",
  "String"
]

// Define Read/Write options
const READ_WRITE_OPTIONS = [
  "Read",
  "Write",
  "Read/Write"
]

// Define the IO Tag interface
interface IOTag {
  id: string;
  name: string;
  address: string;
  dataType: string;
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
}

// Define the Device interface for IO Ports
interface Device {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  tags?: IOTag[];
  description?: string;
}

type SNMPTag = {
  id: string
  name: string
  parentId: string | null
  asnType: string
  objectId: string
  fullObjectId: string
  readWrite: string
  description: string
  isExpanded?: boolean
  isGroup?: boolean
}

type TrapEntry = {
  id: string
  communityName: string
  ip: string
  port: string
}

type TrapTag = {
  id: string
  name: string
  parentId: string | null
  objectId: string
  fullObjectId: string
  eventType: string
  highLimit: string
  lowLimit: string
  isExpanded?: boolean
}

const initialTags: SNMPTag[] = [
  {
    id: "root",
    name: "SNMP Tag list",
    parentId: null,
    asnType: "",
    objectId: "",
    fullObjectId: "",
    readWrite: "",
    description: "",
    isExpanded: true,
    isGroup: true
  }
]

const initialTrapTags: TrapTag[] = [
  {
    id: "trapRoot",
    name: "Trap tag list",
    parentId: null,
    objectId: "100",
    fullObjectId: "1.3.6.1.4.1.10297.400.100",
    eventType: "",
    highLimit: "",
    lowLimit: "",
    isExpanded: true
  }
]

export function SNMPForm() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("config")
  const [snmpTags, setSnmpTags] = useState<SNMPTag[]>(initialTags)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [snmpEnabled, setSnmpEnabled] = useState(false)
  const [trapEnabled, setTrapEnabled] = useState(false)
  const [edgelinkOidValue, setEdgelinkOidValue] = useState("1.3.6.1.4.1.10297.400")
  
  // State for tag selection dialog
  const [tagSelectionDialogOpen, setTagSelectionDialogOpen] = useState(false)
  const [ioPorts, setIoPorts] = useState<Port[]>([])
  const [expandedPorts, setExpandedPorts] = useState<string[]>([])
  const [expandedDevices, setExpandedDevices] = useState<string[]>([])
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null)
  const [isForTrapTag, setIsForTrapTag] = useState(false)
  
  // State for trap entries
  const [trapEntries, setTrapEntries] = useState<TrapEntry[]>([])
  const [selectedTrapEntries, setSelectedTrapEntries] = useState<string[]>([])
  const [trapExpanded, setTrapExpanded] = useState(true)
  
  // State for trap tags
  const [trapTags, setTrapTags] = useState<TrapTag[]>(initialTrapTags)
  const [selectedTrapTags, setSelectedTrapTags] = useState<string[]>([])
  const [trapTagsExpanded, setTrapTagsExpanded] = useState(true)
  
  // Fetch IO ports data from localStorage
  useEffect(() => {
    const fetchIoPorts = async () => {
      try {
        const storedPorts = localStorage.getItem('io_ports_data')
        if (storedPorts) {
          setIoPorts(JSON.parse(storedPorts))
        }
        
        // Listen for updates to IO ports data
        const handleIoPortsUpdate = (event: StorageEvent) => {
          if (event.key === 'io_ports_data' && event.newValue) {
            setIoPorts(JSON.parse(event.newValue))
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
    
    fetchIoPorts()
    
    // Poll for updates to IO ports data
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
  }, [])
  
  // Function to toggle expansion of a group
  const toggleExpand = (id: string) => {
    setSnmpTags(prevTags => {
      return prevTags.map(tag => {
        if (tag.id === id) {
          return { ...tag, isExpanded: !tag.isExpanded }
        }
        return tag
      })
    })
  }
  
  // Select a tag from the tree and add it to SNMP tags or trap tags
  const selectTagFromTree = (tag: IOTag, deviceName: string, portName: string) => {
    if (isForTrapTag) {
      // If selecting for trap tag, use the addSelectedTagAsTrapTag function
      addSelectedTagAsTrapTag(tag, deviceName, portName)
      } else {
      // Find the parent group
      const parentId = targetGroupId || "root"
      const parentGroup = snmpTags.find(t => t.id === parentId)
      
      // For tags added directly to the root, we need to find the highest object ID among both groups and direct tags
      let nextObjectId = 1
      if (parentId === "root") {
        // Find the highest object ID among groups and direct root tags
        snmpTags.forEach(t => {
          if ((t.parentId === "root" && !t.isGroup) || (t.isGroup && t.id !== "root")) {
            const objId = parseInt(t.objectId)
            if (!isNaN(objId) && objId >= nextObjectId) {
              nextObjectId = objId + 1
          }
        }
        })
      } else {
        // Find the highest object ID within this specific group
        snmpTags.forEach(t => {
          if (t.parentId === parentId && !t.isGroup && t.objectId) {
            const objId = parseInt(t.objectId)
          if (!isNaN(objId) && objId >= nextObjectId) {
            nextObjectId = objId + 1
          }
        }
        })
      }
      
      // Get the parent's object ID for constructing the full object ID
      let parentObjectId = ""
      if (parentId !== "root") {
        parentObjectId = parentGroup?.objectId || ""
      }
      
      // Create the full object ID
      const fullObjectId = parentId === "root" 
        ? `${edgelinkOidValue}.${nextObjectId}` 
        : `${edgelinkOidValue}.${parentObjectId}.${nextObjectId}`
      
      // Create a new SNMP tag from the selected IO tag
      const newTag: SNMPTag = {
        id: `tag${Date.now()}`,
        name: `${deviceName}:${tag.name}`,
        // Use the targetGroupId if available, otherwise use "root"
        parentId: parentId,
        asnType: "Integer32", // Default ASN type
      objectId: nextObjectId.toString(),
        fullObjectId: fullObjectId,
        readWrite: "Read/Write",
        description: tag.description || "Imported from IO Tag"
      }
      
      // Add the new tag to the SNMP tags list and ensure parent group is expanded
      setSnmpTags(prevTags => {
        // First add the new tag
        const updatedTags = [...prevTags, newTag]
        
        // If we have a target group, make sure it's expanded
        if (targetGroupId) {
          return updatedTags.map(tag => {
            if (tag.id === targetGroupId && !tag.isExpanded) {
              return { ...tag, isExpanded: true }
            }
            return tag
          })
        }
        
        return updatedTags
      })
      
      // Close the dialog and reset the targetGroupId
      setTagSelectionDialogOpen(false)
      setTargetGroupId(null)
      
      toast({
        title: "Tag Added",
        description: `Tag ${newTag.name} has been added to SNMP tags.`
      })
    }
  }
  
  // Function to handle tag selection
  const handleTagSelection = (tag: any) => {
    if (isForTrapTag) {
      // Handle trap tag selection
      addSelectedTagAsTrapTag(tag, tag.path ? tag.path.split('/')[1] : 'Unknown', tag.path ? tag.path.split('/')[0] : 'Unknown')
    } else {
      // Handle regular SNMP tag selection
      const parentId = targetGroupId || "root"
      const parentGroup = snmpTags.find(t => t.id === parentId)
      
      // For tags added directly to the root, we need to find the highest object ID among both groups and direct tags
      let nextObjectId = 1
      if (parentId === "root") {
        // Find the highest object ID among groups and direct root tags
        snmpTags.forEach(t => {
          if ((t.parentId === "root" && !t.isGroup) || (t.isGroup && t.id !== "root")) {
            const objId = parseInt(t.objectId)
            if (!isNaN(objId) && objId >= nextObjectId) {
              nextObjectId = objId + 1
            }
          }
        })
      } else {
        // Find the highest object ID within this specific group
        snmpTags.forEach(t => {
          if (t.parentId === parentId && !t.isGroup && t.objectId) {
            const objId = parseInt(t.objectId)
            if (!isNaN(objId) && objId >= nextObjectId) {
              nextObjectId = objId + 1
            }
          }
        })
      }
      
      // Get the parent's object ID for constructing the full object ID
      let parentObjectId = ""
      if (parentId !== "root") {
        parentObjectId = parentGroup?.objectId || ""
      }
      
      // Create the full object ID
      const fullObjectId = parentId === "root" 
        ? `${edgelinkOidValue}.${nextObjectId}` 
        : `${edgelinkOidValue}.${parentObjectId}.${nextObjectId}`
      
      // Create a new SNMP tag from the selected tag
      const newTag: SNMPTag = {
        id: `tag${Date.now()}`,
        name: tag.name,
        // Use the targetGroupId if available, otherwise use "root"
        parentId: parentId,
        asnType: "Integer32", // Default ASN type
        objectId: nextObjectId.toString(),
        fullObjectId: fullObjectId,
        readWrite: "Read/Write",
        description: tag.description || "Imported from Tag"
      }
      
      // Add the new tag to the SNMP tags list and ensure parent group is expanded
      setSnmpTags(prevTags => {
        // First add the new tag
        const updatedTags = [...prevTags, newTag]
        
        // If we have a target group, make sure it's expanded
        if (targetGroupId) {
          return updatedTags.map(tag => {
            if (tag.id === targetGroupId && !tag.isExpanded) {
              return { ...tag, isExpanded: true }
            }
            return tag
          })
        }
        
        return updatedTags
      })
      
      // Close the dialog and reset the targetGroupId
      setTagSelectionDialogOpen(false)
      setTargetGroupId(null)
      
      toast({
        title: "Tag Added",
        description: `Tag ${newTag.name} has been added to SNMP tags.`
      })
    }
  }
  
  // Function to handle tag selection
  const toggleTagSelection = (id: string) => {
    setSelectedTags(prevSelected => {
      if (prevSelected.includes(id)) {
        return prevSelected.filter(tagId => tagId !== id)
      } else {
        return [...prevSelected, id]
      }
    })
  }
  
  // Function to add a new tag
  const addTag = () => {
    // Reset the target group ID to add to root
    setTargetGroupId(null)
    // Open the tag selection dialog
    setTagSelectionDialogOpen(true)
  }
  
  // Function to add a new group
  const addGroup = () => {
    // Find the highest group number to increment
    let highestGroupNum = 0
    snmpTags.forEach(tag => {
      if (tag.isGroup && tag.id !== "root") {
        const match = tag.name.match(/Group (\d+)/)
        if (match && match[1]) {
          const groupNum = parseInt(match[1])
          if (groupNum > highestGroupNum) {
            highestGroupNum = groupNum
          }
        }
      }
    })
    
    // Find the highest object ID to increment among ALL root-level items
    // This includes both groups and direct tags under the root
    let nextObjectId = 1
    snmpTags.forEach(tag => {
      // Check both groups and direct root tags
      if ((tag.isGroup && tag.id !== "root") || (tag.parentId === "root" && !tag.isGroup)) {
        if (tag.objectId) {
          const objId = parseInt(tag.objectId)
          if (!isNaN(objId) && objId >= nextObjectId) {
            nextObjectId = objId + 1
          }
        }
      }
    })
    
    // Get the current Edgelink OID from the form
    const edgelinkOid = snmpEnabled ? edgelinkOidValue || "1.3.6.1.4.1.10297" : "1.3.6.1.4.1.10297"
    
    const newGroup: SNMPTag = {
      id: `group${Date.now()}`,
      name: `Group ${highestGroupNum + 1}`,
      parentId: "root",
      asnType: "",
      objectId: nextObjectId.toString(),
      fullObjectId: `${edgelinkOid}.${nextObjectId}`,
      readWrite: "",
      description: "",
      isExpanded: false,
      isGroup: true
    }
    
    setSnmpTags([...snmpTags, newGroup])
    toast({
      title: "Group Added",
      description: `${newGroup.name} has been added.`
    })
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
  
  // Function to handle ASN Type change
  const handleAsnTypeChange = (tagId: string, newType: string) => {
    setSnmpTags(prevTags => {
      return prevTags.map(tag => {
        if (tag.id === tagId) {
          return { ...tag, asnType: newType }
        }
        return tag
      })
    })
  }
  
  // Function to handle Read/Write change
  const handleReadWriteChange = (tagId: string, newValue: string) => {
    setSnmpTags(prevTags => {
      return prevTags.map(tag => {
        if (tag.id === tagId) {
          return { ...tag, readWrite: newValue }
        }
        return tag
      })
    })
  }
  
  // Function to handle Description change
  const handleDescriptionChange = (tagId: string, newValue: string) => {
    setSnmpTags(prevTags => {
      return prevTags.map(tag => {
        if (tag.id === tagId) {
          return { ...tag, description: newValue }
        }
        return tag
      })
    })
  }
  
  // Function to handle Name change
  const handleNameChange = (tagId: string, newValue: string) => {
    setSnmpTags(prevTags => {
      return prevTags.map(tag => {
        if (tag.id === tagId) {
          return { ...tag, name: newValue }
        }
        return tag
      })
    })
  }
  
  // Function to check if an Object ID is already in use within a group or at root level
  const isObjectIdInUse = (objectId: string, currentTagId: string, parentId: string | null) => {
    if (parentId === "root") {
      // For root level items, check across all groups and direct root tags
      return snmpTags.some(tag => 
        tag.id !== currentTagId && 
        tag.id !== "root" && 
        ((tag.parentId === "root") || (tag.isGroup && tag.id !== "root")) && 
        tag.objectId === objectId
      )
    } else {
      // For items within a group, check only within that group
      return snmpTags.some(tag => 
        tag.id !== currentTagId && 
        tag.id !== "root" && 
        tag.parentId === parentId && 
        tag.objectId === objectId
      )
    }
  }
  
  // Function to update all Full Object IDs when Edgelink OID changes
  const updateAllFullObjectIds = (newEdgelinkOid: string) => {
    // First, update all group Full Object IDs
    setSnmpTags(prevTags => {
      // Create a copy of the tags to work with
      const updatedTags = [...prevTags]
      
      // First update all groups
      updatedTags.forEach((tag, index) => {
        if (tag.isGroup && tag.id !== "root" && tag.objectId) {
          updatedTags[index] = {
            ...tag,
            fullObjectId: `${newEdgelinkOid}.${tag.objectId}`
          }
        }
      })
      
      // Then update all regular tags using the updated group IDs
      updatedTags.forEach((tag, index) => {
        if (!tag.isGroup && tag.id !== "root" && tag.objectId) {
          const parentId = tag.parentId
          let parentObjectId = ""
          
          // Find the parent's object ID
          if (parentId && parentId !== "root") {
            const parentTag = updatedTags.find(t => t.id === parentId)
            if (parentTag) {
              parentObjectId = parentTag.objectId
            }
          }
          
          // Update the full object ID based on parent
          if (parentId === "root" || !parentObjectId) {
            updatedTags[index] = {
              ...tag,
              fullObjectId: `${newEdgelinkOid}.${tag.objectId}`
            }
          } else {
            updatedTags[index] = {
              ...tag,
              fullObjectId: `${newEdgelinkOid}.${parentObjectId}.${tag.objectId}`
            }
          }
        }
      })
      
      return updatedTags
    })
  }
  
  // Function to handle Object ID change
  const handleObjectIdChange = (tagId: string, newValue: string) => {
    console.log(`Changing Object ID for tag ${tagId} to ${newValue}`);
    
    // Allow the change even if empty (for backspace operations)
    // We'll validate before saving
    
    // Find the current tag and its parent ID
    const currentTag = snmpTags.find(tag => tag.id === tagId)
    if (!currentTag) return
    
    const parentId = currentTag.parentId
    
    // Only validate non-empty values
    if (newValue.trim() !== "") {
      // Check if this objectId is already in use
      if (isObjectIdInUse(newValue, tagId, parentId)) {
        // Different message based on whether it's a root level item or within a group
        if (parentId === "root") {
          toast({
            title: "Duplicate Object ID",
            description: "This Object ID is already in use at the root level. Object IDs must be unique across all groups and direct tags.",
            variant: "destructive"
          })
        } else {
          toast({
            title: "Duplicate Object ID",
            description: "This Object ID is already in use in this group. Object IDs must be unique within a group.",
            variant: "destructive"
          })
        }
        return
      }
    }
    
    // Find the parent group's object ID for constructing the full object ID
    let parentObjectId = ""
    if (parentId && parentId !== "root") {
      const parentTag = snmpTags.find(tag => tag.id === parentId)
      if (parentTag) {
        parentObjectId = parentTag.objectId
      }
    }
    
    // Update both objectId and fullObjectId
    setSnmpTags(prevTags => {
      return prevTags.map(tag => {
        if (tag.id === tagId) {
          // If it's a group or direct root tag, the fullObjectId is edgelinkOid.objectId
          // If it's a tag within a group, the fullObjectId is edgelinkOid.parentObjectId.objectId
          const fullObjectId = (tag.isGroup || tag.parentId === "root") 
            ? `${edgelinkOidValue}.${newValue}` 
            : `${edgelinkOidValue}.${parentObjectId}.${newValue}`
          
          return { 
            ...tag, 
            objectId: newValue,
            fullObjectId: fullObjectId
          }
        }
        return tag
      })
    })
  }
  
  // Function to add a new trap entry
  const addTrapEntry = () => {
    const newTrapEntry: TrapEntry = {
      id: `trap${Date.now()}`,
      communityName: `Community Name${trapEntries.length + 1}`,
      ip: "10.0.0.1",
      port: "162"
    }
    
    setTrapEntries([...trapEntries, newTrapEntry])
    toast({
      title: "Trap Added",
      description: "New trap entry has been added."
    })
  }
  
  // Function to delete selected trap entries
  const deleteSelectedTrapEntries = () => {
    if (selectedTrapEntries.length === 0) {
      toast({
        title: "No Traps Selected",
        description: "Please select trap entries to delete.",
        variant: "destructive"
      })
      return
    }
    
    setTrapEntries(prevEntries => 
      prevEntries.filter(entry => !selectedTrapEntries.includes(entry.id))
    )
    setSelectedTrapEntries([])
    
    toast({
      title: "Traps Deleted",
      description: `${selectedTrapEntries.length} trap entries have been deleted.`
    })
  }
  
  // Function to toggle trap selection
  const toggleTrapSelection = (trapId: string) => {
    setSelectedTrapEntries(prevSelected => {
      if (prevSelected.includes(trapId)) {
        return prevSelected.filter(id => id !== trapId)
      } else {
        return [...prevSelected, trapId]
      }
    })
  }
  
  // Function to delete a tag
  const deleteTag = (tagId: string) => {
    // Don't allow deletion of root tag
    if (tagId === "root") return;
    
    // Get the tag to be deleted
    const tagToDelete = snmpTags.find(tag => tag.id === tagId);
    if (!tagToDelete) return;
    
    // Get all child tags (recursively)
    const getAllChildIds = (parentId: string): string[] => {
      const directChildren = snmpTags.filter(tag => tag.parentId === parentId).map(tag => tag.id);
      const allChildren = [...directChildren];
      
      directChildren.forEach(childId => {
        allChildren.push(...getAllChildIds(childId));
      });
      
      return allChildren;
    };
    
    const childIds = getAllChildIds(tagId);
    const allIdsToDelete = [tagId, ...childIds];
    
    // Delete the tag and all its children
    setSnmpTags(prevTags => prevTags.filter(tag => !allIdsToDelete.includes(tag.id)));
    
    // Remove from selection if selected
    setSelectedTags(prevSelected => prevSelected.filter(id => !allIdsToDelete.includes(id)));
    
    // Show success message
    toast({
      title: tagToDelete.isGroup ? "Group Deleted" : "Tag Deleted",
      description: tagToDelete.isGroup 
        ? `Deleted group ${tagToDelete.name} and all its tags` 
        : `Deleted tag ${tagToDelete.name}`,
    });
  }
  
  // Function to toggle trap expansion
  const toggleTrapExpansion = () => {
    setTrapExpanded(prev => !prev)
  }
  
  // Function to handle trap field changes
  const handleTrapFieldChange = (trapId: string, field: keyof TrapEntry, value: string) => {
    setTrapEntries(prevEntries => {
      return prevEntries.map(entry => {
        if (entry.id === trapId) {
          return { ...entry, [field]: value }
        }
        return entry
      })
    })
  }
  
  // Function to add a new trap tag
  const addTrapTag = () => {
    // Open the tag selection dialog and set the target as trap tag
    setTagSelectionDialogOpen(true)
    setIsForTrapTag(true)
  }
  
  // Function to handle adding a selected tag as a trap tag
  const addSelectedTagAsTrapTag = (tag: IOTag, deviceName: string, portName: string) => {
    // Find the highest object ID to increment, starting from 2
    let nextObjectId = 2
    trapTags.forEach(tag => {
      if (tag.id !== "trapRoot" && tag.objectId) {
        const objId = parseInt(tag.objectId)
        if (!isNaN(objId) && objId >= nextObjectId) {
          nextObjectId = objId + 1
        }
      }
    })
    
    // Check if the object ID is already in use
    const isObjectIdUsed = trapTags.some(t => 
      t.id !== "trapRoot" && t.objectId === nextObjectId.toString()
    )
    
    if (isObjectIdUsed) {
      toast({
        title: "Error Adding Tag",
        description: "Could not generate a unique Object ID. Please try again.",
        variant: "destructive"
      })
      return
    }
    
    // Create the new trap tag with the correct Object ID format
    const newTrapTag: TrapTag = {
      id: `trapTag${Date.now()}`,
      name: `${deviceName}:${tag.name}`,
      parentId: "trapRoot",
      objectId: nextObjectId.toString(),
      fullObjectId: `${edgelinkOidValue}.100.${nextObjectId}`,
      eventType: "Value Change",
      highLimit: "100",
      lowLimit: "0"
    }
    
    setTrapTags([...trapTags, newTrapTag])
    
    // Close the dialog and reset the flag
    setTagSelectionDialogOpen(false)
    setIsForTrapTag(false)
    
    toast({
      title: "Trap Tag Added",
      description: `Tag ${newTrapTag.name} has been added to trap tags.`
    })
  }
  
  // Function to delete selected trap tags
  const deleteSelectedTrapTags = () => {
    if (selectedTrapTags.length === 0) {
      toast({
        title: "No Tags Selected",
        description: "Please select trap tags to delete.",
        variant: "destructive"
      })
      return
    }
    
    // Don't allow deleting the root
    if (selectedTrapTags.includes("trapRoot")) {
      toast({
        title: "Cannot Delete Root",
        description: "The trap tag list cannot be deleted.",
        variant: "destructive"
      })
      return
    }
    
    setTrapTags(prevTags => 
      prevTags.filter(tag => !selectedTrapTags.includes(tag.id))
    )
    setSelectedTrapTags([])
    
    toast({
      title: "Trap Tags Deleted",
      description: `${selectedTrapTags.length} trap tag(s) have been deleted.`
    })
  }
  
  // Function to toggle trap tag selection
  const toggleTrapTagSelection = (tagId: string) => {
    setSelectedTrapTags(prevSelected => {
      if (prevSelected.includes(tagId)) {
        return prevSelected.filter(id => id !== tagId)
      } else {
        return [...prevSelected, tagId]
      }
    })
  }
  
  // Function to toggle trap tags expansion
  const toggleTrapTagsExpansion = () => {
    setTrapTagsExpanded(prev => !prev)
  }
  
  // Function to update all trap tag Full Object IDs when Edgelink OID changes
  const updateAllTrapTagFullObjectIds = (newEdgelinkOid: string) => {
    setTrapTags(prevTags => {
      // Create a copy of the tags to work with
      const updatedTags = [...prevTags]
      
      // First update the root trap tag
      const rootIndex = updatedTags.findIndex(tag => tag.id === "trapRoot")
      if (rootIndex !== -1) {
        const rootObjectId = updatedTags[rootIndex].objectId
        updatedTags[rootIndex] = {
          ...updatedTags[rootIndex],
          fullObjectId: `${newEdgelinkOid}.${rootObjectId}`
        }
        
        // Then update all child trap tags
        updatedTags.forEach((tag, index) => {
          if (tag.id !== "trapRoot") {
            updatedTags[index] = {
              ...tag,
              fullObjectId: `${newEdgelinkOid}.${rootObjectId}.${tag.objectId}`
            }
          }
        })
      }
      
      return updatedTags
    })
  }
  
  // Function to handle trap tag field changes
  const handleTrapTagFieldChange = (tagId: string, field: keyof TrapTag, value: string) => {
    // Special handling for objectId field
    if (field === "objectId") {
      // Check if this is the root trap tag
      const isRoot = tagId === "trapRoot"
      
      if (isRoot) {
        // For the root trap tag, update the objectId and fullObjectId
        setTrapTags(prevTags => {
          return prevTags.map(tag => {
            if (tag.id === tagId) {
              return { 
                ...tag, 
                objectId: value,
                fullObjectId: `${edgelinkOidValue}.${value}`
              }
            }
            // Also update all child tags' fullObjectId
            if (tag.parentId === "trapRoot") {
              return {
                ...tag,
                fullObjectId: `${edgelinkOidValue}.${value}.${tag.objectId}`
              }
            }
            return tag
          })
        })
      } else {
        // For regular trap tags, check if the objectId is already in use
        const isDuplicate = trapTags.some(tag => 
          tag.id !== tagId && 
          tag.id !== "trapRoot" && 
          tag.objectId === value
        )
        
        if (isDuplicate) {
          toast({
            title: "Duplicate Object ID",
            description: "This Object ID is already in use. Object IDs must be unique.",
            variant: "destructive"
          })
          return
        }
        
        // Find the root trap tag to get its objectId
        const rootTag = trapTags.find(tag => tag.id === "trapRoot")
        const rootObjectId = rootTag ? rootTag.objectId : "100"
        
        // Update the tag's objectId and fullObjectId
        setTrapTags(prevTags => {
          return prevTags.map(tag => {
            if (tag.id === tagId) {
              return { 
                ...tag, 
                objectId: value,
                fullObjectId: `${edgelinkOidValue}.${rootObjectId}.${value}`
              }
            }
            return tag
          })
        })
      }
    } else {
      // Handle other fields normally
      setTrapTags(prevTags => {
        return prevTags.map(tag => {
          if (tag.id === tagId) {
            return { ...tag, [field]: value }
          }
          return tag
        })
      })
    }
  }
  
  // Function to delete selected tags
  const deleteTags = () => {
    if (selectedTags.length === 0) {
      toast({
        title: "No Tags Selected",
        description: "Please select tags to delete.",
        variant: "destructive"
      })
      return
    }
    
    // Don't allow deleting the root
    if (selectedTags.includes("root")) {
      toast({
        title: "Cannot Delete Root",
        description: "The root tag list cannot be deleted.",
        variant: "destructive"
      })
      return
    }
    
    // Get all child tags of selected groups
    const getAllChildrenIds = (parentId: string): string[] => {
      const children = snmpTags.filter(tag => tag.parentId === parentId).map(tag => tag.id)
      const grandchildren = children.flatMap(childId => getAllChildrenIds(childId))
      return [...children, ...grandchildren]
    }
    
    const tagsToDelete = [...selectedTags, ...selectedTags.flatMap(getAllChildrenIds)]
    
    setSnmpTags(prevTags => prevTags.filter(tag => !tagsToDelete.includes(tag.id)))
    setSelectedTags([])
    
    toast({
      title: "Tags Deleted",
      description: `${tagsToDelete.length} tag(s) have been deleted.`
    })
  }
  
  // Function to apply changes
  const applyChanges = () => {
    toast({
      title: "Changes Applied",
      description: "SNMP configuration has been applied."
    })
  }
  
  // Function to discard changes
  const discardChanges = () => {
    // Reset to initial state
    setSnmpTags(initialTags)
    setSelectedTags([])
    
    toast({
      title: "Changes Discarded",
      description: "SNMP configuration changes have been discarded."
    })
  }
  
  // Function to export MIB file
  const exportMibFile = () => {
    toast({
      title: "MIB File Exported",
      description: "SNMP MIB file has been exported."
    })
  }
  
  // Function to add a tag to a specific group
  const addTagToGroup = (groupId: string) => {
    // Make sure the group is expanded when adding a tag
    setSnmpTags(prevTags => {
      return prevTags.map(tag => {
        if (tag.id === groupId && !tag.isExpanded) {
          return { ...tag, isExpanded: true }
        }
        return tag
      })
    })
    
    // Open the tag selection dialog with the target group ID
    setTagSelectionDialogOpen(true)
    // Store the group ID to add the tag to
    setTargetGroupId(groupId)
  }
  
  // Recursive function to render tags in a hierarchical structure
  const renderTags = (parentId: string | null, level = 0): JSX.Element[] => {
    return snmpTags
      .filter(tag => tag.parentId === parentId)
      .map(tag => {
        const hasChildren = snmpTags.some(child => child.parentId === tag.id)
        const isExpanded = tag.isExpanded
        const isSelected = selectedTags.includes(tag.id)
        const isGroup = tag.isGroup
        
        return (
          <>
            <TableRow 
              key={tag.id} 
              className={isSelected ? "bg-accent" : ""}
              onClick={() => toggleTagSelection(tag.id)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center" style={{ paddingLeft: `${level * 20}px` }}>
                  {hasChildren ? (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(tag.id);
                      }} 
                      className="mr-2 p-1 rounded-sm hover:bg-accent"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  ) : (
                    <div className="w-6"></div>
                  )}
                  {isGroup && tag.id !== "root" ? (
                    <Input
                      value={tag.name}
                      onChange={(e) => handleNameChange(tag.id, e.target.value)}
                      className="h-8 w-full"
                      onClick={(e) => e.stopPropagation()} // Prevent toggling selection when clicking the input
                      onFocus={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex-1">
                      {tag.name}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>{!tag.isGroup && tag.id !== "root" ? tag.name : ""}</TableCell>
              <TableCell>
                {!tag.isGroup && tag.id !== "root" ? (
                  <Select 
                    value={tag.asnType} 
                    onValueChange={(value) => handleAsnTypeChange(tag.id, value)}
                  >
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASN_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  ""
                )}
              </TableCell>
              <TableCell>
                <Input
                  value={tag.objectId}
                  onChange={(e) => {
                    console.log(`Input change: ${tag.id} - ${e.target.value}`);
                    handleObjectIdChange(tag.id, e.target.value);
                  }}
                  className="h-8"
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  disabled={tag.id === "root"} // Disable for root tag but still show as input
                />
              </TableCell>
              <TableCell>{tag.fullObjectId}</TableCell>
              <TableCell>
                {!tag.isGroup && tag.id !== "root" ? (
                  <Select 
                    value={tag.readWrite} 
                    onValueChange={(value) => handleReadWriteChange(tag.id, value)}
                  >
                    <SelectTrigger className="w-[120px] h-8">
                      <SelectValue placeholder="Select access" />
                    </SelectTrigger>
                    <SelectContent>
                      {READ_WRITE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  ""
                )}
              </TableCell>
              <TableCell>
                {tag.id === "root" ? (
                  tag.description
                ) : (
                  <Input
                    value={tag.description}
                    onChange={(e) => handleDescriptionChange(tag.id, e.target.value)}
                    className="h-8"
                  />
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {(isGroup || tag.id === "root") && (
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        tag.id === "root" ? addTag() : addTagToGroup(tag.id);
                      }} 
                      size="sm" 
                      variant="outline" 
                      className="h-8"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Tag
                    </Button>
                  )}
                  
                  {/* Delete button - don't show for root tag */}
                  {tag.id !== "root" && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex items-center gap-1 text-destructive hover:bg-destructive/10 h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTag(tag.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                      {isGroup ? "Delete Group" : "Delete"}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
            {hasChildren && isExpanded && renderTags(tag.id, level + 1)}
          </>
        )
      })
  }

  return (
    <div className="space-y-4">
      {/* Tag Selection Dialog */}
      <TagSelectionDialog
        open={tagSelectionDialogOpen}
        onOpenChange={setTagSelectionDialogOpen}
        onSelectTag={handleTagSelection}
      />
      {/* Top Action Bar */}
      <div className="flex justify-between items-center p-2 bg-background border rounded-md">
        <div className="space-x-2">
          <Button onClick={applyChanges} className="bg-green-600 hover:bg-green-700">Apply</Button>
          <Button onClick={discardChanges} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700">Discard</Button>
        </div>
        <Button onClick={exportMibFile} className="bg-orange-500 hover:bg-orange-600">
          <Download className="h-4 w-4 mr-2" />
          Export To MIB File
        </Button>
      </div>
      
      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="trap">Trap</TabsTrigger>
        </TabsList>
        
        <TabsContent value="config" className="space-y-6">
          {/* Config Form */}
          <div className="space-y-4 p-4 border rounded-md bg-background">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <label htmlFor="enableSnmp" className="text-sm font-medium leading-none">
                  Enable SNMP Service
                </label>
                <p className="text-sm text-muted-foreground">Enable or disable SNMP protocol</p>
              </div>
              <Switch id="enableSnmp" checked={snmpEnabled} onCheckedChange={setSnmpEnabled} />
            </div>
            
            {snmpEnabled && (
              <div className="space-y-4 border-t pt-4 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="version" className="text-sm font-medium leading-none">
                      Version
                    </label>
                    <Select defaultValue="v2c">
                      <SelectTrigger id="version" className="w-full">
                        <SelectValue placeholder="Select version" />
                      </SelectTrigger>
                      <SelectContent>
                      <SelectItem value="v1">V1</SelectItem>
                        <SelectItem value="v2c">V2C</SelectItem>
                        <SelectItem value="v3">V3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <label htmlFor="edgelinkOid" className="text-sm font-medium leading-none">
                      Edgelink OID
                    </label>
                    <Input 
                      id="edgelinkOid" 
                      value={edgelinkOidValue} 
                      onChange={(e) => {
                        setEdgelinkOidValue(e.target.value);
                        // Update all full object IDs when edgelink OID changes
                        updateAllFullObjectIds(e.target.value);
                        // Update all trap tag full object IDs
                        updateAllTrapTagFullObjectIds(e.target.value);
                      }} 
                      className="w-full" 
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label htmlFor="port" className="text-sm font-medium leading-none">
                      Port
                    </label>
                    <Input id="port" defaultValue="161" className="w-full" />
                  </div>
                  
                  <div className="space-y-1">
                    <label htmlFor="readCommunity" className="text-sm font-medium leading-none">
                      Read Community
                    </label>
                    <Input id="readCommunity" defaultValue="public" className="w-full" />
                  </div>
                  
                  <div className="space-y-1">
                    <label htmlFor="writeCommunity" className="text-sm font-medium leading-none">
                      Write Community
                    </label>
                    <Input id="writeCommunity" defaultValue="private" className="w-full" />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Tags Table Section */}
          {snmpEnabled && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">SNMP Tags</h3>
                <div className="flex space-x-2">
                  <Button onClick={addGroup} size="sm" variant="outline" className="h-8">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Group
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-md overflow-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[15%]">Object Name</TableHead>
                      <TableHead className="w-[10%]">Tag Name</TableHead>
                      <TableHead className="w-[10%]">Asn Type</TableHead>
                      <TableHead className="w-[15%]">Object ID</TableHead>
                      <TableHead className="w-[15%]">Full Object ID</TableHead>
                      <TableHead className="w-[10%]">Read/Write</TableHead>
                      <TableHead className="w-[15%]">Description</TableHead>
                      <TableHead className="w-[10%]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renderTags(null)}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="trap" className="space-y-6">
          {/* Trap Configuration Section */}
          <div className="p-4 border rounded-md bg-background">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <label htmlFor="enableTrap" className="text-sm font-medium leading-none">
                    Enable Trap
                  </label>
                  <p className="text-sm text-muted-foreground">Enable or disable SNMP trap functionality</p>
                </div>
                <Switch id="enableTrap" checked={trapEnabled} onCheckedChange={setTrapEnabled} />
              </div>
              
              {trapEnabled && (
                <div className="border-t pt-4 mt-2 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="trapInterval" className="text-sm font-medium leading-none">
                        Interval(ms):
                      </label>
                      <Input id="trapInterval" defaultValue="5000" className="w-full" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Trap Tabs */}
          {trapEnabled && (
            <div className="border rounded-md overflow-hidden">
              <div className="p-2 bg-muted">
                <Tabs defaultValue="trapList" className="w-full">
                  <TabsList>
                    <TabsTrigger value="tagList">Tag List</TabsTrigger>
                    <TabsTrigger value="trapList">Trap List</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="tagList" className="p-4">
                    {/* Action Buttons */}
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex space-x-2">
                        <Button onClick={addTrapTag} size="sm" variant="outline" className="h-8">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Tag
                        </Button>
                        <Button onClick={deleteSelectedTrapTags} size="sm" variant="outline" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    {/* Tag List Table */}
                    <div className="border rounded-md overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Object Name</TableHead>
                            <TableHead>Tag Name</TableHead>
                            <TableHead>Object ID</TableHead>
                            <TableHead>Full Object ID</TableHead>
                            <TableHead>Event Type</TableHead>
                            <TableHead>High Limit</TableHead>
                            <TableHead>Low Limit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Root Tag Row - Always visible */}
                          {trapTags
                            .filter(tag => tag.id === "trapRoot")
                            .map(tag => (
                              <TableRow 
                                key={tag.id} 
                                className={selectedTrapTags.includes(tag.id) ? "bg-accent" : ""}
                                onClick={() => toggleTrapTagSelection(tag.id)}
                              >
                                <TableCell className="cursor-pointer">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTrapTagsExpansion();
                                    }} 
                                    className="p-1 rounded-sm hover:bg-accent"
                                  >
                                    {trapTagsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={tag.name}
                                    onChange={(e) => handleTrapTagFieldChange(tag.id, "name", e.target.value)}
                                    className="h-8"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell>
                                  <Input
                                    value={tag.objectId}
                                    onChange={(e) => handleTrapTagFieldChange(tag.id, "objectId", e.target.value)}
                                    className="h-8"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={tag.fullObjectId}
                                    onChange={(e) => handleTrapTagFieldChange(tag.id, "fullObjectId", e.target.value)}
                                    className="h-8"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            ))}
                            
                          {/* Child Tag Rows - Only visible when expanded */}
                          {trapTagsExpanded && trapTags
                            .filter(tag => tag.id !== "trapRoot")
                            .map(tag => (
                              <TableRow 
                                key={tag.id} 
                                className={selectedTrapTags.includes(tag.id) ? "bg-accent" : ""}
                                onClick={() => toggleTrapTagSelection(tag.id)}
                              >
                                <TableCell>
                                  <div className="w-4 ml-4"></div>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={tag.name}
                                    onChange={(e) => handleTrapTagFieldChange(tag.id, "name", e.target.value)}
                                    className="h-8"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell>
                                  {tag.name}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={tag.objectId}
                                    onChange={(e) => handleTrapTagFieldChange(tag.id, "objectId", e.target.value)}
                                    className="h-8"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={tag.fullObjectId}
                                    onChange={(e) => handleTrapTagFieldChange(tag.id, "fullObjectId", e.target.value)}
                                    className="h-8"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select 
                                    value={tag.eventType} 
                                    onValueChange={(value) => handleTrapTagFieldChange(tag.id, "eventType", value)}
                                  >
                                    <SelectTrigger className="w-[140px] h-8" onClick={(e) => e.stopPropagation()}>
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Value Change">Value Change</SelectItem>
                                      <SelectItem value="High Limit">High Limit</SelectItem>
                                      <SelectItem value="Low Limit">Low Limit</SelectItem>
                                      <SelectItem value="Both Limits">Both Limits</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={tag.highLimit}
                                    onChange={(e) => handleTrapTagFieldChange(tag.id, "highLimit", e.target.value)}
                                    className="h-8 w-20"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={tag.lowLimit}
                                    onChange={(e) => handleTrapTagFieldChange(tag.id, "lowLimit", e.target.value)}
                                    className="h-8 w-20"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="trapList" className="p-4">
                    {/* Action Buttons */}
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={toggleTrapExpansion} 
                          className="p-1 rounded-sm hover:bg-accent"
                        >
                          {trapExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <h3 className="text-lg font-medium">Trap List</h3>
                      </div>
                      <div className="flex space-x-2">
                        <Button onClick={addTrapEntry} size="sm" variant="outline" className="h-8">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Trap
                        </Button>
                        <Button onClick={deleteSelectedTrapEntries} size="sm" variant="outline" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    {/* Trap List Table */}
                    {trapExpanded && (
                      <div className="border rounded-md overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10"></TableHead>
                              <TableHead>Community Name</TableHead>
                              <TableHead>IP</TableHead>
                              <TableHead>Port</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {trapEntries.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                  No trap entries. Click "Add Trap" to create one.
                                </TableCell>
                              </TableRow>
                            ) : (
                              trapEntries.map(entry => (
                                <TableRow 
                                  key={entry.id} 
                                  className={selectedTrapEntries.includes(entry.id) ? "bg-accent" : ""}
                                  onClick={() => toggleTrapSelection(entry.id)}
                                >
                                  <TableCell className="cursor-pointer">
                                    <div className="w-4"></div>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={entry.communityName}
                                      onChange={(e) => handleTrapFieldChange(entry.id, "communityName", e.target.value)}
                                      className="h-8"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={entry.ip}
                                      onChange={(e) => handleTrapFieldChange(entry.id, "ip", e.target.value)}
                                      className="h-8"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={entry.port}
                                      onChange={(e) => handleTrapFieldChange(entry.id, "port", e.target.value)}
                                      className="h-8"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
