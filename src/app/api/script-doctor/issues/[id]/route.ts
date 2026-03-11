import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
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
    const issueId = Number(id);
    if (isNaN(issueId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const { isResolved, resolvedNote } = body as {
      isResolved?: boolean;
      resolvedNote?: string;
    };

    const [issue] = await db
      .select()
      .from(schema.scriptIssues)
      .where(eq(schema.scriptIssues.id, issueId));

    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (isResolved !== undefined) {
      updates.isResolved = isResolved ? 1 : 0;
    }
    if (resolvedNote !== undefined) {
      updates.resolvedNote = resolvedNote;
    }

    await db.update(schema.scriptIssues)
      .set(updates)
      .where(eq(schema.scriptIssues.id, issueId));

    const [updated] = await db
      .select()
      .from(schema.scriptIssues)
      .where(eq(schema.scriptIssues.id, issueId));

    return NextResponse.json(updated);
  } catch (error: unknown) {
    logger.error("PATCH /api/script-doctor/issues/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update issue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
