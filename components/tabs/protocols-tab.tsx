"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Database } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DNP3Form } from "@/components/forms/dnp3-form"
import { OPCUAForm } from "@/components/forms/opcua-form"
import { ModbusForm } from "@/components/forms/modbus-form"
import { IECProtocolsForm } from "@/components/forms/iec-protocols-form"
import { ProtocolConversionForm } from "@/components/forms/protocol-conversion-form"
import { DataMappingForm } from "@/components/forms/data-mapping-form"

export default function ProtocolsTab() {
  const searchParams = useSearchParams()
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
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="dnp3">DNP3.0</TabsTrigger>
            <TabsTrigger value="opcua">OPC-UA</TabsTrigger>
            <TabsTrigger value="modbus">Modbus</TabsTrigger>
            <TabsTrigger value="iec">IEC</TabsTrigger>
          </TabsList>

          <TabsContent value="dnp3">
            <DNP3Form />
          </TabsContent>

          <TabsContent value="opcua">
            <OPCUAForm />
          </TabsContent>

          <TabsContent value="modbus">
            <ModbusForm separateAdvancedConfig={false} />
          </TabsContent>

          <TabsContent value="iec">
            <IECProtocolsForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

