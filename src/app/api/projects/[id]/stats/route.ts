import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { sql, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Wrapped entire handler in try/catch with ID validation
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  await ensureSchema();
  const { id } = await params;
  const projectId = Number(id);
  if (isNaN(projectId)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

  // Run all stat queries
  const [
    sceneStats,
    characterCount,
    dialogueCount,
    directionCount,
    imageGenStats,
    videoGenStats,
    voiceGenCount,
    driveFileStats,
    breakdownStats,
    versionCount,
    analysisCount,
    polishJobCount,
    moodboardCount,
    locationCount,
  ] = await Promise.all([
    // Scene breakdown by type
    db
      .select({
        total: sql<number>`COUNT(*)`,
        intCount: sql<number>`SUM(CASE WHEN heading_type = 'INT.' THEN 1 ELSE 0 END)`,
        extCount: sql<number>`SUM(CASE WHEN heading_type = 'EXT.' THEN 1 ELSE 0 END)`,
        intExtCount: sql<number>`SUM(CASE WHEN heading_type = 'INT./EXT.' THEN 1 ELSE 0 END)`,
        dayCount: sql<number>`SUM(CASE WHEN time_of_day ILIKE '%DAY%' THEN 1 ELSE 0 END)`,
        nightCount: sql<number>`SUM(CASE WHEN time_of_day ILIKE '%NIGHT%' THEN 1 ELSE 0 END)`,
      })
      .from(schema.scenes)
      .where(eq(schema.scenes.projectId, projectId))
      .then(rows => rows[0]),

    // Characters
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.characters)
      .where(eq(schema.characters.projectId, projectId))
      .then(rows => rows[0]),

    // Dialogues
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.dialogues)
      .where(
        sql`scene_id IN (SELECT id FROM scenes WHERE project_id = ${projectId})`
      )
      .then(rows => rows[0]),

    // Directions
    db
      .select({
        total: sql<number>`COUNT(*)`,
        actions: sql<number>`SUM(CASE WHEN type = 'action' THEN 1 ELSE 0 END)`,
        transitions: sql<number>`SUM(CASE WHEN type = 'transition' THEN 1 ELSE 0 END)`,
        brolls: sql<number>`SUM(CASE WHEN type = 'broll' THEN 1 ELSE 0 END)`,
        music: sql<number>`SUM(CASE WHEN type = 'music' THEN 1 ELSE 0 END)`,
        notes: sql<number>`SUM(CASE WHEN type = 'note' THEN 1 ELSE 0 END)`,
      })
      .from(schema.directions)
      .where(
        sql`scene_id IN (SELECT id FROM scenes WHERE project_id = ${projectId})`
      )
      .then(rows => rows[0]),

    // Image generations (with cost tracking)
    db
      .select({
        total: sql<number>`COUNT(*)`,
        completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        favorites: sql<number>`SUM(CASE WHEN is_favorite = true THEN 1 ELSE 0 END)`,
        totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
      })
      .from(schema.imageGenerations)
      .where(eq(schema.imageGenerations.projectId, projectId))
      .then(rows => rows[0]),

    // Video generations (with cost tracking)
    db
      .select({
        total: sql<number>`COUNT(*)`,
        completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        favorites: sql<number>`SUM(CASE WHEN is_favorite = true THEN 1 ELSE 0 END)`,
        totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
      })
      .from(schema.videoGenerations)
      .where(eq(schema.videoGenerations.projectId, projectId))
      .then(rows => rows[0]),

    // Voice generations (with cost tracking)
    db
      .select({
        count: sql<number>`COUNT(*)`,
        totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
      })
      .from(schema.voiceGenerations)
      .where(eq(schema.voiceGenerations.projectId, projectId))
      .then(rows => rows[0]),

    // Drive files by type
    db
      .select({
        total: sql<number>`COUNT(*)`,
        images: sql<number>`SUM(CASE WHEN file_type = 'image' THEN 1 ELSE 0 END)`,
        audio: sql<number>`SUM(CASE WHEN file_type = 'audio' THEN 1 ELSE 0 END)`,
        video: sql<number>`SUM(CASE WHEN file_type = 'video' THEN 1 ELSE 0 END)`,
        documents: sql<number>`SUM(CASE WHEN file_type = 'document' THEN 1 ELSE 0 END)`,
        totalSize: sql<number>`COALESCE(SUM(file_size), 0)`,
      })
      .from(schema.driveFiles)
      .where(eq(schema.driveFiles.projectId, projectId))
      .then(rows => rows[0]),

    // Breakdowns
    db
      .select({
        total: sql<number>`COUNT(*)`,
        completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
      })
      .from(schema.sceneBreakdowns)
      .where(eq(schema.sceneBreakdowns.projectId, projectId))
      .then(rows => rows[0]),

    // Versions
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.screenplayVersions)
      .where(eq(schema.screenplayVersions.projectId, projectId))
      .then(rows => rows[0]),

    // Script analyses
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.scriptAnalyses)
      .where(eq(schema.scriptAnalyses.projectId, projectId))
      .then(rows => rows[0]),

    // Dialogue polish jobs
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.dialoguePolishJobs)
      .where(eq(schema.dialoguePolishJobs.projectId, projectId))
      .then(rows => rows[0]),

    // Moodboards
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.moodboards)
      .where(eq(schema.moodboards.projectId, projectId))
      .then(rows => rows[0]),

    // Locations
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.locations)
      .where(eq(schema.locations.projectId, projectId))
      .then(rows => rows[0]),
  ]);

  // Word count from raw screenplay
  const [project] = await db
    .select({ rawText: schema.projects.rawText })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId));

  const wordCount = project?.rawText
    ? project.rawText.split(/\s+/).filter(Boolean).length
    : 0;

  // Estimated pages (industry standard: ~250 words per page for screenplays)
  const estimatedPages = Math.round(wordCount / 250);

  // Top characters by dialogue count
  const topCharacters = await db
    .select({
      name: schema.characters.name,
      dialogueCount: schema.characters.dialogueCount,
      hasVoice: sql<number>`CASE WHEN voice_id IS NOT NULL THEN 1 ELSE 0 END`,
    })
    .from(schema.characters)
    .where(eq(schema.characters.projectId, projectId))
    .orderBy(sql`dialogue_count DESC`)
    .limit(10);

  // Quick-action stats: characters without voice, without description, scenes without breakdowns, scenes without linked files
  const [charsNoVoice, charsNoDesc, scenesNoBreakdown, scenesNoFiles] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.characters)
      .where(sql`project_id = ${projectId} AND voice_id IS NULL`)
      .then(rows => rows[0]?.count || 0),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.characters)
      .where(sql`project_id = ${projectId} AND (description IS NULL OR description = '')`)
      .then(rows => rows[0]?.count || 0),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.scenes)
      .where(sql`project_id = ${projectId} AND id NOT IN (SELECT scene_id FROM scene_breakdowns WHERE project_id = ${projectId})`)
      .then(rows => rows[0]?.count || 0),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.scenes)
      .where(sql`project_id = ${projectId} AND id NOT IN (SELECT scene_id FROM scene_file_links)`)
      .then(rows => rows[0]?.count || 0),
  ]);

  return NextResponse.json({
    scenes: sceneStats || { total: 0, intCount: 0, extCount: 0, intExtCount: 0, dayCount: 0, nightCount: 0 },
    characters: characterCount?.count || 0,
    dialogues: dialogueCount?.count || 0,
    directions: directionCount || { total: 0, actions: 0, transitions: 0, brolls: 0, music: 0, notes: 0 },
    wordCount,
    estimatedPages,
    imageGenerations: imageGenStats || { total: 0, completed: 0, favorites: 0, totalCost: 0 },
    videoGenerations: videoGenStats || { total: 0, completed: 0, favorites: 0, totalCost: 0 },
    voiceGenerations: voiceGenCount?.count || 0,
    voiceCost: voiceGenCount?.totalCost || 0,
    totalAiCost: Number(((imageGenStats?.totalCost || 0) + (videoGenStats?.totalCost || 0) + (voiceGenCount?.totalCost || 0)).toFixed(2)),
    driveFiles: driveFileStats || { total: 0, images: 0, audio: 0, video: 0, documents: 0, totalSize: 0 },
    breakdowns: breakdownStats || { total: 0, completed: 0 },
    versions: versionCount?.count || 0,
    analyses: analysisCount?.count || 0,
    polishJobs: polishJobCount?.count || 0,
    moodboards: moodboardCount?.count || 0,
    locations: locationCount?.count || 0,
    topCharacters,
    quickActions: {
      charactersWithoutVoice: charsNoVoice,
      charactersWithoutDescription: charsNoDesc,
      scenesWithoutBreakdowns: scenesNoBreakdown,
      scenesWithoutFiles: scenesNoFiles,
    },
  });
  } catch (err) {
    logger.error("GET /api/projects/[id]/stats error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch project stats" }, { status: 500 });
  }
}
