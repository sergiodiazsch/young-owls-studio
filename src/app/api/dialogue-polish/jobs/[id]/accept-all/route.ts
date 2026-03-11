import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { dialoguePolishJobs, dialoguePolishResults } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and ID validation
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const jobId = Number(id);
    if (isNaN(jobId)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });

    const [job] = await db
      .select()
      .from(dialoguePolishJobs)
      .where(eq(dialoguePolishJobs.id, jobId));

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Count pending results
    const pendingResults = await db
      .select()
      .from(dialoguePolishResults)
      .where(
        and(
          eq(dialoguePolishResults.jobId, jobId),
          eq(dialoguePolishResults.status, "pending")
        )
      );

    const rejectedResults = await db
      .select()
      .from(dialoguePolishResults)
      .where(
        and(
          eq(dialoguePolishResults.jobId, jobId),
          eq(dialoguePolishResults.status, "rejected")
        )
      );

    const toAcceptCount = pendingResults.length + rejectedResults.length;

    // Set all results to accepted
    await db.update(dialoguePolishResults)
      .set({ status: "accepted" })
      .where(eq(dialoguePolishResults.jobId, jobId));

    // Update job counts
    await db.update(dialoguePolishJobs)
      .set({
        acceptedDialogues: job.totalDialogues,
        rejectedDialogues: 0,
      })
      .where(eq(dialoguePolishJobs.id, jobId));

    return NextResponse.json({ success: true, acceptedCount: toAcceptCount });
  } catch (error: unknown) {
    logger.error("POST /api/dialogue-polish/jobs/[id]/accept-all error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to accept all";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
