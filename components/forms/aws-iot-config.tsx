import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { BridgeBlock } from "@/lib/stores/configuration-store";

interface AwsIotConfigProps {
    config: any;
    onUpdate: (config: any) => void;
}

export function AwsIotConfig({ config, onUpdate }: AwsIotConfigProps) {
    const handleChange = (key: string, value: any) => {
        onUpdate({ ...config, [key]: value });
    };

    return (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
             <p className="text-sm text-muted-foreground">
                Publish the source tag's value to an AWS IoT Thing Shadow.
            </p>
            <div>
                <Label htmlFor="thingName">Thing Name</Label>
                <Input
                    id="thingName"
                    type="text"
                    placeholder="e.g., MyGateway-01"
                    value={config.thingName || ''}
                    onChange={(e) => handleChange('thingName', e.target.value)}
                />
                 <p className="text-xs text-muted-foreground mt-1">The name of the AWS IoT Thing to target.</p>
            </div>
            <div>
                <Label htmlFor="shadow">Topic Shadow</Label>
                <Input
                    id="shadow"
                    type="text"
                    placeholder="e.g., /shadow/update"
                    value={config.shadow || ''}
                    onChange={(e) => handleChange('shadow', e.target.value)}
                />
                 <p className="text-xs text-muted-foreground mt-1">Usually `/shadow/update` to report state.</p>
            </div>
        </div>
    );
} 