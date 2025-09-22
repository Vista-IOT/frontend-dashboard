"use client";

import React, { useState, useEffect } from "react";
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
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import TagSelectionDialog from "@/components/dialogs/tag-selection-dialog";
import { useConfigStore } from "@/lib/stores/configuration-store";

// Import CSV components
import { CSVImportExport } from "@/components/common/csv-import-export";
import { statsTagColumns, validateStatsTag } from "@/lib/csv-configs";

function StatsTagDialog({
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
  const [tagType, setTagType] = useState("Average");
  const [referTag, setReferTag] = useState("");
  const [updateCycle, setUpdateCycle] = useState("60");
  const [updateUnit, setUpdateUnit] = useState("sec");
  const [description, setDescription] = useState("");
  const [tagSelectionDialogOpen, setTagSelectionDialogOpen] = useState(false);

  const userTags = useConfigStore((state) => state.config.user_tags);
  const calculationTags = useConfigStore(
    (state) => state.config.calculation_tags
  );
  const statsTags = useConfigStore((state) => state.config.stats_tags);
  const systemTags = useConfigStore((state) => state.config.system_tags);

  useEffect(() => {
    if (open) {
      if (editTag) {
        setTagName(editTag.name || "");
        setTagType(editTag.type || "Average");
        setReferTag(editTag.referTag || "");
        setUpdateCycle(editTag.updateCycleValue || "60");
        setUpdateUnit(editTag.updateCycleUnit || "sec");
        setDescription(editTag.description || "");
      } else {
        setTagName("");
        setTagType("Average");
        setReferTag("");
        setUpdateCycle("60");
        setUpdateUnit("sec");
        setDescription("");
      }
      setTagSelectionDialogOpen(false);
    }
  }, [open, editTag]);

  const handleTagSelection = (selectedTag: any) => {
    setReferTag(selectedTag.name);
  };

  const handleSubmit = () => {
    const errors: string[] = [];

    // --- Tag name validation ---
    if (!tagName.trim()) {
      errors.push("Stats tag name is required.");
    } else {
      if (tagName.length < 3) {
        errors.push("Stats tag name must be at least 3 characters long.");
      }
      if (!/^[a-zA-Z0-9-_]+$/.test(tagName)) {
        errors.push(
          "Stats tag name can only contain letters, numbers, hyphens (-), and underscores (_)."
        );
      }
      if (/^\d+$/.test(tagName)) {
        errors.push("Stats tag name cannot be all numbers.");
      }
      if (/^\s|\s$/.test(tagName)) {
        errors.push("Stats tag name cannot start or end with a space.");
      }
    }

    // --- Refer Tag validation ---
    if (!referTag.trim()) {
      errors.push("Reference tag is required.");
    }

    // --- Description validation ---
    if (description && description.length > 100) {
      errors.push("Description should not exceed 100 characters.");
    }

    if (errors.length > 0) {
      toast.error(errors[0], { duration: 5000 });
      return;
    }

    const tagData = {
      id: editTag?.id || Date.now().toString(),
      name: tagName,
      type: tagType,
      referTag,
      updateCycleValue: parseInt(updateCycle) || 60,
      updateCycleUnit: updateUnit,
      description,
    };

    onSaveTag(tagData, !!editTag);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editTag ? "Edit Stats Tag" : "Add New Stats Tag"}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 border rounded-md bg-slate-100 space-y-4">
          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <Label htmlFor="tag-name" className="text-slate-700">
              Name:<span className="text-red-500">*</span>
            </Label>
            <Input
              id="tag-name"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="Enter stats tag name"
            />
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <Label htmlFor="refer-tag" className="text-slate-700">
              Refer Tag: <span className="text-red-500">*</span>
            </Label>
            <div className="flex">
              <Input
                id="refer-tag"
                value={referTag}
                onChange={(e) => setReferTag(e.target.value)}
                placeholder="Select a tag to reference"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={() => setTagSelectionDialogOpen(true)}
              >
                Browse
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <Label htmlFor="tag-type" className="text-slate-700">
              Type
            </Label>
            <Select value={tagType} onValueChange={setTagType}>
              <SelectTrigger>
                <SelectValue placeholder="Select stats type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Average">Average</SelectItem>
                <SelectItem value="Max">Max</SelectItem>
                <SelectItem value="Min">Min</SelectItem>
                <SelectItem value="Sum">Sum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <Label htmlFor="update-cycle" className="text-slate-700">
              Update Cycle:
            </Label>
            <div className="flex">
              <Input
                id="update-cycle"
                value={updateCycle}
                onChange={(e) => setUpdateCycle(e.target.value)}
                placeholder="60"
                className="flex-1"
              />
              <Select value={updateUnit} onValueChange={setUpdateUnit}>
                <SelectTrigger className="w-20 ml-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sec">sec</SelectItem>
                  <SelectItem value="min">min</SelectItem>
                  <SelectItem value="hour">hour</SelectItem>
                  <SelectItem value="day">day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-start gap-2">
            <Label htmlFor="description" className="pt-2 text-slate-700">
              Description:
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description (optional)"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-500 hover:bg-blue-600">
            {editTag ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <TagSelectionDialog
        open={tagSelectionDialogOpen}
        onOpenChange={setTagSelectionDialogOpen}
        onSelectTag={handleTagSelection}
        userTags={userTags || []}
        calculationTags={calculationTags || []}
        statsTags={statsTags || []}
        systemTags={systemTags || []}
      />
    </Dialog>
  );
}

export function StatsTagsForm() {
  const { getConfig, updateConfig } = useConfigStore();
  const tags = getConfig().stats_tags || [];
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | number | null>(
    null
  );

  const handleAddTag = () => {
    setEditingTag(null);
    setTagDialogOpen(true);
  };

  const handleModifyTag = () => {
    if (selectedTagId) {
      const tagToEdit = tags.find((tag: any) => tag.id === selectedTagId);
      if (tagToEdit) {
        setEditingTag(tagToEdit);
        setTagDialogOpen(true);
      }
    } else {
      toast.error("Please select a tag to modify.", {
        duration: 3000,
      });
    }
  };

  const saveTag = (tag: any, isEdit: boolean) => {
    const updatedTags = isEdit
      ? tags.map((t: any) => (t.id === tag.id ? tag : t))
      : [...tags, tag];
    updateConfig(["stats_tags"], updatedTags);
    toast.success(
      `Tag "${tag.name}" has been ${
        isEdit ? "updated" : "added"
      } successfully.`,
      {
        duration: 3000,
      }
    );
  };

  const handleDeleteTag = () => {
    if (selectedTagId) {
      const updatedTags = tags.filter((tag: any) => tag.id !== selectedTagId);
      updateConfig(["stats_tags"], updatedTags);
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
  const handleCSVImport = (importedTags: any[]) => {
    // Check for duplicate names
    const existingNames = tags.map((tag: any) => tag.name.toLowerCase());
    const duplicates = importedTags.filter((tag: any) => 
      existingNames.includes(tag.name.toLowerCase())
    );

    if (duplicates.length > 0) {
      toast.error(`Cannot import tags with duplicate names: ${duplicates.map((t: any) => t.name).join(', ')}`, { duration: 5000 });
      return;
    }

    // Add imported tags to existing ones
    const updatedTags = [...tags, ...importedTags];
    updateConfig(["stats_tags"], updatedTags);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stats Tags</CardTitle>
        <CardDescription>Configure statistical data points</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              onClick={handleAddTag}
              className="bg-green-500 hover:bg-green-600"
            >
              <Plus className="h-4 w-4" /> Add...
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTag}
              disabled={tags.length === 0 || selectedTagId === null}
            >
              <X className="h-4 w-4" /> Delete
            </Button>
          </div>

          {/* CSV Import/Export */}
          <CSVImportExport
            data={tags}
            filename="stats_tags.csv"
            columns={statsTagColumns}
            onImport={handleCSVImport}
            validateRow={validateStatsTag}
            disabled={false}
          />
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Reference Tag</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Update Cycle</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-4 text-muted-foreground"
                  >
                    No stats tags defined. Click "Add..." to create a new tag.
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag: any) => (
                  <TableRow
                    key={tag.id}
                    className={
                      selectedTagId === tag.id ? "bg-muted" : ""
                    }
                    onClick={() => setSelectedTagId(tag.id)}
                    onDoubleClick={() => handleModifyTag()}
                    style={{ cursor: "pointer" }}
                  >
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell>{tag.referTag}</TableCell>
                    <TableCell>{tag.type}</TableCell>
                    <TableCell>
                      {tag.updateCycleValue} {tag.updateCycleUnit}
                    </TableCell>
                    <TableCell className="truncate max-w-[200px]">
                      {tag.description}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <StatsTagDialog
          open={tagDialogOpen}
          onOpenChange={setTagDialogOpen}
          onSaveTag={saveTag}
          editTag={editingTag}
        />
      </CardContent>
    </Card>
  );
}
