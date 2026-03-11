import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { breakdownElements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const eid = Number(id);
    if (isNaN(eid)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(breakdownElements)
      .where(eq(breakdownElements.id, eid));

    if (!existing) {
      return NextResponse.json({ error: "Element not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.category !== undefined) updateData.category = body.category;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.quantity !== undefined) updateData.quantity = body.quantity;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existing);
    }

    await db.update(breakdownElements)
      .set(updateData)
      .where(eq(breakdownElements.id, eid));

    const [updated] = await db
      .select()
      .from(breakdownElements)
      .where(eq(breakdownElements.id, eid));

    return NextResponse.json(updated);
  } catch (error: unknown) {
    logger.error("PATCH /api/breakdowns/elements/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update element";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const eid = Number(id);
    if (isNaN(eid)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const [existing] = await db
      .select()
      .from(breakdownElements)
      .where(eq(breakdownElements.id, eid));

    if (!existing) {
      return NextResponse.json({ error: "Element not found" }, { status: 404 });
    }

    await db.delete(breakdownElements).where(eq(breakdownElements.id, eid));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/breakdowns/elements/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete element";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
