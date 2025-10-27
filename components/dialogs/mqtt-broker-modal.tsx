"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

export interface MqttBroker {
  id: string
  name: string
  address: string
  port: number
  clientId: string
  keepalive: number
  cleanSession: boolean
  protocol: "mqtt" | "mqtts" | "ws" | "wss"
  auth: {
    enabled: boolean
    username?: string
    password?: string
  }
  tls: {
    enabled: boolean
    verifyServer: boolean
    allowInsecure: boolean
    certFile?: string
    keyFile?: string
    caFile?: string
  }
  enabled: boolean
}

interface BrokerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (broker: Partial<MqttBroker>) => void
  initialData?: MqttBroker | null
}

export function MQTTBrokerModal({ open, onOpenChange, onSave, initialData }: BrokerModalProps) {
  const [formData, setFormData] = useState<Partial<MqttBroker>>(
    initialData || {
      name: "",
      address: "localhost",
      port: 1883,
      clientId: `iot-gateway-${Date.now()}`,
      keepalive: 60,
      cleanSession: true,
      protocol: "mqtt",
      auth: { enabled: false, username: "", password: "" },
      tls: { enabled: false, verifyServer: true, allowInsecure: false },
      enabled: true,
    }
  )

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    }
  }, [initialData, open])

  const handleSave = () => {
    if (!formData.name || !formData.address) {
      toast.error("Please fill in required fields")
      return
    }
    onSave(formData)
    toast.success(initialData ? "Broker updated successfully" : "Broker added successfully")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit MQTT Broker" : "Add MQTT Broker"}
          </DialogTitle>
          <DialogDescription>
            Configure MQTT broker connection settings including authentication and TLS/SSL
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Basic Configuration
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Broker Name *</label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Production MQTT"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Protocol</label>
                <Select value={formData.protocol || "mqtt"} onValueChange={(value: any) => setFormData({ ...formData, protocol: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mqtt">MQTT (TCP)</SelectItem>
                    <SelectItem value="mqtts">MQTT (TLS)</SelectItem>
                    <SelectItem value="ws">WebSocket</SelectItem>
                    <SelectItem value="wss">WebSocket (TLS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Broker Address *</label>
                <Input
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g., mqtt.example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Port</label>
                <Input
                  type="number"
                  value={formData.port || 1883}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                  min="1"
                  max="65535"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Client ID</label>
              <Input
                value={formData.clientId || ""}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                placeholder="e.g., iot-gateway-001"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Keep Alive (seconds)</label>
                <Input
                  type="number"
                  value={formData.keepalive || 60}
                  onChange={(e) => setFormData({ ...formData, keepalive: parseInt(e.target.value) })}
                  min="0"
                  max="3600"
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.cleanSession ?? true}
                    onCheckedChange={(checked) => setFormData({ ...formData, cleanSession: checked as boolean })}
                  />
                  <span className="text-sm font-medium">Clean Session</span>
                </label>
              </div>
            </div>
          </div>

          {/* Authentication Section */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                Authentication
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.auth?.enabled ?? false}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    auth: { ...formData.auth, enabled: checked as boolean }
                  })}
                />
                <span className="text-sm font-medium">Enable</span>
              </label>
            </div>

            {formData.auth?.enabled && (
              <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-primary/30">
                <div>
                  <label className="text-sm font-medium">Username</label>
                  <Input
                    value={formData.auth?.username || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      auth: { ...formData.auth, username: e.target.value }
                    })}
                    placeholder="Username"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    value={formData.auth?.password || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      auth: { ...formData.auth, password: e.target.value }
                    })}
                    placeholder="Password"
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* TLS/SSL Section */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                TLS/SSL Configuration
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.tls?.enabled ?? false}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    tls: { ...formData.tls, enabled: checked as boolean }
                  })}
                />
                <span className="text-sm font-medium">Enable</span>
              </label>
            </div>

            {formData.tls?.enabled && (
              <div className="space-y-4 pl-4 border-l-2 border-primary/30">
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.tls?.verifyServer ?? true}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        tls: { ...formData.tls, verifyServer: checked as boolean }
                      })}
                    />
                    <span className="text-sm font-medium">Verify Server</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.tls?.allowInsecure ?? false}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        tls: { ...formData.tls, allowInsecure: checked as boolean }
                      })}
                    />
                    <span className="text-sm font-medium">Allow Insecure</span>
                  </label>
                </div>

                <div>
                  <label className="text-sm font-medium">CA Certificate File</label>
                  <Input
                    value={formData.tls?.caFile || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      tls: { ...formData.tls, caFile: e.target.value }
                    })}
                    placeholder="/path/to/ca.crt"
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Client Certificate</label>
                    <Input
                      value={formData.tls?.certFile || ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        tls: { ...formData.tls, certFile: e.target.value }
                      })}
                      placeholder="/path/to/client.crt"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Client Key File</label>
                    <Input
                      value={formData.tls?.keyFile || ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        tls: { ...formData.tls, keyFile: e.target.value }
                      })}
                      placeholder="/path/to/client.key"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formData.enabled ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked as boolean })}
              />
              <span className="text-sm font-medium">Enable this broker</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {initialData ? "Update Broker" : "Add Broker"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
