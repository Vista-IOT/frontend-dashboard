"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { useState } from "react"
import { RefreshCw, Plus, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

const userSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "operator", "viewer"]),
  enabled: z.boolean()
})

const certificateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["ca", "server", "client"]),
  file: z.string().optional(),
  key_file: z.string().optional(),
  passphrase: z.string().optional()
})

const securityFormSchema = z.object({
  ssh: z.object({
    enabled: z.boolean(),
    port: z.number().min(1).max(65535),
    allow_root: z.boolean(),
    password_auth: z.boolean()
  }),
  users: z.array(userSchema),
  certificates: z.array(certificateSchema)
})

export function SecurityForm() {
  const { updateConfig, getConfig } = useConfigStore()
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("ssh")
  const [fileUploading, setFileUploading] = useState(false)

  const form = useForm<z.infer<typeof securityFormSchema>>({
    resolver: zodResolver(securityFormSchema),
    defaultValues: {
      ssh: getConfig().security.ssh,
      users: getConfig().security.users || [],
      certificates: getConfig().security.certificates || []
    }
  })

  const onSubmit = async (values: z.infer<typeof securityFormSchema>) => {
    setIsSaving(true)
    try {
      await updateConfig(['security'], {
        ssh: values.ssh,
        users: values.users,
        certificates: values.certificates
      })
      
      toast.success('Security settings saved successfully!', {
        duration: 3000
      })
    } catch (error) {
      console.error('Error saving security settings:', error)
      toast.error('Failed to save security settings', {
        duration: 5000
      })
    } finally {
      setIsSaving(false)
    }
  }

  const addUser = () => {
    const currentUsers = form.getValues("users")
    form.setValue("users", [
      ...currentUsers,
      {
        username: "",
        password: "",
        role: "viewer",
        enabled: true
      }
    ])
  }

  const removeUser = (index: number) => {
    const currentUsers = form.getValues("users")
    form.setValue("users", currentUsers.filter((_, i) => i !== index))
  }

  const addCertificate = () => {
    const currentCerts = form.getValues("certificates")
    form.setValue("certificates", [
      ...currentCerts,
      {
        name: "",
        type: "client",
        file: "",
        key_file: "",
        passphrase: ""
      }
    ])
  }

  const removeCertificate = (index: number) => {
    const currentCerts = form.getValues("certificates")
    form.setValue("certificates", currentCerts.filter((_, i) => i !== index))
  }

  const handleFileUpload = async (file: File, index: number, fieldName: string) => {
    setFileUploading(true)
    try {
      // Here you would typically upload the file to your server
      // For now, we'll just update the form with the filename
      const currentCerts = form.getValues("certificates")
      const updatedCerts = [...currentCerts]
      if (fieldName === 'file') {
        updatedCerts[index] = { ...updatedCerts[index], file: file.name }
      } else if (fieldName === 'key_file') {
        updatedCerts[index] = { ...updatedCerts[index], key_file: file.name }
      }
      form.setValue("certificates", updatedCerts)
      toast.success(`File ${file.name} uploaded successfully`)
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error('Failed to upload file')
    } finally {
      setFileUploading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="ssh">SSH Settings</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
          </TabsList>

          <TabsContent value="ssh">
            <Card>
              <CardHeader>
                <CardTitle>SSH Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="ssh.enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Enable SSH</FormLabel>
                        <FormDescription>
                          Allow secure shell access to the device
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

                {form.watch("ssh.enabled") && (
                  <>
                    <FormField
                      control={form.control}
                      name="ssh.port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SSH Port</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value))}
                              placeholder="22"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ssh.allow_root"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <FormLabel>Allow Root Login</FormLabel>
                            <FormDescription>
                              Enable root user SSH access
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
                      name="ssh.password_auth"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <FormLabel>Password Authentication</FormLabel>
                            <FormDescription>
                              Allow password-based SSH authentication
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
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>User Management</CardTitle>
                <Button type="button" variant="outline" onClick={addUser}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {form.watch("users").map((_, index) => (
                  <div key={index} className="space-y-4 p-4 border rounded-lg relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={() => removeUser(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <FormField
                      control={form.control}
                      name={`users.${index}.username`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`users.${index}.password`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`users.${index}.role`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrator</SelectItem>
                              <SelectItem value="operator">Operator</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`users.${index}.enabled`}
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Account Enabled</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="certificates">
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Certificate Management
                  <Button type="button" onClick={addCertificate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Certificate
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.watch("certificates")?.map((cert, index) => (
                  <div key={index} className="relative border p-4 rounded-lg">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={() => removeCertificate(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <FormField
                      control={form.control}
                      name={`certificates.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Certificate Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="My Certificate" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`certificates.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Certificate Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ca">CA Certificate</SelectItem>
                              <SelectItem value="server">Server Certificate</SelectItem>
                              <SelectItem value="client">Client Certificate</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 mt-4">
                      <FormField
                        control={form.control}
                        name={`certificates.${index}.file`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Certificate File</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Input {...field} placeholder="certificate.pem" readOnly />
                                <Input
                                  type="file"
                                  accept=".pem,.crt,.cer"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleFileUpload(file, index, 'file')
                                  }}
                                  className="hidden"
                                  id={`cert-file-${index}`}
                                />
                                <Button
                                  type="button"
                                  onClick={() => document.getElementById(`cert-file-${index}`)?.click()}
                                  disabled={fileUploading}
                                >
                                  <Upload className="h-4 w-4" />
                                </Button>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* Similar file upload fields for key_file */}
                      
                      <FormField
                        control={form.control}
                        name={`certificates.${index}.passphrase`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passphrase</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button type="submit" disabled={isSaving || fileUploading}>
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