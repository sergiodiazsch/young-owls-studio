import { NextResponse } from "next/server";
import { submitAvatarGeneration } from "@/lib/fal";
import { createVideoGeneration, updateVideoGeneration } from "@/lib/db/queries";
import { safeJson } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added proper types for request body
interface AvatarParams {
  duration?: number;
  aspectRatio?: string;
  cfgScale?: number;
  secondSourceImagePath?: string;
  secondSourceAudioPath?: string;
  speakerBoundingBoxes?: Array<{ x: number; y: number; w: number; h: number }>;
  resolution?: "480p" | "720p";
  negativePrompt?: string;
  poseStyle?: number;
  expressionScale?: number;
}

interface AvatarBody {
  projectId: number;
  model: string;
  sourceImagePath: string;
  sourceAudioPath: string;
  prompt?: string;
  params?: AvatarParams;
}

export async function POST(req: Request) {
  const [body, err] = await safeJson<AvatarBody>(req);
  if (err) return err;
  const {
    projectId,
    model,
    sourceImagePath,
    sourceAudioPath,
    prompt,
    params,
  } = body;

  if (!projectId || !model || !sourceImagePath || !sourceAudioPath) {
    return NextResponse.json(
      { error: "projectId, model, sourceImagePath, and sourceAudioPath required" },
      { status: 400 }
    );
  }

  const row = await createVideoGeneration({
    projectId,
    prompt: prompt || "Avatar generation",
    model,
    mode: "avatar",
    status: "submitted",
    params: params ? JSON.stringify(params) : undefined,
    sourceImagePath,
    sourceAudioPath,
  });

  try {
    const parsed = params || {};
    const result = await submitAvatarGeneration({
      model,
      sourceImagePath,
      sourceAudioPath,
      prompt,
      duration: parsed.duration,
      aspectRatio: parsed.aspectRatio,
      cfgScale: parsed.cfgScale,
      secondSourceImagePath: parsed.secondSourceImagePath,
      secondSourceAudioPath: parsed.secondSourceAudioPath,
      speakerBoundingBoxes: parsed.speakerBoundingBoxes,
      resolution: parsed.resolution,
      negativePrompt: parsed.negativePrompt,
      poseStyle: parsed.poseStyle,
      expressionScale: parsed.expressionScale,
    });

    const avatarParams: Record<string, unknown> = parsed ? { ...parsed } : {};
    avatarParams._falResponseUrl = result.response_url;
    avatarParams._falStatusUrl = result.status_url;

    await updateVideoGeneration(row.id, {
      falRequestId: result.request_id,
      status: "submitted",
      params: JSON.stringify(avatarParams),
    });

    return NextResponse.json({
      ...row,
      falRequestId: result.request_id,
      status: "submitted",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Avatar generation failed";
    await updateVideoGeneration(row.id, { status: "failed", error: message });
    return NextResponse.json({ ...row, status: "failed", error: message }, { status: 500 });
  }
}
