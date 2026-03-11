import { NextResponse } from "next/server";
import { updateDriveTag, deleteDriveTag } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and safe JSON parsing
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // TECH AUDIT FIX: Cast body values to expected types for type safety
    const { name, color } = body;
    await updateDriveTag(numId, {
      ...(name !== undefined && { name: name as string }),
      ...(color !== undefined && { color: color as string }),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/drive/tags/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and ID validation
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
    await deleteDriveTag(numId);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/drive/tags/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}
