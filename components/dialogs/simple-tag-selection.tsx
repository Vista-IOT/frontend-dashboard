"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  X,
} from "lucide-react";
import { useConfigStore } from "@/lib/stores/configuration-store";
import { buildIoTagTree } from "@/lib/utils";
import type { ConfigSchema, IOPortConfig, DeviceConfig, CalculationTag, StatsTag } from "@/lib/stores/configuration-store";

interface SimpleTag {
  id: string;
  name: string;
  type: string;
  dataType?: string;
  units?: string;
  defaultValue?: string | number;
  description?: string;
  address?: string;
}

interface IOTag {
  id: string;
  name: string;
  dataType: string;
  address: string;
  description: string;
}

interface SimpleTagSelectionProps {
  onSelectTag: (tag: SimpleTag) => void;
  onClose: () => void;
}

export default function SimpleTagSelection({ onSelectTag, onClose }: SimpleTagSelectionProps) {
  const { config } = useConfigStore();
  const [selectedTab, setSelectedTab] = useState<string>('io-tag');
  const [collapsedPorts, setCollapsedPorts] = useState<Record<string, boolean>>({});
  const [collapsedDevices, setCollapsedDevices] = useState<Record<string, boolean>>({});

  // Memoize the IO tag tree to prevent re-renders
  const ioTagTree = useMemo(() => {
    return buildIoTagTree(config, {});
  }, [config]);

  // Memoize other tag types
  const calculationTags = useMemo(() => {
    return config.calculation_tags || [];
  }, [config.calculation_tags]);

  const statsTags = useMemo(() => {
    return config.stats_tags || [];
  }, [config.stats_tags]);

  const userTags = useMemo(() => {
    return config.user_tags || [];
  }, [config.user_tags]);

  const systemTags = useMemo(() => {
    return config.system_tags || [];
  }, [config.system_tags]);

  // Helper to toggle port collapse state
  const togglePort = (portId: string) => {
    setCollapsedPorts(prev => ({ ...prev, [portId]: !prev[portId] }));
  };

  // Helper to toggle device collapse state
  const toggleDevice = (deviceId: string) => {
    setCollapsedDevices(prev => ({ ...prev, [deviceId]: !prev[deviceId] }));
  };

  const handleTagSelect = (tag: SimpleTag) => {
    onSelectTag(tag);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Main dialog container with proper dimensions */}
      <div className="relative w-full max-w-5xl max-h-[90vh] m-4 bg-background rounded-lg border shadow-lg overflow-hidden">
        {/* Fixed header */}
        <div className="px-6 py-4 border-b bg-background">
          <div className="flex items-center justify-between">
            <CardTitle>Select Tag from Data Center</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content area with proper scrolling */}
        <div className="flex-1 px-6 py-4 overflow-hidden">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex flex-col h-full">
            {/* Fixed tabs header */}
            <TabsList className="mb-4 flex-shrink-0">
              <TabsTrigger value="io-tag">IO Tags</TabsTrigger>
              <TabsTrigger value="calc-tag">Calculation Tags</TabsTrigger>
              <TabsTrigger value="stats-tag">Stats Tags</TabsTrigger>
              <TabsTrigger value="user-tag">User Tags</TabsTrigger>
              <TabsTrigger value="system-tag">System Tags</TabsTrigger>
            </TabsList>

            {/* Scrollable tab content */}
            <TabsContent value="io-tag" className="flex-1 min-h-0 m-0">
              <ScrollArea className="h-[60vh]">
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
                              className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ml-6 border-l-2 border-transparent hover:bg-accent hover:border-primary/20"
                              onClick={() => handleTagSelect({
                                id: tag.id,
                                name: `${device.name}:${tag.name}`,
                                type: 'io',
                                dataType: tag.dataType,
                                address: tag.address,
                                description: tag.description,
                                units: '', // Could be enhanced from tag metadata
                                defaultValue: 0,
                              })}
                            >
                              <TagIcon className="h-4 w-4 text-purple-600" />
                              <div className="flex-1">
                                <div className="font-medium">{tag.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {tag.dataType} • Address: {tag.address}
                                </div>
                                {tag.description && (
                                  <div className="text-xs text-muted-foreground">{tag.description}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                  {ioTagTree.length === 0 && (
                    <div className="text-center text-muted-foreground p-8">
                      <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No IO ports configured in Data Center.</p>
                      <p className="text-sm">Configure IO ports in Data Center → IO Setup first.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="calc-tag" className="flex-1 min-h-0 m-0">
              <ScrollArea className="h-[60vh]">
                <div className="space-y-1 p-1">
                  {calculationTags.map((tag: CalculationTag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm hover:bg-accent"
                      onClick={() => handleTagSelect({
                        id: tag.id,
                        name: tag.name,
                        type: 'calculation',
                        dataType: 'Analog', // Calculations typically produce analog values
                        description: tag.description,
                        units: '',
                        defaultValue: 0,
                      })}
                    >
                      <FileDigit className="h-4 w-4 text-green-600" />
                      <div className="flex-1">
                        <div className="font-medium">{tag.name}</div>
                        <div className="text-xs text-muted-foreground">Formula: {tag.formula}</div>
                        {tag.description && (
                          <div className="text-xs text-muted-foreground">{tag.description}</div>
                        )}
                      </div>
                      <Badge variant="outline">Calculation</Badge>
                    </div>
                  ))}
                  {calculationTags.length === 0 && (
                    <div className="text-center text-muted-foreground p-8">
                      <FileDigit className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No calculation tags available.</p>
                      <p className="text-sm">Create calculation tags in Data Center → Calculation Tags.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="stats-tag" className="flex-1 min-h-0 m-0">
              <ScrollArea className="h-[60vh]">
                <div className="space-y-1 p-1">
                  {statsTags.map((tag: StatsTag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm hover:bg-accent"
                      onClick={() => handleTagSelect({
                        id: tag.id,
                        name: tag.name,
                        type: 'stats',
                        dataType: 'Analog', // Stats typically produce analog values
                        description: tag.description,
                        units: '',
                        defaultValue: 0,
                      })}
                    >
                      <BarChart className="h-4 w-4 text-orange-600" />
                      <div className="flex-1">
                        <div className="font-medium">{tag.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {tag.type} of {tag.referTag} • Update: {tag.updateCycleValue} {tag.updateCycleUnit}
                        </div>
                        {tag.description && (
                          <div className="text-xs text-muted-foreground">{tag.description}</div>
                        )}
                      </div>
                      <Badge variant="outline">Stats</Badge>
                    </div>
                  ))}
                  {statsTags.length === 0 && (
                    <div className="text-center text-muted-foreground p-8">
                      <BarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No stats tags available.</p>
                      <p className="text-sm">Create stats tags in Data Center → Stats Tags.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="user-tag" className="flex-1 min-h-0 m-0">
              <ScrollArea className="h-[60vh]">
                <div className="space-y-1 p-1">
                  {userTags.map((tag: any) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm hover:bg-accent"
                      onClick={() => handleTagSelect({
                        id: tag.id,
                        name: tag.name,
                        type: 'user',
                        dataType: tag.dataType || 'Analog',
                        description: tag.description,
                        units: '',
                        defaultValue: tag.defaultValue || 0,
                      })}
                    >
                      <UserCircle className="h-4 w-4 text-blue-600" />
                      <div className="flex-1">
                        <div className="font-medium">{tag.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {tag.dataType} • Default: {tag.defaultValue} • Access: {tag.readWrite}
                        </div>
                        {tag.description && (
                          <div className="text-xs text-muted-foreground">{tag.description}</div>
                        )}
                      </div>
                      <Badge variant="outline">User</Badge>
                    </div>
                  ))}
                  {userTags.length === 0 && (
                    <div className="text-center text-muted-foreground p-8">
                      <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No user tags available.</p>
                      <p className="text-sm">Create user tags in Data Center → User Tags.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="system-tag" className="flex-1 min-h-0 m-0">
              <ScrollArea className="h-[60vh]">
                <div className="space-y-1 p-1">
                  {systemTags.map((tag: any) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm hover:bg-accent"
                      onClick={() => handleTagSelect({
                        id: tag.id,
                        name: tag.name,
                        type: 'system',
                        dataType: tag.dataType || 'Analog',
                        description: tag.description,
                        units: tag.unit || '',
                        defaultValue: 0,
                      })}
                    >
                      <Cog className="h-4 w-4 text-gray-600" />
                      <div className="flex-1">
                        <div className="font-medium">{tag.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {tag.dataType} • Unit: {tag.unit} • Range: {tag.spanLow}-{tag.spanHigh}
                        </div>
                        {tag.description && (
                          <div className="text-xs text-muted-foreground">{tag.description}</div>
                        )}
                      </div>
                      <Badge variant="outline">System</Badge>
                    </div>
                  ))}
                  {systemTags.length === 0 && (
                    <div className="text-center text-muted-foreground p-8">
                      <Cog className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No system tags available.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
