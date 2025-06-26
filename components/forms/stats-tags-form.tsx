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
        setUpdateCycle(editTag.updateCycle || "60");
        setUpdateUnit(editTag.updateUnit || "sec");
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
    if (!tagName || !referTag) {
      alert("Please fill in both the Name and Refer Tag fields.");
      return;
    }

    // Check if the name already exists (excluding the current tag being edited)
    const nameExists = statsTags.some(
      (tag) =>
        tag.name.trim().toLowerCase() === tagName.trim().toLowerCase() &&
        tag.id !== editTag?.id
    );

    if (nameExists) {
      toast.error("A stats tag with this name already exists.", {
        duration: 5000,
      });
      return;
    }

    const tagData = {
      id: editTag ? editTag.id : Date.now(),
      name: tagName,
      type: tagType,
      referTag: referTag,
      updateCycle: updateCycle,
      updateUnit: updateUnit,
      description: description,
    };
    onSaveTag(tagData, !!editTag);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Tag</DialogTitle>
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
              className="bg-white"
              placeholder="Enter Name"
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
                className="bg-white rounded-r-none"
                readOnly
              />
              <Button
                variant="outline"
                className="rounded-l-none px-2 bg-white border-l-0"
                onClick={() => setTagSelectionDialogOpen(true)}
              >
                ...
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <Label htmlFor="tag-type" className="text-slate-700">
              Type
            </Label>
            <Select value={tagType} onValueChange={setTagType}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Average">Average</SelectItem>
                <SelectItem value="Maximum">Maximum</SelectItem>
                <SelectItem value="Minimum">Minimum</SelectItem>
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
                className="bg-white w-full rounded-r-none"
              />
              <Select value={updateUnit} onValueChange={setUpdateUnit}>
                <SelectTrigger className="bg-white w-20 rounded-l-none border-l-0">
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
              className="min-h-[150px] bg-white"
            />
          </div>
        </div>

        <DialogFooter className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>OK</Button>
        </DialogFooter>

        <TagSelectionDialog
          open={tagSelectionDialogOpen}
          onOpenChange={setTagSelectionDialogOpen}
          onSelectTag={handleTagSelection}
          userTags={userTags}
          calculationTags={calculationTags}
          statsTags={statsTags}
          systemTags={systemTags}
        />
      </DialogContent>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stats Tags</CardTitle>
        <CardDescription>Configure statistical data points</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Refer Tag</TableHead>
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
                    className={selectedTagId === tag.id ? "bg-muted" : ""}
                    onClick={() => setSelectedTagId(tag.id)}
                    style={{ cursor: "pointer" }}
                    onDoubleClick={() => {
                      setEditingTag(tag);
                      setTagDialogOpen(true);
                    }}
                  >
                    <TableCell>{tag.name}</TableCell>
                    <TableCell>{tag.type}</TableCell>
                    <TableCell>{tag.referTag}</TableCell>
                    <TableCell>
                      {tag.updateCycle}
                      {tag.updateUnit}
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
