import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { Upload, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ImportConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportConfigDialog({ open, onOpenChange }: ImportConfigDialogProps) {
  const { toast } = useToast()
  const { updateConfig, resetConfig } = useConfigStore()
  const [isImporting, setIsImporting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setError(null)
    setPreviewData(null)

    // Validate file type
    if (!file.name.endsWith('.yaml') && !file.name.endsWith('.yml')) {
      setError('Please select a valid YAML file (.yaml or .yml)')
      return
    }

    // Read and parse the file
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const YAML = require('yaml')
        const parsedData = YAML.parse(content)
        
        // Basic validation
        if (!parsedData || typeof parsedData !== 'object') {
          setError('Invalid YAML format')
          return
        }

        setPreviewData(parsedData)
      } catch (err) {
        setError('Failed to parse YAML file. Please check the file format.')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!selectedFile || !previewData) return

    setIsImporting(true)
    
    try {
      // Reset to default first, then apply imported config
      resetConfig()
      
      // Apply the imported configuration
      // For now, we'll replace the entire config
      // In a real implementation, you might want to merge or validate specific sections
      Object.keys(previewData).forEach(key => {
        updateConfig([key], previewData[key])
      })
      
    toast({
      title: "Configuration imported",
        description: "The configuration has been imported successfully. Some changes may require a restart.",
      })
      onOpenChange(false)
      
      // Reset form
      setSelectedFile(null)
      setPreviewData(null)
      setError(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error importing configuration:', error)
      toast({
        title: "Import failed",
        description: "Failed to import configuration. Please check the file format.",
        variant: "destructive",
    })
    } finally {
      setIsImporting(false)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setPreviewData(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Configuration</DialogTitle>
          <DialogDescription>
            Import a gateway configuration file. This will overwrite your current settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="config-file">Configuration File (YAML)</Label>
            <Input 
              id="config-file" 
              type="file" 
              accept=".yaml,.yml"
              onChange={handleFileSelect}
              ref={fileInputRef}
            />
            <p className="text-xs text-muted-foreground">
              Select a YAML configuration file to import
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {previewData && (
            <div className="space-y-2">
              <Label>Configuration Preview</Label>
              <div className="max-h-40 overflow-y-auto rounded border p-3 text-xs bg-muted">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(previewData, null, 2)}
                </pre>
              </div>
              <p className="text-xs text-muted-foreground">
                This configuration will replace your current settings
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={isImporting || !selectedFile || !previewData || !!error}
          >
            {isImporting ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

