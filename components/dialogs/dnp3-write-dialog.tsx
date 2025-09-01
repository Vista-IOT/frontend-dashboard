"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useDnp3Write } from "@/hooks/useDnp3Write";
import { toast } from "sonner";

interface Dnp3WriteDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  device: any;
  tag: any; // expects { id, name, address, pointType? }
}

export function Dnp3WriteDialog({ open, onOpenChange, device, tag }: Dnp3WriteDialogProps) {
  const [value, setValue] = useState<string | number | boolean>("");
  const [pointType, setPointType] = useState<string>(tag?.pointType || "AO");
  const [address, setAddress] = useState<string>(tag?.address || "");
  const [timeoutMs, setTimeoutMs] = useState<number>(5000);
  const [retries, setRetries] = useState<number>(3);
  const [verify, setVerify] = useState<boolean>(true);
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<number>(0);
  const { dnp3Write, isWriting } = useDnp3Write();

  useEffect(() => {
    if (open) {
      setValue("");
      setAddress(tag?.address || "");
      
      // Extract point type from address if possible (e.g., "AO.001" -> "AO")
      if (tag?.address && tag.address.match(/[.,]/)) {
        const extractedType = tag.address.split(/[.,]/)[0].toUpperCase();
        if (['AO', 'BO'].includes(extractedType)) {
          setPointType(extractedType);
        }
      } else {
        setPointType(tag?.pointType || "AO");
      }
      
      setScale(tag?.scale || 1);
      setOffset(tag?.offset || 0);
    }
  }, [open, tag?.address, tag?.pointType, tag?.scale, tag?.offset]);

  const handleSubmit = async () => {
    // Validate address
    if (!address) {
      toast.error("DNP3 address is required");
      return;
    }

    // Validate address format
    if (!address.match(/[.,]/)) {
      toast.error("DNP3 address must be in format 'TYPE.INDEX or TYPE,INDEX' (e.g., 'AO.001', 'AI,001', 'BO.005')");
      return;
    }

    const [addrPointType, indexStr] = address.split(/[.,]/);
    
    // Validate point type is writable
    if (!['AO', 'BO'].includes(addrPointType.toUpperCase())) {
      toast.error("Only AO (Analog Output) and BO (Binary Output) points can be written");
      return;
    }

    // Validate index is numeric
    const pointIndex = parseInt(indexStr, 10);
    if (isNaN(pointIndex) || pointIndex < 0) {
      toast.error("Point index must be a valid non-negative number");
      return;
    }

    // Parse and validate value based on point type
    let parsedValue: string | number | boolean = value;
    
    if (addrPointType.toUpperCase() === 'BO') {
      // Binary output - convert to boolean
      if (typeof value === 'boolean') {
        parsedValue = value;
      } else {
        const strValue = String(value).toLowerCase().trim();
        if (strValue === 'true' || strValue === '1' || strValue === 'on') {
          parsedValue = true;
        } else if (strValue === 'false' || strValue === '0' || strValue === 'off') {
          parsedValue = false;
        } else {
          toast.error("Binary output value must be true/false, 1/0, or on/off");
          return;
        }
      }
    } else if (addrPointType.toUpperCase() === 'AO') {
      // Analog output - convert to number
      parsedValue = parseFloat(String(value));
      if (isNaN(parsedValue as number)) {
        toast.error("Analog output value must be a valid number");
        return;
      }
    }

    const res = await dnp3Write({
      device,
      address: address,
      value: parsedValue,
      timeoutMs,
      retries,
      verify,
      scale,
      offset,
    });

    if (res.success) {
      toast.success("DNP3 Write successful");
      onOpenChange(false);
    } else {
      toast.error(res.message || "DNP3 Write failed");
    }
  };

  const getValueInputType = () => {
    if (!address) return "text";
    const addrPointType = address.split(/[.,]/)[0]?.toUpperCase();
    if (addrPointType === 'BO') return "text"; // For boolean inputs (true/false)
    if (addrPointType === 'AO') return "number"; // For analog outputs
    return "text";
  };

  const getValuePlaceholder = () => {
    if (!address) return "Enter value";
    const addrPointType = address.split('.')[0]?.toUpperCase();
    if (addrPointType === 'BO') return "true, false, 1, 0, on, off";
    if (addrPointType === 'AO') return "Enter numeric value";
    return "Enter value";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>DNP3 Write</DialogTitle>
          <DialogDescription>
            Write a value to DNP3 point {address || tag?.address} on {device?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>DNP3 Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., AO.001, BO.005"
            />
            <p className="text-xs text-muted-foreground">
              Format: TYPE.INDEX (AO=Analog Output, BO=Binary Output)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Point Type</Label>
            <Select value={pointType} onValueChange={setPointType} disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select point type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AO">AO - Analog Output</SelectItem>
                <SelectItem value="BO">BO - Binary Output</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only Analog Output (AO) and Binary Output (BO) points are writable
            </p>
          </div>
          
          <div className="space-y-2">
            <Label>Value</Label>
            <Input 
              value={String(value)} 
              onChange={(e) => setValue(e.target.value)} 
              placeholder={getValuePlaceholder()}
              type={getValueInputType()}
            />
            {address?.startsWith('BO.') && (
              <p className="text-xs text-muted-foreground">
                For binary outputs: true, false, 1, 0, on, or off
              </p>
            )}
            {address?.startsWith('AO.') && (
              <p className="text-xs text-muted-foreground">
                For analog outputs: enter a numeric value
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scale Factor</Label>
              <Input 
                type="number" 
                value={scale} 
                onChange={(e) => setScale(Number(e.target.value))} 
                step={0.1}
              />
            </div>
            <div className="space-y-2">
              <Label>Offset</Label>
              <Input 
                type="number" 
                value={offset} 
                onChange={(e) => setOffset(Number(e.target.value))} 
                step={0.1}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label>Retries</Label>
              <Input 
                type="number" 
                value={retries} 
                onChange={(e) => setRetries(Number(e.target.value))} 
                min={0} 
                max={10} 
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="verify" 
              checked={verify} 
              onCheckedChange={(checked) => setVerify(checked as boolean)} 
            />
            <Label htmlFor="verify">Verify write by reading back value</Label>
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
