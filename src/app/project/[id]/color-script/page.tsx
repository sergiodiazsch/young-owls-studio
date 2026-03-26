"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

const ColorScriptCharts = dynamic(
  () => import("./charts"),
  { ssr: false, loading: () => <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3 mb-6">{[1,2,3].map(i => <div key={i} className="rounded-xl border bg-card p-4"><div className="h-[180px] bg-muted/30 rounded-lg animate-pulse" /></div>)}</div> }
);
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { InfoTooltip } from "@/components/info-tooltip";

// ── Types ──

interface ColorInfo {
  hex: string;
  percentage: number;
  name: string;
}

interface SceneColorInfo {
  sceneId: number;
  sceneNumber: number;
  heading: string;
  timeOfDay: string | null;
  colorData: {
    id: number;
    dominantColors: ColorInfo[];
    averageColor: string | null;
    brightness: number | null;
    saturation: number | null;
    warmth: number | null;
    moodTag: string | null;
    sourceImageId: number | null;
    sourceImagePath: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

interface AnalysisPattern {
  name: string;
  description: string;
  sceneRange: string;
}

interface AnalysisSuggestion {
  type: "consistency" | "contrast" | "mood" | "pacing";
  description: string;
  affectedScenes: number[];
}

interface ColorAnalysis {
  overallMood: string;
  colorProgression: string;
  patterns: AnalysisPattern[];
  suggestions: AnalysisSuggestion[];
  emotionalArc: string;
  paletteNotes: string;
}

interface ChartDataPoint {
  sceneNumber: number;
  brightness: number;
  saturation: number;
  warmth: number;
}

// ── Suggestion type colors ──

const SUGGESTION_COLORS: Record<string, string> = {
  consistency: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  contrast: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  mood: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  pacing: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

// ── Component ──

export default function ColorScriptPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [scenes, setScenes] = useState<SceneColorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ColorAnalysis | null>(null);
  const [selectedScene, setSelectedScene] = useState<SceneColorInfo | null>(null);
  const [hoveredScene, setHoveredScene] = useState<SceneColorInfo | null>(null);

  const fetchData = useCallback((signal?: AbortSignal) => {
    fetch(`/api/color-script?projectId=${projectId}`, signal ? { signal } : undefined)
      .then((r) => r.json())
      .then((data: SceneColorInfo[]) => {
        setScenes(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load color script data");
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  // ── Extract All ──

  async function handleExtractAll() {
    setExtracting(true);
    try {
      const res = await fetch("/api/color-script/extract-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Extraction failed");
        return;
      }
      toast.success(
        `Extracted: ${data.extracted} | Skipped: ${data.skipped} | Errors: ${data.errors}`
      );
      fetchData();
    } catch {
      toast.error("Failed to extract colors");
    } finally {
      setExtracting(false);
    }
  }

  // ── Extract Single ──

  async function handleExtractSingle(sceneId: number) {
    try {
      const res = await fetch("/api/color-script/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Extraction failed");
        return;
      }
      toast.success("Colors extracted");
      fetchData();
    } catch {
      toast.error("Failed to extract colors");
    }
  }

  // ── Analyze ──

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/color-script/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Analysis failed");
        return;
      }
      setAnalysis(data);
      toast.success("Color analysis complete");
    } catch {
      toast.error("Failed to analyze color progression");
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Update Mood Tag ──

  async function handleSetMoodTag(sceneId: number, moodTag: string) {
    try {
      const res = await fetch(`/api/color-script/${sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodTag }),
      });
      if (res.ok) {
        toast.success("Mood tag updated");
        fetchData();
      }
    } catch {
      toast.error("Failed to update mood tag");
    }
  }

  // ── Chart Data ──

  const chartData: ChartDataPoint[] = scenes
    .filter((s) => s.colorData)
    .map((s) => ({
      sceneNumber: s.sceneNumber,
      brightness: Math.round((s.colorData!.brightness ?? 0) * 100),
      saturation: Math.round((s.colorData!.saturation ?? 0) * 100),
      warmth: Math.round(((s.colorData!.warmth ?? 0) + 1) * 50), // normalize -1..+1 to 0..100
    }));

  // ── Stats ──

  const scenesWithData = scenes.filter((s) => s.colorData).length;
  const totalScenes = scenes.length;

  // ── Overall Palette (aggregate top colors across all scenes) ──

  const paletteMap = new Map<string, { hex: string; name: string; count: number }>();
  for (const scene of scenes) {
    if (!scene.colorData) continue;
    for (const color of scene.colorData.dominantColors) {
      const key = color.hex.toLowerCase();
      const existing = paletteMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        paletteMap.set(key, { hex: color.hex, name: color.name, count: 1 });
      }
    }
  }
  const overallPalette = Array.from(paletteMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // ── Loading State ──

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-9 w-56 mb-1" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-[180px] w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ── Compute total page-length for proportional strip segments ──
  // Use sceneNumber gaps as a proxy for relative scene "length"
  const sceneLengths = scenes.map((scene, idx) => {
    if (idx < scenes.length - 1) {
      return scenes[idx + 1].sceneNumber - scene.sceneNumber;
    }
    // Last scene: average of prior lengths, or 1
    if (scenes.length > 1) {
      const totalBefore = scenes[scenes.length - 1].sceneNumber - scenes[0].sceneNumber;
      return Math.max(1, Math.round(totalBefore / (scenes.length - 1)));
    }
    return 1;
  });
  const totalLength = sceneLengths.reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* ── Title ── */}
      <h1 className="text-[28px] font-bold tracking-tight mb-1">
        Color Script
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Visual color progression across {totalScenes} scene{totalScenes !== 1 ? "s" : ""}
        {scenesWithData > 0 && (
          <span className="text-foreground font-medium">
            {" "}&middot; {scenesWithData} analyzed
          </span>
        )}
      </p>

      {/* ═══════════════════════════════════════════════════════════════
          COLOR STRIP HERO — full-width, proportional segments
          ═══════════════════════════════════════════════════════════════ */}
      {totalScenes > 0 && (
        <section className="mb-8">
          <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
            Color Strip
          </p>
          <TooltipProvider delayDuration={80}>
            <div className="relative flex rounded-xl overflow-hidden h-16 shadow-[0_0_20px_var(--glow-primary)] border border-border/30">
              {scenes.map((scene, idx) => {
                const dominantColor =
                  scene.colorData?.dominantColors?.[0]?.hex ||
                  scene.colorData?.averageColor ||
                  null;
                const hasData = !!scene.colorData;
                const isSelected = selectedScene?.sceneId === scene.sceneId;
                const flexBasis = totalLength > 0 ? (sceneLengths[idx] / totalLength) * 100 : 0;

                return (
                  <Tooltip key={scene.sceneId}>
                    <TooltipTrigger asChild>
                      <button
                        className={`relative transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:z-10 ${
                          isSelected
                            ? "ring-2 ring-primary ring-offset-1 ring-offset-background z-10 scale-y-110"
                            : ""
                        } ${!hasData ? "bg-muted/60" : ""}`}
                        style={{
                          flexBasis: `${flexBasis}%`,
                          flexGrow: 0,
                          flexShrink: 0,
                          backgroundColor: hasData ? (dominantColor ?? "#404040") : undefined,
                        }}
                        onClick={() =>
                          setSelectedScene(
                            isSelected ? null : scene
                          )
                        }
                        onMouseEnter={() => setHoveredScene(scene)}
                        onMouseLeave={() => setHoveredScene(null)}
                        aria-label={`Scene ${scene.sceneNumber}: ${scene.heading}`}
                      >
                        {/* Subtle inner border between segments */}
                        {idx < scenes.length - 1 && (
                          <div className="absolute right-0 top-0 bottom-0 w-px bg-black/10 dark:bg-white/10" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="font-semibold text-xs">
                        Scene {scene.sceneNumber}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {scene.heading}
                      </p>
                      {scene.colorData && (
                        <div className="flex gap-1 mt-1.5">
                          {scene.colorData.dominantColors
                            .slice(0, 5)
                            .map((color, i) => (
                              <div
                                key={i}
                                className="w-4 h-4 rounded-sm border border-white/20"
                                style={{ backgroundColor: color.hex }}
                                title={`${color.name} (${color.percentage}%)`}
                              />
                            ))}
                        </div>
                      )}
                      {!scene.colorData && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          No color data yet
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Hover indicator: scene number shown below the hovered segment */}
            <div className="relative h-5 mt-1">
              {hoveredScene && (
                <p className="text-[11px] text-muted-foreground font-medium text-center animate-in fade-in duration-100">
                  Scene {hoveredScene.sceneNumber}
                  {hoveredScene.heading ? ` \u2014 ${hoveredScene.heading}` : ""}
                </p>
              )}
            </div>
          </TooltipProvider>
        </section>
      )}

      {/* ── Action Buttons ── */}
      {totalScenes > 0 && (
        <div className="flex gap-3 flex-wrap mb-10">
          <Button
            onClick={handleExtractAll}
            disabled={extracting}
            size="lg"
            title="Scans linked images and extracts dominant colors, brightness, saturation, and warmth per scene."
          >
            {extracting ? (
              <>
                <LoadingSpinner />
                Extracting...
              </>
            ) : (
              <>
                <ExtractIcon />
                Extract All
              </>
            )}
          </Button>
          <Button
            onClick={handleAnalyze}
            disabled={analyzing || scenesWithData < 2}
            variant="outline"
            size="lg"
            title="AI interprets color progression -- identifies patterns, emotional arcs, and suggests improvements."
          >
            {analyzing ? (
              <>
                <LoadingSpinner />
                Analyzing...
              </>
            ) : (
              <>
                <AnalyzeIcon />
                Analyze
              </>
            )}
          </Button>
          {scenesWithData > 0 && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                const exportData = {
                  projectId: Number(projectId),
                  exportedAt: new Date().toISOString(),
                  totalScenes,
                  analyzedScenes: scenesWithData,
                  overallPalette: overallPalette.map((c) => ({ hex: c.hex, name: c.name, frequency: c.count })),
                  scenes: scenes.map((s) => ({
                    sceneNumber: s.sceneNumber,
                    heading: s.heading,
                    timeOfDay: s.timeOfDay,
                    colorData: s.colorData ? {
                      dominantColors: s.colorData.dominantColors,
                      averageColor: s.colorData.averageColor,
                      brightness: s.colorData.brightness,
                      saturation: s.colorData.saturation,
                      warmth: s.colorData.warmth,
                      moodTag: s.colorData.moodTag,
                    } : null,
                  })),
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `color-script-${projectId}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Color script exported as JSON");
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
                <path d="M8 2v8M8 10L5 7M8 10L11 7" />
                <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
              </svg>
              Export JSON
            </Button>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          EMPTY STATE — No scenes at all
          ═══════════════════════════════════════════════════════════════ */}
      {totalScenes === 0 && (
        <Card className="border-dashed border-2 border-border/40 backdrop-blur-sm bg-card/80">
          <CardContent className="relative flex flex-col items-center justify-center py-20 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
            <div className="relative w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 animate-float flex items-center justify-center mb-5 shadow-[0_0_30px_var(--glow-primary)]">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-muted-foreground"
              >
                <rect x="2" y="2" width="6" height="6" rx="1" />
                <rect x="9" y="2" width="6" height="6" rx="1" />
                <rect x="16" y="2" width="6" height="6" rx="1" />
                <rect x="2" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
                <rect x="16" y="9" width="6" height="6" rx="1" />
                <rect x="2" y="16" width="6" height="6" rx="1" />
                <rect x="9" y="16" width="6" height="6" rx="1" />
                <rect x="16" y="16" width="6" height="6" rx="1" />
              </svg>
            </div>
            <h2 className="relative text-lg font-semibold mb-1">No scenes yet</h2>
            <p className="relative text-sm text-muted-foreground text-center max-w-sm">
              Upload and parse a screenplay first, then come back here to extract colors.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          EMPTY STATE — Scenes exist, but no color data extracted
          Simplified 2-step visual guide
          ═══════════════════════════════════════════════════════════════ */}
      {totalScenes > 0 && scenesWithData === 0 && (
        <Card className="border-dashed border-2 border-border/40 backdrop-blur-sm bg-card/80 mb-8">
          <CardContent className="relative py-14 px-6 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />

            <div className="relative flex flex-col items-center text-center">
              <h2 className="text-lg font-semibold mb-6">
                Two steps to your color script
              </h2>

              {/* 2-step guide */}
              <div className="flex items-start gap-6 sm:gap-10 mb-8">
                {/* Step 1 */}
                <div className="flex flex-col items-center max-w-[180px]">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground mb-2">
                    1
                  </div>
                  <p className="text-sm font-medium">Generate images in Scenes</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Link or generate concept art for each scene
                  </p>
                </div>

                {/* Arrow */}
                <div className="mt-3 text-muted-foreground">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center max-w-[180px]">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary mb-2">
                    2
                  </div>
                  <p className="text-sm font-medium">Come back and click Extract All</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    We&apos;ll pull dominant colors from every scene
                  </p>
                </div>
              </div>

              <Button
                onClick={handleExtractAll}
                disabled={extracting}
                size="lg"
                className="shadow-md shadow-primary/20"
              >
                {extracting ? (
                  <>
                    <LoadingSpinner />
                    Extracting...
                  </>
                ) : (
                  <>
                    <ExtractIcon />
                    Extract All Colors
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          CHARTS (lazy-loaded recharts)
          ═══════════════════════════════════════════════════════════════ */}
      {chartData.length > 1 && <ColorScriptCharts data={chartData} />}

      {/* ═══════════════════════════════════════════════════════════════
          SCENE DETAIL PANEL
          ═══════════════════════════════════════════════════════════════ */}
      {selectedScene && (
        <Card className="mb-8 border-border/40 backdrop-blur-sm bg-card/80 shadow-[0_0_20px_var(--glow-primary)]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-semibold text-base">
                  Scene {selectedScene.sceneNumber}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedScene.heading}
                </p>
                {selectedScene.timeOfDay && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {selectedScene.timeOfDay}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExtractSingle(selectedScene.sceneId)}
                >
                  <ExtractIcon />
                  {selectedScene.colorData ? "Re-extract" : "Extract"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedScene(null)}
                >
                  <CloseIcon />
                </Button>
              </div>
            </div>

            {selectedScene.colorData ? (
              <div className="space-y-5">
                {/* Dominant Colors */}
                <div>
                  <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                    Dominant Colors
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedScene.colorData.dominantColors.map(
                      (color, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-md border border-border/40 shadow-[0_0_8px_var(--swatch-glow)] transition-shadow duration-300"
                            style={{ backgroundColor: color.hex, "--swatch-glow": `${color.hex}60` } as React.CSSProperties}
                          />
                          <div>
                            <p className="text-xs font-medium capitalize">
                              {color.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {color.hex} -- {color.percentage}%
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <Separator />

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Brightness
                    </p>
                    <p className="text-lg font-bold">
                      {Math.round(
                        (selectedScene.colorData.brightness ?? 0) * 100
                      )}
                      %
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Saturation
                    </p>
                    <p className="text-lg font-bold">
                      {Math.round(
                        (selectedScene.colorData.saturation ?? 0) * 100
                      )}
                      %
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Warmth
                    </p>
                    <p className="text-lg font-bold">
                      {(selectedScene.colorData.warmth ?? 0) > 0
                        ? "+"
                        : ""}
                      {(selectedScene.colorData.warmth ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Mood Tag */}
                <div>
                  <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                    Mood Tag
                    <InfoTooltip text="Emotional label for the scene's palette. Helps track intended mood alongside color data." />
                  </p>
                  <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Mood tag selection">
                    {MOOD_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() =>
                          handleSetMoodTag(selectedScene.sceneId, tag)
                        }
                        aria-pressed={selectedScene.colorData?.moodTag === tag}
                        className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                          selectedScene.colorData?.moodTag === tag
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "dark:bg-white/[0.04] dark:hover:bg-white/[0.06] bg-muted text-muted-foreground border-border hover:bg-accent"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Source Image */}
                {selectedScene.colorData.sourceImagePath && (
                  <div>
                    <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                      Source Image
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element -- max-height constrained preview */}
                    <img
                      src={`/api/drive/files/${selectedScene.colorData.sourceImageId}`}
                      alt="Source"
                      className="max-h-32 rounded-md border border-border object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-3">
                  No color data for this scene yet.
                </p>
                <p className="text-xs text-muted-foreground">
                  Link an image to this scene in the Scene view, then extract
                  colors.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PER-SCENE PALETTE BREAKDOWN CARDS
          ═══════════════════════════════════════════════════════════════ */}
      {scenesWithData > 0 && (
        <section className="mb-8">
          <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-4">
            Scene Palettes
          </p>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {scenes
              .filter((s) => s.colorData)
              .map((scene) => (
                <button
                  key={scene.sceneId}
                  onClick={() =>
                    setSelectedScene(
                      selectedScene?.sceneId === scene.sceneId ? null : scene
                    )
                  }
                  className={`group rounded-xl border border-border/40 backdrop-blur-sm bg-card/80 p-3 text-left transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    selectedScene?.sceneId === scene.sceneId
                      ? "ring-2 ring-primary border-primary/30 shadow-[0_0_20px_var(--glow-primary)]"
                      : ""
                  }`}
                >
                  {/* Color swatches row */}
                  <div className="flex gap-0.5 rounded-md overflow-hidden h-8 mb-2">
                    {scene.colorData!.dominantColors.slice(0, 5).map((color, i) => (
                      <div
                        key={i}
                        className="flex-1 min-w-0"
                        style={{ backgroundColor: color.hex }}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-semibold truncate">
                    Scene {scene.sceneNumber}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {scene.heading}
                  </p>
                  {scene.colorData?.moodTag && (
                    <Badge variant="secondary" className="mt-1.5 text-[9px] px-1.5 py-0">
                      {scene.colorData.moodTag}
                    </Badge>
                  )}
                </button>
              ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          OVERALL EPISODE PALETTE
          ═══════════════════════════════════════════════════════════════ */}
      {overallPalette.length > 0 && (
        <section className="mb-8">
          <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-4">
            Episode Palette
            <span className="ml-2 text-[11px] font-normal normal-case tracking-normal">
              ({overallPalette.length} color{overallPalette.length !== 1 ? "s" : ""})
            </span>
          </p>
          <Card className="border-border/40 backdrop-blur-sm bg-card/80">
            <CardContent className="p-6">
              <div className="flex gap-3 flex-wrap">
                {overallPalette.map((color, idx) => (
                  <TooltipProvider key={idx} delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col items-center gap-1.5">
                          <div
                            className="w-12 h-12 rounded-lg border border-border/40 cursor-default transition-shadow duration-300 hover:shadow-[0_0_12px_var(--swatch-glow)]"
                            style={{ backgroundColor: color.hex, "--swatch-glow": `${color.hex}80` } as React.CSSProperties}
                          />
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {color.hex}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs font-medium capitalize">
                          {color.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {color.count} {color.count === 1 ? "scene" : "scenes"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          AI ANALYSIS
          ═══════════════════════════════════════════════════════════════ */}
      {analysis && (
        <section className="mb-8">
          <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-4">
            AI Color Analysis
          </p>
          <Card className="border-border/40 backdrop-blur-sm bg-card/80 shadow-[0_0_20px_var(--glow-primary)]">
            <CardContent className="p-6">
              <div className="space-y-5">
                {/* Overall Mood */}
                <div>
                  <h4 className="font-semibold text-sm mb-1">Overall Mood</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {analysis.overallMood}
                  </p>
                </div>

                <Separator />

                {/* Color Progression */}
                <div>
                  <h4 className="font-semibold text-sm mb-1">
                    Color Progression
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {analysis.colorProgression}
                  </p>
                </div>

                <Separator />

                {/* Emotional Arc */}
                <div>
                  <h4 className="font-semibold text-sm mb-1">Emotional Arc</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {analysis.emotionalArc}
                  </p>
                </div>

                <Separator />

                {/* Patterns */}
                {analysis.patterns.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">
                      Identified Patterns
                    </h4>
                    <div className="space-y-2">
                      {analysis.patterns.map((pattern, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-border/40 p-3 bg-muted/20 backdrop-blur-sm"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {pattern.name}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {pattern.sceneRange}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {pattern.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Suggestions */}
                {analysis.suggestions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Suggestions</h4>
                    <div className="space-y-2">
                      {analysis.suggestions.map((suggestion, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-border/40 p-3 bg-muted/20 backdrop-blur-sm"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              className={`text-[10px] border-0 ${
                                SUGGESTION_COLORS[suggestion.type] || ""
                              }`}
                            >
                              {suggestion.type}
                            </Badge>
                            {suggestion.affectedScenes.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                Scenes:{" "}
                                {suggestion.affectedScenes.join(", ")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {suggestion.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Palette Notes */}
                <div>
                  <h4 className="font-semibold text-sm mb-1">Palette Notes</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {analysis.paletteNotes}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

// ── Constants ──

const MOOD_TAGS = [
  "tense",
  "serene",
  "melancholy",
  "joyful",
  "ominous",
  "romantic",
  "chaotic",
  "dreamy",
  "gritty",
  "hopeful",
  "nostalgic",
  "eerie",
];

// ── SVG Icons ──

function ExtractIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="mr-1.5"
    >
      <circle cx="5" cy="5" r="3" />
      <circle cx="11" cy="5" r="3" />
      <circle cx="8" cy="11" r="3" />
    </svg>
  );
}

function AnalyzeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="mr-1.5"
    >
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
      <circle cx="8" cy="8" r="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="mr-1.5 animate-spin"
    >
      <path d="M8 1a7 7 0 106.93 6" />
    </svg>
  );
}
