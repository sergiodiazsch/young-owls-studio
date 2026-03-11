"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTooltip } from "@/components/info-tooltip";
import { AVATAR_MODELS, type AvatarModelConfig } from "./video-gen-models";

export interface AvatarPanelProps {
  // Model
  avatarModel: string;
  onAvatarModelChange: (v: string) => void;
  avatarConfig: AvatarModelConfig;
  // Character image
  avatarImagePreview: string | null;
  onClearAvatarImage: () => void;
  onUploadAvatarImage: () => void;
  // Audio
  avatarAudioPath: string | null;
  onUploadAvatarAudio: () => void;
  // Prompt
  avatarPrompt: string;
  onAvatarPromptChange: (v: string) => void;
  // Duration
  avatarDuration: number;
  onAvatarDurationChange: (v: number) => void;
  // Aspect
  avatarAspect: string;
  onAvatarAspectChange: (v: string) => void;
  // CFG
  avatarCfgScale: number;
  onAvatarCfgScaleChange: (v: number) => void;
  // Resolution
  avatarResolution: string;
  onAvatarResolutionChange: (v: string) => void;
  // SadTalker
  poseStyle: number;
  onPoseStyleChange: (v: number) => void;
  expressionScale: number;
  onExpressionScaleChange: (v: number) => void;
  // Multi-avatar speaker 2
  avatarImage2Preview: string | null;
  onClearAvatarImage2: () => void;
  onUploadAvatarImage2: () => void;
  avatarAudio2Path: string | null;
  onUploadAvatarAudio2: () => void;
}

export function AvatarPanel({
  avatarModel,
  onAvatarModelChange,
  avatarConfig,
  avatarImagePreview,
  onClearAvatarImage,
  onUploadAvatarImage,
  avatarAudioPath,
  onUploadAvatarAudio,
  avatarPrompt,
  onAvatarPromptChange,
  avatarDuration,
  onAvatarDurationChange,
  avatarAspect,
  onAvatarAspectChange,
  avatarCfgScale,
  onAvatarCfgScaleChange,
  avatarResolution,
  onAvatarResolutionChange,
  poseStyle,
  onPoseStyleChange,
  expressionScale,
  onExpressionScaleChange,
  avatarImage2Preview,
  onClearAvatarImage2,
  onUploadAvatarImage2,
  avatarAudio2Path,
  onUploadAvatarAudio2,
}: AvatarPanelProps) {
  return (
    <>
      {/* Character Image */}
      <div className="space-y-2">
        <Label>Character Image <span className="text-destructive">*</span></Label>
        {avatarImagePreview ? (
          <div className="relative rounded-lg overflow-hidden border bg-muted aspect-square max-w-[200px]">
            <Image src={avatarImagePreview} alt="Avatar" fill className="object-cover" sizes="200px" />
            <button
              onClick={onClearAvatarImage}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
            >
              x
            </button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={onUploadAvatarImage}
          >
            Upload Character Image
          </Button>
        )}
      </div>

      {/* Audio Track */}
      <div className="space-y-2">
        <Label>Audio Track <span className="text-destructive">*</span></Label>
        <Button
          variant={avatarAudioPath ? "secondary" : "outline"}
          className="w-full"
          onClick={onUploadAvatarAudio}
        >
          {avatarAudioPath ? "Audio uploaded" : "Upload Audio Track"}
        </Button>
      </div>

      {/* Avatar Model */}
      <div className="space-y-2">
        <Label>Avatar Model</Label>
        <Select value={avatarModel} onValueChange={onAvatarModelChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVATAR_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.name}</span>
                  {m.maxSpeakers > 1 && (
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{m.maxSpeakers} speakers</span>
                  )}
                  <span className="text-muted-foreground text-xs ml-auto">{m.cost}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {avatarConfig.info && (
          <p className="text-[10px] text-muted-foreground">{avatarConfig.info}</p>
        )}
        {/* Duration mode indicator */}
        {avatarConfig.durationMode === "audio-match" && (
          <div className="flex items-center gap-1.5 text-[10px] text-primary">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 1" /></svg>
            Video duration matches your audio length
          </div>
        )}
      </div>

      {/* Duration (fixed-duration models like Kling) */}
      {avatarConfig.durations && avatarConfig.durationMode === "fixed" && (
        <div className="space-y-2">
          <Label>Duration</Label>
          <div className="flex gap-1.5">
            {avatarConfig.durations.map((d) => (
              <button
                key={d}
                onClick={() => onAvatarDurationChange(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  avatarDuration === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-border"
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Aspect Ratio (Kling models) */}
      {avatarConfig.aspects && (
        <div className="space-y-2">
          <Label>Aspect Ratio</Label>
          <div className="flex gap-1.5">
            {avatarConfig.aspects.map((a) => (
              <button
                key={a}
                onClick={() => onAvatarAspectChange(a)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  avatarAspect === a
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-border"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resolution picker (for models that support it) */}
      {avatarConfig.supportsResolution && avatarConfig.resolutions && (
        <div className="space-y-2">
          <Label>Resolution</Label>
          <div className="flex gap-1.5">
            {avatarConfig.resolutions.map((r) => (
              <button
                key={r}
                onClick={() => onAvatarResolutionChange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  avatarResolution === r
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-border"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt */}
      {avatarConfig.supportsPrompt && (
        <div className="space-y-2">
          <Label>Prompt (optional)</Label>
          <Textarea
            value={avatarPrompt}
            onChange={(e) => onAvatarPromptChange(e.target.value)}
            placeholder="Describe how the character should move, emote..."
            rows={2}
          />
        </div>
      )}

      {/* CFG Scale */}
      {avatarConfig.supportsCfgScale && (
        <div className="space-y-1">
          <Label className="text-xs">CFG Scale<InfoTooltip text="How strictly the model follows your prompt. Higher = more faithful, lower = more creative." /></Label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={avatarCfgScale}
              onChange={(e) => onAvatarCfgScaleChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">{avatarCfgScale.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* SadTalker Controls */}
      {avatarModel === "sadtalker" && (
        <div className="space-y-3 p-3 rounded-md border bg-muted/30">
          <p className="text-xs font-medium">SadTalker Settings</p>
          <div className="space-y-1">
            <Label className="text-xs">Pose Style (0-45)<InfoTooltip text="Head pose pattern (0-45). Each number = different tilt/movement combination." /></Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={45}
                step={1}
                value={poseStyle}
                onChange={(e) => onPoseStyleChange(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-6">{poseStyle}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Expression Scale<InfoTooltip text="Facial expression intensity. Higher = more animated, lower = more neutral." /></Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={expressionScale}
                onChange={(e) => onExpressionScaleChange(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8">{expressionScale.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Avatar: Speaker 2 */}
      {avatarConfig.maxSpeakers === 2 && (
        <div className="space-y-3 p-3 rounded-md border bg-muted/30">
          <p className="text-xs font-medium">Speaker 2 (optional)</p>
          <div className="space-y-2">
            <Label className="text-xs">Speaker 2 Image</Label>
            {avatarImage2Preview ? (
              <div className="relative w-16 h-16 rounded-md overflow-hidden border bg-muted">
                <Image src={avatarImage2Preview} alt="Speaker 2" fill className="object-cover" sizes="64px" />
                <button
                  onClick={onClearAvatarImage2}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[8px] flex items-center justify-center"
                >
                  x
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={onUploadAvatarImage2}
              >
                Upload Speaker 2 Image
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Speaker 2 Audio</Label>
            <Button
              variant={avatarAudio2Path ? "secondary" : "outline"}
              size="sm"
              className="w-full text-xs"
              onClick={onUploadAvatarAudio2}
            >
              {avatarAudio2Path ? "Audio 2 uploaded" : "Upload Speaker 2 Audio"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
