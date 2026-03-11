"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InfoTooltip } from "@/components/info-tooltip";
import type { ImageGenerationParams } from "@/lib/types";

// Duplicated from fal.ts (server-only) for client use
const IMAGE_MODELS = [
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    cost: "$0.15",
    features: ["1K/2K/4K resolution", "Aspect ratio", "Web search"],
    maxCount: 4,
    supportsResolution: true,
    supportsAspectRatio: true,
    supportsWebSearch: true,
    supportsEnhancePrompt: false,
    supportsReferenceImages: true,
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    cost: "$0.10",
    features: ["1K/2K/4K resolution", "Aspect ratio", "Web search", "Enhanced quality"],
    maxCount: 4,
    supportsResolution: true,
    supportsAspectRatio: true,
    supportsWebSearch: true,
    supportsEnhancePrompt: false,
    supportsReferenceImages: true,
  },
  {
    id: "seedream-4.5",
    name: "Seedream 4.5",
    cost: "$0.04",
    features: ["Auto 2K", "Enhance prompt", "Up to 10 references"],
    maxCount: 6,
    supportsResolution: false,
    supportsAspectRatio: true,
    supportsWebSearch: false,
    supportsEnhancePrompt: true,
    supportsReferenceImages: true,
  },
] as const;

interface Props {
  model: string;
  onModelChange: (model: string) => void;
  params: ImageGenerationParams;
  onParamsChange: (params: ImageGenerationParams) => void;
  count: number;
  onCountChange: (count: number) => void;
  seed: number | undefined;
  onSeedChange: (seed: number | undefined) => void;
}

export function ImageGenModelSelector({
  model,
  onModelChange,
  params,
  onParamsChange,
  count,
  onCountChange,
  seed,
  onSeedChange,
}: Props) {
  const config = IMAGE_MODELS.find((m) => m.id === model) || IMAGE_MODELS[0];

  const updateParam = <K extends keyof ImageGenerationParams>(key: K, value: ImageGenerationParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };

  const effectiveCost = parseFloat(config.cost.replace("$", ""));

  return (
    <div className="space-y-4">
      {/* Model Selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Model<InfoTooltip text="The AI model for generation. Each has different strengths, speeds, and costs." /></Label>
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IMAGE_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="flex items-center gap-2">
                  {m.name}
                  <span className="text-xs text-muted-foreground">{m.cost}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 flex-wrap mt-1">
          {config.features.map((f) => (
            <Badge key={f} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
              {f}
            </Badge>
          ))}
        </div>
      </div>

      {/* Per-model settings */}
      <div className="grid grid-cols-2 gap-4">
        {/* Resolution (nano-banana-pro only) */}
        {config.supportsResolution && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Resolution<InfoTooltip text="Output size. 1K is fastest. 2K is detailed. 4K is highest quality but slower." /></Label>
            <Select
              value={params.resolution || "1K"}
              onValueChange={(v) => updateParam("resolution", v)}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1K">1K (1024px)</SelectItem>
                <SelectItem value="2K">2K (2048px)</SelectItem>
                <SelectItem value="4K">4K (4096px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Aspect Ratio */}
        {config.supportsAspectRatio && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Aspect Ratio<InfoTooltip text="Width-to-height ratio. 1:1 for portraits. 16:9 for cinema. 9:16 for mobile." /></Label>
            <Select
              value={params.aspectRatio || "square"}
              onValueChange={(v) => updateParam("aspectRatio", v)}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Square (1:1)</SelectItem>
                <SelectItem value="landscape_4_3">4:3 Landscape</SelectItem>
                <SelectItem value="landscape_16_9">16:9 Wide</SelectItem>
                <SelectItem value="portrait_3_4">3:4 Portrait</SelectItem>
                <SelectItem value="portrait_9_16">9:16 Tall</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Count */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Count<InfoTooltip text="Images to generate in parallel. Each costs one credit." /></Label>
            <Select value={String(count)} onValueChange={(v) => onCountChange(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: config.maxCount }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} image{n > 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        {/* Web Search (nano-banana-pro only) */}
        {config.supportsWebSearch && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Web Search<InfoTooltip text="Lets the model reference real-world visuals from the web for better accuracy." /></Label>
            <div className="flex items-center gap-2 h-9">
              <Switch
                checked={params.enableWebSearch || false}
                onCheckedChange={(v) => updateParam("enableWebSearch", v)}
              />
              <span className="text-xs text-muted-foreground">
                {params.enableWebSearch ? "On" : "Off"}
              </span>
            </div>
          </div>
        )}

        {/* Enhance Prompt (seedream-4.5 only) */}
        {config.supportsEnhancePrompt && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Enhance Prompt<InfoTooltip text="Automatically rewrites your prompt to be more detailed before sending to the model." /></Label>
            <div className="flex items-center gap-2 h-9">
              <Switch
                checked={params.enhancePrompt || false}
                onCheckedChange={(v) => updateParam("enhancePrompt", v)}
              />
              <span className="text-xs text-muted-foreground">
                {params.enhancePrompt ? "On" : "Off"}
              </span>
            </div>
          </div>
        )}

        {/* Seed */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Seed<InfoTooltip text="Controls randomness. Same seed + same prompt = same image. Leave empty for random." /></Label>
          <div className="relative">
            <Input
              type="number"
              placeholder="Random"
              value={seed ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                onSeedChange(val === "" ? undefined : Number(val));
              }}
              className="h-9 pr-7 [&::-webkit-inner-spin-button]:appearance-none"
            />
            {seed !== undefined && (
              <button
                onClick={() => onSeedChange(undefined)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                title="Reset to random"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Estimated cost */}
      <Separator />
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <span>Est. cost</span>
        <span className="font-medium">
          ~${(effectiveCost * count).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export { IMAGE_MODELS };
