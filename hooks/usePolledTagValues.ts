import { useEffect, useState } from "react";

export interface PolledTagValue {
  value: number | null;
  status: string;
  error: string | null;
  timestamp: number;
}

export function usePolledTagValues(pollInterval = 1000) {
  const [values, setValues] = useState<{ [deviceName: string]: { [tagId: string]: PolledTagValue } }>({});

  useEffect(() => {
    let timer: NodeJS.Timeout;
    async function fetchValues() {
      try {
        const res = await fetch("/api/io/polled-values");
        if (res.ok) {
          const data = await res.json();
          // If backend returns empty object or error, clear values
          if (!data || Object.keys(data).length === 0) {
            setValues({});
          } else {
            setValues(data);
          }
        } else {
          setValues({});
        }
      } catch (e) {
        setValues({});
      }
      timer = setTimeout(fetchValues, pollInterval);
    }
    fetchValues();
    return () => clearTimeout(timer);
  }, [pollInterval]);

  return values;
} 