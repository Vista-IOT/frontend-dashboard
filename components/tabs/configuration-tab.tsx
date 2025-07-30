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
  const { getYamlString, getLastUpdated, updateConfig, resetConfig, deployConfig } = useConfigStore()
  const lastUpdated = useConfigStore(state => state.lastUpdated);
  const [isDeploying, setIsDeploying] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [editorContent, setEditorContent] = useState(getYamlString())
  const [isEditorReady, setIsEditorReady] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isConfigValid, setIsConfigValid] = useState(true)

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setEditorContent(getYamlString());
    }
  }, [lastUpdated]);

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
    try {
      // Use the new deployConfig method from the store
      const result = await deployConfig();
      toast.success("Configuration deployed and backend reinitialized successfully!", {
        description: result.message || "Your configuration has been applied to the backend",
        duration: 5000,
      });
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
