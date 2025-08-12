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
  // SNMP extensions (optional to keep backward compatibility)
  snmpVersion: z.enum(["v1", "v2c", "v3"]).optional(),
  snmpTimeoutMs: z.coerce.number().int().min(100).max(60000).optional(),
  snmpRetries: z.coerce.number().int().min(0).max(5).optional(),
  readCommunity: z.string().optional(),
  // v3 specific
  snmpV3SecurityLevel: z.enum(["noAuthNoPriv", "authNoPriv", "authPriv"]).optional(),
  snmpV3Username: z.string().optional(),
  snmpV3AuthProtocol: z
    .enum(["MD5", "SHA1", "SHA224", "SHA256", "SHA384", "SHA512"])
    .optional(),
  snmpV3AuthPassword: z.string().optional(),
  snmpV3PrivProtocol: z
    .enum(["DES", "AES128", "AES192", "AES256"])
    .optional(),
  snmpV3PrivPassword: z.string().optional(),
  snmpV3ContextName: z.string().optional(),
  snmpV3ContextEngineId: z.string().optional(),
  // Advanced
  snmpMaxPduSize: z.coerce.number().int().min(484).max(65535).optional(),
  snmpBulkNonRepeaters: z.coerce.number().int().min(0).max(10).optional(),
  snmpBulkMaxRepetitions: z.coerce.number().int().min(1).max(50).optional(),
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
  community?: string; // For SNMP
  // SNMP extensions (frontend-only for now)
  snmpVersion?: "v1" | "v2c" | "v3";
  snmpTimeoutMs?: number;
  snmpRetries?: number;
  readCommunity?: string; // kept separate for clarity; `community` maintained for backend compat
  // v3 specific
  snmpV3SecurityLevel?: "noAuthNoPriv" | "authNoPriv" | "authPriv";
  snmpV3Username?: string;
  snmpV3AuthProtocol?: "MD5" | "SHA1" | "SHA224" | "SHA256" | "SHA384" | "SHA512";
  snmpV3AuthPassword?: string;
  snmpV3PrivProtocol?: "DES" | "AES128" | "AES192" | "AES256";
  snmpV3PrivPassword?: string;
  snmpV3ContextName?: string;
  snmpV3ContextEngineId?: string;
  // Advanced
  snmpMaxPduSize?: number;
  snmpBulkNonRepeaters?: number;
  snmpBulkMaxRepetitions?: number;
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
  const [community, setCommunity] = useState(existingConfig?.community || "public");
  // SNMP: extended fields
  const [snmpVersion, setSnmpVersion] = useState<"v1" | "v2c" | "v3">(
    (existingConfig?.snmpVersion as any) || "v2c"
  );
  const [snmpTimeoutMs, setSnmpTimeoutMs] = useState<number>(
    existingConfig?.snmpTimeoutMs ?? 2000
  );
  const [snmpRetries, setSnmpRetries] = useState<number>(
    existingConfig?.snmpRetries ?? 1
  );
  // v3
  const [snmpV3SecurityLevel, setSnmpV3SecurityLevel] = useState<
    "noAuthNoPriv" | "authNoPriv" | "authPriv"
  >((existingConfig?.snmpV3SecurityLevel as any) || "noAuthNoPriv");
  const [snmpV3Username, setSnmpV3Username] = useState<string>(
    existingConfig?.snmpV3Username || ""
  );
  const [snmpV3AuthProtocol, setSnmpV3AuthProtocol] = useState<
    "MD5" | "SHA1" | "SHA224" | "SHA256" | "SHA384" | "SHA512" | ""
  >(((existingConfig?.snmpV3AuthProtocol as any) || "") as any);
  const [snmpV3AuthPassword, setSnmpV3AuthPassword] = useState<string>(
    existingConfig?.snmpV3AuthPassword || ""
  );
  const [snmpV3PrivProtocol, setSnmpV3PrivProtocol] = useState<
    "DES" | "AES128" | "AES192" | "AES256" | ""
  >(((existingConfig?.snmpV3PrivProtocol as any) || "") as any);
  const [snmpV3PrivPassword, setSnmpV3PrivPassword] = useState<string>(
    existingConfig?.snmpV3PrivPassword || ""
  );
  const [snmpV3ContextName, setSnmpV3ContextName] = useState<string>(
    existingConfig?.snmpV3ContextName || ""
  );
  const [snmpV3ContextEngineId, setSnmpV3ContextEngineId] = useState<string>(
    existingConfig?.snmpV3ContextEngineId || ""
  );
  // Advanced
  const [snmpMaxPduSize, setSnmpMaxPduSize] = useState<number>(
    existingConfig?.snmpMaxPduSize ?? 1400
  );
  const [snmpBulkNonRepeaters, setSnmpBulkNonRepeaters] = useState<number>(
    existingConfig?.snmpBulkNonRepeaters ?? 0
  );
  const [snmpBulkMaxRepetitions, setSnmpBulkMaxRepetitions] = useState<number>(
    existingConfig?.snmpBulkMaxRepetitions ?? 10
  );
  const [showSnmpAdvanced, setShowSnmpAdvanced] = useState<boolean>(false);
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

  // 3. Autofill defaults when switching device types
  useEffect(() => {
    if (
      deviceType === "Modbus TCP" &&
      (!existingConfig || existingConfig.deviceType !== "Modbus TCP")
    ) {
      setIpAddress("11.0.0.1");
      setPortNumber(502);
    } else if (
      deviceType === "SNMP" &&
      (!existingConfig || existingConfig.deviceType !== "SNMP")
    ) {
      setIpAddress("192.168.1.1");
      setPortNumber(161);
      setCommunity("public");
      setSnmpVersion("v2c");
      setSnmpTimeoutMs(2000);
      setSnmpRetries(1);
      setSnmpV3SecurityLevel("noAuthNoPriv");
      setSnmpV3Username("");
      setSnmpV3AuthProtocol("");
      setSnmpV3AuthPassword("");
      setSnmpV3PrivProtocol("");
      setSnmpV3PrivPassword("");
      setSnmpV3ContextName("");
      setSnmpV3ContextEngineId("");
      setSnmpMaxPduSize(1400);
      setSnmpBulkNonRepeaters(0);
      setSnmpBulkMaxRepetitions(10);
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

    // --- Unit Number validation (skip for SNMP) ---
    if (deviceType !== "SNMP" && (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 247)) {
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

    // --- SNMP validations ---
    if (deviceType === "SNMP") {
      if (!ipAddress || portNumber < 1 || portNumber > 65535) {
        toast.error("Provide a valid IP and port (1-65535) for SNMP.");
        return;
      }
      if (!Number.isInteger(snmpTimeoutMs) || snmpTimeoutMs < 100 || snmpTimeoutMs > 60000) {
        toast.error("SNMP timeout must be between 100 and 60000 ms.");
        return;
      }
      if (!Number.isInteger(snmpRetries) || snmpRetries < 0 || snmpRetries > 5) {
        toast.error("SNMP retries must be between 0 and 5.");
        return;
      }
      if (snmpVersion === "v1" || snmpVersion === "v2c") {
        if (!community?.trim()) {
          toast.error("Community is required for SNMP v1/v2c.");
          return;
        }
      } else if (snmpVersion === "v3") {
        if (!snmpV3Username.trim()) {
          toast.error("SNMPv3 username is required.");
          return;
        }
        if (snmpV3SecurityLevel === "authNoPriv" || snmpV3SecurityLevel === "authPriv") {
          if (!snmpV3AuthProtocol || !snmpV3AuthPassword || snmpV3AuthPassword.length < 8) {
            toast.error("Auth protocol and password (min 8 chars) are required for auth* levels.");
            return;
          }
        }
        if (snmpV3SecurityLevel === "authPriv") {
          if (!snmpV3PrivProtocol || !snmpV3PrivPassword || snmpV3PrivPassword.length < 8) {
            toast.error("Privacy protocol and password (min 8 chars) are required for authPriv.");
            return;
          }
        }
      }
      if (snmpMaxPduSize < 484 || snmpMaxPduSize > 65535) {
        toast.error("SNMP Max PDU size must be between 484 and 65535.");
        return;
      }
      if (snmpBulkNonRepeaters < 0 || snmpBulkNonRepeaters > 10) {
        toast.error("SNMP Non-repeaters must be between 0 and 10.");
        return;
      }
      if (snmpBulkMaxRepetitions < 1 || snmpBulkMaxRepetitions > 50) {
        toast.error("SNMP Max-repetitions must be between 1 and 50.");
        return;
      }
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

    // --- Unit number conflict check (skip for SNMP) ---
    if (deviceType !== "SNMP") {
      const unitConflict = thisPort.devices.some(
        (d) => d.unitNumber === unitNumber && d.id !== existingConfig?.id
      );

      if (unitConflict) {
        toast.error(`Unit number ${unitNumber} is already in use on this port.`, {
          duration: 5000,
        });
        return;
      }
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
        : deviceType === "SNMP"
        ? {
            ipAddress,
            portNumber,
            // maintain `community` for current backend compatibility (v1/v2c)
            community: snmpVersion === "v3" ? "" : community,
            // store extended SNMP config in the device
            snmpVersion,
            snmpTimeoutMs,
            snmpRetries,
            readCommunity: snmpVersion === "v3" ? undefined : community,
            snmpV3SecurityLevel,
            snmpV3Username,
            snmpV3AuthProtocol: snmpV3SecurityLevel !== "noAuthNoPriv" ? (snmpV3AuthProtocol || undefined) : undefined,
            snmpV3AuthPassword: snmpV3SecurityLevel !== "noAuthNoPriv" ? (snmpV3AuthPassword || undefined) : undefined,
            snmpV3PrivProtocol: snmpV3SecurityLevel === "authPriv" ? (snmpV3PrivProtocol || undefined) : undefined,
            snmpV3PrivPassword: snmpV3SecurityLevel === "authPriv" ? (snmpV3PrivPassword || undefined) : undefined,
            snmpV3ContextName: snmpV3ContextName || undefined,
            snmpV3ContextEngineId: snmpV3ContextEngineId || undefined,
            snmpMaxPduSize,
            snmpBulkNonRepeaters,
            snmpBulkMaxRepetitions,
          }
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
        setCommunity("public");
        setSnmpVersion("v2c");
        setSnmpTimeoutMs(2000);
        setSnmpRetries(1);
        setSnmpV3SecurityLevel("noAuthNoPriv");
        setSnmpV3Username("");
        setSnmpV3AuthProtocol("");
        setSnmpV3AuthPassword("");
        setSnmpV3PrivProtocol("");
        setSnmpV3PrivPassword("");
        setSnmpV3ContextName("");
        setSnmpV3ContextEngineId("");
        setSnmpMaxPduSize(1400);
        setSnmpBulkNonRepeaters(0);
        setSnmpBulkMaxRepetitions(10);
      }
    }
  };

  // 4. Add 'Modbus TCP' to DEVICE_TYPES
  const DEVICE_TYPES = [
    "Modbus RTU",
    "Modbus TCP",
    "SNMP",
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
              {/* Modbus TCP and SNMP fields */}
              {(deviceType === "Modbus TCP" || deviceType === "SNMP") && (
                <div className="space-y-4 mb-4">
                  <div className={`grid ${deviceType === "SNMP" ? "grid-cols-3" : "grid-cols-2"} gap-4`}>
                    <div className="space-y-2">
                      <Label htmlFor="ipAddress">IP Address</Label>
                      <Input
                        id="ipAddress"
                        value={ipAddress}
                        onChange={(e) => setIpAddress(e.target.value)}
                        placeholder={deviceType === "SNMP" ? "192.168.1.1" : "11.0.0.1"}
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
                        placeholder={deviceType === "SNMP" ? "161" : "502"}
                      />
                    </div>
                    {deviceType === "SNMP" && snmpVersion !== "v3" && (
                      <div className="space-y-2">
                        <Label htmlFor="community">Community</Label>
                        <Input
                          id="community"
                          value={community}
                          onChange={(e) => setCommunity(e.target.value)}
                          placeholder="public"
                        />
                      </div>
                    )}
                  </div>

                  {deviceType === "SNMP" && (
                    <div className="space-y-4 border rounded-md p-4">
                      <h4 className="text-sm font-medium">SNMP Settings</h4>

                      {/* Version, Timeout, Retries */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="snmpVersion">Version</Label>
                          <Select value={snmpVersion} onValueChange={(v) => setSnmpVersion(v as any)}>
                            <SelectTrigger id="snmpVersion">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="v1">v1</SelectItem>
                              <SelectItem value="v2c">v2c</SelectItem>
                              <SelectItem value="v3">v3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="snmpTimeoutMs">Timeout (ms)</Label>
                          <Input
                            id="snmpTimeoutMs"
                            type="number"
                            value={snmpTimeoutMs}
                            onChange={(e) => setSnmpTimeoutMs(Number(e.target.value))}
                            min={100}
                            max={60000}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="snmpRetries">Retries</Label>
                          <Input
                            id="snmpRetries"
                            type="number"
                            value={snmpRetries}
                            onChange={(e) => setSnmpRetries(Number(e.target.value))}
                            min={0}
                            max={5}
                          />
                        </div>
                      </div>

                      {/* v3 Security */}
                      {snmpVersion === "v3" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="snmpV3SecurityLevel">Security Level</Label>
                              <Select value={snmpV3SecurityLevel} onValueChange={(v) => setSnmpV3SecurityLevel(v as any)}>
                                <SelectTrigger id="snmpV3SecurityLevel">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="noAuthNoPriv">noAuthNoPriv</SelectItem>
                                  <SelectItem value="authNoPriv">authNoPriv</SelectItem>
                                  <SelectItem value="authPriv">authPriv</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="snmpV3Username">Username</Label>
                              <Input
                                id="snmpV3Username"
                                value={snmpV3Username}
                                onChange={(e) => setSnmpV3Username(e.target.value)}
                              />
                            </div>
                          </div>

                          {(snmpV3SecurityLevel === "authNoPriv" || snmpV3SecurityLevel === "authPriv") && (
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="snmpV3AuthProtocol">Auth Protocol</Label>
                                <Select value={snmpV3AuthProtocol || ""} onValueChange={(v) => setSnmpV3AuthProtocol(v as any)}>
                                  <SelectTrigger id="snmpV3AuthProtocol">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="MD5">MD5</SelectItem>
                                    <SelectItem value="SHA1">SHA1</SelectItem>
                                    <SelectItem value="SHA224">SHA224</SelectItem>
                                    <SelectItem value="SHA256">SHA256</SelectItem>
                                    <SelectItem value="SHA384">SHA384</SelectItem>
                                    <SelectItem value="SHA512">SHA512</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="snmpV3AuthPassword">Auth Password</Label>
                                <Input
                                  id="snmpV3AuthPassword"
                                  type="password"
                                  value={snmpV3AuthPassword}
                                  onChange={(e) => setSnmpV3AuthPassword(e.target.value)}
                                />
                              </div>
                            </div>
                          )}

                          {snmpV3SecurityLevel === "authPriv" && (
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="snmpV3PrivProtocol">Privacy Protocol</Label>
                                <Select value={snmpV3PrivProtocol || ""} onValueChange={(v) => setSnmpV3PrivProtocol(v as any)}>
                                  <SelectTrigger id="snmpV3PrivProtocol">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="DES">DES</SelectItem>
                                    <SelectItem value="AES128">AES128</SelectItem>
                                    <SelectItem value="AES192">AES192</SelectItem>
                                    <SelectItem value="AES256">AES256</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="snmpV3PrivPassword">Privacy Password</Label>
                                <Input
                                  id="snmpV3PrivPassword"
                                  type="password"
                                  value={snmpV3PrivPassword}
                                  onChange={(e) => setSnmpV3PrivPassword(e.target.value)}
                                />
                              </div>
                            </div>
                          )}

                          {/* v3 Advanced */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="snmpV3ContextName">Context Name (optional)</Label>
                              <Input
                                id="snmpV3ContextName"
                                value={snmpV3ContextName}
                                onChange={(e) => setSnmpV3ContextName(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="snmpV3ContextEngineId">Context Engine ID (optional)</Label>
                              <Input
                                id="snmpV3ContextEngineId"
                                value={snmpV3ContextEngineId}
                                onChange={(e) => setSnmpV3ContextEngineId(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Advanced (common) */}
                      <div className="space-y-2">
                        <Button type="button" variant="outline" onClick={() => setShowSnmpAdvanced((s) => !s)}>
                          {showSnmpAdvanced ? "Hide Advanced" : "Show Advanced"}
                        </Button>
                        {showSnmpAdvanced && (
                          <div className="grid grid-cols-3 gap-4 mt-2">
                            <div className="space-y-2">
                              <Label htmlFor="snmpMaxPduSize">Max PDU Size</Label>
                              <Input
                                id="snmpMaxPduSize"
                                type="number"
                                value={snmpMaxPduSize}
                                onChange={(e) => setSnmpMaxPduSize(Number(e.target.value))}
                                min={484}
                                max={65535}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="snmpBulkNonRepeaters">GETBULK Non-repeaters</Label>
                              <Input
                                id="snmpBulkNonRepeaters"
                                type="number"
                                value={snmpBulkNonRepeaters}
                                onChange={(e) => setSnmpBulkNonRepeaters(Number(e.target.value))}
                                min={0}
                                max={10}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="snmpBulkMaxRepetitions">GETBULK Max-repetitions</Label>
                              <Input
                                id="snmpBulkMaxRepetitions"
                                type="number"
                                value={snmpBulkMaxRepetitions}
                                onChange={(e) => setSnmpBulkMaxRepetitions(Number(e.target.value))}
                                min={1}
                                max={50}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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

              {/* Unit Number - Hide for SNMP devices */}
              {deviceType !== "SNMP" && (
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
              )}

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
