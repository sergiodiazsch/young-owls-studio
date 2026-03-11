import { getSetting } from "./db/queries";
import { readFile } from "./storage";
import { tlsFetch } from "./fetch-tls";

async function getApiKey(): Promise<string> {
  const setting = await getSetting("fal_api_key");
  if (!setting?.value) throw new Error("fal.ai API key not configured. Go to Settings to add it.");
  return setting.value;
}

/** Parse fal.ai error responses into user-friendly messages */
function parseFalError(status: number, body: string, context: string): string {
  // Try to parse JSON error body
  let detail = "";
  try {
    const json = JSON.parse(body);
    detail = json.detail || json.message || json.error || "";
  } catch {
    detail = body.slice(0, 200);
  }

  if (status === 401 || status === 403) {
    return `fal.ai authentication failed — your API key may be invalid or expired. Check Settings. (${context})`;
  }
  if (status === 402) {
    return `fal.ai: Insufficient credits — add funds at fal.ai/dashboard/billing (${context})`;
  }
  if (status === 405) {
    // 405 can happen when credits are exhausted on certain endpoints, or wrong method
    if (detail.toLowerCase().includes("credit") || detail.toLowerCase().includes("billing") || detail.toLowerCase().includes("payment")) {
      return `fal.ai: Insufficient credits — add funds at fal.ai/dashboard/billing (${context})`;
    }
    return `fal.ai request rejected (405) — this may indicate insufficient credits or an unsupported operation. Details: ${detail || "none"} (${context})`;
  }
  if (status === 422) {
    return `fal.ai: Invalid request parameters — ${detail} (${context})`;
  }
  if (status === 429) {
    return `fal.ai: Rate limit exceeded — wait a moment and try again (${context})`;
  }

  return `fal.ai error ${status}: ${detail || body.slice(0, 200)} (${context})`;
}

// ── Model Configuration ──

export interface ImageModelConfig {
  id: string;
  name: string;
  endpoint: string;
  editEndpoint?: string;
  cost: string;
  features: string[];
  maxCount: number;
  supportsResolution: boolean;
  supportsAspectRatio: boolean;
  supportsWebSearch: boolean;
  supportsEnhancePrompt: boolean;
  supportsReferenceImages: boolean;
  supportsCameraAngles: boolean;
}

export const IMAGE_MODELS: ImageModelConfig[] = [
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    endpoint: "https://fal.run/fal-ai/nano-banana-pro",
    editEndpoint: "https://fal.run/fal-ai/nano-banana-pro/edit",
    cost: "$0.15",
    features: ["1K/2K/4K resolution", "Aspect ratio", "Web search"],
    maxCount: 4,
    supportsResolution: true,
    supportsAspectRatio: true,
    supportsWebSearch: true,
    supportsEnhancePrompt: false,
    supportsReferenceImages: true,
    supportsCameraAngles: false,
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    endpoint: "https://fal.run/fal-ai/nano-banana-2",
    editEndpoint: "https://fal.run/fal-ai/nano-banana-2/edit",
    cost: "$0.10",
    features: ["1K/2K/4K resolution", "Aspect ratio", "Web search", "Enhanced quality"],
    maxCount: 4,
    supportsResolution: true,
    supportsAspectRatio: true,
    supportsWebSearch: true,
    supportsEnhancePrompt: false,
    supportsReferenceImages: true,
    supportsCameraAngles: false,
  },
  {
    id: "seedream-4.5",
    name: "Seedream 4.5",
    endpoint: "https://fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image",
    editEndpoint: "https://fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/edit",
    cost: "$0.04",
    features: ["Auto 2K", "Enhance prompt", "Up to 10 references"],
    maxCount: 6,
    supportsResolution: false,
    supportsAspectRatio: true,
    supportsWebSearch: false,
    supportsEnhancePrompt: true,
    supportsReferenceImages: true,
    supportsCameraAngles: false,
  },
  {
    id: "camera-angles",
    name: "Flux Multi-Angle",
    endpoint: "https://fal.run/fal-ai/flux-2-lora-gallery/multiple-angles",
    cost: "$0.04",
    features: ["12 cinematic angles", "Azimuth/elevation control"],
    maxCount: 12,
    supportsResolution: false,
    supportsAspectRatio: false,
    supportsWebSearch: false,
    supportsEnhancePrompt: false,
    supportsReferenceImages: false,
    supportsCameraAngles: true,
  },
  {
    id: "stable-zero123",
    name: "Stable Zero123",
    endpoint: "https://fal.run/fal-ai/stable-zero123",
    cost: "$0.04",
    features: ["3D rotation from image", "Per-angle generation"],
    maxCount: 12,
    supportsResolution: false,
    supportsAspectRatio: false,
    supportsWebSearch: false,
    supportsEnhancePrompt: false,
    supportsReferenceImages: false,
    supportsCameraAngles: true,
  },
  {
    id: "era3d",
    name: "Era3D Multi-View",
    endpoint: "https://fal.run/fal-ai/era3d",
    cost: "$0.10",
    features: ["6 canonical views", "Single batch"],
    maxCount: 6,
    supportsResolution: false,
    supportsAspectRatio: false,
    supportsWebSearch: false,
    supportsEnhancePrompt: false,
    supportsReferenceImages: false,
    supportsCameraAngles: true,
  },
];

export interface CameraAnglePreset {
  label: string;
  azimuth: number;
  elevation: number;
  distance: number;
}

export const CAMERA_ANGLE_PRESETS: CameraAnglePreset[] = [
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

/** Camera angles config — separate from main IMAGE_MODELS for client-side use */
export const CAMERA_ANGLES_CONFIG = IMAGE_MODELS.find((m) => m.id === "camera-angles")!;

export function getModelConfig(modelId: string): ImageModelConfig {
  const model = IMAGE_MODELS.find((m) => m.id === modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  return model;
}

// ── Shared types ──

export interface FalImageResult {
  images: Array<{ url: string; content_type: string }>;
  seed: number;
}

// ── Reference image helpers ──

/** Convert a storage path to a base64 data URL (fal.ai can't access localhost) */
async function storagePathToDataUrl(storagePath: string, mimeType = "image/png"): Promise<string> {
  const buffer = await readFile(storagePath);
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

// ── Aspect ratio mapping (UI value → API value per model) ──

/** nano-banana-pro uses `aspect_ratio` with colon-separated values */
const NANO_BANANA_ASPECT_MAP: Record<string, string> = {
  "square": "1:1",
  "landscape_4_3": "4:3",
  "landscape_16_9": "16:9",
  "portrait_3_4": "3:4",
  "portrait_9_16": "9:16",
};

// ── Unified generateImage ──

export interface GenerateImageOptions {
  prompt: string;
  model?: string;
  resolution?: string;
  aspectRatio?: string;
  enableWebSearch?: boolean;
  enhancePrompt?: boolean;
  referenceImages?: string[]; // storage paths
  seed?: number;
  azimuth?: number;
  elevation?: number;
  distance?: number;
  outputFormat?: string;
  sourceImagePath?: string; // storage path for source image (camera angle models)
}

export async function generateImage(options: GenerateImageOptions): Promise<FalImageResult> {
  const apiKey = await getApiKey();
  const modelId = options.model || "nano-banana-pro";
  const model = getModelConfig(modelId);
  const hasReferences = options.referenceImages && options.referenceImages.length > 0;

  // Pick endpoint: use edit endpoint when reference images provided
  const endpoint = hasReferences && model.editEndpoint ? model.editEndpoint : model.endpoint;

  const body: Record<string, unknown> = {
    prompt: options.prompt,
    output_format: options.outputFormat || "png",
  };

  // Seed (supported by nano-banana-pro and seedream-4.5)
  if (options.seed !== undefined && options.seed !== null) {
    body.seed = options.seed;
  }

  // ── Model-specific body construction ──

  if (modelId === "nano-banana-pro") {
    // nano-banana-pro uses `resolution` ("1K"/"2K"/"4K") and `aspect_ratio` ("16:9", "4:3", etc.)
    if (options.resolution) {
      body.resolution = options.resolution;
    }
    if (options.aspectRatio) {
      body.aspect_ratio = NANO_BANANA_ASPECT_MAP[options.aspectRatio] || options.aspectRatio;
    }
    if (options.enableWebSearch) {
      body.enable_web_search = true;
    }
    if (hasReferences) {
      body.image_urls = await Promise.all(options.referenceImages!.map((sp) => storagePathToDataUrl(sp)));
    }
  } else if (modelId === "nano-banana-2") {
    // nano-banana-2 uses same API shape as nano-banana-pro
    if (options.resolution) {
      body.resolution = options.resolution;
    }
    if (options.aspectRatio) {
      body.aspect_ratio = NANO_BANANA_ASPECT_MAP[options.aspectRatio] || options.aspectRatio;
    }
    if (options.enableWebSearch) {
      body.enable_web_search = true;
    }
    if (hasReferences) {
      body.image_urls = await Promise.all(options.referenceImages!.map((sp) => storagePathToDataUrl(sp)));
    }
  } else if (modelId === "seedream-4.5") {
    if (options.aspectRatio) {
      body.image_size = options.aspectRatio;
    }
    if (options.enhancePrompt) {
      body.enhance_prompt_mode = "standard";
    }
    if (hasReferences) {
      body.image_urls = await Promise.all(options.referenceImages!.map((sp) => storagePathToDataUrl(sp)));
    }
  } else if (modelId === "camera-angles") {
    if (options.azimuth !== undefined) body.azimuth = options.azimuth;
    if (options.elevation !== undefined) body.elevation = options.elevation;
    if (options.distance !== undefined) body.distance = options.distance;
  } else if (modelId === "stable-zero123") {
    if (options.sourceImagePath) {
      body.image_url = await storagePathToDataUrl(options.sourceImagePath);
    }
    if (options.azimuth !== undefined) body.azimuth = options.azimuth;
    if (options.elevation !== undefined) body.elevation = options.elevation;
  } else if (modelId === "era3d") {
    if (options.sourceImagePath) {
      body.image_url = await storagePathToDataUrl(options.sourceImagePath);
    }
  }

  const res = await tlsFetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseFalError(res.status, text, "image generation"));
  }

  return res.json() as Promise<FalImageResult>;
}

// ── Inpainting ──

export async function inpaintImage(options: {
  prompt: string;
  imageStoragePath: string;
  maskDataUrl: string; // base64 data URL of the mask (white = regenerate)
  model?: string;
}): Promise<FalImageResult> {
  const apiKey = await getApiKey();
  const modelId = options.model || "nano-banana-pro";
  const model = getModelConfig(modelId);

  const endpoint = model.editEndpoint || model.endpoint;
  const imageDataUrl = await storagePathToDataUrl(options.imageStoragePath);

  const body: Record<string, unknown> = {
    prompt: options.prompt,
    image_url: imageDataUrl,
    mask_url: options.maskDataUrl,
    output_format: "png",
  };

  const res = await tlsFetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseFalError(res.status, text, "inpainting"));
  }

  return res.json() as Promise<FalImageResult>;
}

// ── Download helper ──

export async function downloadFalImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await tlsFetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: res.headers.get("content-type") || "image/png",
  };
}

// ═══════════════════════════════════════════════
// ── Video Generation Models & Queue Functions ──
// ═══════════════════════════════════════════════

export interface VideoModelConfig {
  id: string;
  name: string;
  queueEndpoint: string; // image-to-video endpoint slug
  cost: string;
  features: string[];
  maxDuration: number;
  durations: number[];
  aspectRatios: string[];
  supportsNegativePrompt: boolean;
  supportsAudio: boolean;
  supportsElements: boolean;
  maxElements: number;
  supportsMultiPrompt: boolean;
  supportsCfgScale: boolean;
  supportsEndImage: boolean;
  supportsVoice: boolean;
  supportsShotType: boolean;
  shotTypes?: string[];
  // Per-provider parameter name overrides (different APIs use different names)
  imageUrlParam?: string;     // default: "image_url" (Kling uses "start_image_url")
  endImageUrlParam?: string;  // default: "end_image_url"
  audioParam?: string;        // default: "with_audio" (Kling uses "generate_audio", PixVerse uses "generate_audio_switch")
  elementsImageParam?: string; // default: "image_url" (Kling uses "frontal_image_url")
}

const KLING_SHOT_TYPES = ["close-up", "medium-shot", "long-shot", "full-shot", "extreme-close-up", "POV", "over-the-shoulder", "low-angle", "high-angle", "dutch-angle", "bird-eye", "worm-eye"];

export const VIDEO_MODELS: VideoModelConfig[] = [
  // ── Kling ──
  {
    id: "kling-3.0-pro",
    name: "Kling 3.0 Pro",
    queueEndpoint: "fal-ai/kling-video/v3/pro/image-to-video",
    cost: "$0.14/s (no audio), $0.22/s (audio+voice)",
    features: ["3-15s", "10 elements", "Multi-prompt", "Voice x2", "End image", "Shot types", "1080p"],
    maxDuration: 15,
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    aspectRatios: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: true,
    supportsAudio: true,
    supportsElements: true,
    maxElements: 10,
    supportsMultiPrompt: true,
    supportsCfgScale: true,
    supportsEndImage: true,
    supportsVoice: true,
    supportsShotType: true,
    shotTypes: KLING_SHOT_TYPES,
    imageUrlParam: "start_image_url",
    audioParam: "generate_audio",
    elementsImageParam: "frontal_image_url",
  },
  {
    id: "kling-3.0-standard",
    name: "Kling 3.0",
    queueEndpoint: "fal-ai/kling-video/v3/standard/image-to-video",
    cost: "$0.07/s (no audio), $0.14/s (audio)",
    features: ["3-15s", "10 elements", "Multi-prompt", "Voice x2", "End image", "Shot types"],
    maxDuration: 15,
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    aspectRatios: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: true,
    supportsAudio: true,
    supportsElements: true,
    maxElements: 10,
    supportsMultiPrompt: true,
    supportsCfgScale: true,
    supportsEndImage: true,
    supportsVoice: true,
    supportsShotType: true,
    shotTypes: KLING_SHOT_TYPES,
    imageUrlParam: "start_image_url",
    audioParam: "generate_audio",
    elementsImageParam: "frontal_image_url",
  },
  {
    id: "kling-o3",
    name: "Kling O3 (Thinking)",
    queueEndpoint: "fal-ai/kling-video/o3/standard/image-to-video",
    cost: "$0.17/s (no audio), $0.22/s (audio)",
    features: ["3-15s", "Thinking mode", "10 elements", "Multi-prompt", "Voice x2", "End image", "Best quality"],
    maxDuration: 15,
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    aspectRatios: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: true,
    supportsAudio: true,
    supportsElements: true,
    maxElements: 10,
    supportsMultiPrompt: true,
    supportsCfgScale: true,
    supportsEndImage: true,
    supportsVoice: true,
    supportsShotType: true,
    shotTypes: KLING_SHOT_TYPES,
    imageUrlParam: "start_image_url",
    audioParam: "generate_audio",
    elementsImageParam: "frontal_image_url",
  },
  {
    id: "kling-2.6-pro",
    name: "Kling 2.6 Pro",
    queueEndpoint: "fal-ai/kling-video/v2.6/pro/image-to-video",
    cost: "$0.07/s (no audio), $0.14/s (audio)",
    features: ["5/10s", "4 elements", "Negative prompt", "Audio", "End image"],
    maxDuration: 10,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: true,
    supportsAudio: true,
    supportsElements: true,
    maxElements: 4,
    supportsMultiPrompt: false,
    supportsCfgScale: true,
    supportsEndImage: true,
    supportsVoice: true,
    supportsShotType: false,
    imageUrlParam: "start_image_url",
    audioParam: "generate_audio",
    elementsImageParam: "frontal_image_url",
  },
  // ── Hailuo / MiniMax ──
  {
    id: "hailuo-2.3",
    name: "Hailuo 2.3",
    queueEndpoint: "fal-ai/minimax/hailuo-2.3/standard/image-to-video",
    cost: "$0.28/6s, $0.56/10s",
    features: ["6/10s", "768p", "Prompt optimizer", "Cinematic realism"],
    maxDuration: 10,
    durations: [6, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: false,
    supportsAudio: false,
    supportsElements: false,
    maxElements: 0,
    supportsMultiPrompt: false,
    supportsCfgScale: false,
    supportsEndImage: false,
    supportsVoice: false,
    supportsShotType: false,
  },
  {
    id: "hailuo-02-pro",
    name: "Hailuo 02 Pro",
    queueEndpoint: "fal-ai/minimax/hailuo-02/pro/image-to-video",
    cost: "$0.08/s (~$0.48/6s)",
    features: ["~6s", "1080p", "End image"],
    maxDuration: 6,
    durations: [6],
    aspectRatios: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: false,
    supportsAudio: false,
    supportsElements: false,
    maxElements: 0,
    supportsMultiPrompt: false,
    supportsCfgScale: false,
    supportsEndImage: true,
    supportsVoice: false,
    supportsShotType: false,
  },
  {
    id: "hailuo-02-standard",
    name: "Hailuo 02",
    queueEndpoint: "fal-ai/minimax/hailuo-02/standard/image-to-video",
    cost: "~$0.30/6s",
    features: ["~6s", "768p"],
    maxDuration: 6,
    durations: [6],
    aspectRatios: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: false,
    supportsAudio: false,
    supportsElements: false,
    maxElements: 0,
    supportsMultiPrompt: false,
    supportsCfgScale: false,
    supportsEndImage: false,
    supportsVoice: false,
    supportsShotType: false,
  },
  // ── PixVerse ──
  {
    id: "pixverse-5.5",
    name: "PixVerse v5.5",
    queueEndpoint: "fal-ai/pixverse/v5.5/image-to-video",
    cost: "$0.20/5s (720p)",
    features: ["5/8/10s", "Style presets", "Audio gen", "Multi-clip", "Up to 1080p", "Negative prompt"],
    maxDuration: 10,
    durations: [5, 8, 10],
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    supportsNegativePrompt: true,
    supportsAudio: true,
    supportsElements: false,
    maxElements: 0,
    supportsMultiPrompt: false,
    supportsCfgScale: false,
    supportsEndImage: false,
    supportsVoice: false,
    supportsShotType: false,
    audioParam: "generate_audio_switch",
  },
  // ── Wan ──
  {
    id: "wan-2.6",
    name: "Wan 2.6",
    queueEndpoint: "wan/v2.6/image-to-video",
    cost: "$0.10/s (720p), $0.15/s (1080p)",
    features: ["5/10/15s", "720p/1080p", "Multi-shot", "Audio URL", "Prompt expansion", "Open model"],
    maxDuration: 15,
    durations: [5, 10, 15],
    aspectRatios: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: true,
    supportsAudio: false,
    supportsElements: false,
    maxElements: 0,
    supportsMultiPrompt: false,
    supportsCfgScale: false,
    supportsEndImage: false,
    supportsVoice: false,
    supportsShotType: false,
  },
];

export interface LipsyncModelConfig {
  id: string;
  name: string;
  queueEndpoint: string;
  cost: string;
  features: string[];
  maxVideoDuration: number;
  maxAudioDuration: number;
  supportsTTS: boolean;
  supportsPrompt: boolean;
  syncModes?: string[];
  supportsGuidanceScale: boolean;
  multiSpeaker?: boolean;
  inputType?: "video" | "image"; // "image" = avatar-style lipsync (image+audio→video)
}

export const LIPSYNC_MODELS: LipsyncModelConfig[] = [
  {
    id: "kling-lipsync",
    name: "Kling Lipsync",
    queueEndpoint: "fal-ai/kling-video/lipsync/audio-to-video",
    cost: "$0.55",
    features: ["Best quality", "Video 2-10s", "Audio up to 60s"],
    maxVideoDuration: 10,
    maxAudioDuration: 60,
    supportsTTS: false,
    supportsPrompt: false,
    supportsGuidanceScale: false,
  },
  {
    id: "sync-lipsync-v2",
    name: "Sync Lipsync 2.0",
    queueEndpoint: "fal-ai/sync-lipsync/v2",
    cost: "$0.20",
    features: ["Sync modes: cut_off/loop/bounce/silence/remap"],
    maxVideoDuration: 60,
    maxAudioDuration: 120,
    supportsTTS: false,
    supportsPrompt: false,
    syncModes: ["cut_off", "loop", "bounce", "silence", "remap"],
    supportsGuidanceScale: false,
  },
  {
    id: "latentsync",
    name: "LatentSync",
    queueEndpoint: "fal-ai/latentsync",
    cost: "$0.10",
    features: ["Guidance scale", "Anime support", "Cost-effective"],
    maxVideoDuration: 60,
    maxAudioDuration: 120,
    supportsTTS: false,
    supportsPrompt: false,
    supportsGuidanceScale: true,
  },
  {
    id: "pixverse-lipsync",
    name: "PixVerse Lipsync",
    queueEndpoint: "fal-ai/pixverse/lipsync",
    cost: "$0.25",
    features: ["Built-in TTS", "Text up to 500 chars", "Video up to 30s"],
    maxVideoDuration: 30,
    maxAudioDuration: 0,
    supportsTTS: true,
    supportsPrompt: false,
    supportsGuidanceScale: false,
  },
  {
    id: "creatify-aurora",
    name: "Creatify Aurora",
    queueEndpoint: "fal-ai/creatify/aurora/lipsync",
    cost: "$0.30",
    features: ["Prompt guidance for style", "Video up to 30s"],
    maxVideoDuration: 30,
    maxAudioDuration: 120,
    supportsTTS: false,
    supportsPrompt: true,
    supportsGuidanceScale: false,
  },
  {
    id: "musetalk",
    name: "MuseTalk",
    queueEndpoint: "fal-ai/musetalk",
    cost: "$0.04/run",
    features: ["Real-time lip-sync", "Preserves video quality", "Cost-effective"],
    maxVideoDuration: 60,
    maxAudioDuration: 120,
    supportsTTS: false,
    supportsPrompt: false,
    supportsGuidanceScale: false,
  },
  {
    id: "veed-lipsync",
    name: "VEED Lipsync",
    queueEndpoint: "veed/lipsync",
    cost: "$0.40/min",
    features: ["Realistic lip-sync", "Commercial use"],
    maxVideoDuration: 300,
    maxAudioDuration: 300,
    supportsTTS: false,
    supportsPrompt: false,
    supportsGuidanceScale: false,
  },
  {
    id: "hummingbird-0",
    name: "Hummingbird-0 (Tavus)",
    queueEndpoint: "fal-ai/tavus/hummingbird-lipsync/v0",
    cost: "~$0.10/s",
    features: ["Zero-shot", "Up to 5 min", "Best realism", "Research preview"],
    maxVideoDuration: 300,
    maxAudioDuration: 300,
    supportsTTS: false,
    supportsPrompt: false,
    supportsGuidanceScale: false,
  },
  {
    id: "sync-lipsync-v2-pro",
    name: "Sync Lipsync 2.0 Pro",
    queueEndpoint: "fal-ai/sync-lipsync/v2",
    cost: "$5/min",
    features: ["Enhanced quality", "Active speaker detection", "Multi-speaker auto", "Best for close-ups"],
    maxVideoDuration: 60,
    maxAudioDuration: 120,
    supportsTTS: false,
    supportsPrompt: false,
    syncModes: ["cut_off", "loop", "bounce", "silence", "remap"],
    supportsGuidanceScale: false,
    multiSpeaker: true,
  },
];

// ── Upscale Models ──

export interface UpscaleModelConfig {
  id: string;
  name: string;
  queueEndpoint: string;
  cost: string;
  features: string[];
  maxScale: number;
  supportsFps: boolean;
  maxFps: number;
}

export const UPSCALE_MODELS: UpscaleModelConfig[] = [
  {
    id: "topaz-upscale",
    name: "Topaz Upscale",
    queueEndpoint: "fal-ai/topaz/upscale/video",
    cost: "~$0.10/s",
    features: ["1-4x scale", "Up to 8K", "Target FPS up to 120"],
    maxScale: 4,
    supportsFps: true,
    maxFps: 120,
  },
  {
    id: "topaz-4x-gen",
    name: "Topaz 4x Generative",
    queueEndpoint: "fal-ai/topaz/upscale-4x-generative/video",
    cost: "~$0.15/s",
    features: ["Generative 4x upscale", "AI detail enhancement"],
    maxScale: 4,
    supportsFps: false,
    maxFps: 0,
  },
];

// ── Avatar Models (Image + Audio → Talking Avatar Video) ──

export interface AvatarModelConfig {
  id: string;
  name: string;
  queueEndpoint: string;
  cost: string;
  features: string[];
  info: string;
  maxSpeakers: number;
  supportsPrompt: boolean;
  supportsCfgScale: boolean;
  supportsResolution?: boolean;
  resolutions?: string[];
  aspectRatios?: string[];
  durations?: number[];
  durationMode: "fixed" | "audio-match"; // "audio-match" = output matches audio length
}

export const AVATAR_MODELS: AvatarModelConfig[] = [
  // ── Kling ──
  {
    id: "kling-avatar-v2-pro",
    name: "Kling Avatar v2 Pro",
    queueEndpoint: "fal-ai/kling-video/ai-avatar/v2/pro",
    cost: "$0.115/s (~$6.90/min)",
    features: ["Best quality", "Humans/animals/cartoons", "Lip-sync", "Head & body movement", "Multi-language"],
    info: "Highest quality. Handles humans, animals, cartoons. Prompt-guided with body movement. Duration is capped at 5 or 10s — for longer content use Longcat or Infinitalk.",
    maxSpeakers: 1,
    supportsPrompt: true,
    supportsCfgScale: true,
    aspectRatios: ["16:9", "9:16", "1:1"],
    durations: [5, 10],
    durationMode: "fixed",
  },
  {
    id: "kling-avatar-v2-standard",
    name: "Kling Avatar v2",
    queueEndpoint: "fal-ai/kling-video/ai-avatar/v2/standard",
    cost: "$0.056/s (~$3.37/min)",
    features: ["Good quality", "Humans/animals/cartoons", "Lip-sync", "Multi-language", "Cost-effective"],
    info: "Same as Pro but 2x cheaper. Good for prototyping. 5 or 10s max duration.",
    maxSpeakers: 1,
    supportsPrompt: true,
    supportsCfgScale: true,
    aspectRatios: ["16:9", "9:16", "1:1"],
    durations: [5, 10],
    durationMode: "fixed",
  },
  // ── Longcat ──
  {
    id: "longcat-single-avatar",
    name: "Longcat Single Avatar",
    queueEndpoint: "fal-ai/longcat-single-avatar/image-audio-to-video",
    cost: "$0.15/s (480p), $0.30/s (720p)",
    features: ["Prompt-guided", "Text + audio guidance scales", "Up to 10 segments (~50s)", "480p/720p"],
    info: "Prompt-guided generation. Segments generate ~5s each, up to 10 = ~50s total. Video duration matches audio. Great for longer clips.",
    maxSpeakers: 1,
    supportsPrompt: true,
    supportsCfgScale: true,
    supportsResolution: true,
    resolutions: ["480p", "720p"],
    durationMode: "audio-match",
  },
  {
    id: "longcat-multi-avatar",
    name: "Longcat Multi-Avatar",
    queueEndpoint: "fal-ai/longcat-multi-avatar/image-audio-to-video",
    cost: "$0.15/s (480p), $0.30/s (720p)",
    features: ["2 speakers", "Prompt-guided", "Parallel or sequential audio", "Bounding boxes", "Up to ~50s", "480p/720p"],
    info: "2 independent speakers with separate audio tracks. Supports prompt guidance, bounding boxes, and parallel/sequential audio modes. Duration matches audio.",
    maxSpeakers: 2,
    supportsPrompt: true,
    supportsCfgScale: true,
    supportsResolution: true,
    resolutions: ["480p", "720p"],
    durationMode: "audio-match",
  },
  // ── Infinitalk ──
  {
    id: "infinitalk",
    name: "Infinitalk",
    queueEndpoint: "fal-ai/infinitalk",
    cost: "$0.20/s (480p), $0.40/s (720p)",
    features: ["Prompt-guided", "Up to 721 frames (~24s)", "Natural expressions", "480p/720p"],
    info: "Good quality with natural facial expressions. Prompt-guided. Duration matches audio. Acceleration modes for faster output.",
    maxSpeakers: 1,
    supportsPrompt: true,
    supportsCfgScale: false,
    supportsResolution: true,
    resolutions: ["480p", "720p"],
    durationMode: "audio-match",
  },
  // ── fal.ai AI Avatar (single + multi) ──
  {
    id: "fal-ai-avatar",
    name: "fal AI Avatar",
    queueEndpoint: "fal-ai/ai-avatar",
    cost: "$0.20/s (480p), $0.40/s (720p)",
    features: ["Prompt-guided", "Natural expressions", "Acceleration modes", "480p/720p"],
    info: "fal.ai's own avatar engine. Prompt-guided, natural expressions. Duration matches audio.",
    maxSpeakers: 1,
    supportsPrompt: true,
    supportsCfgScale: false,
    supportsResolution: true,
    resolutions: ["480p", "720p"],
    durationMode: "audio-match",
  },
  {
    id: "fal-ai-avatar-multi",
    name: "fal AI Avatar Multi",
    queueEndpoint: "fal-ai/ai-avatar/multi",
    cost: "$0.20/s (480p), $0.40/s (720p)",
    features: ["2 speakers", "Prompt-guided", "Sequential conversation", "480p/720p"],
    info: "Multi-speaker conversations. 2 people speaking in sequence. Prompt-guided. No bounding boxes needed — auto-detected.",
    maxSpeakers: 2,
    supportsPrompt: true,
    supportsCfgScale: false,
    supportsResolution: true,
    resolutions: ["480p", "720p"],
    durationMode: "audio-match",
  },
  // ── VEED ──
  {
    id: "veed-fabric-1.0",
    name: "VEED Fabric 1.0",
    queueEndpoint: "veed/fabric-1.0",
    cost: "$0.08/s (480p), $0.15/s (720p)",
    features: ["Full body animation", "Hand gestures", "Head movement", "480p/720p", "Up to 30s per clip"],
    info: "Full body + hand gestures + head movement. Great realism. Up to 30s per clip, stitch for longer. Duration matches audio.",
    maxSpeakers: 1,
    supportsPrompt: false,
    supportsCfgScale: false,
    supportsResolution: true,
    resolutions: ["480p", "720p"],
    durationMode: "audio-match",
  },
  // ── SadTalker ──
  {
    id: "sadtalker",
    name: "SadTalker",
    queueEndpoint: "fal-ai/sadtalker",
    cost: "~$0.01/run",
    features: ["3D motion coefficients", "Expression control", "Pose styles (0-45)", "Face enhancer", "Still mode"],
    info: "Ultra-cheap. 3D audio-driven motion. Adjustable expressions and 46 pose styles. Good for stylized/cartoon content. Duration matches audio.",
    maxSpeakers: 1,
    supportsPrompt: false,
    supportsCfgScale: false,
    durationMode: "audio-match",
  },
  // ── Live Avatar ──
  {
    id: "live-avatar",
    name: "Live Avatar",
    queueEndpoint: "fal-ai/live-avatar",
    cost: "$0.01/s",
    features: ["Real-time streaming", "Infinite length", "Prompt-guided", "Acceleration modes"],
    info: "Cheapest option. Real-time streaming capable. Infinite-length video. Great for long-form talking head content.",
    maxSpeakers: 1,
    supportsPrompt: true,
    supportsCfgScale: false,
    durationMode: "audio-match",
  },
];

export function getVideoModelConfig(modelId: string): VideoModelConfig {
  const model = VIDEO_MODELS.find((m) => m.id === modelId);
  if (!model) throw new Error(`Unknown video model: ${modelId}`);
  return model;
}

export function getLipsyncModelConfig(modelId: string): LipsyncModelConfig {
  const model = LIPSYNC_MODELS.find((m) => m.id === modelId);
  if (!model) throw new Error(`Unknown lipsync model: ${modelId}`);
  return model;
}

export function getUpscaleModelConfig(modelId: string): UpscaleModelConfig {
  const model = UPSCALE_MODELS.find((m) => m.id === modelId);
  if (!model) throw new Error(`Unknown upscale model: ${modelId}`);
  return model;
}

export function getAvatarModelConfig(modelId: string): AvatarModelConfig {
  const model = AVATAR_MODELS.find((m) => m.id === modelId);
  if (!model) throw new Error(`Unknown avatar model: ${modelId}`);
  return model;
}

// ── Queue API (async long-running jobs) ──

export interface SubmitVideoOptions {
  prompt: string;
  model: string;
  mode: "image-to-video" | "lipsync";
  duration?: number;
  aspectRatio?: string;
  negativePrompt?: string;
  enableAudio?: boolean;
  sourceImagePath?: string;
  sourceVideoPath?: string;
  sourceAudioPath?: string;
  syncMode?: string;
  guidanceScale?: number;
  // New params
  elements?: string[]; // storage paths for element reference images
  multiPrompt?: Array<{ prompt: string; duration: number }>;
  cfgScale?: number;
  endImagePath?: string;
  voiceIds?: string[];
  shotType?: string;
  // Lipsync-specific
  text?: string; // for TTS mode (PixVerse)
  lipsyncPrompt?: string; // for style guidance (Creatify Aurora)
}

/** Response from fal.ai queue submit */
export interface FalQueueSubmitResponse {
  request_id: string;
  response_url?: string;
  status_url?: string;
}

export async function submitVideoGeneration(options: SubmitVideoOptions): Promise<FalQueueSubmitResponse> {
  const apiKey = await getApiKey();
  let queueEndpoint: string;

  if (options.mode === "lipsync") {
    const model = getLipsyncModelConfig(options.model);
    queueEndpoint = model.queueEndpoint;
  } else {
    const model = getVideoModelConfig(options.model);
    queueEndpoint = model.queueEndpoint;
  }

  const body: Record<string, unknown> = {};

  if (options.mode !== "lipsync") {
    const config = getVideoModelConfig(options.model);

    // Multi-prompt or single prompt
    if (config.supportsMultiPrompt && options.multiPrompt && options.multiPrompt.length > 0) {
      body.multi_prompt = options.multiPrompt.map((p) => ({
        prompt: p.prompt,
        duration: p.duration,
      }));
    } else {
      body.prompt = options.prompt;
    }

    if (options.duration) body.duration = options.duration;
    if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
    if (config.supportsNegativePrompt && options.negativePrompt) {
      body.negative_prompt = options.negativePrompt;
    }
    if (config.supportsAudio && options.enableAudio !== undefined) {
      const audioKey = config.audioParam || "with_audio";
      body[audioKey] = options.enableAudio;
    }
    if (options.sourceImagePath) {
      const imageKey = config.imageUrlParam || "image_url";
      body[imageKey] = await storagePathToDataUrl(options.sourceImagePath);
    }

    // Elements (character consistency references)
    if (config.supportsElements && options.elements && options.elements.length > 0) {
      const elemImgKey = config.elementsImageParam || "image_url";
      body.elements = await Promise.all(options.elements.slice(0, config.maxElements).map(async (filePath) => ({
        [elemImgKey]: await storagePathToDataUrl(filePath),
      })));
    }

    // cfg_scale
    if (config.supportsCfgScale && options.cfgScale !== undefined) {
      body.cfg_scale = options.cfgScale;
    }

    // End image
    if (config.supportsEndImage && options.endImagePath) {
      const endImgKey = config.endImageUrlParam || "end_image_url";
      body[endImgKey] = await storagePathToDataUrl(options.endImagePath);
    }

    // Voice IDs
    if (config.supportsVoice && options.voiceIds && options.voiceIds.length > 0) {
      body.voice_ids = options.voiceIds.slice(0, 2);
    }

    // Shot type
    if (config.supportsShotType && options.shotType) {
      body.shot_type = options.shotType;
    }
  } else {
    // Lipsync params
    const lipsyncConfig = getLipsyncModelConfig(options.model);

    // Image-input lipsync (e.g., Kling Avatar used as lipsync)
    if (lipsyncConfig.inputType === "image") {
      if (options.sourceImagePath) {
        body.image_url = await storagePathToDataUrl(options.sourceImagePath);
      }
    } else if (options.sourceVideoPath) {
      body.video_url = await storagePathToDataUrl(options.sourceVideoPath, "video/mp4");
    }

    // TTS mode (PixVerse) — send text instead of audio
    if (lipsyncConfig.supportsTTS && options.text) {
      body.text = options.text;
    } else if (options.sourceAudioPath) {
      body.audio_url = await storagePathToDataUrl(options.sourceAudioPath, "audio/mpeg");
    }

    // Prompt guidance (Creatify Aurora, Kling Avatar)
    if (lipsyncConfig.supportsPrompt && options.lipsyncPrompt) {
      body.prompt = options.lipsyncPrompt;
    }

    // Sync Lipsync Pro model variant
    if (options.model === "sync-lipsync-v2-pro") {
      body.model = "lipsync-2-pro";
    }

    if (options.syncMode) body.sync_mode = options.syncMode;
    if (options.guidanceScale) body.guidance_scale = options.guidanceScale;
    if (options.duration) body.duration = options.duration;
    if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
  }

  const res = await tlsFetch(`https://queue.fal.run/${queueEndpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseFalError(res.status, text, "video generation"));
  }

  return res.json() as Promise<FalQueueSubmitResponse>;
}

// ── Video Upscale ──

export interface SubmitUpscaleOptions {
  sourceVideoPath: string;
  model: string;
  scale?: number;
  targetFps?: number;
}

export async function submitVideoUpscale(options: SubmitUpscaleOptions): Promise<FalQueueSubmitResponse> {
  const apiKey = await getApiKey();
  const config = getUpscaleModelConfig(options.model);

  const body: Record<string, unknown> = {
    video_url: await storagePathToDataUrl(options.sourceVideoPath, "video/mp4"),
  };

  if (options.scale && options.scale > 1) {
    body.scale = options.scale;
  }
  if (config.supportsFps && options.targetFps) {
    body.target_fps = options.targetFps;
  }

  const res = await tlsFetch(`https://queue.fal.run/${config.queueEndpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseFalError(res.status, text, "video upscale"));
  }

  return res.json() as Promise<FalQueueSubmitResponse>;
}


export interface FalQueueStatus {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  response_url?: string;
}

function assertFalOrigin(url: string): void {
  const parsed = new URL(url);
  const h = parsed.hostname;
  if (
    !h.endsWith(".fal.ai") &&
    !h.endsWith(".fal.run") &&
    h !== "fal.media" && !h.endsWith(".fal.media")
  ) {
    throw new Error(`Blocked fetch to non-fal origin: ${h}`);
  }
}

export async function checkVideoStatus(statusUrl: string): Promise<FalQueueStatus> {
  assertFalOrigin(statusUrl);
  const apiKey = await getApiKey();
  const res = await tlsFetch(statusUrl, {
    method: "GET",
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseFalError(res.status, text, `status check: ${statusUrl}`));
  }
  const json = await res.json() as Record<string, unknown>;
  const rawStatus = (json.status as string || "").toUpperCase();
  return {
    status: rawStatus as FalQueueStatus["status"],
    response_url: json.response_url as string | undefined,
  };
}

export interface FalVideoResult {
  video: { url: string; content_type?: string };
  seed?: number;
}

export async function getVideoResult(responseUrl: string): Promise<FalVideoResult> {
  assertFalOrigin(responseUrl);
  const apiKey = await getApiKey();
  const res = await tlsFetch(responseUrl, {
    method: "GET",
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseFalError(res.status, text, `result fetch: ${responseUrl}`));
  }
  return res.json() as Promise<FalVideoResult>;
}

// ── Avatar Generation ──

export interface SubmitAvatarOptions {
  model: string;
  sourceImagePath: string;
  sourceAudioPath: string;
  prompt?: string;
  negativePrompt?: string;
  duration?: number;
  aspectRatio?: string;
  cfgScale?: number;
  // Multi-speaker
  secondSourceImagePath?: string;
  secondSourceAudioPath?: string;
  speakerBoundingBoxes?: Array<{ x: number; y: number; w: number; h: number }>;
  resolution?: "480p" | "720p";
  // SadTalker-specific
  poseStyle?: number;
  expressionScale?: number;
  faceEnhancer?: boolean;
  stillMode?: boolean;
  // Longcat-specific
  audioType?: "para" | "add"; // parallel or sequential
}

export async function submitAvatarGeneration(options: SubmitAvatarOptions): Promise<FalQueueSubmitResponse> {
  const apiKey = await getApiKey();
  const config = getAvatarModelConfig(options.model);

  const body: Record<string, unknown> = {};

  if (config.maxSpeakers >= 2 && options.model === "longcat-multi-avatar") {
    // Longcat Multi-Avatar — image with 2 speakers + separate audio per speaker
    body.image_url = await storagePathToDataUrl(options.sourceImagePath);
    body.audio_url_person1 = await storagePathToDataUrl(options.sourceAudioPath, "audio/mpeg");

    if (options.secondSourceAudioPath) {
      body.audio_url_person2 = await storagePathToDataUrl(options.secondSourceAudioPath, "audio/mpeg");
    }

    if (config.supportsPrompt && options.prompt) body.prompt = options.prompt;
    if (options.negativePrompt) body.negative_prompt = options.negativePrompt;
    if (options.resolution) body.resolution = options.resolution;
    if (options.audioType) body.audio_type = options.audioType;

    if (config.supportsCfgScale) {
      if (options.cfgScale !== undefined) {
        body.text_guidance_scale = options.cfgScale;
        body.audio_guidance_scale = options.cfgScale;
      }
    }

    // Bounding boxes
    if (options.speakerBoundingBoxes?.[0]) {
      const bb = options.speakerBoundingBoxes[0];
      body.bbox_person1 = { x: bb.x, y: bb.y, w: bb.w, h: bb.h };
    }
    if (options.speakerBoundingBoxes?.[1]) {
      const bb = options.speakerBoundingBoxes[1];
      body.bbox_person2 = { x: bb.x, y: bb.y, w: bb.w, h: bb.h };
    }
  } else if (config.maxSpeakers >= 2 && options.model === "fal-ai-avatar-multi") {
    // fal AI Avatar Multi — 2 speakers in sequence
    body.image_url = await storagePathToDataUrl(options.sourceImagePath);
    body.first_audio_url = await storagePathToDataUrl(options.sourceAudioPath, "audio/mpeg");

    if (options.secondSourceAudioPath) {
      body.second_audio_url = await storagePathToDataUrl(options.secondSourceAudioPath, "audio/mpeg");
    }

    if (config.supportsPrompt && options.prompt) body.prompt = options.prompt;
    if (options.resolution) body.resolution = options.resolution;
  } else if (options.model === "sadtalker") {
    // SadTalker — expression/pose control
    body.source_image_url = await storagePathToDataUrl(options.sourceImagePath);
    body.driven_audio_url = await storagePathToDataUrl(options.sourceAudioPath, "audio/mpeg");

    if (options.poseStyle !== undefined) body.pose_style = options.poseStyle;
    if (options.expressionScale !== undefined) body.expression_scale = options.expressionScale;
    if (options.faceEnhancer) body.face_enhancer = "gfpgan";
    if (options.stillMode) body.still_mode = true;
  } else {
    // Generic single-speaker models (Kling, Longcat Single, VEED Fabric, Infinitalk, Live Avatar, fal AI Avatar)
    body.image_url = await storagePathToDataUrl(options.sourceImagePath);
    body.audio_url = await storagePathToDataUrl(options.sourceAudioPath, "audio/mpeg");

    if (config.supportsPrompt && options.prompt) body.prompt = options.prompt;
    if (options.negativePrompt) body.negative_prompt = options.negativePrompt;
    if (options.duration) body.duration = options.duration;
    if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
    if (options.resolution) body.resolution = options.resolution;

    if (config.supportsCfgScale && options.cfgScale !== undefined) {
      // Longcat uses text/audio guidance scales
      if (options.model.startsWith("longcat")) {
        body.text_guidance_scale = options.cfgScale;
        body.audio_guidance_scale = options.cfgScale;
      } else {
        body.cfg_scale = options.cfgScale;
      }
    }
  }

  const res = await tlsFetch(`https://queue.fal.run/${config.queueEndpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseFalError(res.status, text, "avatar generation"));
  }

  return res.json() as Promise<FalQueueSubmitResponse>;
}

export async function downloadFalVideo(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  assertFalOrigin(url);
  const res = await tlsFetch(url);
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: res.headers.get("content-type") || "video/mp4",
  };
}
