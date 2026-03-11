"use client";

import { useState, useRef, useCallback, useMemo, useEffect, memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { ImageGeneration, DriveFolder, Scene } from "@/lib/types";
import type { GallerySize } from "@/hooks/use-gallery-size";
import { GRID_COLS } from "@/hooks/use-gallery-size";
import { IMAGE_MODELS } from "@/components/image-gen-model-selector";
import { toast } from "sonner";

type FilterTab = "recent" | "favorites" | "all";

const NONE_VALUE = "__none__";

/** Map raw API error strings to user-friendly messages */
function friendlyError(raw: string | undefined | null): { message: string; technical: string | null } {
  if (!raw) return { message: "Generation failed unexpectedly.", technical: null };
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("429"))
    return { message: "Too many requests -- please wait a moment and try again.", technical: raw };
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("deadline"))
    return { message: "The generation timed out. Try a simpler prompt or smaller resolution.", technical: raw };
  if (lower.includes("content policy") || lower.includes("safety") || lower.includes("nsfw") || lower.includes("moderation"))
    return { message: "Your prompt was flagged by the content policy. Try rephrasing.", technical: raw };
  if (lower.includes("invalid") && lower.includes("key"))
    return { message: "API key is invalid or expired. Check your settings.", technical: raw };
  if (lower.includes("quota") || lower.includes("billing") || lower.includes("insufficient"))
    return { message: "Account quota exceeded. Check your fal.ai billing.", technical: raw };
  if (lower.includes("model") && (lower.includes("not found") || lower.includes("unavailable")))
    return { message: "This model is temporarily unavailable. Try a different model.", technical: raw };
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("econnrefused"))
    return { message: "Network error -- check your connection and try again.", technical: raw };
  if (raw.length > 120)
    return { message: "Generation failed. Expand details below for more info.", technical: raw };
  return { message: raw, technical: null };
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getModelName(modelId: string): string {
  const found = IMAGE_MODELS.find((m) => m.id === modelId);
  return found ? found.name : modelId;
}

interface Props {
  generations: ImageGeneration[];
  loading: boolean;
  projectId: string;
  onToggleFavorite: (id: number) => void;
  onDelete: (id: number) => void;
  onPromoteToDrive: (id: number, folderId?: number, sceneId?: number) => void;
  onInpaint?: (gen: ImageGeneration) => void;
  gridSize?: GallerySize;
}

export function ImageGenResultsGrid({
  generations,
  loading,
  projectId,
  onToggleFavorite,
  onDelete,
  onPromoteToDrive,
  onInpaint,
  gridSize = 3,
}: Props) {
  const [filter, setFilter] = useState<FilterTab>("recent");
  const [lightboxGen, setLightboxGen] = useState<ImageGeneration | null>(null);

  // Save to drive dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveGenId, setSaveGenId] = useState<number | null>(null);
  const [saveFolderId, setSaveFolderId] = useState<string>(NONE_VALUE);
  const [saveSceneId, setSaveSceneId] = useState<string>(NONE_VALUE);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [saving, setSaving] = useState(false);

  // Quick link-to-scene dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkGenId, setLinkGenId] = useState<number | null>(null);
  const [linkSceneId, setLinkSceneId] = useState<string>(NONE_VALUE);
  const [linking, setLinking] = useState(false);

  // Filter generations
  const filtered = useMemo(() => generations.filter((g) => {
    if (filter === "favorites") return g.isFavorite;
    return true;
  }), [generations, filter]);

  // Group by batch
  const { batches, standalone } = useMemo(() => {
    const batchMap = new Map<string, ImageGeneration[]>();
    const standaloneList: ImageGeneration[] = [];
    for (const g of filtered) {
      if (g.batchId) {
        if (!batchMap.has(g.batchId)) batchMap.set(g.batchId, []);
        batchMap.get(g.batchId)!.push(g);
      } else {
        standaloneList.push(g);
      }
    }
    return { batches: batchMap, standalone: standaloneList };
  }, [filtered]);

  async function openSaveDialog(genId: number) {
    setSaveGenId(genId);
    setSaveFolderId(NONE_VALUE);
    setSaveSceneId(NONE_VALUE);

    const [folderRes, sceneRes] = await Promise.all([
      fetch(`/api/drive/folders?projectId=${projectId}`),
      fetch(`/api/scenes?projectId=${projectId}`),
    ]);

    setFolders(await folderRes.json());
    setScenes(await sceneRes.json());
    setSaveDialogOpen(true);
  }

  async function handleSave() {
    if (!saveGenId) return;
    setSaving(true);
    await onPromoteToDrive(
      saveGenId,
      saveFolderId !== NONE_VALUE ? Number(saveFolderId) : undefined,
      saveSceneId !== NONE_VALUE ? Number(saveSceneId) : undefined
    );
    setSaving(false);
    setSaveDialogOpen(false);
  }

  async function openLinkDialog(genId: number) {
    setLinkGenId(genId);
    setLinkSceneId(NONE_VALUE);
    if (scenes.length === 0) {
      const sceneRes = await fetch(`/api/scenes?projectId=${projectId}`);
      setScenes(await sceneRes.json());
    }
    setLinkDialogOpen(true);
  }

  async function handleLink() {
    if (!linkGenId || linkSceneId === NONE_VALUE) return;
    setLinking(true);
    try {
      // Save to Drive first (auto-creates drive file + scene link)
      await onPromoteToDrive(linkGenId, undefined, Number(linkSceneId));
      toast.success("Linked to scene");
    } catch {
      toast.error("Failed to link to scene");
    }
    setLinking(false);
    setLinkDialogOpen(false);
  }

  function imageUrl(gen: ImageGeneration) {
    if (gen.id > 0 && gen.storagePath) {
      return `/api/generate/image/generations/${gen.id}`;
    }
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card overflow-hidden shadow-theme" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="p-3 space-y-2">
              <div className="flex gap-2">
                <div data-slot="skeleton" className="h-5 w-20 rounded-full bg-muted animate-pulse" />
                <div data-slot="skeleton" className="h-5 w-16 rounded bg-muted animate-pulse" />
              </div>
              <div data-slot="skeleton" className="h-32 w-full rounded-md bg-muted animate-pulse" />
              <div data-slot="skeleton" className="h-3 w-2/3 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4" role="tablist" aria-label="Filter generated images">
        {(["recent", "favorites", "all"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={filter === tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 press-scale ${
              filter === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab === "recent" ? "Recent" : tab === "favorites" ? "Favorites" : "All"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
              <rect x="1" y="1" width="14" height="14" rx="2" />
              <circle cx="5" cy="5" r="1.5" />
              <path d="M1 11l4-4 3 3 2-2 5 5" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            {filter === "favorites" ? "No favorites yet" : "Generated images will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Batch groups */}
          {Array.from(batches.entries()).map(([batchId, items]) => (
            <div key={batchId} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-medium text-muted-foreground">Camera Angles Batch</span>
                <span className="text-[10px] text-muted-foreground/60 line-clamp-1">{items[0]?.prompt}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {items.map((gen) => (
                  <ImageCard
                    key={gen.id}
                    gen={gen}
                    imageUrl={imageUrl(gen)}
                    onClick={() => gen.status === "completed" && setLightboxGen(gen)}
                    onFavorite={() => onToggleFavorite(gen.id)}
                    onSave={() => openSaveDialog(gen.id)}
                    onLink={() => openLinkDialog(gen.id)}
                    onDelete={() => onDelete(gen.id)}
                    compact
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Standalone images -- VideoCard-style grid */}
          <div className={`grid gap-4 ${GRID_COLS.image[gridSize]}`}>
            {standalone.map((gen) => (
              <ImageCard
                key={gen.id}
                gen={gen}
                imageUrl={imageUrl(gen)}
                onClick={() => gen.status === "completed" && setLightboxGen(gen)}
                onFavorite={() => onToggleFavorite(gen.id)}
                onSave={() => openSaveDialog(gen.id)}
                onLink={() => openLinkDialog(gen.id)}
                onDelete={() => onDelete(gen.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Full-screen Lightbox (matches VideoPlayerModal) */}
      <ImageLightbox
        gen={lightboxGen}
        open={!!lightboxGen}
        onClose={() => setLightboxGen(null)}
        imageUrl={lightboxGen ? imageUrl(lightboxGen) : null}
        onFavorite={onToggleFavorite}
        onSave={(id) => { setLightboxGen(null); openSaveDialog(id); }}
        onLink={(id) => { setLightboxGen(null); openLinkDialog(id); }}
        onDelete={(id) => { onDelete(id); setLightboxGen(null); }}
        onInpaint={onInpaint ? (gen) => { setLightboxGen(null); onInpaint(gen); } : undefined}
      />

      {/* Save to Drive Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to Asset Drive</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Destination folder</Label>
              <Select value={saveFolderId} onValueChange={setSaveFolderId}>
                <SelectTrigger><SelectValue placeholder="Root (no folder)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Root</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Link to scene (optional)</Label>
              <Select value={saveSceneId} onValueChange={setSaveSceneId}>
                <SelectTrigger><SelectValue placeholder="No scene" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {scenes.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      Sc. {s.sceneNumber} — {s.heading}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save to Drive"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Link to Scene Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link to Scene</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Select a scene to link this image. It will be saved to Drive and linked automatically.
            </p>
            <Select value={linkSceneId} onValueChange={setLinkSceneId}>
              <SelectTrigger><SelectValue placeholder="Select scene…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE} disabled>Select scene…</SelectItem>
                {scenes.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    Sc. {s.sceneNumber} — {s.heading}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleLink} disabled={linking || linkSceneId === NONE_VALUE} className="w-full">
              {linking ? "Linking..." : "Link to Scene"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── ImageCard (matches VideoCard design) ──

const ImageCard = memo(function ImageCard({
  gen,
  imageUrl,
  onClick,
  onFavorite,
  onSave,
  onLink,
  onDelete,
  compact,
}: {
  gen: ImageGeneration;
  imageUrl: string | null;
  onClick: () => void;
  onFavorite: () => void;
  onSave: () => void;
  onLink: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const isReady = gen.status === "completed";
  const isFailed = gen.status === "failed";
  const isGenerating = gen.status === "generating";
  const isQueued = gen.status === "queued";
  const [hovered, setHovered] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  return (
    <div
      className="group relative rounded-xl overflow-hidden bg-black/40 dark:bg-white/[0.03] border border-transparent hover:border-white/[0.08] transition-all duration-300 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={isReady ? onClick : undefined}
    >
      {/* Thumbnail area */}
      <div className={`relative ${compact ? "aspect-square" : "aspect-square"} bg-black/60 overflow-hidden`}>
        {isReady && imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={gen.prompt ? `Generated: ${gen.prompt.slice(0, 80)}` : "Generated image"}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        )}

        {/* Generating state */}
        {isGenerating && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-black/60 to-primary/[0.05]" />
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg animate-pulse" />
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="relative animate-spin">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" className="text-white/[0.08]" />
                  <path d="M44 24a20 20 0 00-20-20" stroke="url(#img-spinner-grad)" strokeWidth="2" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="img-spinner-grad" x1="44" y1="24" x2="24" y2="4">
                      <stop stopColor="hsl(var(--primary))" />
                      <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="text-[10px] text-white/40 font-medium uppercase tracking-[0.15em]">
                Generating
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/40 to-transparent">
              <p className="text-[11px] text-white/30 line-clamp-1">{gen.prompt}</p>
            </div>
          </>
        )}

        {/* Queued state */}
        {isQueued && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-muted/20 via-black/50 to-muted/10" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.06]">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                <span className="text-[10px] text-white/40 font-medium uppercase tracking-[0.15em]">
                  In queue
                </span>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/40 to-transparent">
              <p className="text-[11px] text-white/30 line-clamp-1">{gen.prompt}</p>
            </div>
          </>
        )}

        {/* Failed state */}
        {isFailed && (() => {
          const { message, technical } = friendlyError(gen.error);
          return (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 bg-gradient-to-b from-red-950/20 to-background/40">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400/80">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <span className="text-[11px] text-red-300/80 text-center leading-relaxed line-clamp-2">
                {message}
              </span>
              {technical && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowTechnicalDetails(!showTechnicalDetails); }}
                  className="text-[9px] text-white/30 hover:text-white/50 transition-colors"
                >
                  {showTechnicalDetails ? "Hide" : "Technical"} details
                </button>
              )}
              {showTechnicalDetails && technical && (
                <p className="text-[9px] text-white/25 text-center leading-relaxed line-clamp-3 font-mono break-all max-w-full">
                  {technical}
                </p>
              )}
            </div>
          );
        })()}

        {/* Hover overlay -- zoom icon */}
        {isReady && (
          <div className={`absolute inset-0 transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-[0_0_24px_rgba(255,255,255,0.1)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><path d="M11 8v6M8 11h6" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Top-left: favorite */}
        {gen.isFavorite && (
          <div className="absolute top-2 left-2 z-10">
            <div className="w-6 h-6 rounded-full bg-primary/90 flex items-center justify-center shadow-sm">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="white">
                <path d="M8 1l2.24 4.55 5.01.73-3.63 3.54.86 5L8 12.27 3.52 14.82l.86-5L.75 6.28l5.01-.73z" />
              </svg>
            </div>
          </div>
        )}

        {/* Top-right: model badge */}
        {!compact && (
          <div className={`absolute top-2 right-2 z-10 transition-opacity duration-200 ${hovered ? "opacity-100" : "opacity-70"}`}>
            <span className="text-[10px] font-medium text-white bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
              {getModelName(gen.model)}
            </span>
          </div>
        )}

        {/* Batch label for compact cards */}
        {compact && gen.batchLabel && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 text-center z-10">
            {gen.batchLabel}
          </div>
        )}

        {/* Bottom hover overlay -- prompt + meta + actions */}
        {!compact && (
          <div className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/70 to-transparent transition-all duration-300 ${hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"}`}>
            {isReady && (
              <div className="px-3 pt-4 pb-1.5">
                <p className="text-[11px] text-white/90 line-clamp-2 leading-relaxed">{gen.prompt}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-white/50">{formatRelative(gen.createdAt)}</span>
                  {gen.seed != null && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(String(gen.seed)); toast.success("Seed copied"); }}
                      className="text-[10px] text-white/40 hover:text-white/70 font-mono flex items-center gap-0.5 transition-colors"
                      title="Click to copy seed"
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
                      </svg>
                      Seed: {gen.seed}
                    </button>
                  )}
                  {gen.driveFileId && (
                    <span className="text-[10px] text-primary/80 flex items-center gap-0.5">
                      <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13.5 6.5L6 14l-3.5-3.5" />
                      </svg>
                      Saved
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-0.5 px-2 py-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); onFavorite(); }}
                className={`p-1.5 rounded-md transition-colors ${gen.isFavorite ? "text-primary" : "text-white/50 hover:text-white/80"}`}
                title="Favorite"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill={gen.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 1l2.24 4.55 5.01.73-3.63 3.54.86 5L8 12.27 3.52 14.82l.86-5L.75 6.28l5.01-.73z" />
                </svg>
              </button>
              {isReady && !gen.driveFileId && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSave(); }}
                  className="p-1.5 rounded-md text-white/50 hover:text-white/80 transition-colors"
                  title="Save to Drive"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
                  </svg>
                </button>
              )}
              {isReady && (
                <button
                  onClick={(e) => { e.stopPropagation(); onLink(); }}
                  className="p-1.5 rounded-md text-white/50 hover:text-white/80 transition-colors"
                  title="Link to Scene"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6.5 9.5l3-3M5.5 7L4 8.5a2.12 2.12 0 003 3L8.5 10M10.5 9l1.5-1.5a2.12 2.12 0 00-3-3L7.5 6" />
                  </svg>
                </button>
              )}
              {isReady && imageUrl && (
                <a
                  href={imageUrl}
                  download={`image-${gen.id}.png`}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-md text-white/50 hover:text-white/80 transition-colors"
                  title="Download"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 2v8M8 10L5 7M8 10L11 7" /><path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
                  </svg>
                </a>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1.5 rounded-md text-white/50 hover:text-red-400/80 transition-colors ml-auto"
                title="Delete"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ── ImageLightbox (matches VideoPlayerModal design) ──

function ImageLightbox({
  gen,
  open,
  onClose,
  imageUrl,
  onFavorite,
  onSave,
  onLink,
  onDelete,
  onInpaint,
}: {
  gen: ImageGeneration | null;
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
  onFavorite: (id: number) => void;
  onSave: (id: number) => void;
  onLink: (id: number) => void;
  onDelete: (id: number) => void;
  onInpaint?: (gen: ImageGeneration) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanningState, setIsPanningState] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Reset zoom when gen changes
  useEffect(() => {
    if (gen) {
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [gen?.id]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  // Zoom via wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(5, Math.max(0.5, z - e.deltaY * 0.002)));
  }, []);

  // Pan
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (zoom <= 1) return;
    isPanning.current = true;
    setIsPanningState(true);
    panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [zoom, panOffset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
    setIsPanningState(false);
  }, []);

  function handleCopyPrompt() {
    if (!gen) return;
    navigator.clipboard.writeText(gen.prompt);
    toast.success("Prompt copied");
  }

  function handleDownload() {
    if (!gen || !imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `image-${gen.id}.png`;
    a.click();
  }

  function handleDelete() {
    if (!gen) return;
    onDelete(gen.id);
  }

  if (!gen || !open) return null;

  const params = gen.params ? (() => { try { return JSON.parse(gen.params!); } catch { return {}; } })() : {};
  const isReady = gen.status === "completed" && imageUrl;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm animate-in fade-in-0 duration-300"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative w-full h-full flex animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        {/* Left: Image area */}
        <div className="flex-1 relative select-none bg-black">
          {isReady ? (
            <div
              className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <div className="w-full h-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={gen.prompt ? `Generated: ${gen.prompt.slice(0, 120)}` : "Generated image"}
                  className="max-w-full max-h-full object-contain select-none"
                  draggable={false}
                  style={{
                    transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                    transformOrigin: "center center",
                    transition: isPanningState ? "none" : "transform 0.15s ease-out",
                  }}
                />
              </div>
            </div>
          ) : gen.status === "failed" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400/70">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <p className="text-sm text-white/60 text-center max-w-xs leading-relaxed">
                {friendlyError(gen.error).message}
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="animate-spin">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" className="text-white/10" />
                  <path d="M44 24a20 20 0 00-20-20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary" />
                </svg>
              </div>
              <p className="text-sm text-white/50 capitalize">{gen.status}...</p>
            </div>
          )}

          {/* Zoom controls (bottom-left) */}
          {isReady && (
            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="text-white/70 hover:text-white transition-colors px-1"
                aria-label="Zoom out"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><path d="M8 11h6" />
                </svg>
              </button>
              <button
                onClick={resetZoom}
                className="text-[11px] text-white/60 hover:text-white font-mono min-w-[3rem] text-center transition-colors"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
                className="text-white/70 hover:text-white transition-colors px-1"
                aria-label="Zoom in"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><path d="M11 8v6M8 11h6" />
                </svg>
              </button>
            </div>
          )}

          {/* Close button (top-left) */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 flex items-center justify-center transition-colors border border-white/10"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Right: Details sidebar */}
        <div
          data-sidebar
          className="w-[340px] h-full bg-card border-l border-white/[0.06] flex flex-col overflow-y-auto animate-in slide-in-from-right-4 duration-300"
        >
          {/* Header */}
          <div className="p-5 border-b border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-[10px] font-medium">
                {getModelName(gen.model)}
              </Badge>
              {gen.status === "completed" && (
                <Badge variant="outline" className="text-[10px]">
                  Completed
                </Badge>
              )}
              {gen.status === "failed" && (
                <Badge variant="destructive" className="text-[10px]">
                  Failed
                </Badge>
              )}
              {(gen.status === "generating" || gen.status === "queued") && (
                <Badge variant="default" className="text-[10px]">
                  {gen.status === "generating" ? "Generating" : "Queued"}
                </Badge>
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground">{gen.prompt}</p>
          </div>

          {/* Metadata */}
          <div className="p-5 border-b border-border/50 space-y-2.5">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Details</h3>
            <MetaRow label="Created" value={formatDate(gen.createdAt)} />
            {gen.fileSize > 0 && <MetaRow label="File size" value={formatBytes(gen.fileSize)} />}
            {params.resolution && <MetaRow label="Resolution" value={params.resolution} />}
            {params.aspectRatio && <MetaRow label="Aspect ratio" value={params.aspectRatio.replace(/_/g, " ")} />}
            {gen.seed != null && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Seed</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(String(gen.seed)); toast.success("Seed copied"); }}
                  className="text-[11px] font-mono text-foreground hover:text-primary flex items-center gap-1 transition-colors"
                  title="Click to copy"
                >
                  {gen.seed}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
              </div>
            )}
            {gen.cost != null && gen.cost > 0 && <MetaRow label="Cost" value={`$${gen.cost.toFixed(3)}`} />}
            {params.enableWebSearch && <MetaRow label="Web search" value="Enabled" />}
            {params.enhancePrompt && <MetaRow label="Enhanced prompt" value="Yes" />}
            {gen.batchLabel && <MetaRow label="Batch label" value={gen.batchLabel} />}
            {gen.driveFileId && <MetaRow label="Drive" value="Saved" />}
          </div>

          {/* Tags */}
          {gen.tags && gen.tags.length > 0 && (
            <div className="p-5 border-b border-border/50">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tags</h3>
              <div className="flex gap-1 flex-wrap">
                {gen.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-5 space-y-2 flex-1">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Actions</h3>

            <ActionButton
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>}
              label="Copy prompt"
              onClick={handleCopyPrompt}
            />

            {isReady && (
              <ActionButton
                icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v8M8 10L5 7M8 10L11 7" /><path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" /></svg>}
                label="Download"
                onClick={handleDownload}
              />
            )}

            {isReady && !gen.driveFileId && (
              <ActionButton
                icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" /></svg>}
                label="Save to Drive"
                onClick={() => onSave(gen.id)}
              />
            )}

            {isReady && (
              <ActionButton
                icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6.5 9.5l3-3M5.5 7L4 8.5a2.12 2.12 0 003 3L8.5 10M10.5 9l1.5-1.5a2.12 2.12 0 00-3-3L7.5 6" /></svg>}
                label="Link to Scene"
                onClick={() => onLink(gen.id)}
              />
            )}

            {isReady && onInpaint && (
              <ActionButton
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>}
                label="Edit / Inpaint"
                onClick={() => onInpaint(gen)}
                accent
              />
            )}
          </div>

          {/* Bottom bar */}
          <div className="p-5 border-t border-border/50 flex items-center gap-2">
            <button
              onClick={() => onFavorite(gen.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-1 justify-center ${
                gen.isFavorite
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill={gen.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                <path d="M8 1l2.24 4.55 5.01.73-3.63 3.54.86 5L8 12.27 3.52 14.82l.86-5L.75 6.28l5.01-.73z" />
              </svg>
              {gen.isFavorite ? "Favorited" : "Favorite"}
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-muted/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-[11px] text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function ActionButton({ icon, label, onClick, accent }: { icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
        accent
          ? "bg-primary/10 hover:bg-primary/20 text-primary"
          : "hover:bg-muted/50 text-foreground"
      }`}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      {label}
    </button>
  );
}
