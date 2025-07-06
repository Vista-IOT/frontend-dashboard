"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tag, UserCircle, FileDigit, BarChart, Cog } from "lucide-react";
import IOTagManagement from "@/components/tabs/io-tag-tab";
import { UserTagsForm } from "@/components/forms/user-tags-form";
import { StatsTagsForm } from "@/components/forms/stats-tags-form";
import { SystemConfigTabs } from "@/components/forms/system-tags-form";
import CalculationTagTab from "@/components/tabs/calculation-tag-tab";
import { useConfigStore } from "@/lib/stores/configuration-store";

interface DataCenterTabProps {
  section: string;
  selectedPortId: string;
  selectedDeviceId: string;
}

export default function DataCenterTab({
  section,
  selectedPortId,
  selectedDeviceId,
}: DataCenterTabProps) {
  const { config } = useConfigStore();
  // Map devices to add 'type' property for UI compatibility
  const ioPorts = config.io_setup.ports.map(port => ({
    ...port,
    devices: port.devices.map(device => ({
      ...device,
      type: device.deviceType || "",
      useAsciiProtocol: Boolean(device.useAsciiProtocol),
    })),
  }));
  // setIoPorts is still passed for compatibility, but not used for state
  const handleNavigation = (query: string) => {
    const url = new URL(window.location.href);
    url.search = query;
    window.history.pushState({}, "", url.toString());
    // Manually trigger URL parsing logic in parent component if needed
  };

  return (
    <div className="rounded-lg border p-8">
      <h2 className="text-lg font-semibold mb-4">Data Center Management</h2>
      <p className="text-muted-foreground mb-4">
        Configure and manage your data tags for the IoT gateway.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card
          className={`p-4 cursor-pointer transition-colors ${
            section === "io-tag" ? "border-primary" : "hover:border-primary"
          }`}
          onClick={() => handleNavigation("?tab=datacenter&section=io-tag")}
        >
          <h3 className="font-medium flex items-center">
            <Tag className="mr-2 h-4 w-4" /> IO Tags
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage input/output data tags
          </p>
        </Card>
        <Card
          className={`p-4 cursor-pointer transition-colors ${
            section === "user-tag" ? "border-primary" : "hover:border-primary"
          }`}
          onClick={() => handleNavigation("?tab=datacenter&section=user-tag")}
        >
          <h3 className="font-medium flex items-center">
            <UserCircle className="mr-2 h-4 w-4" /> User Tags
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure custom user-defined tags
          </p>
        </Card>
        <Card
          className={`p-4 cursor-pointer transition-colors ${
            section === "calc-tag" ? "border-primary" : "hover:border-primary"
          }`}
          onClick={() => handleNavigation("?tab=datacenter&section=calc-tag")}
        >
          <h3 className="font-medium flex items-center">
            <FileDigit className="mr-2 h-4 w-4" /> Calculation Tags
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Set up calculated data points
          </p>
        </Card>
        <Card
          className={`p-4 cursor-pointer transition-colors ${
            section === "stats-tag" ? "border-primary" : "hover:border-primary"
          }`}
          onClick={() => handleNavigation("?tab=datacenter&section=stats-tag")}
        >
          <h3 className="font-medium flex items-center">
            <BarChart className="mr-2 h-4 w-4" /> Stats Tags
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure statistical data points
          </p>
        </Card>
        <Card
          className={`p-4 cursor-pointer transition-colors ${
            section === "system-tag" ? "border-primary" : "hover:border-primary"
          }`}
          onClick={() => handleNavigation("?tab=datacenter&section=system-tag")}
        >
          <h3 className="font-medium flex items-center">
            <Cog className="mr-2 h-4 w-4" /> System Tags
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage system-level tags
          </p>
        </Card>
      </div>

      {/* Conditionally render the selected section below */}
      <div className="mt-6 space-y-6">
        {section === "io-tag" && (
          <IOTagManagement
            ioPorts={ioPorts}
            selectedPortId={selectedPortId}
            selectedDeviceId={selectedDeviceId}
          />
        )}
        {section === "user-tag" && <UserTagsForm />}
        {section === "calc-tag" && <CalculationTagTab ioPorts={ioPorts} />}
        {section === "stats-tag" && <StatsTagsForm />}
        {section === "system-tag" && <SystemConfigTabs />}
      </div>
    </div>
  );
}
