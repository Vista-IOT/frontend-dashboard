"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConfigStore } from "@/lib/stores/configuration-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SystemTagsTab } from "./system-tags-tab";
import { HardwareMappingsTab } from "./hardware-mappings-tab";

// Define the HardwareMappingTag interface
interface HardwareMappingTag {
  id: number;
  name: string;
  type: string; // network, serial, gpio, etc.
  path: string; // e.g., eth0, /dev/ttyUSB0, etc.
  description: string;
}

const TAG_TYPES = [
  { value: "network", label: "Network Interface" },
  { value: "serial", label: "Serial/COM Port" },
  { value: "gpio", label: "GPIO" },
  { value: "usb", label: "USB Device" },
  { value: "disk", label: "Disk/Partition" },
  { value: "custom", label: "Custom" },
];

export function SystemConfigTabs() {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">System Configuration</h2>
        <p className="text-muted-foreground">
          Manage system tags and hardware resource mappings for your IoT gateway.
        </p>
      </div>
      
      <Tabs defaultValue="system-tags" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="system-tags" className="text-sm font-medium">
            System Tags
          </TabsTrigger>
          <TabsTrigger value="hardware-mappings" className="text-sm font-medium">
            Port Settings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="system-tags" className="space-y-4">
          <SystemTagsTab />
        </TabsContent>
        
        <TabsContent value="hardware-mappings" className="space-y-4">
          <HardwareMappingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
