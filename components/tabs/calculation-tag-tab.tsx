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
      address: "", // Calculation tags don't need physical addresses
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
    if (!formValues.id || !editingTag) return;

    const updatedTag: CalculationTag = {
      ...formValues,
      id: editingTag.id,
      dataType: editingTag.dataType, // Preserve existing data type
      address: editingTag.address, // Preserve existing address
      description: editingTag.description, // Preserve existing description
    };

    updateConfig(
      ["calculation_tags"],
      calculationTags.map((t) => (t.id === updatedTag.id ? updatedTag : t))
    );

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

  // Handle move tag up
  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const newTags = [...calculationTags];
      const temp = newTags[index];
      newTags[index] = newTags[index - 1];
      newTags[index - 1] = temp;
      updateConfig(["calculation_tags"], newTags);
    }
  };

  // Handle move tag down
  const handleMoveDown = (index: number) => {
    if (index < calculationTags.length - 1) {
      const newTags = [...calculationTags];
      const temp = newTags[index];
      newTags[index] = newTags[index + 1];
      newTags[index + 1] = temp;
      updateConfig(["calculation_tags"], newTags);
    }
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
                      No calculation tags to delete
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

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
                            setEditingTag(selectedTag);
                          } else {
                            toast({
                              title: "No Tag Selected",
                              description: "Please select a tag to modify.",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={noCalculationTags || !selectedTagId}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Modify...
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {noCalculationTags && (
                    <TooltipContent>
                      No calculation tags to modify
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (selectedTagId) {
                            const index = calculationTags.findIndex(
                              (t) => t.id === selectedTagId
                            );
                            if (index > 0) {
                              handleMoveUp(index);
                            } else {
                              toast({
                                title: "Cannot Move Up",
                                description:
                                  "The selected tag is already at the top.",
                                variant: "destructive",
                              });
                            }
                          } else {
                            toast({
                              title: "No Tag Selected",
                              description: "Please select a tag to move up.",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={
                          noCalculationTags ||
                          !selectedTagId ||
                          calculationTags.length === 1
                        }
                      >
                        <ArrowUp className="h-4 w-4 mr-2" />
                        Up
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {noCalculationTags && (
                    <TooltipContent>No calculation tags to move</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (selectedTagId) {
                            const index = calculationTags.findIndex(
                              (t) => t.id === selectedTagId
                            );
                            if (index < calculationTags.length - 1) {
                              handleMoveDown(index);
                            } else {
                              toast({
                                title: "Cannot Move Down",
                                description:
                                  "The selected tag is already at the bottom.",
                                variant: "destructive",
                              });
                            }
                          } else {
                            toast({
                              title: "No Tag Selected",
                              description: "Please select a tag to move down.",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={
                          noCalculationTags ||
                          !selectedTagId ||
                          calculationTags.length === 1
                        }
                      >
                        <ArrowDown className="h-4 w-4 mr-2" />
                        Down
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {noCalculationTags && (
                    <TooltipContent>No calculation tags to move</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Name</TableHead>
                  <TableHead>Default Value</TableHead>
                  <TableHead>Formula</TableHead>
                  <TableHead>A</TableHead>
                  <TableHead>B</TableHead>
                  <TableHead>C</TableHead>
                  <TableHead>D</TableHead>
                  <TableHead>E</TableHead>
                  <TableHead>F</TableHead>
                  <TableHead>G</TableHead>
                  <TableHead>H</TableHead>
                  <TableHead>Period(s)</TableHead>
                  <TableHead>Read Write</TableHead>
                  <TableHead>Span High</TableHead>
                  <TableHead>Span Low</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculationTags.map((tag, index) => (
                  <TableRow
                    key={tag.id}
                    className={`cursor-pointer hover:bg-muted/50 ${
                      selectedTagId === tag.id ? "bg-muted" : ""
                    }`}
                    onClick={() => {
                      // Handle row selection
                      setSelectedTagId(tag.id);
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
                    <TableCell>{tag.defaultValue}</TableCell>
                    <TableCell>{tag.formula}</TableCell>
                    <TableCell>{tag.a}</TableCell>
                    <TableCell>{tag.b}</TableCell>
                    <TableCell>{tag.c}</TableCell>
                    <TableCell>{tag.d}</TableCell>
                    <TableCell>{tag.e}</TableCell>
                    <TableCell>{tag.f}</TableCell>
                    <TableCell>{tag.g}</TableCell>
                    <TableCell>{tag.h}</TableCell>
                    <TableCell>{tag.period}</TableCell>
                    <TableCell>{tag.readWrite}</TableCell>
                    <TableCell>{tag.spanHigh}</TableCell>
                    <TableCell>{tag.spanLow}</TableCell>
                  </TableRow>
                ))}
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
              Modify settings for {editingTag?.name}
            </DialogDescription>
          </DialogHeader>
          {editingTag && (
            <CalculationTagForm
              onSubmit={handleUpdateTag}
              onCancel={() => setEditingTag(null)}
              initialValues={{
                id: editingTag.id,
                name: editingTag.name,
                description: editingTag.description || "",
                defaultValue: typeof editingTag.defaultValue === 'number' ? editingTag.defaultValue : Number(editingTag.defaultValue) || 0,
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
                readWrite: editingTag.readWrite || "Read/Write",
                spanHigh: editingTag.spanHigh || 1000,
                spanLow: editingTag.spanLow || 0,
                isParent: editingTag.isParent || false,
              }}
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
