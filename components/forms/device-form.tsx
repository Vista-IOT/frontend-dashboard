"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { useConfigStore } from "@/lib/stores/configuration-store";
import type { IOPortConfig } from "./io-tag-form"; // Assuming IOPortConfig is exported from there
import type { IOTag } from "@/lib/stores/configuration-store";

import { AlertCircle } from "lucide-react";
import { z } from "zod";

export const deviceConfigSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  name: z.string().min(1, "Device name is required"),
  deviceType: z.string().min(1, "Device type is required"),
  unitNumber: z.coerce
    .number()
    .int("Must be an integer")
    .min(1, "Unit number must be at least 1")
    .max(255, "Unit number must be at most 255"), // or 247 for Modbus strict
  tagWriteType: z.string().min(1, "Tag write type is required"),
  description: z.string().optional().default(""),
  addDeviceNameAsPrefix: z.boolean(),
  useAsciiProtocol: z.coerce
    .number()
    .int()
    .refine((val) => val === 0 || val === 1, {
      message: "useAsciiProtocol must be 0 or 1",
    }),
  packetDelay: z.coerce
    .number()
    .int()
    .min(0, "Packet delay must be non-negative"),
  digitalBlockSize: z.coerce.number().int().min(0),
  analogBlockSize: z.coerce.number().int().min(0),
  tags: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      dataType: z.string(),
      address: z.string(),
      description: z.string(),
    })
  ),
});

export interface DeviceConfig {
  id: string;
  enabled: boolean;
  name: string;
  deviceType: string;
  unitNumber: number;
  tagWriteType: string;
  description: string;
  addDeviceNameAsPrefix: boolean;
  useAsciiProtocol: number;
  packetDelay: number;
  digitalBlockSize: number;
  analogBlockSize: number;
  tags: IOTag[]; // Array to hold device tags
  ipAddress?: string; // For Modbus TCP
  portNumber?: number; // For Modbus TCP
}

interface DeviceFormProps {
  onSubmit?: (config: DeviceConfig) => boolean;
  existingConfig?: DeviceConfig;
  portId: string;
  existingDeviceNames?: string[];
}

export function DeviceForm({
  onSubmit,
  existingConfig,
  portId,
  existingDeviceNames = [],
}: DeviceFormProps) {
  const { updateConfig, getConfig } = useConfigStore();
  const [enabled, setEnabled] = useState(existingConfig?.enabled ?? true);
  const [name, setName] = useState(existingConfig?.name || "NewDevice");
  const [nameError, setNameError] = useState(() => {
    const lowerNewName = (existingConfig?.name || "NewDevice")
      .trim()
      .toLowerCase();
    const lowerExistingNames = (existingDeviceNames || [])
      .filter(
        (n) =>
          !existingConfig ||
          n.toLowerCase() !== (existingConfig.name ?? "").toLowerCase()
      )
      .map((n) => n.toLowerCase());
    return (
      (existingConfig?.name || "NewDevice") === "NewDevice" ||
      (existingConfig?.name || "NewDevice").trim() === "" ||
      lowerExistingNames.includes(lowerNewName)
    );
  });
  const [deviceType, setDeviceType] = useState(
    existingConfig?.deviceType || "Modbus RTU"
  );
  const [unitNumber, setUnitNumber] = useState(existingConfig?.unitNumber || 1);
  const [tagWriteType, setTagWriteType] = useState(
    existingConfig?.tagWriteType || "Single Write"
  );
  const [description, setDescription] = useState(
    existingConfig?.description || ""
  );
  const [addDeviceNameAsPrefix, setAddDeviceNameAsPrefix] = useState(
    existingConfig?.addDeviceNameAsPrefix ?? true
  );

  // Extension properties
  const [useAsciiProtocol, setUseAsciiProtocol] = useState(
    existingConfig?.useAsciiProtocol || 0
  );
  const [packetDelay, setPacketDelay] = useState(
    existingConfig?.packetDelay || 20
  );
  const [digitalBlockSize, setDigitalBlockSize] = useState(
    existingConfig?.digitalBlockSize || 512
  );
  const [analogBlockSize, setAnalogBlockSize] = useState(
    existingConfig?.analogBlockSize || 64
  );

  // 2. Add state for Modbus TCP fields
  const [ipAddress, setIpAddress] = useState(
    existingConfig?.ipAddress || "11.0.0.1"
  );
  const [portNumber, setPortNumber] = useState(
    existingConfig?.portNumber || 502
  );

  // 3. Autofill defaults when switching to Modbus TCP
  useEffect(() => {
    if (
      deviceType === "Modbus TCP" &&
      (!existingConfig || existingConfig.deviceType !== "Modbus TCP")
    ) {
      setIpAddress("11.0.0.1");
      setPortNumber(502);
    }
  }, [deviceType]);

  useEffect(() => {
    const lowerNewName = name.trim().toLowerCase();
    const lowerExistingNames = (existingDeviceNames || [])
      .filter(
        (n) =>
          !existingConfig ||
          n.toLowerCase() !== (existingConfig.name ?? "").toLowerCase()
      )
      .map((n) => n.toLowerCase());
    setNameError(
      name === "NewDevice" ||
        name.trim() === "" ||
        lowerExistingNames.includes(lowerNewName)
    );
  }, [name, existingDeviceNames, existingConfig]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    // Check for uniqueness (case-insensitive, ignore self if editing)
    const lowerNewName = newName.trim().toLowerCase();
    const lowerExistingNames = existingDeviceNames
      .filter(
        (n) =>
          !existingConfig ||
          n.toLowerCase() !== (existingConfig.name ?? "").toLowerCase()
      )
      .map((n) => n.toLowerCase());
    setNameError(
      newName === "NewDevice" ||
        newName.trim() === "" ||
        lowerExistingNames.includes(lowerNewName)
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // --- Name validation ---
    if (nameError || !name.trim()) {
      toast.error("Provide a valid and unique device name.", {
        duration: 5000,
      });
      return;
    }

    if (name.length < 3) {
      toast.error("Device name must be at least 3 characters.", {
        duration: 5000,
      });
      return;
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
      toast.error(
        "Device name can only contain letters, numbers, hyphens (-), and underscores (_).",
        {
          duration: 5000,
        }
      );
      return;
    }

    if (/^\s|\s$/.test(name)) {
      toast.error("Device name cannot start or end with a space.", {
        duration: 5000,
      });
      return;
    }

    if (/^\d+$/.test(name)) {
      toast.error("Device name cannot be all numbers.", {
        duration: 5000,
      });
      return;
    }

    // --- Unit Number validation ---
    if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 247) {
      toast.error("Unit number must be an integer between 1 and 247.", {
        duration: 5000,
      });
      return;
    }

    // --- Description validation ---
    if (description && description.length > 100) {
      toast.error("Description should not exceed 100 characters.", {
        duration: 5000,
      });
      return;
    }

    if (description && !/[a-zA-Z0-9]/.test(description)) {
      toast.error("Description should include some letters or numbers.", {
        duration: 5000,
      });
      return;
    }

    // --- Packet Delay validation ---
    if (!Number.isInteger(packetDelay) || packetDelay < 0) {
      toast.error("Packet delay must be a non-negative integer.", {
        duration: 5000,
      });
      return;
    }

    // --- Digital Block Size validation ---
    if (!Number.isInteger(digitalBlockSize) || digitalBlockSize < 0) {
      toast.error("Digital block size must be a non-negative integer.", {
        duration: 5000,
      });
      return;
    }

    // --- Analog Block Size validation ---
    if (!Number.isInteger(analogBlockSize) || analogBlockSize < 0) {
      toast.error("Analog block size must be a non-negative integer.", {
        duration: 5000,
      });
      return;
    }

    // --- Port existence check ---
    const ports = getConfig().io_setup?.ports || [];
    const thisPort = ports.find((p) => p.id === portId);

    if (!thisPort) {
      toast.error(`Port ${portId} not found.`, {
        duration: 5000,
      });
      return;
    }

    // --- Unit number conflict check ---
    const unitConflict = thisPort.devices.some(
      (d) => d.unitNumber === unitNumber && d.id !== existingConfig?.id
    );

    if (unitConflict) {
      toast.error(`Unit number ${unitNumber} is already in use on this port.`, {
        duration: 5000,
      });
      return;
    }

    // --- Construct new device config ---
    const newDeviceConfig: DeviceConfig = {
      id: existingConfig?.id || `device-${Date.now()}`,
      enabled,
      name,
      deviceType,
      unitNumber,
      tagWriteType,
      description,
      addDeviceNameAsPrefix,
      useAsciiProtocol,
      packetDelay,
      digitalBlockSize,
      analogBlockSize,
      tags: existingConfig?.tags || [],
      ...(deviceType === "Modbus TCP"
        ? { ipAddress, portNumber }
        : {}),
    };

    if (onSubmit) {
      const success = onSubmit(newDeviceConfig);
      if (success && !existingConfig) {
        setEnabled(true);
        setName("NewDevice");
        setDeviceType("Modbus RTU");
        setUnitNumber(1);
        setTagWriteType("Single Write");
        setDescription("");
        setAddDeviceNameAsPrefix(true);
        setUseAsciiProtocol(0);
        setPacketDelay(20);
        setDigitalBlockSize(512);
        setAnalogBlockSize(64);
        setIpAddress("11.0.0.1");
        setPortNumber(502);
      }
    }
  };

  // 4. Add 'Modbus TCP' to DEVICE_TYPES
  const DEVICE_TYPES = [
    "Modbus RTU",
    "Modbus TCP",
    "Advantech ADAM 2000 Series (Modbus RTU)",
    "Advantech ADAM 4000 Series (ADAM ASCII/Modbus RTU)",
    "Advantech WebCon 2000 Series",
    "Advantech WebOP HMI (Modbus RTU)",
    "Delta DVP Series PLC (Modbus RTU)",
    "M System, Modbus Compatible, RX Series (Modbus RTU)",
    "Schneider ION6200 (Modbus RTU)",
    "WAGO I/O System 750",
    "YASKAWA MP900 series, MemoBus Modbus compatible (Modbus RTU)",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {existingConfig ? "Edit Device" : "Add New Device"}
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[70vh] overflow-y-auto pr-1">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="border rounded-md p-4">
              <h3 className="text-md font-medium mb-4">General Information</h3>

              {/* Enable option */}
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox
                  id="enabled"
                  checked={enabled}
                  onCheckedChange={(checked) => setEnabled(checked as boolean)}
                />
                <Label htmlFor="enabled">Enable</Label>
              </div>

              {/* Name with validation indicator */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="name" className="flex items-center">
                  Name
                  {nameError && (
                    <span className="ml-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                    </span>
                  )}
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={handleNameChange}
                  className={nameError ? "border-destructive" : ""}
                />
                {nameError && (
                  <p className="text-xs text-destructive">
                    Please enter a unique device name (not used by any other
                    device in this port)
                  </p>
                )}
              </div>

              {/* Device Type dropdown */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="deviceType">Device Type</Label>
                <Select value={deviceType} onValueChange={setDeviceType}>
                  <SelectTrigger id="deviceType">
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Modbus TCP fields */}
              {deviceType === "Modbus TCP" && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="ipAddress">IP Address</Label>
                    <Input
                      id="ipAddress"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="11.0.0.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portNumber">Port Number</Label>
                    <Input
                      id="portNumber"
                      type="number"
                      value={portNumber}
                      onChange={(e) => setPortNumber(Number(e.target.value))}
                      min={1}
                      max={65535}
                      placeholder="502"
                    />
                  </div>
                </div>
              )}

              {/* Device Model */}
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox id="deviceModel" disabled />
                <Label htmlFor="deviceModel" className="flex-1">
                  Device Model
                </Label>
                <Button
                  variant="outline"
                  disabled
                  className="text-muted-foreground"
                >
                  Double Click to Select Device Template
                </Button>
                <Button variant="outline" size="icon" disabled>
                  ...
                </Button>
              </div>

              {/* Unit Number */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="unitNumber">Unit Number</Label>
                <Input
                  id="unitNumber"
                  type="number"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(Number(e.target.value))}
                  min={1}
                  max={255}
                />
              </div>

              {/* Tag Write Type dropdown */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="tagWriteType">Tag Write Type</Label>
                <Select value={tagWriteType} onValueChange={setTagWriteType}>
                  <SelectTrigger id="tagWriteType">
                    <SelectValue placeholder="Select tag write type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single Write">Single Write</SelectItem>
                    <SelectItem value="Block Write">Block Write</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter a description (optional)"
                  rows={3}
                />
              </div>

              {/* Add device name as prefix to IO tags */}
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox
                  id="addDeviceNameAsPrefix"
                  checked={addDeviceNameAsPrefix}
                  onCheckedChange={(checked) =>
                    setAddDeviceNameAsPrefix(checked as boolean)
                  }
                />
                <Label htmlFor="addDeviceNameAsPrefix">
                  Add device name as prefix to IO tags
                </Label>
              </div>

              {/* Bulk Copy button */}
              <Button type="button" variant="outline" className="mt-2">
                Bulk Copy
              </Button>
            </div>

            {/* Extension Properties */}
            <div className="border rounded-md p-4">
              <h3 className="text-md font-medium mb-4">Extension Properties</h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Use ASCII Protocol */}
                <div className="space-y-2">
                  <Label htmlFor="useAsciiProtocol">Use ASCII Protocol</Label>
                  <Input
                    id="useAsciiProtocol"
                    type="number"
                    value={useAsciiProtocol}
                    onChange={(e) =>
                      setUseAsciiProtocol(Number(e.target.value))
                    }
                    min={0}
                  />
                </div>

                {/* Packet Delay */}
                <div className="space-y-2">
                  <Label htmlFor="packetDelay">Packet Delay (ms)</Label>
                  <Input
                    id="packetDelay"
                    type="number"
                    value={packetDelay}
                    onChange={(e) => setPacketDelay(Number(e.target.value))}
                    min={0}
                  />
                </div>

                {/* Digital block size */}
                <div className="space-y-2">
                  <Label htmlFor="digitalBlockSize">Digital block size</Label>
                  <Input
                    id="digitalBlockSize"
                    type="number"
                    value={digitalBlockSize}
                    onChange={(e) =>
                      setDigitalBlockSize(Number(e.target.value))
                    }
                    min={0}
                  />
                </div>

                {/* Analog block size */}
                <div className="space-y-2">
                  <Label htmlFor="analogBlockSize">Analog block size</Label>
                  <Input
                    id="analogBlockSize"
                    type="number"
                    value={analogBlockSize}
                    onChange={(e) => setAnalogBlockSize(Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Reset or cancel form
                if (onSubmit && existingConfig) {
                  onSubmit(existingConfig);
                }
              }}
            >
              {existingConfig ? "Discard Changes" : "Cancel"}
            </Button>
            <Button type="submit">
              {existingConfig ? "Apply Changes" : "Add Device"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
