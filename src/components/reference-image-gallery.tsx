"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export interface ReferenceImage {
  id: number;
  storagePath: string;
  filename: string;
  label: string | null;
  isDefault: boolean;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
}

interface Props {
  entityType: "character" | "location";
  entityId: number;
  images: ReferenceImage[];
  onRefresh: () => void;
  /** For generation page: show checkboxes to select images */
  selectable?: boolean;
  selectedIds?: Set<number>;
  onSelectionChange?: (ids: Set<number>) => void;
}

export function ReferenceImageGallery({
  entityType,
  entityId,
  images,
  onRefresh,
  selectable,
  selectedIds,
  onSelectionChange,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<ReferenceImage | null>(null);
  const [labelValue, setLabelValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiBase = entityType === "character"
    ? `/api/characters/${entityId}/reference-images`
    : `/api/locations/${entityId}/reference-images`;

  const handleUpload = useCallback(async (files: FileList) => {
    setUploading(true);
    let uploaded = 0;
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(apiBase, { method: "POST", body: formData });
        if (res.ok) uploaded++;
        else {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          toast.error(err.error || "Upload failed");
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    if (uploaded > 0) {
      toast.success(`${uploaded} image${uploaded > 1 ? "s" : ""} uploaded`);
      onRefresh();
    }
    setUploading(false);
  }, [apiBase, onRefresh]);

  const handleDelete = useCallback(async (imageId: number) => {
    try {
      const res = await fetch(`${apiBase}?imageId=${imageId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Image deleted");
        onRefresh();
      }
    } catch {
      toast.error("Failed to delete image");
    }
  }, [apiBase, onRefresh]);

  const handleSetDefault = useCallback(async (imageId: number) => {
    try {
      await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, isDefault: true }),
      });
      onRefresh();
    } catch {
      toast.error("Failed to set default");
    }
  }, [apiBase, onRefresh]);

  const handleUpdateLabel = useCallback(async () => {
    if (!editingImage) return;
    try {
      await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: editingImage.id, label: labelValue || null }),
      });
      toast.success("Label updated");
      onRefresh();
    } catch {
      toast.error("Failed to update label");
    }
    setLabelDialogOpen(false);
  }, [apiBase, editingImage, labelValue, onRefresh]);

  const toggleSelection = (id: number) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">
          Reference Images
          {images.length > 0 && (
            <span className="text-muted-foreground font-normal ml-1">({images.length})</span>
          )}
        </h4>
        {!selectable && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 3v10M3 8h10" />
                </svg>
                Add Image
              </>
            )}
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUpload(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {images.length === 0 ? (
        <div className="border border-dashed border-border/50 rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">No reference images yet</p>
          {!selectable && (
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Upload Images
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((img) => {
            const isSelected = selectedIds?.has(img.id);
            return (
              <div
                key={img.id}
                className={`group relative rounded-lg overflow-hidden border transition-all ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/30"
                    : img.isDefault
                      ? "border-primary/40"
                      : "border-border/30 hover:border-border/60"
                } ${selectable ? "cursor-pointer" : ""}`}
                onClick={selectable ? () => toggleSelection(img.id) : undefined}
              >
                <div className="aspect-square bg-black/20 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/storage/${img.storagePath}`}
                    alt={img.label || img.filename}
                    className="w-full h-full object-cover"
                  />

                  {/* Checkbox for selection mode */}
                  {selectable && (
                    <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected ? "bg-primary border-primary" : "bg-black/40 border-white/40"
                    }`}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5">
                          <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
                        </svg>
                      )}
                    </div>
                  )}

                  {/* Default badge */}
                  {img.isDefault && (
                    <Badge className="absolute top-1.5 right-1.5 text-[9px] bg-primary/80 border-0">
                      Default
                    </Badge>
                  )}

                  {/* Hover actions (non-selectable mode) */}
                  {!selectable && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                      {!img.isDefault && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSetDefault(img.id); }}
                          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                          title="Set as default"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M8 1l2.24 4.55 5.01.73-3.63 3.54.86 5L8 12.27 3.52 14.82l.86-5L.75 6.28l5.01-.73z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingImage(img);
                          setLabelValue(img.label || "");
                          setLabelDialogOpen(true);
                        }}
                        className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title="Edit label"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                        className="p-1.5 rounded-md bg-white/10 hover:bg-red-500/40 text-white transition-colors"
                        title="Delete"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Label */}
                {img.label && (
                  <div className="px-1.5 py-1 text-[10px] text-muted-foreground truncate text-center">
                    {img.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Label edit dialog */}
      <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Label</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="e.g., Front view, Close-up, Full body..."
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUpdateLabel()}
            />
            <Button onClick={handleUpdateLabel} className="w-full">
              Save Label
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
