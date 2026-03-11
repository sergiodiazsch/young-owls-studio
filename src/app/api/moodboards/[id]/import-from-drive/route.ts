import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { moodboardItems, moodboards, driveFiles } from "@/lib/db/schema";
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

    if (!Array.isArray(body.fileIds) || (body.fileIds as number[]).length === 0) {
      return NextResponse.json(
        { error: "fileIds array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Verify moodboard exists
    const [board] = await db
      .select()
      .from(moodboards)
      .where(eq(moodboards.id, numId));

    if (!board) {
      return NextResponse.json({ error: "Moodboard not found" }, { status: 404 });
    }

    // Get current max sort order
    const [maxResult] = await db
      .select({ maxSort: sql<number>`COALESCE(MAX(sort_order), -1)` })
      .from(moodboardItems)
      .where(eq(moodboardItems.moodboardId, numId));

    let nextSort = (maxResult?.maxSort ?? -1) + 1;
    const created: Array<Record<string, unknown>> = [];

    await db.transaction(async (tx) => {
      for (const fileId of body.fileIds as number[]) {
        // Look up the drive file
        const [file] = await tx
          .select()
          .from(driveFiles)
          .where(eq(driveFiles.id, fileId));

        if (!file) continue;

        const [item] = await tx
          .insert(moodboardItems)
          .values({
            moodboardId: numId,
            type: "image",
            fileId: file.id,
            storagePath: file.storagePath,
            caption: file.caption ?? file.filename,
            sortOrder: nextSort,
          })
          .returning();

        created.push(item);
        nextSort++;
      }

      // Touch moodboard updatedAt
      await tx.update(moodboards)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(moodboards.id, numId));
    });

    return NextResponse.json({ imported: created.length, items: created }, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/moodboards/[id]/import-from-drive error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to import from drive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
