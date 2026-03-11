import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
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
    const analysisId = Number(id);
    if (isNaN(analysisId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const [analysis] = await db
      .select()
      .from(schema.scriptAnalyses)
      .where(eq(schema.scriptAnalyses.id, analysisId));

    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    // Auto-fail stuck analyses (processing/pending for > 5 minutes)
    if (
      (analysis.status === "processing" || analysis.status === "pending") &&
      analysis.createdAt
    ) {
      const ageMs = Date.now() - new Date(analysis.createdAt).getTime();
      if (ageMs > 5 * 60 * 1000) {
        await db.update(schema.scriptAnalyses)
          .set({ status: "failed", error: "Analysis timed out — the server function may have been interrupted. Please try again." })
          .where(eq(schema.scriptAnalyses.id, analysisId));
        return NextResponse.json({
          ...analysis,
          status: "failed",
          error: "Analysis timed out — the server function may have been interrupted. Please try again.",
          issues: [],
        });
      }
    }

    const issues = await db
      .select()
      .from(schema.scriptIssues)
      .where(eq(schema.scriptIssues.analysisId, analysisId))
      .orderBy(asc(schema.scriptIssues.sortOrder));

    return NextResponse.json({ ...analysis, issues });
  } catch (error: unknown) {
    logger.error("GET /api/script-doctor/analyses/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch analysis";
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
    const analysisId = Number(id);
    if (isNaN(analysisId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const [analysis] = await db
      .select()
      .from(schema.scriptAnalyses)
      .where(eq(schema.scriptAnalyses.id, analysisId));

    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    await db.delete(schema.scriptAnalyses)
      .where(eq(schema.scriptAnalyses.id, analysisId));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/script-doctor/analyses/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete analysis";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
