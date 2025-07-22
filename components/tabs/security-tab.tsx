"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Database, Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IPSecVPNForm } from "@/components/forms/ipsec-vpn-form";
import { FirewallForm } from "@/components/forms/firewall-form";
import { IPBindingForm } from "@/components/forms/ip-binding-form";
import { EncryptionSettingsForm } from "@/components/forms/encryption-settings-form";
import { CertificateManagementForm } from "@/components/forms/certificate-management-form";
import { useConfigStore } from "@/lib/stores/configuration-store";

export default function SecurityTab() {
  const searchParams = useSearchParams();
  const config = useConfigStore(state => state.config);
  const [activeSecurityTab, setActiveSecurityTab] = useState(() => {
    return searchParams.get("section") || "vpn";
  });

  // Update active tab when section changes in URL
  useEffect(() => {
    const section = searchParams.get("section");
    if (section) {
      setActiveSecurityTab(section);
    }
  }, [searchParams]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Configuration</CardTitle>
        <CardDescription>
          Manage VPN, firewall, and security settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeSecurityTab} onValueChange={setActiveSecurityTab}>
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="vpn">VPN</TabsTrigger>
            {config.network.firewall.enabled && <TabsTrigger value="firewall">Firewall</TabsTrigger>}
            <TabsTrigger value="ip-binding">IP Binding</TabsTrigger>
            <TabsTrigger value="encryption">Encryption</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
          </TabsList>

          <TabsContent value="vpn">
            <IPSecVPNForm />
            {/* <div className="h-[2000px] bg-red-100">Test</div> */}
          </TabsContent>

          {config.network.firewall.enabled && <TabsContent value="firewall">
            <FirewallForm />
          </TabsContent>}

          <TabsContent value="ip-binding">
            <IPBindingForm />
          </TabsContent>

          <TabsContent value="encryption">
            <EncryptionSettingsForm />
          </TabsContent>

          <TabsContent value="certificates">
            <CertificateManagementForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
