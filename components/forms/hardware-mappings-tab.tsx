"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Edit, Trash2, Check, X } from "lucide-react";
import { useConfigStore, HardwareMappingTag, SystemTag } from "@/lib/stores/configuration-store";

const TAG_TYPES = [
  { value: "network", label: "Network Interface" },
  { value: "serial", label: "Serial/COM Port" },
];

export function HardwareMappingsTab() {
  const hardwareMappings = useConfigStore(state => state.config.hardware_mappings || []);
  const updateConfig = useConfigStore(state => state.updateConfig);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<HardwareMappingTag | null>(null);
  const [newTag, setNewTag] = useState<HardwareMappingTag>({
    id: Date.now().toString(),
    name: "",
    type: "network",
    path: "",
    description: "",
  });
  const [hardware, setHardware] = useState<any>(null);
  const [loadingHardware, setLoadingHardware] = useState(false);
  const [hardwareError, setHardwareError] = useState<string | null>(null);
  const [customPathInput, setCustomPathInput] = useState<{ [id: string]: string }>({});
  const [newTagCustomPath, setNewTagCustomPath] = useState<string>("");

  const handleEdit = (id: string) => {
    const tagToEdit = hardwareMappings.find(tag => tag.id === id);
    if (tagToEdit) {
      setEditingId(id);
      setEditingData({ ...tagToEdit });
      // Initialize custom path input if needed
      if (tagToEdit.path && !getPathOptions(tagToEdit.type).includes(tagToEdit.path)) {
        setCustomPathInput(prev => ({ ...prev, [id]: tagToEdit.path }));
        setEditingData({ ...tagToEdit, path: "__custom__" });
      }
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingData(null);
    setCustomPathInput({});
  };

  const handleSave = (id: string) => {
    if (!editingData) return;
    
    // If using custom path, use the custom input value
    const finalData = editingData.path === "__custom__" 
      ? { ...editingData, path: customPathInput[id] || "" }
      : editingData;

    const updatedMappings = hardwareMappings.map(tag => tag.id === id ? finalData : tag);
    updateConfig(["hardware_mappings"], updatedMappings);
    setEditingId(null);
    setEditingData(null);
    setCustomPathInput({});
  };

  const handleDelete = (id: string) => {
    const updatedMappings = hardwareMappings.filter(tag => tag.id !== id);
    updateConfig(["hardware_mappings"], updatedMappings);
  };

  const handleAdd = () => {
    if (!newTag.name.trim() || !newTag.path.trim()) return;
    const finalNewTag = newTag.path === "__custom__" 
      ? { ...newTag, path: newTagCustomPath, id: Date.now().toString() }
      : { ...newTag, id: Date.now().toString() };
    
    const updatedMappings = [...hardwareMappings, finalNewTag];
    updateConfig(["hardware_mappings"], updatedMappings);
    setNewTag({ id: Date.now().toString(), name: "", type: "network", path: "", description: "" });
    setNewTagCustomPath("");
  };

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

  const getPathOptions = (type: string): string[] => {
    if (!hardware) return Array.from(new Set(hardwareMappings.filter(tag => tag.type === type).map(tag => tag.path)));
    // Detected options
    let detected: string[] = [];
    if (type === "network") detected = (hardware.network_interfaces as Array<any>)?.filter((iface) => iface.type === "Ethernet").map((iface) => iface.name) || [];
    if (type === "serial") detected = (hardware.serial_ports as Array<any>)?.map((port) => port.path) || [];
    if (type === "gpio") detected = (hardware.gpio?.gpio_chips as Array<any>)?.map((chip) => chip.path) || [];
    if (type === "usb") detected = (hardware.usb_devices as Array<any>)?.map((dev) => dev.path) || [];
    // Already-used config values for this type
    const used = hardwareMappings.filter(tag => tag.type === type).map(tag => tag.path);
    // Merge and deduplicate
    return Array.from(new Set([...detected, ...used]));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Port Settings</CardTitle>
        <CardDescription>
          Define hardware resource mappings (network, serial, GPIO, etc.) for your system. These will be used in the YAML config and backend.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Path/Value</TableHead>
                <TableHead className="w-[300px]">Description</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hardwareMappings.map((tag, index) => (
                <TableRow key={tag.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                  {editingId === tag.id && editingData ? (
                    <>
                      <TableCell>
                        <Input
                          value={editingData.name}
                          onChange={e => setEditingData({ ...editingData, name: e.target.value })}
                          className="h-8"
                          placeholder="Enter name"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={editingData.type}
                          onValueChange={value => setEditingData({ ...editingData, type: value })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAG_TYPES.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {loadingHardware ? (
                          <span>Loading...</span>
                        ) : (
                          <Select
                            value={editingData.path}
                            onValueChange={value => {
                              if (value === "__custom__") {
                                setEditingData({ ...editingData, path: value });
                              } else {
                                setEditingData({ ...editingData, path: value });
                                setCustomPathInput((prev) => ({ ...prev, [tag.id]: "" }));
                              }
                            }}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select or enter path" />
                            </SelectTrigger>
                            <SelectContent>
                              {getPathOptions(editingData.type).map((opt: string) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                              <SelectItem value="__custom__">Custom...</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {editingData.path === "__custom__" && (
                          <Input
                            value={customPathInput[tag.id] || ""}
                            onChange={e => setCustomPathInput(prev => ({ ...prev, [tag.id]: e.target.value }))}
                            placeholder="Enter custom path"
                            className="h-8 mt-1"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editingData.description}
                          onChange={e => setEditingData({ ...editingData, description: e.target.value })}
                          className="h-8"
                          placeholder="Description"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            onClick={() => handleSave(tag.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={handleCancel}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{tag.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {TAG_TYPES.find(t => t.value === tag.type)?.label || tag.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm bg-muted/30 rounded px-2 py-1">{tag.path}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-muted-foreground" title={tag.description}>
                        {tag.description || "No description"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEdit(tag.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDelete(tag.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {/* Add new tag row */}
              <TableRow className="bg-muted/50 border-2 border-dashed border-primary/30 hover:bg-primary/5 transition-all">
                <TableCell className="text-primary font-bold text-lg">+</TableCell>
                <TableCell>
                  <Input
                    value={newTag.name}
                    onChange={e => setNewTag(t => ({ ...t, name: e.target.value }))}
                    placeholder="e.g. ETH_MAIN"
                    className="h-8 border-dashed"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={newTag.type}
                    onValueChange={value => setNewTag(t => ({ ...t, type: value }))}
                  >
                    <SelectTrigger className="h-8 border-dashed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAG_TYPES.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {loadingHardware ? (
                    <span>Loading...</span>
                  ) : (
                    <Select
                      value={newTag.path === "__custom__" ? "__custom__" : newTag.path}
                      onValueChange={value => {
                        if (value === "__custom__") {
                          setNewTag(t => ({ ...t, path: value }));
                        } else {
                          setNewTag(t => ({ ...t, path: value }));
                          setNewTagCustomPath("");
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 border-dashed">
                        <SelectValue placeholder="Select or enter path" />
                      </SelectTrigger>
                      <SelectContent>
                        {getPathOptions(newTag.type).map((opt: string) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">Custom...</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {newTag.path === "__custom__" && (
                    <Input
                      value={newTagCustomPath}
                      onChange={e => {
                        setNewTagCustomPath(e.target.value);
                        setNewTag(t => ({ ...t, path: e.target.value }));
                      }}
                      placeholder="Enter custom path"
                      className="h-8 mt-1"
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    value={newTag.description}
                    onChange={e => setNewTag(t => ({ ...t, description: e.target.value }))}
                    placeholder="Description"
                    className="h-8 border-dashed"
                  />
                </TableCell>
                <TableCell>
                  <Button 
                    size="sm" 
                    onClick={handleAdd}
                    className="h-8 gap-1"
                    disabled={!newTag.name.trim() || !newTag.path.trim()}
                  >
                    <PlusCircle className="w-4 h-4" /> Add
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
} 
