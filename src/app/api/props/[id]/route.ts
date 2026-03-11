import { NextResponse } from "next/server";
import { getProp, updateProp, deleteProp } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const PROP_UPDATABLE_FIELDS = [
  "name", "description", "tags", "aiGenerationNotes",
] as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid prop ID" }, { status: 400 });
    const prop = await getProp(numId);
    if (!prop) return NextResponse.json({ error: "Prop not found" }, { status: 404 });
    return NextResponse.json(prop);
  } catch (err) {
    logger.error("GET /api/props/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch prop" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid prop ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const allowed: Record<string, unknown> = {};
    for (const key of PROP_UPDATABLE_FIELDS) {
      if (key in body) allowed[key] = body[key];
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await updateProp(numId, allowed as Parameters<typeof updateProp>[1]);
    return NextResponse.json(updated ?? { success: true });
  } catch (err) {
    logger.error("PATCH /api/props/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update prop" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid prop ID" }, { status: 400 });
    await deleteProp(numId);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/props/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete prop" }, { status: 500 });
  }
}
