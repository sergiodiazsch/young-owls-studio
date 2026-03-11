import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { locationConcepts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { saveFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST — Add concept image (upload file or link from asset library)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const locationId = Number(id);
    if (isNaN(locationId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // File upload
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const projectId = Number(formData.get("projectId"));
      const timeOfDay = formData.get("timeOfDay") as string | null;
      const cameraAngle = formData.get("cameraAngle") as string | null;

      if (!file || !projectId || isNaN(projectId)) {
        return NextResponse.json({ error: "file and projectId required" }, { status: 400 });
      }

      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
      }

      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Only image files allowed" }, { status: 400 });
      }

      const safeFilename = file.name.replace(/[/\\]/g, "_");
      const buffer = Buffer.from(await file.arrayBuffer());
      const { storagePath } = await saveFile(projectId, safeFilename, buffer);

      // Get max sortOrder
      const existing = await db.select().from(locationConcepts).where(eq(locationConcepts.locationId, locationId));
      const maxSort = existing.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1);

      const [concept] = await db.insert(locationConcepts).values({
        locationId,
        storagePath,
        timeOfDay: timeOfDay || null,
        cameraAngle: cameraAngle || null,
        isPrimary: existing.length === 0 ? 1 : 0,
        sortOrder: maxSort + 1,
      }).returning();

      return NextResponse.json(concept, { status: 201 });
    } else {
      // JSON — link from asset library or generation
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const { storagePath, fileId, generationId, prompt, timeOfDay, cameraAngle } = body as {
        storagePath?: string;
        fileId?: number;
        generationId?: number;
        prompt?: string;
        timeOfDay?: string;
        cameraAngle?: string;
      };

      if (!storagePath) {
        return NextResponse.json({ error: "storagePath required" }, { status: 400 });
      }

      const existing = await db.select().from(locationConcepts).where(eq(locationConcepts.locationId, locationId));
      const maxSort = existing.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1);

      const [concept] = await db.insert(locationConcepts).values({
        locationId,
        storagePath: storagePath as string,
        fileId: fileId ? Number(fileId) : null,
        generationId: generationId ? Number(generationId) : null,
        prompt: (prompt as string) || null,
        timeOfDay: (timeOfDay as string) || null,
        cameraAngle: (cameraAngle as string) || null,
        isPrimary: existing.length === 0 ? 1 : 0,
        sortOrder: maxSort + 1,
      }).returning();

      return NextResponse.json(concept, { status: 201 });
    }
  } catch (error: unknown) {
    logger.error("POST /api/locations/[id]/concepts error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to add concept" }, { status: 500 });
  }
}

// DELETE — Remove concept image
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const locationId = Number(id);
    if (isNaN(locationId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const conceptId = Number(searchParams.get("conceptId"));
    if (isNaN(conceptId)) return NextResponse.json({ error: "conceptId required" }, { status: 400 });

    await db.delete(locationConcepts).where(
      and(eq(locationConcepts.id, conceptId), eq(locationConcepts.locationId, locationId))
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/locations/[id]/concepts error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to delete concept" }, { status: 500 });
  }
}

// PATCH — Set primary concept
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const locationId = Number(id);
    if (isNaN(locationId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    let body: { conceptId: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { conceptId } = body;
    if (!conceptId) return NextResponse.json({ error: "conceptId required" }, { status: 400 });

    // Unset all primary flags
    await db.update(locationConcepts)
      .set({ isPrimary: 0 })
      .where(eq(locationConcepts.locationId, locationId));

    // Set selected as primary
    await db.update(locationConcepts)
      .set({ isPrimary: 1 })
      .where(and(eq(locationConcepts.id, conceptId), eq(locationConcepts.locationId, locationId)));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("PATCH /api/locations/[id]/concepts error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to update concept" }, { status: 500 });
  }
}
