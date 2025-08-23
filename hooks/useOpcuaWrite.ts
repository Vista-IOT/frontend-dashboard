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

      // 🔧 FIXED: Build proper deviceConfig structure for backend
      const properDeviceConfig = {
        // Use provided deviceConfig first, then extract from device object
        ...deviceConfig,
        name: device?.name || deviceConfig?.name || 'UnknownDevice',
        opcuaServerUrl: device?.opcuaServerUrl || device?.endpointUrl || device?.url || deviceConfig?.opcuaServerUrl,
        opcuaEndpointSelection: device?.opcuaEndpointSelection || deviceConfig?.opcuaEndpointSelection,
        opcuaSecurityMode: device?.opcuaSecurityMode || device?.securityMode || deviceConfig?.opcuaSecurityMode || 'None',
        opcuaSecurityPolicy: device?.opcuaSecurityPolicy || device?.securityPolicy || deviceConfig?.opcuaSecurityPolicy || 'Basic256Sha256',
        opcuaAuthType: device?.opcuaAuthType || deviceConfig?.opcuaAuthType || 'Anonymous',
        opcuaUsername: device?.opcuaUsername || device?.username || deviceConfig?.opcuaUsername || '',
        opcuaPassword: device?.opcuaPassword || device?.password || deviceConfig?.opcuaPassword || '',
        opcuaSessionTimeout: device?.opcuaSessionTimeout || deviceConfig?.opcuaSessionTimeout || 60000,
        opcuaRequestTimeout: device?.opcuaRequestTimeout || timeoutMs || deviceConfig?.opcuaRequestTimeout || 5000,
      };

      const payload = {
        deviceConfig: properDeviceConfig,
        nodeId,
        value,
        dataType,
      };

      // 🔍 Log what you're sending
      console.log("📤 OPC-UA Write Payload:", JSON.stringify(payload, null, 2));
      console.log("🔧 Device object received:", JSON.stringify(device, null, 2));

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
