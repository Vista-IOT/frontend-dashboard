"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { DeviceConfig, IOTag } from "@/lib/stores/configuration-store";

interface Iec104WriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: DeviceConfig;
  tag: IOTag;
}

export function Iec104WriteDialog({
  open,
  onOpenChange,
  device,
  tag,
}: Iec104WriteDialogProps) {
  const [value, setValue] = useState("");
  const [isWriting, setIsWriting] = useState(false);

  const handleWrite = async () => {
    if (!value.trim()) {
      toast.error("Please enter a value to write");
      return;
    }

    setIsWriting(true);

    try {
      const response = await fetch("/deploy/api/iec104/write", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId: device.id,
          tagId: tag.id,
          value: value,
          address: tag.address,
          publicAddress: tag.iec104PublicAddress,
          pointNumber: tag.iec104PointNumber,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Successfully wrote value ${value} to ${tag.name}`);
        onOpenChange(false);
        setValue("");
      } else {
        toast.error(result.error || "Failed to write value");
      }
    } catch (error) {
      toast.error("Failed to write value");
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write IEC-104 Value</DialogTitle>
          <DialogDescription>
            Write a value to {tag.name} at address {tag.address}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="writeValue">Value</Label>
            <Input
              id="writeValue"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter value to write"
            />
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Device:</strong> {device.name}</p>
            <p><strong>Tag:</strong> {tag.name}</p>
            <p><strong>Address:</strong> {tag.address}</p>
            <p><strong>Public Address:</strong> {tag.iec104PublicAddress}</p>
            <p><strong>Point Number:</strong> {tag.iec104PointNumber}</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setValue("");
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleWrite} disabled={isWriting}>
            {isWriting ? "Writing..." : "Write"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
