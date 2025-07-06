// If you haven't already, install uuid: npm install uuid
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

const defaultValues: Record<string, any> = {
  "mqtt-broker": {
    name: "",
    broker: {
      address: "",
      port: 1883,
      clientId: "",
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
        enabled: false,
        username: "",
        password: "",
      },
    },
    topics: { publish: [], subscribe: [] },
    description: "",
  },
  "aws-iot": {
    name: "",
    aws: {
      region: "",
      thingName: "",
      shadow: "",
      endpoint: "",
      credentials: { accessKeyId: "", secretAccessKey: "", sessionToken: "" },
      certificates: { certFile: "", keyFile: "", caFile: "" },
    },
    topics: { publish: [], subscribe: [] },
    description: "",
  },
  "aws-mqtt": {
    name: "",
    aws: {
      region: "",
      endpoint: "",
      credentials: { accessKeyId: "", secretAccessKey: "", sessionToken: "" },
    },
    mqtt: { clientId: "", keepalive: 60, cleanSession: true },
    topics: { publish: [], subscribe: [] },
    description: "",
  },
  "rest-api": {
    name: "",
    api: {
      baseUrl: "",
      method: "POST",
      headers: {},
      timeout: 10,
      retries: 0,
    },
    auth: {
      type: "none",
      credentials: {},
    },
    dataMapping: {
      urlTemplate: "",
      bodyTemplate: "",
      contentType: "application/json",
    },
    description: "",
  },
  "virtual-memory-map": {
    name: "",
    memory: {
      address: "",
      dataType: "int16",
      length: 1,
      endianness: "little",
      scaling: { enabled: false, factor: 1, offset: 0 },
    },
    description: "",
  },
};

// --- Helpers ---
function isValidClientId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{3,30}$/.test(id);
}

function isValidIpOrDomain(address: string): boolean {
  return /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,}|^(\d{1,3}\.){3}\d{1,3}$/.test(
    address
  );
}

function isValidAuthString(str: string): boolean {
  return /^[^\s]{3,}$/.test(str); // min 3 chars, no whitespace
}

function isValidTLSVersion(version: string): boolean {
  return /^1\.(0|1|2|3)$/.test(version); // TLS 1.0–1.3
}

function isNonEmpty(value: string | undefined | null): boolean {
  return !!value && value.trim().length > 0;
}

function isPositiveNumber(n: any): boolean {
  return typeof n === "number" && !isNaN(n) && n > 0;
}

function isNumber(n: any): boolean {
  return typeof n === "number" && !isNaN(n);
}

function showErrors(errors: string[]): boolean {
  errors.forEach((err) => toast.error(err));
  return false;
}

function validateMqttConfig(values: any): boolean {
  const errors: string[] = [];

  if (!isNonEmpty(values.name)) errors.push("Name is required.");
  if (!isNonEmpty(values.broker?.address)) {
    errors.push("Broker address is required.");
  } else if (!isValidIpOrDomain(values.broker.address)) {
    errors.push("Enter a valid broker address (domain or IP).");
  }

  if (!isPositiveNumber(values.broker?.port) || values.broker.port > 65535)
    errors.push("Port must be between 1 and 65535.");

  if (!isNonEmpty(values.broker?.clientId)) {
    errors.push("Client ID is required.");
  } else if (!isValidClientId(values.broker.clientId)) {
    errors.push(
      "Client ID must be 3–30 characters, only letters, numbers, -, _."
    );
  }

  if (
    !isNumber(values.broker?.keepalive) ||
    values.broker.keepalive < 0 ||
    values.broker.keepalive > 3600
  )
    errors.push("Keepalive must be between 0 and 3600 seconds.");

  if (values.broker?.tls?.enabled) {
    if (
      !isNonEmpty(values.broker.tls.version) ||
      !isValidTLSVersion(values.broker.tls.version)
    )
      errors.push("TLS version must be 1.0 to 1.3.");
    if (!isNonEmpty(values.broker.tls.caFile))
      errors.push("CA file is required.");
    if (!isNonEmpty(values.broker.tls.certFile))
      errors.push("Cert file is required.");
    if (!isNonEmpty(values.broker.tls.keyFile))
      errors.push("Key file is required.");
  }

  if (values.broker?.auth?.enabled) {
    if (
      !isNonEmpty(values.broker.auth.username) ||
      !isValidAuthString(values.broker.auth.username)
    )
      errors.push("Username must be at least 3 characters, no spaces.");
    if (
      !isNonEmpty(values.broker.auth.password) ||
      !isValidAuthString(values.broker.auth.password)
    )
      errors.push("Password must be at least 3 characters, no spaces.");
  }

  return errors.length > 0 ? showErrors(errors) : true;
}

function validateAwsIotConfig(values: any): boolean {
  const errors: string[] = [];

  if (!isNonEmpty(values.name)) errors.push("Name is required.");
  if (!isNonEmpty(values.aws?.region)) errors.push("Region is required.");
  if (!isNonEmpty(values.aws?.thingName))
    errors.push("Thing Name is required.");
  if (!isNonEmpty(values.aws?.shadow)) errors.push("Shadow is required.");
  if (!isNonEmpty(values.aws?.endpoint)) errors.push("Endpoint is required.");

  if (!isNonEmpty(values.aws?.credentials?.accessKeyId))
    errors.push("Access Key ID is required.");
  if (!isNonEmpty(values.aws?.credentials?.secretAccessKey))
    errors.push("Secret Access Key is required.");

  if (!isNonEmpty(values.aws?.certificates?.caFile))
    errors.push("CA File is required.");
  if (!isNonEmpty(values.aws?.certificates?.certFile))
    errors.push("Cert File is required.");
  if (!isNonEmpty(values.aws?.certificates?.keyFile))
    errors.push("Key File is required.");

  return errors.length > 0 ? showErrors(errors) : true;
}

function validateAwsMqttConfig(values: any): boolean {
  const errors: string[] = [];

  if (!isNonEmpty(values.name)) errors.push("Name is required.");
  if (!isNonEmpty(values.aws?.region)) errors.push("Region is required.");
  if (!isNonEmpty(values.aws?.endpoint)) errors.push("Endpoint is required.");

  if (!isNonEmpty(values.aws?.credentials?.accessKeyId))
    errors.push("Access Key ID is required.");
  if (!isNonEmpty(values.aws?.credentials?.secretAccessKey))
    errors.push("Secret Access Key is required.");

  if (!isNonEmpty(values.mqtt?.clientId)) errors.push("Client ID is required.");
  if (!isNumber(values.mqtt?.keepalive))
    errors.push("Keepalive must be a valid number.");

  return errors.length > 0 ? showErrors(errors) : true;
}

function validateRestApiConfig(values: any): boolean {
  const errors: string[] = [];

  if (!isNonEmpty(values.name)) errors.push("Name is required.");
  if (!isNonEmpty(values.api?.baseUrl)) errors.push("Base URL is required.");
  if (!isNonEmpty(values.api?.method)) errors.push("HTTP method is required.");
  if (!isNumber(values.api?.timeout))
    errors.push("Timeout must be a valid number.");
  if (!isNumber(values.api?.retries))
    errors.push("Retries must be a valid number.");

  const auth = values.auth;
  if (auth?.type === "basic") {
    if (!isNonEmpty(auth.credentials?.username))
      errors.push("Basic auth username required.");
    if (!isNonEmpty(auth.credentials?.password))
      errors.push("Basic auth password required.");
  } else if (auth?.type === "bearer") {
    if (!isNonEmpty(auth.credentials?.token))
      errors.push("Bearer token required.");
  } else if (auth?.type === "api-key") {
    if (!isNonEmpty(auth.credentials?.apiKey))
      errors.push("API Key is required.");
    if (!isNonEmpty(auth.credentials?.apiKeyHeader))
      errors.push("API Key Header required.");
  }

  if (!isNonEmpty(values.dataMapping?.urlTemplate))
    errors.push("URL Template is required.");
  if (!isNonEmpty(values.dataMapping?.bodyTemplate))
    errors.push("Body Template is required.");
  if (!isNonEmpty(values.dataMapping?.contentType))
    errors.push("Content Type is required.");

  return errors.length > 0 ? showErrors(errors) : true;
}

function validateVirtualMemoryMapConfig(values: any, existingConfigs: any[] = []): boolean {
  const errors: string[] = [];

  // Name validation
  if (!isNonEmpty(values.name)) {
    errors.push("Name is required.");
  } else {
    if (values.name.length < 3) {
      errors.push("Name must be at least 3 characters.");
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(values.name)) {
      errors.push("Name can only contain letters, numbers, hyphens (-), and underscores (_)." );
    }
    if (/^\d+$/.test(values.name)) {
      errors.push("Name cannot be only numbers.");
    }
    if (/^\s|\s$/.test(values.name)) {
      errors.push("Name cannot start or end with a space.");
    }
    // Uniqueness
    const isDuplicate = existingConfigs.some(
      (cfg) =>
        cfg.name?.trim().toLowerCase() === values.name?.trim().toLowerCase() &&
        cfg.id !== values.id
    );
    if (isDuplicate) {
      errors.push("Name must be unique.");
    }
  }

  // Address validation
  if (!isNonEmpty(values.memory?.address)) {
    errors.push("Address is required.");
  } else {
    const addr = values.memory.address;
    if (!/^0x[0-9a-fA-F]+$/.test(addr) && !/^\d+$/.test(addr)) {
      errors.push("Address must be a valid integer or hex (e.g., 0x1000 or 4096)." );
    }
  }

  // Data Type
  if (!isNonEmpty(values.memory?.dataType))
    errors.push("Data Type is required.");

  // Endianness
  if (!isNonEmpty(values.memory?.endianness))
    errors.push("Endianness is required.");

  // Unit ID
  const unitId = values.memory?.unitId;
  if (unitId === undefined || unitId === null || unitId === "") {
    errors.push("Unit ID is required.");
  } else if (!Number.isInteger(unitId) || unitId < 1 || unitId > 247) {
    errors.push("Unit ID must be an integer between 1 and 247.");
  }

  // Length for string/ascii
  if (["string", "ascii"].includes(values.memory?.dataType)) {
    if (!isPositiveNumber(values.memory.length) || !Number.isInteger(values.memory.length)) {
      errors.push("Length is required and must be a positive integer for string/ascii types.");
    }
  }

  // Scaling
  if (values.memory?.scaling?.enabled) {
    if (!isNumber(values.memory.scaling.factor))
      errors.push("Scaling factor must be a number.");
    if (!isNumber(values.memory.scaling.offset))
      errors.push("Scaling offset must be a number.");
  }

  // Description
  if (values.description && values.description.length > 100) {
    errors.push("Description should not exceed 100 characters.");
  }

  return errors.length > 0 ? showErrors(errors) : true;
}

export default function DestinationForm({
  type,
  initialValues,
  existingConfigs = [],
  onSubmit,
  onCancel,
}: {
  type: string;
  initialValues?: any;
  onSubmit: (dest: any) => void;
  onCancel: () => void;
  existingConfigs?: any[];
}) {
  const [values, setValues] = useState<any>(
    initialValues || defaultValues[type]
  );
  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    let isValid = true;

    if (type === "mqtt-broker") {
      isValid = validateMqttConfig(values);
    } else if (type === "aws-iot") {
      isValid = validateAwsIotConfig(values);
    } else if (type === "aws-mqtt") {
      isValid = validateAwsMqttConfig(values);
    } else if (type === "rest-api") {
      isValid = validateRestApiConfig(values);
    } else if (type === "virtual-memory-map") {
      isValid = validateVirtualMemoryMapConfig(values, existingConfigs);
    }

    if (!isValid) return;

    console.log("Checking duplicates in:", existingConfigs);

    const isDuplicateName = existingConfigs.some(
      (cfg) =>
        cfg.name?.trim().toLowerCase() === values.name?.trim().toLowerCase() &&
        cfg.id !== values.id
    );

    if (isDuplicateName) {
      toast.error("Destination name must be unique.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        ...values,
        id: values.id || uuidv4(),
        type,
      });

      toast.success(
        `${type.replace(/-/g, " ").toUpperCase()} saved successfully.`
      );
    } catch (err) {
      toast.error("Failed to save destination.");
    } finally {
      setSaving(false);
    }
  };

  // Helper for input changes
  const handleChange = (path: string[], value: any) => {
    setValues((prev: any) => {
      let obj = { ...prev };
      let cur = obj;
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {};
        cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = value;
      return obj;
    });
  };

  // Render fields for each type
  let formFields = null;
  if (type === "mqtt-broker") {
    formFields = (
      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={values.name}
                  onChange={(e) => handleChange(["name"], e.target.value)}
                  placeholder="My MQTT Broker"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={values.description}
                  onChange={(e) =>
                    handleChange(["description"], e.target.value)
                  }
                  placeholder="Optional description"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Broker Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Broker Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={values.broker.address}
                  onChange={(e) =>
                    handleChange(["broker", "address"], e.target.value)
                  }
                  placeholder="broker.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={values.broker.port}
                  onChange={(e) =>
                    handleChange(["broker", "port"], Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={values.broker.clientId}
                  onChange={(e) =>
                    handleChange(["broker", "clientId"], e.target.value)
                  }
                  placeholder="device_001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keepalive">Keepalive</Label>
                <Input
                  id="keepalive"
                  type="number"
                  value={values.broker.keepalive}
                  onChange={(e) =>
                    handleChange(
                      ["broker", "keepalive"],
                      Number(e.target.value)
                    )
                  }
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="cleanSession"
                checked={values.broker.cleanSession}
                onChange={(e) =>
                  handleChange(["broker", "cleanSession"], e.target.checked)
                }
                className="rounded"
              />
              <Label htmlFor="cleanSession">Clean Session</Label>
            </div>
          </CardContent>
        </Card>

        {/* TLS Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">TLS Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="tlsEnabled"
                checked={values.broker.tls.enabled}
                onChange={(e) =>
                  handleChange(["broker", "tls", "enabled"], e.target.checked)
                }
                className="rounded"
              />
              <Label htmlFor="tlsEnabled">Enable TLS</Label>
            </div>
            {values.broker.tls.enabled && (
              <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tlsVersion">TLS Version</Label>
                    <Input
                      id="tlsVersion"
                      value={values.broker.tls.version}
                      onChange={(e) =>
                        handleChange(
                          ["broker", "tls", "version"],
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="verifyServer"
                      checked={values.broker.tls.verifyServer}
                      onChange={(e) =>
                        handleChange(
                          ["broker", "tls", "verifyServer"],
                          e.target.checked
                        )
                      }
                      className="rounded"
                    />
                    <Label htmlFor="verifyServer">Verify Server</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allowInsecure"
                      checked={values.broker.tls.allowInsecure}
                      onChange={(e) =>
                        handleChange(
                          ["broker", "tls", "allowInsecure"],
                          e.target.checked
                        )
                      }
                      className="rounded"
                    />
                    <Label htmlFor="allowInsecure">Allow Insecure</Label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="caFile">CA File</Label>
                    <Input
                      id="caFile"
                      value={values.broker.tls.caFile}
                      onChange={(e) =>
                        handleChange(
                          ["broker", "tls", "caFile"],
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="certFile">Cert File</Label>
                    <Input
                      id="certFile"
                      value={values.broker.tls.certFile}
                      onChange={(e) =>
                        handleChange(
                          ["broker", "tls", "certFile"],
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="keyFile">Key File</Label>
                    <Input
                      id="keyFile"
                      value={values.broker.tls.keyFile}
                      onChange={(e) =>
                        handleChange(
                          ["broker", "tls", "keyFile"],
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="authEnabled"
                checked={values.broker.auth.enabled}
                onChange={(e) =>
                  handleChange(["broker", "auth", "enabled"], e.target.checked)
                }
                className="rounded"
              />
              <Label htmlFor="authEnabled">Enable Authentication</Label>
            </div>
            {values.broker.auth.enabled && (
              <div className="space-y-4 pl-4 border-l-2 border-green-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={values.broker.auth.username}
                      onChange={(e) =>
                        handleChange(
                          ["broker", "auth", "username"],
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={values.broker.auth.password}
                      onChange={(e) =>
                        handleChange(
                          ["broker", "auth", "password"],
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  } else if (type === "aws-iot") {
    formFields = (
      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={values.name}
                  onChange={(e) => handleChange(["name"], e.target.value)}
                  placeholder="My AWS IoT"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={values.description}
                  onChange={(e) =>
                    handleChange(["description"], e.target.value)
                  }
                  placeholder="Optional description"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AWS Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AWS Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={values.aws.region}
                  onChange={(e) =>
                    handleChange(["aws", "region"], e.target.value)
                  }
                  placeholder="us-east-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thingName">Thing Name</Label>
                <Input
                  id="thingName"
                  value={values.aws.thingName}
                  onChange={(e) =>
                    handleChange(["aws", "thingName"], e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shadow">Shadow</Label>
                <Input
                  id="shadow"
                  value={values.aws.shadow}
                  onChange={(e) =>
                    handleChange(["aws", "shadow"], e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endpoint">Endpoint</Label>
                <Input
                  id="endpoint"
                  value={values.aws.endpoint}
                  onChange={(e) =>
                    handleChange(["aws", "endpoint"], e.target.value)
                  }
                  placeholder="xxxxxx.iot.us-east-1.amazonaws.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accessKeyId">Access Key ID</Label>
                <Input
                  id="accessKeyId"
                  value={values.aws.credentials.accessKeyId}
                  onChange={(e) =>
                    handleChange(
                      ["aws", "credentials", "accessKeyId"],
                      e.target.value
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                <Input
                  id="secretAccessKey"
                  type="password"
                  value={values.aws.credentials.secretAccessKey}
                  onChange={(e) =>
                    handleChange(
                      ["aws", "credentials", "secretAccessKey"],
                      e.target.value
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sessionToken">Session Token</Label>
                <Input
                  id="sessionToken"
                  value={values.aws.credentials.sessionToken}
                  onChange={(e) =>
                    handleChange(
                      ["aws", "credentials", "sessionToken"],
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certificates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Certificates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="caFile">CA File</Label>
                <Input
                  id="caFile"
                  value={values.aws.certificates.caFile}
                  onChange={(e) =>
                    handleChange(
                      ["aws", "certificates", "caFile"],
                      e.target.value
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certFile">Cert File</Label>
                <Input
                  id="certFile"
                  value={values.aws.certificates.certFile}
                  onChange={(e) =>
                    handleChange(
                      ["aws", "certificates", "certFile"],
                      e.target.value
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyFile">Key File</Label>
                <Input
                  id="keyFile"
                  value={values.aws.certificates.keyFile}
                  onChange={(e) =>
                    handleChange(
                      ["aws", "certificates", "keyFile"],
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  } else if (type === "aws-mqtt") {
    formFields = (
      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={values.name}
                  onChange={(e) => handleChange(["name"], e.target.value)}
                  placeholder="My AWS MQTT"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={values.description}
                  onChange={(e) =>
                    handleChange(["description"], e.target.value)
                  }
                  placeholder="Optional description"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AWS Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AWS Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={values.aws.region}
                  onChange={(e) =>
                    handleChange(["aws", "region"], e.target.value)
                  }
                  placeholder="us-east-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endpoint">Endpoint</Label>
                <Input
                  id="endpoint"
                  value={values.aws.endpoint}
                  onChange={(e) =>
                    handleChange(["aws", "endpoint"], e.target.value)
                  }
                  placeholder="xxxxxx.iot.us-east-1.amazonaws.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accessKeyId">Access Key ID</Label>
                <Input
                  id="accessKeyId"
                  value={values.aws.credentials.accessKeyId}
                  onChange={(e) =>
                    handleChange(
                      ["aws", "credentials", "accessKeyId"],
                      e.target.value
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                <Input
                  id="secretAccessKey"
                  type="password"
                  value={values.aws.credentials.secretAccessKey}
                  onChange={(e) =>
                    handleChange(
                      ["aws", "credentials", "secretAccessKey"],
                      e.target.value
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sessionToken">Session Token</Label>
                <Input
                  id="sessionToken"
                  value={values.aws.credentials.sessionToken}
                  onChange={(e) =>
                    handleChange(
                      ["aws", "credentials", "sessionToken"],
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MQTT Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">MQTT Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={values.mqtt.clientId}
                  onChange={(e) =>
                    handleChange(["mqtt", "clientId"], e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keepalive">Keepalive</Label>
                <Input
                  id="keepalive"
                  type="number"
                  value={values.mqtt.keepalive}
                  onChange={(e) =>
                    handleChange(["mqtt", "keepalive"], Number(e.target.value))
                  }
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="cleanSession"
                checked={values.mqtt.cleanSession}
                onChange={(e) =>
                  handleChange(["mqtt", "cleanSession"], e.target.checked)
                }
                className="rounded"
              />
              <Label htmlFor="cleanSession">Clean Session</Label>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  } else if (type === "rest-api") {
    formFields = (
      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={values.name}
                  onChange={(e) => handleChange(["name"], e.target.value)}
                  placeholder="My REST API"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={values.description}
                  onChange={(e) =>
                    handleChange(["description"], e.target.value)
                  }
                  placeholder="Optional description"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">API Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={values.api.baseUrl}
                  onChange={(e) =>
                    handleChange(["api", "baseUrl"], e.target.value)
                  }
                  placeholder="https://api.example.com/data"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">Method</Label>
                <select
                  id="method"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={values.api.method}
                  onChange={(e) =>
                    handleChange(["api", "method"], e.target.value)
                  }
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (seconds)</Label>
                <Input
                  id="timeout"
                  type="number"
                  value={values.api.timeout}
                  onChange={(e) =>
                    handleChange(["api", "timeout"], Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retries">Retries</Label>
                <Input
                  id="retries"
                  type="number"
                  value={values.api.retries}
                  onChange={(e) =>
                    handleChange(["api", "retries"], Number(e.target.value))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="authType">Auth Type</Label>
              <select
                id="authType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={values.auth.type}
                onChange={(e) => handleChange(["auth", "type"], e.target.value)}
              >
                <option value="none">None</option>
                <option value="basic">Basic</option>
                <option value="bearer">Bearer</option>
                <option value="api-key">API Key</option>
              </select>
            </div>
            {values.auth.type === "basic" && (
              <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={values.auth.credentials.username || ""}
                      onChange={(e) =>
                        handleChange(
                          ["auth", "credentials", "username"],
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={values.auth.credentials.password || ""}
                      onChange={(e) =>
                        handleChange(
                          ["auth", "credentials", "password"],
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            )}
            {values.auth.type === "bearer" && (
              <div className="space-y-4 pl-4 border-l-2 border-green-200">
                <div className="space-y-2">
                  <Label htmlFor="token">Token</Label>
                  <Input
                    id="token"
                    value={values.auth.credentials.token || ""}
                    onChange={(e) =>
                      handleChange(
                        ["auth", "credentials", "token"],
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>
            )}
            {values.auth.type === "api-key" && (
              <div className="space-y-4 pl-4 border-l-2 border-purple-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      value={values.auth.credentials.apiKey || ""}
                      onChange={(e) =>
                        handleChange(
                          ["auth", "credentials", "apiKey"],
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKeyHeader">API Key Header</Label>
                    <Input
                      id="apiKeyHeader"
                      value={values.auth.credentials.apiKeyHeader || ""}
                      onChange={(e) =>
                        handleChange(
                          ["auth", "credentials", "apiKeyHeader"],
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Mapping */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="urlTemplate">URL Template</Label>
              <Input
                id="urlTemplate"
                value={values.dataMapping.urlTemplate}
                onChange={(e) =>
                  handleChange(["dataMapping", "urlTemplate"], e.target.value)
                }
                placeholder="/api/data/{id}"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bodyTemplate">Body Template</Label>
              <Textarea
                id="bodyTemplate"
                value={values.dataMapping.bodyTemplate}
                onChange={(e) =>
                  handleChange(["dataMapping", "bodyTemplate"], e.target.value)
                }
                placeholder='{"value": "{value}", "timestamp": "{timestamp}"}'
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contentType">Content Type</Label>
              <Input
                id="contentType"
                value={values.dataMapping.contentType}
                onChange={(e) =>
                  handleChange(["dataMapping", "contentType"], e.target.value)
                }
                placeholder="application/json"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  } else if (type === "virtual-memory-map") {
    formFields = (
      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={values.name}
                  onChange={(e) => handleChange(["name"], e.target.value)}
                  placeholder="My Virtual Map"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={values.description}
                  onChange={(e) =>
                    handleChange(["description"], e.target.value)
                  }
                  placeholder="Optional description"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Memory Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Memory Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={values.memory.address}
                  onChange={(e) =>
                    handleChange(["memory", "address"], e.target.value)
                  }
                  placeholder="0x1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataType">Data Type</Label>
                <select
                  id="dataType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={values.memory.dataType}
                  onChange={(e) =>
                    handleChange(["memory", "dataType"], e.target.value)
                  }
                >
                  <option value="int16">int16</option>
                  <option value="int32">int32</option>
                  <option value="float32">float32</option>
                  <option value="float64">float64</option>
                  <option value="string">string</option>
                  <option value="ascii">ascii</option>
                </select>
              </div>
              {/* Unit ID Field */}
              <div className="space-y-2">
                <Label htmlFor="unitId">Unit ID</Label>
                <Input
                  id="unitId"
                  type="number"
                  min={1}
                  value={values.memory.unitId ?? 1}
                  onChange={(e) =>
                    handleChange(["memory", "unitId"], Number(e.target.value))
                  }
                  placeholder="1"
                />
              </div>
              {/* Length Field: Always show for all data types */}
              <div className="space-y-2">
                <Label htmlFor="length">
                  {['string', 'ascii'].includes(values.memory.dataType)
                    ? 'Length (in registers)'
                    : 'Number of Registers to Map'}
                </Label>
                <Input
                  id="length"
                  type="number"
                  min={1}
                  value={values.memory.length ?? 1}
                  onChange={(e) =>
                    handleChange(["memory", "length"], Number(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {['string', 'ascii'].includes(values.memory.dataType)
                    ? 'Each register holds 2 characters (bytes).'
                    : 'Specify how many consecutive registers to map starting from the address.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endianness">Endianness</Label>
                <select
                  id="endianness"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={values.memory.endianness}
                  onChange={(e) =>
                    handleChange(["memory", "endianness"], e.target.value)
                  }
                >
                  <option value="little">Little Endian</option>
                  <option value="big">Big Endian</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scaling Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scaling Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="scalingEnabled"
                checked={values.memory.scaling.enabled}
                onChange={(e) =>
                  handleChange(
                    ["memory", "scaling", "enabled"],
                    e.target.checked
                  )
                }
                className="rounded"
              />
              <Label htmlFor="scalingEnabled">Enable Scaling</Label>
            </div>
            {values.memory.scaling.enabled && (
              <div className="space-y-4 pl-4 border-l-2 border-orange-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="factor">Factor</Label>
                    <Input
                      id="factor"
                      type="number"
                      step="0.1"
                      value={values.memory.scaling.factor}
                      onChange={(e) =>
                        handleChange(
                          ["memory", "scaling", "factor"],
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="offset">Offset</Label>
                    <Input
                      id="offset"
                      type="number"
                      step="0.1"
                      value={values.memory.scaling.offset}
                      onChange={(e) =>
                        handleChange(
                          ["memory", "scaling", "offset"],
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {formFields}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
