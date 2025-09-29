"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Database, Cloud } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import protocol forms
import ModbusTcpServerForm from "@/components/server-forms/modbus-server-form";
import { useConfigStore } from "@/lib/stores/configuration-store";

export default function DataServiceTab() {
  const searchParams = useSearchParams();
  const config = useConfigStore((state) => state.config);
  const [activeServiceTab, setActiveServiceTab] = useState(() => {
    return searchParams.get("service") || "mqtt";
  });

  // Sync with URL param
  useEffect(() => {
    const service = searchParams.get("service");
    if (service) {
      setActiveServiceTab(service);
    }
  }, [searchParams]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Service Configuration</CardTitle>
        <CardDescription>
          Configure protocol servers and data services
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeServiceTab} onValueChange={setActiveServiceTab}>
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="snmp">SNMP</TabsTrigger>
            <TabsTrigger value="opcua">OPC UA</TabsTrigger>
            <TabsTrigger value="modbus">Modbus</TabsTrigger>
            <TabsTrigger value="iec-104">IEC-104</TabsTrigger>
           
          </TabsList>

          {/* <TabsContent value="mqtt">
            <MQTTForm />
          </TabsContent>

          <TabsContent value="opcua">
            <OPCUAForm />
          </TabsContent> */}

          <TabsContent value="modbus">
            <ModbusTcpServerForm />
          </TabsContent>

          {/* <TabsContent value="kafka">
            <KafkaForm />
          </TabsContent>

          <TabsContent value="http">
            <HTTPForm />
          </TabsContent> */}
        </Tabs>
      </CardContent>
    </Card>
  );
}
