"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReferenceImageGallery, type ReferenceImage } from "@/components/reference-image-gallery";
import { ShareAssetToggle } from "@/components/share-asset-toggle";
import type { Location, LocationConcept } from "@/lib/types";

interface LocationScene {
  id: number;
  sceneNumber: number;
  heading: string;
  timeOfDay: string | null;
  synopsis: string | null;
  sortOrder: number;
}

interface LocationDetail extends Location {
  scenes: LocationScene[];
  concepts: LocationConcept[];
}

interface DriveFile {
  id: number;
  filename: string;
  storagePath: string;
  mimeType: string;
  fileType: string;
  fileSize: number;
}

export default function LocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const locationId = params.locationId as string;

  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [visualPrompt, setVisualPrompt] = useState("");
  const [descDirty, setDescDirty] = useState(false);
  const [promptDirty, setPromptDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Image management state
  const [uploading, setUploading] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [assetFiles, setAssetFiles] = useState<DriveFile[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [deletingConcept, setDeletingConcept] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reference images
  const [locRefImages, setLocRefImages] = useState<ReferenceImage[]>([]);
  const loadRefImages = useCallback(() => {
    fetch(`/api/locations/${locationId}/reference-images`)
      .then((r) => r.json())
      .then((data: ReferenceImage[]) => setLocRefImages(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [locationId]);

  const fetchLocation = useCallback(() => {
    fetch(`/api/locations/${locationId}`)
      .then((r) => r.json())
      .then((data: LocationDetail) => {
        setLocation(data);
        setDescription(data.description || "");
        setVisualPrompt(data.visualPrompt || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    fetchLocation();
    loadRefImages();
  }, [fetchLocation, loadRefImages]);

  async function saveField(field: "description" | "visualPrompt", value: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        toast.success(field === "description" ? "Description saved" : "Visual prompt saved");
        if (field === "description") setDescDirty(false);
        if (field === "visualPrompt") setPromptDirty(false);
      }
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  }

  async function handleRegenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/locations/${locationId}/generate-prompt`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Failed to generate visual prompt");
        setGenerating(false);
        return;
      }
      const data = await res.json();
      setVisualPrompt(data.visualPrompt);
      setPromptDirty(false);
      toast.success("Visual prompt regenerated from script");
    } catch {
      toast.error("Failed to generate visual prompt");
    }
    setGenerating(false);
  }

  async function handleDelete() {
    try {
      await fetch(`/api/locations/${locationId}`, { method: "DELETE" });
      toast.success("Location deleted");
      router.push(`/project/${projectId}/locations`);
    } catch {
      toast.error("Failed to delete location");
    }
  }

  // ── Image management ──

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);

        const res = await fetch(`/api/locations/${locationId}/concepts`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "Upload failed");
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    fetchLocation();
    toast.success("Images uploaded");
  }

  async function handleAssetLibraryOpen() {
    setAssetPickerOpen(true);
    setLoadingAssets(true);
    try {
      const res = await fetch(`/api/drive/browse?projectId=${projectId}`);
      const data = await res.json();
      setAssetFiles((data.files || []).filter((f: DriveFile) => f.fileType === "image"));
    } catch {
      toast.error("Failed to load asset library");
    }
    setLoadingAssets(false);
  }

  async function handleAssetSelect(file: DriveFile) {
    try {
      const res = await fetch(`/api/locations/${locationId}/concepts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: file.storagePath,
          fileId: file.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to add image");
        return;
      }
      toast.success(`Added "${file.filename}"`);
      fetchLocation();
    } catch {
      toast.error("Failed to add image");
    }
  }

  async function handleConceptDelete(conceptId: number) {
    setDeletingConcept(conceptId);
    try {
      const res = await fetch(`/api/locations/${locationId}/concepts?conceptId=${conceptId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Image removed");
        fetchLocation();
      }
    } catch {
      toast.error("Failed to remove image");
    }
    setDeletingConcept(null);
  }

  async function handleSetPrimary(conceptId: number) {
    try {
      const res = await fetch(`/api/locations/${locationId}/concepts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId }),
      });
      if (res.ok) {
        toast.success("Cover image updated");
        fetchLocation();
      }
    } catch {
      toast.error("Failed to update cover");
    }
  }

  const filteredAssets = assetSearch
    ? assetFiles.filter((f) => f.filename.toLowerCase().includes(assetSearch.toLowerCase()))
    : assetFiles;

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Skeleton className="h-4 w-24 mb-4" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-40 mb-6" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Location not found.</p>
        <Link
          href={`/project/${projectId}/locations`}
          className="text-sm text-primary hover:underline mt-2 inline-block"
        >
          Back to locations
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Back link */}
      <Link
        href={`/project/${projectId}/locations`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group mb-4"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-0.5 transition-transform">
          <path d="M10 2L4 8l6 6" />
        </svg>
        Back to Locations
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{location.name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="secondary" className="text-xs">
              {location.sceneCount} scene{location.sceneCount !== 1 ? "s" : ""}
            </Badge>
            {location.timePeriod && (
              <Badge variant="outline" className="text-xs">{location.timePeriod}</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {location && (
            <ShareAssetToggle
              assetType="location"
              entityId={Number(locationId)}
              projectId={Number(projectId)}
              name={location.name}
              description={location.description}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
            Delete
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Description */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="location-description">Description</Label>
              {descDirty && (
                <Button size="sm" className="h-7 text-xs" onClick={() => saveField("description", description)} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
            <Textarea
              id="location-description"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setDescDirty(true); }}
              placeholder="Describe this location -- its appearance, atmosphere, key features..."
              rows={4}
              className="text-sm"
            />
          </CardContent>
        </Card>

        {/* Visual Prompt */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="location-visual-prompt">Visual Prompt</Label>
              <div className="flex items-center gap-2">
                {promptDirty && (
                  <Button size="sm" className="h-7 text-xs" onClick={() => saveField("visualPrompt", visualPrompt)} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleRegenerate} disabled={generating}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                    <path d="M1 4v6h6M23 20v-6h-6" />
                    <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                  </svg>
                  {generating ? "Generating..." : "Regenerate from Script"}
                </Button>
              </div>
            </div>
            <Textarea
              id="location-visual-prompt"
              value={visualPrompt}
              onChange={(e) => { setVisualPrompt(e.target.value); setPromptDirty(true); }}
              placeholder="AI-generated visual description for concept art generation..."
              rows={6}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              This prompt can be used for image generation to create concept art for this location.
            </p>
          </CardContent>
        </Card>

        <Separator />

        {/* ── Reference Images ── */}
        <ReferenceImageGallery
          entityType="location"
          entityId={Number(locationId)}
          images={locRefImages}
          onRefresh={loadRefImages}
        />

        <Separator />

        {/* ── Concept Art Gallery ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Concept Art</h2>
            <div className="flex items-center gap-2">
              {/* Upload button */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {uploading ? "Uploading..." : "Upload"}
              </Button>

              {/* Asset Library button */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleAssetLibraryOpen}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                Asset Library
              </Button>

              {/* Generate button */}
              <Link href={`/project/${projectId}/generate?prompt=${encodeURIComponent(visualPrompt || `Cinematic establishing shot of ${location.name}`)}`}>
                <Button variant="default" size="sm" className="gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="1" width="14" height="14" rx="2" />
                    <circle cx="6" cy="6" r="2" />
                    <path d="M1 12l4-4 3 3 2-2 5 5" />
                  </svg>
                  Generate
                </Button>
              </Link>
            </div>
          </div>

          {location.concepts.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                    <rect x="2" y="2" width="20" height="20" rx="3" />
                    <circle cx="8" cy="8" r="2" />
                    <path d="M2 16l5-5 4 4 3-3 8 8" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">No concept art yet</p>
                <p className="text-xs text-muted-foreground mt-1">Upload images, pick from Asset Library, or generate with AI</p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Upload Images
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleAssetLibraryOpen}>
                    From Asset Library
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {location.concepts
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((concept) => (
                  <div key={concept.id} className="group relative rounded-lg overflow-hidden border bg-muted">
                    {concept.storagePath && (
                      <button
                        onClick={() => handleSetPrimary(concept.id)}
                        className="w-full text-left"
                        title="Click to set as cover"
                      >
                        <div className="relative w-full aspect-[4/3]">
                          <Image
                            src={`/api/storage/${concept.storagePath}`}
                            alt={concept.prompt || `${location.name} concept`}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 50vw, 33vw"
                          />
                        </div>
                      </button>
                    )}

                    {/* Primary badge */}
                    {concept.isPrimary === 1 && (
                      <div className="absolute top-2 left-2">
                        <Badge className="text-[10px] bg-primary text-primary-foreground shadow-md">
                          Cover
                        </Badge>
                      </div>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleConceptDelete(concept.id); }}
                      disabled={deletingConcept === concept.id}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white/80 hover:bg-red-600 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>

                    {/* Overlay with metadata */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {concept.timeOfDay && (
                          <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-0">
                            {concept.timeOfDay}
                          </Badge>
                        )}
                        {concept.cameraAngle && (
                          <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-0">
                            {concept.cameraAngle}
                          </Badge>
                        )}
                      </div>
                      {concept.prompt && (
                        <p className="text-[10px] text-white/80 truncate mt-1">{concept.prompt}</p>
                      )}
                    </div>
                  </div>
                ))}

              {/* Add more button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 aspect-[4/3] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                <span className="text-xs">Add Image</span>
              </button>
            </div>
          )}
        </div>

        <Separator />

        {/* Scenes at this location */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Scenes at This Location</h2>
          {location.scenes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scenes linked to this location.</p>
          ) : (
            <div className="space-y-2">
              {location.scenes
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((scene) => (
                  <Link key={scene.id} href={`/project/${projectId}/scenes/${scene.id}`} className="block">
                    <Card className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                          {scene.sceneNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{scene.heading}</p>
                          {scene.synopsis && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{scene.synopsis}</p>
                          )}
                        </div>
                        {scene.timeOfDay && (
                          <Badge variant="outline" className="text-[10px] shrink-0">{scene.timeOfDay}</Badge>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete location"
        description="This location and all its data will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete Location"
        onConfirm={handleDelete}
      />

      {/* ── Asset Library Picker Dialog ── */}
      <Dialog open={assetPickerOpen} onOpenChange={setAssetPickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select from Asset Library</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={assetSearch}
              onChange={(e) => setAssetSearch(e.target.value)}
              placeholder="Search images..."
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background"
            />
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingAssets ? (
              <div className="grid grid-cols-3 gap-2 p-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-md" />
                ))}
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {assetSearch ? "No matching images" : "No images in Asset Library"}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 p-1">
                {filteredAssets.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => { handleAssetSelect(file); setAssetPickerOpen(false); }}
                    className="group relative rounded-md overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                  >
                    <div className="relative aspect-square">
                      <Image
                        src={`/api/storage/${file.storagePath}`}
                        alt={file.filename}
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                      <p className="text-[10px] text-white/0 group-hover:text-white/90 p-1.5 truncate w-full transition-colors">
                        {file.filename}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
