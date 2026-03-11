import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import {
  dialoguePolishJobs,
  dialoguePolishResults,
  dialogues,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;
  const jobId = Number(id);

  const [job] = await db
    .select()
    .from(dialoguePolishJobs)
    .where(eq(dialoguePolishJobs.id, jobId));

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status === "applied") {
    return NextResponse.json(
      { error: "Job already applied" },
      { status: 400 }
    );
  }

  // Get all accepted results
  const acceptedResults = await db
    .select()
    .from(dialoguePolishResults)
    .where(
      and(
        eq(dialoguePolishResults.jobId, jobId),
        eq(dialoguePolishResults.status, "accepted")
      )
    );

  if (acceptedResults.length === 0) {
    return NextResponse.json(
      { error: "No accepted results to apply" },
      { status: 400 }
    );
  }

  let appliedCount: number;
  try {
    appliedCount = await db.transaction(async (tx) => {
      let count = 0;

      for (const result of acceptedResults) {
        const updateData: { line: string; parenthetical?: string | null } = {
          line: result.rewrittenLine,
        };

        if (result.rewrittenParenthetical !== undefined) {
          updateData.parenthetical = result.rewrittenParenthetical;
        }

        await tx.update(dialogues)
          .set(updateData)
          .where(eq(dialogues.id, result.dialogueId));

        count++;
      }

      await tx.update(dialoguePolishJobs)
        .set({ status: "applied" })
        .where(eq(dialoguePolishJobs.id, jobId));

      return count;
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to apply changes";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true, appliedCount });
}
