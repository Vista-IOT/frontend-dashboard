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

const ethernetFormSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["dhcp", "static"]),
  ipv4: z.object({
    static: z.object({
      address: z.string().optional(),
      netmask: z.string().optional(),
      gateway: z.string().optional()
    }),
    dns: z.object({
      primary: z.string().optional(),
      secondary: z.string().optional()
    })
  }),
  link: z.object({
    speed: z.enum(["auto", "10", "100", "1000"]),
    duplex: z.enum(["auto", "full", "half"])
  })
})

export function EthernetSettingsForm() {
  const { toast } = useToast()
  const { updateConfig, getConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<z.infer<typeof ethernetFormSchema>>({
    resolver: zodResolver(ethernetFormSchema),
    defaultValues: {
      enabled: getConfig().network.interfaces.eth0.enabled,
      mode: getConfig().network.interfaces.eth0.ipv4.mode,
      ipv4: getConfig().network.interfaces.eth0.ipv4,
      link: getConfig().network.interfaces.eth0.link
    }
  })

  const onSubmit = async (values: z.infer<typeof ethernetFormSchema>) => {
    setIsSaving(true)
    try {
      updateConfig(['network', 'interfaces', 'eth0'], {
        ...getConfig().network.interfaces.eth0,
        ...values
      })
      
      toast({
        title: "Settings saved",
        description: "Ethernet settings have been updated successfully.",
      })
    } catch (error) {
      console.error('Error saving ethernet settings:', error)
      toast({
        title: "Error",
        description: "Failed to save ethernet settings.",
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
                <FormLabel>Enable Interface</FormLabel>
                <FormDescription>
                  Enable or disable the ethernet interface
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
          name="mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>IP Configuration Mode</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dhcp">DHCP</SelectItem>
                  <SelectItem value="static">Static IP</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        {form.watch("mode") === "static" && (
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

        <FormField
          control={form.control}
          name="link.speed"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Link Speed</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select speed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="10">10 Mbps</SelectItem>
                  <SelectItem value="100">100 Mbps</SelectItem>
                  <SelectItem value="1000">1 Gbps</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

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