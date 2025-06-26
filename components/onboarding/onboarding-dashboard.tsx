"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  HardDrive,
  Network,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

import { DeviceDiscoveryDialog } from "@/components/onboarding/device-discovery-dialog";
import { DeviceRegistrationDialog } from "@/components/onboarding/device-registration-dialog";
import { DeviceCard } from "@/components/onboarding/device-card";
import { BaremetalDeviceLayout } from "@/components/onboarding/baremetal-device-layout";
import { SidebarNav } from "@/components/sidebar-nav";
import { NetworkGraph } from "@/components/network-graph";

// Sample device data
const discoveredDevices = [
  {
    id: "gw-001",
    name: "Gateway-001",
    ip: "192.168.1.100",
    mac: "00:11:22:33:44:55",
    model: "IoT-GW-5000",
    status: "online",
    configured: true,
    lastSeen: "2 minutes ago",
    cpu: 24,
    memory: 35,
    storage: 42,
  },
  {
    id: "gw-002",
    name: "Gateway-002",
    ip: "192.168.1.101",
    mac: "00:11:22:33:44:56",
    model: "IoT-GW-5000",
    status: "online",
    configured: false,
    lastSeen: "5 minutes ago",
    cpu: 12,
    memory: 28,
    storage: 15,
  },
  {
    id: "gw-003",
    name: "Gateway-003",
    ip: "192.168.1.102",
    mac: "00:11:22:33:44:57",
    model: "IoT-GW-3000",
    status: "offline",
    configured: true,
    lastSeen: "3 hours ago",
    cpu: 0,
    memory: 0,
    storage: 22,
  },
  {
    id: "gw-004",
    name: "Gateway-004",
    ip: "192.168.1.103",
    mac: "00:11:22:33:44:58",
    model: "IoT-GW-3000",
    status: "warning",
    configured: true,
    lastSeen: "1 minute ago",
    cpu: 85,
    memory: 92,
    storage: 78,
  },
];

// Navigation items for the sidebar
const navItems = [
  {
    title: "Onboarding",
    href: "/onboarding",
    icon: Server,
    active: true,
  },
  {
    title: "Dashboard",
    href: "/",
    icon: Activity,
  },
  {
    title: "Devices",
    href: "/devices",
    icon: HardDrive,
  },
  {
    title: "Network",
    href: "/network",
    icon: Network,
  },
  {
    title: "Security",
    href: "/security",
    icon: Shield,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export default function OnboardingDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [discoveryDialogOpen, setDiscoveryDialogOpen] = useState(false);
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const { toast } = useToast();

  // Filter devices based on search query
  const filteredDevices = discoveredDevices.filter(
    (device) =>
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.ip.includes(searchQuery) ||
      device.mac.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefresh = () => {
    toast({
      title: "Refreshing device list",
      description: "Scanning network for devices...",
    });
  };

  const handleRegisterDevice = (device: any) => {
    setSelectedDevice(device);
    setRegistrationDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 space-y-4 p-8 pt-6">
        {/* Header */}
        <header className="h-16 border-b flex items-center px-6">
          <h1 className="text-xl font-bold">Device Onboarding</h1>
          <div className="ml-auto flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiscoveryDialogOpen(true)}
            >
              <Search className="h-4 w-4 mr-2" />
              Discover Device
            </Button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <div className="col-span-4">
            <Tabs defaultValue="discovered">
              <TabsList>
                <TabsTrigger value="discovered">Discovered Devices</TabsTrigger>
                <TabsTrigger value="metrics">Monitoring Metrics</TabsTrigger>
                <TabsTrigger value="baremetal">Baremetal View</TabsTrigger>
              </TabsList>

              <TabsContent value="discovered" className="mt-6">
                {/* Search and filter */}
                <div className="flex items-center mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search devices by name, IP, or MAC address..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button
                    className="ml-4"
                    onClick={() => setDiscoveryDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Device
                  </Button>
                </div>

                {/* Device grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredDevices.map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      onRegister={() => handleRegisterDevice(device)}
                    />
                  ))}
                </div>

                {filteredDevices.length === 0 && (
                  <div className="text-center py-12">
                    <Server className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">
                      No devices found
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      No devices match your search criteria. Try adjusting your
                      search or discover new devices.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => setDiscoveryDialogOpen(true)}
                    >
                      Discover Devices
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="metrics" className="mt-6">
                {/* System metrics */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Devices
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {discoveredDevices.length}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        Last updated: 2 minutes ago
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Online Devices
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {
                          discoveredDevices.filter((d) => d.status === "online")
                            .length
                        }
                      </div>
                      <Progress
                        value={
                          (discoveredDevices.filter(
                            (d) => d.status === "online"
                          ).length /
                            discoveredDevices.length) *
                          100
                        }
                        className="h-2"
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Configured Devices
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {discoveredDevices.filter((d) => d.configured).length}
                      </div>
                      <Progress
                        value={
                          (discoveredDevices.filter((d) => d.configured)
                            .length /
                            discoveredDevices.length) *
                          100
                        }
                        className="h-2"
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Alerts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {
                          discoveredDevices.filter(
                            (d) => d.status === "warning"
                          ).length
                        }
                      </div>
                      <div className="flex items-center text-xs text-yellow-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {
                          discoveredDevices.filter(
                            (d) => d.status === "warning"
                          ).length
                        }{" "}
                        devices need attention
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Network health */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Network Health</CardTitle>
                    <CardDescription>
                      Overall status of your IoT network
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-2 md:grid-cols-4">
                        <div className="font-medium">Device</div>
                        <div className="font-medium">Status</div>
                        <div className="font-medium">CPU Load</div>
                        <div className="font-medium">Memory Usage</div>
                      </div>
                      {discoveredDevices.map((device) => (
                        <div
                          key={device.id}
                          className="grid gap-2 md:grid-cols-4 border-t pt-2"
                        >
                          <div className="flex items-center">
                            <Server className="h-4 w-4 mr-2 text-muted-foreground" />
                            <div>
                              <div>{device.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {device.ip}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <div
                              className={`h-2 w-2 rounded-full mr-2 ${
                                device.status === "online"
                                  ? "bg-green-500"
                                  : device.status === "warning"
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                            />
                            <span className="capitalize">{device.status}</span>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm">{device.cpu}%</span>
                            </div>
                            <Progress
                              value={device.cpu}
                              className="h-2"
                              indicatorClassName={
                                device.cpu > 80
                                  ? "bg-red-500"
                                  : device.cpu > 60
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm">{device.memory}%</span>
                            </div>
                            <Progress
                              value={device.memory}
                              className="h-2"
                              indicatorClassName={
                                device.memory > 80
                                  ? "bg-red-500"
                                  : device.memory > 60
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent activities */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activities</CardTitle>
                    <CardDescription>
                      Latest events from your IoT network
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                          <CheckCircle2 className="h-5 w-5 text-blue-700" />
                        </div>
                        <div>
                          <p className="font-medium">
                            Gateway-001 configured successfully
                          </p>
                          <p className="text-sm text-muted-foreground">
                            10 minutes ago
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center mr-3">
                          <Network className="h-5 w-5 text-green-700" />
                        </div>
                        <div>
                          <p className="font-medium">
                            Gateway-002 discovered on network
                          </p>
                          <p className="text-sm text-muted-foreground">
                            25 minutes ago
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-yellow-100 flex items-center justify-center mr-3">
                          <AlertTriangle className="h-5 w-5 text-yellow-700" />
                        </div>
                        <div>
                          <p className="font-medium">
                            Gateway-004 high CPU usage detected
                          </p>
                          <p className="text-sm text-muted-foreground">
                            1 hour ago
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center mr-3">
                          <AlertTriangle className="h-5 w-5 text-red-700" />
                        </div>
                        <div>
                          <p className="font-medium">
                            Gateway-003 went offline
                          </p>
                          <p className="text-sm text-muted-foreground">
                            3 hours ago
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full">
                      View All Activities
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="baremetal" className="mt-6">
                <BaremetalDeviceLayout />
              </TabsContent>
            </Tabs>
          </div>

          <div className="col-span-3">
            <NetworkGraph />
          </div>

          {/* Recent activities card */}
          <div className="col-span-full">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activities</CardTitle>
                <CardDescription>
                  Latest events from your IoT network
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                      <CheckCircle2 className="h-5 w-5 text-blue-700" />
                    </div>
                    <div>
                      <p className="font-medium">
                        Gateway-001 configured successfully
                      </p>
                      <p className="text-sm text-muted-foreground">
                        10 minutes ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center mr-3">
                      <Network className="h-5 w-5 text-green-700" />
                    </div>
                    <div>
                      <p className="font-medium">
                        Gateway-002 discovered on network
                      </p>
                      <p className="text-sm text-muted-foreground">
                        25 minutes ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="h-9 w-9 rounded-full bg-yellow-100 flex items-center justify-center mr-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-700" />
                    </div>
                    <div>
                      <p className="font-medium">
                        Gateway-004 high CPU usage detected
                      </p>
                      <p className="text-sm text-muted-foreground">
                        1 hour ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center mr-3">
                      <AlertTriangle className="h-5 w-5 text-red-700" />
                    </div>
                    <div>
                      <p className="font-medium">Gateway-003 went offline</p>
                      <p className="text-sm text-muted-foreground">
                        3 hours ago
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  View All Activities
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>

      {/* Dialogs */}
      <DeviceDiscoveryDialog
        open={discoveryDialogOpen}
        onOpenChange={setDiscoveryDialogOpen}
      />
      <DeviceRegistrationDialog
        open={registrationDialogOpen}
        onOpenChange={setRegistrationDialogOpen}
        device={selectedDevice}
      />
    </div>
  );
}
