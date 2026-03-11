import { NextResponse } from "next/server";
import { createPropFileLink, deletePropFileLink } from "@/lib/db/queries";
import { db, ensureSchema } from "@/lib/db";
import { propFileLinks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { propId, fileId, isPrimary } = body;
    if (!propId || !fileId) {
      return NextResponse.json({ error: "propId and fileId are required" }, { status: 400 });
    }

    const link = await createPropFileLink(propId as number, fileId as number, isPrimary as boolean | undefined);
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    logger.error("POST /api/drive/prop-links error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create prop link" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureSchema();
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { propId, linkId } = body;
    if (!propId || !linkId) {
      return NextResponse.json({ error: "propId and linkId are required" }, { status: 400 });
    }

    await db.update(propFileLinks)
      .set({ isPrimary: false })
      .where(eq(propFileLinks.propId, Number(propId)));

    await db.update(propFileLinks)
      .set({ isPrimary: true })
      .where(and(
        eq(propFileLinks.id, Number(linkId)),
        eq(propFileLinks.propId, Number(propId)),
      ));

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/drive/prop-links error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to set primary image" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { id } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await deletePropFileLink(id as number);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/drive/prop-links error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete prop link" }, { status: 500 });
  }
}
