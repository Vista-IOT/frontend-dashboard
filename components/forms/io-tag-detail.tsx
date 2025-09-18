"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Tags,
  MoreVertical,
  X,
  ChevronDown,
  Save,
  FileDown,
  FileUp,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  useConfigStore,
  type ConfigState,
} from "@/lib/stores/configuration-store";
import type { IOPortConfig } from "./io-tag-form";
// import type { DeviceConfig } from "./device-form";
// IOTag interface is defined and exported in this file, no need for self-import.

import { usePolledTagValues, PolledTagValue } from "@/hooks/usePolledTagValues";
import { SnmpSetDialog } from "@/components/dialogs/snmp-set-dialog";
import { OpcuaWriteDialog } from "@/components/dialogs/opcua-write-dialog";
import { Dnp3WriteDialog } from "@/components/dialogs/dnp3-write-dialog";
import { Iec104WriteDialog } from "@/components/dialogs/iec104-write-dialog";
import { ModbusWriteDialog } from "@/components/dialogs/modbus-write-dialog";
import { useSnmpSet } from "@/hooks/useSnmpSet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const CONVERSION_OPTIONS = [
  { value: "UINT, Big Endian (ABCD)", defaultLength: 16 },
  { value: "INT, Big Endian (ABCD)", defaultLength: 16 },
  {
    value: "UINT32, Modicon Double Precision (reg1*10000+reg2)",
    defaultLength: 32,
  },
  {value: "UInt32", defaultLength: 32},
  { value: "FLOAT, Big Endian (ABCD)", defaultLength: 32 },
  { value: "FLOAT, Big Endian, Swap Word (CDAB)", defaultLength: 32 },
  { value: "INT, Big Endian, Swap Word (CDAB)", defaultLength: 16 },
  { value: "UINT, Big Endian, Swap Word (CDAB)", defaultLength: 16 },
  { value: "UINT, Packed BCD, Big Endian (ABCD)", defaultLength: 16 },
  { value: "UINT, Packed BCD, Big Endian Swap Word (CDAB)", defaultLength: 16 },
  { value: "INT, Little Endian (DCBA)", defaultLength: 16 },
  { value: "UINT, Little Endian (DCBA)", defaultLength: 16 },
  { value: "DOUBLE", defaultLength: 32 },
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

import type { DeviceConfig, IOTag } from "@/lib/stores/configuration-store";

interface IOTagDetailProps {
  device: DeviceConfig;
  portId: string;
  onUpdate?: (portId: string, deviceId: string, tags: IOTag[]) => void;
}

export function IOTagDetailView({
  device: initialDeviceFromProps,
  portId,
  onUpdate,
}: IOTagDetailProps) {
  const { getConfig, updateConfig } = useConfigStore();

  const deviceToDisplay = useConfigStore((state: ConfigState) => {
    // With ConfigSchema, state.config.io_setup.ports should be correctly typed as IOPortConfig[]
    const port = state.config.io_setup?.ports?.find(
      (p: IOPortConfig) => p.id === portId
    );
    if (port && port.devices) {
      const deviceInStore = port.devices.find(
        (d: DeviceConfig) => d.id === initialDeviceFromProps.id
      );
      if (deviceInStore) {
        return deviceInStore;
      }
    }
    return initialDeviceFromProps; // Fallback if port or device not found in store
  });

  const tagsToDisplay: IOTag[] = deviceToDisplay?.tags || [];

  // State for the table and selection
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFormOpen, setTagFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<IOTag | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [snmpSetOpen, setSnmpSetOpen] = useState(false);
  const [snmpSetTag, setSnmpSetTag] = useState<IOTag | null>(null);
  const [opcuaWriteOpen, setOpcuaWriteOpen] = useState(false);
  const [dnp3WriteOpen, setDnp3WriteOpen] = useState(false);
  const [dnp3WriteTag, setDnp3WriteTag] = useState<IOTag | null>(null);
  const [iec104WriteOpen, setIec104WriteOpen] = useState(false);
  const [iec104WriteTag, setIec104WriteTag] = useState<IOTag | null>(null);
  const [modbusWriteOpen, setModbusWriteOpen] = useState(false);
  const [modbusWriteTag, setModbusWriteTag] = useState<IOTag | null>(null);
  const [opcuaWriteTag, setOpcuaWriteTag] = useState<IOTag | null>(null);
  const { snmpSet } = useSnmpSet();

  const handleTagSelection = (tagId: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };

  const handleAddTag = () => {
    setEditingTag(null);
    setTagFormOpen(true);
  };

  const handleEditTag = () => {
    if (selectedTags.length !== 1) return;

    const tagToEdit = tagsToDisplay.find(
      (tag: IOTag) => tag.id === selectedTags[0]
    );
    if (tagToEdit) {
      setEditingTag(tagToEdit);
      setTagFormOpen(true);
    }
  };

  const handleDeleteClick = () => {
    if (selectedTags.length === 0) return;
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    const updatedTagsForDevice = (tagsToDisplay || []).filter(
      (tag: IOTag) => !selectedTags.includes(tag.id)
    );

    // Update global store
    const allPortsFromStore: IOPortConfig[] = getConfig().io_setup?.ports || [];
    const portIndex = allPortsFromStore.findIndex(
      (p: IOPortConfig) => p.id === portId
    );

    if (portIndex === -1) {
      toast.error(`Port ${portId} not found.`, {
        duration: 5000,
      });

      setDeleteConfirmOpen(false);
      return;
    }

    const targetPort = { ...allPortsFromStore[portIndex] };
    const deviceIndex = targetPort.devices.findIndex(
      (d: DeviceConfig) => d.id === deviceToDisplay.id
    );

    if (deviceIndex === -1) {
      toast.error(
        `Device ${deviceToDisplay.name} not found in port ${targetPort.name}.`,
        {
          duration: 5000,
        }
      );

      setDeleteConfirmOpen(false);
      return;
    }

    const targetDevice = { ...targetPort.devices[deviceIndex] };
    targetDevice.tags = updatedTagsForDevice;

    targetPort.devices = targetPort.devices.map((d: DeviceConfig) =>
      d.id === deviceToDisplay.id ? targetDevice : d
    );
    const finalUpdatedPorts = allPortsFromStore.map((p: IOPortConfig) =>
      p.id === portId ? targetPort : p
    );
    updateConfig(["io_setup", "ports"], finalUpdatedPorts);

    setSelectedTags([]);
    setDeleteConfirmOpen(false);
    toast.success(
      `${selectedTags.length} tag(s) have been deleted from ${deviceToDisplay.name}.`,
      {
        duration: 5000,
      }
    );
  };

  const handleSaveTag = (newTag: IOTag) => {
    const existingTags = tagsToDisplay || [];

    // --- Tag name validations ---
    if (!newTag.name.trim()) {
      toast.error("Tag name is required.", { duration: 5000 });
      return;
    }
    if (newTag.name.length < 3) {
      toast.error("Tag name must be at least 3 characters long.", { duration: 5000 });
      return;
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(newTag.name)) {
      toast.error("Tag name can only contain letters, numbers, hyphens (-), and underscores (_).", { duration: 5000 });
      return;
    }
    if (/^\d+$/.test(newTag.name)) {
      toast.error("Tag name cannot be all numbers.", { duration: 5000 });
      return;
    }
    if (/^\s|\s$/.test(newTag.name)) {
      toast.error("Tag name cannot start or end with a space.", { duration: 5000 });
      return;
    }

    const duplicateNameExists = existingTags.some(
      (tag: IOTag) =>
        tag.name.trim().toLowerCase() === newTag.name.trim().toLowerCase() &&
        tag.id !== editingTag?.id
    );

    if (duplicateNameExists) {
      toast.error("A tag with this name already exists in this device.", {
        duration: 5000,
      });
      return;
    }

    // --- Description validation ---
    if (newTag.description && newTag.description.length > 100) {
      toast.error("Description should not exceed 100 characters.", { duration: 5000 });
      return;
    }
    if (newTag.description && !/[a-zA-Z0-9]/.test(newTag.description)) {
      toast.error("Description should include some letters or numbers.", { duration: 5000 });
      return;
    }

    // --- Address validation ---
    if (!newTag.address.trim()) {
      toast.error("Address is required.", { duration: 5000 });
      return;
    }
    
    // Different validation for SNMP, OPC-UA vs other device types
    if (deviceToDisplay.deviceType === "SNMP") {
      // SNMP OID validation: must be in format like 1.3.6.1.2.1.1.1.0
      if (!/^\d+(\.\d+)+$/.test(newTag.address)) {
        toast.error("Address must be a valid SNMP OID (e.g., 1.3.6.1.2.1.1.1.0).", { duration: 5000 });
        return;
      }
    } else if (deviceToDisplay.deviceType === "OPC-UA") {
      // OPC-UA Node ID validation following Advantech EdgeLink format
      // Support formats: ns=<namespace>;s=<string>, ns=<namespace>;i=<numeric>, 
      // ns=<namespace>;g=<guid>, ns=<namespace>;b=<bytestring>
      const opcuaNodeIdRegex = /^ns=\d+;[sigb]=[^;]+$/;
      if (!opcuaNodeIdRegex.test(newTag.address)) {
        toast.error("Address must be a valid OPC-UA Node ID (e.g., ns=2;s=Device.Temperature, ns=2;i=1001, ns=2;g=72962B91-FA75-4AE6-8D28-B404DC7DAF63, or ns=2;b=M/RbKBsRVkePCePcx24oRA==).", { duration: 5000 });
        return;
      }
    } else if (deviceToDisplay.deviceType === "DNP3.0") {
      // DNP3 point address validation following Advantech EdgeLink format
      const dnp3AddressRegex = /^(AI|AO|BI|BO|CTR|DBI)[.,](\d{1,5})$/;
      if (!dnp3AddressRegex.test(newTag.address)) {
        toast.error("Address must be a valid DNP3 point address (e.g., AI.001, AI,001, BO.005, BI.010).", { duration: 5000 });
        return;
      }
      const match = newTag.address.match(dnp3AddressRegex);
      if (match && parseInt(match[2]) > 65535) {
        toast.error("DNP3 point number must be between 0 and 65535.", { duration: 5000 });
        return;
      }
    } else if (deviceToDisplay.deviceType === "IEC-104") {
      // IEC-104 validation: check that iec104PointType is valid
      const validPointTypes = ["M_SP_NA_1", "M_DP_NA_1", "M_ME_NA_1", "M_ME_NC_1", "M_IT_NA_1", "C_SC_NA_1", "C_SE_NA_1", "C_SE_NC_1"];
      if (!newTag.iec104PointType || !validPointTypes.includes(newTag.iec104PointType)) {
        toast.error("Valid IEC-104 Point Type is required.", { duration: 5000 });
        return;
      }
    } else {
      // Standard Modbus address validation
      if (!/^0x[0-9a-fA-F]+$/.test(newTag.address) && !/^\d+$/.test(newTag.address)) {
        toast.error("Address must be a valid integer or hex (e.g., 0x1000 or 4096).", { duration: 5000 });
        return;
      }
    }

    // --- Data Type validation ---
    if (!newTag.dataType) {
      toast.error("Data Type is required.", { duration: 5000 });
      return;
    }

    // --- Register Type validation ---
    if (!newTag.registerType) {
      toast.error("Register Type is required.", { duration: 5000 });
      return;
    }

    // --- Proceed with update ---
    let updatedTags: IOTag[];

    if (editingTag) {
      updatedTags = (tagsToDisplay || []).map((tag: IOTag) =>
        tag.id === editingTag.id ? newTag : tag
      );

      toast.success("Successfully updated tag", { duration: 5000 });
    } else {
      updatedTags = [...(tagsToDisplay || []), newTag];

      toast.success("Successfully added tag", { duration: 5000 });
    }

    const allPortsFromStore: IOPortConfig[] = getConfig().io_setup?.ports || [];
    const portIndex = allPortsFromStore.findIndex((p) => p.id === portId);

    if (portIndex === -1) {
      toast.error(`Port ${portId} not found.`, { duration: 5000 });
      setTagFormOpen(false);
      return;
    }

    const targetPort = { ...allPortsFromStore[portIndex] };
    const deviceIndex = targetPort.devices.findIndex(
      (d) => d.id === deviceToDisplay.id
    );

    if (deviceIndex === -1) {
      toast.error(
        `Device ${deviceToDisplay.name} not found in port ${targetPort.name}.`,
        { duration: 5000 }
      );
      setTagFormOpen(false);
      return;
    }

    const targetDeviceToUpdate = { ...targetPort.devices[deviceIndex] };
    targetDeviceToUpdate.tags = updatedTags;

    targetPort.devices = targetPort.devices.map((d: DeviceConfig) =>
      d.id === deviceToDisplay.id ? targetDeviceToUpdate : d
    );

    const finalUpdatedPorts = allPortsFromStore.map((p: IOPortConfig) =>
      p.id === portId ? targetPort : p
    );

    updateConfig(["io_setup", "ports"], finalUpdatedPorts);
    localStorage.setItem("io_ports_data", JSON.stringify(finalUpdatedPorts));

    setTagFormOpen(false);
    setEditingTag(null);
  };
  // CSV Export Function
  const handleExportCSV = () => {
    if (tagsToDisplay.length === 0) {
      toast.error("No tags to export", { duration: 3000 });
      return;
    }

    const csvHeaders = [
      "Name",
      "Data Type", 
      "Register Type",
      "Conversion Type",
      "Address",
      "Start Bit",
      "Length Bit",
      "Span Low",
      "Span High",
      "Default Value",
      "Scan Rate",
      "Read Write",
      "Description",
      "Scale Type",
      "Formula",
      "Scale",
      "Offset",
      "Clamp To Low",
      "Clamp To High",
      "Clamp To Zero",
      "Signal Reversal",
      "Value 0",
      "Value 1",
    ];

    const csvData = tagsToDisplay.map((tag: IOTag) => [
      tag.name || "",
      tag.dataType || "",
      tag.registerType || "",
      tag.conversionType || "",
      tag.address || "",
      tag.startBit || 0,
      tag.lengthBit || 64,
      tag.spanLow || 0,
      tag.spanHigh || 1000,
      tag.defaultValue || 0,
      tag.scanRate || 1,
      tag.readWrite || "",
      tag.description || "",
      tag.scaleType || "",
      tag.formula || "",
      tag.scale || 1,
      tag.offset || 0,
      tag.clampToLow || false,
      tag.clampToHigh || false,
      tag.clampToZero || false,
      tag.signalReversal || false,
      tag.value0 || "",
      tag.value1 || "",
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => 
        typeof field === 'string' && field.includes(',') 
          ? `"${field.replace(/"/g, '""')}"` 
          : field
      ).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${deviceToDisplay.name}_tags.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast.success(`Exported ${tagsToDisplay.length} tags to CSV`, { duration: 3000 });
  };

  // CSV Import Function
  const handleImportCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast.error("Failed to read file", { duration: 3000 });
        return;
      }

      try {
        // Smart CSV/TSV parsing function that detects delimiter
        const parseCSV = (text: string): string[][] => {
          const rows: string[][] = [];
          const lines = text.split(/\r?\n/);
          
          if (lines.length === 0) return rows;
          
          // Auto-detect delimiter by checking the first line
          const firstLine = lines[0];
          const tabCount = (firstLine.match(/\t/g) || []).length;
          const commaCount = (firstLine.match(/,/g) || []).length;
          
          // Use tab if there are more tabs than commas, or if there are tabs and no commas
          const delimiter = (tabCount > commaCount || (tabCount > 0 && commaCount === 0)) ? '\t' : ',';
          
          console.log('Detected delimiter:', delimiter === '\t' ? 'TAB' : 'COMMA');
          console.log('First line tab count:', tabCount, 'comma count:', commaCount);
          
          for (const line of lines) {
            if (!line.trim()) continue;
            
            if (delimiter === '\t') {
              // Simple tab splitting for TSV
              const row = line.split('\t').map(cell => cell.trim());
              if (row.some(cell => cell.length > 0)) {
                rows.push(row);
              }
            } else {
              // CSV parsing with quote handling
              const row: string[] = [];
              let current = '';
              let inQuotes = false;
              
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"' && !inQuotes) {
                  inQuotes = true;
                } else if (char === '"' && inQuotes && nextChar === '"') {
                  current += '"';
                  i++; // Skip next quote
                } else if (char === '"' && inQuotes) {
                  inQuotes = false;
                } else if (char === ',' && !inQuotes) {
                  row.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              
              row.push(current.trim());
              if (row.some(cell => cell.length > 0)) {
                rows.push(row);
              }
            }
          }
          
          return rows;
        };

        const rows = parseCSV(text);
        
        if (rows.length < 2) {
          toast.error("CSV file must have at least a header and one data row", { duration: 3000 });
          return;
        }

        const headers = rows[0].map(h => h.replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, ''));
        const dataRows = rows.slice(1);

        console.log('CSV Headers:', headers);
        console.log('Number of data rows:', dataRows.length);
        console.log('First data row length:', dataRows[0]?.length, 'Headers length:', headers.length);
        if (dataRows[0]) {
          console.log('First data row:', dataRows[0]);
        }

        const newTags: IOTag[] = [];
        let importErrors: string[] = [];

        dataRows.forEach((values, index) => {
          // Ensure the row has enough columns, pad with empty strings if needed
          while (values.length < headers.length) {
            values.push('');
          }
          
          // If row has more columns than headers, truncate
          if (values.length > headers.length) {
            values = values.slice(0, headers.length);
          }

          const tagData: any = {};
          headers.forEach((header, i) => {
            tagData[header] = values[i] ? values[i].replace(/^"|"$/g, '') : '';
          });

          // Create tag with more flexible field mapping
          const tag: IOTag = {
            id: `imported-tag-${Date.now()}-${index}`,
            name: tagData.name || `ImportedTag${index + 1}`,
            dataType: tagData.datatype || tagData['datatype'] || "Analog",
            registerType: tagData.registertype || tagData['registertype'] || "Coil",
            conversionType: tagData.conversiontype || tagData['conversiontype'] || "FLOAT, Big Endian (ABCD)",
            address: tagData.address || "0",
            startBit: parseInt(tagData.startbit || tagData['startbit']) || 0,
            lengthBit: parseInt(tagData.lengthbit || tagData['lengthbit']) || 64,
            spanLow: parseFloat(tagData.spanlow || tagData['spanlow']) || 0,
            spanHigh: parseFloat(tagData.spanhigh || tagData['spanhigh']) || 1000,
            defaultValue: parseFloat(tagData.defaultvalue || tagData['defaultvalue']) || 0,
            scanRate: parseInt(tagData.scanrate || tagData['scanrate']) || 1,
            readWrite: tagData.readwrite || tagData['readwrite'] || "Read/Write",
            description: tagData.description || "",
            scaleType: tagData.scaletype || tagData['scaletype'] || "No Scale",
            formula: tagData.formula || "",
            scale: parseFloat(tagData.scale) || 1,
            offset: parseFloat(tagData.offset) || 0,
            clampToLow: (tagData.clamptolow || tagData['clamptolow'] || '').toLowerCase() === 'true',
            clampToHigh: (tagData.clamptohigh || tagData['clamptohigh'] || '').toLowerCase() === 'true',
            clampToZero: (tagData.clamptozero || tagData['clamptozero'] || '').toLowerCase() === 'true',
            signalReversal: (tagData.signalreversal || tagData['signalreversal'] || '').toLowerCase() === 'true',
            value0: tagData.value0 || tagData['value0'] || "",
            value1: tagData.value1 || tagData['value1'] || "",
          };

          // Basic validation
          if (!tag.name.trim()) {
            importErrors.push(`Row ${index + 2}: Tag name is required`);
            return;
          }

          // Check for duplicate names
          const duplicateInExisting = tagsToDisplay.some(existingTag => 
            existingTag.name.toLowerCase() === tag.name.toLowerCase()
          );
          const duplicateInImport = newTags.some(newTag => 
            newTag.name.toLowerCase() === tag.name.toLowerCase()
          );

          if (duplicateInExisting || duplicateInImport) {
            importErrors.push(`Row ${index + 2}: Duplicate tag name "${tag.name}"`);
            return;
          }

          newTags.push(tag);
        });

        if (importErrors.length > 0 && newTags.length === 0) {
          toast.error(`Import failed with ${importErrors.length} errors: ${importErrors.slice(0, 3).join(', ')}${importErrors.length > 3 ? '...' : ''}`, { duration: 5000 });
          return;
        }

        if (newTags.length === 0) {
          toast.error("No valid tags found in CSV file", { duration: 3000 });
          return;
        }

        // Show warning if there were errors but some tags were imported
        if (importErrors.length > 0) {
          toast.warning(`Imported ${newTags.length} tags with ${importErrors.length} errors. First few errors: ${importErrors.slice(0, 2).join(', ')}`, { duration: 5000 });
        }

        // Add imported tags to existing tags
        const updatedTags = [...tagsToDisplay, ...newTags];
        
        // Update the store
        const allPortsFromStore: IOPortConfig[] = getConfig().io_setup?.ports || [];
        const portIndex = allPortsFromStore.findIndex((p) => p.id === portId);

        if (portIndex === -1) {
          toast.error(`Port ${portId} not found.`, { duration: 5000 });
          return;
        }

        const targetPort = { ...allPortsFromStore[portIndex] };
        const deviceIndex = targetPort.devices.findIndex(
          (d) => d.id === deviceToDisplay.id
        );

        if (deviceIndex === -1) {
          toast.error(
            `Device ${deviceToDisplay.name} not found in port ${targetPort.name}.`,
            { duration: 5000 }
          );
          return;
        }

        const targetDevice = { ...targetPort.devices[deviceIndex] };
        targetDevice.tags = updatedTags;

        targetPort.devices = targetPort.devices.map((d: DeviceConfig) =>
          d.id === deviceToDisplay.id ? targetDevice : d
        );

        const finalUpdatedPorts = allPortsFromStore.map((p: IOPortConfig) =>
          p.id === portId ? targetPort : p
        );

        updateConfig(["io_setup", "ports"], finalUpdatedPorts);
        localStorage.setItem("io_ports_data", JSON.stringify(finalUpdatedPorts));

        toast.success(`Successfully imported ${newTags.length} tags from CSV`, { duration: 3000 });

      } catch (error) {
        console.error('CSV parsing error:', error);
        toast.error("Failed to parse CSV file. Please check the file format.", { duration: 3000 });
      }
    };

    reader.readAsText(file);
  };



  // File input handler
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv') && !file.name.endsWith('.tsv') && !file.name.endsWith('.txt')) {
        toast.error("Please select a CSV, TSV, or TXT file", { duration: 3000 });
        return;
      }
      handleImportCSV(file);
    }
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };



  const polledValues = usePolledTagValues(1000); // 1s polling

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center">
            <Tags className="h-5 w-5 mr-2" /> IO Tags for {deviceToDisplay.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure input/output tags for data acquisition and processing
          </p>
        </div>
                <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={tagsToDisplay.length === 0}
          >
            <FileDown className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <input
            type="file"
            ref={(ref) => {
              if (ref) {
                ref.style.display = 'none';
              }
            }}
            accept=".csv,.tsv,.txt"
            onChange={handleFileChange}
            id="csv-import-input"
          />
          <Button
            variant="outline"
            onClick={() => {
              const input = document.getElementById('csv-import-input') as HTMLInputElement;
              if (input) input.click();
            }}
          >
            <FileUp className="h-4 w-4 mr-2" /> Import CSV
          </Button>
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
                <TableHead>Length</TableHead>
                <TableHead>Read Write</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tagsToDisplay.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center py-6 text-muted-foreground"
                  >
                    No IO tags configured for this device. Click "Add" to create
                    a new tag.
                  </TableCell>
                </TableRow>
              ) : (
                tagsToDisplay.map((tag: IOTag) => (
                  <TableRow
                    key={tag.id}
                    className={
                      selectedTags.includes(tag.id) ? "bg-muted/50" : ""
                    }
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
                    <TableCell>
                      {tag.conversionType || "FLOAT, Big Endian (ABCD)"}
                    </TableCell>
                    <TableCell>{tag.scaleType || "No Scale"}</TableCell>
                    <TableCell>{tag.lengthBit || "Length Bit"}</TableCell>
                    <TableCell>{tag.readWrite || "Read/Write"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {tag.description}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const tagVal: PolledTagValue | undefined = polledValues[deviceToDisplay.name]?.[tag.id];
                        if (!tagVal) {
                          // Show a spinner for loading
                          return (
                            <span className="flex items-center justify-center text-gray-400">
                              <Loader2 className="animate-spin w-4 h-4" />
                            </span>
                          );
                        }
                        if (tagVal.status === "ok" || tagVal.status === "good" || tagVal.status === "success") {
                          return (
                            <span className="font-mono text-green-600">{tagVal.value}</span>
                          );
                        }
                        // For any error status, show error icon and tooltip
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center justify-center text-red-500 cursor-pointer">
                                  <AlertTriangle className="w-5 h-5" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="center"
                                className="bg-white border border-red-500 shadow-lg rounded-lg px-4 py-3 flex items-center space-x-2 min-w-[220px] max-w-xs"
                              >
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                <span className="text-red-700 font-semibold break-words">{tagVal.error || `Error: ${tagVal.status}`}</span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {deviceToDisplay.deviceType === "SNMP" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSnmpSetTag(tag);
                            setSnmpSetOpen(true);
                          }}
                          disabled={(tag.readWrite || "Read/Write") === "Read Only"}
                        >
                          Set
                        </Button>
                      )}
                      {deviceToDisplay.deviceType === "IEC-104" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIec104WriteTag(tag);
                            setIec104WriteOpen(true);
                          }}
                          disabled={(tag.readWrite || "Read/Write") === "Read Only"}
                        >
                          Write
                        </Button>
                      )}
                      {deviceToDisplay.deviceType === "OPC-UA" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpcuaWriteTag(tag);
                            setOpcuaWriteOpen(true);
                          }}
                          disabled={(tag.readWrite || "Read/Write") === "Read Only"}
                        >
                          Write
                        </Button>
                      )}
                      {deviceToDisplay.deviceType === "DNP3.0" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDnp3WriteTag(tag);
                            setDnp3WriteOpen(true);
                          }}
                          disabled={(tag.readWrite || "Read/Write") === "Read Only" || !tag.address?.match(/^(AO|BO)\./i)}
                        >
                          Write
                        </Button>
                      )}
                      {deviceToDisplay.deviceType === "Modbus TCP" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModbusWriteTag(tag);
                            setModbusWriteOpen(true);
                          }}
                          disabled={(tag.readWrite || "Read/Write") === "Read Only"}
                        >
                          Write
                        </Button>
                      )}
                    </TableCell>
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
            <DialogTitle>
              {editingTag ? "Modify IO Tag" : "Add New IO Tag"}
            </DialogTitle>
            <DialogDescription>
              Configure the IO tag properties for data acquisition and
              processing
            </DialogDescription>
          </DialogHeader>

          <TagForm
            onSave={handleSaveTag}
            onCancel={() => setTagFormOpen(false)}
            existingTag={editingTag}
            device={deviceToDisplay}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedTags.length} IO tag(s). This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDeleteConfirm()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SNMP Set Dialog */}
      {deviceToDisplay.deviceType === "SNMP" && snmpSetTag && (
        <SnmpSetDialog
          open={snmpSetOpen}
          onOpenChange={setSnmpSetOpen}
          device={deviceToDisplay}
          tag={snmpSetTag}
        />
      )}
      
      {/* OPC-UA Write Dialog */}
      {deviceToDisplay.deviceType === "OPC-UA" && opcuaWriteTag && (
        <OpcuaWriteDialog
          open={opcuaWriteOpen}
          onOpenChange={setOpcuaWriteOpen}
          device={deviceToDisplay}
          tag={opcuaWriteTag}
        />
      )}
      
      {/* DNP3 Write Dialog */}
      {deviceToDisplay.deviceType === "DNP3.0" && dnp3WriteTag && (
        <Dnp3WriteDialog
          open={dnp3WriteOpen}
          onOpenChange={setDnp3WriteOpen}
          device={deviceToDisplay}
          tag={dnp3WriteTag}
        />
      )}
      
      {/* IEC-104 Write Dialog */}
      {deviceToDisplay.deviceType === "IEC-104" && iec104WriteTag && (
        <Iec104WriteDialog
          open={iec104WriteOpen}
          onOpenChange={setIec104WriteOpen}
          device={deviceToDisplay}
          tag={iec104WriteTag}
        />
      )}
      
      {/* Modbus Write Dialog */}
      {deviceToDisplay.deviceType === "Modbus TCP" && modbusWriteTag && (
        <ModbusWriteDialog
          open={modbusWriteOpen}
          onOpenChange={setModbusWriteOpen}
          device={deviceToDisplay}
          tag={modbusWriteTag}
        />
      )}
    </div>
  );
}

interface TagFormProps {
  onSave: (tag: IOTag) => void;
  onCancel: () => void;
  existingTag?: IOTag | null;
  device: DeviceConfig;
}

function TagForm({ onSave, onCancel, existingTag, device }: TagFormProps) {
  const [activeTab, setActiveTab] = useState("basic");

  // Form state
  const [name, setName] = useState(existingTag?.name || "");
  const [dataType, setDataType] = useState(existingTag?.dataType || "Analog");
  const [registerType, setRegisterType] = useState(
    existingTag?.registerType || ""
  );
  const [conversion, setConversion] = useState(
    existingTag?.conversionType || ""
  ); // Default to empty or existing
  const [address, setAddress] = useState(existingTag?.address || "");
  const [startBit, setStartBit] = useState(existingTag?.startBit || 0);
  const [lengthBit, setLengthBit] = useState(existingTag?.lengthBit || 64);
  const [spanLow, setSpanLow] = useState(existingTag?.spanLow || 0);
  const [spanHigh, setSpanHigh] = useState(existingTag?.spanHigh || 1000);
  const [defaultValue, setDefaultValue] = useState(
    existingTag?.defaultValue || 0.0
  );
  const [scanRate, setScanRate] = useState(existingTag?.scanRate || 1);
  const [readWrite, setReadWrite] = useState(
    existingTag?.readWrite || "Read/Write"
  );
  const [description, setDescription] = useState(
    existingTag?.description || ""
  );
  // New state for Discrete fields
  const [signalReversal, setSignalReversal] = useState(
    existingTag?.signalReversal ?? false
  );
  const [value0, setValue0] = useState(existingTag?.value0 || "");
  const [value1, setValue1] = useState(existingTag?.value1 || "");
  
  // SNMP-specific fields
  const [asnType, setAsnType] = useState(existingTag?.asnType || "Integer32");
  const [objectId, setObjectId] = useState(existingTag?.objectId || "");
  const [fullObjectId, setFullObjectId] = useState(existingTag?.fullObjectId || "");
  
  // OPC-UA specific fields (following Advantech EdgeLink format)
  const [opcuaDataType, setOpcuaDataType] = useState(existingTag?.opcuaDataType || "Double");
  const [opcuaNodeIdType, setOpcuaNodeIdType] = useState(existingTag?.opcuaNodeIdType || "String");
  const [opcuaNamespace, setOpcuaNamespace] = useState(existingTag?.opcuaNamespace || "2");
  const [opcuaIdentifier, setOpcuaIdentifier] = useState(existingTag?.opcuaIdentifier || "");
  const [opcuaBrowseName, setOpcuaBrowseName] = useState(existingTag?.opcuaBrowseName || "");
  const [opcuaDisplayName, setOpcuaDisplayName] = useState(existingTag?.opcuaDisplayName || "");
  const [opcuaPublishingInterval, setOpcuaPublishingInterval] = useState(existingTag?.opcuaPublishingInterval || 1000);
  const [opcuaSamplingInterval, setOpcuaSamplingInterval] = useState(existingTag?.opcuaSamplingInterval || 100);
  const [opcuaQueueSize, setOpcuaQueueSize] = useState(existingTag?.opcuaQueueSize || 1);
  // DNP3 specific fields
  const [dnp3PointType, setDnp3PointType] = useState(existingTag?.dnp3PointType || "AI");
  const [dnp3PointIndex, setDnp3PointIndex] = useState(existingTag?.dnp3PointIndex || 0);
  const [dnp3Class, setDnp3Class] = useState(existingTag?.dnp3Class || "Class 2");
  const [dnp3EventMode, setDnp3EventMode] = useState(existingTag?.dnp3EventMode || "SOE");
  const [dnp3DeadbandValue, setDnp3DeadbandValue] = useState(existingTag?.dnp3DeadbandValue || 0);
  const [dnp3StaticVariation, setDnp3StaticVariation] = useState(existingTag?.dnp3StaticVariation || "Default");
  const [dnp3EventVariation, setDnp3EventVariation] = useState(existingTag?.dnp3EventVariation || "Default");
  // IEC-104 specific fields
  const [iec104PublicAddress, setIec104PublicAddress] = useState(existingTag?.iec104PublicAddress || 1);
  const [iec104PointNumber, setIec104PointNumber] = useState(existingTag?.iec104PointNumber || 0);
  const [iec104SOE, setIec104SOE] = useState(existingTag?.iec104SOE || "Enabled");
  const [iec104KValue, setIec104KValue] = useState(existingTag?.iec104KValue || 0);
  const [iec104BaseValue, setIec104BaseValue] = useState(existingTag?.iec104BaseValue || 0);
  const [iec104ChangePercent, setIec104ChangePercent] = useState(existingTag?.iec104ChangePercent || 5);
  const [iec104PointType, setIec104PointType] = useState(existingTag?.iec104PointType || "M_SP_NA_1");

  // When dataType changes, reset registerType and set default if applicable
  useEffect(() => {
    // Manage dependent fields and active tab when dataType changes
    if (dataType === "Analog") {
      setRegisterType(
        existingTag?.registerType && existingTag?.dataType === "Analog"
          ? existingTag.registerType
          : "Coil"
      );
      // If a conversion is already selected, its length will be set by the other useEffect.
      // Otherwise, default to 64 or existing if no specific conversion is yet picked.
      if (!conversion) {
        setLengthBit(existingTag?.lengthBit || 64);

      }
      if (activeTab === "tagValueDescriptor") {
        setActiveTab("basic");
      }
    } else if (dataType === "Discrete") {
      setRegisterType(
        existingTag?.registerType && existingTag?.dataType === "Discrete"
          ? existingTag.registerType
          : "Input"
      );
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
  }, [
    dataType,
    conversion,
    existingTag?.dataType,
    existingTag?.registerType,
    existingTag?.lengthBit,
    existingTag?.signalReversal,
    existingTag?.value0,
    existingTag?.value1,
    activeTab,
  ]);

  // Effect to update lengthBit based on selected conversion for Analog type
  useEffect(() => {
    if (dataType === "Analog" && conversion) {
      const selectedOption = CONVERSION_OPTIONS.find(
        (opt) => opt.value === conversion
      );
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

  const [scaleType, setScaleType] = useState(
    existingTag?.scaleType || "No Scale"
  );
  const [formula, setFormula] = useState(existingTag?.formula || "");
  const [scale, setScale] = useState(existingTag?.scale || 1);
  const [offset, setOffset] = useState(existingTag?.offset || 0);
  const [clampToLow, setClampToLow] = useState(
    existingTag?.clampToLow || false
  );
  const [clampToHigh, setClampToHigh] = useState(
    existingTag?.clampToHigh || false
  );
  const [clampToZero, setClampToZero] = useState(
    existingTag?.clampToZero || false
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Name is required.");
      return;
    }

    if (!dataType) {
      alert("Data Type is required.");
      return;
    }

    if (!registerType) {
      alert("Register Type is required.");
      return;
    }

    if (dataType === "Analog" && !conversion) {
      alert("Conversion Type is required for Analog tags.");
      return;
    }

    // Address validation - skip for IEC-104 as it is auto-generated
    if (device.deviceType !== "IEC-104" && !address.trim()) {
      alert("Address is required.");
      return;
    }

    const newTag: IOTag = {
      id: existingTag?.id || `tag-${Date.now()}`,
      name,
      dataType,
      registerType,
      conversionType: conversion,
      address: device.deviceType === "IEC-104" ? `${iec104PointType}:${iec104PointNumber}` : (device.deviceType === "DNP3.0" ? address.replace(",", ".") : address),
      startBit,
      lengthBit: dataType === "Discrete" ? 1 : lengthBit,
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
      signalReversal: dataType === "Discrete" ? signalReversal : undefined,
      value0: dataType === "Discrete" ? value0 : undefined,
      value1: dataType === "Discrete" ? value1 : undefined,
      // SNMP-specific fields
      asnType: device.deviceType === "SNMP" ? asnType : undefined,
      objectId: device.deviceType === "SNMP" ? objectId : undefined,
      fullObjectId: device.deviceType === "SNMP" ? fullObjectId : undefined,
      // OPC-UA specific fields
      opcuaDataType: device.deviceType === "OPC-UA" ? opcuaDataType : undefined,
      opcuaNodeIdType: device.deviceType === "OPC-UA" ? opcuaNodeIdType : undefined,
      opcuaNamespace: device.deviceType === "OPC-UA" ? opcuaNamespace : undefined,
      opcuaIdentifier: device.deviceType === "OPC-UA" ? opcuaIdentifier : undefined,
      opcuaBrowseName: device.deviceType === "OPC-UA" ? opcuaBrowseName : undefined,
      opcuaDisplayName: device.deviceType === "OPC-UA" ? opcuaDisplayName : undefined,
      opcuaPublishingInterval: device.deviceType === "OPC-UA" ? opcuaPublishingInterval : undefined,
      opcuaSamplingInterval: device.deviceType === "OPC-UA" ? opcuaSamplingInterval : undefined,
      opcuaQueueSize: device.deviceType === "OPC-UA" ? opcuaQueueSize : undefined,
      // DNP3 specific fields
      dnp3PointType: device.deviceType === "DNP3.0" ? dnp3PointType : undefined,
      dnp3PointIndex: device.deviceType === "DNP3.0" ? dnp3PointIndex : undefined,
      dnp3Class: device.deviceType === "DNP3.0" ? dnp3Class : undefined,
      dnp3EventMode: device.deviceType === "DNP3.0" ? dnp3EventMode : undefined,
      dnp3DeadbandValue: device.deviceType === "DNP3.0" ? dnp3DeadbandValue : undefined,
      dnp3StaticVariation: device.deviceType === "DNP3.0" ? dnp3StaticVariation : undefined,
      dnp3EventVariation: device.deviceType === "DNP3.0" ? dnp3EventVariation : undefined,
      // IEC-104 specific fields
      iec104PublicAddress: device.deviceType === "IEC-104" ? iec104PublicAddress : undefined,
      iec104PointType: device.deviceType === "IEC-104" ? iec104PointType : undefined,
      iec104PointNumber: device.deviceType === "IEC-104" ? iec104PointNumber : undefined,
      iec104SOE: device.deviceType === "IEC-104" ? iec104SOE : undefined,
      iec104KValue: device.deviceType === "IEC-104" ? iec104KValue : undefined,
      iec104BaseValue: device.deviceType === "IEC-104" ? iec104BaseValue : undefined,
      iec104ChangePercent: device.deviceType === "IEC-104" ? iec104ChangePercent : undefined,
    };

    onSave(newTag); // make sure onSave is defined in props
  };

  return (
    <form onSubmit={handleSubmit}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="basic" className="flex-1">
            Basic
          </TabsTrigger>
          {dataType === "Analog" && (
            <TabsTrigger value="advanced" className="flex-1">
              Advanced
            </TabsTrigger>
          )}
          {dataType === "Discrete" && (
            <TabsTrigger value="tagValueDescriptor" className="flex-1">
              Tag Value Descriptor
            </TabsTrigger>
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
                      <SelectItem value="Discrete Inputs">
                        Discrete Inputs
                      </SelectItem>
                    </>
                  )}
                  {dataType === "Discrete" && (
                    <>
                      <SelectItem value="Input">Input</SelectItem>
                      <SelectItem value="Holding">Holding</SelectItem>
                    </>
                  )}
                  {/* Show a disabled item if dataType is not selected or doesn't match Analog/Discrete */}
                  {(!dataType ||
                    (dataType !== "Analog" && dataType !== "Discrete")) && (
                    <SelectItem value="" disabled>
                      Select Data Type first
                    </SelectItem>
                  )}
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
                    {CONVERSION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {device.deviceType === "SNMP" && (
              <div className="space-y-2">
                <Label htmlFor="asnType">ASN Type</Label>
                <Select value={asnType} onValueChange={setAsnType}>
                  <SelectTrigger id="asnType">
                    <SelectValue placeholder="Select ASN type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Integer32">Integer32</SelectItem>
                    <SelectItem value="String">String</SelectItem>
                    <SelectItem value="Ipaddress">Ipaddress</SelectItem>
                    <SelectItem value="Timeticks">Timeticks</SelectItem>
                    <SelectItem value="Oid">Oid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {device.deviceType === "OPC-UA" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="opcuaDataType">OPC-UA Data Type</Label>
                  <Select value={opcuaDataType} onValueChange={setOpcuaDataType}>
                    <SelectTrigger id="opcuaDataType">
                      <SelectValue placeholder="Select OPC-UA data type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Boolean">Boolean</SelectItem>
                      <SelectItem value="Byte">Byte</SelectItem>
                      <SelectItem value="SByte">SByte</SelectItem>
                      <SelectItem value="Int16">Int16</SelectItem>
                      <SelectItem value="UInt16">UInt16</SelectItem>
                      <SelectItem value="Int32">Int32</SelectItem>
                      <SelectItem value="UInt32">UInt32</SelectItem>
                      <SelectItem value="Int64">Int64</SelectItem>
                      <SelectItem value="UInt64">UInt64</SelectItem>
                      <SelectItem value="Float">Float</SelectItem>
                      <SelectItem value="Double">Double</SelectItem>
                      <SelectItem value="String">String</SelectItem>
                      <SelectItem value="DateTime">DateTime</SelectItem>
                      <SelectItem value="StatusCode">StatusCode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opcuaNodeIdType">Node ID Type</Label>
                  <Select value={opcuaNodeIdType} onValueChange={setOpcuaNodeIdType}>
                    <SelectTrigger id="opcuaNodeIdType">
                      <SelectValue placeholder="Select Node ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="String">String</SelectItem>
                      <SelectItem value="Numeric">Numeric</SelectItem>
                      <SelectItem value="GUID">GUID</SelectItem>
                      <SelectItem value="ByteString">ByteString</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            {device.deviceType === "IEC-104" && (
              <>
              <div className="space-y-2">
                  <Label htmlFor="iec104PointType">IEC-104 Point Type</Label>
                  <Select value={iec104PointType} onValueChange={setIec104PointType}>
                    <SelectTrigger id="iec104PointType">
                      <SelectValue placeholder="Select IEC-104 point type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M_SP_NA_1">BI - Binary Input (Single Point)</SelectItem>
                      <SelectItem value="M_DP_NA_1">BI - Binary Input (Double Point)</SelectItem>
                      <SelectItem value="M_ME_NA_1">AI - Analog Input (Normalized)</SelectItem>
                      <SelectItem value="M_ME_NC_1">AI - Analog Input (Float)</SelectItem>
                      <SelectItem value="M_IT_NA_1">Counter - Integrated Totals</SelectItem>
                      <SelectItem value="C_SC_NA_1">BO - Binary Output (Single Command)</SelectItem>
                      <SelectItem value="C_SE_NA_1">AO - Analog Output (Normalized)</SelectItem>
                      <SelectItem value="C_SE_NC_1">AO - Analog Output (Float)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the IEC-104 information type for this point
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iec104PublicAddress">Public Address</Label>
                  <Input
                    id="iec104PublicAddress"
                    type="number"
                    value={iec104PublicAddress}
                    onChange={(e) => setIec104PublicAddress(Number(e.target.value))}
                    min={1}
                    max={65535}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Common Address of ASDU
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="iec104PointNumber">Point Number</Label>
                  <Input
                    id="iec104PointNumber"
                    type="number"
                    value={iec104PointNumber}
                    onChange={(e) => setIec104PointNumber(Number(e.target.value))}
                    min={0}
                    max={16777215}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Information Object Address (IOA)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="iec104SOE">Sequence of Events</Label>
                  <Select value={iec104SOE} onValueChange={setIec104SOE}>
                    <SelectTrigger id="iec104SOE">
                      <SelectValue placeholder="Select SOE mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Enabled">Enabled</SelectItem>
                      <SelectItem value="Disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="iec104KValue">K Value</Label>
                  <Input
                    id="iec104KValue"
                    type="number"
                    value={iec104KValue}
                    onChange={(e) => setIec104KValue(Number(e.target.value))}
                    min={0}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Scaling factor for analog values
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="iec104BaseValue">Base Value</Label>
                  <Input
                    id="iec104BaseValue"
                    type="number"
                    value={iec104BaseValue}
                    onChange={(e) => setIec104BaseValue(Number(e.target.value))}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Base offset for analog values
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="iec104ChangePercent">Change Percent</Label>
                  <Input
                    id="iec104ChangePercent"
                    type="number"
                    value={iec104ChangePercent}
                    onChange={(e) => setIec104ChangePercent(Number(e.target.value))}
                    min={0}
                    max={100}
                    placeholder="5"
                  />
                  <p className="text-xs text-muted-foreground">
                    Threshold for event generation (%)
                  </p>
                </div>
              </>
            )}

            {device.deviceType !== "IEC-104" ? (
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
            ) : (
            <div className="space-y-2">
              <Label htmlFor="iec104Address">Computed Address</Label>
              <Input
                id="iec104Address"
                value={`${iec104PointType}:${iec104PointNumber}`}
                readOnly
                placeholder="Auto-generated from Point Type and Point Number"
                className="bg-gray-50"
              />
              <p className="text-xs text-muted-foreground">
                Address is automatically generated from Point Type and Point Number
              </p>
            </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="startBit">Start Bit</Label>
              <Input
                id="startBit"
                type="number"
                value={startBit}
                onChange={(e) => setStartBit(Number(e.target.value))}
                min={0}
                max={255}
              />
            </div>

            {device.deviceType === "DNP3.0" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="dnp3PointType">DNP3 Point Type</Label>
                  <Select value={dnp3PointType} onValueChange={setDnp3PointType}>
                    <SelectTrigger id="dnp3PointType">
                      <SelectValue placeholder="Select DNP3 point type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AI">Analog Input (AI)</SelectItem>
                      <SelectItem value="AO">Analog Output (AO)</SelectItem>
                      <SelectItem value="BI">Binary Input (BI)</SelectItem>
                      <SelectItem value="BO">Binary Output (BO)</SelectItem>
                      <SelectItem value="CTR">Counter (CTR)</SelectItem>
                      <SelectItem value="DBI">Double-bit Input (DBI)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dnp3PointIndex">Point Index</Label>
                  <Input
                    id="dnp3PointIndex"
                    type="number"
                    value={dnp3PointIndex}
                    onChange={(e) => setDnp3PointIndex(Number(e.target.value))}
                    min={0}
                    max={65535}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dnp3Class">Event Class</Label>
                  <Select value={dnp3Class} onValueChange={setDnp3Class}>
                    <SelectTrigger id="dnp3Class">
                      <SelectValue placeholder="Select event class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Class 0">Class 0 (Static)</SelectItem>
                      <SelectItem value="Class 1">Class 1 (Priority)</SelectItem>
                      <SelectItem value="Class 2">Class 2 (Normal)</SelectItem>
                      <SelectItem value="Class 3">Class 3 (Low Priority)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dnp3EventMode">Event Mode</Label>
                  <Select value={dnp3EventMode} onValueChange={setDnp3EventMode}>
                    <SelectTrigger id="dnp3EventMode">
                      <SelectValue placeholder="Select event mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SOE">SOE (Sequence of Events)</SelectItem>
                      <SelectItem value="COV">COV (Change of Value)</SelectItem>
                      <SelectItem value="Periodic">Periodic</SelectItem>
                      <SelectItem value="None">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(dnp3PointType === "AI" || dnp3PointType === "AO") && (
                  <div className="space-y-2">
                    <Label htmlFor="dnp3DeadbandValue">Deadband Value</Label>
                    <Input
                      id="dnp3DeadbandValue"
                      type="number"
                      value={dnp3DeadbandValue}
                      onChange={(e) => setDnp3DeadbandValue(Number(e.target.value))}
                      min={0}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Analog deadband for event generation
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="dnp3StaticVariation">Static Variation</Label>
                  <Select value={dnp3StaticVariation} onValueChange={setDnp3StaticVariation}>
                    <SelectTrigger id="dnp3StaticVariation">
                      <SelectValue placeholder="Select static variation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Default">Default</SelectItem>
                      <SelectItem value="Group1Var1">Group 1 Variation 1</SelectItem>
                      <SelectItem value="Group1Var2">Group 1 Variation 2</SelectItem>
                      <SelectItem value="Group30Var1">Group 30 Variation 1</SelectItem>
                      <SelectItem value="Group30Var2">Group 30 Variation 2</SelectItem>
                      <SelectItem value="Group30Var3">Group 30 Variation 3</SelectItem>
                      <SelectItem value="Group30Var4">Group 30 Variation 4</SelectItem>
                      <SelectItem value="Group30Var5">Group 30 Variation 5</SelectItem>
                      <SelectItem value="Group30Var6">Group 30 Variation 6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dnp3EventVariation">Event Variation</Label>
                  <Select value={dnp3EventVariation} onValueChange={setDnp3EventVariation}>
                    <SelectTrigger id="dnp3EventVariation">
                      <SelectValue placeholder="Select event variation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Default">Default</SelectItem>
                      <SelectItem value="Group2Var1">Group 2 Variation 1</SelectItem>
                      <SelectItem value="Group2Var2">Group 2 Variation 2</SelectItem>
                      <SelectItem value="Group32Var1">Group 32 Variation 1</SelectItem>
                      <SelectItem value="Group32Var2">Group 32 Variation 2</SelectItem>
                      <SelectItem value="Group32Var3">Group 32 Variation 3</SelectItem>
                      <SelectItem value="Group32Var4">Group 32 Variation 4</SelectItem>
                      <SelectItem value="Group32Var5">Group 32 Variation 5</SelectItem>
                      <SelectItem value="Group32Var6">Group 32 Variation 6</SelectItem>
                      <SelectItem value="Group32Var7">Group 32 Variation 7</SelectItem>
                      <SelectItem value="Group32Var8">Group 32 Variation 8</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

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
                    if (
                      dataType === "Analog" &&
                      !CONVERSION_OPTIONS.find(
                        (opt) => opt.value === conversion
                      )
                    ) {
                      setLengthBit(Number(e.target.value));
                    }
                  }}
                  readOnly={
                    dataType === "Discrete" ||
                    (dataType === "Analog" &&
                      !!CONVERSION_OPTIONS.find(
                        (opt) => opt.value === conversion
                      ))
                  } // Read-only for Discrete or if Analog and conversion selected
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
                    <SelectItem value="Scale 0-100% Input to Span">
                      Scale 0-100% Input to Span
                    </SelectItem>
                    <SelectItem value="Linear Scale, MX+B">
                      Linear Scale, MX+B
                    </SelectItem>
                    <SelectItem value="Scale Defined Input H/L to Span">
                      Scale Defined Input H/L to Span
                    </SelectItem>
                    <SelectItem value="Scale 12-Bit Input to Span">
                      Scale 12-Bit Input to Span
                    </SelectItem>
                    <SelectItem value="Scale 0-100% Square Root Input">
                      Scale 0-100% Square Root Input
                    </SelectItem>
                    <SelectItem value="Square Root of (Input/(F2-F1)) to Span">
                      Square Root of (Input/(F2-F1)) to Span
                    </SelectItem>
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
                      onCheckedChange={(checked) =>
                        setClampToLow(checked as boolean)
                      }
                    />
                    <Label htmlFor="clampToLow">Clamp to span low</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="clampToHigh"
                      checked={clampToHigh}
                      onCheckedChange={(checked) =>
                        setClampToHigh(checked as boolean)
                      }
                    />
                    <Label htmlFor="clampToHigh">Clamp to span high</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="clampToZero"
                      checked={clampToZero}
                      onCheckedChange={(checked) =>
                        setClampToZero(checked as boolean)
                      }
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
        <Button variant="outline" type="button" onClick={onCancel}>
          Close
        </Button>
        <Button type="submit">OK</Button>
      </DialogFooter>
    </form>
  );
}
