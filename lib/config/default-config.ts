import type { ConfigSchema } from "../stores/configuration-store";

export const defaultConfig: ConfigSchema = {
  device: {
    name: "IoT-Gateway-001",
    model: "IoT-GW-5000",
    version: "2.1.0",
    location: "",
    description: "",
  },
  network: {
    interfaces: {
      eth0: {
        type: "ethernet",
        enabled: true,
        mode: "dhcp",
        link: {
          speed: "auto",
          duplex: "auto",
        },
        ipv4: {
          mode: "dhcp",
          static: {
            address: "",
            netmask: "",
            gateway: "",
          },
          dns: {
            primary: "",
            secondary: "",
          },
        },
      },
      wlan0: {
        type: "wireless",
        enabled: false,
        mode: "client",
        wifi: {
          ssid: "",
          security: {
            mode: "wpa2",
            password: "",
          },
          channel: "auto",
          band: "2.4",
          hidden: false,
        },
        ipv4: {
          mode: "dhcp",
          static: {
            address: "",
            netmask: "",
            gateway: "",
          },
        },
      },
    },
    firewall: {
      enabled: true,
      default_policy: "drop",
      rules: [],
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
      enabled: false,
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
      mapping: [],
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
        publish: [],
        subscribe: [],
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
      enabled: false,
      timeout: 30,
      action: "restart",
      custom_command: "",
    },
    gpio: {
      inputs: [],
      outputs: [],
    },
  },
  security: {
    ssh: {
      enabled: true,
      port: 22,
      allow_root: false,
      password_auth: false,
    },
    users: [],
    certificates: [],
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
      enabled: false,
      schedule: "0 0 * * *",
      retain: 7,
      location: "local",
    },
  },
  io_setup: {
    ports: [
      // Example:
      // {
      //   id: "io-1",
      //   name: "DI1",
      //   type: "digital_input",
      //   hardwareMappingId: 1,
      //   hardwareInterface: "com1",
      //   ...other fields
      // }
    ],
  },

  user_tags: [],
  calculation_tags: [],
  stats_tags: [],
  system_tags: [
    // Example:
    // {
    //   id: "sys-1",
    //   name: "#SYS_UPTIME",
    //   dataType: "Analog",
    //   unit: "s",
    //   spanHigh: 281474976710655,
    //   spanLow: 0,
    //   description: "The current uptime(s)",
    //   path: "/sys/uptime"
    // }
  ],
  communication_forward: {
    destinations: [
      // Example:
      // {
      //   id: "dest-1",
      //   name: "SCADA",
      //   type: "modbus_tcp",
      //   configJson: "{}",
      //   description: "Modbus TCP destination"
      // }
    ],
    bridges: [],
  },
  hardware_mappings: [
    // Example:
    // {
    //   id: 1,
    //   name: "SYS_UPTIME",
    //   type: "system",
    //   path: "/sys/uptime",
    //   description: "System uptime in seconds"
    // }
  ],
  virtual_memory_map: [
    // Example:
    // {
    //   id: "vmm-1",
    //   name: "HoldingRegister1",
    //   address: 40001,
    //   unitId: 1,
    //   dataType: "Analog",
    //   ...other fields
    // }
  ],
};
