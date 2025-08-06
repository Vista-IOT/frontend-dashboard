import { useState } from "react";

interface MqttBrokerFormProps {
  onSave: (config: { topic: string }) => void;
  existingConfig?: { topic?: string };
}

export function MqttBrokerForm({ onSave, existingConfig }: MqttBrokerFormProps) {
  const [topic, setTopic] = useState(existingConfig?.topic || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const brokerConfig = {
      topic,
    };
    onSave(brokerConfig);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-2 mt-4">
        <label htmlFor="mqtt-topic" className="block font-medium text-sm">MQTT Topic</label>
        <input
          id="mqtt-topic"
          type="text"
          className="w-full border rounded px-3 py-2"
          placeholder="e.g. vista/gateway/data"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          required
        />
      </div>
    </form>
  );
} 