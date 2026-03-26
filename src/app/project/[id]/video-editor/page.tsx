"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { Pause } from "@phosphor-icons/react/dist/csr/Pause";
import { SkipBack } from "@phosphor-icons/react/dist/csr/SkipBack";
import { SkipForward } from "@phosphor-icons/react/dist/csr/SkipForward";
import { SpeakerHigh } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerX } from "@phosphor-icons/react/dist/csr/SpeakerX";
import { Scissors } from "@phosphor-icons/react/dist/csr/Scissors";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { DownloadSimple } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { FilmStrip } from "@phosphor-icons/react/dist/csr/FilmStrip";
import { MusicNote } from "@phosphor-icons/react/dist/csr/MusicNote";
import { TextT } from "@phosphor-icons/react/dist/csr/TextT";
import { Image } from "@phosphor-icons/react/dist/csr/Image";
import { MagicWand } from "@phosphor-icons/react/dist/csr/MagicWand";
import { Stack } from "@phosphor-icons/react/dist/csr/Stack";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { Lock } from "@phosphor-icons/react/dist/csr/Lock";
import { LockOpen } from "@phosphor-icons/react/dist/csr/LockOpen";
import { MagnifyingGlassPlus } from "@phosphor-icons/react/dist/csr/MagnifyingGlassPlus";
import { MagnifyingGlassMinus } from "@phosphor-icons/react/dist/csr/MagnifyingGlassMinus";
import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { Copy } from "@phosphor-icons/react/dist/csr/Copy";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { Crosshair } from "@phosphor-icons/react/dist/csr/Crosshair";
import { MagnetStraight } from "@phosphor-icons/react/dist/csr/MagnetStraight";
import { ArrowsIn } from "@phosphor-icons/react/dist/csr/ArrowsIn";
import { ArrowClockwise } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { ArrowUUpLeft } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
import { ArrowUUpRight } from "@phosphor-icons/react/dist/csr/ArrowUUpRight";
import { Repeat } from "@phosphor-icons/react/dist/csr/Repeat";
import { Flag } from "@phosphor-icons/react/dist/csr/Flag";
import { Snowflake } from "@phosphor-icons/react/dist/csr/Snowflake";
import { MonitorPlay } from "@phosphor-icons/react/dist/csr/MonitorPlay";
import { Export } from "@phosphor-icons/react/dist/csr/Export";
import { FilmReel } from "@phosphor-icons/react/dist/csr/FilmReel";
import { ChatCircleDots } from "@phosphor-icons/react/dist/csr/ChatCircleDots";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import type { PlayerRef } from "@remotion/player";

const RemotionPlayer = dynamic(
  () => import("@remotion/player").then((m) => ({ default: m.Player })),
  { ssr: false }
);
const TimelineComposition = dynamic(
  () => import("./remotion-composition").then((m) => ({ default: m.TimelineComposition })),
  { ssr: false }
);

// ── Types ──

interface Track {
  id: number;
  type: string;
  name: string;
  muted: boolean;
  locked: boolean;
  volume: number;
  sortOrder: number;
  clips: Clip[];
}

interface Clip {
  id: number;
  trackId: number;
  editorProjectId: number;
  type: string;
  name: string | null;
  startMs: number;
  durationMs: number;
  sourceStartMs: number;
  sourceEndMs: number | null;
  sourcePath: string | null;
  sourceType: string | null;
  sourceId: number | null;
  volume: number;
  opacity: number;
  playbackRate: number;
  textContent: string | null;
  textStyle: string | null;
  filters: string | null;
  transition: string | null;
  thumbnailPath: string | null;
  waveformData: string | null;
}

interface EditorProject {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  status: string;
  renderProgress: number;
  renderError: string | null;
  outputPath: string | null;
  outputSize: number | null;
  tracks: Track[];
}

interface DriveFile {
  id: number;
  filename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  fileType: string;
}

interface VoiceGenMedia {
  id: number;
  storagePath: string;
  paddedStoragePath: string | null;
  durationMs: number | null;
  inputText: string;
  character: string;
  sceneHeading: string;
  sceneId: number;
  mimeType: string;
}

interface ImageGenMedia {
  id: number;
  storagePath: string | null;
  prompt: string;
  createdAt: string;
}

interface VideoGenMedia {
  id: number;
  storagePath: string | null;
  prompt: string;
  durationMs: number | null;
  createdAt: string;
}

interface AudioGenMedia {
  id: number;
  storagePath: string | null;
  prompt: string;
  type: string;
  durationSeconds: number | null;
  createdAt: string;
}

// ── Helpers ──

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const frames = Math.floor((ms % 1000) / (1000 / 30));
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

function msToPixels(ms: number, scale: number): number {
  return (ms / 1000) * scale;
}

function pixelsToMs(px: number, scale: number): number {
  return (px / scale) * 1000;
}

// ── Clip Colors ──
const CLIP_COLORS: Record<string, string> = {
  video: "bg-primary/80 border-primary/50 hover:shadow-md",
  audio: "bg-[oklch(0.55_0.17_162/0.8)] border-[oklch(0.65_0.17_162/0.5)] hover:shadow-sm",
  image: "bg-[oklch(0.55_0.2_300/0.8)] border-[oklch(0.65_0.2_300/0.5)] hover:shadow-md",
  text: "bg-[oklch(0.6_0.15_85/0.8)] border-[oklch(0.7_0.15_85/0.5)] hover:shadow-sm",
  subtitle: "bg-[oklch(0.6_0.17_55/0.8)] border-[oklch(0.7_0.17_55/0.5)] hover:shadow-sm",
};

// ── Filter Types & LUT Presets ──

interface FilterConfig {
  type: string;
  value: number;
}

const LUT_PRESETS: Record<string, FilterConfig[]> = {
  Cinematic: [{ type: "contrast", value: 15 }, { type: "saturation", value: -20 }, { type: "brightness", value: -5 }],
  Warm: [{ type: "temperature", value: 30 }, { type: "saturation", value: 10 }],
  Cool: [{ type: "temperature", value: -30 }, { type: "saturation", value: -5 }],
  "B&W": [{ type: "saturation", value: -100 }, { type: "contrast", value: 10 }],
  Vintage: [{ type: "saturation", value: -30 }, { type: "contrast", value: -10 }, { type: "brightness", value: 5 }, { type: "grain", value: 25 }],
  Faded: [{ type: "contrast", value: -25 }, { type: "brightness", value: 10 }, { type: "saturation", value: -15 }],
  Vibrant: [{ type: "saturation", value: 40 }, { type: "contrast", value: 10 }],
  Horror: [{ type: "saturation", value: -60 }, { type: "contrast", value: 30 }, { type: "brightness", value: -10 }],
  Neon: [{ type: "saturation", value: 80 }, { type: "contrast", value: 20 }, { type: "brightness", value: 5 }],
};

// ── Transition Types ──
interface TransitionConfig {
  type: "dissolve" | "fade-black" | "wipe-left" | "none";
  durationMs: number;
}

// ── Format Presets ──
const FORMAT_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "16:9 (1920×1080)", width: 1920, height: 1080 },
  { label: "16:9 4K (3840×2160)", width: 3840, height: 2160 },
  { label: "21:9 Ultra (2560×1080)", width: 2560, height: 1080 },
  { label: "4:3 (1440×1080)", width: 1440, height: 1080 },
  { label: "1:1 Square (1080×1080)", width: 1080, height: 1080 },
  { label: "9:16 Vertical (1080×1920)", width: 1080, height: 1920 },
  { label: "4:5 Instagram (1080×1350)", width: 1080, height: 1350 },
];

const TRANSITION_OPTIONS: { label: string; type: TransitionConfig["type"] }[] = [
  { label: "None", type: "none" },
  { label: "Dissolve", type: "dissolve" },
  { label: "Fade to Black", type: "fade-black" },
  { label: "Wipe Left", type: "wipe-left" },
];

function parseTransition(json: string | null): TransitionConfig | null {
  if (!json) return null;
  try {
    const t = JSON.parse(json);
    return t.type && t.type !== "none" ? t : null;
  } catch { return null; }
}

function parseFilters(filtersJson: string | null): FilterConfig[] {
  if (!filtersJson) return [];
  try { return JSON.parse(filtersJson); } catch { return []; }
}

// ── Title Templates ──
const TITLE_TEMPLATES: { name: string; style: Record<string, unknown> }[] = [
  { name: "Lower Third", style: { fontSize: 28, position: "bottom-left", color: "#ffffff", background: "rgba(0,0,0,0.8)", fontFamily: "sans-serif" } },
  { name: "Center Big", style: { fontSize: 64, position: "center", color: "#ffffff", background: "rgba(0,0,0,0.5)", fontFamily: "sans-serif" } },
  { name: "Cinematic", style: { fontSize: 48, position: "center", color: "#f5f5dc", background: "rgba(0,0,0,0)", fontFamily: "Georgia" } },
  { name: "News Banner", style: { fontSize: 22, position: "bottom-center", color: "#ffffff", background: "#c0392b", fontFamily: "sans-serif" } },
  { name: "Minimal", style: { fontSize: 18, position: "bottom-right", color: "#cccccc", background: "rgba(0,0,0,0)", fontFamily: "monospace" } },
  { name: "Impact", style: { fontSize: 72, position: "center", color: "#ffff00", background: "rgba(0,0,0,0)", fontFamily: "Impact" } },
  { name: "Subtitle Classic", style: { fontSize: 24, position: "bottom-center", color: "#ffffff", background: "rgba(0,0,0,0.7)", fontFamily: "sans-serif" } },
];

// ── Waveform calculation ──

async function calculateWaveform(audioUrl: string, samples: number): Promise<number[]> {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const rawData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(rawData.length / samples);
  const peaks: number[] = [];
  for (let i = 0; i < samples; i++) {
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const value = Math.abs(rawData[i * blockSize + j]);
      if (value > max) max = value;
    }
    peaks.push(max);
  }
  audioCtx.close();
  return peaks;
}

// ══════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════

export default function VideoEditorPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [editorProjects, setEditorProjects] = useState<EditorProject[]>([]);
  const [activeProject, setActiveProject] = useState<EditorProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  // UX AUDIT FIX: state for ConfirmDialog instead of native confirm()
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<number | null>(null);

  // Fetch editor projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`/api/video-editor/projects?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setEditorProjects(data);
      }
    } catch {
      toast.error("Failed to load editor projects");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Open a project in the editor
  const openProject = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/video-editor/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveProject(data);
      }
    } catch {
      toast.error("Failed to load editor project");
    }
  }, []);

  // Create new project
  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch("/api/video-editor/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const created = await res.json();
      setCreateDialogOpen(false);
      setNewTitle("");
      setNewDescription("");
      await fetchProjects();
      openProject(created.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }, [newTitle, newDescription, projectId, fetchProjects, openProject]);

  // UX AUDIT FIX: confirmation now handled by ConfirmDialog, removed native confirm()
  const handleDeleteProject = useCallback(async (id: number) => {
    try {
      await fetch(`/api/video-editor/projects/${id}`, { method: "DELETE" });
      if (activeProject?.id === id) setActiveProject(null);
      fetchProjects();
      toast.success("Project deleted");
    } catch {
      toast.error("Delete failed");
    }
  }, [activeProject, fetchProjects]);

  // WOW AUDIT: enhanced loading state with skeleton layout matching project list
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-36 bg-accent dark:bg-white/[0.06] animate-pulse rounded-md" data-slot="skeleton" />
            <div className="h-4 w-64 bg-accent dark:bg-white/[0.06] animate-pulse rounded-md" data-slot="skeleton" />
          </div>
          <div className="h-9 w-32 bg-accent dark:bg-white/[0.06] animate-pulse rounded-md" data-slot="skeleton" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="h-5 w-32 bg-accent dark:bg-white/[0.06] animate-pulse rounded-md" data-slot="skeleton" />
              <div className="h-3 w-48 bg-accent dark:bg-white/[0.06] animate-pulse rounded-md" data-slot="skeleton" />
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-accent dark:bg-white/[0.06] animate-pulse rounded-full" data-slot="skeleton" />
                <div className="h-5 w-14 bg-accent dark:bg-white/[0.06] animate-pulse rounded-full" data-slot="skeleton" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If we have an active project, show the full editor
  if (activeProject) {
    return (
      <VideoEditor
        project={activeProject}
        projectId={projectId}
        onBack={() => { setActiveProject(null); fetchProjects(); }}
        onUpdate={(p) => setActiveProject(p)}
      />
    );
  }

  // Project list view
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Video Editor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and edit video sequences with timeline editing, audio mixing, and AI tools.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Project
        </Button>
      </div>

      {editorProjects.length === 0 ? (
        // WOW AUDIT: elevated empty state with larger icon in container, animate-float, radial gradient, and prominent CTA
        <div className="border-2 border-dashed border-border/40 rounded-xl relative overflow-hidden backdrop-blur-sm bg-card/80">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
          <div className="relative flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 animate-float flex items-center justify-center mb-4 shadow-[0_0_30px_var(--glow-primary)]">
              <FilmStrip className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-1">No video editor projects yet</h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">Create your first project to start editing video sequences with timeline tools</p>
            <Button onClick={() => setCreateDialogOpen(true)} className="shadow-[0_0_15px_var(--glow-primary)]">
              <Plus className="w-4 h-4 mr-2" /> Create Project
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {editorProjects.map((ep) => (
            <div
              key={ep.id}
              className="border border-border/40 rounded-lg p-4 backdrop-blur-sm bg-card/80 hover:border-primary/40 transition-all duration-300 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => openProject(ep.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{ep.title}</h3>
                  {ep.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ep.description}</p>
                  )}
                </div>
                <Badge variant={ep.status === "completed" ? "default" : "secondary"} className="ml-2 shrink-0">
                  {ep.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span>{ep.width}x{ep.height}</span>
                <span>{ep.fps}fps</span>
                <span>{formatTime(ep.durationMs)}</span>
              </div>
              <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openProject(ep.id); }}>
                  Open
                </Button>
                {/* UX AUDIT FIX: uses ConfirmDialog via state, added aria-label */}
                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" aria-label={`Delete ${ep.title}`} onClick={(e) => { e.stopPropagation(); setDeleteProjectTarget(ep.id); }}>
                  <Trash className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Video Editor Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* UX AUDIT FIX: replaced raw <label> with <Label htmlFor> for accessibility */}
            <div>
              <Label htmlFor="editor-title">Title</Label>
              <Input id="editor-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="My Edit" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="editor-description">Description (optional)</Label>
              <Textarea id="editor-description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Describe your edit..." className="mt-1" rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newTitle.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* UX AUDIT FIX: confirmation dialog for destructive project delete action */}
      <ConfirmDialog
        open={deleteProjectTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteProjectTarget(null); }}
        title="Delete editor project"
        description="This editor project and all its tracks and clips will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete Project"
        onConfirm={() => { if (deleteProjectTarget !== null) return handleDeleteProject(deleteProjectTarget); }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════
// Full Video Editor Component
// ══════════════════════════════════════════════

function VideoEditor({
  project,
  projectId,
  onBack,
  onUpdate,
}: {
  project: EditorProject;
  projectId: string;
  onBack: () => void;
  onUpdate: (p: EditorProject) => void;
}) {
  // ── State ──
  const [tracks, setTracks] = useState<Track[]>(project.tracks || []);
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineScale, setTimelineScale] = useState(100); // px per second
  const [activePanel, setActivePanel] = useState<"media" | "properties" | "ai">("media");
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [voiceGenerations, setVoiceGenerations] = useState<VoiceGenMedia[]>([]);
  const [imageGenerations, setImageGenerations] = useState<ImageGenMedia[]>([]);
  const [videoGenerations, setVideoGenerations] = useState<VideoGenMedia[]>([]);
  const [audioGenerations, setAudioGenerations] = useState<AudioGenMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [renderingProgress, setRenderingProgress] = useState<number | null>(null);
  const [mediaTab, setMediaTab] = useState<"drive" | "voices" | "images" | "videos" | "audio">("drive");
  const [addTrackDialogOpen, setAddTrackDialogOpen] = useState(false);
  const [newTrackType, setNewTrackType] = useState("video");
  const [newTrackName, setNewTrackName] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAction, setAiAction] = useState("suggest-cuts");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<unknown[]>([]);
  const [subtitleText, setSubtitleText] = useState("");
  const [textClipContent, setTextClipContent] = useState("");
  // Auto-Animatic Builder state
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderScenes, setBuilderScenes] = useState<Array<{ id: number; heading: string }>>([]);
  const [builderSelectedScenes, setBuilderSelectedScenes] = useState<number[]>([]);
  const [builderResult, setBuilderResult] = useState<{ clipsCreated: number; scenesWithAssets: number; scenesWithoutAssets: number; totalDurationMs: number } | null>(null);
  const [builderConfirmOpen, setBuilderConfirmOpen] = useState(false);
  const [copiedGrade, setCopiedGrade] = useState<FilterConfig[] | null>(null);
  const [transitionMenu, setTransitionMenu] = useState<{ clipId: number; x: number; y: number } | null>(null);
  const [aiColorLoading, setAiColorLoading] = useState(false);
  const [subtitlesLoading, setSubtitlesLoading] = useState(false);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<number>>(new Set());
  const [razorMode, setRazorMode] = useState(false);
  const [magneticTimeline, setMagneticTimeline] = useState(false);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const [regenDialog, setRegenDialog] = useState<{ clipId: number; sourceType: string; sourceId: number; prompt: string; loading: boolean } | null>(null);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Markers
  const [markers, setMarkers] = useState<Array<{ id: number; timeMs: number; label: string; color: string }>>([]);
  const markerIdRef = useRef(1);
  // In/Out points for loop playback
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);
  const [loopPlayback, setLoopPlayback] = useState(false);
  // Mini-map
  const [showMiniMap, setShowMiniMap] = useState(true);
  // Remotion Player
  const playerRef = useRef<PlayerRef>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  // AI Director chat
  const [aiDirectorOpen, setAiDirectorOpen] = useState(false);
  const [aiDirectorMessages, setAiDirectorMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiDirectorInput, setAiDirectorInput] = useState("");
  const [aiDirectorLoading, setAiDirectorLoading] = useState(false);
  const playheadMsRef = useRef(0);
  const tracksRef = useRef<Track[]>([]);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Total duration from clips
  const totalDurationMs = useMemo(() => {
    let max = 0;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const end = clip.startMs + clip.durationMs;
        if (end > max) max = end;
      }
    }
    return Math.max(max, 10000); // Min 10 seconds
  }, [tracks]);

  // Selected clip
  const selectedClip = useMemo(() => {
    for (const t of tracks) {
      const clip = t.clips.find(c => c.id === selectedClipId);
      if (clip) return clip;
    }
    return null;
  }, [tracks, selectedClipId]);

  // ── Sync refs ──
  useEffect(() => { playheadMsRef.current = playheadMs; }, [playheadMs]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  // ── Auto-scroll timeline to follow playhead during playback ──
  useEffect(() => {
    if (!isPlaying || !timelineRef.current) return;
    const el = timelineRef.current;
    const playheadX = msToPixels(playheadMs, timelineScale);
    const viewLeft = el.scrollLeft;
    const viewRight = viewLeft + el.clientWidth;
    // If playhead goes past 80% of visible area, scroll to keep it at 30%
    if (playheadX > viewRight - 60 || playheadX < viewLeft + 20) {
      el.scrollLeft = playheadX - el.clientWidth * 0.3;
    }
  }, [playheadMs, isPlaying, timelineScale]);

  // ── Undo/Redo ──
  const pushUndo = useCallback(() => {
    undoStackRef.current.push(JSON.stringify(tracks));
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
  }, [tracks]);

  // undo, redo, zoomToFit, closeGaps, deleteSelectedClips — defined after refreshProject

  // ── Sync Remotion Player when scrubbing (not playing) ──
  useEffect(() => {
    if (isPlaying) return;
    if (playerRef.current) {
      const frame = Math.round((playheadMs / 1000) * (project.fps || 30));
      playerRef.current.seekTo(frame);
    }
  }, [playheadMs, isPlaying, project.fps]);

  // ── Fetch all media sources ──
  const fetchMedia = useCallback(async () => {
    setMediaLoading(true);
    try {
      const res = await fetch(`/api/video-editor/media?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setDriveFiles(data.driveFiles || []);
        setVoiceGenerations(data.voiceGenerations || []);
        setImageGenerations(data.imageGenerations || []);
        setVideoGenerations(data.videoGenerations || []);
        setAudioGenerations(data.audioStudioGenerations || []);
      }
    } catch {} finally {
      setMediaLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  // Fetch scenes for Auto-Animatic Builder
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/scenes?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setBuilderScenes(data.map((s: { id: number; heading: string }) => ({ id: s.id, heading: s.heading })));
        }
      } catch {}
    })();
  }, [projectId]);

  // ── Playback (Remotion-driven) ──
  const playPause = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      // If in/out set, seek to in point first
      if (inPoint !== null && playheadMs < inPoint) {
        const frame = Math.round((inPoint / 1000) * (project.fps || 30));
        playerRef.current.seekTo(frame);
        setPlayheadMs(inPoint);
      }
      playerRef.current.play();
    }
  }, [isPlaying, playheadMs, inPoint, project.fps]);

  // Remotion Player sync — drive playhead from Player events
  useEffect(() => {
    if (!playerRef.current) return;
    const player = playerRef.current;
    const fps = project.fps || 30;

    const onFrame = (e: { detail: { frame: number } }) => {
      const ms = Math.round((e.detail.frame / fps) * 1000);
      setPlayheadMs(ms);
      playheadMsRef.current = ms;

      // Handle in/out bounds
      if (outPoint !== null && ms >= outPoint) {
        if (loopPlayback && inPoint !== null) {
          player.seekTo(Math.round((inPoint / 1000) * fps));
        } else {
          player.pause();
        }
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    player.addEventListener("frameupdate", onFrame as never);
    player.addEventListener("play", onPlay as never);
    player.addEventListener("pause", onPause as never);

    return () => {
      player.removeEventListener("frameupdate", onFrame as never);
      player.removeEventListener("play", onPlay as never);
      player.removeEventListener("pause", onPause as never);
    };
  }, [project.fps, inPoint, outPoint, loopPlayback]);

  // ── Refresh project data ──
  const refreshProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/video-editor/projects/${project.id}`);
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks || []);
        onUpdate(data);
      }
    } catch {}
  }, [project.id, onUpdate]);

  // ── Undo / Redo / Editing tools (placed after refreshProject) ──
  const undo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(JSON.stringify(tracks));
    setTracks(JSON.parse(prev));
    refreshProject();
  }, [tracks, refreshProject]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(JSON.stringify(tracks));
    setTracks(JSON.parse(next));
    refreshProject();
  }, [tracks, refreshProject]);

  const zoomToFit = useCallback(() => {
    const timelineEl = timelineRef.current;
    if (!timelineEl || totalDurationMs <= 0) return;
    const availableWidth = timelineEl.clientWidth - 40;
    const newScale = (availableWidth / totalDurationMs) * 1000;
    setTimelineScale(Math.max(5, Math.min(newScale, 500)));
  }, [totalDurationMs]);

  const closeGaps = useCallback(async () => {
    pushUndo();
    for (const track of tracks) {
      const sorted = [...track.clips].sort((a, b) => a.startMs - b.startMs);
      let cursor = 0;
      for (const clip of sorted) {
        if (clip.startMs !== cursor) {
          await fetch(`/api/video-editor/clips/${clip.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startMs: cursor }),
          });
        }
        cursor += clip.durationMs;
      }
    }
    refreshProject();
    toast.success("Gaps closed");
  }, [tracks, refreshProject, pushUndo]);

  const deleteSelectedClips = useCallback(async () => {
    const ids = selectedClipIds.size > 0 ? Array.from(selectedClipIds) : (selectedClipId ? [selectedClipId] : []);
    if (ids.length === 0) return;
    pushUndo();
    for (const id of ids) {
      await fetch(`/api/video-editor/clips/${id}`, { method: "DELETE" });
    }
    setSelectedClipIds(new Set());
    setSelectedClipId(null);
    refreshProject();
  }, [selectedClipIds, selectedClipId, refreshProject, pushUndo]);

  // ── Markers ──
  const addMarker = useCallback((label?: string) => {
    const id = markerIdRef.current++;
    const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316"];
    setMarkers(prev => [...prev, {
      id,
      timeMs: playheadMs,
      label: label || `Marker ${id}`,
      color: colors[prev.length % colors.length],
    }]);
    toast.success(`Marker added at ${formatTime(playheadMs)}`);
  }, [playheadMs]);

  const removeMarker = useCallback((id: number) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
  }, []);

  // ── Freeze Frame ──
  const freezeFrame = useCallback(async () => {
    if (!selectedClip || (selectedClip.type !== "video" && selectedClip.type !== "image")) return;
    const videoTrack = tracks.find(t => t.type === "video");
    if (!videoTrack) return;
    pushUndo();
    try {
      // Create an image clip at current playhead position with same source
      await fetch("/api/video-editor/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: videoTrack.id,
          editorProjectId: project.id,
          type: "image",
          name: `Freeze: ${selectedClip.name || "Frame"}`,
          startMs: playheadMs,
          durationMs: 2000, // 2 seconds default freeze
          sourcePath: selectedClip.sourcePath,
          sourceType: selectedClip.sourceType,
          sourceId: selectedClip.sourceId,
          filters: selectedClip.filters,
        }),
      });
      refreshProject();
      toast.success("Freeze frame created (2s)");
    } catch { toast.error("Failed to create freeze frame"); }
  }, [selectedClip, tracks, playheadMs, project.id, refreshProject, pushUndo]);

  // ── Set In/Out Points ──
  const setIn = useCallback(() => { setInPoint(playheadMs); toast.success(`In: ${formatTime(playheadMs)}`); }, [playheadMs]);
  const setOut = useCallback(() => { setOutPoint(playheadMs); toast.success(`Out: ${formatTime(playheadMs)}`); }, [playheadMs]);
  const clearInOut = useCallback(() => { setInPoint(null); setOutPoint(null); toast("In/Out cleared"); }, []);

  // ── Audio Ducking — lower music/sfx when voice clips are playing ──
  const applyDucking = useCallback(async () => {
    pushUndo();
    const voiceTracks = tracks.filter(t => t.type === "audio" && t.name?.toLowerCase().includes("dial"));
    const musicTracks = tracks.filter(t => t.type === "audio" && !t.name?.toLowerCase().includes("dial"));

    // If no labelled tracks, use first audio track as voice, rest as music
    const voiceClips = voiceTracks.length > 0
      ? voiceTracks.flatMap(t => t.clips)
      : (tracks.filter(t => t.type === "audio").length > 0
        ? tracks.filter(t => t.type === "audio")[0].clips
        : []);
    const musicClipsToUpdate = musicTracks.length > 0
      ? musicTracks.flatMap(t => t.clips)
      : (tracks.filter(t => t.type === "audio").length > 1
        ? tracks.filter(t => t.type === "audio").slice(1).flatMap(t => t.clips)
        : []);

    if (voiceClips.length === 0 || musicClipsToUpdate.length === 0) {
      toast.info("Need at least one voice and one music/SFX track for ducking");
      return;
    }

    let ducked = 0;
    for (const mc of musicClipsToUpdate) {
      // Check if any voice clip overlaps with this music clip
      const overlaps = voiceClips.some(vc =>
        vc.startMs < mc.startMs + mc.durationMs && vc.startMs + vc.durationMs > mc.startMs
      );
      if (overlaps && mc.volume > 0.3) {
        await fetch(`/api/video-editor/clips/${mc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ volume: 0.2 }),
        });
        ducked++;
      }
    }
    refreshProject();
    toast.success(`Ducking applied: ${ducked} clips lowered to 20% volume`);
  }, [tracks, refreshProject, pushUndo]);

  // Auto-Animatic Build action
  const handleAutoBuild = useCallback(async () => {
    setBuilderLoading(true);
    setBuilderResult(null);
    try {
      const res = await fetch("/api/video-editor/auto-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorProjectId: project.id,
          projectId: Number(projectId),
          sceneIds: builderSelectedScenes.length > 0 ? builderSelectedScenes : [],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Build failed");
      }
      const result = await res.json();
      setBuilderResult(result);
      refreshProject();
      fetchMedia();
      toast.success(`Animatic built: ${result.clipsCreated} clips, ${formatTime(result.totalDurationMs)}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Build failed");
    } finally {
      setBuilderLoading(false);
      setBuilderConfirmOpen(false);
    }
  }, [project.id, projectId, builderSelectedScenes, refreshProject, fetchMedia]);

  // ── Track operations ──
  const addTrack = useCallback(async () => {
    if (!newTrackName.trim()) return;
    try {
      await fetch("/api/video-editor/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorProjectId: project.id,
          type: newTrackType,
          name: newTrackName.trim(),
          sortOrder: tracks.length,
        }),
      });
      setAddTrackDialogOpen(false);
      setNewTrackName("");
      refreshProject();
    } catch {
      toast.error("Failed to add track");
    }
  }, [newTrackName, newTrackType, project.id, tracks.length, refreshProject]);

  const deleteTrack = useCallback(async (trackId: number) => {
    try {
      await fetch(`/api/video-editor/tracks/${trackId}`, { method: "DELETE" });
      refreshProject();
      toast.success("Track deleted");
    } catch {
      toast.error("Delete failed");
    }
  }, [refreshProject]);

  const toggleTrackMute = useCallback(async (trackId: number, currentMuted: boolean) => {
    try {
      await fetch(`/api/video-editor/tracks/${trackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: !currentMuted }),
      });
      refreshProject();
    } catch {}
  }, [refreshProject]);

  const toggleTrackLock = useCallback(async (trackId: number, currentLocked: boolean) => {
    try {
      await fetch(`/api/video-editor/tracks/${trackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !currentLocked }),
      });
      refreshProject();
    } catch {}
  }, [refreshProject]);

  // ── Clip operations ──

  const addClipFromDrive = useCallback(async (file: DriveFile, trackId: number) => {
    const isVideo = file.mimeType.startsWith("video/");
    const isAudio = file.mimeType.startsWith("audio/");
    const isImage = file.mimeType.startsWith("image/");

    const type = isVideo ? "video" : isAudio ? "audio" : isImage ? "image" : "video";
    const defaultDuration = isImage ? 5000 : 10000; // images default 5s, others 10s

    try {
      await fetch("/api/video-editor/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId,
          editorProjectId: project.id,
          type,
          name: file.filename,
          startMs: getTrackEndMs(trackId),
          durationMs: defaultDuration,
          sourcePath: file.storagePath,
          sourceType: "drive",
          sourceId: file.id,
        }),
      });
      const freshRes = await fetch(`/api/video-editor/projects/${project.id}`);
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        setTracks(freshData.tracks || []);
        onUpdate(freshData);
        // Calculate waveform for audio clips in background
        if (isAudio) {
          const newClips = (freshData.tracks || []).flatMap((t: Track) => t.clips);
          const newClip = newClips.find((c: Clip) => c.sourcePath === file.storagePath && !c.waveformData);
          if (newClip) computeAndSaveWaveform(newClip.id, `/api/storage/${file.storagePath}`);
        }
      }
      toast.success(`Added "${file.filename}" to timeline`);
    } catch {
      toast.error("Failed to add clip");
    }
  }, [project.id, refreshProject, onUpdate, tracks]);

  const getTrackEndMs = useCallback((trackId: number): number => {
    const track = tracks.find(t => t.id === trackId);
    if (!track || track.clips.length === 0) return 0;
    return Math.max(...track.clips.map(c => c.startMs + c.durationMs));
  }, [tracks]);

  // Optimistic local clip update (instant canvas feedback, no API call)
  const updateClipLocal = useCallback((clipId: number, data: Record<string, unknown>) => {
    setTracks(prev => prev.map(t => ({
      ...t,
      clips: t.clips.map(c => c.id === clipId ? { ...c, ...data } : c)
    })));
  }, []);

  // Calculate waveform and persist to DB (runs in background, no await needed)
  const computeAndSaveWaveform = useCallback((clipId: number, audioUrl: string) => {
    calculateWaveform(audioUrl, 80).then(peaks => {
      const json = JSON.stringify(peaks);
      updateClipLocal(clipId, { waveformData: json });
      fetch(`/api/video-editor/clips/${clipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waveformData: json }),
      }).catch(() => {});
    }).catch(() => {});
  }, [updateClipLocal]);

  // Auto-compute waveforms for clips that don't have them
  useEffect(() => {
    const allClips = tracks.flatMap(t => t.clips);
    for (const clip of allClips) {
      if (!clip.waveformData && clip.sourcePath && (clip.type === "audio" || clip.type === "video")) {
        computeAndSaveWaveform(clip.id, `/api/storage/${clip.sourcePath}`);
      }
    }
  }, [tracks, computeAndSaveWaveform]);

  // Debounced filter update: instant local + 300ms-debounced API persist
  const updateClipFilters = useCallback((clipId: number, filters: FilterConfig[]) => {
    const json = JSON.stringify(filters);
    updateClipLocal(clipId, { filters: json });
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      fetch(`/api/video-editor/clips/${clipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: json }),
      }).catch(() => toast.error("Failed to save filters"));
    }, 300);
  }, [updateClipLocal]);

  const setClipTransition = useCallback((clipId: number, type: TransitionConfig["type"]) => {
    const config: TransitionConfig = { type, durationMs: 500 };
    const json = type === "none" ? null : JSON.stringify(config);
    updateClipLocal(clipId, { transition: json });
    fetch(`/api/video-editor/clips/${clipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transition: json }),
    }).catch(() => toast.error("Failed to save transition"));
    setTransitionMenu(null);
  }, [updateClipLocal]);

  // AI Color Match — suggest filters based on scene color data
  const handleAiColorMatch = useCallback(async () => {
    if (!selectedClip) return;
    setAiColorLoading(true);
    try {
      const res = await fetch("/api/video-editor/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "color-match",
          projectId,
          currentFilters: selectedClip.filters,
        }),
      });
      if (!res.ok) throw new Error("AI request failed");
      const data = await res.json();
      if (data.filters && Array.isArray(data.filters)) {
        updateClipFilters(selectedClip.id, data.filters);
        toast.success(`Applied: ${data.presetName || "AI Color Match"}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI Color Match failed");
    } finally {
      setAiColorLoading(false);
    }
  }, [selectedClip, projectId, updateClipFilters]);

  // Auto-subtitles from DB voice generations
  const handleDbSubtitles = useCallback(async () => {
    if (!project) return;
    setSubtitlesLoading(true);
    try {
      const res = await fetch("/api/video-editor/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "db-subtitles",
          projectId,
          editorProjectId: project.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate subtitles");
      const data = await res.json();
      if (!data.subtitles || data.subtitles.length === 0) {
        toast.info("No voice generations found for subtitles");
        return;
      }

      // Find or create T1 text track
      let textTrack = tracks.find(t => t.type === "text");
      if (!textTrack) {
        const createRes = await fetch("/api/video-editor/tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editorProjectId: project.id,
            type: "text",
            name: "T1 - Subtitles",
            sortOrder: tracks.length,
          }),
        });
        if (createRes.ok) {
          await refreshProject();
          textTrack = tracks.find(t => t.type === "text");
        }
      }

      if (!textTrack) {
        toast.error("Could not find text track");
        return;
      }

      // Create subtitle clips
      let created = 0;
      for (const sub of data.subtitles) {
        await fetch("/api/video-editor/clips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackId: textTrack.id,
            editorProjectId: project.id,
            type: "text",
            name: `${sub.character}: ${sub.text.slice(0, 30)}`,
            startMs: sub.startMs,
            durationMs: sub.durationMs,
            textContent: sub.character !== "Unknown" ? `${sub.character}: ${sub.text}` : sub.text,
            textStyle: JSON.stringify({
              fontSize: 18,
              color: "#ffffff",
              background: "rgba(0,0,0,0.7)",
              position: "bottom-center",
            }),
          }),
        });
        created++;
      }
      await refreshProject();
      toast.success(`Created ${created} subtitle clips`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Subtitle generation failed");
    } finally {
      setSubtitlesLoading(false);
    }
  }, [project, projectId, tracks, refreshProject]);

  const addTextClip = useCallback(async (trackId: number) => {
    if (!textClipContent.trim()) return;
    try {
      await fetch("/api/video-editor/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId,
          editorProjectId: project.id,
          type: "text",
          name: "Text",
          startMs: playheadMs,
          durationMs: 3000,
          textContent: textClipContent.trim(),
          textStyle: JSON.stringify({
            fontSize: 48,
            color: "#ffffff",
            fontFamily: "sans-serif",
            position: "bottom-center",
            background: "rgba(0,0,0,0.7)",
          }),
        }),
      });
      setTextClipContent("");
      refreshProject();
      toast.success("Text clip added");
    } catch {
      toast.error("Failed to add text clip");
    }
  }, [project.id, playheadMs, textClipContent, refreshProject]);

  const deleteClip = useCallback(async (clipId: number) => {
    try {
      await fetch(`/api/video-editor/clips/${clipId}`, { method: "DELETE" });
      if (selectedClipId === clipId) setSelectedClipId(null);
      refreshProject();
    } catch {
      toast.error("Delete failed");
    }
  }, [selectedClipId, refreshProject]);

  const updateClip = useCallback(async (clipId: number, data: Record<string, unknown>) => {
    try {
      await fetch(`/api/video-editor/clips/${clipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      refreshProject();
    } catch {
      toast.error("Update failed");
    }
  }, [refreshProject]);

  // Split clip at playhead
  const splitClipAtPlayhead = useCallback(async () => {
    if (!selectedClip) return;
    const relativeMs = playheadMs - selectedClip.startMs;
    if (relativeMs <= 0 || relativeMs >= selectedClip.durationMs) {
      toast.error("Playhead must be within the selected clip");
      return;
    }

    // Shorten original clip
    await updateClip(selectedClip.id, { durationMs: relativeMs });

    // Create new clip starting at playhead
    try {
      await fetch("/api/video-editor/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: selectedClip.trackId,
          editorProjectId: project.id,
          type: selectedClip.type,
          name: selectedClip.name ? `${selectedClip.name} (split)` : "Split clip",
          startMs: playheadMs,
          durationMs: selectedClip.durationMs - relativeMs,
          sourceStartMs: selectedClip.sourceStartMs + relativeMs,
          sourceEndMs: selectedClip.sourceEndMs,
          sourcePath: selectedClip.sourcePath,
          sourceType: selectedClip.sourceType,
          sourceId: selectedClip.sourceId,
          volume: selectedClip.volume,
          opacity: selectedClip.opacity,
          playbackRate: selectedClip.playbackRate,
        }),
      });
      refreshProject();
      toast.success("Clip split");
    } catch {
      toast.error("Split failed");
    }
  }, [selectedClip, playheadMs, project.id, updateClip, refreshProject]);

  // Duplicate clip
  const duplicateClip = useCallback(async () => {
    if (!selectedClip) return;
    try {
      await fetch("/api/video-editor/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: selectedClip.trackId,
          editorProjectId: project.id,
          type: selectedClip.type,
          name: selectedClip.name ? `${selectedClip.name} (copy)` : "Copy",
          startMs: selectedClip.startMs + selectedClip.durationMs,
          durationMs: selectedClip.durationMs,
          sourceStartMs: selectedClip.sourceStartMs,
          sourceEndMs: selectedClip.sourceEndMs,
          sourcePath: selectedClip.sourcePath,
          sourceType: selectedClip.sourceType,
          sourceId: selectedClip.sourceId,
          volume: selectedClip.volume,
          opacity: selectedClip.opacity,
          playbackRate: selectedClip.playbackRate,
          textContent: selectedClip.textContent,
          textStyle: selectedClip.textStyle,
        }),
      });
      refreshProject();
      toast.success("Clip duplicated");
    } catch {
      toast.error("Duplicate failed");
    }
  }, [selectedClip, project.id, refreshProject]);

  // ── Render / Export ──
  const handleServerRender = useCallback(async () => {
    setRenderingProgress(0);
    try {
      const res = await fetch("/api/video-editor/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editorProjectId: project.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Render failed");
      }
      const result = await res.json();
      setRenderingProgress(100);
      refreshProject();
      toast.success("Render complete!");

      if (result.outputPath) {
        const link = document.createElement("a");
        link.href = `/api/storage/${result.outputPath}`;
        link.download = `${project.title || "export"}.mp4`;
        link.click();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Render failed");
    } finally {
      setTimeout(() => setRenderingProgress(null), 3000);
    }
  }, [project.id, project.title, refreshProject]);

  const handleRender = useCallback(() => {
    handleServerRender();
    setExportDialogOpen(false);
  }, [handleServerRender]);

  // ── AI Director ──
  const sendAiDirectorMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;
    const userMsg = { role: "user" as const, content: message };
    setAiDirectorMessages(prev => [...prev, userMsg]);
    setAiDirectorInput("");
    setAiDirectorLoading(true);

    try {
      const res = await fetch("/api/video-editor/ai-director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          editorProjectId: project.id,
          projectId: projectId,
          history: aiDirectorMessages.slice(-10),
          context: {
            tracks: tracks.map(t => ({
              id: t.id, type: t.type, name: t.name,
              clipCount: t.clips.length,
              clips: t.clips.map(c => ({
                id: c.id, type: c.type, name: c.name,
                startMs: c.startMs, durationMs: c.durationMs,
                sourcePath: c.sourcePath ? true : false,
              })),
            })),
            totalDurationMs,
            resolution: `${project.width}x${project.height}`,
            fps: project.fps,
          },
        }),
      });

      if (!res.ok) throw new Error("AI Director request failed");
      const data = await res.json();

      setAiDirectorMessages(prev => [...prev, {
        role: "assistant",
        content: data.message || data.response || "Done.",
      }]);

      // If the AI made changes, refresh the project
      if (data.actionsExecuted && data.actionsExecuted > 0) {
        refreshProject();
        toast.success(`AI Director executed ${data.actionsExecuted} action(s)`);
      }
    } catch (err: unknown) {
      setAiDirectorMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Request failed"}`,
      }]);
    } finally {
      setAiDirectorLoading(false);
    }
  }, [project.id, projectId, aiDirectorMessages, tracks, totalDurationMs, project.width, project.height, project.fps, refreshProject]);

  // ── AI Features ──
  const handleAiAction = useCallback(async () => {
    if (!aiPrompt.trim() && aiAction !== "generate-subtitles") return;
    setAiLoading(true);
    setAiResults([]);
    try {
      const res = await fetch("/api/video-editor/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: aiAction,
          prompt: aiAction === "generate-subtitles" ? subtitleText : aiPrompt,
          context: `Project: ${project.title}, Duration: ${formatTime(totalDurationMs)}`,
        }),
      });
      if (!res.ok) throw new Error("AI request failed");
      const data = await res.json();
      setAiResults(data.suggestions || data.subtitles || data.scenes || [data]);
      toast.success("AI analysis complete");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, aiAction, subtitleText, project.title, totalDurationMs]);

  // Add subtitle clips from AI results
  const applySubtitles = useCallback(async () => {
    const textTrack = tracks.find(t => t.type === "text");
    let targetTrackId = textTrack?.id;

    if (!targetTrackId) {
      // Create a text track
      const res = await fetch("/api/video-editor/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorProjectId: project.id,
          type: "text",
          name: "Subtitles",
          sortOrder: tracks.length,
        }),
      });
      if (res.ok) {
        const track = await res.json();
        targetTrackId = track.id;
      }
    }
    if (!targetTrackId) return;

    for (const sub of aiResults as Array<{ startMs: number; endMs: number; text: string }>) {
      if (sub.startMs !== undefined && sub.text) {
        await fetch("/api/video-editor/clips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackId: targetTrackId,
            editorProjectId: project.id,
            type: "subtitle",
            name: "Subtitle",
            startMs: sub.startMs,
            durationMs: (sub.endMs || sub.startMs + 2000) - sub.startMs,
            textContent: sub.text,
            textStyle: JSON.stringify({
              fontSize: 32,
              color: "#ffffff",
              background: "rgba(0,0,0,0.75)",
              position: "bottom-center",
            }),
          }),
        });
      }
    }
    refreshProject();
    toast.success("Subtitles applied to timeline");
  }, [aiResults, tracks, project.id, refreshProject]);

  // Add voice generation clip to audio track
  const addVoiceClip = useCallback(async (voice: VoiceGenMedia) => {
    const audioTrack = tracks.find(t => t.type === "audio");
    if (!audioTrack) { toast.error("No audio track available"); return; }
    const storagePath = voice.paddedStoragePath || voice.storagePath;
    const clipName = `${voice.character}: ${voice.inputText.slice(0, 40)}`;
    try {
      await fetch("/api/video-editor/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: audioTrack.id,
          editorProjectId: project.id,
          type: "audio",
          name: clipName,
          startMs: getTrackEndMs(audioTrack.id),
          durationMs: voice.durationMs || 3000,
          sourcePath: storagePath,
          sourceType: "voice_generation",
          sourceId: voice.id,
        }),
      });
      // Refresh and compute waveform
      const freshRes = await fetch(`/api/video-editor/projects/${project.id}`);
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        setTracks(freshData.tracks || []);
        onUpdate(freshData);
        const allClips = (freshData.tracks || []).flatMap((t: Track) => t.clips);
        const newClip = allClips.find((c: Clip) => c.sourcePath === storagePath && !c.waveformData);
        if (newClip) computeAndSaveWaveform(newClip.id, `/api/storage/${storagePath}`);
      }
      toast.success(`Added "${voice.character}" voice clip`);
    } catch {
      toast.error("Failed to add voice clip");
    }
  }, [tracks, project.id, getTrackEndMs, refreshProject, onUpdate, computeAndSaveWaveform]);

  // Add image/video generation clip
  const addGenerationClip = useCallback(async (
    storagePath: string, name: string, type: "video" | "image",
    sourceType: string, sourceId: number, durationMs?: number | null,
  ) => {
    const targetTrack = tracks.find(t => t.type === "video");
    if (!targetTrack) { toast.error("No video track available"); return; }
    try {
      await fetch("/api/video-editor/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: targetTrack.id,
          editorProjectId: project.id,
          type,
          name,
          startMs: getTrackEndMs(targetTrack.id),
          durationMs: durationMs || (type === "image" ? 5000 : 10000),
          sourcePath: storagePath,
          sourceType,
          sourceId,
        }),
      });
      refreshProject();
      toast.success(`Added "${name}" to timeline`);
    } catch {
      toast.error("Failed to add clip");
    }
  }, [tracks, project.id, getTrackEndMs, refreshProject]);

  // Add audio studio generation clip
  const addAudioGenClip = useCallback(async (audio: AudioGenMedia) => {
    const audioTrack = tracks.find(t => t.type === "audio");
    if (!audioTrack) { toast.error("No audio track available"); return; }
    try {
      await fetch("/api/video-editor/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: audioTrack.id,
          editorProjectId: project.id,
          type: "audio",
          name: audio.prompt.slice(0, 40),
          startMs: getTrackEndMs(audioTrack.id),
          durationMs: (audio.durationSeconds || 10) * 1000,
          sourcePath: audio.storagePath,
          sourceType: "audio-studio",
          sourceId: audio.id,
        }),
      });
      refreshProject();
      toast.success("Added audio clip");
    } catch {
      toast.error("Failed to add audio clip");
    }
  }, [tracks, project.id, getTrackEndMs, refreshProject]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ": e.preventDefault(); playPause(); break;
        case "Delete":
        case "Backspace":
          e.preventDefault(); deleteSelectedClips();
          break;
        case "z":
          if (e.metaKey || e.ctrlKey) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
          break;
        case "y":
          if (e.metaKey || e.ctrlKey) { e.preventDefault(); redo(); }
          break;
        case "r":
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); setRazorMode(prev => !prev); }
          break;
        case "m":
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); setMagneticTimeline(prev => !prev); }
          break;
        case "f":
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); zoomToFit(); }
          break;
        case "Escape":
          setSelectedClipId(null); setSelectedClipIds(new Set()); setRazorMode(false); setTransitionMenu(null);
          break;
        case "a":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            const allIds = new Set(tracks.flatMap(t => t.clips.map(c => c.id)));
            setSelectedClipIds(allIds);
          }
          break;
        case "s":
          if (e.metaKey || e.ctrlKey) { e.preventDefault(); toast.success("Project saved"); }
          else { e.preventDefault(); splitClipAtPlayhead(); }
          break;
        case "d":
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); duplicateClip(); }
          break;
        case "j": // Rewind 5s
          e.preventDefault();
          setPlayheadMs(prev => Math.max(0, prev - 5000));
          break;
        case "k": // Play/Pause (same as space)
          e.preventDefault();
          playPause();
          break;
        case "l": // Forward 5s
          e.preventDefault();
          setPlayheadMs(prev => Math.min(prev + 5000, totalDurationMs));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setPlayheadMs(prev => Math.max(0, prev - (e.shiftKey ? 1000 : 100)));
          break;
        case "ArrowRight":
          e.preventDefault();
          setPlayheadMs(prev => Math.min(prev + (e.shiftKey ? 1000 : 100), totalDurationMs));
          break;
        case "Home":
          e.preventDefault();
          setPlayheadMs(0);
          break;
        case "End":
          e.preventDefault();
          setPlayheadMs(totalDurationMs);
          break;
        case "i": // Set In point
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); setIn(); }
          break;
        case "o": // Set Out point
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); setOut(); }
          break;
        case "p": // Toggle loop
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); setLoopPlayback(prev => !prev); toast(loopPlayback ? "Loop off" : "Loop on"); }
          break;
        case "n": // Add marker
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); addMarker(); }
          break;
        case "g": // Freeze frame
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); freezeFrame(); }
          break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [playPause, selectedClipId, deleteSelectedClips, splitClipAtPlayhead, duplicateClip, totalDurationMs, undo, redo, zoomToFit, tracks, setIn, setOut, loopPlayback, addMarker, freezeFrame]);

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      {/* ── Top Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 backdrop-blur-sm bg-card/80 shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <span className="font-medium text-sm truncate max-w-[200px]">{project.title}</span>
        <Select
          value={`${project.width}x${project.height}`}
          onValueChange={async (val) => {
            const [w, h] = val.split("x").map(Number);
            try {
              await fetch(`/api/video-editor/projects/${project.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ width: w, height: h }),
              });
              refreshProject();
              toast.success(`Format changed to ${w}×${h}`);
            } catch { toast.error("Failed to change format"); }
          }}
        >
          <SelectTrigger className="h-7 w-auto text-xs gap-1 px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMAT_PRESETS.map(f => (
              <SelectItem key={`${f.width}x${f.height}`} value={`${f.width}x${f.height}`}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">{project.fps}fps</Badge>
        <div className="flex-1" />

        {/* Edit tools */}
        {/* UX AUDIT FIX: added aria-label to icon-only toolbar buttons */}
        <Button variant="ghost" size="sm" onClick={splitClipAtPlayhead} disabled={!selectedClip} title="Split at playhead (S)" aria-label="Split clip at playhead">
          <Scissors className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={duplicateClip} disabled={!selectedClip} title="Duplicate clip" aria-label="Duplicate clip">
          <Copy className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => selectedClipId && deleteClip(selectedClipId)} disabled={!selectedClip} title="Delete clip" aria-label="Delete clip">
          <Trash className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Render / Export */}
        {renderingProgress !== null ? (
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${renderingProgress}%` }} />
            </div>
            <span className="text-xs">{renderingProgress}%</span>
          </div>
        ) : (
          <Button size="sm" onClick={() => setExportDialogOpen(true)} disabled={tracks.every(t => t.clips.length === 0)}>
            <Export className="w-4 h-4 mr-1" /> Export
          </Button>
        )}

        {project.outputPath && (
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/storage/${project.outputPath}`} download={`${project.title}.mp4`}>
              <DownloadSimple className="w-4 h-4 mr-1" /> Download
            </a>
          </Button>
        )}

        {/* Export Subtitles */}
        <Button size="sm" variant="ghost" title="Export subtitles as SRT"
          disabled={tracks.flatMap(t => t.clips).filter(c => c.type === "text" || c.type === "subtitle").length === 0}
          onClick={() => {
            const textClips = tracks.flatMap(t => t.clips)
              .filter(c => (c.type === "text" || c.type === "subtitle") && c.textContent)
              .sort((a, b) => a.startMs - b.startMs);
            if (textClips.length === 0) { toast.error("No text/subtitle clips to export"); return; }
            const srt = textClips.map((clip, i) => {
              const startH = Math.floor(clip.startMs / 3600000);
              const startM = Math.floor((clip.startMs % 3600000) / 60000);
              const startS = Math.floor((clip.startMs % 60000) / 1000);
              const startMs = clip.startMs % 1000;
              const endMs = clip.startMs + clip.durationMs;
              const endH = Math.floor(endMs / 3600000);
              const endM = Math.floor((endMs % 3600000) / 60000);
              const endS = Math.floor((endMs % 60000) / 1000);
              const endMsR = endMs % 1000;
              return `${i + 1}\n${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}:${String(startS).padStart(2, "0")},${String(startMs).padStart(3, "0")} --> ${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:${String(endS).padStart(2, "0")},${String(endMsR).padStart(3, "0")}\n${clip.textContent}`;
            }).join("\n\n");
            const blob = new Blob([srt], { type: "text/srt" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `${project.title}.srt`; a.click();
            URL.revokeObjectURL(url);
            toast.success("SRT exported");
          }}>
          <TextT className="w-4 h-4 mr-1" /> SRT
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button
          size="sm"
          variant={aiDirectorOpen ? "default" : "outline"}
          onClick={() => setAiDirectorOpen(!aiDirectorOpen)}
          title="AI Director — describe your idea and AI builds the edit"
        >
          <ChatCircleDots className="w-4 h-4 mr-1" /> AI Director
        </Button>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Preview + Properties Panel ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Remotion Player Preview */}
          <div className="flex-1 flex items-center justify-center bg-black relative min-h-[200px] ring-1 ring-border/20 shadow-[inset_0_0_30px_var(--glow-primary)]">
            <RemotionPlayer
              ref={playerRef}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              component={TimelineComposition as any}
              inputProps={{ tracks }}
              durationInFrames={Math.max(1, Math.ceil((totalDurationMs / 1000) * (project.fps || 30)))}
              fps={project.fps || 30}
              compositionWidth={project.width}
              compositionHeight={project.height}
              style={{
                width: "100%",
                maxHeight: "100%",
                aspectRatio: `${project.width}/${project.height}`,
              }}
              controls={false}
              loop={loopPlayback}
              clickToPlay={false}
            />
            {/* Remotion badge */}
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 rounded px-1.5 py-0.5">
              <MonitorPlay className="w-3 h-3 text-primary" />
              <span className="text-[9px] text-zinc-300 font-medium">Remotion</span>
            </div>
          </div>

          {/* Transport Controls */}
          {/* UX AUDIT FIX: added aria-label to icon-only transport buttons */}
          <div className="flex items-center gap-3 px-4 py-2 border-t border-border/40 backdrop-blur-sm bg-card/80 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setPlayheadMs(0)} title="Go to start" aria-label="Go to start">
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={playPause} title="Play/Pause (Space)" aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPlayheadMs(totalDurationMs)} title="Go to end" aria-label="Go to end">
              <SkipForward className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            {/* In/Out/Loop controls */}
            <Button size="icon" variant={inPoint !== null ? "secondary" : "ghost"} className="h-7 w-7" onClick={setIn} title="Set In Point (I)">
              <ArrowUUpLeft className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant={outPoint !== null ? "secondary" : "ghost"} className="h-7 w-7" onClick={setOut} title="Set Out Point (O)">
              <ArrowUUpRight className="w-3.5 h-3.5" />
            </Button>
            {(inPoint !== null || outPoint !== null) && (
              <button className="text-[9px] text-muted-foreground hover:text-foreground" onClick={clearInOut}>Clear</button>
            )}
            <Button size="icon" variant={loopPlayback ? "default" : "ghost"} className="h-7 w-7" onClick={() => setLoopPlayback(!loopPlayback)} title="Loop (P)">
              <Repeat className="w-3.5 h-3.5" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <span className="font-mono text-sm tabular-nums min-w-[80px]">{formatTime(playheadMs)}</span>
            <span className="text-xs text-muted-foreground">/ {formatTime(totalDurationMs)}</span>
            <Separator orientation="vertical" className="h-6" />
            {/* Editing tools */}
            <Button size="icon" variant={razorMode ? "default" : "ghost"} className="h-7 w-7" onClick={() => setRazorMode(!razorMode)} title="Razor (R)">
              <Crosshair className="w-4 h-4" />
            </Button>
            <Button size="icon" variant={magneticTimeline ? "default" : "ghost"} className="h-7 w-7" onClick={() => { setMagneticTimeline(!magneticTimeline); if (!magneticTimeline) closeGaps(); }} title="Magnetic Timeline (M)">
              <MagnetStraight className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={zoomToFit} title="Zoom to Fit (F)">
              <ArrowsIn className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={undo} title="Undo (Ctrl+Z)">
              <ArrowCounterClockwise className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={redo} title="Redo (Ctrl+Y)">
              <ArrowClockwise className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addMarker()} title="Add Marker (N)">
              <Flag className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={freezeFrame} title="Freeze Frame (G)" disabled={!selectedClip || (selectedClip.type !== "video" && selectedClip.type !== "image")}>
              <Snowflake className="w-4 h-4" />
            </Button>
            <Button size="icon" variant={showMiniMap ? "secondary" : "ghost"} className="h-7 w-7" onClick={() => setShowMiniMap(!showMiniMap)} title="Toggle Mini-map">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="6" width="4" height="1.5" rx="0.5" fill="currentColor" /><rect x="8" y="7" width="3" height="1.5" rx="0.5" fill="currentColor" /><rect x="5" y="9" width="5" height="1.5" rx="0.5" fill="currentColor" /></svg>
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <MagnifyingGlassMinus className="w-3 h-3 text-muted-foreground" />
              <input
                type="range"
                min={20}
                max={400}
                value={timelineScale}
                onChange={(e) => setTimelineScale(Number(e.target.value))}
                className="w-24 h-1 accent-primary"
              />
              <MagnifyingGlassPlus className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="w-80 border-l border-border/40 backdrop-blur-sm bg-card/80 flex flex-col shrink-0 overflow-hidden">
          <Tabs value={activePanel} onValueChange={(v) => setActivePanel(v as typeof activePanel)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <TabsList className="w-full justify-start rounded-none border-b px-2 pt-1 bg-transparent">
              <TabsTrigger value="media" className="text-xs gap-1"><Stack className="w-3 h-3" /> Media</TabsTrigger>
              <TabsTrigger value="properties" className="text-xs gap-1"><GearSix className="w-3 h-3" /> Properties</TabsTrigger>
              <TabsTrigger value="ai" className="text-xs gap-1"><Sparkle className="w-3 h-3" /> AI Tools</TabsTrigger>
            </TabsList>

            <TabsContent value="media" className="flex-1 flex flex-col m-0 overflow-hidden min-h-0">
              {/* Media Pool Tabs with counters */}
              <div className="p-1.5 border-b">
                <div className="flex gap-0.5 overflow-x-auto">
                  {([
                    { key: "drive" as const, label: "Drive", count: driveFiles.length },
                    { key: "voices" as const, label: "Voices", count: voiceGenerations.length },
                    { key: "images" as const, label: "Images", count: imageGenerations.length },
                    { key: "videos" as const, label: "Videos", count: videoGenerations.length },
                    { key: "audio" as const, label: "Audio", count: audioGenerations.length },
                  ]).map(({ key, label, count }) => (
                    <Button
                      key={key}
                      variant={mediaTab === key ? "default" : "ghost"}
                      size="sm"
                      className="h-6 text-[10px] px-1.5 shrink-0"
                      onClick={() => setMediaTab(key)}
                    >
                      {label} ({count})
                    </Button>
                  ))}
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {mediaLoading ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Loading media...</p>
                  ) : (
                    <>
                      {/* Drive files tab */}
                      {mediaTab === "drive" && (driveFiles.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No files in Drive</p>
                      ) : driveFiles.map(file => (
                        <div key={file.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent group text-xs">
                          <span className="shrink-0">
                            {file.fileType === "video" ? <FilmStrip className="w-3.5 h-3.5 text-primary" /> :
                             file.fileType === "audio" ? <MusicNote className="w-3.5 h-3.5 text-accent" /> :
                             <Image className="w-3.5 h-3.5 text-primary/70" />}
                          </span>
                          <span className="truncate flex-1">{file.filename}</span>
                          <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                            {tracks.filter(t =>
                              (file.fileType === "video" && t.type === "video") ||
                              (file.fileType === "audio" && t.type === "audio") ||
                              (file.fileType === "image" && t.type === "video")
                            ).map(t => (
                              <Button key={t.id} size="sm" variant="ghost" className="h-5 px-1 text-[10px]"
                                onClick={() => addClipFromDrive(file, t.id)} title={`Add to ${t.name}`}>
                                <Plus className="w-3 h-3" />
                              </Button>
                            ))}
                          </div>
                        </div>
                      )))}

                      {/* Voices tab */}
                      {mediaTab === "voices" && (voiceGenerations.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No voice generations yet</p>
                      ) : voiceGenerations.map(v => (
                        <div key={v.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-accent group text-xs">
                          <MusicNote className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground">{v.character}</span>
                            <p className="text-[10px] text-muted-foreground truncate">{v.inputText.slice(0, 60)}</p>
                            <p className="text-[9px] text-muted-foreground/60">{v.sceneHeading}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={() => addVoiceClip(v)} title="Add to audio track">
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      )))}

                      {/* Images tab */}
                      {mediaTab === "images" && (imageGenerations.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No completed image generations</p>
                      ) : imageGenerations.map(img => (
                        <div key={img.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent group text-xs">
                          <Image className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                          <span className="truncate flex-1 text-[10px]">{img.prompt.slice(0, 50)}</span>
                          <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={() => img.storagePath && addGenerationClip(img.storagePath, img.prompt.slice(0, 40), "image", "image_generation", img.id)}
                            title="Add to video track">
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      )))}

                      {/* Videos tab */}
                      {mediaTab === "videos" && (videoGenerations.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No completed video generations</p>
                      ) : videoGenerations.map(vid => (
                        <div key={vid.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent group text-xs">
                          <FilmStrip className="w-3.5 h-3.5 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="truncate block text-[10px]">{vid.prompt.slice(0, 50)}</span>
                            {vid.durationMs && <span className="text-[9px] text-muted-foreground">{formatTime(vid.durationMs)}</span>}
                          </div>
                          <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={() => vid.storagePath && addGenerationClip(vid.storagePath, vid.prompt.slice(0, 40), "video", "video_generation", vid.id, vid.durationMs)}
                            title="Add to video track">
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      )))}

                      {/* Audio tab */}
                      {mediaTab === "audio" && (audioGenerations.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No audio studio generations</p>
                      ) : audioGenerations.map(aud => (
                        <div key={aud.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent group text-xs">
                          <MusicNote className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="truncate block text-[10px]">{aud.prompt.slice(0, 50)}</span>
                            <span className="text-[9px] text-muted-foreground">{aud.type}</span>
                          </div>
                          <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={() => addAudioGenClip(aud)} title="Add to audio track">
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      )))}
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="properties" className="flex-1 m-0 overflow-auto min-h-0">
              <div className="p-3 space-y-4">
                {selectedClip ? (
                  <>
                    <div>
                      <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Clip Properties</h4>
                      <div className="space-y-3">
                        {/* UX AUDIT FIX: replaced raw <label> with <Label htmlFor> for accessibility */}
                        <div>
                          <Label htmlFor="clip-name" className="text-xs text-muted-foreground">Name</Label>
                          <Input
                            id="clip-name"
                            value={selectedClip.name || ""}
                            onChange={(e) => updateClip(selectedClip.id, { name: e.target.value })}
                            className="h-7 text-xs mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="clip-start" className="text-xs text-muted-foreground">Start</Label>
                            <Input
                              id="clip-start"
                              type="number"
                              value={Math.round(selectedClip.startMs)}
                              onChange={(e) => updateClip(selectedClip.id, { startMs: Number(e.target.value) })}
                              className="h-7 text-xs mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="clip-duration" className="text-xs text-muted-foreground">Duration</Label>
                            <Input
                              id="clip-duration"
                              type="number"
                              value={Math.round(selectedClip.durationMs)}
                              onChange={(e) => updateClip(selectedClip.id, { durationMs: Number(e.target.value) })}
                              className="h-7 text-xs mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="clip-volume" className="text-xs text-muted-foreground">Volume ({Math.round(selectedClip.volume * 100)}%)</Label>
                          <input
                            id="clip-volume"
                            type="range"
                            min={0}
                            max={200}
                            value={selectedClip.volume * 100}
                            onChange={(e) => updateClip(selectedClip.id, { volume: Number(e.target.value) / 100 })}
                            className="w-full h-1 mt-1 accent-primary"
                          />
                        </div>
                        <div>
                          <Label htmlFor="clip-opacity" className="text-xs text-muted-foreground">Opacity ({Math.round(selectedClip.opacity * 100)}%)</Label>
                          <input
                            id="clip-opacity"
                            type="range"
                            min={0}
                            max={100}
                            value={selectedClip.opacity * 100}
                            onChange={(e) => updateClip(selectedClip.id, { opacity: Number(e.target.value) / 100 })}
                            className="w-full h-1 mt-1 accent-primary"
                          />
                        </div>
                        <div>
                          <Label htmlFor="clip-speed" className="text-xs text-muted-foreground">Speed ({selectedClip.playbackRate}x)</Label>
                          <input
                            id="clip-speed"
                            type="range"
                            min={25}
                            max={400}
                            value={selectedClip.playbackRate * 100}
                            onChange={(e) => updateClip(selectedClip.id, { playbackRate: Number(e.target.value) / 100 })}
                            className="w-full h-1 mt-1 accent-primary"
                          />
                        </div>
                        {/* PiP controls (video/image clips) */}
                        {(selectedClip.type === "video" || selectedClip.type === "image") && (() => {
                          const clipFilters = parseFilters(selectedClip.filters);
                          const getPipVal = (t: string, def: number) => clipFilters.find(f => f.type === t)?.value ?? def;
                          const setPipVal = (t: string, v: number) => {
                            const nf = clipFilters.filter(f => f.type !== t);
                            nf.push({ type: t, value: v });
                            updateClipFilters(selectedClip.id, nf);
                          };
                          return (
                            <div className="space-y-2 pt-2 border-t border-dashed">
                              <h4 className="text-[10px] font-medium text-muted-foreground uppercase">Position & Scale (PiP)</h4>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <div className="flex justify-between text-[10px] text-muted-foreground"><span>X Position</span><span>{getPipVal("pipX", 0)}%</span></div>
                                  <input type="range" min={0} max={100} value={getPipVal("pipX", 0)}
                                    onChange={(e) => setPipVal("pipX", Number(e.target.value))} className="w-full h-1 accent-primary" />
                                </div>
                                <div>
                                  <div className="flex justify-between text-[10px] text-muted-foreground"><span>Y Position</span><span>{getPipVal("pipY", 0)}%</span></div>
                                  <input type="range" min={0} max={100} value={getPipVal("pipY", 0)}
                                    onChange={(e) => setPipVal("pipY", Number(e.target.value))} className="w-full h-1 accent-primary" />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between text-[10px] text-muted-foreground"><span>Scale</span><span>{getPipVal("pipScale", 100)}%</span></div>
                                <input type="range" min={10} max={100} value={getPipVal("pipScale", 100)}
                                  onChange={(e) => setPipVal("pipScale", Number(e.target.value))} className="w-full h-1 accent-primary" />
                              </div>
                              <div className="flex gap-1">
                                {[
                                  { label: "Full", x: 0, y: 0, s: 100 },
                                  { label: "PiP TL", x: 3, y: 5, s: 33 },
                                  { label: "PiP TR", x: 97, y: 5, s: 33 },
                                  { label: "PiP BL", x: 3, y: 95, s: 33 },
                                  { label: "PiP BR", x: 97, y: 95, s: 33 },
                                ].map(preset => (
                                  <Button key={preset.label} size="sm" variant="outline" className="flex-1 text-[9px] h-6 px-1"
                                    onClick={() => {
                                      const nf = clipFilters.filter(f => !f.type.startsWith("pip"));
                                      nf.push({ type: "pipX", value: preset.x }, { type: "pipY", value: preset.y }, { type: "pipScale", value: preset.s });
                                      updateClipFilters(selectedClip.id, nf);
                                    }}>
                                    {preset.label}
                                  </Button>
                                ))}
                              </div>
                              {/* Split Screen Region */}
                              <div className="pt-2 border-t border-dashed mt-2">
                                <h4 className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Split Screen</h4>
                                <div className="grid grid-cols-5 gap-1">
                                  {[
                                    { label: "None", v: 0 },
                                    { label: "L½", v: 1 }, { label: "R½", v: 2 },
                                    { label: "T½", v: 3 }, { label: "B½", v: 4 },
                                    { label: "TL¼", v: 5 }, { label: "TR¼", v: 6 },
                                    { label: "BL¼", v: 7 }, { label: "BR¼", v: 8 },
                                  ].map(opt => (
                                    <Button key={opt.v} size="sm" variant={getPipVal("splitRegion", 0) === opt.v ? "default" : "outline"}
                                      className="text-[8px] h-5 px-0.5"
                                      onClick={() => setPipVal("splitRegion", opt.v)}>
                                      {opt.label}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        {selectedClip.type === "text" || selectedClip.type === "subtitle" ? (() => {
                          const style = selectedClip.textStyle ? JSON.parse(selectedClip.textStyle) : {};
                          const updateStyle = (key: string, value: unknown) => {
                            const updated = { ...style, [key]: value };
                            updateClip(selectedClip.id, { textStyle: JSON.stringify(updated) });
                          };
                          return (
                            <div className="space-y-2">
                              <Label htmlFor="clip-text" className="text-xs text-muted-foreground">Text Content</Label>
                              <Textarea
                                id="clip-text"
                                value={selectedClip.textContent || ""}
                                onChange={(e) => updateClip(selectedClip.id, { textContent: e.target.value })}
                                className="text-xs"
                                rows={3}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Font Size</Label>
                                  <Input type="number" value={style.fontSize || 32} min={8} max={200}
                                    onChange={(e) => updateStyle("fontSize", Number(e.target.value))} className="h-7 text-xs mt-0.5" />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Position</Label>
                                  <Select value={style.position || "bottom-center"} onValueChange={(v) => updateStyle("position", v)}>
                                    <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {["top-left", "top-center", "top-right", "center", "bottom-left", "bottom-center", "bottom-right"].map(p => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Text Color</Label>
                                  <input type="color" value={style.color || "#ffffff"}
                                    onChange={(e) => updateStyle("color", e.target.value)}
                                    className="w-full h-7 mt-0.5 rounded cursor-pointer" />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">BG Color</Label>
                                  <input type="color" value={(style.background || "#000000").replace(/rgba?\([^)]+\)/, "#000000")}
                                    onChange={(e) => updateStyle("background", `${e.target.value}b3`)}
                                    className="w-full h-7 mt-0.5 rounded cursor-pointer" />
                                </div>
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Font</Label>
                                <Select value={style.fontFamily || "sans-serif"} onValueChange={(v) => updateStyle("fontFamily", v)}>
                                  <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {["sans-serif", "serif", "monospace", "Georgia", "Impact", "Courier New", "Trebuchet MS"].map(f => (
                                      <SelectItem key={f} value={f}>{f}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          );
                        })() : null}
                      </div>
                    </div>
                    <Separator />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={splitClipAtPlayhead}>
                        <Scissors className="w-3 h-3 mr-1" /> Split
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={duplicateClip}>
                        <Copy className="w-3 h-3 mr-1" /> Duplicate
                      </Button>
                    </div>

                    {/* ── Color & Look ── (visual clips only) */}
                    {selectedClip.type !== "text" && selectedClip.type !== "subtitle" && (() => {
                      const filters = parseFilters(selectedClip.filters);
                      const getVal = (type: string) => filters.find(f => f.type === type)?.value ?? 0;
                      const hasEffect = (type: string) => filters.some(f => f.type === type && f.value > 0);
                      const setFilter = (type: string, value: number) => {
                        const nf = filters.filter(f => f.type !== type);
                        if (value !== 0 || ["grain", "chromatic", "lensflare"].includes(type)) nf.push({ type, value });
                        updateClipFilters(selectedClip.id, nf);
                      };
                      const toggleEffect = (type: string, defaultVal: number) => {
                        if (hasEffect(type)) {
                          updateClipFilters(selectedClip.id, filters.filter(f => f.type !== type));
                        } else {
                          updateClipFilters(selectedClip.id, [...filters, { type, value: defaultVal }]);
                        }
                      };
                      const detectedPreset = (() => {
                        for (const [name, preset] of Object.entries(LUT_PRESETS)) {
                          const cp = preset.filter(f => !["grain", "chromatic", "lensflare"].includes(f.type));
                          const cf = filters.filter(f => !["grain", "chromatic", "lensflare"].includes(f.type));
                          if (cp.length === cf.length && cp.every(p => cf.some(c => c.type === p.type && c.value === p.value))) return name;
                        }
                        return "";
                      })();

                      return (
                        <>
                          <Separator />
                          <div>
                            <h4 className="text-xs font-medium mb-3 text-muted-foreground uppercase">Color & Look</h4>

                            {/* LUT Preset selector */}
                            <div className="flex gap-2 mb-3">
                              <Select value={detectedPreset} onValueChange={(name) => {
                                const preset = LUT_PRESETS[name];
                                if (!preset) return;
                                const efx = filters.filter(f => ["grain", "chromatic", "lensflare"].includes(f.type));
                                updateClipFilters(selectedClip.id, [...preset, ...efx]);
                              }}>
                                <SelectTrigger className="h-7 text-xs flex-1">
                                  <SelectValue placeholder="LUT Preset" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.keys(LUT_PRESETS).map(n => (
                                    <SelectItem key={n} value={n}>{n}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => {
                                const efx = filters.filter(f => ["grain", "chromatic", "lensflare"].includes(f.type));
                                updateClipFilters(selectedClip.id, efx);
                              }}>Clear</Button>
                            </div>

                            {/* Color sliders */}
                            {([
                              { type: "brightness", label: "Brightness", min: -100, max: 100 },
                              { type: "contrast", label: "Contrast", min: -100, max: 100 },
                              { type: "saturation", label: "Saturation", min: -100, max: 100 },
                              { type: "temperature", label: "Temperature", min: -100, max: 100 },
                            ] as const).map(({ type, label, min, max }) => (
                              <div key={type} className="mb-2">
                                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                                  <span>{label}</span>
                                  <span className="tabular-nums w-8 text-right">{getVal(type)}</span>
                                </div>
                                <input type="range" min={min} max={max} value={getVal(type)}
                                  onChange={(e) => setFilter(type, Number(e.target.value))}
                                  className="w-full h-1 accent-primary" />
                              </div>
                            ))}

                            <Separator className="my-3" />

                            {/* Post-processing effects */}
                            <h4 className="text-[10px] font-medium mb-2 text-muted-foreground uppercase">Effects</h4>
                            {([
                              { type: "grain", label: "Film Grain", max: 100, def: 30 },
                              { type: "chromatic", label: "Chromatic Ab.", max: 20, def: 5 },
                              { type: "lensflare", label: "Lens Flare", max: 100, def: 40 },
                              ...(selectedClip.type === "image" ? [{ type: "kenBurns" as const, label: "Ken Burns", max: 100, def: 50 }] : []),
                            ] as const).map(({ type, label, max, def }) => (
                              <div key={type} className="mb-2">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <input type="checkbox" checked={hasEffect(type)}
                                    onChange={() => toggleEffect(type, def)}
                                    className="accent-primary size-3" />
                                  <span className="text-[10px] text-muted-foreground flex-1">{label}</span>
                                  <span className="text-[10px] tabular-nums w-6 text-right text-muted-foreground">
                                    {hasEffect(type) ? getVal(type) : "—"}
                                  </span>
                                </div>
                                {hasEffect(type) && (
                                  <input type="range" min={0} max={max} value={getVal(type)}
                                    onChange={(e) => setFilter(type, Number(e.target.value))}
                                    className="w-full h-1 accent-primary ml-5" style={{ width: "calc(100% - 1.25rem)" }} />
                                )}
                              </div>
                            ))}

                            <Separator className="my-3" />

                            {/* Copy / Paste Grade */}
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 text-xs h-7"
                                onClick={() => { setCopiedGrade(filters); toast.success("Grade copied"); }}>
                                <Copy className="w-3 h-3 mr-1" /> Copy
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 text-xs h-7"
                                disabled={!copiedGrade}
                                onClick={() => { if (copiedGrade) { updateClipFilters(selectedClip.id, copiedGrade); toast.success("Grade pasted"); } }}>
                                Paste
                              </Button>
                            </div>

                            {/* AI Color Match */}
                            <Button size="sm" variant="outline" className="w-full text-xs h-7 mt-2"
                              disabled={aiColorLoading}
                              onClick={handleAiColorMatch}>
                              {aiColorLoading ? "Matching..." : "AI Color Match"}
                            </Button>

                            {/* Chroma Key (Green Screen) */}
                            {(selectedClip.type === "video" || selectedClip.type === "image") && (() => {
                              const chromaEnabled = hasEffect("chromaKey");
                              return (
                                <>
                                  <Separator className="my-3" />
                                  <h4 className="text-[10px] font-medium mb-2 text-muted-foreground uppercase">Chroma Key</h4>
                                  <div className="flex items-center gap-2 mb-1">
                                    <input type="checkbox" checked={chromaEnabled}
                                      onChange={() => {
                                        if (chromaEnabled) {
                                          updateClipFilters(selectedClip.id, filters.filter(f => !f.type.startsWith("chroma")));
                                        } else {
                                          updateClipFilters(selectedClip.id, [...filters,
                                            { type: "chromaKey", value: 1 },
                                            { type: "chromaTolerance", value: 30 },
                                          ]);
                                        }
                                      }}
                                      className="accent-primary size-3" />
                                    <span className="text-[10px] text-muted-foreground">Enable Green Screen</span>
                                  </div>
                                  {chromaEnabled && (
                                    <div className="space-y-1.5">
                                      <div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                          <span>Key Color</span>
                                        </div>
                                        <div className="flex gap-1 mt-0.5">
                                          {["#00ff00", "#0000ff", "#ff00ff", "#ffffff"].map(c => (
                                            <button key={c} className="w-5 h-5 rounded border border-zinc-600"
                                              style={{ backgroundColor: c }}
                                              onClick={() => {
                                                const nf = filters.filter(f => f.type !== "chromaColor");
                                                nf.push({ type: "chromaColor", value: parseInt(c.slice(1), 16) });
                                                updateClipFilters(selectedClip.id, nf);
                                              }}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                          <span>Tolerance</span>
                                          <span>{getVal("chromaTolerance")}%</span>
                                        </div>
                                        <input type="range" min={5} max={80} value={getVal("chromaTolerance")}
                                          onChange={(e) => setFilter("chromaTolerance", Number(e.target.value))}
                                          className="w-full h-1 accent-primary" />
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-8">
                    Select a clip to view properties
                  </div>
                )}

                <Separator />

                {/* Quick text clip add */}
                <div>
                  <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Add Text Overlay</h4>
                  {/* Title Templates */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {TITLE_TEMPLATES.map(tmpl => (
                      <button key={tmpl.name}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-border/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors truncate"
                        onClick={async () => {
                          const textTrack = tracks.find(t => t.type === "text") || tracks.find(t => t.type === "video");
                          if (!textTrack) { toast.error("No text track"); return; }
                          try {
                            await fetch("/api/video-editor/clips", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                trackId: textTrack.id,
                                editorProjectId: project.id,
                                type: "text",
                                name: tmpl.name,
                                startMs: playheadMs,
                                durationMs: 3000,
                                textContent: tmpl.name,
                                textStyle: JSON.stringify(tmpl.style),
                              }),
                            });
                            refreshProject();
                            toast.success(`Added "${tmpl.name}" template`);
                          } catch { toast.error("Failed to add title"); }
                        }}
                        title={`Add "${tmpl.name}" title template`}
                      >
                        {tmpl.name}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={textClipContent}
                    onChange={(e) => setTextClipContent(e.target.value)}
                    placeholder="Enter text for overlay..."
                    className="text-xs mb-2"
                    rows={2}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    disabled={!textClipContent.trim() || tracks.filter(t => t.type === "text" || t.type === "video").length === 0}
                    onClick={() => {
                      const textTrack = tracks.find(t => t.type === "text") || tracks.find(t => t.type === "video");
                      if (textTrack) addTextClip(textTrack.id);
                    }}
                  >
                    <TextT className="w-3 h-3 mr-1" /> Add Text at Playhead
                  </Button>
                </div>

                <Separator />

                {/* ── Markers ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase">Markers</h4>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => addMarker()}>
                      <Plus className="w-3 h-3 mr-1" /> Add (N)
                    </Button>
                  </div>
                  {markers.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-2">No markers. Press N to add.</p>
                  ) : (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {markers.sort((a, b) => a.timeMs - b.timeMs).map(m => (
                        <div key={m.id} className="flex items-center gap-2 text-[10px] group hover:bg-accent rounded px-1 py-0.5 cursor-pointer"
                          onClick={() => setPlayheadMs(m.timeMs)}>
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                          <span className="flex-1 truncate">{m.label}</span>
                          <span className="text-muted-foreground font-mono">{formatTime(m.timeMs)}</span>
                          <button className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80"
                            onClick={(e) => { e.stopPropagation(); removeMarker(m.id); }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* ── Keyboard Shortcuts Reference ── */}
                <div>
                  <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Shortcuts</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] text-muted-foreground">
                    <span><kbd className="bg-muted px-1 rounded">Space</kbd> Play/Pause</span>
                    <span><kbd className="bg-muted px-1 rounded">S</kbd> Split</span>
                    <span><kbd className="bg-muted px-1 rounded">D</kbd> Duplicate</span>
                    <span><kbd className="bg-muted px-1 rounded">R</kbd> Razor</span>
                    <span><kbd className="bg-muted px-1 rounded">M</kbd> Magnetic</span>
                    <span><kbd className="bg-muted px-1 rounded">F</kbd> Zoom Fit</span>
                    <span><kbd className="bg-muted px-1 rounded">N</kbd> Marker</span>
                    <span><kbd className="bg-muted px-1 rounded">G</kbd> Freeze</span>
                    <span><kbd className="bg-muted px-1 rounded">I</kbd> In Point</span>
                    <span><kbd className="bg-muted px-1 rounded">O</kbd> Out Point</span>
                    <span><kbd className="bg-muted px-1 rounded">P</kbd> Loop</span>
                    <span><kbd className="bg-muted px-1 rounded">J/K/L</kbd> Rew/Play/Fwd</span>
                    <span><kbd className="bg-muted px-1 rounded">←/→</kbd> Frame step</span>
                    <span><kbd className="bg-muted px-1 rounded">⌘Z/Y</kbd> Undo/Redo</span>
                    <span><kbd className="bg-muted px-1 rounded">⌘A</kbd> Select All</span>
                    <span><kbd className="bg-muted px-1 rounded">Del</kbd> Delete</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="flex-1 m-0 overflow-auto min-h-0">
              <div className="p-3 space-y-4">
                {/* ── Auto-Animatic Builder ── */}
                <div className="border border-border/40 rounded-lg p-3 bg-card/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <FilmStrip className="w-4 h-4 text-primary" />
                    <h4 className="text-xs font-semibold">Auto-Animatic Builder</h4>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-3">
                    Build the timeline automatically from screenplay scenes
                  </p>

                  {/* Scene selector */}
                  <div className="mb-3">
                    <Label className="text-[10px] text-muted-foreground">Scenes</Label>
                    <Select
                      value={builderSelectedScenes.length === 0 ? "all" : "custom"}
                      onValueChange={(v) => {
                        if (v === "all") setBuilderSelectedScenes([]);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue placeholder="All scenes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All scenes ({builderScenes.length})</SelectItem>
                        <SelectItem value="custom">Custom selection...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom scene checkboxes */}
                  {builderSelectedScenes.length > 0 || builderScenes.length <= 20 ? null : null}
                  {builderSelectedScenes.length > 0 && (
                    <div className="max-h-24 overflow-y-auto mb-3 space-y-0.5">
                      {builderScenes.map(s => (
                        <label key={s.id} className="flex items-center gap-2 text-[10px] cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                          <input
                            type="checkbox"
                            checked={builderSelectedScenes.includes(s.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBuilderSelectedScenes(prev => [...prev, s.id]);
                              } else {
                                setBuilderSelectedScenes(prev => prev.filter(id => id !== s.id));
                              }
                            }}
                            className="accent-primary size-3"
                          />
                          <span className="truncate">{s.heading}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Build button */}
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    disabled={builderLoading || builderScenes.length === 0}
                    onClick={() => {
                      // Check if tracks have existing clips
                      const hasClips = tracks.some(t => t.clips.length > 0);
                      if (hasClips) {
                        setBuilderConfirmOpen(true);
                      } else {
                        handleAutoBuild();
                      }
                    }}
                  >
                    {builderLoading ? (
                      <><ArrowCounterClockwise className="w-3 h-3 mr-1 animate-spin" /> Building...</>
                    ) : (
                      <><Sparkle className="w-3 h-3 mr-1" /> Build Animatic</>
                    )}
                  </Button>

                  {/* Result summary */}
                  {builderResult && (
                    <div className="mt-2 p-2 bg-muted/40 rounded text-[10px] text-muted-foreground">
                      <p>V1: {builderResult.scenesWithAssets} visual clips, A1: {builderResult.clipsCreated - builderResult.scenesWithAssets - (builderResult.scenesWithAssets + builderResult.scenesWithoutAssets)} voice clips</p>
                      <p>Duration: {formatTime(builderResult.totalDurationMs)}</p>
                      {builderResult.scenesWithoutAssets > 0 && (
                        <p className="text-muted-foreground">{builderResult.scenesWithoutAssets} scenes without visual assets</p>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Auto-Subtitles from DB ── */}
                <div className="border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-xs font-semibold">Auto-Subtitles</h4>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Generate subtitle clips from voice generation dialogues
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-xs"
                    disabled={subtitlesLoading}
                    onClick={handleDbSubtitles}
                  >
                    {subtitlesLoading ? "Generating..." : "Generate Subtitles"}
                  </Button>
                </div>

                {/* ── Audio Ducking ── */}
                <div className="border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <SpeakerHigh className="w-4 h-4 text-primary" />
                    <h4 className="text-xs font-semibold">Audio Ducking</h4>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Lower music/SFX volume when dialogue is playing
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-xs"
                    onClick={applyDucking}
                  >
                    Apply Ducking
                  </Button>
                </div>

                <Separator />

                <div>
                  <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">AI Assistant</h4>
                  <Select value={aiAction} onValueChange={setAiAction}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="suggest-cuts">Suggest Cuts & Transitions</SelectItem>
                      <SelectItem value="generate-subtitles">Generate Subtitles</SelectItem>
                      <SelectItem value="enhance-audio-prompt">Audio/Music Suggestions</SelectItem>
                      <SelectItem value="scene-detect">Scene Detection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {aiAction === "generate-subtitles" ? (
                  <div>
                    <Label htmlFor="editor-subtitle-text" className="text-xs text-muted-foreground">Dialogue / Narration Text</Label>
                    <Textarea
                      id="editor-subtitle-text"
                      value={subtitleText}
                      onChange={(e) => setSubtitleText(e.target.value)}
                      placeholder="Paste dialogue or narration here..."
                      className="text-xs mt-1"
                      rows={4}
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="editor-ai-prompt" className="text-xs text-muted-foreground">
                      {aiAction === "suggest-cuts" ? "Describe your scene or editing goal" :
                       aiAction === "enhance-audio-prompt" ? "Describe the scene mood" :
                       "Describe the video content"}
                    </Label>
                    <Textarea
                      id="editor-ai-prompt"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Describe..."
                      className="text-xs mt-1"
                      rows={3}
                    />
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleAiAction}
                  disabled={aiLoading || (!aiPrompt.trim() && aiAction !== "generate-subtitles") || (aiAction === "generate-subtitles" && !subtitleText.trim())}
                >
                  {aiLoading ? (
                    <><ArrowCounterClockwise className="w-3 h-3 mr-1 animate-spin" /> Analyzing...</>
                  ) : (
                    <><MagicWand className="w-3 h-3 mr-1" /> Run AI</>
                  )}
                </Button>

                {aiResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase">Results</h4>
                      {aiAction === "generate-subtitles" && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={applySubtitles}>
                          Apply to Timeline
                        </Button>
                      )}
                    </div>
                    <ScrollArea className="max-h-[300px]">
                      {(aiResults as Array<Record<string, string | number>>).map((r, i) => (
                        <div key={i} className="p-2 bg-muted/50 rounded text-xs mb-1">
                          {r.type ? <Badge variant="outline" className="text-[10px] mr-1 mb-1">{String(r.type)}</Badge> : null}
                          {r.suggestion ? <p>{String(r.suggestion)}</p> : null}
                          {r.text ? <p>{String(r.text)}</p> : null}
                          {r.label ? <p className="font-medium">{String(r.label)}</p> : null}
                          {r.description ? <p className="text-muted-foreground">{String(r.description)}</p> : null}
                          {r.musicPrompt ? <p><strong>Music:</strong> {String(r.musicPrompt)}</p> : null}
                          {r.startMs !== undefined ? <span className="text-muted-foreground">{formatTime(Number(r.startMs))}</span> : null}
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="border-t border-border/40 bg-background shrink-0" style={{ height: Math.max(200, tracks.length * 60 + 80) }}>
        {/* Track headers + Timeline */}
        <div className="flex h-full">
          {/* Track Headers */}
          <div className="w-48 border-r border-border/30 shrink-0 flex flex-col backdrop-blur-sm bg-card/60">
            <div className="h-6 border-b border-border/30 flex items-center justify-between px-2 bg-muted/20">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Tracks</span>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setAddTrackDialogOpen(true); setNewTrackName(""); }} title="Add Track">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {tracks.map(track => (
                <div
                  key={track.id}
                  className="h-[52px] border-b border-border/20 flex items-center gap-1 px-2 group"
                >
                  <span className="shrink-0">
                    {track.type === "video" ? <FilmStrip className="w-3.5 h-3.5 text-primary" /> :
                     track.type === "audio" ? <MusicNote className="w-3.5 h-3.5 text-accent" /> :
                     <TextT className="w-3.5 h-3.5 text-muted-foreground" />}
                  </span>
                  <span className="text-[10px] truncate flex-1 leading-tight">{track.name || `${track.type.charAt(0).toUpperCase()}${track.type.slice(1)} ${track.sortOrder + 1}`}</span>
                  {/* Volume mini-slider for audio/video tracks */}
                  {(track.type === "audio" || track.type === "video") && (
                    <input type="range" min={0} max={200} value={Math.round((track.volume ?? 1) * 100)}
                      onChange={(e) => {
                        const vol = Number(e.target.value) / 100;
                        fetch(`/api/video-editor/tracks/${track.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ volume: vol }),
                        }).then(() => refreshProject());
                      }}
                      className="w-10 h-0.5 accent-primary shrink-0"
                      title={`Volume: ${Math.round((track.volume ?? 1) * 100)}%`}
                    />
                  )}
                  <Button
                    variant="ghost" size="sm" className="h-5 w-5 p-0"
                    onClick={() => toggleTrackMute(track.id, track.muted)}
                    title={track.muted ? "Unmute" : "Mute"}
                    aria-label={track.muted ? `Unmute ${track.name}` : `Mute ${track.name}`}
                  >
                    {track.muted ? <SpeakerX className="w-3 h-3 text-destructive" /> : <SpeakerHigh className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-5 w-5 p-0"
                    onClick={() => toggleTrackLock(track.id, track.locked)}
                    title={track.locked ? "Unlock" : "Lock"}
                    aria-label={track.locked ? `Unlock ${track.name}` : `Lock ${track.name}`}
                  >
                    {track.locked ? <Lock className="w-3 h-3 text-muted-foreground" /> : <LockOpen className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => deleteTrack(track.id)}
                    title="Delete track"
                    aria-label={`Delete ${track.name} track`}
                  >
                    <Trash className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* Timeline Area */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={timelineRef}>
            <div
              className="relative min-h-full"
              style={{ width: msToPixels(totalDurationMs, timelineScale) + 200 }}
            >
              {/* Time Ruler + Scene Markers — click to seek, drag to scrub */}
              <div
                className="h-6 border-b border-border/30 bg-muted/15 relative cursor-pointer"
                onMouseDown={(e) => {
                  const timeline = timelineRef.current;
                  if (!timeline) return;
                  const rect = timeline.getBoundingClientRect();
                  const getMs = (clientX: number) => {
                    const x = clientX - rect.left + timeline.scrollLeft;
                    return Math.max(0, Math.min(Math.round(pixelsToMs(x, timelineScale)), totalDurationMs));
                  };
                  setPlayheadMs(getMs(e.clientX));
                  const onMove = (me: MouseEvent) => setPlayheadMs(getMs(me.clientX));
                  const onUp = () => {
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                  };
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }}
              >
                {(() => {
                  // Adaptive tick interval based on zoom level
                  const pixelsPerSec = msToPixels(1000, timelineScale);
                  const minPixelsBetweenLabels = 60;
                  const stepSec = pixelsPerSec >= minPixelsBetweenLabels ? 1
                    : pixelsPerSec >= minPixelsBetweenLabels / 2 ? 2
                    : pixelsPerSec >= minPixelsBetweenLabels / 5 ? 5
                    : pixelsPerSec >= minPixelsBetweenLabels / 10 ? 10
                    : 30;
                  const totalSecs = Math.ceil(totalDurationMs / 1000) + 1;
                  return Array.from({ length: Math.ceil(totalSecs / stepSec) + 1 }, (_, idx) => {
                    const sec = idx * stepSec;
                    return (
                      <div
                        key={sec}
                        className="absolute top-0 h-full border-l border-border/40 flex items-end pb-0.5"
                        style={{ left: msToPixels(sec * 1000, timelineScale) }}
                      >
                        <span className="text-[9px] text-muted-foreground ml-1 font-mono whitespace-nowrap">{formatTime(sec * 1000)}</span>
                      </div>
                    );
                  });
                })()}
                {/* Scene markers from T1 title clips */}
                {tracks
                  .filter(t => t.type === "text")
                  .flatMap(t => t.clips)
                  .filter(c => c.textContent && c.name?.startsWith("Title:"))
                  .map(clip => (
                    <div
                      key={`marker-${clip.id}`}
                      className="absolute top-0 cursor-pointer group z-10"
                      style={{ left: msToPixels(clip.startMs, timelineScale) }}
                      onClick={() => setPlayheadMs(clip.startMs)}
                      title={clip.textContent || "Scene"}
                    >
                      <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-yellow-400" />
                      <div className="hidden group-hover:block absolute top-4 left-1/2 -translate-x-1/2 bg-popover border rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap z-20 shadow-md">
                        {clip.textContent}
                      </div>
                    </div>
                  ))}
                {/* User markers */}
                {markers.map(marker => (
                  <div
                    key={`um-${marker.id}`}
                    className="absolute top-0 cursor-pointer group z-10"
                    style={{ left: msToPixels(marker.timeMs, timelineScale) }}
                    onClick={() => setPlayheadMs(marker.timeMs)}
                    onContextMenu={(e) => { e.preventDefault(); removeMarker(marker.id); toast("Marker removed"); }}
                    title={`${marker.label} — right-click to remove`}
                  >
                    <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[7px] border-l-transparent border-r-transparent" style={{ borderTopColor: marker.color }} />
                    <div className="hidden group-hover:block absolute top-4 left-1/2 -translate-x-1/2 bg-popover border rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap z-20 shadow-md">
                      {marker.label}
                    </div>
                  </div>
                ))}
                {/* In/Out range highlight */}
                {inPoint !== null && outPoint !== null && (
                  <div className="absolute top-0 h-full bg-blue-500/15 border-l border-r border-blue-400/40 pointer-events-none"
                    style={{
                      left: msToPixels(Math.min(inPoint, outPoint), timelineScale),
                      width: msToPixels(Math.abs(outPoint - inPoint), timelineScale),
                    }}
                  />
                )}
                {inPoint !== null && (
                  <div className="absolute top-0 h-full w-px bg-blue-400 pointer-events-none" style={{ left: msToPixels(inPoint, timelineScale) }}>
                    <span className="absolute -top-0 left-1 text-[8px] text-primary font-bold">I</span>
                  </div>
                )}
                {outPoint !== null && (
                  <div className="absolute top-0 h-full w-px bg-blue-400 pointer-events-none" style={{ left: msToPixels(outPoint, timelineScale) }}>
                    <span className="absolute -top-0 left-1 text-[8px] text-primary font-bold">O</span>
                  </div>
                )}
              </div>

              {/* Track Lanes */}
              {tracks.map(track => (
                <div
                  key={track.id}
                  data-track-lane={track.id}
                  className="h-[52px] border-b border-border/20 relative bg-background/40"
                  onClick={(e) => {
                    // Click on empty space to place playhead
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
                    setPlayheadMs(pixelsToMs(x, timelineScale));
                    setSelectedClipId(null);
                  }}
                >
                  {/* Clips */}
                  {track.clips.map(clip => {
                    const left = msToPixels(clip.startMs, timelineScale);
                    const width = msToPixels(clip.durationMs, timelineScale);
                    const colorClass = CLIP_COLORS[clip.type] || "bg-gray-600/80 border-gray-400";
                    const isSelected = selectedClipId === clip.id;

                    return (
                      <div
                        key={clip.id}
                        className={`absolute top-1 bottom-1 rounded border cursor-pointer transition-shadow
                          ${colorClass}
                          ${isSelected ? "ring-2 ring-white shadow-lg z-10" : selectedClipIds.has(clip.id) ? "ring-2 ring-blue-400 shadow-md z-10" : "hover:brightness-110"}
                          ${track.locked ? "opacity-50 pointer-events-none" : ""}
                          ${razorMode ? "cursor-crosshair" : ""}
                        `}
                        style={{ left, width: Math.max(width, 4) }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTransitionMenu(null);
                          if (razorMode) {
                            // Razor: split clip at click position
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const clickMs = clip.startMs + pixelsToMs(x, timelineScale);
                            const relMs = clickMs - clip.startMs;
                            if (relMs > 100 && relMs < clip.durationMs - 100) {
                              pushUndo();
                              setSelectedClipId(clip.id);
                              // Use direct split logic
                              fetch(`/api/video-editor/clips/${clip.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ durationMs: relMs }),
                              }).then(() =>
                                fetch("/api/video-editor/clips", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    trackId: clip.trackId, editorProjectId: project.id, type: clip.type,
                                    name: clip.name ? `${clip.name} (cut)` : "Cut",
                                    startMs: clip.startMs + relMs, durationMs: clip.durationMs - relMs,
                                    sourceStartMs: clip.sourceStartMs + relMs, sourceEndMs: clip.sourceEndMs,
                                    sourcePath: clip.sourcePath, sourceType: clip.sourceType, sourceId: clip.sourceId,
                                    volume: clip.volume, opacity: clip.opacity, playbackRate: clip.playbackRate,
                                  }),
                                })
                              ).then(() => refreshProject());
                            }
                            return;
                          }
                          // Multiselect with Shift/Ctrl
                          if (e.shiftKey || e.metaKey || e.ctrlKey) {
                            setSelectedClipIds(prev => {
                              const next = new Set(prev);
                              if (next.has(clip.id)) next.delete(clip.id);
                              else next.add(clip.id);
                              return next;
                            });
                          } else {
                            setSelectedClipIds(new Set());
                          }
                          setSelectedClipId(clip.id);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedClipId(clip.id);
                          setTransitionMenu({ clipId: clip.id, x: e.clientX, y: e.clientY });
                        }}
                        onMouseDown={(e) => {
                          if (e.button !== 0 || track.locked) return;
                          e.stopPropagation();
                          setSelectedClipId(clip.id);
                          const timeline = timelineRef.current;
                          if (!timeline) return;
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const origStartMs = clip.startMs;
                          const origTrackId = track.id;
                          let moved = false;
                          let lastStartMs = origStartMs;
                          let lastTrackId = origTrackId;

                          const onMove = (me: MouseEvent) => {
                            const dx = me.clientX - startX;
                            const dy = me.clientY - startY;
                            if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
                            moved = true;

                            const dMs = pixelsToMs(dx, timelineScale);
                            let raw = Math.max(0, Math.round(origStartMs + dMs));
                            // Snap to other clip edges (within 8px)
                            const snapThresholdMs = pixelsToMs(8, timelineScale);
                            const allEdges = tracks.flatMap(t => t.clips)
                              .filter(c => c.id !== clip.id)
                              .flatMap(c => [c.startMs, c.startMs + c.durationMs]);
                            allEdges.push(0); // snap to start
                            const clipEnd = raw + clip.durationMs;
                            for (const edge of allEdges) {
                              if (Math.abs(raw - edge) < snapThresholdMs) { raw = edge; break; }
                              if (Math.abs(clipEnd - edge) < snapThresholdMs) { raw = edge - clip.durationMs; break; }
                            }
                            lastStartMs = Math.max(0, raw);

                            // Track type compatibility: video/image→video tracks, audio→audio tracks, text→text tracks
                            const clipTrackType = clip.type === "audio" ? "audio" : clip.type === "text" || clip.type === "subtitle" ? "text" : "video";
                            const trackLanes = timeline.querySelectorAll("[data-track-lane]");
                            lastTrackId = origTrackId;
                            trackLanes.forEach(lane => {
                              const rect = lane.getBoundingClientRect();
                              if (me.clientY >= rect.top && me.clientY < rect.bottom) {
                                const candidateId = Number(lane.getAttribute("data-track-lane"));
                                // Check type compatibility
                                const targetTrack = tracks.find(t => t.id === candidateId);
                                if (targetTrack && targetTrack.type === clipTrackType) {
                                  lastTrackId = candidateId;
                                }
                                // Also allow video/image clips to move between video tracks
                                if (targetTrack && targetTrack.type === "video" && (clip.type === "video" || clip.type === "image")) {
                                  lastTrackId = candidateId;
                                }
                              }
                            });

                            // Overlap prevention: check if clip would overlap with existing clips on target track
                            const targetTrack = tracks.find(t => t.id === lastTrackId);
                            if (targetTrack) {
                              const hasOverlap = targetTrack.clips.some(c =>
                                c.id !== clip.id &&
                                lastStartMs < c.startMs + c.durationMs &&
                                lastStartMs + clip.durationMs > c.startMs
                              );
                              if (hasOverlap) {
                                // Push clip after the overlapping one
                                const overlapping = targetTrack.clips
                                  .filter(c => c.id !== clip.id && lastStartMs < c.startMs + c.durationMs && lastStartMs + clip.durationMs > c.startMs)
                                  .sort((a, b) => a.startMs - b.startMs);
                                if (overlapping.length > 0) {
                                  lastStartMs = overlapping[overlapping.length - 1].startMs + overlapping[overlapping.length - 1].durationMs;
                                }
                              }
                            }

                            updateClipLocal(clip.id, { startMs: lastStartMs, trackId: lastTrackId });
                            if (lastTrackId !== origTrackId) {
                              setTracks(prev => {
                                const clipData = prev.flatMap(t => t.clips).find(c => c.id === clip.id);
                                if (!clipData) return prev;
                                return prev.map(t => ({
                                  ...t,
                                  clips: t.id === lastTrackId
                                    ? [...t.clips.filter(c => c.id !== clip.id), { ...clipData, startMs: lastStartMs, trackId: lastTrackId }]
                                    : t.clips.filter(c => c.id !== clip.id),
                                }));
                              });
                            }
                          };

                          const onUp = () => {
                            document.removeEventListener("mousemove", onMove);
                            document.removeEventListener("mouseup", onUp);
                            if (moved) {
                              updateClip(clip.id, { startMs: lastStartMs, trackId: lastTrackId });
                            }
                          };
                          document.addEventListener("mousemove", onMove);
                          document.addEventListener("mouseup", onUp);
                        }}
                      >
                        <div className="px-1.5 py-0.5 h-full flex items-center overflow-hidden relative">
                          <span className="text-[10px] text-white/90 truncate font-medium z-10 flex items-center gap-1">
                            {clip.type === "video" && <FilmStrip className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            {clip.type === "audio" && <MusicNote className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            {clip.type === "image" && <Image className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            {clip.name || clip.type}
                            {clip.playbackRate !== 1 && <span className="text-[8px] opacity-60">{clip.playbackRate}x</span>}
                          </span>
                          {clip.waveformData && (clip.type === "audio" || clip.type === "video") && (() => {
                            try {
                              const peaks = JSON.parse(clip.waveformData) as number[];
                              const vol = clip.volume ?? 1;
                              const waveColor = clip.type === "audio" ? "text-green-300" : "text-blue-300";
                              return (
                                <svg className={`absolute inset-0 w-full h-full ${vol > 0 ? "opacity-50" : "opacity-10"}`} preserveAspectRatio="none" viewBox={`0 0 ${peaks.length} 100`}>
                                  {peaks.map((p, i) => {
                                    const scaled = Math.min(p * vol, 1);
                                    return (
                                      <rect key={i} x={i} y={(1 - scaled) * 50} width={1.3} height={Math.max(scaled * 100, 0.5)} fill="currentColor" className={waveColor} />
                                    );
                                  })}
                                </svg>
                              );
                            } catch { return null; }
                          })()}
                        </div>
                        {/* Transition indicator */}
                        {clip.transition && parseTransition(clip.transition) && (
                          <div className="absolute top-0 right-0 bg-muted text-[8px] text-foreground font-bold px-1 rounded-bl leading-tight">
                            {parseTransition(clip.transition)!.type === "dissolve" ? "DSV" : parseTransition(clip.transition)!.type === "fade-black" ? "FDE" : "WPE"}
                          </div>
                        )}
                        {/* Trim handles */}
                        {!track.locked && isSelected && (
                          <>
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/30 cursor-col-resize hover:bg-white/50 rounded-l"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                const startX = e.clientX;
                                const origStart = clip.startMs;
                                const origDuration = clip.durationMs;
                                const onMove = (me: MouseEvent) => {
                                  const dx = me.clientX - startX;
                                  const dMs = pixelsToMs(dx, timelineScale);
                                  const newStart = Math.max(0, origStart + dMs);
                                  const newDuration = origDuration - (newStart - origStart);
                                  if (newDuration > 100) {
                                    updateClip(clip.id, { startMs: Math.round(newStart), durationMs: Math.round(newDuration) });
                                  }
                                };
                                const onUp = () => {
                                  document.removeEventListener("mousemove", onMove);
                                  document.removeEventListener("mouseup", onUp);
                                };
                                document.addEventListener("mousemove", onMove);
                                document.addEventListener("mouseup", onUp);
                              }}
                            />
                            <div
                              className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/30 cursor-col-resize hover:bg-white/50 rounded-r"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                const startX = e.clientX;
                                const origDuration = clip.durationMs;
                                const onMove = (me: MouseEvent) => {
                                  const dx = me.clientX - startX;
                                  const dMs = pixelsToMs(dx, timelineScale);
                                  const newDuration = origDuration + dMs;
                                  if (newDuration > 100) {
                                    updateClip(clip.id, { durationMs: Math.round(newDuration) });
                                  }
                                };
                                const onUp = () => {
                                  document.removeEventListener("mousemove", onMove);
                                  document.removeEventListener("mouseup", onUp);
                                };
                                document.addEventListener("mousemove", onMove);
                                document.addEventListener("mouseup", onUp);
                              }}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Playhead — draggable */}
              <div
                className="absolute top-0 bottom-0 z-20"
                style={{ left: msToPixels(playheadMs, timelineScale) }}
              >
                {/* Drag handle (wider hit area) */}
                <div
                  className="absolute -left-[6px] top-0 w-[13px] h-5 cursor-col-resize z-30"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const timeline = timelineRef.current;
                    if (!timeline) return;
                    const onMove = (me: MouseEvent) => {
                      const rect = timeline.getBoundingClientRect();
                      const x = me.clientX - rect.left + timeline.scrollLeft;
                      const ms = Math.max(0, Math.min(pixelsToMs(x, timelineScale), totalDurationMs));
                      setPlayheadMs(Math.round(ms));
                    };
                    const onUp = () => {
                      document.removeEventListener("mousemove", onMove);
                      document.removeEventListener("mouseup", onUp);
                    };
                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp);
                  }}
                >
                  <div className="w-3 h-3 bg-red-500 ml-[0.5px] -mt-0.5" style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }} />
                </div>
                {/* Thin red line */}
                <div className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none" />
              </div>

              {/* Drop zone for clips from timeline ruler area */}
            </div>

            {/* ── Mini-map ── */}
            {showMiniMap && totalDurationMs > 0 && (
              <div className="h-6 border-t border-border/30 bg-background/60 relative cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  setPlayheadMs(Math.round(ratio * totalDurationMs));
                }}
              >
                {/* Clip blocks (compressed view) */}
                {tracks.map((track, ti) => {
                  const h = Math.max(2, Math.floor(24 / Math.max(tracks.length, 1)));
                  return track.clips.map(clip => {
                    const left = `${totalDurationMs > 0 ? (clip.startMs / totalDurationMs) * 100 : 0}%`;
                    const width = `${totalDurationMs > 0 ? (clip.durationMs / totalDurationMs) * 100 : 0}%`;
                    const colors: Record<string, string> = { video: "#3b82f6", audio: "#22c55e", image: "#a855f7", text: "#eab308" };
                    return (
                      <div key={`mm-${clip.id}`} className="absolute rounded-[1px]"
                        style={{ left, width, top: ti * h, height: h, backgroundColor: colors[clip.type] || "#6b7280", opacity: 0.7 }}
                      />
                    );
                  });
                })}
                {/* Playhead on mini-map */}
                <div className="absolute top-0 bottom-0 w-px bg-red-500" style={{ left: `${totalDurationMs > 0 ? (playheadMs / totalDurationMs) * 100 : 0}%` }} />
                {/* Viewport indicator */}
                {timelineRef.current && (() => {
                  const el = timelineRef.current;
                  const fullWidth = msToPixels(totalDurationMs, timelineScale);
                  const viewStart = el.scrollLeft / fullWidth;
                  const viewWidth = el.clientWidth / fullWidth;
                  return (
                    <div className="absolute top-0 bottom-0 border border-white/30 bg-white/5 pointer-events-none rounded-sm"
                      style={{ left: `${viewStart * 100}%`, width: `${Math.min(viewWidth * 100, 100)}%` }}
                    />
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Track Dialog ── */}
      <Dialog open={addTrackDialogOpen} onOpenChange={setAddTrackDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Track</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* UX AUDIT FIX: replaced raw <label> with <Label> for accessibility */}
            <div>
              <Label htmlFor="track-type">Track Type</Label>
              <Select value={newTrackType} onValueChange={setNewTrackType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="text">Text / Subtitles</SelectItem>
                  <SelectItem value="overlay">Overlay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="track-name">Name</Label>
              <Input
                id="track-name"
                value={newTrackName}
                onChange={(e) => setNewTrackName(e.target.value)}
                placeholder={`${newTrackType.charAt(0).toUpperCase() + newTrackType.slice(1)} ${tracks.filter(t => t.type === newTrackType).length + 1}`}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddTrackDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                if (!newTrackName.trim()) {
                  setNewTrackName(`${newTrackType.charAt(0).toUpperCase() + newTrackType.slice(1)} ${tracks.filter(t => t.type === newTrackType).length + 1}`);
                }
                addTrack();
              }}>Add Track</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Auto-Animatic Confirm Dialog ── */}
      <ConfirmDialog
        open={builderConfirmOpen}
        onOpenChange={setBuilderConfirmOpen}
        title="Replace existing clips?"
        description="This will delete all existing clips on V1, A1, and T1 tracks and rebuild the timeline from scratch."
        confirmLabel="Build Animatic"
        onConfirm={handleAutoBuild}
      />

      {/* ── Clip Context Menu ── */}
      {transitionMenu && (() => {
        const menuClip = tracks.flatMap(t => t.clips).find(c => c.id === transitionMenu.clipId);
        const isVisual = menuClip?.type === "video" || menuClip?.type === "image";
        const hasSource = menuClip?.sourceType && menuClip?.sourceId &&
          ["voice_generation", "image_generation", "video_generation"].includes(menuClip.sourceType);
        return (
          <>
            <div className="fixed inset-0 z-50" role="button" tabIndex={-1} aria-label="Close menu" onClick={() => setTransitionMenu(null)} onKeyDown={(e) => { if (e.key === "Escape") setTransitionMenu(null); }} />
            <div
              className="fixed z-50 bg-card/95 backdrop-blur-md border border-border/40 rounded-lg shadow-[0_0_20px_var(--glow-primary)] py-1 min-w-[180px]"
              ref={(el) => {
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                let x = transitionMenu.x;
                let y = transitionMenu.y;
                if (x + rect.width > vw - 8) x = vw - rect.width - 8;
                if (y + rect.height > vh - 8) y = vh - rect.height - 8;
                if (x < 8) x = 8;
                if (y < 8) y = 8;
                el.style.left = `${x}px`;
                el.style.top = `${y}px`;
              }}
              style={{ left: transitionMenu.x, top: transitionMenu.y }}
            >
              {/* Transition options (video/image only) */}
              {isVisual && (
                <>
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Transition</div>
                  {TRANSITION_OPTIONS.map(opt => {
                    const currentTrans = (() => {
                      if (!menuClip?.transition) return "none";
                      try { return JSON.parse(menuClip.transition).type || "none"; } catch { return "none"; }
                    })();
                    return (
                      <button
                        key={opt.type}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 flex items-center gap-2 ${currentTrans === opt.type ? "text-primary" : "text-foreground"}`}
                        onClick={() => setClipTransition(transitionMenu.clipId, opt.type)}
                      >
                        {currentTrans === opt.type && <span className="text-muted-foreground">●</span>}
                        {opt.label}
                      </button>
                    );
                  })}
                  <div className="border-t border-zinc-600 my-1" />
                </>
              )}

              {/* View Original Prompt / Regenerate */}
              {hasSource && (
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 text-foreground"
                  onClick={async () => {
                    setTransitionMenu(null);
                    try {
                      const res = await fetch(`/api/video-editor/source-prompt?sourceType=${menuClip!.sourceType}&sourceId=${menuClip!.sourceId}`);
                      if (res.ok) {
                        const data = await res.json();
                        setRegenDialog({
                          clipId: menuClip!.id,
                          sourceType: menuClip!.sourceType!,
                          sourceId: menuClip!.sourceId!,
                          prompt: data.prompt || "(no prompt found)",
                          loading: false,
                        });
                      }
                    } catch {
                      toast.error("Failed to load prompt");
                    }
                  }}
                >
                  View Original Prompt
                </button>
              )}

              {/* Split */}
              <button
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 text-foreground"
                onClick={() => {
                  setTransitionMenu(null);
                  setSelectedClipId(transitionMenu.clipId);
                  splitClipAtPlayhead();
                }}
              >
                Split at Playhead
              </button>

              {/* Duplicate */}
              <button
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 text-foreground"
                onClick={() => {
                  setTransitionMenu(null);
                  setSelectedClipId(transitionMenu.clipId);
                  duplicateClip();
                }}
              >
                Duplicate Clip
              </button>

              {/* Freeze Frame (video/image) */}
              {(menuClip?.type === "video" || menuClip?.type === "image") && (
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 text-foreground"
                  onClick={() => {
                    setTransitionMenu(null);
                    setSelectedClipId(menuClip!.id);
                    freezeFrame();
                  }}
                >
                  Freeze Frame (2s)
                </button>
              )}

              {/* Speed presets */}
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Speed</div>
              <div className="flex gap-0.5 px-2 pb-1.5">
                {[0.25, 0.5, 1, 1.5, 2, 4].map(rate => (
                  <button key={rate}
                    className={`flex-1 text-center px-1 py-1 text-[10px] rounded ${menuClip?.playbackRate === rate ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
                    onClick={() => { updateClip(menuClip!.id, { playbackRate: rate }); setTransitionMenu(null); }}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              <div className="border-t border-zinc-600 my-1" />

              {/* Detach Audio (video clips only) */}
              {menuClip?.type === "video" && menuClip.sourcePath && (
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 text-foreground"
                  onClick={async () => {
                    setTransitionMenu(null);
                    const audioTrack = tracks.find(t => t.type === "audio");
                    if (!audioTrack) { toast.error("No audio track — create one first"); return; }
                    try {
                      await fetch("/api/video-editor/clips", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          trackId: audioTrack.id,
                          editorProjectId: project.id,
                          type: "audio",
                          name: `Audio: ${menuClip.name || "Detached"}`,
                          startMs: menuClip.startMs,
                          durationMs: menuClip.durationMs,
                          sourcePath: menuClip.sourcePath,
                          sourceType: menuClip.sourceType,
                          sourceId: menuClip.sourceId,
                          sourceStartMs: menuClip.sourceStartMs,
                          volume: menuClip.volume,
                        }),
                      });
                      // Mute original video clip
                      await updateClip(menuClip.id, { volume: 0 });
                      toast.success("Audio detached to audio track");
                    } catch { toast.error("Failed to detach audio"); }
                  }}
                >
                  Detach Audio
                </button>
              )}

              {/* Audio Crossfade with previous clip */}
              {menuClip?.type === "audio" && (() => {
                const sameTrack = tracks.find(t => t.id === menuClip.trackId);
                const prevClip = sameTrack?.clips
                  .filter(c => c.id !== menuClip.id && c.startMs + c.durationMs <= menuClip.startMs + 100)
                  .sort((a, b) => b.startMs - a.startMs)[0];
                if (!prevClip) return null;
                return (
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 text-foreground"
                    onClick={async () => {
                      setTransitionMenu(null);
                      // Create crossfade: overlap clips by 500ms and set transitions
                      const overlap = 500;
                      await updateClip(menuClip.id, { startMs: menuClip.startMs - overlap });
                      await updateClip(menuClip.id, { transition: JSON.stringify({ type: "dissolve", durationMs: overlap }) });
                      toast.success("Crossfade applied (500ms)");
                    }}
                  >
                    Crossfade with Previous
                  </button>
                );
              })()}

              {/* Normalize Volume (audio/video) */}
              {(menuClip?.type === "audio" || menuClip?.type === "video") && (
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 text-foreground"
                  onClick={() => {
                    setTransitionMenu(null);
                    updateClip(menuClip!.id, { volume: 1 });
                    toast.success("Volume normalized to 100%");
                  }}
                >
                  Normalize Volume
                </button>
              )}

              {/* Reset Filters */}
              {menuClip?.filters && (
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 text-foreground"
                  onClick={() => {
                    setTransitionMenu(null);
                    updateClip(menuClip!.id, { filters: null });
                    toast.success("Filters reset");
                  }}
                >
                  Reset All Filters
                </button>
              )}

              {/* Snap to Playhead */}
              <button
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 text-foreground"
                onClick={() => {
                  setTransitionMenu(null);
                  updateClip(menuClip!.id, { startMs: playheadMs });
                  toast.success("Snapped to playhead");
                }}
              >
                Snap to Playhead
              </button>

              {/* Set as In/Out */}
              <button
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 text-foreground"
                onClick={() => {
                  setTransitionMenu(null);
                  setInPoint(menuClip!.startMs);
                  setOutPoint(menuClip!.startMs + menuClip!.durationMs);
                  toast.success("In/Out set to clip range");
                }}
              >
                Set In/Out to Clip
              </button>

              <div className="border-t border-zinc-600 my-1" />

              {/* Delete */}
              <button
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-900/50 text-destructive"
                onClick={() => {
                  setTransitionMenu(null);
                  deleteClip(transitionMenu.clipId);
                }}
              >
                Delete Clip
              </button>
            </div>
          </>
        );
      })()}

      {/* ── Regenerate/Original Prompt Dialog ── */}
      {regenDialog && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" role="button" tabIndex={-1} aria-label="Close dialog" onClick={() => setRegenDialog(null)} onKeyDown={(e) => { if (e.key === "Escape") setRegenDialog(null); }} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card/95 backdrop-blur-md border border-border/40 rounded-xl shadow-[0_0_30px_var(--glow-primary)] p-5 w-[420px] max-w-[90vw]">
            <h3 className="text-sm font-semibold text-foreground mb-1">Original Prompt</h3>
            <p className="text-[10px] text-muted-foreground mb-3">
              Source: {regenDialog.sourceType.replace(/_/g, " ")} #{regenDialog.sourceId}
            </p>
            <div className="bg-background/80 rounded-lg p-3 text-xs text-foreground whitespace-pre-wrap max-h-[200px] overflow-auto mb-4 border border-border/30">
              {regenDialog.prompt}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setRegenDialog(null)}>
                Close
              </Button>
              <Button size="sm" variant="secondary" onClick={() => {
                navigator.clipboard.writeText(regenDialog.prompt);
                toast.success("Prompt copied to clipboard");
              }}>
                Copy Prompt
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── AI Director Floating Chat Panel ── */}
      {aiDirectorOpen && (
        <div className="fixed bottom-4 right-4 z-40 w-[380px] max-h-[500px] bg-card/95 backdrop-blur-md border border-border/40 rounded-xl shadow-[0_0_30px_var(--glow-primary)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/30">
            <div className="flex items-center gap-2">
              <ChatCircleDots className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">AI Director</span>
            </div>
            <button onClick={() => setAiDirectorOpen(false)} className="text-muted-foreground hover:text-foreground text-xs">
              ✕
            </button>
          </div>
          <ScrollArea className="flex-1 max-h-[360px] p-3">
            {aiDirectorMessages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ChatCircleDots className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs mb-2">Describe your idea and AI will build the edit.</p>
                <div className="flex flex-col gap-1">
                  {[
                    "Add a fade-in to the first clip",
                    "Make all transitions dissolve, 500ms",
                    "Add a title 'Chapter 1' at the beginning",
                    "Auto-arrange clips with 1s gaps",
                    "Apply cinematic color grading to all clips",
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      className="text-[10px] text-left px-2 py-1 rounded border hover:bg-muted transition-colors"
                      onClick={() => sendAiDirectorMessage(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {aiDirectorMessages.map((msg, i) => (
              <div key={i} className={`mb-2 ${msg.role === "user" ? "text-right" : ""}`}>
                <div className={`inline-block max-w-[90%] rounded-lg px-3 py-1.5 text-xs ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {aiDirectorLoading && (
              <div className="mb-2">
                <div className="inline-block bg-muted rounded-lg px-3 py-1.5 text-xs text-muted-foreground animate-pulse">
                  Thinking...
                </div>
              </div>
            )}
          </ScrollArea>
          <div className="border-t p-2 flex gap-1">
            <Input
              value={aiDirectorInput}
              onChange={(e) => setAiDirectorInput(e.target.value)}
              placeholder="Describe your edit..."
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !aiDirectorLoading) {
                  e.preventDefault();
                  sendAiDirectorMessage(aiDirectorInput);
                }
              }}
            />
            <Button
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!aiDirectorInput.trim() || aiDirectorLoading}
              onClick={() => sendAiDirectorMessage(aiDirectorInput)}
            >
              <PaperPlaneTilt className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Export Dialog ── */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilmReel className="w-5 h-5" /> Export Video
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="bg-muted/50 rounded-lg p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Resolution</span>
                <span>{project.width}×{project.height}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Frame Rate</span>
                <span>{project.fps} fps</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Duration</span>
                <span>{formatTime(totalDurationMs)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tracks</span>
                <span>{tracks.length} ({tracks.flatMap(t => t.clips).length} clips)</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setExportDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleRender}>
                <Export className="w-4 h-4 mr-1" /> Render MP4
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
