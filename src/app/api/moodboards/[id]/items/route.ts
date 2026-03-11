import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { moodboardItems, moodboards } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch, ID validation, and safe JSON parsing
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid moodboard ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    if (!body.type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    // Get current max sort order
    const [maxResult] = await db
      .select({ maxSort: sql<number>`COALESCE(MAX(sort_order), -1)` })
      .from(moodboardItems)
      .where(eq(moodboardItems.moodboardId, numId));

    const nextSort = (maxResult?.maxSort ?? -1) + 1;

    const [item] = await db
      .insert(moodboardItems)
      .values({
        moodboardId: numId,
        type: body.type as string,
        fileId: (body.fileId as number) ?? null,
        storagePath: (body.storagePath as string) ?? null,
        textContent: (body.textContent as string) ?? null,
        colorValue: (body.colorValue as string) ?? null,
        colorName: (body.colorName as string) ?? null,
        caption: (body.caption as string) ?? null,
        sortOrder: nextSort,
      })
      .returning();

    // Touch moodboard updatedAt
    await db.update(moodboards)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(moodboards.id, numId));

    return NextResponse.json(item, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/moodboards/[id]/items error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to create item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
