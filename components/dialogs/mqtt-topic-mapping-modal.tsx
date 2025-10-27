"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import type { MqttBroker } from "./mqtt-broker-modal"

export interface TopicBrokerMapping {
  id: string
  topicName: string
  brokerId: string
  selectedTags: Array<{
    id: string
    name: string
    type?: string
    description?: string
    dataType?: string
    path?: string
  }>
  qos: number
  retain: boolean
  publishInterval: number
  format: "json" | "csv" | "plain" | "xml"
  delimiter?: string
  includeTimestamp: boolean
  includeHeaders: boolean
  enabled: boolean
}

interface MappingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (mapping: Partial<TopicBrokerMapping>) => void
  brokers: MqttBroker[]
  initialData?: TopicBrokerMapping | null
  onOpenTagSelector: () => void
  onTagsUpdated?: (tags: any[]) => void
}

export function MQTTTopicMappingModal({
  open,
  onOpenChange,
  onSave,
  brokers,
  initialData,
  onOpenTagSelector,
  onTagsUpdated,
}: MappingModalProps) {
  const [formData, setFormData] = useState<Partial<TopicBrokerMapping>>(
    initialData || {
      topicName: "",
      brokerId: "",
      selectedTags: [],
      qos: 0,
      retain: false,
      publishInterval: 1000,
      format: "json",
      delimiter: ",",
      includeTimestamp: true,
      includeHeaders: true,
      enabled: true,
    }
  )

  // Reset form to empty state
  const resetFormData = () => {
    setFormData({
      topicName: "",
      brokerId: "",
      selectedTags: [],
      qos: 0,
      retain: false,
      publishInterval: 1000,
      format: "json",
      delimiter: ",",
      includeTimestamp: true,
      includeHeaders: true,
      enabled: true,
    })
  }

  useEffect(() => {
    if (open && initialData) {
      setFormData(initialData)
    } else if (open && !initialData) {
      // Reset to empty form if no initialData (new mapping)
      resetFormData()
    }
  }, [initialData, open])

  // Update formData when tags are updated from the tag selector
  useEffect(() => {
    if (initialData?.selectedTags && formData.selectedTags !== initialData.selectedTags) {
      setFormData(prev => ({
        ...prev,
        selectedTags: initialData.selectedTags
      }))
    }
  }, [initialData?.selectedTags])

  const handleSave = () => {
    if (!formData.topicName || !formData.brokerId) {
      toast.error("Please fill in required fields")
      return
    }
    onSave(formData)
    toast.success(initialData ? "Mapping updated successfully" : "Mapping added successfully")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Topic Mapping" : "Add Topic Mapping"}
          </DialogTitle>
          <DialogDescription>
            Configure topic publishing settings and select tags to publish
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tags Section - MOVED TO TOP */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                Select Tags ({formData.selectedTags?.length || 0})
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={onOpenTagSelector}>
                <Plus className="h-4 w-4 mr-2" />
                Add Tags
              </Button>
            </div>

            {formData.selectedTags && formData.selectedTags.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                {formData.selectedTags.map((tag, idx) => (
                  <div key={tag.id} className="flex items-center justify-between bg-background p-3 rounded border border-muted-foreground/20 hover:border-primary/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tag.name}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {tag.dataType && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {tag.dataType}
                          </span>
                        )}
                        {tag.type && (
                          <span className="text-xs bg-secondary/10 text-secondary-foreground px-2 py-0.5 rounded">
                            {tag.type}
                          </span>
                        )}
                      </div>
                      {tag.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{tag.description}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          selectedTags: formData.selectedTags?.filter((_, i) => i !== idx)
                        })
                      }}
                      className="ml-2 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-lg bg-muted/20">
                <p className="text-sm text-muted-foreground text-center">No tags selected yet</p>
                <p className="text-xs text-muted-foreground text-center mt-1">Click "Add Tags" to select tags for publishing</p>
              </div>
            )}
          </div>

          {/* Topic Configuration */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Topic Configuration
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Topic Name *</label>
                <Input
                  value={formData.topicName || ""}
                  onChange={(e) => setFormData({ ...formData, topicName: e.target.value })}
                  placeholder="e.g., sensors/temperature"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Broker *</label>
                <Select value={formData.brokerId || ""} onValueChange={(value) => setFormData({ ...formData, brokerId: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a broker" />
                  </SelectTrigger>
                  <SelectContent>
                    {brokers.map((broker) => (
                      <SelectItem key={broker.id} value={broker.id}>
                        {broker.name} ({broker.address}:{broker.port})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Publishing Settings */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Publishing Settings
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">QoS Level</label>
                <Select value={String(formData.qos ?? 0)} onValueChange={(value) => setFormData({ ...formData, qos: parseInt(value) })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - At Most Once</SelectItem>
                    <SelectItem value="1">1 - At Least Once</SelectItem>
                    <SelectItem value="2">2 - Exactly Once</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Publish Interval (ms)</label>
                <Input
                  type="number"
                  value={formData.publishInterval || 1000}
                  onChange={(e) => setFormData({ ...formData, publishInterval: parseInt(e.target.value) })}
                  min="100"
                  max="3600000"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Format</label>
                <Select value={formData.format || "json"} onValueChange={(value: any) => setFormData({ ...formData, format: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="plain">Plain Text</SelectItem>
                    <SelectItem value="xml">XML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.retain ?? false}
                  onCheckedChange={(checked) => setFormData({ ...formData, retain: checked as boolean })}
                />
                <span className="text-sm font-medium">Retain Message</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.includeTimestamp ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, includeTimestamp: checked as boolean })}
                />
                <span className="text-sm font-medium">Include Timestamp</span>
              </label>
            </div>

            {formData.format === "csv" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">CSV Delimiter</label>
                  <Input
                    value={formData.delimiter || ","}
                    onChange={(e) => setFormData({ ...formData, delimiter: e.target.value })}
                    placeholder=","
                    maxLength="1"
                    className="mt-1"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.includeHeaders ?? true}
                    onCheckedChange={(checked) => setFormData({ ...formData, includeHeaders: checked as boolean })}
                  />
                  <span className="text-sm font-medium">Include Headers</span>
                </label>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formData.enabled ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked as boolean })}
              />
              <span className="text-sm font-medium">Enable this mapping</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {initialData ? "Update Mapping" : "Add Mapping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
