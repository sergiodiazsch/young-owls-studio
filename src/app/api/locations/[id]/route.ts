import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { locations, sceneLocations, locationConcepts, scenes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, locationId));

    if (!location) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const linkedScenes = await db
      .select({
        id: scenes.id,
        sceneNumber: scenes.sceneNumber,
        heading: scenes.heading,
        timeOfDay: scenes.timeOfDay,
        synopsis: scenes.synopsis,
        sortOrder: scenes.sortOrder,
      })
      .from(sceneLocations)
      .innerJoin(scenes, eq(sceneLocations.sceneId, scenes.id))
      .where(eq(sceneLocations.locationId, locationId));

    const concepts = await db
      .select()
      .from(locationConcepts)
      .where(eq(locationConcepts.locationId, locationId));

    return NextResponse.json({ ...location, scenes: linkedScenes, concepts });
  } catch (error: unknown) {
    logger.error("GET /api/locations/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch, safe JSON parsing, and ID validation to PATCH
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const locationId = Number(id);
    if (isNaN(locationId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const allowedFields: Record<string, unknown> = {};
    if (body.description !== undefined) allowedFields.description = body.description;
    if (body.visualPrompt !== undefined) allowedFields.visualPrompt = body.visualPrompt;
    if (body.timePeriod !== undefined) allowedFields.timePeriod = body.timePeriod;
    if (body.styleNotes !== undefined) allowedFields.styleNotes = body.styleNotes;
    if (body.name !== undefined) allowedFields.name = body.name;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await db.update(locations)
      .set({ ...allowedFields, updatedAt: new Date().toISOString() })
      .where(eq(locations.id, locationId));

    const [updated] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, locationId));

    return NextResponse.json(updated);
  } catch (error: unknown) {
    logger.error("PATCH /api/locations/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and ID validation to DELETE
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const locationId = Number(id);
    if (isNaN(locationId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await db.delete(sceneLocations).where(eq(sceneLocations.locationId, locationId));
    await db.delete(locationConcepts).where(eq(locationConcepts.locationId, locationId));
    await db.delete(locations).where(eq(locations.id, locationId));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/locations/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
