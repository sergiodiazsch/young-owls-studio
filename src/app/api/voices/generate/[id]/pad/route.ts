import { NextResponse } from "next/server";
import { getVoiceGeneration, updateVoiceGeneration } from "@/lib/db/queries";
import { padAudio } from "@/lib/audio";
import { deleteFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added outer try/catch, safe JSON parsing, and ID validation
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { paddingStart, paddingEnd } = body;

    const gen = await getVoiceGeneration(numId);
    if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Remove old padded file if exists
    if (gen.paddedStoragePath) {
      try { await deleteFile(gen.paddedStoragePath); } catch {}
    }

    // TECH AUDIT FIX: cast body values from unknown to number for padAudio and updateVoiceGeneration
    const padStart = Number(paddingStart) || 0;
    const padEnd = Number(paddingEnd) || 0;

    const { storagePath, fileSize } = await padAudio(gen.storagePath, padStart, padEnd);

    await updateVoiceGeneration(numId, {
      paddedStoragePath: storagePath,
      paddingStart: padStart,
      paddingEnd: padEnd,
      paddedFileSize: fileSize,
    });

    return NextResponse.json({ success: true, storagePath, fileSize });
  } catch (error: unknown) {
    logger.error("POST /api/voices/generate/[id]/pad error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to pad audio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
