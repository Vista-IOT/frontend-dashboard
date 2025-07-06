"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronRight,
  ChevronDown,
  Server,
  Cpu,
  Tag,
  UserCircle,
  FileDigit,
  BarChart,
  Cog,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog";
import type { ConfigSchema } from "@/lib/stores/configuration-store"; // adjust the path as needed
import { useConfigStore } from "@/lib/stores/configuration-store";
import { toast } from "sonner";

// Define the form schema
const calculationTagSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  defaultValue: z.coerce.number().default(0),
  formula: z.string().min(1, "Formula is required"),
  a: z.string().optional().default(""),
  b: z.string().optional().default(""),
  c: z.string().optional().default(""),
  d: z.string().optional().default(""),
  e: z.string().optional().default(""),
  f: z.string().optional().default(""),
  g: z.string().optional().default(""),
  h: z.string().optional().default(""),
  period: z.coerce.number().int().min(1).default(1),
  readWrite: z.string().default("Read/Write"),
  spanHigh: z.coerce.number().int().min(0).default(1000),
  spanLow: z.coerce.number().int().min(0).default(0),
  isParent: z.boolean().default(false),
  description: z.string().optional().default(""),
});

// Define the form props
interface CalculationTagFormProps {
  onSubmit: (values: z.infer<typeof calculationTagSchema>) => void;
  onCancel: () => void;
  initialValues?: z.infer<typeof calculationTagSchema>;
}

// Define interfaces for IO structure
interface IOTag {
  id: string;
  name: string;
  dataType: string;
  address: string;
  description: string;
}

interface Device {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  tags: IOTag[];
}

interface Port {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  devices: Device[];
}

export function CalculationTagForm({
  onSubmit,
  onCancel,
  initialValues,
}: CalculationTagFormProps) {
  // Initialize ioPorts as an empty array
  const [ioPorts, setIoPorts] = useState<Port[]>([]);

  // State for expanded items in tree
  const [expandedPorts, setExpandedPorts] = useState<string[]>([]);
  const [expandedDevices, setExpandedDevices] = useState<string[]>([]);
  const { config } = useConfigStore();
  // State for tag selection dialog
  const [tagSelectionDialog, setTagSelectionDialog] = useState({
    isOpen: false,
    targetVariable: "",
  });
  const [activeTab, setActiveTab] = useState("basic");
  const { user_tags, stats_tags, calculation_tags, system_tags } = config;
  // Load IO ports data from localStorage
  useEffect(() => {
    const fetchIoPorts = async () => {
      try {
        const storedPorts = localStorage.getItem("io_ports_data");
        if (storedPorts) {
          setIoPorts(JSON.parse(storedPorts));
        }

        const handleIoPortsUpdate = (event: StorageEvent) => {
          if (event.key === "io_ports_data") {
            try {
              const updatedPorts = JSON.parse(event.newValue || "[]");
              if (updatedPorts) {
                setIoPorts(updatedPorts);
              }
            } catch (error) {
              console.error("Error parsing updated IO ports data:", error);
            }
          }
        };

        window.addEventListener("storage", handleIoPortsUpdate);

        return () => {
          window.removeEventListener("storage", handleIoPortsUpdate);
        };
      } catch (error) {
        console.error("Error fetching IO ports data:", error);
      }
    };

    fetchIoPorts();
  }, []);

  // Toggle expansion of a port in the tree
  const togglePortExpansion = (portId: string) => {
    setExpandedPorts((prev) => {
      if (prev.includes(portId)) {
        return prev.filter((id) => id !== portId);
      } else {
        return [...prev, portId];
      }
    });
  };

  // Toggle expansion of a device in the tree
  const toggleDeviceExpansion = (deviceId: string) => {
    setExpandedDevices((prev) => {
      if (prev.includes(deviceId)) {
        return prev.filter((id) => id !== deviceId);
      } else {
        return [...prev, deviceId];
      }
    });
  };

  const [activeCategory, setActiveCategory] = useState<
    "io" | "user" | "calc" | "stats" | "system"
  >("io");

  // Define the type for the form values
  type FormValues = z.infer<typeof calculationTagSchema>;

  // Initialize the form with default values or provided initial values
  const form = useForm<FormValues>({
    resolver: zodResolver(calculationTagSchema),
    defaultValues: initialValues || {
      description: "",
      name: "",
      defaultValue: 0.0,
      formula: "",
      a: "",
      b: "",
      c: "",
      d: "",
      e: "",
      f: "",
      g: "",
      h: "",
      period: 1,
      readWrite: "Read/Write",
      spanHigh: 1000,
      spanLow: 0,
      isParent: false,
    },
    mode: "onChange",
  });

  // Custom submit logic, called only if validation passes

  function onValidSubmit(values: FormValues) {
    // 1. Duplicate tag name check
    const isDuplicate = calculation_tags.some(
      (tag) =>
        tag.name.trim().toLowerCase() === values.name.trim().toLowerCase() &&
        tag.name !== initialValues?.name // allow same name if editing
    );

    if (isDuplicate) {
      toast.error("A calculation tag with this name already exists.", {
        duration: 5000,
      });
      return;
    }

    // 2. Empty formula check
    if (!values.formula || values.formula.trim() === "") {
      toast.error("Formula field cannot be empty.", {
        duration: 5000,
      });
      return;
    }

    // 3. At least one variable (A–H) must be filled
    const variableFields = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const atLeastOneFilled = variableFields.some(
      (field) => values[field as keyof FormValues]?.trim() !== ""
    );

    if (!atLeastOneFilled) {
      toast.error("At least one variable (A–H) must be provided.", {
        duration: 5000,
      });
      return;
    }

    // 4. Formula validation
    const formula = values.formula.trim();

    // Reject any characters that are NOT: a–h (case-insensitive), numbers, + - * / . ( )
    const invalidFormula = /[^a-hA-H0-9+\-*/().]/.test(formula);
    if (invalidFormula) {
      toast.error(
        "Formula can only contain letters A–H, numbers, and operators (+, -, *, /, (, )).",
        {
          duration: 5000,
        }
      );
      return;
    }

    // Reject letters outside A–H (e.g., x, y, z, m, etc.)
    const disallowedLetters = formula.match(/[i-zI-Z]/g);
    if (disallowedLetters) {
      toast.error("Formula can only include variables A–H.", {
        duration: 5000,
      });
      return;
    }

    const openParens = (values.formula.match(/\(/g) || []).length;
    const closeParens = (values.formula.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      toast.error("Formula has unbalanced parentheses.", {
        duration: 5000,
      });
      return;
    }

    //  All validations passed
    onSubmit(values);
    onCancel();
    console.log("Submitted");
  }

  return (
    <div className="border rounded-md p-0">
      <div className="text-lg font-semibold p-4 bg-muted/30 border-b">
        New Tag
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onValidSubmit)}>
          <Tabs defaultValue="basic" className="w-full">
            <div className="border-b px-4">
              <TabsList className="bg-transparent h-12">
                <TabsTrigger
                  value="basic"
                  className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                    Basic
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="advanced"
                  className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-sm"></div>
                    Advanced
                  </div>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4">
              <TabsContent value="basic" className="mt-0">
                <div className="space-y-4">
                  <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                    <FormLabel className="text-right">
                      Name: <span className="text-red-500">*</span>
                    </FormLabel>

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              placeholder="New Calculation Tag"
                              {...field}
                              className={
                                form.formState.errors.name
                                  ? "border-red-500"
                                  : ""
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                    <FormLabel className="text-right">Default Value:</FormLabel>
                    <FormField
                      control={form.control}
                      name="defaultValue"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="0.0"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                    <FormLabel className="text-right">Period(s):</FormLabel>
                    <FormField
                      control={form.control}
                      name="period"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="1"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                    <FormLabel className="text-right">Span High:</FormLabel>
                    <FormField
                      control={form.control}
                      name="spanHigh"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="1000"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                    <FormLabel className="text-right">Span Low:</FormLabel>
                    <FormField
                      control={form.control}
                      name="spanLow"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-[120px_1fr] items-start gap-4">
                    <FormLabel className="text-right pt-2">
                      Description:
                    </FormLabel>
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Textarea
                              placeholder="Enter description"
                              className="min-h-[100px] resize-none"
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="mt-0">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value === "+")
                          form.setValue(
                            "formula",
                            form.getValues("formula") + "+"
                          );
                        if (value === "-")
                          form.setValue(
                            "formula",
                            form.getValues("formula") + "-"
                          );
                        if (value === "*")
                          form.setValue(
                            "formula",
                            form.getValues("formula") + "*"
                          );
                        if (value === "/")
                          form.setValue(
                            "formula",
                            form.getValues("formula") + "/"
                          );
                        if (value === "%")
                          form.setValue(
                            "formula",
                            form.getValues("formula") + "%"
                          );
                        if (value === "^")
                          form.setValue(
                            "formula",
                            form.getValues("formula") + "^"
                          );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mathematical" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="+">+</SelectItem>
                        <SelectItem value="-">-</SelectItem>
                        <SelectItem value="*">*</SelectItem>
                        <SelectItem value="/">/</SelectItem>
                        <SelectItem value="%">%</SelectItem>
                        <SelectItem value="^">^</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value=""
                      onValueChange={(value) => {
                        form.setValue(
                          "formula",
                          form.getValues("formula") + value
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Functions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="min( , )">min( , )</SelectItem>
                        <SelectItem value="max( , )">max( , )</SelectItem>
                        <SelectItem value="avg( , )">avg( , )</SelectItem>
                        <SelectItem value="sum( , )">sum( , )</SelectItem>
                        <SelectItem value="abs()">abs()</SelectItem>
                        <SelectItem value="ceil()">ceil()</SelectItem>
                        <SelectItem value="floor()">floor()</SelectItem>
                        <SelectItem value="round()">round()</SelectItem>
                        <SelectItem value="roundn( , )">roundn( , )</SelectItem>
                        <SelectItem value="exp()">exp()</SelectItem>
                        <SelectItem value="log()">log()</SelectItem>
                        <SelectItem value="log10()">log10()</SelectItem>
                        <SelectItem value="logn( , )">logn( , )</SelectItem>
                        <SelectItem value="root( , )">root( , )</SelectItem>
                        <SelectItem value="sqrt()">sqrt()</SelectItem>
                        <SelectItem value="clamp( , , )">
                          clamp( , , )
                        </SelectItem>
                        <SelectItem value="inrange( , , )">
                          inrange( , , )
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value=""
                      onValueChange={(value) => {
                        form.setValue(
                          "formula",
                          form.getValues("formula") + value
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Trigonometry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sin()">sin()</SelectItem>
                        <SelectItem value="cos()">cos()</SelectItem>
                        <SelectItem value="tan()">tan()</SelectItem>
                        <SelectItem value="acos()">acos()</SelectItem>
                        <SelectItem value="asin()">asin()</SelectItem>
                        <SelectItem value="atan()">atan()</SelectItem>
                        <SelectItem value="atan2( , )">atan2( , )</SelectItem>
                        <SelectItem value="cosh()">cosh()</SelectItem>
                        <SelectItem value="cot()">cot()</SelectItem>
                        <SelectItem value="csc()">csc()</SelectItem>
                        <SelectItem value="sec()">sec()</SelectItem>
                        <SelectItem value="sinh()">sinh()</SelectItem>
                        <SelectItem value="tanh()">tanh()</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value=""
                      onValueChange={(value) => {
                        form.setValue(
                          "formula",
                          form.getValues("formula") + value
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Conditional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="==">==</SelectItem>
                        <SelectItem value="!=">!=</SelectItem>
                        <SelectItem value="<">&lt;</SelectItem>
                        <SelectItem value="<=">&lt;=</SelectItem>
                        <SelectItem value=">">&gt;</SelectItem>
                        <SelectItem value=">=">&gt;=</SelectItem>
                        <SelectItem value="() ? () : ()">
                          () ? () : ()
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value=""
                      onValueChange={(value) => {
                        form.setValue(
                          "formula",
                          form.getValues("formula") + value
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Boolean logic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">and</SelectItem>
                        <SelectItem value="mand( , )">mand( , )</SelectItem>
                        <SelectItem value="mor( , )">mor( , )</SelectItem>
                        <SelectItem value="nand">nand</SelectItem>
                        <SelectItem value="nor">nor</SelectItem>
                        <SelectItem value="not()">not()</SelectItem>
                        <SelectItem value="or">or</SelectItem>
                        <SelectItem value="xor">xor</SelectItem>
                        <SelectItem value="xnor">xnor</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value=""
                      onValueChange={(value) => {
                        form.setValue(
                          "formula",
                          form.getValues("formula") + value
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Constant" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pi">pi</SelectItem>
                        <SelectItem value="epsilon">epsilon</SelectItem>
                        <SelectItem value="inf">inf</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-2">
                    <FormLabel>Expression:</FormLabel>
                    <FormField
                      control={form.control}
                      name="formula"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="Enter calculation formula"
                              className="min-h-[100px] resize-none mt-2"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FormLabel className="min-w-[20px] text-right">
                          A:
                        </FormLabel>
                        <FormField
                          control={form.control}
                          name="a"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Double click to add tag."
                                  {...field}
                                  onDoubleClick={() =>
                                    setTagSelectionDialog({
                                      isOpen: true,
                                      targetVariable: field.name,
                                    })
                                  }
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <TagSelectionDialog
                        open={tagSelectionDialog.isOpen}
                        onOpenChange={(isOpen) =>
                          setTagSelectionDialog((prev) => ({
                            ...prev,
                            isOpen,
                          }))
                        }
                        onSelectTag={(tag) => {
                          console.log("Selected tag:", tag);
                        }}
                      />

                      <div className="flex items-center gap-2 mb-2">
                        <FormLabel className="min-w-[20px] text-right">
                          C:
                        </FormLabel>
                        <FormField
                          control={form.control}
                          name="c"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Double click to add tag."
                                  {...field}
                                  onDoubleClick={() =>
                                    setTagSelectionDialog({
                                      isOpen: true,
                                      targetVariable: field.name,
                                    })
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <FormLabel className="min-w-[20px] text-right">
                          E:
                        </FormLabel>
                        <FormField
                          control={form.control}
                          name="e"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Double click to add tag."
                                  {...field}
                                  onDoubleClick={() =>
                                    setTagSelectionDialog({
                                      isOpen: true,
                                      targetVariable: field.name,
                                    })
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <FormLabel className="min-w-[20px] text-right">
                          G:
                        </FormLabel>
                        <FormField
                          control={form.control}
                          name="g"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Double click to add tag."
                                  {...field}
                                  onDoubleClick={() =>
                                    setTagSelectionDialog({
                                      isOpen: true,
                                      targetVariable: field.name,
                                    })
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FormLabel className="min-w-[20px] text-right">
                          B:
                        </FormLabel>
                        <FormField
                          control={form.control}
                          name="b"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Double click to add tag."
                                  {...field}
                                  onDoubleClick={() =>
                                    setTagSelectionDialog({
                                      isOpen: true,
                                      targetVariable: field.name,
                                    })
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <FormLabel className="min-w-[20px] text-right">
                          D:
                        </FormLabel>
                        <FormField
                          control={form.control}
                          name="d"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Double click to add tag."
                                  {...field}
                                  onDoubleClick={() =>
                                    setTagSelectionDialog({
                                      isOpen: true,
                                      targetVariable: field.name,
                                    })
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <FormLabel className="min-w-[20px] text-right">
                          F:
                        </FormLabel>
                        <FormField
                          control={form.control}
                          name="f"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Double click to add tag."
                                  {...field}
                                  onDoubleClick={() =>
                                    setTagSelectionDialog({
                                      isOpen: true,
                                      targetVariable: field.name,
                                    })
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <FormLabel className="min-w-[20px] text-right">
                          H:
                        </FormLabel>
                        <FormField
                          control={form.control}
                          name="h"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder="Double click to add tag."
                                  {...field}
                                  onDoubleClick={() =>
                                    setTagSelectionDialog({
                                      isOpen: true,
                                      targetVariable: field.name,
                                    })
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
          {/* 🔍 Validation error output */}
          {Object.keys(form.formState.errors).length > 0 && (
            <div className="text-red-500 text-sm p-2 border border-red-300 rounded bg-red-50 mt-4">
              <ul className="list-disc list-inside">
                {Object.entries(form.formState.errors).map(([field, error]) => (
                  <li key={field}>
                    <strong>{field}:</strong> {error?.message as string}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 p-4 border-t bg-muted/20">
            <Button type="submit" variant="default">
              OK
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>

      {/* Tag Selection Dialog */}
      <Dialog
        open={tagSelectionDialog.isOpen}
        onOpenChange={(open) =>
          !open && setTagSelectionDialog({ isOpen: false, targetVariable: "" })
        }
      >
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Tag</DialogTitle>
            <DialogDescription>
              Choose a tag to use as variable{" "}
              {tagSelectionDialog.targetVariable?.toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <div className="space-y-4 p-2">
              {/* Mobile view: Tabs for categories */}
              <div className="block sm:hidden">
                <Tabs defaultValue="io-tags" className="w-full">
                  <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger
                      value="io-tags"
                      className="flex items-center justify-center"
                    >
                      <Tag className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger
                      value="user-tags"
                      className="flex items-center justify-center"
                    >
                      <UserCircle className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger
                      value="calc-tags"
                      className="flex items-center justify-center"
                    >
                      <FileDigit className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger
                      value="stats-tags"
                      className="flex items-center justify-center"
                    >
                      <BarChart className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger
                      value="system-tags"
                      className="flex items-center justify-center"
                    >
                      <Cog className="h-4 w-4" />
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="io-tags" className="mt-2">
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm font-medium">
                          IO Tags
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-0 px-2">
                        <div className="space-y-2">
                          {ioPorts.map((port) => (
                            <div key={port.id} className="border rounded-md">
                              <div
                                className="flex items-center p-2 cursor-pointer hover:bg-muted/50"
                                onClick={() => togglePortExpansion(port.id)}
                              >
                                {expandedPorts.includes(port.id) ? (
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 mr-1" />
                                )}
                                <Server className="h-4 w-4 mr-2 text-muted-foreground" />
                                <span className="font-medium">{port.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({port.type})
                                </span>
                              </div>

                              {expandedPorts.includes(port.id) && (
                                <div className="pl-4 pr-2 pb-2 space-y-2">
                                  {port.devices.map((device) => (
                                    <div
                                      key={device.id}
                                      className="border rounded-md"
                                    >
                                      <div
                                        className="flex items-center p-2 cursor-pointer hover:bg-muted/50"
                                        onClick={() =>
                                          toggleDeviceExpansion(device.id)
                                        }
                                      >
                                        {expandedDevices.includes(device.id) ? (
                                          <ChevronDown className="h-4 w-4 mr-1" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 mr-1" />
                                        )}
                                        <Cpu className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <span className="font-medium">
                                          {device.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                          ({device.type})
                                        </span>
                                      </div>

                                      {expandedDevices.includes(device.id) && (
                                        <div className="pl-4 pr-2 pb-2 overflow-x-auto">
                                          <Table className="min-w-[400px]">
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Data Type</TableHead>
                                                <TableHead>Address</TableHead>
                                                <TableHead></TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {device.tags?.map((tag) => (
                                                <TableRow key={tag.id}>
                                                  <TableCell className="whitespace-nowrap">
                                                    {tag.name}
                                                  </TableCell>
                                                  <TableCell className="whitespace-nowrap">
                                                    {tag.dataType}
                                                  </TableCell>
                                                  <TableCell className="whitespace-nowrap">
                                                    {tag.address}
                                                  </TableCell>
                                                  <TableCell>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => {
                                                        form.setValue(
                                                          tagSelectionDialog.targetVariable,
                                                          `${device.name}:${tag.name}`
                                                        );
                                                        setTagSelectionDialog({
                                                          isOpen: false,
                                                          targetVariable: "",
                                                        });
                                                      }}
                                                    >
                                                      Select
                                                    </Button>
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Other tabs content would go here */}
                </Tabs>
              </div>

              {/* Desktop view: Side-by-side layout */}
              <div className="hidden sm:grid sm:grid-cols-5 gap-4">
                <Card className="sm:col-span-1 h-auto overflow-auto">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">
                      Tag Categories
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-0">
                    <div className="space-y-1">
                      <div
                        className={`flex items-center px-2 py-1.5 rounded-md text-sm cursor-pointer ${
                          activeCategory === "io"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        onClick={() => setActiveCategory("io")}
                      >
                        <Tag className="h-4 w-4 mr-2" />
                        IO Tags
                      </div>
                      <div
                        className={`flex items-center px-2 py-1.5 rounded-md text-sm cursor-pointer ${
                          activeCategory === "user"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        onClick={() => setActiveCategory("user")}
                      >
                        <UserCircle className="h-4 w-4 mr-2" />
                        User Tags
                      </div>
                      <div
                        className={`flex items-center px-2 py-1.5 rounded-md text-sm cursor-pointer ${
                          activeCategory === "calc"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        onClick={() => setActiveCategory("calc")}
                      >
                        <FileDigit className="h-4 w-4 mr-2" />
                        Calculation Tags
                      </div>
                      <div
                        className={`flex items-center px-2 py-1.5 rounded-md text-sm cursor-pointer ${
                          activeCategory === "stats"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        onClick={() => setActiveCategory("stats")}
                      >
                        <BarChart className="h-4 w-4 mr-2" />
                        Stats Tags
                      </div>
                      <div
                        className={`flex items-center px-2 py-1.5 rounded-md text-sm cursor-pointer ${
                          activeCategory === "system"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        onClick={() => setActiveCategory("system")}
                      >
                        <Cog className="h-4 w-4 mr-2" />
                        System Tags
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="sm:col-span-4 h-auto overflow-auto">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">
                      {activeCategory === "io" && "IO Tags"}
                      {activeCategory === "user" && "User Tags"}
                      {activeCategory === "calc" && "Calculation Tags"}
                      {activeCategory === "stats" && "Stats Tags"}
                      {activeCategory === "system" && "System Tags"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-0">
                    {activeCategory === "io" && (
                      <div className="space-y-2">
                        {ioPorts.map((port) => (
                          <div key={port.id} className="border rounded-md">
                            <div
                              className="flex items-center p-2 cursor-pointer hover:bg-muted/50"
                              onClick={() => togglePortExpansion(port.id)}
                            >
                              {expandedPorts.includes(port.id) ? (
                                <ChevronDown className="h-4 w-4 mr-1" />
                              ) : (
                                <ChevronRight className="h-4 w-4 mr-1" />
                              )}
                              <Server className="h-4 w-4 mr-2 text-muted-foreground" />
                              <span className="font-medium">{port.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({port.type})
                              </span>
                            </div>

                            {expandedPorts.includes(port.id) && (
                              <div className="pl-4 pr-2 pb-2 space-y-2">
                                {port.devices.map((device) => (
                                  <div
                                    key={device.id}
                                    className="border rounded-md"
                                  >
                                    <div
                                      className="flex items-center p-2 cursor-pointer hover:bg-muted/50"
                                      onClick={() =>
                                        toggleDeviceExpansion(device.id)
                                      }
                                    >
                                      {expandedDevices.includes(device.id) ? (
                                        <ChevronDown className="h-4 w-4 mr-1" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 mr-1" />
                                      )}
                                      <Cpu className="h-4 w-4 mr-2 text-muted-foreground" />
                                      <span className="font-medium">
                                        {device.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({device.type})
                                      </span>
                                    </div>

                                    {expandedDevices.includes(device.id) && (
                                      <div className="pl-4 pr-2 pb-2 overflow-x-auto">
                                        <Table className="min-w-[400px]">
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Name</TableHead>
                                              <TableHead>Data Type</TableHead>
                                              <TableHead>Address</TableHead>
                                              <TableHead></TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {device.tags?.map((tag) => (
                                              <TableRow key={tag.id}>
                                                <TableCell className="whitespace-nowrap">
                                                  {tag.name}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                  {tag.dataType}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                  {tag.address}
                                                </TableCell>
                                                <TableCell>
                                                  <Button
                                                    variant="default"
                                                    size="sm"
                                                    onClick={() => {
                                                      form.setValue(
                                                        tagSelectionDialog.targetVariable,
                                                        `${device.name}:${tag.name}`
                                                      );
                                                      setTagSelectionDialog({
                                                        isOpen: false,
                                                        targetVariable: "",
                                                      });
                                                    }}
                                                  >
                                                    Select
                                                  </Button>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty placeholders for other categories */}
                    {activeCategory === "user" && (
                      <div className="space-y-2">
                        {user_tags.length > 0 ? (
                          user_tags.map((tag) => (
                            <div
                              key={tag.id}
                              className="flex justify-between items-center border rounded-md p-2 hover:bg-muted/50"
                            >
                              <div>
                                <div className="font-medium">{tag.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {tag.description}
                                </div>
                              </div>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  form.setValue(
                                    tagSelectionDialog.targetVariable,
                                    tag.name
                                  );
                                  setTagSelectionDialog({
                                    isOpen: false,
                                    targetVariable: "",
                                  });
                                }}
                              >
                                Select
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm italic text-muted-foreground">
                            No user tags available.
                          </div>
                        )}
                      </div>
                    )}

                    {activeCategory === "stats" && (
                      <div className="space-y-2">
                        {stats_tags.length > 0 ? (
                          stats_tags.map((tag) => (
                            <div
                              key={tag.id}
                              className="flex justify-between items-center border rounded-md p-2 hover:bg-muted/50"
                            >
                              <div>
                                <div className="font-medium">{tag.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {tag.description}
                                </div>
                              </div>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  form.setValue(
                                    tagSelectionDialog.targetVariable,
                                    tag.name
                                  );
                                  setTagSelectionDialog({
                                    isOpen: false,
                                    targetVariable: "",
                                  });
                                }}
                              >
                                Select
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm italic text-muted-foreground">
                            No stats tags available.
                          </div>
                        )}
                      </div>
                    )}

                    {activeCategory === "calc" && (
                      <div className="space-y-2">
                        {calculation_tags.length > 0 ? (
                          calculation_tags.map((tag) => (
                            <div
                              key={tag.id}
                              className="flex justify-between items-center border rounded-md p-2 hover:bg-muted/50"
                            >
                              <div>
                                <div className="font-medium">{tag.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {tag.description}
                                </div>
                              </div>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  form.setValue(
                                    tagSelectionDialog.targetVariable,
                                    tag.name
                                  );
                                  setTagSelectionDialog({
                                    isOpen: false,
                                    targetVariable: "",
                                  });
                                }}
                              >
                                Select
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm italic text-muted-foreground">
                            No calculation tags available.
                          </div>
                        )}
                      </div>
                    )}

                    {activeCategory === "system" && (
                      <div className="space-y-2">
                        {system_tags.length > 0 ? (
                          system_tags.map((tag) => (
                            <div
                              key={tag.id}
                              className="flex justify-between items-center border rounded-md p-2 hover:bg-muted/50"
                            >
                              <div>
                                <div className="font-medium">{tag.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {tag.description}
                                </div>
                              </div>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  form.setValue(
                                    tagSelectionDialog.targetVariable,
                                    tag.name
                                  );
                                  setTagSelectionDialog({
                                    isOpen: false,
                                    targetVariable: "",
                                  });
                                }}
                              >
                                Select
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm italic text-muted-foreground">
                            No system tags available.
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
