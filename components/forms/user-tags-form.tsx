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
import type { UserTagFormValues } from "@/lib/stores/configuration-store"; // if it's there too

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
    }
  }, [open, editTag]);
  const { getConfig } = useConfigStore();
  const handleSubmit = () => {
    setIsNameTouched(true);

    if (!tagName.trim()) {
      return; // stop submission if name is empty
    }

    // Get all existing user tags from the store
    const allTags: UserTag[] = getConfig().user_tags;

    // Check if the name already exists (excluding the current tag being edited)
    const nameExists = allTags.some(
      (tag) =>
        tag.name.trim().toLowerCase() === tagName.trim().toLowerCase() &&
        tag.id !== editTag?.id
    );

    if (nameExists) {
      // Show some UI feedback, like an alert or toast
      console.log("Triggering toast...");
      toast.error("A tag with this name already exists.", {
        duration: 5000,
      });

      return;
    }

    const tagData = {
      id: editTag ? editTag.id : Date.now(),
      name: tagName,
      dataType: dataType,
      defaultValue: dataType === "Analog" ? defaultValue : discreteValue,
      spanHigh: dataType === "Analog" ? spanHigh : "1",
      spanLow: dataType === "Analog" ? spanLow : "0",
      descriptor0: dataType === "Discrete" ? descriptor0 : "",
      descriptor1: dataType === "Discrete" ? descriptor1 : "",
      readWrite: readWrite,
      description: description,
    };

    onSaveTag(tagData, !!editTag);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {editTag ? "Edit Tag" : "New Tag"}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 border rounded-md">
          <div className="font-medium flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4" />
            Basic
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
              <Label htmlFor="tag-name" className="flex items-center gap-1">
                Name: <span className="text-red-500">*</span>
              </Label>
              <div>
                <Input
                  id="tag-name"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  onBlur={() => setIsNameTouched(true)}
                  placeholder="Enter name"
                  className={
                    isNameTouched && !tagName.trim() ? "border-red-500" : ""
                  }
                />
                {isNameTouched && !tagName.trim() && (
                  <p className="text-sm text-red-500 mt-1">Name is required.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
              <Label htmlFor="data-type">Data Type:</Label>
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
                <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                  <Label htmlFor="default-value">Default Value:</Label>
                  <Input
                    id="default-value"
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                  <Label htmlFor="span-high">Span High:</Label>
                  <Input
                    id="span-high"
                    value={spanHigh}
                    onChange={(e) => setSpanHigh(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                  <Label htmlFor="span-low">Span Low:</Label>
                  <Input
                    id="span-low"
                    value={spanLow}
                    onChange={(e) => setSpanLow(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                  <Label htmlFor="default-value">Default Value:</Label>
                  <RadioGroup
                    value={discreteValue}
                    onValueChange={setDiscreteValue}
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="0" id="value-0" />
                      <Label htmlFor="value-0">0</Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="1" id="value-1" />
                      <Label htmlFor="value-1">1</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                  <Label htmlFor="descriptor-0">Descriptor 0:</Label>
                  <Input
                    id="descriptor-0"
                    value={descriptor0}
                    onChange={(e) => setDescriptor0(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                  <Label htmlFor="descriptor-1">Descriptor 1:</Label>
                  <Input
                    id="descriptor-1"
                    value={descriptor1}
                    onChange={(e) => setDescriptor1(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
              <Label htmlFor="read-write">Read Write:</Label>
              <Select value={readWrite} onValueChange={setReadWrite}>
                <SelectTrigger>
                  <SelectValue placeholder="Select access type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Read/Write">Read/Write</SelectItem>
                  <SelectItem value="Read Only">Read Only</SelectItem>
                  <SelectItem value="Write Only">Write Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-[120px_1fr] items-start gap-2">
              <Label htmlFor="description" className="pt-2">
                Description:
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>OK</Button>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Tags</CardTitle>
        <CardDescription>Configure custom user-defined tags</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Default Value</TableHead>
                <TableHead>Span High</TableHead>
                <TableHead>Span Low</TableHead>
                <TableHead>Read Write</TableHead>
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
                        : tag.defaultValue === "0"
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
