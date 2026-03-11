import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and NaN validation to GET
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const numId = Number(projectId);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });

    const analyses = await db
      .select()
      .from(schema.scriptAnalyses)
      .where(eq(schema.scriptAnalyses.projectId, numId))
      .orderBy(desc(schema.scriptAnalyses.createdAt));

    return NextResponse.json(analyses);
  } catch (error: unknown) {
    logger.error("GET /api/script-doctor/analyses error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch analyses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
