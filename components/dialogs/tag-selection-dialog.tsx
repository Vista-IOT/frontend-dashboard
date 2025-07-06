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
} from "lucide-react";
import { buildIoTagTree } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  onSelectTag: (tag: Tag) => void;
  excludeCalculationTagId?: string;
  excludeCalculationTags?: boolean;
}

export default function TagSelectionDialog({
  open,
  onOpenChange,
  onSelectTag,
  excludeCalculationTagId,
  excludeCalculationTags,
}: TagSelectionDialogProps) {
  const { config } = useConfigStore();
  const [selectedTab, setSelectedTab] = useState<string>('io-tag');
  const [collapsedPorts, setCollapsedPorts] = useState<Record<string, boolean>>({});

  // Use the shared tree builder for IO ports
  const ioTagTree = buildIoTagTree(config, { excludeCalculationTagId, excludeCalculationTags });

  // Helper to handle tag selection and close dialog
  function handleTagSelect(tag: Tag) {
    onSelectTag(tag);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl w-full max-h-[90vh] overflow-auto flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Select Tag</DialogTitle>
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
                      className="flex items-center font-medium text-primary mb-1 relative cursor-pointer select-none" 
                      onClick={() => setCollapsedPorts((prev: Record<string, boolean>) => ({...prev, [port.id]: !prev[port.id]}))}
                    >
                      {collapsedPorts[port.id] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      <Server size={16} className="mx-1 text-blue-700" /> {port.name}
                    </div>
                    {!collapsedPorts[port.id] && port.devices?.map((device: DeviceConfig) => (
                      <div key={device.id} className="ml-4 relative pl-4">
                        <div className="flex items-center font-normal text-sm text-blue-900 mb-1 relative">
                          <Cpu size={16} className="mr-1 text-blue-500" /> {device.name}
                        </div>
                        {device.tags?.map((tag: IOTag) => (
                          <div
                            key={tag.id}
                            className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ml-6 hover:bg-accent"
                            onClick={() => handleTagSelect({
                              id: tag.id,
                              name: `${device.name}:${tag.name}`,
                              type: tag.dataType,
                              value: tag.address,
                              description: tag.description,
                            })}
                          >
                            <TagIcon className="h-4 w-4 text-purple-600" />
                            {tag.name}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="calc-tag" className="flex-1 min-h-0 min-w-0 overflow-auto">
              <div className="space-y-1 p-1">
                {config.calculation_tags?.map((tag: CalculationTag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm hover:bg-accent"
                    onClick={() => handleTagSelect({
                      id: tag.id,
                      name: tag.name,
                      type: 'calculation',
                      value: tag.formula,
                      description: tag.description,
                    })}
                  >
                    <TagIcon className="h-4 w-4 text-green-600" />
                    {tag.name}
                  </div>
                ))}
                {(!config.calculation_tags || config.calculation_tags.length === 0) && (
                  <div className="text-center text-muted-foreground p-8">
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
                    className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm hover:bg-accent"
                    onClick={() => handleTagSelect({
                      id: tag.id,
                      name: tag.name,
                      type: 'stats',
                      value: tag.referTag,
                      description: tag.description,
                    })}
                  >
                    <TagIcon className="h-4 w-4 text-orange-600" />
                    {tag.name}
                  </div>
                ))}
                {(!config.stats_tags || config.stats_tags.length === 0) && (
                  <div className="text-center text-muted-foreground p-8">
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
                    className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm hover:bg-accent"
                    onClick={() => handleTagSelect({
                      id: tag.id,
                      name: tag.name,
                      type: 'user',
                      description: tag.description,
                    })}
                  >
                    <TagIcon className="h-4 w-4 text-blue-600" />
                    {tag.name}
                  </div>
                ))}
                {(!config.user_tags || config.user_tags.length === 0) && (
                  <div className="text-center text-muted-foreground p-8">
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
                    className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm hover:bg-accent"
                    onClick={() => handleTagSelect({
                      id: tag.id,
                      name: tag.name,
                      type: 'system',
                      description: tag.description,
                    })}
                  >
                    <TagIcon className="h-4 w-4 text-gray-600" />
                    {tag.name}
                  </div>
                ))}
                {(!config.system_tags || config.system_tags.length === 0) && (
                  <div className="text-center text-muted-foreground p-8">
                    <p>No system tags available.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
