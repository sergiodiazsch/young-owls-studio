import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { audioStudioGenerations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET: list audio generations for a project
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const rows = await db
      .select()
      .from(audioStudioGenerations)
      .where(eq(audioStudioGenerations.projectId, Number(projectId)))
      .orderBy(desc(audioStudioGenerations.createdAt));

    return NextResponse.json(rows);
  } catch (error: unknown) {
    logger.error("GET /api/audio-studio error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to load audio generations" }, { status: 500 });
  }
}

// DELETE: remove an audio generation
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await ensureSchema();
    await db.delete(audioStudioGenerations).where(eq(audioStudioGenerations.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/audio-studio error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
