import { NextResponse } from "next/server";
import { submitVideoGeneration } from "@/lib/fal";
import { createVideoGeneration, updateVideoGeneration } from "@/lib/db/queries";
import { safeJson } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added proper types for request body
interface LipsyncParams {
  syncMode?: string;
  guidanceScale?: number;
  lipsyncPrompt?: string;
}

interface LipsyncBody {
  projectId: number;
  prompt?: string;
  model: string;
  params?: LipsyncParams;
  sourceVideoPath?: string;
  sourceImagePath?: string;
  sourceAudioPath?: string;
  text?: string;
}

export async function POST(req: Request) {
  const [body, err] = await safeJson<LipsyncBody>(req);
  if (err) return err;
  const { projectId, prompt, model, params, sourceVideoPath, sourceImagePath, sourceAudioPath, text } = body;

  if (!projectId || !model) {
    return NextResponse.json(
      { error: "projectId and model required" },
      { status: 400 }
    );
  }

  // Either video or image source must be provided
  if (!sourceVideoPath && !sourceImagePath) {
    return NextResponse.json(
      { error: "sourceVideoPath or sourceImagePath required" },
      { status: 400 }
    );
  }

  // Either audio or text (TTS) must be provided
  if (!sourceAudioPath && !text) {
    return NextResponse.json(
      { error: "sourceAudioPath or text (for TTS) required" },
      { status: 400 }
    );
  }

  const row = await createVideoGeneration({
    projectId,
    prompt: prompt || "Lipsync generation",
    model,
    mode: "lipsync",
    status: "submitted",
    params: params ? JSON.stringify(params) : undefined,
    sourceVideoPath: sourceVideoPath || undefined,
    sourceImagePath: sourceImagePath || undefined,
    sourceAudioPath,
  });

  try {
    const parsed = params || {};
    const result = await submitVideoGeneration({
      prompt: prompt || "Lipsync generation",
      model,
      mode: "lipsync",
      sourceVideoPath: sourceVideoPath || undefined,
      sourceImagePath: sourceImagePath || undefined,
      sourceAudioPath,
      syncMode: parsed.syncMode,
      guidanceScale: parsed.guidanceScale,
      text,
      lipsyncPrompt: parsed.lipsyncPrompt,
    });

    const lipsyncParams: Record<string, unknown> = parsed ? { ...parsed } : {};
    lipsyncParams._falResponseUrl = result.response_url;
    lipsyncParams._falStatusUrl = result.status_url;

    await updateVideoGeneration(row.id, {
      falRequestId: result.request_id,
      status: "submitted",
      params: JSON.stringify(lipsyncParams),
    });

    return NextResponse.json({
      ...row,
      falRequestId: result.request_id,
      status: "submitted",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lipsync submission failed";
    await updateVideoGeneration(row.id, { status: "failed", error: message });
    return NextResponse.json({ ...row, status: "failed", error: message }, { status: 500 });
  }
}
