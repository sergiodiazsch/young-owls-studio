import { NextResponse } from "next/server";
import { generateSpeech } from "@/lib/elevenlabs";
import { createVoiceGeneration } from "@/lib/db/queries";
import { saveFile } from "@/lib/storage";
import { safeJson } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface BulkItem {
  dialogueId: number;
  voiceId: string;
  text: string;
}

interface BulkGenerateBody {
  projectId: number;
  sceneId: number;
  items: BulkItem[];
}

interface BulkResult {
  dialogueId: number;
  status: "success" | "error";
  error?: string;
}

export async function POST(req: Request) {
  try {
    const [body, err] = await safeJson<BulkGenerateBody>(req);
    if (err) return err;

    const { projectId, sceneId, items } = body;
    if (!projectId || !sceneId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "projectId, sceneId, and items required" }, { status: 400 });
    }

    if (items.length > 50) {
      return NextResponse.json({ error: "Maximum 50 items per bulk request" }, { status: 400 });
    }

    const results: BulkResult[] = [];

    for (const item of items) {
      try {
        if (!item.voiceId || !item.text || !item.dialogueId) {
          results.push({ dialogueId: item.dialogueId, status: "error", error: "Missing voiceId, text, or dialogueId" });
          continue;
        }

        // Generate 1 option per dialogue in bulk mode (faster)
        const audioBuffer = await generateSpeech(item.voiceId, item.text);
        const { storagePath, fileSize } = await saveFile(projectId, `voice-${item.dialogueId}-bulk-${Date.now()}.mp3`, audioBuffer);

        await createVoiceGeneration({
          dialogueId: item.dialogueId,
          projectId,
          sceneId,
          voiceId: item.voiceId,
          modelId: "eleven_v3",
          inputText: item.text,
          optionIndex: 0,
          storagePath,
          fileSize,
        });

        results.push({ dialogueId: item.dialogueId, status: "success" });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Generation failed";
        results.push({ dialogueId: item.dialogueId, status: "error", error: msg });
        logger.error("Bulk voice generation item failed", { dialogueId: item.dialogueId, error: msg });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return NextResponse.json({ results, successCount, errorCount }, { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/voices/generate-bulk error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Bulk generation failed" }, { status: 500 });
  }
}
