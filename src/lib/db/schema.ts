import { pgTable, text, integer, real, serial, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  rawText: text("raw_text"),
  originalFilename: text("original_filename"),
  coverImage: text("cover_image"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const scenes = pgTable("scenes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sceneNumber: integer("scene_number").notNull(),
  heading: text("heading").notNull(),
  headingType: text("heading_type"),
  location: text("location"),
  timeOfDay: text("time_of_day"),
  section: text("section"),
  synopsis: text("synopsis"),
  rawContent: text("raw_content"),
  sortOrder: integer("sort_order").notNull(),
});

export const dialogues = pgTable("dialogues", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  character: text("character").notNull(),
  parenthetical: text("parenthetical"),
  line: text("line").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const directions = pgTable("directions", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  content: text("content").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  dialogueCount: integer("dialogue_count").notNull().default(0),
  voiceId: text("voice_id"),
  voiceName: text("voice_name"),
  role: text("role"),
  personalityTraits: text("personality_traits"), // JSON array: '["stubborn","loyal"]'
  archetype: text("archetype"),
  emotionalRange: text("emotional_range"),
  speakingStyle: text("speaking_style"),
  backstory: text("backstory"),
  aiGenerationNotes: text("ai_generation_notes"),
  aiScriptNotes: text("ai_script_notes"),
});

export const characterReferenceImages = pgTable("character_reference_images", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  filename: text("filename").notNull(),
  label: text("label"),
  isDefault: boolean("is_default").notNull().default(false),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const locationReferenceImages = pgTable("location_reference_images", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  filename: text("filename").notNull(),
  label: text("label"),
  isDefault: boolean("is_default").notNull().default(false),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sceneId: integer("scene_id").references(() => scenes.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  mediaType: text("media_type").notNull(),
  caption: text("caption"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Settings ──

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Prompt Snippets ──

export const promptSnippets = pgTable("prompt_snippets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  shortcut: text("shortcut"),
  tags: text("tags"), // JSON array of tag strings
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Voice Generations ──

export const voiceGenerations = pgTable("voice_generations", {
  id: serial("id").primaryKey(),
  dialogueId: integer("dialogue_id").notNull().references(() => dialogues.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sceneId: integer("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  voiceId: text("voice_id").notNull(),
  modelId: text("model_id").notNull(),
  inputText: text("input_text").notNull(),
  optionIndex: integer("option_index").notNull(),
  selected: boolean("selected").notNull().default(false),
  storagePath: text("storage_path").notNull(),
  paddedStoragePath: text("padded_storage_path"),
  paddingStart: real("padding_start").default(0),
  paddingEnd: real("padding_end").default(0),
  mimeType: text("mime_type").notNull().default("audio/mpeg"),
  fileSize: integer("file_size").notNull(),
  paddedFileSize: integer("padded_file_size"),
  durationMs: integer("duration_ms"),
  cost: real("cost"), // estimated cost in USD
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Image Generations ──

export const imageGenerations = pgTable("image_generations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  model: text("model").notNull().default("nano-banana-pro"),
  status: text("status").notNull().default("queued"),
  storagePath: text("storage_path"),
  mimeType: text("mime_type").default("image/png"),
  fileSize: integer("file_size").default(0),
  seed: integer("seed"),
  error: text("error"),
  params: text("params"), // JSON: resolution, aspectRatio, referenceImages, azimuth, elevation, distance
  isFavorite: boolean("is_favorite").notNull().default(false),
  driveFileId: integer("drive_file_id").references(() => driveFiles.id, { onDelete: "set null" }),
  batchId: text("batch_id"),
  batchLabel: text("batch_label"),
  tags: text("tags"), // JSON array of auto-generated tags
  cost: real("cost"), // estimated cost in USD (e.g. 0.15)
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Audio Studio Generations ──

export const audioStudioGenerations = pgTable("audio_studio_generations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  type: text("type").notNull().default("sfx"), // "sfx" | "music"
  status: text("status").notNull().default("generating"), // "generating" | "completed" | "failed"
  storagePath: text("storage_path"),
  filename: text("filename"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  durationSeconds: real("duration_seconds"),
  error: text("error"),
  generatedBy: text("generated_by"), // "elevenlabs" | "fal.ai"
  cost: real("cost"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Drive (Asset Management) ──

export const driveFolders = pgTable("drive_folders", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"), // Self-referential FK defined in DDL; Drizzle relation handles the join
  name: text("name").notNull(),
  icon: text("icon").default("folder"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const driveFiles = pgTable("drive_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => driveFolders.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(), // image | audio | video | document
  caption: text("caption"),
  thumbnailPath: text("thumbnail_path"),
  generatedBy: text("generated_by"), // "fal.ai" | "elevenlabs" | null
  generationPrompt: text("generation_prompt"),
  seed: integer("seed"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const driveTags = pgTable("drive_tags", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("gray"),
});

export const driveTagAssignments = pgTable("drive_tag_assignments", {
  id: serial("id").primaryKey(),
  tagId: integer("tag_id").notNull().references(() => driveTags.id, { onDelete: "cascade" }),
  fileId: integer("file_id").references(() => driveFiles.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => driveFolders.id, { onDelete: "cascade" }),
});

export const sceneFileLinks = pgTable("scene_file_links", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  fileId: integer("file_id").notNull().references(() => driveFiles.id, { onDelete: "cascade" }),
  reviewStatus: text("review_status").notNull().default("pending"),
});

export const characterFileLinks = pgTable("character_file_links", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  fileId: integer("file_id").notNull().references(() => driveFiles.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false),
});

// ── Relations ──

export const projectsRelations = relations(projects, ({ many }) => ({
  scenes: many(scenes),
  characters: many(characters),
  media: many(media),
  driveFolders: many(driveFolders),
  driveFiles: many(driveFiles),
  driveTags: many(driveTags),
  promptSnippets: many(promptSnippets),
  imageGenerations: many(imageGenerations),
}));

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  project: one(projects, { fields: [scenes.projectId], references: [projects.id] }),
  dialogues: many(dialogues),
  directions: many(directions),
  media: many(media),
  sceneFileLinks: many(sceneFileLinks),
  voiceGenerations: many(voiceGenerations),
  sceneNotes: many(sceneNotes),
}));

export const dialoguesRelations = relations(dialogues, ({ one, many }) => ({
  scene: one(scenes, { fields: [dialogues.sceneId], references: [scenes.id] }),
  voiceGenerations: many(voiceGenerations),
}));

export const directionsRelations = relations(directions, ({ one }) => ({
  scene: one(scenes, { fields: [directions.sceneId], references: [scenes.id] }),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  project: one(projects, { fields: [characters.projectId], references: [projects.id] }),
  characterFileLinks: many(characterFileLinks),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  project: one(projects, { fields: [media.projectId], references: [projects.id] }),
  scene: one(scenes, { fields: [media.sceneId], references: [scenes.id] }),
}));

export const promptSnippetsRelations = relations(promptSnippets, ({ one }) => ({
  project: one(projects, { fields: [promptSnippets.projectId], references: [projects.id] }),
}));

export const voiceGenerationsRelations = relations(voiceGenerations, ({ one }) => ({
  dialogue: one(dialogues, { fields: [voiceGenerations.dialogueId], references: [dialogues.id] }),
  project: one(projects, { fields: [voiceGenerations.projectId], references: [projects.id] }),
  scene: one(scenes, { fields: [voiceGenerations.sceneId], references: [scenes.id] }),
}));

export const imageGenerationsRelations = relations(imageGenerations, ({ one }) => ({
  project: one(projects, { fields: [imageGenerations.projectId], references: [projects.id] }),
  driveFile: one(driveFiles, { fields: [imageGenerations.driveFileId], references: [driveFiles.id] }),
}));

export const driveFoldersRelations = relations(driveFolders, ({ one, many }) => ({
  project: one(projects, { fields: [driveFolders.projectId], references: [projects.id] }),
  parent: one(driveFolders, { fields: [driveFolders.parentId], references: [driveFolders.id] }),
  files: many(driveFiles),
  tagAssignments: many(driveTagAssignments),
}));

export const driveFilesRelations = relations(driveFiles, ({ one, many }) => ({
  project: one(projects, { fields: [driveFiles.projectId], references: [projects.id] }),
  folder: one(driveFolders, { fields: [driveFiles.folderId], references: [driveFolders.id] }),
  tagAssignments: many(driveTagAssignments),
  sceneFileLinks: many(sceneFileLinks),
  characterFileLinks: many(characterFileLinks),
}));

export const driveTagsRelations = relations(driveTags, ({ one, many }) => ({
  project: one(projects, { fields: [driveTags.projectId], references: [projects.id] }),
  assignments: many(driveTagAssignments),
}));

export const driveTagAssignmentsRelations = relations(driveTagAssignments, ({ one }) => ({
  tag: one(driveTags, { fields: [driveTagAssignments.tagId], references: [driveTags.id] }),
  file: one(driveFiles, { fields: [driveTagAssignments.fileId], references: [driveFiles.id] }),
  folder: one(driveFolders, { fields: [driveTagAssignments.folderId], references: [driveFolders.id] }),
}));

export const sceneFileLinksRelations = relations(sceneFileLinks, ({ one }) => ({
  scene: one(scenes, { fields: [sceneFileLinks.sceneId], references: [scenes.id] }),
  file: one(driveFiles, { fields: [sceneFileLinks.fileId], references: [driveFiles.id] }),
}));

export const characterFileLinksRelations = relations(characterFileLinks, ({ one }) => ({
  character: one(characters, { fields: [characterFileLinks.characterId], references: [characters.id] }),
  file: one(driveFiles, { fields: [characterFileLinks.fileId], references: [driveFiles.id] }),
}));

// ── Video Generations ──

export const videoGenerations = pgTable("video_generations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  model: text("model").notNull(),
  mode: text("mode").notNull().default("text-to-video"), // text-to-video | image-to-video | lipsync
  status: text("status").notNull().default("queued"), // queued | submitted | processing | completed | failed
  falRequestId: text("fal_request_id"),
  storagePath: text("storage_path"),
  mimeType: text("mime_type").default("video/mp4"),
  fileSize: integer("file_size").default(0),
  durationMs: integer("duration_ms"),
  seed: integer("seed"),
  error: text("error"),
  params: text("params"), // JSON: model-specific settings
  isFavorite: boolean("is_favorite").notNull().default(false),
  driveFileId: integer("drive_file_id").references(() => driveFiles.id, { onDelete: "set null" }),
  sourceImagePath: text("source_image_path"),
  sourceVideoPath: text("source_video_path"),
  sourceAudioPath: text("source_audio_path"),
  batchId: text("batch_id"),
  tags: text("tags"), // JSON array
  cost: real("cost"), // estimated cost in USD
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const videoGenerationsRelations = relations(videoGenerations, ({ one }) => ({
  project: one(projects, { fields: [videoGenerations.projectId], references: [projects.id] }),
  driveFile: one(driveFiles, { fields: [videoGenerations.driveFileId], references: [driveFiles.id] }),
}));

// ── Batch 2: Screenplay Versioning (Feature 20) ──

export const screenplayVersions = pgTable("screenplay_versions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  branchId: integer("branch_id"),
  versionNumber: integer("version_number").notNull(),
  label: text("label"),
  triggerType: text("trigger_type").notNull(),
  triggerDetail: text("trigger_detail"),
  snapshot: text("snapshot").notNull(),
  stats: text("stats"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const screenplayBranches = pgTable("screenplay_branches", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: integer("is_active").default(0),
  parentVersionId: integer("parent_version_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Batch 2: Script Doctor (Feature 16) ──

export const scriptAnalyses = pgTable("script_analyses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  versionId: integer("version_id"),
  analysisType: text("analysis_type").notNull(),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  customPrompt: text("custom_prompt"),
  model: text("model").default("claude-sonnet-4-20250514"),
  tokenCount: integer("token_count"),
  error: text("error"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const scriptIssues = pgTable("script_issues", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull().references(() => scriptAnalyses.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  sceneIds: text("scene_ids"),
  characterNames: text("character_names"),
  recommendation: text("recommendation").notNull(),
  isResolved: integer("is_resolved").default(0),
  resolvedNote: text("resolved_note"),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Batch 2: Dialogue Polish (Feature 17) ──

export const dialoguePolishJobs = pgTable("dialogue_polish_jobs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  characterName: text("character_name").notNull(),
  directive: text("directive").notNull(),
  status: text("status").notNull().default("pending"),
  totalDialogues: integer("total_dialogues").notNull(),
  processedDialogues: integer("processed_dialogues").default(0),
  acceptedDialogues: integer("accepted_dialogues").default(0),
  rejectedDialogues: integer("rejected_dialogues").default(0),
  model: text("model").default("claude-sonnet-4-20250514"),
  versionIdBefore: integer("version_id_before"),
  error: text("error"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const dialoguePolishResults = pgTable("dialogue_polish_results", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => dialoguePolishJobs.id, { onDelete: "cascade" }),
  dialogueId: integer("dialogue_id").notNull().references(() => dialogues.id, { onDelete: "cascade" }),
  sceneId: integer("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  originalLine: text("original_line").notNull(),
  originalParenthetical: text("original_parenthetical"),
  rewrittenLine: text("rewritten_line").notNull(),
  rewrittenParenthetical: text("rewritten_parenthetical"),
  changeRationale: text("change_rationale"),
  status: text("status").notNull().default("pending"),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Batch 2: Scene Breakdown (Feature 18) ──

export const sceneBreakdowns = pgTable("scene_breakdowns", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  pageCount: real("page_count"),
  dayOrNight: text("day_or_night"),
  intOrExt: text("int_or_ext"),
  estimatedShootHours: real("estimated_shoot_hours"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const breakdownElements = pgTable("breakdown_elements", {
  id: serial("id").primaryKey(),
  breakdownId: integer("breakdown_id").notNull().references(() => sceneBreakdowns.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  quantity: integer("quantity").default(1),
  isCustom: integer("is_custom").default(0),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Batch 2: Moodboard (Feature 19) ──

export const moodboards = pgTable("moodboards", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sceneId: integer("scene_id"),
  title: text("title").notNull(),
  description: text("description"),
  layout: text("layout").default("masonry"),
  backgroundColor: text("background_color").default("#1a1a1a"),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const moodboardItems = pgTable("moodboard_items", {
  id: serial("id").primaryKey(),
  moodboardId: integer("moodboard_id").notNull().references(() => moodboards.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  fileId: integer("file_id"),
  generationId: integer("generation_id"),
  storagePath: text("storage_path"),
  textContent: text("text_content"),
  colorValue: text("color_value"),
  colorName: text("color_name"),
  url: text("url"),
  urlThumbnail: text("url_thumbnail"),
  positionX: real("position_x"),
  positionY: real("position_y"),
  width: real("width"),
  height: real("height"),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Batch 2: Locations (Feature 23) ──

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  visualPrompt: text("visual_prompt"),
  timePeriod: text("time_period"),
  styleNotes: text("style_notes"),
  referenceImages: text("reference_images"),
  moodboardId: integer("moodboard_id"),
  sceneCount: integer("scene_count").default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const sceneLocations = pgTable("scene_locations", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  locationId: integer("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
});

export const locationConcepts = pgTable("location_concepts", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  generationId: integer("generation_id"),
  fileId: integer("file_id"),
  storagePath: text("storage_path"),
  prompt: text("prompt"),
  timeOfDay: text("time_of_day"),
  cameraAngle: text("camera_angle"),
  isPrimary: integer("is_primary").default(0),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Batch 2: Color Script (Feature 24) ──

export const sceneColorData = pgTable("scene_color_data", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  dominantColors: text("dominant_colors").notNull(),
  averageColor: text("average_color"),
  brightness: real("brightness"),
  saturation: real("saturation"),
  warmth: real("warmth"),
  moodTag: text("mood_tag"),
  sourceImageId: integer("source_image_id"),
  sourceImagePath: text("source_image_path"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Video Editor ──

export const videoEditorProjects = pgTable("video_editor_projects", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  width: integer("width").notNull().default(1920),
  height: integer("height").notNull().default(1080),
  fps: integer("fps").notNull().default(30),
  durationMs: integer("duration_ms").notNull().default(0),
  status: text("status").notNull().default("draft"), // draft | rendering | completed | failed
  renderProgress: integer("render_progress").default(0),
  renderError: text("render_error"),
  outputPath: text("output_path"),
  outputSize: integer("output_size"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const videoEditorTracks = pgTable("video_editor_tracks", {
  id: serial("id").primaryKey(),
  editorProjectId: integer("editor_project_id").notNull().references(() => videoEditorProjects.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // video | audio | text | overlay
  name: text("name").notNull(),
  muted: boolean("muted").notNull().default(false),
  locked: boolean("locked").notNull().default(false),
  volume: real("volume").notNull().default(1.0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const videoEditorClips = pgTable("video_editor_clips", {
  id: serial("id").primaryKey(),
  trackId: integer("track_id").notNull().references(() => videoEditorTracks.id, { onDelete: "cascade" }),
  editorProjectId: integer("editor_project_id").notNull().references(() => videoEditorProjects.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // video | audio | image | text | subtitle
  name: text("name"),
  // Timeline position (ms)
  startMs: integer("start_ms").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  // Source trimming (ms from source start)
  sourceStartMs: integer("source_start_ms").notNull().default(0),
  sourceEndMs: integer("source_end_ms"),
  // Source reference
  sourcePath: text("source_path"), // storagePath
  sourceType: text("source_type"), // drive | generation | audio-studio | upload | ai-generated
  sourceId: integer("source_id"), // driveFileId or generationId
  // Properties
  volume: real("volume").notNull().default(1.0),
  opacity: real("opacity").notNull().default(1.0),
  playbackRate: real("playback_rate").notNull().default(1.0),
  // Text/subtitle clips
  textContent: text("text_content"),
  textStyle: text("text_style"), // JSON: font, size, color, position, bg
  // Filters & effects
  filters: text("filters"), // JSON array of filter configs
  transition: text("transition"), // JSON: type, durationMs
  // Metadata
  thumbnailPath: text("thumbnail_path"),
  waveformData: text("waveform_data"), // JSON array of amplitude values
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Props ──

export const props = pgTable("props", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  tags: text("tags"), // JSON array of tag strings
  aiGenerationNotes: text("ai_generation_notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const propFileLinks = pgTable("prop_file_links", {
  id: serial("id").primaryKey(),
  propId: integer("prop_id").notNull().references(() => props.id, { onDelete: "cascade" }),
  fileId: integer("file_id").notNull().references(() => driveFiles.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false),
});

export const propsRelations = relations(props, ({ one, many }) => ({
  project: one(projects, { fields: [props.projectId], references: [projects.id] }),
  propFileLinks: many(propFileLinks),
}));

export const propFileLinksRelations = relations(propFileLinks, ({ one }) => ({
  prop: one(props, { fields: [propFileLinks.propId], references: [props.id] }),
  file: one(driveFiles, { fields: [propFileLinks.fileId], references: [driveFiles.id] }),
}));

// ── Cross-Project Asset Sharing ──

export const sharedAssets = pgTable("shared_assets", {
  id: serial("id").primaryKey(),
  assetType: text("asset_type").notNull(), // 'character' | 'location' | 'prop'
  sourceProjectId: integer("source_project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sourceEntityId: integer("source_entity_id").notNull(), // characters.id or locations.id
  name: text("name").notNull(),
  description: text("description"),
  thumbnailPath: text("thumbnail_path"),
  metadata: text("metadata"), // JSON: extra data for import
  sharedAt: text("shared_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const importedAssets = pgTable("imported_assets", {
  id: serial("id").primaryKey(),
  sharedAssetId: integer("shared_asset_id").notNull().references(() => sharedAssets.id, { onDelete: "cascade" }),
  targetProjectId: integer("target_project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  targetEntityId: integer("target_entity_id").notNull(),
  assetType: text("asset_type").notNull(),
  isForked: boolean("is_forked").notNull().default(false),
  importedAt: text("imported_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Presentation Shares ──

export const presentationShares = pgTable("presentation_shares", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at"),
});

export const presentationSharesRelations = relations(presentationShares, ({ one }) => ({
  project: one(projects, { fields: [presentationShares.projectId], references: [projects.id] }),
}));

// ── Scene Notes (Production Notes) ──

export const sceneNotes = pgTable("scene_notes", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"),
  color: text("color").notNull().default("yellow"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const sceneNotesRelations = relations(sceneNotes, ({ one }) => ({
  scene: one(scenes, { fields: [sceneNotes.sceneId], references: [scenes.id] }),
  project: one(projects, { fields: [sceneNotes.projectId], references: [projects.id] }),
}));

export const videoEditorProjectsRelations = relations(videoEditorProjects, ({ one, many }) => ({
  project: one(projects, { fields: [videoEditorProjects.projectId], references: [projects.id] }),
  tracks: many(videoEditorTracks),
  clips: many(videoEditorClips),
}));

export const videoEditorTracksRelations = relations(videoEditorTracks, ({ one, many }) => ({
  editorProject: one(videoEditorProjects, { fields: [videoEditorTracks.editorProjectId], references: [videoEditorProjects.id] }),
  clips: many(videoEditorClips),
}));

export const videoEditorClipsRelations = relations(videoEditorClips, ({ one }) => ({
  track: one(videoEditorTracks, { fields: [videoEditorClips.trackId], references: [videoEditorTracks.id] }),
  editorProject: one(videoEditorProjects, { fields: [videoEditorClips.editorProjectId], references: [videoEditorProjects.id] }),
}));

// ── Visual Consistency Checks ──

export const consistencyChecks = pgTable("consistency_checks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // 'character' | 'location'
  entityName: text("entity_name").notNull(),
  imageAId: integer("image_a_id").notNull(),
  imageBId: integer("image_b_id").notNull(),
  imageAPath: text("image_a_path").notNull(),
  imageBPath: text("image_b_path").notNull(),
  result: text("result").notNull(), // 'consistent' | 'inconsistent' | 'uncertain'
  reason: text("reason"),
  checkedAt: text("checked_at").notNull().$defaultFn(() => new Date().toISOString()),
});
