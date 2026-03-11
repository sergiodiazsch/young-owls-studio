"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { VideoGeneration } from "@/lib/types";

import {
  VIDEO_MODELS,
  LIPSYNC_MODELS,
  AVATAR_MODELS,
  type Mode,
  type MultiPromptSegment,
  type ElementImage,
} from "@/components/video-gen/video-gen-models";
import dynamic from "next/dynamic";

const ImageToVideoPanel = dynamic(
  () => import("@/components/video-gen/image-to-video-panel").then((m) => ({ default: m.ImageToVideoPanel })),
  { ssr: false }
);
const LipsyncPanel = dynamic(
  () => import("@/components/video-gen/lipsync-panel").then((m) => ({ default: m.LipsyncPanel })),
  { ssr: false }
);
const AvatarPanel = dynamic(
  () => import("@/components/video-gen/avatar-panel").then((m) => ({ default: m.AvatarPanel })),
  { ssr: false }
);
import { VideoCard } from "@/components/video-gen/video-card";
import { VideoPlayerModal } from "@/components/video-gen/video-player-modal";

type GalleryFilter = "all" | "completed" | "pending" | "failed" | "favorites";

export default function GenerateVideoPage() {
  const params = useParams();
  const projectId = params.id as string;

  const {
    generations,
    loading,
    submit,
    toggleFavorite,
    deleteGeneration,
    retryGeneration,
    promoteToDrive,
  } = useVideoGenerationQueue(projectId);

  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("image-to-video");
  const [model, setModel] = useState("kling-3.0-pro");
  const [lipsyncModel, setLipsyncModel] = useState("kling-lipsync");
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Model params
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [enableAudio, setEnableAudio] = useState(true);
  const [cfgScale, setCfgScale] = useState(0.5);
  const [shotType, setShotType] = useState("__auto__");

  // Source files
  const [sourceImagePath, setSourceImagePath] = useState<string | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(null);
  const [sourceVideoPath, setSourceVideoPath] = useState<string | null>(null);
  const [sourceAudioPath, setSourceAudioPath] = useState<string | null>(null);

  // Elements
  const [elements, setElements] = useState<ElementImage[]>([]);

  // End image
  const [endImagePath, setEndImagePath] = useState<string | null>(null);
  const [endImagePreview, setEndImagePreview] = useState<string | null>(null);

  // Multi-prompt
  const [useMultiPrompt, setUseMultiPrompt] = useState(false);
  const [multiPromptSegments, setMultiPromptSegments] = useState<MultiPromptSegment[]>([
    { prompt: "", duration: 3 },
  ]);

  // Advanced toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Lipsync-specific
  const [syncMode, setSyncMode] = useState("cut_off");
  const [guidanceScale, setGuidanceScale] = useState(1.5);
  const [ttsText, setTtsText] = useState("");
  const [lipsyncPrompt, setLipsyncPrompt] = useState("");

  // Avatar-specific
  const [avatarModel, setAvatarModel] = useState("kling-avatar-v2-pro");
  const [avatarImagePath, setAvatarImagePath] = useState<string | null>(null);
  const [avatarImagePreview, setAvatarImagePreview] = useState<string | null>(null);
  const [avatarAudioPath, setAvatarAudioPath] = useState<string | null>(null);
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [avatarDuration, setAvatarDuration] = useState(5);
  const [avatarAspect, setAvatarAspect] = useState("16:9");
  const [avatarCfgScale, setAvatarCfgScale] = useState(0.5);
  const [avatarImage2Path, setAvatarImage2Path] = useState<string | null>(null);
  const [avatarImage2Preview, setAvatarImage2Preview] = useState<string | null>(null);
  const [avatarAudio2Path, setAvatarAudio2Path] = useState<string | null>(null);
  const [avatarResolution, setAvatarResolution] = useState<string>("720p");
  const [poseStyle, setPoseStyle] = useState(0);
  const [expressionScale, setExpressionScale] = useState(1.0);

  // UI state
  const [playingGen, setPlayingGen] = useState<VideoGeneration | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [gallerySize, setGallerySize] = useGallerySize(3);

  const modelConfig = VIDEO_MODELS.find((m) => m.id === model) || VIDEO_MODELS[0];
  const lipsyncConfig = LIPSYNC_MODELS.find((m) => m.id === lipsyncModel) || LIPSYNC_MODELS[0];
  const avatarConfig = AVATAR_MODELS.find((m) => m.id === avatarModel) || AVATAR_MODELS[0];

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setHasApiKey(data.fal_api_key?.hasValue || false))
      .catch(() => setHasApiKey(false));
  }, []);

  useEffect(() => {
    const cfg = VIDEO_MODELS.find((m) => m.id === model);
    if (cfg && !cfg.durations.includes(duration)) {
      setDuration(cfg.durations[0]);
    }
  }, [model, duration]);

  // Filtered generations
  const filteredGenerations = useMemo(() => {
    switch (filter) {
      case "completed": return generations.filter((g) => g.status === "completed");
      case "pending": return generations.filter((g) => g.status === "submitted" || g.status === "processing");
      case "failed": return generations.filter((g) => g.status === "failed");
      case "favorites": return generations.filter((g) => g.isFavorite);
      default: return generations;
    }
  }, [generations, filter]);

  const pendingCount = generations.filter(
    (g) => g.status === "submitted" || g.status === "processing"
  ).length;

  const completedCount = generations.filter((g) => g.status === "completed").length;
  const failedCount = generations.filter((g) => g.status === "failed").length;
  const favCount = generations.filter((g) => g.isFavorite).length;

  // ── Upload helpers ──

  async function uploadImage(callback: (storagePath: string, previewUrl: string) => void) {
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
        callback(driveFile.storagePath, `/api/drive/files/${driveFile.id}`);
      } catch {
        toast.error("Failed to upload image");
      }
    };
    input.click();
  }

  async function uploadSourceFile(type: "image" | "video" | "audio") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = type === "image" ? "image/*" : type === "video" ? "video/*" : "audio/*";
    input.onchange = async () => {
      if (!input.files?.[0]) return;
      const formData = new FormData();
      formData.append("file", input.files[0]);
      formData.append("projectId", projectId);
      try {
        const res = await fetch("/api/drive/files/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const driveFile = await res.json();
        if (type === "video") {
          setSourceVideoPath(driveFile.storagePath);
          toast.success("Source video uploaded");
        } else {
          setSourceAudioPath(driveFile.storagePath);
          toast.success("Source audio uploaded");
        }
      } catch {
        toast.error(`Failed to upload ${type}`);
      }
    };
    input.click();
  }

  async function uploadAudioFile(callback: (storagePath: string) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = async () => {
      if (!input.files?.[0]) return;
      const formData = new FormData();
      formData.append("file", input.files[0]);
      formData.append("projectId", projectId);
      try {
        const res = await fetch("/api/drive/files/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const driveFile = await res.json();
        callback(driveFile.storagePath);
        toast.success("Audio uploaded");
      } catch {
        toast.error("Failed to upload audio");
      }
    };
    input.click();
  }

  // ── Generate handler ──

  function handleGenerate() {
    if (mode === "image-to-video") {
      if (!sourceImagePath) { toast.error("Upload a source image first"); return; }
      if (!useMultiPrompt && !prompt.trim()) { toast.error("Enter a prompt first"); return; }

      const genParams: Record<string, unknown> = { duration, aspectRatio, enableAudio };
      if (modelConfig.supportsNeg && negativePrompt) genParams.negativePrompt = negativePrompt;
      if (modelConfig.supportsCfgScale) genParams.cfgScale = cfgScale;
      if (modelConfig.supportsEndImage && endImagePath) genParams.endImagePath = endImagePath;
      if (modelConfig.supportsShotType && shotType && shotType !== "__auto__") genParams.shotType = shotType;
      if (modelConfig.supportsElements && elements.length > 0) genParams.elements = elements.map((e) => e.storagePath);
      if (modelConfig.supportsMultiPrompt && useMultiPrompt && multiPromptSegments.length > 0) {
        genParams.multiPrompt = multiPromptSegments.filter((s) => s.prompt.trim());
      }

      submit({
        prompt: useMultiPrompt ? multiPromptSegments.map((s) => s.prompt).join(" | ") : prompt.trim(),
        model, mode: "image-to-video", params: genParams, sourceImagePath,
      });
    } else if (mode === "lipsync") {
      if (!sourceVideoPath) { toast.error("Upload a source video first"); return; }
      if (lipsyncConfig.supportsTTS) {
        if (!ttsText.trim()) { toast.error("Enter text for TTS"); return; }
      } else if (!sourceAudioPath) { toast.error("Upload an audio track first"); return; }

      const genParams: Record<string, unknown> = {};
      if (lipsyncConfig.syncModes) genParams.syncMode = syncMode;
      if (lipsyncConfig.supportsGuidance) genParams.guidanceScale = guidanceScale;
      if (lipsyncConfig.supportsPrompt && lipsyncPrompt) genParams.lipsyncPrompt = lipsyncPrompt;

      submit({
        prompt: lipsyncConfig.supportsTTS ? ttsText.trim() : lipsyncPrompt.trim() || "Lipsync generation",
        model: lipsyncModel, mode: "lipsync", params: genParams,
        sourceVideoPath: sourceVideoPath!, sourceAudioPath: sourceAudioPath || undefined,
        text: lipsyncConfig.supportsTTS ? ttsText.trim() : undefined,
      });
    } else if (mode === "avatar") {
      if (!avatarImagePath) { toast.error("Upload a character image first"); return; }
      if (!avatarAudioPath) { toast.error("Upload an audio track first"); return; }

      const genParams: Record<string, unknown> = {};
      if (avatarConfig.durations) genParams.duration = avatarDuration;
      if (avatarConfig.aspects) genParams.aspectRatio = avatarAspect;
      if (avatarConfig.supportsCfgScale) genParams.cfgScale = avatarCfgScale;
      if (avatarConfig.supportsResolution && avatarResolution) genParams.resolution = avatarResolution;
      if (avatarConfig.maxSpeakers === 2) {
        if (avatarImage2Path) genParams.secondSourceImagePath = avatarImage2Path;
        if (avatarAudio2Path) genParams.secondSourceAudioPath = avatarAudio2Path;
      }
      if (avatarModel === "sadtalker") {
        genParams.poseStyle = poseStyle;
        genParams.expressionScale = expressionScale;
      }

      submit({
        prompt: avatarPrompt.trim() || "Avatar generation",
        model: avatarModel, mode: "avatar", params: genParams,
        sourceImagePath: avatarImagePath, sourceAudioPath: avatarAudioPath,
      });
    }

    // Close panel after generating to show gallery
    setPanelOpen(false);
  }

  if (hasApiKey === false) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Video Generation</h1>
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-16">
            <p className="text-sm text-muted-foreground mb-4">
              Add your fal.ai API key in Settings to start generating videos.
            </p>
            <Button onClick={() => window.location.href = "/settings"}>Go to Settings</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* ── Header bar ── */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="px-4 md:px-6 py-3 flex items-center gap-4">
          {/* Title + stats */}
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap drop-shadow-sm">Video Studio</h1>
            {generations.length > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {completedCount} video{completedCount !== 1 ? "s" : ""}
                {pendingCount > 0 && (
                  <span className="text-primary ml-1.5">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="inline animate-spin mr-0.5 -mt-0.5">
                      <circle cx="8" cy="8" r="6" strokeDasharray="10 20" />
                    </svg>
                    {pendingCount} generating
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 ml-auto">
            {([
              ["all", "All", generations.length],
              ["completed", "Ready", completedCount],
              ["pending", "Generating", pendingCount],
              ["favorites", "Favorites", favCount],
              ["failed", "Failed", failedCount],
            ] as [GalleryFilter, string, number][]).map(([key, label, count]) => (
              count > 0 || key === "all" ? (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all duration-300 ${
                    filter === key
                      ? "bg-primary/15 text-primary shadow-[0_2px_8px_oklch(0.585_0.233_264/0.15)]"
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

          {/* Size control + Create button */}
          <GallerySizeControl value={gallerySize} onChange={setGallerySize} />
          <Button
            onClick={() => setPanelOpen(true)}
            size="sm"
            className="gap-1.5 shrink-0 shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)] hover:shadow-[0_0_25px_oklch(0.585_0.233_264/0.3)] transition-all duration-300"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" />
            </svg>
            <span className="hidden sm:inline">Create</span>
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
            <div className="w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 flex items-center justify-center mb-5 shadow-[0_0_20px_oklch(0.585_0.233_264/0.1)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M10 9l5 3-5 3V9z" />
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
                <h2 className="text-lg font-semibold mb-1">No videos yet</h2>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-5">
                  Create your first video by uploading a source image and writing a prompt
                </p>
                <Button onClick={() => setPanelOpen(true)} className="gap-1.5 shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)] hover:shadow-[0_0_25px_oklch(0.585_0.233_264/0.3)] transition-all duration-300">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  Create Video
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
                onRetry={gen.status === "failed" ? () => retryGeneration(gen.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Creation Panel (Sheet) ── */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0 flex flex-col backdrop-blur-sm bg-card/80 border-border/40">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <SheetTitle>Create Video</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              {/* Mode tabs */}
              <div className="flex rounded-lg border border-border/40 bg-muted/30 backdrop-blur-sm p-0.5" role="tablist">
                {(["image-to-video", "lipsync", "avatar"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-300 ${
                      mode === m
                        ? "bg-primary/15 text-primary shadow-[0_2px_8px_oklch(0.585_0.233_264/0.15)]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "image-to-video" ? "Image to Video" : m === "lipsync" ? "Lipsync" : "Avatar"}
                  </button>
                ))}
              </div>

              {mode === "image-to-video" && (
                <ImageToVideoPanel
                  prompt={prompt} onPromptChange={setPrompt}
                  model={model} onModelChange={setModel} modelConfig={modelConfig}
                  duration={duration} onDurationChange={setDuration}
                  aspectRatio={aspectRatio} onAspectRatioChange={setAspectRatio}
                  enableAudio={enableAudio} onEnableAudioChange={setEnableAudio}
                  cfgScale={cfgScale} onCfgScaleChange={setCfgScale}
                  negativePrompt={negativePrompt} onNegativePromptChange={setNegativePrompt}
                  shotType={shotType} onShotTypeChange={setShotType}
                  sourceImagePreview={sourceImagePreview}
                  onClearSourceImage={() => { setSourceImagePath(null); setSourceImagePreview(null); }}
                  onUploadSourceImage={() => uploadImage((sp, url) => { setSourceImagePath(sp); setSourceImagePreview(url); toast.success("Source image uploaded"); })}
                  endImagePreview={endImagePreview}
                  onClearEndImage={() => { setEndImagePath(null); setEndImagePreview(null); }}
                  onUploadEndImage={() => uploadImage((sp, url) => { setEndImagePath(sp); setEndImagePreview(url); })}
                  elements={elements} onSetElements={setElements}
                  onUploadElement={() => uploadImage((sp, url) => setElements([...elements, { storagePath: sp, previewUrl: url }]))}
                  useMultiPrompt={useMultiPrompt} onUseMultiPromptChange={setUseMultiPrompt}
                  multiPromptSegments={multiPromptSegments} onMultiPromptSegmentsChange={setMultiPromptSegments}
                  showAdvanced={showAdvanced} onShowAdvancedChange={setShowAdvanced}
                />
              )}

              {mode === "lipsync" && (
                <LipsyncPanel
                  lipsyncModel={lipsyncModel} onLipsyncModelChange={setLipsyncModel}
                  lipsyncConfig={lipsyncConfig}
                  sourceVideoPath={sourceVideoPath} onUploadSourceVideo={() => uploadSourceFile("video")}
                  sourceAudioPath={sourceAudioPath} onUploadSourceAudio={() => uploadSourceFile("audio")}
                  ttsText={ttsText} onTtsTextChange={setTtsText}
                  syncMode={syncMode} onSyncModeChange={setSyncMode}
                  guidanceScale={guidanceScale} onGuidanceScaleChange={setGuidanceScale}
                  lipsyncPrompt={lipsyncPrompt} onLipsyncPromptChange={setLipsyncPrompt}
                />
              )}

              {mode === "avatar" && (
                <AvatarPanel
                  avatarModel={avatarModel} onAvatarModelChange={setAvatarModel}
                  avatarConfig={avatarConfig}
                  avatarImagePreview={avatarImagePreview}
                  onClearAvatarImage={() => { setAvatarImagePath(null); setAvatarImagePreview(null); }}
                  onUploadAvatarImage={() => uploadImage((sp, url) => { setAvatarImagePath(sp); setAvatarImagePreview(url); toast.success("Character image uploaded"); })}
                  avatarAudioPath={avatarAudioPath}
                  onUploadAvatarAudio={() => uploadAudioFile((sp) => setAvatarAudioPath(sp))}
                  avatarPrompt={avatarPrompt} onAvatarPromptChange={setAvatarPrompt}
                  avatarDuration={avatarDuration} onAvatarDurationChange={setAvatarDuration}
                  avatarAspect={avatarAspect} onAvatarAspectChange={setAvatarAspect}
                  avatarCfgScale={avatarCfgScale} onAvatarCfgScaleChange={setAvatarCfgScale}
                  avatarResolution={avatarResolution} onAvatarResolutionChange={setAvatarResolution}
                  poseStyle={poseStyle} onPoseStyleChange={setPoseStyle}
                  expressionScale={expressionScale} onExpressionScaleChange={setExpressionScale}
                  avatarImage2Preview={avatarImage2Preview}
                  onClearAvatarImage2={() => { setAvatarImage2Path(null); setAvatarImage2Preview(null); }}
                  onUploadAvatarImage2={() => uploadImage((sp, url) => { setAvatarImage2Path(sp); setAvatarImage2Preview(url); })}
                  avatarAudio2Path={avatarAudio2Path}
                  onUploadAvatarAudio2={() => uploadAudioFile((sp) => setAvatarAudio2Path(sp))}
                />
              )}
            </div>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur-sm px-6 py-4 space-y-2">
            {pendingCount > 0 && (
              <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-primary/10 border border-primary/20 shadow-[0_0_12px_oklch(0.585_0.233_264/0.15)] animate-pulse">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-primary">
                  <circle cx="8" cy="8" r="6" strokeDasharray="10 20" />
                </svg>
                <span className="text-xs text-primary font-medium">{pendingCount} video{pendingCount > 1 ? "s" : ""} generating</span>
              </div>
            )}
            <Button
              className="w-full shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)] hover:shadow-[0_0_25px_oklch(0.585_0.233_264/0.3)] transition-all duration-300 disabled:shadow-none"
              size="lg"
              onClick={handleGenerate}
              disabled={
                (mode === "image-to-video" && (!sourceImagePath || (!prompt.trim() && !useMultiPrompt))) ||
                (mode === "lipsync" && (
                  !sourceVideoPath ||
                  (!sourceAudioPath && !lipsyncConfig.supportsTTS) ||
                  (lipsyncConfig.supportsTTS && !ttsText.trim())
                )) ||
                (mode === "avatar" && (!avatarImagePath || !avatarAudioPath))
              }
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                <path d="M4 2l10 6-10 6V2z" />
              </svg>
              Generate Video
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Cost: ~{mode === "lipsync" ? lipsyncConfig.cost : mode === "avatar" ? avatarConfig.cost : modelConfig.cost} per video
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Video player modal ── */}
      <VideoPlayerModal
        gen={playingGen}
        open={!!playingGen}
        onClose={() => setPlayingGen(null)}
        onReuse={(g) => {
          setPrompt(g.prompt);
          const p = g.params ? (() => { try { return JSON.parse(g.params!); } catch { return {}; } })() : {};
          if (g.mode === "image-to-video") {
            setMode("image-to-video");
            setModel(g.model);
            if (p.duration) setDuration(p.duration);
            if (p.aspectRatio) setAspectRatio(p.aspectRatio);
            if (p.enableAudio != null) setEnableAudio(p.enableAudio);
            if (p.cfgScale != null) setCfgScale(p.cfgScale);
            if (p.negativePrompt) setNegativePrompt(p.negativePrompt);
            if (p.shotType) setShotType(p.shotType);
          } else if (g.mode === "lipsync") {
            setMode("lipsync");
            setLipsyncModel(g.model);
          } else if (g.mode === "avatar") {
            setMode("avatar");
            setAvatarModel(g.model);
            setAvatarPrompt(g.prompt);
          }
          setPanelOpen(true);
          toast.success("Prompt and settings loaded");
        }}
        onRegenerate={(g) => {
          const p = g.params ? (() => { try { return JSON.parse(g.params!); } catch { return {}; } })() : {};
          const { _falResponseUrl, _falStatusUrl, ...cleanParams } = p;
          submit({
            prompt: g.prompt,
            model: g.model,
            mode: g.mode as "image-to-video" | "lipsync" | "avatar" | "upscale" | "fps-boost",
            params: cleanParams,
            sourceImagePath: g.sourceImagePath || undefined,
            sourceVideoPath: g.sourceVideoPath || undefined,
            sourceAudioPath: g.sourceAudioPath || undefined,
          });
          toast.success("Regenerating video...");
        }}
        onFavorite={toggleFavorite}
        onSave={promoteToDrive}
        onDelete={deleteGeneration}
        onGrabFrame={async (dataUrl) => {
          try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const formData = new FormData();
            formData.append("file", blob, `frame-${Date.now()}.png`);
            formData.append("projectId", projectId);
            const uploadRes = await fetch("/api/drive/files/upload", { method: "POST", body: formData });
            if (!uploadRes.ok) throw new Error("Upload failed");
            const driveFile = await uploadRes.json();
            setSourceImagePath(driveFile.storagePath);
            setSourceImagePreview(`/api/drive/files/${driveFile.id}`);
            setMode("image-to-video");
            setPanelOpen(true);
            toast.success("Frame set as source image");
          } catch {
            toast.error("Failed to set frame as source");
          }
        }}
      />
    </div>
  );
}
