
import { useState, useEffect } from 'react';

interface NetworkInterface {
  name: string;
  type: string;
  mac: string;
  state: string;
  ip_addresses: string[];
  mtu: number;
}

interface ApiResponse {
  status: string;
  data: {
    network_interfaces: NetworkInterface[];
  };
  error: string | null;
  details: string | null;
}

export function useNetworkInterfaces() {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInterfaces() {
      try {
        // Dynamically replace localhost/0.0.0.0/127.0.0.1 with the current window location's hostname
        const apiHost = window.location.hostname;
        const response = await fetch(`http://${apiHost}:8000/api/hardware/network-interfaces`);
        if (!response.ok) {
          throw new Error('Failed to fetch network interfaces');
        }
        const result: ApiResponse = await response.json();
        if (result.status === 'success') {
          setInterfaces(result.data.network_interfaces);
        } else {
          throw new Error(result.error || 'Failed to get data from API');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInterfaces();
  }, []);

  return { interfaces, isLoading, error };
} 