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
import { useConfigStore, EthernetInterface, WirelessInterface } from "@/lib/stores/configuration-store"
import { RefreshCw } from "lucide-react"
import { useNetworkInterfaces } from "@/hooks/useNetworkInterfaces"

export function EthernetInterfaceForm() {
  const { interfaces, isLoading, error } = useNetworkInterfaces()

  if (isLoading) {
    return <div>Loading network interfaces...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>
  }

  const supportedInterfaces = interfaces.filter(
    iface => iface.type === "Ethernet" || iface.type === "WiFi"
  );


  return (
    <div className="space-y-4">
      {supportedInterfaces.map(iface => (
        <InterfaceForm key={iface.name} iface={iface} />
      ))}
    </div>
  )
}

function InterfaceForm({ iface }: { iface: { name: string, type: string } }) {
  const { toast } = useToast()
  const { updateConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)
  
  const ifaceConfig = useConfigStore(state => state.config.network.interfaces[iface.name]);

  useEffect(() => {
    // If the config for this interface doesn't exist, create a default one
    if (!ifaceConfig) {
      if (iface.type === 'Ethernet') {
        updateConfig(['network', 'interfaces', iface.name], {
          type: 'ethernet',
          enabled: true,
          mode: 'static',
          link: { speed: 'auto', duplex: 'auto' },
          ipv4: {
            mode: 'dhcp',
            static: { address: '', netmask: '', gateway: '' },
            dns: { primary: '', secondary: '' }
          }
        });
      } else if (iface.type === 'WiFi') {
        updateConfig(['network', 'interfaces', iface.name], {
          type: 'wireless',
          enabled: true,
          mode: 'client',
          wifi: {
            ssid: '',
            security: { mode: 'none', password: '' },
            channel: 'auto',
            band: '2.4',
            hidden: false,
          },
          ipv4: {
            mode: 'dhcp',
            static: { address: '', netmask: '', gateway: '' },
          },
        });
      }
    }
  }, [ifaceConfig, iface, updateConfig]);

  if (!ifaceConfig) {
    return <div>Initializing interface {iface.name}...</div>;
  }
  
  if (ifaceConfig.type === 'ethernet') {
    return <EthernetForm ifaceConfig={ifaceConfig as EthernetInterface} interfaceName={iface.name} />
  } else if (ifaceConfig.type === 'wireless') {
    return <WifiForm ifaceConfig={ifaceConfig as WirelessInterface} interfaceName={iface.name} />
  }

  return null;
}

function EthernetForm({ ifaceConfig, interfaceName }: { ifaceConfig: EthernetInterface, interfaceName: string }) {
  const { toast } = useToast()
  const { saveNetworkSettings } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)
  const [enabled, setEnabled] = useState(ifaceConfig.enabled)
  const [ipv4Mode, setIpv4Mode] = useState(ifaceConfig.ipv4.mode);
  
  useEffect(() => {
    setEnabled(ifaceConfig.enabled);
    setIpv4Mode(ifaceConfig.ipv4.mode);
  }, [ifaceConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      const formData = new FormData(e.target as HTMLFormElement)
      
      const interfaceData: EthernetInterface = {
        type: "ethernet",
        enabled: enabled,
        mode: formData.get(`${interfaceName}-mode`) as string,
        link: {
          speed: formData.get(`${interfaceName}-speed`) as string,
          duplex: formData.get(`${interfaceName}-duplex`) as string,
        },
        ipv4: {
          mode: ipv4Mode,
          static: {
            address: formData.get(`${interfaceName}-ip-address`) as string || "",
            netmask: formData.get(`${interfaceName}-subnet-mask`) as string || "",
            gateway: formData.get(`${interfaceName}-gateway`) as string || "",
          },
          dns: {
            primary: formData.get(`${interfaceName}-dns-primary`) as string || "",
            secondary: formData.get(`${interfaceName}-dns-secondary`) as string || "",
          },
        },
      }
      
      // Use the new saveNetworkSettings helper function
      const result = saveNetworkSettings(['network', 'interfaces', interfaceName], interfaceData, `${interfaceName} interface`)
      
      if (result.success) {
        toast({
          title: "Settings saved",
          description: result.message,
        })
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error(`Error saving ${interfaceName} settings:`, error)
      toast({
        title: "Error",
        description: `Failed to save ${interfaceName} interface settings.`,
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
          <CardTitle>Ethernet Interface ({interfaceName})</CardTitle>
            <CardDescription>Configure WAN interface settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
            <Label htmlFor={`${interfaceName}-enabled`}>Enable Interface</Label>
              <Switch 
              id={`${interfaceName}-enabled`}
              name={`${interfaceName}-enabled`}
              checked={enabled}
              onCheckedChange={setEnabled}
              />
            </div>

          {enabled && (
            <>
            <div className="space-y-2">
              <Label>Connection Type</Label>
                <RadioGroup 
                  defaultValue={ipv4Mode} 
                  name={`${interfaceName}-ipv4-mode`}
                  onValueChange={setIpv4Mode}
                >
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dhcp" id={`${interfaceName}-dhcp`} />
                    <Label htmlFor={`${interfaceName}-dhcp`}>DHCP (Automatic IP)</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="static" id={`${interfaceName}-static`} />
                    <Label htmlFor={`${interfaceName}-static`}>Static IP</Label>
                </div>
              </RadioGroup>
            </div>

              {ipv4Mode === "static" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor={`${interfaceName}-ip-address`}>IP Address</Label>
                    <Input 
                        id={`${interfaceName}-ip-address`}
                        name={`${interfaceName}-ip-address`}
                      placeholder="192.168.1.100" 
                        defaultValue={ifaceConfig.ipv4.static.address}
                    />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor={`${interfaceName}-subnet-mask`}>Subnet Mask</Label>
                    <Input 
                        id={`${interfaceName}-subnet-mask`}
                        name={`${interfaceName}-subnet-mask`}
                      placeholder="255.255.255.0" 
                        defaultValue={ifaceConfig.ipv4.static.netmask}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor={`${interfaceName}-gateway`}>Default Gateway</Label>
                    <Input 
                        id={`${interfaceName}-gateway`}
                        name={`${interfaceName}-gateway`}
                      placeholder="192.168.1.1" 
                        defaultValue={ifaceConfig.ipv4.static.gateway}
                    />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor={`${interfaceName}-dns-primary`}>Primary DNS</Label>
                    <Input 
                        id={`${interfaceName}-dns-primary`}
                        name={`${interfaceName}-dns-primary`}
                      placeholder="8.8.8.8" 
                        defaultValue={ifaceConfig.ipv4.dns?.primary}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${interfaceName}-dns-secondary`}>Secondary DNS</Label>
                  <Input 
                      id={`${interfaceName}-dns-secondary`}
                      name={`${interfaceName}-dns-secondary`}
                    placeholder="8.8.4.4" 
                      defaultValue={ifaceConfig.ipv4.dns?.secondary}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                  <Label htmlFor={`${interfaceName}-speed`}>Speed</Label>
                  <Select defaultValue={ifaceConfig.link.speed} name={`${interfaceName}-speed`}>
                    <SelectTrigger id={`${interfaceName}-speed`}>
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
                  <Label htmlFor={`${interfaceName}-duplex`}>Duplex</Label>
                  <Select defaultValue={ifaceConfig.link.duplex} name={`${interfaceName}-duplex`}>
                    <SelectTrigger id={`${interfaceName}-duplex`}>
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

function WifiForm({ ifaceConfig, interfaceName }: { ifaceConfig: WirelessInterface, interfaceName: string }) {
  const { toast } = useToast();
  const { saveNetworkSettings } = useConfigStore();
  const [isSaving, setIsSaving] = useState(false);

  const [enabled, setEnabled] = useState(ifaceConfig.enabled);
  const [mode, setMode] = useState(ifaceConfig.mode);
  const [ssid, setSsid] = useState(ifaceConfig.wifi.ssid);
  const [securityMode, setSecurityMode] = useState(ifaceConfig.wifi.security.mode);
  const [password, setPassword] = useState(ifaceConfig.wifi.security.password);
  const [channel, setChannel] = useState(ifaceConfig.wifi.channel);
  const [band, setBand] = useState(ifaceConfig.wifi.band);
  const [hidden, setHidden] = useState(ifaceConfig.wifi.hidden);
  const [ipv4Mode, setIpv4Mode] = useState(ifaceConfig.ipv4.mode);
  
  useEffect(() => {
    setEnabled(ifaceConfig.enabled);
    setMode(ifaceConfig.mode);
    setSsid(ifaceConfig.wifi.ssid);
    setSecurityMode(ifaceConfig.wifi.security.mode);
    setPassword(ifaceConfig.wifi.security.password);
    setChannel(ifaceConfig.wifi.channel);
    setBand(ifaceConfig.wifi.band);
    setHidden(ifaceConfig.wifi.hidden);
    setIpv4Mode(ifaceConfig.ipv4.mode);
  }, [ifaceConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const interfaceData: WirelessInterface = {
        type: 'wireless',
        enabled,
        mode,
        wifi: {
          ssid,
          security: {
            mode: securityMode,
            password,
          },
          channel,
          band,
          hidden,
        },
        ipv4: {
          mode: ipv4Mode,
          static: {
            address: formData.get(`${interfaceName}-ip-address`) as string || '',
            netmask: formData.get(`${interfaceName}-subnet-mask`) as string || '',
            gateway: formData.get(`${interfaceName}-gateway`) as string || '',
          },
        },
      };
      
      // Use the new saveNetworkSettings helper function
      const result = saveNetworkSettings(['network', 'interfaces', interfaceName], interfaceData, `${interfaceName} interface`)
      
      if (result.success) {
        toast({
          title: "Settings saved",
          description: result.message,
        })
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error(`Error saving ${interfaceName} settings:`, error);
      toast({
        title: "Error",
        description: `Failed to save ${interfaceName} interface settings.`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
          <CardTitle>Wireless Interface ({interfaceName})</CardTitle>
            <CardDescription>Configure wireless interface settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
            <Label htmlFor={`${interfaceName}-enabled`}>Enable Interface</Label>
              <Switch 
              id={`${interfaceName}-enabled`}
              checked={enabled}
              onCheckedChange={setEnabled}
              />
            </div>

          {enabled && (
            <>
            <div className="space-y-2">
              <Label>Wireless Mode</Label>
                <RadioGroup value={mode} onValueChange={setMode}>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="client" id={`${interfaceName}-client`} />
                    <Label htmlFor={`${interfaceName}-client`}>Client Mode</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ap" id={`${interfaceName}-ap`} />
                    <Label htmlFor={`${interfaceName}-ap`}>Access Point Mode</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
                <Label htmlFor={`${interfaceName}-ssid`}>SSID</Label>
              <Input 
                  id={`${interfaceName}-ssid`}
                placeholder="Network Name" 
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label htmlFor={`${interfaceName}-security-mode`}>Security</Label>
                  <Select value={securityMode} onValueChange={setSecurityMode}>
                    <SelectTrigger id={`${interfaceName}-security-mode`}>
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
                {securityMode !== 'none' && (
              <div className="space-y-2">
                    <Label htmlFor={`${interfaceName}-password`}>Password</Label>
                <Input 
                      id={`${interfaceName}-password`}
                  type="password" 
                  placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                />
              </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label htmlFor={`${interfaceName}-channel`}>Channel</Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger id={`${interfaceName}-channel`}>
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
              </div>
              <div className="space-y-2">
                  <Label htmlFor={`${interfaceName}-band`}>Band</Label>
                  <Select value={band} onValueChange={setBand}>
                    <SelectTrigger id={`${interfaceName}-band`}>
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
                  id={`${interfaceName}-hidden`}
                  checked={hidden}
                  onCheckedChange={setHidden}
              />
                <Label htmlFor={`${interfaceName}-hidden`}>Hidden Network</Label>
            </div>

            <div className="space-y-2">
              <Label>IP Configuration</Label>
                <RadioGroup value={ipv4Mode} onValueChange={setIpv4Mode}>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dhcp" id={`${interfaceName}-dhcp-ip`} />
                    <Label htmlFor={`${interfaceName}-dhcp-ip`}>DHCP (Automatic IP)</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="static" id={`${interfaceName}-static-ip`} />
                    <Label htmlFor={`${interfaceName}-static-ip`}>Static IP</Label>
                </div>
              </RadioGroup>
            </div>

              {ipv4Mode === 'static' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor={`${interfaceName}-ip-address`}>IP Address</Label>
                    <Input 
                        id={`${interfaceName}-ip-address`}
                        name={`${interfaceName}-ip-address`}
                      placeholder="192.168.1.100" 
                        defaultValue={ifaceConfig.ipv4.static.address}
                    />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${interfaceName}-subnet-mask`}>Subnet Mask</Label>
                      <Input
                        id={`${interfaceName}-subnet-mask`}
                        name={`${interfaceName}-subnet-mask`}
                        placeholder="255.255.255.0"
                        defaultValue={ifaceConfig.ipv4.static.netmask}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${interfaceName}-gateway`}>Default Gateway</Label>
                    <Input 
                      id={`${interfaceName}-gateway`}
                      name={`${interfaceName}-gateway`}
                      placeholder="192.168.1.1"
                      defaultValue={ifaceConfig.ipv4.static.gateway}
                    />
                  </div>
                </div>
              )}
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

