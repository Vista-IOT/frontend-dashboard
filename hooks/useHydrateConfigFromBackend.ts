import { useEffect } from "react";
import { useConfigStore } from "@/lib/stores/configuration-store";
import YAML from "yaml";

export function useHydrateConfigFromBackend() {
  const { updateConfig } = useConfigStore();

  useEffect(() => {
    // Use window.location.origin to get the correct base URL
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    
    fetch(`${baseUrl}/deploy/config`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No config snapshot found');
        const data = await res.json();
        try {
          const parsed = YAML.parse(data.raw);
          updateConfig([], parsed);
        } catch (e) {
          console.error('Failed to parse config YAML:', e);
        }
      })
      .catch((error) => {
        console.error('Failed to hydrate config from backend:', error);
      });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
} 
