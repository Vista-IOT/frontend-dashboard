import { create } from "zustand";
import YAML from "yaml";
// defaultConfig will be typed with ConfigSchema in its own file later
import { defaultConfig } from "@/lib/config/default-config";
import { Code } from "lucide-react";

// --- BEGIN: Inserted Interface Definitions ---

// Canonical IOTag definition (originally from io-tag-detail.tsx)
export interface IOTag {
  id: string;
  name: string;
  dataType: string;
  registerType?: string;
  address: string;
  description: string;
  source?: string;
  defaultValue?: string | number;
  scanRate?: number;
  conversionType?: string;
  scaleType?: string;
  readWrite?: string;
  startBit?: number;
  lengthBit?: number;
  spanLow?: number;
  spanHigh?: number;
  formula?: string;
  scale?: number;
  offset?: number;
  clampToLow?: boolean;
  clampToHigh?: boolean;
  clampToZero?: boolean;
  signalReversal?: boolean;
  value0?: string;
  value1?: string;
  // SNMP-specific fields
  asnType?: string;
  objectId?: string;
  fullObjectId?: string;
}

export interface CalculationTag extends IOTag {
  formula: string;
  a?: string;
  b?: string;
  c?: string;
  d?: string;
  e?: string;
  f?: string;
  g?: string;
  h?: string;
  period?: number;
  isParent?: boolean;
}

export interface UserTag {
  id: string;
  name: string;
  dataType: string; // e.g., "Analog", "Digital"
  defaultValue: number;
  spanHigh: number;
  spanLow: number;
  readWrite: string; // e.g., "Read", "Write", "Read/Write"
  description?: string;
}

import { z } from "zod";

// Zod schema for form validation
export const userTagSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  dataType: z.enum(["Analog", "Digital"]),
  defaultValue: z.coerce.number().default(0),
  spanHigh: z.coerce.number().min(0).default(1),
  spanLow: z.coerce.number().min(0).default(0),
  readWrite: z.string().default("Read/Write"),
  description: z.string().optional().default(""),
});

// Type for form values
export type UserTagFormValues = z.infer<typeof userTagSchema>;

export interface StatsTag {
  id: string;
  name: string;
  referTag: string; // Tag being referenced
  type: "Average" | "Max" | "Min" | "Sum"; // or string if dynamic
  updateCycleValue: number; // Numeric value (e.g., 60)
  updateCycleUnit: "sec" | "min" | "hour" | "day"; // Unit of time
  description?: string;
}

export const statsTagSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  referTag: z.string().min(1, "Refer Tag is required"),
  type: z.enum(["Average", "Max", "Min", "Sum"]),
  updateCycleValue: z.coerce.number().min(1, "Cycle value must be at least 1"),
  updateCycleUnit: z.enum(["sec", "min", "hour", "day"]),
  description: z.string().optional().default(""),
});

export type StatsTagFormValues = z.infer<typeof statsTagSchema>;

export interface SystemTag {
  id: string;
  name: string;
  dataType: "Analog" | "Digital";
  unit: string;
  spanHigh: number;
  spanLow: number;
  description?: string;
  path?: string;
}
// Canonical DeviceConfig definition (originally from device-form.tsx)
export interface DeviceConfig {
  id: string;
  enabled: boolean;
  name: string;
  deviceType: string;
  unitNumber: number;
  tagWriteType: string;
  description: string;
  addDeviceNameAsPrefix: boolean;
  useAsciiProtocol: number; // Assuming number based on typical usage
  packetDelay: number;
  digitalBlockSize: number;
  analogBlockSize: number;
  tags: IOTag[];
}

// Canonical SerialPortSettings definition (originally from io-tag-form.tsx)
export interface SerialPortSettings {
  port: string;
  baudRate: number;
  dataBit: number;
  stopBit: number | string;
  parity: string;
  rts: boolean;
  dtr: boolean;
  enabled: boolean;
}

// Canonical IOPortConfig definition (originally from io-tag-form.tsx)
export interface IOPortConfig {
  id: string;
  type: string;
  name: string;
  description: string;
  scanTime: number;
  timeOut: number;
  retryCount: number;
  autoRecoverTime: number;
  scanMode: string;
  enabled: boolean;
  serialSettings?: SerialPortSettings;
  devices: DeviceConfig[];
  hardwareMappingId?: string; // Reference to HardwareMapping (primary hardware source)
  hardwareInterface?: string; // Only used for custom/manual entries
}

// --- Sub-interfaces for ConfigSchema (derived from defaultConfig.ts) ---
interface DeviceInfo {
  name: string;
  model: string;
  version: string;
  location: string;
  description: string;
}

interface IPv4StaticConfig {
  address: string;
  netmask: string;
  gateway: string;
}

interface DNSConfig {
  primary: string;
  secondary: string;
}

interface IPv4Config {
  mode: string;
  static: IPv4StaticConfig;
  dns?: DNSConfig;
}

interface EthernetLinkConfig {
  speed: string;
  duplex: string;
}

export interface EthernetInterface {
  type: string;
  enabled: boolean;
  mode: string;
  link: EthernetLinkConfig;
  ipv4: IPv4Config;
}

interface WifiSecurity {
  mode: string;
  password: string;
}

interface WifiConfig {
  ssid: string;
  security: WifiSecurity;
  channel: string;
  band: string;
  hidden: boolean;
}

export interface WirelessInterface {
  type: string;
  enabled: boolean;
  mode: string;
  wifi: WifiConfig;
  ipv4: IPv4Config;
}

interface NetworkInterfaces {
  [key: string]: EthernetInterface | WirelessInterface;
}

// Define a basic FirewallRule, expand if structure is known
interface FirewallRule {
  id?: string; // Example property
  action: string;
  protocol?: string;
  source_ip?: string;
  description?: string;
}

interface FirewallConfig {
  enabled: boolean;
  default_policy: string;
  rules: FirewallRule[];
}

// DHCP Server Configuration
interface DHCPServerConfig {
  enabled: boolean;
  start_ip: string;
  end_ip: string;
  lease_time: number;
  domain: string;
  dns_servers: string[];
}

// Static Route Configuration
interface StaticRoute {
  id: string;
  destination: string;
  netmask: string;
  gateway: string;
  interface: string;
  metric: number;
}

// Port Forwarding Rule Configuration
interface PortForwardingRule {
  id: string;
  name: string;
  protocol: string;
  external_port: number;
  internal_ip: string;
  internal_port: number;
}

// Dynamic DNS Configuration
interface DynamicDNSConfig {
  enabled: boolean;
  provider: string;
  domain: string;
  username: string;
  password: string;
  update_interval: number;
}

interface NetworkConfig {
  interfaces: NetworkInterfaces;
  firewall: FirewallConfig;
  dhcp_server: DHCPServerConfig;
  static_routes: StaticRoute[];
  port_forwarding: PortForwardingRule[];
  dynamic_dns: DynamicDNSConfig;
}

interface ModbusTCPConfig {
  port: number;
  max_connections: number;
  timeout: number;
}

interface ModbusSerialConfig {
  port: string;
  baudrate: number;
  data_bits: number;
  parity: string;
  stop_bits: number;
}

// Define a basic ModbusMapping, expand if structure is known
interface ModbusMapping {
  id?: string; // Example property
  register: number;
  type: string;
}

interface ModbusConfig {
  enabled: boolean;
  mode: string;
  tcp: ModbusTCPConfig;
  serial: ModbusSerialConfig;
  slave_id: number;
  mapping: ModbusMapping[];
}

interface MQTTTLSConfig {
  enabled: boolean;
  version: string;
  verify_server: boolean;
  allow_insecure: boolean;
  cert_file: string;
  key_file: string;
  ca_file: string;
}

interface MQTTAuthConfig {
  enabled: boolean;
  username: string;
  password: string;
}

interface MQTTBrokerConfig {
  address: string;
  port: number;
  client_id: string;
  keepalive: number;
  clean_session: boolean;
  tls: MQTTTLSConfig;
  auth: MQTTAuthConfig;
}

// Define a basic MQTTTopic, expand if structure is known
interface MQTTTopic {
  path: string;
  qos: number;
}

interface MQTTTopics {
  publish: MQTTTopic[];
  subscribe: MQTTTopic[];
}

interface MQTTConfig {
  enabled: boolean;
  broker: MQTTBrokerConfig;
  topics: MQTTTopics;
}

interface ProtocolsConfig {
  modbus: ModbusConfig;
  mqtt: MQTTConfig;
}

interface ComPortSetting {
  mode: string;
  baudrate: number;
  data_bits: number;
  parity: string;
  stop_bits: number;
  flow_control: string;
}

interface ComPortsConfig {
  com1: ComPortSetting;
  com2: ComPortSetting;
}

interface WatchdogConfig {
  enabled: boolean;
  timeout: number;
  action: string;
  custom_command: string;
}

interface GPIOInput {
  id?: string;
  state?: boolean;
}
interface GPIOOutput {
  id?: string;
  state?: boolean;
}

interface GPIOConfig {
  inputs: GPIOInput[];
  outputs: GPIOOutput[];
}

interface HardwareConfig {
  com_ports: ComPortsConfig;
  watchdog: WatchdogConfig;
  gpio: GPIOConfig;
}

interface SSHConfig {
  enabled: boolean;
  port: number;
  allow_root: boolean;
  password_auth: boolean;
}

interface UserConfig {
  id?: string;
  username: string;
}
interface CertificateConfig {
  id?: string;
  name: string;
}

interface SecurityConfig {
  ssh: SSHConfig;
  users: UserConfig[];
  certificates: CertificateConfig[];
}

interface RemoteSyslogConfig {
  enabled: boolean;
  server: string;
  port: number;
}

interface LoggingConfig {
  level: string;
  max_size: string;
  max_files: number;
  remote_syslog: RemoteSyslogConfig;
}

interface AutoUpdateConfig {
  enabled: boolean;
  schedule: string;
  channel: string;
}

interface BackupConfig {
  enabled: boolean;
  schedule: string;
  retain: number;
  location: string;
}

interface MaintenanceConfig {
  auto_update: AutoUpdateConfig;
  backup: BackupConfig;
}

interface IOSetupConfig {
  ports: IOPortConfig[]; // Key change: explicitly IOPortConfig[]
}

export interface BridgeBlock {
  id: string; 
  type: 'source' | 'destination' | 'intermediate';
  subType: 'io-tag' | 'calc-tag' | 'stats-tag' | 'user-tag' | 'system-tag' | 'mqtt-broker' | 'aws-iot' | 'aws-mqtt' | 'rest-api' | 'virtual-memory-map' | 'data-conversion' | 'filter' | 'formula' | null;
  label: string;
  config: any;
}

// Destination Definitions
export interface MqttBrokerDestination {
  id: string;
  name: string;
  type: 'mqtt-broker';
  broker: {
    address: string;
    port: number;
    clientId: string;
    keepalive: number;
    cleanSession: boolean;
    tls: {
      enabled: boolean;
      version: string;
      verifyServer: boolean;
      allowInsecure: boolean;
      certFile: string;
      keyFile: string;
      caFile: string;
    };
    auth: {
      enabled: boolean;
      username: string;
      password: string;
    };
  };
  topics: {
    publish: Array<{
      path: string;
      qos: number;
      retain: boolean;
    }>;
    subscribe: Array<{
      path: string;
      qos: number;
    }>;
  };
  description?: string;
}

export interface AwsIotDestination {
  id: string;
  name: string;
  type: 'aws-iot';
  aws: {
    region: string;
    thingName: string;
    shadow: string;
    endpoint: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    };
    certificates: {
      certFile: string;
      keyFile: string;
      caFile: string;
    };
  };
  topics: {
    publish: Array<{
      path: string;
      qos: number;
    }>;
    subscribe: Array<{
      path: string;
      qos: number;
    }>;
  };
  description?: string;
}

export interface AwsMqttDestination {
  id: string;
  name: string;
  type: 'aws-mqtt';
  aws: {
    region: string;
    endpoint: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    };
  };
  mqtt: {
    clientId: string;
    keepalive: number;
    cleanSession: boolean;
  };
  topics: {
    publish: Array<{
      path: string;
      qos: number;
      retain: boolean;
    }>;
    subscribe: Array<{
      path: string;
      qos: number;
    }>;
  };
  description?: string;
}

export interface RestApiDestination {
  id: string;
  name: string;
  type: 'rest-api';
  api: {
    baseUrl: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers: Record<string, string>;
    timeout: number;
    retries: number;
  };
  auth: {
    type: 'none' | 'basic' | 'bearer' | 'api-key';
    credentials: {
      username?: string;
      password?: string;
      token?: string;
      apiKey?: string;
      apiKeyHeader?: string;
    };
  };
  dataMapping: {
    urlTemplate: string;
    bodyTemplate?: string;
    contentType: string;
  };
  description?: string;
}

export interface VirtualMemoryMapDestination {
  id: string;
  name: string;
  type: 'virtual-memory-map';
  memory: {
    address: string;
    dataType: 'int16' | 'int32' | 'float32' | 'float64' | 'string' | 'ascii';
    length?: number; // For string/ascii types
    endianness: 'little' | 'big';
    unitId?: number; // Modbus unit id for this entry
    scaling: {
      enabled: boolean;
      factor: number;
      offset: number;
    };
  };
  description?: string;
}

export type Destination = 
  | MqttBrokerDestination 
  | AwsIotDestination 
  | AwsMqttDestination 
  | RestApiDestination 
  | VirtualMemoryMapDestination;

export interface Bridge {
  id: string;
  blocks: BridgeBlock[];
}

export interface CommunicationForwardConfig {
  destinations: Destination[];
  bridges: Bridge[];
}

// Add HardwareMappingTag interface for hardware mappings
export interface HardwareMappingTag {
  id: string;
  name: string;
  type: string; // network, serial, gpio, etc.
  path: string; // e.g., eth0, /dev/ttyUSB0, etc.
  description: string;
}

// The main configuration schema
export interface ConfigSchema {
  device: DeviceInfo;
  network: NetworkConfig;
  protocols: ProtocolsConfig;
  hardware: HardwareConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
  maintenance: MaintenanceConfig;
  io_setup: IOSetupConfig;
  user_tags: UserTag[];
  calculation_tags: CalculationTag[];
  stats_tags: StatsTag[];
  system_tags: SystemTag[];
  communication_forward?: CommunicationForwardConfig;
  hardware_mappings?: HardwareMappingTag[];
  virtual_memory_map?: any[];
}

// --- END: Inserted Interface Definitions ---

// ConfigState interface, modified to use ConfigSchema
export interface ConfigState {
  config: ConfigSchema; // MODIFIED: Use ConfigSchema
  lastUpdated: string;
  isDirty: boolean;
  updateConfig: (path: string[], value: any) => void;
  resetConfig: () => Promise<void>;
  getYamlString: () => string;
  getLastUpdated: () => string;
  setDirty: (isDirty: boolean) => void;
  getConfig: () => ConfigSchema; // MODIFIED: Return type is ConfigSchema
  hydrateConfigFromBackend: () => Promise<void>;
  saveConfigToBackend: () => Promise<void>;
}

// --- BEGIN: Dynamic Default Config Generator ---

/**
 * Fetches available network interfaces and serial ports from the backend and builds a dynamic default config.
 */
export async function fetchDynamicDefaultConfig(): Promise<ConfigSchema> {
  // Use window.location.hostname with port 8000 or fallback
  const apiBase = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000");

  // Fetch all hardware info from /api/hardware/detect
  const detectRes = await fetch(`${apiBase}/api/hardware/detect`);
  const detectJson = await detectRes.json();
  const hardware = detectJson.data || {};
  const interfaces = hardware.network_interfaces || [];
  const serialPorts = hardware.serial_ports || [];

  // Build network.interfaces
  const networkInterfaces: any = {};
  interfaces.forEach((iface: any) => {
    if (iface.type === "Ethernet") {
      networkInterfaces[iface.name] = {
        type: "ethernet",
        enabled: true,
        mode: "dhcp",
        link: { speed: "auto", duplex: "auto" },
        ipv4: {
          mode: "dhcp",
          static: { address: "", netmask: "", gateway: "" },
          dns: { primary: "", secondary: "" },
        },
      };
    } else if (iface.type === "WiFi") {
      networkInterfaces[iface.name] = {
        type: "wireless",
        enabled: true,
        mode: "client",
        wifi: {
          ssid: "",
          security: { mode: "wpa2", password: "" },
          channel: "auto",
          band: "2.4",
          hidden: false,
        },
        ipv4: {
          mode: "dhcp",
          static: { address: "", netmask: "", gateway: "" },
        },
      };
    }
  });

  // Build hardware.com_ports
  const com_ports: any = {};
  serialPorts.forEach((port: any) => {
    com_ports[port.name] = {
      mode: "rs232",
      baudrate: 9600,
      data_bits: 8,
      parity: "none",
      stop_bits: 1,
      flow_control: "none",
    };
  });

  // Compose the config (fill in other fields from static defaultConfig as fallback)
  return {
    ...defaultConfig,
    network: {
      ...defaultConfig.network,
      interfaces: networkInterfaces,
    },
    hardware: {
      ...defaultConfig.hardware,
      com_ports,
    },
  };
}
// --- END: Dynamic Default Config Generator ---

// The store implementation
export const useConfigStore = create<ConfigState>((set, get) => ({
  config: defaultConfig as ConfigSchema, // Initial value, will be replaced by dynamic config
  lastUpdated: new Date().toISOString(),
  isDirty: false,

  updateConfig: (path: string[], value: any) => {
    set((state) => {
      const newConfig = JSON.parse(JSON.stringify(state.config)) as ConfigSchema;
      let current: any = newConfig;
      for (let i = 0; i < path.length - 1; i++) {
        if (current[path[i]] === undefined || typeof current[path[i]] !== "object") {
          current[path[i]] = {};
        }
        current = current[path[i]];
      }
      if (path.length > 0) {
        current[path[path.length - 1]] = value;
      } else {
        return {
          config: value as ConfigSchema,
          lastUpdated: new Date().toISOString(),
          isDirty: true,
        };
      }
      return {
        config: newConfig,
        lastUpdated: new Date().toISOString(),
        isDirty: true,
      };
    });
  },

  // Make resetConfig async and use dynamic default config
  resetConfig: async () => {
    const dynamicConfig = await fetchDynamicDefaultConfig();
    set({
      config: dynamicConfig,
      lastUpdated: new Date().toISOString(),
      isDirty: true,
    });
  },

  getYamlString: () => {
    return YAML.stringify(get().config, { indent: 2 });
  },

  getLastUpdated: () => {
    return get().lastUpdated;
  },

  setDirty: (isDirty: boolean) => {
    set({ isDirty });
  },

  getConfig: () => {
    return get().config; // This now correctly returns ConfigSchema
  },

  hydrateConfigFromBackend: async () => {
    const apiBase = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_API_BASE_URL || "");
    const res = await fetch(`${apiBase}/deploy/config`);
    const json = await res.json();
    let config = json.raw;
    if (typeof config === "string") {
      try {
        config = YAML.parse(config);
      } catch (e) {
        config = {};
      }
    }
    set({ config, lastUpdated: new Date().toISOString(), isDirty: false });
  },

  saveConfigToBackend: async () => {
    const apiBase = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_API_BASE_URL || "");
    const yamlString = get().getYamlString();
    await fetch(`${apiBase}/deploy/config`, {
      method: "POST",
      body: yamlString,
      headers: { "Content-Type": "text/yaml" },
    });
    set({ isDirty: false });
  },
}));

export const DESTINATION_TYPES = [
  { key: "mqtt-broker", label: "MQTT Broker", icon: "/icons/mqtt-broker.svg" },
  { key: "aws-iot", label: "AWS IoT", icon: "/icons/aws-iot.svg" },
  { key: "aws-mqtt", label: "AWS MQTT", icon: "/icons/aws-mqtt.svg" },
  { key: "rest-api", label: "REST API", icon: "/icons/rest-api.svg" },
  { key: "virtual-memory-map", label: "Virtual Memory Map", icon: "/icons/virtual-memory-map.svg" },
];
