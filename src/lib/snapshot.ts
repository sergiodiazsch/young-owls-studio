import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db";
import { eq, asc, desc, sql } from "drizzle-orm";
import {
  projects,
  scenes,
  dialogues,
  directions,
  characters,
  screenplayVersions,
  screenplayBranches,
} from "@/lib/db/schema";
import type { ScreenplaySnapshot } from "@/lib/types";

// ── Debounce state (module-level) ──

const DEBOUNCE_MS = 60_000;
const MAX_TRACKED_PROJECTS = 100;
const lastSnapshotAt = new Map<number, number>();

// ── Create snapshot ──

export async function createSnapshot(
  projectId: number,
  triggerType: string,
  triggerDetail: string,
): Promise<number> {
  await ensureSchema();

  // Fetch the project
  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const project = projectRows[0];

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Fetch all scenes
  const allScenes = await db
    .select()
    .from(scenes)
    .where(eq(scenes.projectId, projectId))
    .orderBy(asc(scenes.sortOrder));

  const sceneIds = allScenes.map((s) => s.id);

  // Batch-fetch dialogues and directions for all scenes using drizzle
  const allDialogueRows = sceneIds.length > 0
    ? await db.select().from(dialogues)
        .where(sql`${dialogues.sceneId} IN (${sql.join(sceneIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(asc(dialogues.sortOrder))
    : [];

  const allDirectionRows = sceneIds.length > 0
    ? await db.select().from(directions)
        .where(sql`${directions.sceneId} IN (${sql.join(sceneIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(asc(directions.sortOrder))
    : [];

  // Group by scene_id
  const dialoguesByScene = new Map<number, typeof allDialogueRows>();
  for (const d of allDialogueRows) {
    if (!dialoguesByScene.has(d.sceneId)) dialoguesByScene.set(d.sceneId, []);
    dialoguesByScene.get(d.sceneId)!.push(d);
  }

  const directionsByScene = new Map<number, typeof allDirectionRows>();
  for (const d of allDirectionRows) {
    if (!directionsByScene.has(d.sceneId)) directionsByScene.set(d.sceneId, []);
    directionsByScene.get(d.sceneId)!.push(d);
  }

  // Fetch all characters
  const allCharacters = await db
    .select()
    .from(characters)
    .where(eq(characters.projectId, projectId))
    .orderBy(desc(characters.dialogueCount));

  // Build the snapshot
  let wordCount = 0;
  let dialogueCount = 0;
  let directionCount = 0;

  const snapshotScenes = allScenes.map((s) => {
    const sceneDialogues = (dialoguesByScene.get(s.id) || []).map((d) => {
      wordCount += countWords(d.line);
      if (d.parenthetical) wordCount += countWords(d.parenthetical);
      dialogueCount++;
      return {
        id: d.id,
        character: d.character,
        parenthetical: d.parenthetical,
        line: d.line,
        sortOrder: d.sortOrder,
      };
    });

    const sceneDirections = (directionsByScene.get(s.id) || []).map((d) => {
      wordCount += countWords(d.content);
      directionCount++;
      return {
        id: d.id,
        type: d.type,
        content: d.content,
        sortOrder: d.sortOrder,
      };
    });

    // Count words in headings and synopses too
    wordCount += countWords(s.heading);
    if (s.synopsis) wordCount += countWords(s.synopsis);

    return {
      id: s.id,
      sceneNumber: s.sceneNumber,
      heading: s.heading,
      headingType: s.headingType || "",
      location: s.location || "",
      timeOfDay: s.timeOfDay || "",
      section: s.section || "",
      synopsis: s.synopsis || "",
      rawContent: s.rawContent || "",
      sortOrder: s.sortOrder,
      dialogues: sceneDialogues,
      directions: sceneDirections,
    };
  });

  const snapshot: ScreenplaySnapshot = {
    scenes: snapshotScenes,
    characters: allCharacters.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || "",
    })),
    metadata: {
      projectId,
      projectTitle: project.title,
      snapshotTimestamp: new Date().toISOString(),
      wordCount,
      sceneCount: allScenes.length,
      dialogueCount,
      directionCount,
      characterCount: allCharacters.length,
    },
  };

  const stats = {
    wordCount,
    sceneCount: allScenes.length,
    dialogueCount,
    directionCount,
    characterCount: allCharacters.length,
  };

  // Determine next version_number for this project on the active branch
  const activeBranchRows = await db
    .select()
    .from(screenplayBranches)
    .where(
      sql`${screenplayBranches.projectId} = ${projectId} AND ${screenplayBranches.isActive} = 1`,
    )
    .limit(1);
  const activeBranch = activeBranchRows[0];

  const branchId = activeBranch?.id ?? null;

  const maxVersionResult = await db.execute(
    branchId !== null
      ? sql`SELECT COALESCE(MAX(version_number), 0) AS max_v
           FROM screenplay_versions
           WHERE project_id = ${projectId} AND branch_id = ${branchId}`
      : sql`SELECT COALESCE(MAX(version_number), 0) AS max_v
           FROM screenplay_versions
           WHERE project_id = ${projectId} AND branch_id IS NULL`,
  );

  const maxVersionRow = (maxVersionResult.rows as Array<Record<string, unknown>>)[0];
  const versionNumber = (Number(maxVersionRow.max_v) || 0) + 1;

  // Insert the version record
  const insertedRows = await db
    .insert(screenplayVersions)
    .values({
      projectId,
      branchId,
      versionNumber,
      label: null,
      triggerType,
      triggerDetail,
      snapshot: JSON.stringify(snapshot),
      stats: JSON.stringify(stats),
    })
    .returning();
  const inserted = insertedRows[0];

  // Update debounce tracker (evict oldest if map grows too large)
  lastSnapshotAt.set(projectId, Date.now());
  if (lastSnapshotAt.size > MAX_TRACKED_PROJECTS) {
    const firstKey = lastSnapshotAt.keys().next().value;
    if (firstKey !== undefined) lastSnapshotAt.delete(firstKey);
  }

  return inserted.id;
}

// ── Maybe create snapshot (debounced) ──

export async function maybeCreateSnapshot(
  projectId: number,
  triggerType: string,
  triggerDetail: string,
): Promise<number | null> {
  const lastTime = lastSnapshotAt.get(projectId);
  if (lastTime && Date.now() - lastTime < DEBOUNCE_MS) {
    return null;
  }

  return createSnapshot(projectId, triggerType, triggerDetail);
}

// ── Helpers ──

function countWords(text: string): number {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}
