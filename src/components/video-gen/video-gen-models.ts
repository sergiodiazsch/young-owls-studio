// ── Client-side model configs (keep in sync with fal.ts) ──

export const KLING_SHOTS = [
  "close-up",
  "medium-shot",
  "long-shot",
  "full-shot",
  "extreme-close-up",
  "POV",
  "over-the-shoulder",
  "low-angle",
  "high-angle",
  "dutch-angle",
  "bird-eye",
  "worm-eye",
];

export const VIDEO_MODELS = [
  // ── Kling ──
  { id: "kling-3.0-pro", name: "Kling 3.0 Pro", cost: "$0.14-0.22/s", durations: [3,4,5,6,7,8,9,10,11,12,13,14,15], aspects: ["16:9","9:16","1:1"], supportsNeg: true, supportsAudio: true, supportsElements: true, maxElements: 10, supportsMultiPrompt: true, supportsCfgScale: true, supportsEndImage: true, supportsShotType: true, shotTypes: KLING_SHOTS, info: "Best quality. 10 elements, voice x2, multi-shot." },
  { id: "kling-3.0-standard", name: "Kling 3.0", cost: "$0.07-0.14/s", durations: [3,4,5,6,7,8,9,10,11,12,13,14,15], aspects: ["16:9","9:16","1:1"], supportsNeg: true, supportsAudio: true, supportsElements: true, maxElements: 10, supportsMultiPrompt: true, supportsCfgScale: true, supportsEndImage: true, supportsShotType: true, shotTypes: KLING_SHOTS, info: "Great balance of quality and cost. Full Kling 3.0 features." },
  { id: "kling-o3", name: "Kling O3 (Thinking)", cost: "$0.17-0.22/s", durations: [3,4,5,6,7,8,9,10,11,12,13,14,15], aspects: ["16:9","9:16","1:1"], supportsNeg: true, supportsAudio: true, supportsElements: true, maxElements: 10, supportsMultiPrompt: true, supportsCfgScale: true, supportsEndImage: true, supportsShotType: true, shotTypes: KLING_SHOTS, info: "\"Thinking\" mode for maximum quality. Slower but best results." },
  { id: "kling-2.6-pro", name: "Kling 2.6 Pro", cost: "$0.07-0.17/s", durations: [5, 10], aspects: ["16:9","9:16","1:1"], supportsNeg: true, supportsAudio: true, supportsElements: true, maxElements: 4, supportsMultiPrompt: false, supportsCfgScale: true, supportsEndImage: true, supportsShotType: false, shotTypes: [] as string[], info: "Proven model. 4 elements, voice x2, end image." },
  // ── Hailuo / MiniMax ──
  { id: "hailuo-2.3", name: "Hailuo 2.3", cost: "$0.28-0.56", durations: [6, 10], aspects: ["16:9","9:16","1:1"], supportsNeg: false, supportsAudio: false, supportsElements: false, maxElements: 0, supportsMultiPrompt: false, supportsCfgScale: false, supportsEndImage: false, supportsShotType: false, shotTypes: [] as string[], info: "Cinematic realism. 768p. Prompt optimizer included." },
  { id: "hailuo-02-pro", name: "Hailuo 02 Pro", cost: "$0.08/s", durations: [6], aspects: ["16:9","9:16","1:1"], supportsNeg: false, supportsAudio: false, supportsElements: false, maxElements: 0, supportsMultiPrompt: false, supportsCfgScale: false, supportsEndImage: true, supportsShotType: false, shotTypes: [] as string[], info: "1080p output. End image support." },
  { id: "hailuo-02-standard", name: "Hailuo 02", cost: "~$0.30", durations: [6], aspects: ["16:9","9:16","1:1"], supportsNeg: false, supportsAudio: false, supportsElements: false, maxElements: 0, supportsMultiPrompt: false, supportsCfgScale: false, supportsEndImage: false, supportsShotType: false, shotTypes: [] as string[], info: "768p. Budget-friendly." },
  // ── PixVerse ──
  { id: "pixverse-5.5", name: "PixVerse v5.5", cost: "$0.20/5s", durations: [5, 8, 10], aspects: ["16:9","4:3","1:1","3:4","9:16"], supportsNeg: true, supportsAudio: true, supportsElements: false, maxElements: 0, supportsMultiPrompt: false, supportsCfgScale: false, supportsEndImage: false, supportsShotType: false, shotTypes: [] as string[], info: "Style presets (anime, 3D, cyberpunk). Audio gen. Up to 1080p." },
  // ── Wan ──
  { id: "wan-2.6", name: "Wan 2.6", cost: "$0.10-0.15/s", durations: [5, 10, 15], aspects: ["16:9","9:16","1:1"], supportsNeg: true, supportsAudio: false, supportsElements: false, maxElements: 0, supportsMultiPrompt: false, supportsCfgScale: false, supportsEndImage: false, supportsShotType: false, shotTypes: [] as string[], info: "Open model. 720p/1080p. Multi-shot. Cheapest option." },
];

export const LIPSYNC_MODELS = [
  { id: "kling-lipsync", name: "Kling Lipsync", cost: "$0.55", supportsTTS: false, supportsPrompt: false, syncModes: null, supportsGuidance: false, limits: "Video 2-10s, Audio up to 60s", inputType: "video" as const, multiSpeaker: false, info: "Best quality lip-sync from Kling." },
  { id: "sync-lipsync-v2", name: "Sync Lipsync 2.0", cost: "$3/min", supportsTTS: false, supportsPrompt: false, syncModes: ["cut_off", "loop", "bounce", "silence", "remap"], supportsGuidance: false, limits: "Video up to 60s", inputType: "video" as const, multiSpeaker: false, info: "Zero-shot, preserves speaker style. 5 sync modes." },
  { id: "sync-lipsync-v2-pro", name: "Sync Lipsync 2.0 Pro", cost: "$5/min", supportsTTS: false, supportsPrompt: false, syncModes: ["cut_off", "loop", "bounce", "silence", "remap"], supportsGuidance: false, limits: "Video up to 60s. Multi-speaker auto-detection.", inputType: "video" as const, multiSpeaker: true, info: "Enhanced quality + active speaker detection. Best for multi-speaker videos." },
  { id: "latentsync", name: "LatentSync", cost: "$0.10", supportsTTS: false, supportsPrompt: false, syncModes: null, supportsGuidance: true, limits: "Anime support, cost-effective", inputType: "video" as const, multiSpeaker: false, info: "Guidance scale control. Great for anime." },
  { id: "musetalk", name: "MuseTalk", cost: "$0.04/run", supportsTTS: false, supportsPrompt: false, syncModes: null, supportsGuidance: false, limits: "Real-time lip-sync, preserves video quality", inputType: "video" as const, multiSpeaker: false, info: "Ultra-cheap. Real-time audio-driven lip-sync." },
  { id: "veed-lipsync", name: "VEED Lipsync", cost: "$0.40/min", supportsTTS: false, supportsPrompt: false, syncModes: null, supportsGuidance: false, limits: "Commercial use. Realistic lip-sync.", inputType: "video" as const, multiSpeaker: false, info: "VEED's realistic lip-sync engine." },
  { id: "hummingbird-0", name: "Hummingbird-0 (Tavus)", cost: "~$0.10/s", supportsTTS: false, supportsPrompt: false, syncModes: null, supportsGuidance: false, limits: "Up to 5 min. Best realism. Research preview.", inputType: "video" as const, multiSpeaker: false, info: "Zero-shot, SOTA realism. Tavus research preview." },
  { id: "pixverse-lipsync", name: "PixVerse Lipsync", cost: "$0.25", supportsTTS: true, supportsPrompt: false, syncModes: null, supportsGuidance: false, limits: "Text up to 500 chars, Video up to 30s", inputType: "video" as const, multiSpeaker: false, info: "Built-in TTS — type text instead of uploading audio." },
  { id: "creatify-aurora", name: "Creatify Aurora", cost: "$0.30", supportsTTS: false, supportsPrompt: true, syncModes: null, supportsGuidance: false, limits: "Prompt guidance, Video up to 30s", inputType: "video" as const, multiSpeaker: false, info: "Style prompt to guide lip-sync aesthetics." },
];

export const AVATAR_MODELS = [
  // ── Kling (fixed duration: 5 or 10s max) ──
  { id: "kling-avatar-v2-pro", name: "Kling Avatar v2 Pro", cost: "$0.115/s (~$6.90/min)", maxSpeakers: 1, supportsPrompt: true, supportsCfgScale: true, aspects: ["16:9","9:16","1:1"] as string[] | null, durations: [5, 10] as number[] | null, durationMode: "fixed" as const, supportsResolution: false, resolutions: null as string[] | null, info: "Highest quality. Humans, animals, cartoons. Prompt-guided with body movement. Duration capped at 5 or 10s." },
  { id: "kling-avatar-v2-standard", name: "Kling Avatar v2", cost: "$0.056/s (~$3.37/min)", maxSpeakers: 1, supportsPrompt: true, supportsCfgScale: true, aspects: ["16:9","9:16","1:1"], durations: [5, 10], durationMode: "fixed" as const, supportsResolution: false, resolutions: null, info: "Same as Pro but 2x cheaper. Good for prototyping. Multi-language. 5 or 10s max." },
  // ── Longcat ──
  { id: "longcat-single-avatar", name: "Longcat Single Avatar", cost: "$0.15-0.30/s", maxSpeakers: 1, supportsPrompt: true, supportsCfgScale: true, aspects: null, durations: null, durationMode: "audio-match" as const, supportsResolution: true, resolutions: ["480p", "720p"], info: "Prompt-guided. Segments generate ~5s each, up to 10 = ~50s total. Video duration matches audio." },
  { id: "longcat-multi-avatar", name: "Longcat Multi-Avatar", cost: "$0.15-0.30/s", maxSpeakers: 2, supportsPrompt: true, supportsCfgScale: true, aspects: null, durations: null, durationMode: "audio-match" as const, supportsResolution: true, resolutions: ["480p", "720p"], info: "2 independent speakers with separate audio tracks. Prompt-guided. Bounding boxes. Duration matches audio." },
  // ── Infinitalk ──
  { id: "infinitalk", name: "Infinitalk", cost: "$0.20-0.40/s", maxSpeakers: 1, supportsPrompt: true, supportsCfgScale: false, aspects: null, durations: null, durationMode: "audio-match" as const, supportsResolution: true, resolutions: ["480p", "720p"], info: "Natural facial expressions. Prompt-guided. Up to ~24s. Acceleration modes for faster output." },
  // ── fal AI Avatar ──
  { id: "fal-ai-avatar", name: "fal AI Avatar", cost: "$0.20-0.40/s", maxSpeakers: 1, supportsPrompt: true, supportsCfgScale: false, aspects: null, durations: null, durationMode: "audio-match" as const, supportsResolution: true, resolutions: ["480p", "720p"], info: "fal.ai's own avatar engine. Prompt-guided, natural expressions. Duration matches audio." },
  { id: "fal-ai-avatar-multi", name: "fal AI Avatar Multi", cost: "$0.20-0.40/s", maxSpeakers: 2, supportsPrompt: true, supportsCfgScale: false, aspects: null, durations: null, durationMode: "audio-match" as const, supportsResolution: true, resolutions: ["480p", "720p"], info: "Multi-speaker conversations. 2 people speaking in sequence. Auto-detected — no bounding boxes needed." },
  // ── VEED ──
  { id: "veed-fabric-1.0", name: "VEED Fabric 1.0", cost: "$0.08-0.15/s", maxSpeakers: 1, supportsPrompt: false, supportsCfgScale: false, aspects: null, durations: null, durationMode: "audio-match" as const, supportsResolution: true, resolutions: ["480p", "720p"], info: "Full body + hand gestures + head movement. Up to 30s per clip. Great realism." },
  // ── SadTalker ──
  { id: "sadtalker", name: "SadTalker", cost: "~$0.01/run", maxSpeakers: 1, supportsPrompt: false, supportsCfgScale: false, aspects: null, durations: null, durationMode: "audio-match" as const, supportsResolution: false, resolutions: null, info: "Ultra-cheap. 3D audio-driven motion. 46 pose styles + expression control. Good for stylized/cartoon content." },
  // ── Live Avatar ──
  { id: "live-avatar", name: "Live Avatar", cost: "$0.01/s", maxSpeakers: 1, supportsPrompt: true, supportsCfgScale: false, aspects: null, durations: null, durationMode: "audio-match" as const, supportsResolution: false, resolutions: null, info: "Cheapest. Real-time streaming capable. Infinite-length video. Great for long-form talking head content." },
];

export type VideoModelConfig = (typeof VIDEO_MODELS)[number];
export type LipsyncModelConfig = (typeof LIPSYNC_MODELS)[number];
export type AvatarModelConfig = (typeof AVATAR_MODELS)[number];

export type Mode = "image-to-video" | "lipsync" | "avatar";

export interface MultiPromptSegment {
  prompt: string;
  duration: number;
}

export interface ElementImage {
  storagePath: string;
  previewUrl: string;
}

// ── Human-readable error messages ──

const ERROR_PATTERNS: [RegExp, string][] = [
  [/fal\.ai error 400/i, "Generation failed — please try again with a different image or settings"],
  [/failed to download the assets/i, "Source image couldn't be processed — try a different image"],
  [/401|unauthorized/i, "API key issue — check your settings"],
  [/403|forbidden/i, "API key issue — check your settings"],
  [/429|rate.?limit/i, "Rate limit reached — wait a moment and try again"],
  [/timeout|timed?\s*out|took too long/i, "Generation took too long — try again"],
  [/nsfw|content.?policy|safety/i, "Content was flagged by safety filters — try different input"],
  [/invalid.*image|image.*invalid|unsupported.*format/i, "Image format not supported — try a JPG or PNG"],
  [/too large|file.*size/i, "File is too large — try a smaller image"],
];

const FALLBACK_ERROR = "Something went wrong. Try again.";

export function humanizeError(raw: string | null | undefined): string {
  if (!raw) return FALLBACK_ERROR;
  for (const [pattern, message] of ERROR_PATTERNS) {
    if (pattern.test(raw)) return message;
  }
  return FALLBACK_ERROR;
}

// ── Fallback model name map (for IDs not found in model lists) ──

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "fal-ai/wan-i2v": "Wan Video",
  "wan-i2v": "Wan Video",
  "kling-video": "Kling Video",
  "minimax-video": "MiniMax Video",
  "luma-dream-machine": "Luma Dream Machine",
  "hunyuan-video": "Hunyuan Video",
};

export function getDisplayModelName(modelId: string): string {
  const all = [...VIDEO_MODELS, ...LIPSYNC_MODELS, ...AVATAR_MODELS];
  const found = all.find((m) => m.id === modelId);
  if (found) return found.name;
  if (MODEL_DISPLAY_NAMES[modelId]) return MODEL_DISPLAY_NAMES[modelId];
  // Try partial match on known slugs
  for (const [key, name] of Object.entries(MODEL_DISPLAY_NAMES)) {
    if (modelId.includes(key)) return name;
  }
  return modelId;
}
