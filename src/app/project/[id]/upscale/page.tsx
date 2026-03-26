"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { useVideoGenerationQueue } from "@/hooks/use-video-generation-queue";
import { useGallerySize, GRID_COLS } from "@/hooks/use-gallery-size";
import { GallerySizeControl } from "@/components/gallery-size-control";
import { VideoCard } from "@/components/video-gen/video-card";
import { VideoPlayerModal } from "@/components/video-gen/video-player-modal";
import type { VideoGeneration } from "@/lib/types";

const UPSCALE_MODELS = [
  { id: "topaz-upscale", name: "Topaz Upscale", cost: "~$0.10/s", maxScale: 4, supportsFps: true, maxFps: 120, features: "1-4x scale, up to 8K, FPS up to 120" },
  { id: "topaz-4x-gen", name: "Topaz 4x Generative", cost: "~$0.15/s", maxScale: 4, supportsFps: false, maxFps: 0, features: "AI-enhanced 4x upscale" },
];

type GalleryFilter = "all" | "completed" | "pending" | "failed" | "favorites";

export default function UpscalePage() {
  const params = useParams();
  const projectId = params.id as string;

  const {
    generations,
    loading,
    submit,
    toggleFavorite,
    deleteGeneration,
    promoteToDrive,
  } = useVideoGenerationQueue(projectId);

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [sourceVideoPath, setSourceVideoPath] = useState<string | null>(null);
  const [sourceVideoName, setSourceVideoName] = useState<string | null>(null);
  const [model, setModel] = useState("topaz-upscale");
  const [scale, setScale] = useState(2);
  const [targetFps, setTargetFps] = useState(0);

  const [playingGen, setPlayingGen] = useState<VideoGeneration | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [gallerySize, setGallerySize] = useGallerySize(3);

  const modelConfig = UPSCALE_MODELS.find((m) => m.id === model) || UPSCALE_MODELS[0];

  // Filter to show only upscale/fps-boost generations
  const upscaleGenerations = generations.filter((g) => g.mode === "upscale" || g.mode === "fps-boost");

  const filteredGenerations = useMemo(() => {
    switch (filter) {
      case "completed": return upscaleGenerations.filter((g) => g.status === "completed");
      case "pending": return upscaleGenerations.filter((g) => g.status === "submitted" || g.status === "processing");
      case "failed": return upscaleGenerations.filter((g) => g.status === "failed");
      case "favorites": return upscaleGenerations.filter((g) => g.isFavorite);
      default: return upscaleGenerations;
    }
  }, [upscaleGenerations, filter]);

  const completedCount = upscaleGenerations.filter((g) => g.status === "completed").length;
  const pendingCount = upscaleGenerations.filter((g) => g.status === "submitted" || g.status === "processing").length;
  const failedCount = upscaleGenerations.filter((g) => g.status === "failed").length;
  const favCount = upscaleGenerations.filter((g) => g.isFavorite).length;

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setHasApiKey(data.fal_api_key?.hasValue || false))
      .catch(() => setHasApiKey(false));
  }, []);

  async function uploadVideo() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = async () => {
      if (!input.files?.[0]) return;
      const file = input.files[0];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      try {
        const res = await fetch("/api/drive/files/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const driveFile = await res.json();
        setSourceVideoPath(driveFile.storagePath);
        setSourceVideoName(file.name);
        toast.success("Video uploaded");
      } catch {
        toast.error("Failed to upload video");
      }
    };
    input.click();
  }

  function handleSubmit() {
    if (!sourceVideoPath) {
      toast.error("Upload a video first");
      return;
    }

    const mode = (targetFps > 0 && scale <= 1) ? "fps-boost" : "upscale";

    submit({
      prompt: mode === "upscale" ? `${scale}x upscale` : `FPS boost to ${targetFps}`,
      model,
      mode: mode as "upscale" | "fps-boost",
      sourceVideoPath,
      params: {
        scale,
        targetFps: targetFps || undefined,
      },
    });

    setPanelOpen(false);
  }

  if (hasApiKey === false) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4">
        <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-destructive">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-1">API Key Required</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-5">
          Add your fal.ai API key in Settings to start upscaling videos.
        </p>
        <Button onClick={() => window.location.href = "/settings"}>Go to Settings</Button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* ── Header bar ── */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="px-4 md:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap drop-shadow-sm">Video Upscale & FPS</h1>
            {upscaleGenerations.length > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {completedCount} video{completedCount !== 1 ? "s" : ""}
                {pendingCount > 0 && (
                  <span className="text-primary ml-1.5">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="inline animate-spin mr-0.5 -mt-0.5">
                      <circle cx="8" cy="8" r="6" strokeDasharray="10 20" />
                    </svg>
                    {pendingCount} processing
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 ml-auto">
            {([
              ["all", "All", upscaleGenerations.length],
              ["completed", "Ready", completedCount],
              ["pending", "Processing", pendingCount],
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
            <span className="hidden sm:inline">Upscale</span>
          </Button>
        </div>
      </div>

      {/* ── Gallery ── */}
      <div className="p-4 md:p-6">
        {loading ? (
          <div className={`grid gap-4 ${GRID_COLS.video[gallerySize]}`}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-video rounded-xl" />
            ))}
          </div>
        ) : filteredGenerations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 flex items-center justify-center mb-5 shadow-[0_0_20px_var(--glow-primary)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M7 14l3-3 2 2 4-4" />
              </svg>
            </div>
            {filter !== "all" ? (
              <>
                <h2 className="text-lg font-semibold mb-1">No results</h2>
                <p className="text-sm text-muted-foreground mb-4">No videos match this filter</p>
                <Button variant="outline" size="sm" onClick={() => setFilter("all")}>Show all</Button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-1">No upscaled videos yet</h2>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-5">
                  Upload a video to upscale its resolution or boost its frame rate
                </p>
                <Button onClick={() => setPanelOpen(true)} className="gap-1.5 shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-all duration-300">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  Upscale Video
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className={`grid gap-4 ${GRID_COLS.video[gallerySize]}`}>
            {filteredGenerations.map((gen) => (
              <VideoCard
                key={gen.id}
                gen={gen}
                onPlay={() => setPlayingGen(gen)}
                onFavorite={() => toggleFavorite(gen.id)}
                onSave={() => promoteToDrive(gen.id)}
                onDelete={() => deleteGeneration(gen.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Creation Panel (Sheet) ── */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-[380px] sm:max-w-[380px] p-0 flex flex-col backdrop-blur-sm bg-card/80 border-border/40">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <SheetTitle>Upscale Video</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
            {/* Source video */}
            <div className="space-y-2">
              <Label>Source Video <span className="text-destructive">*</span></Label>
              <Button
                variant={sourceVideoPath ? "secondary" : "outline"}
                className={`w-full h-14 border-dashed transition-all duration-300 ${sourceVideoPath ? "shadow-sm" : "hover:shadow-md"}`}
                onClick={uploadVideo}
              >
                {sourceVideoPath ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-primary">
                      <path d="M13.5 6.5L6 14l-3.5-3.5" />
                    </svg>
                    <span className="truncate text-sm">{sourceVideoName || "Video uploaded"}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                      <path d="M8 10V2M8 2L5 5M8 2L11 5" />
                      <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
                    </svg>
                    <span className="text-xs text-muted-foreground">Upload Video</span>
                  </div>
                )}
              </Button>
            </div>

            {/* Model selector */}
            <div className="space-y-2">
              <Label>Upscale Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UPSCALE_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground ml-2">{m.cost}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">{modelConfig.features}</p>
            </div>

            {/* Scale factor */}
            <div className="space-y-2">
              <Label>Scale Factor</Label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].filter((s) => s <= modelConfig.maxScale).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`flex-1 py-2 text-xs font-medium rounded-md border transition-all duration-300 ${
                      scale === s
                        ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_var(--glow-primary)]"
                        : "bg-background hover:bg-accent border-border hover:-translate-y-0.5 hover:shadow-md"
                    }`}
                  >
                    {s === 1 ? "1x (FPS)" : `${s}x`}
                  </button>
                ))}
              </div>
            </div>

            {/* Target FPS */}
            {modelConfig.supportsFps && (
              <div className="space-y-2">
                <Label>Target FPS</Label>
                <div className="flex gap-1.5">
                  {[0, 60, 90, 120].filter((f) => f <= modelConfig.maxFps || f === 0).map((f) => (
                    <button
                      key={f}
                      onClick={() => setTargetFps(f)}
                      className={`flex-1 py-2 text-xs font-medium rounded-md border transition-all duration-300 ${
                        targetFps === f
                          ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_var(--glow-primary)]"
                          : "bg-background hover:bg-accent border-border hover:-translate-y-0.5 hover:shadow-md"
                      }`}
                    >
                      {f === 0 ? "Original" : `${f}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            </div>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur-sm px-6 py-4 space-y-2">
            <Button
              className="w-full shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-all duration-300 disabled:shadow-none"
              size="lg"
              onClick={handleSubmit}
              disabled={!sourceVideoPath || (scale <= 1 && targetFps === 0)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                <path d="M2 2l6 6M8 2l6 6M2 8l6 6M8 8l6 6" />
              </svg>
              {scale > 1 && targetFps > 0 ? `${scale}x Upscale + ${targetFps} FPS` :
               scale > 1 ? `${scale}x Upscale` : `Boost to ${targetFps} FPS`}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Cost: {modelConfig.cost} of video
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Video player modal ── */}
      <VideoPlayerModal
        gen={playingGen}
        open={!!playingGen}
        onClose={() => setPlayingGen(null)}
        onReuse={() => {
          setPanelOpen(true);
        }}
        onRegenerate={(g) => {
          const p = g.params ? (() => { try { return JSON.parse(g.params!); } catch { return {}; } })() : {};
          const { _falResponseUrl, _falStatusUrl, ...cleanParams } = p;
          submit({
            prompt: g.prompt,
            model: g.model,
            mode: g.mode as "upscale" | "fps-boost",
            params: cleanParams,
            sourceVideoPath: g.sourceVideoPath || undefined,
          });
          toast.success("Regenerating...");
        }}
        onFavorite={toggleFavorite}
        onSave={promoteToDrive}
        onDelete={deleteGeneration}
      />
    </div>
  );
}
