// ── Shared types for client & server ──

export interface Project {
  id: number;
  title: string;
  subtitle: string | null;
  rawText: string | null;
  originalFilename: string | null;
  coverImage: string | null;
  productionStyle: string | null;
  createdAt: string;
  updatedAt: string;
  sceneCount?: number;
  characterCount?: number;
  mediaCount?: number;
}

export interface Scene {
  id: number;
  projectId: number;
  sceneNumber: number;
  heading: string;
  headingType: string | null;
  location: string | null;
  timeOfDay: string | null;
  section: string | null;
  synopsis: string | null;
  rawContent: string | null;
  sortOrder: number;
  dialogues?: Dialogue[];
  directions?: Direction[];
  media?: Media[];
}

export interface Dialogue {
  id: number;
  sceneId: number;
  character: string;
  parenthetical: string | null;
  line: string;
  sortOrder: number;
}

export interface Direction {
  id: number;
  sceneId: number;
  type: "action" | "transition" | "broll" | "music" | "note";
  content: string;
  sortOrder: number;
}

export interface Character {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  dialogueCount: number;
  voiceId: string | null;
  voiceName: string | null;
  role: string | null;
  personalityTraits: string | null;
  archetype: string | null;
  emotionalRange: string | null;
  speakingStyle: string | null;
  backstory: string | null;
  aiGenerationNotes: string | null;
  aiScriptNotes: string | null;
}

export interface Prop {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  tags: string | null; // JSON array of tag strings
  aiGenerationNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropFileLink {
  id: number;
  propId: number;
  fileId: number;
  isPrimary: boolean;
}

export interface SharedAsset {
  id: number;
  assetType: "character" | "location" | "prop";
  sourceProjectId: number;
  sourceEntityId: number;
  name: string;
  description: string | null;
  thumbnailPath: string | null;
  metadata: string | null; // JSON
  sharedAt: string;
}

export interface ImportedAsset {
  id: number;
  sharedAssetId: number;
  targetProjectId: number;
  targetEntityId: number;
  assetType: string;
  isForked: boolean;
  importedAt: string;
}

export interface Media {
  id: number;
  projectId: number;
  sceneId: number | null;
  filename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  mediaType: "image" | "audio" | "video";
  caption: string | null;
  createdAt: string;
}

// ── Settings ──

export interface Setting {
  key: string;
  value: string | null;
  updatedAt: string;
}

// ── Prompt Snippets ──

export interface PromptSnippet {
  id: number;
  projectId: number | null;
  name: string;
  content: string;
  shortcut: string | null;
  tags: string[] | null; // stored as JSON string in DB
  createdAt: string;
  updatedAt: string;
}

// ── Voice Generations ──

export interface VoiceGeneration {
  id: number;
  dialogueId: number;
  projectId: number;
  sceneId: number;
  voiceId: string;
  modelId: string;
  inputText: string;
  optionIndex: number;
  selected: boolean;
  storagePath: string;
  paddedStoragePath: string | null;
  paddingStart: number;
  paddingEnd: number;
  mimeType: string;
  fileSize: number;
  paddedFileSize: number | null;
  durationMs: number | null;
  cost: number | null; // TECH AUDIT FIX: Added missing field matching DB schema
  createdAt: string;
}

// ── Drive ──

export interface DriveFolder {
  id: number;
  projectId: number;
  parentId: number | null;
  name: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DriveFile {
  id: number;
  projectId: number;
  folderId: number | null;
  filename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  fileType: string;
  caption: string | null;
  thumbnailPath: string | null;
  generatedBy: string | null;
  generationPrompt: string | null;
  seed: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  tags?: DriveTag[];
}

export interface DriveTag {
  id: number;
  projectId: number;
  name: string;
  color: string;
}

export interface DriveTagAssignment {
  id: number;
  tagId: number;
  fileId: number | null;
  folderId: number | null;
}

export interface SceneFileLink {
  id: number;
  sceneId: number;
  fileId: number;
  reviewStatus: "approved" | "rejected" | "pending";
}

export interface PresentationShare {
  id: number;
  projectId: number;
  token: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface CharacterFileLink {
  id: number;
  characterId: number;
  fileId: number;
  isPrimary: boolean;
}

// ── Claude parsing types ──

export interface ParsedScene {
  sceneNumber: number;
  heading: string;
  headingType: string;
  location: string;
  timeOfDay: string;
  section: string;
  synopsis: string;
  elements: ParsedElement[];
}

export interface ParsedElement {
  type: "dialogue" | "action" | "transition" | "broll" | "music" | "note";
  character?: string;
  parenthetical?: string;
  line?: string;
  content?: string;
  sortOrder: number;
}

export interface ParsedScreenplay {
  title: string;
  subtitle: string;
  scenes: ParsedScene[];
  characters: { name: string; description: string }[];
}

// ── Scene Modification (AI) ──

export interface SceneModificationOption {
  label: string;
  synopsis: string;
  elements: ParsedElement[];
}

// ── Image Generation ──

export interface ImageGeneration {
  id: number;
  projectId: number;
  prompt: string;
  model: string;
  status: "queued" | "generating" | "completed" | "failed";
  storagePath: string | null;
  mimeType: string;
  fileSize: number;
  seed: number | null;
  error: string | null;
  params: string | null; // JSON
  isFavorite: boolean;
  driveFileId: number | null;
  batchId: string | null;
  batchLabel: string | null;
  tags: string[] | null; // auto-generated AI tags (stored as JSON string in DB)
  cost: number | null; // estimated cost in USD
  createdAt: string;
}

export interface ImageGenerationParams {
  resolution?: string;
  aspectRatio?: string;
  enableWebSearch?: boolean;
  enhancePrompt?: boolean;
  referenceImages?: string[]; // storage paths or temp IDs
  seed?: number;
  azimuth?: number;
  elevation?: number;
  distance?: number;
  sourceImagePath?: string; // storage path for source image (camera angle engines)
}

// TECH AUDIT FIX: Removed deprecated ImageGenerationJob interface (unused, replaced by ImageGeneration)

// ── Video Generation ──

export interface VideoGeneration {
  id: number;
  projectId: number;
  prompt: string;
  model: string;
  mode: "text-to-video" | "image-to-video" | "lipsync" | "avatar" | "upscale" | "fps-boost";
  status: "queued" | "submitted" | "processing" | "completed" | "failed";
  falRequestId: string | null;
  storagePath: string | null;
  mimeType: string;
  fileSize: number;
  durationMs: number | null;
  seed: number | null;
  error: string | null;
  params: string | null; // JSON
  isFavorite: boolean;
  driveFileId: number | null;
  sourceImagePath: string | null;
  sourceVideoPath: string | null;
  sourceAudioPath: string | null;
  batchId: string | null;
  tags: string[] | null;
  cost: number | null; // estimated cost in USD
  createdAt: string;
}

// ── Batch 2: Screenplay Versioning ──

export interface ScreenplaySnapshot {
  scenes: Array<{
    id: number;
    sceneNumber: number;
    heading: string;
    headingType: string;
    location: string;
    timeOfDay: string;
    section: string;
    synopsis: string;
    rawContent: string;
    sortOrder: number;
    dialogues: Array<{
      id: number;
      character: string;
      parenthetical: string | null;
      line: string;
      sortOrder: number;
    }>;
    directions: Array<{
      id: number;
      type: string;
      content: string;
      sortOrder: number;
    }>;
  }>;
  characters: Array<{
    id: number;
    name: string;
    description: string;
    visualDescription?: string;
    personality?: string;
    promptText?: string;
  }>;
  metadata: {
    projectId: number;
    projectTitle: string;
    snapshotTimestamp: string;
    wordCount: number;
    sceneCount: number;
    dialogueCount: number;
    directionCount: number;
    characterCount: number;
  };
}

export interface ScreenplayVersion {
  id: number;
  projectId: number;
  branchId: number | null;
  versionNumber: number;
  label: string | null;
  triggerType: string;
  triggerDetail: string | null;
  snapshot: string;
  stats: string | null;
  createdAt: string;
}

export interface ScreenplayBranch {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  isActive: number;
  parentVersionId: number | null;
  createdAt: string;
}

// ── Batch 2: Script Doctor ──

export interface AnalysisResult {
  overallScore: number;
  logline: string;
  synopsis: string;
  structure: {
    score: number;
    actBreaks: Array<{ act: number; startsAtScene: number; endsAtScene: number; assessment: string }>;
    incitingIncident: { sceneId: number; assessment: string } | null;
    midpoint: { sceneId: number; assessment: string } | null;
    climax: { sceneId: number; assessment: string } | null;
    resolution: { sceneId: number; assessment: string } | null;
    notes: string;
  };
  pacing: {
    score: number;
    slowSections: Array<{ fromScene: number; toScene: number; reason: string }>;
    rushedSections: Array<{ fromScene: number; toScene: number; reason: string }>;
    tensionCurve: Array<{ sceneNumber: number; tension: number }>;
    notes: string;
  };
  characters: Array<{
    name: string;
    arcScore: number;
    hasArc: boolean;
    introduction: { sceneId: number; effective: boolean; notes: string } | null;
    development: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  dialogue: {
    score: number;
    voiceDistinctness: number;
    onTheNose: Array<{ dialogueId: number; sceneId: number; character: string; line: string; note: string }>;
    highlights: Array<{ dialogueId: number; character: string; line: string; note: string }>;
    notes: string;
  };
  themes: {
    identified: Array<{ theme: string; strength: string; scenes: number[] }>;
    notes: string;
  };
  issues: Array<{
    category: string;
    severity: string;
    title: string;
    description: string;
    sceneIds: number[];
    characterNames: string[];
    recommendation: string;
  }>;
  moodAndColor?: {
    episodeAnchorMood: string;
    scenes: Array<{
      sceneNumber: number;
      dominantMood: string;
      recommendedBrightnessPercent: number;
      colorPalette: string[];
      moodNotes: string;
    }>;
  };
}

export interface ScriptAnalysis {
  id: number;
  projectId: number;
  versionId: number | null;
  analysisType: string;
  status: string;
  result: string | null;
  customPrompt: string | null;
  model: string | null;
  tokenCount: number | null;
  error: string | null;
  createdAt: string;
}

export interface ScriptIssue {
  id: number;
  analysisId: number;
  projectId: number;
  category: string;
  severity: string;
  title: string;
  description: string;
  sceneIds: string | null;
  characterNames: string | null;
  recommendation: string;
  isResolved: number;
  resolvedNote: string | null;
  sortOrder: number;
  createdAt: string;
}

// ── Batch 2: Dialogue Polish ──

export interface DialoguePolishJob {
  id: number;
  projectId: number;
  characterId: number;
  characterName: string;
  directive: string;
  status: string;
  totalDialogues: number;
  processedDialogues: number;
  acceptedDialogues: number;
  rejectedDialogues: number;
  model: string | null;
  versionIdBefore: number | null;
  error: string | null;
  createdAt: string;
}

export interface DialoguePolishResult {
  id: number;
  jobId: number;
  dialogueId: number;
  sceneId: number;
  originalLine: string;
  originalParenthetical: string | null;
  rewrittenLine: string;
  rewrittenParenthetical: string | null;
  changeRationale: string | null;
  status: string;
  sortOrder: number;
  createdAt: string;
}

// ── Batch 2: Scene Breakdown ──

export interface SceneBreakdown {
  id: number;
  sceneId: number;
  projectId: number;
  status: string;
  pageCount: number | null;
  dayOrNight: string | null;
  intOrExt: string | null;
  estimatedShootHours: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BreakdownElement {
  id: number;
  breakdownId: number;
  category: string;
  name: string;
  description: string | null;
  quantity: number;
  isCustom: number;
  sortOrder: number;
  createdAt: string;
}

// ── Batch 2: Moodboard ──

export interface Moodboard {
  id: number;
  projectId: number;
  sceneId: number | null;
  title: string;
  description: string | null;
  layout: string;
  backgroundColor: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MoodboardItem {
  id: number;
  moodboardId: number;
  type: string;
  fileId: number | null;
  generationId: number | null;
  storagePath: string | null;
  textContent: string | null;
  colorValue: string | null;
  colorName: string | null;
  url: string | null;
  urlThumbnail: string | null;
  positionX: number | null;
  positionY: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
}

// ── Batch 2: Locations ──

export interface Location {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  visualPrompt: string | null;
  timePeriod: string | null;
  styleNotes: string | null;
  referenceImages: string | null;
  moodboardId: number | null;
  sceneCount: number;
  createdAt: string;
  updatedAt: string;
  /** Derived from linked scenes: "INT" | "EXT" | "INT/EXT" | null */
  intExt?: string | null;
  /** Derived from linked scenes: unique time-of-day values e.g. ["DAY","NIGHT"] */
  timesOfDay?: string[];
}

export interface LocationConcept {
  id: number;
  locationId: number;
  generationId: number | null;
  fileId: number | null;
  storagePath: string | null;
  prompt: string | null;
  timeOfDay: string | null;
  cameraAngle: string | null;
  isPrimary: number;
  sortOrder: number;
  createdAt: string;
}

// ── Batch 2: Color Script ──

export interface SceneColorData {
  id: number;
  sceneId: number;
  projectId: number;
  dominantColors: string;
  averageColor: string | null;
  brightness: number | null;
  saturation: number | null;
  warmth: number | null;
  moodTag: string | null;
  sourceImageId: number | null;
  sourceImagePath: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Diff Types ──

export interface TextDiff {
  type: "added" | "removed" | "unchanged";
  value: string;
}

export interface DiffResult {
  scenes: {
    added: Array<{ sceneNumber: number; heading: string }>;
    removed: Array<{ sceneNumber: number; heading: string }>;
    modified: Array<{ sceneNumber: number; heading: string; changes: string[] }>;
    unchanged: number;
  };
  dialogues: {
    added: Array<{ character: string; line: string; sceneNumber: number }>;
    removed: Array<{ character: string; line: string; sceneNumber: number }>;
    modified: Array<{ character: string; oldLine: string; newLine: string; sceneNumber: number; diffs: TextDiff[] }>;
    unchanged: number;
  };
  directions: {
    added: Array<{ type: string; content: string; sceneNumber: number }>;
    removed: Array<{ type: string; content: string; sceneNumber: number }>;
    modified: Array<{ type: string; oldContent: string; newContent: string; sceneNumber: number; diffs: TextDiff[] }>;
    unchanged: number;
  };
  characters: {
    added: Array<{ name: string }>;
    removed: Array<{ name: string }>;
    modified: Array<{ name: string; changes: string[] }>;
  };
  summary: {
    totalChanges: number;
    description: string;
  };
}
