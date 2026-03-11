import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { dialoguePolishJobs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and NaN validation
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const projectId = Number(searchParams.get("projectId"));

    if (!projectId || isNaN(projectId)) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const jobs = await db
      .select()
      .from(dialoguePolishJobs)
      .where(eq(dialoguePolishJobs.projectId, projectId))
      .orderBy(desc(dialoguePolishJobs.createdAt));

    return NextResponse.json(jobs);
  } catch (error: unknown) {
    logger.error("GET /api/dialogue-polish/jobs error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
