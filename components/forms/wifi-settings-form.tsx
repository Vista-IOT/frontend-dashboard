"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { useState } from "react"
import { RefreshCw } from "lucide-react"

const wifiFormSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["client", "ap"]),
  wifi: z.object({
    ssid: z.string().min(1, "SSID is required"),
    security: z.object({
      mode: z.enum(["none", "wep", "wpa", "wpa2"]),
      password: z.string().optional()
    }),
    channel: z.enum(["auto", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]),
    band: z.enum(["2.4", "5"]),
    hidden: z.boolean()
  }),
  ipv4: z.object({
    mode: z.enum(["dhcp", "static"]),
    static: z.object({
      address: z.string().optional(),
      netmask: z.string().optional(),
      gateway: z.string().optional()
    })
  })
})

export function WifiSettingsForm() {
  const { toast } = useToast()
  const { updateConfig, getConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<z.infer<typeof wifiFormSchema>>({
    resolver: zodResolver(wifiFormSchema),
    defaultValues: {
      enabled: getConfig().network.interfaces.wlan0.enabled,
      mode: getConfig().network.interfaces.wlan0.mode,
      wifi: getConfig().network.interfaces.wlan0.wifi,
      ipv4: getConfig().network.interfaces.wlan0.ipv4
    }
  })

  const onSubmit = async (values: z.infer<typeof wifiFormSchema>) => {
    setIsSaving(true)
    try {
      updateConfig(['network', 'interfaces', 'wlan0'], {
        ...getConfig().network.interfaces.wlan0,
        ...values
      })
      
      toast({
        title: "Settings saved",
        description: "WiFi settings have been updated successfully.",
      })
    } catch (error) {
      console.error('Error saving WiFi settings:', error)
      toast({
        title: "Error",
        description: "Failed to save WiFi settings.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Enable WiFi</FormLabel>
                <FormDescription>
                  Enable or disable the wireless interface
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {form.watch("enabled") && (
          <>
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
            <FormItem>
              <FormLabel>WiFi Mode</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client (Station)</SelectItem>
                  <SelectItem value="ap">Access Point</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="wifi.ssid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SSID</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter network name" />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="wifi.security.mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Security</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select security mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="wep">WEP</SelectItem>
                  <SelectItem value="wpa">WPA</SelectItem>
                  <SelectItem value="wpa2">WPA2</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        {form.watch("wifi.security.mode") !== "none" && (
          <FormField
            control={form.control}
            name="wifi.security.password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="wifi.channel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Channel</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  {[...Array(11)].map((_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Channel {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="wifi.band"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Band</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select band" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2.4">2.4 GHz</SelectItem>
                  <SelectItem value="5">5 GHz</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="wifi.hidden"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Hidden Network</FormLabel>
                <FormDescription>
                  Hide SSID from network scans
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ipv4.mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>IP Configuration</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select IP mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dhcp">DHCP</SelectItem>
                  <SelectItem value="static">Static IP</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        {form.watch("ipv4.mode") === "static" && (
          <>
            <FormField
              control={form.control}
              name="ipv4.static.address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP Address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="192.168.1.100" />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="ipv4.static.netmask"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subnet Mask</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="255.255.255.0" />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ipv4.static.gateway"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gateway</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="192.168.1.1" />
                  </FormControl>
                </FormItem>
              )}
            />
          </>
        )}
          </>
        )}

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
      </form>
    </Form>
  )
}

