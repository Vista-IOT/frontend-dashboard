"use client";

import { Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminManagementForm } from "@/components/forms/admin-management-form";

export default function SecurityTab() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <div>
            <CardTitle>Security & Administration</CardTitle>
            <CardDescription>
              Manage system administrators and access control
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AdminManagementForm />
      </CardContent>
    </Card>
  );
}
