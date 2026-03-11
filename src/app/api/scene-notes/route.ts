import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { sceneNotes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const sceneId = searchParams.get("sceneId");

    if (!sceneId) {
      return NextResponse.json({ error: "sceneId is required" }, { status: 400 });
    }

    const sid = Number(sceneId);
    if (isNaN(sid)) return NextResponse.json({ error: "sceneId must be a number" }, { status: 400 });

    const notes = await db
      .select()
      .from(sceneNotes)
      .where(eq(sceneNotes.sceneId, sid))
      .orderBy(desc(sceneNotes.createdAt));

    return NextResponse.json(notes);
  } catch (err) {
    logger.error("GET /api/scene-notes error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch scene notes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  if (!body.sceneId || !body.projectId || !body.content) {
    return NextResponse.json({ error: "sceneId, projectId, and content are required" }, { status: 400 });
  }

  const sceneId = Number(body.sceneId);
  const projectId = Number(body.projectId);
  if (isNaN(sceneId) || isNaN(projectId)) {
    return NextResponse.json({ error: "sceneId and projectId must be numbers" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const rows = await db
      .insert(sceneNotes)
      .values({
        sceneId,
        projectId,
        content: body.content as string,
        category: (body.category as string) || "general",
        color: (body.color as string) || "yellow",
      })
      .returning();

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    logger.error("POST /api/scene-notes error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create scene note" }, { status: 500 });
  }
}
