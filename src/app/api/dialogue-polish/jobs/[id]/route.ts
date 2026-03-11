import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import {
  dialoguePolishJobs,
  dialoguePolishResults,
  scenes,
} from "@/lib/db/schema";
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
    const jobId = Number(id);
    if (isNaN(jobId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const [job] = await db
      .select()
      .from(dialoguePolishJobs)
      .where(eq(dialoguePolishJobs.id, jobId));

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
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
      .where(eq(dialoguePolishResults.jobId, jobId))
      .orderBy(asc(scenes.sortOrder), asc(dialoguePolishResults.sortOrder));

    return NextResponse.json({ ...job, results });
  } catch (error: unknown) {
    logger.error("GET /api/dialogue-polish/jobs/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch job";
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
    const jobId = Number(id);
    if (isNaN(jobId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const [job] = await db
      .select()
      .from(dialoguePolishJobs)
      .where(eq(dialoguePolishJobs.id, jobId));

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    await db.delete(dialoguePolishJobs)
      .where(eq(dialoguePolishJobs.id, jobId));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/dialogue-polish/jobs/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
