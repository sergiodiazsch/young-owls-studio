import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db/queries";
import { saveFile } from "@/lib/storage";
import { tlsFetch } from "@/lib/fetch-tls";
import { logger } from "@/lib/logger";
import { db, ensureSchema } from "@/lib/db";
import { audioStudioGenerations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AudioGenerateBody {
  projectId: number;
  prompt: string;
  type?: string;
  durationSeconds?: number;
  promptInfluence?: number;
  negativePrompt?: string;
}

// ── ElevenLabs Sound Effects (fast, completes in seconds) ──

async function generateSoundEffect(
  prompt: string,
  durationSeconds?: number,
  promptInfluence?: number
): Promise<Buffer> {
  const setting = await getSetting("elevenlabs_api_key");
  const apiKey = setting?.value || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ElevenLabs API key not configured. Go to Settings or set ELEVENLABS_API_KEY env var.");

  const body: Record<string, unknown> = { text: prompt };
  if (durationSeconds) body.duration_seconds = durationSeconds;
  if (promptInfluence !== undefined) body.prompt_influence = promptInfluence;

  const res = await tlsFetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error("ElevenLabs: Invalid API key — check Settings");
    if (res.status === 402 || res.status === 403) throw new Error("ElevenLabs: Insufficient credits or plan limit reached");
    if (res.status === 429) throw new Error("ElevenLabs: Rate limit exceeded — wait and try again");
    throw new Error(`ElevenLabs SFX error: ${res.status} ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── POST handler ──
// SFX: generate synchronously and return result (fast, ~5s)
// Music: submit to fal.ai queue and return requestId for client-side polling

export async function POST(req: Request) {
  let body: AudioGenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { projectId, prompt, type, durationSeconds, promptInfluence, negativePrompt } = body;

  if (!projectId || !prompt) {
    return NextResponse.json({ error: "projectId and prompt are required" }, { status: 400 });
  }

  try {
    await ensureSchema();

    // Create DB record
    const [row] = await db.insert(audioStudioGenerations).values({
      projectId: Number(projectId),
      prompt,
      type: type === "sfx" ? "sfx" : "music",
      status: "generating",
      generatedBy: type === "sfx" ? "elevenlabs" : "fal.ai",
      durationSeconds: durationSeconds || null,
    }).returning();

    if (type === "sfx") {
      // SFX: synchronous — ElevenLabs is fast
      const buffer = await generateSoundEffect(prompt, durationSeconds, promptInfluence);
      if (!buffer || buffer.length === 0) {
        await db.update(audioStudioGenerations).set({ status: "failed", error: "ElevenLabs returned empty audio" }).where(eq(audioStudioGenerations.id, row.id));
        return NextResponse.json({ error: "ElevenLabs returned empty audio response" }, { status: 502 });
      }
      const filename = `sfx-${Date.now()}.mp3`;
      const saved = await saveFile(Number(projectId), filename, buffer);

      await db.update(audioStudioGenerations).set({
        status: "completed",
        storagePath: saved.storagePath,
        filename,
        mimeType: "audio/mpeg",
        fileSize: saved.fileSize,
      }).where(eq(audioStudioGenerations.id, row.id));

      return NextResponse.json({
        id: row.id,
        status: "completed",
        storagePath: saved.storagePath,
        filename,
        mimeType: "audio/mpeg",
        fileSize: saved.fileSize,
      });
    } else {
      // Music: submit to fal.ai queue, return immediately for client polling
      const falSetting = await getSetting("fal_api_key");
      const falKey = falSetting?.value || process.env.FAL_KEY;
      if (!falKey) throw new Error("fal.ai API key not configured. Go to Settings or set FAL_KEY env var.");

      const falBody: Record<string, unknown> = {
        prompt,
        seconds_total: durationSeconds || 30,
      };
      if (negativePrompt) falBody.negative_prompt = negativePrompt;

      const submitRes = await fetch("https://queue.fal.run/fal-ai/stable-audio", {
        method: "POST",
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(falBody),
      });

      if (!submitRes.ok) {
        const text = await submitRes.text();
        await db.update(audioStudioGenerations).set({ status: "failed", error: `fal.ai submit error: ${submitRes.status}` }).where(eq(audioStudioGenerations.id, row.id));
        if (submitRes.status === 401 || submitRes.status === 403) throw new Error("fal.ai: Invalid API key or expired — check Settings");
        if (submitRes.status === 402) throw new Error("fal.ai: Insufficient credits — add funds at fal.ai/dashboard/billing");
        throw new Error(`fal.ai error ${submitRes.status}: ${text.slice(0, 200)}`);
      }

      const queueData = await submitRes.json() as { request_id: string; status_url?: string; response_url?: string };

      // Save queue URLs in the DB record for polling
      const statusUrl = queueData.status_url || `https://queue.fal.run/fal-ai/stable-audio/requests/${queueData.request_id}/status`;
      const responseUrl = queueData.response_url || `https://queue.fal.run/fal-ai/stable-audio/requests/${queueData.request_id}`;

      await db.update(audioStudioGenerations).set({
        status: "generating",
        error: JSON.stringify({ statusUrl, responseUrl, requestId: queueData.request_id }),
      }).where(eq(audioStudioGenerations.id, row.id));

      return NextResponse.json({
        id: row.id,
        status: "generating",
        requestId: queueData.request_id,
      });
    }
  } catch (error: unknown) {
    logger.error("Audio generation error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Audio generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
