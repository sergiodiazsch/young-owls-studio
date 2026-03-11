import { NextResponse } from "next/server";
import { getDriveFolder, updateDriveFolder, deleteDriveFolder } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const folder = await getDriveFolder(Number(id));
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(folder);
}

// TECH AUDIT FIX: Added try/catch and safe JSON parsing
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // TECH AUDIT FIX: Cast body values to expected types for type safety
    const { name, icon, parentId, sortOrder } = body;
    await updateDriveFolder(numId, {
      ...(name !== undefined && { name: name as string }),
      ...(icon !== undefined && { icon: icon as string }),
      ...(parentId !== undefined && { parentId: parentId as number | null }),
      ...(sortOrder !== undefined && { sortOrder: sortOrder as number }),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/drive/folders/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and ID validation
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });
    await deleteDriveFolder(numId);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/drive/folders/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 });
  }
}
