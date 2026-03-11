import { NextResponse } from "next/server";
import { getImageGeneration, updateImageGeneration, deleteImageGeneration } from "@/lib/db/queries";
import { readFile, deleteFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and ID validation to GET
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const gen = await getImageGeneration(numId);
    if (!gen) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!gen.storagePath) {
      return NextResponse.json({ error: "No image stored" }, { status: 404 });
    }

    try {
      const buffer = await readFile(gen.storagePath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": gen.mimeType || "image/png",
          "Content-Length": String(buffer.length),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }
  } catch (error: unknown) {
    logger.error("GET /api/generate/image/generations/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch image generation";
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

    const gen = await getImageGeneration(numId);
    if (!gen) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.isFavorite !== undefined) updates.isFavorite = body.isFavorite;
    if (body.status !== undefined) updates.status = body.status;
    if (body.error !== undefined) updates.error = body.error;

    await updateImageGeneration(numId, updates);
    return NextResponse.json({ ...gen, ...updates });
  } catch (error: unknown) {
    logger.error("PATCH /api/generate/image/generations/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update image generation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and ID validation to DELETE
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const gen = await getImageGeneration(numId);
    if (!gen) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete file from disk
    if (gen.storagePath) {
      try { await deleteFile(gen.storagePath); } catch {}
    }

    await deleteImageGeneration(numId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/generate/image/generations/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete image generation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
