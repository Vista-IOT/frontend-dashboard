"use client";

import { useState } from "react";
import {
  BarChartIcon as Bar,
  ChevronDown,
  Database,
  Gauge,
  HardDrive,
  type LucideIcon,
  Network,
  RefreshCw,
  Server,
  Settings,
  Shield,
  Wifi,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useHydrateConfigFromBackend, useConfigStore } from "@/hooks/useHydrateConfigFromBackend";

// Types for the navigation items
type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: string;
  submenu?: NavItem[];
};

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const config = useConfigStore(state => state.config);

  useHydrateConfigFromBackend();

  // Navigation items
  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "#",
      icon: Gauge,
      active: true,
    },
    {
      title: "Networking",
      href: "#",
      icon: Network,
      submenu: [
        { title: "Interfaces", href: "#", icon: Wifi },
        { title: "DHCP", href: "#", icon: Database },
        { title: "Routing", href: "#", icon: RefreshCw },
        { title: "Port Forwarding", href: "#", icon: Network },
        { title: "Dynamic DNS", href: "#", icon: Database },
      ],
    },
    {
      title: "Security",
      href: "#",
      icon: Shield,
      submenu: [
        { title: "IPSec VPN", href: "#", icon: Shield },
        { title: "Firewall", href: "#", icon: Shield },
        { title: "IP Binding", href: "#", icon: Database },
      ],
    },
    {
      title: "Remote Management",
      href: "#",
      icon: Server,
      submenu: [
        { title: "Web UI", href: "#", icon: Database },
        { title: "SNMP", href: "#", icon: Database },
      ],
    },
    {
      title: "Industrial Protocols",
      href: "#",
      icon: Database,
      submenu: [
        { title: "DNP3.0", href: "#", icon: Database },
        { title: "OPC-UA", href: "#", icon: Database },
        { title: "Modbus", href: "#", icon: Database },
        { title: "IEC", href: "#", icon: Database },
      ],
    },
    {
      title: "Hardware",
      href: "#",
      icon: HardDrive,
      submenu: [
        { title: "Ethernet", href: "#", icon: Network },
        { title: "COM Ports", href: "#", icon: Database },
        { title: "WiFi", href: "#", icon: Wifi },
        { title: "Watchdog", href: "#", icon: RefreshCw },
      ],
    },
    {
      title: "Settings",
      href: "#",
      icon: Settings,
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-16"
        } bg-muted/40 border-r transition-all duration-300 ease-in-out flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 border-b flex items-center px-4">
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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => (
              <li key={item.title}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 ${
                    item.active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  } ${!sidebarOpen ? "justify-center" : ""}`}
                >
                  <item.icon
                    className={`h-5 w-5 ${!sidebarOpen ? "mx-auto" : ""}`}
                  />
                  {sidebarOpen && (
                    <span className="flex-1 truncate">{item.title}</span>
                  )}
                  {item.badge && sidebarOpen && (
                    <Badge variant="outline" className="ml-auto">
                      {item.badge}
                    </Badge>
                  )}
                </Link>

                {/* Submenu */}
                {item.submenu && sidebarOpen && (
                  <ul className="mt-1 pl-4 space-y-1">
                    {item.submenu.map((subitem) => (
                      <li key={subitem.title}>
                        <Link
                          href={subitem.href}
                          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <subitem.icon className="h-4 w-4" />
                          <span className="flex-1 truncate">
                            {subitem.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            {sidebarOpen && (
              <div className="flex flex-1 justify-between">
                <span className="text-sm font-medium">System Status</span>
                <span className="text-sm text-muted-foreground">Online</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="h-16 border-b flex items-center px-6">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <div className="ml-auto flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon">
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
                <DropdownMenuItem>Restart Gateway</DropdownMenuItem>
                <DropdownMenuItem>Export Configuration</DropdownMenuItem>
                <DropdownMenuItem>Import Configuration</DropdownMenuItem>
                <DropdownMenuItem>Reset to Defaults</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {/* System status cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  System Uptime
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">10d 14h 32m</div>
                <p className="text-xs text-muted-foreground">
                  Last restart: 2023-06-15 08:23:45
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">CPU Load</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">24%</div>
                <Progress value={24} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">512MB / 2GB</div>
                <Progress value={25} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Storage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2.1GB / 8GB</div>
                <Progress value={26} className="h-2" />
              </CardContent>
            </Card>
          </div>

          {/* Tabs for main sections */}
          <div className="mt-8">
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2 md:grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="network">Network</TabsTrigger>
                {config.security.ssh.enabled && <TabsTrigger value="security">Security</TabsTrigger>}
                {(config.protocols.modbus.enabled || config.protocols.mqtt.enabled) && <TabsTrigger value="protocols">Protocols</TabsTrigger>}
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-6">
                {/* Status summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>System Status</CardTitle>
                    <CardDescription>
                      Overall status of your IoT Gateway
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      <div className="flex items-center gap-4">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <div>
                          <div className="font-medium">Network</div>
                          <div className="text-sm text-muted-foreground">
                            Connected
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <div>
                          <div className="font-medium">VPN</div>
                          <div className="text-sm text-muted-foreground">
                            Connected
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-3 w-3 rounded-full bg-yellow-500" />
                        <div>
                          <div className="font-medium">Modbus</div>
                          <div className="text-sm text-muted-foreground">
                            Partial
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <div>
                          <div className="font-medium">OPC-UA</div>
                          <div className="text-sm text-muted-foreground">
                            Connected
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <div>
                          <div className="font-medium">DNP3.0</div>
                          <div className="text-sm text-muted-foreground">
                            Disconnected
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <div>
                          <div className="font-medium">Watchdog</div>
                          <div className="text-sm text-muted-foreground">
                            Active
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Interface summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Network Interfaces</CardTitle>
                    <CardDescription>
                      Status of network interfaces and connectivity
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-2 md:grid-cols-4">
                        <div className="font-medium">Interface</div>
                        <div className="font-medium">IP Address</div>
                        <div className="font-medium">Status</div>
                        <div className="font-medium">Traffic</div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-4 border-t pt-2">
                        <div>eth0 (WAN)</div>
                        <div>192.168.1.100</div>
                        <div className="flex items-center">
                          <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                          Connected
                        </div>
                        <div>
                          <div className="flex items-center text-sm">
                            <Bar className="h-3 w-3 mr-1 text-green-500" />
                            <span>TX: 1.2 MB/s</span>
                          </div>
                          <div className="flex items-center text-sm">
                            <Bar className="h-3 w-3 mr-1 rotate-180 text-blue-500" />
                            <span>RX: 256 KB/s</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-4 border-t pt-2">
                        <div>eth1 (LAN)</div>
                        <div>10.0.0.1</div>
                        <div className="flex items-center">
                          <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                          Connected
                        </div>
                        <div>
                          <div className="flex items-center text-sm">
                            <Bar className="h-3 w-3 mr-1 text-green-500" />
                            <span>TX: 350 KB/s</span>
                          </div>
                          <div className="flex items-center text-sm">
                            <Bar className="h-3 w-3 mr-1 rotate-180 text-blue-500" />
                            <span>RX: 2.1 MB/s</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-4 border-t pt-2">
                        <div>wlan0</div>
                        <div>10.0.0.2</div>
                        <div className="flex items-center">
                          <div className="h-2 w-2 rounded-full bg-yellow-500 mr-2" />
                          Limited
                        </div>
                        <div>
                          <div className="flex items-center text-sm">
                            <Bar className="h-3 w-3 mr-1 text-green-500" />
                            <span>TX: 50 KB/s</span>
                          </div>
                          <div className="flex items-center text-sm">
                            <Bar className="h-3 w-3 mr-1 rotate-180 text-blue-500" />
                            <span>RX: 120 KB/s</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="ml-auto">
                      View All Interfaces
                    </Button>
                  </CardFooter>
                </Card>

                {/* Industrial protocols */}
                <Card>
                  <CardHeader>
                    <CardTitle>Protocol Status</CardTitle>
                    <CardDescription>
                      Status of configured industrial protocols
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-2 md:grid-cols-4">
                        <div className="font-medium">Protocol</div>
                        <div className="font-medium">Mode</div>
                        <div className="font-medium">Status</div>
                        <div className="font-medium">Connections</div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-4 border-t pt-2">
                        <div>Modbus TCP</div>
                        <div>Server</div>
                        <div className="flex items-center">
                          <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                          Running
                        </div>
                        <div>3 active</div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-4 border-t pt-2">
                        <div>Modbus RTU</div>
                        <div>Client</div>
                        <div className="flex items-center">
                          <div className="h-2 w-2 rounded-full bg-yellow-500 mr-2" />
                          Partial
                        </div>
                        <div>1 active, 2 failed</div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-4 border-t pt-2">
                        <div>OPC-UA</div>
                        <div>Server</div>
                        <div className="flex items-center">
                          <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                          Running
                        </div>
                        <div>1 active</div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-4 border-t pt-2">
                        <div>DNP3.0</div>
                        <div>Server</div>
                        <div className="flex items-center">
                          <div className="h-2 w-2 rounded-full bg-red-500 mr-2" />
                          Stopped
                        </div>
                        <div>0 active</div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="ml-auto">
                      Manage Protocols
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="network" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Network Configuration</CardTitle>
                    <CardDescription>
                      Manage network interfaces, routing, and DHCP
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p>
                        Configure network interfaces and related services in
                        this section. The gateway supports DHCP (client and
                        server), static routes, traffic routing, port
                        forwarding, NAT, and dynamic DNS.
                      </p>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Network className="h-6 w-6" />
                          <span>Ethernet Interfaces</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Database className="h-6 w-6" />
                          <span>DHCP Server</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <RefreshCw className="h-6 w-6" />
                          <span>Static Routes</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Network className="h-6 w-6" />
                          <span>Port Forwarding</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Database className="h-6 w-6" />
                          <span>Dynamic DNS</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Wifi className="h-6 w-6" />
                          <span>WiFi Settings</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {config.security.ssh.enabled && <TabsContent value="security" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Security Configuration</CardTitle>
                    <CardDescription>
                      Manage VPN, firewall, and security settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p>
                        Configure security features including IPSec VPN (IKEv1,
                        IKEv2), zone-based firewall, and source/destination IP
                        binding. Ensure secure communication and protect your
                        IoT devices.
                      </p>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Shield className="h-6 w-6" />
                          <span>IPSec VPN</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Shield className="h-6 w-6" />
                          <span>Zone-Based Firewall</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Database className="h-6 w-6" />
                          <span>IP Binding</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Shield className="h-6 w-6" />
                          <span>Encryption Settings</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Shield className="h-6 w-6" />
                          <span>Certificate Management</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Shield className="h-6 w-6" />
                          <span>Security Audit</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>}

              {(config.protocols.modbus.enabled || config.protocols.mqtt.enabled) && <TabsContent value="protocols" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Industrial Protocols</CardTitle>
                    <CardDescription>
                      Manage industrial communication protocols
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p>
                        Configure industrial protocols including DNP3.0, OPC-UA,
                        IEC protocols, and Modbus RTU/TCP. Set up both client
                        and server modes for flexible system integration.
                      </p>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Database className="h-6 w-6" />
                          <span>DNP3.0</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Database className="h-6 w-6" />
                          <span>OPC-UA</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Database className="h-6 w-6" />
                          <span>Modbus RTU/TCP</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Database className="h-6 w-6" />
                          <span>IEC Protocols</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Database className="h-6 w-6" />
                          <span>Protocol Conversion</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col items-center justify-center gap-2"
                        >
                          <Database className="h-6 w-6" />
                          <span>Data Mapping</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>}

              <TabsContent value="logs" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>System Logs</CardTitle>
                    <CardDescription>
                      View system logs and events
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <Button variant="outline">System</Button>
                        <Button variant="outline">Network</Button>
                        <Button variant="outline">VPN</Button>
                        <Button variant="outline">Protocols</Button>
                        <Button variant="outline">Watchdog</Button>
                      </div>
                      <div className="bg-muted p-4 rounded-md h-[400px] overflow-y-auto text-sm">
                        <div className="space-y-2">
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:23:45]
                            </span>{" "}
                            <span className="bg-green-500/10 text-green-700 px-1 rounded">
                              INFO
                            </span>{" "}
                            System started successfully
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:23:46]
                            </span>{" "}
                            <span className="bg-green-500/10 text-green-700 px-1 rounded">
                              INFO
                            </span>{" "}
                            Interface eth0 up with IP 192.168.1.100
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:23:47]
                            </span>{" "}
                            <span className="bg-green-500/10 text-green-700 px-1 rounded">
                              INFO
                            </span>{" "}
                            Interface eth1 up with IP 10.0.0.1
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:23:48]
                            </span>{" "}
                            <span className="bg-green-500/10 text-green-700 px-1 rounded">
                              INFO
                            </span>{" "}
                            DHCP server started on eth1
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:23:50]
                            </span>{" "}
                            <span className="bg-green-500/10 text-green-700 px-1 rounded">
                              INFO
                            </span>{" "}
                            IPsec service started
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:24:01]
                            </span>{" "}
                            <span className="bg-green-500/10 text-green-700 px-1 rounded">
                              INFO
                            </span>{" "}
                            IPsec tunnel established with peer vpn.example.com
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:24:15]
                            </span>{" "}
                            <span className="bg-green-500/10 text-green-700 px-1 rounded">
                              INFO
                            </span>{" "}
                            Modbus TCP server started on port 502
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:24:30]
                            </span>{" "}
                            <span className="bg-yellow-500/10 text-yellow-700 px-1 rounded">
                              WARN
                            </span>{" "}
                            Failed to connect to Modbus RTU device on COM1
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:25:00]
                            </span>{" "}
                            <span className="bg-green-500/10 text-green-700 px-1 rounded">
                              INFO
                            </span>{" "}
                            OPC-UA server started on port 4840
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:25:45]
                            </span>{" "}
                            <span className="bg-red-500/10 text-red-700 px-1 rounded">
                              ERROR
                            </span>{" "}
                            DNP3.0 server failed to start: configuration error
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:26:10]
                            </span>{" "}
                            <span className="bg-green-500/10 text-green-700 px-1 rounded">
                              INFO
                            </span>{" "}
                            Client connected to Modbus TCP server (10.0.0.5)
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:27:23]
                            </span>{" "}
                            <span className="bg-green-500/10 text-green-700 px-1 rounded">
                              INFO
                            </span>{" "}
                            Watchdog service started with timeout 30s
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:30:12]
                            </span>{" "}
                            <span className="bg-yellow-500/10 text-yellow-700 px-1 rounded">
                              WARN
                            </span>{" "}
                            High CPU usage detected: 78%
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              [2023-06-15 14:32:45]
                            </span>{" "}
                            <span className="bg-green-500/10 text-green-700 px-1 rounded">
                              INFO
                            </span>{" "}
                            DDNS update successful for hostname
                            iot-gateway.example.com
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline">Export Logs</Button>
                    <Button variant="outline" className="ml-2">
                      Clear Logs
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
