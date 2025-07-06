"use client";
import React, { useState, useEffect } from "react";
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
  { value: "gpio", label: "GPIO" },
  { value: "usb", label: "USB Device" },
  { value: "disk", label: "Disk/Partition" },
  { value: "custom", label: "Custom" },
];

export function HardwareMappingsTab() {
  const hardwareMappings = useConfigStore(state => state.config.hardware_mappings || []);
  const updateConfig = useConfigStore(state => state.updateConfig);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newTag, setNewTag] = useState<HardwareMappingTag>({
    id: Date.now(),
    name: "",
    type: "network",
    path: "",
    description: "",
  });

  const handleEdit = (id: number) => setEditingId(id);
  const handleCancel = () => setEditingId(null);
  const handleSave = (id: number, updated: HardwareMappingTag) => {
    const updatedMappings = hardwareMappings.map(tag => tag.id === id ? updated : tag);
    updateConfig(["hardware_mappings"], updatedMappings);
    setEditingId(null);
  };
  const handleDelete = (id: number) => {
    const updatedMappings = hardwareMappings.filter(tag => tag.id !== id);
    updateConfig(["hardware_mappings"], updatedMappings);
  };
  const handleAdd = () => {
    if (!newTag.name.trim() || !newTag.path.trim()) return;
    const updatedMappings = [...hardwareMappings, { ...newTag, id: Date.now() }];
    updateConfig(["hardware_mappings"], updatedMappings);
    setNewTag({ id: Date.now(), name: "", type: "network", path: "", description: "" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hardware Mappings</CardTitle>
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
                  {editingId === tag.id ? (
                    <>
                      <TableCell>
                        <Input
                          value={tag.name}
                          onChange={e => handleSave(tag.id, { ...tag, name: e.target.value })}
                          className="h-8"
                          placeholder="Enter name"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tag.type}
                          onValueChange={value => handleSave(tag.id, { ...tag, type: value })}
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
                        <Input
                          value={tag.path}
                          onChange={e => handleSave(tag.id, { ...tag, path: e.target.value })}
                          className="h-8"
                          placeholder="e.g. eth0, /dev/ttyUSB0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={tag.description}
                          onChange={e => handleSave(tag.id, { ...tag, description: e.target.value })}
                          className="h-8"
                          placeholder="Description"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            onClick={() => handleSave(tag.id, tag)}
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
                  <Input
                    value={newTag.path}
                    onChange={e => setNewTag(t => ({ ...t, path: e.target.value }))}
                    placeholder="e.g. eth0, /dev/ttyUSB0"
                    className="h-8 border-dashed"
                  />
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