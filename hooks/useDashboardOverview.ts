import { useEffect, useState } from "react";

export function useDashboardOverview(refreshInterval = 1000) {
  const [data, setData] = useState<any>(null);
  const baseUrl =
    typeof window !== "undefined"
      ? `http://${window.location.hostname}:8000`
      : process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  useEffect(() => {
    let isMounted = true;
    const fetchData = () => {
      fetch(`${baseUrl}/api/dashboard/overview`)
        .then((res) => res.json())
        .then((json) => {
          if (isMounted) setData(json.data);
        });
    };
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [baseUrl, refreshInterval]);

  return data;
}
