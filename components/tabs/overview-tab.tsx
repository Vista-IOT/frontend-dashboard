import { BarChartIcon as Bar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { Loader2 } from "lucide-react";

export default function OverviewTab() {
  const data = useDashboardOverview();
  if (!data) {
    return <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;
  }
  const protocolStatusColor = (status: string) => {
    if (status === "connected" || status === "running" || status === "active") return "bg-green-500";
    if (status === "partial") return "bg-yellow-500";
    if (status === "disconnected" || status === "stopped") return "bg-red-500";
    return "bg-gray-400";
  };
  const protocols = [
    { name: "Network", status: data.protocols?.network || "connected" },
    { name: "VPN", status: data.protocols?.vpn || "connected" },
    { name: "Modbus", status: data.protocols?.modbus || "partial" },
    { name: "OPC-UA", status: data.protocols?.opcua || "connected" },
  ];
  return (
    <>
      {/* Status summary */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Overall status of your IoT Gateway</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {protocols.map((p) => (
              <div className="flex items-center gap-4" key={p.name}>
                <div className={`h-3 w-3 rounded-full ${protocolStatusColor(p.status)}`} />
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-muted-foreground">{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Interface summary */}
      <Card>
        <CardHeader>
          <CardTitle>Network Interfaces</CardTitle>
          <CardDescription>Status of network interfaces and connectivity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-4">
              <div className="font-medium">Interface</div>
              <div className="font-medium">IP Address</div>
              <div className="font-medium">Status</div>
              <div className="font-medium">Traffic</div>
            </div>
            {data.network_interfaces?.map((iface: any) => (
              <div className="grid gap-2 md:grid-cols-4 border-t pt-2" key={iface.name}>
                <div>{iface.name}</div>
                <div>{iface.ip && iface.ip !== "N/A" ? iface.ip : <span className="text-muted-foreground">N/A</span>}</div>
                <div className="flex items-center">
                  <div className={`h-2 w-2 rounded-full ${protocolStatusColor(iface.status)} mr-2`} />
                  {iface.status.charAt(0).toUpperCase() + iface.status.slice(1)}
                </div>
                <div>
                  <div className="flex items-center text-sm">
                    <Bar className="h-3 w-3 mr-1 text-green-500" />
                    <span>TX: {iface.tx}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Bar className="h-3 w-3 mr-1 rotate-180 text-blue-500" />
                    <span>RX: {iface.rx}</span>
                  </div>
                </div>
              </div>
            ))}
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
          <CardDescription>Status of configured industrial protocols</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-4">
              <div className="font-medium">Protocol</div>
              <div className="font-medium">Mode</div>
              <div className="font-medium">Status</div>
              <div className="font-medium">Connections</div>
            </div>
            {Object.entries(data.protocols || {})
              .filter(([name]) => name !== 'dnp3' && name !== 'watchdog')
              .map(([name, status]: [string, any]) => (
              <div className="grid gap-2 md:grid-cols-4 border-t pt-2" key={name}>
                <div>{name}</div>
                <div>-</div>
                <div className="flex items-center">
                  <div className={`h-2 w-2 rounded-full ${protocolStatusColor(status)} mr-2`} />
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
                <div>-</div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="ml-auto">
            Manage Protocols
          </Button>
        </CardFooter>
      </Card>

      {/* System resource summary */}
      <Card>
        <CardHeader>
          <CardTitle>System Resources</CardTitle>
          <CardDescription>Live system resource usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="font-medium">System Uptime</div>
              <div>{data.system_uptime}</div>
            </div>
            <div>
              <div className="font-medium">CPU Load</div>
              <div>{data.cpu_load}%</div>
            </div>
            <div>
              <div className="font-medium">Memory Usage</div>
              <div>
                {data.memory?.used} / {data.memory?.total} {data.memory?.unit || 'MB'}
                {typeof data.memory?.free !== 'undefined' && (
                  <span> (Free: {data.memory.free} {data.memory.unit || 'MB'})</span>
                )}
                {typeof data.memory?.percent !== 'undefined' && (
                  <span> ({data.memory.percent.toFixed(1)}%)</span>
                )}
              </div>
            </div>
            <div>
              <div className="font-medium">Storage Usage</div>
              <div>
                {data.storage?.used} / {data.storage?.total} {data.storage?.unit || 'GB'}
                {typeof data.storage?.free !== 'undefined' && (
                  <span> (Free: {data.storage.free} {data.storage.unit || 'GB'})</span>
                )}
                {typeof data.storage?.percent !== 'undefined' && (
                  <span> ({data.storage.percent.toFixed(1)}%)</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

