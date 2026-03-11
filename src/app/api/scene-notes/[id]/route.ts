import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { sceneNotes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const NOTE_UPDATABLE_FIELDS = ["content", "category", "color"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid note ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const allowed: Record<string, unknown> = {};
    for (const key of NOTE_UPDATABLE_FIELDS) {
      if (key in body) allowed[key] = body[key];
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    allowed.updatedAt = new Date().toISOString();
    await db.update(sceneNotes).set(allowed).where(eq(sceneNotes.id, numId));
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/scene-notes/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update scene note" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid note ID" }, { status: 400 });

    await db.delete(sceneNotes).where(eq(sceneNotes.id, numId));
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/scene-notes/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete scene note" }, { status: 500 });
  }
}
