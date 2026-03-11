// ── Generation Statuses ──
// Used across image generation, video generation, breakdowns, script-doctor, audio-studio, etc.

export const GENERATION_STATUS = {
  QUEUED: "queued",
  GENERATING: "generating",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type GenerationStatus = (typeof GENERATION_STATUS)[keyof typeof GENERATION_STATUS];

// Video generation has additional intermediate statuses
export const VIDEO_GENERATION_STATUS = {
  ...GENERATION_STATUS,
  SUBMITTED: "submitted",
  PROCESSING: "processing",
} as const;

export type VideoGenerationStatus = (typeof VIDEO_GENERATION_STATUS)[keyof typeof VIDEO_GENERATION_STATUS];

// ── Direction / Element Types ──
// Used in types.ts Direction.type and ParsedElement.type

export const DIRECTION_TYPES = {
  ACTION: "action",
  TRANSITION: "transition",
  BROLL: "broll",
  MUSIC: "music",
  NOTE: "note",
} as const;

export type DirectionType = (typeof DIRECTION_TYPES)[keyof typeof DIRECTION_TYPES];

export const ELEMENT_TYPES = {
  DIALOGUE: "dialogue",
  ...DIRECTION_TYPES,
} as const;

export type ElementType = (typeof ELEMENT_TYPES)[keyof typeof ELEMENT_TYPES];

// ── Media Types ──

export const MEDIA_TYPES = {
  IMAGE: "image",
  AUDIO: "audio",
  VIDEO: "video",
} as const;

export type MediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES];

// ── Video Generation Modes ──

export const VIDEO_MODES = {
  TEXT_TO_VIDEO: "text-to-video",
  IMAGE_TO_VIDEO: "image-to-video",
  LIPSYNC: "lipsync",
  AVATAR: "avatar",
  UPSCALE: "upscale",
  FPS_BOOST: "fps-boost",
} as const;

export type VideoMode = (typeof VIDEO_MODES)[keyof typeof VIDEO_MODES];

// ── Production Note Categories ──
// Used in production-notes.tsx

export const NOTE_CATEGORIES = [
  "blocking",
  "lighting",
  "sound",
  "vfx",
  "performance",
  "general",
] as const;

export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

// ── Production Note Colors ──

export const NOTE_COLORS = ["red", "yellow", "green", "blue", "purple"] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export const NOTE_COLOR_VALUES: Record<string, string> = {
  red: "oklch(0.55 0.2 25)",
  yellow: "oklch(0.75 0.15 85)",
  green: "oklch(0.55 0.18 145)",
  blue: "oklch(0.55 0.18 250)",
  purple: "oklch(0.55 0.18 300)",
};

// ── Default Limits & Timeouts ──

export const DEFAULTS = {
  /** Default debounce delay for search inputs (ms) */
  DEBOUNCE_MS: 300,

  /** Default page limit for image generation queries */
  IMAGE_GEN_QUERY_LIMIT: 200,

  /** Default page limit for video generation queries */
  VIDEO_GEN_QUERY_LIMIT: 200,

  /** Default page limit for drive file queries */
  DRIVE_FILES_QUERY_LIMIT: 100,

  /** Default page limit for version queries */
  VERSIONS_QUERY_LIMIT: 50,

  /** Max versions per query */
  VERSIONS_QUERY_MAX: 200,

  /** Max concurrent image generation requests */
  MAX_CONCURRENT_IMAGE_GEN: 4,
} as const;

// ── Polling Constants ──

export const POLLING = {
  /** Video generation poll interval (ms) */
  VIDEO_POLL_INTERVAL_MS: 5000,

  /** Maximum video poll attempts before timeout (120 * 5s = 10 minutes) */
  VIDEO_MAX_POLL_ATTEMPTS: 120,

  /** Maximum polling backoff ceiling (ms) -- used in script-doctor & dialogue-polish */
  MAX_BACKOFF_MS: 30000,
} as const;

// ── File Size Limits ──

export const FILE_SIZE_LIMITS = {
  /** General storage hard limit (200MB) */
  STORAGE_MAX: 200 * 1024 * 1024,

  /** Drive file upload limit (100MB) */
  DRIVE_UPLOAD_MAX: 100 * 1024 * 1024,

  /** Media upload limit (100MB) */
  MEDIA_UPLOAD_MAX: 100 * 1024 * 1024,

  /** Screenplay .docx upload limit (10MB) */
  SCREENPLAY_UPLOAD_MAX: 10 * 1024 * 1024,

  /** Reference image upload limit (20MB) */
  REFERENCE_UPLOAD_MAX: 20 * 1024 * 1024,

  /** Upload page file size limit (50MB) */
  UPLOAD_PAGE_MAX: 50 * 1024 * 1024,
} as const;

// ── Rate Limit Defaults ──

export const RATE_LIMIT = {
  /** Default rate limit interval (ms) */
  INTERVAL_MS: 60_000,

  /** Default unique tokens per interval */
  UNIQUE_TOKENS: 500,
} as const;

// ── Dialogue Polish Job Statuses ──

export const POLISH_STATUS = {
  REVIEW: "review",
  FAILED: "failed",
} as const;

// ── Script Analysis Statuses ──

export const ANALYSIS_STATUS = {
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

// ── Breakdown Statuses ──

export const BREAKDOWN_STATUS = {
  GENERATING: "generating",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
