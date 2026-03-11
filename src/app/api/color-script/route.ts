import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { sceneColorData, scenes } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** GET /api/color-script?projectId=X — Get all scene color data for a project */
// TECH AUDIT FIX: Added try/catch and NaN validation
export async function GET(req: Request) {
  try {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const pid = Number(searchParams.get("projectId"));

  if (!pid || isNaN(pid)) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  // Get all scenes for the project
  const projectScenes = await db
    .select()
    .from(scenes)
    .where(eq(scenes.projectId, pid))
    .orderBy(asc(scenes.sortOrder));

  // Get all color data for the project
  const colorData = await db
    .select()
    .from(sceneColorData)
    .where(eq(sceneColorData.projectId, pid));

  // Build a map of sceneId -> color data
  const colorMap = new Map(colorData.map((cd) => [cd.sceneId, cd]));

  // Combine scenes with their color data
  const result = projectScenes.map((scene) => {
    const cd = colorMap.get(scene.id);
    return {
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      heading: scene.heading,
      timeOfDay: scene.timeOfDay,
      colorData: cd
        ? {
            id: cd.id,
            dominantColors: JSON.parse(cd.dominantColors) as Array<{
              hex: string;
              percentage: number;
              name: string;
            }>,
            averageColor: cd.averageColor,
            brightness: cd.brightness,
            saturation: cd.saturation,
            warmth: cd.warmth,
            moodTag: cd.moodTag,
            sourceImageId: cd.sourceImageId,
            sourceImagePath: cd.sourceImagePath,
            createdAt: cd.createdAt,
            updatedAt: cd.updatedAt,
          }
        : null,
    };
  });

  return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error("GET /api/color-script error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch color script";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
