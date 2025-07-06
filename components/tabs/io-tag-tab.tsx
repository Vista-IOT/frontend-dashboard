// Main working io tag tab code
"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  Server,
  Terminal,
  Cpu,
  Tags,
  ChevronDown,
  Pencil,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
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

// Import your form components
import { IOPortForm } from "@/components/forms/io-tag-form";
import { DeviceForm } from "@/components/forms/device-form";
import { IOTagDetailView } from "@/components/forms/io-tag-detail";

// Helper function to get display name for port types
function getTypeDisplayName(type: string): string {
  const typeMap: Record<string, string> = {
    builtin: "Built-in Serial Port",
    serial: "Serial Port",
    tcpip: "TCP/IP",
    api: "API Connection",
    "modbus-rtu": "Modbus RTU",
    "modbus-tcp": "Modbus TCP",
    "opc-ua": "OPC UA",
    mqtt: "MQTT Client",
  };

  return typeMap[type.toLowerCase()] || type;
}

// Type definitions
export interface ExtensionProperties {
  useAsciiProtocol?: number;
  packetDelay?: number;
  digitalBlockSize?: number;
  analogBlockSize?: number;
}

export interface Device {
  id: string;
  name: string;
  type: string;
  deviceType: string;
  enabled: boolean;
  unitNumber: number;
  description: string;
  tagWriteType: string;
  addDeviceNameAsPrefix?: boolean;
  useAsciiProtocol: boolean;
  packetDelay: number;
  digitalBlockSize: number;
  analogBlockSize: number;

  tags?: IOTag[];
}

export interface Port {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  devices: Device[];
  description: string;
  scanTime: number;
  timeOut: number;
  retryCount: number;
  autoRecoverTime: number;
  scanMode: string;
  serialSettings?: any;
  hardwareMappingId?: string;
  hardwareInterface?: string;
}

import type { IOTag } from "@/lib/stores/configuration-store";
import { useConfigStore } from "@/lib/stores/configuration-store";

export interface IOTagManagementProps {
  ioPorts: Port[];
  selectedPortId?: string | null;
  selectedDeviceId?: string | null;
}

export default function IOTagManagement({
  ioPorts = [],
  selectedPortId = null,
  selectedDeviceId = null,
}: IOTagManagementProps) {
  const { toast } = useToast();
  const { updateConfig, getConfig } = useConfigStore();
  const hardwareMappings = getConfig().hardware_mappings || [];
  const [showAddPortForm, setShowAddPortForm] = useState(false);
  const [editingPort, setEditingPort] = useState<Port | null>(null);
  const [showAddDeviceForm, setShowAddDeviceForm] = useState(false);
  const [addingDeviceForPort, setAddingDeviceForPort] = useState<string | null>(
    null
  );
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [deletePortDialog, setDeletePortDialog] = useState<{
    isOpen: boolean;
    port: Port | null;
  }>({ isOpen: false, port: null });
  const [deleteDeviceDialog, setDeleteDeviceDialog] = useState<{
    isOpen: boolean;
    device: Device | null;
    portId: string | null;
  }>({ isOpen: false, device: null, portId: null });

  // Track expanded ports and devices
  const [expandedPorts, setExpandedPorts] = useState<Record<string, boolean>>(
    {}
  );
  const [expandedDevices, setExpandedDevices] = useState<
    Record<string, boolean>
  >({});

  const selectedPort = ioPorts.find((p) => p.id === selectedPortId) || null;
  const selectedDevice = selectedPort?.devices.find((d) => d.id === selectedDeviceId) || null;

  // Handle add calculation tag
  const handleAddPort = (config: any) => {
    const currentConfig = getConfig();
    const ports = currentConfig.io_setup?.ports || [];
    const nameExists = ports.some(
      (port) => port.name.trim().toLowerCase() === config.name.trim().toLowerCase()
    );
    if (nameExists) {
      toast({
        title: "Duplicate Port Name",
        description: `A port with the name '${config.name}' already exists. Please choose a unique name.`,
        variant: "destructive",
      });
      return false;
    }
    const newPort = {
      id: `port-${Date.now()}`,
      ...config,
      devices: [],
      enabled: true,
    };
    const updatedPorts = [...ports, newPort];
    updateConfig(["io_setup", "ports"], updatedPorts);
    toast({
      title: "Port Added",
      description: `Port ${config.name} has been added successfully.`,
    });
    return true;
  };

  // Handle device selection for viewing/editing tags
  const handleDeviceSelect = (device: Device, portId: string) => {
    window.history.pushState(
      {},
      "",
      `?tab=datacenter&section=io-tag&portId=${portId}&deviceId=${device.id}`
    );
  };

  // Update existing IO Port
  const handleUpdatePort = (config: any) => {
    const currentConfig = getConfig();
    const ports = currentConfig.io_setup?.ports || [];
    const updatedPorts = ports.map((port) =>
      port.id === config.id ? { ...port, ...config } : port
      );
    updateConfig(["io_setup", "ports"], updatedPorts);
      setEditingPort(null);
      toast({
        title: "Port Updated",
        description: `Port ${config.name} has been updated successfully.`,
      });
  };

  // Handle delete IO Port
  const handleDeletePort = () => {
    if (!deletePortDialog.port) return;
    const currentConfig = getConfig();
    const updatedPorts = (currentConfig.io_setup?.ports || []).filter(
        (port) => port.id !== deletePortDialog.port?.id
      );
    updateConfig(["io_setup", "ports"], updatedPorts);
    if (editingPort?.id === deletePortDialog.port.id) {
      setEditingPort(null);
      }
      setDeletePortDialog({ isOpen: false, port: null });
      toast({
        title: "Port Deleted",
        description: `Port ${deletePortDialog.port.name} has been deleted successfully.`,
      });
  };

  // Handle showing add device form for a specific port
  const handleShowAddDeviceForm = (portId: string) => {
    setAddingDeviceForPort(portId);
    setShowAddDeviceForm(true);
  };

  // Handle device form submission for adding a new device
  const handleAddDevice = (config: any, portId: string) => {
    const currentConfig = getConfig();
    const ports = currentConfig.io_setup?.ports || [];
    const port = ports.find((p) => p.id === portId);
    if (!port) return false;
    const nameExists = (port.devices || []).some(
      (device) => device.name.trim().toLowerCase() === config.name.trim().toLowerCase()
    );
    if (nameExists) {
      toast({
        title: "Duplicate Device Name",
        description: `A device with the name '${config.name}' already exists in this port. Please choose a unique name.`,
        variant: "destructive",
      });
      return false;
    }
    const newDevice = {
        id: `device-${Date.now()}`,
        ...config,
        tags: [],
        enabled: true,
      };
    const updatedPorts = ports.map((port) =>
      port.id === portId
        ? { ...port, devices: [...(port.devices || []), newDevice] }
        : port
    );
    updateConfig(["io_setup", "ports"], updatedPorts);
      toast({
        title: "Device Added",
        description: `Device ${config.name} has been added successfully.`,
      });
    return true;
  };

  // Handle updating device configuration
  const handleUpdateDevice = (config: any, portId: string) => {
    const currentConfig = getConfig();
    const ports = currentConfig.io_setup?.ports || [];
    const updatedPorts = ports.map((port) => {
      if (port.id !== portId) return port;
      const updatedDevices = (port.devices || []).map((device) =>
        device.id === config.id ? { ...device, ...config } : device
        );
      return { ...port, devices: updatedDevices };
    });
    updateConfig(["io_setup", "ports"], updatedPorts);
        setEditingDevice(null);
        toast({
          title: "Device Updated",
          description: `Device ${config.name} has been updated successfully.`,
        });
  };

  // Handle device deletion
  const handleDeleteDevice = () => {
    if (!deleteDeviceDialog.device || !deleteDeviceDialog.portId) return;
    const currentConfig = getConfig();
    const ports = currentConfig.io_setup?.ports || [];
    const updatedPorts = ports.map((port) => {
      if (port.id !== deleteDeviceDialog.portId) return port;
          return {
            ...port,
        devices: (port.devices || []).filter(
          (d) => d.id !== deleteDeviceDialog.device?.id
        ),
          };
    });
    updateConfig(["io_setup", "ports"], updatedPorts);
    if (editingDevice?.device.id === deleteDeviceDialog.device.id) {
      setEditingDevice(null);
      }
      setDeleteDeviceDialog({ isOpen: false, device: null, portId: null });
      toast({
        title: "Device Deleted",
        description: `Device ${deleteDeviceDialog.device.name} has been deleted successfully.`,
      });
  };

  // Handle IO tag updates
  const handleUpdateTags = (portId: string, deviceId: string, updatedTags: IOTag[]) => {
    const currentConfig = getConfig();
    const ports = currentConfig.io_setup?.ports || [];
    const updatedPorts = ports.map((port) => {
      if (port.id !== portId) return port;
      const updatedDevices = (port.devices || []).map((device) =>
        device.id === deviceId ? { ...device, tags: updatedTags } : device
      );
      return { ...port, devices: updatedDevices };
    });
    updateConfig(["io_setup", "ports"], updatedPorts);
      toast({
        title: "Tags Updated",
        description: `Tags have been updated successfully.`,
      });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            {selectedPort ? (
              <>
                <CardTitle>Devices</CardTitle>
                <CardDescription>
                  Manage devices for port: {selectedPort.name}
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle>IO Ports</CardTitle>
                <CardDescription>
                  Configure communication ports for your IO tags
                </CardDescription>
              </>
            )}
          </div>
          {!selectedPort && (
            <Button onClick={() => setShowAddPortForm(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Port
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {ioPorts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Terminal className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No communication ports configured yet
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowAddPortForm(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Your First Port
              </Button>
            </div>
          ) : (
            <div className="w-full">
              {/* Selected device info banner */}
              {selectedDevice && selectedPort && (
                <div className="bg-muted mb-6 rounded-lg p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Terminal className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">
                        {selectedPort.name} / {selectedDevice.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Managing IO Tags for this device
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.history.pushState(
                          {},
                          "",
                          `?tab=datacenter&section=io-tag`
                        );
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}

              {selectedDevice ? (
                <div className="border rounded-lg p-4">
                  <IOTagDetailView
                    device={{
                      ...selectedDevice,
                      addDeviceNameAsPrefix: selectedDevice.addDeviceNameAsPrefix ?? false,
                      useAsciiProtocol: Number(selectedDevice.useAsciiProtocol),
                      tags: selectedDevice.tags ?? [],
                    }}
                    portId={selectedPort?.id || ""}
                    onUpdate={handleUpdateTags}
                  />
                </div>
              ) : !selectedPort ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {ioPorts.map((port) => (
                    <Card
                      key={port.id}
                      className="overflow-hidden cursor-pointer hover:border-primary transition-colors"
                      onClick={() => {
                        window.history.pushState(
                          {},
                          "",
                          `?tab=datacenter&section=io-tag&portId=${port.id}`
                        );
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{port.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Type:
                            </span>
                            <span className="text-sm font-medium">
                              {getTypeDisplayName(port.type)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Scan Mode:
                            </span>
                            <span className="text-sm font-medium">
                              {port.scanMode}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-sm text-muted-foreground">
                              Status:
                            </span>
                            <Switch
                              checked={port.enabled}
                              onClick={e => e.stopPropagation()}
                              onCheckedChange={(checked: boolean) => {
                                const updatedPort = {
                                  ...port,
                                  enabled: checked,
                                };
                                handleUpdatePort(updatedPort);
                              }}
                            />
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="border-t pt-3 flex justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            // This is redundant since the whole card is clickable, but keeping for clarity
                            e.stopPropagation();
                            window.history.pushState(
                              {},
                              "",
                              `?tab=datacenter&section=io-tag&portId=${port.id}`
                            );
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPort(port);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletePortDialog({ isOpen: true, port });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : selectedPort ? (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {selectedPort.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {getTypeDisplayName(selectedPort.type)}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      {/* Edit and Delete buttons */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => setEditingPort(selectedPort)}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() =>
                          setDeletePortDialog({
                            isOpen: true,
                            port: selectedPort,
                          })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Enhanced Port Details */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm font-medium">Status</p>
                      <div className="flex items-center mt-1">
                        <div
                          className={`h-2 w-2 rounded-full mr-2 ${
                            selectedPort.enabled ? "bg-green-500" : "bg-red-500"
                          }`}
                        ></div>
                        <p className="text-sm">
                          {selectedPort.enabled ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Type</p>
                      <p className="text-sm mt-1">
                        {getTypeDisplayName(selectedPort.type)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Description</p>
                      <p className="text-sm mt-1">{selectedPort.description || "-"}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Scan Time</p>
                      <p className="text-sm mt-1">{selectedPort.scanTime} ms</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Timeout</p>
                      <p className="text-sm mt-1">{selectedPort.timeOut} ms</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Retry Count</p>
                      <p className="text-sm mt-1">{selectedPort.retryCount}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Auto Recover Time</p>
                      <p className="text-sm mt-1">
                        {selectedPort.autoRecoverTime} s
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Scan Mode</p>
                      <p className="text-sm mt-1">{selectedPort.scanMode}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Hardware Source</p>
                      <p className="text-sm mt-1">
                        {selectedPort.hardwareMappingId
                          ? (() => {
                              const mapping = hardwareMappings.find((m: any) => String(m.id) === selectedPort.hardwareMappingId);
                              return mapping ? `${mapping.name} (${mapping.type}: ${mapping.path})` : selectedPort.hardwareMappingId;
                            })()
                          : selectedPort.hardwareInterface || "-"}
                      </p>
                    </div>
                  </div>

                  {/* Serial/COM Port Settings if present */}
                  {selectedPort.serialSettings && (
                    <div className="mb-6">
                      <h4 className="font-medium mb-3">Serial/COM Port Settings</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium">Port</p>
                          <p className="text-sm mt-1">{selectedPort.serialSettings.port}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Baud Rate</p>
                          <p className="text-sm mt-1">{selectedPort.serialSettings.baudRate}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Data Bits</p>
                          <p className="text-sm mt-1">{selectedPort.serialSettings.dataBit}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Stop Bits</p>
                          <p className="text-sm mt-1">{selectedPort.serialSettings.stopBit}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Parity</p>
                          <p className="text-sm mt-1">{selectedPort.serialSettings.parity}</p>
                          </div>
                          <div>
                          <p className="text-sm font-medium">RTS</p>
                          <p className="text-sm mt-1">{selectedPort.serialSettings.rts ? "Yes" : "No"}</p>
                              </div>
                        <div>
                          <p className="text-sm font-medium">DTR</p>
                          <p className="text-sm mt-1">{selectedPort.serialSettings.dtr ? "Yes" : "No"}</p>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Devices in this port */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Devices</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => handleShowAddDeviceForm(selectedPort.id)}
                      >
                        <Plus className="h-3 w-3" />
                        Add Device
                      </Button>
                    </div>

                    {selectedPort?.devices.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPort.devices.map((device: Device) => (
                          <div
                            key={device.id}
                            className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/30 cursor-pointer"
                            onClick={() =>
                              handleDeviceSelect(device, selectedPort.id)
                            }
                          >
                            <div className="flex items-center">
                              <Cpu className="h-4 w-4 mr-2 text-primary" />
                              <div>
                                <p className="text-sm font-medium">
                                  {device.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {device.type} - Unit {device.unitNumber}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div
                                className={`h-2 w-2 rounded-full ${
                                  device.enabled ? "bg-green-500" : "bg-red-500"
                                }`}
                              ></div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingDevice({ ...device, portId: selectedPort.id });
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteDeviceDialog({
                                    isOpen: true,
                                    device: device,
                                    portId: selectedPort.id,
                                  });
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-4 border rounded-md text-muted-foreground">
                        <p>No devices configured for this port</p>
                        <Button
                          variant="link"
                          onClick={() =>
                            handleShowAddDeviceForm(selectedPort.id)
                          }
                        >
                          Add your first device
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="bg-muted p-4 rounded-full mb-4">
                    <Terminal className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    Select from Sidebar
                  </h3>
                  <p className="text-muted-foreground max-w-md mb-6">
                    Select a port or device from the sidebar to manage IO Tags
                  </p>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => setShowAddPortForm(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add New Port
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Add Port Dialog */}
      <Dialog open={showAddPortForm} onOpenChange={setShowAddPortForm}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add New Communication Port</DialogTitle>
            <DialogDescription>
              Configure a new port for device communications
            </DialogDescription>
          </DialogHeader>
          <IOPortForm onSubmit={(config) => {
            const success = handleAddPort(config);
            if (success) setShowAddPortForm(false);
          }} />
        </DialogContent>
      </Dialog>
      {/* Edit Port Dialog */}
      <Dialog
        open={!!editingPort}
        onOpenChange={(open) => !open && setEditingPort(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Port</DialogTitle>
            <DialogDescription>
              Modify settings for {editingPort?.name}
            </DialogDescription>
          </DialogHeader>
          {editingPort && (
            <IOPortForm
              onSubmit={handleUpdatePort}
              existingConfig={{
                ...editingPort,
                devices: editingPort.devices.map((device) => ({
                  ...device,
                  addDeviceNameAsPrefix: device.addDeviceNameAsPrefix ?? false,
                  useAsciiProtocol: typeof device.useAsciiProtocol === 'boolean' ? (device.useAsciiProtocol ? 1 : 0) : Number(device.useAsciiProtocol),
                  tags: device.tags ?? [],
                })),
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Delete Port Confirmation Dialog */}
      <AlertDialog
        open={deletePortDialog.isOpen}
        onOpenChange={(open) =>
          !open && setDeletePortDialog({ isOpen: false, port: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Port</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletePortDialog.port?.name}?
              This action cannot be undone. All devices and tags associated with
              this port will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePort}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Add Device Dialog */}
      <Dialog open={showAddDeviceForm} onOpenChange={setShowAddDeviceForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Device</DialogTitle>
            <DialogDescription>
              Add a new device to this port.
            </DialogDescription>
          </DialogHeader>
            <DeviceForm
            portId={addingDeviceForPort || ""}
            existingDeviceNames={selectedPort?.devices.map(d => d.name) || []}
            onSubmit={(config) => {
              const success = handleAddDevice(config, addingDeviceForPort || "");
              if (success) {
                setShowAddDeviceForm(false);
                setAddingDeviceForPort(null);
              }
            }}
            />
        </DialogContent>
      </Dialog>
      {/* Edit Device Dialog */}
      <Dialog
        open={!!editingDevice}
        onOpenChange={(open) => !open && setEditingDevice(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              Modify settings for {editingDevice?.name}
            </DialogDescription>
          </DialogHeader>
          {editingDevice && (
            <DeviceForm
              onSubmit={(config) => handleUpdateDevice(config, editingDevice.portId)}
              existingConfig={editingDevice}
              portId={editingDevice.portId}
              existingDeviceNames={selectedPort?.devices.map(d => d.name) || []}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Delete Device Confirmation Dialog */}
      <AlertDialog
        open={deleteDeviceDialog.isOpen}
        onOpenChange={(open) =>
          !open &&
          setDeleteDeviceDialog({ isOpen: false, device: null, portId: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteDeviceDialog.device?.name}?
              This action cannot be undone. All tags associated with this device
              will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDevice}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
