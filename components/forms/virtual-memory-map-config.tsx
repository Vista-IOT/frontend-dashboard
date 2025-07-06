import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BridgeBlock } from "../tabs/communication-forward-tab";

interface VirtualMemoryMapConfigProps {
    config: any;
    onUpdate: (config: any) => void;
}

export function VirtualMemoryMapConfig({ config, onUpdate }: VirtualMemoryMapConfigProps) {
    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({ ...config, address: parseInt(e.target.value, 10) || 0 });
    };

    const handleDataTypeChange = (value: string) => {
        onUpdate({ ...config, dataType: value });
    };
    
    const handleLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({ ...config, length: parseInt(e.target.value, 10) || 1 });
    };

    return (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
            <p className="text-sm text-muted-foreground">
                Map the source tag's value to a virtual Modbus register for external reading.
            </p>
            <div>
                <Label htmlFor="address">Start Register Address</Label>
                <Input
                    id="address"
                    type="number"
                    placeholder="e.g., 40001"
                    value={config.address || ''}
                    onChange={handleAddressChange}
                />
                 <p className="text-xs text-muted-foreground mt-1">The starting Modbus register address.</p>
            </div>
            <div>
                <Label htmlFor="dataType">Data Type</Label>
                 <Select value={config.dataType || ''} onValueChange={handleDataTypeChange}>
                    <SelectTrigger id="dataType">
                        <SelectValue placeholder="Select a data type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="int16">Signed 16-bit Integer (1 register)</SelectItem>
                        <SelectItem value="uint16">Unsigned 16-bit Integer (1 register)</SelectItem>
                        <SelectItem value="int32">Signed 32-bit Integer (2 registers)</SelectItem>
                        <SelectItem value="uint32">Unsigned 32-bit Integer (2 registers)</SelectItem>
                        <SelectItem value="float32">32-bit Float (2 registers)</SelectItem>
                        <SelectItem value="ascii">ASCII String (N registers)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="animate-in fade-in-50 duration-300">
                <Label htmlFor="length">{config.dataType === 'ascii' ? 'String Length (in registers)' : 'Number of Registers to Map'}</Label>
                <Input
                    id="length"
                    type="number"
                    placeholder={config.dataType === 'ascii' ? 'e.g., 10' : 'e.g., 1'}
                    value={config.length || ''}
                    onChange={handleLengthChange}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {config.dataType === 'ascii'
                    ? 'Each register holds 2 characters (bytes).'
                    : 'Specify how many consecutive registers to map starting from the address.'}
                </p>
            </div>
        </div>
    );
} 