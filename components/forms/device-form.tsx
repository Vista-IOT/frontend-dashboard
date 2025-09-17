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
    .max(255, "Unit number must be at most 255").optional(), // Optional since not all protocols need it
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
  opcuaServerUrl: z.string().optional(),
  opcuaEndpointSelection: z.string().optional(),
  opcuaSecurityMode: z.enum(["None", "Sign", "SignAndEncrypt"]).optional(),
  opcuaSecurityPolicy: z.string().optional(),
  opcuaAuthType: z.enum(["Anonymous", "UsernamePassword", "Certificate"]).optional(),
  opcuaUsername: z.string().optional(),
  // Note: do not attempt to store File objects here - store refs/ids instead
  opcuaClientCertRef: z.string().optional(),
  opcuaClientKeyRef: z.string().optional(),
  opcuaAcceptServerCert: z.enum(["auto", "prompt", "reject"]).optional(),
  opcuaSessionTimeout: z.coerce.number().int().min(0).optional(),
  opcuaRequestTimeout: z.coerce.number().int().min(0).optional(),
  opcuaKeepAliveInterval: z.coerce.number().int().min(0).optional(),
  opcuaReconnectRetries: z.coerce.number().int().min(0).optional(),
  opcuaPublishingInterval: z.coerce.number().int().min(0).optional(),
  opcuaSamplingInterval: z.coerce.number().int().min(0).optional(),
  opcuaQueueSize: z.coerce.number().int().min(0).optional(),
  opcuaDeadbandType: z.enum(["None", "Absolute", "Percent"]).optional(),
  opcuaDeadbandValue: z.coerce.number().optional(),
  // DNP3.0 extensions
  dnp3IpAddress: z.string().optional(),
  dnp3PortNumber: z.coerce.number().int().min(1).max(65535).optional(),
  dnp3LocalAddress: z.coerce.number().int().min(0).max(65535).optional(),
  dnp3RemoteAddress: z.coerce.number().int().min(0).max(65535).optional(),
  dnp3TimeoutMs: z.coerce.number().int().min(1000).max(30000).optional(),
  dnp3Retries: z.coerce.number().int().min(0).max(5).optional(),
  // IEC-104 extensions
  iec104IpAddress: z.string().optional(),
  iec104PortNumber: z.coerce.number().int().min(1).max(65535).optional(),
  iec104AsduAddress: z.coerce.number().int().min(1).max(65535).optional(),
  iec104T0: z.coerce.number().int().min(1).max(255).optional(),
  iec104T1: z.coerce.number().int().min(1).max(255).optional(),
  iec104T2: z.coerce.number().int().min(1).max(255).optional(),
  iec104T3: z.coerce.number().int().min(1).max(255).optional(),
  iec104K: z.coerce.number().int().min(1).max(32767).optional(),
  iec104W: z.coerce.number().int().min(1).max(32767).optional(),
  iec104CommonAddressLength: z.coerce.number().int().min(1).max(2).optional(),
  iec104InfoAddressLength: z.coerce.number().int().min(1).max(3).optional(),
  iec104TransmitCauseLength: z.coerce.number().int().min(1).max(2).optional(),
  iec104AsduDataLength: z.coerce.number().int().min(1).max(253).optional(),
  iec104TimeTag: z.enum(["cp56", "cp24", "cp32"]).optional(),
});

export interface DeviceConfig {
  id: string;
  enabled: boolean;
  name: string;
  deviceType: string;
  unitNumber?: number;
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
  opcuaServerUrl?: string; // For OPC UA
  opcuaEndpointSelection?: string;
  opcuaSecurityMode?: "None" | "Sign" | "SignAndEncrypt";
  opcuaSecurityPolicy?: string;
  opcuaAuthType?: "Anonymous" | "UsernamePassword" | "Certificate";
  opcuaUsername?: string;
  opcuaClientCertRef?: string;
  opcuaClientKeyRef?: string;
  opcuaAcceptServerCert?: "auto" | "prompt" | "reject";
  opcuaSessionTimeout?: number;
  opcuaRequestTimeout?: number;
  opcuaKeepAliveInterval?: number;
  opcuaReconnectRetries?: number;
  opcuaPublishingInterval?: number;
  opcuaSamplingInterval?: number;
  opcuaQueueSize?: number;
  opcuaDeadbandType?: "None" | "Absolute" | "Percent";
  opcuaDeadbandValue?: number;
  // DNP3.0 specific fields
  dnp3IpAddress?: string;
  dnp3PortNumber?: number;
  dnp3LocalAddress?: number;
  dnp3RemoteAddress?: number;
  dnp3TimeoutMs?: number;
  dnp3Retries?: number;
  // IEC-104 specific fields
  iec104IpAddress?: string;
  iec104PortNumber?: number;
  iec104AsduAddress?: number;
  iec104T0?: number;
  iec104T1?: number;
  iec104T2?: number;
  iec104T3?: number;
  iec104K?: number;
  iec104W?: number;
  iec104CommonAddressLength?: number;
  iec104InfoAddressLength?: number;
  iec104TransmitCauseLength?: number;
  iec104AsduDataLength?: number;
  iec104TimeTag?: string;
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
  const [unitNumber, setUnitNumber] = useState(existingConfig?.unitNumber);
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

  // 3. Add state for OPC UA fields
  const [opcuaServerUrl, setOpcuaServerUrl] = useState(
    existingConfig?.opcuaServerUrl || "opc.tcp://192.168.1.100:4840"
  );

  // --- NEW OPC UA state (security / auth / session / subscription / trust) ---
  const [opcuaEndpointSelection, setOpcuaEndpointSelection] = useState<string | null>(null);
  const [opcuaDiscoveredEndpoints, setOpcuaDiscoveredEndpoints] = useState<string[]>([]);
  const [opcuaSecurityMode, setOpcuaSecurityMode] = useState<"None"|"Sign"|"SignAndEncrypt">("None");
  const [opcuaSecurityPolicy, setOpcuaSecurityPolicy] = useState<string>("Basic256Sha256");
  const [opcuaAuthType, setOpcuaAuthType] = useState<"Anonymous"|"UsernamePassword"|"Certificate">("Anonymous");
  const [opcuaUsername, setOpcuaUsername] = useState<string>("");
  const [opcuaPassword, setOpcuaPassword] = useState<string>("");
  const [opcuaClientCert, setOpcuaClientCert] = useState<File | null>(null);
  const [opcuaClientKey, setOpcuaClientKey] = useState<File | null>(null);
  const [opcuaAcceptServerCert, setOpcuaAcceptServerCert] = useState<"auto"|"prompt"|"reject">("prompt");
  const [opcuaSessionTimeout, setOpcuaSessionTimeout] = useState<number>(60000);
  const [opcuaRequestTimeout, setOpcuaRequestTimeout] = useState<number>(5000);
  const [opcuaKeepAliveInterval, setOpcuaKeepAliveInterval] = useState<number>(10000);
  const [opcuaReconnectRetries, setOpcuaReconnectRetries] = useState<number>(3);
  const [opcuaPublishingInterval, setOpcuaPublishingInterval] = useState<number>(1000);
  const [opcuaSamplingInterval, setOpcuaSamplingInterval] = useState<number>(1000);
  const [opcuaQueueSize, setOpcuaQueueSize] = useState<number>(10);
  const [opcuaDeadbandType, setOpcuaDeadbandType] = useState<"None"|"Absolute"|"Percent">("None");
  const [opcuaDeadbandValue, setOpcuaDeadbandValue] = useState<number>(0);

  // DNP3.0 state fields
  const [dnp3IpAddress, setDnp3IpAddress] = useState(
    existingConfig?.dnp3IpAddress || "192.168.1.100"
  );
  const [dnp3PortNumber, setDnp3PortNumber] = useState(
    existingConfig?.dnp3PortNumber || 20000
  );
  const [dnp3LocalAddress, setDnp3LocalAddress] = useState(
    existingConfig?.dnp3LocalAddress || 1
  );
  const [dnp3RemoteAddress, setDnp3RemoteAddress] = useState(
    existingConfig?.dnp3RemoteAddress || 4
  );
  const [dnp3TimeoutMs, setDnp3TimeoutMs] = useState(
    existingConfig?.dnp3TimeoutMs || 5000
  );
  const [dnp3Retries, setDnp3Retries] = useState(
    existingConfig?.dnp3Retries || 3
  );

  // IEC-104 state fields
  const [iec104IpAddress, setIec104IpAddress] = useState(
    existingConfig?.iec104IpAddress || "192.168.1.100"
  );
  const [iec104PortNumber, setIec104PortNumber] = useState(
    existingConfig?.iec104PortNumber || 2404
  );
  const [iec104AsduAddress, setIec104AsduAddress] = useState(
    existingConfig?.iec104AsduAddress || 1
  );
  const [iec104T0, setIec104T0] = useState(
    existingConfig?.iec104T0 || 30
  );
  const [iec104T1, setIec104T1] = useState(
    existingConfig?.iec104T1 || 15
  );
  const [iec104T2, setIec104T2] = useState(
    existingConfig?.iec104T2 || 10
  );
  const [iec104T3, setIec104T3] = useState(
    existingConfig?.iec104T3 || 30
  );
  const [iec104K, setIec104K] = useState(
    existingConfig?.iec104K || 12
  );
  const [iec104W, setIec104W] = useState(
    existingConfig?.iec104W || 8
  );
  const [iec104CommonAddressLength, setIec104CommonAddressLength] = useState(
    existingConfig?.iec104CommonAddressLength || 2
  );
  const [iec104InfoAddressLength, setIec104InfoAddressLength] = useState(
    existingConfig?.iec104InfoAddressLength || 3
  );
  const [iec104TransmitCauseLength, setIec104TransmitCauseLength] = useState(
    existingConfig?.iec104TransmitCauseLength || 2
  );
  const [iec104AsduDataLength, setIec104AsduDataLength] = useState(
    existingConfig?.iec104AsduDataLength || 253
  );
  const [iec104TimeTag, setIec104TimeTag] = useState(
    existingConfig?.iec104TimeTag || "cp56"
  );

  // 3. Autofill defaults when switching device types
  useEffect(() => {
    if (
      deviceType === "Modbus RTU" &&
      (!existingConfig || existingConfig.deviceType !== "Modbus RTU")
    ) {
      // For new Modbus RTU devices, unitNumber is required (default to 1)
      if (!existingConfig) {
        setUnitNumber(1);
      }
    } else if (
      deviceType === "Modbus TCP" &&
      (!existingConfig || existingConfig.deviceType !== "Modbus TCP")
    ) {
      setIpAddress("11.0.0.1");
      setPortNumber(502);
      // For new Modbus TCP devices, unitNumber is optional (start as undefined)
      if (!existingConfig) {
        setUnitNumber(undefined);
      }
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
    } else if (
      deviceType === "OPC-UA" &&
      (!existingConfig || existingConfig.deviceType !== "OPC-UA" && existingConfig.deviceType !== "DNP3.0" && existingConfig.deviceType !== "IEC-104")
    ) {
      setOpcuaServerUrl("opc.tcp://192.168.1.100:4840");
    } else if (
      deviceType === "DNP3.0" &&
      (!existingConfig || existingConfig.deviceType !== "DNP3.0")
    ) {
      setDnp3IpAddress("192.168.1.100");
      setDnp3PortNumber(20000);
      setDnp3LocalAddress(1);
      setDnp3RemoteAddress(4);
    } else if (
      deviceType === "IEC-104" &&
      (!existingConfig || existingConfig.deviceType !== "IEC-104")
    ) {
      setIec104IpAddress("192.168.1.100");
      setIec104PortNumber(2404);
      setIec104AsduAddress(1);
      setIec104T0(30);
      setIec104T1(15);
      setIec104T2(10);
      setIec104T3(30);
      setIec104K(12);
      setIec104W(8);
      setIec104CommonAddressLength(2);
      setIec104InfoAddressLength(3);
      setIec104TransmitCauseLength(2);
      setIec104AsduDataLength(253);
      setIec104TimeTag("cp56");
      setDnp3TimeoutMs(5000);
      setDnp3Retries(3);
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

  const handleSubmit = async (e: React.FormEvent) => {
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

    // --- Unit Number validation - Required for Modbus RTU, optional for Modbus TCP ---
    if (deviceType === "Modbus RTU" || deviceType.includes("Modbus RTU")) {
      // Required for Modbus RTU
      if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 247) {
        toast.error("Unit number must be an integer between 1 and 247 for Modbus RTU.", {
          duration: 5000,
        });
        return;
      }
    } else if (deviceType === "Modbus TCP") {
      // Optional for Modbus TCP, but if provided must be valid
      if (unitNumber !== undefined && unitNumber !== null && unitNumber !== "" && (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 247)) {
        toast.error("Unit number, if provided, must be an integer between 1 and 247 for Modbus TCP.", {
          duration: 5000,
        });
        return;
      }
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

    // --- DNP3 validations ---
    if (deviceType === "DNP3.0") {
      if (!dnp3IpAddress || !/^(\d{1,3}\.){3}\d{1,3}$/.test(dnp3IpAddress)) {
        toast.error("Please provide a valid IP address for DNP3.");
        return;
      }
      if (!Number.isInteger(dnp3PortNumber) || dnp3PortNumber < 1 || dnp3PortNumber > 65535) {
        toast.error("DNP3 port must be between 1 and 65535.");
        return;
      }
      if (!Number.isInteger(dnp3LocalAddress) || dnp3LocalAddress < 0 || dnp3LocalAddress > 65535) {
        toast.error("DNP3 local address must be between 0 and 65535.");
        return;
      }
      if (!Number.isInteger(dnp3RemoteAddress) || dnp3RemoteAddress < 0 || dnp3RemoteAddress > 65535) {
        toast.error("DNP3 remote address must be between 0 and 65535.");
        return;
      }
      if (!Number.isInteger(dnp3TimeoutMs) || dnp3TimeoutMs < 1000 || dnp3TimeoutMs > 30000) {
        toast.error("DNP3 timeout must be between 1000 and 30000 ms.");
        return;
      }
      if (!Number.isInteger(dnp3Retries) || dnp3Retries < 0 || dnp3Retries > 5) {
        toast.error("DNP3 retries must be between 0 and 5.");
        return;
      }
    }

    // --- IEC-104 validations ---
    if (deviceType === "IEC-104") {
      if (!iec104IpAddress || !/^(\d{1,3}\.){3}\d{1,3}$/.test(iec104IpAddress)) {
        toast.error("Please provide a valid IP address for IEC-104.");
        return;
      }
      if (!Number.isInteger(iec104PortNumber) || iec104PortNumber < 1 || iec104PortNumber > 65535) {
        toast.error("IEC-104 port must be between 1 and 65535.");
        return;
      }
      if (!Number.isInteger(iec104AsduAddress) || iec104AsduAddress < 1 || iec104AsduAddress > 65535) {
        toast.error("IEC-104 ASDU address must be between 1 and 65535.");
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
    // Only check conflicts if unitNumber is provided and protocol uses unit numbers
    if (((deviceType === "Modbus RTU" || deviceType.includes("Modbus RTU")) || 
        (deviceType === "Modbus TCP" && unitNumber !== undefined && unitNumber !== null && unitNumber !== ""))) {
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

    // --- If OPC-UA and client certs present: upload certs and get refs ---
    let opcuaClientCertRef: string | undefined;
    let opcuaClientKeyRef: string | undefined;
    if (deviceType === "OPC-UA" && (opcuaClientCert || opcuaClientKey)) {
      const fd = new FormData();
      if (opcuaClientCert) fd.append("cert", opcuaClientCert);
      if (opcuaClientKey) fd.append("key", opcuaClientKey);
      try {
        const up = await fetch("/api/files/upload-opcua-cert", { method: "POST", body: fd });
        if (!up.ok) {
          toast.error("Certificate upload failed");
          return;
        }
        const uploaded = await up.json();
        opcuaClientCertRef = uploaded.certRef;
        opcuaClientKeyRef = uploaded.keyRef;
      } catch (err) {
        toast.error("Certificate upload failed");
        return;
      }
    }

    // --- Construct new device config ---
    const newDeviceConfig: DeviceConfig = {
      id: existingConfig?.id || `device-${Date.now()}`,
      enabled,
      name,
      deviceType,
      // Include unitNumber based on protocol requirements
      ...((deviceType === "Modbus RTU" || deviceType.includes("Modbus RTU")) 
          ? { unitNumber } 
          : (deviceType === "Modbus TCP" && unitNumber !== undefined && unitNumber !== null && unitNumber !== "") 
            ? { unitNumber } 
            : {}),
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
        : deviceType === "OPC-UA"
        ? {
            opcuaServerUrl,
            opcuaEndpointSelection: opcuaEndpointSelection || undefined,
            opcuaSecurityMode,
            opcuaSecurityPolicy,
            opcuaAuthType,
            opcuaUsername: opcuaAuthType === "UsernamePassword" ? opcuaUsername : undefined,
            // use uploaded cert refs (backend returns these IDs)
            opcuaClientCertRef: opcuaClientCertRef,
            opcuaClientKeyRef: opcuaClientKeyRef,
            opcuaAcceptServerCert,
            opcuaSessionTimeout,
            opcuaRequestTimeout,
            opcuaKeepAliveInterval,
            opcuaReconnectRetries,
            opcuaPublishingInterval,
            opcuaSamplingInterval,
            opcuaQueueSize,
            opcuaDeadbandType,
            opcuaDeadbandValue,
          }
        : deviceType === "DNP3.0"
        ? {
            dnp3IpAddress,
            dnp3PortNumber,
            dnp3LocalAddress,
            dnp3RemoteAddress,
            dnp3TimeoutMs,
            dnp3Retries,
          }
        : deviceType === "IEC-104"
        ? {
            iec104IpAddress,
            iec104PortNumber,
            iec104AsduAddress,
            iec104T0,
            iec104T1,
            iec104T2,
            iec104T3,
            iec104K,
            iec104W,
            iec104CommonAddressLength,
            iec104InfoAddressLength,
            iec104TransmitCauseLength,
            iec104AsduDataLength,
            iec104TimeTag,
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
        // For new Modbus TCP devices, unitNumber is optional (start as undefined)
        if (!existingConfig) {
          setUnitNumber(undefined);
        }
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
        setOpcuaServerUrl("opc.tcp://192.168.1.100:4840");
        setDnp3IpAddress("192.168.1.100");
        setDnp3PortNumber(20000);
        setDnp3LocalAddress(1);
        setDnp3RemoteAddress(4);
        setDnp3TimeoutMs(5000);
        setDnp3Retries(3);
      }
    }
  };

  // 4. Add 'Modbus TCP' to DEVICE_TYPES
  const DEVICE_TYPES = [
    "Modbus RTU",
    "Modbus TCP",
    "SNMP",
    "OPC-UA",
    "DNP3.0",
    "IEC-104",
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

  // Derived: map community to a select-friendly value for v1/v2c
  const communitySelectValue =
    community === "public" || community === "private" ? community : "custom";

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
              {/* Modbus TCP, SNMP, and OPC UA fields */}
              {(deviceType === "Modbus TCP" || deviceType === "SNMP" || deviceType === "OPC-UA" || deviceType === "DNP3.0" || deviceType === "IEC-104") && (
                <div className="space-y-4 mb-4">
                  <div className={`grid ${deviceType === "SNMP" ? "grid-cols-3" : deviceType === "OPC-UA" ? "grid-cols-1" : "grid-cols-2"} gap-4`}>
                    {deviceType !== "OPC-UA" && deviceType !== "DNP3.0" && deviceType !== "IEC-104" && (
                      <>
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
                      </>
                    )}
                    {deviceType === "OPC-UA" && (
                      <div className="p-3 border rounded-md bg-gray-50/40 space-y-3">
                        {/* Connection row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          <div className="sm:col-span-2">
                            <Label htmlFor="opcuaServerUrl">Server URL</Label>
                            <Input
                              id="opcuaServerUrl"
                              value={opcuaServerUrl}
                              onChange={(e) => setOpcuaServerUrl(e.target.value)}
                              placeholder="opc.tcp://192.168.1.100:4840"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Enter endpoint or use Discover to fetch endpoints from the server.</p>
                          </div>
                          <div className="flex gap-2">
                            
                          </div>
                          
                        </div>

                        <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const res = await fetch('/api/opcua/discover', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ url: opcuaServerUrl }),
                                  });
                                  const response = await res.json();
                                  if (response.success && response.data?.endpoints) {
                                    setOpcuaDiscoveredEndpoints(response.data.endpoints);
                                    toast.success("Endpoints discovered");
                                  } else {
                                    toast.error(response.error || "Endpoint discovery failed");
                                  }
                                } catch {
                                  toast.error("Endpoint discovery failed");
                                }
                              }}
                            >
                              Discover
                            </Button>

                        {/* Endpoint selection */}
                        <div className="space-y-1">
                          <Label>Endpoint</Label>
                          <Select
                            value={opcuaEndpointSelection ?? "USE_SERVER_URL"}
                            onValueChange={(v) =>
                              setOpcuaEndpointSelection(v === "USE_SERVER_URL" ? null : v)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Use Server URL" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USE_SERVER_URL">Use Server URL</SelectItem>
                              {opcuaDiscoveredEndpoints.map((ep: string) => (
                                <SelectItem key={ep} value={ep}>
                                  {ep}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Grouped settings */}
                        
                        <div className="space-y-1">
                          <Label>Security & Authentication</Label>
                          {/* Security & Authentication (stacked) */}
                          
                              
                              
                          <div className="p-3 border rounded">
                            
                            <div className="mt-3 space-y-3">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Select value={opcuaSecurityMode} onValueChange={(v) => setOpcuaSecurityMode(v as any)}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Security Mode" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="None">None</SelectItem>
                                    <SelectItem value="Sign">Sign</SelectItem>
                                    <SelectItem value="SignAndEncrypt">Sign And Encrypt</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Select value={opcuaSecurityPolicy} onValueChange={setOpcuaSecurityPolicy}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Security Policy" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Basic128Rsa15">Basic128Rsa15</SelectItem>
                                    <SelectItem value="Basic256">Basic256</SelectItem>
                                    <SelectItem value="Basic256Sha256">Basic256Sha256</SelectItem>
                                    <SelectItem value="None">None</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Authentication Type</Label>
                                <Select value={opcuaAuthType} onValueChange={(v) => setOpcuaAuthType(v as any)}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Authentication Type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Anonymous">Anonymous</SelectItem>
                                    <SelectItem value="UsernamePassword">Username / Password</SelectItem>
                                    <SelectItem value="Certificate">Certificate</SelectItem>
                                  </SelectContent>
                                </Select>

                                {opcuaAuthType === "UsernamePassword" && (
                                  <div className="mt-2 grid grid-cols-1 gap-2">
                                    <Input placeholder="Username" value={opcuaUsername} onChange={(e) => setOpcuaUsername(e.target.value)} />
                                    <Input placeholder="Password" type="password" value={opcuaPassword} onChange={(e) => setOpcuaPassword(e.target.value)} />
                                  </div>
                                )}

                                {opcuaAuthType === "Certificate" && (
                                  <div className="mt-2 grid grid-cols-1 gap-2">
                                    <div className="flex flex-col">
                                      <Label className="text-xs">Client Certificate (.pem/.crt)</Label>
                                      <input type="file" accept=".pem,.crt" onChange={(e) => setOpcuaClientCert(e.target.files?.[0] ?? null)} />
                                    </div>
                                    <div className="flex flex-col">
                                      <Label className="text-xs">Client Key (.key/.pfx)</Label>
                                      <input type="file" accept=".pem,.key,.pfx" onChange={(e) => setOpcuaClientKey(e.target.files?.[0] ?? null)} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Server Trust (stacked below security) */}
                          <div className="mt-6 space-y-2">
                            <Label>Server Trust</Label> 
                          <div className="p-3 border rounded">
                          
                            <div className="mt-3 space-y-1">
                              <div>
                                <Label>Trust Policy</Label>
                                <Select value={opcuaAcceptServerCert} onValueChange={(v) => setOpcuaAcceptServerCert(v as any)}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Trust Policy" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="prompt">Prompt to Trust</SelectItem>
                                    <SelectItem value="auto">Auto Accept</SelectItem>
                                    <SelectItem value="reject">Reject Untrusted</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Server certificate fingerprint will appear here after discovery or test connection.
                              </div>
                              <div className="text-xs break-all"> {/* placeholder for fingerprint */}
                                {/** show fingerprint when available: e.g. opcuaServerCertFingerprint */}
                              </div>
                            </div>
                          </div>
                          </div>
                        </div>



                        {/* Session & Subscription */}
                        <div className="space-y-4">
                          <div className="p-3 border rounded">
                            <h4 className="text-sm font-medium">Session / Timeouts</h4>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Input type="number" value={opcuaSessionTimeout} onChange={(e) => setOpcuaSessionTimeout(Number(e.target.value))} placeholder="Session (ms)" />
                              <Input type="number" value={opcuaRequestTimeout} onChange={(e) => setOpcuaRequestTimeout(Number(e.target.value))} placeholder="Request (ms)" />
                              <Input type="number" value={opcuaKeepAliveInterval} onChange={(e) => setOpcuaKeepAliveInterval(Number(e.target.value))} placeholder="KeepAlive (ms)" />
                              <Input type="number" value={opcuaReconnectRetries} onChange={(e) => setOpcuaReconnectRetries(Number(e.target.value))} placeholder="Reconnect tries" />
                            </div>
                          </div>

                          <div className="p-3 border rounded">
                            <h4 className="text-sm font-medium">Subscription Defaults</h4>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Input type="number" value={opcuaPublishingInterval} onChange={(e) => setOpcuaPublishingInterval(Number(e.target.value))} placeholder="Publishing (ms)" />
                              <Input type="number" value={opcuaSamplingInterval} onChange={(e) => setOpcuaSamplingInterval(Number(e.target.value))} placeholder="Sampling (ms)" />
                              <Input type="number" value={opcuaQueueSize} onChange={(e) => setOpcuaQueueSize(Number(e.target.value))} placeholder="Queue size" />
                              <div>
                                <Label className="sr-only">Deadband</Label>
                                <Select value={opcuaDeadbandType} onValueChange={(v) => setOpcuaDeadbandType(v as any)}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Deadband" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="None">None</SelectItem>
                                    <SelectItem value="Absolute">Absolute</SelectItem>
                                    <SelectItem value="Percent">Percent</SelectItem>
                                  </SelectContent>
                                </Select>
                                {opcuaDeadbandType !== "None" && (
                                  <Input className="mt-2" type="number" value={opcuaDeadbandValue} onChange={(e) => setOpcuaDeadbandValue(Number(e.target.value))} placeholder="Deadband value" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                const body = {
                                  url: opcuaEndpointSelection || opcuaServerUrl,
                                  endpointSelection: opcuaEndpointSelection,
                                  securityMode: opcuaSecurityMode,
                                  securityPolicy: opcuaSecurityPolicy,
                                  authType: opcuaAuthType,
                                  username: opcuaAuthType === "UsernamePassword" ? opcuaUsername : undefined,
                                  password: opcuaAuthType === "UsernamePassword" ? opcuaPassword : undefined,
                                  sessionTimeout: opcuaSessionTimeout,
                                  requestTimeout: opcuaRequestTimeout,
                                };
                                const res = await fetch("/api/opcua/test-connection", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(body),
                                });
                                const response = await res.json();
                                if (response.success) {
                                  toast.success("Test connection succeeded");
                                } else {
                                  toast.error(response.error || "Test connection failed");
                                }
                              } catch {
                                toast.error("Test connection failed");
                              }
                            }}
                          >
                            Test Connection
                          </Button>

                          <Button type="button" variant="outline" onClick={() => {
                            setOpcuaSecurityMode("None");
                            setOpcuaSecurityPolicy("Basic256Sha256");
                            setOpcuaAuthType("Anonymous");
                          }}>
                            Reset
                          </Button>
                        </div>
                      </div>
                    )}
                    {deviceType === "SNMP" && snmpVersion !== "v3" && (
                      <div className="space-y-2">
                        <Label htmlFor="community">Community</Label>
                        <Select
                          value={communitySelectValue}
                          onValueChange={(v) => {
                            if (v === "custom") {
                              // Preserve existing custom value or clear for user input
                              if (community === "public" || community === "private") {
                                setCommunity("");
                              }
                            } else {
                              setCommunity(v);
                            }
                          }}
                        >
                          <SelectTrigger id="community">
                            <SelectValue placeholder="Select community" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">public</SelectItem>
                            <SelectItem value="private">private</SelectItem>
                            <SelectItem value="custom">Custom...</SelectItem>
                          </SelectContent>
                        </Select>
                        {communitySelectValue === "custom" && (
                          <Input
                            id="community-custom"
                            value={community}
                            onChange={(e) => setCommunity(e.target.value)}
                            placeholder="Enter custom community"
                          />
                        )}
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

                  {deviceType === "DNP3.0" && (
                    <div className="space-y-4 border rounded-md p-4">
                      <h4 className="text-sm font-medium">DNP3 Configuration</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dnp3IpAddress">IP Address</Label>
                          <Input
                            id="dnp3IpAddress"
                            value={dnp3IpAddress}
                            onChange={(e) => setDnp3IpAddress(e.target.value)}
                            placeholder="192.168.1.100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dnp3PortNumber">Port Number</Label>
                          <Input
                            id="dnp3PortNumber"
                            type="number"
                            value={dnp3PortNumber}
                            onChange={(e) => setDnp3PortNumber(Number(e.target.value))}
                            min={1}
                            max={65535}
                            placeholder="20000"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dnp3LocalAddress">Local Address (Master)</Label>
                          <Input
                            id="dnp3LocalAddress"
                            type="number"
                            value={dnp3LocalAddress}
                            onChange={(e) => setDnp3LocalAddress(Number(e.target.value))}
                            min={0}
                            max={65535}
                            placeholder="1"
                          />
                          <p className="text-xs text-muted-foreground">DNP3 Master station address</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dnp3RemoteAddress">Remote Address (Slave)</Label>
                          <Input
                            id="dnp3RemoteAddress"
                            type="number"
                            value={dnp3RemoteAddress}
                            onChange={(e) => setDnp3RemoteAddress(Number(e.target.value))}
                            min={0}
                            max={65535}
                            placeholder="4"
                          />
                          <p className="text-xs text-muted-foreground">DNP3 Outstation (slave) address</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dnp3TimeoutMs">Timeout (ms)</Label>
                          <Input
                            id="dnp3TimeoutMs"
                            type="number"
                            value={dnp3TimeoutMs}
                            onChange={(e) => setDnp3TimeoutMs(Number(e.target.value))}
                            min={1000}
                            max={30000}
                            placeholder="5000"
                          />
                          <p className="text-xs text-muted-foreground">Response timeout in milliseconds</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dnp3Retries">Retries</Label>
                          <Input
                            id="dnp3Retries"
                            type="number"
                            value={dnp3Retries}
                            onChange={(e) => setDnp3Retries(Number(e.target.value))}
                            min={0}
                            max={5}
                            placeholder="3"
                          />
                          <p className="text-xs text-muted-foreground">Number of retry attempts on failure</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={async () => {
                            // Test DNP3 connection functionality can be added here
                            toast.success("DNP3 Test Connection - Not implemented yet");
                          }}
                        >
                          Test Connection
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setDnp3IpAddress("192.168.1.100");
                            setDnp3PortNumber(20000);
                            setDnp3LocalAddress(1);
                            setDnp3RemoteAddress(4);
                            setDnp3TimeoutMs(5000);
                            setDnp3Retries(3);
                          }}
                        >
                          Reset to Defaults
                        </Button>
                      </div>
                    </div>
                  )}

                  {deviceType === "IEC-104" && (
                    <div className="space-y-4 border rounded-md p-4">
                      <h4 className="text-sm font-medium">IEC-104 Configuration</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="iec104IpAddress">IP Address</Label>
                          <Input
                            id="iec104IpAddress"
                            value={iec104IpAddress}
                            onChange={(e) => setIec104IpAddress(e.target.value)}
                            placeholder="192.168.1.100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="iec104PortNumber">Port Number</Label>
                          <Input
                            id="iec104PortNumber"
                            type="number"
                            value={iec104PortNumber}
                            onChange={(e) => setIec104PortNumber(Number(e.target.value))}
                            min={1}
                            max={65535}
                          />
                          <p className="text-xs text-muted-foreground">Default: 2404</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="iec104AsduAddress">ASDU Address</Label>
                          <Input
                            id="iec104AsduAddress"
                            type="number"
                            value={iec104AsduAddress}
                            onChange={(e) => setIec104AsduAddress(Number(e.target.value))}
                            min={1}
                            max={65535}
                          />
                          <p className="text-xs text-muted-foreground">Common Address of ASDU</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="iec104TimeTag">Time Tag</Label>
                          <Select value={iec104TimeTag} onValueChange={setIec104TimeTag}>
                            <SelectTrigger id="iec104TimeTag">
                              <SelectValue placeholder="Select time tag" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cp56">CP56 Time2a</SelectItem>
                              <SelectItem value="cp24">CP24 Time</SelectItem>
                              <SelectItem value="cp32">CP32 Time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h5 className="text-sm font-medium">Time Parameters</h5>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="iec104T0">t0 (s)</Label>
                            <Input
                              id="iec104T0"
                              type="number"
                              value={iec104T0}
                              onChange={(e) => setIec104T0(Number(e.target.value))}
                              min={1}
                              max={255}
                            />
                            <p className="text-xs text-muted-foreground">Connection timeout</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="iec104T1">t1 (s)</Label>
                            <Input
                              id="iec104T1"
                              type="number"
                              value={iec104T1}
                              onChange={(e) => setIec104T1(Number(e.target.value))}
                              min={1}
                              max={255}
                            />
                            <p className="text-xs text-muted-foreground">Send or test timeout</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="iec104T2">t2 (s)</Label>
                            <Input
                              id="iec104T2"
                              type="number"
                              value={iec104T2}
                              onChange={(e) => setIec104T2(Number(e.target.value))}
                              min={1}
                              max={255}
                            />
                            <p className="text-xs text-muted-foreground">Receive timeout</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="iec104T3">t3 (s)</Label>
                            <Input
                              id="iec104T3"
                              type="number"
                              value={iec104T3}
                              onChange={(e) => setIec104T3(Number(e.target.value))}
                              min={1}
                              max={255}
                            />
                            <p className="text-xs text-muted-foreground">Test frame timeout</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="iec104K">k (APDUs)</Label>
                            <Input
                              id="iec104K"
                              type="number"
                              value={iec104K}
                              onChange={(e) => setIec104K(Number(e.target.value))}
                              min={1}
                              max={32767}
                            />
                            <p className="text-xs text-muted-foreground">Max APDUs before ack</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="iec104W">w (APDUs)</Label>
                            <Input
                              id="iec104W"
                              type="number"
                              value={iec104W}
                              onChange={(e) => setIec104W(Number(e.target.value))}
                              min={1}
                              max={32767}
                            />
                            <p className="text-xs text-muted-foreground">Latest ack after w APDUs</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h5 className="text-sm font-medium">ASDU Parameters</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="iec104CommonAddressLength">Common Address Length</Label>
                            <Input
                              id="iec104CommonAddressLength"
                              type="number"
                              value={iec104CommonAddressLength}
                              onChange={(e) => setIec104CommonAddressLength(Number(e.target.value))}
                              min={1}
                              max={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="iec104InfoAddressLength">Info Address Length</Label>
                            <Input
                              id="iec104InfoAddressLength"
                              type="number"
                              value={iec104InfoAddressLength}
                              onChange={(e) => setIec104InfoAddressLength(Number(e.target.value))}
                              min={1}
                              max={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="iec104TransmitCauseLength">Transmit Cause Length</Label>
                            <Input
                              id="iec104TransmitCauseLength"
                              type="number"
                              value={iec104TransmitCauseLength}
                              onChange={(e) => setIec104TransmitCauseLength(Number(e.target.value))}
                              min={1}
                              max={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="iec104AsduDataLength">ASDU Data Length</Label>
                            <Input
                              id="iec104AsduDataLength"
                              type="number"
                              value={iec104AsduDataLength}
                              onChange={(e) => setIec104AsduDataLength(Number(e.target.value))}
                              min={1}
                              max={253}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            toast.success("IEC-104 Test Connection - Not implemented yet");
                          }}
                        >
                          Test Connection
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIec104IpAddress("192.168.1.100");
                            setIec104PortNumber(2404);
                            setIec104AsduAddress(1);
                            setIec104T0(30);
                            setIec104T1(15);
                            setIec104T2(10);
                            setIec104T3(30);
                            setIec104K(12);
                            setIec104W(8);
                            setIec104CommonAddressLength(2);
                            setIec104InfoAddressLength(3);
                            setIec104TransmitCauseLength(2);
                            setIec104AsduDataLength(253);
                            setIec104TimeTag("cp56");
                          }}
                        >
                          Reset to Defaults
                        </Button>
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

              {/* Unit Number - show for Modbus devices with different requirements */}
              {(deviceType === "Modbus RTU" || deviceType === "Modbus TCP") && (
                <div className="space-y-2 mb-4">
                  <Label htmlFor="unitNumber">
                    Unit Number
                    {deviceType === "Modbus RTU" && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                    {deviceType === "Modbus TCP" && (
                      <span className="text-gray-500 ml-1">(optional)</span>
                    )}
                  </Label>
                  <Input
                    id="unitNumber"
                    type="number"
                    value={unitNumber || ""}
                    onChange={(e) => setUnitNumber(e.target.value === "" ? undefined : Number(e.target.value))}
                    min={1}
                    max={247}
                    placeholder={
                      deviceType === "Modbus TCP" 
                        ? "Leave empty if not needed" 
                        : ""
                    }
                  />
                  <p className="text-xs text-gray-500">
                    {deviceType === "Modbus RTU" 
                      ? "Required for Modbus RTU communication"
                      : "Optional for Modbus TCP - can be left empty"
                    }
                  </p>
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
