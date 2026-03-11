import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { moodboards, moodboardItems } from "@/lib/db/schema";
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
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const [board] = await db
      .select()
      .from(moodboards)
      .where(eq(moodboards.id, numId));

    if (!board) {
      return NextResponse.json({ error: "Moodboard not found" }, { status: 404 });
    }

    const items = await db
      .select()
      .from(moodboardItems)
      .where(eq(moodboardItems.moodboardId, numId))
      .orderBy(asc(moodboardItems.sortOrder));

    return NextResponse.json({ ...board, items });
  } catch (error: unknown) {
    logger.error("GET /api/moodboards/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch moodboard";
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
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.layout !== undefined) data.layout = body.layout;
    if (body.backgroundColor !== undefined) data.backgroundColor = body.backgroundColor;
    data.updatedAt = new Date().toISOString();

    await db.update(moodboards)
      .set(data)
      .where(eq(moodboards.id, numId));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("PATCH /api/moodboards/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update moodboard";
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

    await db.delete(moodboardItems)
      .where(eq(moodboardItems.moodboardId, numId));

    await db.delete(moodboards)
      .where(eq(moodboards.id, numId));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/moodboards/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete moodboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
