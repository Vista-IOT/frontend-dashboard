import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

export function usePolledTagValues(pollInterval = 1000) {
  const [values, setValues] = useState<{ [deviceName: string]: { [tagId: string]: number } }>({});

  useEffect(() => {
    let timer: NodeJS.Timeout;
    async function fetchValues() {
      try {
        const res = await fetch(`${API_BASE}/deploy/api/io/polled-values`);
        if (res.ok) {
          const data = await res.json();
          setValues(data);
        }
      } catch (e) {
        // Optionally handle error
      }
      timer = setTimeout(fetchValues, pollInterval);
    }
    fetchValues();
    return () => clearTimeout(timer);
  }, [pollInterval]);

  return values;
} 