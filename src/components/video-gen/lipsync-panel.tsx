"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTooltip } from "@/components/info-tooltip";
import { LIPSYNC_MODELS, type LipsyncModelConfig } from "./video-gen-models";

export interface LipsyncPanelProps {
  // Model
  lipsyncModel: string;
  onLipsyncModelChange: (v: string) => void;
  lipsyncConfig: LipsyncModelConfig;
  // Source video
  sourceVideoPath: string | null;
  onUploadSourceVideo: () => void;
  // Source audio
  sourceAudioPath: string | null;
  onUploadSourceAudio: () => void;
  // TTS
  ttsText: string;
  onTtsTextChange: (v: string) => void;
  // Sync mode
  syncMode: string;
  onSyncModeChange: (v: string) => void;
  // Guidance
  guidanceScale: number;
  onGuidanceScaleChange: (v: number) => void;
  // Prompt
  lipsyncPrompt: string;
  onLipsyncPromptChange: (v: string) => void;
}

export function LipsyncPanel({
  lipsyncModel,
  onLipsyncModelChange,
  lipsyncConfig,
  sourceVideoPath,
  onUploadSourceVideo,
  sourceAudioPath,
  onUploadSourceAudio,
  ttsText,
  onTtsTextChange,
  syncMode,
  onSyncModeChange,
  guidanceScale,
  onGuidanceScaleChange,
  lipsyncPrompt,
  onLipsyncPromptChange,
}: LipsyncPanelProps) {
  return (
    <>
      {/* Lipsync model selector */}
      <div className="space-y-2">
        <Label>Lipsync Model</Label>
        <Select value={lipsyncModel} onValueChange={onLipsyncModelChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIPSYNC_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground ml-2">{m.cost}</span>
                {m.multiSpeaker && <Badge variant="outline" className="ml-1.5 text-[8px] px-1 py-0">Multi</Badge>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {lipsyncConfig.info && (
          <p className="text-[10px] text-muted-foreground">{lipsyncConfig.info}</p>
        )}
        <p className="text-[10px] text-muted-foreground">{lipsyncConfig.limits}</p>
      </div>

      {/* Source Video */}
      <div className="space-y-2">
        <Label>Source Video <span className="text-destructive">*</span></Label>
        <Button
          variant={sourceVideoPath ? "secondary" : "outline"}
          className="w-full"
          onClick={onUploadSourceVideo}
        >
          {sourceVideoPath ? "Video uploaded" : "Upload Source Video"}
        </Button>
      </div>

      {/* Audio source OR TTS text */}
      {lipsyncConfig.supportsTTS ? (
        <div className="space-y-2">
          <Label>Text for TTS <span className="text-destructive">*</span></Label>
          <Textarea
            value={ttsText}
            onChange={(e) => onTtsTextChange(e.target.value)}
            placeholder="Enter text to be spoken (max 500 chars)..."
            rows={3}
            maxLength={500}
          />
          <p className="text-[10px] text-muted-foreground text-right">{ttsText.length}/500</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Audio Track <span className="text-destructive">*</span></Label>
          <Button
            variant={sourceAudioPath ? "secondary" : "outline"}
            className="w-full"
            onClick={onUploadSourceAudio}
          >
            {sourceAudioPath ? "Audio uploaded" : "Upload Audio Track"}
          </Button>
        </div>
      )}

      {/* Model-specific settings */}
      {lipsyncConfig.syncModes && (
        <div className="space-y-2">
          <Label>Sync Mode<InfoTooltip text="How audio/video lengths align. cut_off trims, loop repeats, bounce reverses, remap stretches." /></Label>
          <Select value={syncMode} onValueChange={onSyncModeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lipsyncConfig.syncModes.map((sm) => (
                <SelectItem key={sm} value={sm}>
                  {sm.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {lipsyncConfig.supportsGuidance && (
        <div className="space-y-1">
          <Label>Guidance Scale<InfoTooltip text="Lip-sync strength. Higher = more pronounced lip movement." /></Label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={2}
              step={0.1}
              value={guidanceScale}
              onChange={(e) => onGuidanceScaleChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">{guidanceScale.toFixed(1)}</span>
          </div>
        </div>
      )}

      {lipsyncConfig.supportsPrompt && (
        <div className="space-y-2">
          <Label>Style Prompt</Label>
          <Input
            value={lipsyncPrompt}
            onChange={(e) => onLipsyncPromptChange(e.target.value)}
            placeholder="Style guidance for the lipsync..."
          />
        </div>
      )}
    </>
  );
}
