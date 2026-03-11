"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { DriveFile } from "@/lib/types";

interface DriveFileViewerProps {
  file: DriveFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onDeleted?: () => void;
  onRenamed?: () => void;
}

export function DriveFileViewer({ file, open, onOpenChange, projectId, onDeleted, onRenamed }: DriveFileViewerProps) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!file) return null;

  // TECH AUDIT FIX: Capture file in a local const to avoid non-null assertions in closures
  const currentFile = file;

  const isImage = currentFile.fileType === "image" || currentFile.mimeType?.startsWith("image/");
  const isAudio = currentFile.fileType === "audio" || currentFile.mimeType?.startsWith("audio/");
  const isVideo = currentFile.fileType === "video" || currentFile.mimeType?.startsWith("video/");
  const hasAiMeta = !!currentFile.generatedBy;

  async function handleDelete() {
    try {
      const res = await fetch(`/api/drive/files/${currentFile.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("File deleted");
      onOpenChange(false);
      onDeleted?.();
    } catch {
      toast.error("Failed to delete file");
    }
  }

  async function handleRename() {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`/api/drive/files/${currentFile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: newName.trim() }),
      });
      if (!res.ok) throw new Error("Rename failed");
      toast.success("Renamed");
      setRenaming(false);
      onRenamed?.();
    } catch {
      toast.error("Failed to rename file");
    }
  }

  async function handleDownload() {
    const a = document.createElement("a");
    a.href = `/api/drive/files/${currentFile.id}`;
    a.download = currentFile.filename;
    a.click();
  }

  function handleUseAsReference() {
    router.push(`/project/${projectId}/generate?ref=${currentFile.id}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {renaming ? (
              <div className="flex gap-2 items-center">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 border rounded px-2 py-1 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setRenaming(false);
                  }}
                />
                <Button size="sm" className="h-7" onClick={handleRename}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setRenaming(false)}>Cancel</Button>
              </div>
            ) : (
              file.filename
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="rounded-lg overflow-hidden bg-muted border">
          {isImage && (
            <div className="relative w-full" style={{ minHeight: 200, maxHeight: '50vh' }}>
              <Image
                src={`/api/drive/files/${file.id}`}
                alt={file.filename}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          )}
          {isAudio && (
            <div className="p-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <audio controls src={`/api/drive/files/${file.id}`} className="w-full max-w-md" />
            </div>
          )}
          {isVideo && (
            <video
              controls
              src={`/api/drive/files/${file.id}`}
              className="w-full max-h-[50vh]"
            />
          )}
          {!isImage && !isAudio && !isVideo && (
            <div className="p-12 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-muted-foreground/10 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground uppercase font-medium tracking-wider">
                {file.mimeType?.split("/")[1]?.toUpperCase() || "FILE"}
              </p>
            </div>
          )}
        </div>

        {/* File details */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm py-2">
          <div>
            <span className="text-muted-foreground text-xs">Type</span>
            <p className="font-medium text-xs">{file.mimeType}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Size</span>
            <p className="font-medium text-xs">{formatSize(file.fileSize)}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Created</span>
            <p className="font-medium text-xs">{new Date(file.createdAt).toLocaleDateString()}</p>
          </div>
          {file.caption && (
            <div className="col-span-2">
              <span className="text-muted-foreground text-xs">Caption</span>
              <p className="font-medium text-xs">{file.caption}</p>
            </div>
          )}
        </div>

        {/* AI Metadata */}
        {hasAiMeta && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1">
                    <path d="M8 1v3M8 12v3M1 8h3M12 8h3" /><circle cx="8" cy="8" r="3" />
                  </svg>
                  AI Generated
                </Badge>
                <span className="text-xs text-muted-foreground">via {file.generatedBy}</span>
              </div>
              {file.generationPrompt && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Prompt</p>
                  <p className="text-xs leading-relaxed">{file.generationPrompt}</p>
                </div>
              )}
              {file.seed != null && (
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Seed</p>
                  <code className="text-xs font-mono text-foreground select-all">{file.seed}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(String(file.seed)); }}
                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy seed"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="5" y="5" width="9" height="9" rx="1.5" />
                      <path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Actions */}
        <Separator />
        <div className="flex flex-wrap gap-2">
          {isImage && (
            <Button variant="outline" size="sm" onClick={handleUseAsReference}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
                <path d="M8 1v3M8 12v3M1 8h3M12 8h3" /><circle cx="8" cy="8" r="3" />
              </svg>
              Use as Reference
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { setNewName(file.filename); setRenaming(true); }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
              <path d="M11 2l3 3L5 14H2v-3L11 2z" />
            </svg>
            Rename
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
              <path d="M8 2v8M8 10L5 7M8 10L11 7" />
              <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
            </svg>
            Download
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteConfirm(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
            Delete
          </Button>
        </div>
      </DialogContent>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete file"
        description={`"${file.filename}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </Dialog>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
