import { useState, useCallback } from "react";

export interface OpcuaWriteParams {
  device: any;
  deviceConfig?: any;
  nodeId: string;
  value: string | number | boolean;
  dataType: string;
  timeoutMs?: number;
}

export interface OpcuaWriteResult {
  success: boolean;
  message?: string;
}

export function useOpcuaWrite() {
  const [isWriting, setIsWriting] = useState(false);

  const opcuaWrite = useCallback(async (params: OpcuaWriteParams): Promise<OpcuaWriteResult> => {
    setIsWriting(true);
    try {
      const {
        device,
        deviceConfig = {},
        nodeId,
        value,
        dataType,
        timeoutMs = 5000,
      } = params;

      const payload = {
        deviceConfig,
        device: {
          name: device?.name,
          endpointUrl: device?.endpointUrl || device?.url,
          username: device?.username,
          password: device?.password,
          securityMode: device?.securityMode || "None",
          securityPolicy: device?.securityPolicy || "None",
        },
        nodeId,    // ✅ moved to root
        value,     // ✅ moved to root
        dataType,  // ✅ moved to root
        timeoutMs, // ✅ moved to root
      };

      // 🔍 Log what you’re sending
      console.log("📤 OPC-UA Write Payload:", JSON.stringify(payload, null, 2));

      const res = await fetch("/deploy/api/opcua/write", {
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

      console.log("📥 OPC-UA Write Response:", responseData);

      if (!res.ok) {
        let message = responseData?.message || responseData?.error || `OPC-UA Write failed (${res.status})`;
        return { success: false, message };
      }

      return { success: true, message: responseData?.message || "OK" };
    } catch (e: any) {
      console.error("❌ OPC-UA Write Exception:", e);
      return { success: false, message: e?.message || String(e) };
    } finally {
      setIsWriting(false);
    }
  }, []);

  return { opcuaWrite, isWriting };
}
