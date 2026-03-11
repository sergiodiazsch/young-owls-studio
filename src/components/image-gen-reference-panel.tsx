"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ReferenceImage {
  storagePath: string;
  filename: string;
  preview?: string; // object URL for local preview, or API URL for existing files
}

interface Props {
  projectId: string;
  references: ReferenceImage[];
  onReferencesChange: (refs: ReferenceImage[]) => void;
  maxImages?: number;
}

// ── Character picker types ──
interface CharacterWithImages {
  id: number;
  name: string;
  images: Array<{
    linkId: number;
    file: { id: number; filename: string; storagePath: string; mimeType: string };
  }>;
}

// ── Drive picker types ──
interface DriveFolder {
  id: number;
  name: string;
}

interface DriveFile {
  id: number;
  filename: string;
  storagePath: string;
  mimeType: string;
  fileType: string;
}

export function ImageGenReferencePanel({ projectId, references, onReferencesChange, maxImages = 10 }: Props) {
  const [uploading, setUploading] = useState(false);

  // Character picker state
  const [charPickerOpen, setCharPickerOpen] = useState(false);
  const [characters, setCharacters] = useState<CharacterWithImages[]>([]);
  const [charsLoading, setCharsLoading] = useState(false);

  // Drive picker state
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [_driveFolderId, setDriveFolderId] = useState<number | null>(null);
  const [driveBreadcrumbs, setDriveBreadcrumbs] = useState<Array<{ id: number; name: string }>>([]);
  const [driveLoading, setDriveLoading] = useState(false);

  const remaining = maxImages - references.length;

  // ── File upload handler ──
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (remaining <= 0) {
      toast.error(`Maximum ${maxImages} reference images`);
      return;
    }

    const toUpload = fileArray.slice(0, remaining);
    setUploading(true);

    const newRefs: ReferenceImage[] = [];
    for (const file of toUpload) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);

        const res = await fetch("/api/generate/image/reference-upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();

        newRefs.push({
          storagePath: data.storagePath,
          filename: data.filename,
          preview: URL.createObjectURL(file),
        });
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    onReferencesChange([...references, ...newRefs]);
    setUploading(false);
  }, [projectId, references, onReferencesChange, maxImages, remaining]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const removeReference = useCallback((index: number) => {
    const updated = [...references];
    const removed = updated.splice(index, 1)[0];
    if (removed.preview && removed.preview.startsWith("blob:")) URL.revokeObjectURL(removed.preview);
    onReferencesChange(updated);
  }, [references, onReferencesChange]);

  // ── Add existing file as reference (already in storage) ──
  const addExistingFile = useCallback((storagePath: string, filename: string, fileId: number) => {
    if (remaining <= 0) {
      toast.error(`Maximum ${maxImages} reference images`);
      return;
    }
    // Check for duplicates
    if (references.some((r) => r.storagePath === storagePath)) {
      toast.error("Already added");
      return;
    }
    onReferencesChange([...references, {
      storagePath,
      filename,
      preview: `/api/drive/files/${fileId}`,
    }]);
  }, [references, onReferencesChange, maxImages, remaining]);

  // ── Character picker ──
  const openCharacterPicker = useCallback(async () => {
    setCharPickerOpen(true);
    setCharsLoading(true);

    try {
      const res = await fetch(`/api/characters?projectId=${projectId}`);
      const chars: Array<{ id: number; name: string }> = await res.json();

      // Fetch images for each character in parallel
      const withImages = await Promise.all(
        chars.map(async (c) => {
          try {
            const filesRes = await fetch(`/api/characters/${c.id}/files`);
            const files = await filesRes.json();
            return { ...c, images: files };
          } catch {
            return { ...c, images: [] };
          }
        })
      );

      // Only show characters that have images
      setCharacters(withImages.filter((c) => c.images.length > 0));
    } catch {
      toast.error("Failed to load characters");
    }
    setCharsLoading(false);
  }, [projectId]);

  // ── Drive picker ──
  const loadDriveFolder = useCallback(async (folderId: number | null) => {
    setDriveLoading(true);
    try {
      const params = new URLSearchParams({ projectId });
      if (folderId !== null) params.set("folderId", String(folderId));
      const res = await fetch(`/api/drive/browse?${params}`);
      const data = await res.json();

      setDriveFolders(data.folders || []);
      // Only show image files
      setDriveFiles((data.files || []).filter((f: DriveFile) => f.fileType === "image"));
      setDriveFolderId(folderId);
      setDriveBreadcrumbs(data.breadcrumbs || []);
    } catch {
      toast.error("Failed to load drive");
    }
    setDriveLoading(false);
  }, [projectId]);

  const openDrivePicker = useCallback(() => {
    setDrivePickerOpen(true);
    loadDriveFolder(null);
  }, [loadDriveFolder]);

  return (
    <div className="space-y-3">
      {/* Reference grid */}
      {references.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {references.map((ref, i) => (
            <div key={ref.storagePath} className="relative group">
              <div className="relative aspect-square rounded-lg bg-muted overflow-hidden border">
                {ref.preview ? (
                  ref.preview.startsWith("blob:") ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- blob URLs not supported by next/image */
                    <img src={ref.preview} alt={ref.filename} className="w-full h-full object-cover" />
                  ) : (
                    <Image src={ref.preview} alt={ref.filename} fill className="object-cover" sizes="80px" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    {ref.filename.slice(0, 8)}...
                  </div>
                )}
              </div>
              <button
                onClick={() => removeReference(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Source buttons */}
      <div className="flex gap-2">
        {/* Upload from computer */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex-1 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            input.accept = "image/*";
            input.onchange = () => {
              if (input.files) handleFiles(input.files);
            };
            input.click();
          }}
        >
          {uploading ? (
            <p className="text-xs text-muted-foreground">Uploading...</p>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-1 text-muted-foreground">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-[10px] font-medium">Upload</p>
            </>
          )}
        </div>

        {/* Pick from characters */}
        <button
          onClick={openCharacterPicker}
          className="flex-1 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-1 text-muted-foreground">
            <circle cx="9" cy="7" r="4" />
            <path d="M1 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
          </svg>
          <p className="text-[10px] font-medium">Characters</p>
        </button>

        {/* Pick from drive */}
        <button
          onClick={openDrivePicker}
          className="flex-1 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-1 text-muted-foreground">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
          <p className="text-[10px] font-medium">Drive</p>
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        {references.length}/{maxImages} references
      </p>

      {/* ── Character Picker Dialog ── */}
      <Dialog open={charPickerOpen} onOpenChange={setCharPickerOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Pick from Character Images</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {charsLoading && <p className="text-xs text-muted-foreground text-center py-8">Loading characters...</p>}
            {!charsLoading && characters.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                No characters with images. Upload images on the Characters page first.
              </p>
            )}
            {characters.map((char) => (
              <div key={char.id}>
                <p className="text-xs font-semibold mb-2">{char.name}</p>
                <div className="grid grid-cols-4 gap-2">
                  {char.images.map((img) => {
                    const alreadyAdded = references.some((r) => r.storagePath === img.file.storagePath);
                    return (
                      <button
                        key={img.linkId}
                        onClick={() => {
                          if (!alreadyAdded) {
                            addExistingFile(img.file.storagePath, img.file.filename, img.file.id);
                            toast.success(`Added ${img.file.filename}`);
                          }
                        }}
                        disabled={alreadyAdded}
                        className="relative aspect-square rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all disabled:opacity-40"
                      >
                        <Image
                          src={`/api/drive/files/${img.file.id}`}
                          alt={img.file.filename}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                        {alreadyAdded && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Drive Picker Dialog ── */}
      <Dialog open={drivePickerOpen} onOpenChange={setDrivePickerOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Pick from Asset Drive</DialogTitle>
          </DialogHeader>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-xs flex-wrap">
            <button
              onClick={() => loadDriveFolder(null)}
              className="text-primary hover:underline"
            >
              Root
            </button>
            {driveBreadcrumbs.map((bc) => (
              <span key={bc.id} className="flex items-center gap-1">
                <span className="text-muted-foreground">/</span>
                <button
                  onClick={() => loadDriveFolder(bc.id)}
                  className="text-primary hover:underline"
                >
                  {bc.name}
                </button>
              </span>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {driveLoading && <p className="text-xs text-muted-foreground text-center py-8">Loading...</p>}

            {!driveLoading && (
              <div className="space-y-1">
                {/* Folders */}
                {driveFolders.map((folder) => (
                  <button
                    key={`folder-${folder.id}`}
                    onClick={() => loadDriveFolder(folder.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                    <span className="text-xs font-medium truncate">{folder.name}</span>
                  </button>
                ))}

                {/* Image files */}
                {driveFiles.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    {driveFiles.map((file) => {
                      const alreadyAdded = references.some((r) => r.storagePath === file.storagePath);
                      return (
                        <button
                          key={file.id}
                          onClick={() => {
                            if (!alreadyAdded) {
                              addExistingFile(file.storagePath, file.filename, file.id);
                              toast.success(`Added ${file.filename}`);
                            }
                          }}
                          disabled={alreadyAdded}
                          className="relative aspect-square rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all disabled:opacity-40"
                        >
                          <Image
                            src={`/api/drive/files/${file.id}`}
                            alt={file.filename}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                          {alreadyAdded && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                            <p className="text-[8px] text-white truncate">{file.filename}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!driveLoading && driveFolders.length === 0 && driveFiles.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No images in this folder</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export type { ReferenceImage };
