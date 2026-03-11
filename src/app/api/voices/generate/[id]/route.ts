import { NextResponse } from "next/server";
import { getVoiceGeneration, updateVoiceGeneration, deleteVoiceGeneration } from "@/lib/db/queries";
import { readFile, deleteFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and ID validation to GET
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const gen = await getVoiceGeneration(numId);
    if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const audioPath = gen.paddedStoragePath || gen.storagePath;
    try {
      const buffer = await readFile(audioPath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": gen.mimeType,
          "Content-Length": String(buffer.length),
        },
      });
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
  } catch (error: unknown) {
    logger.error("GET /api/voices/generate/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch voice generation";
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

    const { paddedStoragePath, paddingStart, paddingEnd, paddedFileSize } = body;
    // TECH AUDIT FIX: cast body values from unknown to expected types for updateVoiceGeneration
    await updateVoiceGeneration(numId, {
      ...(paddedStoragePath !== undefined && { paddedStoragePath: String(paddedStoragePath) }),
      ...(paddingStart !== undefined && { paddingStart: Number(paddingStart) }),
      ...(paddingEnd !== undefined && { paddingEnd: Number(paddingEnd) }),
      ...(paddedFileSize !== undefined && { paddedFileSize: Number(paddedFileSize) }),
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("PATCH /api/voices/generate/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update voice generation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and ID validation to DELETE
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const gen = await getVoiceGeneration(numId);
    if (gen) {
      try { await deleteFile(gen.storagePath); } catch {}
      if (gen.paddedStoragePath) {
        try { await deleteFile(gen.paddedStoragePath); } catch {}
      }
      await deleteVoiceGeneration(numId);
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/voices/generate/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete voice generation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
