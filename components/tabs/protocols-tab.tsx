"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Database } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DNP3Form } from "@/components/forms/dnp3-form"
import { ModbusForm } from "@/components/forms/modbus-form"
import { SNMPForm } from "@/components/forms/snmp-form"
import { IECProtocolsForm } from "@/components/forms/iec-protocols-form"
import { ProtocolConversionForm } from "@/components/forms/protocol-conversion-form"
import { DataMappingForm } from "@/components/forms/data-mapping-form"
import { useConfigStore } from "@/lib/stores/configuration-store"

export default function ProtocolsTab() {
  const searchParams = useSearchParams()
  const config = useConfigStore(state => state.config);
  const [activeProtocolTab, setActiveProtocolTab] = useState(() => {
    return searchParams.get("section") || "dnp3"
  })

  // Update active tab when section changes in URL
  useEffect(() => {
    const section = searchParams.get("section")
    if (section) {
      setActiveProtocolTab(section)
    }
  }, [searchParams])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Industrial Protocols</CardTitle>
        <CardDescription>Manage industrial communication protocols</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeProtocolTab} onValueChange={setActiveProtocolTab}>
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="dnp3">DNP3.0</TabsTrigger>
            <TabsTrigger value="opcua">OPC-UA</TabsTrigger>
            {config.protocols.modbus.enabled && <TabsTrigger value="modbus">Modbus</TabsTrigger>}
            <TabsTrigger value="snmp">SNMP</TabsTrigger>
            <TabsTrigger value="iec">IEC</TabsTrigger>
          </TabsList>

          <TabsContent value="dnp3">
            <DNP3Form />
          </TabsContent>

          <TabsContent value="opcua">
            <div className="p-6 text-center text-muted-foreground">
              <p>OPC-UA configuration is available in the IO Setup section.</p>
              <p>Create devices with device type "OPC-UA" to configure OPC-UA connections.</p>
            </div>
          </TabsContent>

          {config.protocols.modbus.enabled && <TabsContent value="modbus">
            <ModbusForm separateAdvancedConfig={false} />
          </TabsContent>}

          <TabsContent value="snmp">
            <SNMPForm />
          </TabsContent>

          <TabsContent value="iec">
            <IECProtocolsForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

