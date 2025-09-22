"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, X, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useConfigStore } from "@/lib/stores/configuration-store";
import type { UserTag } from "@/lib/stores/configuration-store";
import type { UserTagFormValues } from "@/lib/stores/configuration-store";

// Import CSV components
import { CSVImportExport } from "@/components/common/csv-import-export";
import { userTagColumns, validateUserTag } from "@/lib/csv-configs";

// Tag Dialog Component for both adding and editing tags
function TagDialog({
  open,
  onOpenChange,
  onSaveTag,
  editTag = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveTag: (tag: any, isEdit: boolean) => void;
  editTag?: any | null;
}) {
  const [tagName, setTagName] = useState("");
  const [isNameTouched, setIsNameTouched] = useState(false);
  const [dataType, setDataType] = useState("Analog");
  const [defaultValue, setDefaultValue] = useState("0.0");
  const [spanHigh, setSpanHigh] = useState("1000");
  const [spanLow, setSpanLow] = useState("0");
  const [readWrite, setReadWrite] = useState("Read/Write");
  const [description, setDescription] = useState("");
  const [descriptor0, setDescriptor0] = useState("");
  const [descriptor1, setDescriptor1] = useState("");
  const [discreteValue, setDiscreteValue] = useState("0");

  // Reset form when dialog opens or when editTag changes
  React.useEffect(() => {
    if (open) {
      if (editTag) {
        // If editing an existing tag, populate the form with its values
        setTagName(editTag.name || "");
        setDataType(editTag.dataType || "Analog");

        if (editTag.dataType === "Analog") {
          setDefaultValue(editTag.defaultValue || "0.0");
          setSpanHigh(editTag.spanHigh || "1000");
          setSpanLow(editTag.spanLow || "0");
        } else {
          setDiscreteValue(editTag.defaultValue === "1" ? "1" : "0");
          setDescriptor0(editTag.descriptor0 || "");
          setDescriptor1(editTag.descriptor1 || "");
        }

        setReadWrite(editTag.readWrite || "Read/Write");
        setDescription(editTag.description || "");
      } else {
        // If adding a new tag, reset the form
        setTagName("");
        setDataType("Analog");
        setDefaultValue("0.0");
        setSpanHigh("1000");
        setSpanLow("0");
        setReadWrite("Read/Write");
        setDescription("");
        setDescriptor0("");
        setDescriptor1("");
        setDiscreteValue("0");
      }
      setIsNameTouched(false);
    }
  }, [open, editTag]);

  const handleSubmit = () => {
    const errors: string[] = [];

    // --- Tag name validation ---
    if (!tagName.trim()) {
      errors.push("User tag name is required.");
    } else {
      if (tagName.length < 3) {
        errors.push("User tag name must be at least 3 characters long.");
      }
      if (!/^[a-zA-Z0-9-_]+$/.test(tagName)) {
        errors.push(
          "User tag name can only contain letters, numbers, hyphens (-), and underscores (_)."
        );
      }
      if (/^\d+$/.test(tagName)) {
        errors.push("User tag name cannot be all numbers.");
      }
      if (/^\s|\s$/.test(tagName)) {
        errors.push("User tag name cannot start or end with a space.");
      }
    }

    // --- Description validation ---
    if (description && description.length > 100) {
      errors.push("Description should not exceed 100 characters.");
    }
    if (description && !/[a-zA-Z0-9]/.test(description)) {
      errors.push("Description should include some letters or numbers.");
    }

    if (errors.length > 0) {
      toast.error(errors[0], { duration: 5000 });
      return;
    }

    const tagData: UserTagFormValues = {
      id: editTag?.id || Date.now().toString(),
      name: tagName,
      dataType,
      defaultValue:
        dataType === "Analog"
          ? parseFloat(defaultValue)
          : parseInt(discreteValue),
      spanHigh: parseFloat(spanHigh),
      spanLow: parseFloat(spanLow),
      readWrite,
      description,
      descriptor0: dataType === "Discrete" ? descriptor0 : undefined,
      descriptor1: dataType === "Discrete" ? descriptor1 : undefined,
    };

    onSaveTag(tagData, !!editTag);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editTag ? "Edit User Tag" : "Add New User Tag"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="tag-name">Tag Name</Label>
            <Input
              id="tag-name"
              value={tagName}
              onChange={(e) => {
                setTagName(e.target.value);
                setIsNameTouched(true);
              }}
              placeholder="Enter tag name"
            />
          </div>

          <div>
            <Label htmlFor="data-type">Data Type</Label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger>
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Analog">Analog</SelectItem>
                <SelectItem value="Discrete">Discrete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dataType === "Analog" ? (
            <>
              <div>
                <Label htmlFor="default-value">Default Value</Label>
                <Input
                  id="default-value"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder="Enter default value"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="span-high">Span High</Label>
                  <Input
                    id="span-high"
                    value={spanHigh}
                    onChange={(e) => setSpanHigh(e.target.value)}
                    placeholder="High value"
                  />
                </div>
                <div>
                  <Label htmlFor="span-low">Span Low</Label>
                  <Input
                    id="span-low"
                    value={spanLow}
                    onChange={(e) => setSpanLow(e.target.value)}
                    placeholder="Low value"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Default Value</Label>
                <RadioGroup value={discreteValue} onValueChange={setDiscreteValue}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="0" id="r1" />
                    <Label htmlFor="r1">0</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="r2" />
                    <Label htmlFor="r2">1</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="descriptor0">Descriptor for 0</Label>
                  <Input
                    id="descriptor0"
                    value={descriptor0}
                    onChange={(e) => setDescriptor0(e.target.value)}
                    placeholder="e.g. Off"
                  />
                </div>
                <div>
                  <Label htmlFor="descriptor1">Descriptor for 1</Label>
                  <Input
                    id="descriptor1"
                    value={descriptor1}
                    onChange={(e) => setDescriptor1(e.target.value)}
                    placeholder="e.g. On"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="read-write">Read/Write</Label>
            <Select value={readWrite} onValueChange={setReadWrite}>
              <SelectTrigger>
                <SelectValue placeholder="Select access type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Read/Write">Read/Write</SelectItem>
                <SelectItem value="Read Only">Read Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description (optional)"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {editTag ? "Update Tag" : "Add Tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserTagsForm() {
  const userTags = useConfigStore((state) => state.config.user_tags || []);
  const updateConfig = useConfigStore((state) => state.updateConfig);

  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<UserTag | null>(null);

  // Function to open dialog for adding a new tag
  const handleAddTag = () => {
    setEditingTag(null);
    setTagDialogOpen(true);
  };

  const handleRowDoubleClick = (tag: UserTag) => {
    setEditingTag(tag);
    setTagDialogOpen(true);
  };

  // Save tag (add or update)
  const saveTag = (tag: UserTagFormValues, isEdit: boolean) => {
    if (isEdit && tag.id) {
      const updatedTags = userTags.map((t) =>
        t.id === tag.id ? { ...tag } : t
      );
      updateConfig(["user_tags"], updatedTags);
      toast.success(`Tag "${tag.name}" has been updated successfully.`, {
        duration: 3000,
      });
    } else {
      const newTag: UserTag = {
        ...tag,
        id: Date.now().toString(),
      };
      updateConfig(["user_tags"], [...userTags, newTag]);
      toast.success(`Tag "${newTag.name}" has been added successfully.`, {
        duration: 3000,
      });
    }
    setTagDialogOpen(false);
  };

  const handleDeleteTag = () => {
    if (selectedTagId) {
      const updatedTags = userTags.filter((tag) => tag.id !== selectedTagId);
      updateConfig(["user_tags"], updatedTags);
      setSelectedTagId(null);
      toast.success("The selected tag has been deleted.", {
        duration: 3000,
      });
    } else {
      toast.error("Please select a tag to delete.", {
        duration: 3000,
      });
    }
  };

  // CSV Import handler
  const handleCSVImport = (importedTags: UserTag[]) => {
    // Check for duplicate names
    const existingNames = userTags.map(tag => tag.name.toLowerCase());
    const duplicates = importedTags.filter(tag => 
      existingNames.includes(tag.name.toLowerCase())
    );

    if (duplicates.length > 0) {
      toast.error(`Cannot import tags with duplicate names: ${duplicates.map(t => t.name).join(', ')}`, { duration: 5000 });
      return;
    }

    // Add imported tags to existing ones
    const updatedTags = [...userTags, ...importedTags];
    updateConfig(["user_tags"], updatedTags);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Tags</CardTitle>
        <CardDescription>Configure custom user-defined tags</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button onClick={handleAddTag} className="flex items-center gap-1">
              <Plus className="h-4 w-4" />
              Add
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      onClick={handleDeleteTag}
                      className="flex items-center gap-1"
                      disabled={userTags.length === 0}
                    >
                      <X className="h-4 w-4" />
                      Delete
                    </Button>
                  </span>
                </TooltipTrigger>
                {userTags.length === 0 && (
                  <TooltipContent>
                    No user tags available to delete
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* CSV Import/Export */}
          <CSVImportExport
            data={userTags}
            filename="user_tags.csv"
            columns={userTagColumns}
            onImport={handleCSVImport}
            validateRow={validateUserTag}
            disabled={false}
          />
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Default Value</TableHead>
                <TableHead>Span High</TableHead>
                <TableHead>Span Low</TableHead>
                <TableHead>Read/Write</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userTags.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-4 text-muted-foreground"
                  >
                    No user tags defined. Click "Add" to create a new tag.
                  </TableCell>
                </TableRow>
              ) : (
                userTags.map((tag) => (
                  <TableRow
                    key={tag.id}
                    className={selectedTagId === tag.id ? "bg-muted" : ""}
                    onClick={() => setSelectedTagId(tag.id)}
                    onDoubleClick={() => handleRowDoubleClick(tag)}
                    style={{ cursor: "pointer" }}
                  >
                    <TableCell>{tag.name}</TableCell>
                    <TableCell>{tag.dataType}</TableCell>
                    <TableCell>
                      {tag.dataType === "Analog"
                        ? tag.defaultValue
                        : tag.defaultValue === 0
                        ? "0"
                        : "1"}
                    </TableCell>
                    <TableCell>
                      {tag.dataType === "Analog" ? tag.spanHigh : "1"}
                    </TableCell>
                    <TableCell>
                      {tag.dataType === "Analog" ? tag.spanLow : "0"}
                    </TableCell>
                    <TableCell>{tag.readWrite}</TableCell>
                    <TableCell className="truncate max-w-[200px]">
                      {tag.description}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <TagDialog
          open={tagDialogOpen}
          onOpenChange={setTagDialogOpen}
          onSaveTag={saveTag}
          editTag={editingTag}
        />
      </CardContent>
    </Card>
  );
}
