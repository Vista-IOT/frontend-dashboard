import type { ConfigSchema } from "../stores/configuration-store";

export const comprehensiveConfig: ConfigSchema = {
  device: {
    name: "Vista-IoT-Gateway-001",
    model: "Vista-IoT-GW-5000",
    version: "2.1.0",
    location: "Building A - Floor 3 - Room 305",
    description: "Primary IoT Gateway for Industrial Automation System",
  },
  network: {
    interfaces: {},
    firewall: {
      enabled: true,
      default_policy: "drop",
      rules: [
        {
          id: "rule-1",
          action: "allow",
          protocol: "tcp",
          source_ip: "192.168.1.0/24",
          description: "Allow local network access"
        },
        {
          id: "rule-2", 
          action: "allow",
          protocol: "tcp",
          source_ip: "10.0.0.0/8",
          description: "Allow corporate network access"
        }
      ],
    },
    dhcp_server: {
      enabled: true,
      start_ip: "192.168.1.150",
      end_ip: "192.168.1.200",
      lease_time: 24,
      domain: "vista.local",
      dns_servers: ["192.168.1.1", "8.8.8.8"],
    },
    static_routes: [
      {
        id: "route-1",
        destination: "10.0.0.0",
        netmask: "255.0.0.0",
        gateway: "192.168.1.254",
        interface: "eth0",
        metric: 10
      },
      {
        id: "route-2",
        destination: "172.16.0.0",
        netmask: "255.240.0.0",
        gateway: "192.168.1.254",
        interface: "eth0",
        metric: 20
      }
    ],
    port_forwarding: [
      {
        id: "pf-1",
        name: "Web Interface",
        protocol: "tcp",
        external_port: 8080,
        internal_ip: "192.168.1.100",
        internal_port: 3000
      },
      {
        id: "pf-2",
        name: "SSH Access",
        protocol: "tcp",
        external_port: 2222,
        internal_ip: "192.168.1.100",
        internal_port: 22
      },
      {
        id: "pf-3",
        name: "Modbus TCP",
        protocol: "tcp",
        external_port: 502,
        internal_ip: "192.168.1.100",
        internal_port: 502
      }
    ],
    dynamic_dns: {
      enabled: true,
      provider: "noip",
      domain: "vista-gateway.ddns.net",
      username: "vista_admin",
      password: "SecureDDNS123!",
      update_interval: 30,
    },
  },
  protocols: {
    modbus: {
      enabled: true,
      mode: "tcp",
      tcp: {
        port: 502,
        max_connections: 10,
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
          id: "map-1",
          register: 40001,
          type: "holding"
        }
      ],
    },
    mqtt: {
      enabled: true,
      broker: {
        address: "mqtt.vista.local",
        port: 1883,
        client_id: "vista-gateway-001",
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
          enabled: true,
          username: "vista_user",
          password: "MQTTPass456!",
        },
      },
      topics: {
        publish: [
          {
            path: "vista/gateway/001/status",
            qos: 1
          },
          {
            path: "vista/gateway/001/data",
            qos: 0
          }
        ],
        subscribe: [
          {
            path: "vista/gateway/001/command",
            qos: 1
          }
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
      timeout: 60,
      action: "restart",
      custom_command: "",
    },
    gpio: {
      inputs: [
        {
          id: "gpio-in-1",
          state: false
        },
        {
          id: "gpio-in-2", 
          state: true
        }
      ],
      outputs: [
        {
          id: "gpio-out-1",
          state: false
        },
        {
          id: "gpio-out-2",
          state: true
        }
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
        id: "user-1",
        username: "admin"
      },
      {
        id: "user-2",
        username: "operator"
      }
    ],
    certificates: [
      {
        id: "cert-1",
        name: "Vista Gateway Certificate"
      }
    ],
  },
  logging: {
    level: "info",
    max_size: "50M",
    max_files: 10,
    remote_syslog: {
      enabled: true,
      server: "192.168.1.50",
      port: 514,
    },
  },
  maintenance: {
    auto_update: {
      enabled: true,
      schedule: "0 2 * * 0",
      channel: "stable",
    },
    backup: {
      enabled: true,
      schedule: "0 1 * * *",
      retain: 30,
      location: "remote",
    },
  },
  hardware_mappings: [
    {
      id: "hm-serial-1",
      name: "Serial Main",
      type: "serial",
      path: "/dev/ttyS1",
      description: "Main RS-232 port"
    },
    {
      id: "hm-serial-2",
      name: "Serial Secondary",
      type: "serial",
      path: "/dev/ttyUSB0",
      description: "USB Serial Adapter"
    },
    {
      id: "hm-net-1",
      name: "Network Main",
      type: "network",
      path: "eth0",
      description: "Primary Ethernet interface"
    },
    {
      id: "hm-wifi-1",
      name: "WiFi",
      type: "network",
      path: "wlan0",
      description: "WiFi interface"
    }
  ],
  io_setup: {
    ports: [
      {
        id: "ioport-1",
        type: "builtin",
        name: "Primary Serial Port",
        description: "Main communication port for industrial devices",
        scanTime: 1000,
        timeOut: 3000,
        retryCount: 3,
        autoRecoverTime: 10,
        scanMode: "serial",
        enabled: true,
        hardwareMappingId: "hm-serial-1",
        serialSettings: {
          port: "/dev/ttyS1",
          baudRate: 9600,
          dataBit: 8,
          stopBit: 1,
          parity: "None",
          rts: false,
          dtr: false,
          enabled: true,
        },
        devices: [
          {
            id: "device-1",
            enabled: true,
            name: "PLC-001",
            deviceType: "Modbus RTU",
            unitNumber: 1,
            tagWriteType: "Single Write",
            description: "Primary Programmable Logic Controller",
            addDeviceNameAsPrefix: true,
            useAsciiProtocol: 0,
            packetDelay: 20,
            digitalBlockSize: 512,
            analogBlockSize: 64,
            tags: [
              {
                id: "tag-1",
                name: "Temperature_Sensor_1",
                dataType: "Analog",
                registerType: "Holding Register",
                address: "40001",
                startBit: 0,
                lengthBit: 16,
                spanLow: 0,
                spanHigh: 100,
                defaultValue: 25,
                scanRate: 1,
                readWrite: "Read/Write",
                description: "Temperature reading from sensor 1",
                scaleType: "Linear Scale",
                formula: "",
                scale: 0.1,
                offset: 0,
                clampToLow: false,
                clampToHigh: false,
                clampToZero: false,
                conversionType: "UINT16, Big Endian"
              },
              {
                id: "tag-2",
                name: "Pressure_Sensor_1",
                dataType: "Analog",
                registerType: "Holding Register",
                address: "40002",
                startBit: 0,
                lengthBit: 16,
                spanLow: 0,
                spanHigh: 1000,
                defaultValue: 0,
                scanRate: 1,
                readWrite: "Read Only",
                description: "Pressure reading from sensor 1",
                scaleType: "Linear Scale",
                formula: "",
                scale: 1,
                offset: 0,
                clampToLow: false,
                clampToHigh: false,
                clampToZero: false,
                conversionType: "UINT16, Big Endian"
              },
              {
                id: "tag-3",
                name: "Pump_Status",
                dataType: "Digital",
                registerType: "Coil",
                address: "00001",
                startBit: 0,
                lengthBit: 1,
                spanLow: 0,
                spanHigh: 1,
                defaultValue: 0,
                scanRate: 1,
                readWrite: "Read/Write",
                description: "Pump on/off status",
                scaleType: "No Scale",
                formula: "",
                scale: 1,
                offset: 0,
                clampToLow: false,
                clampToHigh: false,
                clampToZero: false,
                conversionType: "Boolean"
              }
            ]
          },
          {
            id: "device-2",
            enabled: true,
            name: "HMI-001",
            deviceType: "Modbus RTU",
            unitNumber: 2,
            tagWriteType: "Single Write",
            description: "Human Machine Interface",
            addDeviceNameAsPrefix: true,
            useAsciiProtocol: 0,
            packetDelay: 20,
            digitalBlockSize: 512,
            analogBlockSize: 64,
            tags: [
              {
                id: "tag-4",
                name: "Setpoint_Temperature",
                dataType: "Analog",
                registerType: "Holding Register",
                address: "40010",
                startBit: 0,
                lengthBit: 16,
                spanLow: 0,
                spanHigh: 100,
                defaultValue: 25,
                scanRate: 1,
                readWrite: "Read/Write",
                description: "Temperature setpoint from HMI",
                scaleType: "Linear Scale",
                formula: "",
                scale: 0.1,
                offset: 0,
                clampToLow: false,
                clampToHigh: false,
                clampToZero: false,
                conversionType: "UINT16, Big Endian"
              }
            ]
          }
        ]
      },
      {
        id: "ioport-2",
        type: "tcpip",
        name: "Ethernet Devices",
        description: "Network-connected industrial devices",
        scanTime: 500,
        timeOut: 2000,
        retryCount: 2,
        autoRecoverTime: 5,
        scanMode: "tcp",
        enabled: true,
        hardwareMappingId: "hm-net-1",
        devices: [
          {
            id: "device-3",
            enabled: true,
            name: "Remote_PLC",
            deviceType: "Modbus TCP",
            unitNumber: 1,
            tagWriteType: "Single Write",
            description: "Remote PLC over Ethernet",
            addDeviceNameAsPrefix: true,
            useAsciiProtocol: 0,
            packetDelay: 10,
            digitalBlockSize: 512,
            analogBlockSize: 64,
            tags: [
              {
                id: "tag-5",
                name: "Flow_Rate",
                dataType: "Analog",
                registerType: "Holding Register",
                address: "40001",
                startBit: 0,
                lengthBit: 32,
                spanLow: 0,
                spanHigh: 1000,
                defaultValue: 0,
                scanRate: 2,
                readWrite: "Read Only",
                description: "Flow rate measurement",
                scaleType: "Linear Scale",
                formula: "",
                scale: 0.01,
                offset: 0,
                clampToLow: false,
                clampToHigh: false,
                clampToZero: false,
                conversionType: "FLOAT32, IEEE 754"
              }
            ]
          }
        ]
      },
      {
        id: "ioport-3",
        type: "builtin",
        name: "Secondary Serial Port",
        description: "Backup serial port for redundancy",
        scanTime: 1000,
        timeOut: 3000,
        retryCount: 3,
        autoRecoverTime: 10,
        scanMode: "serial",
        enabled: true,
        hardwareMappingId: "hm-serial-2",
        serialSettings: {
          port: "/dev/ttyUSB0",
          baudRate: 19200,
          dataBit: 8,
          stopBit: 1,
          parity: "Even",
          rts: false,
          dtr: false,
          enabled: true,
        },
        devices: []
      },
      {
        id: "ioport-4",
        type: "tcpip",
        name: "WiFi Devices",
        description: "Devices connected over WiFi",
        scanTime: 1000,
        timeOut: 3000,
        retryCount: 3,
        autoRecoverTime: 10,
        scanMode: "tcp",
        enabled: true,
        hardwareMappingId: "hm-wifi-1",
        devices: []
      },
      {
        id: "ioport-5",
        type: "builtin",
        name: "Custom Serial Port",
        description: "Manual entry for custom serial port",
        scanTime: 1000,
        timeOut: 3000,
        retryCount: 3,
        autoRecoverTime: 10,
        scanMode: "serial",
        enabled: true,
        hardwareInterface: "/dev/ttyCUSTOM1",
        serialSettings: {
          port: "/dev/ttyCUSTOM1",
          baudRate: 38400,
          dataBit: 8,
          stopBit: 1,
          parity: "Odd",
          rts: false,
          dtr: false,
          enabled: true,
        },
        devices: []
      }
    ],
  },
  user_tags: [
    {
      id: "user-tag-1",
      name: "Manual_Temperature_Input",
      dataType: "Analog",
      defaultValue: 25,
      spanHigh: 100,
      spanLow: 0,
      readWrite: "Read/Write",
      description: "Manual temperature input for testing"
    },
    {
      id: "user-tag-2",
      name: "Alarm_Status",
      dataType: "Digital",
      defaultValue: 0,
      spanHigh: 1,
      spanLow: 0,
      readWrite: "Read/Write",
      description: "Global alarm status flag"
    }
  ],
  calculation_tags: [
    {
      id: "calc-tag-1",
      name: "Temperature_Difference",
      dataType: "Analog",
      defaultValue: 0,
      formula: "A-B",
      a: "PLC-001:Temperature_Sensor_1",
      b: "HMI-001:Setpoint_Temperature",
      c: "",
      d: "",
      e: "",
      f: "",
      g: "",
      h: "",
      period: 1,
      readWrite: "Read Only",
      spanHigh: 50,
      spanLow: -50,
      isParent: false,
      description: "Difference between actual and setpoint temperature",
      address: "calc-001"
    },
    {
      id: "calc-tag-2",
      name: "Average_Temperature",
      dataType: "Analog",
      defaultValue: 0,
      formula: "(A+B)/2",
      a: "PLC-001:Temperature_Sensor_1",
      b: "Remote_PLC:Flow_Rate",
      c: "",
      d: "",
      e: "",
      f: "",
      g: "",
      h: "",
      period: 5,
      readWrite: "Read Only",
      spanHigh: 100,
      spanLow: 0,
      isParent: false,
      description: "Average of temperature and flow rate",
      address: "calc-002"
    }
  ],
  stats_tags: [
    {
      id: "stats-tag-1",
      name: "Temperature_Max_1H",
      referTag: "PLC-001:Temperature_Sensor_1",
      type: "Max",
      updateCycleValue: 60,
      updateCycleUnit: "min",
      description: "Maximum temperature over 1 hour"
    },
    {
      id: "stats-tag-2",
      name: "Temperature_Avg_1H",
      referTag: "PLC-001:Temperature_Sensor_1",
      type: "Average",
      updateCycleValue: 60,
      updateCycleUnit: "min",
      description: "Average temperature over 1 hour"
    },
    {
      id: "stats-tag-3",
      name: "Flow_Rate_Sum_1D",
      referTag: "Remote_PLC:Flow_Rate",
      type: "Sum",
      updateCycleValue: 24,
      updateCycleUnit: "hour",
      description: "Total flow rate over 1 day"
    }
  ],
  system_tags: [
    {
      id: "sys-1",
      name: "#SYS_UPTIME",
      dataType: "Analog",
      unit: "s",
      spanHigh: 281474976710655,
      spanLow: 0,
      description: "The current uptime(s)",
      path: "/sys/uptime"
    },
    {
      id: "sys-2",
      name: "#SYS_CURRENT_TIME",
      dataType: "Analog",
      unit: "s",
      spanHigh: 281474976710655,
      spanLow: 0,
      description: "The current system time(s)",
      path: "/sys/current_time"
    },
    {
      id: "sys-3",
      name: "#SYS_CPU_FREQ",
      dataType: "Analog",
      unit: "Hz",
      spanHigh: 10737418240,
      spanLow: 0,
      description: "CPU Frequency",
      path: "/sys/cpu_freq"
    },
    {
      id: "sys-4",
      name: "#SYS_MEM_SIZE",
      dataType: "Analog",
      unit: "Byte",
      spanHigh: 10737418240,
      spanLow: 0,
      description: "Memory size(Byte)",
      path: "/sys/mem_size"
    },
    {
      id: "sys-5",
      name: "#SYS_CPU_USED",
      dataType: "Analog",
      unit: "%",
      spanHigh: 100,
      spanLow: 0,
      description: "CPU utilization rate(%)",
      path: "/sys/cpu_used"
    },
    {
      id: "sys-6",
      name: "#SYS_MEM_USED",
      dataType: "Analog",
      unit: "%",
      spanHigh: 100,
      spanLow: 0,
      description: "Memory utilization rate(%)",
      path: "/sys/mem_used"
    }
  ],
  communication_forward: {
    destinations: [
      {
        id: "dest-1",
        name: "Vista Cloud MQTT",
        type: "mqtt-broker",
        broker: {
          address: "mqtt.vista-cloud.com",
          port: 1883,
          clientId: "vista-gateway-001",
          keepalive: 60,
          cleanSession: true,
          tls: {
            enabled: true,
            version: "1.2",
            verifyServer: true,
            allowInsecure: false,
            certFile: "/certs/client.crt",
            keyFile: "/certs/client.key",
            caFile: "/certs/ca.crt"
          },
          auth: {
            enabled: true,
            username: "vista_gateway_001",
            password: "CloudPass789!"
          }
        },
        topics: {
          publish: [
            {
              path: "vista/gateway/001/telemetry",
              qos: 1,
              retain: false
            },
            {
              path: "vista/gateway/001/status",
              qos: 1,
              retain: true
            }
          ],
          subscribe: [
            {
              path: "vista/gateway/001/command",
              qos: 1
            }
          ]
        },
        description: "Primary cloud MQTT broker for telemetry data"
      },
      {
        id: "dest-2",
        name: "AWS IoT Core",
        type: "aws-iot",
        aws: {
          region: "us-east-1",
          thingName: "vista-gateway-001",
          shadow: "vista-gateway-shadow",
          endpoint: "a1b2c3d4e5f6g7.iot.us-east-1.amazonaws.com",
          credentials: {
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
          },
          certificates: {
            certFile: "/certs/aws-cert.pem",
            keyFile: "/certs/aws-key.pem",
            caFile: "/certs/aws-ca.pem"
          }
        },
        topics: {
          publish: [
            {
              path: "vista/gateway/001/data",
              qos: 1
            }
          ],
          subscribe: [
            {
              path: "vista/gateway/001/control",
              qos: 1
            }
          ]
        },
        description: "AWS IoT Core for cloud integration"
      },
      {
        id: "dest-3",
        name: "REST API Endpoint",
        type: "rest-api",
        api: {
          baseUrl: "https://api.vista-industrial.com",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer vista-api-token-123"
          },
          timeout: 30,
          retries: 3
        },
        auth: {
          type: "bearer",
          credentials: {
            token: "vista-api-token-123"
          }
        },
        dataMapping: {
          urlTemplate: "/v1/gateway/{gateway_id}/data",
          bodyTemplate: '{"timestamp": "{timestamp}", "data": {data}}',
          contentType: "application/json"
        },
        description: "REST API for data forwarding"
      },
      {
        id: "dest-4",
        name: "Virtual Memory Map",
        type: "virtual-memory-map",
        memory: {
          address: "1000",
          dataType: "float32",
          length: 10,
          endianness: "little",
          scaling: {
            enabled: true,
            factor: 0.1,
            offset: 0
          }
        },
        description: "Virtual memory mapping for internal data processing"
      }
    ],
    bridges: [
      {
        id: "bridge-1",
        blocks: [
          {
            id: "bridge-1-source",
            type: "source",
            subType: "io-tag",
            label: "Temperature Sensor 1",
            config: {
              tagId: "tag-1"
            }
          },
          {
            id: "bridge-1-filter",
            type: "intermediate",
            subType: "filter",
            label: "Temperature Filter",
            config: {
              condition: "pass",
              operator: "gte",
              value: "20"
            }
          },
          {
            id: "bridge-1-conversion",
            type: "intermediate",
            subType: "data-conversion",
            label: "Data Conversion",
            config: {
              toType: "float"
            }
          },
          {
            id: "bridge-1-dest",
            type: "destination",
            subType: "mqtt-broker",
            label: "Vista Cloud MQTT",
            config: {
              destinationId: "dest-1"
            }
          }
        ]
      },
      {
        id: "bridge-2",
        blocks: [
          {
            id: "bridge-2-source",
            type: "source",
            subType: "calc-tag",
            label: "Temperature Difference",
            config: {
              tagId: "calc-tag-1"
            }
          },
          {
            id: "bridge-2-formula",
            type: "intermediate",
            subType: "formula",
            label: "Formula Processing",
            config: {
              expression: "(x*1.8)+32"
            }
          },
          {
            id: "bridge-2-dest",
            type: "destination",
            subType: "aws-iot",
            label: "AWS IoT Core",
            config: {
              destinationId: "dest-2"
            }
          }
        ]
      },
      {
        id: "bridge-3",
        blocks: [
          {
            id: "bridge-3-source",
            type: "source",
            subType: "stats-tag",
            label: "Temperature Max 1H",
            config: {
              tagId: "stats-tag-1"
            }
          },
          {
            id: "bridge-3-dest",
            type: "destination",
            subType: "rest-api",
            label: "REST API Endpoint",
            config: {
              destinationId: "dest-3"
            }
          }
        ]
      }
    ]
  }
}; 