"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { PlusCircle, Trash2, RefreshCw } from "lucide-react"

export function StaticRoutesForm() {
  const { toast } = useToast()
  const { updateConfig, getConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)
  const [addRouteDialogOpen, setAddRouteDialogOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<any>(null)
  
  // Get current configuration
  const config = getConfig()
  const staticRoutes = config.network.static_routes

  const [newRoute, setNewRoute] = useState({
    destination: "",
    netmask: "",
    gateway: "",
    interface: "eth0",
    metric: 10
  })

  const handleAddRoute = () => {
    if (!newRoute.destination || !newRoute.netmask || !newRoute.gateway) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    
    try {
      const routeData = {
        id: `route-${Date.now()}`,
        destination: newRoute.destination,
        netmask: newRoute.netmask,
        gateway: newRoute.gateway,
        interface: newRoute.interface,
        metric: newRoute.metric
      }
      
      const updatedRoutes = [...staticRoutes, routeData]
      updateConfig(['network', 'static_routes'], updatedRoutes)
      
      // Reset form
      setNewRoute({
        destination: "",
        netmask: "",
        gateway: "",
        interface: "eth0",
        metric: 10
      })
      setAddRouteDialogOpen(false)
      
    toast({
      title: "Route added",
      description: "A new static route has been added.",
    })
    } catch (error) {
      console.error('Error adding route:', error)
      toast({
        title: "Error",
        description: "Failed to add static route.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteRoute = (routeId: string) => {
    setIsSaving(true)
    
    try {
      const updatedRoutes = staticRoutes.filter(route => route.id !== routeId)
      updateConfig(['network', 'static_routes'], updatedRoutes)
      
      toast({
        title: "Route deleted",
        description: "Static route has been removed.",
      })
    } catch (error) {
      console.error('Error deleting route:', error)
      toast({
        title: "Error",
        description: "Failed to delete static route.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditRoute = (route: any) => {
    setEditingRoute(route)
    setNewRoute({
      destination: route.destination,
      netmask: route.netmask,
      gateway: route.gateway,
      interface: route.interface,
      metric: route.metric
    })
    setAddRouteDialogOpen(true)
  }

  const handleUpdateRoute = () => {
    if (!newRoute.destination || !newRoute.netmask || !newRoute.gateway) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    
    try {
      const updatedRoutes = staticRoutes.map(route => 
        route.id === editingRoute.id 
          ? {
              ...route,
              destination: newRoute.destination,
              netmask: newRoute.netmask,
              gateway: newRoute.gateway,
              interface: newRoute.interface,
              metric: newRoute.metric
            }
          : route
      )
      
      updateConfig(['network', 'static_routes'], updatedRoutes)
      
      // Reset form
      setNewRoute({
        destination: "",
        netmask: "",
        gateway: "",
        interface: "eth0",
        metric: 10
      })
      setEditingRoute(null)
      setAddRouteDialogOpen(false)
      
      toast({
        title: "Route updated",
        description: "Static route has been updated.",
      })
    } catch (error) {
      console.error('Error updating route:', error)
      toast({
        title: "Error",
        description: "Failed to update static route.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setNewRoute({
      destination: "",
      netmask: "",
      gateway: "",
      interface: "eth0",
      metric: 10
    })
    setEditingRoute(null)
    setAddRouteDialogOpen(false)
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Static Routes</CardTitle>
        <CardDescription>Configure static routing table entries</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destination</TableHead>
              <TableHead>Subnet Mask</TableHead>
              <TableHead>Gateway</TableHead>
              <TableHead>Interface</TableHead>
              <TableHead>Metric</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {staticRoutes.length === 0 ? (
            <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-muted-foreground">No static routes configured</span>
                    </div>
              </TableCell>
            </TableRow>
              ) : (
                staticRoutes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell>{route.destination}</TableCell>
                    <TableCell>{route.netmask}</TableCell>
                    <TableCell>{route.gateway}</TableCell>
                    <TableCell>{route.interface}</TableCell>
                    <TableCell>{route.metric}</TableCell>
              <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditRoute(route)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteRoute(route.id)}
                        >
                  <Trash2 className="h-4 w-4" />
                </Button>
                      </div>
              </TableCell>
            </TableRow>
                ))
              )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
          <Button onClick={() => setAddRouteDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Route
        </Button>
      </CardFooter>
    </Card>

      {/* Add/Edit Route Dialog */}
      <Dialog open={addRouteDialogOpen} onOpenChange={setAddRouteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRoute ? "Edit Static Route" : "Add Static Route"}
            </DialogTitle>
            <DialogDescription>
              Configure a new static route for the routing table.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="destination">Destination</Label>
                <Input 
                  id="destination"
                  placeholder="192.168.2.0"
                  value={newRoute.destination}
                  onChange={(e) => setNewRoute({...newRoute, destination: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="netmask">Subnet Mask</Label>
                <Input 
                  id="netmask"
                  placeholder="255.255.255.0"
                  value={newRoute.netmask}
                  onChange={(e) => setNewRoute({...newRoute, netmask: e.target.value})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gateway">Gateway</Label>
                <Input 
                  id="gateway"
                  placeholder="10.0.0.2"
                  value={newRoute.gateway}
                  onChange={(e) => setNewRoute({...newRoute, gateway: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interface">Interface</Label>
                <Select 
                  value={newRoute.interface} 
                  onValueChange={(value) => setNewRoute({...newRoute, interface: value})}
                >
                  <SelectTrigger id="interface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eth0">eth0</SelectItem>
                    <SelectItem value="wlan0">wlan0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="metric">Metric</Label>
              <Input 
                id="metric"
                type="number"
                placeholder="10"
                value={newRoute.metric}
                onChange={(e) => setNewRoute({...newRoute, metric: parseInt(e.target.value) || 10})}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button 
              onClick={editingRoute ? handleUpdateRoute : handleAddRoute}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                editingRoute ? 'Update Route' : 'Add Route'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

