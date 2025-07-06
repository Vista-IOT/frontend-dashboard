// Working Dashboard File
"use client";

import { useState, useEffect, Suspense } from "react";
import {
  ChevronDown,
  Database,
  Gauge,
  HardDrive,
  type LucideIcon,
  MessageSquare,
  Network,
  RefreshCw,
  Server,
  Settings,
  Shield,
  Wifi,
  ArrowLeft,
  Code,
  FileDigit,
  Tag,
  UserCircle,
  BarChart,
  Cog,
  Clock,
  HardDrive as HardDiskIcon,
  Activity as MemoryIcon,
  Cpu,
  AreaChart,
  Terminal,
  Loader2,
} from "lucide-react";
import type { Port } from "@/components/tabs/io-tag-tab";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { useHydrateConfigFromBackend } from "@/hooks/useHydrateConfigFromBackend";
import { useConfigStore } from "@/lib/stores/configuration-store";
import { comprehensiveConfig } from "@/lib/config/comprehensive-config";
import { buildIoTagTree } from "@/lib/utils";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";

import NetworkTab from "@/components/tabs/network-tab";
import SecurityTab from "@/components/tabs/security-tab";
import ProtocolsTab from "@/components/tabs/protocols-tab";
import LogsTab from "@/components/tabs/logs-tab";
import OverviewTab from "@/components/tabs/overview-tab";
import DataCenterTab from "@/components/tabs/data-center-tab";
import { MQTTForm } from "@/components/forms/mqtt-form";
import { UserTagsForm } from "@/components/forms/user-tags-form";
import { StatsTagsForm } from "@/components/forms/stats-tags-form";
import { SystemTagsForm } from "@/components/forms/system-tags-form";
import { RestartGatewayDialog } from "@/components/dialogs/restart-dialog";
import { ExportConfigDialog } from "@/components/dialogs/export-config-dialog";
import { ImportConfigDialog } from "@/components/dialogs/import-config-dialog";
import { ResetConfigDialog } from "@/components/dialogs/reset-config-dialog";
import { SidebarNav } from "@/components/sidebar-nav";
import { DeviceConfigurationPanel } from "@/components/device-configuration-panel";
import ConfigurationTab from "@/components/tabs/configuration-tab";
import IOTagManagement from "@/components/tabs/io-tag-tab";
import CalculationTagTab from "@/components/tabs/calculation-tag-tab";
import CommunicationForwardTab from "@/components/tabs/communication-forward-tab";

// Types for the navigation items
type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: string;
  submenu?: NavItem[];
  dynamicSubmenu?: string;
  isIoTagSection?: boolean;
  children?: NavItem[];
};

function DashboardContent() {
  useHydrateConfigFromBackend();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("device");
  const section = searchParams.get("section");
  const portId = searchParams.get("portId");
  const deviceItemId = searchParams.get("deviceId");
  const [showReconfigureOption, setShowReconfigureOption] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(1000);

  // Get config from store
  const { config, updateConfig, resetConfig } = useConfigStore();
  const hydrateConfig = useConfigStore((s) => s.hydrateConfigFromBackend);
  const saveConfig = useConfigStore((s) => s.saveConfigToBackend);
  const isDirty = useConfigStore((s) => s.isDirty);

  // Build IO ports tree from config for the sidebar
  const ioPorts = buildIoTagTree(config);

  // Dialog states
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isLoadingComprehensive, setIsLoadingComprehensive] = useState(false);

  // Add state for active section
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const pathname = usePathname();

  // --- Dashboard Overview Data ---
  const dashboardData = useDashboardOverview(refreshInterval);

  // Modified navigation items with proper routes
  const navItems: NavItem[] = [
    {
      title: "Overview",
      href: "?tab=overview",
      icon: Gauge,
      active: activeTab === "overview",
      children: [
        {
          title: "System Uptime",
          href: "?tab=overview&section=system-uptime",
          icon: Clock,
        },
        {
          title: "CPU Load",
          href: "?tab=overview&section=cpu-load",
          icon: Cpu,
        },
        {
          title: "Memory Usage",
          href: "?tab=overview&section=memory-usage",
          icon: MemoryIcon,
        },
        {
          title: "Storage",
          href: "?tab=overview&section=storage",
          icon: HardDiskIcon,
        },
        {
          title: "Services Status",
          href: "?tab=overview&section=services-status",
          icon: Server,
        },
      ],
    },
    {
      title: "Networking",
      href: "?tab=network",
      icon: Network,
      active: activeTab === "network",
      submenu: [
        {
          title: "Interfaces",
          href: "?tab=network&section=interfaces",
          icon: Wifi,
          submenu: [
            {
              title: "Ethernet",
              href: "?tab=network&section=interfaces&subsection=ethernet",
              icon: Wifi,
            },
            {
              title: "WiFi",
              href: "?tab=network&section=interfaces&subsection=wifi",
              icon: Wifi,
            },
          ],
        },
        { title: "DHCP", href: "?tab=network&section=dhcp", icon: Database },
        {
          title: "Routing",
          href: "?tab=network&section=routing",
          icon: RefreshCw,
        },
        {
          title: "Port Forwarding",
          href: "?tab=network&section=port-forwarding",
          icon: Network,
        },
        {
          title: "Dynamic DNS",
          href: "?tab=network&section=ddns",
          icon: Database,
        },
        { title: "WiFi", href: "?tab=network&section=wifi", icon: Wifi },
      ],
    },
    {
      title: "Data Center",
      href: "?tab=datacenter",
      icon: Server,
      active: activeTab === "datacenter",
      submenu: [
        {
          title: "IO Ports",
          href: "?tab=datacenter&section=io-tag",
          icon: Tag,
          isIoTagSection: true,
        },
        {
          title: "User Tag",
          href: "?tab=datacenter&section=user-tag",
          icon: Tag,
        },
        {
          title: "Calculation Tag",
          href: "?tab=datacenter&section=calc-tag",
          icon: FileDigit,
        },
        {
          title: "Stats Tag",
          href: "?tab=datacenter&section=stats-tag",
          icon: BarChart,
        },
        {
          title: "System Tag",
          href: "?tab=datacenter&section=system-tag",
          icon: Tag,
        },
      ],
    },
    {
      title: "Security",
      href: "?tab=security",
      icon: Shield,
      active: activeTab === "security",
      submenu: [
        { title: "IPSec VPN", href: "?tab=security&section=vpn", icon: Shield },
        {
          title: "Firewall",
          href: "?tab=security&section=firewall",
          icon: Shield,
        },
        {
          title: "IP Binding",
          href: "?tab=security&section=ip-binding",
          icon: Database,
        },
      ],
    },
    {
      title: "Industrial Protocols",
      href: "?tab=protocols",
      icon: Database,
      active: activeTab === "protocols",
      submenu: [
        {
          title: "DNP3.0",
          href: "?tab=protocols&section=dnp3",
          icon: Database,
        },
        {
          title: "OPC-UA",
          href: "?tab=protocols&section=opcua",
          icon: Database,
        },
        {
          title: "Modbus",
          href: "?tab=protocols&section=modbus",
          icon: Database,
        },
        { title: "IEC", href: "?tab=protocols&section=iec", icon: Database },
      ],
    },
    {
      title: "Communication Forward",
      href: "?tab=communication-forward",
      icon: MessageSquare,
      active: activeTab === "communication-forward",
    },
    {
      title: "Configuration",
      href: "?tab=configuration",
      icon: Code,
      active: activeTab === "configuration",
    },
  ];

  // Update the navigation handler
  const handleNavigation = (href: string) => {
    if (href.startsWith("/")) {
      router.push(href);
    } else {
      router.push(href);
      const params = new URLSearchParams(href);
      const tab = params.get("tab");
      const section = params.get("section");

      if (tab) {
        setActiveTab(tab);
        // If there's a section, update the NetworkTab or other relevant component
        if (section) {
          setActiveSection(section);
        }
      }
    }
  };

  // Update the useEffect to handle sections
  useEffect(() => {
    const tab = searchParams.get("tab");
    const section = searchParams.get("section");

    if (tab) {
      setActiveTab(tab);
      if (section) {
        setActiveSection(section);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (deviceId) {
      // For demo purposes, we'll assume devices with odd IDs are configured
      // In a real app, you would check your device database
      const isConfigured = deviceId.includes("001") || deviceId.includes("003");
      setShowReconfigureOption(isConfigured);

      // If the device is not configured, show the configuration panel
      setIsConfiguring(!isConfigured);

      toast({
        title: "Device Connected",
        description: `Managing device with ID: ${deviceId}${
          isConfigured ? " (Configured)" : " (Needs Configuration)"
        }`,
      });
    }
  }, [deviceId, toast]);

  const handleRefresh = () => {
    toast({
      title: "Refreshing data",
      description: "Dashboard data has been refreshed",
    });
  };

  // Check for hash in URL on initial load
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (
      hash &&
      ["overview", "network", "security", "protocols", "logs", "communication-forward"].includes(
        hash
      )
    ) {
      setActiveTab(hash);
    }
  }, []);

  const handleReconfigure = () => {
    toast({
      title: "Reconfiguring Device",
      description: `Starting reconfiguration process for device ${deviceId}`,
    });
    setIsConfiguring(true);
  };

  const handleConfigurationComplete = () => {
    setIsConfiguring(false);
    setShowReconfigureOption(true);
    toast({
      title: "Configuration Saved",
      description: `Device ${deviceId} configuration has been saved.`,
    });
  };

  // Function to load comprehensive configuration for testing
  const handleLoadComprehensiveConfig = async () => {
    setIsLoadingComprehensive(true);
    
    try {
      // Reset to default first
      resetConfig();
      
      // Apply comprehensive configuration
      Object.keys(comprehensiveConfig).forEach(key => {
        updateConfig([key], comprehensiveConfig[key as keyof typeof comprehensiveConfig]);
      });
      
      toast({
        title: "Comprehensive configuration loaded",
        description: "Test configuration with realistic data has been loaded successfully.",
      });
    } catch (error) {
      console.error('Error loading comprehensive config:', error);
      toast({
        title: "Load failed",
        description: "Failed to load comprehensive configuration.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingComprehensive(false);
    }
  };

  useEffect(() => {
    hydrateConfig();
  }, [hydrateConfig]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-16"
        } flex flex-col h-full border-r bg-background transition-all duration-300`}
      >
        <div className="flex h-16 items-center border-b px-4">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            {sidebarOpen && (
              <span className="text-xl font-bold">IoT Gateway</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                sidebarOpen ? "rotate-0" : "rotate-180"
              }`}
            />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav
            items={navItems}
            sidebarOpen={sidebarOpen}
            ioPorts={ioPorts}
          />
        </div>
      </div>
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="h-16 border-b flex items-center px-6">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={() => router.push("/onboarding")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">
            Dashboard {deviceId ? `- Device ${deviceId}` : ""}
          </h1>
          <div className="ml-auto flex items-center gap-4">
            {showReconfigureOption && deviceId && (
              <Button variant="outline" onClick={handleReconfigure}>
                Reconfigure Device
              </Button>
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh data</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Actions
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRestartDialogOpen(true)}>
                  Restart Gateway
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                  Export Configuration
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                  Import Configuration
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setResetDialogOpen(true)}>
                  Reset to Defaults
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleLoadComprehensiveConfig}
                  disabled={isLoadingComprehensive}
                >
                  {isLoadingComprehensive ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading Test Config...
                    </>
                  ) : (
                    "Load Test Configuration"
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="ml-4 flex items-center gap-2">
            <label htmlFor="refresh-interval" className="text-xs text-muted-foreground">Refresh:</label>
            <select
              id="refresh-interval"
              value={refreshInterval}
              onChange={e => setRefreshInterval(Number(e.target.value))}
              className="border rounded px-2 py-1 text-xs"
            >
              <option value={1000}>1s</option>
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {isConfiguring && deviceId ? (
            <DeviceConfigurationPanel
              deviceId={deviceId}
              onComplete={handleConfigurationComplete}
            />
          ) : (
            <>
              {/* System status cards - only shown for Overview section */}
              {activeTab === "overview" && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        System Uptime
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboardData ? (
                        <div className="text-2xl font-bold">{dashboardData.system_uptime}</div>
                      ) : (
                        <Loader2 className="animate-spin" />
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        CPU Load
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboardData ? (
                        <>
                          <div className="text-2xl font-bold">{dashboardData.cpu_load}%</div>
                          <Progress value={dashboardData.cpu_load} className="h-2" />
                        </>
                      ) : (
                        <Loader2 className="animate-spin" />
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Memory Usage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboardData && dashboardData.memory ? (
                        <div className="text-2xl font-bold">
                          {dashboardData.memory.used} / {dashboardData.memory.total} {dashboardData.memory.unit || 'MB'}
                          {typeof dashboardData.memory.percent !== 'undefined' && (
                            <span> ({dashboardData.memory.percent.toFixed(1)}%)</span>
                          )}
                        </div>
                      ) : (
                        <Loader2 className="animate-spin" />
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Storage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboardData && dashboardData.storage ? (
                        <div className="text-2xl font-bold">
                          {dashboardData.storage.used} / {dashboardData.storage.total} {dashboardData.storage.unit || 'GB'}
                          {typeof dashboardData.storage.percent !== 'undefined' && (
                            <span> ({dashboardData.storage.percent.toFixed(1)}%)</span>
                          )}
                        </div>
                      ) : (
                        <Loader2 className="animate-spin" />
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Tabs for main sections */}
              <div className="mt-8">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2 md:grid-cols-9">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="network">Network</TabsTrigger>
                    <TabsTrigger
                      value="datacenter"
                      onClick={() => handleNavigation("?tab=datacenter")}
                    >
                      Data Center
                    </TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                    <TabsTrigger value="protocols">Protocols</TabsTrigger>
                    <TabsTrigger value="communication-forward">Communication Forward</TabsTrigger>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                    <TabsTrigger value="configuration">
                      Configuration
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-6 space-y-6">
                    <OverviewTab />
                  </TabsContent>

                  <TabsContent value="network" className="mt-6 space-y-6">
                    <NetworkTab />
                  </TabsContent>

                  <TabsContent value="datacenter">
                    <DataCenterTab
                      section={searchParams.get("section") || ""}
                      selectedPortId={searchParams.get("portId") || ""}
                      selectedDeviceId={searchParams.get("deviceId") || ""}
                    />
                  </TabsContent>

                  <TabsContent value="security" className="mt-6 space-y-6">
                    <SecurityTab />
                  </TabsContent>

                  <TabsContent value="protocols" className="mt-6 space-y-6">
                    <ProtocolsTab />
                  </TabsContent>

                  <TabsContent value="communication-forward" className="mt-6 space-y-6">
                    <CommunicationForwardTab />
                  </TabsContent>

                  <TabsContent value="logs" className="mt-6">
                    <LogsTab />
                  </TabsContent>

                  <TabsContent value="configuration" className="mt-6">
                    <ConfigurationTab />
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
          <div className="flex gap-2 mb-4">
            <button className="btn btn-primary" onClick={async () => {
              await saveConfig();
              toast({ title: "Config saved to backend!" });
            }} disabled={!isDirty}>Save Config</button>
          </div>
        </div>
      </div>
      {/* Dialogs */}
      <RestartGatewayDialog
        open={restartDialogOpen}
        onOpenChange={setRestartDialogOpen}
      />
      <ExportConfigDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
      <ImportConfigDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
      <ResetConfigDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
      />
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
