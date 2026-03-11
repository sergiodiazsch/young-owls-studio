"use client";

import { memo, useRef, useState, useEffect } from "react";
import type { VideoGeneration } from "@/lib/types";
import {
  humanizeError,
  getDisplayModelName,
} from "@/components/video-gen/video-gen-models";

export interface VideoCardProps {
  gen: VideoGeneration;
  onPlay: () => void;
  onFavorite: () => void;
  onSave: () => void;
  onDelete: () => void;
  onRetry?: () => void;
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

function formatElapsed(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const totalSec = Math.floor(diff / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `0:${secs.toString().padStart(2, "0")}`;
}

export const VideoCard = memo(function VideoCard({ gen, onPlay, onFavorite, onSave, onDelete, onRetry }: VideoCardProps) {
  const isReady = gen.status === "completed";
  const isFailed = gen.status === "failed";
  const isPending = gen.status === "submitted" || gen.status === "processing";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const [elapsed, setElapsed] = useState(() => isPending ? formatElapsed(gen.createdAt) : "");
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Elapsed time ticker for pending states
  useEffect(() => {
    if (!isPending) return;
    setElapsed(formatElapsed(gen.createdAt));
    const id = setInterval(() => setElapsed(formatElapsed(gen.createdAt)), 1000);
    return () => clearInterval(id);
  }, [isPending, gen.createdAt]);

  // Play preview on hover
  function handleMouseEnter() {
    setHovered(true);
    if (isReady && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }

  function handleMouseLeave() {
    setHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  return (
    <div
      className="group relative rounded-xl overflow-hidden bg-black/40 dark:bg-white/[0.03] border border-transparent hover:border-white/[0.08] transition-all duration-300 cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={isReady ? onPlay : undefined}
    >
      {/* Thumbnail / Video area */}
      <div className="relative aspect-video bg-black/60 overflow-hidden">
        {isReady && (
          <video
            ref={videoRef}
            src={`/api/generate/video/generations/${gen.id}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            preload="metadata"
            muted
            loop
            playsInline
          />
        )}

        {isPending && (
          <>
            {/* Animated shimmer background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-black/60 to-primary/[0.05]" />
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />

            {/* Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              {/* Spinner with glow */}
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg animate-pulse" />
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="relative animate-spin">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" className="text-white/[0.08]" />
                  <path d="M44 24a20 20 0 00-20-20" stroke="url(#spinner-grad)" strokeWidth="2" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="spinner-grad" x1="44" y1="24" x2="24" y2="4">
                      <stop stopColor="hsl(var(--primary))" />
                      <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Status label */}
              <span className="text-[10px] text-white/40 font-medium uppercase tracking-[0.15em]">
                {gen.status === "processing" ? "Processing" : "In queue"}
              </span>

              {/* Elapsed time counter */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.06]">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] text-white/60 font-mono tabular-nums">{elapsed}</span>
              </div>
            </div>

            {/* Bottom prompt for pending */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/40 to-transparent">
              <p className="text-[11px] text-white/30 line-clamp-1">{gen.prompt}</p>
            </div>
          </>
        )}

        {isFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 bg-gradient-to-b from-red-950/20 to-background/40">
            {/* Muted exclamation triangle icon */}
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400/80">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            {/* Human-readable error */}
            <span className="text-[11px] text-red-300/80 text-center leading-relaxed line-clamp-2">
              {humanizeError(gen.error)}
            </span>
            {/* Retry button */}
            {onRetry && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetry(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/[0.1] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                </svg>
                Retry
              </button>
            )}
            {/* Expandable technical details */}
            {gen.error && gen.error !== humanizeError(gen.error) && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowTechnicalDetails(!showTechnicalDetails); }}
                className="text-[9px] text-white/30 hover:text-white/50 transition-colors"
              >
                {showTechnicalDetails ? "Hide" : "Technical"} details
              </button>
            )}
            {showTechnicalDetails && gen.error && (
              <p className="text-[9px] text-white/25 text-center leading-relaxed line-clamp-3 font-mono break-all max-w-full">
                {gen.error}
              </p>
            )}
          </div>
        )}

        {/* Hover overlay — play button + gradient */}
        {isReady && (
          <div className={`absolute inset-0 transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-[0_0_24px_rgba(255,255,255,0.1)]">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="white" className="ml-0.5">
                  <path d="M4 2l10 6-10 6V2z" />
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
        <div className={`absolute top-2 right-2 z-10 transition-opacity duration-200 ${hovered ? "opacity-100" : "opacity-70"}`}>
          <span className="text-[10px] font-medium text-white bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
            {getDisplayModelName(gen.model)}
          </span>
        </div>

        {/* Bottom info for failed state */}
        {isFailed && (
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-[11px] text-white/40 line-clamp-1">{gen.prompt}</p>
          </div>
        )}

        {/* Bottom hover overlay — unified: prompt + meta + actions */}
        <div className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/70 to-transparent transition-all duration-300 ${hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"}`}>
          {/* Prompt + meta */}
          {isReady && (
            <div className="px-3 pt-4 pb-1.5">
              <p className="text-[11px] text-white/90 line-clamp-2 leading-relaxed">{gen.prompt}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-white/50">{formatRelative(gen.createdAt)}</span>
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
              <a
                href={`/api/generate/video/generations/${gen.id}`}
                download={`video-${gen.id}.mp4`}
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
      </div>
    </div>
  );
});
