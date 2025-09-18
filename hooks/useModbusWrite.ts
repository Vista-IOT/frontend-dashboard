import { useState, useCallback } from "react";

export interface ModbusWriteParams {
  device: any;
  deviceConfig?: any;
  address: string | number;
  value: string | number | boolean;
  dataType: string;
  byteOrder?: string;
  timeoutMs?: number;
}

export interface ModbusWriteResult {
  success: boolean;
  message?: string;
  data?: any;
}

export function useModbusWrite() {
  const [isWriting, setIsWriting] = useState(false);

  const modbusWrite = useCallback(async (params: ModbusWriteParams): Promise<ModbusWriteResult> => {
    setIsWriting(true);
    try {
      const {
        device,
        deviceConfig = {},
        address,
        value,
        dataType,
        byteOrder = "ABCD",
        timeoutMs = 3000,
      } = params;

      // Build proper deviceConfig structure for backend
      const properDeviceConfig = {
        // Use provided deviceConfig first, then extract from device object
        ...deviceConfig,
        name: device?.name || deviceConfig?.name || 'UnknownDevice',
        ipAddress: device?.ipAddress || device?.ip || deviceConfig?.ipAddress || 'localhost',
        portNumber: device?.portNumber || device?.port || deviceConfig?.portNumber || 502,
        unitNumber: device?.unitNumber || device?.unit || deviceConfig?.unitNumber || 1,
        timeout: device?.timeout || Math.floor(timeoutMs / 1000) || deviceConfig?.timeout || 3,
      };

      const payload = {
        deviceConfig: properDeviceConfig,
        address,
        value,
        dataType,
        byteOrder,
      };

      // Log what you're sending for debugging
      console.log("📤 Modbus Write Payload:", JSON.stringify(payload, null, 2));
      console.log("🔧 Device object received:", JSON.stringify(device, null, 2));

      const res = await fetch("/deploy/api/modbus/write", {
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

      console.log("📥 Modbus Write Response:", responseData);

      if (!res.ok) {
        let message = responseData?.message || responseData?.error || `Modbus Write failed (${res.status})`;
        return { success: false, message };
      }

      // Check if response indicates success
      if (responseData?.success === false) {
        return { 
          success: false, 
          message: responseData?.error || "Modbus Write operation failed" 
        };
      }

      return { 
        success: true, 
        message: responseData?.message || "Write successful",
        data: responseData?.data 
      };
    } catch (e: any) {
      console.error("❌ Modbus Write Exception:", e);
      return { success: false, message: e?.message || String(e) };
    } finally {
      setIsWriting(false);
    }
  }, []);

  return { modbusWrite, isWriting };
}
