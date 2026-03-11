import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { sceneBreakdowns, breakdownElements } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  try {
    await ensureSchema();
    const { sceneId } = await params;
    const sid = Number(sceneId);
    if (isNaN(sid)) return NextResponse.json({ error: "Invalid sceneId" }, { status: 400 });

    const [breakdown] = await db
      .select()
      .from(sceneBreakdowns)
      .where(eq(sceneBreakdowns.sceneId, sid));

    if (!breakdown) {
      return NextResponse.json({ breakdown: null, elements: [] });
    }

    const elements = await db
      .select()
      .from(breakdownElements)
      .where(eq(breakdownElements.breakdownId, breakdown.id))
      .orderBy(asc(breakdownElements.sortOrder));

    return NextResponse.json({ breakdown, elements });
  } catch (error: unknown) {
    logger.error("GET /api/breakdowns/[sceneId] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch breakdown";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  try {
    await ensureSchema();
    const { sceneId } = await params;
    const sid = Number(sceneId);
    if (isNaN(sid)) return NextResponse.json({ error: "Invalid sceneId" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const [existing] = await db
    .select()
    .from(sceneBreakdowns)
    .where(eq(sceneBreakdowns.sceneId, sid));

  if (!existing) {
    return NextResponse.json({ error: "Breakdown not found for this scene" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (body.pageCount !== undefined) updateData.pageCount = body.pageCount;
  if (body.dayOrNight !== undefined) updateData.dayOrNight = body.dayOrNight;
  if (body.intOrExt !== undefined) updateData.intOrExt = body.intOrExt;
  if (body.estimatedShootHours !== undefined) updateData.estimatedShootHours = body.estimatedShootHours;
  if (body.notes !== undefined) updateData.notes = body.notes;

  await db.update(sceneBreakdowns)
    .set(updateData)
    .where(eq(sceneBreakdowns.id, existing.id));

  const [updated] = await db
    .select()
    .from(sceneBreakdowns)
    .where(eq(sceneBreakdowns.id, existing.id));

    return NextResponse.json(updated);
  } catch (error: unknown) {
    logger.error("PATCH /api/breakdowns/[sceneId] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update breakdown";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
