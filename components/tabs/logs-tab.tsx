"use client"

import { useState, useEffect } from "react"
import { Download, RefreshCw, Search, Server, Database, Monitor, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface LogEntry {
  timestamp: string
  level: string
  logger?: string
  message: string
  module?: string
  function?: string
  line?: number
}

export default function LogsTab() {
  const [activeService, setActiveService] = useState<"backend" | "dataservice" | "frontend">("backend")
  const [logLevel, setLogLevel] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lineCount, setLineCount] = useState(500)

  // Fetch logs from backend
  const fetchLogs = async (service: string) => {
    setIsLoading(true)
    try {
      const apiBase = typeof window !== "undefined" 
        ? `http://${window.location.hostname}:8000` 
        : "http://localhost:8000"
      
      const response = await fetch(`${apiBase}/api/logs/${service}?lines=${lineCount}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`)
      }
      
      const data = await response.json()
      let logLines = data.logs || []
      
      // Handle both string and array responses
      if (typeof logLines === 'string') {
        logLines = logLines.split('\n')
      }
      
      // Ensure it's an array
      if (!Array.isArray(logLines)) {
        logLines = []
      }
      
      // Parse log lines
      const parsedLogs: LogEntry[] = logLines
        .filter((line: string) => line && line.trim())
        .map((line: string, index: number) => {
          // Try to parse JSON logs first
          try {
            const jsonLog = JSON.parse(line)
            return {
              timestamp: jsonLog.timestamp || new Date().toISOString(),
              level: jsonLog.level || "INFO",
              logger: jsonLog.logger || jsonLog.name || service,
              message: jsonLog.message || line,
              module: jsonLog.module,
              function: jsonLog.function || jsonLog.funcName,
              line: jsonLog.line || jsonLog.lineno
            }
          } catch {
            // Parse plain text logs
            const match = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*\|\s*(\w+)\s*\|\s*([^|]+)\s*\|\s*(.+)$/)
            if (match) {
              return {
                timestamp: match[1],
                level: match[2].trim(),
                logger: match[3].trim(),
                message: match[4].trim()
              }
            }
            
            // Fallback for unstructured logs
            return {
              timestamp: new Date().toISOString(),
              level: "INFO",
              logger: service,
              message: line
            }
          }
        })
      
      setLogs(parsedLogs)
    } catch (error) {
      console.error("Error fetching logs:", error)
      toast.error(`Failed to fetch ${service} logs`)
      setLogs([])
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch logs when service changes
  useEffect(() => {
    fetchLogs(activeService)
  }, [activeService, lineCount])

  // Auto-refresh logs
  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(() => {
      fetchLogs(activeService)
    }, 5000) // Refresh every 5 seconds
    
    return () => clearInterval(interval)
  }, [autoRefresh, activeService])

  // Filter logs based on level and search query
  const filteredLogs = logs.filter((log) => {
    const matchesLevel = logLevel === "all" || log.level.toLowerCase() === logLevel.toLowerCase()
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.logger && log.logger.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesLevel && matchesSearch
  })

  const handleRefresh = () => {
    fetchLogs(activeService)
    toast.success("Logs refreshed")
  }

  const handleExport = () => {
    const logText = filteredLogs
      .map(log => `${log.timestamp} | ${log.level} | ${log.logger || activeService} | ${log.message}`)
      .join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeService}-logs-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Logs exported")
  }

  const getLevelColor = (level: string) => {
    const l = level.toUpperCase()
    if (l.includes("ERROR") || l.includes("CRITICAL")) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    if (l.includes("WARN")) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    if (l.includes("DEBUG")) return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>System Logs</CardTitle>
            <CardDescription>View and monitor logs from all services</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? "Auto-Refresh On" : "Auto-Refresh Off"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Service Tabs */}
        <Tabs value={activeService} onValueChange={(v) => setActiveService(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="backend" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Backend
            </TabsTrigger>
            <TabsTrigger value="dataservice" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Service
            </TabsTrigger>
            <TabsTrigger value="frontend" className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Frontend
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full md:w-40">
            <Select value={logLevel} onValueChange={setLogLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Log level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-32">
            <Select value={lineCount.toString()} onValueChange={(v) => setLineCount(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100 lines</SelectItem>
                <SelectItem value="500">500 lines</SelectItem>
                <SelectItem value="1000">1000 lines</SelectItem>
                <SelectItem value="2000">2000 lines</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Logs Display */}
        <div className="border rounded-md">
          <ScrollArea className="h-[500px]">
            {isLoading && logs.length === 0 ? (
              <div className="flex items-center justify-center h-[500px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length > 0 ? (
              <div className="p-4 space-y-2 font-mono text-sm">
                {filteredLogs.map((log, index) => (
                  <div key={index} className="flex gap-3 py-1 hover:bg-muted/50 rounded px-2">
                    <span className="text-muted-foreground whitespace-nowrap text-xs">
                      {log.timestamp}
                    </span>
                    <Badge variant="outline" className={`${getLevelColor(log.level)} whitespace-nowrap`}>
                      {log.level}
                    </Badge>
                    {log.logger && (
                      <span className="text-muted-foreground whitespace-nowrap text-xs">
                        [{log.logger}]
                      </span>
                    )}
                    <span className="flex-1 break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                No logs found matching your criteria
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex justify-between w-full items-center">
          <div className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {logs.length} log entries
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredLogs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

