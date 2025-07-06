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

export function PortForwardingForm() {
  const { toast } = useToast()
  const { updateConfig, getConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)
  const [addRuleDialogOpen, setAddRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<any>(null)
  
  // Get current configuration
  const config = getConfig()
  const portForwarding = config.network.port_forwarding

  const [newRule, setNewRule] = useState({
    name: "",
    protocol: "tcp",
    external_port: 80,
    internal_ip: "",
    internal_port: 80
  })

  const handleAddRule = () => {
    if (!newRule.name || !newRule.internal_ip) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    
    try {
      const ruleData = {
        id: `rule-${Date.now()}`,
        name: newRule.name,
        protocol: newRule.protocol,
        external_port: newRule.external_port,
        internal_ip: newRule.internal_ip,
        internal_port: newRule.internal_port
      }
      
      const updatedRules = [...portForwarding, ruleData]
      updateConfig(['network', 'port_forwarding'], updatedRules)
      
      // Reset form
      setNewRule({
        name: "",
        protocol: "tcp",
        external_port: 80,
        internal_ip: "",
        internal_port: 80
      })
      setAddRuleDialogOpen(false)
      
    toast({
      title: "Rule added",
      description: "A new port forwarding rule has been added.",
    })
    } catch (error) {
      console.error('Error adding rule:', error)
      toast({
        title: "Error",
        description: "Failed to add port forwarding rule.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteRule = (ruleId: string) => {
    setIsSaving(true)
    
    try {
      const updatedRules = portForwarding.filter(rule => rule.id !== ruleId)
      updateConfig(['network', 'port_forwarding'], updatedRules)
      
      toast({
        title: "Rule deleted",
        description: "Port forwarding rule has been removed.",
      })
    } catch (error) {
      console.error('Error deleting rule:', error)
      toast({
        title: "Error",
        description: "Failed to delete port forwarding rule.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditRule = (rule: any) => {
    setEditingRule(rule)
    setNewRule({
      name: rule.name,
      protocol: rule.protocol,
      external_port: rule.external_port,
      internal_ip: rule.internal_ip,
      internal_port: rule.internal_port
    })
    setAddRuleDialogOpen(true)
  }

  const handleUpdateRule = () => {
    if (!newRule.name || !newRule.internal_ip) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    
    try {
      const updatedRules = portForwarding.map(rule => 
        rule.id === editingRule.id 
          ? {
              ...rule,
              name: newRule.name,
              protocol: newRule.protocol,
              external_port: newRule.external_port,
              internal_ip: newRule.internal_ip,
              internal_port: newRule.internal_port
            }
          : rule
      )
      
      updateConfig(['network', 'port_forwarding'], updatedRules)
      
      // Reset form
      setNewRule({
        name: "",
        protocol: "tcp",
        external_port: 80,
        internal_ip: "",
        internal_port: 80
      })
      setEditingRule(null)
      setAddRuleDialogOpen(false)
      
      toast({
        title: "Rule updated",
        description: "Port forwarding rule has been updated.",
      })
    } catch (error) {
      console.error('Error updating rule:', error)
      toast({
        title: "Error",
        description: "Failed to update port forwarding rule.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setNewRule({
      name: "",
      protocol: "tcp",
      external_port: 80,
      internal_ip: "",
      internal_port: 80
    })
    setEditingRule(null)
    setAddRuleDialogOpen(false)
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Port Forwarding</CardTitle>
          <CardDescription>Configure port forwarding rules for external access</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead>External Port</TableHead>
              <TableHead>Internal IP</TableHead>
              <TableHead>Internal Port</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {portForwarding.length === 0 ? (
            <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-muted-foreground">No port forwarding rules configured</span>
                    </div>
              </TableCell>
            </TableRow>
              ) : (
                portForwarding.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.name}</TableCell>
                    <TableCell className="uppercase">{rule.protocol}</TableCell>
                    <TableCell>{rule.external_port}</TableCell>
                    <TableCell>{rule.internal_ip}</TableCell>
                    <TableCell>{rule.internal_port}</TableCell>
              <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditRule(rule)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteRule(rule.id)}
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
          <Button onClick={() => setAddRuleDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </CardFooter>
    </Card>

      {/* Add/Edit Rule Dialog */}
      <Dialog open={addRuleDialogOpen} onOpenChange={setAddRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Port Forwarding Rule" : "Add Port Forwarding Rule"}
            </DialogTitle>
            <DialogDescription>
              Configure a new port forwarding rule for external access.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input 
                id="name"
                placeholder="Web Server"
                value={newRule.name}
                onChange={(e) => setNewRule({...newRule, name: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="protocol">Protocol</Label>
                <Select 
                  value={newRule.protocol} 
                  onValueChange={(value) => setNewRule({...newRule, protocol: value})}
                >
                  <SelectTrigger id="protocol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="external-port">External Port</Label>
                <Input 
                  id="external-port"
                  type="number"
                  placeholder="80"
                  value={newRule.external_port}
                  onChange={(e) => setNewRule({...newRule, external_port: parseInt(e.target.value) || 80})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="internal-ip">Internal IP Address</Label>
                <Input 
                  id="internal-ip"
                  placeholder="192.168.1.100"
                  value={newRule.internal_ip}
                  onChange={(e) => setNewRule({...newRule, internal_ip: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internal-port">Internal Port</Label>
                <Input 
                  id="internal-port"
                  type="number"
                  placeholder="80"
                  value={newRule.internal_port}
                  onChange={(e) => setNewRule({...newRule, internal_port: parseInt(e.target.value) || 80})}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button 
              onClick={editingRule ? handleUpdateRule : handleAddRule}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                editingRule ? 'Update Rule' : 'Add Rule'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

