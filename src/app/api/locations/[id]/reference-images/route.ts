import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { locationReferenceImages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { saveFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

// GET all reference images for a location
export async function GET(_req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const locationId = Number(id);
  if (!locationId || isNaN(locationId)) {
    return NextResponse.json({ error: "Invalid location id" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const images = await db
      .select()
      .from(locationReferenceImages)
      .where(eq(locationReferenceImages.locationId, locationId))
      .orderBy(locationReferenceImages.createdAt);

    return NextResponse.json(images);
  } catch (err) {
    logger.error("GET location reference images error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch reference images" }, { status: 500 });
  }
}

// POST — upload a new reference image (multipart/form-data)
export async function POST(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const locationId = Number(id);
  if (!locationId || isNaN(locationId)) {
    return NextResponse.json({ error: "Invalid location id" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const label = (formData.get("label") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `loc-ref-${locationId}-${Date.now()}-${file.name}`;
    const saved = await saveFile(0, filename, buffer);

    // Check if this is the first image — auto-set as default
    const existing = await db
      .select({ id: locationReferenceImages.id })
      .from(locationReferenceImages)
      .where(eq(locationReferenceImages.locationId, locationId));

    const [row] = await db
      .insert(locationReferenceImages)
      .values({
        locationId,
        storagePath: saved.storagePath,
        filename: file.name,
        label,
        isDefault: existing.length === 0,
        fileSize: saved.fileSize,
        mimeType: file.type || "image/png",
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    logger.error("POST location reference image error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to upload reference image" }, { status: 500 });
  }
}

// DELETE — remove a reference image by imageId query param
export async function DELETE(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const locationId = Number(id);
  const { searchParams } = new URL(req.url);
  const imageId = Number(searchParams.get("imageId"));

  if (!locationId || !imageId || isNaN(locationId) || isNaN(imageId)) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

  try {
    await ensureSchema();
    await db
      .delete(locationReferenceImages)
      .where(and(eq(locationReferenceImages.id, imageId), eq(locationReferenceImages.locationId, locationId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE location reference image error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete reference image" }, { status: 500 });
  }
}

// PATCH — set default or update label
export async function PATCH(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const locationId = Number(id);
  if (!locationId || isNaN(locationId)) {
    return NextResponse.json({ error: "Invalid location id" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const body = await req.json();
    const { imageId, isDefault, label } = body as { imageId: number; isDefault?: boolean; label?: string };

    if (!imageId) {
      return NextResponse.json({ error: "imageId is required" }, { status: 400 });
    }

    if (isDefault) {
      // Unset all defaults first
      await db
        .update(locationReferenceImages)
        .set({ isDefault: false })
        .where(eq(locationReferenceImages.locationId, locationId));
    }

    const updates: Record<string, unknown> = {};
    if (isDefault !== undefined) updates.isDefault = isDefault;
    if (label !== undefined) updates.label = label;

    await db
      .update(locationReferenceImages)
      .set(updates)
      .where(and(eq(locationReferenceImages.id, imageId), eq(locationReferenceImages.locationId, locationId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH location reference image error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update reference image" }, { status: 500 });
  }
}
