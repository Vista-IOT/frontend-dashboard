import type { ConfigSchema } from "../stores/configuration-store";

export const defaultConfig: ConfigSchema = {
  device: {
    name: "IoT-Gateway-001",
    model: "IoT-GW-5000",
    version: "2.1.0",
    location: "Production Floor 1",
    description: "Industrial IoT Gateway for SCADA integration",
  },
  network: {
    interfaces: {
      // These will be populated dynamically based on detected hardware
      eth0: {
        type: "ethernet",
        enabled: true,
        mode: "dhcp",
        link: { speed: "auto", duplex: "auto" },
        ipv4: {
          mode: "dhcp",
          static: { address: "", netmask: "", gateway: "" },
          dns: { primary: "8.8.8.8", secondary: "8.8.4.4" },
        },
      },
    },
    firewall: {
      enabled: true,
      default_policy: "drop",
      rules: [
        {
          id: "allow-ssh",
          action: "accept",
          protocol: "tcp",
          source_ip: "0.0.0.0/0",
          description: "Allow SSH access",
        },
        {
          id: "allow-modbus",
          action: "accept", 
          protocol: "tcp",
          source_ip: "0.0.0.0/0",
          description: "Allow Modbus TCP",
        },
      ],
    },
    dhcp_server: {
      enabled: false,
      start_ip: "10.0.0.100",
      end_ip: "10.0.0.200",
      lease_time: 24,
      domain: "local",
      dns_servers: ["8.8.8.8", "8.8.4.4"],
    },
    static_routes: [],
    port_forwarding: [],
    dynamic_dns: {
      enabled: false,
      provider: "dyndns",
      domain: "",
      username: "",
      password: "",
      update_interval: 60,
    },
  },
  protocols: {
    modbus: {
      enabled: true,
      mode: "tcp",
      tcp: {
        port: 502,
        max_connections: 5,
        timeout: 30,
      },
      serial: {
        port: "ttyS0",
        baudrate: 9600,
        data_bits: 8,
        parity: "none",
        stop_bits: 1,
      },
      slave_id: 1,
      mapping: [
        {
          id: "example-mapping",
          register: 40001,
          type: "holding",
        },
      ],
    },
    mqtt: {
      enabled: false,
      broker: {
        address: "localhost",
        port: 1883,
        client_id: "iot-gateway",
        keepalive: 60,
        clean_session: true,
        tls: {
          enabled: false,
          version: "1.2",
          verify_server: true,
          allow_insecure: false,
          cert_file: "",
          key_file: "",
          ca_file: "",
        },
        auth: {
          enabled: false,
          username: "",
          password: "",
        },
      },
      topics: {
        publish: [
          {
            path: "vista/status",
            qos: 1,
          },
        ],
        subscribe: [
          {
            path: "vista/command",
            qos: 1,
          },
        ],
      },
    },
  },
  hardware: {
    com_ports: {
      com1: {
        mode: "rs232",
        baudrate: 9600,
        data_bits: 8,
        parity: "none",
        stop_bits: 1,
        flow_control: "none",
      },
      com2: {
        mode: "rs485",
        baudrate: 115200,
        data_bits: 8,
        parity: "none",
        stop_bits: 1,
        flow_control: "none",
      },
    },
    watchdog: {
      enabled: true,
      timeout: 30,
      action: "restart",
      custom_command: "",
    },
    gpio: {
      inputs: [
        {
          id: "gpio-in-1",
          state: false,
        },
      ],
      outputs: [
        {
          id: "gpio-out-1", 
          state: false,
        },
      ],
    },
  },
  security: {
    ssh: {
      enabled: true,
      port: 22,
      allow_root: false,
      password_auth: false,
    },
    users: [
      {
        id: "admin",
        username: "admin",
      },
    ],
    certificates: [
      {
        id: "default-cert",
        name: "Default Certificate",
      },
    ],
  },
  logging: {
    level: "info",
    max_size: "10M",
    max_files: 5,
    remote_syslog: {
      enabled: false,
      server: "",
      port: 514,
    },
  },
  maintenance: {
    auto_update: {
      enabled: false,
      schedule: "0 0 * * 0",
      channel: "stable",
    },
    backup: {
      enabled: true,
      schedule: "0 0 * * *",
      retain: 7,
      location: "local",
    },
  },
  io_setup: {
    ports: [
      {
        id: "io-port-1",
        type: "serial",
        name: "Serial Port 1",
        description: "Primary serial communication port",
        scanTime: 1000,
        timeOut: 5000,
        retryCount: 3,
        autoRecoverTime: 30000,
        scanMode: "continuous",
        enabled: true,
        serialSettings: {
          port: "ttyS0",
          baudRate: 9600,
          dataBit: 8,
          stopBit: 1,
          parity: "none",
          rts: false,
          dtr: false,
          enabled: true,
        },
        devices: [
          {
            id: "device-1",
            enabled: true,
            name: "Modbus Device 1",
            deviceType: "modbus_rtu",
            unitNumber: 1,
            tagWriteType: "single",
            description: "Example Modbus RTU device",
            addDeviceNameAsPrefix: true,
            useAsciiProtocol: 0,
            packetDelay: 100,
            digitalBlockSize: 125,
            analogBlockSize: 125,
            tags: [
              {
                id: "tag-1",
                name: "Temperature",
                dataType: "float32",
                registerType: "holding",
                address: "40001",
                description: "Temperature reading from sensor",
                scanRate: 1000,
                readWrite: "read",
                spanLow: 0,
                spanHigh: 100,
              },
            ],
          },
        ],
      },
    ],
  },
  user_tags: [
    {
      id: "user-tag-1",
      name: "Custom Tag 1",
      dataType: "Analog",
      defaultValue: 0,
      spanHigh: 100,
      spanLow: 0,
      readWrite: "Read/Write",
      description: "Example user-defined tag",
    },
  ],
  calculation_tags: [
    {
      id: "calc-tag-1",
      name: "Average Temperature",
      dataType: "float32",
      address: "calc_001",
      description: "Average temperature calculation",
      formula: "AVG(Temperature, 60)",
      period: 60,
      scanRate: 5000,
    },
  ],
  stats_tags: [
    {
      id: "stats-tag-1",
      name: "Max Temperature",
      referTag: "Temperature",
      type: "Max",
      updateCycleValue: 60,
      updateCycleUnit: "sec",
      description: "Maximum temperature over 1 minute",
    },
  ],
  system_tags: [
    {
      id: "sys-uptime",
      name: "#SYS_UPTIME",
      dataType: "Analog",
      unit: "s",
      spanHigh: 281474976710655,
      spanLow: 0,
      description: "System uptime in seconds",
      path: "/sys/uptime",
    },
    {
      id: "sys-cpu",
      name: "#SYS_CPU_USAGE",
      dataType: "Analog",
      unit: "%",
      spanHigh: 100,
      spanLow: 0,
      description: "CPU usage percentage",
      path: "/proc/loadavg",
    },
  ],
  communication_forward: {
    destinations: [
      {
        id: "mqtt-dest-1",
        name: "Cloud MQTT",
        type: "mqtt-broker",
        broker: {
          address: "mqtt.example.com",
          port: 1883,
          clientId: "vista-gateway",
          keepalive: 60,
          cleanSession: true,
          tls: {
            enabled: false,
            version: "1.2",
            verifyServer: true,
            allowInsecure: false,
            certFile: "",
            keyFile: "",
            caFile: "",
          },
          auth: {
            enabled: true,
            username: "vista-user",
            password: "vista-pass",
          },
        },
        topics: {
          publish: [
            {
              path: "vista/data",
              qos: 1,
              retain: false,
            },
          ],
          subscribe: [
            {
              path: "vista/command",
              qos: 1,
            },
          ],
        },
        description: "MQTT broker for cloud data forwarding",
      },
    ],
    bridges: [
      {
        id: "bridge-1",
        blocks: [
          {
            id: "source-1",
            type: "source",
            subType: "io-tag",
            label: "Temperature Source",
            config: {
              tagId: "tag-1",
            },
          },
          {
            id: "dest-1",
            type: "destination",
            subType: "mqtt-broker",
            label: "MQTT Destination",
            config: {
              destinationId: "mqtt-dest-1",
            },
          },
        ],
      },
    ],
  },
  hardware_mappings: [
    {
      id: "hw-1",
      name: "Serial Port 1",
      type: "serial",
      path: "ttyS0",
      description: "Primary serial port mapping",
    },
    {
      id: "hw-2", 
      name: "Ethernet Interface",
      type: "network",
      path: "eth0",
      description: "Primary network interface",
    },
  ],
  virtual_memory_map: [
    {
      id: "vmm-1",
      name: "Holding Register 40001",
      address: "40001",
      unitId: 1,
      dataType: "float32",
      endianness: "big",
      scaling: {
        enabled: true,
        factor: 1.0,
        offset: 0.0,
      },
    },
  ],
};
