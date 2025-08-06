"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, RefreshCw, Download, Upload, Terminal } from "lucide-react";
import { toast } from "sonner";
import backendService from "@/lib/services/backend-service";
import { useConfigStore } from "@/lib/stores/configuration-store";

export function BackendControl() {
  const [isBackendRunning, setIsBackendRunning] = useState<boolean>(false);
  const [isBackendStatusLoading, setIsBackendStatusLoading] = useState<boolean>(true);
  const [isBackendRestarting, setIsBackendRestarting] = useState<boolean>(false);
  const [isConfigSyncing, setIsConfigSyncing] = useState<boolean>(false);
  const { getConfig } = useConfigStore();

  useEffect(() => {
    // Check backend status on load and periodically
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const checkBackendStatus = async () => {
    setIsBackendStatusLoading(true);
    try {
      const isRunning = await backendService.checkStatus();
      setIsBackendRunning(isRunning);
    } catch (error) {
      console.error("Error checking backend status:", error);
      setIsBackendRunning(false);
    } finally {
      setIsBackendStatusLoading(false);
    }
  };

  const handleRestartBackend = async () => {
    setIsBackendRestarting(true);
    try {
      const success = await backendService.restartBackend();
      if (success) {
        toast.success("Backend service restarted successfully");
        setTimeout(checkBackendStatus, 2000); // Check status after a short delay
      } else {
        toast.error("Failed to restart backend service");
      }
    } catch (error) {
      console.error("Error restarting backend:", error);
      toast.error("Error restarting backend service");
    } finally {
      setIsBackendRestarting(false);
    }
  };

  const handleSyncConfig = async () => {
    setIsConfigSyncing(true);
    try {
      // Get current configuration
      const config = getConfig();
      if (!config) {
        toast.error("No configuration available to sync");
        return;
      }

      // Send to backend
      const success = await backendService.updateConfig(config);
      if (success) {
        toast.success("Configuration synced with backend successfully");
      } else {
        toast.error("Failed to sync configuration with backend");
      }
    } catch (error) {
      console.error("Error syncing configuration:", error);
      toast.error("Error syncing configuration with backend");
    } finally {
      setIsConfigSyncing(false);
    }
  };

  const handleLaunchBackend = async () => {
    try {
      // Launch the backend with the current configuration
      const success = await backendService.launchBackend();
      if (success) {
        toast.success("Backend service launched successfully");
        setTimeout(checkBackendStatus, 2000); // Check status after a short delay
      } else {
        toast.error("Failed to launch backend service");
      }
    } catch (error) {
      console.error("Error launching backend:", error);
      toast.error("Error launching backend service");
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">Backend Service</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="text-sm">Status:</div>
            {isBackendStatusLoading ? (
              <Badge variant="outline" className="px-3 py-1">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Checking...
              </Badge>
            ) : isBackendRunning ? (
              <Badge variant="secondary" className="px-3 py-1">
                Running
              </Badge>
            ) : (
              <Badge variant="destructive" className="px-3 py-1">
                Stopped
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          The Vista IoT Gateway backend service manages communication with hardware, protocols, and data processing.
          Configure the gateway through the web interface, then ensure the backend service is running to apply your configuration.
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex space-x-2">
          {!isBackendRunning && (
            <Button variant="default" onClick={handleLaunchBackend} className="text-sm">
              <Play className="h-4 w-4 mr-1" />
              Launch Backend
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleRestartBackend}
            disabled={isBackendRestarting}
            className="text-sm"
          >
            {isBackendRestarting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Restarting...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1" />
                Restart Backend
              </>
            )}
          </Button>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleSyncConfig}
            disabled={isConfigSyncing || !isBackendRunning}
            className="text-sm"
          >
            {isConfigSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" />
                Sync Configuration
              </>
            )}
          </Button>
          <Button variant="outline" onClick={checkBackendStatus} className="text-sm">
            <Terminal className="h-4 w-4 mr-1" />
            Check Status
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
