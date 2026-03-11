import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { scenes, locations } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { extractLocations } from "@/lib/location-extractor";
import { logger } from "@/lib/logger";
import type { Scene } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSchema();

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const { projectId } = body as { projectId: number };

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Load all scenes for this project
    const allScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, projectId)) as Scene[];

    if (allScenes.length === 0) {
      return NextResponse.json({ error: "No scenes found for this project. Upload a screenplay first." }, { status: 400 });
    }

    const extracted = extractLocations(allScenes);

    logger.info("Location extraction", {
      projectId,
      scenesCount: allScenes.length,
      extractedCount: extracted.length,
      locationNames: extracted.map((l) => l.normalizedName),
    });

    if (extracted.length === 0) {
      return NextResponse.json(
        { error: "No locations found in scene headings. Ensure scenes use standard format (e.g. INT. LOCATION - DAY)." },
        { status: 400 }
      );
    }

    const created: Array<{
      id: number;
      name: string;
      sceneCount: number;
      sceneIds: number[];
    }> = [];

    await db.transaction(async (tx) => {
      for (const loc of extracted) {
        // Check if a location with this name already exists for this project
        const [existing] = await tx
          .select()
          .from(locations)
          .where(and(eq(locations.projectId, projectId), eq(locations.name, loc.normalizedName)));

        let locationId: number;

        if (existing) {
          // Update scene count
          await tx.update(locations)
            .set({
              sceneCount: loc.sceneCount,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(locations.id, existing.id));
          locationId = existing.id;
        } else {
          // Insert new location
          const [inserted] = await tx
            .insert(locations)
            .values({
              projectId,
              name: loc.normalizedName,
              sceneCount: loc.sceneCount,
            })
            .returning();
          locationId = inserted.id;
        }

        // Upsert scene_locations links using ON CONFLICT to handle the UNIQUE constraint
        for (const sceneId of loc.sceneIds) {
          await tx.execute(
            sql`INSERT INTO scene_locations (scene_id, location_id) VALUES (${sceneId}, ${locationId}) ON CONFLICT (scene_id, location_id) DO NOTHING`
          );
        }

        created.push({
          id: locationId,
          name: loc.normalizedName,
          sceneCount: loc.sceneCount,
          sceneIds: loc.sceneIds,
        });
      }
    });

    logger.info("Location extraction complete", {
      projectId,
      createdCount: created.length,
      locations: created.map((l) => ({ id: l.id, name: l.name, sceneCount: l.sceneCount })),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/locations/extract error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const message = error instanceof Error ? error.message : "Failed to extract locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
