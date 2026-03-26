"use client";

import { useEffect, useState, useRef, use, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Scene, Character } from "@/lib/types";

interface SceneFileLink {
  linkId: number;
  fileId: number;
  fileType: string;
  mimeType: string;
  filename: string;
  storagePath: string;
  reviewStatus: "approved" | "rejected" | "pending";
}

interface SceneReviewData {
  sceneId: number;
  files: SceneFileLink[];
}

interface SceneWithAssets extends Scene {
  assetCount: number;
  dialogueCount: number;
  estimatedDuration: number; // seconds
  characters: string[];
}

const TIME_OF_DAY_COLORS: Record<string, string> = {
  DAY: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  NIGHT: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  DAWN: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  DUSK: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  MORNING: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  EVENING: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  CONTINUOUS: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

const HEADING_TYPE_COLORS: Record<string, string> = {
  INT: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  EXT: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  "INT/EXT": "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "EXT/INT": "bg-teal-500/20 text-teal-300 border-teal-500/30",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function estimateSceneDuration(scene: Scene): number {
  let seconds = 0;
  // ~3 seconds per dialogue line (average speaking pace)
  if (scene.dialogues) seconds += scene.dialogues.length * 3;
  // ~2 seconds per direction/action line
  if (scene.directions) seconds += scene.directions.length * 2;
  // Minimum 5 seconds per scene
  return Math.max(5, seconds);
}

export default function TimelineReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const [scenes, setScenes] = useState<SceneWithAssets[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<"chart" | "storyboard">("chart");
  const [sceneFiles, setSceneFiles] = useState<Record<number, SceneFileLink[]>>({});
  const timelineRef = useRef<HTMLDivElement>(null);
  const storyboardRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [scenesRes, charsRes, reviewRes] = await Promise.all([
        fetch(`/api/scenes?projectId=${projectId}&include=dialogues,directions`),
        fetch(`/api/characters?projectId=${projectId}`),
        fetch(`/api/scenes/review?projectId=${projectId}`),
      ]);

      const scenesData: Scene[] = await scenesRes.json();
      const charsData = await charsRes.json();
      setCharacters(Array.isArray(charsData) ? charsData : charsData.characters || []);

      // Build file map from review data
      const reviewData: SceneReviewData[] = await reviewRes.json();
      const fileMap: Record<number, SceneFileLink[]> = {};
      reviewData.forEach((d) => { fileMap[d.sceneId] = d.files; });
      setSceneFiles(fileMap);

      const enriched: SceneWithAssets[] = scenesData.map((s) => {
        const dialogueChars = new Set<string>();
        if (s.dialogues) s.dialogues.forEach((d) => dialogueChars.add(d.character));

        return {
          ...s,
          assetCount: (fileMap[s.id] || []).length,
          dialogueCount: s.dialogues?.length || 0,
          estimatedDuration: estimateSceneDuration(s),
          characters: Array.from(dialogueChars),
        };
      });

      setScenes(enriched.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch {
      toast.error("Failed to load timeline data");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Scene files are fetched in fetchData on initial load

  const updateReviewStatus = useCallback(async (linkId: number, newStatus: "approved" | "rejected" | "pending") => {
    try {
      const res = await fetch("/api/drive/scene-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: linkId, reviewStatus: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update review status");
      setSceneFiles((prev) => {
        const next = { ...prev };
        for (const sceneId of Object.keys(next)) {
          next[Number(sceneId)] = next[Number(sceneId)].map((f) =>
            f.linkId === linkId ? { ...f, reviewStatus: newStatus } : f
          );
        }
        return next;
      });
      toast.success(`Marked as ${newStatus}`);
    } catch {
      toast.error("Failed to update review status");
    }
  }, []);

  const totalDuration = scenes.reduce((sum, s) => sum + s.estimatedDuration, 0);
  const maxSceneDuration = Math.max(...scenes.map((s) => s.estimatedDuration), 1);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="h-40 rounded-lg bg-muted animate-pulse" />
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
            <path d="M1 8h14" />
            <circle cx="4" cy="8" r="2" />
            <circle cx="9" cy="8" r="2" />
            <circle cx="13" cy="8" r="1.5" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-1">No scenes yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Upload and parse a screenplay first to see the timeline review.
        </p>
      </div>
    );
  }

  const selectedSceneData = scenes.find((s) => s.id === selectedScene);

  return (
    <div className="p-6 space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Timeline Review</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {scenes.length} scene{scenes.length !== 1 ? "s" : ""} &middot; ~{formatDuration(totalDuration)} estimated runtime
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-border/30 bg-card/60 backdrop-blur-sm p-0.5">
            <button
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "chart" ? "bg-primary text-primary-foreground shadow-[0_0_12px_var(--glow-primary)]" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setViewMode("chart")}
            >
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 14h12M4 10v4M8 6v8M12 2v12" /></svg>
                Chart
              </span>
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "storyboard" ? "bg-primary text-primary-foreground shadow-[0_0_12px_var(--glow-primary)]" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setViewMode("storyboard")}
            >
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="4" height="6" rx="0.5" /><rect x="6" y="1" width="4" height="6" rx="0.5" /><rect x="11" y="1" width="4" height="6" rx="0.5" /><rect x="1" y="9" width="4" height="6" rx="0.5" /><rect x="6" y="9" width="4" height="6" rx="0.5" /><rect x="11" y="9" width="4" height="6" rx="0.5" /></svg>
                Storyboard
              </span>
            </button>
          </div>

          {/* Zoom controls (chart mode only) */}
          {viewMode === "chart" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} disabled={zoom <= 0.5}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10" /></svg>
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(3, zoom + 0.25))} disabled={zoom >= 3}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M8 3v10" /></svg>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Scenes", value: scenes.length },
          { label: "INT Scenes", value: scenes.filter((s) => s.headingType?.includes("INT")).length },
          { label: "EXT Scenes", value: scenes.filter((s) => s.headingType?.includes("EXT") && !s.headingType?.includes("INT")).length },
          { label: "Characters", value: characters.length },
        ].map((stat) => (
          <Card key={stat.label} className="bg-card/60 backdrop-blur-sm border-border/30">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ===== CHART VIEW ===== */}
      {viewMode === "chart" && (
        <>
          {/* Horizontal timeline */}
          <Card className="bg-card/60 backdrop-blur-sm border-border/30 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Scene Timeline</h3>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500/60" /> INT</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500/60" /> EXT</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500/40" /> DAY</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500/40" /> NIGHT</span>
                </div>
              </div>

              <div ref={timelineRef} className="overflow-x-auto pb-2 scrollbar-thin">
                <div className="flex gap-1 items-end min-w-max" style={{ height: `${120 * zoom}px` }}>
                  {scenes.map((scene) => {
                    const heightPercent = (scene.estimatedDuration / maxSceneDuration) * 100;
                    const isSelected = selectedScene === scene.id;
                    const bgClass = scene.headingType?.includes("INT")
                      ? "bg-emerald-500/30 hover:bg-emerald-500/40"
                      : scene.headingType?.includes("EXT")
                        ? "bg-sky-500/30 hover:bg-sky-500/40"
                        : "bg-muted hover:bg-muted/80";

                    return (
                      <button
                        key={scene.id}
                        className={`relative rounded-t-md transition-all duration-200 cursor-pointer group ${bgClass} ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""}`}
                        style={{
                          width: `${Math.max(32, 48 * zoom)}px`,
                          height: `${Math.max(20, heightPercent * zoom)}%`,
                          minHeight: "20px",
                        }}
                        onClick={() => setSelectedScene(isSelected ? null : scene.id)}
                        title={`Sc. ${scene.sceneNumber} — ${scene.heading} (~${formatDuration(scene.estimatedDuration)})`}
                      >
                        {/* Time-of-day indicator bar at top */}
                        <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-md ${
                          scene.timeOfDay === "NIGHT" ? "bg-indigo-500/60" :
                          scene.timeOfDay === "DAWN" || scene.timeOfDay === "DUSK" ? "bg-orange-500/60" :
                          "bg-amber-500/40"
                        }`} />
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-foreground group-hover:text-foreground transition-colors">
                          {scene.sceneNumber}
                        </span>
                        {/* Asset dot indicator */}
                        {scene.assetCount > 0 && (
                          <span className="absolute top-1.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Time ruler */}
                <div className="flex gap-1 mt-1 min-w-max">
                  {scenes.map((scene) => (
                    <div
                      key={scene.id}
                      className="text-[8px] text-muted-foreground text-center font-mono"
                      style={{ width: `${Math.max(32, 48 * zoom)}px` }}
                    >
                      {formatDuration(scene.estimatedDuration)}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected scene detail panel */}
          {selectedSceneData && (
            <Card className="bg-card/60 backdrop-blur-sm border-border/30 animate-in slide-in-from-bottom-2 duration-300">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold">
                        Scene {selectedSceneData.sceneNumber}
                      </h3>
                      {selectedSceneData.headingType && (
                        <Badge variant="outline" className={`text-[10px] ${HEADING_TYPE_COLORS[selectedSceneData.headingType] || ""}`}>
                          {selectedSceneData.headingType}
                        </Badge>
                      )}
                      {selectedSceneData.timeOfDay && (
                        <Badge variant="outline" className={`text-[10px] ${TIME_OF_DAY_COLORS[selectedSceneData.timeOfDay] || ""}`}>
                          {selectedSceneData.timeOfDay}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedSceneData.heading}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedScene(null)} className="shrink-0">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-lg font-semibold">{formatDuration(selectedSceneData.estimatedDuration)}</p>
                    <p className="text-[10px] text-muted-foreground">Est. Duration</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-lg font-semibold">{selectedSceneData.dialogueCount}</p>
                    <p className="text-[10px] text-muted-foreground">Dialogue Lines</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-lg font-semibold">{selectedSceneData.characters.length}</p>
                    <p className="text-[10px] text-muted-foreground">Characters</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-lg font-semibold">{selectedSceneData.assetCount}</p>
                    <p className="text-[10px] text-muted-foreground">Assets</p>
                  </div>
                </div>

                {selectedSceneData.characters.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Characters in scene</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSceneData.characters.map((name) => (
                        <Badge key={name} variant="secondary" className="text-[10px]">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSceneData.synopsis && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Synopsis</p>
                    <p className="text-sm text-foreground/80">{selectedSceneData.synopsis}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <a href={`/project/${projectId}/scenes/${selectedSceneData.id}`}>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12M2 8h12M2 13h8" /></svg>
                      View Scene
                    </Button>
                  </a>
                  <a href={`/project/${projectId}/generate?scene=${selectedSceneData.id}`}>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2l2 4 4.5.7-3.3 3.2.8 4.6L8 12.3 3.9 14.5l.8-4.6L1.5 6.7 6 6z" /></svg>
                      Generate Image
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scene list (compact table view) */}
          <Card className="bg-card/60 backdrop-blur-sm border-border/30">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 text-left text-xs text-muted-foreground">
                      <th className="p-3 font-medium">#</th>
                      <th className="p-3 font-medium">Scene</th>
                      <th className="p-3 font-medium">Type</th>
                      <th className="p-3 font-medium">Time</th>
                      <th className="p-3 font-medium">Characters</th>
                      <th className="p-3 font-medium text-right">Dialogues</th>
                      <th className="p-3 font-medium text-right">Assets</th>
                      <th className="p-3 font-medium text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenes.map((scene) => (
                      <tr
                        key={scene.id}
                        className={`border-b border-border/10 hover:bg-muted/20 cursor-pointer transition-colors ${selectedScene === scene.id ? "bg-primary/5" : ""}`}
                        onClick={() => setSelectedScene(selectedScene === scene.id ? null : scene.id)}
                      >
                        <td className="p-3 font-mono text-xs text-muted-foreground">{scene.sceneNumber}</td>
                        <td className="p-3 max-w-[200px] truncate">{scene.heading}</td>
                        <td className="p-3">
                          {scene.headingType && (
                            <Badge variant="outline" className={`text-[9px] ${HEADING_TYPE_COLORS[scene.headingType] || ""}`}>
                              {scene.headingType}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          {scene.timeOfDay && (
                            <Badge variant="outline" className={`text-[9px] ${TIME_OF_DAY_COLORS[scene.timeOfDay] || ""}`}>
                              {scene.timeOfDay}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[150px] truncate">
                          {scene.characters.join(", ") || "—"}
                        </td>
                        <td className="p-3 text-right font-mono text-xs">{scene.dialogueCount}</td>
                        <td className="p-3 text-right font-mono text-xs">
                          {scene.assetCount > 0 ? (
                            <span className="text-primary">{scene.assetCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-xs">{formatDuration(scene.estimatedDuration)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border/30 text-xs font-medium">
                      <td className="p-3" colSpan={5}>Total</td>
                      <td className="p-3 text-right font-mono">{scenes.reduce((s, sc) => s + sc.dialogueCount, 0)}</td>
                      <td className="p-3 text-right font-mono">{scenes.reduce((s, sc) => s + sc.assetCount, 0)}</td>
                      <td className="p-3 text-right font-mono">{formatDuration(totalDuration)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== STORYBOARD VIEW ===== */}
      {viewMode === "storyboard" && (
        <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-[0_0_12px_var(--glow-primary)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Storyboard</h3>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Approved</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Rejected</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-border" /> Pending</span>
              </div>
            </div>

            {loading ? (
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="min-w-[180px] space-y-2">
                    <div className="h-6 rounded bg-muted animate-pulse" />
                    <div className="h-24 rounded bg-muted animate-pulse" />
                    <div className="h-24 rounded bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div ref={storyboardRef} className="overflow-x-auto pb-2 scrollbar-thin">
                <div className="flex gap-3 min-w-max">
                  {scenes.map((scene) => {
                    const files = sceneFiles[scene.id] || [];
                    const images = files.filter((f) => f.mimeType?.startsWith("image/"));
                    const videos = files.filter((f) => f.mimeType?.startsWith("video/"));
                    const audio = files.filter((f) => f.mimeType?.startsWith("audio/"));
                    const hasAny = files.length > 0;

                    // Extract short location from heading (e.g., "INT. KITCHEN - DAY" -> "KITCHEN")
                    const locationMatch = scene.heading?.match(/(?:INT|EXT|INT\/EXT|EXT\/INT)[.\s-]+(.+?)(?:\s*-\s*(?:DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS))?$/i);
                    const shortLocation = locationMatch?.[1]?.trim() || scene.heading || "Unknown";

                    const reviewBorderClass = (status: string) =>
                      status === "approved" ? "border-emerald-500" :
                      status === "rejected" ? "border-red-500" :
                      "border-border";

                    const cycleStatus = (current: string): "approved" | "rejected" | "pending" =>
                      current === "pending" ? "approved" :
                      current === "approved" ? "rejected" :
                      "pending";

                    return (
                      <div key={scene.id} className="min-w-[180px] max-w-[180px] flex flex-col">
                        {/* Column header */}
                        <div className="rounded-t-lg bg-muted/30 border border-border/30 border-b-0 px-3 py-2">
                          <p className="text-xs font-bold font-mono text-foreground">Sc. {scene.sceneNumber}</p>
                          <p className="text-[10px] text-muted-foreground truncate" title={shortLocation}>{shortLocation}</p>
                        </div>

                        {/* Content area */}
                        <div className="flex-1 rounded-b-lg border border-border/30 border-t-0 bg-muted/10 p-2 space-y-2">
                          {!hasAny ? (
                            /* Empty scene placeholder */
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                              <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center mb-2">
                                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                                  <rect x="2" y="2" width="12" height="12" rx="2" />
                                  <path d="M6 6l4 4M10 6l-4 4" />
                                </svg>
                              </div>
                              <p className="text-[10px] text-muted-foreground mb-2">No assets linked</p>
                              <a href={`/project/${projectId}/generate?scene=${scene.id}`}>
                                <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 gap-1">
                                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2l2 4 4.5.7-3.3 3.2.8 4.6L8 12.3 3.9 14.5l.8-4.6L1.5 6.7 6 6z" /></svg>
                                  Generate
                                </Button>
                              </a>
                            </div>
                          ) : (
                            <>
                              {/* Image thumbnails */}
                              {images.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                      <rect x="2" y="2" width="12" height="12" rx="2" />
                                      <circle cx="6" cy="6" r="1.5" />
                                      <path d="M2 11l3-3 2 2 3-3 4 4v1H2z" />
                                    </svg>
                                    Images ({images.length})
                                  </p>
                                  {images.map((file) => (
                                    <div key={file.linkId} className="relative group">
                                      <a
                                        href={`/api/drive/files/${file.fileId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`block rounded-md border-2 overflow-hidden transition-all hover:shadow-md ${reviewBorderClass(file.reviewStatus)}`}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={`/api/drive/files/${file.fileId}`}
                                          alt={file.filename}
                                          className="aspect-video w-full object-cover bg-muted/40"
                                          loading="lazy"
                                        />
                                      </a>
                                      <p className="text-[8px] text-muted-foreground/60 truncate mt-0.5 px-0.5" title={file.filename}>{file.filename}</p>
                                      {/* Review status badge */}
                                      <button
                                        className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all opacity-80 group-hover:opacity-100 ${
                                          file.reviewStatus === "approved" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                                          file.reviewStatus === "rejected" ? "bg-red-500/20 border-red-500 text-red-400" :
                                          "bg-muted/60 border-border text-muted-foreground"
                                        }`}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateReviewStatus(file.linkId, cycleStatus(file.reviewStatus)); }}
                                        title={`Status: ${file.reviewStatus} (click to cycle)`}
                                      >
                                        {file.reviewStatus === "approved" ? (
                                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8l3.5 3.5L13 5" /></svg>
                                        ) : file.reviewStatus === "rejected" ? (
                                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                                        ) : (
                                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="3" /></svg>
                                        )}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Video thumbnails */}
                              {videos.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                      <rect x="1" y="3" width="10" height="10" rx="1.5" />
                                      <path d="M11 6l4-2v8l-4-2" />
                                    </svg>
                                    Video ({videos.length})
                                  </p>
                                  {videos.map((file) => (
                                    <div key={file.linkId} className="relative group">
                                      <a
                                        href={`/api/drive/files/${file.fileId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`block rounded-md border-2 overflow-hidden transition-all hover:shadow-md ${reviewBorderClass(file.reviewStatus)}`}
                                      >
                                        <div className="aspect-video bg-muted/40 flex items-center justify-center">
                                          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground">
                                            <path d="M6 4l7 4-7 4V4z" fill="currentColor" />
                                          </svg>
                                        </div>
                                      </a>
                                      <p className="text-[8px] text-muted-foreground/60 truncate mt-0.5 px-0.5" title={file.filename}>{file.filename}</p>
                                      {/* Review status badge */}
                                      <button
                                        className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all opacity-80 group-hover:opacity-100 ${
                                          file.reviewStatus === "approved" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                                          file.reviewStatus === "rejected" ? "bg-red-500/20 border-red-500 text-red-400" :
                                          "bg-muted/60 border-border text-muted-foreground"
                                        }`}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateReviewStatus(file.linkId, cycleStatus(file.reviewStatus)); }}
                                        title={`Status: ${file.reviewStatus} (click to cycle)`}
                                      >
                                        {file.reviewStatus === "approved" ? (
                                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8l3.5 3.5L13 5" /></svg>
                                        ) : file.reviewStatus === "rejected" ? (
                                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                                        ) : (
                                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="3" /></svg>
                                        )}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Audio indicator */}
                              {audio.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                      <path d="M2 6v4M5 4v8M8 2v12M11 4v8M14 6v4" />
                                    </svg>
                                    Audio ({audio.length})
                                  </p>
                                  {audio.map((file) => (
                                    <div key={file.linkId} className="relative group">
                                      <a
                                        href={`/api/drive/files/${file.fileId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`block rounded-md border-2 overflow-hidden transition-all hover:shadow-md ${reviewBorderClass(file.reviewStatus)}`}
                                      >
                                        <div className="h-10 bg-muted/40 flex items-center justify-center gap-0.5 px-2">
                                          {/* Waveform visualization */}
                                          <svg width="64" height="20" viewBox="0 0 64 20" fill="none" className="text-muted-foreground">
                                            <rect x="2" y="6" width="2" height="8" rx="1" fill="currentColor" />
                                            <rect x="7" y="3" width="2" height="14" rx="1" fill="currentColor" />
                                            <rect x="12" y="7" width="2" height="6" rx="1" fill="currentColor" />
                                            <rect x="17" y="1" width="2" height="18" rx="1" fill="currentColor" />
                                            <rect x="22" y="5" width="2" height="10" rx="1" fill="currentColor" />
                                            <rect x="27" y="3" width="2" height="14" rx="1" fill="currentColor" />
                                            <rect x="32" y="7" width="2" height="6" rx="1" fill="currentColor" />
                                            <rect x="37" y="2" width="2" height="16" rx="1" fill="currentColor" />
                                            <rect x="42" y="5" width="2" height="10" rx="1" fill="currentColor" />
                                            <rect x="47" y="7" width="2" height="6" rx="1" fill="currentColor" />
                                            <rect x="52" y="4" width="2" height="12" rx="1" fill="currentColor" />
                                            <rect x="57" y="6" width="2" height="8" rx="1" fill="currentColor" />
                                          </svg>
                                        </div>
                                      </a>
                                      <p className="text-[8px] text-muted-foreground/60 truncate mt-0.5 px-0.5" title={file.filename}>{file.filename}</p>
                                      {/* Review status badge */}
                                      <button
                                        className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all opacity-80 group-hover:opacity-100 ${
                                          file.reviewStatus === "approved" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                                          file.reviewStatus === "rejected" ? "bg-red-500/20 border-red-500 text-red-400" :
                                          "bg-muted/60 border-border text-muted-foreground"
                                        }`}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateReviewStatus(file.linkId, cycleStatus(file.reviewStatus)); }}
                                        title={`Status: ${file.reviewStatus} (click to cycle)`}
                                      >
                                        {file.reviewStatus === "approved" ? (
                                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8l3.5 3.5L13 5" /></svg>
                                        ) : file.reviewStatus === "rejected" ? (
                                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                                        ) : (
                                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="3" /></svg>
                                        )}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
