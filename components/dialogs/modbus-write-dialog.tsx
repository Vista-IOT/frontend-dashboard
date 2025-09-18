"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useModbusWrite } from "@/hooks/useModbusWrite";
import { toast } from "sonner";

interface ModbusWriteDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  device: any;
  tag: any; // expects { id, name, address, dataType?, byteOrder? }
}

export function ModbusWriteDialog({ open, onOpenChange, device, tag }: ModbusWriteDialogProps) {
  const [value, setValue] = useState<string | number | boolean>("");
  const [dataType, setDataType] = useState<string>(tag?.dataType || tag?.modbusDataType || "UINT16");
  const [byteOrder, setByteOrder] = useState<string>(tag?.byteOrder || tag?.modbusByteOrder || "ABCD");
  const [timeoutMs, setTimeoutMs] = useState<number>(3000);
  const { modbusWrite, isWriting } = useModbusWrite();

  useEffect(() => {
    if (open) {
      setValue("");
      setDataType(tag?.dataType || tag?.modbusDataType || "UINT16");
      setByteOrder(tag?.byteOrder || tag?.modbusByteOrder || "ABCD");
    }
  }, [open, tag?.dataType, tag?.modbusDataType, tag?.byteOrder, tag?.modbusByteOrder]);

  const handleSubmit = async () => {
    if (!tag?.address) {
      toast.error("Tag has no address defined");
      return;
    }

    // Parse value based on data type
    let parsedValue: string | number | boolean = value;
    if (dataType === "BOOL") {
      parsedValue = String(value).toLowerCase() === "true" || value === "1" || value === 1;
    } else if (dataType === "INT16" || dataType === "UINT16") {
      parsedValue = parseInt(String(value), 10);
      if (isNaN(parsedValue as number)) {
        toast.error("Invalid integer value");
        return;
      }
      // Check ranges
      if (dataType === "INT16" && (parsedValue < -32768 || parsedValue > 32767)) {
        toast.error("Value out of range for INT16 (-32768 to 32767)");
        return;
      }
      if (dataType === "UINT16" && (parsedValue < 0 || parsedValue > 65535)) {
        toast.error("Value out of range for UINT16 (0 to 65535)");
        return;
      }
    } else if (dataType === "INT32" || dataType === "UINT32") {
      parsedValue = parseInt(String(value), 10);
      if (isNaN(parsedValue as number)) {
        toast.error("Invalid integer value");
        return;
      }
      // Check ranges
      if (dataType === "INT32" && (parsedValue < -2147483648 || parsedValue > 2147483647)) {
        toast.error("Value out of range for INT32 (-2147483648 to 2147483647)");
        return;
      }
      if (dataType === "UINT32" && (parsedValue < 0 || parsedValue > 4294967295)) {
        toast.error("Value out of range for UINT32 (0 to 4294967295)");
        return;
      }
    } else if (dataType === "FLOAT32") {
      parsedValue = parseFloat(String(value));
      if (isNaN(parsedValue as number)) {
        toast.error("Invalid numeric value");
        return;
      }
    }

    const res = await modbusWrite({
      device,
      address: tag.address,
      value: parsedValue,
      dataType,
      byteOrder,
      timeoutMs,
    });

    if (res.success) {
      toast.success("Modbus Write successful");
      onOpenChange(false);
    } else {
      toast.error(res.message || "Modbus Write failed");
    }
  };

  const getAddressTypeInfo = (address: string | number) => {
    const addr = parseInt(String(address));
    if (addr >= 1 && addr <= 9999) {
      return "Coil (Boolean output)";
    } else if (addr >= 10001 && addr <= 19999) {
      return "Discrete Input (read-only)";
    } else if (addr >= 30001 && addr <= 39999) {
      return "Input Register (read-only)";
    } else if (addr >= 40001 && addr <= 49999) {
      return "Holding Register";
    } else {
      return "Raw address (assumed Holding Register)";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modbus Write</DialogTitle>
          <DialogDescription>
            Write a value to address {tag?.address} on {device?.name}
            {tag?.address && (
              <div className="text-xs text-muted-foreground mt-1">
                Address type: {getAddressTypeInfo(tag.address)}
              </div>
            )}
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
                <SelectItem value="BOOL">BOOL (Boolean)</SelectItem>
                <SelectItem value="INT16">INT16 (-32768 to 32767)</SelectItem>
                <SelectItem value="UINT16">UINT16 (0 to 65535)</SelectItem>
                <SelectItem value="INT32">INT32 (-2147483648 to 2147483647)</SelectItem>
                <SelectItem value="UINT32">UINT32 (0 to 4294967295)</SelectItem>
                <SelectItem value="FLOAT32">FLOAT32 (32-bit floating point)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(dataType === "INT32" || dataType === "UINT32" || dataType === "FLOAT32") && (
            <div className="space-y-2">
              <Label>Byte Order (for 32-bit values)</Label>
              <Select value={byteOrder} onValueChange={setByteOrder}>
                <SelectTrigger>
                  <SelectValue placeholder="Select byte order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABCD">ABCD (Big Endian)</SelectItem>
                  <SelectItem value="CDAB">CDAB (Little Endian)</SelectItem>
                  <SelectItem value="BADC">BADC (Big Endian, word swap)</SelectItem>
                  <SelectItem value="DCBA">DCBA (Little Endian, word swap)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Byte order determines how 32-bit values are split across two 16-bit registers
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Value</Label>
            <Input 
              value={String(value)} 
              onChange={(e) => setValue(e.target.value)} 
              placeholder="Enter value"
              type={dataType === "BOOL" ? "text" : "number"}
            />
            {dataType === "BOOL" && (
              <p className="text-xs text-muted-foreground">
                Enter "true", "false", "1", or "0" for boolean values
              </p>
            )}
            {dataType === "INT16" && (
              <p className="text-xs text-muted-foreground">
                Range: -32768 to 32767
              </p>
            )}
            {dataType === "UINT16" && (
              <p className="text-xs text-muted-foreground">
                Range: 0 to 65535
              </p>
            )}
            {dataType === "INT32" && (
              <p className="text-xs text-muted-foreground">
                Range: -2147483648 to 2147483647 (uses 2 registers)
              </p>
            )}
            {dataType === "UINT32" && (
              <p className="text-xs text-muted-foreground">
                Range: 0 to 4294967295 (uses 2 registers)
              </p>
            )}
            {dataType === "FLOAT32" && (
              <p className="text-xs text-muted-foreground">
                32-bit floating point number (uses 2 registers)
              </p>
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
