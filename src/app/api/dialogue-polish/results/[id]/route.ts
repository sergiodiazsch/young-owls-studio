import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { dialoguePolishResults, dialoguePolishJobs } from "@/lib/db/schema";
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
  const resultId = Number(id);
  if (isNaN(resultId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { status }: { status: string } = body as { status: string };

  if (status !== "accepted" && status !== "rejected") {
    return NextResponse.json(
      { error: "status must be 'accepted' or 'rejected'" },
      { status: 400 }
    );
  }

  const [result] = await db
    .select()
    .from(dialoguePolishResults)
    .where(eq(dialoguePolishResults.id, resultId));

  if (!result) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  const previousStatus = result.status;

  // Update result status
  await db.update(dialoguePolishResults)
    .set({ status })
    .where(eq(dialoguePolishResults.id, resultId));

  // Update job counts
  const [job] = await db
    .select()
    .from(dialoguePolishJobs)
    .where(eq(dialoguePolishJobs.id, result.jobId));

  if (job) {
    let acceptedDelta = 0;
    let rejectedDelta = 0;

    // Remove previous status count
    if (previousStatus === "accepted") acceptedDelta--;
    if (previousStatus === "rejected") rejectedDelta--;

    // Add new status count
    if (status === "accepted") acceptedDelta++;
    if (status === "rejected") rejectedDelta++;

    await db.update(dialoguePolishJobs)
      .set({
        acceptedDialogues: (job.acceptedDialogues ?? 0) + acceptedDelta,
        rejectedDialogues: (job.rejectedDialogues ?? 0) + rejectedDelta,
      })
      .where(eq(dialoguePolishJobs.id, result.jobId));
  }

  return NextResponse.json({ success: true, status });
  } catch (error: unknown) {
    logger.error("PATCH /api/dialogue-polish/results/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update result";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
