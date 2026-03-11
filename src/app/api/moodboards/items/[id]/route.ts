import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { moodboardItems, moodboards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch, safe JSON parsing, and ID validation to PATCH
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.caption !== undefined) data.caption = body.caption;
    if (body.textContent !== undefined) data.textContent = body.textContent;
    if (body.colorValue !== undefined) data.colorValue = body.colorValue;
    if (body.colorName !== undefined) data.colorName = body.colorName;
    if (body.positionX !== undefined) data.positionX = body.positionX;
    if (body.positionY !== undefined) data.positionY = body.positionY;
    if (body.width !== undefined) data.width = body.width;
    if (body.height !== undefined) data.height = body.height;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

    await db.update(moodboardItems)
      .set(data)
      .where(eq(moodboardItems.id, numId));

    const [item] = await db
      .select({ moodboardId: moodboardItems.moodboardId })
      .from(moodboardItems)
      .where(eq(moodboardItems.id, numId));

    if (item) {
      await db.update(moodboards)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(moodboards.id, item.moodboardId));
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("PATCH /api/moodboards/items/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update moodboard item";
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
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const [item] = await db
      .select({ moodboardId: moodboardItems.moodboardId })
      .from(moodboardItems)
      .where(eq(moodboardItems.id, numId));

    await db.delete(moodboardItems)
      .where(eq(moodboardItems.id, numId));

    if (item) {
      await db.update(moodboards)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(moodboards.id, item.moodboardId));
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/moodboards/items/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete moodboard item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
