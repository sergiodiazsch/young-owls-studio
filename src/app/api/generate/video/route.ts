import { NextResponse } from "next/server";
import { submitVideoGeneration } from "@/lib/fal";
import { createVideoGeneration, updateVideoGeneration } from "@/lib/db/queries";
import { safeJson } from "@/lib/api-utils";
import { appendCharacterNotes } from "@/lib/ai-prompt-utils";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added proper types for request body
interface VideoGenParams {
  duration?: number;
  aspectRatio?: string;
  negativePrompt?: string;
  enableAudio?: boolean;
  elements?: string[];
  multiPrompt?: Array<{ prompt: string; duration: number }>;
  cfgScale?: number;
  endImagePath?: string;
  voiceIds?: string[];
  shotType?: string;
}

interface VideoGenBody {
  projectId: number;
  prompt: string;
  model: string;
  params?: VideoGenParams;
  sourceImagePath: string;
}

export async function POST(req: Request) {
  const [body, err] = await safeJson<VideoGenBody>(req);
  if (err) return err;
  const { projectId, prompt, model, params, sourceImagePath } = body;

  if (!prompt || !projectId || !model) {
    return NextResponse.json({ error: "prompt, projectId, and model required" }, { status: 400 });
  }

  if (!sourceImagePath) {
    return NextResponse.json({ error: "sourceImagePath required for image-to-video" }, { status: 400 });
  }

  // Append character AI generation notes for any @mentioned characters
  const enhancedPrompt = await appendCharacterNotes(prompt, projectId);

  const row = await createVideoGeneration({
    projectId,
    prompt,
    model,
    mode: "image-to-video",
    status: "submitted",
    params: params ? JSON.stringify(params) : undefined,
    sourceImagePath,
  });

  try {
    const parsed = params || {};
    const result = await submitVideoGeneration({
      prompt: enhancedPrompt,
      model,
      mode: "image-to-video",
      duration: parsed.duration,
      aspectRatio: parsed.aspectRatio,
      negativePrompt: parsed.negativePrompt,
      enableAudio: parsed.enableAudio,
      sourceImagePath,
      elements: parsed.elements,
      multiPrompt: parsed.multiPrompt,
      cfgScale: parsed.cfgScale,
      endImagePath: parsed.endImagePath,
      voiceIds: parsed.voiceIds,
      shotType: parsed.shotType,
    });

    // Store fal.ai queue URLs for correct polling
    const existingParams: Record<string, unknown> = params ? { ...params } : {};
    existingParams._falResponseUrl = result.response_url;
    existingParams._falStatusUrl = result.status_url;

    await updateVideoGeneration(row.id, {
      falRequestId: result.request_id,
      status: "submitted",
      params: JSON.stringify(existingParams),
    });

    return NextResponse.json({
      ...row,
      falRequestId: result.request_id,
      status: "submitted",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Video generation failed";
    await updateVideoGeneration(row.id, { status: "failed", error: message });
    return NextResponse.json({ ...row, status: "failed", error: message }, { status: 500 });
  }
}
