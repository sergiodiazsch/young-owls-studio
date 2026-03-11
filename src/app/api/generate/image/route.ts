import { NextResponse } from "next/server";
import { generateImage, downloadFalImage, getModelConfig } from "@/lib/fal";
import { createImageGeneration, updateImageGeneration } from "@/lib/db/queries";
import { saveFile } from "@/lib/storage";
import { safeJson } from "@/lib/api-utils";
import { rateLimit } from "@/lib/rate-limit";
import { appendCharacterNotes } from "@/lib/ai-prompt-utils";

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added proper types for request body
interface ImageGenParams {
  resolution?: string;
  aspectRatio?: string;
  enableWebSearch?: boolean;
  enhancePrompt?: boolean;
  referenceImages?: string[];
  seed?: number;
  azimuth?: number;
  elevation?: number;
  distance?: number;
  sourceImagePath?: string;
}

interface ImageGenBody {
  projectId: number;
  prompt: string;
  model?: string;
  params?: ImageGenParams;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anonymous";
  const { success } = limiter.check(10, ip);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  const [body, err] = await safeJson<ImageGenBody>(req);
  if (err) return err;
  const { projectId, prompt, model, params } = body;

  if (!prompt || !projectId) {
    return NextResponse.json({ error: "prompt and projectId required" }, { status: 400 });
  }

  // Append character AI generation notes for any @mentioned characters
  const enhancedPrompt = await appendCharacterNotes(prompt, projectId);

  // Calculate cost from model config
  const modelId = model || "nano-banana-pro";
  let cost: number | undefined;
  try {
    const cfg = getModelConfig(modelId);
    cost = parseFloat(cfg.cost.replace(/[^0-9.]/g, "")) || undefined;
  } catch { /* unknown model, skip cost */ }

  // Create DB row immediately so the UI can track it
  const row = await createImageGeneration({
    projectId,
    prompt,
    model: modelId,
    status: "generating",
    params: params ? JSON.stringify(params) : undefined,
    cost,
  });

  try {
    const parsed = params || {};
    const result = await generateImage({
      prompt: enhancedPrompt,
      model: model || "nano-banana-pro",
      resolution: parsed.resolution,
      aspectRatio: parsed.aspectRatio,
      enableWebSearch: parsed.enableWebSearch,
      enhancePrompt: parsed.enhancePrompt,
      referenceImages: parsed.referenceImages,
      seed: parsed.seed,
      azimuth: parsed.azimuth,
      elevation: parsed.elevation,
      distance: parsed.distance,
      sourceImagePath: parsed.sourceImagePath,
    });

    const imageUrl = result.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL returned from fal.ai");

    // Download and save to local storage immediately
    const { buffer, contentType } = await downloadFalImage(imageUrl);
    const filename = `gen-${row.id}-${Date.now()}.png`;
    const { storagePath, fileSize } = await saveFile(projectId, filename, buffer);

    await updateImageGeneration(row.id, {
      status: "completed",
      storagePath,
      mimeType: contentType,
      fileSize,
      seed: result.seed,
    });

    return NextResponse.json({
      ...row,
      status: "completed",
      storagePath,
      mimeType: contentType,
      fileSize,
      seed: result.seed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    await updateImageGeneration(row.id, { status: "failed", error: message });
    return NextResponse.json({
      ...row,
      status: "failed",
      error: message,
    }, { status: 500 });
  }
}
