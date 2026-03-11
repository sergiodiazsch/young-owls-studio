import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { dialoguePolishResults, scenes } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and ID validation
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  await ensureSchema();
  const { id } = await params;
  const jobId = Number(id);
  if (isNaN(jobId)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const conditions = [eq(dialoguePolishResults.jobId, jobId)];

  if (
    statusFilter &&
    (statusFilter === "pending" ||
      statusFilter === "accepted" ||
      statusFilter === "rejected")
  ) {
    conditions.push(eq(dialoguePolishResults.status, statusFilter));
  }

  const results = await db
    .select({
      id: dialoguePolishResults.id,
      jobId: dialoguePolishResults.jobId,
      dialogueId: dialoguePolishResults.dialogueId,
      sceneId: dialoguePolishResults.sceneId,
      originalLine: dialoguePolishResults.originalLine,
      originalParenthetical: dialoguePolishResults.originalParenthetical,
      rewrittenLine: dialoguePolishResults.rewrittenLine,
      rewrittenParenthetical: dialoguePolishResults.rewrittenParenthetical,
      changeRationale: dialoguePolishResults.changeRationale,
      status: dialoguePolishResults.status,
      sortOrder: dialoguePolishResults.sortOrder,
      createdAt: dialoguePolishResults.createdAt,
      sceneHeading: scenes.heading,
      sceneNumber: scenes.sceneNumber,
    })
    .from(dialoguePolishResults)
    .innerJoin(scenes, eq(dialoguePolishResults.sceneId, scenes.id))
    .where(and(...conditions))
    .orderBy(asc(scenes.sortOrder), asc(dialoguePolishResults.sortOrder));

  // Group by scene
  const grouped: Record<
    number,
    {
      sceneId: number;
      sceneHeading: string;
      sceneNumber: number;
      results: typeof results;
    }
  > = {};

  for (const r of results) {
    if (!grouped[r.sceneId]) {
      grouped[r.sceneId] = {
        sceneId: r.sceneId,
        sceneHeading: r.sceneHeading,
        sceneNumber: r.sceneNumber,
        results: [],
      };
    }
    grouped[r.sceneId].results.push(r);
  }

  const sceneGroups = Object.values(grouped).sort(
    (a, b) => a.sceneNumber - b.sceneNumber
  );

  return NextResponse.json(sceneGroups);
  } catch (error: unknown) {
    logger.error("GET /api/dialogue-polish/jobs/[id]/results error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
