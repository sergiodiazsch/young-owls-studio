/**
 * AI Production Cost Database
 *
 * Real pricing from fal.ai, ElevenLabs, and Anthropic APIs.
 * Used by the Budget Calculator to estimate per-scene and per-project costs.
 */

// ── Image Generation ──

export interface ImagePricing {
  id: string;
  name: string;
  costPerImage: number; // USD
  tier: "budget" | "mid" | "premium";
  bestFor: string[];
}

export const IMAGE_PRICING: ImagePricing[] = [
  { id: "seedream-4.5", name: "Seedream 4.5", costPerImage: 0.04, tier: "budget", bestFor: ["environments", "general", "fast iteration"] },
  { id: "flux-multi-angle", name: "Flux Multi-Angle", costPerImage: 0.04, tier: "budget", bestFor: ["character angles", "3D rotation", "consistency"] },
  { id: "nano-banana-2", name: "Nano Banana 2", costPerImage: 0.10, tier: "mid", bestFor: ["high detail", "character portraits", "cinematic"] },
  { id: "nano-banana-pro", name: "Nano Banana Pro", costPerImage: 0.15, tier: "premium", bestFor: ["hero shots", "key frames", "highest quality"] },
];

// ── Video Generation (image-to-video) ──

export interface VideoPricing {
  id: string;
  name: string;
  costPerSecond: number; // USD
  costPerSecondAudio: number; // with audio generation
  typicalDuration: number; // seconds per clip
  tier: "budget" | "mid" | "premium";
  bestFor: string[];
}

export const VIDEO_PRICING: VideoPricing[] = [
  { id: "kling-3.0-standard", name: "Kling 3.0", costPerSecond: 0.07, costPerSecondAudio: 0.14, typicalDuration: 5, tier: "budget", bestFor: ["dialogue shots", "static scenes", "standard quality"] },
  { id: "kling-3.0-pro", name: "Kling 3.0 Pro", costPerSecond: 0.14, costPerSecondAudio: 0.22, typicalDuration: 5, tier: "mid", bestFor: ["action scenes", "complex motion", "1080p"] },
  { id: "kling-o3", name: "Kling O3 (Thinking)", costPerSecond: 0.17, costPerSecondAudio: 0.22, typicalDuration: 5, tier: "premium", bestFor: ["hero shots", "complex choreography", "best quality"] },
  { id: "hailuo-02-standard", name: "Hailuo 02", costPerSecond: 0.05, costPerSecondAudio: 0.05, typicalDuration: 6, tier: "budget", bestFor: ["atmospheric", "environments", "breathing room"] },
  { id: "hailuo-2.3", name: "Hailuo 2.3", costPerSecond: 0.047, costPerSecondAudio: 0.047, typicalDuration: 6, tier: "mid", bestFor: ["cinematic realism", "smooth motion"] },
  { id: "pixverse-5.5", name: "PixVerse v5.5", costPerSecond: 0.04, costPerSecondAudio: 0.04, typicalDuration: 5, tier: "budget", bestFor: ["style presets", "quick generation"] },
  { id: "wan-2.6", name: "Wan 2.6", costPerSecond: 0.10, costPerSecondAudio: 0.10, typicalDuration: 5, tier: "mid", bestFor: ["open model", "multi-shot"] },
];

// ── Voice / TTS ──

export interface VoicePricing {
  id: string;
  name: string;
  costPer1kChars: number; // USD per 1000 characters
  avgCharsPerLine: number; // average chars in a dialogue line
  tier: "budget" | "mid" | "premium";
  bestFor: string[];
}

export const VOICE_PRICING: VoicePricing[] = [
  { id: "elevenlabs-v2", name: "ElevenLabs v2", costPer1kChars: 0.30, avgCharsPerLine: 80, tier: "premium", bestFor: ["emotional range", "character voices", "best quality"] },
  { id: "elevenlabs-turbo", name: "ElevenLabs Turbo", costPer1kChars: 0.15, avgCharsPerLine: 80, tier: "mid", bestFor: ["fast iteration", "bulk dialogue"] },
];

// ── Lipsync ──

export interface LipsyncPricing {
  id: string;
  name: string;
  costPerRun: number; // USD per lipsync operation
  tier: "budget" | "mid" | "premium";
  bestFor: string[];
}

export const LIPSYNC_PRICING: LipsyncPricing[] = [
  { id: "musetalk", name: "MuseTalk", costPerRun: 0.04, tier: "budget", bestFor: ["cost-effective", "real-time", "prototyping"] },
  { id: "latentsync", name: "LatentSync", costPerRun: 0.10, tier: "budget", bestFor: ["anime", "stylized", "guidance control"] },
  { id: "sync-lipsync-v2", name: "Sync Lipsync 2.0", costPerRun: 0.20, tier: "mid", bestFor: ["general use", "sync modes"] },
  { id: "pixverse-lipsync", name: "PixVerse Lipsync", costPerRun: 0.25, tier: "mid", bestFor: ["built-in TTS", "simple workflow"] },
  { id: "kling-lipsync", name: "Kling Lipsync", costPerRun: 0.55, tier: "premium", bestFor: ["close-ups", "best quality", "hero dialogue"] },
];

// ── Audio / SFX ──

export interface AudioPricing {
  id: string;
  name: string;
  costPerGeneration: number; // USD
  tier: "budget" | "mid" | "premium";
  bestFor: string[];
}

export const AUDIO_PRICING: AudioPricing[] = [
  { id: "elevenlabs-sfx", name: "ElevenLabs SFX", costPerGeneration: 0.05, tier: "budget", bestFor: ["sound effects", "foley", "ambience"] },
];

// ── Upscale ──

export interface UpscalePricing {
  id: string;
  name: string;
  costPerSecond: number; // USD
  tier: "budget" | "mid" | "premium";
}

export const UPSCALE_PRICING: UpscalePricing[] = [
  { id: "topaz-upscale", name: "Topaz Upscale", costPerSecond: 0.10, tier: "budget" },
  { id: "topaz-4x-gen", name: "Topaz 4x Generative", costPerSecond: 0.15, tier: "premium" },
];

// ── AI Analysis (Anthropic) ──

export const ANTHROPIC_PRICING = {
  inputPer1kTokens: 0.003, // Claude Sonnet input
  outputPer1kTokens: 0.015, // Claude Sonnet output
  avgBreakdownInputTokens: 2000,
  avgBreakdownOutputTokens: 4000,
  avgAnalysisInputTokens: 8000,
  avgAnalysisOutputTokens: 6000,
};

// ── Budget Profiles ──

export type BudgetTier = "economy" | "standard" | "premium";

export interface BudgetProfile {
  tier: BudgetTier;
  label: string;
  description: string;
  imageModel: string;
  videoModel: string;
  voiceModel: string;
  lipsyncModel: string;
  audioModel: string;
  retryMultiplier: number; // how many attempts on average (1.5 = 50% redo rate)
}

export const BUDGET_PROFILES: BudgetProfile[] = [
  {
    tier: "economy",
    label: "Draft Cut",
    description: "Fast and affordable — ideal for early drafts and test renders",
    imageModel: "seedream-4.5",
    videoModel: "pixverse-5.5",
    voiceModel: "elevenlabs-turbo",
    lipsyncModel: "musetalk",
    audioModel: "elevenlabs-sfx",
    retryMultiplier: 2.5,
  },
  {
    tier: "standard",
    label: "Director's Cut",
    description: "Balanced quality and cost — the sweet spot for most projects",
    imageModel: "nano-banana-2",
    videoModel: "kling-3.0-standard",
    voiceModel: "elevenlabs-turbo",
    lipsyncModel: "sync-lipsync-v2",
    audioModel: "elevenlabs-sfx",
    retryMultiplier: 1.8,
  },
  {
    tier: "premium",
    label: "Festival Print",
    description: "Top-tier models with the highest fidelity and consistency",
    imageModel: "nano-banana-pro",
    videoModel: "kling-3.0-pro",
    voiceModel: "elevenlabs-v2",
    lipsyncModel: "kling-lipsync",
    audioModel: "elevenlabs-sfx",
    retryMultiplier: 1.3,
  },
];

// ── Cost Calculator ──

export interface SceneCostBreakdown {
  sceneId: number;
  sceneNumber: number;
  heading: string;
  imageCount: number;
  shotCount: number;
  dialogueLineCount: number;
  audioElementCount: number;
  needsLipsync: boolean;
  estimatedDurationSeconds: number;
  costs: {
    images: number;
    video: number;
    voice: number;
    lipsync: number;
    audio: number;
    analysis: number;
  };
  totalBeforeRetries: number;
  totalWithRetries: number;
}

export interface ProjectCostEstimate {
  scenes: SceneCostBreakdown[];
  totals: {
    images: number;
    video: number;
    voice: number;
    lipsync: number;
    audio: number;
    analysis: number;
    upscale: number;
    subtotal: number;
    retryBuffer: number;
    grandTotal: number;
  };
  counts: {
    totalScenes: number;
    totalImages: number;
    totalShots: number;
    totalDialogueLines: number;
    totalAudioElements: number;
    totalVideoSeconds: number;
  };
  profile: BudgetProfile;
  retryMultiplier: number;
  includeUpscale: boolean;
  upscaleDuration: number;
}

export function calculateSceneCost(
  sceneData: {
    sceneId: number;
    sceneNumber: number;
    heading: string;
    imageCount: number;
    shotCount: number;
    dialogueLineCount: number;
    audioElementCount: number;
    estimatedDurationSeconds: number;
  },
  profile: BudgetProfile,
  retryMultiplier?: number,
): SceneCostBreakdown {
  const imgModel = IMAGE_PRICING.find((m) => m.id === profile.imageModel) || IMAGE_PRICING[0];
  const vidModel = VIDEO_PRICING.find((m) => m.id === profile.videoModel) || VIDEO_PRICING[0];
  const voiceModel = VOICE_PRICING.find((m) => m.id === profile.voiceModel) || VOICE_PRICING[0];
  const lipsyncModel = LIPSYNC_PRICING.find((m) => m.id === profile.lipsyncModel) || LIPSYNC_PRICING[0];
  const audioModel = AUDIO_PRICING.find((m) => m.id === profile.audioModel) || AUDIO_PRICING[0];

  const rm = retryMultiplier ?? profile.retryMultiplier;

  // Images: each image needs generation
  const imageCost = sceneData.imageCount * imgModel.costPerImage;

  // Video: each shot becomes a video clip of ~typicalDuration seconds
  const videoCost = sceneData.shotCount * vidModel.typicalDuration * vidModel.costPerSecond;

  // Voice: each dialogue line
  const voiceCost = sceneData.dialogueLineCount * (voiceModel.avgCharsPerLine / 1000) * voiceModel.costPer1kChars;

  // Lipsync: needed for dialogue shots with visible characters
  const needsLipsync = sceneData.dialogueLineCount > 0;
  const lipsyncCount = needsLipsync ? Math.ceil(sceneData.dialogueLineCount * 0.7) : 0; // ~70% of lines need visible lipsync
  const lipsyncCost = lipsyncCount * lipsyncModel.costPerRun;

  // Audio: SFX/ambience elements
  const audioCost = sceneData.audioElementCount * audioModel.costPerGeneration;

  // Analysis cost (breakdown generation via Claude)
  const analysisCost = (ANTHROPIC_PRICING.avgBreakdownInputTokens / 1000) * ANTHROPIC_PRICING.inputPer1kTokens +
    (ANTHROPIC_PRICING.avgBreakdownOutputTokens / 1000) * ANTHROPIC_PRICING.outputPer1kTokens;

  const totalBeforeRetries = imageCost + videoCost + voiceCost + lipsyncCost + audioCost + analysisCost;

  return {
    sceneId: sceneData.sceneId,
    sceneNumber: sceneData.sceneNumber,
    heading: sceneData.heading,
    imageCount: sceneData.imageCount,
    shotCount: sceneData.shotCount,
    dialogueLineCount: sceneData.dialogueLineCount,
    audioElementCount: sceneData.audioElementCount,
    needsLipsync,
    estimatedDurationSeconds: sceneData.estimatedDurationSeconds,
    costs: {
      images: imageCost * rm,
      video: videoCost * rm,
      voice: voiceCost * rm,
      lipsync: lipsyncCost * rm,
      audio: audioCost * rm,
      analysis: analysisCost, // analysis doesn't get retried
    },
    totalBeforeRetries,
    totalWithRetries: imageCost * rm + videoCost * rm + voiceCost * rm + lipsyncCost * rm + audioCost * rm + analysisCost,
  };
}

export function calculateProjectCost(
  scenesData: Array<{
    sceneId: number;
    sceneNumber: number;
    heading: string;
    imageCount: number;
    shotCount: number;
    dialogueLineCount: number;
    audioElementCount: number;
    estimatedDurationSeconds: number;
  }>,
  profile: BudgetProfile,
  retryMultiplier?: number,
  includeUpscale = false,
): ProjectCostEstimate {
  const rm = retryMultiplier ?? profile.retryMultiplier;
  const scenes = scenesData.map((s) => calculateSceneCost(s, profile, rm));

  const totals = {
    images: 0,
    video: 0,
    voice: 0,
    lipsync: 0,
    audio: 0,
    analysis: 0,
    upscale: 0,
    subtotal: 0,
    retryBuffer: 0,
    grandTotal: 0,
  };

  const counts = {
    totalScenes: scenes.length,
    totalImages: 0,
    totalShots: 0,
    totalDialogueLines: 0,
    totalAudioElements: 0,
    totalVideoSeconds: 0,
  };

  for (const s of scenes) {
    totals.images += s.costs.images;
    totals.video += s.costs.video;
    totals.voice += s.costs.voice;
    totals.lipsync += s.costs.lipsync;
    totals.audio += s.costs.audio;
    totals.analysis += s.costs.analysis;

    counts.totalImages += s.imageCount;
    counts.totalShots += s.shotCount;
    counts.totalDialogueLines += s.dialogueLineCount;
    counts.totalAudioElements += s.audioElementCount;
    counts.totalVideoSeconds += s.estimatedDurationSeconds;
  }

  // Upscale: total video duration
  let upscaleDuration = 0;
  if (includeUpscale) {
    upscaleDuration = counts.totalVideoSeconds;
    const upscaleModel = UPSCALE_PRICING[0];
    totals.upscale = upscaleDuration * upscaleModel.costPerSecond;
  }

  totals.subtotal = totals.images + totals.video + totals.voice + totals.lipsync + totals.audio + totals.analysis;
  totals.retryBuffer = totals.subtotal - scenes.reduce((acc, s) => acc + s.totalBeforeRetries, 0);
  totals.grandTotal = totals.subtotal + totals.upscale;

  return {
    scenes,
    totals,
    counts,
    profile,
    retryMultiplier: rm,
    includeUpscale,
    upscaleDuration,
  };
}
