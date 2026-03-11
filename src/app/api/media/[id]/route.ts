import { NextResponse } from "next/server";
import { getMediaById, updateMedia, deleteMedia } from "@/lib/db/queries";
import { readFile, deleteFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and ID validation to GET
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid media ID" }, { status: 400 });

    const record = await getMediaById(numId);
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    try {
      const buffer = await readFile(record.storagePath);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": record.mimeType,
          "Content-Disposition": `inline; filename="${record.filename.replace(/["\r\n]/g, "_")}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }
  } catch (error: unknown) {
    logger.error("GET /api/media/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch media";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and safe JSON parsing
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid media ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { sceneId, caption } = body;
    // TECH AUDIT FIX: cast body values from unknown to expected types for updateMedia
    await updateMedia(numId, {
      ...(sceneId !== undefined && { sceneId: sceneId === null ? null : Number(sceneId) }),
      ...(caption !== undefined && { caption: caption === null ? null : String(caption) }),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/media/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update media" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and ID validation to DELETE
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid media ID" }, { status: 400 });

    const record = await getMediaById(numId);
    if (record) {
      try { await deleteFile(record.storagePath); } catch {}
      await deleteMedia(numId);
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/media/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete media";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
