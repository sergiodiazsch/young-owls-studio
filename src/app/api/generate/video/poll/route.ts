import { NextResponse } from "next/server";
import { getVideoGeneration, updateVideoGeneration } from "@/lib/db/queries";
import { checkVideoStatus, getVideoResult, downloadFalVideo } from "@/lib/fal";
import { saveFile } from "@/lib/storage";
import { safeJson } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface PollBody {
  generationId: number;
}

// Max time a video can stay in processing before we consider it stale (30 min)
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

export async function POST(req: Request) {
  const [body, err] = await safeJson<PollBody>(req);
  if (err) return err;
  const { generationId } = body;
  if (!generationId) return NextResponse.json({ error: "generationId required" }, { status: 400 });

  const gen = await getVideoGeneration(generationId);
  if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!gen.falRequestId) return NextResponse.json({ error: "No fal request ID" }, { status: 400 });
  if (gen.status === "completed") {
    return NextResponse.json(gen);
  }

  // For "failed" generations: allow recovery if fal.ai might still have the result
  // Only skip recovery for definitive failures (fal.ai itself said FAILED, or missing URLs)
  const definiteFailures = [
    "Generation failed on fal.ai",
    "Missing fal.ai queue URLs",
    "No video URL in fal.ai result",
  ];
  if (gen.status === "failed") {
    const isDefinite = definiteFailures.some((f) => gen.error?.includes(f));
    if (isDefinite) {
      return NextResponse.json(gen);
    }
    // Transient failure — try to recover below
    logger.info(`[video-poll] Attempting recovery for gen ${gen.id} (error was: ${gen.error})`);
  }

  // Check for stale generations — if processing for too long, mark as failed
  const createdAt = gen.createdAt ? new Date(gen.createdAt).getTime() : 0;
  if (createdAt > 0 && Date.now() - createdAt > STALE_THRESHOLD_MS) {
    await updateVideoGeneration(gen.id, {
      status: "failed",
      error: "Generation timed out after 30 minutes — please try again",
    });
    return NextResponse.json({
      ...gen,
      status: "failed",
      error: "Generation timed out after 30 minutes — please try again",
    });
  }

  // Read fal.ai queue URLs stored during submit
  const savedParams = gen.params ? JSON.parse(gen.params) : {};
  const statusUrl = savedParams._falStatusUrl;
  const responseUrl = savedParams._falResponseUrl;

  if (!statusUrl || !responseUrl) {
    await updateVideoGeneration(gen.id, {
      status: "failed",
      error: "Missing fal.ai queue URLs — please regenerate this video",
    });
    return NextResponse.json({
      ...gen,
      status: "failed",
      error: "Missing fal.ai queue URLs — please regenerate this video",
    });
  }

  // Phase 1: Check status on fal.ai — transient errors here should NOT kill the generation
  let falStatus: string;
  try {
    const status = await checkVideoStatus(statusUrl);
    falStatus = status.status;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Status check failed";
    logger.warn(`[video-poll] Transient status check error for gen ${gen.id}: ${message}`);
    // Return current DB status — don't mark as failed for transient network errors
    return NextResponse.json({ ...gen, status: gen.status });
  }

  if (falStatus === "IN_QUEUE" || falStatus === "IN_PROGRESS") {
    const newStatus = falStatus === "IN_QUEUE" ? "submitted" : "processing";
    if (gen.status !== newStatus) {
      await updateVideoGeneration(gen.id, { status: newStatus });
    }
    return NextResponse.json({ ...gen, status: newStatus });
  }

  if (falStatus === "FAILED") {
    await updateVideoGeneration(gen.id, { status: "failed", error: "Generation failed on fal.ai" });
    return NextResponse.json({ ...gen, status: "failed", error: "Generation failed on fal.ai" });
  }

  if (falStatus !== "COMPLETED") {
    return NextResponse.json({ ...gen, status: gen.status });
  }

  // Phase 2: COMPLETED — fetch result and download video
  // Errors here ARE more serious but we still give one grace period
  try {
    const result = await getVideoResult(responseUrl);
    const videoUrl = result.video?.url;
    if (!videoUrl) {
      await updateVideoGeneration(gen.id, { status: "failed", error: "No video URL in fal.ai result" });
      return NextResponse.json({ ...gen, status: "failed", error: "No video URL in fal.ai result" }, { status: 500 });
    }

    const { buffer, contentType } = await downloadFalVideo(videoUrl);
    const filename = `video-${gen.id}-${Date.now()}.mp4`;
    const { storagePath, fileSize } = await saveFile(gen.projectId, filename, buffer);

    await updateVideoGeneration(gen.id, {
      status: "completed",
      storagePath,
      mimeType: contentType,
      fileSize,
      seed: result.seed,
    });

    return NextResponse.json({
      ...gen,
      status: "completed",
      storagePath,
      mimeType: contentType,
      fileSize,
      seed: result.seed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Download failed";
    logger.error(`[video-poll] Download/save error for gen ${gen.id}: ${message}`);
    // For download errors: return processing status so the next poll retries
    // The stale check above will eventually catch truly stuck ones
    return NextResponse.json({ ...gen, status: "processing" });
  }
}
