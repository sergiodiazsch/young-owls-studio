import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { sceneLocations, scenes } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and ID validation to GET
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  await ensureSchema();
  const { id } = await params;
  const locationId = Number(id);
  if (isNaN(locationId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const linkedScenes = await db
    .select({
      id: scenes.id,
      projectId: scenes.projectId,
      sceneNumber: scenes.sceneNumber,
      heading: scenes.heading,
      headingType: scenes.headingType,
      location: scenes.location,
      timeOfDay: scenes.timeOfDay,
      section: scenes.section,
      synopsis: scenes.synopsis,
      sortOrder: scenes.sortOrder,
    })
    .from(sceneLocations)
    .innerJoin(scenes, eq(sceneLocations.sceneId, scenes.id))
    .where(eq(sceneLocations.locationId, locationId))
    .orderBy(asc(scenes.sortOrder));

  return NextResponse.json(linkedScenes);
  } catch (error: unknown) {
    logger.error("GET /api/locations/[id]/scenes error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch scenes for location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
