"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SnippetPicker } from "@/components/snippet-picker";
import { PromptWithMentions } from "@/components/prompt-with-mentions";
import { ImageGenModelSelector, IMAGE_MODELS } from "@/components/image-gen-model-selector";
import { ImageGenReferencePanel, type ReferenceImage } from "@/components/image-gen-reference-panel";
import dynamic from "next/dynamic";
import { ImageGenPromptHistory } from "@/components/image-gen-prompt-history";
import { useGallerySize, GRID_COLS } from "@/hooks/use-gallery-size";
import { GallerySizeControl } from "@/components/gallery-size-control";

const ImageGenResultsGrid = dynamic(
  () => import("@/components/image-gen-results-grid").then((m) => ({ default: m.ImageGenResultsGrid })),
  { ssr: false }
);

const ImageGenInpaintEditor = dynamic(
  () => import("@/components/image-gen-inpaint-editor").then((m) => ({ default: m.ImageGenInpaintEditor })),
  { ssr: false }
);
import { useImageGenerationQueue } from "@/hooks/use-image-generation-queue";
import { toast } from "sonner";
import type { Scene, ImageGeneration, ImageGenerationParams } from "@/lib/types";

type GalleryFilter = "all" | "completed" | "generating" | "favorites" | "failed";

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="page-loader"><div className="loader-spin loader-spin-lg" /><p>Loading generator...</p></div>}>
      <GeneratePageInner />
    </Suspense>
  );
}

function GeneratePageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;

  const {
    generations,
    loading,
    enqueue,
    toggleFavorite,
    deleteGeneration,
    promoteToDrive,
    clearCompleted,
    refresh,
  } = useImageGenerationQueue(projectId);

  // Prompt state
  const [prompt, setPrompt] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Model & settings
  const [model, setModel] = useState("nano-banana-pro");
  const [genParams, setGenParams] = useState<ImageGenerationParams>({
    resolution: "1K",
    aspectRatio: "square",
  });
  const [count, setCount] = useState(1);
  const [seed, setSeed] = useState<number | undefined>(undefined);

  // Reference images
  const [references, setReferences] = useState<ReferenceImage[]>([]);

  // Entity reference images (from characters/locations in prompt)
  const [entityRefImages, setEntityRefImages] = useState<Array<{
    entityType: "character" | "location";
    entityName: string;
    entityId: number;
    images: Array<{ id: number; storagePath: string; filename: string; label: string | null; isDefault: boolean }>;
  }>>([]);
  const [selectedEntityRefs, setSelectedEntityRefs] = useState<Set<number>>(new Set());

  // Inpaint state
  const [inpaintGen, setInpaintGen] = useState<ImageGeneration | null>(null);
  const [standaloneInpaint, setStandaloneInpaint] = useState(false);

  // Scene context from ?sceneId= deep link
  const [sceneContext, setSceneContext] = useState<{ sceneNumber: number; heading: string } | null>(null);

  // Auto-generate concepts state
  const [autoGenerating, setAutoGenerating] = useState(false);

  // UI state
  const [panelOpen, setPanelOpen] = useState(false);
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [gallerySize, setGallerySize] = useGallerySize(3);

  const modelConfig = IMAGE_MODELS.find((m) => m.id === model) || IMAGE_MODELS[0];

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
        toast.error("Failed to load page data");
        setHasApiKey(false);
      });
    return () => controller.abort();
  }, [projectId]);

  // Reset count when switching models
  useEffect(() => {
    const maxCount = modelConfig.maxCount;
    if (count > maxCount) setCount(maxCount > 1 ? maxCount : 1);
  }, [model, modelConfig.maxCount, count]);

  // Handle ?ref={fileId} deep link
  useEffect(() => {
    const refId = searchParams.get("ref");
    if (!refId) return;
    fetch(`/api/drive/files/${refId}?info=true`)
      .then((r) => r.json())
      .then((file) => {
        if (file && file.storagePath && file.mimeType?.startsWith("image/")) {
          setReferences((prev) => {
            if (prev.some((r) => r.storagePath === file.storagePath)) return prev;
            return [...prev, {
              storagePath: file.storagePath,
              filename: file.filename,
              preview: `/api/drive/files/${file.id}`,
            }];
          });
          toast.success(`Added "${file.filename}" as reference`);
          setPanelOpen(true);
        }
      })
      .catch(() => {});
    router.replace(`/project/${projectId}/generate`, { scroll: false });
  }, [searchParams, projectId, router]);

  // Handle ?sceneId={id} deep link
  useEffect(() => {
    const sceneId = searchParams.get("sceneId");
    if (!sceneId) return;
    fetch(`/api/scenes/${sceneId}`)
      .then((r) => r.json())
      .then((scene) => {
        if (scene && !scene.error) {
          const heading = scene.heading || `Scene ${scene.sceneNumber}`;
          const actionLines = (scene.directions || [])
            .filter((d: { type: string; content: string }) => d.type === "action")
            .map((d: { content: string }) => d.content)
            .join(" ")
            .slice(0, 200);
          const contextPrompt = `Cinematic still from a screenplay. ${heading}. ${actionLines}`.trim();
          setPrompt(contextPrompt);
          setSceneContext({ sceneNumber: scene.sceneNumber, heading });
          setPanelOpen(true);
        }
      })
      .catch(() => {});
    router.replace(`/project/${projectId}/generate`, { scroll: false });
  }, [searchParams, projectId, router]);

  // Handle ?prompt={text} deep link
  useEffect(() => {
    const promptParam = searchParams.get("prompt");
    if (!promptParam) return;
    setPrompt(promptParam);
    setPanelOpen(true);
    router.replace(`/project/${projectId}/generate`, { scroll: false });
  }, [searchParams, projectId, router]);

  // Filtered generations
  const filteredGenerations = useMemo(() => {
    switch (filter) {
      case "completed": return generations.filter((g) => g.status === "completed");
      case "generating": return generations.filter((g) => g.status === "generating" || g.status === "queued");
      case "failed": return generations.filter((g) => g.status === "failed");
      case "favorites": return generations.filter((g) => g.isFavorite);
      default: return generations;
    }
  }, [generations, filter]);

  const completedCount = generations.filter((g) => g.status === "completed").length;
  const generatingCount = generations.filter((g) => g.status === "generating" || g.status === "queued").length;
  const failedCount = generations.filter((g) => g.status === "failed").length;
  const favCount = generations.filter((g) => g.isFavorite).length;

  function handleGenerate() {
    if (!prompt.trim()) return;
    if (!hasApiKey) {
      toast.error("fal.ai API key not configured. Go to Settings first.");
      return;
    }

    const finalParams: ImageGenerationParams = { ...genParams };
    // Combine manual references + selected entity references
    const allRefPaths = [
      ...references.map((r) => r.storagePath),
      ...entityRefImages
        .flatMap((e) => e.images)
        .filter((img) => selectedEntityRefs.has(img.id))
        .map((img) => img.storagePath),
    ];
    if (allRefPaths.length > 0 && modelConfig.supportsReferenceImages) {
      finalParams.referenceImages = allRefPaths;
    }

    enqueue({
      prompt: prompt.trim(),
      model,
      params: finalParams,
      seed,
      count,
    });

    setPanelOpen(false);
  }

  async function handleSuggest(context: string) {
    setSuggesting(true);
    try {
      const res = await fetch("/api/generate/suggest-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.prompt) setPrompt(data.prompt);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to suggest prompt");
    }
    setSuggesting(false);
  }

  async function handleAutoGenerateConcepts() {
    setAutoGenerating(true);
    try {
      const res = await fetch("/api/scenes/auto-generate-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to queue generations");
      toast.success(`Queued ${data.queued} concept generation${data.queued !== 1 ? "s" : ""}`);
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to auto-generate concepts");
    }
    setAutoGenerating(false);
  }

  const generateLabel = `Generate ${count > 1 ? `${count} Images` : "Image"}`;

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
          Configure your fal.ai API key in Settings to enable image generation.
        </p>
        <Button onClick={() => router.push("/settings")}>Go to Settings</Button>
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
            <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap drop-shadow-sm">Image Generation</h1>
            {generations.length > 0 && (
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
              ["all", "All", generations.length],
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

          {/* Size control + Actions */}
          <GallerySizeControl value={gallerySize} onChange={setGallerySize} />
          <div className="flex items-center gap-1.5 shrink-0">
            {generations.some((g) => g.status === "completed" || g.status === "failed") && (
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={clearCompleted}>
                Clear
              </Button>
            )}
            <Button
              onClick={() => setPanelOpen(true)}
              size="sm"
              className="gap-1.5 shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-all duration-300"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v10M3 8h10" />
              </svg>
              <span className="hidden sm:inline">Create</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Gallery ── */}
      <div className="p-4 md:p-6">
        {loading ? (
          <div className={`grid gap-4 ${GRID_COLS.image[gallerySize]}`}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : filteredGenerations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 flex items-center justify-center mb-5 shadow-[0_0_20px_var(--glow-primary)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            {filter !== "all" ? (
              <>
                <h2 className="text-lg font-semibold mb-1">No results</h2>
                <p className="text-sm text-muted-foreground mb-4">No images match this filter</p>
                <Button variant="outline" size="sm" onClick={() => setFilter("all")}>Show all</Button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-1">No images yet</h2>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-5">
                  Create your first image with a detailed prompt describing the scene
                </p>
                <Button onClick={() => setPanelOpen(true)} className="gap-1.5 shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-all duration-300">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  Create Image
                </Button>
              </>
            )}
          </div>
        ) : (
          <ImageGenResultsGrid
            generations={filteredGenerations}
            loading={loading}
            projectId={projectId}
            onToggleFavorite={toggleFavorite}
            onDelete={deleteGeneration}
            onPromoteToDrive={promoteToDrive}
            onInpaint={setInpaintGen}
            gridSize={gallerySize}
          />
        )}
      </div>

      {/* ── Creation Panel (Sheet) ── */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0 flex flex-col backdrop-blur-sm bg-card/80 border-border/40">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
            <SheetTitle>Create Image</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              {/* Scene context badge */}
              {sceneContext && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-primary/20 bg-primary/5 text-xs shadow-[0_0_10px_var(--glow-primary)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-primary">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                  </svg>
                  <span className="text-muted-foreground">Generating for</span>
                  <span className="font-medium text-primary">Scene {sceneContext.sceneNumber}</span>
                  <button
                    type="button"
                    onClick={() => setSceneContext(null)}
                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear scene context"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Prompt */}
              <div className="space-y-2 rounded-lg p-3 -mx-3 backdrop-blur-sm bg-muted/30 focus-within:shadow-[0_0_15px_var(--glow-primary)] transition-all duration-300">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Prompt</label>
                  <div className="flex items-center gap-1">
                    <ImageGenPromptHistory projectId={projectId} onSelectPrompt={setPrompt} />
                    <SnippetPicker projectId={projectId} onInsert={(text) => setPrompt((p) => p ? p + "\n" + text : text)} />
                  </div>
                </div>
                <PromptWithMentions
                  value={prompt}
                  onChange={setPrompt}
                  projectId={projectId}
                  placeholder={"Describe the image you want to generate...\n\ne.g. A cinematic wide shot of @CharacterName in a dimly lit detective office, film noir style..."}
                  rows={4}
                  className="resize-none"
                  onCharacterSelected={(character, primaryImage) => {
                    if (primaryImage && modelConfig.supportsReferenceImages) {
                      setReferences((prev) => {
                        if (prev.some((r) => r.storagePath === primaryImage.storagePath)) return prev;
                        return [...prev, {
                          storagePath: primaryImage.storagePath,
                          filename: `${character.name} (primary)`,
                          preview: primaryImage.preview,
                        }];
                      });
                      toast.success(`Added ${character.name}'s image as reference`);
                    }
                    // Load all reference images for this character
                    fetch(`/api/characters/${character.id}/reference-images`)
                      .then((r) => r.json())
                      .then((imgs) => {
                        if (Array.isArray(imgs) && imgs.length > 0) {
                          setEntityRefImages((prev) => {
                            if (prev.some((e) => e.entityType === "character" && e.entityId === character.id)) return prev;
                            return [...prev, {
                              entityType: "character",
                              entityName: character.name,
                              entityId: character.id,
                              images: imgs,
                            }];
                          });
                          // Auto-select default images
                          setSelectedEntityRefs((prev) => {
                            const next = new Set(prev);
                            for (const img of imgs) { if (img.isDefault) next.add(img.id); }
                            return next;
                          });
                        }
                      })
                      .catch(() => {});
                  }}
                />
                {scenes.length > 0 && (
                  <SceneSuggestDropdown scenes={scenes} suggesting={suggesting} onSuggest={handleSuggest} />
                )}
              </div>

              {/* Reference Images */}
              {modelConfig.supportsReferenceImages && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reference Images</label>
                  <ImageGenReferencePanel
                    projectId={projectId}
                    references={references}
                    onReferencesChange={setReferences}
                    maxImages={10}
                  />
                </div>
              )}

              {/* Entity Reference Images (from @mentions) */}
              {entityRefImages.length > 0 && modelConfig.supportsReferenceImages && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Character / Location References</label>
                  <div className="space-y-3">
                    {entityRefImages.map((entity) => (
                      <div key={`${entity.entityType}-${entity.entityId}`} className="rounded-lg border border-border/30 bg-card/40 p-2.5">
                        <p className="text-xs font-medium text-muted-foreground mb-2 capitalize">
                          {entity.entityType}: {entity.entityName}
                        </p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {entity.images.map((img) => {
                            const isSelected = selectedEntityRefs.has(img.id);
                            return (
                              <button
                                key={img.id}
                                type="button"
                                className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                                  isSelected ? "border-primary ring-1 ring-primary/30" : "border-transparent opacity-60 hover:opacity-100"
                                }`}
                                onClick={() => {
                                  setSelectedEntityRefs((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(img.id)) next.delete(img.id);
                                    else next.add(img.id);
                                    return next;
                                  });
                                }}
                                title={img.label || img.filename}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/api/storage/${img.storagePath}`}
                                  alt={img.label || img.filename}
                                  className="w-full h-full object-cover"
                                />
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-sm border flex items-center justify-center text-white text-[8px] ${
                                  isSelected ? "bg-primary border-primary" : "bg-black/40 border-white/30"
                                }`}>
                                  {isSelected && (
                                    <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3">
                                      <path d="M3 8.5l3.5 3.5 6.5-8" />
                                    </svg>
                                  )}
                                </div>
                                {img.isDefault && (
                                  <span className="absolute bottom-0.5 right-0.5 text-[7px] bg-primary/80 text-white px-1 rounded">
                                    default
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Model & Settings */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Model & Settings</label>
                <ImageGenModelSelector
                  model={model}
                  onModelChange={setModel}
                  params={genParams}
                  onParamsChange={setGenParams}
                  count={count}
                  onCountChange={setCount}
                  seed={seed}
                  onSeedChange={setSeed}
                />
              </div>

              {/* Auto-Generate for All Scenes */}
              {scenes.length > 0 && (
                <Button
                  onClick={handleAutoGenerateConcepts}
                  disabled={autoGenerating || hasApiKey !== true}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {autoGenerating ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin mr-2">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                  )}
                  {autoGenerating ? "Queuing..." : `Auto-Generate for All Scenes (${scenes.length})`}
                </Button>
              )}
            </div>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur-sm px-6 py-4 space-y-2">
            {generatingCount > 0 && (
              <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-primary/10 border border-primary/20 shadow-[0_0_12px_var(--glow-primary)] animate-pulse">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-primary">
                  <circle cx="8" cy="8" r="6" strokeDasharray="10 20" />
                </svg>
                <span className="text-xs text-primary font-medium">{generatingCount} image{generatingCount > 1 ? "s" : ""} generating</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || hasApiKey !== true}
                size="lg"
                className="flex-1 h-12 text-base shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-all duration-300"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2">
                  <path d="M8 1v3M8 12v3M1 8h3M12 8h3" /><circle cx="8" cy="8" r="3" />
                </svg>
                {generateLabel}
              </Button>
              <Button
                onClick={() => { setStandaloneInpaint(true); setPanelOpen(false); }}
                variant="outline"
                size="lg"
                className="h-12"
                title="Upload and edit an image with inpainting"
                aria-label="Open inpaint editor"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Model: {modelConfig.name}
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Inpaint Editor */}
      <ImageGenInpaintEditor
        generation={inpaintGen}
        standalone={standaloneInpaint}
        projectId={projectId}
        onClose={() => { setInpaintGen(null); setStandaloneInpaint(false); }}
        onComplete={() => {
          setInpaintGen(null);
          setStandaloneInpaint(false);
          refresh();
        }}
      />
    </div>
  );
}

function SceneSuggestDropdown({
  scenes,
  suggesting,
  onSuggest,
}: {
  scenes: Scene[];
  suggesting: boolean;
  onSuggest: (context: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden transition-all duration-300 backdrop-blur-sm bg-card/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-accent/40 transition-colors duration-200"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-primary">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="text-xs font-medium">Auto-suggest from scene</span>
          <span className="text-[10px] text-muted-foreground">({scenes.length} scenes)</span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div
        ref={contentRef}
        className="transition-all duration-300 ease-out overflow-hidden"
        style={{
          maxHeight: open ? `${Math.min(scenes.length * 72 + 8, 320)}px` : "0px",
          opacity: open ? 1 : 0,
        }}
      >
        <div className="border-t border-border/40 max-h-[312px] overflow-y-auto">
          {scenes.map((scene) => {
            const context = [
              scene.heading,
              scene.location && `Location: ${scene.location}`,
              scene.timeOfDay && `Time: ${scene.timeOfDay}`,
              scene.synopsis,
            ].filter(Boolean).join("\n");

            return (
              <button
                key={scene.id}
                type="button"
                disabled={suggesting}
                onClick={() => onSuggest(context)}
                className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors duration-150 border-b border-border/20 last:border-b-0 disabled:opacity-50 group"
              >
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 text-[10px] font-mono font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 mt-0.5">
                    {scene.sceneNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                      {scene.heading || `Scene ${scene.sceneNumber}`}
                    </p>
                    {scene.synopsis && (
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {scene.synopsis}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {scene.headingType && (
                        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70 bg-muted/50 rounded px-1 py-px">
                          {scene.headingType}
                        </span>
                      )}
                      {scene.timeOfDay && (
                        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70 bg-muted/50 rounded px-1 py-px">
                          {scene.timeOfDay}
                        </span>
                      )}
                    </div>
                  </div>
                  {suggesting ? (
                    <div className="shrink-0 mt-1 loader-spin loader-spin-sm" />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-1 text-muted-foreground group-hover:text-primary transition-colors">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
