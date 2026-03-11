import { NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and NaN validation to GET
export async function GET(req: Request) {
  try {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const numId = Number(projectId);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });

  // Use raw SQL to avoid Drizzle generating unqualified "id" in subqueries
  const { rows } = await pool.query<{
    id: number;
    project_id: number;
    name: string;
    description: string | null;
    visual_prompt: string | null;
    time_period: string | null;
    style_notes: string | null;
    reference_images: string | null;
    moodboard_id: number | null;
    scene_count: number;
    created_at: string;
    updated_at: string;
    linked_scene_count: number;
    int_ext: string | null;
    times_of_day_raw: string | null;
    cover_image: string | null;
  }>(`
    SELECT
      l.id,
      l.project_id,
      l.name,
      l.description,
      l.visual_prompt,
      l.time_period,
      l.style_notes,
      l.reference_images,
      l.moodboard_id,
      l.scene_count,
      l.created_at,
      l.updated_at,
      (SELECT COUNT(*)::int FROM scene_locations WHERE location_id = l.id) AS linked_scene_count,
      (
        SELECT CASE
          WHEN COUNT(DISTINCT s.heading_type) > 1 THEN 'INT/EXT'
          ELSE MAX(REPLACE(s.heading_type, '.', ''))
        END
        FROM scene_locations sl
        JOIN scenes s ON s.id = sl.scene_id
        WHERE sl.location_id = l.id
      ) AS int_ext,
      (
        SELECT STRING_AGG(DISTINCT s.time_of_day, '||')
        FROM scene_locations sl
        JOIN scenes s ON s.id = sl.scene_id
        WHERE sl.location_id = l.id AND s.time_of_day IS NOT NULL AND s.time_of_day != ''
      ) AS times_of_day_raw,
      (
        SELECT lc.storage_path FROM location_concepts lc
        WHERE lc.location_id = l.id AND lc.is_primary = 1
        LIMIT 1
      ) AS cover_image
    FROM locations l
    WHERE l.project_id = $1
    ORDER BY l.scene_count DESC
  `, [numId]);

  // Transform snake_case to camelCase and split timesOfDay
  const enriched = rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    visualPrompt: row.visual_prompt,
    timePeriod: row.time_period,
    styleNotes: row.style_notes,
    referenceImages: row.reference_images,
    moodboardId: row.moodboard_id,
    sceneCount: row.scene_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    linkedSceneCount: row.linked_scene_count,
    intExt: row.int_ext,
    timesOfDay: row.times_of_day_raw ? row.times_of_day_raw.split("||").filter(Boolean) : [],
    coverImage: row.cover_image,
  }));

  logger.info("GET /api/locations", { projectId: numId, count: enriched.length });

  return NextResponse.json(enriched);
  } catch (error: unknown) {
    logger.error("GET /api/locations error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const message = error instanceof Error ? error.message : "Failed to fetch locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
