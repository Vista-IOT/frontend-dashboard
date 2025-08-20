"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOpcuaWrite } from "@/hooks/useOpcuaWrite";
import { toast } from "sonner";

interface OpcuaWriteDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  device: any;
  tag: any; // expects { id, name, address, opcuaDataType? }
}

export function OpcuaWriteDialog({ open, onOpenChange, device, tag }: OpcuaWriteDialogProps) {
  const [value, setValue] = useState<string | number | boolean>("");
  const [dataType, setDataType] = useState<string>(tag?.opcuaDataType || "Double");
  const [timeoutMs, setTimeoutMs] = useState<number>(5000);
  const { opcuaWrite, isWriting } = useOpcuaWrite();

  useEffect(() => {
    if (open) {
      setValue("");
      setDataType(tag?.opcuaDataType || "Double");
    }
  }, [open, tag?.opcuaDataType]);

  const handleSubmit = async () => {
    if (!tag?.address) {
      toast.error("Tag has no Node ID address defined");
      return;
    }

    // Parse value based on data type
    let parsedValue: string | number | boolean = value;
    if (dataType === "Boolean") {
      parsedValue = String(value).toLowerCase() === "true";
    } else if (dataType === "Int32" || dataType === "UInt32" || dataType === "Int16" || dataType === "UInt16") {
      parsedValue = parseInt(String(value), 10);
      if (isNaN(parsedValue as number)) {
        toast.error("Invalid integer value");
        return;
      }
    } else if (dataType === "Float" || dataType === "Double") {
      parsedValue = parseFloat(String(value));
      if (isNaN(parsedValue as number)) {
        toast.error("Invalid numeric value");
        return;
      }
    }

    const res = await opcuaWrite({
      device,
      nodeId: tag.address,
      value: parsedValue,
      dataType,
      timeoutMs,
    });

    if (res.success) {
      toast.success("OPC-UA Write successful");
      onOpenChange(false);
    } else {
      toast.error(res.message || "OPC-UA Write failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>OPC-UA Write</DialogTitle>
          <DialogDescription>
            Write a value to Node ID {tag?.address} on {device?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Data Type</Label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger>
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Boolean">Boolean</SelectItem>
                <SelectItem value="Byte">Byte</SelectItem>
                <SelectItem value="SByte">SByte</SelectItem>
                <SelectItem value="Int16">Int16</SelectItem>
                <SelectItem value="UInt16">UInt16</SelectItem>
                <SelectItem value="Int32">Int32</SelectItem>
                <SelectItem value="UInt32">UInt32</SelectItem>
                <SelectItem value="Int64">Int64</SelectItem>
                <SelectItem value="UInt64">UInt64</SelectItem>
                <SelectItem value="Float">Float</SelectItem>
                <SelectItem value="Double">Double</SelectItem>
                <SelectItem value="String">String</SelectItem>
                <SelectItem value="DateTime">DateTime</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Value</Label>
            <Input 
              value={String(value)} 
              onChange={(e) => setValue(e.target.value)} 
              placeholder="Enter value"
              type={dataType === "String" ? "text" : dataType === "Boolean" ? "text" : "number"}
            />
            {dataType === "Boolean" && (
              <p className="text-xs text-muted-foreground">Enter "true" or "false" for boolean values</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Timeout (ms)</Label>
            <Input 
              type="number" 
              value={timeoutMs} 
              onChange={(e) => setTimeoutMs(Number(e.target.value))} 
              min={100} 
              max={60000} 
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isWriting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isWriting}>
            {isWriting ? "Writing..." : "Write"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
