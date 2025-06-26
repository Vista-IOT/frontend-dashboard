"use client";

import { useState, useMemo } from "react";
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
  const [errors, setErrors] = useState<{ name?: string; type?: string }>({});
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors: { name?: string; type?: string } = {};
    if (!type.trim()) validationErrors.type = "Type is required.";
    if (!name.trim()) validationErrors.name = "Name is required.";

    const allConfigs = getConfig().io_setup.ports;
    // Get existing configs from the store

    const nameExists = allConfigs.some(
      (cfg: IOPortConfig) =>
        cfg.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        cfg.id !== existingConfig?.id // Allow same name if editing current config
    );

    if (nameExists) {
      validationErrors.name = "This name is already used.";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Invalid data, Validation error", {
        duration: 5000,
      });
      return;
    }

    setErrors({}); // Clear any previous errors

    if (!type || !name) {
      toast.error("Validation error", {
        duration: 5000,
      });
      return;
    }

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
      devices: existingConfig?.devices || [], // Initialize devices array
    };

    // Add serial settings if it's a serial port type
    if (isSerialType) {
      newPortConfig.serialSettings = {
        port: serialPort,
        baudRate,
        dataBit,
        stopBit,
        parity,
        rts,
        dtr,
        enabled,
      };
    }

    // Call the local onSubmit if provided (e.g., for closing dialogs)
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
        setBaudRate(9600);
        setDataBit(8);
        setStopBit(1);
        setParity("None");
        setRts(false);
        setDtr(false);
      }
    }
  };

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

          {/* Serial Port Settings Panel */}
          {isSerialType && (
            <div className="border rounded-md p-4 mt-6">
              <h3 className="text-md font-medium mb-4">
                Serial Port Settings <span className="text-red-500">*</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serialPort">Port</Label>
                  <Select value={serialPort} onValueChange={setSerialPort}>
                    <SelectTrigger id="serialPort">
                      <SelectValue placeholder="Select port" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COM1">COM1</SelectItem>
                      <SelectItem value="COM2">COM2</SelectItem>
                      <SelectItem value="COM3">COM3</SelectItem>
                      <SelectItem value="COM4">COM4</SelectItem>
                      <SelectItem value="miniPCIe/USB">miniPCIe/USB</SelectItem>
                    </SelectContent>
                  </Select>
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
                      <SelectItem value="1.5">1.5</SelectItem>
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
                      <SelectItem value="Mark">Mark</SelectItem>
                      <SelectItem value="Space">Space</SelectItem>
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
                      setBaudRate(
                        existingConfig.serialSettings.baudRate || 9600
                      );
                      setDataBit(existingConfig.serialSettings.dataBit || 8);
                      setStopBit(existingConfig.serialSettings.stopBit || 1);
                      setParity(existingConfig.serialSettings.parity || "None");
                      setRts(existingConfig.serialSettings.rts ?? false);
                      setDtr(existingConfig.serialSettings.dtr ?? false);
                    }
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
                    setBaudRate(9600);
                    setDataBit(8);
                    setStopBit(1);
                    setParity("None");
                    setRts(false);
                    setDtr(false);
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
