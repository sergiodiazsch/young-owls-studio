import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db/queries";
import { saveFile } from "@/lib/storage";
import { tlsFetch } from "@/lib/fetch-tls";
import { logger } from "@/lib/logger";
import { db, ensureSchema } from "@/lib/db";
import { audioStudioGenerations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { generationId: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { generationId } = body;
  if (!generationId) return NextResponse.json({ error: "generationId required" }, { status: 400 });

  try {
    await ensureSchema();

    const [gen] = await db.select().from(audioStudioGenerations).where(eq(audioStudioGenerations.id, generationId));
    if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Already done
    if (gen.status === "completed" || gen.status === "failed") {
      return NextResponse.json(gen);
    }

    // Parse the queue URLs from the error field (used as temp storage)
    let queueInfo: { statusUrl?: string; responseUrl?: string; requestId?: string } = {};
    try {
      if (gen.error) queueInfo = JSON.parse(gen.error);
    } catch { /* not JSON */ }

    if (!queueInfo.statusUrl || !queueInfo.responseUrl) {
      await db.update(audioStudioGenerations).set({ status: "failed", error: "Missing queue URLs" }).where(eq(audioStudioGenerations.id, gen.id));
      return NextResponse.json({ ...gen, status: "failed", error: "Missing queue URLs — try generating again" });
    }

    const setting = await getSetting("fal_api_key");
    if (!setting?.value) throw new Error("fal.ai API key not configured.");
    const apiKey = setting.value;

    // Check status
    const statusRes = await fetch(queueInfo.statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    });

    if (!statusRes.ok) {
      // Transient error — return current status
      return NextResponse.json({ ...gen, status: "generating" });
    }

    const statusData = await statusRes.json() as Record<string, unknown>;
    const rawStatus = ((statusData.status as string) || "").toUpperCase();

    if (rawStatus === "IN_QUEUE" || rawStatus === "IN_PROGRESS") {
      return NextResponse.json({ ...gen, status: "generating" });
    }

    if (rawStatus === "FAILED") {
      await db.update(audioStudioGenerations).set({ status: "failed", error: "fal.ai: Music generation failed" }).where(eq(audioStudioGenerations.id, gen.id));
      return NextResponse.json({ ...gen, status: "failed", error: "fal.ai: Music generation failed" });
    }

    if (rawStatus === "COMPLETED") {
      // Fetch result
      const resultRes = await fetch(queueInfo.responseUrl, {
        headers: { Authorization: `Key ${apiKey}` },
      });

      if (!resultRes.ok) {
        const text = await resultRes.text();
        throw new Error(`Failed to fetch result: ${text.slice(0, 200)}`);
      }

      const data = await resultRes.json() as Record<string, unknown>;
      const audioFile = data.audio_file as { url?: string } | undefined;
      const audio = data.audio as { url?: string } | undefined;
      const directUrl = data.url as string | undefined;
      const url = audioFile?.url || audio?.url || directUrl;

      if (!url) throw new Error(`No audio URL in result. Keys: ${Object.keys(data).join(", ")}`);

      // Download and save
      const audioRes = await tlsFetch(url);
      if (!audioRes.ok) throw new Error("Failed to download generated audio");
      const arrayBuffer = await audioRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const contentType = audioRes.headers.get("content-type") || "audio/wav";
      const ext = contentType.includes("wav") ? "wav" : contentType.includes("mp3") ? "mp3" : "wav";
      const filename = `music-${gen.id}-${Date.now()}.${ext}`;
      const saved = await saveFile(gen.projectId, filename, buffer);

      await db.update(audioStudioGenerations).set({
        status: "completed",
        storagePath: saved.storagePath,
        filename,
        mimeType: contentType,
        fileSize: saved.fileSize,
        error: null, // clear the queue URLs
      }).where(eq(audioStudioGenerations.id, gen.id));

      return NextResponse.json({
        ...gen,
        status: "completed",
        storagePath: saved.storagePath,
        filename,
        mimeType: contentType,
        fileSize: saved.fileSize,
      });
    }

    // Unknown status
    return NextResponse.json({ ...gen, status: "generating" });
  } catch (error: unknown) {
    logger.error("Audio poll error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Poll failed";

    try {
      await db.update(audioStudioGenerations).set({ status: "failed", error: message }).where(eq(audioStudioGenerations.id, generationId));
    } catch { /* ignore */ }

    return NextResponse.json({ status: "failed", error: message }, { status: 500 });
  }
}
