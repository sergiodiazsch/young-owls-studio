"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
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
import {
  VIDEO_MODELS,
  type VideoModelConfig,
  type MultiPromptSegment,
  type ElementImage,
} from "./video-gen-models";

export interface ImageToVideoPanelProps {
  // Prompt
  prompt: string;
  onPromptChange: (v: string) => void;
  // Model
  model: string;
  onModelChange: (v: string) => void;
  modelConfig: VideoModelConfig;
  // Duration
  duration: number;
  onDurationChange: (v: number) => void;
  // Aspect ratio
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
  // Audio
  enableAudio: boolean;
  onEnableAudioChange: (v: boolean) => void;
  // CFG
  cfgScale: number;
  onCfgScaleChange: (v: number) => void;
  // Negative prompt
  negativePrompt: string;
  onNegativePromptChange: (v: string) => void;
  // Shot type
  shotType: string;
  onShotTypeChange: (v: string) => void;
  // Source image
  sourceImagePreview: string | null;
  onClearSourceImage: () => void;
  onUploadSourceImage: () => void;
  // End image
  endImagePreview: string | null;
  onClearEndImage: () => void;
  onUploadEndImage: () => void;
  // Elements
  elements: ElementImage[];
  onSetElements: (v: ElementImage[]) => void;
  onUploadElement: () => void;
  // Multi-prompt
  useMultiPrompt: boolean;
  onUseMultiPromptChange: (v: boolean) => void;
  multiPromptSegments: MultiPromptSegment[];
  onMultiPromptSegmentsChange: (v: MultiPromptSegment[]) => void;
  // Advanced toggle
  showAdvanced: boolean;
  onShowAdvancedChange: (v: boolean) => void;
}

export function ImageToVideoPanel({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  modelConfig,
  duration,
  onDurationChange,
  aspectRatio,
  onAspectRatioChange,
  enableAudio,
  onEnableAudioChange,
  cfgScale,
  onCfgScaleChange,
  negativePrompt,
  onNegativePromptChange,
  shotType,
  onShotTypeChange,
  sourceImagePreview,
  onClearSourceImage,
  onUploadSourceImage,
  endImagePreview,
  onClearEndImage,
  onUploadEndImage,
  elements,
  onSetElements,
  onUploadElement,
  useMultiPrompt,
  onUseMultiPromptChange,
  multiPromptSegments,
  onMultiPromptSegmentsChange,
  showAdvanced,
  onShowAdvancedChange,
}: ImageToVideoPanelProps) {
  return (
    <>
      {/* Source Image */}
      <div className="space-y-2">
        <Label>Source Image <span className="text-destructive">*</span></Label>
        {sourceImagePreview ? (
          <div className="relative rounded-lg overflow-hidden border bg-muted aspect-video">
            <Image src={sourceImagePreview} alt="Source" fill className="object-contain" sizes="(max-width: 640px) 100vw, 400px" />
            <button
              onClick={onClearSourceImage}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
            >
              x
            </button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={onUploadSourceImage}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
              <path d="M8 10V2M8 2L5 5M8 2L11 5" />
              <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
            </svg>
            Upload Source Image
          </Button>
        )}
      </div>

      {/* Prompt */}
      {!useMultiPrompt && (
        <div className="space-y-2">
          <Label>Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe the video you want to generate..."
            rows={3}
          />
          {modelConfig.supportsElements && elements.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Reference elements in your prompt as {elements.map((_, i) => `@Element${i + 1}`).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Multi-Prompt toggle + segments */}
      {modelConfig.supportsMultiPrompt && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useMultiPrompt}
              onChange={(e) => onUseMultiPromptChange(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">Multi-Prompt (sequential shots)<InfoTooltip text="Define different prompts for different time segments of the video." /></span>
          </label>
          {useMultiPrompt && (
            <div className="space-y-2 pl-1">
              {multiPromptSegments.map((seg, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Textarea
                      value={seg.prompt}
                      onChange={(e) => {
                        const updated = [...multiPromptSegments];
                        updated[i] = { ...seg, prompt: e.target.value };
                        onMultiPromptSegmentsChange(updated);
                      }}
                      placeholder={`Shot ${i + 1} prompt...`}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="w-16 space-y-1">
                    <Input
                      type="number"
                      value={seg.duration}
                      onChange={(e) => {
                        const updated = [...multiPromptSegments];
                        updated[i] = { ...seg, duration: Number(e.target.value) };
                        onMultiPromptSegmentsChange(updated);
                      }}
                      min={1}
                      max={15}
                      className="text-sm"
                    />
                    <p className="text-[9px] text-muted-foreground text-center">sec</p>
                  </div>
                  {multiPromptSegments.length > 1 && (
                    <button
                      onClick={() => onMultiPromptSegmentsChange(multiPromptSegments.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive p-1 mt-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onMultiPromptSegmentsChange([...multiPromptSegments, { prompt: "", duration: 3 }])}
                  className="text-xs"
                >
                  + Add Shot
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Total: {multiPromptSegments.reduce((sum, s) => sum + s.duration, 0)}s / {duration}s
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Model selector */}
      <div className="space-y-2">
        <Label>Video Model<InfoTooltip text="The AI engine that animates your image. Each has different quality, speed, features, and cost." /></Label>
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIDEO_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground ml-2">{m.cost}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {modelConfig.info && (
          <p className="text-[10px] text-muted-foreground">{modelConfig.info}</p>
        )}
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <Label>Duration<InfoTooltip text="Output video length. Longer = more expensive. Some models only support fixed durations." /></Label>
        {modelConfig.durations.length <= 5 ? (
          <div className="flex gap-1.5 flex-wrap">
            {modelConfig.durations.map((d) => (
              <button
                key={d}
                onClick={() => onDurationChange(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  duration === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-border"
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <input
              type="range"
              min={modelConfig.durations[0]}
              max={modelConfig.durations[modelConfig.durations.length - 1]}
              step={1}
              value={duration}
              onChange={(e) => {
                const val = Number(e.target.value);
                const closest = modelConfig.durations.reduce((prev, curr) =>
                  Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
                );
                onDurationChange(closest);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{modelConfig.durations[0]}s</span>
              <span className="font-medium text-foreground">{duration}s</span>
              <span>{modelConfig.durations[modelConfig.durations.length - 1]}s</span>
            </div>
          </div>
        )}
      </div>

      {/* Aspect ratio */}
      <div className="space-y-2">
        <Label>Aspect Ratio<InfoTooltip text="Frame ratio. 16:9 widescreen, 9:16 vertical/mobile, 1:1 square." /></Label>
        <div className="flex gap-1.5 flex-wrap">
          {modelConfig.aspects.map((a) => (
            <button
              key={a}
              onClick={() => onAspectRatioChange(a)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                aspectRatio === a
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent border-border"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Elements panel */}
      {modelConfig.supportsElements && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Elements (Character Refs)<InfoTooltip text="Reference images for character/object consistency across frames." /></Label>
            <span className="text-[10px] text-muted-foreground">{elements.length}/{modelConfig.maxElements}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {elements.map((el, i) => (
              <div key={i} className="relative w-14 h-14 rounded-md overflow-hidden border bg-muted group">
                <Image src={el.previewUrl} alt={`Element ${i + 1}`} fill className="object-cover" sizes="56px" />
                <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[8px] text-center py-0.5">
                  @Element{i + 1}
                </div>
                <button
                  onClick={() => onSetElements(elements.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            ))}
            {elements.length < modelConfig.maxElements && (
              <button
                onClick={onUploadElement}
                className="w-14 h-14 rounded-md border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v10M3 8h10" />
                </svg>
              </button>
            )}
          </div>
          {elements.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Use @Element1{elements.length > 1 ? `, @Element2${elements.length > 2 ? "..." : ""}` : ""} in your prompt to reference these
            </p>
          )}
        </div>
      )}

      {/* Audio toggle */}
      {modelConfig.supportsAudio && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enableAudio}
            onChange={(e) => onEnableAudioChange(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Generate with audio<InfoTooltip text="Generate synchronized audio with the video. Increases cost." /></span>
        </label>
      )}

      {/* Advanced Settings */}
      <div>
        <button
          onClick={() => onShowAdvancedChange(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
          Advanced Settings
        </button>
        {showAdvanced && (
          <div className="mt-2 space-y-3 pl-1 border-l-2 border-border/50 ml-1">
            {/* cfg_scale */}
            {modelConfig.supportsCfgScale && (
              <div className="space-y-1 pl-3">
                <Label className="text-xs">CFG Scale<InfoTooltip text="How strictly the model follows your prompt. Higher = more faithful, lower = more creative." /></Label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={cfgScale}
                    onChange={(e) => onCfgScaleChange(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8">{cfgScale.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Negative prompt */}
            {modelConfig.supportsNeg && (
              <div className="space-y-1 pl-3">
                <Label className="text-xs">Negative Prompt<InfoTooltip text="Describe what to avoid: blurriness, distortion, unwanted objects." /></Label>
                <Input
                  value={negativePrompt}
                  onChange={(e) => onNegativePromptChange(e.target.value)}
                  placeholder="What to avoid..."
                  className="text-sm"
                />
              </div>
            )}

            {/* End image */}
            {modelConfig.supportsEndImage && (
              <div className="space-y-1 pl-3">
                <Label className="text-xs">End Frame Image<InfoTooltip text="The target final frame — the video animates from source toward this end state." /></Label>
                {endImagePreview ? (
                  <div className="relative w-20 h-14 rounded-md overflow-hidden border bg-muted">
                    <Image src={endImagePreview} alt="End frame" fill className="object-cover" sizes="80px" />
                    <button
                      onClick={onClearEndImage}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[8px] flex items-center justify-center"
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onUploadEndImage}
                    className="text-xs"
                  >
                    Upload End Image
                  </Button>
                )}
              </div>
            )}

            {/* Shot type */}
            {modelConfig.supportsShotType && modelConfig.shotTypes.length > 0 && (
              <div className="space-y-1 pl-3">
                <Label className="text-xs">Shot Type<InfoTooltip text="Camera framing: close-up, medium, wide, etc. Only available on Kling models." /></Label>
                <Select value={shotType} onValueChange={onShotTypeChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Auto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Auto</SelectItem>
                    {modelConfig.shotTypes.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
