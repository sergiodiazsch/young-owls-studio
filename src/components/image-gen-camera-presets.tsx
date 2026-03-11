"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

const CAMERA_ANGLE_PRESETS = [
  { label: "Front", azimuth: 0, elevation: 20, distance: 5 },
  { label: "3/4 Right", azimuth: 45, elevation: 20, distance: 5 },
  { label: "Right Profile", azimuth: 90, elevation: 20, distance: 5 },
  { label: "3/4 Rear Right", azimuth: 135, elevation: 20, distance: 5 },
  { label: "Rear", azimuth: 180, elevation: 20, distance: 5 },
  { label: "3/4 Rear Left", azimuth: 225, elevation: 20, distance: 5 },
  { label: "Left Profile", azimuth: 270, elevation: 20, distance: 5 },
  { label: "3/4 Left", azimuth: 315, elevation: 20, distance: 5 },
  { label: "Bird's Eye", azimuth: 0, elevation: 60, distance: 5 },
  { label: "High Angle", azimuth: 30, elevation: 45, distance: 5 },
  { label: "Low Angle", azimuth: 0, elevation: 5, distance: 5 },
  { label: "Dutch Angle", azimuth: 20, elevation: 25, distance: 5 },
];

interface Props {
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

/* ---------- CSS 3D cube face helper ---------- */
function CubeFace({
  transform,
  className,
}: {
  transform: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 border border-white/20 rounded-[2px]",
        className
      )}
      style={{
        transform,
        backfaceVisibility: "visible",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    />
  );
}

/* ---------- Camera dot ---------- */
function CameraDot({
  preset,
  isSelected,
  isHovered,
  onToggle,
  onHover,
  onLeave,
  radius,
}: {
  preset: (typeof CAMERA_ANGLE_PRESETS)[number];
  isSelected: boolean;
  isHovered: boolean;
  onToggle: () => void;
  onHover: () => void;
  onLeave: () => void;
  radius: number;
}) {
  const azRad = (preset.azimuth * Math.PI) / 180;
  const elRad = (preset.elevation * Math.PI) / 180;

  // Spherical to Cartesian (Y-up)
  const x = radius * Math.cos(elRad) * Math.sin(azRad);
  const y = radius * Math.sin(elRad);
  const z = radius * Math.cos(elRad) * Math.cos(azRad);

  return (
    <div
      style={{
        position: "absolute",
        transform: `translate3d(${x}px, ${-y}px, ${z}px)`,
        transformStyle: "preserve-3d",
      }}
    >
      {/* Connecting line (shown on hover) */}
      {isHovered && (
        <svg
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            overflow: "visible",
            pointerEvents: "none",
            zIndex: 0,
          }}
          width="1"
          height="1"
        >
          <line
            x1="0"
            y1="0"
            x2={-x}
            y2={y}
            stroke="var(--primary)"
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity="0.6"
          />
        </svg>
      )}

      {/* Dot */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        className={cn(
          "relative z-10 rounded-full transition-all duration-300 cursor-pointer border",
          "flex items-center justify-center",
          "-translate-x-1/2 -translate-y-1/2",
          isSelected
            ? "w-3 h-3 border-primary bg-primary glow-sm"
            : "w-2.5 h-2.5 border-muted-foreground/40 bg-muted-foreground/20 hover:border-primary/60 hover:bg-primary/30",
          isHovered && "scale-150"
        )}
        title={preset.label}
      />

      {/* Tooltip label on hover */}
      {isHovered && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-20"
          style={{ bottom: "14px" }}
        >
          <div
            className="px-2 py-0.5 rounded text-[9px] font-medium text-primary-foreground"
            style={{
              background: "var(--primary)",
              boxShadow: "0 2px 8px var(--glow-primary)",
            }}
          >
            {preset.label}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Main component ---------- */
export function ImageGenCameraPresets({
  selected,
  onSelectionChange,
}: Props) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [rotation, setRotation] = useState(0);
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const togglePreset = useCallback(
    (label: string) => {
      const next = new Set(selected);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      onSelectionChange(next);
    },
    [selected, onSelectionChange]
  );

  const allSelected = selected.size === CAMERA_ANGLE_PRESETS.length;

  // Auto-rotate animation
  useEffect(() => {
    const animate = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (!isPaused) {
        setRotation((prev) => (prev + delta * 0.015) % 360);
      }

      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isPaused]);

  const sceneRadius = 70;
  const cubeSize = 24;

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Camera Angles ({selected.size}/12)
        </p>
        <button
          onClick={() => {
            if (allSelected) {
              onSelectionChange(new Set());
            } else {
              onSelectionChange(
                new Set(CAMERA_ANGLE_PRESETS.map((p) => p.label))
              );
            }
          }}
          className="text-[10px] text-primary hover:underline"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* 3D Scene */}
      <div
        className="relative mx-auto overflow-hidden rounded-lg border border-white/10"
        style={{
          height: 200,
          background:
            "radial-gradient(ellipse at center, var(--muted) 0%, var(--background) 70%)",
          perspective: 500,
          perspectiveOrigin: "50% 45%",
        }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => {
          setIsPaused(false);
          setHoveredLabel(null);
        }}
      >
        {/* Scene container — auto-rotates */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transformStyle: "preserve-3d",
            transform: `rotateX(-20deg) rotateY(${rotation}deg)`,
            transition: isPaused ? "transform 0.3s ease-out" : undefined,
          }}
        >
          {/* Central cube subject */}
          <div
            style={{
              position: "absolute",
              width: cubeSize,
              height: cubeSize,
              left: -cubeSize / 2,
              top: -cubeSize / 2,
              transformStyle: "preserve-3d",
            }}
          >
            {/* Front */}
            <CubeFace
              transform={`translateZ(${cubeSize / 2}px)`}
              className="border-primary/30"
            />
            {/* Back */}
            <CubeFace
              transform={`rotateY(180deg) translateZ(${cubeSize / 2}px)`}
            />
            {/* Left */}
            <CubeFace
              transform={`rotateY(-90deg) translateZ(${cubeSize / 2}px)`}
            />
            {/* Right */}
            <CubeFace
              transform={`rotateY(90deg) translateZ(${cubeSize / 2}px)`}
            />
            {/* Top */}
            <CubeFace
              transform={`rotateX(90deg) translateZ(${cubeSize / 2}px)`}
              className="border-primary/20"
            />
            {/* Bottom */}
            <CubeFace
              transform={`rotateX(-90deg) translateZ(${cubeSize / 2}px)`}
            />
          </div>

          {/* Ground ring (visual guide) */}
          <div
            style={{
              position: "absolute",
              width: sceneRadius * 2,
              height: sceneRadius * 2,
              left: -sceneRadius,
              top: -sceneRadius,
              borderRadius: "50%",
              border: "1px dashed",
              borderColor: "var(--muted)",
              transform: "rotateX(90deg)",
              transformStyle: "preserve-3d",
            }}
          />

          {/* Camera dots */}
          {CAMERA_ANGLE_PRESETS.map((preset) => (
            <CameraDot
              key={preset.label}
              preset={preset}
              isSelected={selected.has(preset.label)}
              isHovered={hoveredLabel === preset.label}
              onToggle={() => togglePreset(preset.label)}
              onHover={() => setHoveredLabel(preset.label)}
              onLeave={() => setHoveredLabel(null)}
              radius={sceneRadius}
            />
          ))}
        </div>

        {/* Subtle vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={{
            boxShadow: "inset 0 0 30px var(--background)",
          }}
        />
      </div>

      {/* Pill/chip quick-toggle list */}
      <div className="flex flex-wrap gap-1">
        {CAMERA_ANGLE_PRESETS.map((preset) => {
          const isSelected = selected.has(preset.label);
          const isHovered = hoveredLabel === preset.label;
          return (
            <button
              key={preset.label}
              onClick={() => togglePreset(preset.label)}
              onMouseEnter={() => setHoveredLabel(preset.label)}
              onMouseLeave={() => setHoveredLabel(null)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium transition-all duration-200 border",
                isSelected
                  ? "bg-primary/15 text-primary border-primary/40 glow-sm"
                  : "bg-muted/30 text-muted-foreground border-transparent hover:border-primary/30 hover:text-foreground",
                isHovered && !isSelected && "bg-muted/50 border-primary/20",
                isHovered && isSelected && "glow-md"
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { CAMERA_ANGLE_PRESETS };
