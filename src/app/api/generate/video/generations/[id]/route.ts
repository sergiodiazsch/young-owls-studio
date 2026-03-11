import { NextResponse } from "next/server";
import { getVideoGeneration, updateVideoGeneration, deleteVideoGeneration } from "@/lib/db/queries";
import { readFile, deleteFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and ID validation to GET
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const gen = await getVideoGeneration(numId);
    if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!gen.storagePath) {
      return NextResponse.json({ error: "Video not ready" }, { status: 404 });
    }

    try {
      const buffer = await readFile(gen.storagePath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": gen.mimeType || "video/mp4",
          "Content-Length": String(buffer.length),
          "Content-Disposition": `inline; filename="video-${gen.id}.mp4"`,
        },
      });
    } catch {
      return NextResponse.json({ error: "Video file not found on disk" }, { status: 404 });
    }
  } catch (error: unknown) {
    logger.error("GET /api/generate/video/generations/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch video generation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch, safe JSON parsing, and ID validation to PATCH
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { status, error, isFavorite, tags } = body;
    await updateVideoGeneration(numId, {
      ...(status !== undefined && { status: String(status) }),
      ...(error !== undefined && { error: error === null ? "" : String(error) }),
      ...(isFavorite !== undefined && { isFavorite: Boolean(isFavorite) }),
      ...(tags !== undefined && { tags: String(tags) }),
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("PATCH /api/generate/video/generations/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update video generation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and ID validation to DELETE
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const gen = await getVideoGeneration(numId);
    if (gen?.storagePath) {
      try { await deleteFile(gen.storagePath); } catch {}
    }
    await deleteVideoGeneration(numId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/generate/video/generations/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete video generation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
