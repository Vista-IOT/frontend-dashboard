"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSnmpSet } from "@/hooks/useSnmpSet";
import { toast } from "sonner";

interface SnmpSetDialogProps {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	device: any;
	tag: any; // expects { id, name, address, asnType? }
}

export function SnmpSetDialog({ open, onOpenChange, device, tag }: SnmpSetDialogProps) {
	const [value, setValue] = useState("");
	const [asnType, setAsnType] = useState<string>(tag?.asnType || "Integer32");
	const [timeoutMs, setTimeoutMs] = useState<number>(2000);
	const [retries, setRetries] = useState<number>(1);
	const { snmpSet, isSetting } = useSnmpSet();

	useEffect(() => {
		if (open) {
			setValue("");
			setAsnType(tag?.asnType || "Integer32");
		}
	}, [open, tag?.asnType]);

	const handleSubmit = async () => {
		if (!tag?.address) {
			toast.error("Tag has no OID address defined");
			return;
		}
		const res = await snmpSet({
			device,
			oid: tag.address,
			value,
			type: asnType as any,
			timeoutMs,
			retries,
		});
		if (res.success) {
			toast.success("SNMP SET successful");
			onOpenChange(false);
		} else {
			toast.error(res.message || "SNMP SET failed");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>SNMP Set</DialogTitle>
					<DialogDescription>
						Write a value to OID {tag?.address} on {device?.name}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label>ASN Type</Label>
						<Select value={asnType} onValueChange={setAsnType}>
							<SelectTrigger>
								<SelectValue placeholder="Select type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="Integer32">Integer32</SelectItem>
								<SelectItem value="String">String</SelectItem>
								<SelectItem value="Oid">Oid</SelectItem>
								<SelectItem value="OctetString">OctetString</SelectItem>
								<SelectItem value="Timeticks">Timeticks</SelectItem>
								<SelectItem value="Boolean">Boolean</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Value</Label>
						<Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Enter value" />
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Timeout (ms)</Label>
							<Input type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value))} min={100} max={60000} />
						</div>
						<div className="space-y-2">
							<Label>Retries</Label>
							<Input type="number" value={retries} onChange={(e) => setRetries(Number(e.target.value))} min={0} max={5} />
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSetting}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={isSetting}>
						{isSetting ? "Setting..." : "Set"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}


