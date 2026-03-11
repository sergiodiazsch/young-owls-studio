import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { moodboards, moodboardItems } from "@/lib/db/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and NaN validation to GET
export async function GET(req: Request) {
  try {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const numPid = Number(projectId);
  if (isNaN(numPid)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });

  const boards = await db
    .select({
      id: moodboards.id,
      projectId: moodboards.projectId,
      sceneId: moodboards.sceneId,
      title: moodboards.title,
      description: moodboards.description,
      layout: moodboards.layout,
      backgroundColor: moodboards.backgroundColor,
      sortOrder: moodboards.sortOrder,
      createdAt: moodboards.createdAt,
      updatedAt: moodboards.updatedAt,
      itemCount: sql<number>`(SELECT COUNT(*) FROM moodboard_items WHERE moodboard_id = ${moodboards.id})`,
    })
    .from(moodboards)
    .where(eq(moodboards.projectId, numPid))
    .orderBy(desc(moodboards.updatedAt));

  // For each board, get up to 4 image items for thumbnails
  const boardsWithThumbnails = [];
  for (const board of boards) {
    const thumbnails = await db
      .select({
        id: moodboardItems.id,
        type: moodboardItems.type,
        fileId: moodboardItems.fileId,
        storagePath: moodboardItems.storagePath,
        colorValue: moodboardItems.colorValue,
      })
      .from(moodboardItems)
      .where(
        and(
          eq(moodboardItems.moodboardId, board.id),
          eq(moodboardItems.type, "image")
        )
      )
      .orderBy(asc(moodboardItems.sortOrder))
      .limit(4);

    boardsWithThumbnails.push({ ...board, thumbnails });
  }

  return NextResponse.json(boardsWithThumbnails);
  } catch (error: unknown) {
    logger.error("GET /api/moodboards error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch moodboards";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and safe JSON parsing to POST
export async function POST(req: Request) {
  try {
  await ensureSchema();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  if (!body.projectId || !body.title) {
    return NextResponse.json(
      { error: "projectId and title are required" },
      { status: 400 }
    );
  }

  // TECH AUDIT FIX: Cast body values to correct types
  const [board] = await db
    .insert(moodboards)
    .values({
      projectId: Number(body.projectId),
      title: String(body.title),
      description: body.description ? String(body.description) : null,
      sceneId: body.sceneId ? Number(body.sceneId) : null,
      layout: body.layout ? String(body.layout) : "masonry",
    })
    .returning();

  return NextResponse.json(board, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/moodboards error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to create moodboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
