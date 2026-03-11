"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoTooltip } from "@/components/info-tooltip";
import { ImageGenCameraPresets, CAMERA_ANGLE_PRESETS } from "@/components/image-gen-camera-presets";
import type { ImageGeneration } from "@/lib/types";

// Engine definitions
const CAMERA_ENGINES = [
  {
    id: "camera-angles",
    name: "Flux Multi-Angle",
    cost: "$0.04/angle",
    info: "Generates from text prompt at specified angles. Best for creating concept art from scratch. No source image needed.",
    needsSource: false,
    needsPresets: true,
  },
  {
    id: "stable-zero123",
    name: "Stable Zero123",
    cost: "$0.04/angle",
    info: "Takes an existing image and rotates in 3D. Each angle = 1 image. Best for characters/objects.",
    needsSource: true,
    needsPresets: true,
  },
  {
    id: "era3d",
    name: "Era3D Multi-View",
    cost: "$0.10/batch",
    info: "Takes an existing image and generates 6 canonical views (front, right, back, left, front-right, back-left) in one call.",
    needsSource: true,
    needsPresets: false,
  },
] as const;

interface Props {
  generations: ImageGeneration[];
  enqueue: (options: {
    prompt: string;
    model: string;
    seed?: number;
    cameraPresets?: Array<{ label: string; azimuth: number; elevation: number; distance: number }>;
    sourceImagePath?: string;
  }) => void;
  projectId: string;
  hasApiKey: boolean | null;
}

export function ImageGenCameraSection({ generations, enqueue, projectId, hasApiKey }: Props) {
  const [engine, setEngine] = useState<string>("camera-angles");
  const [prompt, setPrompt] = useState("");
  const [sourceImagePath, setSourceImagePath] = useState<string | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(null);
  const [selectedAngles, setSelectedAngles] = useState<Set<string>>(
    new Set(CAMERA_ANGLE_PRESETS.map((p) => p.label))
  );

  // TECH AUDIT FIX: Added fallback instead of non-null assertion
  const engineConfig = CAMERA_ENGINES.find((e) => e.id === engine) ?? CAMERA_ENGINES[0];

  // Completed generations that can be used as source
  const completedImages = generations.filter(
    (g) => g.status === "completed" && g.storagePath
  );

  function handleSelectSourceFromGen(gen: ImageGeneration) {
    if (!gen.storagePath) return;
    setSourceImagePath(gen.storagePath);
    setSourceImagePreview(`/api/generate/image/generations/${gen.id}/file`);
  }

  async function handleBrowseDrive() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      if (!input.files?.[0]) return;
      const formData = new FormData();
      formData.append("file", input.files[0]);
      formData.append("projectId", projectId);
      try {
        const res = await fetch("/api/drive/files/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const driveFile = await res.json();
        setSourceImagePath(driveFile.storagePath);
        setSourceImagePreview(`/api/drive/files/${driveFile.id}`);
      } catch {
        // error handled silently
      }
    };
    input.click();
  }

  function handleGenerate() {
    if (engineConfig.needsSource && !sourceImagePath) return;
    if (!engineConfig.needsSource && !prompt.trim()) return;
    if (hasApiKey !== true) return;

    if (engine === "era3d") {
      enqueue({
        prompt: prompt.trim() || "3D multi-view generation",
        model: "era3d",
        sourceImagePath: sourceImagePath || undefined,
      });
    } else {
      const presets = CAMERA_ANGLE_PRESETS.filter((p) => selectedAngles.has(p.label));
      if (presets.length === 0) return;
      enqueue({
        prompt: prompt.trim() || "Camera angle generation",
        model: engine,
        cameraPresets: presets,
        sourceImagePath: sourceImagePath || undefined,
      });
    }
  }

  // Cost estimate
  const costPerUnit = engine === "era3d" ? 0.10 : 0.04;
  const unitCount = engine === "era3d" ? 1 : selectedAngles.size;
  const totalCost = costPerUnit * unitCount;

  const canGenerate =
    hasApiKey === true &&
    (!engineConfig.needsSource || !!sourceImagePath) &&
    (engineConfig.needsSource || prompt.trim()) &&
    (engine === "era3d" || selectedAngles.size > 0);

  const generateLabel =
    engine === "era3d"
      ? "Generate 6 Multi-Views"
      : `Generate ${selectedAngles.size} Camera Angle${selectedAngles.size !== 1 ? "s" : ""}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Camera Angles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Engine selector */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Camera Engine
            <InfoTooltip text="Which AI processes the transformation. See each option's description for details." />
          </Label>
          <div className="grid gap-2">
            {CAMERA_ENGINES.map((e) => (
              <button
                key={e.id}
                onClick={() => setEngine(e.id)}
                className={`text-left rounded-lg border p-3 transition-all duration-200 press-scale ${
                  engine === e.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                    : "border-border hover:border-primary/30 hover:bg-muted/30 glass-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{e.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{e.cost}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  {e.info}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Source image picker (for engines that need it) */}
        {engineConfig.needsSource && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Source Image
              <InfoTooltip text="Pick an already-generated image as the base for camera angle transformation." />
            </Label>

            {sourceImagePreview ? (
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 rounded-md overflow-hidden border bg-muted">
                  <Image src={sourceImagePreview} alt="Source" fill className="object-cover" sizes="64px" />
                  <button
                    onClick={() => { setSourceImagePath(null); setSourceImagePreview(null); }}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[8px] flex items-center justify-center"
                  >
                    x
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Source selected</p>
              </div>
            ) : (
              <>
                {completedImages.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {completedImages.slice(0, 12).map((gen) => (
                      <button
                        key={gen.id}
                        onClick={() => handleSelectSourceFromGen(gen)}
                        className="relative flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border hover:ring-2 hover:ring-primary transition-all bg-muted"
                      >
                        <Image
                          src={`/api/generate/image/generations/${gen.id}/file`}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </button>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" className="text-xs" onClick={handleBrowseDrive}>
                  Browse / Upload Image
                </Button>
              </>
            )}
          </div>
        )}

        {/* Prompt (always shown — text-to-angle uses it primarily, others use it optionally) */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {engineConfig.needsSource ? "Prompt (optional)" : "Prompt"}
          </Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              engineConfig.needsSource
                ? "Optional: describe the subject for better results..."
                : "Describe the subject to generate at multiple camera angles..."
            }
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        {/* Angle presets (for engines that use them) */}
        {engineConfig.needsPresets && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Angle Presets
              <InfoTooltip text="Azimuth = horizontal rotation, elevation = vertical tilt. Each preset = one generated image." />
            </Label>
            <ImageGenCameraPresets
              selected={selectedAngles}
              onSelectionChange={setSelectedAngles}
            />
          </div>
        )}

        {/* Era3D info */}
        {engine === "era3d" && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3">
            Era3D generates 6 fixed canonical views: Front, Right, Back, Left, Front-Right, Back-Left. No angle selection needed.
          </div>
        )}

        {/* Generate button + cost */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex-1"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
              <path d="M8 1v3M8 12v3M1 8h3M12 8h3" /><circle cx="8" cy="8" r="3" />
            </svg>
            {generateLabel}
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            ~${totalCost.toFixed(2)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
