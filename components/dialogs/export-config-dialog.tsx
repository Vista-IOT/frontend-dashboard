import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { Download } from "lucide-react"

interface ExportConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportConfigDialog({ open, onOpenChange }: ExportConfigDialogProps) {
  const { toast } = useToast()
  const { getYamlString, getConfig } = useConfigStore()
  const [isExporting, setIsExporting] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    network: true,
    security: true,
    protocols: true,
    hardware: true,
    io_setup: true,
    user_tags: true,
    calculation_tags: true,
    stats_tags: true,
    system_tags: true,
    communication_forward: true
  })

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      const config = getConfig()
      const yamlString = getYamlString()
      
      // Create a filtered configuration based on selected options
      const filteredConfig: any = {
        device: config.device
      }
      
      if (exportOptions.network) filteredConfig.network = config.network
      if (exportOptions.security) filteredConfig.security = config.security
      if (exportOptions.protocols) filteredConfig.protocols = config.protocols
      if (exportOptions.hardware) filteredConfig.hardware = config.hardware
      if (exportOptions.io_setup) filteredConfig.io_setup = config.io_setup
      if (exportOptions.user_tags) filteredConfig.user_tags = config.user_tags
      if (exportOptions.calculation_tags) filteredConfig.calculation_tags = config.calculation_tags
      if (exportOptions.stats_tags) filteredConfig.stats_tags = config.stats_tags
      if (exportOptions.system_tags) filteredConfig.system_tags = config.system_tags
      if (exportOptions.communication_forward) filteredConfig.communication_forward = config.communication_forward

      // Convert filtered config to YAML
      const YAML = require('yaml')
      const filteredYaml = YAML.stringify(filteredConfig, { indent: 2 })
      
      // Create and download the file
      const blob = new Blob([filteredYaml], { type: 'text/yaml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vista-gateway-config-${new Date().toISOString().split('T')[0]}.yaml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
    toast({
      title: "Configuration exported",
      description: "The configuration has been exported successfully.",
    })
    onOpenChange(false)
    } catch (error) {
      console.error('Error exporting configuration:', error)
      toast({
        title: "Export failed",
        description: "Failed to export configuration. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleOptionChange = (option: string, checked: boolean) => {
    setExportOptions(prev => ({
      ...prev,
      [option]: checked
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Configuration</DialogTitle>
          <DialogDescription>Export the current gateway configuration to a YAML file.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Export Options</Label>
            <div className="space-y-2">
            <div className="flex items-center space-x-2">
                <Checkbox 
                  id="network" 
                  checked={exportOptions.network}
                  onCheckedChange={(checked) => handleOptionChange('network', checked as boolean)}
                />
                <label htmlFor="network" className="text-sm font-medium leading-none">
                Network Settings
              </label>
            </div>
            <div className="flex items-center space-x-2">
                <Checkbox 
                  id="security" 
                  checked={exportOptions.security}
                  onCheckedChange={(checked) => handleOptionChange('security', checked as boolean)}
                />
                <label htmlFor="security" className="text-sm font-medium leading-none">
                Security Settings
              </label>
            </div>
            <div className="flex items-center space-x-2">
                <Checkbox 
                  id="protocols" 
                  checked={exportOptions.protocols}
                  onCheckedChange={(checked) => handleOptionChange('protocols', checked as boolean)}
                />
                <label htmlFor="protocols" className="text-sm font-medium leading-none">
                Protocol Settings
              </label>
            </div>
            <div className="flex items-center space-x-2">
                <Checkbox 
                  id="hardware" 
                  checked={exportOptions.hardware}
                  onCheckedChange={(checked) => handleOptionChange('hardware', checked as boolean)}
                />
                <label htmlFor="hardware" className="text-sm font-medium leading-none">
                Hardware Settings
              </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="io_setup" 
                  checked={exportOptions.io_setup}
                  onCheckedChange={(checked) => handleOptionChange('io_setup', checked as boolean)}
                />
                <label htmlFor="io_setup" className="text-sm font-medium leading-none">
                  IO Setup
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="tags" 
                  checked={exportOptions.user_tags && exportOptions.calculation_tags && exportOptions.stats_tags && exportOptions.system_tags}
                  onCheckedChange={(checked) => {
                    const boolChecked = checked as boolean
                    handleOptionChange('user_tags', boolChecked)
                    handleOptionChange('calculation_tags', boolChecked)
                    handleOptionChange('stats_tags', boolChecked)
                    handleOptionChange('system_tags', boolChecked)
                  }}
                />
                <label htmlFor="tags" className="text-sm font-medium leading-none">
                  All Tags
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="communication_forward" 
                  checked={exportOptions.communication_forward}
                  onCheckedChange={(checked) => handleOptionChange('communication_forward', checked as boolean)}
                />
                <label htmlFor="communication_forward" className="text-sm font-medium leading-none">
                  Communication Forward
                </label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Download className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

