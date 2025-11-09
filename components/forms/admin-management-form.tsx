"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, Shield, Key, AlertCircle, UserPlus, RefreshCw } from "lucide-react"
import { format } from "date-fns"

interface Admin {
  id: string
  username: string
  role: string
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}

interface AuthCredentials {
  username: string
  password: string
}

export function AdminManagementForm() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authCredentials, setAuthCredentials] = useState<AuthCredentials>({ username: "", password: "" })
  const [currentUser, setCurrentUser] = useState<Admin | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ username: "", password: "", role: "admin" })
  const [passwordChange, setPasswordChange] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })

  // Authentication
  const handleLogin = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("http://localhost:8000/api/admin/verify", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${authCredentials.username}:${authCredentials.password}`)}`
        }
      })

      if (response.ok) {
        setIsAuthenticated(true)
        toast.success("Authentication successful")
        await loadCurrentUser()
        await loadAdmins()
      } else {
        toast.error("Invalid credentials")
      }
    } catch (error) {
      console.error("Authentication error:", error)
      toast.error("Authentication failed")
    } finally {
      setIsLoading(false)
    }
  }

  // Load current user info
  const loadCurrentUser = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/admin/me", {
        headers: {
          "Authorization": `Basic ${btoa(`${authCredentials.username}:${authCredentials.password}`)}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data)
      }
    } catch (error) {
      console.error("Error loading current user:", error)
    }
  }

  // Load all admins
  const loadAdmins = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("http://localhost:8000/api/admin/list", {
        headers: {
          "Authorization": `Basic ${btoa(`${authCredentials.username}:${authCredentials.password}`)}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setAdmins(data)
      } else {
        toast.error("Failed to load administrators")
      }
    } catch (error) {
      console.error("Error loading admins:", error)
      toast.error("Error loading administrators")
    } finally {
      setIsLoading(false)
    }
  }

  // Create new admin
  const handleCreateAdmin = async () => {
    if (!newAdmin.username || !newAdmin.password) {
      toast.error("Username and password are required")
      return
    }

    if (newAdmin.password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("http://localhost:8000/api/admin/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${btoa(`${authCredentials.username}:${authCredentials.password}`)}`
        },
        body: JSON.stringify(newAdmin)
      })

      if (response.ok) {
        toast.success("Administrator created successfully")
        setShowCreateDialog(false)
        setNewAdmin({ username: "", password: "", role: "admin" })
        await loadAdmins()
      } else {
        const error = await response.json()
        toast.error(error.detail || "Failed to create administrator")
      }
    } catch (error) {
      console.error("Error creating admin:", error)
      toast.error("Error creating administrator")
    } finally {
      setIsLoading(false)
    }
  }

  // Delete admin
  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm("Are you sure you want to delete this administrator?")) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:8000/api/admin/${adminId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Basic ${btoa(`${authCredentials.username}:${authCredentials.password}`)}`
        }
      })

      if (response.ok) {
        toast.success("Administrator deleted successfully")
        await loadAdmins()
      } else {
        const error = await response.json()
        toast.error(error.detail || "Failed to delete administrator")
      }
    } catch (error) {
      console.error("Error deleting admin:", error)
      toast.error("Error deleting administrator")
    } finally {
      setIsLoading(false)
    }
  }

  // Change password
  const handleChangePassword = async () => {
    if (!passwordChange.currentPassword || !passwordChange.newPassword) {
      toast.error("All fields are required")
      return
    }

    if (passwordChange.newPassword !== passwordChange.confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    if (passwordChange.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("http://localhost:8000/api/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${btoa(`${authCredentials.username}:${authCredentials.password}`)}`
        },
        body: JSON.stringify({
          currentPassword: passwordChange.currentPassword,
          newPassword: passwordChange.newPassword
        })
      })

      if (response.ok) {
        toast.success("Password changed successfully")
        setShowPasswordDialog(false)
        setPasswordChange({ currentPassword: "", newPassword: "", confirmPassword: "" })
        // Update stored credentials
        setAuthCredentials({ ...authCredentials, password: passwordChange.newPassword })
      } else {
        const error = await response.json()
        toast.error(error.detail || "Failed to change password")
      }
    } catch (error) {
      console.error("Error changing password:", error)
      toast.error("Error changing password")
    } finally {
      setIsLoading(false)
    }
  }

  // Toggle admin active status
  const handleToggleActive = async (adminId: string, currentStatus: boolean) => {
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:8000/api/admin/${adminId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${btoa(`${authCredentials.username}:${authCredentials.password}`)}`
        },
        body: JSON.stringify({ isActive: !currentStatus })
      })

      if (response.ok) {
        toast.success(`Administrator ${!currentStatus ? "activated" : "deactivated"}`)
        await loadAdmins()
      } else {
        const error = await response.json()
        toast.error(error.detail || "Failed to update administrator")
      }
    } catch (error) {
      console.error("Error updating admin:", error)
      toast.error("Error updating administrator")
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    try {
      return format(new Date(dateString), "MMM dd, yyyy HH:mm")
    } catch {
      return "Invalid date"
    }
  }

  // Login form
  if (!isAuthenticated) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            <CardTitle>Administrator Authentication</CardTitle>
          </div>
          <CardDescription>
            Enter your administrator credentials to access the management panel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Default credentials: <strong>root</strong> / <strong>00000000</strong>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={authCredentials.username}
              onChange={(e) => setAuthCredentials({ ...authCredentials, username: e.target.value })}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={authCredentials.password}
              onChange={(e) => setAuthCredentials({ ...authCredentials, password: e.target.value })}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter password"
            />
          </div>

          <Button onClick={handleLogin} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Login
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Admin management panel
  return (
    <div className="space-y-6">
      {/* Current User Info */}
      {currentUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Current Session
              </div>
              <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Key className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>
                      Update your administrator password
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Current Password</Label>
                      <Input
                        type="password"
                        value={passwordChange.currentPassword}
                        onChange={(e) => setPasswordChange({ ...passwordChange, currentPassword: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>New Password</Label>
                      <Input
                        type="password"
                        value={passwordChange.newPassword}
                        onChange={(e) => setPasswordChange({ ...passwordChange, newPassword: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm New Password</Label>
                      <Input
                        type="password"
                        value={passwordChange.confirmPassword}
                        onChange={(e) => setPasswordChange({ ...passwordChange, confirmPassword: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
                    <Button onClick={handleChangePassword} disabled={isLoading}>
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Change Password
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Username</p>
                <p className="font-medium">{currentUser.username}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <Badge variant={currentUser.role === "superadmin" ? "default" : "secondary"}>
                  {currentUser.role}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Login</p>
                <p className="font-medium text-sm">{formatDate(currentUser.lastLogin)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={currentUser.isActive ? "default" : "destructive"}>
                  {currentUser.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Administrators List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Administrators
              </CardTitle>
              <CardDescription>
                Manage system administrators and their access levels
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadAdmins} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {currentUser?.role === "superadmin" && (
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Administrator
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Administrator</DialogTitle>
                      <DialogDescription>
                        Add a new administrator to the system
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          value={newAdmin.username}
                          onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                          placeholder="Enter username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                          type="password"
                          value={newAdmin.password}
                          onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                          placeholder="Minimum 8 characters"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={newAdmin.role} onValueChange={(value) => setNewAdmin({ ...newAdmin, role: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="superadmin">Superadmin</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="operator">Operator</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                      <Button onClick={handleCreateAdmin} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Create Administrator
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Updated At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.username}</TableCell>
                  <TableCell>
                    <Badge variant={admin.role === "superadmin" ? "default" : "secondary"}>
                      {admin.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={admin.isActive ? "default" : "destructive"}>
                      {admin.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(admin.lastLogin)}</TableCell>
                  <TableCell className="text-sm">{formatDate(admin.createdAt)}</TableCell>
                  <TableCell className="text-sm">{formatDate(admin.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {currentUser?.role === "superadmin" && currentUser.id !== admin.id && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(admin.id, admin.isActive)}
                            disabled={isLoading}
                          >
                            {admin.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAdmin(admin.id)}
                            disabled={isLoading}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
