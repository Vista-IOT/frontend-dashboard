import { BackendControl } from "@/components/backend-control";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Info } from "lucide-react";

export default function BackendPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Backend Management</h1>
      
      <BackendControl />
      
      <Tabs defaultValue="setup">
        <TabsList className="mb-4">
          <TabsTrigger value="setup">Setup Guide</TabsTrigger>
          <TabsTrigger value="hardware">Hardware Requirements</TabsTrigger>
          <TabsTrigger value="testing">Testing Process</TabsTrigger>
        </TabsList>
        
        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Setting Up the Gateway Backend</CardTitle>
              <CardDescription>Follow these steps to set up your Vista IoT Gateway backend</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-lg font-medium">Step 1: Install Dependencies</h3>
              <p>Install all required dependencies for the backend server:</p>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md overflow-x-auto">
                <code>
                  cd vista-iot-gateway-backend{"\n"}
                  pip install -r requirements.txt
                </code>
              </pre>
              
              <h3 className="text-lg font-medium">Step 2: Configure Hardware</h3>
              <p>Connect your hardware devices (like serial adapters, GPIO modules) to your system.</p>
              
              <h3 className="text-lg font-medium">Step 3: Configure through Frontend</h3>
              <p>Use the web interface to configure your gateway settings, including:</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>Network settings</li>
                <li>Protocol settings (Modbus, MQTT)</li>
                <li>IO Ports and Devices</li>
                <li>Tags and Data Mapping</li>
              </ul>
              
              <h3 className="text-lg font-medium">Step 4: Start the Backend</h3>
              <p>Start the backend server with your configuration:</p>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md overflow-x-auto">
                <code>
                  cd vista-iot-gateway-backend{"\n"}
                  python -m vista_iot.app
                </code>
              </pre>
              
              <Alert variant="info" className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Quick Start</AlertTitle>
                <AlertDescription>
                  You can also use the "Launch Backend" button on this page to start the backend server with your current configuration.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="hardware" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hardware Requirements</CardTitle>
              <CardDescription>Recommended hardware for your Industrial IoT Gateway</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-lg font-medium">Minimum System Requirements</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>Linux-based system (Ubuntu 20.04 LTS or newer recommended)</li>
                <li>CPU: Dual-core processor, 1.5 GHz or faster</li>
                <li>RAM: 2 GB or more</li>
                <li>Storage: 8 GB or more</li>
                <li>Network: Ethernet interface</li>
              </ul>
              
              <h3 className="text-lg font-medium">Serial Communication</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>USB-to-Serial adapters for RS-232/RS-485/RS-422 (FTDI chipset recommended)</li>
                <li>For Modbus RTU: RS-485 converter with automatic flow control</li>
              </ul>
              
              <h3 className="text-lg font-medium">GPIO Testing</h3>
              <p>For testing GPIO functionality:</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>Raspberry Pi or similar SBC with GPIO pins</li>
                <li>LED indicators and buttons for simple I/O testing</li>
                <li>Relay modules for testing digital outputs</li>
              </ul>
              
              <h3 className="text-lg font-medium">Recommended Test Equipment</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>Modbus RTU slave simulator device</li>
                <li>MQTT client for testing MQTT functionality</li>
                <li>Network analyzer for troubleshooting</li>
                <li>Digital multimeter for electrical verification</li>
              </ul>
              
              <Alert variant="warning" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Important Note</AlertTitle>
                <AlertDescription>
                  When connecting to industrial equipment, ensure proper isolation and voltage levels to prevent damage to your equipment.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Testing Process</CardTitle>
              <CardDescription>How to test your Vista IoT Gateway</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-lg font-medium">Step-by-Step Testing Process</h3>
              
              <h4 className="font-medium">1. Initial Setup Testing</h4>
              <p>Start with basic connectivity testing:</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>Launch the backend service</li>
                <li>Verify the service is running through the status indicator</li>
                <li>Check backend logs for any startup errors</li>
              </ul>
              
              <h4 className="font-medium">2. Network Configuration Testing</h4>
              <ul className="list-disc ml-6 space-y-1">
                <li>Configure and test Ethernet interfaces</li>
                <li>Test DHCP server functionality if enabled</li>
                <li>Verify firewall rules are applied correctly</li>
              </ul>
              
              <h4 className="font-medium">3. Protocol Testing</h4>
              <ul className="list-disc ml-6 space-y-1">
                <li><strong>Modbus TCP:</strong> Use a Modbus client simulator to connect to the gateway and read/write registers</li>
                <li><strong>Modbus RTU:</strong> Connect a Modbus RTU device to a serial port and test communication</li>
                <li><strong>MQTT:</strong> Use an MQTT client to subscribe to topics and verify message publishing</li>
              </ul>
              
              <h4 className="font-medium">4. Tag and Data Testing</h4>
              <ul className="list-disc ml-6 space-y-1">
                <li>Configure IO tags for your devices</li>
                <li>Test tag reading and writing</li>
                <li>Verify calculation tags and statistics tags are updating correctly</li>
                <li>Test data forwarding to cloud platforms or other destinations</li>
              </ul>
              
              <h4 className="font-medium">5. Performance Testing</h4>
              <ul className="list-disc ml-6 space-y-1">
                <li>Test with expected number of devices and tags</li>
                <li>Monitor CPU and memory usage</li>
                <li>Test concurrent connections and data throughput</li>
              </ul>
              
              <h4 className="font-medium">6. Reliability Testing</h4>
              <ul className="list-disc ml-6 space-y-1">
                <li>Run the system for an extended period (24+ hours)</li>
                <li>Test recovery from network disruptions</li>
                <li>Test restart and recovery procedures</li>
              </ul>
              
              <Alert variant="info" className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Test Environment</AlertTitle>
                <AlertDescription>
                  For initial testing, a virtual environment or development setup is recommended before deploying to production hardware.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
