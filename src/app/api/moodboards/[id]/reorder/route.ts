import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { moodboardItems, moodboards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

    if (!Array.isArray(body.itemIds)) {
      return NextResponse.json(
        { error: "itemIds array is required" },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < (body.itemIds as number[]).length; i++) {
        await tx.update(moodboardItems)
          .set({ sortOrder: i })
          .where(eq(moodboardItems.id, (body.itemIds as number[])[i]));
      }

      // Touch moodboard updatedAt
      await tx.update(moodboards)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(moodboards.id, numId));
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("POST /api/moodboards/[id]/reorder error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to reorder items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
