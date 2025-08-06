"use client"

import { Server } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface DeviceCardProps {
  device: {
    id: string
    name: string
    ip: string
    mac: string
    model: string
    status: string
    configured: boolean
    lastSeen: string
    cpu: number
    memory: number
    storage: number
  }
  onRegister: () => void
}

export function DeviceCard({ device, onRegister }: DeviceCardProps) {
  const router = useRouter()

  const handleConfigureClick = () => {
    router.push(`/?device=${device.id}`)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-medium">{device.name}</CardTitle>
          <Badge
            variant={device.status === "online" ? "default" : device.status === "warning" ? "outline" : "destructive"}
            className={
              device.status === "online"
                ? "bg-green-500"
                : device.status === "warning"
                  ? "border-yellow-500 text-yellow-500"
                  : ""
            }
          >
            {device.status === "online" ? "Online" : device.status === "warning" ? "Warning" : "Offline"}
          </Badge>
        </div>
        <div className="flex items-center text-sm text-muted-foreground">
          <Server className="h-4 w-4 mr-1" />
          {device.model}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">IP Address</div>
            <div className="font-medium">{device.ip}</div>
            <div className="text-muted-foreground">MAC Address</div>
            <div className="font-medium">{device.mac}</div>
            <div className="text-muted-foreground">Last Seen</div>
            <div className="font-medium">{device.lastSeen}</div>
            <div className="text-muted-foreground">Configuration</div>
            <div className="font-medium">
              {device.configured ? (
                <span className="text-green-600">Configured</span>
              ) : (
                <span className="text-yellow-600">Default</span>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CPU</span>
              <span>{device.cpu}%</span>
            </div>
            <Progress
              value={device.cpu}
              className="h-1"
            />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Memory</span>
              <span>{device.memory}%</span>
            </div>
            <Progress
              value={device.memory}
              className="h-1"
            />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Storage</span>
              <span>{device.storage}%</span>
            </div>
            <Progress
              value={device.storage}
              className="h-1"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onRegister}>
          {device.configured ? "Edit" : "Register"}
        </Button>
        <Button size="sm" disabled={device.status === "offline"} onClick={handleConfigureClick}>
          {device.configured ? "Manage" : "Configure"}
        </Button>
      </CardFooter>
    </Card>
  )
}

