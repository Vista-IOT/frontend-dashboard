"use client"

import { useState, useEffect } from "react"
import { Code2, Upload, Download, RefreshCw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { toast } from "sonner"
import { defaultConfig } from "@/lib/config/default-config"
import MonacoEditor from '@/components/monaco-editor'
import { Alert, AlertDescription } from "@/components/ui/alert"
import YAML from 'yaml'

export default function ConfigurationTab() {
  const { getYamlString, getLastUpdated, updateConfig, resetConfig } = useConfigStore()
  const [isDeploying, setIsDeploying] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [editorContent, setEditorContent] = useState("")
  const [isEditorReady, setIsEditorReady] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isConfigValid, setIsConfigValid] = useState(true)

  useEffect(() => {
    setEditorContent(getYamlString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditorDidMount = () => {
    setIsEditorReady(true)
  }

  const handleEditorChange = (value: string | undefined) => {
    setEditorContent(value || "")
    setHasUnsavedChanges(true)
    try {
      YAML.parse(value || "")
      setIsConfigValid(true)
    } catch (error) {
      setIsConfigValid(false)
    }
  }

  const handleDeploy = async () => {
    setIsDeploying(true)
    let frontendError = null;
    let backendError = null;
    try {
      // Dynamically construct the URL using the current window location
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = process.env.NEXT_PUBLIC_FRONTEND_PORT || "3000";
      const apiBase = `${protocol}//${hostname}:${port}`;
      // 1. Deploy to frontend (proxy)
      const frontendRes = await fetch(`${apiBase}/deploy/config`, {
        method: "POST",
        headers: { "Content-Type": "text/yaml" },
        body: editorContent,
      });
      if (!frontendRes.ok) {
        let errorMsg = "Failed to deploy (frontend proxy)";
        try {
          const data = await frontendRes.json();
          if (data && data.error) errorMsg = data.error;
        } catch (e) {
          try {
            const text = await frontendRes.text();
            if (text) errorMsg = text;
          } catch {}
        }
        frontendError = errorMsg;
      }
      // 2. Deploy directly to backend
      const backendRes = await fetch("http://localhost:8000/deploy/config", {
        method: "POST",
        headers: { "Content-Type": "text/yaml" },
        body: editorContent,
      });
      if (!backendRes.ok) {
        let errorMsg = "Failed to deploy (backend direct)";
        try {
          const data = await backendRes.json();
          if (data && data.error) errorMsg = data.error;
        } catch (e) {
          try {
            const text = await backendRes.text();
            if (text) errorMsg = text;
          } catch {}
        }
        backendError = errorMsg;
      }
      if (frontendError || backendError) {
        throw new Error([frontendError, backendError].filter(Boolean).join("; "));
      }
      toast.success("Configuration deployed and stored in database!");
    } catch (error) {
      toast.error("Failed to deploy configuration", {
        description: error instanceof Error ? error.message : String(error),
        duration: 8000,
      });
      console.error("DEPLOY ERROR CAUGHT:", error);
    } finally {
      setIsDeploying(false)
    }
  }

  const handleReset = async () => {
    setIsResetting(true)
    try {
      // Use the new async resetConfig to fetch and apply dynamic default config
      await resetConfig();
      setEditorContent(getYamlString()); // Update editor content
      toast.success('Configuration reset to default state', {
        description: "All settings have been restored to factory defaults",
        duration: 3000,
      })
    } catch (error) {
      console.error('Error resetting configuration:', error)
      toast.error('Failed to reset configuration', {
        description: "Please try again or contact support if the issue persists",
        duration: 5000,
      })
    } finally {
      setIsResetting(false)
    }
  }

  const handleSave = async () => {
    try {
      const parsedConfig = YAML.parse(editorContent)
      updateConfig([], parsedConfig)
      setHasUnsavedChanges(false)
      
      toast.success('Configuration saved successfully', {
        description: "Your changes have been applied",
        duration: 3000,
      })
    } catch (error) {
      console.error('Error saving configuration:', error)
      toast.error('Invalid YAML configuration', {
        description: "Please check your syntax and try again",
        duration: 5000,
      })
    }
  }

  const handleFormat = () => {
    try {
      const parsedYaml = YAML.parse(editorContent)
      const formattedYaml = YAML.stringify(parsedYaml, { indent: 2 })
      setEditorContent(formattedYaml)
      
      toast.success('YAML formatted successfully', {
        duration: 2000,
      })
    } catch (error) {
      toast.error('Failed to format YAML', {
        description: "Invalid YAML syntax",
        duration: 3000,
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration Management</CardTitle>
          <CardDescription>
            Edit, deploy, or reset your device configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <div className="space-x-2">
              <Button 
                variant="destructive" 
                onClick={handleReset}
                disabled={isResetting || isDeploying}
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset to Default'
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  const blob = new Blob([editorContent], { type: 'text/yaml' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'device-config.yaml'
                  a.click()
                  URL.revokeObjectURL(url)
                  
                  toast.success('Configuration downloaded')
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download YAML
              </Button>
            </div>
            <div className="space-x-2">
              <Button 
                variant="outline"
                onClick={handleFormat}
                disabled={!isEditorReady}
              >
                <Code2 className="h-4 w-4 mr-2" />
                Format
              </Button>
              <Button 
                variant="default"
                onClick={handleSave}
                disabled={!isEditorReady || !hasUnsavedChanges || !isConfigValid}
              >
                Save Changes
              </Button>
              <Button 
                variant="default"
                onClick={handleDeploy}
                disabled={isDeploying || !isConfigValid}
              >
                {isDeploying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Configure & Deploy
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="relative min-h-[600px] border rounded-md">
            <MonacoEditor
              height="600px"
              defaultLanguage="yaml"
              value={editorContent}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                readOnly: false,
                wordWrap: "on",
                theme: "vs-dark",
                tabSize: 2,
              }}
            />
          </div>

          <Alert>
            <AlertDescription className="flex justify-between items-center">
              <span>Last updated: {new Date(getLastUpdated()).toLocaleString()}</span>
              {hasUnsavedChanges && (
                <span className="text-yellow-500">You have unsaved changes</span>
              )}
              {!isConfigValid && (
                <span className="text-red-500">Invalid YAML configuration</span>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
} 
