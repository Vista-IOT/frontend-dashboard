import { useEffect } from "react";
import { useConfigStore } from "@/lib/stores/configuration-store";
import YAML from "yaml";

export function useHydrateConfigFromBackend() {
  const { updateConfig } = useConfigStore();

  useEffect(() => {
    fetch('/deploy/config')
      .then(async (res) => {
        if (!res.ok) throw new Error('No config snapshot found');
        const data = await res.json();
        try {
          const parsed = YAML.parse(data.raw);
          updateConfig([], parsed);
        } catch (e) {
          // Optionally handle error
        }
      })
      .catch(() => {
        // Optionally fallback to default config
      });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
} 
