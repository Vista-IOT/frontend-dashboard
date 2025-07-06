"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { RefreshCw } from "lucide-react"

export function DynamicDNSForm() {
  const { toast } = useToast()
  const { updateConfig, getConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)
  
  // Get current configuration
  const config = getConfig()
  const ddnsConfig = config.network.dynamic_dns

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      const formData = new FormData(e.target as HTMLFormElement)
      
      const ddnsData = {
        enabled: formData.get("ddns-enabled") === "on",
        provider: formData.get("provider") as string,
        domain: formData.get("domain") as string,
        username: formData.get("username") as string,
        password: formData.get("password") as string,
        update_interval: parseInt(formData.get("update-interval") as string) || 60,
      }
      
      updateConfig(['network', 'dynamic_dns'], ddnsData)
      
    toast({
      title: "Settings saved",
      description: "Dynamic DNS settings have been updated.",
    })
    } catch (error) {
      console.error('Error saving DDNS settings:', error)
      toast({
        title: "Error",
        description: "Failed to save dynamic DNS settings.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Dynamic DNS</CardTitle>
          <CardDescription>Configure dynamic DNS service for remote access</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="ddns-enabled">Enable Dynamic DNS</Label>
            <Switch 
              id="ddns-enabled" 
              name="ddns-enabled"
              defaultChecked={ddnsConfig.enabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Service Provider</Label>
            <Select defaultValue={ddnsConfig.provider} name="provider">
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dyndns">DynDNS</SelectItem>
                <SelectItem value="noip">No-IP</SelectItem>
                <SelectItem value="freedns">FreeDNS</SelectItem>
                <SelectItem value="duckdns">DuckDNS</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">Domain Name</Label>
            <Input 
              id="domain" 
              name="domain"
              placeholder="mygateway.dyndns.org" 
              defaultValue={ddnsConfig.domain}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                name="username"
                placeholder="username" 
                defaultValue={ddnsConfig.username}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                name="password"
                type="password" 
                placeholder="••••••••" 
                defaultValue={ddnsConfig.password}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="update-interval">Update Interval (minutes)</Label>
            <Input 
              id="update-interval" 
              name="update-interval"
              placeholder="60" 
              type="number" 
              defaultValue={ddnsConfig.update_interval}
            />
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
  )
}

