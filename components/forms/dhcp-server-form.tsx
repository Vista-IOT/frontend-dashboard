"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { RefreshCw } from "lucide-react"

export function DHCPServerForm() {
  const { updateConfig, getConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)
  
  // Get current configuration
  const config = getConfig()
  const dhcpConfig = config.network.dhcp_server
  const [enabled, setEnabled] = useState(dhcpConfig.enabled)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      const formData = new FormData(e.target as HTMLFormElement)
      
      const dhcpData = {
        enabled: enabled,
        start_ip: formData.get("start-ip") as string,
        end_ip: formData.get("end-ip") as string,
        lease_time: parseInt(formData.get("lease-time") as string) || 24,
        domain: formData.get("domain") as string,
        dns_servers: (formData.get("dns") as string)?.split(",").map(s => s.trim()).filter(s => s) || [],
      }
      
      updateConfig(['network', 'dhcp_server'], dhcpData)
      
      toast.success("DHCP server settings have been updated!", { duration: 3000 })
    } catch (error) {
      console.error('Error saving DHCP settings:', error)
      toast.error("Failed to save DHCP server settings.", { duration: 5000 })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>DHCP Server</CardTitle>
          <CardDescription>Configure DHCP server settings for the LAN</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dhcp-enabled">Enable DHCP Server</Label>
            <Switch 
              id="dhcp-enabled" 
              name="dhcp-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-ip">Start IP Address</Label>
                  <Input 
                    id="start-ip" 
                    name="start-ip"
                    placeholder="10.0.0.100" 
                    defaultValue={dhcpConfig.start_ip}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-ip">End IP Address</Label>
                  <Input 
                    id="end-ip" 
                    name="end-ip"
                    placeholder="10.0.0.200" 
                    defaultValue={dhcpConfig.end_ip}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lease-time">Lease Time (hours)</Label>
                  <Input 
                    id="lease-time" 
                    name="lease-time"
                    placeholder="24" 
                    type="number" 
                    defaultValue={dhcpConfig.lease_time}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain Name</Label>
                  <Input 
                    id="domain" 
                    name="domain"
                    placeholder="local" 
                    defaultValue={dhcpConfig.domain}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dns">DNS Servers (comma separated)</Label>
                <Input 
                  id="dns" 
                  name="dns"
                  placeholder="8.8.8.8, 8.8.4.4" 
                  defaultValue={dhcpConfig.dns_servers.join(", ")}
                />
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

