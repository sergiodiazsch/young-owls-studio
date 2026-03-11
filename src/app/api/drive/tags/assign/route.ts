import { NextResponse } from "next/server";
import { assignTag, unassignTag } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and safe JSON parsing
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { tagId, fileId, folderId } = body;
    if (!tagId) return NextResponse.json({ error: "tagId is required" }, { status: 400 });
    if (!fileId && !folderId) return NextResponse.json({ error: "fileId or folderId is required" }, { status: 400 });

    const assignment = await assignTag(tagId as number, { fileId: fileId as number | undefined, folderId: folderId as number | undefined });
    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    logger.error("POST /api/drive/tags/assign error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to assign tag" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and safe JSON parsing
export async function DELETE(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { tagId, fileId, folderId } = body;
    if (!tagId) return NextResponse.json({ error: "tagId is required" }, { status: 400 });

    await unassignTag(tagId as number, { fileId: fileId as number | undefined, folderId: folderId as number | undefined });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/drive/tags/assign error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to unassign tag" }, { status: 500 });
  }
}
