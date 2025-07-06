"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { RefreshCw } from "lucide-react"

export function EthernetInterfaceForm() {
  const { toast } = useToast()
  const { updateConfig, getConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)
  
  // Get current configuration
  const config = getConfig()
  const eth0Config = config.network.interfaces.eth0
  const wlan0Config = config.network.interfaces.wlan0

  const handleEth0Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      const formData = new FormData(e.target as HTMLFormElement)
      
      const eth0Data = {
        type: "ethernet",
        enabled: formData.get("eth0-enabled") === "on",
        mode: formData.get("eth0-mode") as string,
        link: {
          speed: formData.get("eth0-speed") as string,
          duplex: formData.get("eth0-duplex") as string,
        },
        ipv4: {
          mode: formData.get("eth0-ipv4-mode") as string,
          static: {
            address: formData.get("eth0-ip-address") as string || "",
            netmask: formData.get("eth0-subnet-mask") as string || "",
            gateway: formData.get("eth0-gateway") as string || "",
          },
          dns: {
            primary: formData.get("eth0-dns-primary") as string || "",
            secondary: formData.get("eth0-dns-secondary") as string || "",
          },
        },
      }
      
      updateConfig(['network', 'interfaces', 'eth0'], eth0Data)
      
      toast({
        title: "Settings saved",
        description: "Ethernet interface (eth0) settings have been updated.",
      })
    } catch (error) {
      console.error('Error saving eth0 settings:', error)
      toast({
        title: "Error",
        description: "Failed to save ethernet interface settings.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleWlan0Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      const formData = new FormData(e.target as HTMLFormElement)
      
      const wlan0Data = {
        type: "wireless",
        enabled: formData.get("wlan0-enabled") === "on",
        mode: formData.get("wlan0-mode") as string,
        wifi: {
          ssid: formData.get("wlan0-ssid") as string || "",
          security: {
            mode: formData.get("wlan0-security-mode") as string,
            password: formData.get("wlan0-password") as string || "",
          },
          channel: formData.get("wlan0-channel") as string,
          band: formData.get("wlan0-band") as string,
          hidden: formData.get("wlan0-hidden") === "on",
        },
        ipv4: {
          mode: formData.get("wlan0-ipv4-mode") as string,
          static: {
            address: formData.get("wlan0-ip-address") as string || "",
            netmask: formData.get("wlan0-subnet-mask") as string || "",
            gateway: formData.get("wlan0-gateway") as string || "",
          },
        },
      }
      
      updateConfig(['network', 'interfaces', 'wlan0'], wlan0Data)
      
    toast({
      title: "Settings saved",
        description: "Wireless interface (wlan0) settings have been updated.",
    })
    } catch (error) {
      console.error('Error saving wlan0 settings:', error)
      toast({
        title: "Error",
        description: "Failed to save wireless interface settings.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
      <div className="space-y-4">
      {/* Ethernet Interface (eth0) */}
      <form onSubmit={handleEth0Submit}>
        <Card>
          <CardHeader>
            <CardTitle>Ethernet Interface (eth0)</CardTitle>
            <CardDescription>Configure WAN interface settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="eth0-enabled">Enable Interface</Label>
              <Switch 
                id="eth0-enabled" 
                name="eth0-enabled"
                defaultChecked={eth0Config.enabled}
              />
            </div>

            <div className="space-y-2">
              <Label>Connection Type</Label>
              <RadioGroup defaultValue={eth0Config.ipv4.mode} name="eth0-ipv4-mode">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dhcp" id="eth0-dhcp" />
                  <Label htmlFor="eth0-dhcp">DHCP (Automatic IP)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="static" id="eth0-static" />
                  <Label htmlFor="eth0-static">Static IP</Label>
                </div>
              </RadioGroup>
            </div>

            {eth0Config.ipv4.mode === "static" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eth0-ip-address">IP Address</Label>
                    <Input 
                      id="eth0-ip-address" 
                      name="eth0-ip-address"
                      placeholder="192.168.1.100" 
                      defaultValue={eth0Config.ipv4.static.address}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eth0-subnet-mask">Subnet Mask</Label>
                    <Input 
                      id="eth0-subnet-mask" 
                      name="eth0-subnet-mask"
                      placeholder="255.255.255.0" 
                      defaultValue={eth0Config.ipv4.static.netmask}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eth0-gateway">Default Gateway</Label>
                    <Input 
                      id="eth0-gateway" 
                      name="eth0-gateway"
                      placeholder="192.168.1.1" 
                      defaultValue={eth0Config.ipv4.static.gateway}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eth0-dns-primary">Primary DNS</Label>
                    <Input 
                      id="eth0-dns-primary" 
                      name="eth0-dns-primary"
                      placeholder="8.8.8.8" 
                      defaultValue={eth0Config.ipv4.dns?.primary}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eth0-dns-secondary">Secondary DNS</Label>
                  <Input 
                    id="eth0-dns-secondary" 
                    name="eth0-dns-secondary"
                    placeholder="8.8.4.4" 
                    defaultValue={eth0Config.ipv4.dns?.secondary}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="eth0-speed">Speed</Label>
                <Select defaultValue={eth0Config.link.speed} name="eth0-speed">
                  <SelectTrigger id="eth0-speed">
                  <SelectValue placeholder="Select speed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-negotiate</SelectItem>
                    <SelectItem value="10">10 Mbps</SelectItem>
                    <SelectItem value="100">100 Mbps</SelectItem>
                    <SelectItem value="1000">1000 Mbps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="eth0-duplex">Duplex</Label>
                <Select defaultValue={eth0Config.link.duplex} name="eth0-duplex">
                  <SelectTrigger id="eth0-duplex">
                    <SelectValue placeholder="Select duplex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="full">Full Duplex</SelectItem>
                    <SelectItem value="half">Half Duplex</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
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

      {/* Wireless Interface (wlan0) */}
      <form onSubmit={handleWlan0Submit}>
        <Card>
          <CardHeader>
            <CardTitle>Wireless Interface (wlan0)</CardTitle>
            <CardDescription>Configure wireless interface settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="wlan0-enabled">Enable Interface</Label>
              <Switch 
                id="wlan0-enabled" 
                name="wlan0-enabled"
                defaultChecked={wlan0Config.enabled}
              />
            </div>

            <div className="space-y-2">
              <Label>Wireless Mode</Label>
              <RadioGroup defaultValue={wlan0Config.mode} name="wlan0-mode">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="client" id="wlan0-client" />
                  <Label htmlFor="wlan0-client">Client Mode</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ap" id="wlan0-ap" />
                  <Label htmlFor="wlan0-ap">Access Point Mode</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wlan0-ssid">SSID</Label>
              <Input 
                id="wlan0-ssid" 
                name="wlan0-ssid"
                placeholder="Network Name" 
                defaultValue={wlan0Config.wifi.ssid}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wlan0-security-mode">Security</Label>
                <Select defaultValue={wlan0Config.wifi.security.mode} name="wlan0-security-mode">
                  <SelectTrigger id="wlan0-security-mode">
                    <SelectValue placeholder="Select security" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="wep">WEP</SelectItem>
                    <SelectItem value="wpa">WPA</SelectItem>
                    <SelectItem value="wpa2">WPA2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wlan0-password">Password</Label>
                <Input 
                  id="wlan0-password" 
                  name="wlan0-password"
                  type="password" 
                  placeholder="••••••••" 
                  defaultValue={wlan0Config.wifi.security.password}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wlan0-channel">Channel</Label>
                <Select defaultValue={wlan0Config.wifi.channel} name="wlan0-channel">
                  <SelectTrigger id="wlan0-channel">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="6">6</SelectItem>
                    <SelectItem value="7">7</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="9">9</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="11">11</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wlan0-band">Band</Label>
                <Select defaultValue={wlan0Config.wifi.band} name="wlan0-band">
                  <SelectTrigger id="wlan0-band">
                    <SelectValue placeholder="Select band" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2.4">2.4 GHz</SelectItem>
                    <SelectItem value="5">5 GHz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id="wlan0-hidden" 
                name="wlan0-hidden"
                defaultChecked={wlan0Config.wifi.hidden}
              />
              <Label htmlFor="wlan0-hidden">Hidden Network</Label>
            </div>

            <div className="space-y-2">
              <Label>IP Configuration</Label>
              <RadioGroup defaultValue={wlan0Config.ipv4.mode} name="wlan0-ipv4-mode">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dhcp" id="wlan0-dhcp" />
                  <Label htmlFor="wlan0-dhcp">DHCP (Automatic IP)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="static" id="wlan0-static" />
                  <Label htmlFor="wlan0-static">Static IP</Label>
                </div>
              </RadioGroup>
            </div>

            {wlan0Config.ipv4.mode === "static" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wlan0-ip-address">IP Address</Label>
                    <Input 
                      id="wlan0-ip-address" 
                      name="wlan0-ip-address"
                      placeholder="192.168.1.100" 
                      defaultValue={wlan0Config.ipv4.static.address}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wlan0-subnet-mask">Subnet Mask</Label>
                    <Input 
                      id="wlan0-subnet-mask" 
                      name="wlan0-subnet-mask"
                      placeholder="255.255.255.0" 
                      defaultValue={wlan0Config.ipv4.static.netmask}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wlan0-gateway">Default Gateway</Label>
                  <Input 
                    id="wlan0-gateway" 
                    name="wlan0-gateway"
                    placeholder="192.168.1.1" 
                    defaultValue={wlan0Config.ipv4.static.gateway}
                  />
                </div>
              </div>
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
      </div>
  )
}

