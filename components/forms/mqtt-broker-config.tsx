import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface MqttBrokerConfigProps {
    config: any;
    onUpdate: (config: any) => void;
}

export function MqttBrokerConfig({ config, onUpdate }: MqttBrokerConfigProps) {
    const handleChange = (key: string, value: any) => {
        onUpdate({ ...config, [key]: value });
    };

    return (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
             <p className="text-sm text-muted-foreground">
                Publish the source tag's value to a topic on an MQTT broker.
            </p>
            <div>
                <Label htmlFor="topic">Topic</Label>
                <Input
                    id="topic"
                    type="text"
                    placeholder="e.g., /devices/1/temperature"
                    value={config.topic || ''}
                    onChange={(e) => handleChange('topic', e.target.value)}
                />
                 <p className="text-xs text-muted-foreground mt-1">The MQTT topic to publish data to.</p>
            </div>
            <div>
                <Label htmlFor="qos">Quality of Service (QoS)</Label>
                 <Select value={config.qos?.toString() || '0'} onValueChange={(v) => handleChange('qos', parseInt(v, 10))}>
                    <SelectTrigger id="qos">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0">0 - At most once</SelectItem>
                        <SelectItem value="1">1 - At least once</SelectItem>
                        <SelectItem value="2">2 - Exactly once</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                    <Label>Retain Message</Label>
                    <p className="text-[0.8rem] text-muted-foreground">
                        If true, the message will be retained by the broker.
                    </p>
                </div>
                <Switch
                    checked={config.retain || false}
                    onCheckedChange={(c) => handleChange('retain', c)}
                />
            </div>
        </div>
    );
} 