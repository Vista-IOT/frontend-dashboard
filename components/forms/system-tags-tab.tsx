"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useConfigStore } from "@/lib/stores/configuration-store";
import type { SystemTag } from "@/lib/stores/configuration-store";

export function SystemTagsTab() {
  const [systemTags, setSystemTags] = useState<SystemTag[]>([]);
  useEffect(() => {
    const tags = useConfigStore.getState().config.system_tags || [];
    setSystemTags(tags);
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Tags</CardTitle>
        <CardDescription>View system-defined tags and their properties</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Data Type</TableHead>
                <TableHead className="font-semibold">Unit</TableHead>
                <TableHead className="font-semibold text-center">Span High</TableHead>
                <TableHead className="font-semibold text-center">Span Low</TableHead>
                <TableHead className="w-[300px] font-semibold">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {systemTags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No system tags configured
                  </TableCell>
                </TableRow>
              ) : (
                systemTags.map((tag, index) => (
                  <TableRow key={tag.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="text-center font-medium text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {tag.dataType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tag.unit ? (
                        <Badge variant="secondary">{tag.unit}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {tag.spanHigh !== undefined ? (
                        <span className="font-mono text-sm bg-green-50 text-green-700 px-2 py-1 rounded">
                          {tag.spanHigh}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {tag.spanLow !== undefined ? (
                        <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {tag.spanLow}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px] text-muted-foreground" title={tag.description}>
                      <div className="truncate">
                        {tag.description || "No description available"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
} 