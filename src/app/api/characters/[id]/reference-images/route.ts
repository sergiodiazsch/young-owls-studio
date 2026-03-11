import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { characterReferenceImages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { saveFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

// GET all reference images for a character
export async function GET(_req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const characterId = Number(id);
  if (!characterId || isNaN(characterId)) {
    return NextResponse.json({ error: "Invalid character id" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const images = await db
      .select()
      .from(characterReferenceImages)
      .where(eq(characterReferenceImages.characterId, characterId))
      .orderBy(characterReferenceImages.createdAt);

    return NextResponse.json(images);
  } catch (err) {
    logger.error("GET character reference images error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch reference images" }, { status: 500 });
  }
}

// POST — upload a new reference image (multipart/form-data)
export async function POST(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const characterId = Number(id);
  if (!characterId || isNaN(characterId)) {
    return NextResponse.json({ error: "Invalid character id" }, { status: 400 });
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
    const filename = `char-ref-${characterId}-${Date.now()}-${file.name}`;
    const saved = await saveFile(0, filename, buffer);

    // Check if this is the first image — auto-set as default
    const existing = await db
      .select({ id: characterReferenceImages.id })
      .from(characterReferenceImages)
      .where(eq(characterReferenceImages.characterId, characterId));

    const [row] = await db
      .insert(characterReferenceImages)
      .values({
        characterId,
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
    logger.error("POST character reference image error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to upload reference image" }, { status: 500 });
  }
}

// DELETE — remove a reference image by imageId query param
export async function DELETE(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const characterId = Number(id);
  const { searchParams } = new URL(req.url);
  const imageId = Number(searchParams.get("imageId"));

  if (!characterId || !imageId || isNaN(characterId) || isNaN(imageId)) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

  try {
    await ensureSchema();
    await db
      .delete(characterReferenceImages)
      .where(and(eq(characterReferenceImages.id, imageId), eq(characterReferenceImages.characterId, characterId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE character reference image error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete reference image" }, { status: 500 });
  }
}

// PATCH — set default or update label
export async function PATCH(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const characterId = Number(id);
  if (!characterId || isNaN(characterId)) {
    return NextResponse.json({ error: "Invalid character id" }, { status: 400 });
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
        .update(characterReferenceImages)
        .set({ isDefault: false })
        .where(eq(characterReferenceImages.characterId, characterId));
    }

    const updates: Record<string, unknown> = {};
    if (isDefault !== undefined) updates.isDefault = isDefault;
    if (label !== undefined) updates.label = label;

    await db
      .update(characterReferenceImages)
      .set(updates)
      .where(and(eq(characterReferenceImages.id, imageId), eq(characterReferenceImages.characterId, characterId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH character reference image error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update reference image" }, { status: 500 });
  }
}
