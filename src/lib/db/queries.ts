import { db } from "./index";
import { ensureSchema } from "./index";
import { eq, asc, desc, sql, and, like, isNull } from "drizzle-orm";
import * as schema from "./schema";
import type { ParsedScreenplay, ParsedElement } from "../types";

// ── Projects ──

export async function getAllProjects() {
  await ensureSchema();
  return db
    .select({
      id: schema.projects.id,
      title: schema.projects.title,
      subtitle: schema.projects.subtitle,
      originalFilename: schema.projects.originalFilename,
      coverImage: schema.projects.coverImage,
      createdAt: schema.projects.createdAt,
      updatedAt: schema.projects.updatedAt,
      sceneCount: sql<number>`CAST((SELECT COUNT(*) FROM scenes WHERE project_id = ${schema.projects.id}) AS int)`,
      characterCount: sql<number>`CAST((SELECT COUNT(*) FROM characters WHERE project_id = ${schema.projects.id}) AS int)`,
      mediaCount: sql<number>`CAST((SELECT COUNT(*) FROM drive_files WHERE project_id = ${schema.projects.id}) AS int)`,
    })
    .from(schema.projects)
    .orderBy(desc(schema.projects.createdAt));
}

export async function getProject(id: number) {
  await ensureSchema();
  const rows = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  return rows[0];
}

export async function createProject(data: { title: string; subtitle?: string; rawText?: string; originalFilename?: string }) {
  await ensureSchema();
  const rows = await db
    .insert(schema.projects)
    .values({
      title: data.title,
      subtitle: data.subtitle ?? null,
      rawText: data.rawText ?? null,
      originalFilename: data.originalFilename ?? null,
    })
    .returning();
  return rows[0];
}

export async function deleteProject(id: number) {
  await ensureSchema();
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
}

export async function updateProject(id: number, data: { title?: string; subtitle?: string | null; productionStyle?: string | null }) {
  await ensureSchema();
  const rows = await db
    .update(schema.projects)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.projects.id, id))
    .returning();
  return rows[0];
}

// ── Scenes ──

export async function getScenesByProject(projectId: number) {
  await ensureSchema();
  return db
    .select()
    .from(schema.scenes)
    .where(eq(schema.scenes.projectId, projectId))
    .orderBy(asc(schema.scenes.sortOrder));
}

export async function getScenesWithElementsByProject(projectId: number) {
  await ensureSchema();

  // 3 queries instead of N+1: one for scenes, one for all dialogues, one for all directions
  const allScenes = await db
    .select()
    .from(schema.scenes)
    .where(eq(schema.scenes.projectId, projectId))
    .orderBy(asc(schema.scenes.sortOrder));

  if (allScenes.length === 0) return [];

  const sceneIds = allScenes.map((s) => s.id);

  const allDialogues = await db
    .select()
    .from(schema.dialogues)
    .where(sql`${schema.dialogues.sceneId} IN (${sql.join(sceneIds.map((id) => sql`${id}`), sql`, `)})`)
    .orderBy(asc(schema.dialogues.sortOrder));

  const allDirections = await db
    .select()
    .from(schema.directions)
    .where(sql`${schema.directions.sceneId} IN (${sql.join(sceneIds.map((id) => sql`${id}`), sql`, `)})`)
    .orderBy(asc(schema.directions.sortOrder));

  // Group dialogues and directions by sceneId
  const dialoguesByScene = new Map<number, typeof allDialogues>();
  for (const d of allDialogues) {
    const existing = dialoguesByScene.get(d.sceneId) ?? [];
    existing.push(d);
    dialoguesByScene.set(d.sceneId, existing);
  }

  const directionsByScene = new Map<number, typeof allDirections>();
  for (const d of allDirections) {
    const existing = directionsByScene.get(d.sceneId) ?? [];
    existing.push(d);
    directionsByScene.set(d.sceneId, existing);
  }

  return allScenes.map((scene) => ({
    ...scene,
    dialogues: dialoguesByScene.get(scene.id) ?? [],
    directions: directionsByScene.get(scene.id) ?? [],
  }));
}

export async function getScene(id: number) {
  await ensureSchema();
  const rows = await db.select().from(schema.scenes).where(eq(schema.scenes.id, id)).limit(1);
  return rows[0];
}

export async function getSceneWithElements(sceneId: number) {
  await ensureSchema();
  const sceneRows = await db.select().from(schema.scenes).where(eq(schema.scenes.id, sceneId)).limit(1);
  const scene = sceneRows[0];
  if (!scene) return null;

  const dialogues = await db
    .select()
    .from(schema.dialogues)
    .where(eq(schema.dialogues.sceneId, sceneId))
    .orderBy(asc(schema.dialogues.sortOrder));

  const directions = await db
    .select()
    .from(schema.directions)
    .where(eq(schema.directions.sceneId, sceneId))
    .orderBy(asc(schema.directions.sortOrder));

  // Get linked files via scene_file_links
  const linkedFiles = await db
    .select({
      id: schema.driveFiles.id,
      projectId: schema.driveFiles.projectId,
      folderId: schema.driveFiles.folderId,
      filename: schema.driveFiles.filename,
      storagePath: schema.driveFiles.storagePath,
      mimeType: schema.driveFiles.mimeType,
      fileSize: schema.driveFiles.fileSize,
      fileType: schema.driveFiles.fileType,
      caption: schema.driveFiles.caption,
      thumbnailPath: schema.driveFiles.thumbnailPath,
      generatedBy: schema.driveFiles.generatedBy,
      generationPrompt: schema.driveFiles.generationPrompt,
      sortOrder: schema.driveFiles.sortOrder,
      createdAt: schema.driveFiles.createdAt,
      updatedAt: schema.driveFiles.updatedAt,
      linkId: schema.sceneFileLinks.id,
    })
    .from(schema.sceneFileLinks)
    .innerJoin(schema.driveFiles, eq(schema.sceneFileLinks.fileId, schema.driveFiles.id))
    .where(eq(schema.sceneFileLinks.sceneId, sceneId))
    .orderBy(asc(schema.driveFiles.createdAt));

  return { ...scene, dialogues, directions, linkedFiles };
}

// ── Characters ──

export async function getCharactersByProject(projectId: number) {
  await ensureSchema();
  return db
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.projectId, projectId))
    .orderBy(desc(schema.characters.dialogueCount));
}

export async function createCharacter(data: { projectId: number; name: string; description?: string }) {
  await ensureSchema();
  const rows = await db.insert(schema.characters).values({
    projectId: data.projectId,
    name: data.name,
    description: data.description ?? null,
    dialogueCount: 0,
  }).returning();
  return rows[0];
}

export async function updateCharacterVoice(id: number, voiceId: string | null, voiceName: string | null) {
  await ensureSchema();
  await db.update(schema.characters).set({ voiceId, voiceName }).where(eq(schema.characters.id, id));
}

export async function deleteCharacter(id: number) {
  await ensureSchema();
  await db.delete(schema.characters).where(eq(schema.characters.id, id));
}

// ── Media (legacy, kept for backward compat) ──

export async function getMediaByProject(projectId: number) {
  await ensureSchema();
  return db
    .select()
    .from(schema.media)
    .where(eq(schema.media.projectId, projectId))
    .orderBy(desc(schema.media.createdAt));
}

export async function getMediaById(id: number) {
  await ensureSchema();
  const rows = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
  return rows[0];
}

export async function createMedia(data: {
  projectId: number;
  sceneId?: number;
  filename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  mediaType: string;
  caption?: string;
}) {
  await ensureSchema();
  const rows = await db
    .insert(schema.media)
    .values({
      projectId: data.projectId,
      sceneId: data.sceneId ?? null,
      filename: data.filename,
      storagePath: data.storagePath,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      mediaType: data.mediaType,
      caption: data.caption ?? null,
    })
    .returning();
  return rows[0];
}

export async function updateMedia(id: number, data: { sceneId?: number | null; caption?: string | null }) {
  await ensureSchema();
  await db.update(schema.media).set(data).where(eq(schema.media.id, id));
}

export async function deleteMedia(id: number) {
  await ensureSchema();
  await db.delete(schema.media).where(eq(schema.media.id, id));
}

// ── Settings ──

export async function getSetting(key: string) {
  await ensureSchema();
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
  return rows[0];
}

export async function getAllSettings() {
  await ensureSchema();
  return db.select().from(schema.settings);
}

export async function upsertSetting(key: string, value: string | null) {
  await ensureSchema();
  const now = new Date().toISOString();
  await db.execute(sql`INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, ${now})
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`);
}

// ── Prompt Snippets ──

export async function getSnippetsByProject(projectId: number | null) {
  await ensureSchema();
  if (projectId === null) {
    return db.select().from(schema.promptSnippets)
      .where(isNull(schema.promptSnippets.projectId))
      .orderBy(asc(schema.promptSnippets.name));
  }
  return db.select().from(schema.promptSnippets)
    .where(sql`${schema.promptSnippets.projectId} = ${projectId} OR ${schema.promptSnippets.projectId} IS NULL`)
    .orderBy(asc(schema.promptSnippets.name));
}

export async function createSnippet(data: { projectId?: number | null; name: string; content: string; shortcut?: string; tags?: string }) {
  await ensureSchema();
  const rows = await db.insert(schema.promptSnippets).values({
    projectId: data.projectId ?? null,
    name: data.name,
    content: data.content,
    shortcut: data.shortcut ?? null,
    tags: data.tags ?? null,
  }).returning();
  return rows[0];
}

export async function updateSnippet(id: number, data: { name?: string; content?: string; shortcut?: string; tags?: string | null }) {
  await ensureSchema();
  await db.update(schema.promptSnippets)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.promptSnippets.id, id));
}

export async function deleteSnippet(id: number) {
  await ensureSchema();
  await db.delete(schema.promptSnippets).where(eq(schema.promptSnippets.id, id));
}

// ── Drive: Folders ──

export async function getDriveFolders(projectId: number, parentId: number | null) {
  await ensureSchema();
  const condition = parentId === null
    ? and(eq(schema.driveFolders.projectId, projectId), isNull(schema.driveFolders.parentId))
    : and(eq(schema.driveFolders.projectId, projectId), eq(schema.driveFolders.parentId, parentId));

  return db.select().from(schema.driveFolders)
    .where(condition)
    .orderBy(asc(schema.driveFolders.sortOrder), asc(schema.driveFolders.name));
}

export async function getDriveFolder(id: number) {
  await ensureSchema();
  const rows = await db.select().from(schema.driveFolders).where(eq(schema.driveFolders.id, id)).limit(1);
  return rows[0];
}

export async function createDriveFolder(data: { projectId: number; parentId?: number | null; name: string; icon?: string }) {
  await ensureSchema();
  const rows = await db.insert(schema.driveFolders).values({
    projectId: data.projectId,
    parentId: data.parentId ?? null,
    name: data.name,
    icon: data.icon ?? "folder",
  }).returning();
  return rows[0];
}

export async function updateDriveFolder(id: number, data: { name?: string; icon?: string; parentId?: number | null; sortOrder?: number }) {
  await ensureSchema();
  await db.update(schema.driveFolders)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.driveFolders.id, id));
}

export async function deleteDriveFolder(id: number) {
  await ensureSchema();
  await db.delete(schema.driveFolders).where(eq(schema.driveFolders.id, id));
}

export async function getFolderBreadcrumbs(folderId: number): Promise<Array<{ id: number; name: string }>> {
  await ensureSchema();
  const crumbs: Array<{ id: number; name: string }> = [];
  const visited = new Set<number>();
  // TECH AUDIT FIX: Explicit undefined union to allow reassignment to undefined in loop
  let current: Awaited<ReturnType<typeof getDriveFolder>> | undefined = await getDriveFolder(folderId);
  while (current) {
    if (visited.has(current.id)) break; // prevent infinite loop on circular refs
    visited.add(current.id);
    crumbs.unshift({ id: current.id, name: current.name });
    current = current.parentId ? await getDriveFolder(current.parentId) : undefined;
  }
  return crumbs;
}

// ── Drive: Files ──

export async function getDriveFiles(projectId: number, folderId: number | null, search?: string, limit = 100, offset = 0) {
  await ensureSchema();
  let condition = folderId === null
    ? and(eq(schema.driveFiles.projectId, projectId), isNull(schema.driveFiles.folderId))
    : and(eq(schema.driveFiles.projectId, projectId), eq(schema.driveFiles.folderId, folderId));

  if (search) {
    // TECH AUDIT FIX: Escape LIKE special characters (%, _) to prevent LIKE injection
    const escapedSearch = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    // Search is project-wide (intentional) — ignores folder scope for global search
    condition = and(
      eq(schema.driveFiles.projectId, projectId),
      like(schema.driveFiles.filename, `%${escapedSearch}%`)
    )!;
  }

  return db.select().from(schema.driveFiles)
    .where(condition)
    .orderBy(asc(schema.driveFiles.sortOrder), desc(schema.driveFiles.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getDriveFile(id: number) {
  await ensureSchema();
  const rows = await db.select().from(schema.driveFiles).where(eq(schema.driveFiles.id, id)).limit(1);
  return rows[0];
}

export async function createDriveFile(data: {
  projectId: number;
  folderId?: number | null;
  filename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  fileType: string;
  caption?: string;
  generatedBy?: string;
  generationPrompt?: string;
  seed?: number | null;
}) {
  await ensureSchema();
  const rows = await db.insert(schema.driveFiles).values({
    projectId: data.projectId,
    folderId: data.folderId ?? null,
    filename: data.filename,
    storagePath: data.storagePath,
    mimeType: data.mimeType,
    fileSize: data.fileSize,
    fileType: data.fileType,
    caption: data.caption ?? null,
    generatedBy: data.generatedBy ?? null,
    generationPrompt: data.generationPrompt ?? null,
    seed: data.seed ?? null,
  }).returning();
  return rows[0];
}

export async function updateDriveFile(id: number, data: { filename?: string; folderId?: number | null; caption?: string; sortOrder?: number }) {
  await ensureSchema();
  await db.update(schema.driveFiles)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.driveFiles.id, id));
}

export async function deleteDriveFile(id: number) {
  await ensureSchema();
  await db.delete(schema.driveFiles).where(eq(schema.driveFiles.id, id));
}

// ── Drive: Tags ──

export async function getDriveTags(projectId: number) {
  await ensureSchema();
  return db.select().from(schema.driveTags)
    .where(eq(schema.driveTags.projectId, projectId))
    .orderBy(asc(schema.driveTags.name));
}

export async function createDriveTag(data: { projectId: number; name: string; color: string }) {
  await ensureSchema();
  const rows = await db.insert(schema.driveTags).values(data).returning();
  return rows[0];
}

export async function updateDriveTag(id: number, data: { name?: string; color?: string }) {
  await ensureSchema();
  await db.update(schema.driveTags).set(data).where(eq(schema.driveTags.id, id));
}

export async function deleteDriveTag(id: number) {
  await ensureSchema();
  await db.delete(schema.driveTags).where(eq(schema.driveTags.id, id));
}

// ── Drive: Tag Assignments ──

export async function assignTag(tagId: number, target: { fileId?: number; folderId?: number }) {
  await ensureSchema();
  if (!target.fileId && !target.folderId) {
    throw new Error("assignTag requires either fileId or folderId");
  }
  const rows = await db.insert(schema.driveTagAssignments).values({
    tagId,
    fileId: target.fileId ?? null,
    folderId: target.folderId ?? null,
  }).returning();
  return rows[0];
}

export async function unassignTag(tagId: number, target: { fileId?: number; folderId?: number }) {
  await ensureSchema();
  const conditions = [eq(schema.driveTagAssignments.tagId, tagId)];
  if (target.fileId) conditions.push(eq(schema.driveTagAssignments.fileId, target.fileId));
  if (target.folderId) conditions.push(eq(schema.driveTagAssignments.folderId, target.folderId));
  await db.delete(schema.driveTagAssignments).where(and(...conditions));
}

export async function getTagsForFile(fileId: number) {
  await ensureSchema();
  return db.select({ id: schema.driveTags.id, name: schema.driveTags.name, color: schema.driveTags.color, projectId: schema.driveTags.projectId })
    .from(schema.driveTagAssignments)
    .innerJoin(schema.driveTags, eq(schema.driveTagAssignments.tagId, schema.driveTags.id))
    .where(eq(schema.driveTagAssignments.fileId, fileId));
}

// TECH AUDIT FIX: Batch tag lookup to avoid N+1 queries in drive browse
export async function getTagsForFiles(fileIds: number[]): Promise<Map<number, Array<{ id: number; name: string; color: string; projectId: number }>>> {
  if (fileIds.length === 0) return new Map();
  await ensureSchema();
  const rows = await db.select({
    fileId: schema.driveTagAssignments.fileId,
    id: schema.driveTags.id,
    name: schema.driveTags.name,
    color: schema.driveTags.color,
    projectId: schema.driveTags.projectId,
  })
    .from(schema.driveTagAssignments)
    .innerJoin(schema.driveTags, eq(schema.driveTagAssignments.tagId, schema.driveTags.id))
    .where(sql`${schema.driveTagAssignments.fileId} IN (${sql.join(fileIds.map(id => sql`${id}`), sql`, `)})`);

  const result = new Map<number, Array<{ id: number; name: string; color: string; projectId: number }>>();
  for (const row of rows) {
    if (row.fileId == null) continue;
    const existing = result.get(row.fileId) ?? [];
    existing.push({ id: row.id, name: row.name, color: row.color, projectId: row.projectId });
    result.set(row.fileId, existing);
  }
  return result;
}

// ── Scene <-> File Links ──

export async function getSceneFileLinks(sceneId: number) {
  await ensureSchema();
  return db.select({
    id: schema.sceneFileLinks.id,
    sceneId: schema.sceneFileLinks.sceneId,
    fileId: schema.sceneFileLinks.fileId,
    reviewStatus: schema.sceneFileLinks.reviewStatus,
    file: schema.driveFiles,
  })
    .from(schema.sceneFileLinks)
    .innerJoin(schema.driveFiles, eq(schema.sceneFileLinks.fileId, schema.driveFiles.id))
    .where(eq(schema.sceneFileLinks.sceneId, sceneId));
}

export async function getSceneFileLinksForProject(projectId: number) {
  await ensureSchema();
  return db.select({
    id: schema.sceneFileLinks.id,
    sceneId: schema.sceneFileLinks.sceneId,
    fileId: schema.sceneFileLinks.fileId,
    reviewStatus: schema.sceneFileLinks.reviewStatus,
    file: schema.driveFiles,
  })
    .from(schema.sceneFileLinks)
    .innerJoin(schema.driveFiles, eq(schema.sceneFileLinks.fileId, schema.driveFiles.id))
    .innerJoin(schema.scenes, eq(schema.sceneFileLinks.sceneId, schema.scenes.id))
    .where(eq(schema.scenes.projectId, projectId));
}

export async function updateSceneFileLinkReviewStatus(linkId: number, status: string) {
  await ensureSchema();
  const rows = await db.update(schema.sceneFileLinks)
    .set({ reviewStatus: status })
    .where(eq(schema.sceneFileLinks.id, linkId))
    .returning();
  return rows[0];
}

export async function createSceneFileLink(sceneId: number, fileId: number) {
  await ensureSchema();
  const rows = await db.insert(schema.sceneFileLinks).values({ sceneId, fileId }).returning();
  return rows[0];
}

export async function deleteSceneFileLink(id: number) {
  await ensureSchema();
  await db.delete(schema.sceneFileLinks).where(eq(schema.sceneFileLinks.id, id));
}

// ── Character <-> File Links ──

export async function getCharacterFiles(characterId: number) {
  await ensureSchema();
  return db.select({
    linkId: schema.characterFileLinks.id,
    isPrimary: schema.characterFileLinks.isPrimary,
    file: schema.driveFiles,
  })
    .from(schema.characterFileLinks)
    .innerJoin(schema.driveFiles, eq(schema.characterFileLinks.fileId, schema.driveFiles.id))
    .where(eq(schema.characterFileLinks.characterId, characterId))
    .orderBy(desc(schema.characterFileLinks.isPrimary), asc(schema.driveFiles.createdAt));
}

export async function createCharacterFileLink(characterId: number, fileId: number, isPrimary = false) {
  await ensureSchema();
  const rows = await db.insert(schema.characterFileLinks).values({ characterId, fileId, isPrimary }).returning();
  return rows[0];
}

export async function deleteCharacterFileLink(id: number) {
  await ensureSchema();
  await db.delete(schema.characterFileLinks).where(eq(schema.characterFileLinks.id, id));
}

// ── Props ──

export async function getPropsByProject(projectId: number) {
  await ensureSchema();
  return db
    .select()
    .from(schema.props)
    .where(eq(schema.props.projectId, projectId))
    .orderBy(asc(schema.props.name));
}

export async function getProp(id: number) {
  await ensureSchema();
  const rows = await db.select().from(schema.props).where(eq(schema.props.id, id)).limit(1);
  return rows[0];
}

export async function createProp(data: { projectId: number; name: string; description?: string; tags?: string; aiGenerationNotes?: string }) {
  await ensureSchema();
  const rows = await db.insert(schema.props).values({
    projectId: data.projectId,
    name: data.name,
    description: data.description ?? null,
    tags: data.tags ?? null,
    aiGenerationNotes: data.aiGenerationNotes ?? null,
  }).returning();
  return rows[0];
}

export async function updateProp(id: number, data: { name?: string; description?: string | null; tags?: string | null; aiGenerationNotes?: string | null }) {
  await ensureSchema();
  const rows = await db.update(schema.props)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.props.id, id))
    .returning();
  return rows[0];
}

export async function deleteProp(id: number) {
  await ensureSchema();
  await db.delete(schema.props).where(eq(schema.props.id, id));
}

export async function getPropFiles(propId: number) {
  await ensureSchema();
  return db.select({
    linkId: schema.propFileLinks.id,
    isPrimary: schema.propFileLinks.isPrimary,
    file: schema.driveFiles,
  })
    .from(schema.propFileLinks)
    .innerJoin(schema.driveFiles, eq(schema.propFileLinks.fileId, schema.driveFiles.id))
    .where(eq(schema.propFileLinks.propId, propId))
    .orderBy(desc(schema.propFileLinks.isPrimary), asc(schema.driveFiles.createdAt));
}

export async function createPropFileLink(propId: number, fileId: number, isPrimary = false) {
  await ensureSchema();
  const rows = await db.insert(schema.propFileLinks).values({ propId, fileId, isPrimary }).returning();
  return rows[0];
}

export async function deletePropFileLink(id: number) {
  await ensureSchema();
  await db.delete(schema.propFileLinks).where(eq(schema.propFileLinks.id, id));
}

// ── Voice Generations ──

export async function getVoiceGenerations(dialogueId: number) {
  await ensureSchema();
  return db.select().from(schema.voiceGenerations)
    .where(eq(schema.voiceGenerations.dialogueId, dialogueId))
    .orderBy(desc(schema.voiceGenerations.createdAt));
}

export async function getVoiceGenerationsByScene(sceneId: number) {
  await ensureSchema();
  return db.select().from(schema.voiceGenerations)
    .where(eq(schema.voiceGenerations.sceneId, sceneId))
    .orderBy(asc(schema.voiceGenerations.dialogueId), asc(schema.voiceGenerations.optionIndex));
}

export async function getVoiceGeneration(id: number) {
  await ensureSchema();
  const rows = await db.select().from(schema.voiceGenerations).where(eq(schema.voiceGenerations.id, id)).limit(1);
  return rows[0];
}

export async function createVoiceGeneration(data: {
  dialogueId: number; projectId: number; sceneId: number;
  voiceId: string; modelId: string; inputText: string;
  optionIndex: number; storagePath: string;
  fileSize: number; durationMs?: number;
}) {
  await ensureSchema();
  const rows = await db.insert(schema.voiceGenerations).values({
    ...data,
    durationMs: data.durationMs ?? null,
  }).returning();
  return rows[0];
}

export async function selectVoiceGeneration(id: number, dialogueId: number) {
  await ensureSchema();
  await db.transaction(async (tx) => {
    // Unselect all for this dialogue first
    await tx.update(schema.voiceGenerations)
      .set({ selected: false })
      .where(eq(schema.voiceGenerations.dialogueId, dialogueId));
    // Select this one
    await tx.update(schema.voiceGenerations)
      .set({ selected: true })
      .where(eq(schema.voiceGenerations.id, id));
  });
}

export async function updateVoiceGeneration(id: number, data: {
  paddedStoragePath?: string; paddingStart?: number;
  paddingEnd?: number; paddedFileSize?: number;
}) {
  await ensureSchema();
  await db.update(schema.voiceGenerations).set(data).where(eq(schema.voiceGenerations.id, id));
}

export async function deleteVoiceGeneration(id: number) {
  await ensureSchema();
  await db.delete(schema.voiceGenerations).where(eq(schema.voiceGenerations.id, id));
}

// ── Image Generations ──

// TECH AUDIT FIX: Added LIMIT to prevent unbounded result sets
export async function getImageGenerations(projectId: number, filters?: { favoritesOnly?: boolean; batchId?: string }, limit = 50, offset = 0) {
  await ensureSchema();
  let condition = eq(schema.imageGenerations.projectId, projectId);

  if (filters?.favoritesOnly) {
    condition = and(condition, eq(schema.imageGenerations.isFavorite, true))!;
  }
  if (filters?.batchId) {
    condition = and(condition, eq(schema.imageGenerations.batchId, filters.batchId))!;
  }

  return db.select().from(schema.imageGenerations)
    .where(condition)
    .orderBy(desc(schema.imageGenerations.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getImageGeneration(id: number) {
  await ensureSchema();
  const rows = await db.select().from(schema.imageGenerations).where(eq(schema.imageGenerations.id, id)).limit(1);
  return rows[0];
}

export async function createImageGeneration(data: {
  projectId: number;
  prompt: string;
  model?: string;
  status?: string;
  params?: string;
  batchId?: string;
  batchLabel?: string;
  cost?: number;
}) {
  await ensureSchema();
  const rows = await db.insert(schema.imageGenerations).values({
    projectId: data.projectId,
    prompt: data.prompt,
    model: data.model ?? "nano-banana-pro",
    status: data.status ?? "queued",
    params: data.params ?? null,
    batchId: data.batchId ?? null,
    batchLabel: data.batchLabel ?? null,
    cost: data.cost ?? null,
  }).returning();
  return rows[0];
}

export async function updateImageGeneration(id: number, data: {
  status?: string;
  storagePath?: string;
  mimeType?: string;
  fileSize?: number;
  seed?: number;
  error?: string;
  isFavorite?: boolean;
  driveFileId?: number | null;
  tags?: string;
  cost?: number;
}) {
  await ensureSchema();
  await db.update(schema.imageGenerations).set(data).where(eq(schema.imageGenerations.id, id));
}

/** Get distinct prompts used for a project, ordered by most recent usage */
export async function getPromptHistory(projectId: number) {
  await ensureSchema();
  return db
    .select({
      prompt: schema.imageGenerations.prompt,
      model: schema.imageGenerations.model,
      count: sql<number>`COUNT(*)`,
      lastUsed: sql<string>`MAX(${schema.imageGenerations.createdAt})`,
      favoriteCount: sql<number>`SUM(CASE WHEN ${schema.imageGenerations.isFavorite} = true THEN 1 ELSE 0 END)`,
    })
    .from(schema.imageGenerations)
    .where(eq(schema.imageGenerations.projectId, projectId))
    .groupBy(schema.imageGenerations.prompt, schema.imageGenerations.model)
    .orderBy(sql`MAX(${schema.imageGenerations.createdAt}) DESC`);
}

export async function deleteImageGeneration(id: number) {
  await ensureSchema();
  await db.delete(schema.imageGenerations).where(eq(schema.imageGenerations.id, id));
}

// ── Scene Element Replacement (for AI Modification) ──

export async function replaceSceneElements(sceneId: number, elements: ParsedElement[], synopsis?: string) {
  await ensureSchema();
  await db.transaction(async (tx) => {
    // Delete existing dialogues and directions
    await tx.delete(schema.dialogues).where(eq(schema.dialogues.sceneId, sceneId));
    await tx.delete(schema.directions).where(eq(schema.directions.sceneId, sceneId));

    // Update synopsis if provided
    if (synopsis !== undefined) {
      await tx.update(schema.scenes)
        .set({ synopsis })
        .where(eq(schema.scenes.id, sceneId));
    }

    // Insert new elements
    for (const el of elements) {
      if (el.type === "dialogue") {
        await tx.insert(schema.dialogues)
          .values({
            sceneId,
            character: el.character || "UNKNOWN",
            parenthetical: el.parenthetical || null,
            line: el.line || "",
            sortOrder: el.sortOrder,
          });
      } else {
        await tx.insert(schema.directions)
          .values({
            sceneId,
            type: el.type,
            content: el.content || "",
            sortOrder: el.sortOrder,
          });
      }
    }
  });
}

// ── Bulk insert from parsed screenplay ──

export async function saveParseResults(projectId: number, parsed: ParsedScreenplay) {
  await ensureSchema();
  await db.transaction(async (tx) => {
    // Update project title/subtitle
    await tx.update(schema.projects)
      .set({
        title: parsed.title || "Untitled",
        subtitle: parsed.subtitle || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.projects.id, projectId));

    // Clear existing parsed data
    const existingScenes = await tx
      .select({ id: schema.scenes.id })
      .from(schema.scenes)
      .where(eq(schema.scenes.projectId, projectId));

    for (const s of existingScenes) {
      await tx.delete(schema.dialogues).where(eq(schema.dialogues.sceneId, s.id));
      await tx.delete(schema.directions).where(eq(schema.directions.sceneId, s.id));
    }
    await tx.delete(schema.scenes).where(eq(schema.scenes.projectId, projectId));
    await tx.delete(schema.characters).where(eq(schema.characters.projectId, projectId));

    // Insert scenes + elements
    for (let i = 0; i < parsed.scenes.length; i++) {
      const ps = parsed.scenes[i];
      const sceneRows = await tx
        .insert(schema.scenes)
        .values({
          projectId,
          sceneNumber: ps.sceneNumber,
          heading: ps.heading,
          headingType: ps.headingType || null,
          location: ps.location || null,
          timeOfDay: ps.timeOfDay || null,
          section: ps.section || null,
          synopsis: ps.synopsis || null,
          rawContent: null,
          sortOrder: i,
        })
        .returning();
      const scene = sceneRows[0];

      for (const el of ps.elements) {
        if (el.type === "dialogue") {
          await tx.insert(schema.dialogues)
            .values({
              sceneId: scene.id,
              character: el.character || "UNKNOWN",
              parenthetical: el.parenthetical || null,
              line: el.line || "",
              sortOrder: el.sortOrder,
            });
        } else {
          await tx.insert(schema.directions)
            .values({
              sceneId: scene.id,
              type: el.type,
              content: el.content || "",
              sortOrder: el.sortOrder,
            });
        }
      }
    }

    // Insert characters with dialogue counts
    const dialogueCounts: Record<string, number> = {};
    for (const s of parsed.scenes) {
      for (const el of s.elements) {
        if (el.type === "dialogue" && el.character) {
          const name = el.character.toUpperCase();
          dialogueCounts[name] = (dialogueCounts[name] || 0) + 1;
        }
      }
    }

    for (const char of parsed.characters) {
      await tx.insert(schema.characters)
        .values({
          projectId,
          name: char.name,
          description: char.description || null,
          dialogueCount: dialogueCounts[char.name.toUpperCase()] || 0,
        });
    }
  });
}

// ── Video Generations ──

// TECH AUDIT FIX: Added LIMIT to prevent unbounded result sets
export async function getVideoGenerations(projectId: number, filters?: { favoritesOnly?: boolean }, limit = 200) {
  await ensureSchema();
  let condition = eq(schema.videoGenerations.projectId, projectId);

  if (filters?.favoritesOnly) {
    condition = and(condition, eq(schema.videoGenerations.isFavorite, true))!;
  }

  return db.select().from(schema.videoGenerations)
    .where(condition)
    .orderBy(desc(schema.videoGenerations.createdAt))
    .limit(limit);
}

export async function getVideoGeneration(id: number) {
  await ensureSchema();
  const rows = await db.select().from(schema.videoGenerations).where(eq(schema.videoGenerations.id, id)).limit(1);
  return rows[0];
}

export async function createVideoGeneration(data: {
  projectId: number;
  prompt: string;
  model: string;
  mode?: string;
  status?: string;
  params?: string;
  sourceImagePath?: string;
  sourceVideoPath?: string;
  sourceAudioPath?: string;
  batchId?: string;
}) {
  await ensureSchema();
  const rows = await db.insert(schema.videoGenerations).values({
    projectId: data.projectId,
    prompt: data.prompt,
    model: data.model,
    mode: data.mode ?? "text-to-video",
    status: data.status ?? "queued",
    params: data.params ?? null,
    sourceImagePath: data.sourceImagePath ?? null,
    sourceVideoPath: data.sourceVideoPath ?? null,
    sourceAudioPath: data.sourceAudioPath ?? null,
    batchId: data.batchId ?? null,
  }).returning();
  return rows[0];
}

export async function updateVideoGeneration(id: number, data: {
  status?: string;
  falRequestId?: string | null;
  storagePath?: string;
  mimeType?: string;
  fileSize?: number;
  durationMs?: number;
  seed?: number;
  error?: string;
  isFavorite?: boolean;
  driveFileId?: number | null;
  tags?: string;
  params?: string;
}) {
  await ensureSchema();
  await db.update(schema.videoGenerations).set(data).where(eq(schema.videoGenerations.id, id));
}

export async function deleteVideoGeneration(id: number) {
  await ensureSchema();
  await db.delete(schema.videoGenerations).where(eq(schema.videoGenerations.id, id));
}

// ── Video Editor ──

export async function getVideoEditorProjects(projectId: number) {
  await ensureSchema();
  return db.select().from(schema.videoEditorProjects)
    .where(eq(schema.videoEditorProjects.projectId, projectId))
    .orderBy(desc(schema.videoEditorProjects.createdAt));
}

export async function getVideoEditorProject(id: number) {
  await ensureSchema();
  const rows = await db.select().from(schema.videoEditorProjects)
    .where(eq(schema.videoEditorProjects.id, id)).limit(1);
  return rows[0];
}

export async function createVideoEditorProject(data: {
  projectId: number;
  title: string;
  description?: string;
  width?: number;
  height?: number;
  fps?: number;
}) {
  await ensureSchema();
  const projRows = await db.insert(schema.videoEditorProjects).values({
    projectId: data.projectId,
    title: data.title,
    description: data.description ?? null,
    width: data.width ?? 1920,
    height: data.height ?? 1080,
    fps: data.fps ?? 30,
  }).returning();
  const proj = projRows[0];

  // Create default tracks
  await db.insert(schema.videoEditorTracks).values([
    { editorProjectId: proj.id, type: "video", name: "Video 1", sortOrder: 0 },
    { editorProjectId: proj.id, type: "audio", name: "Audio 1", sortOrder: 1 },
  ]);

  return proj;
}

export async function updateVideoEditorProject(id: number, data: {
  title?: string;
  description?: string;
  width?: number;
  height?: number;
  fps?: number;
  durationMs?: number;
  status?: string;
  renderProgress?: number;
  renderError?: string | null;
  outputPath?: string | null;
  outputSize?: number | null;
}) {
  await ensureSchema();
  await db.update(schema.videoEditorProjects)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.videoEditorProjects.id, id));
}

export async function deleteVideoEditorProject(id: number) {
  await ensureSchema();
  await db.delete(schema.videoEditorProjects).where(eq(schema.videoEditorProjects.id, id));
}

// Tracks
export async function getVideoEditorTracks(editorProjectId: number) {
  await ensureSchema();
  return db.select().from(schema.videoEditorTracks)
    .where(eq(schema.videoEditorTracks.editorProjectId, editorProjectId))
    .orderBy(asc(schema.videoEditorTracks.sortOrder));
}

export async function createVideoEditorTrack(data: {
  editorProjectId: number;
  type: string;
  name: string;
  sortOrder?: number;
}) {
  await ensureSchema();
  const rows = await db.insert(schema.videoEditorTracks).values({
    editorProjectId: data.editorProjectId,
    type: data.type,
    name: data.name,
    sortOrder: data.sortOrder ?? 0,
  }).returning();
  return rows[0];
}

export async function updateVideoEditorTrack(id: number, data: {
  name?: string;
  muted?: boolean;
  locked?: boolean;
  volume?: number;
  sortOrder?: number;
}) {
  await ensureSchema();
  await db.update(schema.videoEditorTracks).set(data)
    .where(eq(schema.videoEditorTracks.id, id));
}

export async function deleteVideoEditorTrack(id: number) {
  await ensureSchema();
  await db.delete(schema.videoEditorTracks).where(eq(schema.videoEditorTracks.id, id));
}

// Clips
export async function getVideoEditorClips(editorProjectId: number) {
  await ensureSchema();
  return db.select().from(schema.videoEditorClips)
    .where(eq(schema.videoEditorClips.editorProjectId, editorProjectId))
    .orderBy(asc(schema.videoEditorClips.startMs));
}

export async function getClipsByTrack(trackId: number) {
  await ensureSchema();
  return db.select().from(schema.videoEditorClips)
    .where(eq(schema.videoEditorClips.trackId, trackId))
    .orderBy(asc(schema.videoEditorClips.startMs));
}

export async function createVideoEditorClip(data: {
  trackId: number;
  editorProjectId: number;
  type: string;
  name?: string;
  startMs: number;
  durationMs: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  sourcePath?: string;
  sourceType?: string;
  sourceId?: number;
  volume?: number;
  opacity?: number;
  playbackRate?: number;
  textContent?: string;
  textStyle?: string;
  filters?: string;
  transition?: string;
  thumbnailPath?: string;
  waveformData?: string;
}) {
  await ensureSchema();
  const rows = await db.insert(schema.videoEditorClips).values({
    trackId: data.trackId,
    editorProjectId: data.editorProjectId,
    type: data.type,
    name: data.name ?? null,
    startMs: data.startMs,
    durationMs: data.durationMs,
    sourceStartMs: data.sourceStartMs ?? 0,
    sourceEndMs: data.sourceEndMs ?? null,
    sourcePath: data.sourcePath ?? null,
    sourceType: data.sourceType ?? null,
    sourceId: data.sourceId ?? null,
    volume: data.volume ?? 1.0,
    opacity: data.opacity ?? 1.0,
    playbackRate: data.playbackRate ?? 1.0,
    textContent: data.textContent ?? null,
    textStyle: data.textStyle ?? null,
    filters: data.filters ?? null,
    transition: data.transition ?? null,
    thumbnailPath: data.thumbnailPath ?? null,
    waveformData: data.waveformData ?? null,
  }).returning();
  return rows[0];
}

export async function updateVideoEditorClip(id: number, data: {
  trackId?: number;
  name?: string;
  startMs?: number;
  durationMs?: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  volume?: number;
  opacity?: number;
  playbackRate?: number;
  textContent?: string;
  textStyle?: string;
  filters?: string;
  transition?: string;
  sortOrder?: number;
}) {
  await ensureSchema();
  await db.update(schema.videoEditorClips).set(data)
    .where(eq(schema.videoEditorClips.id, id));
}

export async function deleteVideoEditorClip(id: number) {
  await ensureSchema();
  await db.delete(schema.videoEditorClips).where(eq(schema.videoEditorClips.id, id));
}

// ── Shared Assets ──

export async function shareAsset(data: {
  assetType: string;
  sourceProjectId: number;
  sourceEntityId: number;
  name: string;
  description?: string;
  thumbnailPath?: string;
  metadata?: string;
}) {
  await ensureSchema();
  const rows = await db.insert(schema.sharedAssets).values({
    assetType: data.assetType,
    sourceProjectId: data.sourceProjectId,
    sourceEntityId: data.sourceEntityId,
    name: data.name,
    description: data.description ?? null,
    thumbnailPath: data.thumbnailPath ?? null,
    metadata: data.metadata ?? null,
  }).returning();
  return rows[0];
}

export async function unshareAsset(assetType: string, sourceEntityId: number) {
  await ensureSchema();
  await db.delete(schema.sharedAssets).where(
    and(
      eq(schema.sharedAssets.assetType, assetType),
      eq(schema.sharedAssets.sourceEntityId, sourceEntityId),
    ),
  );
}

export async function getSharedAsset(assetType: string, sourceEntityId: number) {
  await ensureSchema();
  const rows = await db.select().from(schema.sharedAssets).where(
    and(
      eq(schema.sharedAssets.assetType, assetType),
      eq(schema.sharedAssets.sourceEntityId, sourceEntityId),
    ),
  ).limit(1);
  return rows[0] ?? null;
}

export async function getAllSharedAssets(assetType?: string) {
  await ensureSchema();
  if (assetType) {
    return db.select().from(schema.sharedAssets)
      .where(eq(schema.sharedAssets.assetType, assetType))
      .orderBy(desc(schema.sharedAssets.sharedAt));
  }
  return db.select().from(schema.sharedAssets)
    .orderBy(desc(schema.sharedAssets.sharedAt));
}

export async function createImportedAsset(data: {
  sharedAssetId: number;
  targetProjectId: number;
  targetEntityId: number;
  assetType: string;
  isForked?: boolean;
}) {
  await ensureSchema();
  const rows = await db.insert(schema.importedAssets).values({
    sharedAssetId: data.sharedAssetId,
    targetProjectId: data.targetProjectId,
    targetEntityId: data.targetEntityId,
    assetType: data.assetType,
    isForked: data.isForked ?? false,
  }).returning();
  return rows[0];
}

export async function getImportsByProject(targetProjectId: number) {
  await ensureSchema();
  return db.select().from(schema.importedAssets)
    .where(eq(schema.importedAssets.targetProjectId, targetProjectId));
}

// ── Presentation Shares ──

export async function createPresentationShare(projectId: number, token: string, expiresAt?: string) {
  await ensureSchema();
  const rows = await db.insert(schema.presentationShares).values({
    projectId,
    token,
    expiresAt: expiresAt ?? null,
  }).returning();
  return rows[0];
}

export async function getPresentationShareByToken(token: string) {
  await ensureSchema();
  const rows = await db.select({
    id: schema.presentationShares.id,
    projectId: schema.presentationShares.projectId,
    token: schema.presentationShares.token,
    createdAt: schema.presentationShares.createdAt,
    expiresAt: schema.presentationShares.expiresAt,
    projectTitle: schema.projects.title,
    projectSubtitle: schema.projects.subtitle,
  })
    .from(schema.presentationShares)
    .innerJoin(schema.projects, eq(schema.presentationShares.projectId, schema.projects.id))
    .where(eq(schema.presentationShares.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPresentationSharesByProject(projectId: number) {
  await ensureSchema();
  return db.select().from(schema.presentationShares)
    .where(eq(schema.presentationShares.projectId, projectId))
    .orderBy(desc(schema.presentationShares.createdAt));
}

export async function deletePresentationShare(id: number) {
  await ensureSchema();
  await db.delete(schema.presentationShares).where(eq(schema.presentationShares.id, id));
}

// ── Character Bible ──

export async function getCharacterDialoguesAcrossProjects(characterName: string) {
  await ensureSchema();
  return db.select({
    id: schema.dialogues.id,
    sceneId: schema.dialogues.sceneId,
    character: schema.dialogues.character,
    parenthetical: schema.dialogues.parenthetical,
    line: schema.dialogues.line,
    sortOrder: schema.dialogues.sortOrder,
    sceneNumber: schema.scenes.sceneNumber,
    sceneHeading: schema.scenes.heading,
    projectId: schema.scenes.projectId,
    projectTitle: schema.projects.title,
  })
    .from(schema.dialogues)
    .innerJoin(schema.scenes, eq(schema.dialogues.sceneId, schema.scenes.id))
    .innerJoin(schema.projects, eq(schema.scenes.projectId, schema.projects.id))
    .where(eq(schema.dialogues.character, characterName))
    .orderBy(asc(schema.projects.title), asc(schema.scenes.sceneNumber), asc(schema.dialogues.sortOrder));
}

export async function getCharacterGenerationHistory(characterId: number) {
  await ensureSchema();
  return db.select({
    linkId: schema.characterFileLinks.id,
    isPrimary: schema.characterFileLinks.isPrimary,
    fileId: schema.driveFiles.id,
    filename: schema.driveFiles.filename,
    storagePath: schema.driveFiles.storagePath,
    mimeType: schema.driveFiles.mimeType,
    fileType: schema.driveFiles.fileType,
    generatedBy: schema.driveFiles.generatedBy,
    generationPrompt: schema.driveFiles.generationPrompt,
    seed: schema.driveFiles.seed,
    createdAt: schema.driveFiles.createdAt,
  })
    .from(schema.characterFileLinks)
    .innerJoin(schema.driveFiles, eq(schema.characterFileLinks.fileId, schema.driveFiles.id))
    .where(eq(schema.characterFileLinks.characterId, characterId))
    .orderBy(desc(schema.characterFileLinks.isPrimary), asc(schema.driveFiles.createdAt));
}

export async function getFullVideoEditorProject(editorProjectId: number) {
  await ensureSchema();
  const projectRows = await db.select().from(schema.videoEditorProjects)
    .where(eq(schema.videoEditorProjects.id, editorProjectId)).limit(1);
  const project = projectRows[0];
  if (!project) return null;

  const tracks = await db.select().from(schema.videoEditorTracks)
    .where(eq(schema.videoEditorTracks.editorProjectId, editorProjectId))
    .orderBy(asc(schema.videoEditorTracks.sortOrder));

  const clips = await db.select().from(schema.videoEditorClips)
    .where(eq(schema.videoEditorClips.editorProjectId, editorProjectId))
    .orderBy(asc(schema.videoEditorClips.startMs));

  return {
    ...project,
    tracks: tracks.map(t => ({
      ...t,
      clips: clips.filter(c => c.trackId === t.id),
    })),
  };
}
