"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InfoTooltip } from "@/components/info-tooltip";
import { ImageGenCameraPresets, CAMERA_ANGLE_PRESETS } from "@/components/image-gen-camera-presets";
import { useImageGenerationQueue } from "@/hooks/use-image-generation-queue";
import { toast } from "sonner";
import { useGallerySize, GRID_COLS } from "@/hooks/use-gallery-size";
import { GallerySizeControl } from "@/components/gallery-size-control";
import type { Scene, ImageGeneration } from "@/lib/types";

/* ── Shot type definitions with SVG icons ── */
const SHOT_TYPES = [
  {
    id: "wide",
    label: "Wide Shot",
    description: "Full scene context, establishing shot",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M5 14l4-3 3 2 4-4 3 3" strokeLinejoin="round" />
        <circle cx="7" cy="9" r="1.5" />
      </svg>
    ),
  },
  {
    id: "closeup",
    label: "Close-up",
    description: "Tight framing on face or detail",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="3.5" strokeDasharray="2 2" />
        <path d="M12 5v1M12 18v1M5 12h1M18 12h1" />
      </svg>
    ),
  },
  {
    id: "pov",
    label: "POV",
    description: "First person perspective",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "over-shoulder",
    label: "Over Shoulder",
    description: "Looking past a foreground figure",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path d="M3 20c0-3 2-5 5-5" />
        <circle cx="6" cy="10" r="3" />
        <rect x="10" y="6" width="12" height="12" rx="1.5" strokeDasharray="3 2" />
        <circle cx="16" cy="12" r="2" />
      </svg>
    ),
  },
  {
    id: "dutch",
    label: "Dutch Angle",
    description: "Tilted frame for tension or unease",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <rect x="4" y="4" width="16" height="16" rx="2" transform="rotate(15 12 12)" />
        <line x1="8" y1="9" x2="16" y2="7" />
        <line x1="8" y1="13" x2="14" y2="11.5" />
      </svg>
    ),
  },
  {
    id: "aerial",
    label: "Aerial",
    description: "Bird's eye / drone top-down view",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <ellipse cx="12" cy="14" rx="8" ry="4" />
        <ellipse cx="12" cy="14" rx="4" ry="2" strokeDasharray="2 2" />
        <path d="M12 2v8" />
        <path d="M9 4l3-2 3 2" />
      </svg>
    ),
  },
] as const;

const CAMERA_ENGINES = [
  {
    id: "camera-angles",
    name: "Flux Multi-Angle",
    cost: "$0.04/angle",
    description: "Generates images from a text prompt at specified camera angles. Best for creating concept art from scratch.",
    needsSource: false,
    needsPresets: true,
  },
  {
    id: "stable-zero123",
    name: "Stable Zero123",
    cost: "$0.04/angle",
    description: "Takes an existing image and rotates it in 3D space. Best for characters and objects.",
    needsSource: true,
    needsPresets: true,
  },
  {
    id: "era3d",
    name: "Era3D Multi-View",
    cost: "$0.10/batch",
    description: "Generates 6 canonical views from a single image in one API call.",
    needsSource: true,
    needsPresets: false,
  },
] as const;

type GalleryFilter = "all" | "completed" | "generating" | "failed" | "favorites";

export default function CameraAnglesPage() {
  return (
    <Suspense fallback={<div className="page-loader"><div className="loader-spin loader-spin-lg" /><p>Loading camera angles...</p></div>}>
      <CameraAnglesInner />
    </Suspense>
  );
}

function CameraAnglesInner() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const {
    generations,
    loading,
    enqueue,
    toggleFavorite,
  } = useImageGenerationQueue(projectId);

  // Scene data
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");

  // Shot type selection
  const [selectedShotType, setSelectedShotType] = useState<string | null>(null);

  // Engine & existing generation state
  const [engine, setEngine] = useState<string>("camera-angles");
  const [prompt, setPrompt] = useState("");
  const [description, setDescription] = useState("");
  const [sourceImagePath, setSourceImagePath] = useState<string | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(null);
  const [selectedAngles, setSelectedAngles] = useState<Set<string>>(
    new Set(CAMERA_ANGLE_PRESETS.map((p) => p.label))
  );
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // UI state
  const [panelOpen, setPanelOpen] = useState(false);
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [gallerySize, setGallerySize] = useGallerySize(3);

  const engineConfig = CAMERA_ENGINES.find((e) => e.id === engine)!;

  const selectedScene = scenes.find((s) => String(s.id) === selectedSceneId);

  // Load scenes + settings
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/scenes?projectId=${projectId}`, { signal: controller.signal }).then((r) => r.json()),
      fetch("/api/settings", { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([scenesData, settingsData]) => {
        setScenes(scenesData);
        setHasApiKey(settingsData.fal_api_key?.hasValue || false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load camera angle settings");
        setHasApiKey(false);
      });
    return () => controller.abort();
  }, [projectId]);

  // Filter generations to only show camera angle batches
  const cameraGenerations = generations.filter(
    (g) => g.model === "camera-angles" || g.model === "stable-zero123" || g.model === "era3d"
  );

  const filteredGenerations = useMemo(() => {
    switch (filter) {
      case "completed": return cameraGenerations.filter((g) => g.status === "completed");
      case "generating": return cameraGenerations.filter((g) => g.status === "generating" || g.status === "queued");
      case "failed": return cameraGenerations.filter((g) => g.status === "failed");
      case "favorites": return cameraGenerations.filter((g) => g.isFavorite);
      default: return cameraGenerations;
    }
  }, [cameraGenerations, filter]);

  const completedImages = generations.filter(
    (g) => g.status === "completed" && g.storagePath
  );
  const completedCount = cameraGenerations.filter((g) => g.status === "completed").length;
  const generatingCount = cameraGenerations.filter((g) => g.status === "generating" || g.status === "queued").length;
  const failedCount = cameraGenerations.filter((g) => g.status === "failed").length;
  const favCount = cameraGenerations.filter((g) => g.isFavorite).length;

  function handleSelectSourceFromGen(gen: ImageGeneration) {
    if (!gen.storagePath) return;
    setSourceImagePath(gen.storagePath);
    setSourceImagePreview(`/api/generate/image/generations/${gen.id}/file`);
  }

  async function handleUploadSource() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      if (!input.files?.[0]) return;
      const formData = new FormData();
      formData.append("file", input.files[0]);
      formData.append("projectId", projectId);
      try {
        const res = await fetch("/api/drive/files/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const driveFile = await res.json();
        setSourceImagePath(driveFile.storagePath);
        setSourceImagePreview(`/api/drive/files/${driveFile.id}`);
        toast.success("Image uploaded as source");
      } catch {
        toast.error("Failed to upload image");
      }
    };
    input.click();
  }

  // Build the full prompt from scene + shot type + description
  function buildFullPrompt(): string {
    const parts: string[] = [];
    if (selectedScene) {
      parts.push(`Scene ${selectedScene.sceneNumber}: ${selectedScene.heading}`);
    }
    const shotLabel = SHOT_TYPES.find((s) => s.id === selectedShotType)?.label;
    if (shotLabel) {
      parts.push(`Shot type: ${shotLabel}`);
    }
    if (description.trim()) {
      parts.push(description.trim());
    }
    if (prompt.trim()) {
      parts.push(prompt.trim());
    }
    return parts.join(". ") || "Camera angle generation";
  }

  function handleGenerate() {
    if (engineConfig.needsSource && !sourceImagePath) return;
    if (!selectedSceneId && !prompt.trim() && !description.trim()) return;
    if (hasApiKey !== true) return;

    const fullPrompt = buildFullPrompt();

    if (engine === "era3d") {
      enqueue({
        prompt: fullPrompt,
        model: "era3d",
        sourceImagePath: sourceImagePath || undefined,
      });
      toast.success("Era3D batch queued -- generating 6 views");
    } else {
      const presets = CAMERA_ANGLE_PRESETS.filter((p) => selectedAngles.has(p.label));
      if (presets.length === 0) return;
      enqueue({
        prompt: fullPrompt,
        model: engine,
        cameraPresets: presets,
        sourceImagePath: sourceImagePath || undefined,
      });
      toast.success(`${presets.length} camera angle${presets.length > 1 ? "s" : ""} queued`);
    }

    setPanelOpen(false);
  }

  const costPerUnit = engine === "era3d" ? 0.10 : 0.04;
  const unitCount = engine === "era3d" ? 1 : selectedAngles.size;
  const totalCost = costPerUnit * unitCount;

  const canGenerate =
    hasApiKey === true &&
    (!engineConfig.needsSource || !!sourceImagePath) &&
    (selectedSceneId || prompt.trim() || description.trim()) &&
    (engine === "era3d" || selectedAngles.size > 0);

  const generateLabel =
    engine === "era3d"
      ? "Generate 6 Multi-Views"
      : `Generate ${selectedAngles.size} Angle${selectedAngles.size !== 1 ? "s" : ""}`;

  if (hasApiKey === false) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 bg-background text-foreground min-h-[calc(100vh-3.5rem)]">
        <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-destructive">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-1">API Key Required</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-5">
          Configure your fal.ai API key in Settings to enable camera angle generation.
        </p>
        <Button onClick={() => router.push("/settings")} className="shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-all duration-300">Go to Settings</Button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      {/* ── Header bar ── */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="px-4 md:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap drop-shadow-sm">Camera Angles</h1>
            {cameraGenerations.length > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {completedCount} image{completedCount !== 1 ? "s" : ""}
                {generatingCount > 0 && (
                  <span className="text-primary ml-1.5">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="inline animate-spin mr-0.5 -mt-0.5">
                      <circle cx="8" cy="8" r="6" strokeDasharray="10 20" />
                    </svg>
                    {generatingCount} generating
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 ml-auto">
            {([
              ["all", "All", cameraGenerations.length],
              ["completed", "Ready", completedCount],
              ["generating", "Generating", generatingCount],
              ["favorites", "Favorites", favCount],
              ["failed", "Failed", failedCount],
            ] as [GalleryFilter, string, number][]).map(([key, label, count]) => (
              count > 0 || key === "all" ? (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all duration-300 ${
                    filter === key
                      ? "bg-primary/15 text-primary shadow-[0_2px_8px_var(--glow-primary)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {label}
                  {count > 0 && key !== "all" && (
                    <span className="ml-1 opacity-60">{count}</span>
                  )}
                </button>
              ) : null
            ))}
          </div>

          <GallerySizeControl value={gallerySize} onChange={setGallerySize} />
          <Button
            onClick={() => setPanelOpen(true)}
            size="sm"
            className="gap-1.5 shrink-0 shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-all duration-300"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" />
            </svg>
            <span className="hidden sm:inline">Create</span>
          </Button>
        </div>
      </div>

      {/* ── Main content: scene-first workflow ── */}
      <div className="p-4 md:p-6">
        {/* ── Step 1: Scene selector + Step 2: Shot type grid ── */}
        <div className="mb-8 rounded-xl border border-border/40 backdrop-blur-sm bg-card/80 p-5 space-y-5">
          {/* Scene selector */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm font-medium flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted-foreground/30 text-[10px] font-bold text-muted-foreground">1</span>
              Select a Scene
            </Label>
            <Select value={selectedSceneId} onValueChange={setSelectedSceneId}>
              <SelectTrigger className="bg-card border-border text-foreground hover:border-border">
                <SelectValue placeholder="Choose a scene..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {scenes.length === 0 ? (
                  <SelectItem value="__none" disabled className="text-muted-foreground">
                    No scenes found
                  </SelectItem>
                ) : (
                  scenes.map((scene) => (
                    <SelectItem
                      key={scene.id}
                      value={String(scene.id)}
                      className="text-foreground focus:bg-muted focus:text-foreground"
                    >
                      <span className="font-mono text-muted-foreground mr-2">#{scene.sceneNumber}</span>
                      {scene.heading}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedScene?.synopsis && (
              <p className="text-xs text-muted-foreground pl-1 line-clamp-2">{selectedScene.synopsis}</p>
            )}
          </div>

          {/* Shot type visual grid */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm font-medium flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted-foreground/30 text-[10px] font-bold text-muted-foreground">2</span>
              Shot Type
            </Label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {SHOT_TYPES.map((shot) => {
                const isSelected = selectedShotType === shot.id;
                return (
                  <button
                    key={shot.id}
                    onClick={() => setSelectedShotType(isSelected ? null : shot.id)}
                    className={`group relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-300 ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/50 shadow-[0_0_20px_var(--glow-primary)]"
                        : "border-border/40 backdrop-blur-sm bg-card/80 hover:border-border hover:bg-muted/80 hover:-translate-y-0.5 hover:shadow-md"
                    }`}
                  >
                    <div className={`transition-colors ${isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
                      {shot.icon}
                    </div>
                    <div className="text-center">
                      <p className={`text-xs font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                        {shot.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight hidden sm:block">
                        {shot.description}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-primary">
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description field */}
          <div className="space-y-2 rounded-lg p-3 -mx-3 backdrop-blur-sm bg-muted/30 focus-within:shadow-[0_0_15px_var(--glow-primary)] transition-all duration-300">
            <Label className="text-muted-foreground text-sm font-medium flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted-foreground/30 text-[10px] font-bold text-muted-foreground">3</span>
              Additional Direction
              <InfoTooltip text="Add specific framing notes, mood descriptions, or camera movement cues." />
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Slow push-in, golden hour lighting, rack focus to background..."
              rows={2}
              className="resize-none text-sm bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Generate button */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={() => setPanelOpen(true)}
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
                <path d="M8 2.5v11M2.5 8h11" />
                <circle cx="8" cy="8" r="6.5" strokeDasharray="3 3" />
              </svg>
              Advanced Options
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex-1 shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-all duration-300 disabled:shadow-none"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
                <path d="M8 1v3M8 12v3M1 8h3M12 8h3" /><circle cx="8" cy="8" r="3" />
              </svg>
              {generateLabel}
              <span className="ml-2 text-[11px] opacity-70 font-mono">~${totalCost.toFixed(2)}</span>
            </Button>
          </div>
        </div>

        {/* ── Gallery: contact sheet ── */}
        {loading ? (
          <div className={`grid gap-4 ${GRID_COLS.camera[gallerySize]}`}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-xl bg-muted" />
            ))}
          </div>
        ) : filteredGenerations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-5">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 3v18" />
                <circle cx="15" cy="15" r="2" />
              </svg>
            </div>
            {filter !== "all" ? (
              <>
                <h2 className="text-lg font-semibold mb-1 text-foreground">No results</h2>
                <p className="text-sm text-muted-foreground mb-4">No images match this filter</p>
                <Button variant="outline" size="sm" onClick={() => setFilter("all")} className="border-border text-muted-foreground hover:bg-muted">Show all</Button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-1 text-foreground">No camera angles yet</h2>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-5">
                  Select a scene and shot type above, then generate to create a contact sheet of angle variants
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Group batches as contact sheets */}
            {(() => {
              const batches = new Map<string, ImageGeneration[]>();
              const standalone: ImageGeneration[] = [];
              for (const g of filteredGenerations) {
                if (g.batchId) {
                  if (!batches.has(g.batchId)) batches.set(g.batchId, []);
                  batches.get(g.batchId)!.push(g);
                } else {
                  standalone.push(g);
                }
              }
              return (
                <>
                  {Array.from(batches.entries()).map(([batchId, items]) => {
                    const activeInBatch = items.filter((i) => i.status === "generating" || i.status === "queued").length;
                    const completedInBatch = items.filter((i) => i.status === "completed").length;
                    return (
                      <div key={batchId} className="rounded-xl border border-border/40 backdrop-blur-sm bg-card/80 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <path d="M3 9h18M9 3v18" />
                            </svg>
                            <p className="text-sm font-medium text-foreground">
                              {items[0]?.model === "era3d" ? "Era3D Multi-View" : "Contact Sheet"}
                            </p>
                            {activeInBatch > 0 && (
                              <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30 animate-pulse shadow-[0_0_8px_var(--glow-primary)]">
                                {completedInBatch}/{items.length} done
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[280px]">{items[0]?.prompt}</p>
                        </div>
                        <div className={`grid gap-2 ${GRID_COLS.camera[gallerySize]}`}>
                          {items.map((gen) => (
                            <ContactSheetThumbnail
                              key={gen.id}
                              gen={gen}
                              onFavorite={() => toggleFavorite(gen.id)}
                              projectId={projectId}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {standalone.length > 0 && (
                    <div className={`grid gap-3 ${GRID_COLS.camera[gallerySize]}`}>
                      {standalone.map((gen) => (
                        <ContactSheetThumbnail
                          key={gen.id}
                          gen={gen}
                          onFavorite={() => toggleFavorite(gen.id)}
                          projectId={projectId}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Advanced Options Panel (Sheet) ── */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col backdrop-blur-sm bg-card/80 border-border/40 text-foreground">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <SheetTitle className="text-foreground">Advanced Options</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
            {/* Engine Selector */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Camera Engine</Label>
              <div className="grid gap-2">
                {CAMERA_ENGINES.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEngine(e.id)}
                    className={`text-left rounded-lg border p-3 transition-all duration-300 ${
                      engine === e.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary/50 shadow-[0_0_12px_var(--glow-primary)]"
                        : "border-border/40 backdrop-blur-sm bg-card/80 hover:border-border hover:bg-muted/50 hover:-translate-y-0.5 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{e.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{e.cost}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      {e.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Source Image */}
            {engineConfig.needsSource && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Base Image
                  <InfoTooltip text="Upload or select an image to use as the base for camera angle transformation." />
                </Label>
                {sourceImagePreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sourceImagePreview}
                      alt="Source"
                      className="w-full max-h-48 object-contain rounded-lg border border-border/40 bg-card shadow-[0_0_15px_var(--glow-primary)]"
                      loading="lazy"
                    />
                    <button
                      onClick={() => { setSourceImagePath(null); setSourceImagePreview(null); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs flex items-center justify-center transition-colors"
                      aria-label="Remove source image"
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full h-16 border-dashed border-border hover:bg-muted hover:shadow-md transition-all duration-300" onClick={handleUploadSource}>
                      <div className="flex flex-col items-center gap-1">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                          <path d="M8 10V2M8 2L5 5M8 2L11 5" />
                          <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
                        </svg>
                        <span className="text-xs text-muted-foreground">Upload an image</span>
                      </div>
                    </Button>

                    {completedImages.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1.5">Or pick from recent:</p>
                        <div className="grid grid-cols-6 gap-1.5">
                          {completedImages.slice(0, 12).map((gen) => (
                            <button
                              key={gen.id}
                              onClick={() => handleSelectSourceFromGen(gen)}
                              className="relative aspect-square rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-primary transition-all duration-300 bg-muted"
                            >
                              <Image
                                src={`/api/generate/image/generations/${gen.id}/file`}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Additional Prompt */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                {engineConfig.needsSource ? "Prompt (optional)" : "Prompt Override"}
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  engineConfig.needsSource
                    ? "Optional: describe the subject for better results..."
                    : "Override prompt (leave empty to use scene + shot type)..."
                }
                rows={3}
                className="resize-none text-sm bg-card border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Angle Presets */}
            {engineConfig.needsPresets && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Angle Presets
                  <InfoTooltip text="Each preset defines an azimuth and elevation. Select the angles you want to generate." />
                </Label>
                <ImageGenCameraPresets
                  selected={selectedAngles}
                  onSelectionChange={setSelectedAngles}
                />
              </div>
            )}

            {/* Era3D info */}
            {engine === "era3d" && (
              <div className="text-[11px] text-muted-foreground backdrop-blur-sm bg-card/80 rounded-lg border border-border/40 p-3">
                <p className="font-medium mb-0.5">Era3D generates 6 fixed canonical views:</p>
                <p>Front, Right, Back, Left, Front-Right, and Back-Left.</p>
              </div>
            )}

            </div>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur-sm px-6 py-4">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                size="lg"
                className="flex-1 shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-all duration-300 disabled:shadow-none"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
                  <path d="M8 1v3M8 12v3M1 8h3M12 8h3" /><circle cx="8" cy="8" r="3" />
                </svg>
                {generateLabel}
              </Button>
              <span className="text-xs text-muted-foreground font-mono">
                ~${totalCost.toFixed(2)}
              </span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── Contact Sheet Thumbnail ── */
function ContactSheetThumbnail({
  gen,
  onFavorite,
  projectId,
}: {
  gen: ImageGeneration;
  onFavorite: () => void;
  projectId: string;
}) {
  return (
    <div className="relative group rounded-lg overflow-hidden border border-border/40 backdrop-blur-sm bg-card/80 transition-all duration-300 hover:shadow-md hover:scale-[1.02] hover:border-border">
      <div className="relative aspect-square bg-card">
        {gen.status === "completed" && gen.storagePath ? (
          <Image
            src={`/api/generate/image/generations/${gen.id}/file`}
            alt={gen.batchLabel || "Generated"}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 16vw, 12vw"
          />
        ) : gen.status === "generating" ? (
          <div className="w-full h-full flex items-center justify-center bg-primary/5 animate-pulse">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          </div>
        ) : gen.status === "failed" ? (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-destructive/60">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-border animate-pulse" />
          </div>
        )}
      </div>

      {/* Angle label overlay */}
      {gen.batchLabel && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-foreground text-[9px] font-medium px-1.5 py-1 text-center">
          {gen.batchLabel}
        </div>
      )}

      {/* Hover overlay with actions */}
      {gen.status === "completed" && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
          {/* Favorite button */}
          <button
            onClick={(e) => { e.stopPropagation(); onFavorite(); }}
            className="w-7 h-7 rounded-full bg-muted/80 backdrop-blur-sm text-foreground text-xs flex items-center justify-center hover:bg-accent transition-colors"
            title={gen.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {gen.isFavorite ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-destructive">
                <path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4.5 3.5 3.5 0 0113.5 7C13.5 10.5 8 14 8 14z" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4.5 3.5 3.5 0 0113.5 7C13.5 10.5 8 14 8 14z" />
              </svg>
            )}
          </button>
          {/* Use in Image Gen button */}
          <a
            href={`/project/${projectId}/generate?ref=${gen.id}`}
            className="px-2 py-1 rounded bg-primary/90 text-primary-foreground text-[10px] font-medium hover:bg-primary transition-colors flex items-center gap-1 shadow-[0_0_8px_var(--glow-primary)]"
            onClick={(e) => e.stopPropagation()}
            title="Use this angle as a reference in Image Generation"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2l-6 6M14 2h-4M14 2v4" />
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-3" />
            </svg>
            Use in Image Gen
          </a>
        </div>
      )}
    </div>
  );
}
