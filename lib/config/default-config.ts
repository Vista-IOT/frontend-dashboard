import type { ConfigSchema } from '../stores/configuration-store';

export const defaultConfig: ConfigSchema = {
  device: {
    name: "IoT-Gateway-001",
    model: "IoT-GW-5000",
    version: "2.1.0",
    location: "",
    description: ""
  },
  network: {
    interfaces: {
      eth0: {
        type: "ethernet",
        enabled: true,
        mode: "dhcp",
        link: {
          speed: "auto",
          duplex: "auto"
        },
        ipv4: {
          mode: "dhcp",
          static: {
            address: "",
            netmask: "",
            gateway: ""
          },
          dns: {
            primary: "",
            secondary: ""
          }
        }
      },
      wlan0: {
        type: "wireless",
        enabled: false,
        mode: "client",
        wifi: {
          ssid: "",
          security: {
            mode: "wpa2",
            password: ""
          },
          channel: "auto",
          band: "2.4",
          hidden: false
        },
        ipv4: {
          mode: "dhcp",
          static: {
            address: "",
            netmask: "",
            gateway: ""
          }
        }
      }
    },
    firewall: {
      enabled: true,
      default_policy: "drop",
      rules: []
    }
  },
  protocols: {
    modbus: {
      enabled: false,
      mode: "tcp",
      tcp: {
        port: 502,
        max_connections: 5,
        timeout: 30
      },
      serial: {
        port: "ttyS0",
        baudrate: 9600,
        data_bits: 8,
        parity: "none",
        stop_bits: 1
      },
      slave_id: 1,
      mapping: []
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
          ca_file: ""
        },
        auth: {
          enabled: false,
          username: "",
          password: ""
        }
      },
      topics: {
        publish: [],
        subscribe: []
      }
    }
  },
  hardware: {
    com_ports: {
      com1: {
        mode: "rs232",
        baudrate: 9600,
        data_bits: 8,
        parity: "none",
        stop_bits: 1,
        flow_control: "none"
      },
      com2: {
        mode: "rs485",
        baudrate: 115200,
        data_bits: 8,
        parity: "none",
        stop_bits: 1,
        flow_control: "none"
      }
    },
    watchdog: {
      enabled: false,
      timeout: 30,
      action: "restart",
      custom_command: ""
    },
    gpio: {
      inputs: [],
      outputs: []
    }
  },
  security: {
    ssh: {
      enabled: true,
      port: 22,
      allow_root: false,
      password_auth: false
    },
    users: [],
    certificates: []
  },
  logging: {
    level: "info",
    max_size: "10M",
    max_files: 5,
    remote_syslog: {
      enabled: false,
      server: "",
      port: 514
    }
  },
  maintenance: {
    auto_update: {
      enabled: false,
      schedule: "0 0 * * 0",
      channel: "stable"
    },
    backup: {
      enabled: false,
      schedule: "0 0 * * *",
      retain: 7,
      location: "local"
    }
  },
  io_setup: {
    ports: []
  }
} 