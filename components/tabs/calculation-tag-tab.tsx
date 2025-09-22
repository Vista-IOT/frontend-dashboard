"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit,
  ArrowUp,
  ArrowDown,
  FileDigit,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalculationTagForm } from "@/components/forms/calculation-tag-form";
import type { Port } from "@/components/tabs/io-tag-tab";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Import CSV components
import { CSVImportExport } from "@/components/common/csv-import-export";
import { calculationTagColumns, validateCalculationTag } from "@/lib/csv-configs";

// Type definitions
// Import the z schema from the form component to ensure type compatibility
import { z } from "zod";
import { useConfigStore } from "@/lib/stores/configuration-store";

// Define the form schema to match the CalculationTagForm component
const calculationTagSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
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
});

// Define the type from the schema
type CalculationTagFormValues = z.infer<typeof calculationTagSchema>;

import type { CalculationTag } from "@/lib/stores/configuration-store";

interface CalculationTagTabProps {
  // Any props needed
  ioPorts: Port[];
}

export default function CalculationTagTab({}: CalculationTagTabProps) {
  const { toast } = useToast();
  const calculationTags = useConfigStore(
    (state) => state.config.calculation_tags || []
  );
  const updateConfig = useConfigStore((state) => state.updateConfig);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTag, setEditingTag] = useState<CalculationTag | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    tag: CalculationTag | null;
  }>({ isOpen: false, tag: null });
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  // Handle add calculation tag
  const handleAddTag = (formValues: CalculationTagFormValues) => {
    const newTag: CalculationTag = {
      ...formValues,
      id: Date.now().toString(),
      defaultValue: formValues.defaultValue as number | string,
      dataType: "Analog", // Default data type for calculation tags
      address: "", // Default empty address
      description: "", // Default empty description
    };

    updateConfig(["calculation_tags"], [...calculationTags, newTag]);

    setShowAddForm(false);
    toast({
      title: "Tag Added",
      description: `Calculation tag ${newTag.name} has been added successfully.`,
    });
  };

  // Handle update calculation tag
  const handleUpdateTag = (formValues: CalculationTagFormValues) => {
    if (!editingTag) return;

    const updatedTag: CalculationTag = {
      ...formValues,
      id: editingTag.id,
      dataType: editingTag.dataType || "Analog",
      address: editingTag.address || "",
      description: formValues.description || "",
      defaultValue: formValues.defaultValue as number | string,
    };

    const updatedTags = calculationTags.map((t) =>
      t.id === editingTag.id ? updatedTag : t
    );

    updateConfig(["calculation_tags"], updatedTags);
    setEditingTag(null);

    toast({
      title: "Tag Updated",
      description: `Calculation tag ${updatedTag.name} has been updated successfully.`,
    });
  };

  // Handle delete calculation tag
  const handleDeleteTag = () => {
    if (deleteDialog.tag) {
      const updatedTags = calculationTags.filter(
        (t) => t.id !== deleteDialog.tag?.id
      );

      updateConfig(["calculation_tags"], updatedTags);

      setDeleteDialog({ isOpen: false, tag: null });

      toast({
        title: "Tag Deleted",
        description: `Calculation tag has been deleted successfully.`,
      });
    }
  };

  // CSV Import handler
  const handleCSVImport = (importedTags: CalculationTag[]) => {
    // Check for duplicate names
    const existingNames = calculationTags.map(tag => tag.name.toLowerCase());
    const duplicates = importedTags.filter(tag => 
      existingNames.includes(tag.name.toLowerCase())
    );

    if (duplicates.length > 0) {
      toast({
        title: "Import Error",
        description: `Cannot import tags with duplicate names: ${duplicates.map(t => t.name).join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    // Add imported tags to existing ones
    const updatedTags = [...calculationTags, ...importedTags];
    updateConfig(["calculation_tags"], updatedTags);

    toast({
      title: "Import Successful",
      description: `Successfully imported ${importedTags.length} calculation tags.`,
    });
  };

  const noCalculationTags = calculationTags.length === 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center">
            <FileDigit className="mr-2 h-5 w-5" />
            Calculation Tags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-4">
            <div className="space-x-2">
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add...
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const selectedTag = calculationTags.find(
                            (t) => t.id === selectedTagId
                          );
                          if (selectedTag) {
                            setDeleteDialog({ isOpen: true, tag: selectedTag });
                          } else {
                            toast({
                              title: "No Tag Selected",
                              description: "Please select a tag to delete.",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={noCalculationTags}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {noCalculationTags && (
                    <TooltipContent>
                      No calculation tags available to delete
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* CSV Import/Export */}
            <CSVImportExport
              data={calculationTags}
              filename="calculation_tags.csv"
              columns={calculationTagColumns}
              onImport={handleCSVImport}
              validateRow={validateCalculationTag}
              disabled={false}
            />
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Formula</TableHead>
                  <TableHead>Default Value</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {noCalculationTags ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No calculation tags configured
                    </TableCell>
                  </TableRow>
                ) : (
                  calculationTags.map((tag) => (
                    <TableRow
                      key={tag.id}
                      className={
                        selectedTagId === tag.id
                          ? "bg-muted/50 hover:bg-muted cursor-pointer"
                          : "hover:bg-muted/30 cursor-pointer"
                      }
                      onClick={() => {
                        setSelectedTagId(tag.id);
                      }}
                      onDoubleClick={() => {
                        setEditingTag(tag);
                      }}
                    >
                      <TableCell className="font-medium">
                        {tag.isParent && (
                          <span className="mr-1 inline-flex items-center">
                            1 <ChevronRight className="h-4 w-4" />
                          </span>
                        )}
                        {tag.name}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {tag.formula}
                      </TableCell>
                      <TableCell>{tag.defaultValue}</TableCell>
                      <TableCell>{tag.period || 1}</TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {[tag.a, tag.b, tag.c, tag.d, tag.e, tag.f, tag.g, tag.h]
                          .filter(Boolean)
                          .join(", ") || "None"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {tag.description || ""}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Tag Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add New Calculation Tag</DialogTitle>
            <DialogDescription>
              Configure a new calculation tag with formula and variables
            </DialogDescription>
          </DialogHeader>
          <CalculationTagForm
            onSubmit={handleAddTag}
            onCancel={() => setShowAddForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog
        open={!!editingTag}
        onOpenChange={(open) => !open && setEditingTag(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Calculation Tag</DialogTitle>
            <DialogDescription>
              Modify the calculation tag configuration
            </DialogDescription>
          </DialogHeader>
          {editingTag && (
            <CalculationTagForm
              initialValues={{
                name: editingTag.name,
                defaultValue: editingTag.defaultValue as number,
                formula: editingTag.formula,
                a: editingTag.a || "",
                b: editingTag.b || "",
                c: editingTag.c || "",
                d: editingTag.d || "",
                e: editingTag.e || "",
                f: editingTag.f || "",
                g: editingTag.g || "",
                h: editingTag.h || "",
                period: editingTag.period || 1,
                description: editingTag.description || "",
                readWrite: "Read/Write",
                spanHigh: 1000,
                spanLow: 0,
                isParent: editingTag.isParent || false,
              }}
              onSubmit={handleUpdateTag}
              onCancel={() => setEditingTag(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Tag Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) =>
          !open && setDeleteDialog({ isOpen: false, tag: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calculation Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteDialog.tag?.name}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTag}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
