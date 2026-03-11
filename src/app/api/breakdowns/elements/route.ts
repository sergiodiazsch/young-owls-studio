import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { breakdownElements, sceneBreakdowns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
  await ensureSchema();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { breakdownId, category, name, description, quantity } = body;

  if (!breakdownId || !category || !name) {
    return NextResponse.json(
      { error: "breakdownId, category, and name are required" },
      { status: 400 }
    );
  }

  // Verify breakdown exists
  const [breakdown] = await db
    .select()
    .from(sceneBreakdowns)
    .where(eq(sceneBreakdowns.id, Number(breakdownId)));

  if (!breakdown) {
    return NextResponse.json({ error: "Breakdown not found" }, { status: 404 });
  }

  // Get max sort order
  const [lastElement] = await db
    .select({ sortOrder: breakdownElements.sortOrder })
    .from(breakdownElements)
    .where(eq(breakdownElements.breakdownId, Number(breakdownId)))
    .orderBy(desc(breakdownElements.sortOrder));

  const nextSort = (lastElement?.sortOrder ?? -1) + 1;

  const [element] = await db
    .insert(breakdownElements)
    .values({
      breakdownId: Number(breakdownId),
      category: category as string,
      name: name as string,
      description: (description as string) || null,
      quantity: Number(quantity) || 1,
      isCustom: 1,
      sortOrder: nextSort,
    })
    .returning();

  return NextResponse.json(element, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/breakdowns/elements error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to create element";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
