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
import { useToast } from "@/components/ui/use-toast"
import { useConfigStore } from "@/lib/stores/configuration-store"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ResetConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResetConfigDialog({ open, onOpenChange }: ResetConfigDialogProps) {
  const { toast } = useToast()
  const { resetConfig } = useConfigStore()
  const [isResetting, setIsResetting] = useState(false)

  const handleReset = async () => {
    setIsResetting(true)
    
    try {
      // Reset to default configuration
      resetConfig()
      
    toast({
      title: "Configuration reset",
        description: "The gateway has been reset to factory defaults. Some services may restart.",
    })
    onOpenChange(false)
    } catch (error) {
      console.error('Error resetting configuration:', error)
      toast({
        title: "Reset failed",
        description: "Failed to reset configuration. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset to Factory Defaults</DialogTitle>
          <DialogDescription>
            Are you sure you want to reset the gateway to factory defaults? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This will reset all configuration settings including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Network settings</li>
                <li>Security configurations</li>
                <li>Protocol settings</li>
                <li>IO setup and tags</li>
                <li>Communication forwarding</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleReset}
            disabled={isResetting}
          >
            {isResetting ? (
              <>
                <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset to Defaults
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

