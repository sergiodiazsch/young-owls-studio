"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { VideoGeneration } from "@/lib/types";
import {
  humanizeError,
  getDisplayModelName,
} from "@/components/video-gen/video-gen-models";

interface VideoPlayerModalProps {
  gen: VideoGeneration | null;
  open: boolean;
  onClose: () => void;
  onReuse: (gen: VideoGeneration) => void;
  onRegenerate: (gen: VideoGeneration) => void;
  onFavorite: (id: number) => void;
  onSave: (id: number) => void;
  onDelete: (id: number) => void;
  onGrabFrame?: (dataUrl: string, gen: VideoGeneration) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getModeLabel(mode: string): string {
  switch (mode) {
    case "image-to-video": return "Image to Video";
    case "lipsync": return "Lipsync";
    case "avatar": return "Avatar";
    case "upscale": return "Upscale";
    case "fps-boost": return "FPS Boost";
    default: return mode;
  }
}

export function VideoPlayerModal({
  gen,
  open,
  onClose,
  onReuse,
  onRegenerate,
  onFavorite,
  onSave,
  onDelete,
  onGrabFrame,
}: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showRawError, setShowRawError] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReady = gen?.status === "completed" && gen.storagePath;
  const videoUrl = gen ? `/api/generate/video/generations/${gen.id}` : "";

  // Auto-hide controls
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) setShowControls(true);
    else scheduleHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing, scheduleHide]);

  // Reset state when opening
  useEffect(() => {
    if (open && videoRef.current) {
      setPlaying(false);
      setCurrentTime(0);
    }
  }, [open, gen?.id]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
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

  function togglePlay() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!videoRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * duration;
  }

  function toggleFullscreen() {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  }

  function grabCurrentFrame(): string | null {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/png");
  }

  function handleGrabFrame() {
    if (!gen) return;
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setPlaying(false);
    }
    const dataUrl = grabCurrentFrame();
    if (!dataUrl) { toast.error("Could not capture frame"); return; }
    if (onGrabFrame) {
      onGrabFrame(dataUrl, gen);
      onClose();
    }
  }

  async function handleSaveFrameAsImage() {
    if (!gen) return;
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setPlaying(false);
    }
    const dataUrl = grabCurrentFrame();
    if (!dataUrl) { toast.error("Could not capture frame"); return; }
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("file", blob, `frame-${gen.id}-${Math.floor(currentTime * 1000)}ms.png`);
      formData.append("projectId", String(gen.projectId));
      const uploadRes = await fetch("/api/drive/files/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      toast.success("Frame saved to Drive");
    } catch {
      toast.error("Failed to save frame");
    }
  }

  function handleCopyPrompt() {
    if (!gen) return;
    navigator.clipboard.writeText(gen.prompt);
    toast.success("Prompt copied");
  }

  function handleDownload() {
    if (!gen) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `video-${gen.id}.mp4`;
    a.click();
  }

  function handleDelete() {
    if (!gen) return;
    onDelete(gen.id);
    onClose();
  }

  if (!gen || !open) return null;

  const params = gen.params ? (() => { try { return JSON.parse(gen.params); } catch { return {}; } })() : {};

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm animate-in fade-in-0 duration-300"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative w-full h-full flex animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        {/* ── Left: Video area ── */}
        <div
          className="flex-1 relative select-none bg-black"
          onMouseMove={scheduleHide}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-controls]")) return;
            if ((e.target as HTMLElement).closest("[data-sidebar]")) return;
            togglePlay();
          }}
        >
          {isReady ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-contain"
              autoPlay
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
              onEnded={() => setPlaying(false)}
              muted={muted}
              playsInline
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              {gen.status === "failed" ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400/70">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <p className="text-sm text-white/60 text-center max-w-xs leading-relaxed">{humanizeError(gen.error)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRegenerate(gen); onClose(); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.08] border border-white/[0.1] text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.12] transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                    </svg>
                    Retry
                  </button>
                  {gen.error && gen.error !== humanizeError(gen.error) && (
                    <div className="flex flex-col items-center gap-1 mt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowRawError(!showRawError); }}
                        className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
                      >
                        {showRawError ? "Hide" : "Show"} technical details
                      </button>
                      {showRawError && (
                        <p className="text-[10px] text-white/25 text-center max-w-sm leading-relaxed font-mono break-all">
                          {gen.error}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-12 h-12">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="animate-spin">
                      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" className="text-white/10" />
                      <path d="M44 24a20 20 0 00-20-20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary" />
                    </svg>
                  </div>
                  <p className="text-sm text-white/50 capitalize">{gen.status}...</p>
                </>
              )}
            </div>
          )}

          {/* Play/pause overlay */}
          {isReady && !playing && showControls && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.08)]">
                <svg width="32" height="32" viewBox="0 0 16 16" fill="white" className="ml-1">
                  <path d="M4 2l10 6-10 6V2z" />
                </svg>
              </div>
            </div>
          )}

          {/* Controls bar at bottom */}
          {isReady && (
            <div
              data-controls
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pt-16 pb-4 px-6 transition-opacity duration-300 z-10 ${
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Progress bar */}
              <div
                ref={progressRef}
                className="w-full h-1 bg-white/20 rounded-full mb-3 cursor-pointer group"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full bg-primary rounded-full relative transition-[width] duration-100"
                  style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_rgba(252,186,3,0.5)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="text-white hover:text-primary transition-colors">
                  {playing ? (
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="3" y="2" width="4" height="12" rx="1" />
                      <rect x="9" y="2" width="4" height="12" rx="1" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 2l10 6-10 6V2z" />
                    </svg>
                  )}
                </button>

                <span className="text-xs text-white/70 font-mono tabular-nums min-w-[70px]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <div className="flex items-center gap-1.5">
                  <button onClick={() => setMuted(!muted)} className="text-white/70 hover:text-white transition-colors">
                    {muted || volume === 0 ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                      </svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={muted ? 0 : volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      setMuted(v === 0);
                      if (videoRef.current) videoRef.current.volume = v;
                    }}
                    className="w-16 h-1 accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex-1" />

                <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors" title="Fullscreen">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
                  </svg>
                </button>
              </div>
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

        {/* ── Right: Details sidebar ── */}
        <div
          data-sidebar
          className="w-[340px] h-full bg-card border-l border-white/[0.06] flex flex-col overflow-y-auto animate-in slide-in-from-right-4 duration-300"
        >
          {/* Header */}
          <div className="p-5 border-b border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-[10px] font-medium">
                {getDisplayModelName(gen.model)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {getModeLabel(gen.mode)}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{gen.prompt}</p>
          </div>

          {/* Metadata */}
          <div className="p-5 border-b border-border/50 space-y-2.5">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Details</h3>
            <MetaRow label="Created" value={formatDate(gen.createdAt)} />
            {gen.fileSize > 0 && <MetaRow label="File size" value={formatBytes(gen.fileSize)} />}
            {params.duration && <MetaRow label="Duration" value={`${params.duration}s`} />}
            {params.aspectRatio && <MetaRow label="Aspect ratio" value={params.aspectRatio} />}
            {gen.seed != null && <MetaRow label="Seed" value={String(gen.seed)} mono />}
            {params.cfgScale != null && <MetaRow label="CFG Scale" value={String(params.cfgScale)} />}
            {params.enableAudio != null && <MetaRow label="Audio" value={params.enableAudio ? "Enabled" : "Disabled"} />}
            {gen.cost != null && <MetaRow label="Cost" value={`$${gen.cost.toFixed(3)}`} />}
            {params.negativePrompt && (
              <div>
                <span className="text-[11px] text-muted-foreground">Negative prompt</span>
                <p className="text-[11px] text-foreground mt-0.5 leading-relaxed">{params.negativePrompt}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-5 space-y-2 flex-1">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Actions</h3>

            <ActionButton
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>}
              label="Copy prompt"
              onClick={handleCopyPrompt}
            />
            <ActionButton
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>}
              label="Reuse prompt & settings"
              onClick={() => { onReuse(gen); onClose(); }}
            />
            <ActionButton
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>}
              label="Regenerate"
              onClick={() => { onRegenerate(gen); onClose(); }}
              accent
            />

            {isReady && onGrabFrame && (
              <ActionButton
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>}
                label="Use frame as source"
                onClick={handleGrabFrame}
              />
            )}

            {isReady && (
              <ActionButton
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>}
                label="Save frame to Drive"
                onClick={handleSaveFrameAsImage}
              />
            )}

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
