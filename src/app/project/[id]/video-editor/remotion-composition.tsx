"use client";

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Video,
  Audio,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// ── Types (mirrors main editor) ──

export interface RemotionClip {
  id: number;
  trackId: number;
  type: string;
  name: string | null;
  startMs: number;
  durationMs: number;
  sourceStartMs: number;
  sourceEndMs: number | null;
  sourcePath: string | null;
  volume: number;
  opacity: number;
  playbackRate: number;
  textContent: string | null;
  textStyle: string | null;
  filters: string | null;
  transition: string | null;
}

export interface RemotionTrack {
  id: number;
  type: string;
  name: string;
  muted: boolean;
  volume: number;
  sortOrder: number;
  clips: RemotionClip[];
}

export interface TimelineCompositionProps {
  tracks: RemotionTrack[];
}

// ── Filter/Transition parsing ──

interface FilterEntry {
  type: string;
  value: number;
}

function parseFilters(json: string | null): FilterEntry[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function parseTransition(
  json: string | null
): { type: string; durationMs: number } | null {
  if (!json) return null;
  try {
    const t = JSON.parse(json);
    return t.type && t.type !== "none" ? t : null;
  } catch {
    return null;
  }
}

function buildCSSFilter(filters: FilterEntry[]): string {
  const parts: string[] = [];
  for (const f of filters) {
    switch (f.type) {
      case "brightness":
        parts.push(`brightness(${1 + f.value / 100})`);
        break;
      case "contrast":
        parts.push(`contrast(${1 + f.value / 100})`);
        break;
      case "saturation":
        parts.push(`saturate(${1 + f.value / 100})`);
        break;
      case "temperature": {
        if (f.value > 0)
          parts.push(
            `sepia(${f.value / 100}) saturate(${1 + f.value / 200})`
          );
        else parts.push(`hue-rotate(${f.value}deg)`);
        break;
      }
    }
  }
  return parts.length > 0 ? parts.join(" ") : "";
}

const NON_CSS_FILTERS = new Set([
  "grain",
  "chromatic",
  "lensflare",
  "pipX",
  "pipY",
  "pipScale",
  "splitRegion",
  "kenBurns",
  "chromaKey",
  "chromaTolerance",
  "chromaColor",
]);

// ── Split Screen regions ──

const SPLIT_REGIONS: Record<number, React.CSSProperties> = {
  1: { width: "50%", height: "100%", left: 0, top: 0 },
  2: { width: "50%", height: "100%", left: "50%", top: 0 },
  3: { width: "100%", height: "50%", left: 0, top: 0 },
  4: { width: "100%", height: "50%", left: 0, top: "50%" },
  5: { width: "50%", height: "50%", left: 0, top: 0 },
  6: { width: "50%", height: "50%", left: "50%", top: 0 },
  7: { width: "50%", height: "50%", left: 0, top: "50%" },
  8: { width: "50%", height: "50%", left: "50%", top: "50%" },
};

// ── Text position presets ──

function getPositionStyle(
  position: string,
  entranceProgress: number
): React.CSSProperties {
  const offset = (1 - entranceProgress) * 30;
  const map: Record<string, React.CSSProperties> = {
    "top-left": { top: 40, left: 40, transform: `translateY(${-offset}px)` },
    "top-center": {
      top: 40,
      left: "50%",
      transform: `translateX(-50%) translateY(${-offset}px)`,
    },
    "top-right": { top: 40, right: 40, transform: `translateY(${-offset}px)` },
    center: {
      top: "50%",
      left: "50%",
      transform: `translate(-50%, -50%) scale(${entranceProgress})`,
    },
    "bottom-left": {
      bottom: 40,
      left: 40,
      transform: `translateY(${offset}px)`,
    },
    "bottom-center": {
      bottom: 40,
      left: "50%",
      transform: `translateX(-50%) translateY(${offset}px)`,
    },
    "bottom-right": {
      bottom: 40,
      right: 40,
      transform: `translateY(${offset}px)`,
    },
  };
  return map[position] || map["bottom-center"];
}

// ── Grain overlay (CSS noise) ──

function GrainOverlay({ intensity }: { intensity: number }) {
  const frame = useCurrentFrame();
  // Regenerate grain position each frame for animation
  const offsetX = (frame * 17) % 200;
  const offsetY = (frame * 31) % 200;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: intensity / 200,
        mixBlendMode: "overlay",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
        pointerEvents: "none",
      }}
    />
  );
}

// ── Video Clip Component ──

function VideoClipComponent({
  clip,
  trackVolume,
}: {
  clip: RemotionClip;
  trackVolume: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const filters = parseFilters(clip.filters);
  const trans = parseTransition(clip.transition);

  // Transition opacity
  let transAlpha = 1;
  let clipPath: string | undefined;
  if (trans && trans.durationMs > 0) {
    const transFrames = Math.ceil((trans.durationMs / 1000) * fps);
    if (trans.type === "dissolve" || trans.type === "fade-black") {
      transAlpha = interpolate(frame, [0, transFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    } else if (trans.type === "wipe-left") {
      const progress = interpolate(frame, [0, transFrames], [0, 100], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      clipPath = `inset(0 ${100 - progress}% 0 0)`;
    }
  }

  // PiP
  const pipX = filters.find((f) => f.type === "pipX")?.value ?? 0;
  const pipY = filters.find((f) => f.type === "pipY")?.value ?? 0;
  const pipScale = filters.find((f) => f.type === "pipScale")?.value ?? 100;
  const isPiP = pipScale < 100 || pipX !== 0 || pipY !== 0;

  // Split screen
  const splitRegion = filters.find((f) => f.type === "splitRegion")?.value ?? 0;

  // CSS filters
  const cssFilter = buildCSSFilter(
    filters.filter((f) => !NON_CSS_FILTERS.has(f.type))
  );

  // Grain
  const grain = filters.find((f) => f.type === "grain");

  if (!clip.sourcePath) return null;

  const startFrom = Math.round((clip.sourceStartMs / 1000) * fps);

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    opacity: clip.opacity * transAlpha,
    filter: cssFilter || undefined,
    clipPath,
    overflow: "hidden",
    ...(isPiP
      ? {
          width: `${pipScale}%`,
          height: `${pipScale}%`,
          left: `${pipX}%`,
          top: `${pipY}%`,
          inset: undefined,
          borderRadius: 8,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }
      : {}),
    ...(splitRegion > 0 ? SPLIT_REGIONS[splitRegion] : {}),
  };

  return (
    <div style={containerStyle}>
      <Video
        src={`/api/storage/${clip.sourcePath}`}
        startFrom={startFrom}
        volume={clip.volume * trackVolume}
        playbackRate={clip.playbackRate || 1}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      {grain && grain.value > 0 && <GrainOverlay intensity={grain.value} />}
    </div>
  );
}

// ── Image Clip Component ──

function ImageClipComponent({ clip }: { clip: RemotionClip }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const filters = parseFilters(clip.filters);
  const trans = parseTransition(clip.transition);
  const totalFrames = Math.ceil((clip.durationMs / 1000) * fps);

  // Transition
  let transAlpha = 1;
  if (trans && trans.durationMs > 0) {
    const transFrames = Math.ceil((trans.durationMs / 1000) * fps);
    if (trans.type === "dissolve" || trans.type === "fade-black") {
      transAlpha = interpolate(frame, [0, transFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
  }

  // Ken Burns
  const kenBurns = filters.find((f) => f.type === "kenBurns");
  let imgTransform = "";
  if (kenBurns && kenBurns.value > 0) {
    const progress = interpolate(frame, [0, totalFrames], [0, 1], {
      extrapolateRight: "clamp",
    });
    const intensity = kenBurns.value / 100;
    const zoom = 1 + intensity * 0.3 * progress;
    const panX = intensity * 10 * progress;
    const panY = intensity * 5 * progress;
    imgTransform = `scale(${zoom}) translate(${-panX}%, ${-panY}%)`;
  }

  // Split screen
  const splitRegion = filters.find((f) => f.type === "splitRegion")?.value ?? 0;

  // CSS filters
  const cssFilter = buildCSSFilter(
    filters.filter((f) => !NON_CSS_FILTERS.has(f.type))
  );

  // Grain
  const grain = filters.find((f) => f.type === "grain");

  if (!clip.sourcePath) return null;

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    opacity: clip.opacity * transAlpha,
    filter: cssFilter || undefined,
    overflow: "hidden",
    ...(splitRegion > 0 ? SPLIT_REGIONS[splitRegion] : {}),
  };

  return (
    <div style={containerStyle}>
      <Img
        src={`/api/storage/${clip.sourcePath}`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: imgTransform || undefined,
        }}
      />
      {grain && grain.value > 0 && <GrainOverlay intensity={grain.value} />}
    </div>
  );
}

// ── Text Clip Component ──

function TextClipComponent({ clip }: { clip: RemotionClip }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!clip.textContent) return null;

  const totalFrames = Math.ceil((clip.durationMs / 1000) * fps);

  // Transition
  const trans = parseTransition(clip.transition);
  let opacity = clip.opacity;
  if (trans && trans.durationMs > 0) {
    const transFrames = Math.ceil((trans.durationMs / 1000) * fps);
    opacity *= interpolate(frame, [0, transFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  // Fade out last 500ms
  const fadeOutFrames = Math.min(
    Math.ceil(0.5 * fps),
    Math.floor(totalFrames / 3)
  );
  opacity *= interpolate(
    frame,
    [totalFrames - fadeOutFrames, totalFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Spring entrance
  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  let style: Record<string, unknown> = {};
  try {
    if (clip.textStyle) style = JSON.parse(clip.textStyle);
  } catch {}

  const position = (style.position as string) || "bottom-center";
  const posStyle = getPositionStyle(position, entrance);

  return (
    <div
      style={{
        position: "absolute",
        opacity,
        ...posStyle,
        fontSize: (style.fontSize as number) || 24,
        fontFamily: (style.fontFamily as string) || "sans-serif",
        color: (style.color as string) || "#ffffff",
        background: (style.background as string) || "rgba(0,0,0,0.7)",
        padding: "8px 16px",
        borderRadius: 4,
        whiteSpace: "pre-wrap",
        maxWidth: "80%",
        textAlign: "center",
        textShadow: "0 2px 4px rgba(0,0,0,0.5)",
        lineHeight: 1.4,
        letterSpacing: "0.02em",
      }}
    >
      {clip.textContent}
    </div>
  );
}

// ── Audio Clip Component ──

function AudioClipComponent({
  clip,
  trackVolume,
}: {
  clip: RemotionClip;
  trackVolume: number;
}) {
  const { fps } = useVideoConfig();

  if (!clip.sourcePath) return null;

  const startFrom = Math.round((clip.sourceStartMs / 1000) * fps);

  return (
    <Audio
      src={`/api/storage/${clip.sourcePath}`}
      startFrom={startFrom}
      volume={clip.volume * trackVolume}
      playbackRate={clip.playbackRate || 1}
    />
  );
}

// ── Main Timeline Composition ──

export const TimelineComposition: React.FC<TimelineCompositionProps> = ({
  tracks,
}) => {
  const { fps } = useVideoConfig();

  // Video/image tracks: higher sortOrder = behind (rendered first)
  const videoTracks = tracks
    .filter((t) => (t.type === "video" || t.type === "overlay") && !t.muted)
    .sort((a, b) => b.sortOrder - a.sortOrder);

  // Text tracks
  const textTracks = tracks
    .filter((t) => t.type === "text" && !t.muted)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Audio tracks
  const audioTracks = tracks.filter((t) => t.type === "audio" && !t.muted);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Video/Image layers */}
      {videoTracks.map((track) => (
        <React.Fragment key={track.id}>
          {track.clips.map((clip) => {
            const startFrame = Math.round((clip.startMs / 1000) * fps);
            const durationFrames = Math.max(
              1,
              Math.round((clip.durationMs / 1000) * fps)
            );

            return (
              <Sequence
                key={clip.id}
                from={startFrame}
                durationInFrames={durationFrames}
                name={clip.name || `Clip ${clip.id}`}
              >
                {clip.type === "video" ? (
                  <VideoClipComponent clip={clip} trackVolume={track.volume} />
                ) : clip.type === "image" ? (
                  <ImageClipComponent clip={clip} />
                ) : null}
              </Sequence>
            );
          })}
        </React.Fragment>
      ))}

      {/* Text layers */}
      {textTracks.map((track) => (
        <React.Fragment key={track.id}>
          {track.clips.map((clip) => {
            const startFrame = Math.round((clip.startMs / 1000) * fps);
            const durationFrames = Math.max(
              1,
              Math.round((clip.durationMs / 1000) * fps)
            );

            return (
              <Sequence
                key={clip.id}
                from={startFrame}
                durationInFrames={durationFrames}
                name={clip.name || `Text ${clip.id}`}
              >
                <TextClipComponent clip={clip} />
              </Sequence>
            );
          })}
        </React.Fragment>
      ))}

      {/* Audio layers */}
      {audioTracks.map((track) => (
        <React.Fragment key={track.id}>
          {track.clips.map((clip) => {
            const startFrame = Math.round((clip.startMs / 1000) * fps);
            const durationFrames = Math.max(
              1,
              Math.round((clip.durationMs / 1000) * fps)
            );

            return (
              <Sequence
                key={clip.id}
                from={startFrame}
                durationInFrames={durationFrames}
                name={clip.name || `Audio ${clip.id}`}
              >
                <AudioClipComponent clip={clip} trackVolume={track.volume} />
              </Sequence>
            );
          })}
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};
