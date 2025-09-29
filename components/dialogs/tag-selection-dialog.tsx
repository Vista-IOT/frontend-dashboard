"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  ChevronDown,
  Tag as TagIcon,
  FileDigit,
  UserCircle,
  Cog,
  BarChart,
  Server,
  Cpu,
  Check,
} from "lucide-react";
import { buildIoTagTree } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { ConfigSchema, IOPortConfig, DeviceConfig, CalculationTag, StatsTag } from "@/lib/stores/configuration-store";
import { useConfigStore } from "@/lib/stores/configuration-store";

// Define the IO Tag interface
interface IOTag {
  id: string;
  name: string;
  dataType: string;
  address: string;
  description: string;
}

// Define the Device interface for IO Ports
interface Device {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  unitNumber?: number;
  description?: string;
  tagWriteType?: string;
  addDeviceNameAsPrefix?: boolean;
  extensionProperties?: any;
  tags?: IOTag[];
}

// Define the IO Port interface
interface Port {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  devices?: Device[];
  description?: string;
  scanTime?: number;
  timeOut?: number;
  retryCount?: number;
  autoRecoverTime?: number;
  scanMode?: string;
  serialSettings?: any;
}

type TagCategory = {
  id: string;
  name: string;
  icon: React.ReactNode;
  tags?: Tag[];
};

type Tag = {
  id: string;
  name: string;
  type?: string;
  value?: string;
  description?: string;
  path?: string; // To track the path (port/device/tag)
};

interface TagSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTag?: (tag: Tag) => void; // Single select mode
  onSelectTags?: (tags: Tag[]) => void; // Multi select mode
  multiSelect?: boolean;
  selectedTags?: Tag[]; // For multi-select mode to show pre-selected tags
  excludeCalculationTagId?: string;
  excludeCalculationTags?: boolean;
}

export default function TagSelectionDialog({
  open,
  onOpenChange,
  onSelectTag,
  onSelectTags,
  multiSelect = false,
  selectedTags = [],
  excludeCalculationTagId,
  excludeCalculationTags,
}: TagSelectionDialogProps) {
  const { config } = useConfigStore();
  const [selectedTab, setSelectedTab] = useState<string>('io-tag');
  const [collapsedPorts, setCollapsedPorts] = useState<Record<string, boolean>>({});
  const [collapsedDevices, setCollapsedDevices] = useState<Record<string, boolean>>({});
  const [internalSelectedTags, setInternalSelectedTags] = useState<Tag[]>(selectedTags);

  // Use the shared tree builder for IO ports
  const ioTagTree = buildIoTagTree(config, { excludeCalculationTagId, excludeCalculationTags });

  // Update internal selection when props change
  useEffect(() => {
    setInternalSelectedTags(selectedTags);
  }, [selectedTags]);

  // Helper to handle tag selection
  function handleTagSelect(tag: Tag) {
    if (multiSelect) {
      // Multi-select mode: toggle tag selection
      const isSelected = internalSelectedTags.some(t => t.id === tag.id);
      if (isSelected) {
        setInternalSelectedTags(prev => prev.filter(t => t.id !== tag.id));
      } else {
        setInternalSelectedTags(prev => [...prev, tag]);
      }
    } else {
      // Single select mode: immediately call callback and close
      onSelectTag?.(tag);
      onOpenChange(false);
    }
  }

  // Helper to check if a tag is selected
  const isTagSelected = (tagId: string) => {
    return internalSelectedTags.some(t => t.id === tagId);
  };

  // Helper to toggle port collapse state
  const togglePort = (portId: string) => {
    setCollapsedPorts(prev => ({ ...prev, [portId]: !prev[portId] }));
  };

  // Helper to toggle device collapse state
  const toggleDevice = (deviceId: string) => {
    setCollapsedDevices(prev => ({ ...prev, [deviceId]: !prev[deviceId] }));
  };

  // Handle confirm selection for multi-select mode
  const handleConfirmSelection = () => {
    onSelectTags?.(internalSelectedTags);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl w-full max-h-[90vh] overflow-auto flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>
              {multiSelect ? "Select Tags" : "Select Tag"}
            </DialogTitle>
            {multiSelect && internalSelectedTags.length > 0 && (
              <Badge variant="secondary">
                {internalSelectedTags.length} selected
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 px-6 py-4 min-h-0 min-w-0 overflow-auto">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex flex-col h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="io-tag">IO Tags</TabsTrigger>
              <TabsTrigger value="calc-tag">Calculation Tags</TabsTrigger>
              <TabsTrigger value="stats-tag">Stats Tags</TabsTrigger>
              <TabsTrigger value="user-tag">User Tags</TabsTrigger>
              <TabsTrigger value="system-tag">System Tags</TabsTrigger>
            </TabsList>

            <TabsContent value="io-tag" className="flex-1 min-h-0 min-w-0 overflow-auto">
              <div className="space-y-2 p-1">
                {ioTagTree.map((port: IOPortConfig) => (
                  <div key={port.id} className="relative pl-2">
                    <div className="absolute left-0 top-2 bottom-0 w-px bg-blue-200" />
                    <div 
                      className="flex items-center font-medium text-primary mb-1 relative cursor-pointer select-none hover:bg-accent/50 p-1 rounded" 
                      onClick={() => togglePort(port.id)}
                    >
                      {collapsedPorts[port.id] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      <Server size={16} className="mx-1 text-blue-700" /> {port.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({port.devices?.length || 0} devices)
                      </span>
                    </div>
                    {!collapsedPorts[port.id] && port.devices?.map((device: DeviceConfig) => (
                      <div key={device.id} className="ml-4 relative pl-4">
                        <div className="absolute left-0 top-2 bottom-0 w-px bg-gray-300" />
                        <div 
                          className="flex items-center font-normal text-sm text-blue-900 mb-1 relative cursor-pointer select-none hover:bg-accent/50 p-1 rounded"
                          onClick={() => toggleDevice(device.id)}
                        >
                          {collapsedDevices[device.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          <Cpu size={14} className="mr-1 ml-1 text-blue-500" /> {device.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({device.tags?.length || 0} tags)
                          </span>
                        </div>
                        {!collapsedDevices[device.id] && device.tags?.map((tag: IOTag) => (
                          <div
                            key={tag.id}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ml-6 border-l-2 ${
                              isTagSelected(tag.id) 
                                ? "bg-primary/10 border-primary" 
                                : "border-transparent hover:bg-accent hover:border-primary/20"
                            }`}
                            onClick={() => handleTagSelect({
                              id: tag.id,
                              name: `${device.name}:${tag.name}`,
                              type: tag.dataType,
                              value: tag.address,
                              description: tag.description,
                            })}
                          >
                            {multiSelect && (
                              <Checkbox 
                                checked={isTagSelected(tag.id)}
                                readOnly
                              />
                            )}
                            <TagIcon className="h-4 w-4 text-purple-600" />
                            <div className="flex-1">
                              <div className="font-medium">{tag.name}</div>
                              {tag.description && (
                                <div className="text-xs text-muted-foreground">{tag.description}</div>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{tag.dataType}</div>
                            {isTagSelected(tag.id) && !multiSelect && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
                {ioTagTree.length === 0 && (
                  <div className="text-center text-muted-foreground p-8">
                    <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No IO ports configured.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="calc-tag" className="flex-1 min-h-0 min-w-0 overflow-auto">
              <div className="space-y-1 p-1">
                {config.calculation_tags?.map((tag: CalculationTag) => (
                  <div
                    key={tag.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                      isTagSelected(tag.id) 
                        ? "bg-primary/10" 
                        : "hover:bg-accent"
                    }`}
                    onClick={() => handleTagSelect({
                      id: tag.id,
                      name: tag.name,
                      type: 'calculation',
                      value: tag.formula,
                      description: tag.description,
                    })}
                  >
                    {multiSelect && (
                      <Checkbox 
                        checked={isTagSelected(tag.id)}
                        readOnly
                      />
                    )}
                    <FileDigit className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <div className="font-medium">{tag.name}</div>
                      {tag.description && (
                        <div className="text-xs text-muted-foreground">{tag.description}</div>
                      )}
                    </div>
                    {isTagSelected(tag.id) && !multiSelect && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))}
                {(!config.calculation_tags || config.calculation_tags.length === 0) && (
                  <div className="text-center text-muted-foreground p-8">
                    <FileDigit className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No calculation tags available.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="stats-tag" className="flex-1 min-h-0 min-w-0 overflow-auto">
              <div className="space-y-1 p-1">
                {config.stats_tags?.map((tag: StatsTag) => (
                  <div
                    key={tag.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                      isTagSelected(tag.id) 
                        ? "bg-primary/10" 
                        : "hover:bg-accent"
                    }`}
                    onClick={() => handleTagSelect({
                      id: tag.id,
                      name: tag.name,
                      type: 'stats',
                      value: tag.referTag,
                      description: tag.description,
                    })}
                  >
                    {multiSelect && (
                      <Checkbox 
                        checked={isTagSelected(tag.id)}
                        readOnly
                      />
                    )}
                    <BarChart className="h-4 w-4 text-orange-600" />
                    <div className="flex-1">
                      <div className="font-medium">{tag.name}</div>
                      {tag.description && (
                        <div className="text-xs text-muted-foreground">{tag.description}</div>
                      )}
                    </div>
                    {isTagSelected(tag.id) && !multiSelect && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))}
                {(!config.stats_tags || config.stats_tags.length === 0) && (
                  <div className="text-center text-muted-foreground p-8">
                    <BarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No stats tags available.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="user-tag" className="flex-1 min-h-0 min-w-0 overflow-auto">
              <div className="space-y-1 p-1">
                {config.user_tags?.map((tag: Tag) => (
                  <div
                    key={tag.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                      isTagSelected(tag.id) 
                        ? "bg-primary/10" 
                        : "hover:bg-accent"
                    }`}
                    onClick={() => handleTagSelect({
                      id: tag.id,
                      name: tag.name,
                      type: 'user',
                      description: tag.description,
                    })}
                  >
                    {multiSelect && (
                      <Checkbox 
                        checked={isTagSelected(tag.id)}
                        readOnly
                      />
                    )}
                    <UserCircle className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <div className="font-medium">{tag.name}</div>
                      {tag.description && (
                        <div className="text-xs text-muted-foreground">{tag.description}</div>
                      )}
                    </div>
                    {isTagSelected(tag.id) && !multiSelect && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))}
                {(!config.user_tags || config.user_tags.length === 0) && (
                  <div className="text-center text-muted-foreground p-8">
                    <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No user tags available.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="system-tag" className="flex-1 min-h-0 min-w-0 overflow-auto">
              <div className="space-y-1 p-1">
                {config.system_tags?.map((tag: Tag) => (
                  <div
                    key={tag.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                      isTagSelected(tag.id) 
                        ? "bg-primary/10" 
                        : "hover:bg-accent"
                    }`}
                    onClick={() => handleTagSelect({
                      id: tag.id,
                      name: tag.name,
                      type: 'system',
                      description: tag.description,
                    })}
                  >
                    {multiSelect && (
                      <Checkbox 
                        checked={isTagSelected(tag.id)}
                        readOnly
                      />
                    )}
                    <Cog className="h-4 w-4 text-gray-600" />
                    <div className="flex-1">
                      <div className="font-medium">{tag.name}</div>
                      {tag.description && (
                        <div className="text-xs text-muted-foreground">{tag.description}</div>
                      )}
                    </div>
                    {isTagSelected(tag.id) && !multiSelect && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))}
                {(!config.system_tags || config.system_tags.length === 0) && (
                  <div className="text-center text-muted-foreground p-8">
                    <Cog className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No system tags available.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <div className="flex items-center justify-between w-full">
            {multiSelect && internalSelectedTags.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {internalSelectedTags.length} tag{internalSelectedTags.length !== 1 ? 's' : ''} selected
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {multiSelect && (
                <Button 
                  onClick={handleConfirmSelection}
                  disabled={internalSelectedTags.length === 0}
                >
                  Select Tags
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
