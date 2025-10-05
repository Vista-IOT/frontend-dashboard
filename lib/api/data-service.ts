/**
 * Data-Service API Client
 * 
 * This module provides functions to interact with the Data-Service API
 * running on port 8080 (as configured in the Data-Service .env file)
 */

export interface DataServiceConfig {
  baseUrl?: string;
  timeout?: number;
}

export interface DataPoint {
  key: string;
  address?: number;
  default: any;
  data_type: string;
  units: string;
  allow_address_conflict?: boolean;
}

export interface IEC104Mapping {
  id: string;
  key: string;
  ioa: number;  // Information Object Address
  type: string; // IEC104 Type ID
}

export interface ModbusMapping {
  id: string;
  key: string;
  register_address: number;
  function_code: number;
  data_type: string;
  access: string;
  scaling_factor: number;
  endianess: string;
  description: string;
}

export interface DataServiceResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface BulkRegisterRequest {
  points: Array<{
    key: string;
    address?: number;
    default: any;
    data_type: string;
    units: string;
  }>;
  allow_address_conflict: boolean;
}

export interface BulkRegisterResponse {
  ok: boolean;
  total_points: number;
  successful: number;
  failed: number;
  results: Array<{
    index: number;
    key: string;
    id: string;
    ok: boolean;
    error?: string;
  }>;
  errors: string[];
}

class DataServiceAPI {
  private baseUrl: string;
  private timeout: number;

  constructor(config: DataServiceConfig = {}) {
    // Default to Data-Service port 8080 as configured in its .env file
    this.baseUrl = config.baseUrl || (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:8080` : "http://localhost:8080");
    this.timeout = config.timeout || 10000;
  }

  private async request<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<DataServiceResponse<T>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          ok: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        ok: true,
        data,
      };
    } catch (error: any) {
      return {
        ok: false,
        error: error.message || 'Network error',
      };
    }
  }

  // Health check
  async health() {
    return this.request('/health');
  }

  // Get current data snapshot
  async getData() {
    return this.request('/data');
  }

  // Get detailed data with metadata
  async getDetailedData() {
    return this.request('/detailed');
  }

  // Get statistics
  async getStats() {
    return this.request('/stats');
  }

  // Register a single data point
  async registerDataPoint(dataPoint: DataPoint) {
    return this.request('/register', {
      method: 'POST',
      body: JSON.stringify(dataPoint),
    });
  }

  // Bulk register data points
  async bulkRegister(request: BulkRegisterRequest): Promise<DataServiceResponse<BulkRegisterResponse>> {
    return this.request('/register/bulk', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Write data to a point
  async writeData(key: string, value: any) {
    return this.request('/write', {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });
  }

  // Get all Modbus mappings
  async getModbusMappings() {
    return this.request('/mappings/modbus');
  }

  // Create Modbus mapping
  async createModbusMapping(mapping: ModbusMapping) {
    return this.request('/mappings/modbus', {
      method: 'POST',
      body: JSON.stringify(mapping),
    });
  }

  // Enable Modbus service
  async enableModbusService() {
    return this.request('/services/modbus/enable', {
      method: 'POST',
    });
  }

  // Disable Modbus service
  async disableModbusService() {
    return this.request('/services/modbus/disable', {
      method: 'POST',
    });
  }

  // Enable OPC-UA service
  async enableOpcuaService() {
    return this.request('/services/opcua/enable', {
      method: 'POST',
    });
  }

  // Disable OPC-UA service
  async disableOpcuaService() {
    return this.request('/services/opcua/disable', {
      method: 'POST',
    });
  }

  // Get all OPC-UA mappings
  async getOpcuaMappings() {
    return this.request('/mappings/opcua');
  }

  // Create OPC-UA mapping
  async createOpcuaMapping(mapping: any) {
    return this.request('/mappings/opcua', {
      method: 'POST',
      body: JSON.stringify(mapping),
    });
  }

  // Get detailed health status
  async getDetailedHealth() {
    return this.request('/health/detailed');
  }

  // Get address space information
  async getAddressSpace() {
    return this.request('/addr');
  }

  // Get address space allocation info
  async getAddressSpaceInfo() {
    return this.request('/address-space/info');
  }

  // List all datapoints
  async listDatapoints() {
    return this.request('/datapoints');
  }

  // Simulate data (for testing)
  async simulateData() {
    return this.request('/simulate', {
      method: 'POST',
    });
  }
  // IEC104 Server Methods
  async getIEC104Mappings() {
    return this.request("/mappings/iec104");
  }

  async createIEC104Mapping(mapping: any) {
    return this.request("/mappings/iec104", {
      method: "POST",
      body: JSON.stringify(mapping),
    });
  }

  async enableIEC104Service() {
    return this.request("/services/iec104/enable", {
      method: "POST",
    });
  }

  async disableIEC104Service() {
    return this.request("/services/iec104/disable", {
      method: "POST",
    });
  }
}

// Default instance
export const dataServiceAPI = new DataServiceAPI();

// Helper functions for frontend integration

export function mapFrontendDataTypeToDataService(frontendType: string): string {
  const mapping: Record<string, string> = {
    'Analog': 'float',
    'Digital': 'bool', 
    'UInt16': 'int',
    'UInt32': 'int',
    'Int16': 'int',
    'Int32': 'int',
    'Float': 'float',
    'Boolean': 'bool',
    'String': 'string',
    'uint16': 'int',
    'uint32': 'int',
    'int16': 'int',
    'int32': 'int',
    'float32': 'float',
    'bool': 'bool',
  };
  return mapping[frontendType] || 'float';
}

export function mapFrontendRegisterTypeToFunctionCode(registerType: string): number {
  const mapping: Record<string, number> = {
    'Coil': 1,
    'Discrete Input': 2,
    'Input Register': 4,
    'Holding Register': 3,
    'holding_register': 3,
    'input_register': 4,
    'coil': 1,
    'discrete_input': 2,
  };
  return mapping[registerType] || 3; // Default to Holding Register
}

export function mapFrontendDataTypeToModbusType(frontendType: string): string {
  const mapping: Record<string, string> = {
    'UInt16': 'int16',
    'UInt32': 'int32', 
    'Int16': 'int16',
    'Int32': 'int32',
    'Float': 'float32',
    'Boolean': 'int16',
    'Analog': 'float32',
    'Digital': 'int16',
    'uint16': 'int16',
    'uint32': 'int32',
    'int16': 'int16', 
    'int32': 'int32',
    'float32': 'float32',
    'bool': 'int16',
  };
  return mapping[frontendType] || 'int16';
}

export function determineRegisterAccess(registerType: string): string {
  const readOnlyTypes = ['Discrete Input', 'Input Register', 'discrete_input', 'input_register'];
  return readOnlyTypes.includes(registerType) ? 'r' : 'rw';
}

// Error handling helper
export function isDataServiceError(response: DataServiceResponse): response is DataServiceResponse & { ok: false; error: string } {
  return !response.ok;
}

export { DataServiceAPI };

// IEC104 helper functions
export function mapFrontendTypeIDToIEC104Type(typeID: string): string {
  const mapping: Record<string, string> = {
    'M_SP_NA_1': 'M_SP_NA_1',     // Single point information
    'M_DP_NA_1': 'M_DP_NA_1',     // Double point information
    'M_ME_NA_1': 'M_ME_NA_1',     // Measured value, normalized
    'M_ME_NB_1': 'M_ME_NB_1',     // Measured value, scaled
    'M_ME_NC_1': 'M_ME_NC_1',     // Measured value, floating point
    'Single Point': 'M_SP_NA_1',
    'Double Point': 'M_DP_NA_1', 
    'Measured Normalized': 'M_ME_NA_1',
    'Measured Scaled': 'M_ME_NB_1',
    'Measured Float': 'M_ME_NC_1',
  };
  return mapping[typeID] || 'M_SP_NA_1';
}

export function mapFrontendDataTypeToIEC104Type(frontendType: string): string {
  const mapping: Record<string, string> = {
    'UInt16': 'int16',
    'UInt32': 'int32', 
    'Int16': 'int16',
    'Int32': 'int32',
    'Float': 'float32',
    'Boolean': 'bool',
    'Analog': 'float32',
    'Digital': 'bool',
    'uint16': 'int16',
    'uint32': 'int32',
    'int16': 'int16', 
    'int32': 'int32',
    'float32': 'float32',
    'bool': 'bool',
  };
  return mapping[frontendType] || 'int16';
}

export function determineIEC104Access(typeID: string): string {
  // In IEC104, most measured values are read-only, commands are write-only or read-write
  const readOnlyTypes = ['M_SP_NA_1', 'M_DP_NA_1', 'M_ME_NA_1', 'M_ME_NB_1', 'M_ME_NC_1'];
  return readOnlyTypes.includes(typeID) ? 'r' : 'rw';
}
