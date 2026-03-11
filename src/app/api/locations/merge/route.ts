import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { locations, sceneLocations, locationConcepts } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and safe JSON parsing to POST
export async function POST(req: Request) {
  try {
  await ensureSchema();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { sourceId, targetId } = body as { sourceId: number; targetId: number };

  if (!sourceId || !targetId) {
    return NextResponse.json({ error: "sourceId and targetId are required" }, { status: 400 });
  }

  if (sourceId === targetId) {
    return NextResponse.json({ error: "Cannot merge a location into itself" }, { status: 400 });
  }

  const [source] = await db.select().from(locations).where(eq(locations.id, sourceId));
  const [target] = await db.select().from(locations).where(eq(locations.id, targetId));

  if (!source || !target) {
    return NextResponse.json({ error: "Source or target location not found" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    // Move scene_locations from source to target
    // First, get existing scene IDs for target to avoid duplicates
    const targetSceneLinks = await tx
      .select({ sceneId: sceneLocations.sceneId })
      .from(sceneLocations)
      .where(eq(sceneLocations.locationId, targetId));

    const targetSceneIds = new Set(targetSceneLinks.map(l => l.sceneId));

    const sourceSceneLinks = await tx
      .select()
      .from(sceneLocations)
      .where(eq(sceneLocations.locationId, sourceId));

    for (const link of sourceSceneLinks) {
      if (!targetSceneIds.has(link.sceneId)) {
        // Move the link to target
        await tx.update(sceneLocations)
          .set({ locationId: targetId })
          .where(eq(sceneLocations.id, link.id));
      } else {
        // Already linked to target, delete the duplicate
        await tx.delete(sceneLocations)
          .where(eq(sceneLocations.id, link.id));
      }
    }

    // Move location concepts from source to target
    await tx.update(locationConcepts)
      .set({ locationId: targetId })
      .where(eq(locationConcepts.locationId, sourceId));

    // Recalculate scene count for target
    const [newCount] = await tx
      .select({ count: sql<number>`COUNT(*)` })
      .from(sceneLocations)
      .where(eq(sceneLocations.locationId, targetId));

    await tx.update(locations)
      .set({
        sceneCount: newCount?.count ?? 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(locations.id, targetId));

    // Delete source location
    await tx.delete(locations).where(eq(locations.id, sourceId));
  });

  // Return updated target
  const [updated] = await db.select().from(locations).where(eq(locations.id, targetId));
  return NextResponse.json(updated);
  } catch (error: unknown) {
    logger.error("POST /api/locations/merge error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to merge locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
