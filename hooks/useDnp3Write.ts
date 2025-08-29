import { useState, useCallback } from "react";

export interface Dnp3WriteParams {
  device: any;
  address: string;
  value: string | number | boolean;
  pointType?: string;
  timeoutMs?: number;
  retries?: number;
  verify?: boolean;
  scale?: number;
  offset?: number;
}

export interface Dnp3WriteResult {
  success: boolean;
  message?: string;
  data?: any;
}

export function useDnp3Write() {
  const [isWriting, setIsWriting] = useState(false);

  const dnp3Write = useCallback(async (params: Dnp3WriteParams): Promise<Dnp3WriteResult> => {
    setIsWriting(true);
    try {
      const {
        device,
        address,
        value,
        timeoutMs = 5000,
        retries = 3,
        verify = true,
        scale = 1,
        offset = 0,
      } = params;

      // Build device config structure for backend
      const deviceConfig = {
        name: device?.name || 'UnknownDevice',
        dnp3IpAddress: device?.dnp3IpAddress || device?.ip || device?.ipAddress,
        dnp3PortNumber: device?.dnp3PortNumber || device?.port || device?.portNumber || 20000,
        dnp3LocalAddress: device?.dnp3LocalAddress || device?.localAddress || 1,
        dnp3RemoteAddress: device?.dnp3RemoteAddress || device?.remoteAddress || 4,
        dnp3TimeoutMs: device?.dnp3TimeoutMs || timeoutMs,
        dnp3Retries: device?.dnp3Retries || retries,
      };

      const payload = {
        device: deviceConfig,
        operation: {
          address,
          value,
          verify,
          scale,
          offset,
        },
      };

      // Log what we're sending
      console.log("📤 DNP3 Write Payload:", JSON.stringify(payload, null, 2));
      console.log("🔧 Device object received:", JSON.stringify(device, null, 2));

      const res = await fetch("/deploy/api/dnp3/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let responseText = await res.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      console.log("📥 DNP3 Write Response:", responseData);

      if (!res.ok) {
        let message = responseData?.message || responseData?.error || `DNP3 Write failed (${res.status})`;
        return { success: false, message };
      }

      return { 
        success: responseData?.success || true, 
        message: responseData?.message || "OK",
        data: responseData?.data
      };
    } catch (e: any) {
      console.error("❌ DNP3 Write Exception:", e);
      return { success: false, message: e?.message || String(e) };
    } finally {
      setIsWriting(false);
    }
  }, []);

  return { dnp3Write, isWriting };
}
