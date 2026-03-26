"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InfoTooltip } from "@/components/info-tooltip";
import { toast } from "sonner";

type AudioType = "music" | "sfx" | "voice";
type GalleryFilter = "all" | "completed" | "generating" | "failed";

interface GeneratedAudio {
  id: string;
  prompt: string;
  type: AudioType;
  status: "generating" | "completed" | "failed";
  storagePath?: string;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  error?: string;
  createdAt: string;
}

interface CharacterOption {
  id: string | number;
  name: string;
}

const MUSIC_PRESETS = [
  { label: "Cinematic Tension", prompt: "Dark cinematic tension building orchestral score, suspenseful strings, low brass, atmospheric" },
  { label: "Romantic Piano", prompt: "Romantic solo piano melody, gentle and emotional, film score style" },
  { label: "Action Chase", prompt: "Fast-paced action chase scene music, driving percussion, intense brass, urgent tempo" },
  { label: "Ambient Drone", prompt: "Ambient atmospheric drone, ethereal textures, spacious reverb, meditative" },
  { label: "Comedy Quirky", prompt: "Light comedic quirky music, playful pizzicato strings, whimsical woodwinds" },
  { label: "Horror Eerie", prompt: "Eerie horror atmosphere, dissonant strings, unsettling whispers, dark ambient" },
  { label: "Epic Finale", prompt: "Epic orchestral finale, triumphant brass fanfare, full orchestra, cinematic crescendo" },
  { label: "Jazz Noir", prompt: "Smoky jazz noir, muted trumpet, brushed drums, double bass, 1940s detective film" },
];

const SFX_PRESETS = [
  { label: "Footsteps", prompt: "Footsteps walking on a hard wooden floor, steady pace, indoor" },
  { label: "Door Creak", prompt: "Old wooden door slowly creaking open, horror atmosphere" },
  { label: "Rain", prompt: "Heavy rain falling on a rooftop, steady downpour, ambient" },
  { label: "Gunshot", prompt: "Single gunshot from a pistol, outdoor environment, echo" },
  { label: "Car Engine", prompt: "Car engine starting and idling, modern sedan, parking garage" },
  { label: "Glass Break", prompt: "Glass window shattering, multiple shards falling, indoor" },
  { label: "Thunder", prompt: "Rolling thunder in the distance, approaching storm" },
  { label: "Crowd Murmur", prompt: "Restaurant crowd background ambience, quiet conversation, silverware clinking" },
  { label: "Wind", prompt: "Strong wind howling through open windows, whistling" },
  { label: "Clock Ticking", prompt: "Old wall clock ticking steadily, quiet room, mechanical" },
  { label: "Phone Ring", prompt: "Vintage rotary telephone ringing, 1970s style" },
  { label: "Explosion", prompt: "Distant explosion with rumble, outdoor, debris settling" },
];

const VOICE_PRESETS = [
  { label: "Dramatic Monologue", prompt: "The world isn't what it used to be. I remember a time when things made sense." },
  { label: "Whispered Secret", prompt: "Don't turn around. They're watching us." },
  { label: "Excited Discovery", prompt: "You're not going to believe this. Come here, look at this!" },
  { label: "Cold Threat", prompt: "You have exactly thirty seconds to explain yourself." },
  { label: "Heartfelt Goodbye", prompt: "I wish things could have been different. Take care of yourself." },
  { label: "Comic Relief", prompt: "So let me get this straight — you want ME to defuse the bomb?" },
];

/** Generate a deterministic array of bar heights from an ID string */
function seededWaveformBars(id: string, count: number): number[] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    hash = (hash * 16807 + 1) | 0;
    const h = 20 + (Math.abs(hash) % 80); // 20-100%
    bars.push(h);
  }
  return bars;
}

export default function AudioStudioPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [audioType, setAudioType] = useState<AudioType>("music");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [promptInfluence, setPromptInfluence] = useState(0.5);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [generations, setGenerations] = useState<GeneratedAudio[]>([]);
  const [generating, setGenerating] = useState(false);
  const playingRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const pollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Voice-specific state
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");

  // UI state
  const [panelOpen, setPanelOpen] = useState(false);
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<GeneratedAudio | null>(null);

  // Fetch characters for the voice tab
  useEffect(() => {
    fetch(`/api/characters?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data: CharacterOption[]) => {
        if (Array.isArray(data)) setCharacters(data);
      })
      .catch(() => { /* non-critical */ });
  }, [projectId]);

  // Start polling for a music generation until it completes or fails
  const startPolling = useCallback((generationId: string, tempId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/audio-studio/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generationId: Number(generationId) }),
        });
        if (!res.ok) return; // transient error, keep polling

        const data = await res.json();

        if (data.status === "completed") {
          clearInterval(interval);
          pollIntervalsRef.current.delete(generationId);
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === tempId || g.id === generationId
                ? {
                    ...g,
                    id: generationId,
                    status: "completed" as const,
                    storagePath: data.storagePath,
                    filename: data.filename,
                    mimeType: data.mimeType,
                    fileSize: data.fileSize,
                    error: undefined,
                  }
                : g
            )
          );
          toast.success("Audio generated", {
            action: {
              label: "Save to Drive",
              onClick: () => handleSaveToDrive({ id: String(generationId), prompt: "", type: "music", status: "completed", storagePath: data.storagePath, filename: data.filename, mimeType: data.mimeType || "audio/mpeg", fileSize: data.fileSize || 0, createdAt: new Date().toISOString() }),
            },
          });
        } else if (data.status === "failed") {
          clearInterval(interval);
          pollIntervalsRef.current.delete(generationId);
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === tempId || g.id === generationId
                ? { ...g, id: generationId, status: "failed" as const, error: data.error || "Generation failed" }
                : g
            )
          );
          toast.error(data.error || "Audio generation failed");
        }
        // else still "generating" — keep polling
      } catch {
        // Network error — keep polling, don't fail
      }
    }, 3000);

    pollIntervalsRef.current.set(generationId, interval);
  }, []);

  // Load saved generations from DB and resume polling for in-progress items
  useEffect(() => {
    fetch(`/api/audio-studio?projectId=${projectId}`)
      .then((r) => r.json())
      .then((rows: Array<Record<string, unknown>>) => {
        if (!Array.isArray(rows)) return;
        const mapped = rows.map((r) => ({
          id: String(r.id),
          prompt: r.prompt as string,
          type: (r.type as AudioType) || "sfx",
          status: (r.status as "generating" | "completed" | "failed") || "completed",
          storagePath: r.storagePath as string | undefined,
          filename: r.filename as string | undefined,
          mimeType: r.mimeType as string | undefined,
          fileSize: r.fileSize as number | undefined,
          error: r.error as string | undefined,
          createdAt: r.createdAt as string,
        }));
        setGenerations(mapped);
        // Resume polling for any items still generating
        mapped.filter((g) => g.status === "generating").forEach((g) => {
          startPolling(g.id, g.id);
        });
      })
      .catch(() => { /* non-critical */ });
  }, [projectId, startPolling]);

  // Clean up audio and polling intervals on unmount
  useEffect(() => {
    return () => {
      if (playingRef.current) {
        playingRef.current.pause();
        playingRef.current = null;
      }
      pollIntervalsRef.current.forEach((interval) => clearInterval(interval));
      pollIntervalsRef.current.clear();
    };
  }, []);

  // Filtered generations
  const filteredGenerations = useMemo(() => {
    switch (filter) {
      case "completed": return generations.filter((g) => g.status === "completed");
      case "generating": return generations.filter((g) => g.status === "generating");
      case "failed": return generations.filter((g) => g.status === "failed");
      default: return generations;
    }
  }, [generations, filter]);

  const completedCount = generations.filter((g) => g.status === "completed").length;
  const generatingCount = generations.filter((g) => g.status === "generating").length;
  const failedCount = generations.filter((g) => g.status === "failed").length;
  const musicCount = generations.filter((g) => g.type === "music").length;
  const sfxCount = generations.filter((g) => g.type === "sfx").length;
  const voiceCount = generations.filter((g) => g.type === "voice").length;

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error(audioType === "voice" ? "Enter a dialogue line" : "Enter a prompt describing the audio you want");
      return;
    }
    if (audioType === "voice" && !selectedCharacter) {
      toast.error("Select a character for the voice");
      return;
    }
    setGenerating(true);
    setPanelOpen(false);
    const tempId = `temp-${Date.now()}`;
    const newGen: GeneratedAudio = {
      id: tempId,
      prompt: prompt.trim(),
      type: audioType,
      status: "generating",
      createdAt: new Date().toISOString(),
    };
    setGenerations((prev) => [newGen, ...prev]);

    try {
      const body: Record<string, unknown> = {
        projectId: Number(projectId),
        prompt: prompt.trim(),
        type: audioType,
      };

      if (audioType === "voice") {
        body.character = selectedCharacter;
      } else {
        body.durationSeconds = duration;
        if (audioType === "sfx") body.promptInfluence = promptInfluence;
        if (audioType === "music") body.negativePrompt = negativePrompt || undefined;
      }

      const res = await fetch("/api/audio-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Generation failed: ${res.status}` }));
        throw new Error(err.error || `Generation failed: ${res.status}`);
      }

      const data = await res.json();

      if (data.status === "completed") {
        // SFX / Voice: returned immediately with result
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === tempId
              ? {
                  ...g,
                  id: data.id ? String(data.id) : tempId,
                  status: "completed" as const,
                  storagePath: data.storagePath,
                  filename: data.filename,
                  mimeType: data.mimeType,
                  fileSize: data.fileSize,
                }
              : g
          )
        );
        toast.success(audioType === "voice" ? "Voice line generated" : "Sound effect generated", {
          action: {
            label: "Save to Drive",
            onClick: () => handleSaveToDrive({ id: data.id ? String(data.id) : tempId, prompt: prompt.trim(), type: audioType, status: "completed", storagePath: data.storagePath, filename: data.filename, mimeType: data.mimeType || "audio/mpeg", fileSize: data.fileSize || 0, createdAt: new Date().toISOString() }),
          },
        });
      } else if (data.status === "generating" && data.id) {
        // Music: submitted to queue — update ID and start polling
        const realId = String(data.id);
        setGenerations((prev) =>
          prev.map((g) => (g.id === tempId ? { ...g, id: realId } : g))
        );
        startPolling(realId, tempId);
        toast.info("Audio generation started — this may take up to a minute");
      } else {
        throw new Error(data.error || "Unexpected response");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setGenerations((prev) =>
        prev.map((g) => (g.id === tempId ? { ...g, status: "failed", error: msg } : g))
      );
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }, [prompt, audioType, duration, promptInfluence, negativePrompt, projectId, startPolling, selectedCharacter]);

  const handlePlay = useCallback((gen: GeneratedAudio) => {
    if (playingId === gen.id) {
      playingRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (playingRef.current) {
      playingRef.current.pause();
    }
    const audio = new Audio(`/api/storage/${gen.storagePath}`);
    audio.onended = () => setPlayingId(null);
    audio.play();
    playingRef.current = audio;
    setPlayingId(gen.id);
  }, [playingId]);

  const handleDownload = useCallback((gen: GeneratedAudio) => {
    const a = document.createElement("a");
    a.href = `/api/storage/${gen.storagePath}`;
    a.download = gen.filename || "audio.mp3";
    a.click();
  }, []);

  const handleSaveToDrive = useCallback(async (gen: GeneratedAudio) => {
    try {
      const res = await fetch("/api/drive/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          filename: gen.filename,
          storagePath: gen.storagePath,
          mimeType: gen.mimeType || "audio/mpeg",
          fileSize: gen.fileSize || 0,
          fileType: "audio",
          caption: gen.prompt,
          generatedBy: gen.type === "sfx" ? "elevenlabs" : gen.type === "voice" ? "elevenlabs" : "fal.ai",
          generationPrompt: gen.prompt,
        }),
      });
      if (!res.ok) throw new Error("Failed to save to drive");
      toast.success("Saved to Asset Drive");
    } catch {
      toast.error("Failed to save to drive");
    }
  }, [projectId]);

  const handleDelete = useCallback(async (gen: GeneratedAudio) => {
    // Stop polling if active
    const interval = pollIntervalsRef.current.get(gen.id);
    if (interval) {
      clearInterval(interval);
      pollIntervalsRef.current.delete(gen.id);
    }
    // Remove from UI immediately
    setGenerations((prev) => prev.filter((g) => g.id !== gen.id));
    // Delete from DB if it has a real ID (not temp)
    if (!gen.id.startsWith("temp-")) {
      try {
        await fetch("/api/audio-studio", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: Number(gen.id) }),
        });
      } catch { /* non-critical */ }
    }
    if (playingId === gen.id) {
      playingRef.current?.pause();
      setPlayingId(null);
    }
    toast.success("Deleted");
  }, [playingId]);

  const presets = audioType === "music" ? MUSIC_PRESETS : audioType === "sfx" ? SFX_PRESETS : VOICE_PRESETS;

  const typeLabel = audioType === "music" ? "Music" : audioType === "sfx" ? "Sound Effect" : "Voice Line";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      {/* -- Header bar -- */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 shadow-[0_1px_20px_var(--glow-primary)]">
        <div className="px-4 md:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap">Audio Studio</h1>
            {generations.length > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {completedCount} track{completedCount !== 1 ? "s" : ""}
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

          {/* Type toggle (compact, 3 tabs) */}
          <div className="flex gap-0.5 p-0.5 bg-muted/60 rounded-lg" role="group" aria-label="Audio type">
            {([
              ["music", "Music"],
              ["sfx", "SFX"],
              ["voice", "Voice"],
            ] as [AudioType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setAudioType(key)}
                aria-pressed={audioType === key}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  audioType === key
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 ml-auto">
            {([
              ["all", "All", generations.length],
              ["completed", "Ready", completedCount],
              ["generating", "Generating", generatingCount],
              ["failed", "Failed", failedCount],
            ] as [GalleryFilter, string, number][]).map(([key, label, count]) => (
              count > 0 || key === "all" ? (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                    filter === key
                      ? "bg-primary/15 text-primary"
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

          <Button
            onClick={() => setPanelOpen(true)}
            size="sm"
            className="gap-1.5 shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" />
            </svg>
            <span className="hidden sm:inline">Create</span>
          </Button>
        </div>

        {/* Type counts sub-bar */}
        {generations.length > 0 && (
          <div className="px-4 md:px-6 pb-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            {musicCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />{musicCount} music</span>}
            {sfxCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />{sfxCount} sfx</span>}
            {voiceCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />{voiceCount} voice</span>}
          </div>
        )}
      </div>

      {/* -- Audio List -- */}
      <div className="p-4 md:p-6">
        {filteredGenerations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 flex items-center justify-center mb-5 shadow-sm">
              <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M8 1v14M4 4v8M12 4v8M2 6v4M6 3v10M10 3v10M14 6v4" />
              </svg>
            </div>
            {filter !== "all" ? (
              <>
                <h2 className="text-lg font-semibold mb-1">No results</h2>
                <p className="text-sm text-muted-foreground mb-4">No audio matches this filter</p>
                <Button variant="outline" size="sm" onClick={() => setFilter("all")}>Show all</Button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-1">No audio generated yet</h2>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-5">
                  Enter a prompt and generate {audioType === "music" ? "music" : audioType === "sfx" ? "sound effects" : "voice lines"} for your project
                </p>
                <Button onClick={() => setPanelOpen(true)} className="gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  Create Audio
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {filteredGenerations.map((gen) => {
              const waveformBars = gen.status === "completed" ? seededWaveformBars(gen.id, 24) : [];
              const isPlaying = playingId === gen.id;

              return (
                <div
                  key={gen.id}
                  className="flex items-center gap-3 rounded-xl border border-border/40 backdrop-blur-sm bg-card/80 p-3.5 transition-all duration-300 hover:bg-muted/40 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Status icon / waveform */}
                  <div className="shrink-0">
                    {gen.status === "generating" ? (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shadow-[0_0_12px_var(--glow-primary)]">
                        <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" className="opacity-25" />
                          <path d="M4 12a8 8 0 018-8" className="opacity-75" />
                        </svg>
                      </div>
                    ) : gen.status === "failed" ? (
                      <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shadow-sm">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-destructive">
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </div>
                    ) : (
                      /* Waveform visualization for completed items */
                      <button
                        onClick={() => handlePlay(gen)}
                        className="flex items-end gap-[2px] h-10 px-1.5 rounded-lg hover:bg-primary/10 transition-all duration-300 cursor-pointer hover:shadow-sm"
                        aria-label={isPlaying ? "Pause audio" : "Play audio"}
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {waveformBars.map((h, i) => (
                          <span
                            key={i}
                            className={`w-[3px] rounded-full transition-colors ${
                              isPlaying ? "bg-primary animate-pulse" : "bg-primary/40"
                            }`}
                            style={{ height: `${h}%`, animationDelay: isPlaying ? `${i * 50}ms` : undefined }}
                          />
                        ))}
                      </button>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{gen.prompt}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                        gen.type === "music"
                          ? "bg-violet-500/10 text-violet-500"
                          : gen.type === "voice"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}>
                        {gen.type}
                      </span>
                      {gen.fileSize && (
                        <span className="text-[10px] text-muted-foreground">
                          {(gen.fileSize / 1024 / 1024).toFixed(1)}MB
                        </span>
                      )}
                      {gen.status === "failed" && (
                        <span className="text-[10px] text-destructive truncate">{gen.error}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {gen.status === "completed" && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handlePlay(gen)}
                        className="p-2 rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
                        title={isPlaying ? "Pause" : "Play"}
                        aria-label={isPlaying ? "Pause audio" : "Play audio"}
                      >
                        {isPlaying ? (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-primary">
                            <rect x="3" y="2" width="4" height="12" rx="1" />
                            <rect x="9" y="2" width="4" height="12" rx="1" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-primary ml-0.5">
                            <path d="M4 2l10 6-10 6V2z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleDownload(gen)}
                        className="p-2 rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Download"
                        aria-label="Download audio file"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M8 2v8M8 10L5 7M8 10L11 7" />
                          <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleSaveToDrive(gen)}
                        className="p-2 rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Save to Asset Drive"
                        aria-label="Save to Asset Drive"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 4a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(gen)}
                        className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                        aria-label="Delete audio"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {/* Delete for failed/generating items */}
                  {gen.status !== "completed" && (
                    <button
                      onClick={() => setDeleteTarget(gen)}
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -- Creation Panel (Sheet) -- */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col bg-background/95 backdrop-blur-md border-border/40 text-foreground shadow-[0_0_30px_var(--glow-primary)]">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60 shrink-0">
            <SheetTitle className="text-foreground">Create Audio</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
            {/* Type Toggle (3 tabs) */}
            <div className="flex gap-1 p-1 bg-muted/60 rounded-lg" role="group" aria-label="Audio type">
              <button
                onClick={() => setAudioType("music")}
                aria-pressed={audioType === "music"}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  audioType === "music"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M6 2v10a2.5 2.5 0 11-2-2.45V4l8-2v9a2.5 2.5 0 11-2-2.45V2L6 2z" />
                  </svg>
                  Music
                </span>
              </button>
              <button
                onClick={() => setAudioType("sfx")}
                aria-pressed={audioType === "sfx"}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  audioType === "sfx"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M8 1v14M4 4v8M12 4v8M2 6v4M6 3v10M10 3v10M14 6v4" />
                  </svg>
                  SFX
                </span>
              </button>
              <button
                onClick={() => setAudioType("voice")}
                aria-pressed={audioType === "voice"}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  audioType === "voice"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M8 1v6a2 2 0 004 0V5M8 7a2 2 0 01-4 0V5M8 11v3M5 14h6" />
                  </svg>
                  Voice
                </span>
              </button>
            </div>

            {/* Voice: Character Selector */}
            {audioType === "voice" && (
              <div>
                <Label htmlFor="voice-character" className="flex items-center gap-1 mb-1.5 text-muted-foreground">
                  Character
                  <InfoTooltip text="Select a character from your project cast to generate their voice line." />
                </Label>
                <select
                  id="voice-character"
                  value={selectedCharacter}
                  onChange={(e) => setSelectedCharacter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select a character...</option>
                  {characters.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
                {characters.length === 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">No characters found. Add characters to your project first.</p>
                )}
              </div>
            )}

            {/* Prompt / Line to speak */}
            <div>
              <Label htmlFor="audio-prompt" className="flex items-center gap-1 mb-1.5 text-muted-foreground">
                {audioType === "voice" ? "Line to speak" : "Prompt"}
                <InfoTooltip text={
                  audioType === "music"
                    ? "Describe the music you want: genre, mood, instruments, tempo, film style."
                    : audioType === "sfx"
                    ? "Describe the sound effect precisely: what makes the sound, the environment, intensity."
                    : "Type the dialogue line the character will say."
                } />
              </Label>
              <textarea
                id="audio-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  audioType === "music"
                    ? "e.g., Melancholic piano piece with gentle strings, slow tempo, reflective mood..."
                    : audioType === "sfx"
                    ? "e.g., Heavy rain on a metal roof with distant thunder..."
                    : "e.g., I never thought it would end like this..."
                }
                rows={3}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {audioType === "voice" && (
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                  Uses ElevenLabs Text-to-Speech. Select a character and type the dialogue line.
                </p>
              )}
            </div>

            {/* Duration (Music & SFX only) */}
            {audioType !== "voice" && (
              <div>
                <Label htmlFor="audio-duration" className="flex items-center gap-1 mb-1.5 text-muted-foreground">
                  Duration (seconds)
                  <InfoTooltip text={audioType === "music"
                    ? "Music duration in seconds. Stable Audio supports up to 47 seconds."
                    : "Sound effect duration. ElevenLabs supports 0.5 to 22 seconds."
                  } />
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="audio-duration"
                    type="range"
                    min={audioType === "sfx" ? 1 : 5}
                    max={audioType === "sfx" ? 22 : 47}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-sm font-mono w-8 text-right text-muted-foreground">{duration}s</span>
                </div>
              </div>
            )}

            {/* SFX-specific: Prompt Influence */}
            {audioType === "sfx" && (
              <div>
                <Label htmlFor="audio-prompt-influence" className="flex items-center gap-1 mb-1.5 text-muted-foreground">
                  Prompt Influence
                  <InfoTooltip text="How closely the output follows the prompt. Higher = more literal, Lower = more creative variation." />
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="audio-prompt-influence"
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={promptInfluence}
                    onChange={(e) => setPromptInfluence(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-sm font-mono w-8 text-right text-muted-foreground">{promptInfluence.toFixed(1)}</span>
                </div>
              </div>
            )}

            {/* Music-specific: Negative prompt */}
            {audioType === "music" && (
              <div>
                <Label htmlFor="audio-negative-prompt" className="flex items-center gap-1 mb-1.5 text-muted-foreground">
                  Negative Prompt
                  <InfoTooltip text="Describe what to avoid: distortion, vocals, specific instruments, genres." />
                </Label>
                <Input
                  id="audio-negative-prompt"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="e.g., vocals, distortion, electronic beats"
                  className="border-border bg-card text-foreground placeholder:text-muted-foreground"
                />
              </div>
            )}

            {/* Presets */}
            <div>
              <Label className="mb-1.5 block text-muted-foreground">
                {audioType === "music" ? "Music Presets" : audioType === "sfx" ? "SFX Presets" : "Sample Lines"}
              </Label>
              <div className="grid gap-1.5 max-h-[280px] overflow-y-auto pr-1">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setPrompt(preset.prompt)}
                    className="text-left rounded-lg border border-border/40 backdrop-blur-sm bg-card/80 px-3 py-2 text-sm hover:bg-muted/60 hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 group"
                  >
                    <p className="font-medium text-xs text-muted-foreground group-hover:text-primary transition-colors">{preset.label}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{preset.prompt}</p>
                  </button>
                ))}
              </div>
            </div>

            </div>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border/40 bg-background/90 px-6 py-4 space-y-2">
            <Button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim() || (audioType === "voice" && !selectedCharacter)}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" className="opacity-75" />
                  </svg>
                  Generating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
                    <circle cx="8" cy="8" r="3" />
                  </svg>
                  Generate {typeLabel}
                </span>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              {audioType === "music"
                ? "Uses Stable Audio via fal.ai. Up to 47s. ~$0.04/gen."
                : audioType === "sfx"
                ? "Uses ElevenLabs Sound Generation. Up to 22s."
                : "Uses ElevenLabs Text-to-Speech."}
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => { if (!open) setDeleteTarget(null); }}
        title="Delete Audio"
        description={`"${deleteTarget?.prompt || "This audio"}" will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
      />
    </div>
  );
}
