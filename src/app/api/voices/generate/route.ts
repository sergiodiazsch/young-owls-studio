import { NextResponse } from "next/server";
import { generateSpeech } from "@/lib/elevenlabs";
import { createVoiceGeneration } from "@/lib/db/queries";
import { saveFile } from "@/lib/storage";
import { safeJson } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added proper types for request body
interface VoiceGenerateBody {
  dialogueId: number;
  projectId: number;
  sceneId: number;
  voiceId: string;
  text: string;
  modelId?: string;
}

export async function POST(req: Request) {
  const [body, err] = await safeJson<VoiceGenerateBody>(req);
  if (err) return err;
  const { dialogueId, projectId, sceneId, voiceId, text, modelId } = body;

  if (!voiceId || !text || !dialogueId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const generations = [];

    // Generate 2 options
    for (let i = 0; i < 2; i++) {
      const audioBuffer = await generateSpeech(voiceId, text, { modelId });
      const { storagePath, fileSize } = await saveFile(projectId, `voice-${dialogueId}-opt${i}-${Date.now()}.mp3`, audioBuffer);

      const gen = await createVoiceGeneration({
        dialogueId,
        projectId,
        sceneId,
        voiceId,
        modelId: modelId || "eleven_v3",
        inputText: text,
        optionIndex: i,
        storagePath,
        fileSize,
      });

      generations.push(gen);
    }

    return NextResponse.json(generations, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate voice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
