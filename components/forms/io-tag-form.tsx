"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useConfigStore } from "@/lib/stores/configuration-store";
import type { DeviceConfig } from "./device-form"; // Import consolidated types. IOTag is part of DeviceConfig.
import { toast } from "sonner";

export interface SerialPortSettings {
  port: string;
  baudRate: number;
  dataBit: number;
  stopBit: number | string;
  parity: string;
  rts: boolean;
  dtr: boolean;
  enabled: boolean;
}

export interface IOPortConfig {
  id: string;
  type: string;
  name: string;
  description: string;
  scanTime: number;
  timeOut: number;
  retryCount: number;
  autoRecoverTime: number;
  scanMode: string;
  enabled: boolean;
  serialSettings?: SerialPortSettings;
  devices: DeviceConfig[];
  hardwareMappingId?: string;
  hardwareInterface?: string;
}

interface IOPortFormProps {
  onSubmit?: (config: IOPortConfig) => boolean;
  existingConfig?: IOPortConfig;
}

export function IOPortForm({ onSubmit, existingConfig }: IOPortFormProps) {
  const { updateConfig, getConfig } = useConfigStore();
  const [type, setType] = useState(existingConfig?.type || "");
  const [name, setName] = useState(existingConfig?.name || "");
  const [description, setDescription] = useState(
    existingConfig?.description || ""
  );
  const [scanTime, setScanTime] = useState(existingConfig?.scanTime || 1000);
  const [timeOut, setTimeOut] = useState(existingConfig?.timeOut || 3000);
  const [retryCount, setRetryCount] = useState(existingConfig?.retryCount || 3);
  const [autoRecoverTime, setAutoRecoverTime] = useState(
    existingConfig?.autoRecoverTime || 10
  );
  const [scanMode, setScanMode] = useState(
    existingConfig?.scanMode || "serial"
  );
  const [enabled, setEnabled] = useState(existingConfig?.enabled ?? true);

  // Serial port settings
  const [serialPort, setSerialPort] = useState(
    existingConfig?.serialSettings?.port || "COM1"
  );
  const [serialPortCustom, setSerialPortCustom] = useState(
    existingConfig?.serialSettings?.port && !["COM1","COM2","COM3","COM4"].includes(existingConfig.serialSettings.port) ? existingConfig.serialSettings.port : ""
  );
  const [baudRate, setBaudRate] = useState(
    existingConfig?.serialSettings?.baudRate || 9600
  );
  const [dataBit, setDataBit] = useState(
    existingConfig?.serialSettings?.dataBit || 8
  );
  const [stopBit, setStopBit] = useState(
    existingConfig?.serialSettings?.stopBit || 1
  );
  const [parity, setParity] = useState(
    existingConfig?.serialSettings?.parity || "None"
  );
  const [rts, setRts] = useState(existingConfig?.serialSettings?.rts ?? false);
  const [dtr, setDtr] = useState(existingConfig?.serialSettings?.dtr ?? false);

  // Add state for detected hardware
  const [hardware, setHardware] = useState<any>(null);
  const [loadingHardware, setLoadingHardware] = useState(false);
  const [hardwareError, setHardwareError] = useState<string | null>(null);

  // Add state for hardware mapping selection
  const hardwareMappings = useConfigStore(state => state.config.hardware_mappings || []);
  const [hardwareMappingId, setHardwareMappingId] = useState(existingConfig?.hardwareMappingId || "");
  const [customHardwareInterface, setCustomHardwareInterface] = useState(existingConfig?.hardwareInterface || "");
  const selectedMapping = hardwareMappings.find((m: any) => String(m.id) === hardwareMappingId);

  useEffect(() => {
    setLoadingHardware(true);
    const apiBase = typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : 'http://localhost:8000';
    fetch(`${apiBase}/api/hardware/detect`)
      .then(res => res.json())
      .then(data => {
        setHardware(data.data);
        setLoadingHardware(false);
      })
      .catch(err => {
        setHardwareError("Failed to fetch hardware");
        setLoadingHardware(false);
      });
  }, []);

  // Check if the selected type is a serial port type
  const isSerialType = useMemo(() => {
    return [
      "bacnet",
      "builtin",
      "zigbee",
      "minipcie",
      "tcpip-serial",
      "xbee",
    ].includes(type);
  }, [type]);

  // Check if the selected type is a TCP/IP type
  const isTcpIpType = useMemo(() => {
    return ["tcpip", "tcpip-serial"].includes(type);
  }, [type]);

  const [errors, setErrors] = useState<{ name?: string; type?: string; description?: string; scanTime?: string; timeOut?: string; retryCount?: string; autoRecoverTime?: string; serialPort?: string; baudRate?: string; dataBit?: string; stopBit?: string; parity?: string }>({});
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors: { name?: string; type?: string; description?: string; scanTime?: string; timeOut?: string; retryCount?: string; autoRecoverTime?: string; serialPort?: string; baudRate?: string; dataBit?: string; stopBit?: string; parity?: string } = {};

    // Basic validations
    if (!type.trim()) validationErrors.type = "Type is required.";
    if (!name.trim()) {
      validationErrors.name = "Name is required.";
    } else {
      // Stricter name validations
      if (name.length < 3) {
        validationErrors.name = "Name must be at least 3 characters.";
      } else if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
        validationErrors.name =
          "Name can only contain letters, numbers, hyphens (-), and underscores (_).";
      } else if (/^\d+$/.test(name)) {
        validationErrors.name = "Name cannot be only numbers.";
      } else if (/^\s|\s$/.test(name)) {
        validationErrors.name = "Name cannot start or end with a space.";
      }
    }

    // Duplicate check
    const allConfigs = getConfig().io_setup.ports;
    const nameExists = allConfigs.some(
      (cfg: IOPortConfig) =>
        cfg.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        cfg.id !== existingConfig?.id
    );

    if (nameExists) {
      validationErrors.name = "This name is already used.";
    }

    // Description validation
    if (description && description.length > 100) {
      validationErrors.description = "Description should not exceed 100 characters.";
    } else if (description && !/[a-zA-Z0-9]/.test(description)) {
      validationErrors.description = "Description should include some letters or numbers.";
    }

    // Numeric fields
    if (!Number.isInteger(scanTime) || scanTime < 1) {
      validationErrors.scanTime = "Scan time must be an integer >= 1 ms.";
    }
    if (!Number.isInteger(timeOut) || timeOut < 1) {
      validationErrors.timeOut = "Timeout must be an integer >= 1 ms.";
    }
    if (!Number.isInteger(retryCount) || retryCount < 0) {
      validationErrors.retryCount = "Retry count must be 0 or greater.";
    }
    if (!Number.isInteger(autoRecoverTime) || autoRecoverTime < 0) {
      validationErrors.autoRecoverTime = "Auto-recover time must be 0 or greater.";
    }

    // Serial settings validation
    if (isSerialType) {
      if (!serialPort && !serialPortCustom) {
        validationErrors.serialPort = "Serial port is required.";
      }
      if (!Number.isInteger(baudRate) || baudRate < 1200 || baudRate > 115200) {
        validationErrors.baudRate = "Baud rate must be between 1200 and 115200.";
      }
      if (!Number.isInteger(dataBit) || dataBit < 5 || dataBit > 8) {
        validationErrors.dataBit = "Data bits must be between 5 and 8.";
      }
      if (!(stopBit === 1 || stopBit === 2)) {
        validationErrors.stopBit = "Stop bit must be 1 or 2.";
      }
      if (!["None", "Even", "Odd"].includes(parity)) {
        validationErrors.parity = "Parity must be None, Even, or Odd.";
      }
    }

    // Show errors
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      for (const key in validationErrors) {
        toast.error(validationErrors[key as keyof typeof validationErrors], {
          duration: 4000,
        });
      }
      return;
    }

    setErrors({});

    // Construct config
    let newPortConfig: IOPortConfig = {
      id: existingConfig?.id || `ioport-${Date.now()}`,
      type,
      name,
      description,
      scanTime,
      timeOut,
      retryCount,
      autoRecoverTime,
      scanMode,
      enabled,
      devices: existingConfig?.devices || [],
    };

    if (isSerialType || isTcpIpType) {
      if (hardwareMappingId && hardwareMappingId !== "__custom__") {
        newPortConfig.hardwareMappingId = hardwareMappingId;
        newPortConfig.hardwareInterface = undefined;
      } else if (customHardwareInterface) {
        newPortConfig.hardwareMappingId = undefined;
        newPortConfig.hardwareInterface = customHardwareInterface;
      }
    }
    if (isSerialType) {
      const selectedMapping = hardwareMappings.find((m: any) => String(m.id) === hardwareMappingId);
      newPortConfig.serialSettings = {
        port: hardwareMappingId && hardwareMappingId !== "__custom__"
          ? (selectedMapping?.path || "")
          : (serialPort === "__custom__" ? serialPortCustom : serialPort),
        baudRate,
        dataBit,
        stopBit,
        parity,
        rts,
        dtr,
        enabled,
      };
    }

    if (onSubmit) {
      const success = onSubmit(newPortConfig);
      if (success && !existingConfig) {
        setType("");
        setName("");
        setDescription("");
        setScanTime(1000);
        setTimeOut(3000);
        setRetryCount(3);
        setAutoRecoverTime(10);
        setScanMode("serial");
        setEnabled(true);
        setSerialPort("COM1");
        setSerialPortCustom("");
        setBaudRate(9600);
        setDataBit(8);
        setStopBit(1);
        setParity("None");
        setRts(false);
        setDtr(false);
        setHardwareMappingId("");
        setCustomHardwareInterface("");
      }
    }
  };

  // Helper to get relevant hardware mapping types for each IO port type
  const getRelevantMappingTypes = (ioType: string): string[] => {
    switch (ioType) {
      case "bacnet":
      case "builtin":
      case "zigbee":
      case "minipcie":
      case "tcpip-serial":
      case "xbee":
        return ["serial"];
      case "tcpip":
        return ["network"];
      case "snmp":
        return ["network"];
      case "usb":
        return ["usb"];
      // Add more cases as needed
      default:
        return ["serial", "network", "usb", "gpio"];
    }
  };

  // Filter hardware mappings for the selected type
  const filteredHardwareMappings = hardwareMappings.filter((mapping: any) =>
    getRelevantMappingTypes(type).includes(mapping.type)
  );

  // If no mappings, show a disabled dropdown with a message
  const noMappingsAvailable = filteredHardwareMappings.length === 0;

  // Debug logs for hardware mappings
  console.log('IO Port type:', type);
  console.log('All hardwareMappings:', hardwareMappings);
  console.log('Filtered hardwareMappings:', filteredHardwareMappings);

  // Auto-select the first available mapping if not set
  useEffect(() => {
    if (!hardwareMappingId && filteredHardwareMappings.length > 0) {
      setHardwareMappingId(String(filteredHardwareMappings[0].id));
    }
  }, [type, filteredHardwareMappings, hardwareMappingId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {existingConfig
            ? "Edit IO Port Configuration"
            : "Add New IO Port Configuration"}
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[70vh] overflow-y-auto pr-1">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Enable/Disable Switch at the top */}
          <div className="flex items-center space-x-2 mb-4">
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Label htmlFor="enabled">{enabled ? "Enabled" : "Disabled"}</Label>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">
                Type <span className="text-red-500">*</span>
              </Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bacnet">Serial (BACnet MS/TP)</SelectItem>
                  <SelectItem value="builtin">Serial (Built-in)</SelectItem>
                  <SelectItem value="zigbee">
                    Serial (FourFaith F891X ZigBee)
                  </SelectItem>
                  <SelectItem value="minipcie">
                    Serial (miniPCIe/USB)
                  </SelectItem>
                  <SelectItem value="tcpip-serial">
                    Serial (via TCP/IP)
                  </SelectItem>
                  <SelectItem value="xbee">Serial (XBee/XBee-PRO)</SelectItem>
                  <SelectItem value="tcpip">TCPIP</SelectItem>
                  <SelectItem value="snmp">SNMP</SelectItem>
                  <SelectItem value="goose">API (IEC-61850 GOOSE)</SelectItem>
                  <SelectItem value="io">API (I/O)</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-red-500">{errors.type}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a unique name for this configuration"
                required
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a description (optional)"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scanTime">
                  Scan Time (ms) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="scanTime"
                  type="number"
                  value={scanTime}
                  onChange={(e) => setScanTime(Number(e.target.value))}
                  min={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeOut">
                  Time Out (ms) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="timeOut"
                  type="number"
                  value={timeOut}
                  onChange={(e) => setTimeOut(Number(e.target.value))}
                  min={500}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="retryCount">
                  Retry Count <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="retryCount"
                  type="number"
                  value={retryCount}
                  onChange={(e) => setRetryCount(Number(e.target.value))}
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="autoRecoverTime">
                  Auto Recover Time (s) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="autoRecoverTime"
                  type="number"
                  value={autoRecoverTime}
                  onChange={(e) => setAutoRecoverTime(Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scanMode">
                Scan Mode <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                id="scanMode"
                value={scanMode}
                onValueChange={setScanMode}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="serial" id="serial" />
                  <Label htmlFor="serial">Serial Scan</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="parallel" id="parallel" />
                  <Label htmlFor="parallel">Parallel Scan</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Hardware Source selection for all types */}
          <div className="space-y-2">
            <Label htmlFor="hardwareMapping">Hardware Source</Label>
            <Select
              value={hardwareMappingId || ""}
              onValueChange={value => setHardwareMappingId(value)}
              disabled={noMappingsAvailable}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder={noMappingsAvailable ? "No hardware mappings found for this type" : "Select hardware mapping or custom"} />
              </SelectTrigger>
              <SelectContent>
                {filteredHardwareMappings.map((mapping: any) => (
                  <SelectItem key={mapping.id} value={String(mapping.id)}>{mapping.name} ({mapping.type}: {mapping.path})</SelectItem>
                ))}
                <SelectItem value="__custom__">Custom...</SelectItem>
              </SelectContent>
            </Select>
            {noMappingsAvailable && (
              <div className="text-xs text-gray-500 mt-1">No hardware mappings found for this IO port type. Please add one in the Hardware Mappings tab.</div>
            )}
            {hardwareMappingId === "__custom__" && (
              <Input
                value={customHardwareInterface}
                onChange={e => setCustomHardwareInterface(e.target.value)}
                placeholder="Enter custom interface or port name"
                className="h-8 mt-1"
              />
            )}
          </div>

          {/* Serial Port Settings Panel */}
          {isSerialType && (
            <div className="border rounded-md p-4 mt-6">
              <h3 className="text-md font-medium mb-4">
                Serial Port Settings <span className="text-red-500">*</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serialPort">Serial Port</Label>
                  <>
                    {hardwareMappingId && hardwareMappingId !== "__custom__" ? (
                      <Input
                        value={selectedMapping?.path || ""}
                        readOnly
                        className="h-8 mt-1 bg-gray-100 cursor-not-allowed"
                      />
                    ) : (
                      <Input
                        value={serialPortCustom || ""}
                        onChange={e => setSerialPortCustom(e.target.value)}
                        placeholder={noMappingsAvailable ? "No hardware source selected" : "Enter custom serial port"}
                        className="h-8 mt-1"
                        disabled={noMappingsAvailable && !hardwareMappingId}
                      />
                    )}
                  </>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baudRate">Baud Rate</Label>
                  <Select
                    value={baudRate.toString()}
                    onValueChange={(value) => setBaudRate(parseInt(value))}
                  >
                    <SelectTrigger id="baudRate">
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

                <div className="space-y-2">
                  <Label htmlFor="dataBit">Data Bit</Label>
                  <Select
                    value={dataBit.toString()}
                    onValueChange={(value) => setDataBit(parseInt(value))}
                  >
                    <SelectTrigger id="dataBit">
                      <SelectValue placeholder="Select data bit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="6">6</SelectItem>
                      <SelectItem value="7">7</SelectItem>
                      <SelectItem value="8">8</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stopBit">Stop Bit</Label>
                  <Select
                    value={stopBit.toString()}
                    onValueChange={(value) => setStopBit(value)}
                  >
                    <SelectTrigger id="stopBit">
                      <SelectValue placeholder="Select stop bit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parity">Parity</Label>
                  <Select value={parity} onValueChange={setParity}>
                    <SelectTrigger id="parity">
                      <SelectValue placeholder="Select parity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      <SelectItem value="Even">Even</SelectItem>
                      <SelectItem value="Odd">Odd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-8 pt-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rts"
                      checked={rts}
                      onCheckedChange={setRts as any}
                    />
                    <Label htmlFor="rts">RTS</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dtr"
                      checked={dtr}
                      onCheckedChange={setDtr as any}
                    />
                    <Label htmlFor="dtr">DTR</Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <div className="space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (existingConfig) {
                    // Reset to original values
                    setType(existingConfig.type || "");
                    setName(existingConfig.name || "");
                    setDescription(existingConfig.description || "");
                    setScanTime(existingConfig.scanTime || 1000);
                    setTimeOut(existingConfig.timeOut || 3000);
                    setRetryCount(existingConfig.retryCount || 3);
                    setAutoRecoverTime(existingConfig.autoRecoverTime || 10);
                    setScanMode(existingConfig.scanMode || "serial");
                    setEnabled(existingConfig.enabled ?? true);

                    if (existingConfig.serialSettings) {
                      setSerialPort(
                        existingConfig.serialSettings.port || "COM1"
                      );
                      setSerialPortCustom(
                        existingConfig.serialSettings.port && !["COM1","COM2","COM3","COM4"].includes(existingConfig.serialSettings.port) ? existingConfig.serialSettings.port : ""
                      );
                      setBaudRate(
                        existingConfig.serialSettings.baudRate || 9600
                      );
                      setDataBit(existingConfig.serialSettings.dataBit || 8);
                      setStopBit(existingConfig.serialSettings.stopBit || 1);
                      setParity(existingConfig.serialSettings.parity || "None");
                      setRts(existingConfig.serialSettings.rts ?? false);
                      setDtr(existingConfig.serialSettings.dtr ?? false);
                    }
                    setHardwareMappingId(existingConfig.hardwareMappingId || "");
                    setCustomHardwareInterface(existingConfig.hardwareInterface || "");
                  } else {
                    // Reset form to defaults
                    setType("");
                    setName("");
                    setDescription("");
                    setScanTime(1000);
                    setTimeOut(3000);
                    setRetryCount(3);
                    setAutoRecoverTime(10);
                    setScanMode("serial");
                    setEnabled(true);
                    setSerialPort("COM1");
                    setSerialPortCustom("");
                    setBaudRate(9600);
                    setDataBit(8);
                    setStopBit(1);
                    setParity("None");
                    setRts(false);
                    setDtr(false);
                    setHardwareMappingId("");
                    setCustomHardwareInterface("");
                  }
                }}
              >
                Discard Changes
              </Button>
              <Button type="submit">
                {existingConfig ? "Apply Changes" : "Add Port"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
